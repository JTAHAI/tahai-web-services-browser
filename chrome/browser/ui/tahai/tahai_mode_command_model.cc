// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"

#include <array>

#include "chrome/app/chrome_command_ids.h"

namespace tahai {
namespace {

constexpr std::array<ModeCommandAction, 2> kDailyToolbarPrimary = {{
    {IDC_TAHAI_NAMED_WORKSPACES, u"Open saved workspace"},
    {IDC_TAHAI_PROFILES, u"Manage profiles"},
}};
constexpr std::array<ModeCommandAction, 2> kDailyToolbarSecondary = {{
    {IDC_TAHAI_WORK_MODES, u"Switch work mode"},
    {IDC_TAHAI_PROFILES, u"Manage profiles"},
}};
constexpr std::array<ModeCommandAction, 3> kDailyAppMenu = {{
    {IDC_TAHAI_NAMED_WORKSPACES, u"Saved workspace"},
    {IDC_TAHAI_WORK_MODES, u"Choose work mode"},
    {IDC_TAHAI_PROFILES, u"Profiles"},
}};

constexpr std::array<ModeCommandAction, 2> kCreatorToolbarPrimary = {{
    {IDC_TAHAI_COMMAND_CENTER, u"Open creator workspace"},
    {IDC_TAHAI_LAUNCHPAD, u"Open creative launchpad"},
}};
constexpr std::array<ModeCommandAction, 2> kCreatorToolbarSecondary = {{
    {IDC_TAHAI_WORK_MODES, u"Switch work mode"},
    {IDC_TAHAI_COMMAND_CENTER, u"Open Command Center"},
}};
constexpr std::array<ModeCommandAction, 3> kCreatorAppMenu = {{
    {IDC_TAHAI_COMMAND_CENTER, u"Creator workspace"},
    {IDC_TAHAI_LAUNCHPAD, u"Creative launchpad"},
    {IDC_TAHAI_WORK_MODES, u"Choose work mode"},
}};

constexpr std::array<ModeCommandAction, 2> kBuilderToolbarPrimary = {{
    {IDC_TAHAI_COMMAND_CENTER, u"Open build workspace"},
    {IDC_TAHAI_MISSION_CONTROL, u"Open build runbook"},
}};
constexpr std::array<ModeCommandAction, 2> kBuilderToolbarSecondary = {{
    {IDC_TAHAI_WORK_MODES, u"Switch work mode"},
    {IDC_TAHAI_LOCAL_OI, u"Open local change intelligence"},
}};
constexpr std::array<ModeCommandAction, 4> kBuilderAppMenu = {{
    {IDC_TAHAI_COMMAND_CENTER, u"Build workspace"},
    {IDC_TAHAI_MISSION_CONTROL, u"Build runbook"},
    {IDC_TAHAI_LOCAL_OI, u"Local change intelligence"},
    {IDC_TAHAI_WORK_MODES, u"Choose work mode"},
}};

constexpr std::array<ModeCommandAction, 2> kOperatorToolbarPrimary = {{
    {IDC_TAHAI_MISSION_CONTROL, u"Open Mission Control"},
    {IDC_TAHAI_COMMAND_CENTER, u"Open operational workspace"},
}};
constexpr std::array<ModeCommandAction, 2> kOperatorToolbarSecondary = {{
    {IDC_TAHAI_LOCAL_OI, u"Open local operational intelligence"},
    {IDC_TAHAI_WORK_MODES, u"Switch work mode"},
}};
constexpr std::array<ModeCommandAction, 5> kOperatorAppMenu = {{
    {IDC_TAHAI_MISSION_CONTROL, u"Mission Control"},
    {IDC_TAHAI_LOCAL_OI, u"Local operational intelligence"},
    {IDC_TAHAI_COMMAND_CENTER, u"Operational workspace"},
    {IDC_TAHAI_SUPPORT, u"Support"},
    {IDC_TAHAI_WORK_MODES, u"Choose work mode"},
}};

constexpr std::array<ModeCommandAction, 2> kResearchToolbarPrimary = {{
    {IDC_TAHAI_LAUNCHPAD, u"Open research workspace"},
    {IDC_TAHAI_COMMAND_CENTER, u"Open source workspace"},
}};
constexpr std::array<ModeCommandAction, 2> kResearchToolbarSecondary = {{
    {IDC_TAHAI_WORK_MODES, u"Switch work mode"},
    {IDC_TAHAI_PROFILES, u"Manage profiles"},
}};
constexpr std::array<ModeCommandAction, 3> kResearchAppMenu = {{
    {IDC_TAHAI_LAUNCHPAD, u"Research workspace"},
    {IDC_TAHAI_COMMAND_CENTER, u"Source workspace"},
    {IDC_TAHAI_WORK_MODES, u"Choose work mode"},
}};

constexpr std::array<ModeCommandAction, 2> kSupportToolbarPrimary = {{
    {IDC_TAHAI_SUPPORT, u"Open support workspace"},
    {IDC_TAHAI_MISSION_CONTROL, u"Open case runbook"},
}};
constexpr std::array<ModeCommandAction, 2> kSupportToolbarSecondary = {{
    {IDC_TAHAI_LOCAL_OI, u"Open local case intelligence"},
    {IDC_TAHAI_POLICY, u"Open privacy and policy"},
}};
constexpr std::array<ModeCommandAction, 5> kSupportAppMenu = {{
    {IDC_TAHAI_SUPPORT, u"Support workspace"},
    {IDC_TAHAI_MISSION_CONTROL, u"Case runbook"},
    {IDC_TAHAI_LOCAL_OI, u"Local case intelligence"},
    {IDC_TAHAI_POLICY, u"Privacy and policy"},
    {IDC_TAHAI_WORK_MODES, u"Choose work mode"},
}};

template <size_t PrimarySize, size_t SecondarySize, size_t AppMenuSize>
ModeCommandGroup MakeGroup(
    const std::array<ModeCommandAction, PrimarySize>& toolbar_primary,
    const std::array<ModeCommandAction, SecondarySize>& toolbar_secondary,
    const std::array<ModeCommandAction, AppMenuSize>& app_menu) {
  return {toolbar_primary, toolbar_secondary, app_menu};
}

}  // namespace

ModeCommandGroup GetModeCommandGroup(std::string_view mode_id) {
  if (mode_id == "daily") {
    return MakeGroup(kDailyToolbarPrimary, kDailyToolbarSecondary,
                     kDailyAppMenu);
  }
  if (mode_id == "creator") {
    return MakeGroup(kCreatorToolbarPrimary, kCreatorToolbarSecondary,
                     kCreatorAppMenu);
  }
  if (mode_id == "builder") {
    return MakeGroup(kBuilderToolbarPrimary, kBuilderToolbarSecondary,
                     kBuilderAppMenu);
  }
  if (mode_id == "operator") {
    return MakeGroup(kOperatorToolbarPrimary, kOperatorToolbarSecondary,
                     kOperatorAppMenu);
  }
  if (mode_id == "research") {
    return MakeGroup(kResearchToolbarPrimary, kResearchToolbarSecondary,
                     kResearchAppMenu);
  }
  return MakeGroup(kSupportToolbarPrimary, kSupportToolbarSecondary,
                   kSupportAppMenu);
}

}  // namespace tahai
