// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_CUSTOM_MODE_REGISTRY_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_CUSTOM_MODE_REGISTRY_H_

#include <string>
#include <optional>
#include <string_view>
#include <vector>

#include "base/values.h"
#include "chrome/browser/ui/tahai/tahai_window_presentation.h"

namespace tahai {

// Positions refer only to this definition's declared native actions. Empty
// groups are intentional, not permission to fall back to a broader menu.
struct NativeModeCommandLayout {
  bool operator==(const NativeModeCommandLayout&) const = default;
  std::vector<std::string> toolbar_primary;
  std::vector<std::string> toolbar_secondary;
  std::vector<std::string> app_menu;
};

// A profile-persistable custom mode is either an independent native definition
// or a revision-pinned operational-skin alias. Its optional saved workspace is
// local to the profile. Actions use a closed symbolic vocabulary, never raw
// command integers, URLs, scripts, credentials or arbitrary renderer payloads.
struct TahaiCustomModeDefinition {
  bool operator==(const TahaiCustomModeDefinition&) const = default;

  std::string id;
  std::string title;
  std::string operational_mode_id;
  std::string workspace_id;
  // Present for an independent local mode rather than an operational-skin
  // alias. Nested mode references and workflow launches are forbidden.
  std::optional<WindowPresentation> native_presentation;
  std::vector<std::string> actions;
  // New operational aliases pin the reviewed package. Legacy unpinned records
  // are retained for recovery, but cannot acquire command authority.
  std::optional<WindowSkinReference> operational_skin;
  // Absent preserves the original local-mode layout: all actions in the
  // primary toolbar and app menu, with only recovery controls in secondary.
  std::optional<NativeModeCommandLayout> command_layout;
};

enum class TahaiCustomModeValidationResult {
  kValid,
  kInvalidSchema,
  kInvalidIdentifier,
  kInvalidTitle,
  kInvalidOperationalMode,
  kInvalidWorkspace,
  kDuplicate,
  kExceededLimit,
  kInvalidPresentation,
  kInvalidActions,
};

base::DictValue SerializeTahaiCustomModeDefinition(
    const TahaiCustomModeDefinition& definition);

base::DictValue EncodeNativeModeCommandLayout(const NativeModeCommandLayout& layout);
std::optional<NativeModeCommandLayout> DecodeNativeModeCommandLayout(
    const base::DictValue& value, const std::vector<std::string>& actions);

// Immutable built-ins use the same finite schema and validator as local
// definitions. They are not persisted into, or overridable through, prefs.
const std::vector<TahaiCustomModeDefinition>& GetBuiltinNativeModePresets();
const TahaiCustomModeDefinition* FindBuiltinNativeModePreset(std::string_view id);

// Validates a bounded preference dictionary. Persistence and activation stay
// separate: callers must resolve the referenced operational mode and saved
// workspace at the browser/window boundary after explicit user activation.
TahaiCustomModeValidationResult ValidateTahaiCustomModeDefinitions(
    const base::DictValue& value,
    std::vector<TahaiCustomModeDefinition>* definitions);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_CUSTOM_MODE_REGISTRY_H_
