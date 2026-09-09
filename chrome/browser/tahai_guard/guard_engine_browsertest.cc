// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include <algorithm>
#include <memory>
#include <optional>
#include <string>
#include <utility>
#include <vector>

#include "base/test/bind.h"
#include "base/test/run_until.h"
#include "base/test/test_future.h"
#include "chrome/browser/tahai_guard/guard_engine_session.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "content/public/test/browser_test.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai::guard {
namespace {

using Kind = mojom::RequestKind;
using Decision = mojom::Decision;
using Status = mojom::ConfigureStatus;

mojom::ConfigureResultPtr Compile(GuardEngineSession& session,
                                  const std::string& rules) {
  base::test::TestFuture<mojom::ConfigureResultPtr> result;
  session.Compile(rules, result.GetCallback());
  if (!result.Wait()) {
    ADD_FAILURE() << "Guard compile callback was not completed";
    return nullptr;
  }
  return result.Take();
}

std::optional<Decision> Check(GuardEngineSession& session,
                              const std::string& url,
                              const std::string& origin,
                              Kind kind = Kind::kScript) {
  base::test::TestFuture<std::optional<Decision>> result;
  session.Check(url, origin, kind, result.GetCallback());
  if (!result.Wait()) {
    ADD_FAILURE() << "Guard request callback was not completed";
    return std::nullopt;
  }
  return result.Take();
}

class FakeEngine final : public mojom::GuardEngine {
 public:
  mojo::PendingRemote<mojom::GuardEngine> Bind() {
    mojo::PendingRemote<mojom::GuardEngine> remote;
    receiver_.Bind(remote.InitWithNewPipeAndPassReceiver());
    return remote;
  }
  void DropPipe() { receiver_.reset(); }
  bool hold_compile = false;
  bool invalid_reply = false;
  bool hold_cosmetics = false;
  std::vector<std::string> selectors;

 private:
  void Cosmetics(const std::string&, CosmeticsCallback callback) override {
    if (hold_cosmetics) {
      cosmetics_ = std::move(callback);
    } else {
      std::move(callback).Run(selectors);
    }
  }
  CosmeticsCallback cosmetics_;
  void Configure(const std::string&, ConfigureCallback callback) override {
    if (hold_compile) {
      compile_callback_ = std::move(callback);
      return;
    }
    auto result = mojom::ConfigureResult::New();
    result->status = Status::kReady;
    result->accepted_rules = invalid_reply ? 0 : 1;
    std::move(callback).Run(std::move(result));
  }
  void Match(const std::string&,
             const std::string&,
             Kind,
             MatchCallback callback) override {
    checks_.push_back(std::move(callback));
  }
  ConfigureCallback compile_callback_;
  std::vector<MatchCallback> checks_;
  mojo::Receiver<mojom::GuardEngine> receiver_{this};
};

class TahaiGuardEngineBrowserTest : public InProcessBrowserTest {};

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiOpaqueSourceStillChecksGeneralNetworkRules) {
  GuardEngineSession session;
  auto configured = Compile(session, "||ads.example^$third-party");
  ASSERT_TRUE(configured);
  ASSERT_EQ(Status::kReady, configured->status);
  EXPECT_EQ(Decision::kBlock, Check(session, "https://ads.example/ad.js", ""));
  EXPECT_EQ(Decision::kAllow,
            Check(session, "https://shop.example/main.js", ""));
  // An invalid non-empty origin is still rejected, not silently downgraded.
  EXPECT_EQ(Decision::kInvalidRequest,
            Check(session, "https://ads.example/ad.js", "not-an-origin"));
}

// These tests exercise the real sandboxed Rust engine via IPC unless they
// explicitly instantiate FakeEngine to simulate failure. They do NOT certify
// URLLoaderFactory coverage, profile routing, default lists, or visible UI.
IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiNetworkRulesAndExceptions) {
  GuardEngineSession session;
  auto configured = Compile(session,
                            "||ads.example^$script,third-party\n"
                            "@@||ads.example/allowed.js$script\n"
                            "||images.example^$image\n");
  ASSERT_TRUE(configured);
  ASSERT_EQ(Status::kReady, configured->status);
  EXPECT_EQ(3u, configured->accepted_rules);
  EXPECT_EQ(0u, configured->ignored_rules);
  EXPECT_EQ(Decision::kBlock, Check(session, "https://ads.example/ad.js",
                                    "https://shop.example/"));
  EXPECT_EQ(Decision::kAllow, Check(session, "https://ads.example/allowed.js",
                                    "https://shop.example/"));
  EXPECT_EQ(Decision::kAllow, Check(session, "https://ads.example/ad.js",
                                    "https://ads.example/"));
  EXPECT_EQ(Decision::kAllow, Check(session, "https://ads.example/logo.png",
                                    "https://shop.example/", Kind::kImage));
  EXPECT_EQ(Decision::kBlock,
            Check(session, "https://images.example/banner.png",
                  "https://shop.example/", Kind::kImage));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiChromiumPrivateSuffixClassification) {
  GuardEngineSession session;
  auto configured = Compile(session, "||asset.github.io^$third-party\n");
  ASSERT_TRUE(configured);
  ASSERT_EQ(Status::kReady, configured->status);
  EXPECT_EQ(Decision::kBlock, Check(session, "https://asset.github.io/ad.js",
                                    "https://another.github.io/"));
  EXPECT_EQ(Decision::kAllow, Check(session, "https://asset.github.io/ad.js",
                                    "https://asset.github.io/"));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiDeclarativeFilteringRejectsActiveContentOptions) {
  GuardEngineSession session;
  auto configured = Compile(session,
                            "! source fixture, not a shipped filter list\n"
                            "[Adblock Plus 2.0]\n"
                            "||ads.example^\n"
                            "shop.example##.advert\n"
                            "||replace.example^$redirect=noopjs\n"
                            "||rewrite.example^$removeparam=tracking\n"
                            "||policy.example^$csp=script-src 'none'\n");
  ASSERT_TRUE(configured);
  ASSERT_EQ(Status::kReady, configured->status);
  EXPECT_EQ(2u, configured->accepted_rules);
  EXPECT_EQ(3u, configured->ignored_rules);
  EXPECT_EQ(Decision::kAllow, Check(session, "https://replace.example/ad.js",
                                    "https://shop.example/"));
  EXPECT_EQ(Decision::kBlock, Check(session, "https://ads.example/ad.js",
                                    "https://shop.example/"));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiRequestBoundsAndCanonicalOrigins) {
  GuardEngineSession session;
  auto configured = Compile(session, "||ads.example^\n");
  ASSERT_TRUE(configured);
  ASSERT_EQ(Status::kReady, configured->status);
  for (const std::string origin :
       {"null", "file:///tmp/private", "https://shop.example/path",
        "https://shop.example/?x=1", "https://user:pass@shop.example/",
        "https://shop.example/#fragment"}) {
    EXPECT_EQ(Decision::kInvalidRequest,
              Check(session, "https://ads.example/ad.js", origin));
  }
  EXPECT_EQ(Decision::kInvalidRequest,
            Check(session, "file:///private.txt", "https://shop.example/"));
  EXPECT_EQ(Decision::kInvalidRequest,
            Check(session, "https://user:pass@ads.example/",
                  "https://shop.example/"));
  EXPECT_EQ(Decision::kInvalidRequest,
            Check(session, std::string(8193, 'a'), "https://shop.example/"));
  EXPECT_EQ(Decision::kInvalidRequest,
            Check(session, "https://ads.example/", std::string(8193, 'a')));
  EXPECT_EQ(Decision::kBlock,
            Check(session, "https://ads.example/ad.js#ignored",
                  "https://shop.example/"));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiGenerationsAreIndependentAndImmutable) {
  GuardEngineSession first;
  GuardEngineSession second;
  auto a = Compile(first, "||first.example^\n");
  auto b = Compile(second, "||second.example^\n");
  ASSERT_TRUE(a);
  ASSERT_TRUE(b);
  ASSERT_EQ(Status::kReady, a->status);
  ASSERT_EQ(Status::kReady, b->status);
  auto replacement = Compile(first, "||second.example^\n");
  ASSERT_TRUE(replacement);
  EXPECT_EQ(Status::kAlreadyConfigured, replacement->status);
  EXPECT_EQ(Decision::kBlock,
            Check(first, "https://first.example/x", "https://site.example/"));
  EXPECT_EQ(Decision::kAllow,
            Check(second, "https://first.example/x", "https://site.example/"));
  EXPECT_EQ(Decision::kAllow,
            Check(first, "https://second.example/x", "https://site.example/"));
  EXPECT_EQ(Decision::kBlock,
            Check(second, "https://second.example/x", "https://site.example/"));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiInputLimitsRejectWholeGeneration) {
  const std::vector<std::pair<std::string, Status>> cases = {
      {"! only a comment\n", Status::kNoRules},
      {"shop.example##.advert\n", Status::kNoRules},
      {"||ads.example^\n" + std::string(8193, 'a'), Status::kInputTooLarge},
      {"||ads.example^\ninvalid\x01input", Status::kInvalidInput},
      {std::string(4 * 1024 * 1024 + 1, 'a'), Status::kInputTooLarge},
      {std::string("\xff", 1), Status::kInvalidInput},
  };
  for (const auto& [rules, expected] : cases) {
    GuardEngineSession session;
    auto configured = Compile(session, rules);
    ASSERT_TRUE(configured);
    EXPECT_EQ(expected, configured->status);
    EXPECT_FALSE(session.ready());
    EXPECT_FALSE(
        Check(session, "https://ads.example/x", "https://site.example/"));
  }
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiQueueIsBoundedAndTimeoutIsNotAllow) {
  FakeEngine fake;
  GuardEngineSession session(fake.Bind());
  ASSERT_TRUE(Compile(session, "||ads.example^"));
  ASSERT_TRUE(session.ready());
  int completed = 0;
  for (int i = 0; i < 128; ++i) {
    session.Check(
        "https://ads.example/x", "https://site.example/", Kind::kScript,
        base::BindLambdaForTesting([&](std::optional<Decision> result) {
          EXPECT_FALSE(result);
          ++completed;
        }));
  }
  EXPECT_EQ(128u, session.pending_requests_for_testing());
  EXPECT_FALSE(
      Check(session, "https://ads.example/overflow", "https://site.example/"));
  ASSERT_TRUE(base::test::RunUntil([&] { return completed == 128; }));
  EXPECT_FALSE(session.ready());
  EXPECT_EQ(0u, session.pending_requests_for_testing());
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiDisconnectAndStopCompletePendingRequests) {
  for (bool disconnect : {false, true}) {
    FakeEngine fake;
    auto session = std::make_unique<GuardEngineSession>(fake.Bind());
    ASSERT_TRUE(Compile(*session, "||ads.example^"));
    base::test::TestFuture<std::optional<Decision>> pending;
    session->Check("https://ads.example/x", "https://site.example/",
                   Kind::kScript, pending.GetCallback());
    if (disconnect) {
      fake.DropPipe();
    } else {
      session.reset();
    }
    ASSERT_TRUE(pending.Wait());
    EXPECT_FALSE(pending.Get());
  }
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiInvalidCompileReplyCannotEnableEngine) {
  FakeEngine fake;
  fake.invalid_reply = true;
  GuardEngineSession session(fake.Bind());
  EXPECT_FALSE(Compile(session, "||ads.example^"));
  EXPECT_FALSE(session.ready());
  EXPECT_FALSE(
      Check(session, "https://ads.example/x", "https://site.example/"));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiCancellationBeforeCompileReply) {
  FakeEngine fake;
  fake.hold_compile = true;
  GuardEngineSession session(fake.Bind());
  base::test::TestFuture<mojom::ConfigureResultPtr> pending;
  session.Compile("||ads.example^", pending.GetCallback());
  session.Stop();
  ASSERT_TRUE(pending.Wait());
  EXPECT_FALSE(pending.Get());
  EXPECT_FALSE(session.ready());
  EXPECT_FALSE(
      Check(session, "https://ads.example/x", "https://site.example/"));
}

IN_PROC_BROWSER_TEST_F(TahaiGuardEngineBrowserTest,
                       TahaiCosmeticsHonorExceptionsAndGenericHide) {
  GuardEngineSession session;
  auto result =
      Compile(session,
              "##.advert\n##div[data-ad]\nshop.example##.sponsor\n"
              "shop.example#@#.advert\n@@||private.example^$generichide\n"
              "shop.example##+js(set, x, y)\nshop.example##.bad {color:red}\n");
  ASSERT_TRUE(result);
  ASSERT_EQ(Status::kReady, result->status);
  EXPECT_EQ(5u, result->accepted_rules);
  EXPECT_EQ(2u, result->ignored_rules);
  base::test::TestFuture<std::vector<std::string>> selectors;
  session.Cosmetics("https://shop.example/page", selectors.GetCallback());
  auto actual = selectors.Take();
  EXPECT_TRUE(std::ranges::contains(actual, ".sponsor"));
  EXPECT_TRUE(std::ranges::contains(actual, "div[data-ad]"));
  EXPECT_FALSE(std::ranges::contains(actual, ".advert"));
  session.Cosmetics("https://other.example/", selectors.GetCallback());
  EXPECT_TRUE(std::ranges::contains(selectors.Take(), ".advert"));
  session.Cosmetics("https://private.example/", selectors.GetCallback());
  EXPECT_TRUE(selectors.Take().empty());
  session.Cosmetics("chrome://settings", selectors.GetCallback());
  EXPECT_TRUE(selectors.Take().empty());
}

IN_PROC_BROWSER_TEST_F(
    TahaiGuardEngineBrowserTest,
    TahaiUnsafeCosmeticReplyAndDeadlineFailClosedAtBoundary) {
  for (bool timeout : {false, true}) {
    FakeEngine fake;
    fake.hold_cosmetics = timeout;
    fake.selectors = {".valid", "body{} @import 'https://attacker.example'"};
    GuardEngineSession session(fake.Bind());
    ASSERT_TRUE(Compile(session, "##.advert"));
    base::test::TestFuture<std::vector<std::string>> selectors;
    session.Cosmetics("https://shop.example/", selectors.GetCallback());
    EXPECT_TRUE(selectors.Get().empty());
    EXPECT_FALSE(session.ready());
  }
}

}  // namespace
}  // namespace tahai::guard
