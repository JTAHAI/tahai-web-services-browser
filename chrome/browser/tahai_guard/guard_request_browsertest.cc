// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include <atomic>
#include <memory>
#include <string>

#include "base/functional/bind.h"
#include "base/test/run_until.h"
#include "base/test/test_future.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/policy/policy_test_utils.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_test_util.h"
#include "chrome/browser/tahai_guard/guard_profile_service.h"
#include "chrome/browser/tahai_guard/guard_profile_service_factory.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration_registry.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_guard_panel.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "chrome/browser/ui/toolbar/app_menu_model.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/test/base/ui_test_utils.h"
#include "components/policy/core/common/policy_map.h"
#include "components/policy/policy_constants.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "content/public/test/browser_test.h"
#include "content/public/test/browser_test_utils.h"
#include "content/public/test/no_renderer_crashes_assertion.h"
#include "content/public/test/test_navigation_observer.h"
#include "net/base/net_errors.h"
#include "net/dns/mock_host_resolver.h"
#include "net/test/embedded_test_server/embedded_test_server.h"
#include "net/test/embedded_test_server/http_request.h"
#include "net/test/embedded_test_server/http_response.h"
#include "ui/views/controls/button/label_button.h"
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/test/button_test_api.h"
#include "ui/views/test/widget_test.h"
#include "ui/views/widget/widget.h"

namespace tahai::guard {
namespace {

using Update = GuardProfileService::UpdateResult;

base::DictValue ManagedConfiguration(std::string mode = "custom") {
  base::DictValue value;
  value.Set("schema_version", 1);
  value.Set("mode", std::move(mode));
  value.Set("local_statistics_enabled", false);
  value.Set("site_overrides", base::ListValue());
  return value;
}

class TahaiGuardRequestBrowserTest : public policy::PolicyTest {
 public:
  void SetUpOnMainThread() override {
    PolicyTest::SetUpOnMainThread();
    host_resolver()->AddRule("*", "127.0.0.1");
    server_.SetSSLConfig(net::EmbeddedTestServer::CERT_TEST_NAMES);
    server_.RegisterRequestHandler(base::BindRepeating(
        &TahaiGuardRequestBrowserTest::Handle, base::Unretained(this)));
    ASSERT_TRUE(server_.Start());
    TahaiGuardConfiguration configuration;
    configuration.mode = TahaiGuardMode::kCustom;
    ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                     configuration));
    ASSERT_TRUE(Service()->ClearCustomRules());
  }

 protected:
  void RegisterHandlers(net::EmbeddedTestServer& server) {
    server.RegisterRequestHandler(base::BindRepeating(
        &TahaiGuardRequestBrowserTest::Handle, base::Unretained(this)));
  }

  GuardProfileService* Service() {
    return GuardProfileServiceFactory::GetForProfile(browser()->GetProfile());
  }

  content::WebContents* Contents(Browser* target = nullptr) {
    return (target ? target : browser())
        ->tab_strip_model()
        ->GetActiveWebContents();
  }

  views::Widget* GuardPanel(Browser* target) {
    for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
             target->GetWindow()->GetNativeWindow())) {
      views::Widget* widget = widget_ptr.get();
      if (widget->IsVisible() &&
          views::ElementTrackerViews::GetInstance()->GetFirstMatchingView(
              kGuardPanelElementId,
              views::ElementTrackerViews::GetContextForWidget(widget), false)) {
        return widget;
      }
    }
    return nullptr;
  }

  GURL Page(const std::string& host = "a.test") {
    return server_.GetURL(host, "/guard/page");
  }

  Update Install(const std::string& rules = "/guard/blocked") {
    base::test::TestFuture<Update> result;
    Service()->InstallCustomRules(rules, result.GetCallback());
    return result.Get();
  }

  void EnableDecisionCounters() {
    auto configuration =
        GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
    configuration.local_statistics_enabled = true;
    ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                     configuration));
  }

  bool Fetch(const std::string& path, Browser* target = nullptr) {
    return content::EvalJs(
               Contents(target),
               content::JsReplace("fetch($1, {cache:'no-store'}).then(r => "
                                  "r.text()).then(() => true, () => false)",
                                  path))
        .ExtractBool();
  }

  bool WaitForHidden(bool hidden, Browser* target = nullptr) {
    return content::EvalJs(Contents(target), content::JsReplace(R"JS(
      new Promise(resolve => {
        let attempts = 0;
        function check() {
          const element = document.querySelector('.tahai-ad');
          if (element && (getComputedStyle(element).display === 'none') === $1)
            return resolve(true);
          if (++attempts > 150) return resolve(false);
          setTimeout(check, 20);
        }
        check();
      })
    )JS",
                                                                hidden))
        .ExtractBool();
  }

  std::unique_ptr<net::test_server::HttpResponse> Handle(
      const net::test_server::HttpRequest& request) {
    auto response = std::make_unique<net::test_server::BasicHttpResponse>();
    response->AddCustomHeader("Access-Control-Allow-Origin", "*");
    response->AddCustomHeader("Cache-Control",
                              request.relative_url == "/guard/cacheable-page"
                                  ? "max-age=60"
                                  : "no-store");
    response->set_code(net::HTTP_OK);
    response->set_content_type("text/html");
    response->set_content("<!doctype html><title>Guard fixture</title>");
    if (request.relative_url.starts_with("/guard/blocked")) {
      ++blocked_hits_;
      response->set_content_type("text/javascript");
      response->set_content("self.fixtureLoaded = true;");
    } else if (request.relative_url == "/guard/control") {
      ++control_hits_;
    } else if (request.relative_url == "/guard/redirect") {
      response->set_code(net::HTTP_TEMPORARY_REDIRECT);
      response->AddCustomHeader("Location", "/guard/blocked");
    } else if (request.relative_url == "/guard/frame") {
      response->set_content(
          "<!doctype html><script>fetch('/guard/blocked',{cache:'no-store'})"
          ".then(r=>r.text()).then(()=>parent.postMessage(true,'*'),"
          "()=>parent.postMessage(false,'*'));</script>");
    } else if (request.relative_url == "/guard/worker.js") {
      response->set_content_type("text/javascript");
      response->set_content(
          "fetch('/guard/blocked', {cache:'no-store'}).then(r=>r.text())"
          ".then(()=>postMessage(true),()=>postMessage(false));");
    } else if (request.relative_url == "/guard/shared.js") {
      response->set_content_type("text/javascript");
      response->set_content(
          "onconnect=e=>{const p=e.ports[0];fetch('/guard/blocked',"
          "{cache:'no-store'}).then(r=>r.text())"
          ".then(()=>p.postMessage(true),()=>p.postMessage(false));};");
    } else if (request.relative_url == "/guard/sw.js") {
      response->set_content_type("text/javascript");
      response->set_content(
          "self.addEventListener('install',()=>self.skipWaiting());"
          "self.addEventListener('activate',e=>e.waitUntil(clients.claim()));"
          "self.addEventListener('message',e=>{e.waitUntil("
          "fetch('/guard/blocked',{cache:'no-store'}).then(r=>r.text())"
          ".then(()=>e.ports[0].postMessage(true),"
          "()=>e.ports[0].postMessage(false)));});");
    }
    return response;
  }

  std::atomic_int blocked_hits_{0};
  std::atomic_int control_hits_{0};
  net::EmbeddedTestServer server_{net::EmbeddedTestServer::TYPE_HTTPS};
};

// All these cases exercise production factory interception and a real sandbox
// engine. Merely compiling/grepping this file does not prove that a case
// passed.
IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiFetchBlocksBeforeNetworkAndOffRestores) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0, blocked_hits_.load());
  auto configuration =
      GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  configuration.mode = TahaiGuardMode::kOff;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  EXPECT_TRUE(Fetch("/guard/blocked"));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiBundledBalancedAndStrictRulesBlockRequests) {
  // Use HTTP for arbitrary list domains: the HTTPS fixture certificate does
  // not cover them. Positive controls prove neither TLS nor CORS caused a
  // block.
  net::EmbeddedTestServer http_server;
  RegisterHandlers(http_server);
  ASSERT_TRUE(http_server.Start());
  auto configuration =
      GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  configuration.mode = TahaiGuardMode::kBalanced;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return Service()->GetSnapshot().status ==
           GuardProfileService::Status::kReady;
  }));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      browser(), http_server.GetURL("a.test", "/guard/page")));
  EXPECT_FALSE(
      Fetch(http_server.GetURL("doubleclick.net", "/guard/blocked").spec()));
  EXPECT_EQ(0, blocked_hits_.load());
  // This host is present in the pinned EasyList snapshot, not TAHAI's small
  // baseline. Keep a successful Off control below so fixture failures cannot
  // masquerade as filtering.
  EXPECT_GT(Service()->GetSnapshot().accepted_rules, 50000u);
  EXPECT_FALSE(
      Fetch(http_server.GetURL("000491b06a.com", "/guard/blocked").spec()));
  EXPECT_EQ(0, blocked_hits_.load());
  EXPECT_TRUE(
      Fetch(http_server.GetURL("newrelic.com", "/guard/blocked").spec()));
  EXPECT_EQ(1, blocked_hits_.load());

  configuration.mode = TahaiGuardMode::kStrict;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return Service()->GetSnapshot().status ==
           GuardProfileService::Status::kReady;
  }));
  EXPECT_FALSE(
      Fetch(http_server.GetURL("newrelic.com", "/guard/blocked").spec()));
  EXPECT_EQ(1, blocked_hits_.load());

  configuration.mode = TahaiGuardMode::kOff;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  EXPECT_TRUE(
      Fetch(http_server.GetURL("doubleclick.net", "/guard/blocked").spec()));
  EXPECT_TRUE(
      Fetch(http_server.GetURL("newrelic.com", "/guard/blocked").spec()));
  EXPECT_EQ(3, blocked_hits_.load());
  EXPECT_TRUE(
      Fetch(http_server.GetURL("000491b06a.com", "/guard/blocked").spec()));
  EXPECT_EQ(4, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiRedirectAndMainNavigationBlockBeforeNetwork) {
  // Adblock filter grammar excludes main documents from an untyped network
  // rule. Exercise both redirect/subresource interception and the explicit
  // document rule required for a top-level navigation.
  ASSERT_EQ(Update::kInstalled,
            Install("/guard/blocked\n/guard/blocked$document"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_FALSE(Fetch("/guard/redirect"));
  EXPECT_EQ(0, blocked_hits_.load());
  content::TestNavigationObserver navigation(Contents());
  Contents()->GetController().LoadURL(
      server_.GetURL("a.test", "/guard/blocked"), content::Referrer(),
      ui::PAGE_TRANSITION_TYPED, std::string());
  navigation.Wait();
  EXPECT_FALSE(navigation.last_navigation_succeeded());
  EXPECT_EQ(net::ERR_BLOCKED_BY_CLIENT, navigation.last_net_error_code());
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiExactOriginRecoveryDoesNotFollowAnotherPane) {
  ASSERT_EQ(Update::kInstalled, Install());
  auto configuration =
      GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  configuration.site_overrides.push_back(
      {Page().DeprecatedGetOriginAsURL().spec(),
       TahaiGuardSiteOverrideMode::kOff});
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  Browser* second = CreateBrowser(browser()->GetProfile());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(second, Page("b.test")));
  // The active window now owns b.test. The original a.test factory still has
  // only a.test's exception; focus must never provide request ownership.
  EXPECT_TRUE(Fetch("/guard/blocked"));
  EXPECT_FALSE(Fetch("/guard/blocked", second));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiFailedReplacementKeepsLiveAndPersistedRules) {
  ASSERT_EQ(Update::kInstalled, Install());
  const std::string before = browser()->GetProfile()->GetPrefs()->GetString(
      prefs::kTahaiGuardCustomRules);
  EXPECT_EQ(Update::kCompileFailed, Install(std::string(8193, 'x')));
  EXPECT_EQ(before, browser()->GetProfile()->GetPrefs()->GetString(
                        prefs::kTahaiGuardCustomRules));
  EXPECT_EQ(GuardProfileService::Status::kLastKnownGood,
            Service()->GetSnapshot().status);
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiPrivateProfileNeverBorrowsRegularGuard) {
  ASSERT_EQ(Update::kInstalled, Install());
  EnableDecisionCounters();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  auto* private_service =
      GuardProfileServiceFactory::GetForProfile(private_browser->GetProfile());
  ASSERT_TRUE(private_service);
  ASSERT_NE(Service(), private_service);
  ASSERT_TRUE(base::test::RunUntil([&] {
    return private_service->GetSnapshot().status ==
           GuardProfileService::Status::kReady;
  }));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(private_browser, Page()));
  const auto regular_before = Service()->GetSnapshot();
  EXPECT_FALSE(Fetch("/guard/blocked", private_browser));
  EXPECT_TRUE(Fetch("/guard/allowed", private_browser));
  const auto private_state = private_service->GetSnapshot();
  EXPECT_TRUE(private_state.private_session);
  EXPECT_FALSE(private_state.statistics_enabled);
  EXPECT_EQ(0u, private_state.allowed);
  EXPECT_EQ(0u, private_state.blocked);
  EXPECT_EQ(0u, private_state.unavailable);
  EXPECT_EQ(regular_before.allowed, Service()->GetSnapshot().allowed);
  EXPECT_EQ(regular_before.blocked, Service()->GetSnapshot().blocked);
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(regular_before.blocked + 1, Service()->GetSnapshot().blocked);
  EXPECT_EQ(0, blocked_hits_.load());
  base::test::TestFuture<Update> private_update;
  private_service->InstallCustomRules("/guard/allowed",
                                      private_update.GetCallback());
  EXPECT_EQ(Update::kDenied, private_update.Get());
  EXPECT_FALSE(private_service->ClearCustomRules());
  EXPECT_EQ("/guard/blocked", browser()->GetProfile()->GetPrefs()->GetString(
                                  prefs::kTahaiGuardCustomRules));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiPrivateEngineRefreshAndTeardownAreIsolated) {
  ASSERT_EQ(Update::kInstalled, Install());
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  auto private_service =
      GuardProfileServiceFactory::GetForProfile(private_browser->GetProfile())
          ->GetWeakPtr();
  ASSERT_TRUE(base::test::RunUntil([&] {
    return private_service->GetSnapshot().status ==
           GuardProfileService::Status::kReady;
  }));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(private_browser, Page()));
  EXPECT_FALSE(Fetch("/guard/blocked", private_browser));
  ASSERT_EQ(Update::kInstalled, Install("/guard/control"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return private_service->GetSnapshot().status ==
           GuardProfileService::Status::kReady;
  }));
  EXPECT_TRUE(Fetch("/guard/blocked", private_browser));
  EXPECT_FALSE(Fetch("/guard/control", private_browser));
  EXPECT_EQ(1, blocked_hits_.load());
  EXPECT_EQ(0, control_hits_.load());
  CloseBrowserSynchronously(private_browser);
  ASSERT_TRUE(base::test::RunUntil([&] { return !private_service; }));
  EXPECT_EQ(GuardProfileService::Status::kReady,
            Service()->GetSnapshot().status);
  EXPECT_EQ("/guard/control", browser()->GetProfile()->GetPrefs()->GetString(
                                  prefs::kTahaiGuardCustomRules));
  // A later private session is a new owner, not revived request/counter state.
  private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  auto* fresh =
      GuardProfileServiceFactory::GetForProfile(private_browser->GetProfile());
  ASSERT_TRUE(fresh);
  ASSERT_TRUE(base::test::RunUntil([&] {
    return fresh->GetSnapshot().status == GuardProfileService::Status::kReady;
  }));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(private_browser, Page()));
  EXPECT_FALSE(Fetch("/guard/control", private_browser));
  EXPECT_EQ(0u, fresh->GetSnapshot().blocked);
  EXPECT_EQ(0, control_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiPrivateManagedMissingEngineFailsClosed) {
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(private_browser, Page()));
  auto* private_service =
      GuardProfileServiceFactory::GetForProfile(private_browser->GetProfile());
  ASSERT_TRUE(private_service);
  policy::PolicyMap policies;
  auto configuration = ManagedConfiguration();
  configuration.Set("local_statistics_enabled", true);
  SetPolicy(&policies, policy::key::kTahaiGuardConfiguration,
            base::Value(std::move(configuration)));
  SetPolicy(&policies, policy::key::kTahaiGuardCustomRules, base::Value(""));
  UpdateProviderPolicy(policies);
  ASSERT_TRUE(private_service->GetSnapshot().managed);
  EXPECT_FALSE(Fetch("/guard/blocked", private_browser));
  content::TestNavigationObserver navigation(Contents(private_browser));
  Contents(private_browser)
      ->GetController()
      .LoadURL(server_.GetURL("a.test", "/guard/blocked"), content::Referrer(),
               ui::PAGE_TRANSITION_TYPED, std::string());
  navigation.Wait();
  EXPECT_EQ(net::ERR_BLOCKED_BY_ADMINISTRATOR,
            navigation.last_net_error_code());
  EXPECT_EQ(0, blocked_hits_.load());
  EXPECT_FALSE(private_service->GetSnapshot().statistics_enabled);
  EXPECT_EQ(0u, private_service->GetSnapshot().unavailable);
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiPrivateEditorCannotMutateInheritedRules) {
  ASSERT_EQ(Update::kInstalled, Install());
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(
      ui_test_utils::NavigateToURL(private_browser, GURL(kTahaiSupportURL)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               Contents(private_browser),
               "document.querySelector('#tahai-guard-engine-status')"
               "?.textContent.includes('Reading') === false")
        .ExtractBool();
  }));
  EXPECT_EQ(true, content::EvalJs(Contents(private_browser), R"JS(
    document.querySelector('#tahai-guard-mode').disabled &&
    document.querySelector('#tahai-guard-local-statistics').disabled &&
    document.querySelector('#tahai-guard-rules').disabled &&
    document.querySelector('#tahai-guard-rules').value === '' &&
    document.querySelector('#tahai-guard-install-rules').disabled
  )JS"));
  // Invoke the backend directly as well; disabling a button is not authority.
  EXPECT_EQ(false, content::EvalJs(Contents(private_browser), R"JS(
    new Promise(resolve => {
      window.tahaiGuardRulesUpdated = saved => resolve(saved);
      chrome.send('installTahaiGuardCustomRules', ['/guard/allowed']);
    })
  )JS"));
  EXPECT_EQ(false, content::EvalJs(Contents(private_browser), R"JS(
    new Promise(resolve => {
      window.tahaiGuardRulesUpdated = saved => resolve(saved);
      chrome.send('clearTahaiGuardCustomRules');
    })
  )JS"));
  EXPECT_EQ("/guard/blocked", browser()->GetProfile()->GetPrefs()->GetString(
                                  prefs::kTahaiGuardCustomRules));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiDedicatedSharedAndServiceWorkerFetchesAreFiltered) {
  ASSERT_EQ(Update::kInstalled, Install());
  EnableDecisionCounters();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_EQ(false, content::EvalJs(Contents(), R"JS(
    new Promise(resolve => {
      const worker = new Worker('/guard/worker.js');
      worker.onmessage = e => {worker.terminate(); resolve(e.data);};
      worker.onerror = () => {worker.terminate(); resolve('worker failed');};
    })
  )JS"));
  EXPECT_EQ(false, content::EvalJs(Contents(), R"JS(
    new Promise(resolve => {
      const worker = new SharedWorker('/guard/shared.js');
      worker.port.onmessage = e => {worker.port.close(); resolve(e.data);};
      worker.onerror = () => resolve('shared worker failed');
    })
  )JS"));
  EXPECT_EQ(false, content::EvalJs(Contents(), R"JS(
    (async () => {
      await navigator.serviceWorker.register('/guard/sw.js', {scope:'/guard/'});
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      const result = new Promise(resolve => channel.port1.onmessage = e => {
        channel.port1.close(); resolve(e.data);
      });
      registration.active.postMessage('check', [channel.port2]);
      const value = await result;
      await registration.unregister();
      return value;
    })()
  )JS"));
  EXPECT_EQ(0, blocked_hits_.load());
  EXPECT_EQ(3u, Service()->GetSnapshot().blocked);
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiScriptRequestsUseResourceTypeRules) {
  ASSERT_EQ(Update::kInstalled, Install("/guard/blocked$script"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_EQ(false, content::EvalJs(Contents(), R"JS(
    new Promise(resolve => {
      const script = document.createElement('script');
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      script.src = '/guard/blocked.js'; document.head.append(script);
    })
  )JS"));
  EXPECT_EQ(0, blocked_hits_.load());
  EXPECT_TRUE(Fetch("/guard/blocked.js"));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiManagedMissingRulesFailClosedAndLockChanges) {
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  policy::PolicyMap policies;
  SetPolicy(&policies, policy::key::kTahaiGuardConfiguration,
            base::Value(ManagedConfiguration()));
  SetPolicy(&policies, policy::key::kTahaiGuardCustomRules, base::Value(""));
  UpdateProviderPolicy(policies);
  ASSERT_TRUE(browser()->GetProfile()->GetPrefs()->IsManagedPreference(
      prefs::kTahaiGuardConfiguration));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0, blocked_hits_.load());
  EXPECT_EQ(Update::kDenied, Install());
  EXPECT_FALSE(Service()->ClearCustomRules());
  auto configuration =
      GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  configuration.mode = TahaiGuardMode::kOff;
  EXPECT_FALSE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                    configuration));

  SetPolicy(&policies, policy::key::kTahaiGuardCustomRules,
            base::Value("/guard/blocked"));
  UpdateProviderPolicy(policies);
  ASSERT_TRUE(base::test::RunUntil([&] {
    return Service()->GetSnapshot().status ==
           GuardProfileService::Status::kReady;
  }));
  EXPECT_TRUE(Fetch("/guard/allowed"));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiManagedInvalidReplacementCannotReuseOldAllow) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_TRUE(Fetch("/guard/allowed"));
  policy::PolicyMap policies;
  SetPolicy(&policies, policy::key::kTahaiGuardConfiguration,
            base::Value(ManagedConfiguration()));
  SetPolicy(&policies, policy::key::kTahaiGuardCustomRules,
            base::Value(std::string(8193, 'x')));
  UpdateProviderPolicy(policies);
  ASSERT_TRUE(base::test::RunUntil([&] {
    return Service()->GetSnapshot().status ==
           GuardProfileService::Status::kUnavailable;
  }));
  EXPECT_FALSE(Fetch("/guard/allowed"));
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiCountersRequireOptInAndClearOnOptOut) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0u, Service()->GetSnapshot().blocked);
  auto configuration =
      GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  configuration.local_statistics_enabled = true;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(1u, Service()->GetSnapshot().blocked);
  configuration.local_statistics_enabled = false;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  EXPECT_EQ(0u, Service()->GetSnapshot().blocked);
  EXPECT_EQ(0u, Service()->GetSnapshot().allowed);
  EXPECT_EQ(0u, Service()->GetSnapshot().unavailable);
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiSandboxedFrameCannotEscapeGeneralRules) {
  ASSERT_EQ(Update::kInstalled, Install());
  EnableDecisionCounters();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_EQ(false, content::EvalJs(
                       Contents(),
                       content::JsReplace(
                           R"JS(
    new Promise(resolve => {
      const frame = document.createElement('iframe');
      frame.sandbox = 'allow-scripts';
      const onMessage = e => {
        if (e.source !== frame.contentWindow) return;
        removeEventListener('message', onMessage);
        frame.remove(); resolve(e.data);
      };
      addEventListener('message', onMessage);
      frame.srcdoc = '<script>fetch(' + JSON.stringify($1) +
        ',{mode:"no-cors",cache:"no-store"}).then(()=>parent.postMessage(true,"*"),'
        + '()=>parent.postMessage(false,"*"));<\/script>';
      document.body.append(frame);
    })
  )JS",
                           server_.GetURL("a.test", "/guard/blocked").spec())));
  EXPECT_EQ(0, blocked_hits_.load());
  EXPECT_EQ(1u, Service()->GetSnapshot().blocked);
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiCustomRuleEditorInstallsThroughVisibleControl) {
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               Contents(),
               "document.querySelector('#tahai-guard-install-rules')"
               "?.disabled === false")
        .ExtractBool();
  }));
  EXPECT_EQ(true, content::EvalJs(Contents(), R"JS(
    new Promise(resolve => {
      const prior = window.tahaiGuardRulesUpdated;
      window.tahaiGuardRulesUpdated = (saved, message) => {
        prior(saved, message); resolve(saved);
      };
      document.querySelector('#tahai-guard-rules').value = '/guard/blocked';
      document.querySelector('#tahai-guard-install-rules').click();
    })
  )JS"));
  EXPECT_EQ("/guard/blocked", browser()->GetProfile()->GetPrefs()->GetString(
                                  prefs::kTahaiGuardCustomRules));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiKeepaliveRemainsFilteredAfterDocumentNavigation) {
  ASSERT_EQ(Update::kInstalled, Install());
  auto configuration =
      GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  configuration.local_statistics_enabled = true;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(content::ExecJs(Contents(), R"JS(
    addEventListener('pagehide', () => {
      navigator.sendBeacon('/guard/blocked', 'fixture');
      navigator.sendBeacon('/guard/control', 'fixture');
    }, {once:true});
  )JS"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page("b.test")));
  ASSERT_TRUE(base::test::RunUntil([&] { return control_hits_.load() == 1; }));
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return Service()->GetSnapshot().blocked >= 1; }));
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiTwoRegularProfilesKeepDistinctGenerations) {
  ASSERT_EQ(Update::kInstalled, Install());
  Profile& other_profile = profiles::testing::CreateProfileSync(
      g_browser_process->profile_manager(),
      browser()->GetProfile()->GetPath().DirName().AppendASCII(
          "GuardOtherProfile"));
  TahaiGuardConfiguration configuration;
  configuration.mode = TahaiGuardMode::kCustom;
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(&other_profile, configuration));
  auto* other = GuardProfileServiceFactory::GetForProfile(&other_profile);
  ASSERT_NE(Service(), other);
  base::test::TestFuture<Update> installed;
  other->InstallCustomRules("/guard/not-blocked-here", installed.GetCallback());
  ASSERT_EQ(Update::kInstalled, installed.Get());
  Browser* second = CreateBrowser(&other_profile);
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(second, Page()));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_TRUE(Fetch("/guard/blocked", second));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiDocumentPauseCannotLeakToSameOriginTabOrWorker) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  Browser* second = CreateBrowser(browser()->GetProfile());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(second, Page()));
  auto* document = Contents()->GetPrimaryMainFrame();
  ASSERT_TRUE(Service()->SetPagePaused(*document, true));
  EXPECT_TRUE(Fetch("/guard/blocked"));
  EXPECT_FALSE(Fetch("/guard/blocked", second));
  EXPECT_EQ(false, content::EvalJs(Contents(), R"JS(
    new Promise(resolve => {
      const worker = new Worker('/guard/worker.js');
      worker.onmessage = e => {worker.terminate(); resolve(e.data);};
      worker.onerror = () => {worker.terminate(); resolve('worker failed');};
    })
  )JS"));
  EXPECT_EQ(false, content::EvalJs(Contents(), R"JS(
    new Promise(resolve => {
      const worker = new SharedWorker('/guard/shared.js');
      worker.port.onmessage = e => {worker.port.close(); resolve(e.data);};
      worker.onerror = () => resolve('shared worker failed');
    })
  )JS"));
  EXPECT_EQ(false, content::EvalJs(Contents(), R"JS(
    (async () => {
      await navigator.serviceWorker.register('/guard/sw.js', {scope:'/guard/'});
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      const result = new Promise(resolve => channel.port1.onmessage = e => {
        channel.port1.close(); resolve(e.data);
      });
      registration.active.postMessage('check', [channel.port2]);
      const value = await result;
      await registration.unregister();
      return value;
    })()
  )JS"));
  EXPECT_EQ(1, blocked_hits_.load());
  ASSERT_TRUE(Service()->SetPagePaused(*document, false));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiDocumentPauseCoversOwnedOrdinarySubframes) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(
      Service()->SetPagePaused(*Contents()->GetPrimaryMainFrame(), true));
  EXPECT_EQ(true,
            content::EvalJs(
                Contents(),
                content::JsReplace(R"JS(
    new Promise(resolve => {
      const frame = document.createElement('iframe');
      const listener = e => {
        if (e.source === frame.contentWindow) {
          removeEventListener('message', listener); frame.remove(); resolve(e.data);
        }
      };
      addEventListener('message', listener);
      frame.src = $1; document.body.append(frame);
    })
  )JS",
                                   server_.GetURL("b.test", "/guard/frame"))));
  EXPECT_EQ(1, blocked_hits_.load());
  ASSERT_TRUE(
      Service()->SetPagePaused(*Contents()->GetPrimaryMainFrame(), false));
  EXPECT_FALSE(Fetch("/guard/blocked"));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiDocumentPauseExpiresOnReloadNavigationAndBack) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      browser(), server_.GetURL("a.test", "/guard/cacheable-page")));
  auto id = Contents()->GetPrimaryMainFrame()->GetPageUkmSourceId();
  ASSERT_TRUE(
      Service()->SetPagePaused(*Contents()->GetPrimaryMainFrame(), true));
  ASSERT_TRUE(content::ExecJs(Contents(),
                              "history.pushState({}, '', '#same-document')"));
  EXPECT_EQ(id, Contents()->GetPrimaryMainFrame()->GetPageUkmSourceId());
  EXPECT_TRUE(Fetch("/guard/blocked"));
  {
    GuardPanelController controller(browser());
    content::TestNavigationObserver reloaded(Contents());
    ASSERT_TRUE(controller.Reload());
    reloaded.Wait();
    EXPECT_FALSE(controller.IsCurrent());
  }
  EXPECT_FALSE(Service()->IsPagePaused(id));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  id = Contents()->GetPrimaryMainFrame()->GetPageUkmSourceId();
  ASSERT_TRUE(
      Service()->SetPagePaused(*Contents()->GetPrimaryMainFrame(), true));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page("b.test")));
  EXPECT_FALSE(Service()->IsPagePaused(id));
  content::TestNavigationObserver back(Contents());
  Contents()->GetController().GoBack();
  back.Wait();
  ASSERT_TRUE(back.last_navigation_succeeded());
  EXPECT_FALSE(Service()->IsPagePaused(id));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiPrivateDocumentPauseCannotPersistOrCrossProfile) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  const auto stored = browser()
                          ->GetProfile()
                          ->GetPrefs()
                          ->GetDict(prefs::kTahaiGuardConfiguration)
                          .Clone();
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  auto* service =
      GuardProfileServiceFactory::GetForProfile(private_browser->GetProfile());
  ASSERT_TRUE(base::test::RunUntil([&] {
    return service->GetSnapshot().status == GuardProfileService::Status::kReady;
  }));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(private_browser, Page()));
  GuardPanelController private_panel(private_browser);
  ASSERT_TRUE(private_panel.SetPaused(true));
  EXPECT_TRUE(Fetch("/guard/blocked", private_browser));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_FALSE(Service()->SetPagePaused(
      *Contents(private_browser)->GetPrimaryMainFrame(), true));
  EXPECT_FALSE(private_panel.SetSiteException(true));
  EXPECT_FALSE(private_panel.CanEditSiteException());
  EXPECT_EQ(stored, browser()->GetProfile()->GetPrefs()->GetDict(
                        prefs::kTahaiGuardConfiguration));
  EXPECT_EQ(0u, service->GetSnapshot().allowed);
  EXPECT_EQ(0u, service->GetSnapshot().blocked);
  CloseBrowserSynchronously(private_browser);
  EXPECT_FALSE(private_panel.IsCurrent());
  EXPECT_FALSE(private_panel.SetPaused(true));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiQueuedPauseIsAbortedAfterResumeOrSettingsChange) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  auto* document = Contents()->GetPrimaryMainFrame();
  const auto id = document->GetPageUkmSourceId();
  const auto origin = document->GetLastCommittedOrigin();
  for (bool settings_change : {false, true}) {
    ASSERT_TRUE(Service()->SetPagePaused(*document, true));
    base::test::TestFuture<GuardProfileService::Result> result;
    Service()->Check(server_.GetURL("a.test", "/guard/blocked"), origin, origin,
                     mojom::RequestKind::kXmlHttpRequest, result.GetCallback(),
                     id);
    if (settings_change) {
      EnableDecisionCounters();
    } else {
      ASSERT_TRUE(Service()->SetPagePaused(*document, false));
    }
    EXPECT_EQ(GuardProfileService::Result::kContextChanged, result.Get());
    EXPECT_FALSE(Service()->IsPagePaused(id));
  }
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiManagedPolicyRevokesPageRecovery) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  GuardPanelController panel(browser());
  ASSERT_TRUE(panel.SetPaused(true));
  EXPECT_TRUE(Fetch("/guard/blocked"));
  policy::PolicyMap policies;
  SetPolicy(&policies, policy::key::kTahaiGuardConfiguration,
            base::Value(ManagedConfiguration()));
  SetPolicy(&policies, policy::key::kTahaiGuardCustomRules,
            base::Value("/guard/blocked"));
  UpdateProviderPolicy(policies);
  EXPECT_FALSE(panel.IsPaused());
  EXPECT_FALSE(panel.SetPaused(true));
  EXPECT_FALSE(panel.SetSiteException(true));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiNativeGuardControllerRejectsStaleDualPaneActions) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(ui_test_utils::NavigateToURLWithDisposition(
      browser(), Page(), WindowOpenDisposition::NEW_FOREGROUND_TAB,
      ui_test_utils::BROWSER_TEST_WAIT_FOR_LOAD_STOP));
  auto* model = browser()->tab_strip_model();
  ASSERT_EQ(2, model->count());
  model->ActivateTabAt(0);
  ASSERT_TRUE(chrome::OpenTahaiDualView(
      browser(), chrome::TahaiDualViewLayout::kSideBySide));
  GuardPanelController first(browser());
  ASSERT_TRUE(first.IsCurrent());
  ASSERT_TRUE(first.SetPaused(true));
  model->ActivateTabAt(1);
  EXPECT_FALSE(first.IsCurrent());
  EXPECT_FALSE(first.SetSiteException(true));
  EXPECT_FALSE(first.Reload());
  EXPECT_FALSE(Fetch("/guard/blocked"));
  model->ActivateTabAt(0);
  EXPECT_FALSE(first.IsCurrent());  // Switching back does not revive authority.
  EXPECT_FALSE(first.SetPaused(false));
  EXPECT_TRUE(Fetch("/guard/blocked"));
  GuardPanelController fresh(browser());
  ASSERT_TRUE(fresh.SetPaused(false));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page("b.test")));
  EXPECT_FALSE(fresh.IsCurrent());
  EXPECT_FALSE(fresh.SetSiteException(true));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiNativeGuardSiteExceptionPreservesExactOriginScope) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  GuardPanelController panel(browser());
  ASSERT_TRUE(panel.SetSiteException(true));
  EXPECT_TRUE(panel.HasSiteException());
  EXPECT_TRUE(Fetch("/guard/blocked"));
  Browser* second = CreateBrowser(browser()->GetProfile());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(second, Page("b.test")));
  EXPECT_FALSE(Fetch("/guard/blocked", second));
  auto configuration =
      GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  configuration.site_overrides.push_back(
      {Page("c.test").DeprecatedGetOriginAsURL().spec(),
       TahaiGuardSiteOverrideMode::kOff});
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(browser()->GetProfile(),
                                                   configuration));
  ASSERT_TRUE(panel.SetSiteException(false));
  configuration = GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  ASSERT_EQ(1u, configuration.site_overrides.size());
  EXPECT_EQ(Page("c.test").DeprecatedGetOriginAsURL().spec(),
            configuration.site_overrides.front().canonical_origin);
  EXPECT_FALSE(Fetch("/guard/blocked"));
  // Corrupt stored input cannot be silently replaced with defaults by the UI.
  browser()->GetProfile()->GetPrefs()->SetDict(
      prefs::kTahaiGuardConfiguration,
      base::DictValue().Set("unexpected", true));
  EXPECT_FALSE(panel.SetSiteException(true));
  EXPECT_TRUE(browser()
                  ->GetProfile()
                  ->GetPrefs()
                  ->GetDict(prefs::kTahaiGuardConfiguration)
                  .FindBool("unexpected")
                  .value_or(false));
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiNativeGuardMenuAllModesAndButtonRecovery) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  auto* mode = WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(mode);
  for (const auto& definition : ModeService::definitions()) {
    ASSERT_TRUE(mode->SetActiveMode(definition.id));
    for (const char* rail : {"icons", "expanded", "hidden"}) {
      ASSERT_TRUE(mode->SetActiveConfigurationValue("rail_state", rail));
      AppMenuModel menu(nullptr, browser());
      menu.Init();
      const auto index = menu.GetIndexOfCommandId(IDC_TAHAI_GUARD_PANEL);
      ASSERT_TRUE(index.has_value());
      EXPECT_TRUE(menu.IsEnabledAt(*index));
    }
  }
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_GUARD_PANEL));
  auto* tracker = views::ElementTrackerViews::GetInstance();
  views::Widget* panel = nullptr;
  ASSERT_TRUE(base::test::RunUntil([&] {
    for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
             browser()->GetWindow()->GetNativeWindow())) {
      views::Widget* widget = widget_ptr.get();
      if (tracker->GetFirstMatchingView(
              kGuardPanelElementId,
              views::ElementTrackerViews::GetContextForWidget(widget), false)) {
        panel = widget;
        return true;
      }
    }
    return false;
  }));
  auto* pause = tracker->GetFirstMatchingViewAs<views::LabelButton>(
      kGuardPauseElementId,
      views::ElementTrackerViews::GetContextForWidget(panel), false);
  ASSERT_TRUE(pause);
  ASSERT_TRUE(pause->GetEnabled());
  views::test::ButtonTestApi(pause).NotifyDefaultMouseClick();
  EXPECT_TRUE(Fetch("/guard/blocked"));
  views::test::ButtonTestApi(pause).NotifyDefaultMouseClick();
  EXPECT_FALSE(Fetch("/guard/blocked"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page("b.test")));
  EXPECT_FALSE(pause->GetEnabled());
  // A stale queued click still hits the controller's identity guard.
  views::test::ButtonTestApi(pause).NotifyDefaultMouseClick();
  EXPECT_FALSE(Fetch("/guard/blocked"));
  views::test::WidgetDestroyedWaiter destroyed(panel);
  panel->Close();
  destroyed.Wait();
  EXPECT_EQ(1, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiRendererLossRevokesDocumentPauseAndPanel) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  GuardPanelController panel(browser());
  const auto id = Contents()->GetPrimaryMainFrame()->GetPageUkmSourceId();
  ASSERT_TRUE(panel.SetPaused(true));
  content::ScopedAllowRendererCrashes allow_crashes(
      Contents()->GetPrimaryMainFrame());
  content::CrashTab(Contents());
  EXPECT_FALSE(panel.IsCurrent());
  EXPECT_FALSE(Service()->IsPagePaused(id));
  EXPECT_FALSE(panel.SetPaused(true));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_EQ(0, blocked_hits_.load());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiNativeGuardPrivateAndManagedButtonsStayLocked) {
  ASSERT_EQ(Update::kInstalled, Install());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  auto* private_service =
      GuardProfileServiceFactory::GetForProfile(private_browser->GetProfile());
  ASSERT_TRUE(base::test::RunUntil([&] {
    return private_service->GetSnapshot().status ==
           GuardProfileService::Status::kReady;
  }));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(private_browser, Page()));
  AppMenuModel private_menu(nullptr, private_browser);
  private_menu.Init();
  const auto menu_item =
      private_menu.GetIndexOfCommandId(IDC_TAHAI_GUARD_PANEL);
  ASSERT_TRUE(menu_item.has_value());
  EXPECT_TRUE(private_menu.IsEnabledAt(*menu_item));
  ASSERT_TRUE(chrome::ExecuteCommand(private_browser, IDC_TAHAI_GUARD_PANEL));
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return GuardPanel(private_browser) != nullptr; }));
  auto* tracker = views::ElementTrackerViews::GetInstance();
  auto context = views::ElementTrackerViews::GetContextForWidget(
      GuardPanel(private_browser));
  auto* private_exception = tracker->GetFirstMatchingViewAs<views::LabelButton>(
      kGuardSiteExceptionElementId, context);
  auto* private_pause = tracker->GetFirstMatchingViewAs<views::LabelButton>(
      kGuardPauseElementId, context);
  ASSERT_TRUE(private_exception);
  ASSERT_TRUE(private_pause);
  EXPECT_FALSE(private_exception->GetEnabled());
  ASSERT_TRUE(private_pause->GetEnabled());
  views::test::ButtonTestApi(private_exception).NotifyDefaultMouseClick();
  EXPECT_TRUE(GetTahaiGuardConfigurationForProfile(browser()->GetProfile())
                  .site_overrides.empty());
  views::test::ButtonTestApi(private_pause).NotifyDefaultMouseClick();
  EXPECT_TRUE(Fetch("/guard/blocked", private_browser));
  EXPECT_FALSE(Fetch("/guard/blocked"));

  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_GUARD_PANEL));
  ASSERT_TRUE(
      base::test::RunUntil([&] { return GuardPanel(browser()) != nullptr; }));
  context =
      views::ElementTrackerViews::GetContextForWidget(GuardPanel(browser()));
  auto* regular_pause = tracker->GetFirstMatchingViewAs<views::LabelButton>(
      kGuardPauseElementId, context);
  auto* regular_exception = tracker->GetFirstMatchingViewAs<views::LabelButton>(
      kGuardSiteExceptionElementId, context);
  ASSERT_TRUE(regular_pause);
  ASSERT_TRUE(regular_exception);
  policy::PolicyMap policies;
  SetPolicy(&policies, policy::key::kTahaiGuardConfiguration,
            base::Value(ManagedConfiguration()));
  SetPolicy(&policies, policy::key::kTahaiGuardCustomRules,
            base::Value("/guard/blocked"));
  UpdateProviderPolicy(policies);
  EXPECT_FALSE(regular_pause->GetEnabled());
  EXPECT_FALSE(regular_exception->GetEnabled());
  EXPECT_FALSE(private_pause->GetEnabled());
  views::test::ButtonTestApi(regular_pause).NotifyDefaultMouseClick();
  views::test::ButtonTestApi(regular_exception).NotifyDefaultMouseClick();
  EXPECT_FALSE(Fetch("/guard/blocked"));
  EXPECT_FALSE(Fetch("/guard/blocked", private_browser));
  EXPECT_EQ(1, blocked_hits_.load());
  views::Widget* regular_panel = GuardPanel(browser());
  views::Widget* private_panel = GuardPanel(private_browser);
  ASSERT_TRUE(regular_panel);
  ASSERT_TRUE(private_panel);
  views::test::WidgetDestroyedWaiter regular_destroyed(regular_panel);
  views::test::WidgetDestroyedWaiter private_destroyed(private_panel);
  regular_panel->Close();
  private_panel->Close();
  regular_destroyed.Wait();
  private_destroyed.Wait();
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiCosmeticsFollowDynamicDomPauseExceptionsAndOff) {
  ASSERT_EQ(Update::kInstalled, Install("##.tahai-ad\n/guard/blocked"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(content::ExecJs(Contents(),
                              "document.body.innerHTML = '<div "
                              "class=tahai-ad>Ad</div><p>Content</p>'"));
  ASSERT_TRUE(WaitForHidden(true));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  ASSERT_TRUE(
      Service()->SetPagePaused(*Contents()->GetPrimaryMainFrame(), true));
  ASSERT_TRUE(WaitForHidden(false));
  EXPECT_TRUE(Fetch("/guard/blocked"));
  ASSERT_TRUE(
      Service()->SetPagePaused(*Contents()->GetPrimaryMainFrame(), false));
  ASSERT_TRUE(WaitForHidden(true));
  auto config = GetTahaiGuardConfigurationForProfile(browser()->GetProfile());
  config.site_overrides.push_back({url::Origin::Create(Page()).GetURL().spec(),
                                   TahaiGuardSiteOverrideMode::kCosmeticOff});
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(browser()->GetProfile(), config));
  ASSERT_TRUE(WaitForHidden(false));
  EXPECT_FALSE(Fetch("/guard/blocked"));
  config.site_overrides.clear();
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(browser()->GetProfile(), config));
  ASSERT_TRUE(WaitForHidden(true));
  config.mode = TahaiGuardMode::kOff;
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(browser()->GetProfile(), config));
  EXPECT_TRUE(WaitForHidden(false));
}

IN_PROC_BROWSER_TEST_F(
    TahaiGuardRequestBrowserTest,
    TahaiCosmeticsDoNotLeakAcrossNavigationOrPrivateProfiles) {
  ASSERT_EQ(Update::kInstalled, Install("a.test##.tahai-ad"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(content::ExecJs(
      Contents(), "document.body.innerHTML = '<div class=tahai-ad>Ad</div>'"));
  ASSERT_TRUE(WaitForHidden(true));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page("b.test")));
  ASSERT_TRUE(content::ExecJs(
      Contents(),
      "document.body.innerHTML = '<div class=tahai-ad>Content</div>'"));
  EXPECT_TRUE(WaitForHidden(false));
  Browser* private_browser = CreateIncognitoBrowser();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(private_browser, Page()));
  ASSERT_TRUE(content::ExecJs(
      Contents(private_browser),
      "document.body.innerHTML = '<div class=tahai-ad>Ad</div>'"));
  EXPECT_TRUE(WaitForHidden(true, private_browser));
  auto* private_service =
      GuardProfileServiceFactory::GetForProfile(private_browser->GetProfile());
  EXPECT_NE(Service(), private_service);
  EXPECT_FALSE(private_service->GetSnapshot().statistics_enabled);
  ASSERT_TRUE(private_service->SetPagePaused(
      *Contents(private_browser)->GetPrimaryMainFrame(), true));
  EXPECT_TRUE(WaitForHidden(false, private_browser));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(content::ExecJs(
      Contents(), "document.body.innerHTML = '<div class=tahai-ad>Ad</div>'"));
  EXPECT_TRUE(WaitForHidden(true));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardRequestBrowserTest,
                       TahaiCosmeticsFollowSameDocumentUrlExceptions) {
  ASSERT_EQ(Update::kInstalled,
            Install("##.tahai-ad\n@@/guard/cosmetic-exception$generichide"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), Page()));
  ASSERT_TRUE(content::ExecJs(
      Contents(), "document.body.innerHTML = '<div class=tahai-ad>Ad</div>'"));
  ASSERT_TRUE(WaitForHidden(true));
  ASSERT_TRUE(content::ExecJs(
      Contents(), "history.pushState({}, '', '/guard/cosmetic-exception')"));
  ASSERT_TRUE(WaitForHidden(false));
  ASSERT_TRUE(content::ExecJs(Contents(),
                              "history.replaceState({}, '', '/guard/page')"));
  EXPECT_TRUE(WaitForHidden(true));
}

}  // namespace
}  // namespace tahai::guard
