// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_environment_guard.h"

#include <optional>

#include "base/check.h"
#include "base/notreached.h"
#include "url/gurl.h"
#include "url/origin.h"

namespace tahai {
namespace {

constexpr TahaiEnvironmentPosture kProductionPosture = {
    TahaiEnvironment::kProduction, "Production", true, true, true, true, true};
constexpr TahaiEnvironmentPosture kStagingPosture = {
    TahaiEnvironment::kStaging, "Staging", true, false, false, false, true};
constexpr TahaiEnvironmentPosture kDevelopmentPosture = {
    TahaiEnvironment::kDevelopment,
    "Development",
    true,
    false,
    false,
    false,
    false};
constexpr TahaiEnvironmentPosture kCustomerPosture = {
    TahaiEnvironment::kCustomer, "Customer", true, true, true, true, true};
constexpr TahaiEnvironmentPosture kInternalPosture = {
    TahaiEnvironment::kInternal, "Internal", true, false, true, true, true};
constexpr TahaiEnvironmentPosture kSensitivePosture = {
    TahaiEnvironment::kSensitive, "Sensitive", true, true, true, true, true};

}  // namespace

std::string_view TahaiEnvironmentName(TahaiEnvironment environment) {
  switch (environment) {
    case TahaiEnvironment::kProduction:
      return "production";
    case TahaiEnvironment::kStaging:
      return "staging";
    case TahaiEnvironment::kDevelopment:
      return "development";
    case TahaiEnvironment::kCustomer:
      return "customer";
    case TahaiEnvironment::kInternal:
      return "internal";
    case TahaiEnvironment::kSensitive:
      return "sensitive";
  }
  NOTREACHED();
}

std::optional<TahaiEnvironment> TahaiEnvironmentFromName(
    std::string_view name) {
  if (name == "production") {
    return TahaiEnvironment::kProduction;
  }
  if (name == "staging") {
    return TahaiEnvironment::kStaging;
  }
  if (name == "development") {
    return TahaiEnvironment::kDevelopment;
  }
  if (name == "customer") {
    return TahaiEnvironment::kCustomer;
  }
  if (name == "internal") {
    return TahaiEnvironment::kInternal;
  }
  if (name == "sensitive") {
    return TahaiEnvironment::kSensitive;
  }
  return std::nullopt;
}

const TahaiEnvironmentPosture& GetTahaiEnvironmentPosture(
    TahaiEnvironment environment) {
  switch (environment) {
    case TahaiEnvironment::kProduction:
      return kProductionPosture;
    case TahaiEnvironment::kStaging:
      return kStagingPosture;
    case TahaiEnvironment::kDevelopment:
      return kDevelopmentPosture;
    case TahaiEnvironment::kCustomer:
      return kCustomerPosture;
    case TahaiEnvironment::kInternal:
      return kInternalPosture;
    case TahaiEnvironment::kSensitive:
      return kSensitivePosture;
  }
  NOTREACHED();
}

TahaiEnvironmentGuardDecision EvaluateTahaiEnvironmentAction(
    TahaiEnvironment environment,
    TahaiEnvironmentAction action) {
  const TahaiEnvironmentPosture& posture =
      GetTahaiEnvironmentPosture(environment);
  TahaiEnvironmentGuardDecision decision = {
      .allowed = true,
      .require_confirmation = false,
      .require_redaction_preview = false,
      .show_persistent_boundary = posture.show_persistent_boundary,
      .reason = "The classified environment permits this operation.",
  };
  switch (action) {
    case TahaiEnvironmentAction::kNavigate:
      return decision;
    case TahaiEnvironmentAction::kMultilinePaste:
      decision.require_confirmation = posture.confirm_multiline_paste;
      decision.reason = posture.confirm_multiline_paste
                            ? "Multiline paste requires operator confirmation."
                            : "Multiline paste is permitted by this posture.";
      return decision;
    case TahaiEnvironmentAction::kDownload:
    case TahaiEnvironmentAction::kUpload:
      decision.require_confirmation = posture.warn_on_download_or_upload;
      decision.reason = posture.warn_on_download_or_upload
                            ? "File transfer requires operator confirmation."
                            : "File transfer is permitted by this posture.";
      return decision;
    case TahaiEnvironmentAction::kClipboardExport:
      decision.require_redaction_preview = posture.require_redaction_preview;
      decision.reason = posture.require_redaction_preview
                            ? "Clipboard export requires a redaction preview."
                            : "Clipboard export is permitted by this posture.";
      return decision;
    case TahaiEnvironmentAction::kPilotAction:
      decision.allowed = !posture.block_pilot_actions;
      decision.reason = posture.block_pilot_actions
                            ? "Pilot actions are blocked in this environment."
                            : "Pilot actions are permitted by this posture.";
      return decision;
  }
  NOTREACHED();
}

bool IsTahaiEnvironmentReviewEscalated(
    const TahaiEnvironmentGuardDecision& previous,
    const TahaiEnvironmentGuardDecision& current) {
  return (!previous.require_confirmation && current.require_confirmation) ||
         (!previous.require_redaction_preview &&
          current.require_redaction_preview);
}

TahaiEnvironmentTransferDecision EvaluateTahaiEnvironmentTransfer(
    TahaiEnvironment source,
    TahaiEnvironment destination) {
  if (source == destination) {
    return {.allowed = true,
            .require_confirmation = false,
            .require_redaction_preview = false,
            .reason = "The transfer remains inside one classified boundary."};
  }

  const TahaiEnvironmentPosture& destination_posture =
      GetTahaiEnvironmentPosture(destination);
  const bool protected_destination =
      destination == TahaiEnvironment::kProduction ||
      destination == TahaiEnvironment::kCustomer ||
      destination == TahaiEnvironment::kInternal ||
      destination == TahaiEnvironment::kSensitive;
  return {
      .allowed = true,
      .require_confirmation = protected_destination,
      .require_redaction_preview =
          destination_posture.require_redaction_preview,
      .reason = protected_destination
                    ? "Cross-environment transfer requires explicit review."
                    : "Cross-environment transfer is permitted by the "
                      "destination posture.",
  };
}

TahaiEnvironmentRuleValidationResult ValidateTahaiEnvironmentRuleOrigin(
    std::string_view origin,
    std::string* canonical_origin) {
  if (!canonical_origin) {
    return TahaiEnvironmentRuleValidationResult::kInvalidOrigin;
  }
  canonical_origin->clear();
  GURL url{std::string(origin)};
  if (!url.is_valid() || !url.SchemeIs("https") || !url.has_host() ||
      url.has_username() || url.has_password() || url.has_query() ||
      url.has_ref() || url.path() != "/" ||
      url::Origin::Create(url).GetURL() != url) {
    return TahaiEnvironmentRuleValidationResult::kInvalidOrigin;
  }
  *canonical_origin = url.spec();
  return TahaiEnvironmentRuleValidationResult::kValid;
}

}  // namespace tahai
