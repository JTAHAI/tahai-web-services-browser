// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_skin_studio_draft.h"

#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/strings/string_number_conversions.h"
#include "base/values.h"
#include "base/version_info/version_info.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "components/prefs/pref_registry_simple.h"
#include "components/prefs/testing_pref_service.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

TEST(TahaiSkinStudioDraftTest, NewDraftTargetsRunningEngineOnly) {
  const auto draft = base::JSONReader::ReadDict(
      GetTahaiSkinStudioDefaultDraft(), base::JSON_PARSE_RFC);
  ASSERT_TRUE(draft);
  const auto* compatibility = draft->FindDict("compatibility");
  ASSERT_TRUE(compatibility);
  EXPECT_EQ(version_info::GetMajorVersionNumberAsInt(),
            compatibility->FindInt("min_chromium_major"));
  EXPECT_EQ(version_info::GetMajorVersionNumberAsInt(),
            compatibility->FindInt("max_chromium_major"));
}

TEST(TahaiSkinStudioDraftTest, ExistingCompatibilityIsNeverSilentlyWidened) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  auto draft = base::JSONReader::ReadDict(GetTahaiSkinStudioDefaultDraft(),
                                          base::JSON_PARSE_RFC);
  ASSERT_TRUE(draft);
  auto* compatibility = draft->FindDict("compatibility");
  ASSERT_TRUE(compatibility);
  compatibility->Set("min_chromium_major", 152);
  compatibility->Set("max_chromium_major", 152);
  auto encoded = base::WriteJson(*draft);
  ASSERT_TRUE(encoded);
  const auto saved = SaveTahaiSkinStudioDraft(&prefs, *encoded);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, saved.status);
  const auto loaded = LoadTahaiSkinStudioDraft(&prefs);
  EXPECT_EQ(saved.manifest_json, loaded.manifest_json);
  const auto restored =
      base::JSONReader::ReadDict(loaded.manifest_json, base::JSON_PARSE_RFC);
  ASSERT_TRUE(restored);
  EXPECT_EQ(152,
            restored->FindDict("compatibility")->FindInt("max_chromium_major"));
}

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

TEST(TahaiSkinStudioDraftTest, FreshDraftUsesDistinctRoyalLightAndDarkPalettes) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  const auto draft = LoadTahaiSkinStudioDraft(&prefs);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, draft.status);
  auto source = base::JSONReader::ReadDict(draft.manifest_json,
                                         base::JSON_PARSE_RFC);
  ASSERT_TRUE(source);
  const auto* appearance = source->FindDict("appearance");
  ASSERT_TRUE(appearance);
  const auto* light = appearance->FindDict("light_tokens");
  const auto* dark = appearance->FindDict("dark_tokens");
  ASSERT_TRUE(light);
  ASSERT_TRUE(dark);
  ASSERT_TRUE(light->FindString("toolbar_background"));
  ASSERT_TRUE(dark->FindString("toolbar_background"));
  ASSERT_TRUE(dark->FindString("tab_background"));
  ASSERT_TRUE(dark->FindString("shell_background"));
  EXPECT_EQ("#ffffff", *light->FindString("toolbar_background"));
  EXPECT_EQ("#090612", *dark->FindString("toolbar_background"));
  EXPECT_EQ("#171026", *dark->FindString("tab_background"));
  EXPECT_NE(*dark->FindString("tab_background"),
            *dark->FindString("shell_background"));
  EXPECT_TRUE(prefs.GetDict(prefs::kTahaiSkinStudioDraft).empty());
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

TEST(TahaiSkinStudioDraftTest, CanonicalGrowthCannotReplaceLastReloadableDraft) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk,
            SaveTahaiSkinStudioDraft(&prefs, GetTahaiSkinStudioDefaultDraft()).status);
  auto source = base::JSONReader::ReadDict(GetTahaiSkinStudioDefaultDraft(), base::JSON_PARSE_RFC);
  ASSERT_TRUE(source);
  auto* workflows = source->FindDict("operational")->FindList("workflows");
  ASSERT_TRUE(workflows);
  auto prototype = workflows->front().GetDict().Clone();
  base::ListValue steps;
  for (int index = 0; index < 32; ++index) {
    steps.Append(base::DictValue().Set("id", "step-" + base::NumberToString(index))
        .Set("name", std::string(120, 'x')).Set("kind", "checkpoint"));
  }
  prototype.Set("steps", std::move(steps));
  workflows->clear();
  bool tested_boundary = false;
  for (int index = 0; index < 24; ++index) {
    auto workflow = prototype.Clone();
    if (index) workflow.Set("id", "workflow-" + base::NumberToString(index));
    workflows->Append(std::move(workflow));
    const auto compact = base::WriteJson(*source);
    ASSERT_TRUE(compact);
    std::string canonical;
    ASSERT_TRUE(base::JSONWriter::WriteWithOptions(
        *source, base::JSONWriter::OPTIONS_PRETTY_PRINT, &canonical));
    ASSERT_LE(compact->size(), skins::kMaxManifestBytes);
    const auto before = prefs.GetDict(prefs::kTahaiSkinStudioDraft).Clone();
    const auto saved = SaveTahaiSkinStudioDraft(&prefs, *compact);
    if (canonical.size() > skins::kMaxManifestBytes) {
      EXPECT_EQ(TahaiSkinStudioDraftStatus::kTooLarge, saved.status);
      EXPECT_TRUE(saved.manifest_json.empty());
      EXPECT_EQ(before, prefs.GetDict(prefs::kTahaiSkinStudioDraft));
      const auto restored = LoadTahaiSkinStudioDraft(&prefs);
      ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, restored.status);
      EXPECT_EQ(*before.FindString("manifest_json"), restored.manifest_json);
      tested_boundary = true;
      break;
    }
    ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, saved.status);
    EXPECT_EQ(canonical, saved.manifest_json);
    EXPECT_EQ(saved.manifest_json, LoadTahaiSkinStudioDraft(&prefs).manifest_json);
  }
  EXPECT_TRUE(tested_boundary);
}

TEST(TahaiSkinStudioDraftTest, OversizedStoredDraftFallbackNeverOverwritesOriginalBytes) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  const std::string oversized(skins::kMaxManifestBytes + 1, ' ');
  prefs.SetDict(prefs::kTahaiSkinStudioDraft,
                base::DictValue().Set("manifest_json", oversized));
  const auto before = prefs.GetDict(prefs::kTahaiSkinStudioDraft).Clone();
  const auto loaded = LoadTahaiSkinStudioDraft(&prefs);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk, loaded.status);
  EXPECT_LE(loaded.manifest_json.size(), skins::kMaxManifestBytes);
  EXPECT_EQ(before, prefs.GetDict(prefs::kTahaiSkinStudioDraft));
  EXPECT_EQ(TahaiSkinStudioDraftStatus::kTooLarge,
            SaveTahaiSkinStudioDraft(&prefs, oversized).status);
  EXPECT_EQ(before, prefs.GetDict(prefs::kTahaiSkinStudioDraft));
}

TEST(TahaiSkinStudioDraftTest, JsonDiagnosticsNeverEchoRejectedSource) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk,
            SaveTahaiSkinStudioDraft(&prefs, GetTahaiSkinStudioDefaultDraft()).status);
  const auto before = prefs.GetDict(prefs::kTahaiSkinStudioDraft).Clone();
  const auto rejected = SaveTahaiSkinStudioDraft(
      &prefs, "{\n\"private-sentinel\": invalid}");
  EXPECT_EQ(TahaiSkinStudioDraftStatus::kInvalidJson, rejected.status);
  EXPECT_EQ("syntax", rejected.diagnostic);
  EXPECT_EQ(2, rejected.error_line);
  EXPECT_GT(rejected.error_column, 0);
  EXPECT_TRUE(rejected.manifest_json.empty());
  const auto root = SaveTahaiSkinStudioDraft(&prefs, "[\"private-sentinel\"]");
  EXPECT_EQ(TahaiSkinStudioDraftStatus::kInvalidManifest, root.status);
  EXPECT_EQ("root-object", root.diagnostic);
  EXPECT_EQ(0, root.error_line);
  EXPECT_EQ(0, root.error_column);
  EXPECT_TRUE(root.manifest_json.empty());
  const auto large = SaveTahaiSkinStudioDraft(
      &prefs, std::string(skins::kMaxManifestBytes + 1, 'x'));
  EXPECT_EQ(TahaiSkinStudioDraftStatus::kTooLarge, large.status);
  EXPECT_TRUE(large.diagnostic.empty());
  EXPECT_EQ(before, prefs.GetDict(prefs::kTahaiSkinStudioDraft));
}

TEST(TahaiSkinStudioDraftTest, ManifestDiagnosticsIdentifyBoundedSections) {
  TestingPrefServiceSimple prefs;
  prefs.registry()->RegisterDictionaryPref(prefs::kTahaiSkinStudioDraft);
  ASSERT_EQ(TahaiSkinStudioDraftStatus::kOk,
            SaveTahaiSkinStudioDraft(&prefs, GetTahaiSkinStudioDefaultDraft()).status);
  const auto before = prefs.GetDict(prefs::kTahaiSkinStudioDraft).Clone();
  for (const std::string category : {"unknown-field", "schema", "appearance",
                                    "capabilities", "surface", "workflow", "mode"}) {
    SCOPED_TRACE(category);
    auto source = base::JSONReader::ReadDict(
        GetTahaiSkinStudioDefaultDraft(), base::JSON_PARSE_RFC);
    ASSERT_TRUE(source);
    auto* operational = source->FindDict("operational");
    if (category == "unknown-field") source->Set("private-sentinel", true);
    if (category == "schema") source->Set("schema_version", 99);
    if (category == "appearance") source->Set("appearance", "private-sentinel");
    if (category == "capabilities")
      operational->Set("capabilities", base::ListValue().Append("private-sentinel"));
    if (category == "surface")
      operational->FindList("surfaces")->front().GetDict().Set("layout", "private-sentinel");
    if (category == "workflow")
      operational->FindList("workflows")->front().GetDict().Set("steps", false);
    if (category == "mode")
      operational->FindList("modes")->front().GetDict().Set("surface", "private-sentinel");
    const auto json = base::WriteJson(*source);
    ASSERT_TRUE(json);
    const auto rejected = SaveTahaiSkinStudioDraft(&prefs, *json);
    EXPECT_EQ(TahaiSkinStudioDraftStatus::kInvalidManifest, rejected.status);
    EXPECT_EQ(category, rejected.diagnostic);
    EXPECT_TRUE(rejected.manifest_json.empty());
    EXPECT_EQ(0, rejected.error_line);
    EXPECT_EQ(0, rejected.error_column);
    EXPECT_EQ(before, prefs.GetDict(prefs::kTahaiSkinStudioDraft));
  }
  const auto saved = SaveTahaiSkinStudioDraft(&prefs, GetTahaiSkinStudioDefaultDraft());
  EXPECT_TRUE(saved.diagnostic.empty());
  EXPECT_EQ(0, saved.error_line);
  EXPECT_EQ(0, saved.error_column);
}

}  // namespace
}  // namespace tahai
