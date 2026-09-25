// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_operational_skin_controller.h"

#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

TEST(TahaiOperationalSkinControllerTest, ResolvesOnlyTheFixedActionVocabulary) {
  EXPECT_EQ(IDC_TAHAI_MISSION_CONTROL,
            GetTahaiOperationalSkinCommand("mission.open"));
  EXPECT_EQ(IDC_TAHAI_QUAD_VIEW, GetTahaiOperationalSkinCommand("layout.quad"));
  EXPECT_FALSE(GetTahaiOperationalSkinCommand("navigate.https://example.test"));
  EXPECT_FALSE(GetTahaiOperationalSkinCommand("native.run"));
}

TEST(TahaiOperationalSkinControllerTest,
     ActivationAppliesPresentationWithoutExecutingTheActionMenu) {
  TahaiOperationalSkinManifest manifest;
  manifest.capabilities = {TahaiOperationalCapability::kWorkspaceLayout,
                           TahaiOperationalCapability::kMissionChecklist,
                           TahaiOperationalCapability::kGuardControl,
                           TahaiOperationalCapability::kBrowserNavigation};
  manifest.surfaces.push_back({"research", TahaiOperationalSurfaceLayout::kQuad,
                               TahaiOperationalRailState::kIcons, "launchpad"});
  manifest.modes.push_back({"research",
                            "Research",
                            "research",
                            "workflow",
                            {"layout.one", "layout.focus", "mission.open",
                             "guard.open", "address.focus", "tabs.find"}});
  const auto activation =
      BuildTahaiOperationalSkinActivation(manifest, "research");
  ASSERT_TRUE(activation);
  ASSERT_EQ(3u, activation->command_ids.size());
  EXPECT_EQ(IDC_TAHAI_QUAD_VIEW, activation->command_ids[0]);
  EXPECT_EQ(IDC_TAHAI_RAIL_ICONS, activation->command_ids[1]);
  EXPECT_EQ(IDC_TAHAI_LAUNCHPAD, activation->command_ids[2]);
  EXPECT_FALSE(BuildTahaiOperationalSkinActivation(manifest, "missing"));
  const auto toolbar =
      BuildTahaiOperationalSkinToolbarActions(manifest, "research");
  ASSERT_TRUE(toolbar);
  ASSERT_EQ(6u, toolbar->command_ids.size());
  EXPECT_EQ(IDC_TAHAI_QUAD_EXIT, toolbar->command_ids[0]);
  manifest.modes[0].actions.push_back("native.run");
  EXPECT_FALSE(BuildTahaiOperationalSkinActivation(manifest, "research"));
}

TEST(TahaiOperationalSkinControllerTest,
     CustomModeUsesOnlyItsOperationalReference) {
  TahaiOperationalSkinManifest manifest;
  manifest.capabilities = {TahaiOperationalCapability::kWorkspaceLayout,
                           TahaiOperationalCapability::kMissionChecklist};
  manifest.surfaces.push_back({"surface", TahaiOperationalSurfaceLayout::kDual,
                               TahaiOperationalRailState::kIcons, "mission"});
  manifest.modes.push_back(
      {"research", "Research", "surface", "workflow", {}});
  TahaiCustomModeDefinition custom = {"my-research", "My Research",
                                      "research", "saved-workspace"};
  EXPECT_TRUE(BuildTahaiCustomModeActivation(manifest, custom).has_value());
  custom.operational_mode_id = "missing";
  EXPECT_FALSE(BuildTahaiCustomModeActivation(manifest, custom).has_value());
}

TEST(TahaiOperationalSkinControllerTest,
     ToolbarActionsExcludePresentationCommandsAndRemainAllowlisted) {
  TahaiOperationalSkinManifest manifest;
  manifest.capabilities = {TahaiOperationalCapability::kWorkspaceLayout,
                           TahaiOperationalCapability::kMissionChecklist,
                           TahaiOperationalCapability::kGuardControl};
  manifest.surfaces.push_back({"surface", TahaiOperationalSurfaceLayout::kQuad,
                               TahaiOperationalRailState::kExpanded,
                               "mission"});
  manifest.modes.push_back({"operations", "Operations", "surface",
                            "workflow",
                            {"mission.open", "guard.open", "mission.open"}});
  const auto toolbar =
      BuildTahaiOperationalSkinToolbarActions(manifest, "operations");
  ASSERT_TRUE(toolbar);
  ASSERT_EQ(2u, toolbar->command_ids.size());
  EXPECT_EQ(IDC_TAHAI_MISSION_CONTROL, toolbar->command_ids[0]);
  EXPECT_EQ(IDC_TAHAI_GUARD_PANEL, toolbar->command_ids[1]);
  EXPECT_FALSE(
      BuildTahaiOperationalSkinToolbarActions(manifest, "not-a-mode"));
  manifest.modes[0].actions = {"native.run"};
  EXPECT_FALSE(
      BuildTahaiOperationalSkinToolbarActions(manifest, "operations"));
}

TEST(TahaiOperationalSkinControllerTest,
     NativeResolutionRechecksEveryDeclaredCapability) {
  TahaiOperationalSkinManifest manifest;
  manifest.capabilities = {TahaiOperationalCapability::kWorkspaceLayout,
                           TahaiOperationalCapability::kMissionChecklist};
  manifest.surfaces.push_back({"surface", TahaiOperationalSurfaceLayout::kOne,
                               TahaiOperationalRailState::kIcons, "launchpad"});
  manifest.modes.push_back({"operations", "Operations", "surface", "workflow",
                            {"mission.open"}});
  EXPECT_TRUE(BuildTahaiOperationalSkinActivation(manifest, "operations"));
  EXPECT_TRUE(BuildTahaiOperationalSkinToolbarActions(manifest, "operations"));
  manifest.surfaces[0].rail_modules = {"guard"};
  EXPECT_FALSE(BuildTahaiOperationalSkinActivation(manifest, "operations"));
  manifest.capabilities.push_back(TahaiOperationalCapability::kGuardControl);
  EXPECT_TRUE(BuildTahaiOperationalSkinActivation(manifest, "operations"));
  manifest.modes[0].actions.push_back("address.focus");
  EXPECT_FALSE(BuildTahaiOperationalSkinActivation(manifest, "operations"));
  EXPECT_FALSE(BuildTahaiOperationalSkinToolbarActions(manifest, "operations"));
  manifest.capabilities.push_back(TahaiOperationalCapability::kBrowserNavigation);
  EXPECT_TRUE(BuildTahaiOperationalSkinActivation(manifest, "operations"));
  EXPECT_TRUE(BuildTahaiOperationalSkinToolbarActions(manifest, "operations"));
  manifest.modes[0].actions = {"layout.one"};
  manifest.capabilities = {TahaiOperationalCapability::kWorkspaceLayout};
  // Opening a bound workflow requires Mission even when it isn't a menu action.
  EXPECT_FALSE(BuildTahaiOperationalSkinActivation(manifest, "operations"));
  manifest.capabilities.clear();
  EXPECT_FALSE(BuildTahaiOperationalSkinToolbarActions(manifest, "operations"));
}

TEST(TahaiOperationalSkinControllerTest,
     OperationalToolbarLabelsAreClosedAndBrowserOwned) {
  const auto mission_label =
      GetOperationalCommandLabel(IDC_TAHAI_MISSION_CONTROL);
  ASSERT_TRUE(mission_label);
  EXPECT_EQ(u"Open Mission Control", *mission_label);
  const auto focus_label = GetOperationalCommandLabel(IDC_TAHAI_QUAD_FOCUS);
  ASSERT_TRUE(focus_label);
  EXPECT_EQ(u"Focus active pane", *focus_label);
  EXPECT_FALSE(GetOperationalCommandLabel(0));
}

}  // namespace
}  // namespace tahai
