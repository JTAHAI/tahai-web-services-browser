// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_guard/tahai_guard_configuration_registry.h"

#include <optional>
#include <utility>

#include "chrome/browser/profiles/profile.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"

namespace tahai {
namespace {

constexpr int kTahaiGuardConfigurationSchemaVersion = 1;

std::optional<std::string_view> SiteOverrideModeName(
    TahaiGuardSiteOverrideMode mode) {
  switch (mode) {
    case TahaiGuardSiteOverrideMode::kOff:
      return "off";
    case TahaiGuardSiteOverrideMode::kCosmeticOff:
      return "cosmetic-off";
  }
  return std::nullopt;
}

std::optional<base::DictValue> SerializeTahaiGuardConfiguration(
    const TahaiGuardConfiguration& configuration) {
  const std::optional<TahaiGuardMode> verified_mode =
      TahaiGuardModeFromName(TahaiGuardModeName(configuration.mode));
  if (!verified_mode || *verified_mode != configuration.mode) {
    return std::nullopt;
  }
  base::DictValue value;
  value.Set("schema_version", kTahaiGuardConfigurationSchemaVersion);
  value.Set("mode", TahaiGuardModeName(configuration.mode));
  value.Set("local_statistics_enabled", configuration.local_statistics_enabled);
  base::ListValue site_overrides;
  for (const TahaiGuardSiteOverride& override : configuration.site_overrides) {
    const std::optional<std::string_view> override_mode =
        SiteOverrideModeName(override.mode);
    if (!override_mode) {
      return std::nullopt;
    }
    base::DictValue entry;
    entry.Set("origin", override.canonical_origin);
    entry.Set("mode", *override_mode);
    site_overrides.Append(std::move(entry));
  }
  value.Set("site_overrides", std::move(site_overrides));
  return value;
}

}  // namespace

TahaiGuardConfiguration GetTahaiGuardConfiguration(const PrefService* prefs) {
  TahaiGuardConfiguration configuration;
  if (!prefs) {
    return configuration;
  }
  const base::DictValue& stored =
      prefs->GetDict(prefs::kTahaiGuardConfiguration);
  TahaiGuardConfiguration parsed;
  if (ValidateTahaiGuardConfiguration(stored, &parsed) ==
      TahaiGuardConfigurationValidationResult::kValid) {
    return parsed;
  }
  return configuration;
}

TahaiGuardConfiguration GetTahaiGuardConfigurationForProfile(
    const Profile* profile) {
  if (!profile || profile->IsOffTheRecord()) {
    return TahaiGuardConfiguration();
  }
  return GetTahaiGuardConfiguration(profile->GetPrefs());
}

bool SetTahaiGuardConfiguration(PrefService* prefs,
                                const TahaiGuardConfiguration& configuration) {
  if (!prefs || prefs->IsManagedPreference(prefs::kTahaiGuardConfiguration)) {
    return false;
  }
  std::optional<base::DictValue> serialized =
      SerializeTahaiGuardConfiguration(configuration);
  TahaiGuardConfiguration parsed;
  if (!serialized || ValidateTahaiGuardConfiguration(*serialized, &parsed) !=
                         TahaiGuardConfigurationValidationResult::kValid) {
    return false;
  }
  prefs->SetDict(prefs::kTahaiGuardConfiguration, std::move(*serialized));
  return true;
}

bool SetTahaiGuardConfigurationForProfile(
    Profile* profile,
    const TahaiGuardConfiguration& configuration) {
  return profile && !profile->IsOffTheRecord() &&
         SetTahaiGuardConfiguration(profile->GetPrefs(), configuration);
}

}  // namespace tahai
