// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/tahai_skin_signature.h"

#include <algorithm>
#include <limits>
#include <set>
#include <string_view>

#include "base/containers/span.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "crypto/keypair.h"
#include "crypto/hash.h"
#include "crypto/sign.h"

namespace tahai::skins {
namespace {

constexpr char kSkinSignatureDomain[] = "TAHAI-SKIN-SIGNATURE-V1\0";

bool IsSafeKeyId(std::string_view value) {
  return !value.empty() && value.size() <= 64u && value.front() != '-' &&
         value.back() != '-' &&
         std::ranges::all_of(value, [](char character) {
           return (character >= 'a' && character <= 'z') ||
                  (character >= '0' && character <= '9') ||
                  character == '-';
         });
}

bool AppendUint32(uint32_t value, std::string* payload) {
  if (!payload || payload->size() > kMaxDecodedPackageBytes - 4u) {
    return false;
  }
  for (int byte = 3; byte >= 0; --byte) {
    payload->push_back(static_cast<char>((value >> (byte * 8)) & 0xff));
  }
  return true;
}

bool AppendField(std::string_view value, std::string* payload) {
  if (value.size() > std::numeric_limits<uint32_t>::max() ||
      !AppendUint32(static_cast<uint32_t>(value.size()), payload) ||
      value.size() > kMaxDecodedPackageBytes - payload->size()) {
    return false;
  }
  payload->append(value);
  return true;
}

bool IsValidTrustStore(const std::vector<TahaiSkinTrustKey>& trusted_keys) {
  if (trusted_keys.empty() || trusted_keys.size() > 32u) {
    return false;
  }
  std::set<std::string> ids;
  for (const TahaiSkinTrustKey& key : trusted_keys) {
    if (!IsSafeKeyId(key.id) || !ids.insert(key.id).second ||
        std::ranges::all_of(key.public_key,
                            [](uint8_t byte) { return byte == 0; })) {
      return false;
    }
  }
  return true;
}

}  // namespace

bool ParseTahaiSkinTrustKeys(const base::DictValue& value,
                             std::vector<TahaiSkinTrustKey>* trusted_keys) {
  if (!trusted_keys) {
    return false;
  }
  trusted_keys->clear();
  const base::ListValue* keys = value.FindList("keys");
  if (!keys || keys->empty() || keys->size() > 32u || value.size() != 1u) {
    return false;
  }
  for (const base::Value& entry : *keys) {
    const base::DictValue* key = entry.GetIfDict();
    if (!key || key->size() != 2u) {
      trusted_keys->clear();
      return false;
    }
    const std::string* id = key->FindString("id");
    const std::string* encoded_key = key->FindString("public_key");
    std::vector<uint8_t> key_bytes;
    if (!id || !encoded_key || !IsSafeKeyId(*id) ||
        encoded_key->size() != kTahaiSkinEd25519PublicKeyBytes * 2u ||
        !std::ranges::all_of(*encoded_key, [](char c) {
          return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
        }) ||
        !base::HexStringToBytes(*encoded_key, &key_bytes) ||
        key_bytes.size() != kTahaiSkinEd25519PublicKeyBytes) {
      trusted_keys->clear();
      return false;
    }
    TahaiSkinTrustKey parsed{.id = *id};
    std::copy(key_bytes.begin(), key_bytes.end(), parsed.public_key.begin());
    trusted_keys->push_back(std::move(parsed));
  }
  if (!IsValidTrustStore(*trusted_keys)) {
    trusted_keys->clear();
    return false;
  }
  return true;
}

std::string TahaiSkinPublicKeyFingerprint(const TahaiSkinTrustKey& key) {
  return base::ToLowerASCII(base::HexEncode(crypto::hash::Sha256(key.public_key)));
}

bool BuildTahaiSkinSignaturePayload(const DecodedSkin& skin,
                                    std::string* payload) {
  if (!payload || skin.manifest_json.empty() ||
      skin.manifest_json.size() > kMaxManifestBytes) {
    return false;
  }
  // Keep the explicit NUL in the domain separator but exclude the compiler's
  // trailing string terminator.
  payload->assign(kSkinSignatureDomain, sizeof(kSkinSignatureDomain) - 1u);
  if (!AppendField(skin.manifest_json, payload)) {
    payload->clear();
    return false;
  }
  return true;
}

TahaiSkinSignatureResult VerifyTahaiSkinSignature(
    const DecodedSkin& skin,
    const std::vector<TahaiSkinTrustKey>& trusted_keys) {
  if (skin.signing_key_id.empty() || skin.signature.empty()) {
    return TahaiSkinSignatureResult::kMissingSignature;
  }
  if (!IsSafeKeyId(skin.signing_key_id) ||
      skin.signature.size() != kTahaiSkinEd25519SignatureBytes ||
      !IsValidTrustStore(trusted_keys)) {
    return TahaiSkinSignatureResult::kInvalidInput;
  }
  std::string payload;
  if (!BuildTahaiSkinSignaturePayload(skin, &payload)) {
    return TahaiSkinSignatureResult::kInvalidInput;
  }
  const auto trusted = std::ranges::find(
      trusted_keys, skin.signing_key_id, &TahaiSkinTrustKey::id);
  if (trusted == trusted_keys.end()) {
    return TahaiSkinSignatureResult::kUnknownKey;
  }
  const crypto::keypair::PublicKey public_key =
      crypto::keypair::PublicKey::FromEd25519PublicKey(trusted->public_key);
  return crypto::sign::Verify(crypto::sign::SignatureKind::ED25519, public_key,
                              base::as_byte_span(payload), skin.signature)
             ? TahaiSkinSignatureResult::kValid
             : TahaiSkinSignatureResult::kInvalidSignature;
}

}  // namespace tahai::skins
