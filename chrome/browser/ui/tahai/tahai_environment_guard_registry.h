// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_ENVIRONMENT_GUARD_REGISTRY_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_ENVIRONMENT_GUARD_REGISTRY_H_

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>

#include "chrome/browser/ui/webui/tahai/tahai_environment_guard.h"

class PrefService;
class GURL;

namespace tahai {

inline constexpr size_t kTahaiMaximumEnvironmentGuardRules = 128;

struct TahaiEnvironmentGuardRule {
  std::string canonical_origin;
  TahaiEnvironment environment;
  TahaiEnvironmentPosture posture;
};

// Returns whether a validated exact-origin rule can be written to the current
// profile preference. Managed policy owns the registry when present.
bool CanSetTahaiEnvironmentGuardRule(PrefService* prefs,
                                     std::string_view origin);

bool SetTahaiEnvironmentGuardRule(PrefService* prefs,
                                  TahaiEnvironment environment,
                                  std::string_view origin);

// Resolves only an exact HTTPS origin. Paths, page contents, titles, history,
// and network state never participate in classification.
std::optional<TahaiEnvironmentGuardRule> FindTahaiEnvironmentGuardRule(
    const PrefService* prefs,
    const GURL& url);

std::optional<TahaiEnvironmentGuardDecision>
EvaluateTahaiEnvironmentGuardForUrl(const PrefService* prefs,
                                    const GURL& url,
                                    TahaiEnvironmentAction action);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_ENVIRONMENT_GUARD_REGISTRY_H_
