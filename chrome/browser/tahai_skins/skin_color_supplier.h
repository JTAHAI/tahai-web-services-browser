// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_SKINS_SKIN_COLOR_SUPPLIER_H_
#define CHROME_BROWSER_TAHAI_SKINS_SKIN_COLOR_SUPPLIER_H_

#include <optional>
#include <string_view>

#include "chrome/browser/themes/custom_theme_supplier.h"
#include "chrome/common/tahai_skins/tahai_skin_manifest.h"
#include "third_party/skia/include/core/SkBitmap.h"

namespace tahai::skins {

// Immutable and profile-owned, so ColorProvider cache keys cannot accidentally
// share a palette between profiles or mutate an already-cached provider.
class SkinColorSupplier final : public CustomThemeSupplier {
 public:
  explicit SkinColorSupplier(TahaiSkinAppearance appearance,
                             SkBitmap decoration = {});
  TahaiSkinDensity density() const { return appearance_.density; }
  const SkBitmap& decoration() const { return decoration_; }
  std::optional<SkColor> Color(std::string_view token,
                               const ui::ColorProviderKey& key) const;
  void AddColorMixers(ui::ColorProvider* provider,
                      const ui::ColorProviderKey& key) const override;

 private:
  ~SkinColorSupplier() override;
  const TahaiSkinAppearance appearance_;
  const SkBitmap decoration_;
};

}  // namespace tahai::skins

#endif  // CHROME_BROWSER_TAHAI_SKINS_SKIN_COLOR_SUPPLIER_H_
