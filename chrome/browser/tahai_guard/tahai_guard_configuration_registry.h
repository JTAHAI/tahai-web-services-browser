// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_GUARD_TAHAI_GUARD_CONFIGURATION_REGISTRY_H_
#define CHROME_BROWSER_TAHAI_GUARD_TAHAI_GUARD_CONFIGURATION_REGISTRY_H_

#include "chrome/browser/tahai_guard/tahai_guard_configuration.h"

class PrefService;
class Profile;

namespace tahai {

// Loads a profile-local TAHAI Guard configuration. Invalid or missing
// stored data safely resolves to the no-engine default and is never repaired
// implicitly. Returning a configuration does not mean Guard is filtering
// requests; only an independently validated native runtime can make that claim.
TahaiGuardConfiguration GetTahaiGuardConfiguration(const PrefService* prefs);

// Editor-facing accessor: incognito returns the no-engine default and never
// exposes the regular profile's editable configuration. The native Guard
// service instead reads its own incognito PrefService's inherited effective
// settings, with separate engine/grant ownership and no writes or counters.
TahaiGuardConfiguration GetTahaiGuardConfigurationForProfile(
    const Profile* profile);

// Writes a complete validated configuration atomically to the profile
// preference. Managed policy owns the whole configuration. This function does
// not accept temporary navigation-lifetime overrides, URLs with paths, or any
// request data.
bool SetTahaiGuardConfiguration(PrefService* prefs,
                                const TahaiGuardConfiguration& configuration);

// Browser-facing persistence rejects off-the-record profiles so a staged
// preference cannot be written through an incognito window.
bool SetTahaiGuardConfigurationForProfile(
    Profile* profile,
    const TahaiGuardConfiguration& configuration);

}  // namespace tahai

#endif  // CHROME_BROWSER_TAHAI_GUARD_TAHAI_GUARD_CONFIGURATION_REGISTRY_H_
