// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/common/tahai_skins/tahai_skin_manifest.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <optional>
#include <span>
#include <string_view>
#include <utility>

namespace tahai {
namespace {

constexpr int kTahaiSkinSchemaVersion = 1;
constexpr size_t kMaximumSkinAssets = 16u;
constexpr size_t kMaximumSkinMetadataLength = 128u;
constexpr size_t kMaximumSkinAssetPathLength = 256u;
constexpr int kMinimumChromiumMajor = 1;
constexpr int kMaximumChromiumMajor = 999;

constexpr std::array<std::string_view, 8> kManifestFields = {
    "schema_version", "id",         "name",  "creator", "license",
    "compatibility",  "appearance", "assets"};

constexpr std::array<std::string_view, 2> kCompatibilityFields = {
    "min_chromium_major", "max_chromium_major"};

constexpr std::array<std::string_view, 5> kAppearanceFields = {
    "density", "reduced_motion", "light_tokens", "dark_tokens",
    "high_contrast_tokens"};

constexpr std::array<std::string_view, 10> kColorTokenNames = {
    "shell_background",   "toolbar_background",
    "toolbar_foreground", "tab_background",
    "tab_foreground",     "rail_background",
    "rail_foreground",    "accent",
    "panel_background",   "panel_foreground"};

constexpr std::array<std::string_view, 3> kAssetFields = {"path", "sha256",
                                                          "purpose"};

bool Contains(std::span<const std::string_view> values,
              std::string_view value) {
  return std::find(values.begin(), values.end(), value) != values.end();
}

bool HasOnlyFields(const base::DictValue& value,
                   std::span<const std::string_view> allowed) {
  return std::all_of(value.begin(), value.end(), [&allowed](const auto& field) {
    return Contains(allowed, field.first);
  });
}

bool IsSafeIdentifier(std::string_view value) {
  if (value.size() < 3u || value.size() > 64u || value.front() == '-' ||
      value.back() == '-') {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '-';
  });
}

bool IsSafeMetadata(std::string_view value) {
  if (value.empty() || value.size() > kMaximumSkinMetadataLength) {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return character >= 0x20 && character <= 0x7e && character != '"' &&
           character != '\\' && character != '<' && character != '>';
  });
}

bool IsHexDigit(char character) {
  return (character >= '0' && character <= '9') ||
         (character >= 'a' && character <= 'f');
}

bool IsOpaqueColor(std::string_view value) {
  return value.size() == 7u && value.front() == '#' &&
         std::all_of(value.begin() + 1, value.end(), IsHexDigit);
}

std::optional<int> HexPair(std::string_view value, size_t offset) {
  if (offset + 2u > value.size()) {
    return std::nullopt;
  }
  const auto to_value = [](char character) -> int {
    return character >= 'a' ? character - 'a' + 10 : character - '0';
  };
  return to_value(value[offset]) * 16 + to_value(value[offset + 1u]);
}

double ToLinearColorComponent(int component) {
  const double normalized = component / 255.0;
  return normalized <= 0.04045 ? normalized / 12.92
                               : std::pow((normalized + 0.055) / 1.055, 2.4);
}

std::optional<double> RelativeLuminance(std::string_view value) {
  if (!IsOpaqueColor(value)) {
    return std::nullopt;
  }
  const std::optional<int> red = HexPair(value, 1u);
  const std::optional<int> green = HexPair(value, 3u);
  const std::optional<int> blue = HexPair(value, 5u);
  if (!red || !green || !blue) {
    return std::nullopt;
  }
  return 0.2126 * ToLinearColorComponent(*red) +
         0.7152 * ToLinearColorComponent(*green) +
         0.0722 * ToLinearColorComponent(*blue);
}

bool HasTextContrast(std::string_view background, std::string_view foreground) {
  const std::optional<double> background_luminance =
      RelativeLuminance(background);
  const std::optional<double> foreground_luminance =
      RelativeLuminance(foreground);
  if (!background_luminance || !foreground_luminance) {
    return false;
  }
  const double lighter = std::max(*background_luminance, *foreground_luminance);
  const double darker = std::min(*background_luminance, *foreground_luminance);
  return (lighter + 0.05) / (darker + 0.05) >= 4.5;
}

bool ParseTokenSet(const base::DictValue& tokens, TahaiSkinTokenSet* parsed) {
  if (!parsed || tokens.size() != kColorTokenNames.size() ||
      !HasOnlyFields(tokens, kColorTokenNames)) {
    return false;
  }
  TahaiSkinTokenSet candidate;
  for (std::string_view name : kColorTokenNames) {
    const std::string* color = tokens.FindString(name);
    if (!color || !IsOpaqueColor(*color)) {
      return false;
    }
    candidate.colors.emplace_back(name, *color);
  }
  const auto color_for =
      [&candidate](std::string_view name) -> std::string_view {
    const auto found =
        std::find_if(candidate.colors.begin(), candidate.colors.end(),
                     [name](const auto& token) { return token.first == name; });
    return found == candidate.colors.end() ? std::string_view() : found->second;
  };
  if (!HasTextContrast(color_for("toolbar_background"),
                       color_for("toolbar_foreground")) ||
      !HasTextContrast(color_for("tab_background"),
                       color_for("tab_foreground")) ||
      !HasTextContrast(color_for("rail_background"),
                       color_for("rail_foreground")) ||
      !HasTextContrast(color_for("panel_background"),
                       color_for("panel_foreground"))) {
    return false;
  }
  *parsed = std::move(candidate);
  return true;
}

bool IsSafeAssetPath(std::string_view value) {
  if (value.size() <= 7u || value.size() > kMaximumSkinAssetPathLength ||
      !value.starts_with("assets/") ||
      value.find('\\') != std::string_view::npos ||
      value.find(':') != std::string_view::npos ||
      value.find('%') != std::string_view::npos ||
      value.find("//") != std::string_view::npos || value.ends_with("/") ||
      (!value.ends_with(".png") && !value.ends_with(".webp"))) {
    return false;
  }
  size_t segment_start = 0u;
  while (segment_start < value.size()) {
    const size_t separator = value.find('/', segment_start);
    const std::string_view segment =
        value.substr(segment_start, separator == std::string_view::npos
                                        ? std::string_view::npos
                                        : separator - segment_start);
    const auto stem = segment.substr(0, segment.find('.'));
    const bool reserved =
        stem == "con" || stem == "prn" || stem == "aux" || stem == "nul" ||
        (stem.size() == 4 &&
         (stem.starts_with("com") || stem.starts_with("lpt")) &&
         stem[3] >= '1' && stem[3] <= '9');
    if (segment.empty() || segment == "." || segment == ".." ||
        segment.ends_with('.') || reserved ||
        !std::all_of(segment.begin(), segment.end(), [](char character) {
          return (character >= 'a' && character <= 'z') ||
                 (character >= '0' && character <= '9') || character == '.' ||
                 character == '_' || character == '-';
        })) {
      return false;
    }
    if (separator == std::string_view::npos) {
      break;
    }
    segment_start = separator + 1u;
  }
  return true;
}

bool IsSha256(std::string_view value) {
  return value.size() == 64u &&
         std::all_of(value.begin(), value.end(), IsHexDigit);
}

std::optional<TahaiSkinAssetPurpose> AssetPurposeFromString(
    std::string_view value) {
  if (value == "preview") {
    return TahaiSkinAssetPurpose::kPreview;
  }
  if (value == "shell-decoration") {
    return TahaiSkinAssetPurpose::kShellDecoration;
  }
  return std::nullopt;
}

}  // namespace

bool IsSafeTahaiSkinAssetPath(std::string_view path) {
  return IsSafeAssetPath(path);
}

TahaiSkinManifestValidationResult ValidateTahaiSkinManifest(
    const base::DictValue& manifest,
    TahaiSkinManifest* parsed_manifest) {
  if (!parsed_manifest) {
    return TahaiSkinManifestValidationResult::kInvalidSchema;
  }
  *parsed_manifest = TahaiSkinManifest();

  if (!HasOnlyFields(manifest, kManifestFields)) {
    return TahaiSkinManifestValidationResult::kUnknownField;
  }
  const std::optional<int> schema_version = manifest.FindInt("schema_version");
  const std::string* id = manifest.FindString("id");
  const std::string* name = manifest.FindString("name");
  const std::string* creator = manifest.FindString("creator");
  const std::string* license = manifest.FindString("license");
  const base::DictValue* compatibility = manifest.FindDict("compatibility");
  const base::DictValue* appearance = manifest.FindDict("appearance");
  const base::ListValue* assets = manifest.FindList("assets");
  if (!schema_version || *schema_version != kTahaiSkinSchemaVersion || !id ||
      !name || !creator || !license || !compatibility || !appearance ||
      !assets) {
    return TahaiSkinManifestValidationResult::kInvalidSchema;
  }
  if (!IsSafeIdentifier(*id)) {
    return TahaiSkinManifestValidationResult::kInvalidIdentifier;
  }
  if (!IsSafeMetadata(*name) || !IsSafeMetadata(*creator) ||
      !IsSafeMetadata(*license)) {
    return TahaiSkinManifestValidationResult::kInvalidMetadata;
  }

  if (!HasOnlyFields(*compatibility, kCompatibilityFields)) {
    return TahaiSkinManifestValidationResult::kInvalidCompatibility;
  }
  const std::optional<int> min_chromium_major =
      compatibility->FindInt("min_chromium_major");
  const std::optional<int> max_chromium_major =
      compatibility->FindInt("max_chromium_major");
  if (!min_chromium_major || !max_chromium_major ||
      *min_chromium_major < kMinimumChromiumMajor ||
      *max_chromium_major > kMaximumChromiumMajor ||
      *min_chromium_major > *max_chromium_major) {
    return TahaiSkinManifestValidationResult::kInvalidCompatibility;
  }

  if (!HasOnlyFields(*appearance, kAppearanceFields)) {
    return TahaiSkinManifestValidationResult::kInvalidAppearance;
  }
  const std::string* density = appearance->FindString("density");
  const std::optional<bool> reduced_motion =
      appearance->FindBool("reduced_motion");
  const base::DictValue* light_tokens = appearance->FindDict("light_tokens");
  const base::DictValue* dark_tokens = appearance->FindDict("dark_tokens");
  const base::DictValue* high_contrast_tokens =
      appearance->FindDict("high_contrast_tokens");
  if (!density || !reduced_motion || !light_tokens || !dark_tokens ||
      !high_contrast_tokens) {
    return TahaiSkinManifestValidationResult::kInvalidAppearance;
  }
  TahaiSkinAppearance parsed_appearance;
  if (*density == "comfortable") {
    parsed_appearance.density = TahaiSkinDensity::kComfortable;
  } else if (*density == "compact") {
    parsed_appearance.density = TahaiSkinDensity::kCompact;
  } else {
    return TahaiSkinManifestValidationResult::kInvalidAppearance;
  }
  parsed_appearance.reduced_motion = *reduced_motion;
  if (!ParseTokenSet(*light_tokens, &parsed_appearance.light_tokens) ||
      !ParseTokenSet(*dark_tokens, &parsed_appearance.dark_tokens) ||
      !ParseTokenSet(*high_contrast_tokens,
                     &parsed_appearance.high_contrast_tokens)) {
    return TahaiSkinManifestValidationResult::kInvalidAppearance;
  }

  if (assets->empty() || assets->size() > kMaximumSkinAssets) {
    return TahaiSkinManifestValidationResult::kInvalidAssets;
  }
  std::vector<TahaiSkinAsset> parsed_assets;
  bool has_preview = false;
  for (const base::Value& asset_value : *assets) {
    const base::DictValue* asset = asset_value.GetIfDict();
    if (!asset || !HasOnlyFields(*asset, kAssetFields)) {
      return TahaiSkinManifestValidationResult::kInvalidAssets;
    }
    const std::string* path = asset->FindString("path");
    const std::string* sha256 = asset->FindString("sha256");
    const std::string* purpose_name = asset->FindString("purpose");
    const std::optional<TahaiSkinAssetPurpose> purpose =
        purpose_name ? AssetPurposeFromString(*purpose_name) : std::nullopt;
    if (!path || !sha256 || !purpose || !IsSafeAssetPath(*path) ||
        !IsSha256(*sha256) ||
        std::find_if(parsed_assets.begin(), parsed_assets.end(),
                     [path](const TahaiSkinAsset& existing) {
                       return existing.path == *path;
                     }) != parsed_assets.end() ||
        (*purpose == TahaiSkinAssetPurpose::kPreview && has_preview)) {
      return TahaiSkinManifestValidationResult::kInvalidAssets;
    }
    has_preview |= *purpose == TahaiSkinAssetPurpose::kPreview;
    parsed_assets.push_back({*path, *sha256, *purpose});
  }
  if (!has_preview) {
    return TahaiSkinManifestValidationResult::kInvalidAssets;
  }

  TahaiSkinManifest candidate;
  candidate.id = *id;
  candidate.name = *name;
  candidate.creator = *creator;
  candidate.license = *license;
  candidate.compatibility = {*min_chromium_major, *max_chromium_major};
  candidate.appearance = std::move(parsed_appearance);
  candidate.assets = std::move(parsed_assets);
  *parsed_manifest = std::move(candidate);
  return TahaiSkinManifestValidationResult::kValid;
}

}  // namespace tahai
