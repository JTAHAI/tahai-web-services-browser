// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_guard/tahai_guard_configuration.h"

#include <algorithm>
#include <array>
#include <optional>
#include <span>
#include <string_view>
#include <utility>

#include "url/gurl.h"

namespace tahai {
namespace {

constexpr int kTahaiGuardConfigurationSchemaVersion = 1;
constexpr size_t kMaximumSiteOverrides = 128u;

constexpr std::array<std::string_view, 4> kConfigurationFields = {
    "schema_version", "mode", "local_statistics_enabled", "site_overrides"};
constexpr std::array<std::string_view, 2> kSiteOverrideFields = {"origin",
                                                                 "mode"};

bool Contains(std::span<const std::string_view> values,
              std::string_view value) {
  return std::find(values.begin(), values.end(), value) != values.end();
}

bool HasOnlyFields(const base::DictValue& value,
                   std::span<const std::string_view> allowed) {
  return std::all_of(value.begin(), value.end(), [&allowed](const auto& field) {
    return Contains(allowed, field.first);
  });
}

bool IsExactHttpsOrigin(std::string_view value, std::string* canonical_origin) {
  if (value.size() > 8192) {
    return false;
  }
  GURL url{std::string(value)};
  if (!url.is_valid() || !url.SchemeIs("https") || !url.has_host() ||
      url.has_username() || url.has_password() || url.has_query() ||
      url.has_ref() || url.path() != "/") {
    return false;
  }
  const std::string canonical = url.DeprecatedGetOriginAsURL().spec();
  if (canonical != url.spec()) {
    return false;
  }
  *canonical_origin = canonical;
  return true;
}

std::optional<TahaiGuardSiteOverrideMode> SiteOverrideModeFromName(
    std::string_view value) {
  if (value == "off") {
    return TahaiGuardSiteOverrideMode::kOff;
  }
  if (value == "cosmetic-off") {
    return TahaiGuardSiteOverrideMode::kCosmeticOff;
  }
  return std::nullopt;
}

bool IsGuardModeUsable(TahaiGuardMode mode) {
  return mode == TahaiGuardMode::kOff || mode == TahaiGuardMode::kBalanced ||
         mode == TahaiGuardMode::kStrict || mode == TahaiGuardMode::kCustom;
}

}  // namespace

std::string_view TahaiGuardModeName(TahaiGuardMode mode) {
  switch (mode) {
    case TahaiGuardMode::kOff:
      return "off";
    case TahaiGuardMode::kBalanced:
      return "balanced";
    case TahaiGuardMode::kStrict:
      return "strict";
    case TahaiGuardMode::kCustom:
      return "custom";
  }
  return "off";
}

std::optional<TahaiGuardMode> TahaiGuardModeFromName(std::string_view name) {
  if (name == "off") {
    return TahaiGuardMode::kOff;
  }
  if (name == "balanced") {
    return TahaiGuardMode::kBalanced;
  }
  if (name == "strict") {
    return TahaiGuardMode::kStrict;
  }
  if (name == "custom") {
    return TahaiGuardMode::kCustom;
  }
  return std::nullopt;
}

TahaiGuardConfigurationValidationResult ValidateTahaiGuardConfiguration(
    const base::DictValue& value,
    TahaiGuardConfiguration* parsed_configuration) {
  if (!parsed_configuration) {
    return TahaiGuardConfigurationValidationResult::kInvalidSchema;
  }
  *parsed_configuration = TahaiGuardConfiguration();
  if (!HasOnlyFields(value, kConfigurationFields)) {
    return TahaiGuardConfigurationValidationResult::kUnknownField;
  }
  const std::optional<int> schema_version = value.FindInt("schema_version");
  const std::string* mode_name = value.FindString("mode");
  const std::optional<bool> local_statistics_enabled =
      value.FindBool("local_statistics_enabled");
  const base::ListValue* site_overrides = value.FindList("site_overrides");
  if (!schema_version ||
      *schema_version != kTahaiGuardConfigurationSchemaVersion || !mode_name ||
      !local_statistics_enabled || !site_overrides) {
    return TahaiGuardConfigurationValidationResult::kInvalidSchema;
  }
  const std::optional<TahaiGuardMode> mode = TahaiGuardModeFromName(*mode_name);
  if (!mode) {
    return TahaiGuardConfigurationValidationResult::kInvalidMode;
  }
  if (site_overrides->size() > kMaximumSiteOverrides) {
    return TahaiGuardConfigurationValidationResult::kInvalidSiteOverrides;
  }

  TahaiGuardConfiguration candidate;
  candidate.mode = *mode;
  candidate.local_statistics_enabled = *local_statistics_enabled;
  for (const base::Value& override_value : *site_overrides) {
    const base::DictValue* override_dict = override_value.GetIfDict();
    if (!override_dict || !HasOnlyFields(*override_dict, kSiteOverrideFields)) {
      return TahaiGuardConfigurationValidationResult::kInvalidSiteOverrides;
    }
    const std::string* origin = override_dict->FindString("origin");
    const std::string* override_mode_name = override_dict->FindString("mode");
    std::string canonical_origin;
    const std::optional<TahaiGuardSiteOverrideMode> override_mode =
        override_mode_name ? SiteOverrideModeFromName(*override_mode_name)
                           : std::nullopt;
    if (!origin || !override_mode ||
        !IsExactHttpsOrigin(*origin, &canonical_origin) ||
        std::any_of(candidate.site_overrides.begin(),
                    candidate.site_overrides.end(),
                    [&canonical_origin](const auto& existing) {
                      return existing.canonical_origin == canonical_origin;
                    })) {
      return TahaiGuardConfigurationValidationResult::kInvalidSiteOverrides;
    }
    candidate.site_overrides.push_back(
        {std::move(canonical_origin), *override_mode});
  }
  *parsed_configuration = std::move(candidate);
  return TahaiGuardConfigurationValidationResult::kValid;
}

TahaiGuardEffectiveSettings ResolveTahaiGuardSettingsForUrl(
    const TahaiGuardConfiguration& configuration,
    const GURL& url) {
  TahaiGuardEffectiveSettings effective;
  effective.network_mode = IsGuardModeUsable(configuration.mode)
                               ? configuration.mode
                               : TahaiGuardMode::kOff;
  effective.cosmetic_filtering_enabled =
      effective.network_mode != TahaiGuardMode::kOff;
  if (!url.is_valid() || !url.SchemeIs("https")) {
    return effective;
  }
  const std::string origin = url.DeprecatedGetOriginAsURL().spec();
  const auto override = std::find_if(
      configuration.site_overrides.begin(), configuration.site_overrides.end(),
      [&origin](const TahaiGuardSiteOverride& candidate) {
        return candidate.canonical_origin == origin;
      });
  if (override == configuration.site_overrides.end()) {
    return effective;
  }
  effective.exact_site_override_applied = true;
  if (override->mode == TahaiGuardSiteOverrideMode::kOff) {
    effective.network_mode = TahaiGuardMode::kOff;
    effective.cosmetic_filtering_enabled = false;
  } else {
    effective.cosmetic_filtering_enabled = false;
  }
  return effective;
}

}  // namespace tahai
