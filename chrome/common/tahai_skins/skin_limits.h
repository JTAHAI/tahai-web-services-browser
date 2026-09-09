// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_SKINS_SKIN_LIMITS_H_
#define CHROME_COMMON_TAHAI_SKINS_SKIN_LIMITS_H_

#include <cstddef>
#include <cstdint>

namespace tahai::skins {

inline constexpr size_t kMaxArchiveBytes = 9 * 1024 * 1024;
inline constexpr size_t kMaxManifestBytes = 64 * 1024;
inline constexpr size_t kMaxAssets = 16;
inline constexpr size_t kMaxEncodedAssetBytes = 4 * 1024 * 1024;
inline constexpr size_t kMaxEncodedPackageBytes = 8 * 1024 * 1024;
inline constexpr uint64_t kMaxCompressionRatio = 100;
inline constexpr uint32_t kMaxImageDimension = 2048;
inline constexpr size_t kMaxDecodedAssetBytes = 16 * 1024 * 1024;
inline constexpr size_t kMaxDecodedPackageBytes = 32 * 1024 * 1024;

}  // namespace tahai::skins

#endif  // CHROME_COMMON_TAHAI_SKINS_SKIN_LIMITS_H_
