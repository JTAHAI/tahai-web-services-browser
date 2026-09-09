// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_MANIFEST_H_
#define CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_MANIFEST_H_

#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/values.h"

namespace tahai {

// A TAHAI Skin is declarative browser-shell presentation data. This manifest
// is deliberately incapable of describing website styles, executable code,
// remote resources, native libraries, or arbitrary View classes. Package
// decoding belongs to a sandboxed utility; installation, preview, recovery and
// applying a skin remain separate browser-owned operations. Accepting this
// manifest alone never applies a skin.
enum class TahaiSkinDensity {
  kComfortable,
  kCompact,
};

enum class TahaiSkinAssetPurpose {
  kPreview,
  kShellDecoration,
};

struct TahaiSkinAsset {
  std::string path;
  std::string sha256;
  TahaiSkinAssetPurpose purpose;
};

// Every token name is a closed vocabulary. Security indicators, origin text,
// warning colors, focus rings, permission prompts, minimum hit areas, and
// page content are intentionally absent from this list.
struct TahaiSkinTokenSet {
  std::vector<std::pair<std::string, std::string>> colors;
};

struct TahaiSkinAppearance {
  TahaiSkinDensity density = TahaiSkinDensity::kComfortable;
  bool reduced_motion = false;
  TahaiSkinTokenSet light_tokens;
  TahaiSkinTokenSet dark_tokens;
  TahaiSkinTokenSet high_contrast_tokens;
};

struct TahaiSkinCompatibility {
  int min_chromium_major = 0;
  int max_chromium_major = 0;
};

struct TahaiSkinManifest {
  int schema_version = 1;
  std::string id;
  std::string name;
  std::string creator;
  std::string license;
  TahaiSkinCompatibility compatibility;
  TahaiSkinAppearance appearance;
  std::vector<TahaiSkinAsset> assets;
};

enum class TahaiSkinManifestValidationResult {
  kValid,
  kUnknownField,
  kInvalidSchema,
  kInvalidIdentifier,
  kInvalidMetadata,
  kInvalidCompatibility,
  kInvalidAppearance,
  kInvalidAssets,
};

// Shared archive/manifest spelling check, including Windows device names and
// trailing-dot aliases. Never normalizes an unsafe spelling into a safe one.
bool IsSafeTahaiSkinAssetPath(std::string_view path);

// Validates a complete `.tahaiskin` manifest before any package contents are
// decoded or made visible. `parsed_manifest` resets on every failure so a
// caller cannot use partially accepted visual data. This validator does not
// authenticate a publisher or validate an archive; matching asset hashes are
// integrity metadata checked by the sandboxed archive decoder.
TahaiSkinManifestValidationResult ValidateTahaiSkinManifest(
    const base::DictValue& manifest,
    TahaiSkinManifest* parsed_manifest);

}  // namespace tahai

#endif  // CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_MANIFEST_H_
