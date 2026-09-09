// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_environment_guard_registry.h"

#include <optional>
#include <string>
#include <string_view>
#include <utility>

#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "url/gurl.h"
#include "url/origin.h"

namespace tahai {

bool CanSetTahaiEnvironmentGuardRule(PrefService* prefs,
                                     std::string_view origin) {
  if (!prefs ||
      prefs->IsManagedPreference(prefs::kTahaiEnvironmentGuardRules)) {
    return false;
  }
  std::string canonical_origin;
  if (ValidateTahaiEnvironmentRuleOrigin(origin, &canonical_origin) !=
      TahaiEnvironmentRuleValidationResult::kValid) {
    return false;
  }
  const base::DictValue& rules =
      prefs->GetDict(prefs::kTahaiEnvironmentGuardRules);
  return rules.contains(canonical_origin) ||
         rules.size() < kTahaiMaximumEnvironmentGuardRules;
}

bool SetTahaiEnvironmentGuardRule(PrefService* prefs,
                                  TahaiEnvironment environment,
                                  std::string_view origin) {
  if (!CanSetTahaiEnvironmentGuardRule(prefs, origin)) {
    return false;
  }
  std::string canonical_origin;
  if (ValidateTahaiEnvironmentRuleOrigin(origin, &canonical_origin) !=
      TahaiEnvironmentRuleValidationResult::kValid) {
    return false;
  }
  ScopedDictPrefUpdate update(prefs, prefs::kTahaiEnvironmentGuardRules);
  update->Set(canonical_origin, TahaiEnvironmentName(environment));
  return true;
}

std::optional<TahaiEnvironmentGuardRule> FindTahaiEnvironmentGuardRule(
    const PrefService* prefs,
    const GURL& url) {
  if (!prefs || !url.is_valid() || !url.SchemeIs("https")) {
    return std::nullopt;
  }
  std::string canonical_origin;
  if (ValidateTahaiEnvironmentRuleOrigin(url::Origin::Create(url).Serialize(),
                                         &canonical_origin) !=
      TahaiEnvironmentRuleValidationResult::kValid) {
    return std::nullopt;
  }
  const std::string* environment_name =
      prefs->GetDict(prefs::kTahaiEnvironmentGuardRules)
          .FindString(canonical_origin);
  if (!environment_name) {
    return std::nullopt;
  }
  const std::optional<TahaiEnvironment> environment =
      TahaiEnvironmentFromName(*environment_name);
  if (!environment) {
    return std::nullopt;
  }
  return TahaiEnvironmentGuardRule{
      .canonical_origin = std::move(canonical_origin),
      .environment = *environment,
      .posture = GetTahaiEnvironmentPosture(*environment),
  };
}

std::optional<TahaiEnvironmentGuardDecision>
EvaluateTahaiEnvironmentGuardForUrl(const PrefService* prefs,
                                    const GURL& url,
                                    TahaiEnvironmentAction action) {
  const std::optional<TahaiEnvironmentGuardRule> rule =
      FindTahaiEnvironmentGuardRule(prefs, url);
  if (!rule) {
    return std::nullopt;
  }
  return EvaluateTahaiEnvironmentAction(rule->environment, action);
}

}  // namespace tahai
