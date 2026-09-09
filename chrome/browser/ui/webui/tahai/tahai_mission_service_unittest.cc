// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"

#include <algorithm>
#include <array>
#include <limits>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

#include "base/containers/span.h"
#include "base/json/json_writer.h"
#include "base/pickle.h"
#include "base/scoped_observation.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/test/bind.h"
#include "base/uuid.h"
#include "base/values.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration_registry.h"
#include "chrome/browser/ui/tahai/tahai_environment_guard_registry.h"
#include "chrome/browser/ui/tahai/tahai_identity_lane.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_store.h"
#include "chrome/browser/ui/webui/tahai/tahai_change_lens_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_environment_guard.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_model.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_policy.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_rule_engine.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_capsule.h"
#include "chrome/browser/ui/webui/tahai/tahai_network_inspector.h"
#include "chrome/browser/ui/webui/tahai/tahai_oi_promotion_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_pack_bundle.h"
#include "chrome/browser/ui/webui/tahai/tahai_pack_manifest.h"
#include "chrome/browser/ui/webui/tahai/tahai_pilot_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_recall_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_sentinel_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_sentinel_schedule.h"
#include "chrome/browser/ui/webui/tahai/tahai_skin_catalog.h"
#include "chrome/browser/ui/webui/tahai/tahai_skin_manifest.h"
#include "chrome/browser/ui/webui/tahai/tahai_skin_package.h"
#include "chrome/browser/ui/webui/tahai/tahai_skin_resolution.h"
#include "chrome/browser/ui/webui/tahai/tahai_skin_selection.h"
#include "chrome/browser/ui/webui/tahai/tahai_skin_selection_registry.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_conflict.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_envelope.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_key_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_team_mission_contract.h"
#include "chrome/common/pref_names.h"
#include "chrome/test/base/testing_profile.h"
#include "components/prefs/pref_service.h"
#include "components/sessions/core/session_service_commands.h"
#include "components/split_tabs/split_tab_visual_data.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "content/public/test/browser_task_environment.h"
#include "crypto/keypair.h"
#include "crypto/sha2.h"
#include "crypto/sign.h"
#include "net/base/net_errors.h"
#include "services/network/public/mojom/url_loader_factory.mojom.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "url/gurl.h"

namespace base {

inline bool Contains(std::string_view haystack, std::string_view needle) {
  return haystack.contains(needle);
}

}  // namespace base

namespace tahai {
namespace {

class MissionServiceTest : public testing::Test {
 protected:
  content::BrowserTaskEnvironment task_environment_;
  TestingProfile profile_;
};

NamedWorkspace ExampleNamedWorkspace() {
  NamedWorkspace workspace;
  workspace.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  workspace.name = "Weekly review";
  workspace.mode = "research";
  workspace.rail_state = "expanded";
  workspace.rail_width = 310;
  workspace.active_tab = 1;
  workspace.tabs = {{GURL("https://example.test/a?view=1"), false, 0},
                    {GURL("https://example.test/b"), false, 0},
                    {GURL("https://example.test/c"), false, 0},
                    {GURL("https://example.test/d"), false, 0}};
  workspace.groups.emplace_back(u"Sources", tab_groups::TabGroupColorId::kBlue);
  NamedWorkspaceSplit split;
  split.tabs = {0, 1, 2, 3};
  split.visual.set_split_layout(split_tabs::SplitTabLayout::kStacked);
  split.visual.set_split_ratio(0.6);
  split.visual.set_tahai_grid_ratios(0.3, 0.7);
  workspace.splits.push_back(std::move(split));
  return workspace;
}

TEST_F(MissionServiceTest, TahaiNamedWorkspaceCodecPreservesLayoutsAndGroups) {
  const auto workspace = ExampleNamedWorkspace();
  ASSERT_TRUE(NamedWorkspaceStore::Validate(workspace));
  const auto encoded = NamedWorkspaceStore::Encode(workspace);
  auto decoded = NamedWorkspaceStore::Decode(encoded);
  ASSERT_TRUE(decoded);
  EXPECT_EQ(encoded, NamedWorkspaceStore::Encode(*decoded));
  EXPECT_EQ(0.3, decoded->splits[0].visual.tahai_row_ratio());
  EXPECT_EQ(0.7, decoded->splits[0].visual.tahai_column_ratio());
  EXPECT_EQ(1, decoded->active_tab);
}

TEST_F(MissionServiceTest, TahaiNamedWorkspaceNameValidationUsesStoredBytes) {
  EXPECT_TRUE(NamedWorkspaceStore::IsValidName("Weekly review"));
  EXPECT_TRUE(NamedWorkspaceStore::IsValidName(std::string(120, 'a')));
  EXPECT_FALSE(NamedWorkspaceStore::IsValidName({}));
  EXPECT_FALSE(NamedWorkspaceStore::IsValidName(std::string(121, 'a')));
  EXPECT_FALSE(NamedWorkspaceStore::IsValidName("line\nbreak"));
}

TEST_F(MissionServiceTest, TahaiNamedWorkspaceRejectsUnsafeUrlsAndPartitions) {
  EXPECT_TRUE(NamedWorkspaceStore::IsRestorableUrl(GURL("tahai://home/")));
  EXPECT_EQ(
      GURL("chrome://tahai/"),
      NamedWorkspaceStore::CanonicalizeInternalUrl(GURL("tahai://home/")));
  for (const char* url :
       {"javascript:alert(1)", "data:text/plain,test", "file:///C:/private.txt",
        "https://u:p@example.test/", "chrome://settings/",
        "https://u@example.test/", "about:crash",
        "blob:https://example.test/abc", "tahai://home/?action=delete",
        "chrome://tahai/unknown/"}) {
    SCOPED_TRACE(url);
    auto workspace = ExampleNamedWorkspace();
    workspace.tabs[0].url = GURL(url);
    EXPECT_FALSE(NamedWorkspaceStore::Validate(workspace));
  }
  auto workspace = ExampleNamedWorkspace();
  workspace.tabs[1].group = -1;
  EXPECT_FALSE(NamedWorkspaceStore::Validate(workspace));
  workspace = ExampleNamedWorkspace();
  workspace.tabs[1].pinned = true;
  EXPECT_FALSE(NamedWorkspaceStore::Validate(workspace));
  workspace = ExampleNamedWorkspace();
  workspace.splits[0].tabs = {0, 2};
  EXPECT_FALSE(NamedWorkspaceStore::Validate(workspace));
  workspace = ExampleNamedWorkspace();
  workspace.splits[0].tabs = {0, 1};
  workspace.splits.push_back(workspace.splits[0]);
  EXPECT_FALSE(NamedWorkspaceStore::Validate(workspace));
  workspace = ExampleNamedWorkspace();
  workspace.splits[0].tabs = {-1, 0};
  EXPECT_FALSE(NamedWorkspaceStore::Validate(workspace));
  workspace = ExampleNamedWorkspace();
  workspace.name = "not\na name";
  EXPECT_FALSE(NamedWorkspaceStore::Validate(workspace));
  auto encoded = NamedWorkspaceStore::Encode(ExampleNamedWorkspace());
  encoded.FindList("splits")->front().GetDict().Set("rows", 0.0);
  EXPECT_FALSE(NamedWorkspaceStore::Decode(encoded));
  encoded = NamedWorkspaceStore::Encode(ExampleNamedWorkspace());
  encoded.FindList("groups")->front().GetDict().Set("color", 999);
  EXPECT_FALSE(NamedWorkspaceStore::Decode(encoded));
  encoded = NamedWorkspaceStore::Encode(ExampleNamedWorkspace());
  encoded.Set("remote_script", "https://example.test/run");
  EXPECT_FALSE(NamedWorkspaceStore::Decode(encoded));
}

TEST_F(MissionServiceTest,
       TahaiNamedWorkspaceOperationsReadLatestProfileState) {
  NamedWorkspaceStore first(&profile_);
  NamedWorkspaceStore second(&profile_);
  auto id = first.Add(ExampleNamedWorkspace());
  ASSERT_TRUE(id);
  ASSERT_TRUE(second.Find(*id));
  ASSERT_TRUE(second.Rename(*id, "Renamed review"));
  EXPECT_EQ("Renamed review", first.Find(*id)->name);
  auto updated = ExampleNamedWorkspace();
  updated.name = "Ignored name";
  updated.tabs.resize(2);
  updated.splits.clear();
  ASSERT_TRUE(second.Replace(*id, std::move(updated)));
  const auto replaced = first.Find(*id);
  ASSERT_TRUE(replaced);
  EXPECT_EQ("Renamed review", replaced->name);
  EXPECT_EQ(2u, replaced->tabs.size());
  auto second_id = second.Add(ExampleNamedWorkspace());
  ASSERT_TRUE(second_id);
  EXPECT_NE(*id, *second_id);
  ASSERT_TRUE(first.Remove(*id));
  EXPECT_FALSE(second.Find(*id));
  ASSERT_TRUE(second.Find(*second_id));
  EXPECT_EQ(1u, first.Read()->size());
  TestingProfile other_profile;
  EXPECT_FALSE(NamedWorkspaceStore(&other_profile).Find(*second_id));
}

TEST_F(MissionServiceTest, TahaiNamedWorkspaceLimitsAndCorruptionPreserveData) {
  NamedWorkspaceStore store(&profile_);
  for (size_t i = 0; i < NamedWorkspaceStore::kMaxWorkspaces; ++i) {
    ASSERT_TRUE(store.Add(ExampleNamedWorkspace()));
  }
  const auto original =
      profile_.GetPrefs()->GetDict(prefs::kTahaiNamedWorkspaces).Clone();
  EXPECT_FALSE(store.Add(ExampleNamedWorkspace()));
  EXPECT_EQ(original,
            profile_.GetPrefs()->GetDict(prefs::kTahaiNamedWorkspaces));
  auto future = original.Clone();
  future.Set("version", 2);
  profile_.GetPrefs()->SetDict(prefs::kTahaiNamedWorkspaces, future.Clone());
  EXPECT_FALSE(store.Read());
  EXPECT_FALSE(store.Add(ExampleNamedWorkspace()));
  EXPECT_EQ(future, profile_.GetPrefs()->GetDict(prefs::kTahaiNamedWorkspaces));
  auto invalid = ExampleNamedWorkspace();
  invalid.tabs.resize(NamedWorkspaceStore::kMaxTabs + 1, invalid.tabs[0]);
  EXPECT_FALSE(NamedWorkspaceStore::Validate(invalid));
}

TEST_F(MissionServiceTest,
       TahaiNamedWorkspacePrivateAndManagedPolicyBoundaries) {
  NamedWorkspaceStore store(&profile_);
  auto id = store.Add(ExampleNamedWorkspace());
  ASSERT_TRUE(id);
  Profile* incognito = profile_.GetPrimaryOTRProfile(true);
  NamedWorkspaceStore private_store(incognito);
  EXPECT_FALSE(private_store.enabled());
  EXPECT_FALSE(private_store.Read());
  EXPECT_FALSE(private_store.Add(ExampleNamedWorkspace()));
  EXPECT_FALSE(private_store.Remove(*id));
  const auto original =
      profile_.GetPrefs()->GetDict(prefs::kTahaiNamedWorkspaces).Clone();
  profile_.GetTestingPrefService()->SetManagedPref(
      prefs::kTahaiNamedWorkspacesEnabled, base::Value(false));
  EXPECT_FALSE(store.enabled());
  EXPECT_FALSE(store.Read());
  EXPECT_FALSE(store.Add(ExampleNamedWorkspace()));
  EXPECT_FALSE(store.Rename(*id, "Blocked"));
  EXPECT_FALSE(store.Remove(*id));
  EXPECT_EQ(original,
            profile_.GetPrefs()->GetDict(prefs::kTahaiNamedWorkspaces));
  profile_.GetTestingPrefService()->RemoveManagedPref(
      prefs::kTahaiNamedWorkspacesEnabled);
  EXPECT_TRUE(store.Find(*id));
}

TEST_F(MissionServiceTest, TahaiGridRatiosAreFiniteAndBounded) {
  split_tabs::SplitTabVisualData data;
  EXPECT_DOUBLE_EQ(0.5, data.tahai_row_ratio());
  EXPECT_DOUBLE_EQ(0.5, data.tahai_column_ratio());
  data.set_tahai_grid_ratios(-1.0, 2.0);
  EXPECT_DOUBLE_EQ(0.1, data.tahai_row_ratio());
  EXPECT_DOUBLE_EQ(0.9, data.tahai_column_ratio());
  data.set_tahai_grid_ratios(std::numeric_limits<double>::quiet_NaN(),
                             std::numeric_limits<double>::infinity());
  EXPECT_DOUBLE_EQ(0.5, data.tahai_row_ratio());
  EXPECT_DOUBLE_EQ(0.5, data.tahai_column_ratio());
  data.set_tahai_grid_ratios(0.35, 0.65);
  EXPECT_DOUBLE_EQ(0.5, data.split_ratio());
  EXPECT_NE(split_tabs::SplitTabVisualData(), data);
}

TEST_F(MissionServiceTest, TahaiGridSessionTrailerRoundTripsAndReadsLegacy) {
  split_tabs::SplitTabVisualData expected(split_tabs::SplitTabLayout::kStacked,
                                          0.3);
  expected.set_tahai_grid_ratios(0.4, 0.7);
  base::Pickle pickle;
  sessions::WriteTahaiSplitGridExtension(&pickle, expected);
  base::PickleIterator iterator(pickle);
  auto actual =
      split_tabs::SplitTabVisualData(split_tabs::SplitTabLayout::kStacked, 0.3);
  ASSERT_TRUE(sessions::ReadTahaiSplitGridExtension(&iterator, &actual));
  EXPECT_EQ(expected, actual);
  base::Pickle legacy;
  base::PickleIterator legacy_iterator(legacy);
  ASSERT_TRUE(sessions::ReadTahaiSplitGridExtension(&legacy_iterator, &actual));
  EXPECT_EQ(
      split_tabs::SplitTabVisualData(split_tabs::SplitTabLayout::kStacked, 0.3),
      actual);
}

TEST_F(MissionServiceTest, TahaiGridSessionTrailerRejectsCorruptionAtomically) {
  split_tabs::SplitTabVisualData expected;
  expected.set_tahai_grid_ratios(0.4, 0.6);
  for (int scenario = 0; scenario < 7; ++scenario) {
    SCOPED_TRACE(scenario);
    base::Pickle pickle;
    pickle.WriteUInt32(scenario == 0 ? 0x54414732 : 0x54414731);
    if (scenario != 1) {
      pickle.WriteDouble(scenario == 2 ? -0.1 : 0.4);
      if (scenario != 3) {
        pickle.WriteDouble(
            scenario == 4   ? std::numeric_limits<double>::quiet_NaN()
            : scenario == 5 ? std::numeric_limits<double>::infinity()
                            : 0.6);
      }
    }
    if (scenario == 6) {
      pickle.WriteInt(1);  // Unrecognized trailing data, not another command.
    }
    base::PickleIterator iterator(pickle);
    auto actual = expected;
    EXPECT_FALSE(sessions::ReadTahaiSplitGridExtension(&iterator, &actual));
    EXPECT_EQ(expected, actual);
  }
}

base::DictValue MakeTahaiSkinTokenSet(std::string_view background,
                                      std::string_view foreground) {
  base::DictValue tokens;
  tokens.Set("shell_background", std::string(background));
  tokens.Set("toolbar_background", std::string(background));
  tokens.Set("toolbar_foreground", std::string(foreground));
  tokens.Set("tab_background", std::string(background));
  tokens.Set("tab_foreground", std::string(foreground));
  tokens.Set("rail_background", std::string(background));
  tokens.Set("rail_foreground", std::string(foreground));
  tokens.Set("accent", "#38bdf8");
  tokens.Set("panel_background", std::string(background));
  tokens.Set("panel_foreground", std::string(foreground));
  return tokens;
}

base::DictValue MakeValidTahaiSkinManifest() {
  base::DictValue manifest;
  manifest.Set("schema_version", 1);
  manifest.Set("id", "midnight-operations");
  manifest.Set("name", "Midnight Operations");
  manifest.Set("creator", "TAHAI Web Services");
  manifest.Set("license", "Apache-2.0");
  base::DictValue compatibility;
  compatibility.Set("min_chromium_major", 140);
  compatibility.Set("max_chromium_major", 200);
  manifest.Set("compatibility", std::move(compatibility));
  base::DictValue appearance;
  appearance.Set("density", "comfortable");
  appearance.Set("reduced_motion", false);
  appearance.Set("light_tokens", MakeTahaiSkinTokenSet("#ffffff", "#111827"));
  appearance.Set("dark_tokens", MakeTahaiSkinTokenSet("#111827", "#f8fafc"));
  appearance.Set("high_contrast_tokens",
                 MakeTahaiSkinTokenSet("#000000", "#ffffff"));
  manifest.Set("appearance", std::move(appearance));
  base::ListValue assets;
  base::DictValue preview;
  preview.Set("path", "assets/preview.webp");
  preview.Set("sha256", std::string(64u, 'a'));
  preview.Set("purpose", "preview");
  assets.Append(std::move(preview));
  manifest.Set("assets", std::move(assets));
  return manifest;
}

TEST_F(MissionServiceTest, CreatesAndReloadsProfileScopedMetadata) {
  {
    MissionService service(&profile_);
    const auto mission = service.CreateMission("DNS migration", "migration");
    ASSERT_TRUE(mission.has_value());
    EXPECT_TRUE(base::Uuid::ParseLowercase(mission->id).is_valid());
    EXPECT_EQ("DNS migration", mission->title);
    EXPECT_EQ("migration", mission->type);
    EXPECT_TRUE(service.persistence_enabled());
  }

  MissionService reloaded(&profile_);
  ASSERT_EQ(1u, reloaded.missions().size());
  EXPECT_EQ("DNS migration", reloaded.missions().front().title);
  EXPECT_FALSE(reloaded.missions().front().steps.empty());
  EXPECT_EQ(1u, reloaded.missions().front().timeline.size());
  EXPECT_TRUE(reloaded.missions().front().timeline_integrity_verified);
  EXPECT_EQ(64u,
            reloaded.missions().front().timeline.front().entry_hash.size());
}

TEST_F(MissionServiceTest, RejectsMalformedOrOversizedInput) {
  MissionService service(&profile_);
  EXPECT_FALSE(service.CreateMission("", "incident"));
  EXPECT_FALSE(service.CreateMission(std::string(129, 'a'), "incident"));
  EXPECT_FALSE(service.CreateMission("Unsafe\nname", "incident"));
  EXPECT_FALSE(service.CreateMission("Valid name", "arbitrary"));
  EXPECT_TRUE(service.missions().empty());
}

TEST_F(MissionServiceTest, RejectsTamperedTimestampPayloads) {
  base::ListValue stored_missions;
  base::DictValue mission;
  mission.Set("id", base::Uuid::GenerateRandomV4().AsLowercaseString());
  mission.Set("title", "Review");
  mission.Set("type", "audit");
  mission.Set("created_at", "https://private.example/should-not-render");
  stored_missions.Append(std::move(mission));
  profile_.GetPrefs()->SetList(prefs::kTahaiMissions,
                               std::move(stored_missions));

  MissionService service(&profile_);
  EXPECT_TRUE(service.missions().empty());
}

TEST_F(MissionServiceTest, ReloadsOnlyGeneratedMissionVocabulary) {
  base::DictValue mission;
  mission.Set("id", base::Uuid::GenerateRandomV4().AsLowercaseString());
  mission.Set("title", "Review");
  mission.Set("type", "audit");
  mission.Set("created_at", "1");

  base::ListValue saved_steps;
  base::DictValue injected_step;
  injected_step.Set("label", "Private page title must not be restored");
  injected_step.Set("complete", true);
  saved_steps.Append(std::move(injected_step));
  mission.Set("steps", std::move(saved_steps));

  base::ListValue saved_timeline;
  base::DictValue injected_event;
  injected_event.Set("kind", "mission");
  injected_event.Set("detail", "Private browsing data must not be restored");
  injected_event.Set("created_at", "1");
  saved_timeline.Append(std::move(injected_event));
  mission.Set("timeline", std::move(saved_timeline));

  base::ListValue stored_missions;
  stored_missions.Append(std::move(mission));
  profile_.GetPrefs()->SetList(prefs::kTahaiMissions,
                               std::move(stored_missions));

  MissionService service(&profile_);
  ASSERT_EQ(1u, service.missions().size());
  const MissionSummary& restored = service.missions().front();
  EXPECT_EQ("Confirm audit scope", restored.steps.front().label);
  EXPECT_FALSE(restored.steps.front().complete);
  ASSERT_EQ(1u, restored.timeline.size());
  EXPECT_EQ("Mission loaded", restored.timeline.front().detail);
}

TEST_F(MissionServiceTest, SupportsNativeElectronParityMissionFamilies) {
  MissionService service(&profile_);
  EXPECT_TRUE(service.CreateMission("Admin workflow", "admin"));
  EXPECT_TRUE(service.CreateMission("Support workflow", "support"));
  EXPECT_TRUE(service.CreateMission("Development workflow", "development"));
  ASSERT_EQ(3u, service.missions().size());
  EXPECT_EQ("Confirm authorized administrative scope",
            service.missions()[0].steps.front().label);
  EXPECT_EQ("Confirm customer scope and authorization",
            service.missions()[1].steps.front().label);
  EXPECT_EQ("Confirm reproducible scope",
            service.missions()[2].steps.front().label);
}

TEST_F(MissionServiceTest,
       LocalOiFindingLifecycleRequiresRationaleAndPersistsLocally) {
  TahaiLocalOiService local_oi(&profile_);
  const std::string now = LocalOiNowTimestamp();
  LocalOiFindingRecord finding;
  finding.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  finding.rule_id = "local_oi.test.lifecycle.v1";
  finding.category = "test";
  finding.severity = LocalOiFindingSeverity::kMedium;
  finding.title = "Local test finding";
  finding.explanation = "A bounded test finding for lifecycle coverage.";
  finding.remediation = "Record a bounded local rationale.";
  finding.created_at = now;
  finding.updated_at = now;
  finding.source_basis = "local_oi.test.lifecycle.v1:fixture";
  ASSERT_TRUE(local_oi.UpsertFinding(finding));

  EXPECT_FALSE(local_oi.AcknowledgeFinding(finding.id, ""));
  ASSERT_TRUE(local_oi.AcknowledgeFinding(finding.id, "Operator accepted it."));
  ASSERT_EQ(1u, local_oi.data().findings.size());
  EXPECT_EQ(LocalOiFindingState::kAcknowledged,
            local_oi.data().findings.front().state);
  EXPECT_TRUE(local_oi.data().findings.front().acknowledged);

  ASSERT_TRUE(
      local_oi.ResolveFinding(finding.id, "Local condition corrected."));
  EXPECT_EQ(LocalOiFindingState::kResolved,
            local_oi.data().findings.front().state);
  EXPECT_FALSE(local_oi.data().findings.front().acknowledged);
  EXPECT_EQ("Local condition corrected.",
            local_oi.data().findings.front().resolution_reason);
}

TEST_F(MissionServiceTest, LocalOiSearchReadsOnlyPersistedTypedRecords) {
  TahaiLocalOiService local_oi(&profile_);
  const std::string now = LocalOiNowTimestamp();
  LocalOiEntityRecord entity;
  entity.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  entity.type = LocalOiEntityType::kEndpoint;
  entity.title = "Approved endpoint";
  entity.summary = "Typed local diagnostic metadata.";
  entity.source = LocalOiRecordSource::kExplicitUserEntry;
  entity.created_at = now;
  entity.updated_at = now;
  entity.fields = {{"certificate_issuer", "Example Issuer Authority"}};
  ASSERT_TRUE(local_oi.UpsertEntity(entity));

  const std::vector<LocalOiSearchResult> results = local_oi.Search("endpoint");
  ASSERT_EQ(1u, results.size());
  EXPECT_EQ("endpoint", results.front().kind);
  EXPECT_EQ("Approved endpoint", results.front().title);
  EXPECT_EQ(1u, local_oi.Search("issuer authority").size());
  EXPECT_TRUE(local_oi.Search("\nunsafe").empty());
}

TEST_F(MissionServiceTest,
       LocalOiSearchUsesBoundedNativeFiltersAndDeterministicRanking) {
  TahaiLocalOiService local_oi(&profile_);
  const std::string now = LocalOiNowTimestamp();
  const std::string mission_id =
      base::Uuid::GenerateRandomV4().AsLowercaseString();

  LocalOiEntityRecord endpoint;
  endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.mission_id = mission_id;
  endpoint.title = "Certificate endpoint";
  endpoint.summary = "Bounded endpoint metadata.";
  endpoint.source = LocalOiRecordSource::kExplicitUserEntry;
  endpoint.created_at = now;
  endpoint.updated_at = now;
  ASSERT_TRUE(local_oi.UpsertEntity(endpoint));

  LocalOiFindingRecord finding;
  finding.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  finding.rule_id = "local_oi.test.search_filter.v1";
  finding.category = "endpoint_intelligence";
  finding.severity = LocalOiFindingSeverity::kHigh;
  finding.title = "Certificate requires attention";
  finding.explanation = "Synthetic typed Local OI finding for search coverage.";
  finding.remediation = "Review the explicit local diagnostic result.";
  finding.created_at = now;
  finding.updated_at = now;
  finding.state = LocalOiFindingState::kAcknowledged;
  finding.acknowledged = true;
  finding.acknowledgement_note = "Reviewed locally.";
  finding.source_basis = "local_oi.test.search_filter.v1:fixture";
  ASSERT_TRUE(local_oi.UpsertFinding(finding));

  LocalOiSearchOptions endpoint_options;
  endpoint_options.query = "certificate";
  endpoint_options.kind = "endpoint";
  endpoint_options.mission_id = mission_id;
  endpoint_options.maximum_age_days = 1;
  const std::vector<LocalOiSearchResult> endpoints =
      local_oi.Search(endpoint_options);
  ASSERT_EQ(1u, endpoints.size());
  EXPECT_EQ("endpoint", endpoints.front().kind);
  EXPECT_EQ(mission_id, endpoints.front().mission_id);

  LocalOiSearchOptions finding_options;
  finding_options.query = "certificate";
  finding_options.kind = "finding";
  finding_options.severity = "blocked";
  finding_options.finding_state = "acknowledged";
  const std::vector<LocalOiSearchResult> findings =
      local_oi.Search(finding_options);
  ASSERT_EQ(1u, findings.size());
  EXPECT_EQ("blocked", findings.front().severity);
  EXPECT_EQ("acknowledged", findings.front().finding_state);

  finding_options.kind = "https://not-a-search-kind.example";
  EXPECT_TRUE(local_oi.Search(finding_options).empty());
}

TEST_F(MissionServiceTest,
       LocalOiRelationshipExplorerIsBoundedTypedAndDeterministic) {
  const std::string mission_id =
      base::Uuid::GenerateRandomV4().AsLowercaseString();
  const std::string endpoint_id =
      base::Uuid::GenerateRandomV4().AsLowercaseString();
  const std::string result_id =
      base::Uuid::GenerateRandomV4().AsLowercaseString();
  LocalOiSnapshot snapshot;
  snapshot.entities = {
      {mission_id, mission_id, "mission", "Release review", "", "1", ""},
      {endpoint_id, mission_id, "endpoint", "Approved endpoint", "", "1", ""},
      {result_id, mission_id, "tool_result", "DNS/TLS result", "", "1", ""},
  };
  snapshot.relationships = {
      {mission_id, endpoint_id, "mission_uses", "Release review",
       "Approved endpoint", "Explicit endpoint selected for this Mission."},
      {endpoint_id, result_id, "derived_from", "Approved endpoint",
       "DNS/TLS result", "Explicit local tool result recorded."},
      {mission_id, result_id, "mission_produced", "Release review",
       "DNS/TLS result", "Mission produced this typed result."},
  };

  LocalOiRelationshipExplorerOptions options;
  options.entity_id = mission_id;
  options.maximum_depth = 1;
  const std::vector<LocalOiRelationshipExplorerItem> one_hop =
      ExploreLocalOiRelationships(snapshot, options);
  ASSERT_EQ(2u, one_hop.size());
  EXPECT_EQ(1, one_hop.front().depth);
  EXPECT_EQ("mission_produced", one_hop.front().relationship);
  EXPECT_FALSE(one_hop.front().basis.empty());

  options.maximum_depth = 2;
  const std::vector<LocalOiRelationshipExplorerItem> two_hops =
      ExploreLocalOiRelationships(snapshot, options);
  ASSERT_EQ(3u, two_hops.size());
  EXPECT_EQ("derived_from", two_hops.back().relationship);
  EXPECT_EQ(2, two_hops.back().depth);

  options.relationship = "mission_uses";
  options.maximum_depth = 1;
  const std::vector<LocalOiRelationshipExplorerItem> typed =
      ExploreLocalOiRelationships(snapshot, options);
  ASSERT_EQ(1u, typed.size());
  EXPECT_EQ("mission_uses", typed.front().relationship);

  const std::optional<LocalOiEntityDetail> detail =
      GetLocalOiEntityDetail(snapshot, endpoint_id);
  ASSERT_TRUE(detail);
  EXPECT_EQ("endpoint", detail->kind);
  EXPECT_EQ("Approved endpoint", detail->label);
  EXPECT_EQ(2u, detail->direct_relationship_count);
  EXPECT_FALSE(GetLocalOiEntityDetail(
                   snapshot, base::Uuid::GenerateRandomV4().AsLowercaseString())
                   .has_value());

  options.relationship = "unbounded_query";
  EXPECT_TRUE(ExploreLocalOiRelationships(snapshot, options).empty());
}

TEST_F(MissionServiceTest, LocalOiPolicyChangesOnlyUnmanagedProfileControls) {
  TahaiLocalOiPolicy policy(profile_.GetPrefs());
  EXPECT_TRUE(policy.IsEnabled(LocalOiPolicyControl::kEnabled));
  EXPECT_FALSE(policy.IsEnabled(LocalOiPolicyControl::kHistoryMetadata));
  EXPECT_TRUE(policy.SetEnabled(LocalOiPolicyControl::kHistoryMetadata, true));
  EXPECT_TRUE(policy.IsEnabled(LocalOiPolicyControl::kHistoryMetadata));
  EXPECT_TRUE(policy.SetEnabled(LocalOiPolicyControl::kEnabled, false));
  EXPECT_FALSE(policy.IsEnabled(LocalOiPolicyControl::kEnabled));
  EXPECT_EQ("profile setting", policy.Source(LocalOiPolicyControl::kEnabled));
}

TEST_F(MissionServiceTest, LocalOiManagedPolicyOverridesProfileSetting) {
  TahaiLocalOiPolicy policy(profile_.GetPrefs());
  ASSERT_TRUE(policy.SetEnabled(LocalOiPolicyControl::kEnabled, true));
  profile_.GetTestingPrefService()->SetManagedPref(prefs::kTahaiLocalOiEnabled,
                                                   base::Value(false));
  EXPECT_TRUE(policy.IsManaged(LocalOiPolicyControl::kEnabled));
  EXPECT_FALSE(policy.IsEnabled(LocalOiPolicyControl::kEnabled));
  EXPECT_FALSE(policy.SetEnabled(LocalOiPolicyControl::kEnabled, true));
  profile_.GetTestingPrefService()->RemoveManagedPref(
      prefs::kTahaiLocalOiEnabled);
  EXPECT_FALSE(policy.IsManaged(LocalOiPolicyControl::kEnabled));
  EXPECT_TRUE(policy.IsEnabled(LocalOiPolicyControl::kEnabled));
}

TEST_F(MissionServiceTest, LocalOiDisabledBlocksDirectWritesAndFindingActions) {
  TahaiLocalOiService local_oi(&profile_);
  const std::string now = LocalOiNowTimestamp();
  LocalOiEntityRecord entity;
  entity.id = NewLocalOiId();
  entity.type = LocalOiEntityType::kNote;
  entity.title = "Synthetic policy fixture";
  entity.summary = "Local test metadata.";
  entity.source = LocalOiRecordSource::kExplicitUserEntry;
  entity.created_at = now;
  entity.updated_at = now;
  ASSERT_TRUE(local_oi.UpsertEntity(entity));
  LocalOiEntityRecord second = entity;
  second.id = NewLocalOiId();
  ASSERT_TRUE(local_oi.UpsertEntity(second));

  LocalOiRelationshipRecord relationship;
  relationship.id = NewLocalOiId();
  relationship.source_id = entity.id;
  relationship.target_id = second.id;
  relationship.basis = "Synthetic relationship.";
  relationship.created_at = now;
  relationship.updated_at = now;
  ASSERT_TRUE(local_oi.UpsertRelationship(relationship));

  LocalOiFindingRecord finding;
  finding.id = NewLocalOiId();
  finding.rule_id = "policy_fixture";
  finding.category = "policy_fixture";
  finding.title = "Synthetic finding";
  finding.explanation = "Local policy regression fixture.";
  finding.remediation = "No real remediation required.";
  finding.source_basis = "Synthetic fixture only.";
  finding.affected_entity_ids = {entity.id};
  finding.created_at = now;
  finding.updated_at = now;
  ASSERT_TRUE(local_oi.UpsertFinding(finding));
  LocalOiMemoryRecord memory;
  memory.id = NewLocalOiId();
  memory.entity_id = entity.id;
  memory.detail = "Synthetic event.";
  memory.created_at = now;
  ASSERT_TRUE(local_oi.AppendMemory(memory));
  LocalOiReportRecord report;
  report.id = NewLocalOiId();
  report.title = "Synthetic report";
  report.content = "Local aggregate test metadata.";
  report.provenance = "Synthetic fixture only.";
  report.created_at = now;
  ASSERT_TRUE(local_oi.AddReport(report));

  const base::DictValue before =
      profile_.GetPrefs()->GetDict(prefs::kTahaiLocalOiStore).Clone();
  profile_.GetTestingPrefService()->SetManagedPref(prefs::kTahaiLocalOiEnabled,
                                                   base::Value(false));
  entity.title = "Blocked entity update";
  relationship.basis = "Blocked relationship update.";
  finding.title = "Blocked finding update";
  memory.id = NewLocalOiId();
  report.id = NewLocalOiId();
  EXPECT_FALSE(local_oi.UpsertEntity(entity));
  EXPECT_FALSE(local_oi.UpsertRelationship(relationship));
  EXPECT_FALSE(local_oi.UpsertFinding(finding));
  EXPECT_FALSE(local_oi.AppendMemory(memory));
  EXPECT_FALSE(local_oi.AddReport(report));
  EXPECT_FALSE(local_oi.RecalculateFindings());
  EXPECT_FALSE(local_oi.AcknowledgeFinding(finding.id, "Blocked action."));
  EXPECT_FALSE(local_oi.ResolveFinding(finding.id, "Blocked action."));
  EXPECT_FALSE(local_oi.SuppressFinding(finding.id, "Blocked action."));
  EXPECT_FALSE(local_oi.ReopenFinding(finding.id, "Blocked action."));
  EXPECT_TRUE(local_oi.Search("Synthetic").empty());
  EXPECT_FALSE(local_oi.GenerateSafeReport(LocalOiSafeReportKind::kOverview));
  EXPECT_EQ(before, profile_.GetPrefs()->GetDict(prefs::kTahaiLocalOiStore));

  // Revocation must not prevent the user from removing retained local data.
  EXPECT_TRUE(local_oi.DeleteEntity(entity.id));
  EXPECT_TRUE(local_oi.DeleteAllData());
  EXPECT_TRUE(local_oi.data().entities.empty());
  EXPECT_TRUE(local_oi.data().findings.empty());
  EXPECT_TRUE(local_oi.data().reports.empty());
}

TEST_F(MissionServiceTest, LocalOiReportPolicyAlsoBlocksDirectLedgerWrites) {
  TahaiLocalOiService local_oi(&profile_);
  LocalOiReportRecord report;
  report.id = NewLocalOiId();
  report.title = "Synthetic report";
  report.content = "Aggregate metadata.";
  report.provenance = "Synthetic fixture only.";
  report.created_at = LocalOiNowTimestamp();
  profile_.GetTestingPrefService()->SetManagedPref(
      prefs::kTahaiLocalOiReportsEnabled, base::Value(false));
  EXPECT_FALSE(local_oi.AddReport(report));
  EXPECT_TRUE(local_oi.data().reports.empty());
  profile_.GetTestingPrefService()->RemoveManagedPref(
      prefs::kTahaiLocalOiReportsEnabled);
  EXPECT_TRUE(local_oi.AddReport(report));
}

TEST_F(MissionServiceTest, LocalOiRetentionPrunesExpiredSupplementalRecords) {
  TahaiLocalOiService local_oi(&profile_);
  LocalOiEntityRecord entity;
  entity.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  entity.type = LocalOiEntityType::kArtifact;
  entity.title = "Expired local artifact";
  entity.summary = "Bounded metadata used only for retention coverage.";
  entity.source = LocalOiRecordSource::kExplicitUserEntry;
  entity.created_at = "1";
  entity.updated_at = "1";
  entity.fields = {{"hash_present", "true"}, {"source_origin_present", "true"}};
  EXPECT_TRUE(local_oi.UpsertEntity(std::move(entity)));
  EXPECT_TRUE(local_oi.data().entities.empty());
}

TEST_F(MissionServiceTest,
       LocalOiRetentionPreservesGeneratedMissionEvidenceAndTimelineRecords) {
  TahaiLocalOiService local_oi(&profile_);
  const auto make_expired_record = [](LocalOiEntityType type,
                                      LocalOiRecordSource source,
                                      std::string_view title) {
    LocalOiEntityRecord record;
    record.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
    record.type = type;
    record.title = std::string(title);
    record.summary = "Bounded retention test metadata.";
    record.source = source;
    record.created_at = "1";
    record.updated_at = "1";
    return record;
  };
  const LocalOiEntityRecord evidence = make_expired_record(
      LocalOiEntityType::kEvidence, LocalOiRecordSource::kMissionEvidence,
      "Generated Mission evidence");
  const LocalOiEntityRecord timeline = make_expired_record(
      LocalOiEntityType::kNote, LocalOiRecordSource::kMissionTimeline,
      "Generated Mission timeline");
  const LocalOiEntityRecord artifact = make_expired_record(
      LocalOiEntityType::kArtifact, LocalOiRecordSource::kExplicitUserEntry,
      "Expired supplemental artifact");

  EXPECT_TRUE(local_oi.UpsertEntity(evidence));
  EXPECT_TRUE(local_oi.UpsertEntity(timeline));
  EXPECT_TRUE(local_oi.UpsertEntity(artifact));
  EXPECT_TRUE(std::any_of(local_oi.data().entities.begin(),
                          local_oi.data().entities.end(),
                          [&evidence](const LocalOiEntityRecord& record) {
                            return record.id == evidence.id;
                          }));
  EXPECT_TRUE(std::any_of(local_oi.data().entities.begin(),
                          local_oi.data().entities.end(),
                          [&timeline](const LocalOiEntityRecord& record) {
                            return record.id == timeline.id;
                          }));
  EXPECT_FALSE(std::any_of(local_oi.data().entities.begin(),
                           local_oi.data().entities.end(),
                           [&artifact](const LocalOiEntityRecord& record) {
                             return record.id == artifact.id;
                           }));
}

TEST_F(MissionServiceTest, LocalOiReportLedgerCountsOnlyPersistedSafeReports) {
  TahaiLocalOiService local_oi(&profile_);
  LocalOiReportRecord report;
  report.id = NewLocalOiId();
  report.kind = LocalOiReportKind::kMissionHealthSummary;
  report.title = "Local Mission Health Summary";
  report.content = "Aggregate local readiness only.";
  report.provenance = "Generated by the deterministic Local OI model.";
  report.created_at = LocalOiNowTimestamp();
  ASSERT_TRUE(local_oi.AddReport(report));

  const LocalOiSnapshot snapshot = BuildLocalOiSnapshot(local_oi.data());
  EXPECT_EQ(1u, snapshot.report_count);
  EXPECT_TRUE(base::Contains(BuildLocalOiSafeReport(snapshot),
                             "Generated local reports: 1"));
}

TEST_F(MissionServiceTest, LocalOiClipboardExportGetsSeparateMemoryEvent) {
  TahaiLocalOiService local_oi(&profile_);
  profile_.GetPrefs()->SetBoolean(prefs::kTahaiLocalOiEnabled, true);
  profile_.GetPrefs()->SetBoolean(prefs::kTahaiLocalOiReportsEnabled, true);
  profile_.GetPrefs()->SetBoolean(prefs::kTahaiLocalOiExportEnabled, true);

  ASSERT_TRUE(local_oi.GenerateSafeReport(LocalOiSafeReportKind::kOverview,
                                          LocalOiSafeReportFormat::kJson));
  EXPECT_FALSE(std::any_of(
      local_oi.data().memory.begin(), local_oi.data().memory.end(),
      [](const LocalOiMemoryRecord& record) {
        return record.action == LocalOiMemoryAction::kSafeExportCompleted;
      }));

  ASSERT_TRUE(
      local_oi.RecordSafeReportCopied(LocalOiSafeReportKind::kOverview));
  EXPECT_TRUE(std::any_of(
      local_oi.data().memory.begin(), local_oi.data().memory.end(),
      [](const LocalOiMemoryRecord& record) {
        return record.action == LocalOiMemoryAction::kSafeExportCompleted &&
               record.detail ==
                   "A safe aggregate Local OI report was explicitly copied to "
                   "the clipboard.";
      }));
}

TEST_F(MissionServiceTest, LocalOiSafeReportsKeepDistinctAggregateFocuses) {
  LocalOiSnapshot snapshot;
  snapshot.operator_action_count = 3;
  snapshot.blocked_finding_count = 2;
  snapshot.change_capture_count = 4;
  snapshot.diagnostic_result_count = 5;
  snapshot.manual_watch_count = 6;
  snapshot.knowledge_gap_count = 7;
  snapshot.evidence_marker_count = 8;
  snapshot.artifact_count = 9;
  snapshot.document_reference_count = 10;

  const std::string overview =
      BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kOverview);
  const std::string handoff = BuildLocalOiSafeReport(
      snapshot, LocalOiSafeReportKind::kSanitizedHandoff);
  const std::string change =
      BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kChangeRecord);
  const std::string incident =
      BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kIncidentPacket);
  const std::string evidence = BuildLocalOiSafeReport(
      snapshot, LocalOiSafeReportKind::kEvidenceManifest);
  const std::string artifact = BuildLocalOiSafeReport(
      snapshot, LocalOiSafeReportKind::kArtifactIntegrity);
  const std::string diagnostic =
      BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kDiagnostic);

  EXPECT_TRUE(base::Contains(overview, "aggregate local operational posture"));
  EXPECT_TRUE(base::Contains(handoff, "3 deterministic action(s)"));
  EXPECT_TRUE(base::Contains(change, "4 safe-digest capture(s)"));
  EXPECT_TRUE(base::Contains(incident, "7 gap(s)"));
  EXPECT_TRUE(base::Contains(evidence, "9 artifact integrity record(s)"));
  EXPECT_TRUE(base::Contains(artifact, "9 explicit artifact record(s)"));
  EXPECT_TRUE(base::Contains(diagnostic, "5 explicit tool result(s)"));
  EXPECT_FALSE(base::Contains(change, "https://"));
  EXPECT_FALSE(base::Contains(evidence, "sha256"));
  EXPECT_FALSE(base::Contains(artifact, "sha256"));
}

TEST_F(MissionServiceTest, NetworkInspectionAcceptsOnlyHostScopedTargets) {
  EXPECT_TRUE(IsValidTahaiNetworkInspectionHost("example.com"));
  EXPECT_TRUE(IsValidTahaiNetworkInspectionHost("8.8.8.8"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("https://example.com"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("example.com:8443"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("example.com/path"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("user@example.com"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("example..com"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost(".example.com"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("example.-com"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("example-.com"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("localhost"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("intranet"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("support.local"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("console.internal"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("192.168.1.10"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("127.0.0.1"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("192.0.2.1"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost("0177.0.0.1"));
  EXPECT_TRUE(IsValidTahaiNetworkInspectionHost(std::string(63u, 'a') +
                                                ".example.com"));
  EXPECT_FALSE(IsValidTahaiNetworkInspectionHost(std::string(64u, 'a') +
                                                 ".example.com"));
}

TEST_F(MissionServiceTest,
       NetworkInspectionSafeSummaryUsesOnlyTypedSanitizedMetadata) {
  TahaiNetworkInspectionResult result;
  result.host = "status.example.com";
  result.resolved_addresses = {"8.8.8.8"};
  result.dns_aliases = {"private-alias.example.com"};
  result.resolved_ipv4_count = 1;
  result.resolved_ipv6_count = 0;
  result.dns_alias_count = 1;
  result.dns_net_error = 0;
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.certificate_subject = "private subject";
  result.certificate_issuer = "private issuer";
  result.subject_alt_names = {"private-san.example.com"};
  result.tls_version = "TLS 1.3";
  result.cipher_suite = "TLS_AES_128_GCM_SHA256";
  result.certificate_days_remaining = 90;
  result.security_header_observation_available = true;
  result.strict_transport_security_observed = true;
  result.content_security_policy_observed = true;
  result.x_content_type_options_observed = true;
  result.observed_security_header_count = 3;

  const std::string summary =
      BuildTahaiNetworkInspectionSafeSummary(result, /*recorded_locally=*/true);

  EXPECT_TRUE(base::Contains(summary, "Target: status.example.com"));
  EXPECT_TRUE(base::Contains(
      summary, "Outcome: Chromium certificate validation completed"));
  EXPECT_TRUE(base::Contains(summary, "HTTPS status: 200"));
  EXPECT_TRUE(base::Contains(summary,
                             "DNS topology counts: IPv4 1; IPv6 0; aliases 1"));
  EXPECT_TRUE(base::Contains(
      summary, "Selected HTTP security headers observed: 3 of 6"));
  EXPECT_TRUE(
      base::Contains(summary, "Certificate status class: none recorded"));
  EXPECT_TRUE(base::Contains(summary, "Certificate: valid"));
  EXPECT_TRUE(base::Contains(summary, "Local OI record: recorded"));
  EXPECT_TRUE(base::Contains(summary, "Excluded: addresses, aliases"));
  for (const std::string_view excluded :
       {"8.8.8.8", "private-alias.example.com", "private subject",
        "private issuer", "private-san.example.com", "TLS 1.3",
        "TLS_AES_128_GCM_SHA256"}) {
    EXPECT_FALSE(base::Contains(summary, excluded));
  }
}

TEST_F(MissionServiceTest,
       NetworkInspectionSafeSummaryDoesNotExposeRejectedTarget) {
  TahaiNetworkInspectionResult result;
  result.host = "127.0.0.1";
  result.target_rejected = true;

  const std::string summary = BuildTahaiNetworkInspectionSafeSummary(
      result, /*recorded_locally=*/false);

  EXPECT_TRUE(
      base::Contains(summary, "Outcome: target rejected before DNS or HTTPS"));
  EXPECT_TRUE(base::Contains(summary, "Target: Unavailable"));
  EXPECT_FALSE(base::Contains(summary, "127.0.0.1"));
  EXPECT_TRUE(base::Contains(summary, "Local OI record: not recorded"));
}

TEST_F(MissionServiceTest,
       NetworkInspectionSafeSummaryUsesFixedCertificateFailureClass) {
  TahaiNetworkInspectionResult result;
  result.host = "status.example.com";
  result.request_net_error = 0;
  result.tls_info_available = true;
  result.certificate_revoked = true;
  result.certificate_subject = "private certificate subject";
  result.certificate_issuer = "private certificate issuer";

  const std::string summary =
      BuildTahaiNetworkInspectionSafeSummary(result, /*recorded_locally=*/true);

  EXPECT_TRUE(base::Contains(summary, "Outcome: certificate revoked"));
  EXPECT_TRUE(base::Contains(summary, "Certificate status class: revoked"));
  EXPECT_FALSE(base::Contains(summary, "private certificate subject"));
  EXPECT_FALSE(base::Contains(summary, "private certificate issuer"));
}

TEST_F(MissionServiceTest,
       NetworkInspectorRequiresConnectionTimePublicAddressCheck) {
  const int32_t options = GetTahaiNetworkInspectionURLLoadOptions();
  EXPECT_NE(0, options & network::mojom::kURLLoadOptionBlockLocalRequest);
  EXPECT_NE(0, options & network::mojom::kURLLoadOptionSendSSLInfoWithResponse);
  EXPECT_NE(
      0,
      options & network::mojom::kURLLoadOptionSendSSLInfoForCertificateError);
}

TEST_F(MissionServiceTest,
       NetworkInspectionGuidanceReportsConnectionTimeBlock) {
  TahaiNetworkInspectionResult result;
  result.public_address_guard_blocked = true;
  result.request_net_error = net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS;
  const auto guidance = BuildTahaiNetworkInspectionGuidance(result);
  ASSERT_EQ(1u, guidance.size());
  EXPECT_TRUE(base::Contains(guidance.front(), "connection endpoint"));
  EXPECT_FALSE(base::Contains(guidance.front(), "non-public DNS result"));
}

TEST_F(MissionServiceTest, NetworkInspectionGuidanceUsesOnlyTypedOutcomeState) {
  TahaiNetworkInspectionResult rejected;
  rejected.host = "127.0.0.1";
  rejected.target_rejected = true;
  std::vector<std::string> guidance =
      BuildTahaiNetworkInspectionGuidance(rejected);
  ASSERT_EQ(1u, guidance.size());
  EXPECT_TRUE(base::Contains(guidance.front(), "public DNS host name"));
  EXPECT_FALSE(base::Contains(guidance.front(), "127.0.0.1"));

  TahaiNetworkInspectionResult guarded;
  guarded.host = "status.example.com";
  guarded.public_address_guard_blocked = true;
  guarded.resolved_addresses = {"10.0.0.20"};
  guarded.dns_aliases = {"internal.example"};
  guidance = BuildTahaiNetworkInspectionGuidance(guarded);
  ASSERT_EQ(1u, guidance.size());
  EXPECT_TRUE(base::Contains(guidance.front(), "not sent"));
  EXPECT_FALSE(base::Contains(guidance.front(), "status.example.com"));
  EXPECT_FALSE(base::Contains(guidance.front(), "10.0.0.20"));
  EXPECT_FALSE(base::Contains(guidance.front(), "internal.example"));

  TahaiNetworkInspectionResult certificate;
  certificate.host = "status.example.com";
  certificate.http_status = 503;
  certificate.tls_info_available = true;
  certificate.certificate_expired = true;
  certificate.certificate_subject = "private subject";
  certificate.certificate_issuer = "private issuer";
  guidance = BuildTahaiNetworkInspectionGuidance(certificate);
  ASSERT_EQ(2u, guidance.size());
  EXPECT_TRUE(base::Contains(guidance[0], "service health"));
  EXPECT_TRUE(base::Contains(guidance[1], "expired certificate"));
  for (const std::string& step : guidance) {
    EXPECT_FALSE(base::Contains(step, "status.example.com"));
    EXPECT_FALSE(base::Contains(step, "private subject"));
    EXPECT_FALSE(base::Contains(step, "private issuer"));
  }

  TahaiNetworkInspectionResult revoked;
  revoked.host = "status.example.com";
  revoked.tls_info_available = true;
  revoked.certificate_revoked = true;
  revoked.certificate_subject = "private subject";
  guidance = BuildTahaiNetworkInspectionGuidance(revoked);
  ASSERT_EQ(1u, guidance.size());
  EXPECT_TRUE(base::Contains(guidance.front(), "revoked certificate"));
  EXPECT_FALSE(base::Contains(guidance.front(), "status.example.com"));
  EXPECT_FALSE(base::Contains(guidance.front(), "private subject"));

  TahaiNetworkInspectionResult unauthorized;
  unauthorized.host = "status.example.com";
  unauthorized.http_status = 401;
  unauthorized.tls_info_available = true;
  unauthorized.certificate_valid = true;
  unauthorized.certificate_subject = "private subject";
  guidance = BuildTahaiNetworkInspectionGuidance(unauthorized);
  ASSERT_EQ(1u, guidance.size());
  EXPECT_TRUE(base::Contains(guidance.front(), "not authenticated"));
  EXPECT_TRUE(base::Contains(guidance.front(), "add credentials"));
  EXPECT_FALSE(base::Contains(guidance.front(), "status.example.com"));
  EXPECT_FALSE(base::Contains(guidance.front(), "private subject"));
}

TEST_F(MissionServiceTest,
       NetworkInspectionGuidanceFlagsMissingSelectedSecurityHeaderObservation) {
  TahaiNetworkInspectionResult result;
  result.host = "status.example.com";
  result.request_net_error = 0;
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.security_header_observation_available = true;
  result.observed_security_header_count = 0;

  const std::vector<std::string> guidance =
      BuildTahaiNetworkInspectionGuidance(result);
  ASSERT_EQ(1u, guidance.size());
  EXPECT_TRUE(
      base::Contains(guidance.front(), "No selected HTTP security headers"));
  EXPECT_FALSE(base::Contains(guidance.front(), "status.example.com"));
}

TEST_F(MissionServiceTest,
       LocalOiNetworkInspectionMayLinkOnlyToAnActiveLocalMission) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Certificate renewal", "change");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));

  TahaiNetworkInspectionResult result;
  result.host = "status.example.com";
  result.resolved_addresses = {"203.0.113.12"};
  result.dns_net_error = 0;
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.certificate_expired = false;
  result.certificate_days_remaining = 90;
  result.tls_version = "TLS 1.3";
  result.cipher_suite = "TLS_AES_128_GCM_SHA256";
  result.inspected_at = LocalOiNowTimestamp();

  ASSERT_TRUE(local_oi.RecordNetworkInspection(result, mission->id));
  const auto tool_result = std::find_if(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [&mission](const LocalOiEntityRecord& record) {
        return record.type == LocalOiEntityType::kToolResult &&
               record.mission_id == mission->id;
      });
  ASSERT_NE(tool_result, local_oi.data().entities.end());
  EXPECT_TRUE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&mission, &tool_result](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kMissionProduced &&
               relationship.source_id == mission->id &&
               relationship.target_id == tool_result->id;
      }));
  EXPECT_FALSE(local_oi.RecordNetworkInspection(result, "not-a-local-id"));
}

TEST_F(MissionServiceTest,
       LocalOiComparesOnlyBoundedDnsTlsMetadataAcrossExplicitRuns) {
  TahaiLocalOiService local_oi(&profile_);
  TahaiNetworkInspectionResult result;
  result.host = "status.example.com";
  result.resolved_addresses = {"203.0.113.12"};
  result.dns_net_error = 0;
  result.request_net_error = 0;
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.certificate_expired = false;
  result.certificate_days_remaining = 90;
  result.tls_version = "TLS 1.3";
  result.cipher_suite = "TLS_AES_128_GCM_SHA256";
  result.inspected_at = LocalOiNowTimestamp();
  ASSERT_TRUE(local_oi.RecordNetworkInspection(result));

  int64_t first_timestamp = 0;
  ASSERT_TRUE(base::StringToInt64(result.inspected_at, &first_timestamp));
  result.http_status = 503;
  result.inspected_at = base::NumberToString(first_timestamp + 1);
  ASSERT_TRUE(local_oi.RecordNetworkInspection(result));
  const std::vector<LocalOiNetworkInspectionHistoryItem> history =
      local_oi.NetworkInspectionHistory(result.host);
  ASSERT_EQ(2u, history.size());
  EXPECT_EQ("changed", history[0].comparison);
  EXPECT_EQ("http_status", history[0].changed_fields);
  EXPECT_EQ(503, history[0].http_status);
  EXPECT_TRUE(history[0].tls_info_available);
  EXPECT_TRUE(history[0].certificate_valid);
  EXPECT_FALSE(history[0].certificate_expired);
  EXPECT_EQ(90, history[0].certificate_days_remaining);
  EXPECT_EQ("baseline", history[1].comparison);
  EXPECT_TRUE(local_oi.NetworkInspectionHistory("localhost").empty());
  EXPECT_TRUE(std::any_of(
      local_oi.data().findings.begin(), local_oi.data().findings.end(),
      [](const LocalOiFindingRecord& finding) {
        return finding.rule_id ==
               "local_oi.diagnostic.transport_metadata_changed.v1";
      }));
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [](const LocalOiEntityRecord& record) {
        return record.type == LocalOiEntityType::kToolResult &&
               std::any_of(record.fields.begin(), record.fields.end(),
                           [](const LocalOiField& field) {
                             return field.key == "diagnostic_comparison" &&
                                    field.value == "changed";
                           });
      }));
}

TEST_F(MissionServiceTest,
       LocalOiComparesAggregateDnsTopologyWithoutRetainingAddressValues) {
  TahaiLocalOiService local_oi(&profile_);
  TahaiNetworkInspectionResult result;
  result.host = "answers.example.com";
  result.resolved_addresses = {"203.0.113.12"};
  result.resolved_ipv4_count = 1;
  result.resolved_ipv6_count = 0;
  result.dns_alias_count = 0;
  result.dns_net_error = 0;
  result.request_net_error = 0;
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.certificate_days_remaining = 90;
  result.inspected_at = LocalOiNowTimestamp();
  ASSERT_TRUE(local_oi.RecordNetworkInspection(result));

  int64_t first_timestamp = 0;
  ASSERT_TRUE(base::StringToInt64(result.inspected_at, &first_timestamp));
  result.resolved_addresses = {"203.0.113.24", "203.0.113.25"};
  result.resolved_ipv4_count = 2;
  result.inspected_at = base::NumberToString(first_timestamp + 1);
  ASSERT_TRUE(local_oi.RecordNetworkInspection(result));

  const std::vector<LocalOiNetworkInspectionHistoryItem> history =
      local_oi.NetworkInspectionHistory(result.host);
  ASSERT_EQ(2u, history.size());
  EXPECT_EQ("changed", history.front().comparison);
  EXPECT_EQ("dns_ipv4_count", history.front().changed_fields);
  EXPECT_EQ(2, history.front().resolved_ipv4_count);
  EXPECT_EQ(0, history.front().resolved_ipv6_count);
  EXPECT_EQ(0, history.front().dns_alias_count);
  EXPECT_TRUE(std::all_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [](const LocalOiEntityRecord& record) {
        return std::none_of(record.fields.begin(), record.fields.end(),
                            [](const LocalOiField& field) {
                              return field.key == "dns_addresses" ||
                                     field.key == "dns_aliases" ||
                                     field.key == "dns_addresses_fingerprint" ||
                                     field.key == "dns_aliases_fingerprint" ||
                                     field.value == "203.0.113.12" ||
                                     field.value == "203.0.113.24" ||
                                     field.value == "203.0.113.25";
                            });
      }));
}

TEST_F(MissionServiceTest,
       LocalOiRetainsOnlySecurityHeaderObservationCountsInHistory) {
  TahaiLocalOiService local_oi(&profile_);
  TahaiNetworkInspectionResult result;
  result.host = "headers.example.com";
  result.resolved_ipv4_count = 1;
  result.dns_net_error = 0;
  result.request_net_error = 0;
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.security_header_observation_available = true;
  result.strict_transport_security_observed = true;
  result.content_security_policy_observed = true;
  result.observed_security_header_count = 2;
  result.inspected_at = LocalOiNowTimestamp();
  ASSERT_TRUE(local_oi.RecordNetworkInspection(result));

  int64_t first_timestamp = 0;
  ASSERT_TRUE(base::StringToInt64(result.inspected_at, &first_timestamp));
  result.strict_transport_security_observed = false;
  result.content_security_policy_observed = false;
  result.observed_security_header_count = 0;
  result.inspected_at = base::NumberToString(first_timestamp + 1);
  ASSERT_TRUE(local_oi.RecordNetworkInspection(result));

  const std::vector<LocalOiNetworkInspectionHistoryItem> history =
      local_oi.NetworkInspectionHistory(result.host);
  ASSERT_EQ(2u, history.size());
  EXPECT_EQ("changed", history.front().comparison);
  EXPECT_TRUE(base::Contains(history.front().changed_fields,
                             "observed_security_header_count"));
  EXPECT_TRUE(history.front().security_header_observation_available);
  EXPECT_EQ(0, history.front().observed_security_header_count);
  EXPECT_TRUE(std::all_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [](const LocalOiEntityRecord& record) {
        return std::none_of(record.fields.begin(), record.fields.end(),
                            [](const LocalOiField& field) {
                              return field.key == "raw_response_headers" ||
                                     field.key == "response_header_value" ||
                                     field.value == "max-age=31536000";
                            });
      }));
}

TEST_F(MissionServiceTest,
       LocalOiRetainsPublicAddressGuardOutcomeWithoutAddressHistory) {
  TahaiLocalOiService local_oi(&profile_);
  TahaiNetworkInspectionResult result;
  result.host = "guarded.example.com";
  result.dns_net_error = 0;
  result.request_net_error = -109;
  result.public_address_guard_blocked = true;
  result.inspected_at = LocalOiNowTimestamp();

  ASSERT_TRUE(local_oi.RecordNetworkInspection(result));
  const std::vector<LocalOiNetworkInspectionHistoryItem> history =
      local_oi.NetworkInspectionHistory(result.host);
  ASSERT_EQ(1u, history.size());
  EXPECT_TRUE(history.front().public_address_guard_blocked);
  EXPECT_EQ("baseline", history.front().comparison);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [](const LocalOiEntityRecord& record) {
        if (record.type != LocalOiEntityType::kToolResult) {
          return false;
        }
        return std::any_of(record.fields.begin(), record.fields.end(),
                           [](const LocalOiField& field) {
                             return field.key ==
                                        "public_address_guard_blocked" &&
                                    field.value == "true";
                           }) &&
               std::none_of(record.fields.begin(), record.fields.end(),
                            [](const LocalOiField& field) {
                              return field.key == "dns_addresses" ||
                                     field.key == "dns_aliases";
                            });
      }));
}

TEST_F(MissionServiceTest, LocalOiNetworkHistoryCapsRowsAndReturnsNewestFirst) {
  TahaiLocalOiService local_oi(&profile_);
  TahaiNetworkInspectionResult result;
  result.host = "history.example.com";
  result.resolved_addresses = {"203.0.113.12"};
  result.dns_net_error = 0;
  result.request_net_error = 0;
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.certificate_expired = false;
  result.certificate_days_remaining = 90;
  result.tls_version = "TLS 1.3";
  result.cipher_suite = "TLS_AES_128_GCM_SHA256";

  int64_t initial_timestamp = 0;
  ASSERT_TRUE(base::StringToInt64(LocalOiNowTimestamp(), &initial_timestamp));
  for (int offset = 0; offset < 10; ++offset) {
    result.http_status = 200 + offset;
    result.inspected_at = base::NumberToString(initial_timestamp + offset);
    ASSERT_TRUE(local_oi.RecordNetworkInspection(result));
  }

  const std::vector<LocalOiNetworkInspectionHistoryItem> history =
      local_oi.NetworkInspectionHistory(result.host);
  ASSERT_EQ(8u, history.size());
  EXPECT_EQ(base::NumberToString(initial_timestamp + 9),
            history.front().inspected_at);
  EXPECT_EQ(base::NumberToString(initial_timestamp + 2),
            history.back().inspected_at);
  EXPECT_EQ(209, history.front().http_status);
  EXPECT_EQ(202, history.back().http_status);
}

TEST_F(MissionServiceTest, LocalOiFlagsExpiringCertificateFromTypedResult) {
  LocalOiStoreData data;
  LocalOiEntityRecord endpoint;
  endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "example.com:443";
  endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = "1";
  endpoint.updated_at = "1";
  endpoint.fields = {{"dns_baseline", "true"},
                     {"tls_baseline", "true"},
                     {"tls_info_available", "true"},
                     {"tls_certificate_valid", "true"},
                     {"tls_certificate_expired", "false"},
                     {"tls_days_remaining", "7"},
                     {"dns_net_error", "0"}};
  data.entities.push_back(std::move(endpoint));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_TRUE(
      std::any_of(proposals.begin(), proposals.end(),
                  [](const LocalOiRuleProposal& proposal) {
                    return proposal.rule_id ==
                           "local_oi.endpoint.tls_certificate_expiring.v1";
                  }));
}

TEST_F(MissionServiceTest,
       LocalOiPrioritizesImminentCertificateExpiryWithoutDuplicatingTier) {
  LocalOiStoreData data;
  LocalOiEntityRecord endpoint;
  endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "imminent.example.com:443";
  endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = "1";
  endpoint.updated_at = "1";
  endpoint.fields = {{"dns_baseline", "true"},
                     {"tls_baseline", "true"},
                     {"tls_info_available", "true"},
                     {"tls_certificate_valid", "true"},
                     {"tls_certificate_expired", "false"},
                     {"tls_days_remaining", "3"},
                     {"dns_net_error", "0"}};
  data.entities.push_back(std::move(endpoint));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_TRUE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id ==
                   "local_oi.endpoint.tls_certificate_imminent.v1" &&
               item.severity == LocalOiFindingSeverity::kHigh;
      }));
  EXPECT_FALSE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id == "local_oi.endpoint.tls_certificate_expiring.v1";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiDoesNotTreatEnvironmentGuardReferenceAsSupportEndpoint) {
  LocalOiStoreData data;
  LocalOiEntityRecord environment;
  environment.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  environment.type = LocalOiEntityType::kEndpoint;
  environment.title = "https://console.example.com/";
  environment.summary = "Explicit local Environment Guard classification.";
  environment.source = LocalOiRecordSource::kExplicitUserEntry;
  environment.created_at = "1";
  environment.updated_at = "1";
  environment.fields = {{"environment", "production"},
                        {"browser_wide_enforcement", "false"},
                        {"show_persistent_boundary", "true"}};
  data.entities.push_back(std::move(environment));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_FALSE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id ==
                   "local_oi.knowledge.endpoint_no_documentation.v1" ||
               item.rule_id == "local_oi.knowledge.endpoint_no_baseline.v1";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiDoesNotInferCertificateExpiryFromUnavailableRemainingDays) {
  LocalOiStoreData data;
  LocalOiEntityRecord endpoint;
  endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "unknown-expiry.example.com:443";
  endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = "1";
  endpoint.updated_at = "1";
  endpoint.fields = {{"dns_baseline", "true"},
                     {"tls_baseline", "true"},
                     {"tls_info_available", "true"},
                     {"tls_certificate_valid", "true"},
                     {"tls_certificate_expired", "false"},
                     {"dns_net_error", "0"}};
  data.entities.push_back(std::move(endpoint));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_FALSE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id ==
                   "local_oi.endpoint.tls_certificate_imminent.v1" ||
               item.rule_id == "local_oi.endpoint.tls_certificate_expiring.v1";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiFlagsOnlyExplicitlyObservedLegacyTlsVersions) {
  LocalOiStoreData data;
  LocalOiEntityRecord legacy_endpoint;
  legacy_endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  legacy_endpoint.type = LocalOiEntityType::kEndpoint;
  legacy_endpoint.title = "legacy-tls.example.com:443";
  legacy_endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  legacy_endpoint.source = LocalOiRecordSource::kOpsTool;
  legacy_endpoint.created_at = "1";
  legacy_endpoint.updated_at = "1";
  legacy_endpoint.fields = {
      {"dns_baseline", "true"},       {"tls_baseline", "true"},
      {"tls_info_available", "true"}, {"tls_certificate_valid", "true"},
      {"tls_version", "TLS 1.0"},     {"dns_net_error", "0"}};
  data.entities.push_back(std::move(legacy_endpoint));

  LocalOiEntityRecord legacy_tls11_endpoint;
  legacy_tls11_endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  legacy_tls11_endpoint.type = LocalOiEntityType::kEndpoint;
  legacy_tls11_endpoint.title = "legacy-tls11.example.com:443";
  legacy_tls11_endpoint.summary =
      "Explicit HTTPS DNS and TLS inspection endpoint.";
  legacy_tls11_endpoint.source = LocalOiRecordSource::kOpsTool;
  legacy_tls11_endpoint.created_at = "1";
  legacy_tls11_endpoint.updated_at = "1";
  legacy_tls11_endpoint.fields = {
      {"dns_baseline", "true"},       {"tls_baseline", "true"},
      {"tls_info_available", "true"}, {"tls_certificate_valid", "true"},
      {"tls_version", "TLS 1.1"},     {"dns_net_error", "0"}};
  data.entities.push_back(std::move(legacy_tls11_endpoint));

  LocalOiEntityRecord modern_endpoint;
  modern_endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  modern_endpoint.type = LocalOiEntityType::kEndpoint;
  modern_endpoint.title = "modern-tls.example.com:443";
  modern_endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  modern_endpoint.source = LocalOiRecordSource::kOpsTool;
  modern_endpoint.created_at = "1";
  modern_endpoint.updated_at = "1";
  modern_endpoint.fields = {
      {"dns_baseline", "true"},       {"tls_baseline", "true"},
      {"tls_info_available", "true"}, {"tls_certificate_valid", "true"},
      {"tls_version", "TLS 1.2"},     {"dns_net_error", "0"}};
  data.entities.push_back(std::move(modern_endpoint));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_TRUE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id == "local_oi.endpoint.legacy_tls_version.v1" &&
               item.severity == LocalOiFindingSeverity::kMedium;
      }));
  EXPECT_EQ(2u,
            std::count_if(proposals.begin(), proposals.end(),
                          [](const LocalOiRuleProposal& item) {
                            return item.rule_id ==
                                   "local_oi.endpoint.legacy_tls_version.v1";
                          }));
}

TEST_F(MissionServiceTest,
       LocalOiPrioritizesSpecificTypedCertificateFailureClasses) {
  auto endpoint_with_failure = [](std::string title,
                                  std::string failure_field) {
    LocalOiEntityRecord endpoint;
    endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
    endpoint.type = LocalOiEntityType::kEndpoint;
    endpoint.title = std::move(title);
    endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
    endpoint.source = LocalOiRecordSource::kOpsTool;
    endpoint.created_at = "1";
    endpoint.updated_at = "1";
    endpoint.fields = {
        {"dns_baseline", "true"},           {"tls_baseline", "true"},
        {"tls_info_available", "true"},     {"tls_certificate_valid", "false"},
        {std::move(failure_field), "true"}, {"dns_net_error", "0"}};
    return endpoint;
  };

  LocalOiStoreData data;
  data.entities.push_back(endpoint_with_failure("revoked.example.com:443",
                                                "tls_certificate_revoked"));
  data.entities.push_back(endpoint_with_failure(
      "authority.example.com:443", "tls_certificate_authority_invalid"));
  data.entities.push_back(endpoint_with_failure(
      "mismatch.example.com:443", "tls_certificate_name_mismatch"));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  const auto has_rule = [&proposals](std::string_view rule_id,
                                     LocalOiFindingSeverity severity) {
    return std::any_of(proposals.begin(), proposals.end(),
                       [rule_id, severity](const LocalOiRuleProposal& item) {
                         return item.rule_id == rule_id &&
                                item.severity == severity;
                       });
  };
  EXPECT_TRUE(has_rule("local_oi.endpoint.tls_certificate_revoked.v1",
                       LocalOiFindingSeverity::kCritical));
  EXPECT_TRUE(has_rule("local_oi.endpoint.tls_certificate_authority_invalid.v1",
                       LocalOiFindingSeverity::kHigh));
  EXPECT_TRUE(has_rule("local_oi.endpoint.tls_certificate_name_mismatch.v1",
                       LocalOiFindingSeverity::kHigh));
  EXPECT_FALSE(has_rule("local_oi.endpoint.tls_certificate_invalid.v1",
                        LocalOiFindingSeverity::kHigh));
}

TEST_F(MissionServiceTest,
       LocalOiFlagsBoundedExplicitHttpsProbeFailuresAndServerErrors) {
  LocalOiStoreData data;
  LocalOiEntityRecord endpoint;
  endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "status.example.com:443";
  endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = "1";
  endpoint.updated_at = "1";
  endpoint.fields = {{"dns_baseline", "true"},
                     {"tls_baseline", "true"},
                     {"request_net_error", "-105"},
                     {"http_status", "503"}};
  data.entities.push_back(std::move(endpoint));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_TRUE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id == "local_oi.endpoint.https_probe_failed.v1";
      }));
  EXPECT_TRUE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id == "local_oi.endpoint.https_server_error.v1";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiDoesNotInferServiceHealthFromCredentialFree401Or403) {
  LocalOiStoreData data;
  for (const int status : {401, 403}) {
    LocalOiEntityRecord endpoint;
    endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
    endpoint.type = LocalOiEntityType::kEndpoint;
    endpoint.title = base::StrCat(
        {"auth-", base::NumberToString(status), ".example.com:443"});
    endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
    endpoint.source = LocalOiRecordSource::kOpsTool;
    endpoint.created_at = "1";
    endpoint.updated_at = "1";
    endpoint.fields = {{"dns_baseline", "true"},
                       {"tls_baseline", "true"},
                       {"dns_net_error", "0"},
                       {"request_net_error", "0"},
                       {"http_status", base::NumberToString(status)},
                       {"security_header_observation_available", "true"},
                       {"observed_security_header_count", "0"}};
    data.entities.push_back(std::move(endpoint));
  }

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_FALSE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id == "local_oi.endpoint.https_probe_failed.v1" ||
               item.rule_id == "local_oi.endpoint.https_server_error.v1" ||
               item.rule_id ==
                   "local_oi.endpoint.http_security_headers_not_observed.v1";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiFlagsMissingSelectedHttpSecurityHeaderObservation) {
  LocalOiStoreData data;
  LocalOiEntityRecord endpoint;
  endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "headers.example.com:443";
  endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = "1";
  endpoint.updated_at = "1";
  endpoint.fields = {{"dns_baseline", "true"},
                     {"tls_baseline", "true"},
                     {"dns_net_error", "0"},
                     {"request_net_error", "0"},
                     {"http_status", "200"},
                     {"security_header_observation_available", "true"},
                     {"observed_security_header_count", "0"}};
  data.entities.push_back(std::move(endpoint));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_TRUE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id ==
                   "local_oi.endpoint.http_security_headers_not_observed.v1" &&
               item.severity == LocalOiFindingSeverity::kLow &&
               base::Contains(item.explanation, "No header values");
      }));
}

TEST_F(MissionServiceTest,
       LocalOiDistinguishesPublicAddressGuardFromGenericProbeFailure) {
  LocalOiStoreData data;
  LocalOiEntityRecord endpoint;
  endpoint.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "guarded.example.com:443";
  endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = "1";
  endpoint.updated_at = "1";
  endpoint.fields = {{"dns_net_error", "0"},
                     {"request_net_error", "-109"},
                     {"public_address_guard_blocked", "true"}};
  data.entities.push_back(std::move(endpoint));

  TahaiLocalOiRuleEngine engine;
  const std::vector<LocalOiRuleProposal> proposals = engine.Evaluate(data);
  EXPECT_TRUE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id ==
               "local_oi.endpoint.public_address_guard_blocked.v1";
      }));
  EXPECT_FALSE(std::any_of(
      proposals.begin(), proposals.end(), [](const LocalOiRuleProposal& item) {
        return item.rule_id == "local_oi.endpoint.https_probe_failed.v1";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiChangeLensPersistsOnlyDigestMetadataAndDetectsChange) {
  TahaiLocalOiService local_oi(&profile_);
  const TahaiChangeCaptureRequest baseline_request = {
      TahaiChangeCaptureKind::kTlsCertificateDigest, "Example.COM",
      std::string(64u, 'a')};
  const std::optional<LocalOiChangeCaptureOutcome> baseline =
      local_oi.RecordChangeCapture(baseline_request);
  ASSERT_TRUE(baseline);
  EXPECT_TRUE(baseline->created_baseline);
  EXPECT_EQ("example.com", baseline->capture.canonical_target);

  const std::optional<LocalOiChangeCaptureOutcome> unchanged =
      local_oi.RecordChangeCapture(baseline_request);
  ASSERT_TRUE(unchanged);
  EXPECT_FALSE(unchanged->created_baseline);
  EXPECT_EQ(TahaiChangeComparisonResult::kUnchanged, unchanged->comparison);

  const std::optional<LocalOiChangeCaptureOutcome> changed =
      local_oi.RecordChangeCapture(
          {TahaiChangeCaptureKind::kTlsCertificateDigest, "example.com",
           std::string(64u, 'b')});
  ASSERT_TRUE(changed);
  EXPECT_EQ(TahaiChangeComparisonResult::kChanged, changed->comparison);
  EXPECT_TRUE(std::any_of(
      local_oi.data().findings.begin(), local_oi.data().findings.end(),
      [](const LocalOiFindingRecord& finding) {
        return finding.rule_id == "local_oi.change.digest_changed.v1" &&
               finding.state == LocalOiFindingState::kOpen;
      }));
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [](const LocalOiEntityRecord& entity) {
        return entity.id.size() == 36u &&
               entity.summary ==
                   "Operator-supplied SHA-256 digest; no captured material "
                   "retained.";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiChangeCaptureHistoryCapsRowsWithoutReturningDigests) {
  TahaiLocalOiService local_oi(&profile_);
  for (int index = 0; index < 10; ++index) {
    std::string digest(63u, 'a');
    digest.push_back(static_cast<char>('0' + index));
    ASSERT_TRUE(local_oi.RecordChangeCapture(
        {TahaiChangeCaptureKind::kContentDigest,
         "https://status.example.com/health", std::move(digest)}));
  }

  const std::vector<LocalOiChangeCaptureHistoryItem> history =
      local_oi.ChangeCaptureHistory(TahaiChangeCaptureKind::kContentDigest,
                                    "https://status.example.com/health");
  ASSERT_EQ(8u, history.size());
  EXPECT_TRUE(std::all_of(history.begin(), history.end(),
                          [](const LocalOiChangeCaptureHistoryItem& item) {
                            return item.comparison == "changed" &&
                                   !item.recorded_at.empty();
                          }));
  EXPECT_TRUE(history.front().is_current);
  EXPECT_FALSE(history.back().is_current);
  EXPECT_TRUE(local_oi
                  .ChangeCaptureHistory(
                      TahaiChangeCaptureKind::kContentDigest,
                      "https://status.example.com/health?private=value")
                  .empty());
  EXPECT_TRUE(
      local_oi
          .ChangeCaptureHistory(TahaiChangeCaptureKind::kTlsCertificateDigest,
                                "status.example.com")
          .empty());
}

TEST_F(MissionServiceTest, LocalOiChangeLensMayLinkOnlyToAnActiveLocalMission) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Production endpoint change", "change");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));

  const std::optional<LocalOiChangeCaptureOutcome> outcome =
      local_oi.RecordChangeCapture(
          {TahaiChangeCaptureKind::kEndpointStatusDigest,
           "https://status.example.com/health", std::string(64u, 'a')},
          mission->id);
  ASSERT_TRUE(outcome);
  EXPECT_TRUE(outcome->linked_to_mission);
  EXPECT_TRUE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&mission, &outcome](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kMissionProduced &&
               relationship.source_id == mission->id &&
               relationship.target_id == outcome->record_id;
      }));
  EXPECT_FALSE(local_oi.RecordChangeCapture(
      {TahaiChangeCaptureKind::kEndpointStatusDigest,
       "https://status.example.com/health", std::string(64u, 'b')},
      "not-a-local-id"));
}

TEST_F(MissionServiceTest,
       LocalOiChangeMissionSnapshotsReflectExplicitLinkedCaptures) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Service change", "change");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));

  const auto mission_field = [&local_oi, &mission](std::string_view key) {
    const auto record = std::find_if(
        local_oi.data().entities.begin(), local_oi.data().entities.end(),
        [&mission](const LocalOiEntityRecord& entity) {
          return entity.id == mission->id;
        });
    if (record == local_oi.data().entities.end()) {
      return std::string();
    }
    const auto field = std::find_if(
        record->fields.begin(), record->fields.end(),
        [key](const LocalOiField& candidate) { return candidate.key == key; });
    return field == record->fields.end() ? std::string() : field->value;
  };

  EXPECT_EQ("false", mission_field("before_snapshot"));
  EXPECT_EQ("false", mission_field("after_snapshot"));
  ASSERT_TRUE(local_oi.RecordChangeCapture(
      {TahaiChangeCaptureKind::kEndpointStatusDigest,
       "https://status.example.com/health", std::string(64u, 'a')},
      mission->id));
  EXPECT_EQ("true", mission_field("before_snapshot"));
  EXPECT_EQ("false", mission_field("after_snapshot"));
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));
  EXPECT_EQ("true", mission_field("before_snapshot"));
  EXPECT_EQ("false", mission_field("after_snapshot"));

  ASSERT_TRUE(local_oi.RecordChangeCapture(
      {TahaiChangeCaptureKind::kEndpointStatusDigest,
       "https://status.example.com/health", std::string(64u, 'a')},
      mission->id));
  EXPECT_EQ("true", mission_field("before_snapshot"));
  EXPECT_EQ("true", mission_field("after_snapshot"));
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));
  EXPECT_EQ("true", mission_field("before_snapshot"));
  EXPECT_EQ("true", mission_field("after_snapshot"));
}

TEST_F(MissionServiceTest,
       LocalOiArtifactMetadataNeverAcceptsAPathOrCredentialedOrigin) {
  TahaiLocalOiService local_oi(&profile_);
  const std::optional<LocalOiArtifactOutcome> artifact =
      local_oi.RecordArtifactMetadata(
          {"TAHAI release archive", "https://downloads.example.com/tahai.msix",
           std::string(64u, 'a'), ""});
  ASSERT_TRUE(artifact);
  EXPECT_EQ("https://downloads.example.com/tahai.msix",
            artifact->canonical_source_url);
  EXPECT_FALSE(artifact->linked_to_mission);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [artifact](const LocalOiEntityRecord& entity) {
        return entity.id == artifact->record_id &&
               entity.type == LocalOiEntityType::kArtifact &&
               entity.summary ==
                   "Explicit artifact provenance and SHA-256 metadata; no "
                   "file retained.";
      }));
  EXPECT_FALSE(local_oi.RecordArtifactMetadata(
      {"C:\\private\\tahai.msix", "https://downloads.example.com/tahai.msix",
       std::string(64u, 'a'), ""}));
  EXPECT_FALSE(local_oi.RecordArtifactMetadata(
      {"Release archive", "https://operator:secret@example.com/tahai.msix",
       std::string(64u, 'a'), ""}));
}

TEST_F(MissionServiceTest,
       LocalOiArtifactRuleDetectsConflictingHashesWithoutDisclosingThem) {
  TahaiLocalOiService local_oi(&profile_);
  constexpr char kSource[] = "https://downloads.example.com/tahai.msix";
  ASSERT_TRUE(local_oi.RecordArtifactMetadata(
      {"TAHAI release A", kSource, std::string(64u, 'a'), ""}));
  ASSERT_TRUE(local_oi.RecordArtifactMetadata(
      {"TAHAI release B", kSource, std::string(64u, 'b'), ""}));
  const auto finding = std::find_if(
      local_oi.data().findings.begin(), local_oi.data().findings.end(),
      [](const LocalOiFindingRecord& candidate) {
        return candidate.rule_id ==
               "local_oi.artifact.same_source_different_hash.v1";
      });
  ASSERT_NE(finding, local_oi.data().findings.end());
  EXPECT_EQ(LocalOiFindingSeverity::kHigh, finding->severity);
  EXPECT_EQ(2u, finding->affected_entity_ids.size());
  EXPECT_FALSE(base::Contains(finding->explanation, std::string(64u, 'a')));
  EXPECT_FALSE(base::Contains(finding->explanation, std::string(64u, 'b')));
}

TEST_F(MissionServiceTest,
       LocalOiArtifactHistoryCapsRowsWithoutReturningOriginOrDigest) {
  TahaiLocalOiService local_oi(&profile_);
  constexpr char kSource[] = "https://downloads.example.com/tahai.msix";
  for (int index = 0; index < 10; ++index) {
    std::string digest(63u, 'a');
    digest.push_back(static_cast<char>('0' + index));
    ASSERT_TRUE(local_oi.RecordArtifactMetadata(
        {base::StrCat({"Artifact ", base::NumberToString(index)}), kSource,
         std::move(digest), ""}));
  }

  const std::vector<LocalOiArtifactHistoryItem> history =
      local_oi.ArtifactHistory(kSource);
  ASSERT_EQ(8u, history.size());
  EXPECT_TRUE(
      std::all_of(history.begin(), history.end(),
                  [](const LocalOiArtifactHistoryItem& item) {
                    return base::StartsWith(item.label, "Artifact ",
                                            base::CompareCase::SENSITIVE) &&
                           item.digest_recorded && !item.recorded_at.empty();
                  }));
  EXPECT_TRUE(
      local_oi
          .ArtifactHistory("https://downloads.example.com/tahai.msix?private=1")
          .empty());
}

TEST_F(MissionServiceTest, LocalOiArtifactCanLinkToAnActiveLocalMission) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Release verification", "deployment");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));
  const std::optional<LocalOiArtifactOutcome> artifact =
      local_oi.RecordArtifactMetadata(
          {"Release archive", "https://downloads.example.com/tahai.msix",
           std::string(64u, 'b'), mission->id});
  ASSERT_TRUE(artifact);
  EXPECT_TRUE(artifact->linked_to_mission);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [&artifact, &mission](const LocalOiEntityRecord& entity) {
        return entity.id == artifact->record_id &&
               entity.mission_id == mission->id;
      }));
}

TEST_F(MissionServiceTest,
       LocalOiManualWatchIsConfigurationOnlyAndRejectsPrivateTargets) {
  TahaiLocalOiService local_oi(&profile_);
  const std::optional<LocalOiManualWatchOutcome> watch =
      local_oi.ConfigureManualWatch(
          {TahaiSentinelWatchKind::kTlsCertificate, "Example.COM", 900});
  ASSERT_TRUE(watch);
  EXPECT_EQ("example.com", watch->canonical_target);
  EXPECT_EQ(900, watch->interval_seconds);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [watch](const LocalOiEntityRecord& entity) {
        if (entity.id != watch->record_id ||
            entity.type != LocalOiEntityType::kWatch) {
          return false;
        }
        return std::any_of(entity.fields.begin(), entity.fields.end(),
                           [](const LocalOiField& field) {
                             return field.key == "execution_mode" &&
                                    field.value == "manual_only";
                           });
      }));
  EXPECT_FALSE(local_oi.ConfigureManualWatch(
      {TahaiSentinelWatchKind::kTlsCertificate, "localhost", 900}));
  EXPECT_FALSE(local_oi.ConfigureManualWatch(
      {TahaiSentinelWatchKind::kEndpointStatus,
       "https://operator:secret@example.com/", 900}));
}

TEST_F(MissionServiceTest,
       LocalOiManualWatchRegistryCapsValidatedManualOnlyConfigurations) {
  TahaiLocalOiService local_oi(&profile_);
  for (int index = 0; index < 18; ++index) {
    ASSERT_TRUE(local_oi.ConfigureManualWatch(
        {TahaiSentinelWatchKind::kTlsCertificate,
         base::StrCat({"check", base::NumberToString(index), ".example.com"}),
         900}));
  }

  const std::vector<LocalOiManualWatchItem> watches = local_oi.ManualWatches();
  ASSERT_EQ(16u, watches.size());
  EXPECT_TRUE(std::all_of(
      watches.begin(), watches.end(), [](const LocalOiManualWatchItem& item) {
        return base::StartsWith(item.target, "check",
                                base::CompareCase::SENSITIVE) &&
               base::EndsWith(item.target, ".example.com",
                              base::CompareCase::SENSITIVE) &&
               item.kind == "tls_certificate" && item.interval_seconds == 900;
      }));
  EXPECT_TRUE(std::is_sorted(watches.begin(), watches.end(),
                             [](const LocalOiManualWatchItem& left,
                                const LocalOiManualWatchItem& right) {
                               return left.target < right.target ||
                                      (left.target == right.target &&
                                       left.kind < right.kind);
                             }));
}

TEST_F(MissionServiceTest, LocalOiManualWatchMayLinkToAnActiveLocalMission) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Support verification", "incident");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));

  const std::optional<LocalOiManualWatchOutcome> watch =
      local_oi.ConfigureManualWatch(
          {TahaiSentinelWatchKind::kTlsCertificate, "status.example.com", 900},
          mission->id);
  ASSERT_TRUE(watch);
  EXPECT_TRUE(watch->linked_to_mission);
  const std::vector<LocalOiManualWatchItem> configured_watches =
      local_oi.ManualWatches();
  ASSERT_EQ(1u, configured_watches.size());
  EXPECT_EQ(mission->id, configured_watches.front().mission_id);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [&watch, &mission](const LocalOiEntityRecord& entity) {
        return entity.id == watch->record_id &&
               entity.mission_id == mission->id;
      }));
  EXPECT_TRUE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&watch, &mission](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kMissionUses &&
               relationship.source_id == mission->id &&
               relationship.target_id == watch->record_id;
      }));
  const std::optional<MissionSummary> replacement_mission =
      missions.CreateMission("Support follow-up", "incident");
  ASSERT_TRUE(replacement_mission);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));
  ASSERT_TRUE(local_oi.ConfigureManualWatch(
      {TahaiSentinelWatchKind::kTlsCertificate, "status.example.com", 900},
      replacement_mission->id));
  EXPECT_EQ(
      1u, std::count_if(local_oi.data().relationships.begin(),
                        local_oi.data().relationships.end(),
                        [watch](const LocalOiRelationshipRecord& relationship) {
                          return relationship.type ==
                                     LocalOiRelationshipType::kMissionUses &&
                                 relationship.target_id == watch->record_id;
                        }));
  ASSERT_TRUE(local_oi.ConfigureManualWatch(
      {TahaiSentinelWatchKind::kTlsCertificate, "status.example.com", 900}));
  EXPECT_EQ(
      0u, std::count_if(local_oi.data().relationships.begin(),
                        local_oi.data().relationships.end(),
                        [watch](const LocalOiRelationshipRecord& relationship) {
                          return relationship.type ==
                                     LocalOiRelationshipType::kMissionUses &&
                                 relationship.target_id == watch->record_id;
                        }));
  EXPECT_FALSE(local_oi.ConfigureManualWatch(
      {TahaiSentinelWatchKind::kTlsCertificate, "status.example.com", 900},
      "not-a-local-oi-id"));
}

TEST_F(MissionServiceTest,
       LocalOiExplicitDnsTlsRecheckLinksOnlyItsMatchingManualWatch) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Saved recheck", "support");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));
  const std::optional<LocalOiManualWatchOutcome> watch =
      local_oi.ConfigureManualWatch(
          {TahaiSentinelWatchKind::kTlsCertificate, "status.example.com", 900},
          mission->id);
  ASSERT_TRUE(watch);

  TahaiNetworkInspectionResult result;
  result.host = "status.example.com";
  result.resolved_addresses = {"8.8.8.8"};
  result.http_status = 200;
  result.tls_info_available = true;
  result.certificate_valid = true;
  result.inspected_at = LocalOiNowTimestamp();
  ASSERT_TRUE(
      local_oi.RecordNetworkInspection(result, mission->id, watch->record_id));
  const std::vector<LocalOiManualWatchItem> configured_watches =
      local_oi.ManualWatches();
  ASSERT_EQ(1u, configured_watches.size());
  EXPECT_EQ(result.inspected_at, configured_watches.front().last_completed_at);
  EXPECT_EQ("scheduled", configured_watches.front().schedule_state);
  EXPECT_GT(configured_watches.front().seconds_until_due, 0);
  EXPECT_LE(configured_watches.front().seconds_until_due, 900);
  ASSERT_TRUE(local_oi.ConfigureManualWatch(
      {TahaiSentinelWatchKind::kTlsCertificate, "status.example.com", 900},
      mission->id));
  const std::vector<LocalOiManualWatchItem> reconfigured_watches =
      local_oi.ManualWatches();
  ASSERT_EQ(1u, reconfigured_watches.size());
  EXPECT_EQ(result.inspected_at,
            reconfigured_watches.front().last_completed_at);
  EXPECT_TRUE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&watch](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kDerivedFrom &&
               relationship.target_id == watch->record_id &&
               relationship.basis ==
                   "Explicit DNS and TLS recheck derived from this manual-only "
                   "local watch configuration.";
      }));

  int64_t inspected_at = 0;
  ASSERT_TRUE(base::StringToInt64(result.inspected_at, &inspected_at));
  result.host = "other.example.com";
  result.inspected_at = base::NumberToString(inspected_at + 1);
  EXPECT_FALSE(
      local_oi.RecordNetworkInspection(result, mission->id, watch->record_id));
  result.host = "status.example.com";
  result.inspected_at = base::NumberToString(inspected_at + 2);
  EXPECT_FALSE(local_oi.RecordNetworkInspection(result, "", watch->record_id));
  result.inspected_at = base::NumberToString(inspected_at + 3);
  EXPECT_FALSE(
      local_oi.RecordNetworkInspection(result, mission->id, NewLocalOiId()));
}

TEST_F(MissionServiceTest,
       LocalOiFindingResolvesDirectMissionContextFromTypedSupportEdges) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Support verification", "incident");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));
  ASSERT_TRUE(
      local_oi.ConfigureManualWatch({TahaiSentinelWatchKind::kEndpointStatus,
                                     "https://status.example.com", 900},
                                    mission->id));
  ASSERT_TRUE(local_oi.RecalculateFindings());

  const LocalOiSnapshot snapshot = BuildLocalOiSnapshot(local_oi.data());
  EXPECT_TRUE(std::any_of(
      snapshot.findings.begin(), snapshot.findings.end(),
      [&mission](const LocalOiFinding& finding) {
        return finding.title == "Referenced endpoint has no documentation" &&
               finding.mission_id == mission->id &&
               finding.mission_title == "Support verification";
      }));
  EXPECT_TRUE(std::any_of(
      snapshot.priority_actions.begin(), snapshot.priority_actions.end(),
      [&mission](const LocalOiPriorityAction& action) {
        return action.mission_id == mission->id &&
               action.mission_title == "Support verification";
      }));
}

TEST_F(MissionServiceTest,
       LocalOiRecalculationReopensActiveResolvedFindingAndRecordsMemory) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Endpoint review", "incident");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));
  ASSERT_TRUE(local_oi.ConfigureManualWatch(
      {TahaiSentinelWatchKind::kEndpointStatus,
       "https://status.example.com", 900},
      mission->id));

  const auto finding = std::find_if(
      local_oi.data().findings.begin(), local_oi.data().findings.end(),
      [](const LocalOiFindingRecord& candidate) {
        return candidate.rule_id ==
               "local_oi.knowledge.endpoint_no_documentation.v1";
      });
  ASSERT_NE(local_oi.data().findings.end(), finding);
  const std::string finding_id = finding->id;
  ASSERT_TRUE(local_oi.ResolveFinding(
      finding_id, "The operator will re-evaluate local endpoint context."));
  ASSERT_TRUE(local_oi.RecalculateFindings());

  const auto reopened = std::find_if(
      local_oi.data().findings.begin(), local_oi.data().findings.end(),
      [finding_id](const LocalOiFindingRecord& candidate) {
        return candidate.id == finding_id;
      });
  ASSERT_NE(local_oi.data().findings.end(), reopened);
  EXPECT_EQ(LocalOiFindingState::kOpen, reopened->state);
  EXPECT_TRUE(std::any_of(
      local_oi.data().memory.begin(), local_oi.data().memory.end(),
      [finding_id = reopened->id](const LocalOiMemoryRecord& record) {
        return record.entity_id == finding_id &&
               record.action == LocalOiMemoryAction::kFindingReopened;
      }));
}

TEST_F(MissionServiceTest, PersistsCheckpointCompletionAndTimeline) {
  std::string mission_id;
  {
    MissionService service(&profile_);
    const auto mission = service.CreateMission("Change window", "change");
    ASSERT_TRUE(mission.has_value());
    mission_id = mission->id;
    ASSERT_FALSE(mission->steps.empty());
    EXPECT_TRUE(service.ToggleStep(mission_id, 0u));
    EXPECT_FALSE(service.ToggleStep(mission_id, mission->steps.size()));
  }

  MissionService reloaded(&profile_);
  ASSERT_EQ(1u, reloaded.missions().size());
  EXPECT_TRUE(reloaded.missions().front().steps.front().complete);
  ASSERT_EQ(2u, reloaded.missions().front().timeline.size());
  EXPECT_EQ("Checkpoint completed: Confirm approved scope",
            reloaded.missions().front().timeline.front().detail);
  EXPECT_EQ("runbook", reloaded.missions().front().timeline.front().kind);
  EXPECT_TRUE(reloaded.missions().front().timeline_integrity_verified);
  EXPECT_EQ(reloaded.missions().front().timeline.front().previous_hash,
            reloaded.missions().front().timeline[1].entry_hash);
}

TEST_F(MissionServiceTest, RejectsTamperedGeneratedLedgerRecords) {
  std::string mission_id;
  {
    MissionService service(&profile_);
    const auto mission = service.CreateMission("Release review", "change");
    ASSERT_TRUE(mission.has_value());
    mission_id = mission->id;
    ASSERT_TRUE(service.ToggleStep(mission_id, 0u));
  }

  base::ListValue stored_missions =
      profile_.GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  base::DictValue& stored_mission = stored_missions.front().GetDict();
  base::ListValue* timeline = stored_mission.FindList("timeline");
  ASSERT_TRUE(timeline);
  ASSERT_FALSE(timeline->empty());
  // This remains an allowlisted generated detail. Changing it without the
  // corresponding digest must still make the local record non-evidentiary.
  timeline->front().GetDict().Set(
      "detail", "Checkpoint reopened: Confirm approved scope");
  profile_.GetPrefs()->SetList(prefs::kTahaiMissions,
                               std::move(stored_missions));

  MissionService reloaded(&profile_);
  ASSERT_EQ(1u, reloaded.missions().size());
  const MissionSummary& mission = reloaded.missions().front();
  EXPECT_EQ(mission_id, mission.id);
  EXPECT_FALSE(mission.timeline_integrity_verified);
  ASSERT_EQ(1u, mission.timeline.size());
  EXPECT_EQ("Mission loaded", mission.timeline.front().detail);
}

TEST_F(MissionServiceTest, PersistsGeneratedRunbookAndEvidencePackState) {
  std::string mission_id;
  {
    MissionService service(&profile_);
    const auto mission = service.CreateMission("Incident review", "incident");
    ASSERT_TRUE(mission.has_value());
    mission_id = mission->id;
    ASSERT_FALSE(mission->validation_steps.empty());
    ASSERT_FALSE(mission->rollback_steps.empty());
    EXPECT_TRUE(service.ToggleValidationStep(mission_id, 0u));
    EXPECT_TRUE(service.ToggleRollbackStep(mission_id, 0u));
    EXPECT_TRUE(service.ToggleEscalation(mission_id));
    EXPECT_TRUE(service.AddEvidenceMarker(mission_id));
    EXPECT_TRUE(service.SetExportProfile(mission_id, "incident-packet"));
    EXPECT_FALSE(service.SetExportProfile(mission_id, "arbitrary-profile"));
  }

  MissionService reloaded(&profile_);
  ASSERT_EQ(1u, reloaded.missions().size());
  const MissionSummary& mission = reloaded.missions().front();
  EXPECT_TRUE(mission.validation_steps.front().complete);
  EXPECT_TRUE(mission.rollback_steps.front().complete);
  EXPECT_TRUE(mission.escalation_required);
  EXPECT_EQ("incident-packet", mission.export_profile);
  ASSERT_EQ(1u, mission.evidence.size());
  EXPECT_EQ("operator-confirmed", mission.evidence.front().capture_scope);
}

TEST_F(MissionServiceTest, DeletesOnlyKnownMission) {
  MissionService service(&profile_);
  const auto mission = service.CreateMission("Audit", "audit");
  ASSERT_TRUE(mission.has_value());
  EXPECT_FALSE(service.DeleteMission("not-a-uuid"));
  EXPECT_FALSE(service.DeleteMission(
      base::Uuid::GenerateRandomV4().AsLowercaseString()));
  // Direct deletion is deliberately unavailable for active operational
  // records. Archive is the reversible default.
  EXPECT_FALSE(service.DeleteMission(mission->id));
  EXPECT_TRUE(service.ArchiveMission(mission->id));
  EXPECT_TRUE(service.DeleteMission(mission->id));
  EXPECT_TRUE(service.missions().empty());
}

TEST_F(MissionServiceTest, ArchivesImmutableRecordsAndPersistsRestore) {
  std::string mission_id;
  {
    MissionService service(&profile_);
    const auto mission = service.CreateMission("Release readiness", "change");
    ASSERT_TRUE(mission.has_value());
    mission_id = mission->id;
    EXPECT_TRUE(service.ArchiveMission(mission_id));
    EXPECT_FALSE(service.ArchiveMission(mission_id));
    EXPECT_FALSE(service.ToggleStep(mission_id, 0u));
    EXPECT_FALSE(service.ToggleValidationStep(mission_id, 0u));
    EXPECT_FALSE(service.ToggleRollbackStep(mission_id, 0u));
    EXPECT_FALSE(service.ToggleEscalation(mission_id));
    EXPECT_FALSE(service.AddEvidenceMarker(mission_id));
    EXPECT_FALSE(service.SetExportProfile(mission_id, "change-record"));
  }

  MissionService reloaded(&profile_);
  ASSERT_EQ(1u, reloaded.missions().size());
  EXPECT_TRUE(reloaded.missions().front().archived);
  EXPECT_EQ("Mission archived",
            reloaded.missions().front().timeline.front().detail);
  EXPECT_TRUE(reloaded.RestoreMission(mission_id));
  EXPECT_FALSE(reloaded.missions().front().archived);
  EXPECT_TRUE(reloaded.ToggleStep(mission_id, 0u));
}

TEST_F(MissionServiceTest, DuplicatesOnlyTheGeneratedMissionFamily) {
  MissionService service(&profile_);
  const auto source = service.CreateMission("Release readiness", "change");
  ASSERT_TRUE(source.has_value());
  ASSERT_TRUE(service.ToggleStep(source->id, 0u));
  ASSERT_TRUE(service.AddEvidenceMarker(source->id));

  const auto duplicate = service.DuplicateMission(source->id);
  ASSERT_TRUE(duplicate.has_value());
  EXPECT_NE(source->id, duplicate->id);
  EXPECT_EQ("Release readiness copy", duplicate->title);
  EXPECT_EQ(source->type, duplicate->type);
  EXPECT_FALSE(duplicate->steps.front().complete);
  EXPECT_TRUE(duplicate->evidence.empty());
  ASSERT_EQ(1u, duplicate->timeline.size());
  EXPECT_EQ("Mission created", duplicate->timeline.front().detail);
  EXPECT_FALSE(service.DuplicateMission("not-a-uuid"));
}

TEST_F(MissionServiceTest, DuplicateTitleRemainsWithinTheSchemaLimit) {
  MissionService service(&profile_);
  const auto source = service.CreateMission(std::string(128u, 'a'), "audit");
  ASSERT_TRUE(source.has_value());

  const auto duplicate = service.DuplicateMission(source->id);
  ASSERT_TRUE(duplicate.has_value());
  EXPECT_EQ(128u, duplicate->title.size());
  EXPECT_TRUE(
      base::EndsWith(duplicate->title, " copy", base::CompareCase::SENSITIVE));
}

TEST_F(MissionServiceTest, EnforcesMissionCountLimit) {
  // Seed the persisted profile state directly. Creating 500 records one at a
  // time is itself exercised by the smaller persistence tests above, but doing
  // so here serializes an increasingly large preference list 500 times and
  // makes this boundary test exceed the standard test-launcher timeout.
  base::ListValue stored_missions;
  for (size_t i = 0; i < 500u; ++i) {
    base::DictValue mission;
    mission.Set("id", base::Uuid::GenerateRandomV4().AsLowercaseString());
    mission.Set("title", "Mission " + std::to_string(i));
    mission.Set("type", "investigation");
    mission.Set("created_at", "1");
    stored_missions.Append(std::move(mission));
  }
  profile_.GetPrefs()->SetList(prefs::kTahaiMissions,
                               std::move(stored_missions));

  MissionService service(&profile_);
  EXPECT_EQ(500u, service.missions().size());
  EXPECT_FALSE(service.CreateMission("Mission 501", "investigation"));
}

TEST_F(MissionServiceTest, IncognitoMissionMetadataIsEphemeral) {
  {
    MissionService regular_service(&profile_);
    ASSERT_TRUE(
        regular_service.CreateMission("Regular profile mission", "incident")
            .has_value());
  }
  Profile* incognito = profile_.GetPrimaryOTRProfile(/*create_if_needed=*/true);
  ASSERT_TRUE(incognito);
  {
    MissionService service(incognito);
    EXPECT_FALSE(service.persistence_enabled());
    // OTR must not inherit the regular profile's mission metadata through
    // Chromium's overlay preference service.
    EXPECT_TRUE(service.missions().empty());
    ASSERT_TRUE(service.CreateMission("Incident scratchpad", "incident"));
    EXPECT_EQ(1u, service.missions().size());
  }

  MissionService recreated(incognito);
  EXPECT_TRUE(recreated.missions().empty());
}

TEST_F(MissionServiceTest, WorkModesAreFixedProfileScopedAndNeverIdentity) {
  {
    ModeService service(&profile_);
    EXPECT_EQ("daily", service.active_mode().id);
    ASSERT_EQ(6u, ModeService::definitions().size());
    ASSERT_EQ(3u, ModeService::modifiers().size());
    EXPECT_TRUE(service.SetActiveMode("creator"));
    EXPECT_TRUE(service.SetModifierEnabled("focus", true));
    EXPECT_FALSE(service.SetActiveMode("arbitrary-mode"));
    EXPECT_FALSE(service.SetModifierEnabled("arbitrary-modifier", true));
  }

  ModeService reloaded(&profile_);
  EXPECT_EQ("creator", reloaded.active_mode().id);
  EXPECT_TRUE(reloaded.IsModifierEnabled("focus"));
  EXPECT_FALSE(reloaded.IsModifierEnabled("watch"));
}

TEST_F(MissionServiceTest, WorkModeWorkspaceChoicesAreFiniteAndProfileScoped) {
  {
    ModeService service(&profile_);
    EXPECT_EQ("dark", service.active_configuration().theme_id);
    EXPECT_TRUE(service.SetActiveConfigurationValue("theme", "light"));
    EXPECT_TRUE(service.SetActiveConfigurationValue("accent", "violet"));
    EXPECT_TRUE(service.SetActiveConfigurationValue("surface", "paper"));
    EXPECT_TRUE(service.SetActiveConfigurationValue("density", "spacious"));
    EXPECT_TRUE(service.SetActiveConfigurationValue("header", "minimal"));
    EXPECT_TRUE(service.SetActiveConfigurationValue("layout", "tri"));
    EXPECT_TRUE(service.SetActiveConfigurationValue("layout_variant",
                                                    "tri-one-over-two"));
    EXPECT_TRUE(
        service.SetActiveConfigurationValue("start_surface", "mission"));
    EXPECT_TRUE(
        service.SetActiveConfigurationValue("show_runbook_rail", "false"));
    EXPECT_FALSE(service.SetActiveConfigurationValue("theme", "neon"));
    EXPECT_FALSE(service.SetActiveConfigurationValue("accent", "hot-pink"));
    EXPECT_FALSE(service.SetActiveConfigurationValue("surface", "url(image)"));
    EXPECT_FALSE(service.SetActiveConfigurationValue("density", "giant"));
    EXPECT_FALSE(
        service.SetActiveConfigurationValue("header", "hidden-script"));
    EXPECT_FALSE(
        service.SetActiveConfigurationValue("layout_variant", "arbitrary"));
    EXPECT_FALSE(service.SetActiveConfigurationValue("start_surface",
                                                     "https://example.test"));
    EXPECT_FALSE(service.SetActiveConfigurationValue("layout", "arbitrary"));
    EXPECT_FALSE(service.SetActiveConfigurationValue("script", "alert(1)"));
  }

  ModeService reloaded(&profile_);
  EXPECT_EQ("light", reloaded.active_configuration().theme_id);
  EXPECT_EQ("violet", reloaded.active_configuration().accent_id);
  EXPECT_EQ("paper", reloaded.active_configuration().surface_id);
  EXPECT_EQ("spacious", reloaded.active_configuration().density_id);
  EXPECT_EQ("minimal", reloaded.active_configuration().header_id);
  EXPECT_EQ("tri", reloaded.active_configuration().layout_id);
  EXPECT_EQ("tri-one-over-two",
            reloaded.active_configuration().layout_variant_id);
  EXPECT_EQ("mission", reloaded.active_configuration().start_surface);
  EXPECT_FALSE(reloaded.active_configuration().show_runbook_rail);
}

TEST_F(MissionServiceTest, ModeConfigurationNoopDoesNotPersistOrNotify) {
  class Counter : public ModeService::Observer {
   public:
    void OnTahaiActiveModeChanged() override {}
    void OnTahaiModeConfigurationChanged() override { ++changes; }
    int changes = 0;
  } counter;
  ModeService service(&profile_);
  base::ScopedObservation<ModeService, ModeService::Observer> observation(
      &counter);
  observation.Observe(&service);
  const auto initial = service.active_configuration();
  const auto before =
      profile_.GetPrefs()->GetDict(prefs::kTahaiWorkModePreferences).Clone();
  EXPECT_TRUE(
      service.SetActiveConfigurationValue("rail_state", initial.rail_state));
  EXPECT_TRUE(service.ResetActiveConfiguration());
  EXPECT_EQ(0, counter.changes);
  EXPECT_EQ(before,
            profile_.GetPrefs()->GetDict(prefs::kTahaiWorkModePreferences));
  const std::string changed =
      initial.rail_state == "hidden" ? "icons" : "hidden";
  EXPECT_TRUE(service.SetActiveConfigurationValue("rail_state", changed));
  EXPECT_EQ(1, counter.changes);
  EXPECT_TRUE(service.SetActiveConfigurationValue("rail_state", changed));
  EXPECT_EQ(1, counter.changes);
  EXPECT_TRUE(service.ResetActiveConfiguration());
  EXPECT_EQ(2, counter.changes);
  EXPECT_EQ(initial, service.active_configuration());
}

TEST_F(MissionServiceTest, WorkspaceRailStatesAreFiniteAndPersistPerMode) {
  {
    ModeService service(&profile_);
    EXPECT_EQ("icons", service.active_configuration().rail_state);
    for (std::string_view state : {"icons", "expanded", "hidden"}) {
      ASSERT_TRUE(service.SetActiveConfigurationValue("rail_state", state));
      EXPECT_EQ(state, service.active_configuration().rail_state);
    }
    for (std::string_view invalid : {"", "compact", "auto", "hover", "Hidden",
                                     "true", "https://example.test"}) {
      EXPECT_FALSE(service.SetActiveConfigurationValue("rail_state", invalid));
      EXPECT_EQ("hidden", service.active_configuration().rail_state);
    }
    // Mission guidance is not a native navigation visibility preference.
    ASSERT_TRUE(
        service.SetActiveConfigurationValue("show_runbook_rail", "true"));
    EXPECT_EQ("hidden", service.active_configuration().rail_state);
    EXPECT_EQ("expanded",
              service.configuration_for_mode("operator").rail_state);
    ASSERT_TRUE(service.SetConfigurationValueForMode("operator", "rail_state",
                                                     "icons"));
  }
  ModeService reloaded(&profile_);
  EXPECT_EQ("hidden", reloaded.configuration_for_mode("daily").rail_state);
  EXPECT_EQ("icons", reloaded.configuration_for_mode("operator").rail_state);
  EXPECT_EQ("expanded", reloaded.configuration_for_mode("creator").rail_state);
  ASSERT_TRUE(reloaded.ResetConfigurationForMode("daily"));
  EXPECT_EQ("icons", reloaded.configuration_for_mode("daily").rail_state);
}

TEST_F(MissionServiceTest,
       WorkspaceRailMigratesLegacyBooleanAndRejectsBadState) {
  base::DictValue configurations;
  base::DictValue daily;
  daily.Set("show_runbook_rail", true);
  configurations.Set("daily", std::move(daily));
  base::DictValue creator;
  creator.Set("show_runbook_rail", false);
  creator.Set("rail_state", "hover");
  configurations.Set("creator", std::move(creator));
  base::DictValue operator_mode;
  operator_mode.Set("show_runbook_rail", true);
  operator_mode.Set("rail_state", "hidden");
  configurations.Set("operator", std::move(operator_mode));
  base::DictValue preferences;
  preferences.Set("configurations", std::move(configurations));
  profile_.GetPrefs()->SetDict(prefs::kTahaiWorkModePreferences,
                               std::move(preferences));
  ModeService service(&profile_);
  EXPECT_EQ("expanded", service.configuration_for_mode("daily").rail_state);
  EXPECT_EQ("icons", service.configuration_for_mode("creator").rail_state);
  EXPECT_EQ("hidden", service.configuration_for_mode("operator").rail_state);
}

TEST_F(MissionServiceTest, WorkspaceRailPreferencesDoNotCrossProfiles) {
  ModeService service(&profile_);
  ASSERT_TRUE(service.SetActiveConfigurationValue("rail_state", "hidden"));
  TestingProfile other_profile;
  ModeService other(&other_profile);
  EXPECT_EQ("icons", other.active_configuration().rail_state);
}

TEST_F(MissionServiceTest, WorkModeTemplatesAreBoundedToTheirMode) {
  ModeService service(&profile_);
  ASSERT_EQ(12u, ModeService::templates().size());
  const WorkModeTemplate* creator = ModeService::FindTemplate("creative-brief");
  ASSERT_TRUE(creator);
  EXPECT_EQ("creator", creator->mode_id);
  EXPECT_EQ("documentation", creator->mission_type);
  EXPECT_EQ(nullptr, ModeService::FindTemplate("https://example.test"));
  EXPECT_FALSE(
      service.SetActiveConfigurationValue("template", "creative-brief"));
  ASSERT_TRUE(service.SetActiveMode("creator"));
  EXPECT_TRUE(
      service.SetActiveConfigurationValue("template", "creative-brief"));
  EXPECT_FALSE(
      service.SetActiveConfigurationValue("template", "incident-bridge"));
}

TEST_F(MissionServiceTest, OffTheRecordModesAreEphemeralAndDefaultToDaily) {
  Profile* incognito = profile_.GetPrimaryOTRProfile(/*create_if_needed=*/true);
  ASSERT_TRUE(incognito);
  {
    ModeService service(incognito);
    EXPECT_FALSE(service.persistence_enabled());
    EXPECT_TRUE(service.SetActiveMode("operator"));
    EXPECT_TRUE(service.SetModifierEnabled("focus", true));
    EXPECT_EQ("operator", service.active_mode().id);
  }
  ModeService recreated(incognito);
  EXPECT_EQ("daily", recreated.active_mode().id);
  EXPECT_FALSE(recreated.IsModifierEnabled("focus"));
}

TEST_F(MissionServiceTest, SyncContractNeverEnablesPrivateBrowserState) {
  ASSERT_EQ(17u, GetTahaiSyncDataPolicies().size());
  const TahaiSyncDataPolicy* bookmarks =
      FindTahaiSyncDataPolicy(TahaiSyncObjectType::kBookmarks);
  ASSERT_TRUE(bookmarks);
  EXPECT_EQ(TahaiSyncInclusion::kDefault, bookmarks->inclusion);

  for (TahaiSyncProvider provider : {TahaiSyncProvider::kGoogleDriveAppData,
                                     TahaiSyncProvider::kOneDriveAppFolder}) {
    EXPECT_FALSE(IsTahaiSyncProviderAvailable(provider));
    EXPECT_FALSE(IsTahaiSyncObjectEligibleForUpload(
        provider, TahaiSyncObjectType::kBookmarks, /*explicit_opt_in=*/true));
    EXPECT_FALSE(IsTahaiSyncObjectEligibleForUpload(
        provider, TahaiSyncObjectType::kCookies, /*explicit_opt_in=*/true));
    EXPECT_FALSE(IsTahaiSyncObjectEligibleForUpload(
        provider, TahaiSyncObjectType::kPasswords,
        /*explicit_opt_in=*/true));
  }
  EXPECT_TRUE(IsTahaiSyncProviderAvailable(TahaiSyncProvider::kLocalProfile));
  EXPECT_FALSE(IsTahaiSyncObjectEligibleForUpload(
      TahaiSyncProvider::kLocalProfile, TahaiSyncObjectType::kMissionCapsule,
      /*explicit_opt_in=*/true));
}

TEST_F(MissionServiceTest, SyncEnvelopeEncryptsAndAuthenticatesEligibleData) {
  const std::array<uint8_t, kTahaiSyncEnvelopeKeyBytes> key = {42};
  TahaiSyncEnvelopeResult result = TahaiSyncEnvelopeResult::kInvalidEnvelope;
  const std::optional<std::string> envelope = SealTahaiSyncEnvelope(
      TahaiSyncProvider::kOneDriveAppFolder, TahaiSyncObjectType::kBookmarks,
      /*explicit_opt_in=*/false, "bookmark-root.7", key, R"({"title":"TAHAI"})",
      &result);
  ASSERT_TRUE(envelope);
  EXPECT_EQ(TahaiSyncEnvelopeResult::kOk, result);
  EXPECT_EQ(std::string::npos, envelope->find("TAHAI"));

  const std::optional<TahaiOpenedSyncEnvelope> opened =
      OpenTahaiSyncEnvelope(*envelope, key, &result);
  ASSERT_TRUE(opened);
  EXPECT_EQ(TahaiSyncEnvelopeResult::kOk, result);
  EXPECT_EQ(TahaiSyncProvider::kOneDriveAppFolder, opened->provider);
  EXPECT_EQ(TahaiSyncObjectType::kBookmarks, opened->object_type);
  EXPECT_EQ("bookmark-root.7", opened->object_id);
  EXPECT_EQ(R"({"title":"TAHAI"})", opened->plaintext);

  std::array<uint8_t, kTahaiSyncEnvelopeKeyBytes> wrong_key = {7};
  EXPECT_FALSE(OpenTahaiSyncEnvelope(*envelope, wrong_key, &result));
  EXPECT_EQ(TahaiSyncEnvelopeResult::kAuthenticationFailed, result);
}

TEST_F(MissionServiceTest, SyncEnvelopeEnforcesSchemaAndPrivacyPolicy) {
  const std::array<uint8_t, kTahaiSyncEnvelopeKeyBytes> key = {13};
  TahaiSyncEnvelopeResult result = TahaiSyncEnvelopeResult::kOk;
  EXPECT_FALSE(SealTahaiSyncEnvelope(TahaiSyncProvider::kGoogleDriveAppData,
                                     TahaiSyncObjectType::kMissionCapsule,
                                     /*explicit_opt_in=*/false, "mission:7",
                                     key, "{}", &result));
  EXPECT_EQ(TahaiSyncEnvelopeResult::kExplicitOptInRequired, result);
  EXPECT_FALSE(SealTahaiSyncEnvelope(
      TahaiSyncProvider::kGoogleDriveAppData, TahaiSyncObjectType::kCookies,
      /*explicit_opt_in=*/true, "cookies", key, "forbidden", &result));
  EXPECT_EQ(TahaiSyncEnvelopeResult::kDisallowedObject, result);
  EXPECT_FALSE(SealTahaiSyncEnvelope(
      TahaiSyncProvider::kGoogleDriveAppData, TahaiSyncObjectType::kBookmarks,
      /*explicit_opt_in=*/false, "unsafe/id", key, "{}", &result));
  EXPECT_EQ(TahaiSyncEnvelopeResult::kInvalidObjectId, result);
}

TEST_F(MissionServiceTest, KeyedSyncEnvelopeAuthenticatesKeySelection) {
  const std::array<uint8_t, kTahaiSyncEnvelopeKeyBytes> key = {23};
  const std::string key_id(64, 'a');
  TahaiSyncEnvelopeResult result = TahaiSyncEnvelopeResult::kInvalidEnvelope;
  const std::optional<std::string> envelope = SealTahaiSyncEnvelopeWithKeyId(
      TahaiSyncProvider::kLocalProfile, TahaiSyncObjectType::kMissionCapsule,
      /*explicit_opt_in=*/true, "mission:7", key_id, key, "{}", &result);
  ASSERT_TRUE(envelope);
  EXPECT_EQ(TahaiSyncEnvelopeResult::kOk, result);
  EXPECT_EQ(key_id, GetTahaiSyncEnvelopeKeyId(*envelope));

  const std::optional<TahaiOpenedSyncEnvelope> opened =
      OpenTahaiSyncEnvelope(*envelope, key, &result);
  ASSERT_TRUE(opened);
  EXPECT_EQ(TahaiSyncEnvelopeResult::kOk, result);
  EXPECT_EQ(key_id, opened->key_id);

  std::string tampered = *envelope;
  const size_t key_id_offset = tampered.find(key_id);
  ASSERT_NE(std::string::npos, key_id_offset);
  tampered.replace(key_id_offset, key_id.size(), std::string(64, 'b'));
  EXPECT_EQ(std::string(64, 'b'), GetTahaiSyncEnvelopeKeyId(tampered));
  EXPECT_FALSE(OpenTahaiSyncEnvelope(tampered, key, &result));
  EXPECT_EQ(TahaiSyncEnvelopeResult::kAuthenticationFailed, result);

  // A key id is only a local key-selection hint.  It must not be read from a
  // dictionary that is otherwise not a recognized sync-envelope header.
  std::string unrecognized_provider = *envelope;
  const size_t provider_offset = unrecognized_provider.find("local-profile");
  ASSERT_NE(std::string::npos, provider_offset);
  unrecognized_provider.replace(provider_offset,
                                std::string_view("local-profile").size(),
                                "unknown-local");
  EXPECT_FALSE(GetTahaiSyncEnvelopeKeyId(unrecognized_provider));
}

TEST_F(MissionServiceTest, SyncConflictRejectsUnauthenticOrPrivateRevisions) {
  TahaiSyncRevision local = {
      .object_type = TahaiSyncObjectType::kBookmarks,
      .object_id = "bookmark-root.7",
      .revision_id = "revision.local",
      .parent_revision_id = "revision.base",
      .modified_micros = 100,
      .device_id = "device.alpha",
      .plaintext_sha256 = std::string(64, 'a'),
  };
  TahaiSyncRevision remote = local;
  remote.plaintext_sha256 = std::string(64, 'b');
  EXPECT_EQ(TahaiSyncConflictAction::kReject,
            ResolveTahaiSyncConflict(local, remote).action);

  remote.revision_id = "revision.remote";
  remote.object_type = TahaiSyncObjectType::kCookies;
  EXPECT_FALSE(IsValidTahaiSyncRevision(remote));
  EXPECT_EQ(TahaiSyncConflictAction::kReject,
            ResolveTahaiSyncConflict(local, remote).action);
}

TEST_F(MissionServiceTest, SyncConflictUsesAuthenticatedDirectAncestry) {
  const TahaiSyncRevision remote = {
      .object_type = TahaiSyncObjectType::kModePreferences,
      .object_id = "mode-settings",
      .revision_id = "revision.remote",
      .parent_revision_id = "revision.base",
      .modified_micros = 100,
      .device_id = "device.remote",
      .plaintext_sha256 = std::string(64, 'a'),
  };
  TahaiSyncRevision local = remote;
  local.revision_id = "revision.local";
  local.parent_revision_id = remote.revision_id;
  local.modified_micros = 200;
  local.device_id = "device.local";
  local.plaintext_sha256 = std::string(64, 'b');

  const TahaiSyncConflictDecision decision =
      ResolveTahaiSyncConflict(local, remote);
  EXPECT_EQ(TahaiSyncConflictRelation::kLocalDescendsRemote, decision.relation);
  EXPECT_EQ(TahaiSyncConflictAction::kUseLocal, decision.action);
  EXPECT_TRUE(decision.forked_object_id.empty());
}

TEST_F(MissionServiceTest, SyncConflictConvergesWithoutLosingUserRecords) {
  TahaiSyncRevision remote = {
      .object_type = TahaiSyncObjectType::kBookmarks,
      .object_id = "bookmark-root.7",
      .revision_id = "revision.remote",
      .parent_revision_id = "revision.base",
      .modified_micros = 100,
      .device_id = "device.remote",
      .plaintext_sha256 = std::string(64, 'a'),
  };
  TahaiSyncRevision local = remote;
  local.revision_id = "revision.local";
  local.modified_micros = 200;
  local.device_id = "device.local";
  local.plaintext_sha256 = std::string(64, 'b');

  const TahaiSyncConflictDecision preserve =
      ResolveTahaiSyncConflict(local, remote);
  EXPECT_EQ(TahaiSyncConflictRelation::kDiverged, preserve.relation);
  EXPECT_EQ(TahaiSyncConflictAction::kKeepLocalAndForkRemote, preserve.action);
  EXPECT_EQ("bookmark-root.7.conflict." + std::string(64, 'a'),
            preserve.forked_object_id);

  // A conflict copy preserves the complete authenticated digest, even when
  // two candidate records share an initial display-sized prefix. It remains a
  // valid bounded object ID for a maximum-length source object.
  local.object_id = std::string(128, 'x');
  remote.object_id = local.object_id;
  remote.plaintext_sha256 = std::string(16, 'a') + std::string(48, 'c');
  local.plaintext_sha256 = std::string(16, 'a') + std::string(48, 'd');
  local.modified_micros = 3;
  remote.modified_micros = 2;
  const TahaiSyncConflictDecision full_digest_preserve =
      ResolveTahaiSyncConflict(local, remote);
  EXPECT_EQ(TahaiSyncConflictAction::kKeepLocalAndForkRemote,
            full_digest_preserve.action);
  EXPECT_EQ(128u, full_digest_preserve.forked_object_id.size());
  EXPECT_EQ(std::string(16, 'a') + std::string(48, 'c'),
            full_digest_preserve.forked_object_id.substr(
                full_digest_preserve.forked_object_id.size() - 64));
  EXPECT_TRUE(IsValidTahaiSyncRevision(
      {.object_type = TahaiSyncObjectType::kBookmarks,
       .object_id = full_digest_preserve.forked_object_id,
       .revision_id = "forked-revision.1",
       .parent_revision_id = "",
       .modified_micros = 3,
       .device_id = "device-a",
       .plaintext_sha256 = std::string(64, 'c')}));

  local.object_type = TahaiSyncObjectType::kCommandPreferences;
  local.object_id = "command-settings";
  TahaiSyncRevision settings_remote = remote;
  settings_remote.object_type = local.object_type;
  settings_remote.object_id = local.object_id;
  const TahaiSyncConflictDecision settings =
      ResolveTahaiSyncConflict(local, settings_remote);
  EXPECT_EQ(TahaiSyncConflictRelation::kDiverged, settings.relation);
  EXPECT_EQ(TahaiSyncConflictAction::kUseLocal, settings.action);
  EXPECT_TRUE(settings.forked_object_id.empty());
}

TEST_F(MissionServiceTest, SyncKeyringStatusDoesNotExposeOrInventKeyMaterial) {
  TahaiSyncKeyService key_service(profile_.GetPrefs(), nullptr);
  const TahaiSyncKeyringStatus empty_status = key_service.GetStatus();
  EXPECT_FALSE(empty_status.has_stored_keyring);
  EXPECT_FALSE(empty_status.has_active_key);
  EXPECT_TRUE(empty_status.active_key_id.empty());

  bool callback_called = false;
  key_service.EnsureActiveKey(base::BindLambdaForTesting(
      [&callback_called](TahaiSyncKeyResult result,
                         std::optional<TahaiSyncEnvelopeKey> key) {
        callback_called = true;
        EXPECT_EQ(TahaiSyncKeyResult::kOsCryptUnavailable, result);
        EXPECT_FALSE(key);
      }));
  EXPECT_TRUE(callback_called);

  base::DictValue malformed;
  malformed.Set("schema_version", 1);
  malformed.Set("active_key_id", std::string(64, 'a'));
  base::ListValue entries;
  base::DictValue malformed_entry;
  malformed_entry.Set("key_id", std::string(64, 'a'));
  malformed_entry.Set("created_micros", "not-a-timestamp");
  malformed_entry.Set("protected_key", "AQI=");
  entries.Append(std::move(malformed_entry));
  malformed.Set("entries", std::move(entries));
  profile_.GetPrefs()->SetDict(prefs::kTahaiSyncKeyring, std::move(malformed));

  const TahaiSyncKeyringStatus malformed_status = key_service.GetStatus();
  EXPECT_TRUE(malformed_status.has_stored_keyring);
  EXPECT_FALSE(malformed_status.has_active_key);
  EXPECT_TRUE(malformed_status.active_key_id.empty());

  TahaiSyncKeyService private_context_key_service(
      profile_.GetPrefs(), nullptr,
      /*persistence_allowed=*/false);
  EXPECT_FALSE(private_context_key_service.GetStatus().has_stored_keyring);
  bool private_callback_called = false;
  private_context_key_service.EnsureActiveKey(base::BindLambdaForTesting(
      [&private_callback_called](TahaiSyncKeyResult result,
                                 std::optional<TahaiSyncEnvelopeKey> key) {
        private_callback_called = true;
        EXPECT_EQ(TahaiSyncKeyResult::kPrivateModeUnavailable, result);
        EXPECT_FALSE(key);
      }));
  EXPECT_TRUE(private_callback_called);
}

TEST_F(MissionServiceTest, MissionCapsuleIsSanitizedAndIntegrityChecked) {
  MissionService service(&profile_);
  const std::optional<MissionSummary> mission =
      service.CreateMission("Secret customer title", "incident");
  ASSERT_TRUE(mission);
  const std::optional<std::string> capsule = BuildTahaiMissionCapsule(*mission);
  ASSERT_TRUE(capsule);
  EXPECT_TRUE(VerifyTahaiMissionCapsule(*capsule));
  EXPECT_EQ(std::string::npos, capsule->find("Secret customer title"));
  EXPECT_NE(std::string::npos, capsule->find("integrity_sha256"));

  std::string tampered = *capsule;
  const size_t incident = tampered.find("incident");
  ASSERT_NE(std::string::npos, incident);
  tampered.replace(incident, 8, "supportx");
  EXPECT_FALSE(VerifyTahaiMissionCapsule(tampered));
}

TEST_F(MissionServiceTest,
       EncryptedCapsuleImportCreatesFreshSanitizedGeneratedMission) {
  MissionService source_service(&profile_);
  const std::optional<MissionSummary> source =
      source_service.CreateMission("Private customer cutover", "migration");
  ASSERT_TRUE(source);
  ASSERT_TRUE(source_service.ToggleStep(source->id, 0));
  ASSERT_TRUE(source_service.ToggleValidationStep(source->id, 0));
  ASSERT_TRUE(source_service.ToggleRollbackStep(source->id, 0));
  ASSERT_TRUE(source_service.SetExportProfile(source->id, "incident-packet"));
  ASSERT_TRUE(source_service.AddEvidenceMarker(source->id));

  const auto current_source = std::find_if(
      source_service.missions().begin(), source_service.missions().end(),
      [&source](const MissionSummary& mission) {
        return mission.id == source->id;
      });
  ASSERT_NE(source_service.missions().end(), current_source);
  const std::optional<std::string> serialized =
      BuildTahaiMissionCapsule(*current_source);
  ASSERT_TRUE(serialized);
  const std::optional<TahaiMissionCapsuleImport> extracted =
      ExtractTahaiMissionCapsuleImport(*serialized);
  ASSERT_TRUE(extracted);
  EXPECT_EQ("migration", extracted->mission_type);
  EXPECT_EQ("incident-packet", extracted->export_profile);
  ASSERT_FALSE(extracted->checkpoint_complete.empty());
  ASSERT_FALSE(extracted->validation_complete.empty());
  ASSERT_FALSE(extracted->rollback_complete.empty());
  EXPECT_TRUE(extracted->checkpoint_complete[0]);
  EXPECT_TRUE(extracted->validation_complete[0]);
  EXPECT_TRUE(extracted->rollback_complete[0]);
  EXPECT_EQ(1u, extracted->evidence_marker_count);

  const std::optional<MissionSummary> imported =
      source_service.ImportSanitizedMissionCapsule(*extracted);
  ASSERT_TRUE(imported);
  EXPECT_NE(source->id, imported->id);
  EXPECT_EQ("Imported encrypted capsule", imported->title);
  EXPECT_EQ("migration", imported->type);
  EXPECT_EQ("incident-packet", imported->export_profile);
  EXPECT_TRUE(imported->steps[0].complete);
  EXPECT_TRUE(imported->validation_steps[0].complete);
  EXPECT_TRUE(imported->rollback_steps[0].complete);
  EXPECT_EQ(1u, imported->evidence.size());
  EXPECT_FALSE(imported->timeline.empty());
}

TEST_F(MissionServiceTest, CapsuleImportRejectsStateThatDoesNotMatchRunbook) {
  MissionService service(&profile_);
  TahaiMissionCapsuleImport malformed;
  malformed.mission_type = "incident";
  malformed.export_profile = "sanitized-handoff";
  malformed.checkpoint_complete = {true};
  malformed.validation_complete = {true};
  malformed.rollback_complete = {true};
  EXPECT_FALSE(service.ImportSanitizedMissionCapsule(malformed));
}

TEST_F(MissionServiceTest, MissionCapsuleRoundTripsThroughEncryptedEnvelope) {
  MissionService service(&profile_);
  const std::optional<MissionSummary> mission =
      service.CreateMission("Private migration", "migration");
  ASSERT_TRUE(mission);
  const std::array<uint8_t, kTahaiSyncEnvelopeKeyBytes> key = {91};
  TahaiSyncEnvelopeResult result = TahaiSyncEnvelopeResult::kInvalidEnvelope;
  const std::optional<std::string> sealed = SealTahaiMissionCapsule(
      *mission, TahaiSyncProvider::kGoogleDriveAppData, key, &result);
  ASSERT_TRUE(sealed);
  EXPECT_EQ(TahaiSyncEnvelopeResult::kOk, result);
  EXPECT_EQ(std::string::npos, sealed->find("Private migration"));

  const std::optional<std::string> opened =
      OpenTahaiMissionCapsule(*sealed, key, &result);
  ASSERT_TRUE(opened);
  EXPECT_EQ(TahaiSyncEnvelopeResult::kOk, result);
  EXPECT_TRUE(VerifyTahaiMissionCapsule(*opened));
}

TEST_F(MissionServiceTest, PackManifestAcceptsOnlyDeclarativeHttpsMetadata) {
  base::DictValue manifest;
  manifest.Set("schema_version", 1);
  manifest.Set("id", "cloudflare-dns");
  manifest.Set("name", "Cloudflare DNS Operations");
  manifest.Set("signing_key_id", "tahai-official-2026");
  base::ListValue capabilities;
  capabilities.Append("mission-recipe");
  capabilities.Append("safe-domain-catalog");
  manifest.Set("capabilities", std::move(capabilities));
  base::ListValue origins;
  origins.Append("https://dash.cloudflare.com/");
  origins.Append("https://developers.cloudflare.com/");
  manifest.Set("allowed_origins", std::move(origins));

  TahaiPackManifest parsed;
  EXPECT_EQ(TahaiPackManifestValidationResult::kValid,
            ValidateTahaiPackManifest(manifest, &parsed));
  EXPECT_EQ("cloudflare-dns", parsed.id);
  EXPECT_EQ(2u, parsed.capabilities.size());
  EXPECT_EQ(2u, parsed.allowed_origins.size());

  manifest.Set("script", "not permitted");
  EXPECT_EQ(TahaiPackManifestValidationResult::kUnknownField,
            ValidateTahaiPackManifest(manifest, &parsed));
  EXPECT_TRUE(parsed.id.empty());
}

TEST_F(MissionServiceTest,
       SkinManifestAcceptsOnlySafeClosedVocabularyAndOpaqueAssets) {
  base::DictValue manifest = MakeValidTahaiSkinManifest();
  TahaiSkinManifest parsed;
  EXPECT_EQ(TahaiSkinManifestValidationResult::kValid,
            ValidateTahaiSkinManifest(manifest, &parsed));
  EXPECT_EQ("midnight-operations", parsed.id);
  EXPECT_EQ(TahaiSkinDensity::kComfortable, parsed.appearance.density);
  ASSERT_EQ(1u, parsed.assets.size());
  EXPECT_EQ("assets/preview.webp", parsed.assets.front().path);
  EXPECT_EQ(TahaiSkinAssetPurpose::kPreview, parsed.assets.front().purpose);

  // An untrusted package cannot add a CSS selector, script, remote source, or
  // arbitrary browser setting through a manifest field.
  manifest.Set("stylesheet", "body { display: none; }");
  EXPECT_EQ(TahaiSkinManifestValidationResult::kUnknownField,
            ValidateTahaiSkinManifest(manifest, &parsed));
  EXPECT_TRUE(parsed.id.empty());
}

TEST_F(MissionServiceTest,
       SkinManifestRejectsInaccessibleTokensAndUnsafeArchiveReferences) {
  base::DictValue manifest = MakeValidTahaiSkinManifest();
  base::DictValue* appearance = manifest.FindDict("appearance");
  ASSERT_TRUE(appearance);
  base::DictValue* dark_tokens = appearance->FindDict("dark_tokens");
  ASSERT_TRUE(dark_tokens);
  dark_tokens->Set("toolbar_foreground", "#111827");
  TahaiSkinManifest parsed;
  EXPECT_EQ(TahaiSkinManifestValidationResult::kInvalidAppearance,
            ValidateTahaiSkinManifest(manifest, &parsed));
  EXPECT_TRUE(parsed.id.empty());

  manifest = MakeValidTahaiSkinManifest();
  base::ListValue* assets = manifest.FindList("assets");
  ASSERT_TRUE(assets);
  base::DictValue* preview = assets->front().GetIfDict();
  ASSERT_TRUE(preview);
  preview->Set("path", "assets/../recovery.png");
  EXPECT_EQ(TahaiSkinManifestValidationResult::kInvalidAssets,
            ValidateTahaiSkinManifest(manifest, &parsed));
  EXPECT_TRUE(parsed.id.empty());

  manifest = MakeValidTahaiSkinManifest();
  assets = manifest.FindList("assets");
  ASSERT_TRUE(assets);
  base::DictValue duplicate_preview;
  duplicate_preview.Set("path", "assets/preview-two.png");
  duplicate_preview.Set("sha256", std::string(64u, 'b'));
  duplicate_preview.Set("purpose", "preview");
  assets->Append(std::move(duplicate_preview));
  EXPECT_EQ(TahaiSkinManifestValidationResult::kInvalidAssets,
            ValidateTahaiSkinManifest(manifest, &parsed));
}

TEST_F(MissionServiceTest,
       SkinPackageRequiresExactBoundedDeclaredRasterEntries) {
  TahaiSkinManifest manifest;
  ASSERT_EQ(TahaiSkinManifestValidationResult::kValid,
            ValidateTahaiSkinManifest(MakeValidTahaiSkinManifest(), &manifest));
  const std::array<TahaiSkinPackageEntry, 1> valid_entries = {{
      {.path = "assets/preview.webp",
       .compressed_size = 256u,
       .uncompressed_size = 1024u},
  }};
  EXPECT_EQ(TahaiSkinPackageValidationResult::kValid,
            ValidateTahaiSkinPackageLayout(manifest, valid_entries));

  std::array<TahaiSkinPackageEntry, 1> symlink_entries = valid_entries;
  symlink_entries.front().is_symbolic_link = true;
  EXPECT_EQ(TahaiSkinPackageValidationResult::kUnsafeEntry,
            ValidateTahaiSkinPackageLayout(manifest, symlink_entries));

  std::array<TahaiSkinPackageEntry, 1> traversal_entries = valid_entries;
  traversal_entries.front().path = "assets/../recovery.webp";
  EXPECT_EQ(TahaiSkinPackageValidationResult::kUnsafeEntry,
            ValidateTahaiSkinPackageLayout(manifest, traversal_entries));

  std::array<TahaiSkinPackageEntry, 1> oversized_entries = valid_entries;
  oversized_entries.front().uncompressed_size = 4u * 1024u * 1024u + 1u;
  EXPECT_EQ(TahaiSkinPackageValidationResult::kExceededLimits,
            ValidateTahaiSkinPackageLayout(manifest, oversized_entries));

  std::array<TahaiSkinPackageEntry, 1> undeclared_entries = valid_entries;
  undeclared_entries.front().path = "assets/unknown.webp";
  EXPECT_EQ(TahaiSkinPackageValidationResult::kUnexpectedEntry,
            ValidateTahaiSkinPackageLayout(manifest, undeclared_entries));

  manifest.assets.front().path = "assets/../unsafe.webp";
  EXPECT_EQ(TahaiSkinPackageValidationResult::kInvalidManifest,
            ValidateTahaiSkinPackageLayout(manifest, valid_entries));
}

TEST_F(MissionServiceTest, SkinPackageVerifiesAssetIntegrityAfterBoundedRead) {
  TahaiSkinManifest manifest;
  ASSERT_EQ(TahaiSkinManifestValidationResult::kValid,
            ValidateTahaiSkinManifest(MakeValidTahaiSkinManifest(), &manifest));
  const std::string asset_bytes = "bounded preview raster bytes";
  manifest.assets.front().sha256 = base::ToLowerASCII(
      base::HexEncode(crypto::SHA256Hash(base::as_byte_span(asset_bytes))));
  EXPECT_EQ(
      TahaiSkinPackageValidationResult::kValid,
      VerifyTahaiSkinPackageAssetBytes(manifest, manifest.assets.front().path,
                                       base::as_byte_span(asset_bytes)));
  EXPECT_EQ(
      TahaiSkinPackageValidationResult::kHashMismatch,
      VerifyTahaiSkinPackageAssetBytes(manifest, manifest.assets.front().path,
                                       base::as_byte_span("tampered")));
  EXPECT_EQ(TahaiSkinPackageValidationResult::kInvalidManifest,
            VerifyTahaiSkinPackageAssetBytes(manifest, "assets/missing.webp",
                                             base::as_byte_span(asset_bytes)));
}

TEST_F(MissionServiceTest, SkinPathsRejectWindowsDeviceAndTrailingDotAliases) {
  for (const char* path :
       {"assets/con.png", "assets/nul.webp", "assets/prn.png", "assets/aux.png",
        "assets/com1.png", "assets/lpt9.webp", "assets/con/preview.png",
        "assets/folder./preview.png"}) {
    SCOPED_TRACE(path);
    EXPECT_FALSE(IsSafeTahaiSkinAssetPath(path));
    auto manifest = MakeValidTahaiSkinManifest();
    manifest.FindList("assets")->front().GetDict().Set("path", path);
    TahaiSkinManifest parsed;
    EXPECT_EQ(TahaiSkinManifestValidationResult::kInvalidAssets,
              ValidateTahaiSkinManifest(manifest, &parsed));
  }
  EXPECT_TRUE(IsSafeTahaiSkinAssetPath("assets/control.png"));
  EXPECT_TRUE(IsSafeTahaiSkinAssetPath("assets/com10.png"));
}

TEST_F(MissionServiceTest, SkinPackageExactRatioAndPurposeCannotBypassLimits) {
  TahaiSkinManifest manifest;
  ASSERT_EQ(TahaiSkinManifestValidationResult::kValid,
            ValidateTahaiSkinManifest(MakeValidTahaiSkinManifest(), &manifest));
  std::array<TahaiSkinPackageEntry, 1> entries = {{
      {.path = "assets/preview.webp",
       .compressed_size = 1,
       .uncompressed_size = 100},
  }};
  EXPECT_EQ(TahaiSkinPackageValidationResult::kValid,
            ValidateTahaiSkinPackageLayout(manifest, entries));
  entries[0].uncompressed_size = 101;
  EXPECT_EQ(TahaiSkinPackageValidationResult::kExceededLimits,
            ValidateTahaiSkinPackageLayout(manifest, entries));
  entries[0].uncompressed_size = 100;
  manifest.assets.front().purpose = static_cast<TahaiSkinAssetPurpose>(99);
  EXPECT_EQ(TahaiSkinPackageValidationResult::kInvalidManifest,
            ValidateTahaiSkinPackageLayout(manifest, entries));
}

TEST_F(MissionServiceTest,
       SkinSelectionUsesFiniteBuiltInsAndProfileModeFallbacks) {
  base::DictValue value;
  value.Set("schema_version", 1);
  value.Set("profile_skin_id", "midnight-operations");
  base::DictValue mode_skins;
  mode_skins.Set("operator", "tahai-sentinel");
  value.Set("mode_skins", std::move(mode_skins));

  TahaiSkinSelection selection;
  EXPECT_EQ(TahaiSkinSelectionValidationResult::kValid,
            ValidateTahaiSkinSelection(value, &selection));
  EXPECT_EQ("tahai-sentinel", ResolveTahaiSkinIdForMode(selection, "operator"));
  EXPECT_EQ("midnight-operations",
            ResolveTahaiSkinIdForMode(selection, "support"));
  EXPECT_EQ("midnight-operations",
            ResolveTahaiSkinIdForMode(selection, "untrusted-mode"));
  EXPECT_TRUE(IsTahaiBuiltInSkinId("classic-amp-inspired"));
  EXPECT_FALSE(IsTahaiBuiltInSkinId("C:\\browser\\skin"));

  value.Set("remote_catalog", "https://example.test/skins");
  EXPECT_EQ(TahaiSkinSelectionValidationResult::kUnknownField,
            ValidateTahaiSkinSelection(value, &selection));
  EXPECT_EQ("stock", selection.profile_skin_id);
}

TEST_F(MissionServiceTest,
       SkinSelectionPersistsPerProfileWithoutApplyingAppearance) {
  TahaiSkinSelection selection;
  selection.profile_skin_id = "tahai-neon";
  selection.mode_selections.push_back({"builder", "bare-metal"});
  ASSERT_TRUE(SetTahaiSkinSelection(profile_.GetPrefs(), selection));

  const TahaiSkinSelection persisted =
      GetTahaiSkinSelection(profile_.GetPrefs());
  EXPECT_EQ("tahai-neon", persisted.profile_skin_id);
  EXPECT_EQ("bare-metal", ResolveTahaiSkinIdForMode(persisted, "builder"));

  TestingProfile separate_profile;
  EXPECT_EQ("stock",
            GetTahaiSkinSelection(separate_profile.GetPrefs()).profile_skin_id);

  selection.mode_selections.push_back({"builder", "tahai-sentinel"});
  EXPECT_FALSE(SetTahaiSkinSelection(profile_.GetPrefs(), selection));
  EXPECT_EQ("bare-metal",
            ResolveTahaiSkinIdForMode(
                GetTahaiSkinSelection(profile_.GetPrefs()), "builder"));
}

TEST_F(MissionServiceTest,
       GuardAndSkinStagingDoNotReadOrWriteThroughOffTheRecordProfiles) {
  TahaiGuardConfiguration guard;
  guard.mode = TahaiGuardMode::kStrict;
  guard.local_statistics_enabled = true;
  ASSERT_TRUE(SetTahaiGuardConfigurationForProfile(&profile_, guard));

  TahaiSkinSelection skin;
  skin.profile_skin_id = "midnight-operations";
  ASSERT_TRUE(SetTahaiSkinSelectionForProfile(&profile_, skin));

  Profile* otr_profile =
      profile_.GetPrimaryOTRProfile(/*create_if_needed=*/true);
  ASSERT_TRUE(otr_profile);
  EXPECT_TRUE(otr_profile->IsOffTheRecord());
  EXPECT_EQ(TahaiGuardMode::kBalanced,
            GetTahaiGuardConfigurationForProfile(otr_profile).mode);
  EXPECT_EQ("stock",
            GetTahaiSkinSelectionForProfile(otr_profile).profile_skin_id);

  TahaiGuardConfiguration off_record_guard;
  off_record_guard.mode = TahaiGuardMode::kOff;
  EXPECT_FALSE(
      SetTahaiGuardConfigurationForProfile(otr_profile, off_record_guard));
  TahaiSkinSelection off_record_skin;
  off_record_skin.profile_skin_id = "tahai-neon";
  EXPECT_FALSE(SetTahaiSkinSelectionForProfile(otr_profile, off_record_skin));

  EXPECT_EQ(TahaiGuardMode::kStrict,
            GetTahaiGuardConfigurationForProfile(&profile_).mode);
  EXPECT_EQ("midnight-operations",
            GetTahaiSkinSelectionForProfile(&profile_).profile_skin_id);
}

TEST_F(MissionServiceTest,
       SkinResolutionHonorsSafeRecoveryAndFinitePrecedenceOnly) {
  TahaiSkinSelection selection;
  selection.profile_skin_id = "midnight-operations";
  selection.mode_selections.push_back({"operator", "tahai-sentinel"});

  TahaiSkinResolutionRequest request;
  request.active_mode_id = "operator";
  request.profile_selection = &selection;
  TahaiSkinResolution resolution = ResolveTahaiSkinIdentity(request);
  EXPECT_EQ("tahai-sentinel", resolution.skin_id);
  EXPECT_EQ(TahaiSkinResolutionSource::kModeSelection, resolution.source);

  request.mission_skin_id = "glass-command";
  resolution = ResolveTahaiSkinIdentity(request);
  EXPECT_EQ("glass-command", resolution.skin_id);
  EXPECT_EQ(TahaiSkinResolutionSource::kMissionAssignment, resolution.source);

  request.enterprise_skin_id = "high-contrast-operator";
  resolution = ResolveTahaiSkinIdentity(request);
  EXPECT_EQ("high-contrast-operator", resolution.skin_id);
  EXPECT_EQ(TahaiSkinResolutionSource::kEnterprisePolicy, resolution.source);

  request.force_stock_recovery = true;
  resolution = ResolveTahaiSkinIdentity(request);
  EXPECT_EQ("stock", resolution.skin_id);
  EXPECT_EQ(TahaiSkinResolutionSource::kStartupSafeRecovery, resolution.source);

  request.force_stock_recovery = false;
  request.enterprise_skin_id = "https://untrusted.example/skin";
  resolution = ResolveTahaiSkinIdentity(request);
  EXPECT_EQ("glass-command", resolution.skin_id);
  EXPECT_EQ(TahaiSkinResolutionSource::kMissionAssignment, resolution.source);

  request.mission_skin_id.reset();
  request.profile_selection = nullptr;
  resolution = ResolveTahaiSkinIdentity(request);
  EXPECT_EQ("stock", resolution.skin_id);
  EXPECT_EQ(TahaiSkinResolutionSource::kStockFallback, resolution.source);
}

TEST_F(MissionServiceTest, SignedPackBundleRequiresKnownEd25519TrustKey) {
  base::DictValue manifest;
  manifest.Set("schema_version", 1);
  manifest.Set("id", "cloudflare-dns");
  manifest.Set("name", "Cloudflare DNS Operations");
  manifest.Set("signing_key_id", "tahai-official-2026");
  base::ListValue capabilities;
  capabilities.Append("mission-recipe");
  manifest.Set("capabilities", std::move(capabilities));
  base::ListValue origins;
  origins.Append("https://developers.cloudflare.com/");
  manifest.Set("allowed_origins", std::move(origins));
  std::string serialized_manifest;
  ASSERT_TRUE(base::JSONWriter::Write(manifest, &serialized_manifest));

  const crypto::keypair::PrivateKey private_key =
      crypto::keypair::PrivateKey::GenerateEd25519();
  const crypto::keypair::PublicKey public_key =
      crypto::keypair::PublicKey::FromPrivateKey(private_key);
  const std::vector<uint8_t> signature =
      crypto::sign::Sign(crypto::sign::SignatureKind::ED25519, private_key,
                         base::as_byte_span(serialized_manifest));
  const TahaiPackTrustKey trusted_key = {
      .key_id = "tahai-official-2026",
      .public_key = public_key.ToEd25519PublicKey(),
  };
  TahaiPackManifest verified;
  EXPECT_EQ(
      TahaiPackBundleVerificationResult::kValid,
      VerifyTahaiSignedPackBundle(serialized_manifest, signature,
                                  base::span_from_ref(trusted_key), &verified));
  EXPECT_EQ("cloudflare-dns", verified.id);

  std::string tampered_manifest = serialized_manifest;
  const size_t cloudflare = tampered_manifest.find("cloudflare-dns");
  ASSERT_NE(std::string::npos, cloudflare);
  tampered_manifest.replace(cloudflare, std::string("cloudflare-dns").size(),
                            "tampered-pack");
  EXPECT_EQ(
      TahaiPackBundleVerificationResult::kInvalidSignature,
      VerifyTahaiSignedPackBundle(tampered_manifest, signature,
                                  base::span_from_ref(trusted_key), &verified));

  const TahaiPackTrustKey untrusted_key = {
      .key_id = "different-key",
      .public_key = public_key.ToEd25519PublicKey(),
  };
  EXPECT_EQ(TahaiPackBundleVerificationResult::kUnknownSigningKey,
            VerifyTahaiSignedPackBundle(serialized_manifest, signature,
                                        base::span_from_ref(untrusted_key),
                                        &verified));

  const std::array<TahaiPackTrustKey, 2> ambiguous_trust = {trusted_key,
                                                            trusted_key};
  EXPECT_EQ(TahaiPackBundleVerificationResult::kInvalidTrustStore,
            VerifyTahaiSignedPackBundle(serialized_manifest, signature,
                                        ambiguous_trust, &verified));

  // A policy/browser supplied trust store is a single fail-closed authority.
  // An unrelated malformed entry must not be ignored just because the Pack's
  // key happens to be valid.
  const TahaiPackTrustKey zero_key = {
      .key_id = "disabled-key",
      .public_key = {},
  };
  const std::array<TahaiPackTrustKey, 2> malformed_trust = {trusted_key,
                                                            zero_key};
  EXPECT_EQ(TahaiPackBundleVerificationResult::kInvalidTrustStore,
            VerifyTahaiSignedPackBundle(serialized_manifest, signature,
                                        malformed_trust, &verified));
}

TEST_F(MissionServiceTest, PilotContractIsReadOnlyAndExplicitlyScoped) {
  EXPECT_EQ(TahaiPilotPermission::kDenied,
            GetTahaiPilotPermission(TahaiPilotAction::kSummarizeSelectedPane,
                                    TahaiPilotScope::kNoScope));
  EXPECT_EQ(TahaiPilotPermission::kReadOnlyAllowed,
            GetTahaiPilotPermission(TahaiPilotAction::kCompareSelectedPanes,
                                    TahaiPilotScope::kSelectedTabs));
  EXPECT_EQ(TahaiPilotPermission::kDenied,
            GetTahaiPilotPermission(TahaiPilotAction::kCompareSelectedPanes,
                                    TahaiPilotScope::kMission));
  EXPECT_EQ(TahaiPilotPermission::kDenied,
            GetTahaiPilotPermission(TahaiPilotAction::kDraftValidationChecklist,
                                    TahaiPilotScope::kSelectedTabs));
  EXPECT_EQ(TahaiPilotPermission::kReadOnlyAllowed,
            GetTahaiPilotPermission(TahaiPilotAction::kDraftValidationChecklist,
                                    TahaiPilotScope::kMission));
  EXPECT_EQ(
      TahaiPilotPermission::kRequiresExplicitApproval,
      GetTahaiPilotPermission(TahaiPilotAction::kNavigateApprovedDestination,
                              TahaiPilotScope::kMission));
  EXPECT_EQ(
      TahaiPilotPermission::kDenied,
      GetTahaiPilotPermission(TahaiPilotAction::kNavigateApprovedDestination,
                              TahaiPilotScope::kSelectedTabs));
  for (TahaiPilotAction action :
       {TahaiPilotAction::kFillForm, TahaiPilotAction::kReadPasswordField,
        TahaiPilotAction::kReadMfaField, TahaiPilotAction::kReadCookies,
        TahaiPilotAction::kReadSessionToken,
        TahaiPilotAction::kRunShellCommand}) {
    EXPECT_EQ(TahaiPilotPermission::kDenied,
              GetTahaiPilotPermission(action, TahaiPilotScope::kMission));
  }
}

TEST_F(MissionServiceTest,
       TeamMissionAndWarRoomContractsNeverGrantRemoteAuthority) {
  EXPECT_EQ("coordinator",
            TahaiLocalMissionRoleName(TahaiLocalMissionRole::kCoordinator));
  EXPECT_EQ(TahaiLocalMissionRole::kReviewer,
            *TahaiLocalMissionRoleFromName("reviewer"));
  EXPECT_FALSE(TahaiLocalMissionRoleFromName("administrator"));

  for (TahaiTeamMissionOperation operation :
       {TahaiTeamMissionOperation::kAssignLocalRole,
        TahaiTeamMissionOperation::kRecordLocalRoleHandoff,
        TahaiTeamMissionOperation::kPrepareLocalWarRoom}) {
    EXPECT_EQ(TahaiTeamMissionPermission::kLocalOnlyAllowed,
              GetTahaiTeamMissionPermission(operation));
  }
  for (TahaiTeamMissionOperation operation :
       {TahaiTeamMissionOperation::kInviteRemoteParticipant,
        TahaiTeamMissionOperation::kResolveExternalIdentity,
        TahaiTeamMissionOperation::kPublishPresence,
        TahaiTeamMissionOperation::kNetworkSync,
        TahaiTeamMissionOperation::kReadAnotherProfile,
        TahaiTeamMissionOperation::kShareClipboard,
        TahaiTeamMissionOperation::kMoveAnotherBrowserWindow,
        TahaiTeamMissionOperation::kControlAnotherBrowserWindow}) {
    EXPECT_EQ(TahaiTeamMissionPermission::kDenied,
              GetTahaiTeamMissionPermission(operation));
  }
}

TEST_F(MissionServiceTest,
       SentinelContractRejectsPrivateAndCredentialedTargets) {
  std::string canonical_target;
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kValid,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kDnsRecord, "Example.COM", 300},
                &canonical_target));
  EXPECT_EQ("example.com", canonical_target);
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kDisallowedTarget,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kTlsCertificate, "localhost", 300},
                &canonical_target));
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kDisallowedTarget,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kDnsRecord, "intranet", 300},
                &canonical_target));
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kInvalidTarget,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kEndpointStatus,
                 "https://operator:secret@example.com/health", 300},
                &canonical_target));
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kInvalidInterval,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kContentHash,
                 "https://status.example.com/health", 30},
                &canonical_target));
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kDisallowedTarget,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kDnsRecord, ".example.com", 300},
                &canonical_target));
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kDisallowedTarget,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kTlsCertificate, "example-.com", 300},
                &canonical_target));
  EXPECT_EQ(TahaiSentinelWatchValidationResult::kDisallowedTarget,
            ValidateTahaiSentinelWatchRequest(
                {TahaiSentinelWatchKind::kTlsCertificate, "example..com", 300},
                &canonical_target));
}

TEST_F(MissionServiceTest, RecallScopesOnlyMapToPersistedLocalOiKinds) {
  EXPECT_EQ("all", *TahaiRecallScopeToLocalOiKind("all"));
  EXPECT_EQ("mission", *TahaiRecallScopeToLocalOiKind("mission"));
  EXPECT_EQ("finding", *TahaiRecallScopeToLocalOiKind("finding"));
  EXPECT_EQ("endpoint", *TahaiRecallScopeToLocalOiKind("endpoint"));
  EXPECT_EQ("artifact", *TahaiRecallScopeToLocalOiKind("artifact"));
  EXPECT_EQ("document_reference", *TahaiRecallScopeToLocalOiKind("reference"));
  EXPECT_EQ("tool_result", *TahaiRecallScopeToLocalOiKind("tool"));
  EXPECT_EQ("watch", *TahaiRecallScopeToLocalOiKind("watch"));
  EXPECT_EQ("memory", *TahaiRecallScopeToLocalOiKind("memory"));
  EXPECT_FALSE(TahaiRecallScopeToLocalOiKind("history"));
  EXPECT_FALSE(TahaiRecallScopeToLocalOiKind("tabs"));
  EXPECT_FALSE(TahaiRecallScopeToLocalOiKind("downloads"));
  EXPECT_FALSE(TahaiRecallScopeToLocalOiKind("credentials"));
}

TEST_F(MissionServiceTest,
       SentinelManualScheduleComputesDueStateWithoutStartingWork) {
  const TahaiSentinelWatchRequest request = {
      TahaiSentinelWatchKind::kTlsCertificate, "status.example.com", 900};
  const int64_t now = 9000000000;
  const TahaiSentinelScheduleStatus never_run =
      GetTahaiSentinelManualScheduleStatus(request, std::nullopt, now);
  EXPECT_EQ(TahaiSentinelScheduleState::kDue, never_run.state);
  EXPECT_EQ(0, never_run.last_completed_micros);
  EXPECT_EQ(0, never_run.seconds_until_due);

  const TahaiSentinelScheduleStatus scheduled =
      GetTahaiSentinelManualScheduleStatus(request, now - 1000000, now);
  EXPECT_EQ(TahaiSentinelScheduleState::kScheduled, scheduled.state);
  EXPECT_EQ(899, scheduled.seconds_until_due);
  EXPECT_EQ(now + 899000000, scheduled.next_due_micros);

  const TahaiSentinelScheduleStatus due =
      GetTahaiSentinelManualScheduleStatus(request, now - 900000000, now);
  EXPECT_EQ(TahaiSentinelScheduleState::kDue, due.state);
  EXPECT_EQ(0, due.seconds_until_due);

  const TahaiSentinelScheduleStatus future_completion =
      GetTahaiSentinelManualScheduleStatus(request, now + 1000000, now);
  EXPECT_EQ(TahaiSentinelScheduleState::kDue, future_completion.state);
  EXPECT_EQ(0, future_completion.seconds_until_due);
  EXPECT_EQ(now + 1000000, future_completion.last_completed_micros);

  const TahaiSentinelScheduleStatus invalid =
      GetTahaiSentinelManualScheduleStatus(
          {TahaiSentinelWatchKind::kTlsCertificate, "localhost", 900},
          std::nullopt, now);
  EXPECT_EQ(TahaiSentinelScheduleState::kInvalid, invalid.state);
}

TEST_F(MissionServiceTest,
       LocalOiDocumentReferencesAreTypedPointersAndCloseEndpointGaps) {
  TahaiLocalOiService local_oi(&profile_);
  LocalOiEntityRecord endpoint;
  endpoint.id = NewLocalOiId();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "status.example.com";
  endpoint.summary = "Explicit local endpoint record.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = LocalOiNowTimestamp();
  endpoint.updated_at = endpoint.created_at;
  ASSERT_TRUE(local_oi.UpsertEntity(endpoint));

  EXPECT_FALSE(local_oi.RecordDocumentReference(
      {"Endpoint runbook", "https://docs.example.com/runbook?token=secret",
       endpoint.id}));
  EXPECT_FALSE(local_oi.RecordDocumentReference(
      {"Endpoint runbook", "https://docs.example.com/runbook",
       NewLocalOiId()}));

  const std::optional<LocalOiDocumentReferenceOutcome> outcome =
      local_oi.RecordDocumentReference({"Endpoint runbook",
                                        "https://docs.example.com/runbook",
                                        endpoint.id});
  ASSERT_TRUE(outcome);
  EXPECT_EQ(endpoint.id, outcome->endpoint_id);
  EXPECT_EQ("https://docs.example.com/runbook",
            outcome->canonical_reference_url);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [&outcome, &endpoint](const LocalOiEntityRecord& entity) {
        if (entity.id != outcome->record_id ||
            entity.type != LocalOiEntityType::kDocumentReference) {
          return false;
        }
        return std::any_of(entity.fields.begin(), entity.fields.end(),
                           [&endpoint](const LocalOiField& field) {
                             return field.key == "endpoint_id" &&
                                    field.value == endpoint.id;
                           });
      }));
  EXPECT_FALSE(std::any_of(
      local_oi.data().findings.begin(), local_oi.data().findings.end(),
      [](const LocalOiFindingRecord& finding) {
        return finding.rule_id ==
               "local_oi.knowledge.endpoint_no_documentation.v1";
      }));
  EXPECT_EQ(1u, BuildLocalOiSnapshot(local_oi.data()).document_reference_count);
}

TEST_F(MissionServiceTest,
       LocalOiDocumentationReferenceMayLinkToAnActiveLocalMission) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Support documentation", "support");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));

  LocalOiEntityRecord endpoint;
  endpoint.id = NewLocalOiId();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "status.example.com";
  endpoint.summary = "Explicit local endpoint record.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = LocalOiNowTimestamp();
  endpoint.updated_at = endpoint.created_at;
  ASSERT_TRUE(local_oi.UpsertEntity(endpoint));

  const std::optional<LocalOiDocumentReferenceOutcome> reference =
      local_oi.RecordDocumentReference({"Endpoint runbook",
                                        "https://docs.example.com/runbook",
                                        endpoint.id, mission->id});
  ASSERT_TRUE(reference);
  EXPECT_TRUE(reference->linked_to_mission);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [&reference, &mission](const LocalOiEntityRecord& entity) {
        return entity.id == reference->record_id &&
               entity.mission_id == mission->id;
      }));
  EXPECT_TRUE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&reference, &mission](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kMissionUses &&
               relationship.source_id == mission->id &&
               relationship.target_id == reference->record_id;
      }));
  ASSERT_TRUE(local_oi.RecordDocumentReference(
      {"Endpoint runbook", "https://docs.example.com/runbook", endpoint.id,
       ""}));
  EXPECT_FALSE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&reference](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kMissionUses &&
               relationship.target_id == reference->record_id;
      }));
  EXPECT_FALSE(local_oi.RecordDocumentReference(
      {"Endpoint runbook", "https://docs.example.com/runbook", endpoint.id,
       "not-a-local-oi-id"}));
}

TEST_F(MissionServiceTest,
       LocalOiDocumentationRegistryCapsCurrentPointersPerEndpoint) {
  TahaiLocalOiService local_oi(&profile_);
  LocalOiEntityRecord endpoint;
  endpoint.id = NewLocalOiId();
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = "status.example.com";
  endpoint.summary = "Explicit local endpoint record.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = LocalOiNowTimestamp();
  endpoint.updated_at = endpoint.created_at;
  ASSERT_TRUE(local_oi.UpsertEntity(endpoint));
  for (int index = 0; index < 18; ++index) {
    ASSERT_TRUE(local_oi.RecordDocumentReference(
        {base::StrCat({"Runbook ", base::NumberToString(index)}),
         base::StrCat({"https://docs.example.com/runbook-",
                       base::NumberToString(index)}),
         endpoint.id}));
  }

  const std::vector<LocalOiDocumentReferenceItem> references =
      local_oi.DocumentReferencesForEndpoint(endpoint.id);
  ASSERT_EQ(16u, references.size());
  EXPECT_TRUE(
      std::all_of(references.begin(), references.end(),
                  [](const LocalOiDocumentReferenceItem& item) {
                    return base::StartsWith(item.label, "Runbook ",
                                            base::CompareCase::SENSITIVE) &&
                           base::StartsWith(item.reference_url,
                                            "https://docs.example.com/runbook-",
                                            base::CompareCase::SENSITIVE) &&
                           !item.recorded_at.empty();
                  }));
  EXPECT_TRUE(
      local_oi.DocumentReferencesForEndpoint("not-a-local-oi-id").empty());
}

TEST_F(MissionServiceTest,
       ChangeLensAcceptsOnlyExplicitDigestBasedPublicCaptures) {
  TahaiChangeCapture before;
  TahaiChangeCapture after;
  const TahaiChangeCaptureRequest before_request = {
      TahaiChangeCaptureKind::kContentDigest,
      "https://status.example.com/health",
      std::string(64u, 'a'),
      1,
  };
  EXPECT_EQ(TahaiChangeCaptureValidationResult::kValid,
            ValidateTahaiChangeCaptureRequest(before_request, &before));
  EXPECT_EQ("https://status.example.com/health", before.canonical_target);
  EXPECT_EQ(TahaiChangeCaptureValidationResult::kValid,
            ValidateTahaiChangeCaptureRequest(
                {TahaiChangeCaptureKind::kContentDigest,
                 "https://status.example.com/health", std::string(64u, 'b'), 2},
                &after));
  EXPECT_EQ(TahaiChangeComparisonResult::kChanged,
            CompareTahaiChangeCaptures(before, after));
  EXPECT_EQ(TahaiChangeComparisonResult::kUnchanged,
            CompareTahaiChangeCaptures(before, before));

  TahaiChangeCapture rejected;
  EXPECT_EQ(TahaiChangeCaptureValidationResult::kInvalidTarget,
            ValidateTahaiChangeCaptureRequest(
                {TahaiChangeCaptureKind::kContentDigest,
                 "https://status.example.com/health?token=secret",
                 std::string(64u, 'a'), 1},
                &rejected));
  EXPECT_TRUE(rejected.canonical_target.empty());
  EXPECT_EQ(TahaiChangeCaptureValidationResult::kInvalidDigest,
            ValidateTahaiChangeCaptureRequest(
                {TahaiChangeCaptureKind::kContentDigest,
                 "https://status.example.com/health", std::string(64u, 'A'), 1},
                &rejected));
  EXPECT_EQ(TahaiChangeCaptureValidationResult::kInvalidTimestamp,
            ValidateTahaiChangeCaptureRequest(
                {TahaiChangeCaptureKind::kContentDigest,
                 "https://status.example.com/health", std::string(64u, 'a'), 0},
                &rejected));
  EXPECT_EQ(TahaiChangeCaptureValidationResult::kInvalidTarget,
            ValidateTahaiChangeCaptureRequest(before_request, nullptr));
}

TEST_F(MissionServiceTest, EnvironmentGuardHasDeterministicProductionPosture) {
  const TahaiEnvironmentPosture& production =
      GetTahaiEnvironmentPosture(TahaiEnvironment::kProduction);
  EXPECT_TRUE(production.show_persistent_boundary);
  EXPECT_TRUE(production.confirm_multiline_paste);
  EXPECT_TRUE(production.require_redaction_preview);
  EXPECT_TRUE(production.block_pilot_actions);

  std::string canonical_origin;
  EXPECT_EQ(TahaiEnvironmentRuleValidationResult::kValid,
            ValidateTahaiEnvironmentRuleOrigin("https://portal.example.com/",
                                               &canonical_origin));
  EXPECT_EQ("https://portal.example.com/", canonical_origin);
  EXPECT_EQ(TahaiEnvironmentRuleValidationResult::kValid,
            ValidateTahaiEnvironmentRuleOrigin("https://intranet.local/",
                                               &canonical_origin));
  EXPECT_EQ(TahaiEnvironmentRuleValidationResult::kInvalidOrigin,
            ValidateTahaiEnvironmentRuleOrigin("http://example.com/",
                                               &canonical_origin));

  const TahaiEnvironmentGuardDecision paste = EvaluateTahaiEnvironmentAction(
      TahaiEnvironment::kProduction, TahaiEnvironmentAction::kMultilinePaste);
  EXPECT_TRUE(paste.allowed);
  EXPECT_TRUE(paste.require_confirmation);
  EXPECT_TRUE(paste.show_persistent_boundary);
  const TahaiEnvironmentGuardDecision pilot = EvaluateTahaiEnvironmentAction(
      TahaiEnvironment::kProduction, TahaiEnvironmentAction::kPilotAction);
  EXPECT_FALSE(pilot.allowed);
  const TahaiEnvironmentTransferDecision transfer =
      EvaluateTahaiEnvironmentTransfer(TahaiEnvironment::kDevelopment,
                                       TahaiEnvironment::kProduction);
  EXPECT_TRUE(transfer.allowed);
  EXPECT_TRUE(transfer.require_confirmation);
  EXPECT_TRUE(transfer.require_redaction_preview);
}

TEST_F(MissionServiceTest,
       GuardConfigurationIsExactOriginOnlyAndNeverPersistsAllowOnce) {
  base::DictValue configuration_value;
  configuration_value.Set("schema_version", 1);
  configuration_value.Set("mode", "strict");
  configuration_value.Set("local_statistics_enabled", true);
  base::ListValue overrides;
  base::DictValue turn_off;
  turn_off.Set("origin", "https://admin.example.com/");
  turn_off.Set("mode", "off");
  overrides.Append(std::move(turn_off));
  base::DictValue cosmetic_off;
  cosmetic_off.Set("origin", "https://console.example.com/");
  cosmetic_off.Set("mode", "cosmetic-off");
  overrides.Append(std::move(cosmetic_off));
  configuration_value.Set("site_overrides", std::move(overrides));

  TahaiGuardConfiguration configuration;
  EXPECT_EQ(
      TahaiGuardConfigurationValidationResult::kValid,
      ValidateTahaiGuardConfiguration(configuration_value, &configuration));
  EXPECT_EQ(TahaiGuardMode::kStrict, configuration.mode);
  EXPECT_TRUE(configuration.local_statistics_enabled);
  ASSERT_EQ(2u, configuration.site_overrides.size());

  const TahaiGuardEffectiveSettings off = ResolveTahaiGuardSettingsForUrl(
      configuration, GURL("https://admin.example.com/dashboard"));
  EXPECT_EQ(TahaiGuardMode::kOff, off.network_mode);
  EXPECT_FALSE(off.cosmetic_filtering_enabled);
  EXPECT_TRUE(off.exact_site_override_applied);

  const TahaiGuardEffectiveSettings cosmetic_off_settings =
      ResolveTahaiGuardSettingsForUrl(
          configuration, GURL("https://console.example.com/dashboard"));
  EXPECT_EQ(TahaiGuardMode::kStrict, cosmetic_off_settings.network_mode);
  EXPECT_FALSE(cosmetic_off_settings.cosmetic_filtering_enabled);
  EXPECT_TRUE(cosmetic_off_settings.exact_site_override_applied);

  const TahaiGuardEffectiveSettings unrelated = ResolveTahaiGuardSettingsForUrl(
      configuration, GURL("https://other.example.com/dashboard"));
  EXPECT_EQ(TahaiGuardMode::kStrict, unrelated.network_mode);
  EXPECT_TRUE(unrelated.cosmetic_filtering_enabled);
  EXPECT_FALSE(unrelated.exact_site_override_applied);

  configuration_value.Set("allow_once", "not-persistable");
  EXPECT_EQ(
      TahaiGuardConfigurationValidationResult::kUnknownField,
      ValidateTahaiGuardConfiguration(configuration_value, &configuration));
  EXPECT_TRUE(configuration.site_overrides.empty());
}

TEST_F(MissionServiceTest,
       GuardConfigurationPersistsOnlyValidatedProfileLocalPreferences) {
  EXPECT_EQ(TahaiGuardMode::kBalanced,
            GetTahaiGuardConfiguration(profile_.GetPrefs()).mode);
  TahaiGuardConfiguration configuration;
  configuration.mode = TahaiGuardMode::kCustom;
  configuration.local_statistics_enabled = true;
  configuration.site_overrides.push_back(
      {"https://admin.example.com/", TahaiGuardSiteOverrideMode::kOff});
  ASSERT_TRUE(SetTahaiGuardConfiguration(profile_.GetPrefs(), configuration));

  const TahaiGuardConfiguration persisted =
      GetTahaiGuardConfiguration(profile_.GetPrefs());
  EXPECT_EQ(TahaiGuardMode::kCustom, persisted.mode);
  EXPECT_TRUE(persisted.local_statistics_enabled);
  ASSERT_EQ(1u, persisted.site_overrides.size());
  EXPECT_EQ("https://admin.example.com/",
            persisted.site_overrides.front().canonical_origin);

  TestingProfile separate_profile;
  EXPECT_EQ(TahaiGuardMode::kBalanced,
            GetTahaiGuardConfiguration(separate_profile.GetPrefs()).mode);

  TahaiGuardConfiguration invalid = configuration;
  invalid.mode = static_cast<TahaiGuardMode>(99);
  EXPECT_FALSE(SetTahaiGuardConfiguration(profile_.GetPrefs(), invalid));
  EXPECT_EQ(TahaiGuardMode::kCustom,
            GetTahaiGuardConfiguration(profile_.GetPrefs()).mode);

  base::DictValue malformed;
  malformed.Set("mode", "strict");
  profile_.GetPrefs()->SetDict(prefs::kTahaiGuardConfiguration,
                               std::move(malformed));
  EXPECT_EQ(TahaiGuardMode::kBalanced,
            GetTahaiGuardConfiguration(profile_.GetPrefs()).mode);
}

TEST_F(MissionServiceTest,
       EnvironmentGuardRegistryResolvesOnlyTheExactProfileOrigin) {
  PrefService* prefs = profile_.GetPrefs();
  EXPECT_TRUE(
      CanSetTahaiEnvironmentGuardRule(prefs, "https://admin.example.com/"));
  EXPECT_TRUE(SetTahaiEnvironmentGuardRule(prefs, TahaiEnvironment::kProduction,
                                           "https://admin.example.com/"));

  const std::optional<TahaiEnvironmentGuardRule> matching =
      FindTahaiEnvironmentGuardRule(
          prefs, GURL("https://admin.example.com/customer/42"));
  ASSERT_TRUE(matching);
  EXPECT_EQ("https://admin.example.com/", matching->canonical_origin);
  EXPECT_EQ(TahaiEnvironment::kProduction, matching->environment);
  EXPECT_TRUE(matching->posture.show_persistent_boundary);
  EXPECT_FALSE(FindTahaiEnvironmentGuardRule(
      prefs, GURL("https://other.admin.example.com/")));
  EXPECT_FALSE(
      FindTahaiEnvironmentGuardRule(prefs, GURL("http://admin.example.com/")));

  const std::optional<TahaiEnvironmentGuardDecision> pilot =
      EvaluateTahaiEnvironmentGuardForUrl(
          prefs, GURL("https://admin.example.com/tools"),
          TahaiEnvironmentAction::kPilotAction);
  ASSERT_TRUE(pilot);
  EXPECT_FALSE(pilot->allowed);

  const TahaiEnvironmentGuardDecision confirmation_only = {
      .allowed = true,
      .require_confirmation = true,
      .require_redaction_preview = false,
      .show_persistent_boundary = true,
      .reason = "review",
  };
  TahaiEnvironmentGuardDecision requires_redaction = confirmation_only;
  requires_redaction.require_redaction_preview = true;
  EXPECT_TRUE(
      IsTahaiEnvironmentReviewEscalated(confirmation_only, requires_redaction));
  EXPECT_FALSE(
      IsTahaiEnvironmentReviewEscalated(requires_redaction, confirmation_only));
}

TEST_F(MissionServiceTest,
       IdentityLaneDestinationsCannotCarryCredentialsOrUnsafeSchemes) {
  EXPECT_TRUE(IsValidTahaiIdentityLaneDestination(
      GURL("https://portal.example.com/dashboard")));
  EXPECT_TRUE(IsValidTahaiIdentityLaneDestination(GURL("tahai://profiles/")));
  EXPECT_FALSE(
      IsValidTahaiIdentityLaneDestination(GURL("http://portal.example.com/")));
  EXPECT_FALSE(IsValidTahaiIdentityLaneDestination(
      GURL("https://operator:secret@portal.example.com/")));
  EXPECT_FALSE(
      IsValidTahaiIdentityLaneDestination(GURL("file:///C:/private.txt")));
  EXPECT_FALSE(
      IsValidTahaiIdentityLaneDestination(GURL("javascript:alert(1)")));
}

TEST_F(MissionServiceTest,
       LocalOiEnvironmentClassificationIsExactOriginMetadataOnly) {
  TahaiLocalOiService local_oi(&profile_);
  const std::optional<LocalOiEnvironmentClassificationOutcome> outcome =
      local_oi.ConfigureEnvironmentClassification(TahaiEnvironment::kProduction,
                                                  "https://admin.example.com");
  ASSERT_TRUE(outcome);
  EXPECT_EQ("https://admin.example.com/", outcome->canonical_origin);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [outcome](const LocalOiEntityRecord& entity) {
        if (entity.id != outcome->record_id ||
            entity.type != LocalOiEntityType::kEndpoint) {
          return false;
        }
        return std::any_of(entity.fields.begin(), entity.fields.end(),
                           [](const LocalOiField& field) {
                             return field.key == "browser_wide_enforcement" &&
                                    field.value == "false";
                           });
      }));
  EXPECT_FALSE(local_oi.ConfigureEnvironmentClassification(
      TahaiEnvironment::kProduction,
      "https://admin.example.com/path?token=secret"));
  const std::optional<TahaiEnvironment> sensitive =
      TahaiEnvironmentFromName("sensitive");
  ASSERT_TRUE(sensitive);
  EXPECT_EQ(TahaiEnvironment::kSensitive, *sensitive);
  EXPECT_FALSE(TahaiEnvironmentFromName("arbitrary"));
}

TEST_F(MissionServiceTest,
       LocalOiEnvironmentRegistryListsOnlyCurrentExactOriginPostures) {
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.ConfigureEnvironmentClassification(
      TahaiEnvironment::kProduction, "https://zebra.example.com"));
  ASSERT_TRUE(local_oi.ConfigureEnvironmentClassification(
      TahaiEnvironment::kSensitive, "https://alpha.example.com"));

  const std::vector<LocalOiEnvironmentClassificationItem> classifications =
      local_oi.EnvironmentClassifications();
  ASSERT_EQ(2u, classifications.size());
  EXPECT_EQ("https://alpha.example.com/", classifications[0].origin);
  EXPECT_EQ("sensitive", classifications[0].environment);
  EXPECT_TRUE(classifications[0].persistent_boundary);
  EXPECT_TRUE(classifications[0].redaction_preview);
  EXPECT_TRUE(classifications[0].pilot_actions_blocked);
  EXPECT_EQ("https://zebra.example.com/", classifications[1].origin);
  EXPECT_EQ("production", classifications[1].environment);
  EXPECT_TRUE(classifications[1].persistent_boundary);
  EXPECT_TRUE(classifications[1].redaction_preview);
  EXPECT_TRUE(classifications[1].pilot_actions_blocked);
}

TEST_F(MissionServiceTest,
       LocalOiEnvironmentClassificationMayLinkToAnActiveLocalMission) {
  MissionService missions(&profile_);
  const std::optional<MissionSummary> mission =
      missions.CreateMission("Production review", "change");
  ASSERT_TRUE(mission);
  TahaiLocalOiService local_oi(&profile_);
  ASSERT_TRUE(local_oi.SyncMissions(missions.missions()));

  const std::optional<LocalOiEnvironmentClassificationOutcome> outcome =
      local_oi.ConfigureEnvironmentClassification(TahaiEnvironment::kSensitive,
                                                  "https://admin.example.com",
                                                  mission->id);
  ASSERT_TRUE(outcome);
  EXPECT_TRUE(outcome->linked_to_mission);
  EXPECT_TRUE(std::any_of(
      local_oi.data().entities.begin(), local_oi.data().entities.end(),
      [&outcome, &mission](const LocalOiEntityRecord& entity) {
        return entity.id == outcome->record_id &&
               entity.mission_id == mission->id;
      }));
  EXPECT_TRUE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&outcome, &mission](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kMissionUses &&
               relationship.source_id == mission->id &&
               relationship.target_id == outcome->record_id;
      }));
  ASSERT_TRUE(local_oi.ConfigureEnvironmentClassification(
      TahaiEnvironment::kSensitive, "https://admin.example.com"));
  EXPECT_FALSE(std::any_of(
      local_oi.data().relationships.begin(),
      local_oi.data().relationships.end(),
      [&outcome](const LocalOiRelationshipRecord& relationship) {
        return relationship.type == LocalOiRelationshipType::kMissionUses &&
               relationship.target_id == outcome->record_id;
      }));
  EXPECT_FALSE(local_oi.ConfigureEnvironmentClassification(
      TahaiEnvironment::kSensitive, "https://admin.example.com",
      "not-a-local-oi-id"));
}

TEST_F(MissionServiceTest, LocalOiEmptyStoreHasNoSyntheticProjection) {
  MissionService service(&profile_);
  const auto mission = service.CreateMission("Release readiness", "change");
  ASSERT_TRUE(mission.has_value());
  ASSERT_TRUE(service.ToggleStep(mission->id, 0u));
  ASSERT_TRUE(service.ToggleEscalation(mission->id));

  const LocalOiSnapshot snapshot = BuildLocalOiSnapshot(LocalOiStoreData());
  EXPECT_TRUE(snapshot.mission_health.empty());
  EXPECT_TRUE(snapshot.relationships.empty());
  EXPECT_TRUE(snapshot.entities.empty());
  EXPECT_TRUE(snapshot.capabilities.empty());
  EXPECT_TRUE(snapshot.scale_signals.empty());
  EXPECT_EQ("Change Record",
            LocalOiSafeReportKindLabel(LocalOiSafeReportKind::kChangeRecord));
  EXPECT_EQ(
      "Artifact Integrity Report",
      LocalOiSafeReportKindLabel(LocalOiSafeReportKind::kArtifactIntegrity));
  EXPECT_EQ("Local OI Diagnostic Report",
            LocalOiSafeReportKindLabel(LocalOiSafeReportKind::kDiagnostic));
  EXPECT_EQ(LocalOiSafeReportKind::kEvidenceManifest,
            LocalOiSafeReportKindFromString("evidence-manifest"));
  EXPECT_EQ(LocalOiSafeReportKind::kArtifactIntegrity,
            LocalOiSafeReportKindFromString("artifact-integrity"));
  EXPECT_EQ(LocalOiSafeReportKind::kDiagnostic,
            LocalOiSafeReportKindFromString("diagnostic-report"));
  EXPECT_FALSE(LocalOiSafeReportKindFromString("mission-title=private"));
  EXPECT_EQ(LocalOiSafeReportFormat::kMarkdown,
            LocalOiSafeReportFormatFromString("markdown"));
  EXPECT_EQ(LocalOiSafeReportFormat::kJson,
            LocalOiSafeReportFormatFromString("json"));
  EXPECT_FALSE(LocalOiSafeReportFormatFromString("xml"));
  EXPECT_EQ(0u, snapshot.blocked_finding_count);
  EXPECT_EQ(0u, snapshot.knowledge_gap_count);
  EXPECT_EQ(0u, snapshot.opaque_oi_reference_count);
  EXPECT_EQ(0u, snapshot.operator_action_count);
  EXPECT_TRUE(snapshot.priority_actions.empty());
  EXPECT_TRUE(snapshot.memory.empty());
  const LocalOiDataInventory inventory =
      BuildLocalOiDataInventory(LocalOiStoreData());
  EXPECT_EQ(kTahaiLocalOiCurrentSchemaVersion, inventory.schema_version);
  EXPECT_EQ(0, inventory.generation);
  EXPECT_EQ(0u, inventory.relationship_count);
  EXPECT_EQ(0u, inventory.finding_count);
  EXPECT_EQ(0u, inventory.memory_count);
  EXPECT_EQ(0u, inventory.report_count);
  EXPECT_EQ(16u, inventory.entity_categories.size());
  for (const LocalOiDataInventoryEntry& entry : inventory.entity_categories) {
    EXPECT_EQ(0u, entry.record_count);
  }

  const std::vector<LocalOiSearchResult> results =
      SearchLocalOiSnapshot(snapshot, "release");
  EXPECT_TRUE(results.empty());
  EXPECT_TRUE(SearchLocalOiSnapshot(snapshot, "https://example.test/").empty());
  EXPECT_TRUE(SearchLocalOiSnapshot(snapshot, std::string(65u, 'a')).empty());
  const std::string change_record =
      BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kChangeRecord);
  EXPECT_TRUE(base::Contains(change_record, "TAHAI Local OI Change Record"));
  EXPECT_TRUE(base::Contains(change_record, "local-only"));
  EXPECT_FALSE(base::Contains(change_record, "Release readiness"));
  EXPECT_TRUE(
      base::Contains(BuildLocalOiSafeReport(
                         snapshot, LocalOiSafeReportKind::kArtifactIntegrity),
                     "Report focus: local artifact-integrity posture"));
  EXPECT_TRUE(base::Contains(
      BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kDiagnostic),
      "Report focus: local diagnostic posture"));
  const std::string json_report =
      BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kDiagnostic,
                             LocalOiSafeReportFormat::kJson, "133713371337");
  EXPECT_TRUE(base::Contains(json_report, "tahai_local_oi_safe_report_v1"));
  EXPECT_TRUE(base::Contains(json_report, "Local OI Diagnostic Report"));
  EXPECT_TRUE(base::Contains(json_report, "local-only"));
  EXPECT_TRUE(base::Contains(json_report, "generated_at"));
  EXPECT_TRUE(base::Contains(json_report, "133713371337"));
  EXPECT_FALSE(base::Contains(json_report, "Release readiness"));
  EXPECT_FALSE(base::Contains(json_report, "https://"));
  const std::string markdown_report = BuildLocalOiSafeReport(
      snapshot, LocalOiSafeReportKind::kOverview,
      LocalOiSafeReportFormat::kMarkdown, "133713371337");
  EXPECT_TRUE(base::Contains(markdown_report, "Generated at: 133713371337"));
  EXPECT_FALSE(base::Contains(markdown_report, "Release readiness"));
}

TEST_F(MissionServiceTest, LocalOiDataInventoryCountsOnlyStoredCategories) {
  LocalOiStoreData data;
  data.schema_version = kTahaiLocalOiCurrentSchemaVersion;
  data.generation = 17;
  data.entities = {
      {NewLocalOiId(), LocalOiEntityType::kMission},
      {NewLocalOiId(), LocalOiEntityType::kEndpoint},
      {NewLocalOiId(), LocalOiEntityType::kEndpoint},
  };
  data.relationships.resize(2u);
  data.findings.resize(3u);
  data.memory.resize(5u);
  data.reports.resize(7u);

  const LocalOiDataInventory inventory = BuildLocalOiDataInventory(data);
  EXPECT_EQ(kTahaiLocalOiCurrentSchemaVersion, inventory.schema_version);
  EXPECT_EQ(17, inventory.generation);
  EXPECT_EQ(2u, inventory.relationship_count);
  EXPECT_EQ(3u, inventory.finding_count);
  EXPECT_EQ(5u, inventory.memory_count);
  EXPECT_EQ(7u, inventory.report_count);
  const auto endpoints = std::find_if(
      inventory.entity_categories.begin(), inventory.entity_categories.end(),
      [](const LocalOiDataInventoryEntry& entry) {
        return entry.entity_type == LocalOiEntityType::kEndpoint;
      });
  ASSERT_NE(inventory.entity_categories.end(), endpoints);
  EXPECT_EQ(2u, endpoints->record_count);
  const auto missions = std::find_if(
      inventory.entity_categories.begin(), inventory.entity_categories.end(),
      [](const LocalOiDataInventoryEntry& entry) {
        return entry.entity_type == LocalOiEntityType::kMission;
      });
  ASSERT_NE(inventory.entity_categories.end(), missions);
  EXPECT_EQ(1u, missions->record_count);
}

TEST_F(MissionServiceTest,
       LocalOiAssistPromptRequiresExplicitBoundedLocalRecords) {
  LocalOiSnapshot snapshot;
  const std::string first_id = NewLocalOiId();
  const std::string second_id = NewLocalOiId();
  snapshot.entities.push_back({first_id, first_id, "finding",
                               "Certificate finding",
                               "The explicit local TLS probe needs review.",
                               "1", "certificate tls finding"});
  snapshot.entities.push_back({second_id, first_id, "endpoint",
                               "Public endpoint", "Configured locally.", "2",
                               "endpoint public"});

  LocalOiAssistRequest request;
  request.operation = LocalOiAssistOperation::kDraftChecklist;
  request.selected_record_ids = {first_id, second_id};
  const std::optional<LocalOiAssistPrompt> prompt =
      PrepareLocalOiAssistPrompt(snapshot, request);
  ASSERT_TRUE(prompt.has_value());
  EXPECT_EQ(LocalOiAssistOperation::kDraftChecklist, prompt->operation);
  ASSERT_EQ(2u, prompt->selected_records.size());
  EXPECT_EQ("finding", prompt->selected_records[0].kind);
  EXPECT_EQ("Certificate finding", prompt->selected_records[0].label);
  EXPECT_EQ("The explicit local TLS probe needs review.",
            prompt->selected_records[0].detail);
  EXPECT_EQ(LocalOiAssistOperation::kDraftSanitizedHandoff,
            LocalOiAssistOperationFromString("draft-sanitized-handoff"));
  EXPECT_FALSE(LocalOiAssistOperationFromString("navigate-page"));
  EXPECT_EQ("Draft checklist", LocalOiAssistOperationLabel(
                                   LocalOiAssistOperation::kDraftChecklist));

  const std::optional<LocalOiDeterministicBrief> checklist =
      BuildLocalOiDeterministicBrief(*prompt);
  ASSERT_TRUE(checklist);
  EXPECT_EQ("Deterministic local review checklist", checklist->title);
  EXPECT_TRUE(base::Contains(checklist->lines[1], "Certificate finding"));
  EXPECT_TRUE(base::Contains(checklist->lines[1], "performs no operation") ||
              base::Contains(checklist->lines[0], "performs no operation"));

  LocalOiAssistPrompt handoff_prompt = *prompt;
  handoff_prompt.operation = LocalOiAssistOperation::kDraftSanitizedHandoff;
  const std::optional<LocalOiDeterministicBrief> handoff =
      BuildLocalOiDeterministicBrief(handoff_prompt);
  ASSERT_TRUE(handoff);
  EXPECT_EQ("Deterministic sanitized handoff scope", handoff->title);
  ASSERT_EQ(3u, handoff->lines.size());
  EXPECT_FALSE(base::Contains(handoff->lines[0], "Certificate finding"));
  EXPECT_FALSE(base::Contains(handoff->lines[0], "Configured locally."));

  LocalOiAssistPrompt invalid_brief = *prompt;
  invalid_brief.selected_records[0].label = "unsafe\nlabel";
  EXPECT_FALSE(BuildLocalOiDeterministicBrief(invalid_brief));
  invalid_brief = *prompt;
  for (size_t index = invalid_brief.selected_records.size(); index < 9u;
       ++index) {
    invalid_brief.selected_records.push_back(prompt->selected_records.front());
  }
  EXPECT_FALSE(BuildLocalOiDeterministicBrief(invalid_brief));

  const std::string finding_id = NewLocalOiId();
  snapshot.findings.push_back(
      {finding_id, first_id, "Private mission", LocalOiSeverity::kAttention,
       LocalOiFindingState::kOpen, false, "Actual Local OI finding",
       "Typed finding context.", "Review the typed evidence.", "3",
       "local rule basis"});
  request.operation = LocalOiAssistOperation::kExplainSelectedFindings;
  request.selected_record_ids = {finding_id};
  const std::optional<LocalOiAssistPrompt> finding_prompt =
      PrepareLocalOiAssistPrompt(snapshot, request);
  ASSERT_TRUE(finding_prompt);
  ASSERT_EQ(1u, finding_prompt->selected_records.size());
  EXPECT_EQ("finding", finding_prompt->selected_records[0].kind);
  EXPECT_EQ("Actual Local OI finding",
            finding_prompt->selected_records[0].label);
  EXPECT_TRUE(base::Contains(finding_prompt->selected_records[0].detail,
                             "Typed finding context."));

  request.selected_record_ids = {first_id, first_id};
  EXPECT_FALSE(PrepareLocalOiAssistPrompt(snapshot, request));
  request.selected_record_ids.clear();
  for (size_t index = 0u; index < 9u; ++index) {
    request.selected_record_ids.push_back(NewLocalOiId());
  }
  EXPECT_FALSE(PrepareLocalOiAssistPrompt(snapshot, request));
}

TEST_F(MissionServiceTest, LocalOiAssistPromptIsGatedByLocalAiPolicy) {
  TahaiLocalOiService local_oi(&profile_);
  const std::string entity_id = NewLocalOiId();
  const std::string now = LocalOiNowTimestamp();
  LocalOiEntityRecord entity;
  entity.id = entity_id;
  entity.type = LocalOiEntityType::kEndpoint;
  entity.title = "Selected local endpoint";
  entity.summary = "Explicit local support metadata.";
  entity.source = LocalOiRecordSource::kExplicitUserEntry;
  entity.created_at = now;
  entity.updated_at = now;
  ASSERT_TRUE(local_oi.UpsertEntity(std::move(entity)));

  LocalOiAssistRequest request;
  request.operation = LocalOiAssistOperation::kSummarizeSelectedRecords;
  request.selected_record_ids = {entity_id};
  profile_.GetPrefs()->SetBoolean(prefs::kTahaiLocalOiEnabled, true);
  profile_.GetPrefs()->SetBoolean(prefs::kTahaiLocalOiLocalAiEnabled, false);
  EXPECT_FALSE(local_oi.PrepareLocalAssistPrompt(request));
  const std::optional<LocalOiDeterministicBrief> deterministic_brief =
      local_oi.BuildDeterministicLocalBrief(request);
  ASSERT_TRUE(deterministic_brief);
  EXPECT_EQ("Deterministic Local OI summary", deterministic_brief->title);
  EXPECT_TRUE(
      base::Contains(deterministic_brief->lines[1], "Selected local endpoint"));

  profile_.GetPrefs()->SetBoolean(prefs::kTahaiLocalOiLocalAiEnabled, true);
  const std::optional<LocalOiAssistPrompt> prompt =
      local_oi.PrepareLocalAssistPrompt(request);
  ASSERT_TRUE(prompt.has_value());
  ASSERT_EQ(1u, prompt->selected_records.size());
  EXPECT_EQ("Selected local endpoint", prompt->selected_records[0].label);
}

TEST_F(MissionServiceTest,
       LocalOiPromotionUsesFixedReferralAndNeverEnablesUpload) {
  MissionService service(&profile_);
  const auto mission = service.CreateMission("Private mission", "incident");
  ASSERT_TRUE(mission.has_value());
  const LocalOiSnapshot snapshot = BuildLocalOiSnapshot(LocalOiStoreData());
  const TahaiOiPromotionPreview preview =
      BuildTahaiOiPromotionPreview(snapshot);

  EXPECT_TRUE(preview.explicit_approval_required);
  EXPECT_TRUE(preview.title_redacted);
  EXPECT_TRUE(preview.browsing_data_excluded);
  EXPECT_FALSE(preview.hosted_upload_available);
  EXPECT_FALSE(IsTahaiOiHostedPromotionAvailable());
  EXPECT_EQ(0u, preview.mission_count);
  EXPECT_EQ(0u, preview.opaque_oi_reference_count);
  EXPECT_EQ(0u, preview.scale_signal_count);
  // A browser-local OI surface must not present an external navigation until
  // the profile owner explicitly enables it (or policy governs that choice).
  EXPECT_FALSE(
      GetTahaiOiPromotionSurfaceState(profile_.GetPrefs()).show_referral);
  EXPECT_FALSE(GetTahaiOiPromotionSurfaceState(profile_.GetPrefs()).is_managed);
  EXPECT_TRUE(SetTahaiOiMspPromotionEnabled(profile_.GetPrefs(), true));
  EXPECT_TRUE(
      GetTahaiOiPromotionSurfaceState(profile_.GetPrefs()).show_referral);
  EXPECT_TRUE(SetTahaiOiMspPromotionEnabled(profile_.GetPrefs(), false));
  EXPECT_FALSE(
      GetTahaiOiPromotionSurfaceState(profile_.GetPrefs()).show_referral);
  EXPECT_EQ(
      "https://ops.tahaiportal.com/?utm_source=tahai_browser&"
      "utm_medium=in_product&utm_campaign=local_oi_to_msp&"
      "utm_content=knowledge_gap",
      TahaiOiMspReferralUrl(TahaiOiReferralContext::kKnowledgeGap).spec());
  EXPECT_EQ(
      "https://ops.tahaiportal.com/?utm_source=tahai_browser&"
      "utm_medium=in_product&utm_campaign=local_oi_to_msp&"
      "utm_content=team_assignment",
      TahaiOiMspReferralUrl(TahaiOiReferralContext::kTeamCoordination).spec());
  EXPECT_TRUE(IsValidTahaiOiOpaqueReference("oi_a9b3c8d2"));
  EXPECT_FALSE(IsValidTahaiOiOpaqueReference("tenant-secret"));
  EXPECT_TRUE(IsValidTahaiOiHostedDeepLink(
      GURL("https://ops.tahaiportal.com/oi/mission/opaque-reference")));
  EXPECT_FALSE(IsValidTahaiOiHostedDeepLink(
      GURL("https://ops.tahaiportal.com/oi/mission?token=secret")));
  EXPECT_EQ("Local AI not configured. Local OI uses deterministic rules only.",
            GetLocalOiAssistPosture().status);
  EXPECT_FALSE(GetLocalOiAssistPosture().remote_model_permitted);
  EXPECT_FALSE(GetLocalOiAssistPosture().may_read_raw_browser_content);
  EXPECT_FALSE(GetLocalOiAssistPosture().may_execute_actions);
  const std::string report = BuildLocalOiSafeReport(snapshot);
  EXPECT_TRUE(base::Contains(report, "TAHAI Local OI Mission Health Summary"));
  EXPECT_FALSE(base::Contains(report, "Private mission"));
  EXPECT_FALSE(base::Contains(report, mission->id));
}

TEST_F(MissionServiceTest,
       RestoresOnlyValidatedInertOpaqueOperationalIntelligenceLinks) {
  const auto make_mission = [](std::string_view title) {
    base::DictValue mission;
    mission.Set("id", base::Uuid::GenerateRandomV4().AsLowercaseString());
    mission.Set("title", std::string(title));
    mission.Set("type", "audit");
    mission.Set("created_at", "1");
    return mission;
  };

  base::DictValue valid = make_mission("Safe local record");
  base::DictValue valid_oi;
  valid_oi.Set("opaque_reference", "oi_a9b3c8d2");
  valid_oi.Set("hosted_deep_link",
               "https://ops.tahaiportal.com/oi/mission/opaque-reference");
  base::DictValue valid_links;
  valid_links.Set("oi", std::move(valid_oi));
  valid.Set("links", std::move(valid_links));

  base::DictValue rejected = make_mission("Rejected hosted record");
  base::DictValue rejected_oi;
  rejected_oi.Set("opaque_reference", "oi_a9b3c8d2");
  rejected_oi.Set("hosted_deep_link",
                  "https://ops.tahaiportal.com/oi/mission?token=secret");
  base::DictValue rejected_links;
  rejected_links.Set("oi", std::move(rejected_oi));
  rejected.Set("links", std::move(rejected_links));

  base::ListValue stored_missions;
  stored_missions.Append(std::move(valid));
  stored_missions.Append(std::move(rejected));
  profile_.GetPrefs()->SetList(prefs::kTahaiMissions,
                               std::move(stored_missions));

  MissionService service(&profile_);
  ASSERT_EQ(2u, service.missions().size());
  ASSERT_TRUE(service.missions()[0].oi_link.has_value());
  EXPECT_EQ("oi_a9b3c8d2", service.missions()[0].oi_link->opaque_reference);
  EXPECT_EQ("https://ops.tahaiportal.com/oi/mission/opaque-reference",
            service.missions()[0].oi_link->hosted_deep_link.spec());
  EXPECT_FALSE(service.missions()[1].oi_link.has_value());
  const LocalOiSnapshot snapshot = BuildLocalOiSnapshot(LocalOiStoreData());
  EXPECT_EQ(0u, snapshot.opaque_oi_reference_count);
  EXPECT_EQ(0u, snapshot.relationship_entity_count);
  EXPECT_TRUE(SearchLocalOiSnapshot(snapshot, "oi_a9b3c8d2").empty());
  EXPECT_FALSE(base::Contains(BuildLocalOiSafeReport(snapshot), "oi_a9b3c8d2"));

  // A normal local Mission update serializes the valid opaque metadata and
  // drops the rejected payload. No action opens or uploads either reference.
  EXPECT_TRUE(service.ToggleStep(service.missions()[0].id, 0u));
  MissionService reloaded(&profile_);
  ASSERT_EQ(2u, reloaded.missions().size());
  ASSERT_TRUE(reloaded.missions()[0].oi_link.has_value());
  EXPECT_EQ("oi_a9b3c8d2", reloaded.missions()[0].oi_link->opaque_reference);
  EXPECT_FALSE(reloaded.missions()[1].oi_link.has_value());
}

}  // namespace
}  // namespace tahai
