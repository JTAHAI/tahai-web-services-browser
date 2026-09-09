// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_pilot_contract.h"

namespace tahai {

TahaiPilotPermission GetTahaiPilotPermission(TahaiPilotAction action,
                                             TahaiPilotScope scope) {
  if (scope == TahaiPilotScope::kNoScope) {
    return TahaiPilotPermission::kDenied;
  }
  switch (action) {
    case TahaiPilotAction::kSummarizeSelectedPane:
    case TahaiPilotAction::kCompareSelectedPanes:
      // These actions are bound to a visible operator selection. A Mission
      // scope is not an implicit substitute for a selected browser context.
      return scope == TahaiPilotScope::kSelectedTabs
                 ? TahaiPilotPermission::kReadOnlyAllowed
                 : TahaiPilotPermission::kDenied;
    case TahaiPilotAction::kDraftValidationChecklist:
    case TahaiPilotAction::kDraftSanitizedHandoff:
    case TahaiPilotAction::kPrepareActionPlan:
      // Mission drafting operates over bounded local Mission context, never
      // over an arbitrary selected tab or a broader browser-data scope.
      return scope == TahaiPilotScope::kMission
                 ? TahaiPilotPermission::kReadOnlyAllowed
                 : TahaiPilotPermission::kDenied;
    case TahaiPilotAction::kNavigateApprovedDestination:
      // Navigation can change server-side state through an authenticated
      // session, so it is never grouped with read-only analysis.
      return scope == TahaiPilotScope::kMission
                 ? TahaiPilotPermission::kRequiresExplicitApproval
                 : TahaiPilotPermission::kDenied;
    case TahaiPilotAction::kFillForm:
    case TahaiPilotAction::kClickPageControl:
    case TahaiPilotAction::kUploadFile:
    case TahaiPilotAction::kDownloadFile:
    case TahaiPilotAction::kReadPasswordField:
    case TahaiPilotAction::kReadMfaField:
    case TahaiPilotAction::kReadCookies:
    case TahaiPilotAction::kReadSessionToken:
    case TahaiPilotAction::kRunShellCommand:
      return TahaiPilotPermission::kDenied;
  }
  return TahaiPilotPermission::kDenied;
}

std::string_view GetTahaiPilotPermissionDescription(
    TahaiPilotPermission permission) {
  switch (permission) {
    case TahaiPilotPermission::kDenied:
      return "Blocked by the TAHAI Pilot permission contract.";
    case TahaiPilotPermission::kReadOnlyAllowed:
      return "Read-only and limited to the explicit selected-tab or Mission "
             "scope.";
    case TahaiPilotPermission::kRequiresExplicitApproval:
      return "Requires a previewed plan and just-in-time user approval.";
  }
  return "Blocked by the TAHAI Pilot permission contract.";
}

}  // namespace tahai
