// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_capability_broker.h"

#include <string>

#include "base/values.h"
#include "chrome/common/pref_names.h"
#include "chrome/test/base/chrome_render_view_host_test_harness.h"
#include "components/prefs/pref_service.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "content/public/browser/render_frame_host.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "url/gurl.h"

namespace tahai {
namespace {

class TahaiCapabilityBrokerTest : public ChromeRenderViewHostTestHarness {
 protected:
  TahaiCapabilityRequest Request() {
    return {"connector-demo", std::string(64u, 'a'),
            GURL("https://connector.example/"),
            TahaiCapabilityOperation::kReadExplicitSelection,
            main_rfh()->GetWeakDocumentPtr()};
  }

  void SetUp() override {
    ChromeRenderViewHostTestHarness::SetUp();
    NavigateAndCommit(GURL("https://connector.example/document?section=1"));
  }
};

TEST_F(TahaiCapabilityBrokerTest, ExactOriginRevisionAndOperationAreRequired) {
  TahaiCapabilityBroker broker(profile());
  const auto request = Request();
  EXPECT_FALSE(broker.IsAllowed(request));
  ASSERT_TRUE(broker.GrantReviewed(request));
  EXPECT_TRUE(broker.IsAllowed(request));

  auto changed = request;
  changed.revision_sha256 = std::string(64u, 'b');
  EXPECT_FALSE(broker.IsAllowed(changed));
  changed = request;
  changed.approved_origin = GURL("https://other.example/");
  EXPECT_FALSE(broker.IsAllowed(changed));
  changed = request;
  changed.operation = TahaiCapabilityOperation::kNavigateApprovedOrigin;
  EXPECT_FALSE(broker.IsAllowed(changed));
  changed = request;
  changed.document = {};
  EXPECT_FALSE(broker.IsAllowed(changed));
  EXPECT_FALSE(broker.GrantReviewed(changed));

  TahaiCapabilityBroker reloaded(profile());
  ASSERT_EQ(1u, reloaded.GetGrants().size());
  EXPECT_TRUE(reloaded.IsAllowed(request));
  ASSERT_TRUE(reloaded.Revoke(reloaded.GetGrants().front()));
  EXPECT_FALSE(broker.IsAllowed(request));
}

TEST_F(TahaiCapabilityBrokerTest, SameOriginNavigationExpiresCapturedDocument) {
  TahaiCapabilityBroker broker(profile());
  const auto request = Request();
  ASSERT_TRUE(broker.GrantReviewed(request));
  NavigateAndCommit(GURL("https://connector.example/another-document"));
  EXPECT_FALSE(broker.IsAllowed(request));
  EXPECT_TRUE(broker.IsAllowed(Request()));
  const auto next = Request();
  NavigateAndCommit(GURL("https://elsewhere.example/"));
  EXPECT_FALSE(broker.IsAllowed(next));
  EXPECT_FALSE(broker.IsAllowed(Request()));
}

TEST_F(TahaiCapabilityBrokerTest, RejectsPrivateForeignAndManagedProfiles) {
  TahaiCapabilityBroker broker(profile());
  const auto request = Request();
  ASSERT_TRUE(broker.GrantReviewed(request));

  Profile* incognito = profile()->GetPrimaryOTRProfile(true);
  TahaiCapabilityBroker private_broker(incognito);
  EXPECT_FALSE(private_broker.GrantReviewed(request));
  EXPECT_FALSE(private_broker.IsAllowed(request));
  EXPECT_TRUE(private_broker.GetGrants().empty());

  TestingProfile other;
  TahaiCapabilityBroker foreign_broker(&other);
  EXPECT_FALSE(foreign_broker.GrantReviewed(request));
  EXPECT_FALSE(foreign_broker.IsAllowed(request));

  profile()->GetTestingPrefService()->SetManagedPref(
      prefs::kTahaiCapabilityGrants,
      base::Value(profile()->GetPrefs()->GetDict(prefs::kTahaiCapabilityGrants).Clone()));
  EXPECT_FALSE(broker.IsAllowed(request));
  EXPECT_FALSE(broker.GrantReviewed(request));
  profile()->GetTestingPrefService()->RemoveManagedPref(prefs::kTahaiCapabilityGrants);
  EXPECT_TRUE(broker.IsAllowed(request));
  profile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, false);
  EXPECT_FALSE(broker.IsAllowed(request));
  EXPECT_FALSE(broker.GrantReviewed(request));
}

TEST_F(TahaiCapabilityBrokerTest, PreservesMalformedStateAndDeniesGrants) {
  TahaiCapabilityBroker broker(profile());
  const auto request = Request();
  ASSERT_TRUE(broker.GrantReviewed(request));
  auto malformed = profile()->GetPrefs()->GetDict(prefs::kTahaiCapabilityGrants).Clone();
  malformed.Set("schema_version", 2);
  profile()->GetPrefs()->SetDict(prefs::kTahaiCapabilityGrants, malformed.Clone());
  EXPECT_FALSE(broker.IsAllowed(request));
  EXPECT_FALSE(broker.GrantReviewed(request));
  EXPECT_FALSE(broker.RevokeAllForProvider(request.provider_id));
  EXPECT_TRUE(broker.GetGrants().empty());
  EXPECT_EQ(malformed, profile()->GetPrefs()->GetDict(prefs::kTahaiCapabilityGrants));
}

TEST_F(TahaiCapabilityBrokerTest, RevokingProviderRemovesEveryRevision) {
  TahaiCapabilityBroker broker(profile());
  const auto first = Request();
  auto second = first;
  second.revision_sha256 = std::string(64u, 'b');
  second.operation = TahaiCapabilityOperation::kNavigateApprovedOrigin;
  ASSERT_TRUE(broker.GrantReviewed(first));
  ASSERT_TRUE(broker.GrantReviewed(second));
  EXPECT_TRUE(broker.RevokeAllForProvider("connector-demo"));
  EXPECT_FALSE(broker.IsAllowed(first));
  EXPECT_FALSE(broker.IsAllowed(second));
  EXPECT_FALSE(broker.RevokeAllForProvider("connector-demo"));
}

TEST_F(TahaiCapabilityBrokerTest, DisabledSkinsStillAllowReviewAndRevocation) {
  TahaiCapabilityBroker broker(profile());
  const auto request = Request();
  ASSERT_TRUE(broker.GrantReviewed(request));
  profile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, false);
  EXPECT_FALSE(broker.IsAllowed(request));
  EXPECT_FALSE(broker.GrantReviewed(request));
  const auto grants = broker.GetReviewableGrants();
  ASSERT_TRUE(grants);
  ASSERT_EQ(1u, grants->size());
  EXPECT_TRUE(broker.Revoke(grants->front()));
  profile()->GetPrefs()->SetBoolean(prefs::kTahaiSkinsEnabled, true);
  EXPECT_FALSE(broker.IsAllowed(request));
  ASSERT_TRUE(broker.GetReviewableGrants());
  EXPECT_TRUE(broker.GetReviewableGrants()->empty());

  profile()->GetPrefs()->SetDict(prefs::kTahaiCapabilityGrants,
      base::DictValue().Set("schema_version", 999));
  EXPECT_FALSE(broker.GetReviewableGrants());
  EXPECT_FALSE(broker.Revoke(grants->front()));
}

}  // namespace
}  // namespace tahai
