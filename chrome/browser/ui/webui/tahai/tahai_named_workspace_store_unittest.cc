// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_named_workspace_store.h"

#include "chrome/common/pref_names.h"
#include "chrome/test/base/testing_profile.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "content/public/test/browser_task_environment.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

class TahaiNamedWorkspaceStoreTest : public testing::Test {
 protected:
  NamedWorkspace Example() {
    NamedWorkspace workspace;
    workspace.name = "Reference desk";
    workspace.mode = "research";
    workspace.rail_state = "expanded";
    workspace.tabs = {{GURL("https://example.test/reference"), false, -1}};
    return workspace;
  }
  content::BrowserTaskEnvironment environment_;
  TestingProfile profile_;
};

TEST_F(TahaiNamedWorkspaceStoreTest, ManagedStoreCannotCreateShadowUserEdits) {
  NamedWorkspaceStore store(&profile_);
  auto* preferences = profile_.GetTestingPrefService();
  const auto id = store.Add(Example());
  ASSERT_TRUE(id);
  const auto original =
      preferences->GetDict(prefs::kTahaiNamedWorkspaces).Clone();
  preferences->SetManagedPref(prefs::kTahaiNamedWorkspaces,
                              base::Value(original.Clone()));
  ASSERT_TRUE(store.Find(*id));
  EXPECT_FALSE(store.Add(Example()));
  EXPECT_FALSE(store.Replace(*id, Example()));
  EXPECT_FALSE(store.Rename(*id, "Shadow rename"));
  EXPECT_FALSE(store.Remove(*id));
  EXPECT_EQ(original,
            preferences->GetRawUserPrefValue(prefs::kTahaiNamedWorkspaces)
                ->GetDict());
  preferences->RemoveManagedPref(prefs::kTahaiNamedWorkspaces);
  EXPECT_EQ(original, preferences->GetDict(prefs::kTahaiNamedWorkspaces));
  EXPECT_TRUE(store.Rename(*id, "Explicit rename"));
}

TEST_F(TahaiNamedWorkspaceStoreTest, WrongTypedStoreCannotBeReplacedBySave) {
  NamedWorkspaceStore store(&profile_);
  auto* preferences = profile_.GetTestingPrefService();
  preferences->SetUserPref(prefs::kTahaiNamedWorkspaces,
                           base::Value("corrupt"));
  EXPECT_FALSE(store.Read());
  EXPECT_FALSE(store.Add(Example()));
  EXPECT_FALSE(store.Remove("missing"));
  EXPECT_EQ("corrupt",
            preferences->GetRawUserPrefValue(prefs::kTahaiNamedWorkspaces)
                ->GetString());
}

}  // namespace
}  // namespace tahai
