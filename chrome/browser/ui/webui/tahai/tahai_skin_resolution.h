// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_RESOLUTION_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_RESOLUTION_H_

#include <optional>
#include <string_view>

#include "base/memory/raw_ptr.h"
#include "chrome/browser/ui/webui/tahai/tahai_skin_selection.h"

namespace tahai {

// Identifies why a finite Skin identity was selected. Resolving an identity is
// deliberately separate from installing or applying a Skin package.
enum class TahaiSkinResolutionSource {
  kStartupSafeRecovery,
  kEnterprisePolicy,
  kMissionAssignment,
  kModeSelection,
  kProfileSelection,
  kStockFallback,
};

struct TahaiSkinResolutionRequest {
  // A policy bridge can supply a finite built-in identity here once its
  // Chromium policy mapping is implemented. This contract does not read or
  // invent policy values on its own.
  std::optional<std::string_view> enterprise_skin_id;
  // Mission ownership supplies an explicit finite identity. Renderer input,
  // page content, URLs, and arbitrary package identifiers are never accepted.
  std::optional<std::string_view> mission_skin_id;
  std::string_view active_mode_id;
  raw_ptr<const TahaiSkinSelection> profile_selection = nullptr;
  // A startup or crash-loop recovery path must return stock before any other
  // candidate can be considered.
  bool force_stock_recovery = false;
};

struct TahaiSkinResolution {
  std::string_view skin_id;
  TahaiSkinResolutionSource source;
};

// Resolves only a validated built-in identity in this order: forced recovery,
// enterprise policy, explicit Mission assignment, Work Mode assignment,
// profile selection, then stock. It has no browser-appearance side effect and
// cannot affect native rail state, origin/TLS UI, warnings, focus indication,
// or other trusted browser surfaces.
TahaiSkinResolution ResolveTahaiSkinIdentity(
    const TahaiSkinResolutionRequest& request);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_RESOLUTION_H_
