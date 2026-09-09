// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_PACKAGE_H_
#define CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_PACKAGE_H_

#include <cstdint>
#include <string>
#include <string_view>

#include "base/containers/span.h"
#include "chrome/common/tahai_skins/tahai_skin_manifest.h"

namespace tahai {

// The sandboxed archive decoder reports the untrusted directory using this
// value type before extracting any bytes. It must set every link/reparse flag
// it can observe. A package is a flat collection of declared bounded raster
// assets; it contains no executable entry types.
struct TahaiSkinPackageEntry {
  std::string path;
  uint64_t compressed_size = 0;
  uint64_t uncompressed_size = 0;
  bool is_directory = false;
  bool is_symbolic_link = false;
  bool is_reparse_point = false;
};

enum class TahaiSkinPackageValidationResult {
  kValid,
  kInvalidManifest,
  kInvalidEntryCount,
  kUnsafeEntry,
  kUnexpectedEntry,
  kMissingEntry,
  kDuplicateEntry,
  kExceededLimits,
  kHashMismatch,
};

// Validates a package directory before extraction. This does not open a ZIP,
// follow a symlink, write a file, decode an image, or apply a skin. An archive
// decoder streams only validated entries into bounded memory, never paths.
TahaiSkinPackageValidationResult ValidateTahaiSkinPackageLayout(
    const TahaiSkinManifest& manifest,
    base::span<const TahaiSkinPackageEntry> entries);

// Verifies the bytes of a single already-bounded declared asset against the
// manifest's lowercase SHA-256 integrity field. This is not publisher
// authentication; package trust and signature verification remain separate.
TahaiSkinPackageValidationResult VerifyTahaiSkinPackageAssetBytes(
    const TahaiSkinManifest& manifest,
    std::string_view path,
    base::span<const uint8_t> bytes);

}  // namespace tahai

#endif  // CHROME_COMMON_TAHAI_SKINS_TAHAI_SKIN_PACKAGE_H_
