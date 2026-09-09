// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_team_mission_contract.h"

namespace tahai {

std::string_view TahaiLocalMissionRoleName(TahaiLocalMissionRole role) {
  switch (role) {
    case TahaiLocalMissionRole::kCoordinator:
      return "coordinator";
    case TahaiLocalMissionRole::kOperator:
      return "operator";
    case TahaiLocalMissionRole::kReviewer:
      return "reviewer";
    case TahaiLocalMissionRole::kObserver:
      return "observer";
  }
  return {};
}

std::optional<TahaiLocalMissionRole> TahaiLocalMissionRoleFromName(
    std::string_view name) {
  if (name == "coordinator") {
    return TahaiLocalMissionRole::kCoordinator;
  }
  if (name == "operator") {
    return TahaiLocalMissionRole::kOperator;
  }
  if (name == "reviewer") {
    return TahaiLocalMissionRole::kReviewer;
  }
  if (name == "observer") {
    return TahaiLocalMissionRole::kObserver;
  }
  return std::nullopt;
}

TahaiTeamMissionPermission GetTahaiTeamMissionPermission(
    TahaiTeamMissionOperation operation) {
  switch (operation) {
    case TahaiTeamMissionOperation::kAssignLocalRole:
    case TahaiTeamMissionOperation::kRecordLocalRoleHandoff:
    case TahaiTeamMissionOperation::kPrepareLocalWarRoom:
      return TahaiTeamMissionPermission::kLocalOnlyAllowed;
    case TahaiTeamMissionOperation::kInviteRemoteParticipant:
    case TahaiTeamMissionOperation::kResolveExternalIdentity:
    case TahaiTeamMissionOperation::kPublishPresence:
    case TahaiTeamMissionOperation::kNetworkSync:
    case TahaiTeamMissionOperation::kReadAnotherProfile:
    case TahaiTeamMissionOperation::kShareClipboard:
    case TahaiTeamMissionOperation::kMoveAnotherBrowserWindow:
    case TahaiTeamMissionOperation::kControlAnotherBrowserWindow:
      return TahaiTeamMissionPermission::kDenied;
  }
  return TahaiTeamMissionPermission::kDenied;
}

}  // namespace tahai
