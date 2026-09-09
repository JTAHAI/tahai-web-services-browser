// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_COMMAND_MODEL_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_COMMAND_MODEL_H_

#include <span>
#include <string_view>

namespace tahai {

// A visible mode changes the controls exposed by browser chrome. Keep the
// command ids and labels in one browser-owned model so the toolbar and app
// menu cannot quietly drift into presenting different workflows for a mode.
struct ModeCommandAction {
  int command_id;
  std::u16string_view label;
};

struct ModeCommandGroup {
  std::span<const ModeCommandAction> toolbar_primary;
  std::span<const ModeCommandAction> toolbar_secondary;
  std::span<const ModeCommandAction> app_menu;
};

// Returns the bounded native commands appropriate to |mode_id|. Unknown ids
// intentionally use the Support Desk group, which is the conservative
// recovery-focused fallback rather than a generic all-features menu.
ModeCommandGroup GetModeCommandGroup(std::string_view mode_id);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_COMMAND_MODEL_H_
