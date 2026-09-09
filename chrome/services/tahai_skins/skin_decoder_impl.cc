// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/services/tahai_skins/skin_decoder_impl.h"

#include <algorithm>
#include <memory>
#include <set>
#include <string>
#include <utility>
#include <vector>

#include "base/containers/span.h"
#include "base/json/json_reader.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_skin_manifest.h"
#include "chrome/common/tahai_skins/tahai_skin_package.h"
#include "mojo/public/cpp/base/big_buffer.h"
#include "third_party/skia/include/codec/SkCodec.h"
#include "third_party/skia/include/codec/SkPngRustDecoder.h"
#include "third_party/skia/include/codec/SkWebpDecoder.h"
#include "third_party/skia/include/core/SkColorSpace.h"
#include "third_party/skia/include/core/SkImageInfo.h"
#include "third_party/skia/include/core/SkStream.h"
#include "third_party/zlib/google/zip_reader.h"

namespace tahai::skins {
namespace {

using Status = mojom::DecodeStatus;

bool IsSafeRegularEntry(const zip::ZipReader::Entry& entry) {
  // ZipReader intentionally normalizes names for general-purpose extraction.
  // For skins accept the literal name only, never its normalized replacement.
  // Reject alternate Unicode names, links and special types on EVERY host OS.
  constexpr uint32_t kPosixFileTypeMask = 0170000;
  constexpr uint32_t kPosixRegularFile = 0100000;
  constexpr uint32_t kWindowsDirectoryOrReparse = 0x10 | 0x400;
  const uint32_t posix_type =
      (entry.external_attributes >> 16) & kPosixFileTypeMask;
  return !entry.is_directory && !entry.is_unsafe && !entry.is_encrypted &&
         !entry.uses_aes_encryption && !entry.has_unicode_path_override &&
         (entry.external_attributes & kWindowsDirectoryOrReparse) == 0 &&
         (posix_type == 0 || posix_type == kPosixRegularFile) &&
         (entry.compression_method == 0 || entry.compression_method == 8) &&
         (entry.raw_path == "manifest.json" ||
          IsSafeTahaiSkinAssetPath(entry.raw_path));
}

bool IsBoundedEntry(const zip::ZipReader::Entry& entry, size_t limit) {
  return entry.original_size > 0 &&
         static_cast<uint64_t>(entry.original_size) <= limit &&
         entry.compressed_size > 0 &&
         entry.compressed_size <= kMaxArchiveBytes &&
         static_cast<uint64_t>(entry.original_size) <=
             entry.compressed_size * kMaxCompressionRatio;
}

mojom::DecodedAssetPtr DecodeRaster(const std::string& path,
                                    const std::string& bytes,
                                    size_t* total_pixels) {
  auto stream = std::make_unique<SkMemoryStream>(bytes.data(), bytes.size());
  SkCodec::Result result = SkCodec::kInvalidInput;
  std::unique_ptr<SkCodec> codec;
  // Explicit format selection: no SVG, ICO, JPEG, scriptable data or implicit
  // codec sniffing fallback. Extension and bytes must agree.
  if (path.ends_with(".png") &&
      SkPngRustDecoder::IsPng(bytes.data(), bytes.size())) {
    codec = SkPngRustDecoder::Decode(std::move(stream), &result);
  } else if (path.ends_with(".webp") &&
             SkWebpDecoder::IsWebp(bytes.data(), bytes.size())) {
    codec = SkWebpDecoder::Decode(std::move(stream), &result);
  }
  if (!codec || result != SkCodec::kSuccess) {
    return nullptr;
  }
  const SkImageInfo info = codec->getInfo()
                               .makeColorType(kN32_SkColorType)
                               .makeAlphaType(kPremul_SkAlphaType)
                               .makeColorSpace(SkColorSpace::MakeSRGB());
  if (info.width() <= 0 || info.height() <= 0 ||
      info.width() > static_cast<int>(kMaxImageDimension) ||
      info.height() > static_cast<int>(kMaxImageDimension) ||
      codec->isAnimated() != SkCodec::IsAnimated::kNo ||
      codec->getFrameCount() != 1) {
    return nullptr;
  }
  // Check dimensions before a pixel allocation/decode, not after a potentially
  // huge decode followed by rescaling. Tightly packed rows have no padding.
  const size_t pixel_bytes = static_cast<size_t>(info.width()) *
                             static_cast<size_t>(info.height()) * 4;
  if (pixel_bytes > kMaxDecodedAssetBytes ||
      pixel_bytes > kMaxDecodedPackageBytes - *total_pixels) {
    return nullptr;
  }
  auto asset = mojom::DecodedAsset::New();
  asset->path = path;
  asset->width = info.width();
  asset->height = info.height();
  asset->pixels = mojo_base::BigBuffer(pixel_bytes);
  std::ranges::fill(base::span(asset->pixels), 0);
  if (codec->getPixels(info, asset->pixels.data(), info.minRowBytes()) !=
      SkCodec::kSuccess) {
    return nullptr;
  }
  *total_pixels += pixel_bytes;
  return asset;
}

Status DecodeArchive(const std::string& archive,
                     mojom::DecodedPackagePtr* decoded) {
  zip::ZipReader directory;
  if (!directory.OpenFromString(archive) || directory.num_entries() < 2 ||
      static_cast<size_t>(directory.num_entries()) > kMaxAssets + 1) {
    return Status::kInvalidArchive;
  }
  std::set<std::string> names;
  std::vector<TahaiSkinPackageEntry> inventory;
  std::string manifest_json;
  for (const zip::ZipReader::Entry* entry = directory.Next(); entry;
       entry = directory.Next()) {
    if (names.size() >= kMaxAssets + 1 || !IsSafeRegularEntry(*entry) ||
        !names.insert(entry->raw_path).second) {
      return Status::kUnsafeEntry;
    }
    const bool manifest_entry = entry->raw_path == "manifest.json";
    if (!IsBoundedEntry(*entry, manifest_entry ? kMaxManifestBytes
                                               : kMaxEncodedAssetBytes)) {
      return Status::kExceededLimits;
    }
    if (manifest_entry) {
      if (!directory.ExtractCurrentEntryToString(kMaxManifestBytes,
                                                 &manifest_json) ||
          manifest_json.size() != static_cast<uint64_t>(entry->original_size)) {
        return Status::kInvalidArchive;
      }
    } else {
      inventory.push_back({entry->raw_path, entry->compressed_size,
                           static_cast<uint64_t>(entry->original_size)});
    }
  }
  if (!directory.ok() ||
      names.size() != static_cast<size_t>(directory.num_entries())) {
    return Status::kInvalidArchive;
  }
  const auto value =
      base::JSONReader::ReadDict(manifest_json, base::JSON_PARSE_RFC, 16);
  TahaiSkinManifest manifest;
  if (!value || ValidateTahaiSkinManifest(*value, &manifest) !=
                    TahaiSkinManifestValidationResult::kValid) {
    return Status::kInvalidManifest;
  }
  if (ValidateTahaiSkinPackageLayout(manifest, inventory) !=
      TahaiSkinPackageValidationResult::kValid) {
    return Status::kInvalidInventory;
  }

  // The archive is our immutable copy, not caller-writable shared memory. No
  // asset is extracted until the ENTIRE inventory and manifest are accepted.
  zip::ZipReader reader;
  if (!reader.OpenFromString(archive)) {
    return Status::kInvalidArchive;
  }
  auto candidate = mojom::DecodedPackage::New();
  candidate->manifest_json = std::move(manifest_json);
  size_t total_pixels = 0;
  for (const zip::ZipReader::Entry* entry = reader.Next(); entry;
       entry = reader.Next()) {
    if (entry->raw_path == "manifest.json") {
      continue;
    }
    std::string bytes;
    if (!reader.ExtractCurrentEntryToString(kMaxEncodedAssetBytes, &bytes) ||
        bytes.size() != static_cast<uint64_t>(entry->original_size)) {
      return Status::kInvalidArchive;
    }
    if (VerifyTahaiSkinPackageAssetBytes(manifest, entry->raw_path,
                                         base::as_byte_span(bytes)) !=
        TahaiSkinPackageValidationResult::kValid) {
      return Status::kHashMismatch;
    }
    auto asset = DecodeRaster(entry->raw_path, bytes, &total_pixels);
    if (!asset) {
      return Status::kInvalidImage;
    }
    candidate->assets.push_back(std::move(asset));
  }
  if (!reader.ok() || candidate->assets.size() != manifest.assets.size()) {
    return Status::kInvalidArchive;
  }
  *decoded = std::move(candidate);
  return Status::kDecoded;
}

}  // namespace

SkinDecoderImpl::SkinDecoderImpl(
    mojo::PendingReceiver<mojom::SkinDecoder> receiver)
    : receiver_(this, std::move(receiver)) {}

SkinDecoderImpl::~SkinDecoderImpl() = default;

void SkinDecoderImpl::Decode(mojo_base::BigBuffer archive,
                             DecodeCallback callback) {
  if (std::exchange(used_, true)) {
    std::move(callback).Run(Status::kAlreadyUsed, nullptr);
    return;
  }
  if (archive.size() > kMaxArchiveBytes) {
    std::move(callback).Run(Status::kInputTooLarge, nullptr);
    return;
  }
  // Copy BEFORE parsing: the sender may retain a writable shared-memory view.
  const std::string immutable_archive(archive.begin(), archive.end());
  mojom::DecodedPackagePtr package;
  const Status status = DecodeArchive(immutable_archive, &package);
  std::move(callback).Run(status, std::move(package));
}

}  // namespace tahai::skins
