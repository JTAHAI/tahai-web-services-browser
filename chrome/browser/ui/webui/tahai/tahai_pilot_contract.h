// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PILOT_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PILOT_CONTRACT_H_

#include <string_view>

namespace tahai {

// This contract constrains a future TAHAI Pilot integration before any model
// provider is connected. It intentionally makes every unspecified action
// unavailable, so a new capability cannot inherit write authority by default.
enum class TahaiPilotAction {
  kSummarizeSelectedPane,
  kCompareSelectedPanes,
  kDraftValidationChecklist,
  kDraftSanitizedHandoff,
  kPrepareActionPlan,
  kNavigateApprovedDestination,
  kFillForm,
  kClickPageControl,
  kUploadFile,
  kDownloadFile,
  kReadPasswordField,
  kReadMfaField,
  kReadCookies,
  kReadSessionToken,
  kRunShellCommand,
};

enum class TahaiPilotScope {
  kNoScope,
  kSelectedTabs,
  kMission,
};

enum class TahaiPilotPermission {
  kDenied,
  kReadOnlyAllowed,
  kRequiresExplicitApproval,
};

// Returns the fixed minimum permission for an action in its declared scope.
// `kRequiresExplicitApproval` is not an authorization result: the caller must
// still present a plan, request a just-in-time user approval, honor policy,
// and write a safe audit event before acting.
TahaiPilotPermission GetTahaiPilotPermission(TahaiPilotAction action,
                                             TahaiPilotScope scope);

std::string_view GetTahaiPilotPermissionDescription(
    TahaiPilotPermission permission);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PILOT_CONTRACT_H_
