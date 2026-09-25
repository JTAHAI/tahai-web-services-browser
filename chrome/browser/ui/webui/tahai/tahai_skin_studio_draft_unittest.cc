// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_skin_studio_draft.h"

#include "base/values.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/testing_pref_service.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

TEST(TahaiSkinStudioDraftTest, ValidatesBeforePersistingDeclarativeSource) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);

  const TahaiSkinStudioDraftResult default_draft =
      LoadTahaiSkinStudioDraft(&prefs);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, default_draft.status);
  ASSERT_FALSE(default_draft.manifest_json.empty());

  const TahaiSkinStudioDraftResult saved =
      SaveTahaiSkinStudioDraft(&prefs, default_draft.manifest_json);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, saved.status);
  EXPECT_EQ(saved.manifest_json,
            LoadTahaiSkinStudioDraft(&prefs).manifest_json);

  const TahaiSkinStudioDraftResult rejected =
      SaveTahaiSkinStudioDraft(&prefs, R"json({"schema_version":2})json");
  EXPECT_EQ(TahaiSkinStudioDraftStatus::kInvalidManifest, rejected.status);
  EXPECT_EQ(saved.manifest_json,
            LoadTahaiSkinStudioDraft(&prefs).manifest_json);
}

TEST(TahaiSkinStudioDraftTest, DoesNotTreatDraftAsPackageOrCapability) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  const TahaiSkinStudioDraftResult saved =
      SaveTahaiSkinStudioDraft(&prefs, GetTahaiSkinStudioDefaultDraft());
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, saved.status);

  const base::DictValue& stored = prefs.GetDict(prefs::kTahaiSkinStudioDraft);
  EXPECT_EQ(1u, stored.size());
  EXPECT_TRUE(stored.contains("manifest_json"));
  EXPECT_FALSE(stored.contains("archive"));
  EXPECT_FALSE(stored.contains("grant"));
  EXPECT_FALSE(stored.contains("credential"));
}

TEST(TahaiSkinStudioDraftTest, DoesNotOverwriteManagedDraft) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  const std::string source = GetTahaiSkinStudioDefaultDraft();
  prefs.SetManagedPref(
      prefs::kTahaiSkinStudioDraft,
      base::DictValue().Set("manifest_json", source));

  const TahaiSkinStudioDraftResult result =
      SaveTahaiSkinStudioDraft(&prefs, R"json({"schema_version":2})json");
  EXPECT_EQ(TahaiSkinStudioDraftStatus::kManaged, result.status);
  EXPECT_FALSE(result.manifest_json.empty());
}

}  // namespace
}  // namespace tahai
