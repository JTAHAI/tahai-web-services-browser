// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_SKIN_MANAGER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_SKIN_MANAGER_H_

#include "ui/base/interaction/element_identifier.h"

class Browser;

namespace tahai::skins {
DECLARE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerImportElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerInstallElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPreviewElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerReviewElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerApplyElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerResetElementId);
bool CanShowSkinManager(Browser* browser);
void ShowSkinManager(Browser* browser);
}  // namespace tahai::skins

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_SKIN_MANAGER_H_
