// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include <array>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/functional/bind.h"
#include "base/test/run_until.h"
#include "base/test/test_future.h"
#include "chrome/browser/tahai_guard/guard_profile_service.h"
#include "chrome/browser/tahai_guard/guard_url_loader_factory.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration_registry.h"
#include "chrome/common/pref_names.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/testing_profile.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "content/public/test/browser_test.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "net/base/net_errors.h"
#include "net/traffic_annotation/network_traffic_annotation_test_helper.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/test/test_url_loader_client.h"
#include "services/network/test/test_url_loader_factory.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai::guard {

// Exercise the production restart callback without waiting 36 seconds in each
// fixture. The configured delays and bounded retry count are asserted below.
// This peer cannot be reached by renderer or production profile operations.
class GuardProfileServiceTestPeer {
 public:
  static bool HasRestart(const GuardProfileService& service) {
    return service.restart_timer_.IsRunning();
  }
  static base::TimeDelta RestartDelay(const GuardProfileService& service) {
    return service.restart_timer_.GetCurrentDelay();
  }
  static void RestartNow(GuardProfileService& service) {
    service.restart_timer_.FireNow();
  }
  static size_t FactoryCount(const GuardProfileService& service) {
    return service.factories_.size();
  }
};

namespace {

using Result = GuardProfileService::Result;
using Update = GuardProfileService::UpdateResult;
using Status = GuardProfileService::Status;
using Decision = mojom::Decision;

// Unlike the request fixture, these tests intentionally use a controlled Mojo
// endpoint, not Rust/network filtering, to force cancellation and fault races.
class ControlledEngine final : public mojom::GuardEngine {
 public:
  void Cosmetics(const std::string&, CosmeticsCallback callback) override {
    std::move(callback).Run({});
  }
  struct Check {
    std::string url;
    std::string origin;
    mojom::RequestKind kind;
    MatchCallback callback;
  };
  mojo::PendingRemote<mojom::GuardEngine> Bind() {
    mojo::PendingRemote<mojom::GuardEngine> remote;
    receiver_.Bind(remote.InitWithNewPipeAndPassReceiver());
    return remote;
  }
  bool HasCompile() const { return !compile_.is_null(); }
  void ReplyCompile(mojom::ConfigureStatus status) {
    auto result = mojom::ConfigureResult::New();
    result->status = status;
    result->accepted_rules = status == mojom::ConfigureStatus::kReady ? 1 : 0;
    std::move(compile_).Run(std::move(result));
  }
  void DropPipe() { receiver_.reset(); }
  std::vector<Check> checks;
  std::string configured_rules;

 private:
  void Configure(const std::string& rules,
                 ConfigureCallback callback) override {
    configured_rules = rules;
    compile_ = std::move(callback);
  }
  void Match(const std::string& url,
             const std::string& origin,
             mojom::RequestKind kind,
             MatchCallback callback) override {
    checks.push_back({url, origin, kind, std::move(callback)});
  }
  ConfigureCallback compile_;
  mojo::Receiver<mojom::GuardEngine> receiver_{this};
};

class TahaiGuardProfileBrowserTest : public InProcessBrowserTest {
 public:
  void SetUpOnMainThread() override {
    InProcessBrowserTest::SetUpOnMainThread();
    profile_ = TestingProfile::Builder().Build();
    TahaiGuardConfiguration configuration;
    configuration.mode = TahaiGuardMode::kCustom;
    ASSERT_TRUE(
        SetTahaiGuardConfigurationForProfile(profile_.get(), configuration));
    service_ = std::make_unique<GuardProfileService>(
        profile_.get(),
        base::BindRepeating(&TahaiGuardProfileBrowserTest::NewSession,
                            base::Unretained(this)));
  }
  void TearDownOnMainThread() override {
    service_.reset();
    engines_.clear();
    profile_.reset();
    InProcessBrowserTest::TearDownOnMainThread();
  }

 protected:
  std::unique_ptr<GuardEngineSession> NewSession() {
    auto engine = std::make_unique<ControlledEngine>();
    auto session = std::make_unique<GuardEngineSession>(engine->Bind());
    engines_.push_back(std::move(engine));
    return session;
  }
  bool ReplyCompile(
      size_t index,
      mojom::ConfigureStatus status = mojom::ConfigureStatus::kReady) {
    if (!base::test::RunUntil([&] {
          return engines_.size() > index && engines_[index]->HasCompile();
        })) {
      return false;
    }
    engines_[index]->ReplyCompile(status);
    return true;
  }
  bool MakeReady() {
    base::test::TestFuture<Update> result;
    service_->InstallCustomRules("||ads.example^", result.GetCallback());
    return ReplyCompile(0) && result.Get() == Update::kInstalled;
  }
  void Check(GuardProfileService::CheckCallback callback) {
    const auto origin = url::Origin::Create(GURL("https://page.example/"));
    service_->Check(GURL("https://ads.example/ad.js"), origin, origin,
                    mojom::RequestKind::kScript, std::move(callback));
  }
  void RequireCustom() {
    profile_->GetTestingPrefService()->SetManagedPref(
        prefs::kTahaiGuardConfiguration,
        base::Value(profile_->GetPrefs()
                        ->GetDict(prefs::kTahaiGuardConfiguration)
                        .Clone()));
  }

  std::unique_ptr<TestingProfile> profile_;
  std::vector<std::unique_ptr<ControlledEngine>> engines_;
  std::unique_ptr<GuardProfileService> service_;
};

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiBalancedAndStrictCompileBundledRules) {
  auto configuration = GetTahaiGuardConfigurationForProfile(profile_.get());
  configuration.mode = TahaiGuardMode::kBalanced;
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(profile_.get(), configuration));
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return engines_.size() == 1 && engines_[0]->HasCompile(); }));
  EXPECT_NE(std::string::npos,
            engines_[0]->configured_rules.find("||doubleclick.net^"));
  ASSERT_TRUE(ReplyCompile(0));
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return service_->GetSnapshot().status == Status::kReady; }));
  ASSERT_TRUE(service_->ClearCustomRules());
  EXPECT_EQ(Status::kReady, service_->GetSnapshot().status);

  base::test::TestFuture<Result> balanced_request;
  Check(balanced_request.GetCallback());
  ASSERT_TRUE(
      base::test::RunUntil([&] { return engines_[0]->checks.size() == 1; }));
  std::move(engines_[0]->checks[0].callback).Run(Decision::kBlock);
  EXPECT_EQ(Result::kBlock, balanced_request.Get());

  configuration.mode = TahaiGuardMode::kStrict;
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(profile_.get(), configuration));
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return engines_.size() == 2 && engines_[1]->HasCompile(); }));
  EXPECT_NE(std::string::npos,
            engines_[1]->configured_rules.find("||newrelic.com^"));
  ASSERT_TRUE(ReplyCompile(1));
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return service_->GetSnapshot().status == Status::kReady; }));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiFailedCandidateKeepsCurrentOwnerGeneration) {
  ASSERT_TRUE(MakeReady());
  base::test::TestFuture<Update> candidate;
  service_->InstallCustomRules("replacement", candidate.GetCallback());
  base::test::TestFuture<Update> duplicate;
  service_->InstallCustomRules("another", duplicate.GetCallback());
  EXPECT_EQ(Update::kBusy, duplicate.Get());
  base::test::TestFuture<Result> request;
  Check(request.GetCallback());
  ASSERT_TRUE(
      base::test::RunUntil([&] { return engines_[0]->checks.size() == 1; }));
  std::move(engines_[0]->checks[0].callback).Run(Decision::kBlock);
  EXPECT_EQ(Result::kBlock, request.Get());
  ASSERT_TRUE(ReplyCompile(1, mojom::ConfigureStatus::kInvalidInput));
  EXPECT_EQ(Update::kCompileFailed, candidate.Get());
  EXPECT_EQ(Status::kLastKnownGood, service_->GetSnapshot().status);
  EXPECT_EQ("||ads.example^",
            profile_->GetPrefs()->GetString(prefs::kTahaiGuardCustomRules));
  EXPECT_EQ(2u, engines_.size());
  EXPECT_FALSE(GuardProfileServiceTestPeer::HasRestart(*service_));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiReplacedGenerationCannotDeliverOldAllow) {
  ASSERT_TRUE(MakeReady());
  RequireCustom();
  base::test::TestFuture<Result> pending;
  Check(pending.GetCallback());
  ASSERT_TRUE(
      base::test::RunUntil([&] { return engines_[0]->checks.size() == 1; }));
  // A managed update invalidates the old generation before compiling its
  // replacement, even if the old utility has already chosen Allow.
  profile_->GetTestingPrefService()->SetManagedPref(
      prefs::kTahaiGuardCustomRules, base::Value("new mandatory rules"));
  std::move(engines_[0]->checks[0].callback).Run(Decision::kAllow);
  EXPECT_EQ(Result::kRequiredUnavailable, pending.Get());
  ASSERT_TRUE(ReplyCompile(1));
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return service_->GetSnapshot().status == Status::kReady; }));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiQueuedBypassCannotCrossMandatoryRevision) {
  auto configuration = GetTahaiGuardConfigurationForProfile(profile_.get());
  configuration.mode = TahaiGuardMode::kOff;
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(profile_.get(), configuration));
  base::test::TestFuture<Result> pending;
  Check(pending.GetCallback());  // Bypass has been posted but not delivered.
  configuration.mode = TahaiGuardMode::kCustom;
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(profile_.get(), configuration));
  RequireCustom();
  EXPECT_EQ(Result::kRequiredUnavailable, pending.Get());
  EXPECT_TRUE(engines_.empty());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiShutdownCancelsCandidateWithoutLatePublication) {
  base::test::TestFuture<Update> pending;
  service_->InstallCustomRules("pending", pending.GetCallback());
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return engines_.size() == 1 && engines_[0]->HasCompile(); }));
  auto weak_service = service_->GetWeakPtr();
  service_->Shutdown();
  EXPECT_FALSE(weak_service);
  EXPECT_EQ(Update::kCancelled, pending.Get());
  engines_[0]->ReplyCompile(mojom::ConfigureStatus::kReady);
  EXPECT_EQ(Status::kStopped, service_->GetSnapshot().status);
  EXPECT_TRUE(
      profile_->GetPrefs()->GetString(prefs::kTahaiGuardCustomRules).empty());
  EXPECT_FALSE(GuardProfileServiceTestPeer::HasRestart(*service_));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiOwnerSanitizesCredentialsAndOpaqueSource) {
  ASSERT_TRUE(MakeReady());
  const auto opaque = url::Origin::Create(GURL("data:text/html,private"));
  base::test::TestFuture<Result> result;
  service_->Check(GURL("https://user:password@ads.example/ad.js?q=1#private"),
                  opaque, opaque, mojom::RequestKind::kImage,
                  result.GetCallback());
  ASSERT_TRUE(
      base::test::RunUntil([&] { return engines_[0]->checks.size() == 1; }));
  auto& check = engines_[0]->checks[0];
  EXPECT_EQ("https://ads.example/ad.js?q=1", check.url);
  EXPECT_TRUE(check.origin.empty());
  EXPECT_EQ(mojom::RequestKind::kImage, check.kind);
  std::move(check.callback).Run(Decision::kBlock);
  EXPECT_EQ(Result::kBlock, result.Get());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiShutdownCannotReturnReusableServiceOrManagedAllow) {
  RequireCustom();
  auto previous_handle = service_->GetWeakPtr();
  ASSERT_TRUE(previous_handle);
  service_->Shutdown();
  EXPECT_FALSE(previous_handle);
  EXPECT_FALSE(service_->GetWeakPtr());
  base::test::TestFuture<Result> result;
  Check(result.GetCallback());
  EXPECT_EQ(Result::kRequiredUnavailable, result.Get());
  EXPECT_EQ(Status::kStopped, service_->GetSnapshot().status);
  EXPECT_TRUE(engines_.empty());
  EXPECT_FALSE(GuardProfileServiceTestPeer::HasRestart(*service_));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiManagedOwnerOverloadDoesNotAllow) {
  ASSERT_TRUE(MakeReady());
  RequireCustom();
  std::vector<std::unique_ptr<base::test::TestFuture<Result>>> requests;
  for (size_t i = 0; i < 128; ++i) {
    auto request = std::make_unique<base::test::TestFuture<Result>>();
    Check(request->GetCallback());
    requests.push_back(std::move(request));
  }
  base::test::TestFuture<Result> overflow;
  Check(overflow.GetCallback());
  EXPECT_EQ(Result::kRequiredUnavailable, overflow.Get());
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return engines_[0]->checks.size() == requests.size(); }));
  for (auto& check : engines_[0]->checks) {
    std::move(check.callback).Run(Decision::kBlock);
  }
  for (const auto& request : requests) {
    EXPECT_EQ(Result::kBlock, request->Get());
  }
  EXPECT_EQ(1u, engines_.size());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiIdleCrashRecoveryHasFiniteBackoff) {
  ASSERT_TRUE(MakeReady());
  engines_[0]->DropPipe();
  const std::array delays = {base::Seconds(1), base::Seconds(5),
                             base::Seconds(30)};
  for (size_t i = 0; i < delays.size(); ++i) {
    ASSERT_TRUE(base::test::RunUntil(
        [&] { return GuardProfileServiceTestPeer::HasRestart(*service_); }));
    EXPECT_EQ(delays[i], GuardProfileServiceTestPeer::RestartDelay(*service_));
    EXPECT_EQ(Status::kUnavailable, service_->GetSnapshot().status);
    GuardProfileServiceTestPeer::RestartNow(*service_);
    ASSERT_TRUE(ReplyCompile(i + 1, mojom::ConfigureStatus::kInvalidInput));
  }
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return service_->GetSnapshot().status == Status::kUnavailable; }));
  EXPECT_EQ(4u, engines_.size());
  EXPECT_FALSE(GuardProfileServiceTestPeer::HasRestart(*service_));
  EXPECT_EQ("||ads.example^",
            profile_->GetPrefs()->GetString(prefs::kTahaiGuardCustomRules));
  base::test::TestFuture<Update> explicit_retry;
  service_->InstallCustomRules("operator retry", explicit_retry.GetCallback());
  ASSERT_TRUE(ReplyCompile(4));
  EXPECT_EQ(Update::kInstalled, explicit_retry.Get());
  EXPECT_EQ(Status::kReady, service_->GetSnapshot().status);
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProfileBrowserTest,
                       TahaiOffCancelsPendingCrashRecovery) {
  ASSERT_TRUE(MakeReady());
  engines_[0]->DropPipe();
  ASSERT_TRUE(base::test::RunUntil(
      [&] { return GuardProfileServiceTestPeer::HasRestart(*service_); }));
  auto configuration = GetTahaiGuardConfigurationForProfile(profile_.get());
  configuration.mode = TahaiGuardMode::kOff;
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(profile_.get(), configuration));
  EXPECT_FALSE(GuardProfileServiceTestPeer::HasRestart(*service_));
  EXPECT_EQ(Status::kOff, service_->GetSnapshot().status);
  base::test::TestFuture<Result> request;
  Check(request.GetCallback());
  EXPECT_EQ(Result::kBypassed, request.Get());
  EXPECT_EQ(1u, engines_.size());
}

class TahaiGuardProxyBrowserTest : public TahaiGuardProfileBrowserTest {
 protected:
  mojo::Remote<network::mojom::URLLoaderFactory> CreateProxy(
      network::TestURLLoaderFactory& terminal) {
    const auto origin = url::Origin::Create(GURL("https://page.example/"));
    network::URLLoaderFactoryBuilder builder;
    service_->OwnFactory(std::make_unique<GuardURLLoaderFactory>(
        service_->GetWeakPtr(),
        GuardURLLoaderFactory::FactoryType::kDocumentSubResource, origin,
        net::IsolationInfo::CreateForInternalRequest(origin), builder));
    mojo::PendingRemote<network::mojom::URLLoaderFactory> target;
    terminal.Clone(target.InitWithNewPipeAndPassReceiver());
    return mojo::Remote<network::mojom::URLLoaderFactory>(
        std::move(builder)
            .Finish<mojo::PendingRemote<network::mojom::URLLoaderFactory>>(
                std::move(target)));
  }
  void Start(network::mojom::URLLoaderFactory* factory,
             mojo::Remote<network::mojom::URLLoader>& loader,
             network::TestURLLoaderClient& client,
             const network::ResourceRequest& request) {
    factory->CreateLoaderAndStart(
        loader.BindNewPipeAndPassReceiver(), 1, 0, request,
        client.CreateRemote(),
        net::MutableNetworkTrafficAnnotationTag(TRAFFIC_ANNOTATION_FOR_TESTS));
  }
  network::ResourceRequest Request() {
    network::ResourceRequest request;
    request.url = GURL("https://ads.example/ad.js");
    request.destination = network::mojom::RequestDestination::kScript;
    return request;
  }
  bool WaitForCheck(size_t index) {
    return base::test::RunUntil(
        [&] { return engines_[0]->checks.size() > index; });
  }
  void Reply(size_t index, Decision decision) {
    std::move(engines_[0]->checks[index].callback).Run(decision);
  }
};

IN_PROC_BROWSER_TEST_F(TahaiGuardProxyBrowserTest,
                       TahaiRendererCannotForgeFactoryAttribution) {
  ASSERT_TRUE(MakeReady());
  auto configuration = GetTahaiGuardConfigurationForProfile(profile_.get());
  const auto forged = url::Origin::Create(GURL("https://exempt.example/"));
  configuration.site_overrides.push_back(
      {forged.GetURL().spec(), TahaiGuardSiteOverrideMode::kOff});
  ASSERT_TRUE(
      SetTahaiGuardConfigurationForProfile(profile_.get(), configuration));
  network::TestURLLoaderFactory terminal;
  auto factory = CreateProxy(terminal);
  auto request = Request();
  request.request_initiator = forged;
  request.trusted_params.emplace();
  request.trusted_params->isolation_info =
      net::IsolationInfo::CreateForInternalRequest(forged);
  request.is_outermost_main_frame = true;
  mojo::Remote<network::mojom::URLLoader> loader;
  network::TestURLLoaderClient client;
  Start(factory.get(), loader, client, request);
  ASSERT_TRUE(WaitForCheck(0));
  EXPECT_EQ("https://page.example/", engines_[0]->checks[0].origin);
  Reply(0, Decision::kBlock);
  client.RunUntilComplete();
  EXPECT_EQ(net::ERR_BLOCKED_BY_CLIENT, client.completion_status().error_code);
  EXPECT_EQ(0u, terminal.total_requests());
}

IN_PROC_BROWSER_TEST_F(
    TahaiGuardProxyBrowserTest,
    TahaiPendingRequestRetainsExactTerminalAfterFactoryClose) {
  ASSERT_TRUE(MakeReady());
  network::TestURLLoaderFactory terminal;
  auto factory = CreateProxy(terminal);
  auto request = Request();
  request.keepalive = true;
  request.headers.SetHeader("X-Fixture", "unchanged");
  mojo::Remote<network::mojom::URLLoader> loader;
  network::TestURLLoaderClient client;
  Start(factory.get(), loader, client, request);
  ASSERT_TRUE(WaitForCheck(0));
  factory.reset();
  Reply(0, Decision::kAllow);
  ASSERT_TRUE(base::test::RunUntil([&] { return terminal.NumPending() == 1; }));
  const auto* downstream = terminal.GetPendingRequest(0);
  ASSERT_TRUE(downstream);
  EXPECT_EQ(request.url, downstream->request.url);
  EXPECT_TRUE(downstream->request.keepalive);
  EXPECT_EQ(std::optional<std::string>("unchanged"),
            downstream->request.headers.GetHeader("X-Fixture"));
  EXPECT_EQ(1u, GuardProfileServiceTestPeer::FactoryCount(*service_));
  client.Unbind();
  ASSERT_TRUE(base::test::RunUntil([&] {
    return GuardProfileServiceTestPeer::FactoryCount(*service_) == 0;
  }));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProxyBrowserTest,
                       TahaiCancelledPreflightCannotForwardLateAllow) {
  ASSERT_TRUE(MakeReady());
  network::TestURLLoaderFactory terminal;
  auto factory = CreateProxy(terminal);
  mojo::Remote<network::mojom::URLLoader> loader;
  network::TestURLLoaderClient client;
  Start(factory.get(), loader, client, Request());
  ASSERT_TRUE(WaitForCheck(0));
  client.Unbind();
  factory.reset();
  ASSERT_TRUE(base::test::RunUntil([&] {
    return GuardProfileServiceTestPeer::FactoryCount(*service_) == 0;
  }));
  Reply(0, Decision::kAllow);
  // A following owner request establishes that the late reply was processed;
  // no arbitrary sleep or merely immediate zero-count assertion is used.
  base::test::TestFuture<Result> barrier;
  Check(barrier.GetCallback());
  ASSERT_TRUE(WaitForCheck(1));
  Reply(1, Decision::kBlock);
  EXPECT_EQ(Result::kBlock, barrier.Get());
  EXPECT_EQ(0u, terminal.total_requests());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProxyBrowserTest,
                       TahaiRedirectOverrideIsCheckedBeforeForwarding) {
  ASSERT_TRUE(MakeReady());
  network::TestURLLoaderFactory terminal(/*observe_loader_requests=*/true);
  auto factory = CreateProxy(terminal);
  mojo::Remote<network::mojom::URLLoader> loader;
  network::TestURLLoaderClient client;
  Start(factory.get(), loader, client, Request());
  ASSERT_TRUE(WaitForCheck(0));
  Reply(0, Decision::kAllow);
  ASSERT_TRUE(base::test::RunUntil([&] { return terminal.NumPending() == 1; }));
  auto* downstream = terminal.GetPendingRequest(0);
  ASSERT_TRUE(downstream);
  net::RedirectInfo redirect;
  redirect.status_code = 307;
  redirect.new_method = "GET";
  redirect.new_url = GURL("https://redirect.example/allowed");
  downstream->client->OnReceiveRedirect(redirect,
                                        network::mojom::URLResponseHead::New());
  ASSERT_TRUE(WaitForCheck(1));
  EXPECT_EQ(redirect.new_url.spec(), engines_[0]->checks[1].url);
  Reply(1, Decision::kAllow);
  client.RunUntilRedirectReceived();
  const GURL override_url("https://ads.example/override");
  loader->FollowRedirect({}, override_url);
  ASSERT_TRUE(WaitForCheck(2));
  EXPECT_EQ(override_url.spec(), engines_[0]->checks[2].url);
  Reply(2, Decision::kBlock);
  client.RunUntilComplete();
  EXPECT_EQ(net::ERR_BLOCKED_BY_CLIENT, client.completion_status().error_code);
  ASSERT_TRUE(downstream->test_url_loader);
  EXPECT_TRUE(downstream->test_url_loader->follow_redirect_params().empty());
  EXPECT_EQ(1u, terminal.total_requests());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProxyBrowserTest,
                       TahaiCloneLimitDoesNotCreateUnboundedReceivers) {
  network::TestURLLoaderFactory terminal;
  auto factory = CreateProxy(terminal);
  std::vector<mojo::Remote<network::mojom::URLLoaderFactory>> clones;
  for (size_t i = 0; i < 256; ++i) {
    mojo::Remote<network::mojom::URLLoaderFactory> clone;
    factory->Clone(clone.BindNewPipeAndPassReceiver());
    clones.push_back(std::move(clone));
  }
  factory.FlushForTesting();
  clones[254].FlushForTesting();
  clones[255].FlushForTesting();
  // The original receiver plus 255 clones fill the fixed 256-receiver bound.
  EXPECT_TRUE(clones[254].is_connected());
  EXPECT_FALSE(clones[255].is_connected());
  EXPECT_EQ(1u, GuardProfileServiceTestPeer::FactoryCount(*service_));
  clones.clear();
  factory.reset();
  ASSERT_TRUE(base::test::RunUntil([&] {
    return GuardProfileServiceTestPeer::FactoryCount(*service_) == 0;
  }));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardProxyBrowserTest,
                       TahaiLostTerminalCannotAcceptLateDecision) {
  ASSERT_TRUE(MakeReady());
  auto terminal = std::make_unique<network::TestURLLoaderFactory>();
  auto factory = CreateProxy(*terminal);
  mojo::Remote<network::mojom::URLLoader> loader;
  network::TestURLLoaderClient client;
  Start(factory.get(), loader, client, Request());
  ASSERT_TRUE(WaitForCheck(0));
  terminal.reset();
  ASSERT_TRUE(base::test::RunUntil([&] { return !factory.is_connected(); }));
  Reply(0, Decision::kAllow);
  client.RunUntilComplete();
  EXPECT_EQ(net::ERR_FAILED, client.completion_status().error_code);
  ASSERT_TRUE(base::test::RunUntil([&] {
    return GuardProfileServiceTestPeer::FactoryCount(*service_) == 0;
  }));
}

}  // namespace
}  // namespace tahai::guard
