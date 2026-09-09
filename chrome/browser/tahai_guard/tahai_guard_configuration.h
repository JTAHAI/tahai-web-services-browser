// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_GUARD_TAHAI_GUARD_CONFIGURATION_H_
#define CHROME_BROWSER_TAHAI_GUARD_TAHAI_GUARD_CONFIGURATION_H_

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/values.h"

class GURL;

namespace tahai {

// Persisted configuration vocabulary. The profile service enforces effective
// settings in both the network and document-bound cosmetic pipelines.
enum class TahaiGuardMode {
  kOff,
  kBalanced,
  kStrict,
  kCustom,
};

enum class TahaiGuardSiteOverrideMode {
  // Disables Guard network decisions for this exact top-level HTTPS origin. It
  // is a
  // persistent user exception and does not change browser permissions.
  kOff,
  // Retains network decisions but turns off declarative element hiding for
  // this exact top-level origin, including its embedded frames.
  kCosmeticOff,
};

struct TahaiGuardSiteOverride {
  std::string canonical_origin;
  TahaiGuardSiteOverrideMode mode;
};

struct TahaiGuardConfiguration {
  int schema_version = 1;
  TahaiGuardMode mode = TahaiGuardMode::kBalanced;
  // This is permission to retain aggregate, profile-local Guard
  // counters. It never permits URL, request body, cookie, or credential
  // collection.
  bool local_statistics_enabled = false;
  std::vector<TahaiGuardSiteOverride> site_overrides;
};

struct TahaiGuardEffectiveSettings {
  TahaiGuardMode network_mode = TahaiGuardMode::kOff;
  bool cosmetic_filtering_enabled = false;
  bool exact_site_override_applied = false;
};

enum class TahaiGuardConfigurationValidationResult {
  kValid,
  kUnknownField,
  kInvalidSchema,
  kInvalidMode,
  kInvalidStatisticsSetting,
  kInvalidSiteOverrides,
};

std::string_view TahaiGuardModeName(TahaiGuardMode mode);
std::optional<TahaiGuardMode> TahaiGuardModeFromName(std::string_view name);

// Parses only persisted, deterministic data. Temporary "allow once" controls
// are intentionally not representable here: GuardProfileService binds them to
// one document lifetime and discards them on new-document commit, settings
// changes, renderer loss or tab destruction instead of writing preferences.
TahaiGuardConfigurationValidationResult ValidateTahaiGuardConfiguration(
    const base::DictValue& value,
    TahaiGuardConfiguration* parsed_configuration);

// Resolves a mode for an exact HTTPS origin. It never infers a top-level site
// from the active pane, focused window, history, page text, or network data.
// The request-path service supplies the request's own BrowserContext and
// top-level site when deciding whether a matching override is in scope.
TahaiGuardEffectiveSettings ResolveTahaiGuardSettingsForUrl(
    const TahaiGuardConfiguration& configuration,
    const GURL& url);

}  // namespace tahai

#endif  // CHROME_BROWSER_TAHAI_GUARD_TAHAI_GUARD_CONFIGURATION_H_
