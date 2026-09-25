// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_PRESENTATION_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_PRESENTATION_H_

#include <optional>
#include <map>
#include <string>
#include <string_view>
#include <vector>

#include "base/values.h"
#include "chrome/common/tahai_skins/tahai_surface_design.h"

namespace tahai {

inline constexpr char kWindowPresentationSessionKey[] =
    "tahai.window-presentation.v1";

// A reference to reverify, never a grant or a process-local binding token.
struct WindowSkinReference {
  bool operator==(const WindowSkinReference&) const = default;
  std::string id;
  std::string archive_sha256;  // Empty only for a compiled built-in appearance.
};

// Presentation only: restoring this must not dispatch a command, launch a
// workflow, restore entered values, or reacquire a capability grant.
struct WindowPresentation {
  bool operator==(const WindowPresentation&) const = default;
  std::string fixed_mode;
  std::string rail_state;
  int rail_width = 280;
  std::vector<std::string> rail_modules;
  std::optional<WindowSkinReference> skin;
  std::string operational_mode;
  std::string custom_mode;
  // Complete finite configuration snapshot for an independent native mode.
  // Empty retains compatibility with older windows using profile templates.
  std::map<std::string, std::string> configuration;
  std::optional<SurfaceDesign> surface_design;
};

bool ValidateWindowPresentation(const WindowPresentation& presentation);
base::DictValue EncodeWindowPresentation(const WindowPresentation& presentation);
std::optional<WindowPresentation> DecodeWindowPresentation(
    const base::DictValue& value);
std::optional<WindowPresentation> ParseWindowPresentation(std::string_view json);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_PRESENTATION_H_
