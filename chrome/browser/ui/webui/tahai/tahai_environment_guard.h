// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_ENVIRONMENT_GUARD_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_ENVIRONMENT_GUARD_H_

#include <optional>
#include <string>
#include <string_view>

namespace tahai {

// A deterministic environment classification. A future environment guard must
// match only explicit user or managed-policy rules; it must never inspect a
// page and guess whether a button is destructive.
enum class TahaiEnvironment {
  kProduction,
  kStaging,
  kDevelopment,
  kCustomer,
  kInternal,
  kSensitive,
};

std::string_view TahaiEnvironmentName(TahaiEnvironment environment);
std::optional<TahaiEnvironment> TahaiEnvironmentFromName(std::string_view name);

struct TahaiEnvironmentPosture {
  TahaiEnvironment environment;
  std::string_view label;
  bool show_persistent_boundary;
  bool confirm_multiline_paste;
  bool warn_on_download_or_upload;
  bool require_redaction_preview;
  bool block_pilot_actions;
};

// Security-sensitive browser operations are reduced to this finite vocabulary
// before the native UI asks the guard for a decision. The guard never accepts
// a URL, script, command name, or page-supplied action.
enum class TahaiEnvironmentAction {
  kNavigate,
  kMultilinePaste,
  kDownload,
  kUpload,
  kClipboardExport,
  kPilotAction,
};

// A decision is deliberately richer than an allow/block boolean so native
// call sites cannot silently collapse a required confirmation or redaction
// preview into an allow. `allowed` is false only for an unconditional block.
struct TahaiEnvironmentGuardDecision {
  bool allowed;
  bool require_confirmation;
  bool require_redaction_preview;
  bool show_persistent_boundary;
  std::string_view reason;
};

struct TahaiEnvironmentTransferDecision {
  bool allowed;
  bool require_confirmation;
  bool require_redaction_preview;
  std::string_view reason;
};

enum class TahaiEnvironmentRuleValidationResult {
  kValid,
  kInvalidOrigin,
  kDisallowedOrigin,
};

const TahaiEnvironmentPosture& GetTahaiEnvironmentPosture(
    TahaiEnvironment environment);

TahaiEnvironmentGuardDecision EvaluateTahaiEnvironmentAction(
    TahaiEnvironment environment,
    TahaiEnvironmentAction action);

// Returns true when a decision re-check introduces a review requirement that
// was not shown to the operator's previous review. Callers must still handle
// an unconditional block separately.
bool IsTahaiEnvironmentReviewEscalated(
    const TahaiEnvironmentGuardDecision& previous,
    const TahaiEnvironmentGuardDecision& current);

// Evaluates an operator-initiated transfer between two explicitly classified
// origins. Crossing a boundary into Production, Customer, Internal, or
// Sensitive always requires confirmation; the strict destinations also
// require a redaction preview. Same-environment movement remains allowed.
TahaiEnvironmentTransferDecision EvaluateTahaiEnvironmentTransfer(
    TahaiEnvironment source,
    TahaiEnvironment destination);

// Canonicalizes an exact HTTPS origin for a future profile-scoped rule. The
// rule vocabulary excludes wildcard hosts, paths, query strings, fragments,
// and user information. Private and internal HTTPS origins remain valid so an
// operator can classify their own intranet without a network side effect.
TahaiEnvironmentRuleValidationResult ValidateTahaiEnvironmentRuleOrigin(
    std::string_view origin,
    std::string* canonical_origin);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_ENVIRONMENT_GUARD_H_
