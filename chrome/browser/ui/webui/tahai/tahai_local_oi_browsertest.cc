// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include <algorithm>
#include <memory>
#include <optional>
#include <string>
#include <utility>

#include "base/task/bind_post_task.h"
#include "base/test/bind.h"
#include "base/test/test_future.h"
#include "base/threading/thread_restrictions.h"
#include "base/time/time.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service_factory.h"
#include "chrome/browser/ui/webui/tahai/tahai_network_inspector.h"
#include "chrome/browser/ui/webui/tahai/tahai_ui.h"
#include "chrome/common/chrome_switches.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/ui_test_utils.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/storage_partition.h"
#include "content/public/browser/web_contents.h"
#include "content/public/test/browser_test.h"
#include "content/public/test/browser_test_utils.h"
#include "content/public/test/url_loader_interceptor.h"
#include "net/base/net_errors.h"
#include "net/base/network_interfaces.h"
#include "net/dns/mock_host_resolver.h"
#include "net/http/http_response_headers.h"
#include "net/test/embedded_test_server/embedded_test_server.h"
#include "net/traffic_annotation/network_traffic_annotation_test_helper.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/ip_address_space_util.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "ui/base/clipboard/clipboard.h"
#include "ui/base/clipboard/clipboard_test_util.h"
#include "ui/base/clipboard/scoped_clipboard_writer.h"
#include "ui/base/window_open_disposition.h"
#include "url/gurl.h"

namespace tahai {
namespace {

class TahaiLocalOiBrowserTest : public InProcessBrowserTest {
 protected:
  void SetUpCommandLine(base::CommandLine* command_line) override {
    InProcessBrowserTest::SetUpCommandLine(command_line);
    command_line->AppendSwitch(switches::kNoProxyServer);
  }

  content::WebContents* NavigateToLocalOi() {
    EXPECT_TRUE(
        ui_test_utils::NavigateToURL(browser(), GURL(kTahaiLocalOiURL)));
    return browser()->tab_strip_model()->GetActiveWebContents();
  }
};

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       FindingTransitionsUpdateSearchProjectionAtomically) {
  auto* service =
      TahaiLocalOiServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  browser()->GetProfile()->GetPrefs()->SetBoolean(prefs::kTahaiLocalOiEnabled,
                                                  true);
  LocalOiEntityRecord endpoint;
  endpoint.id = NewLocalOiId();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "Synthetic support endpoint";
  endpoint.summary = "Metadata-only lifecycle fixture.";
  endpoint.source = LocalOiRecordSource::kExplicitUserEntry;
  endpoint.created_at = LocalOiNowTimestamp();
  endpoint.updated_at = endpoint.created_at;
  const std::string endpoint_id = endpoint.id;
  ASSERT_TRUE(service->UpsertEntity(std::move(endpoint)));
  ASSERT_TRUE(service->RecalculateFindings());
  const auto finding = std::find_if(
      service->data().findings.begin(), service->data().findings.end(),
      [](const LocalOiFindingRecord& record) {
        return record.rule_id ==
               "local_oi.knowledge.endpoint_no_documentation.v1";
      });
  ASSERT_NE(service->data().findings.end(), finding);
  const std::string finding_id = finding->id;
  auto expect_state = [&](std::string_view expected) {
    const auto current = std::find_if(
        service->data().findings.begin(), service->data().findings.end(),
        [&finding_id](const LocalOiFindingRecord& record) {
          return record.id == finding_id;
        });
    ASSERT_NE(service->data().findings.end(), current);
    EXPECT_EQ(expected, LocalOiFindingStateName(current->state));
    EXPECT_EQ(expected == "acknowledged", current->acknowledged);
    EXPECT_EQ(expected != "acknowledged",
              current->acknowledgement_note.empty());
    if (expected == "open" || expected == "acknowledged") {
      EXPECT_TRUE(current->resolution_reason.empty());
    }
    const auto entity = std::find_if(
        service->data().entities.begin(), service->data().entities.end(),
        [&finding_id](const LocalOiEntityRecord& record) {
          return record.id == finding_id &&
                 record.type == LocalOiEntityType::kFinding;
        });
    ASSERT_NE(service->data().entities.end(), entity);
    const auto field = std::find_if(
        entity->fields.begin(), entity->fields.end(),
        [](const LocalOiField& item) { return item.key == "state"; });
    ASSERT_NE(entity->fields.end(), field);
    EXPECT_EQ(expected, field->value);
    TahaiLocalOiStore persisted(browser()->GetProfile()->GetPrefs(), true);
    const auto saved = std::find_if(
        persisted.data().entities.begin(), persisted.data().entities.end(),
        [&finding_id](const LocalOiEntityRecord& record) {
          return record.id == finding_id;
        });
    ASSERT_NE(persisted.data().entities.end(), saved);
    EXPECT_TRUE(std::any_of(saved->fields.begin(), saved->fields.end(),
                            [expected](const LocalOiField& item) {
                              return item.key == "state" &&
                                     item.value == expected;
                            }));
  };
  expect_state("open");
  ASSERT_TRUE(service->AcknowledgeFinding(finding_id, "Reviewed locally."));
  expect_state("acknowledged");
  ASSERT_TRUE(service->ResolveFinding(finding_id, "Resolution reviewed."));
  expect_state("resolved");
  ASSERT_TRUE(service->ReopenFinding(finding_id, "Follow-up required."));
  expect_state("open");
  ASSERT_TRUE(
      service->SuppressFinding(finding_id, "Explicit exception reviewed."));
  expect_state("suppressed");
  ASSERT_TRUE(
      service->AcknowledgeFinding(finding_id, "Exception reconsidered."));
  expect_state("acknowledged");
  browser()->GetProfile()->GetPrefs()->SetBoolean(
      prefs::kTahaiLocalOiDocumentationReferenceIngestionEnabled, true);
  ASSERT_TRUE(service->RecordDocumentReference({"Synthetic documentation",
                                                "https://example.com/docs",
                                                endpoint_id, ""}));
  expect_state("resolved");
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       UnavailableStoreCannotSearchBriefExportOrMutate) {
  auto* service =
      TahaiLocalOiServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  auto* prefs = browser()->GetProfile()->GetPrefs();
  prefs->SetBoolean(prefs::kTahaiLocalOiEnabled, true);
  prefs->SetBoolean(prefs::kTahaiLocalOiLocalAiEnabled, true);
  prefs->SetBoolean(prefs::kTahaiLocalOiReportsEnabled, true);
  prefs->SetBoolean(prefs::kTahaiLocalOiExportEnabled, true);
  LocalOiEntityRecord record;
  record.id = NewLocalOiId();
  record.type = LocalOiEntityType::kNote;
  record.title = "Synthetic reference";
  record.summary = "Explicit metadata-only fixture.";
  record.source = LocalOiRecordSource::kExplicitUserEntry;
  record.created_at = LocalOiNowTimestamp();
  record.updated_at = record.created_at;
  ASSERT_TRUE(service->UpsertEntity(record));
  const LocalOiAssistRequest assist{
      LocalOiAssistOperation::kSummarizeSelectedRecords, {record.id}};
  ASSERT_FALSE(service->Search("Synthetic").empty());
  ASSERT_TRUE(service->BuildDeterministicLocalBrief(assist));
  ASSERT_FALSE(service->data().entities.empty());
  const base::DictValue before_disable =
      prefs->GetDict(prefs::kTahaiLocalOiStore).Clone();
  prefs->SetBoolean(prefs::kTahaiLocalOiEnabled, false);
  EXPECT_TRUE(service->data().entities.empty());
  EXPECT_TRUE(service->data().relationships.empty());
  EXPECT_TRUE(service->data().findings.empty());
  EXPECT_TRUE(service->data().memory.empty());
  EXPECT_TRUE(service->data().reports.empty());
  EXPECT_TRUE(service->Search("Synthetic").empty());
  EXPECT_FALSE(service->BuildDeterministicLocalBrief(assist));
  EXPECT_EQ(before_disable, prefs->GetDict(prefs::kTahaiLocalOiStore));
  prefs->SetBoolean(prefs::kTahaiLocalOiEnabled, true);
  EXPECT_FALSE(service->data().entities.empty());
  base::DictValue future = prefs->GetDict(prefs::kTahaiLocalOiStore).Clone();
  future.Set("schema_version", kTahaiLocalOiCurrentSchemaVersion + 1);
  prefs->SetDict(prefs::kTahaiLocalOiStore, future.Clone());
  EXPECT_FALSE(service->UpsertEntity(record));
  EXPECT_FALSE(service->available());
  EXPECT_TRUE(service->data().entities.empty());
  EXPECT_TRUE(service->data().relationships.empty());
  EXPECT_TRUE(service->data().findings.empty());
  EXPECT_TRUE(service->data().memory.empty());
  EXPECT_TRUE(service->data().reports.empty());
  EXPECT_TRUE(service->Search("Synthetic").empty());
  EXPECT_FALSE(service->BuildDeterministicLocalBrief(assist));
  EXPECT_FALSE(service->PrepareLocalAssistPrompt(assist));
  EXPECT_FALSE(service->GenerateSafeReport(LocalOiSafeReportKind::kOverview));
  EXPECT_FALSE(service->DeleteEntity(record.id));
  EXPECT_FALSE(service->DeleteAllData());
  EXPECT_EQ(future, prefs->GetDict(prefs::kTahaiLocalOiStore));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       TrustedLocalOiWebUiRendersRealLocalSurfaces) {
  content::WebContents* contents = NavigateToLocalOi();
  ASSERT_TRUE(contents);
  EXPECT_EQ(GURL(kTahaiLocalOiURL), contents->GetLastCommittedURL());
  EXPECT_TRUE(
      content::EvalJs(
          contents, "Boolean(document.querySelector('#local-oi-search-form'))")
          .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "Boolean(document.querySelector('#local-oi-graph-form'))")
          .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "Boolean(document.querySelector('#local-oi-deterministic-brief'))")
          .ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,
                              "document.body.innerText.includes('Create a "
                              "deterministic local operations brief')")
                  .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       InspectionLoaderBlocksLocalConnectionEndpoint) {
  // Exercise the actual Network Service with the production inspection loader
  // options. A DNS preflight alone cannot enforce this connection boundary.
  net::NetworkInterfaceList interfaces;
  {
    base::ScopedAllowBlockingForTesting allow_blocking;
    ASSERT_TRUE(net::GetNetworkList(
        &interfaces, net::EXCLUDE_HOST_SCOPE_VIRTUAL_INTERFACES));
  }
  std::optional<net::IPAddress> local_address;
  for (const net::NetworkInterface& interface : interfaces) {
    if (interface.address.IsIPv4() &&
        network::IPAddressToIPAddressSpace(interface.address) ==
            network::mojom::IPAddressSpace::kLocal) {
      local_address = interface.address;
      break;
    }
  }
  ASSERT_TRUE(local_address.has_value());
  ASSERT_TRUE(embedded_test_server()->Start(0, local_address->ToString()));

  auto request = std::make_unique<network::ResourceRequest>();
  // Browser tests classify loopback as public. Binding the live test endpoint
  // to a real private interface exercises the connection-time local-network
  // boundary without depending on an unreachable address or a system proxy.
  request->url = embedded_test_server()->GetURL("/");
  request->method = "HEAD";
  request->credentials_mode = network::mojom::CredentialsMode::kOmit;
  request->redirect_mode = network::mojom::RedirectMode::kError;
  auto loader = network::SimpleURLLoader::Create(std::move(request),
                                                 TRAFFIC_ANNOTATION_FOR_TESTS);
  loader->SetURLLoaderFactoryOptions(GetTahaiNetworkInspectionURLLoadOptions());
  loader->SetTimeoutDuration(base::Seconds(10));
  base::test::TestFuture<scoped_refptr<net::HttpResponseHeaders>> completed;
  loader->DownloadHeadersOnly(browser()
                                  ->GetProfile()
                                  ->GetDefaultStoragePartition()
                                  ->GetURLLoaderFactoryForBrowserProcess()
                                  .get(),
                              completed.GetCallback());
  EXPECT_FALSE(completed.Get());
  EXPECT_EQ(net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS,
            loader->NetError());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       BrowserCommandsAndClipboardRequireActiveGesture) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  const int initial_tabs = browser()->tab_strip_model()->count();
  ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
      .WriteText(u"command-gesture-sentinel");
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    chrome.send('copyTahaiSupportSummary', []);
    chrome.send('executeTahaiCommand', ['tab.new']);
  )JS", content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  content::RunAllTasksUntilIdle();
  EXPECT_EQ(initial_tabs, browser()->tab_strip_model()->count());
  EXPECT_EQ(u"command-gesture-sentinel",
            ui::clipboard_test_util::ReadText(
                ui::Clipboard::GetForCurrentThread(),
                ui::ClipboardBuffer::kCopyPaste, nullptr));

  EXPECT_EQ(true, content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiSupportSummaryCopied = () => resolve(true);
      chrome.send('copyTahaiSupportSummary', []);
    });
  )JS"));
  EXPECT_NE(u"command-gesture-sentinel",
            ui::clipboard_test_util::ReadText(
                ui::Clipboard::GetForCurrentThread(),
                ui::ClipboardBuffer::kCopyPaste, nullptr));

  ASSERT_TRUE(ui_test_utils::NavigateToURLWithDisposition(
      browser(), GURL("about:blank"),
      WindowOpenDisposition::NEW_FOREGROUND_TAB,
      ui_test_utils::BROWSER_TEST_WAIT_FOR_LOAD_STOP));
  // Even a retained gesture cannot target a background tab's browser commands.
  ASSERT_TRUE(content::ExecJs(contents,
      "chrome.send('executeTahaiCommand', ['tab.new'])"));
  content::RunAllTasksUntilIdle();
  EXPECT_EQ(initial_tabs + 1, browser()->tab_strip_model()->count());
  EXPECT_EQ(GURL("about:blank"), browser()->tab_strip_model()
                                     ->GetActiveWebContents()
                                     ->GetLastCommittedURL());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       TrustedSurfaceBlocksRendererFetchAndBaseReplacement) {
  auto* contents = NavigateToLocalOi();
  ASSERT_TRUE(contents);
  EXPECT_EQ(true, content::EvalJs(contents, R"JS(
    new Promise(async resolve => {
      const violations = new Set();
      let rejected = false;
      const originalBase = document.baseURI;
      const check = () => {
        if (violations.has('connect-src') && violations.has('base-uri'))
          resolve(rejected && document.baseURI === originalBase);
      };
      document.addEventListener('securitypolicyviolation', event => {
        violations.add(event.effectiveDirective);
        check();
      });
      try { await fetch('data:text/plain,renderer-networking-is-forbidden'); }
      catch { rejected = true; }
      const base = document.createElement('base');
      base.href = 'https://replacement.invalid/';
      document.head.append(base);
      check();
    });
  )JS"));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       InspectionRequiresSupportDocumentAndExplicitGesture) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.inspectionResults = 0;
    window.tahaiNetworkInspectionComplete = () => ++window.inspectionResults;
    chrome.send('inspectTahaiNetwork', ['localhost']);
  )JS", content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  content::RunAllTasksUntilIdle();
  EXPECT_EQ(0, content::EvalJs(contents, "window.inspectionResults",
                             content::EXECUTE_SCRIPT_NO_USER_GESTURE));

  // The same request from a real gesture reaches native host validation;
  // localhost is rejected before any DNS or HTTP traffic.
  EXPECT_EQ(true, content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiNetworkInspectionComplete = value => resolve(value.target_rejected);
      chrome.send('inspectTahaiNetwork', ['localhost']);
    });
  )JS"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiLocalOiURL)));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.inspectionResults = 0;
    window.tahaiNetworkInspectionComplete = () => ++window.inspectionResults;
    chrome.send('inspectTahaiNetwork', ['localhost']);
  )JS"));
  content::RunAllTasksUntilIdle();
  EXPECT_EQ(0, content::EvalJs(contents, "window.inspectionResults"));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       InspectionSummaryCannotSurviveSupportReload) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  EXPECT_EQ(true, content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiNetworkInspectionComplete = value => resolve(value.target_rejected);
      chrome.send('inspectTahaiNetwork', ['localhost']);
    });
  )JS"));
  ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
      .WriteText(u"inspection-summary-sentinel");
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    chrome.send('copyTahaiNetworkInspectionSummary', []);
    chrome.send('confirmTahaiNetworkInspectionSummary', []);
  )JS"));
  content::RunAllTasksUntilIdle();
  EXPECT_EQ(u"inspection-summary-sentinel",
            ui::clipboard_test_util::ReadText(
                ui::Clipboard::GetForCurrentThread(),
                ui::ClipboardBuffer::kCopyPaste, nullptr));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       LateInspectionCannotPersistAfterSupportReload) {
  // Control the browser-process loader so this test sends no external traffic
  // and can complete the request strictly after its initiating document dies.
  host_resolver()->AddRule("probe.example.com", "93.184.215.14");
  base::test::TestFuture<mojo::PendingReceiver<network::mojom::URLLoader>,
                        mojo::PendingRemote<network::mojom::URLLoaderClient>>
      request;
  auto received = base::BindPostTaskToCurrentDefault(request.GetCallback());
  content::URLLoaderInterceptor interceptor(base::BindLambdaForTesting(
      [&](content::URLLoaderInterceptor::RequestParams* params) {
        if (params->url_request.url != GURL("https://probe.example.com/")) {
          return false;
        }
        EXPECT_EQ("HEAD", params->url_request.method);
        EXPECT_EQ(network::mojom::CredentialsMode::kOmit,
                  params->url_request.credentials_mode);
        std::move(received).Run(std::move(params->receiver),
                                params->client.Unbind());
        return true;
      }));
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  ASSERT_TRUE(content::ExecJs(contents,
      "chrome.send('inspectTahaiNetwork', ['probe.example.com'])"));
  ASSERT_TRUE(request.Wait());
  auto [receiver, pending_client] = request.Take();
  mojo::Remote<network::mojom::URLLoaderClient> client(std::move(pending_client));
  base::test::TestFuture<void> completed;
  client.set_disconnect_handler(completed.GetCallback());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.lateInspectionResults = 0;
    window.tahaiNetworkInspectionComplete = () => ++window.lateInspectionResults;
  )JS", content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  EXPECT_EQ(true, content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiNetworkInspectionRejected = () => resolve(true);
      chrome.send('inspectTahaiNetwork', ['localhost']);
    });
  )JS"));
  content::URLLoaderInterceptor::WriteResponse(
      "HTTP/1.1 200 OK\nContent-Length: 0\n\n", "", client.get());
  ASSERT_TRUE(completed.Wait());
  content::RunAllTasksUntilIdle();
  EXPECT_EQ(0, content::EvalJs(contents, "window.lateInspectionResults",
                             content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  auto* service =
      TahaiLocalOiServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  EXPECT_TRUE(service->NetworkInspectionHistory("probe.example.com").empty());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       DestructiveAndPrivacyActionsRequireLocalOiGesture) {
  auto* profile = browser()->GetProfile();
  auto* service = TahaiLocalOiServiceFactory::GetForProfile(profile);
  ASSERT_TRUE(service);
  profile->GetPrefs()->SetBoolean(prefs::kTahaiLocalOiReportsEnabled, true);
  LocalOiEntityRecord note;
  note.id = NewLocalOiId();
  const std::string id = note.id;
  note.type = LocalOiEntityType::kNote;
  note.title = "Explicit deletion sentinel";
  note.summary = "Synthetic record that requires a foreground Local OI action.";
  note.source = LocalOiRecordSource::kExplicitUserEntry;
  note.created_at = LocalOiNowTimestamp();
  note.updated_at = note.created_at;
  ASSERT_TRUE(service->UpsertEntity(std::move(note)));
  const auto has_record = [&] {
    return std::ranges::any_of(service->data().entities,
        [&id](const LocalOiEntityRecord& record) { return record.id == id; });
  };
  constexpr char mutate[] = R"JS(
    chrome.send('setTahaiLocalOiControl', ['reports', false]);
    chrome.send('deleteTahaiLocalOiData', []);
  )JS";
  auto* contents = NavigateToLocalOi();
  ASSERT_TRUE(content::ExecJs(contents, mutate,
                             content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  content::RunAllTasksUntilIdle();
  EXPECT_TRUE(has_record());
  EXPECT_TRUE(profile->GetPrefs()->GetBoolean(prefs::kTahaiLocalOiReportsEnabled));

  // An explicit gesture on another trusted surface grants neither operation.
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(kTahaiSupportURL)));
  ASSERT_TRUE(content::ExecJs(contents, mutate));
  content::RunAllTasksUntilIdle();
  EXPECT_TRUE(has_record());
  EXPECT_TRUE(profile->GetPrefs()->GetBoolean(prefs::kTahaiLocalOiReportsEnabled));

  contents = NavigateToLocalOi();
  ASSERT_TRUE(ui_test_utils::NavigateToURLWithDisposition(
      browser(), GURL("about:blank"), WindowOpenDisposition::NEW_FOREGROUND_TAB,
      ui_test_utils::BROWSER_TEST_WAIT_FOR_LOAD_STOP));
  ASSERT_TRUE(content::ExecJs(contents, mutate));
  content::RunAllTasksUntilIdle();
  EXPECT_TRUE(has_record());
  EXPECT_TRUE(profile->GetPrefs()->GetBoolean(prefs::kTahaiLocalOiReportsEnabled));

  browser()->tab_strip_model()->ActivateTabAt(
      browser()->tab_strip_model()->GetIndexOfWebContents(contents));
  EXPECT_EQ(true, content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiLocalOiControlUpdated = (setting, stored) => {
        if (setting !== 'reports' || !stored) { resolve(false); return; }
        window.tahaiLocalOiDataDeleted = () => resolve(true);
        chrome.send('deleteTahaiLocalOiData', []);
      };
      chrome.send('setTahaiLocalOiControl', ['reports', false]);
    });
  )JS"));
  EXPECT_FALSE(has_record());
  EXPECT_FALSE(profile->GetPrefs()->GetBoolean(prefs::kTahaiLocalOiReportsEnabled));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       OffTheRecordProfileDoesNotCreateLocalOiService) {
  Profile* regular_profile = browser()->GetProfile();
  ASSERT_TRUE(TahaiLocalOiServiceFactory::GetForProfile(regular_profile));
  Profile* off_the_record = regular_profile->GetPrimaryOTRProfile(true);
  ASSERT_TRUE(off_the_record);
  EXPECT_EQ(nullptr, TahaiLocalOiServiceFactory::GetForProfile(off_the_record));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       OffTheRecordSurfaceDoesNotReadRegularLocalOiData) {
  Profile* regular_profile = browser()->GetProfile();
  TahaiLocalOiService* regular_service =
      TahaiLocalOiServiceFactory::GetForProfile(regular_profile);
  ASSERT_TRUE(regular_service);
  const std::string now = LocalOiNowTimestamp();
  LocalOiEntityRecord domain;
  domain.id = NewLocalOiId();
  domain.type = LocalOiEntityType::kDomain;
  domain.title = "Regular-profile-only Local OI sentinel";
  domain.summary = "Must never render in an off-the-record surface.";
  domain.source = LocalOiRecordSource::kExplicitUserEntry;
  domain.created_at = now;
  domain.updated_at = now;
  ASSERT_TRUE(regular_service->UpsertEntity(std::move(domain)));

  content::WebContents* regular_contents = NavigateToLocalOi();
  ASSERT_TRUE(regular_contents);
  EXPECT_TRUE(content::EvalJs(
                  regular_contents,
                  "document.body.innerText.includes('Regular-profile-only "
                  "Local OI sentinel')")
                  .ExtractBool());

  Profile* off_the_record = regular_profile->GetPrimaryOTRProfile(true);
  ASSERT_TRUE(off_the_record);
  TahaiUIConfig config;
  EXPECT_TRUE(config.IsWebUIEnabled(regular_profile));
  EXPECT_TRUE(config.IsWebUIEnabled(off_the_record));

  Browser* incognito = CreateIncognitoBrowser(regular_profile);
  ASSERT_TRUE(incognito);
  ASSERT_TRUE(ui_test_utils::NavigateToURL(incognito, GURL(kTahaiLocalOiURL)));
  content::WebContents* contents =
      incognito->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  EXPECT_EQ(GURL(kTahaiLocalOiURL), contents->GetLastCommittedURL());
  EXPECT_FALSE(content::EvalJs(
                   contents,
                   "document.body.innerText.includes('Regular-profile-only "
                   "Local OI sentinel')")
                   .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       OrdinaryHttpsUrlCannotClaimTahaiWebUiController) {
  TahaiUIConfig config;
  EXPECT_FALSE(config.ShouldHandleURL(GURL("https://example.com/local-oi")));
  EXPECT_FALSE(config.ShouldHandleURL(GURL("chrome://tahai/not-a-surface")));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       PRE_LocalOiStorePersistsOnlyProfileLocalTypedRecord) {
  TahaiLocalOiService* service =
      TahaiLocalOiServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  const std::string now = LocalOiNowTimestamp();
  LocalOiEntityRecord note;
  note.id = NewLocalOiId();
  note.type = LocalOiEntityType::kNote;
  note.title = "Browser test persistence marker";
  note.summary = "Synthetic profile-local test record.";
  note.source = LocalOiRecordSource::kExplicitUserEntry;
  note.created_at = now;
  note.updated_at = now;
  ASSERT_TRUE(service->UpsertEntity(std::move(note)));
}

IN_PROC_BROWSER_TEST_F(TahaiLocalOiBrowserTest,
                       LocalOiStorePersistsOnlyProfileLocalTypedRecord) {
  TahaiLocalOiService* service =
      TahaiLocalOiServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  EXPECT_TRUE(std::any_of(
      service->data().entities.begin(), service->data().entities.end(),
      [](const LocalOiEntityRecord& record) {
        return record.type == LocalOiEntityType::kNote &&
               record.title == "Browser test persistence marker" &&
               record.summary == "Synthetic profile-local test record.";
      }));
}

}  // namespace
}  // namespace tahai
