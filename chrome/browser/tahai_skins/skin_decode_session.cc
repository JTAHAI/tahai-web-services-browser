// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/skin_decode_session.h"

#include <algorithm>
#include <set>
#include <utility>

#include "base/compiler_specific.h"
#include "base/containers/span.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/location.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/grit/generated_resources.h"
#include "components/version_info/version_info.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/service_process_host.h"
#include "crypto/sha2.h"
#include "mojo/public/cpp/base/big_buffer.h"
#include "third_party/skia/include/core/SkColorSpace.h"
#include "third_party/skia/include/core/SkImageInfo.h"

namespace tahai::skins {
namespace {

constexpr auto kDecodeTimeout = base::Seconds(30);

SkinDecodeResult Revalidate(mojom::DecodedPackagePtr package) {
  SkinDecodeResult result{DecodeOutcome::kInvalidResponse, std::nullopt,
                          nullptr};
  if (!package || package->manifest_json.empty() ||
      package->manifest_json.size() > kMaxManifestBytes ||
      package->assets.empty() || package->assets.size() > kMaxAssets) {
    return result;
  }
  auto candidate = std::make_unique<DecodedSkin>();
  const auto value = base::JSONReader::ReadDict(package->manifest_json,
                                                base::JSON_PARSE_RFC, 16);
  if (!value ||
      ValidateTahaiSkinManifest(*value, &candidate->manifest) !=
          TahaiSkinManifestValidationResult::kValid ||
      package->assets.size() != candidate->manifest.assets.size()) {
    return result;
  }
  int major = 0;
  if (!base::StringToInt(version_info::GetMajorVersionNumber(), &major) ||
      major < candidate->manifest.compatibility.min_chromium_major ||
      major > candidate->manifest.compatibility.max_chromium_major) {
    result.outcome = DecodeOutcome::kIncompatible;
    return result;
  }
  std::set<std::string> paths;
  size_t total_pixels = 0;
  // Validate ALL output metadata before any browser-owned pixel allocation.
  // A compromised decoder is not a trusted SkBitmap/manifest deserializer.
  for (const auto& asset : package->assets) {
    if (!asset || !IsSafeTahaiSkinAssetPath(asset->path) ||
        !paths.insert(asset->path).second || asset->width == 0 ||
        asset->height == 0 || asset->width > kMaxImageDimension ||
        asset->height > kMaxImageDimension ||
        std::ranges::none_of(candidate->manifest.assets,
                             [&asset](const TahaiSkinAsset& declared) {
                               return declared.path == asset->path;
                             })) {
      return result;
    }
    const size_t size = static_cast<size_t>(asset->width) * asset->height * 4;
    if (size > kMaxDecodedAssetBytes ||
        size > kMaxDecodedPackageBytes - total_pixels ||
        asset->pixels.size() != size) {
      return result;
    }
    total_pixels += size;
  }
  for (const auto& asset : package->assets) {
    const size_t size = asset->pixels.size();
    const auto info = SkImageInfo::MakeN32Premul(asset->width, asset->height,
                                                 SkColorSpace::MakeSRGB());
    SkBitmap bitmap;
    if (!bitmap.tryAllocPixels(info, info.minRowBytes())) {
      return result;
    }
    // SAFETY: dimensions and tightly packed byte length were checked above;
    // tryAllocPixels succeeded for precisely this row size and height. Copy
    // sender-writable memory; never wrap/share its pointer with a browser View.
    UNSAFE_BUFFERS(base::span(static_cast<uint8_t*>(bitmap.getPixels()), size))
        .copy_from(base::span(asset->pixels));
    bitmap.setImmutable();
    candidate->assets.push_back({asset->path, std::move(bitmap)});
  }
  result.outcome = DecodeOutcome::kDecoded;
  candidate->manifest_json = std::move(package->manifest_json);
  result.skin = std::move(candidate);
  return result;
}

}  // namespace

SkinDecodeSession::SkinDecodeSession() {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
}

SkinDecodeSession::SkinDecodeSession(
    mojo::PendingRemote<mojom::SkinDecoder> test_decoder)
    : decoder_(std::move(test_decoder)) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
}

SkinDecodeSession::~SkinDecodeSession() {
  callback_.Reset();
  StopTransport();
}

void SkinDecodeSession::Decode(const std::string& archive, Callback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (std::exchange(used_, true)) {
    std::move(callback).Run(
        {DecodeOutcome::kAlreadyUsed, std::nullopt, nullptr});
    return;
  }
  callback_ = std::move(callback);
  if (archive.empty() || archive.size() > kMaxArchiveBytes) {
    Fail(archive.empty() ? DecodeOutcome::kRejected
                         : DecodeOutcome::kInputTooLarge);
    return;
  }
  archive_sha256_ = base::ToLowerASCII(
      base::HexEncode(crypto::SHA256Hash(base::as_byte_span(archive))));
  deadline_at_ = base::TimeTicks::Now() + kDecodeTimeout;
  if (!decoder_.is_bound()) {
    owned_process_ = base::MakeRefCounted<base::RefCountedData<OwnedProcess>>();
    decoder_ = content::ServiceProcessHost::Launch<mojom::SkinDecoder>(
        content::ServiceProcessHost::Options()
            .WithDisplayName(IDS_TAHAI_SKIN_DECODER_PROCESS_NAME)
            .WithProcessCallback(base::BindOnce(
                [](scoped_refptr<base::RefCountedData<OwnedProcess>> owned,
                   const base::Process& process) {
                  owned->data.process = process.Duplicate();
                  if (owned->data.stop_requested &&
                      owned->data.process.IsValid()) {
                    owned->data.process.Terminate(1, /*wait=*/false);
                    owned->data.process.Close();
                  }
                },
                owned_process_))
            .Pass());
  }
  decoder_.set_disconnect_handler(base::BindOnce(&SkinDecodeSession::Fail,
                                                 weak_factory_.GetWeakPtr(),
                                                 DecodeOutcome::kDisconnected));
  deadline_.Start(
      FROM_HERE, kDecodeTimeout,
      base::BindOnce(&SkinDecodeSession::Fail, weak_factory_.GetWeakPtr(),
                     DecodeOutcome::kTimeout));
  decoder_->Decode(mojo_base::BigBuffer(base::as_byte_span(archive)),
                   base::BindOnce(&SkinDecodeSession::OnDecoded,
                                  weak_factory_.GetWeakPtr()));
}

void SkinDecodeSession::OnDecoded(mojom::DecodeStatus status,
                                  mojom::DecodedPackagePtr package) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (base::TimeTicks::Now() >= deadline_at_) {
    Fail(DecodeOutcome::kTimeout);
    return;
  }
  if (status != mojom::DecodeStatus::kDecoded) {
    const auto outcome = package || status == mojom::DecodeStatus::kAlreadyUsed
                             ? DecodeOutcome::kInvalidResponse
                             : DecodeOutcome::kRejected;
    Finish({outcome, status, nullptr});
    return;
  }
  auto result = Revalidate(std::move(package));
  if (base::TimeTicks::Now() >= deadline_at_) {
    Fail(DecodeOutcome::kTimeout);
    return;
  }
  result.decoder_status = status;
  if (result.skin) {
    result.skin->archive_sha256 = archive_sha256_;
  }
  Finish(std::move(result));
}

void SkinDecodeSession::Fail(DecodeOutcome outcome) {
  Finish({outcome, std::nullopt, nullptr});
}

void SkinDecodeSession::Cancel() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  used_ = true;
  Fail(DecodeOutcome::kCancelled);
}

void SkinDecodeSession::Finish(SkinDecodeResult result) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  StopTransport();
  // Cleanup precedes the callback; it may synchronously destroy this owner.
  auto callback = std::move(callback_);
  if (callback) {
    std::move(callback).Run(std::move(result));
  }
}

void SkinDecodeSession::StopTransport() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  deadline_.Stop();
  weak_factory_.InvalidateWeakPtrs();
  decoder_.reset();
  if (owned_process_) {
    // The launch callback retains this stop bit if cancellation precedes the
    // process handle. Never terminate by process name or a caller-supplied PID.
    owned_process_->data.stop_requested = true;
    if (owned_process_->data.process.IsValid()) {
      owned_process_->data.process.Terminate(1, /*wait=*/false);
      owned_process_->data.process.Close();
    }
  }
  archive_sha256_.clear();
}

}  // namespace tahai::skins
