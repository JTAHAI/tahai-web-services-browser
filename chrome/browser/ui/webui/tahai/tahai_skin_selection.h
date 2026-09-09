// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_SELECTION_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_SELECTION_H_

#include <string>
#include <string_view>
#include <vector>

#include "base/values.h"

namespace tahai {

struct TahaiSkinModeSelection {
  std::string mode_id;
  std::string skin_id;
};

// Selection is separate from installation. A selected ID is only a local
// preference; until a Skin package is installed and applied by a future native
// service, the browser remains in the stock browser-owned appearance.
struct TahaiSkinSelection {
  int schema_version = 1;
  std::string profile_skin_id = "stock";
  std::vector<TahaiSkinModeSelection> mode_selections;
};

enum class TahaiSkinSelectionValidationResult {
  kValid,
  kUnknownField,
  kInvalidSchema,
  kInvalidSkinId,
  kInvalidModeSelections,
};

TahaiSkinSelectionValidationResult ValidateTahaiSkinSelection(
    const base::DictValue& value,
    TahaiSkinSelection* parsed_selection);

// Returns a configured built-in identity for a valid mode, or the profile
// choice. It does not cause a UI refresh, change website content, or override
// an explicit navigation-rail preference.
std::string_view ResolveTahaiSkinIdForMode(const TahaiSkinSelection& selection,
                                           std::string_view mode_id);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_SELECTION_H_
