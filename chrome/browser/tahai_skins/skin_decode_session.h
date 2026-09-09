// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_SKINS_SKIN_DECODE_SESSION_H_
#define CHROME_BROWSER_TAHAI_SKINS_SKIN_DECODE_SESSION_H_

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/ref_counted.h"
#include "base/memory/weak_ptr.h"
#include "base/process/process.h"
#include "base/sequence_checker.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/common/tahai_skins/tahai_skin_manifest.h"
#include "chrome/services/tahai_skins/public/mojom/skin_decoder.mojom.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/remote.h"
#include "third_party/skia/include/core/SkBitmap.h"

namespace tahai::skins {

struct DecodedSkinAsset {
  std::string path;
  SkBitmap bitmap;
};

// Browser-owned bounded values and copied immutable pixels only. Acceptance
// is NOT publisher authentication, install, selection, or permission to modify
// security surfaces. The profile owner must explicitly commit/apply it.
struct DecodedSkin {
  TahaiSkinManifest manifest;
  // Exact, bounded manifest accepted by browser-side revalidation, retained
  // with the original archive for later installed-package consistency checks.
  std::string manifest_json;
  std::string archive_sha256;
  std::vector<DecodedSkinAsset> assets;
};

enum class DecodeOutcome {
  kDecoded,
  kRejected,
  kInvalidResponse,
  kIncompatible,
  kInputTooLarge,
  kTimeout,
  kDisconnected,
  kCancelled,
  kAlreadyUsed,
};

struct SkinDecodeResult {
  DecodeOutcome outcome;
  std::optional<mojom::DecodeStatus> decoder_status;
  std::unique_ptr<DecodedSkin> skin;
};

// UI-sequence, single-use owner of ONE separately sandboxed utility. Never
// share across profiles. No filesystem/network access or mutation is exposed.
// Explicit Cancel delivers kCancelled once; destruction silently cancels the
// callback. All callbacks may destroy this owner.
class SkinDecodeSession final {
 public:
  using Callback = base::OnceCallback<void(SkinDecodeResult)>;

  SkinDecodeSession();
  explicit SkinDecodeSession(
      mojo::PendingRemote<mojom::SkinDecoder> test_decoder);
  ~SkinDecodeSession();
  SkinDecodeSession(const SkinDecodeSession&) = delete;
  SkinDecodeSession& operator=(const SkinDecodeSession&) = delete;

  void Decode(const std::string& archive, Callback callback);
  void Cancel();

 private:
  struct OwnedProcess {
    base::Process process;
    bool stop_requested = false;
  };

  void OnDecoded(mojom::DecodeStatus status, mojom::DecodedPackagePtr package);
  void Fail(DecodeOutcome outcome);
  void Finish(SkinDecodeResult result);
  void StopTransport();

  SEQUENCE_CHECKER(sequence_checker_);
  bool used_ = false;
  std::string archive_sha256_;
  scoped_refptr<base::RefCountedData<OwnedProcess>> owned_process_;
  mojo::Remote<mojom::SkinDecoder> decoder_;
  Callback callback_;
  base::TimeTicks deadline_at_;
  base::OneShotTimer deadline_;
  base::WeakPtrFactory<SkinDecodeSession> weak_factory_{this};
};

}  // namespace tahai::skins

#endif  // CHROME_BROWSER_TAHAI_SKINS_SKIN_DECODE_SESSION_H_
