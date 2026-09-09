// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_MISSION_CAPSULE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_MISSION_CAPSULE_H_

#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/containers/span.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_envelope.h"

namespace tahai {

inline constexpr size_t kTahaiMissionCapsuleMaxBytes = 512 * 1024;

// Importable state intentionally omits source IDs, free-form title, times,
// evidence/timeline text, and ledger hashes. It is a bounded set of generated
// completion flags that can create a new local Mission only after an explicit
// operator action.
struct TahaiMissionCapsuleImport {
  std::string mission_type;
  std::string export_profile;
  std::vector<bool> checkpoint_complete;
  std::vector<bool> validation_complete;
  std::vector<bool> rollback_complete;
  size_t evidence_marker_count = 0;
};

// Builds an inspectable, sanitized capsule with an integrity digest. The digest
// detects accidental corruption; it is not a signature. Authenticity and
// confidentiality are provided only by SealTahaiMissionCapsule().
std::optional<std::string> BuildTahaiMissionCapsule(
    const MissionSummary& mission);

bool VerifyTahaiMissionCapsule(std::string_view serialized_capsule);

// Extracts only state that is safe to apply to a fresh generated local
// runbook. It must be called after decrypting an authenticated envelope; it
// never accepts or returns a Mission title, source ID, timeline, or raw
// evidence metadata.
std::optional<TahaiMissionCapsuleImport> ExtractTahaiMissionCapsuleImport(
    std::string_view serialized_capsule);

// Encrypts a sanitized capsule in the provider-neutral TAHAI Sync envelope.
// The caller owns key generation, recovery, and approved secure storage. This
// function does not enable a cloud provider or persist key material.
std::optional<std::string> SealTahaiMissionCapsule(
    const MissionSummary& mission,
    TahaiSyncProvider provider,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result);

// Creates a v2 envelope selected by a public, OS-protected local keyring ID.
// This is suitable for explicit same-profile clipboard/file handoff only; it
// does not transfer the key, enable recovery, or authorize cloud upload.
std::optional<std::string> SealTahaiMissionCapsuleWithKeyId(
    const MissionSummary& mission,
    TahaiSyncProvider provider,
    std::string_view key_id,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result);

std::optional<std::string> OpenTahaiMissionCapsule(
    std::string_view serialized_envelope,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_MISSION_CAPSULE_H_
