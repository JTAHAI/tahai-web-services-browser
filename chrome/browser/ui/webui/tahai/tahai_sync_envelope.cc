// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_sync_envelope.h"

#include <algorithm>
#include <array>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/base64.h"
#include "base/containers/span.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/values.h"
#include "crypto/aead.h"
#include "crypto/random.h"

namespace tahai {
namespace {

constexpr int kLegacyEnvelopeSchemaVersion = 1;
constexpr int kKeyedEnvelopeSchemaVersion = 2;
constexpr std::string_view kEnvelopeKind = "tahai-sync-envelope";
constexpr std::string_view kEnvelopeAlgorithm = "AES-256-GCM";
constexpr size_t kLegacyEnvelopeFieldCount = 8;
constexpr size_t kKeyedEnvelopeFieldCount = 9;
constexpr size_t kMaxObjectIdBytes = 128;
constexpr size_t kKeyIdBytes = 64;
constexpr size_t kMaxSerializedEnvelopeBytes =
    (kTahaiSyncEnvelopeMaxPlaintextBytes * 2) + 4096;

void SetResult(TahaiSyncEnvelopeResult* output,
               TahaiSyncEnvelopeResult result) {
  if (output) {
    *output = result;
  }
}

bool IsValidObjectId(std::string_view object_id) {
  if (object_id.empty() || object_id.size() > kMaxObjectIdBytes ||
      !base::IsStringASCII(object_id)) {
    return false;
  }
  for (char character : object_id) {
    if (!base::IsAsciiAlpha(character) && !base::IsAsciiDigit(character) &&
        character != '-' && character != '_' && character != '.' &&
        character != ':') {
      return false;
    }
  }
  return true;
}

bool IsValidKeyId(std::string_view key_id) {
  if (key_id.size() != kKeyIdBytes || !base::IsStringASCII(key_id)) {
    return false;
  }
  return std::ranges::all_of(key_id, [](char character) {
    return base::IsAsciiDigit(character) ||
           (character >= 'a' && character <= 'f');
  });
}

std::optional<TahaiSyncProvider> ProviderFromName(std::string_view name) {
  for (TahaiSyncProvider provider : {TahaiSyncProvider::kLocalProfile,
                                     TahaiSyncProvider::kGoogleDriveAppData,
                                     TahaiSyncProvider::kOneDriveAppFolder}) {
    if (TahaiSyncProviderName(provider) == name) {
      return provider;
    }
  }
  return std::nullopt;
}

std::optional<TahaiSyncObjectType> ObjectTypeFromName(std::string_view name) {
  for (const TahaiSyncDataPolicy& policy : GetTahaiSyncDataPolicies()) {
    if (TahaiSyncObjectTypeName(policy.object_type) == name) {
      return policy.object_type;
    }
  }
  return std::nullopt;
}

std::string AssociatedData(TahaiSyncProvider provider,
                           TahaiSyncObjectType object_type,
                           std::string_view object_id,
                           int schema_version,
                           std::string_view key_id) {
  if (schema_version == kLegacyEnvelopeSchemaVersion) {
    return base::StrCat({kEnvelopeKind, "|1|", TahaiSyncProviderName(provider),
                         "|", TahaiSyncObjectTypeName(object_type), "|",
                         object_id, "|", kEnvelopeAlgorithm});
  }
  return base::StrCat({kEnvelopeKind, "|", base::NumberToString(schema_version),
                       "|", TahaiSyncProviderName(provider), "|",
                       TahaiSyncObjectTypeName(object_type), "|", object_id,
                       "|", key_id, "|", kEnvelopeAlgorithm});
}

TahaiSyncEnvelopeResult ValidateObjectPolicy(TahaiSyncObjectType object_type,
                                             bool explicit_opt_in) {
  const TahaiSyncDataPolicy* policy = FindTahaiSyncDataPolicy(object_type);
  if (!policy || policy->inclusion == TahaiSyncInclusion::kNever) {
    return TahaiSyncEnvelopeResult::kDisallowedObject;
  }
  if (policy->inclusion == TahaiSyncInclusion::kExplicitOptIn &&
      !explicit_opt_in) {
    return TahaiSyncEnvelopeResult::kExplicitOptInRequired;
  }
  return TahaiSyncEnvelopeResult::kOk;
}

// A key id is intentionally exposed ahead of authenticated decryption so the
// caller can select one of its small, local retained keys.  Do not use an
// arbitrary value from a JSON dictionary for that lookup: require the complete
// authenticated-header shape first.  The AEAD still authenticates every one of
// these fields before the payload is returned.
bool HasRecognizedKeyedEnvelopeHeader(const base::DictValue& envelope) {
  if (envelope.size() != kKeyedEnvelopeFieldCount ||
      envelope.FindInt("schema_version") != kKeyedEnvelopeSchemaVersion) {
    return false;
  }
  const std::string* kind = envelope.FindString("kind");
  const std::string* algorithm = envelope.FindString("algorithm");
  const std::string* provider_name = envelope.FindString("provider");
  const std::string* object_type_name = envelope.FindString("object_type");
  const std::string* object_id = envelope.FindString("object_id");
  const std::string* key_id = envelope.FindString("key_id");
  const std::string* nonce = envelope.FindString("nonce");
  const std::string* ciphertext = envelope.FindString("ciphertext");
  const std::optional<TahaiSyncProvider> provider =
      provider_name ? ProviderFromName(*provider_name) : std::nullopt;
  const std::optional<TahaiSyncObjectType> object_type =
      object_type_name ? ObjectTypeFromName(*object_type_name) : std::nullopt;
  return kind && *kind == kEnvelopeKind && algorithm &&
         *algorithm == kEnvelopeAlgorithm && provider && object_type &&
         ValidateObjectPolicy(*object_type, /*explicit_opt_in=*/true) ==
             TahaiSyncEnvelopeResult::kOk &&
         object_id && IsValidObjectId(*object_id) && key_id &&
         IsValidKeyId(*key_id) && nonce && !nonce->empty() && ciphertext &&
         !ciphertext->empty();
}

std::optional<std::string> SealEnvelope(TahaiSyncProvider provider,
                                        TahaiSyncObjectType object_type,
                                        bool explicit_opt_in,
                                        std::string_view object_id,
                                        std::string_view key_id,
                                        base::span<const uint8_t> key,
                                        std::string_view plaintext,
                                        TahaiSyncEnvelopeResult* result) {
  SetResult(result, TahaiSyncEnvelopeResult::kInvalidEnvelope);
  if (key.size() != kTahaiSyncEnvelopeKeyBytes) {
    SetResult(result, TahaiSyncEnvelopeResult::kInvalidKey);
    return std::nullopt;
  }
  if (!FindTahaiSyncProviderContract(provider)) {
    return std::nullopt;
  }
  if (!IsValidObjectId(object_id)) {
    SetResult(result, TahaiSyncEnvelopeResult::kInvalidObjectId);
    return std::nullopt;
  }
  const int schema_version = key_id.empty() ? kLegacyEnvelopeSchemaVersion
                                            : kKeyedEnvelopeSchemaVersion;
  if (schema_version == kKeyedEnvelopeSchemaVersion && !IsValidKeyId(key_id)) {
    SetResult(result, TahaiSyncEnvelopeResult::kInvalidKeyId);
    return std::nullopt;
  }
  const TahaiSyncEnvelopeResult policy_result =
      ValidateObjectPolicy(object_type, explicit_opt_in);
  if (policy_result != TahaiSyncEnvelopeResult::kOk) {
    SetResult(result, policy_result);
    return std::nullopt;
  }
  if (plaintext.size() > kTahaiSyncEnvelopeMaxPlaintextBytes) {
    SetResult(result, TahaiSyncEnvelopeResult::kPayloadTooLarge);
    return std::nullopt;
  }

  const std::vector<uint8_t> nonce = crypto::RandBytesAsVector(
      crypto::aead::NonceSizeFor(crypto::aead::AES_256_GCM));
  const std::string associated_data =
      AssociatedData(provider, object_type, object_id, schema_version, key_id);
  const std::vector<uint8_t> ciphertext = crypto::aead::Seal(
      crypto::aead::AES_256_GCM, key, base::as_byte_span(plaintext), nonce,
      base::as_byte_span(associated_data));

  base::DictValue envelope;
  envelope.Set("kind", kEnvelopeKind);
  envelope.Set("schema_version", schema_version);
  envelope.Set("algorithm", kEnvelopeAlgorithm);
  envelope.Set("provider", TahaiSyncProviderName(provider));
  envelope.Set("object_type", TahaiSyncObjectTypeName(object_type));
  envelope.Set("object_id", object_id);
  if (schema_version == kKeyedEnvelopeSchemaVersion) {
    envelope.Set("key_id", key_id);
  }
  envelope.Set("nonce", base::Base64Encode(nonce));
  envelope.Set("ciphertext", base::Base64Encode(ciphertext));

  std::string serialized;
  if (!base::JSONWriter::Write(envelope, &serialized)) {
    return std::nullopt;
  }
  SetResult(result, TahaiSyncEnvelopeResult::kOk);
  return serialized;
}

}  // namespace

std::optional<std::string> SealTahaiSyncEnvelope(
    TahaiSyncProvider provider,
    TahaiSyncObjectType object_type,
    bool explicit_opt_in,
    std::string_view object_id,
    base::span<const uint8_t> key,
    std::string_view plaintext,
    TahaiSyncEnvelopeResult* result) {
  return SealEnvelope(provider, object_type, explicit_opt_in, object_id,
                      std::string_view(), key, plaintext, result);
}

std::optional<std::string> SealTahaiSyncEnvelopeWithKeyId(
    TahaiSyncProvider provider,
    TahaiSyncObjectType object_type,
    bool explicit_opt_in,
    std::string_view object_id,
    std::string_view key_id,
    base::span<const uint8_t> key,
    std::string_view plaintext,
    TahaiSyncEnvelopeResult* result) {
  return SealEnvelope(provider, object_type, explicit_opt_in, object_id, key_id,
                      key, plaintext, result);
}

std::optional<std::string> GetTahaiSyncEnvelopeKeyId(
    std::string_view serialized_envelope) {
  if (serialized_envelope.empty() ||
      serialized_envelope.size() > kMaxSerializedEnvelopeBytes) {
    return std::nullopt;
  }
  std::optional<base::DictValue> envelope = base::JSONReader::ReadDict(
      serialized_envelope, base::JSON_PARSE_RFC, /*max_depth=*/4);
  if (!envelope || !HasRecognizedKeyedEnvelopeHeader(*envelope)) {
    return std::nullopt;
  }
  const std::string* key_id = envelope->FindString("key_id");
  return std::optional(*key_id);
}

std::optional<TahaiOpenedSyncEnvelope> OpenTahaiSyncEnvelope(
    std::string_view serialized_envelope,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result) {
  SetResult(result, TahaiSyncEnvelopeResult::kInvalidEnvelope);
  if (key.size() != kTahaiSyncEnvelopeKeyBytes) {
    SetResult(result, TahaiSyncEnvelopeResult::kInvalidKey);
    return std::nullopt;
  }
  if (serialized_envelope.empty() ||
      serialized_envelope.size() > kMaxSerializedEnvelopeBytes) {
    return std::nullopt;
  }
  std::optional<base::DictValue> envelope = base::JSONReader::ReadDict(
      serialized_envelope, base::JSON_PARSE_RFC, /*max_depth=*/4);
  if (!envelope) {
    return std::nullopt;
  }
  const std::string* kind = envelope->FindString("kind");
  const std::optional<int> schema_version = envelope->FindInt("schema_version");
  const std::string* algorithm = envelope->FindString("algorithm");
  const std::string* provider_name = envelope->FindString("provider");
  const std::string* object_type_name = envelope->FindString("object_type");
  const std::string* object_id = envelope->FindString("object_id");
  const std::string* nonce_base64 = envelope->FindString("nonce");
  const std::string* ciphertext_base64 = envelope->FindString("ciphertext");
  const bool is_legacy = schema_version == kLegacyEnvelopeSchemaVersion;
  const bool is_keyed = schema_version == kKeyedEnvelopeSchemaVersion;
  const std::string* key_id = envelope->FindString("key_id");
  if ((!is_legacy && !is_keyed) ||
      envelope->size() !=
          (is_keyed ? kKeyedEnvelopeFieldCount : kLegacyEnvelopeFieldCount) ||
      !kind || *kind != kEnvelopeKind || !algorithm ||
      *algorithm != kEnvelopeAlgorithm || !provider_name || !object_type_name ||
      !object_id || !IsValidObjectId(*object_id) || !nonce_base64 ||
      !ciphertext_base64 || (is_keyed && (!key_id || !IsValidKeyId(*key_id))) ||
      (is_legacy && key_id)) {
    return std::nullopt;
  }
  const std::optional<TahaiSyncProvider> provider =
      ProviderFromName(*provider_name);
  const std::optional<TahaiSyncObjectType> object_type =
      ObjectTypeFromName(*object_type_name);
  if (!provider || !object_type ||
      ValidateObjectPolicy(*object_type, /*explicit_opt_in=*/true) !=
          TahaiSyncEnvelopeResult::kOk) {
    return std::nullopt;
  }
  const std::optional<std::vector<uint8_t>> nonce =
      base::Base64Decode(*nonce_base64);
  const std::optional<std::vector<uint8_t>> ciphertext =
      base::Base64Decode(*ciphertext_base64);
  if (!nonce ||
      nonce->size() != crypto::aead::NonceSizeFor(crypto::aead::AES_256_GCM) ||
      !ciphertext ||
      ciphertext->size() > kTahaiSyncEnvelopeMaxPlaintextBytes + 64) {
    return std::nullopt;
  }

  const std::string associated_data =
      AssociatedData(*provider, *object_type, *object_id, *schema_version,
                     is_keyed ? *key_id : std::string_view());
  std::optional<std::vector<uint8_t>> plaintext =
      crypto::aead::Open(crypto::aead::AES_256_GCM, key, *ciphertext, *nonce,
                         base::as_byte_span(associated_data));
  if (!plaintext) {
    SetResult(result, TahaiSyncEnvelopeResult::kAuthenticationFailed);
    return std::nullopt;
  }

  SetResult(result, TahaiSyncEnvelopeResult::kOk);
  return TahaiOpenedSyncEnvelope{
      .provider = *provider,
      .object_type = *object_type,
      .object_id = *object_id,
      .key_id = is_keyed ? *key_id : std::string(),
      .plaintext = std::string(base::as_string_view(*plaintext)),
  };
}

}  // namespace tahai
