// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_SKIN_STUDIO_DRAFT_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_SKIN_STUDIO_DRAFT_H_

#include <string>

class PrefService;

namespace tahai {

// The Studio retains only declarative package source. It deliberately has no
// archive bytes, local-file handles, website data, credentials, or grants.
enum class TahaiSkinStudioDraftStatus {
  kOk,
  kUnavailable,
  kManaged,
  kTooLarge,
  kInvalidJson,
  kInvalidManifest,
};

struct TahaiSkinStudioDraftResult {
  TahaiSkinStudioDraftStatus status = TahaiSkinStudioDraftStatus::kUnavailable;
  std::string manifest_json;
  // Fixed validator category and position only; never parser text or source.
  std::string diagnostic = {};
  int error_line = 0;
  int error_column = 0;
};

// Returns a valid, inert v2 source template. It is a draft, not an installed
// package and cannot affect the browser until it passes the separate signed
// package review/install path.
std::string GetTahaiSkinStudioDefaultDraft();

// Reads a profile-local draft, falling back to the source template if a stale
// preference is absent or invalid. A managed draft is returned but not mutable.
TahaiSkinStudioDraftResult LoadTahaiSkinStudioDraft(PrefService* prefs);

// Validates and canonicalizes one complete v2 source document before retaining
// it in the profile. Invalid input never replaces a previously good draft.
TahaiSkinStudioDraftResult SaveTahaiSkinStudioDraft(PrefService* prefs,
                                                     std::string manifest_json);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_SKIN_STUDIO_DRAFT_H_
