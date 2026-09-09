// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_CATALOG_H_
#define CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_CATALOG_H_

#include <optional>
#include <span>
#include <string_view>

#include "chrome/common/tahai_skins/tahai_skin_manifest.h"

namespace tahai {

// Browser-owned palettes. User archives cannot impersonate these identities.
struct TahaiSkinDescriptor {
  std::string_view id;
  std::string_view display_name;
  std::string_view description;
  bool is_stock = false;
};

std::span<const TahaiSkinDescriptor> GetTahaiBuiltInSkinCatalog();
bool IsTahaiBuiltInSkinId(std::string_view id);
std::optional<TahaiSkinAppearance> GetTahaiBuiltInSkinAppearance(
    std::string_view id);

}  // namespace tahai

#endif  // CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_CATALOG_H_
