// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PACK_BUNDLE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PACK_BUNDLE_H_

#include <array>
#include <cstddef>
#include <cstdint>
#include <string>
#include <string_view>

#include "base/containers/span.h"
#include "chrome/browser/ui/webui/tahai/tahai_pack_manifest.h"

namespace tahai {

inline constexpr size_t kTahaiPackMaximumManifestBytes = 32 * 1024;
inline constexpr size_t kTahaiPackEd25519SignatureBytes = 64;
inline constexpr size_t kTahaiPackEd25519PublicKeyBytes = 32;

// A trusted verification key is supplied by a separately governed browser or
// managed-policy source. A Pack cannot introduce or replace its own key.
struct TahaiPackTrustKey {
  std::string key_id;
  std::array<uint8_t, kTahaiPackEd25519PublicKeyBytes> public_key;
};

enum class TahaiPackBundleVerificationResult {
  kValid,
  kInvalidBundle,
  kInvalidManifest,
  kInvalidTrustStore,
  kUnknownSigningKey,
  kInvalidSignature,
};

// Parses an untrusted strict manifest only to select a known Ed25519 key, then
// authenticates its exact bytes before returning the accepted declaration. It
// neither fetches, installs, executes, nor persists a Pack. Callers must use
// the returned manifest, not a separately parsed copy of the untrusted bytes.
TahaiPackBundleVerificationResult VerifyTahaiSignedPackBundle(
    std::string_view serialized_manifest,
    base::span<const uint8_t> signature,
    base::span<const TahaiPackTrustKey> trusted_keys,
    TahaiPackManifest* verified_manifest);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PACK_BUNDLE_H_
