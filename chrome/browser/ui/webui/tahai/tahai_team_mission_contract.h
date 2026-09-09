// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_TEAM_MISSION_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_TEAM_MISSION_CONTRACT_H_

#include <optional>
#include <string_view>

namespace tahai {

// Team Mission roles are finite local workflow labels, not identities, account
// bindings, presence records, or permissions. A role is never a reason to read
// another Chromium Profile or to share a Mission outside this device.
enum class TahaiLocalMissionRole {
  kCoordinator,
  kOperator,
  kReviewer,
  kObserver,
};

std::string_view TahaiLocalMissionRoleName(TahaiLocalMissionRole role);
std::optional<TahaiLocalMissionRole> TahaiLocalMissionRoleFromName(
    std::string_view name);

// This closed permission table exists before any Team Mission or War Room UI
// is wired. It prevents a future presentation layer from turning a local role
// label into remote collaboration, cross-profile access, or window control.
enum class TahaiTeamMissionOperation {
  kAssignLocalRole,
  kRecordLocalRoleHandoff,
  kPrepareLocalWarRoom,
  kInviteRemoteParticipant,
  kResolveExternalIdentity,
  kPublishPresence,
  kNetworkSync,
  kReadAnotherProfile,
  kShareClipboard,
  kMoveAnotherBrowserWindow,
  kControlAnotherBrowserWindow,
};

enum class TahaiTeamMissionPermission {
  kLocalOnlyAllowed,
  kDenied,
};

TahaiTeamMissionPermission GetTahaiTeamMissionPermission(
    TahaiTeamMissionOperation operation);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_TEAM_MISSION_CONTRACT_H_
