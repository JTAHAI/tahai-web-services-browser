// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_SKINS_TAHAI_SKIN_SIGNATURE_H_
#define CHROME_BROWSER_TAHAI_SKINS_TAHAI_SKIN_SIGNATURE_H_

#include <array>
#include <cstdint>
#include <string>
#include <vector>

#include "base/values.h"
#include "chrome/browser/tahai_skins/skin_decode_session.h"

namespace tahai::skins {

inline constexpr size_t kTahaiSkinEd25519PublicKeyBytes = 32;
inline constexpr size_t kTahaiSkinEd25519SignatureBytes = 64;

// Trust keys come from mandatory browser policy or explicit native profile-local
// enrollment. A skin archive cannot add, select, or replace a trust key.
struct TahaiSkinTrustKey {
  std::string id;
  std::array<uint8_t, kTahaiSkinEd25519PublicKeyBytes> public_key;
};

enum class TahaiSkinSignatureResult {
  kValid,
  kInvalidInput,
  kMissingSignature,
  kUnknownKey,
  kInvalidSignature,
};

// Parses the strict public-key list {"keys":[{"id":...,"public_key":
// <64 lowercase hex characters>}]}. No partially valid policy is accepted.
bool ParseTahaiSkinTrustKeys(const base::DictValue& value,
                             std::vector<TahaiSkinTrustKey>* trusted_keys);

// Display identity only, not evidence that a key is trusted or an organization
// is who it claims to be. Callers must separately verify the package/policy.
std::string TahaiSkinPublicKeyFingerprint(const TahaiSkinTrustKey& key);

// Produces the versioned, deterministic Ed25519 preimage from the exact
// browser-side validated manifest bytes. The sandboxed decoder separately
// hashes every encoded asset against this signed manifest before it returns
// pixels to the browser process.
bool BuildTahaiSkinSignaturePayload(const DecodedSkin& skin,
                                    std::string* payload);

TahaiSkinSignatureResult VerifyTahaiSkinSignature(
    const DecodedSkin& skin,
    const std::vector<TahaiSkinTrustKey>& trusted_keys);

}  // namespace tahai::skins

#endif  // CHROME_BROWSER_TAHAI_SKINS_TAHAI_SKIN_SIGNATURE_H_
