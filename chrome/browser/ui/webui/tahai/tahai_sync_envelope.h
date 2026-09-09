// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_ENVELOPE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_ENVELOPE_H_

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

#include "base/containers/span.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_contract.h"

namespace tahai {

inline constexpr size_t kTahaiSyncEnvelopeKeyBytes = 32;
inline constexpr size_t kTahaiSyncEnvelopeMaxPlaintextBytes = 4 * 1024 * 1024;

enum class TahaiSyncEnvelopeResult {
  kOk,
  kInvalidKey,
  kInvalidKeyId,
  kInvalidObjectId,
  kDisallowedObject,
  kExplicitOptInRequired,
  kPayloadTooLarge,
  kInvalidEnvelope,
  kAuthenticationFailed,
};

struct TahaiOpenedSyncEnvelope {
  TahaiSyncProvider provider;
  TahaiSyncObjectType object_type;
  std::string object_id;
  // Empty for legacy v1 envelopes. A v2 key ID is authenticated associated
  // data and selects a local retained key before decryption.
  std::string key_id;
  std::string plaintext;
};

// Creates a versioned AES-256-GCM envelope. Provider, object type, object ID,
// schema, and algorithm are authenticated as associated data. This function is
// intentionally transport-independent and does not enable an OAuth provider.
std::optional<std::string> SealTahaiSyncEnvelope(
    TahaiSyncProvider provider,
    TahaiSyncObjectType object_type,
    bool explicit_opt_in,
    std::string_view object_id,
    base::span<const uint8_t> key,
    std::string_view plaintext,
    TahaiSyncEnvelopeResult* result);

// Version-two envelope that authenticates an opaque 64-character key ID.
// It is intended for profile-owned keyrings and does not enable a provider.
std::optional<std::string> SealTahaiSyncEnvelopeWithKeyId(
    TahaiSyncProvider provider,
    TahaiSyncObjectType object_type,
    bool explicit_opt_in,
    std::string_view object_id,
    std::string_view key_id,
    base::span<const uint8_t> key,
    std::string_view plaintext,
    TahaiSyncEnvelopeResult* result);

// Reads only the finite v2 envelope header to choose an OS-protected local
// key. The key ID is untrusted until OpenTahaiSyncEnvelope authenticates it.
std::optional<std::string> GetTahaiSyncEnvelopeKeyId(
    std::string_view serialized_envelope);

// Parses and authenticates a version-one envelope. It rejects unknown fields,
// disallowed object classes, malformed identifiers, oversized ciphertext, and
// any metadata or ciphertext modification.
std::optional<TahaiOpenedSyncEnvelope> OpenTahaiSyncEnvelope(
    std::string_view serialized_envelope,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_ENVELOPE_H_
