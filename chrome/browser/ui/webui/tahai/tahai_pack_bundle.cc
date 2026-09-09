// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_pack_bundle.h"

#include <algorithm>
#include <optional>
#include <string_view>
#include <utility>

#include "base/json/json_reader.h"
#include "base/values.h"
#include "crypto/keypair.h"
#include "crypto/sign.h"

namespace tahai {
namespace {

bool IsSafeTrustKeyId(std::string_view value) {
  if (value.empty() || value.size() > 64u || value.front() == '-' ||
      value.back() == '-') {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '-';
  });
}

bool IsValidTrustStore(base::span<const TahaiPackTrustKey> trusted_keys) {
  if (trusted_keys.empty()) {
    return false;
  }
  for (auto current = trusted_keys.begin(); current != trusted_keys.end();
       ++current) {
    if (!IsSafeTrustKeyId(current->key_id) ||
        std::all_of(current->public_key.begin(), current->public_key.end(),
                    [](uint8_t value) { return value == 0; }) ||
        std::find_if(trusted_keys.begin(), current,
                     [current](const TahaiPackTrustKey& candidate) {
                       return candidate.key_id == current->key_id;
                     }) != current) {
      return false;
    }
  }
  return true;
}

}  // namespace

TahaiPackBundleVerificationResult VerifyTahaiSignedPackBundle(
    std::string_view serialized_manifest,
    base::span<const uint8_t> signature,
    base::span<const TahaiPackTrustKey> trusted_keys,
    TahaiPackManifest* verified_manifest) {
  if (!verified_manifest) {
    return TahaiPackBundleVerificationResult::kInvalidBundle;
  }
  *verified_manifest = TahaiPackManifest();
  if (serialized_manifest.empty() ||
      serialized_manifest.size() > kTahaiPackMaximumManifestBytes ||
      signature.size() != kTahaiPackEd25519SignatureBytes) {
    return TahaiPackBundleVerificationResult::kInvalidBundle;
  }

  std::optional<base::DictValue> untrusted_manifest =
      base::JSONReader::ReadDict(serialized_manifest, base::JSON_PARSE_RFC,
                                 /*max_depth=*/8);
  if (!untrusted_manifest) {
    return TahaiPackBundleVerificationResult::kInvalidManifest;
  }
  TahaiPackManifest parsed_manifest;
  if (ValidateTahaiPackManifest(*untrusted_manifest, &parsed_manifest) !=
      TahaiPackManifestValidationResult::kValid) {
    return TahaiPackBundleVerificationResult::kInvalidManifest;
  }

  // This source is governed separately from Pack data. A malformed or
  // ambiguous entry anywhere in it makes the whole trust decision unsafe;
  // do not select a convenient matching key and proceed.
  if (!IsValidTrustStore(trusted_keys)) {
    return TahaiPackBundleVerificationResult::kInvalidTrustStore;
  }

  const auto key_matches = [&parsed_manifest](const TahaiPackTrustKey& key) {
    return key.key_id == parsed_manifest.signing_key_id;
  };
  const auto trusted_key =
      std::find_if(trusted_keys.begin(), trusted_keys.end(), key_matches);
  if (trusted_key == trusted_keys.end()) {
    return TahaiPackBundleVerificationResult::kUnknownSigningKey;
  }
  const crypto::keypair::PublicKey public_key =
      crypto::keypair::PublicKey::FromEd25519PublicKey(trusted_key->public_key);
  if (!crypto::sign::Verify(crypto::sign::SignatureKind::ED25519, public_key,
                            base::as_byte_span(serialized_manifest),
                            signature)) {
    return TahaiPackBundleVerificationResult::kInvalidSignature;
  }
  *verified_manifest = std::move(parsed_manifest);
  return TahaiPackBundleVerificationResult::kValid;
}

}  // namespace tahai
