// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/common/tahai_skins/tahai_skin_package.h"

#include <algorithm>
#include <limits>
#include <string_view>

#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "crypto/sha2.h"

namespace tahai {
namespace {

constexpr uint64_t kMaximumSkinPackageEntries = skins::kMaxAssets;
constexpr uint64_t kMaximumSkinAssetBytes = skins::kMaxEncodedAssetBytes;
constexpr uint64_t kMaximumSkinPackageBytes = skins::kMaxEncodedPackageBytes;
constexpr uint64_t kMaximumCompressionRatio = skins::kMaxCompressionRatio;

bool IsSafeAssetPath(std::string_view value) {
  return IsSafeTahaiSkinAssetPath(value);
}

bool IsSha256(std::string_view value) {
  return value.size() == 64u &&
         std::all_of(value.begin(), value.end(), [](char character) {
           return (character >= '0' && character <= '9') ||
                  (character >= 'a' && character <= 'f');
         });
}

const TahaiSkinAsset* FindAsset(const TahaiSkinManifest& manifest,
                                std::string_view path) {
  const auto found = std::find_if(
      manifest.assets.begin(), manifest.assets.end(),
      [path](const TahaiSkinAsset& asset) { return asset.path == path; });
  return found == manifest.assets.end() ? nullptr : &*found;
}

bool HasManifestShape(const TahaiSkinManifest& manifest) {
  if (manifest.id.empty() || manifest.assets.empty() ||
      manifest.assets.size() > kMaximumSkinPackageEntries) {
    return false;
  }
  bool has_preview = false;
  for (const TahaiSkinAsset& asset : manifest.assets) {
    if (!IsSafeAssetPath(asset.path) || !IsSha256(asset.sha256) ||
        (asset.purpose != TahaiSkinAssetPurpose::kPreview &&
         asset.purpose != TahaiSkinAssetPurpose::kShellDecoration) ||
        (asset.purpose == TahaiSkinAssetPurpose::kPreview && has_preview) ||
        std::count_if(manifest.assets.begin(), manifest.assets.end(),
                      [&asset](const TahaiSkinAsset& candidate) {
                        return candidate.path == asset.path;
                      }) != 1u) {
      return false;
    }
    has_preview |= asset.purpose == TahaiSkinAssetPurpose::kPreview;
  }
  return has_preview;
}

bool EntryExceedsCompressionRatio(const TahaiSkinPackageEntry& entry) {
  if (entry.compressed_size == 0u || entry.uncompressed_size == 0u ||
      entry.compressed_size > kMaximumSkinPackageBytes) {
    return true;
  }
  return entry.uncompressed_size >
         entry.compressed_size * kMaximumCompressionRatio;
}

}  // namespace

TahaiSkinPackageValidationResult ValidateTahaiSkinPackageLayout(
    const TahaiSkinManifest& manifest,
    base::span<const TahaiSkinPackageEntry> entries) {
  if (!HasManifestShape(manifest)) {
    return TahaiSkinPackageValidationResult::kInvalidManifest;
  }
  if (entries.size() != manifest.assets.size() ||
      entries.size() > kMaximumSkinPackageEntries) {
    return TahaiSkinPackageValidationResult::kInvalidEntryCount;
  }

  uint64_t total_uncompressed_bytes = 0u;
  for (const TahaiSkinPackageEntry& entry : entries) {
    if (entry.is_directory || entry.is_symbolic_link ||
        entry.is_reparse_point) {
      return TahaiSkinPackageValidationResult::kUnsafeEntry;
    }
    // Validate the untrusted archive spelling independently of the manifest.
    // An entry that cannot be safely staged must not be reclassified as merely
    // undeclared, even when no manifest asset has that path.
    if (!IsSafeAssetPath(entry.path)) {
      return TahaiSkinPackageValidationResult::kUnsafeEntry;
    }
    if (entry.path.empty() ||
        entry.uncompressed_size > kMaximumSkinAssetBytes ||
        EntryExceedsCompressionRatio(entry)) {
      return TahaiSkinPackageValidationResult::kExceededLimits;
    }
    if (total_uncompressed_bytes >
        std::numeric_limits<uint64_t>::max() - entry.uncompressed_size) {
      return TahaiSkinPackageValidationResult::kExceededLimits;
    }
    total_uncompressed_bytes += entry.uncompressed_size;
    if (total_uncompressed_bytes > kMaximumSkinPackageBytes) {
      return TahaiSkinPackageValidationResult::kExceededLimits;
    }
    if (!FindAsset(manifest, entry.path)) {
      return TahaiSkinPackageValidationResult::kUnexpectedEntry;
    }
    const size_t duplicates = std::count_if(
        entries.begin(), entries.end(), [&entry](const auto& candidate) {
          return candidate.path == entry.path;
        });
    if (duplicates != 1u) {
      return TahaiSkinPackageValidationResult::kDuplicateEntry;
    }
  }

  for (const TahaiSkinAsset& asset : manifest.assets) {
    if (std::none_of(
            entries.begin(), entries.end(),
            [&asset](const auto& entry) { return entry.path == asset.path; })) {
      return TahaiSkinPackageValidationResult::kMissingEntry;
    }
  }
  return TahaiSkinPackageValidationResult::kValid;
}

TahaiSkinPackageValidationResult VerifyTahaiSkinPackageAssetBytes(
    const TahaiSkinManifest& manifest,
    std::string_view path,
    base::span<const uint8_t> bytes) {
  const TahaiSkinAsset* asset = FindAsset(manifest, path);
  if (!HasManifestShape(manifest) || !asset) {
    return TahaiSkinPackageValidationResult::kInvalidManifest;
  }
  if (bytes.empty() || bytes.size() > kMaximumSkinAssetBytes) {
    return TahaiSkinPackageValidationResult::kExceededLimits;
  }
  const std::string actual_hash =
      base::ToLowerASCII(base::HexEncode(crypto::SHA256Hash(bytes)));
  return actual_hash == asset->sha256
             ? TahaiSkinPackageValidationResult::kValid
             : TahaiSkinPackageValidationResult::kHashMismatch;
}

}  // namespace tahai
