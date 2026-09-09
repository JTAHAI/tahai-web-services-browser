// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/common/tahai_skins/tahai_skin_catalog.h"

#include <algorithm>
#include <array>

namespace tahai {
namespace {

constexpr std::array<TahaiSkinDescriptor, 9> kBuiltInSkins = {{
    {"stock", "TAHAI Stock", "The browser-owned recovery appearance.", true},
    {"tahai-neon", "TAHAI Neon", "Violet and cyan browser colors.", false},
    {"tahai-sentinel", "TAHAI Sentinel", "Blue and amber browser colors.",
     false},
    {"terminal-green", "Terminal Green", "Forest and phosphor green colors.",
     false},
    {"bare-metal", "Bare Metal", "Neutral slate and silver colors.", false},
    {"glass-command", "Glass Command", "Clear teal and ice blue colors.",
     false},
    {"classic-amp-inspired", "Classic Amp-inspired",
     "Original olive and amber colors; no third-party artwork.", false},
    {"midnight-operations", "Midnight Operations",
     "Deep indigo and lavender colors.", false},
    {"high-contrast-operator", "High-Contrast Operator",
     "Black, white and yellow; system forced colors take precedence.", false},
}};

}  // namespace

std::span<const TahaiSkinDescriptor> GetTahaiBuiltInSkinCatalog() {
  return kBuiltInSkins;
}

bool IsTahaiBuiltInSkinId(std::string_view id) {
  return std::any_of(
      kBuiltInSkins.begin(), kBuiltInSkins.end(),
      [id](const TahaiSkinDescriptor& skin) { return skin.id == id; });
}

std::optional<TahaiSkinAppearance> GetTahaiBuiltInSkinAppearance(
    std::string_view id) {
  struct Palette {
    std::string_view id;
    const char* light;
    const char* dark;
    const char* accent;
  };
  static constexpr Palette palettes[] = {
      {"tahai-neon", "#581c87", "#170d26", "#67e8f9"},
      {"tahai-sentinel", "#1e3a8a", "#101827", "#fcd34d"},
      {"terminal-green", "#14532d", "#071c12", "#86efac"},
      {"bare-metal", "#374151", "#17191c", "#d1d5db"},
      {"glass-command", "#115e59", "#082f36", "#a5f3fc"},
      {"classic-amp-inspired", "#3f4d18", "#1a2010", "#fde68a"},
      {"midnight-operations", "#312e81", "#101028", "#c4b5fd"},
      {"high-contrast-operator", "#000000", "#000000", "#ffff00"},
  };
  const auto found = std::ranges::find(palettes, id, &Palette::id);
  if (found == std::end(palettes)) {
    return std::nullopt;
  }
  auto tokens = [](const char* background, const char* foreground,
                   const char* rail, const char* accent) {
    return TahaiSkinTokenSet{{{"shell_background", background},
                              {"toolbar_background", background},
                              {"toolbar_foreground", foreground},
                              {"tab_background", background},
                              {"tab_foreground", foreground},
                              {"rail_background", rail},
                              {"rail_foreground", "#ffffff"},
                              {"accent", accent},
                              {"panel_background", background},
                              {"panel_foreground", foreground}}};
  };
  TahaiSkinAppearance appearance;
  appearance.light_tokens =
      tokens("#ffffff", "#111827", found->light, found->light);
  appearance.dark_tokens =
      tokens(found->dark, "#ffffff", found->dark, found->accent);
  appearance.high_contrast_tokens =
      tokens("#000000", "#ffffff", "#000000", "#ffff00");
  if (id == "high-contrast-operator") {
    appearance.light_tokens = appearance.high_contrast_tokens;
    appearance.reduced_motion = true;
  }
  return appearance;
}

}  // namespace tahai
