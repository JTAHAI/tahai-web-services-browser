// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_SELECTION_REGISTRY_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_SELECTION_REGISTRY_H_

#include "chrome/browser/ui/webui/tahai/tahai_skin_selection.h"

class PrefService;
class Profile;

namespace tahai {

// Returns a profile-local Skin selection. A returned non-stock identity is a
// future preference only; the stock browser-owned UI continues until a native
// Skin service has admitted and applied a package safely.
TahaiSkinSelection GetTahaiSkinSelection(const PrefService* prefs);

// Browser-facing selection treats off-the-record sessions as stock. A Skin
// identity may never be read from or written through the regular profile by
// an incognito window.
TahaiSkinSelection GetTahaiSkinSelectionForProfile(const Profile* profile);

// Stores a complete validated selection atomically. Managed policy owns the
// whole selection. This function never stores a path, archive, remote URL,
// website selector, or browser security-surface setting.
bool SetTahaiSkinSelection(PrefService* prefs,
                           const TahaiSkinSelection& selection);

// Browser-facing persistence rejects off-the-record profiles. This is an
// identity preference only and still does not apply browser appearance.
bool SetTahaiSkinSelectionForProfile(Profile* profile,
                                     const TahaiSkinSelection& selection);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_SELECTION_REGISTRY_H_
