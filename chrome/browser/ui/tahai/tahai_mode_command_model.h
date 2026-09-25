// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_COMMAND_MODEL_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_COMMAND_MODEL_H_

#include <cstddef>
#include <optional>
#include <span>
#include <string>
#include <string_view>
#include <vector>

#include "base/memory/weak_ptr.h"

class Browser;

namespace tahai {

inline constexpr size_t kMaximumNativeModeActions = 17;

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

struct NativeModeActionDefinition {
  std::string_view id;
  int command_id;
  std::u16string_view label;
};

// Bounded, browser-owned local controls available to locally authored modes.
// These open native surfaces or rearrange panes; there is no URL, script,
// external write, clipboard-read, or credential operation in this catalog.
std::span<const NativeModeActionDefinition> GetNativeModeActionCatalog();
std::optional<NativeModeActionDefinition> FindNativeModeAction(std::string_view id);

// Returns the bounded native commands appropriate to |mode_id|. Unknown ids
// intentionally use the Support Desk group, which is the conservative
// recovery-focused fallback rather than a generic all-features menu.
ModeCommandGroup GetModeCommandGroup(std::string_view mode_id);

// Labels for the closed operational action vocabulary used by verified skin
// modes. Returning nullopt prevents an activation command from becoming a
// contextual toolbar item unless browser chrome has an explicit label for it.
std::optional<std::u16string_view> GetOperationalCommandLabel(int command_id);

// A menu/search result is pinned to the window and reviewed mode revision that
// produced it. This is context to revalidate, not permission to run a command.
struct WindowModeActionContext {
  base::WeakPtr<Browser> browser;
  std::string skin_id;
  std::string archive_sha256;
  std::string operational_mode_id;
  std::string custom_mode_id;
  std::string definition_sha256;
};

struct WindowModeActionSet {
  WindowModeActionContext context;
  // Union used by Finder, rail and execution revalidation.
  std::vector<ModeCommandAction> actions;
  std::vector<ModeCommandAction> toolbar_primary;
  std::vector<ModeCommandAction> toolbar_secondary;
  std::vector<ModeCommandAction> app_menu;
};

// Shared by the toolbar, app menu and Finder. nullopt means a compiled mode;
// an engaged result with no actions means an unavailable/revoked custom
// mode. Consumers must not replace that denial with a broader fixed menu.
std::optional<WindowModeActionSet> ResolveOperationalWindowActions(Browser* browser);
bool CanExecuteWindowModeAction(Browser* browser,
                                const WindowModeActionContext& context,
                                int command_id);
bool ExecuteWindowModeAction(Browser* browser,
                             const WindowModeActionContext& context,
                             int command_id);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_COMMAND_MODEL_H_
