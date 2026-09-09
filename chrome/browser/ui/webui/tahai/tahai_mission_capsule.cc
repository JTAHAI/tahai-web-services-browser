// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_mission_capsule.h"

#include <algorithm>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/values.h"
#include "crypto/secure_util.h"
#include "crypto/sha2.h"

namespace tahai {
namespace {

constexpr int kCapsuleSchemaVersion = 2;
constexpr std::string_view kCapsuleKind = "tahai-mission-capsule";
constexpr size_t kCapsuleFieldCount = 16;
constexpr size_t kMaximumImportedSteps = 8;
constexpr size_t kMaximumImportedEvidenceMarkers = 12;

std::string CapsuleDigest(std::string_view canonical_body) {
  return base::HexEncode(crypto::SHA256HashString(canonical_body));
}

bool IsDigest(std::string_view value) {
  return value.size() == 64 &&
         std::all_of(value.begin(), value.end(), [](char character) {
           return base::IsHexDigit(character);
         });
}

bool HasExpectedCapsuleShape(const base::DictValue& capsule) {
  const std::string* kind = capsule.FindString("kind");
  return capsule.size() == kCapsuleFieldCount &&
         capsule.FindInt("schema_version") == kCapsuleSchemaVersion && kind &&
         *kind == kCapsuleKind && capsule.FindString("mission_id") &&
         capsule.FindBool("mission_label_included") == false &&
         capsule.FindString("mission_type") &&
         capsule.FindString("created_at") && capsule.FindString("updated_at") &&
         capsule.FindString("export_profile") &&
         capsule.FindBool("timeline_integrity_verified").has_value() &&
         capsule.FindBool("archived").has_value() &&
         capsule.FindList("checkpoints") && capsule.FindList("validation") &&
         capsule.FindList("rollback") && capsule.FindList("evidence_markers") &&
         capsule.FindList("timeline") && capsule.FindString("integrity_sha256");
}

std::optional<std::vector<bool>> ExtractCompletionStates(
    const base::ListValue* entries) {
  if (!entries || entries->size() > kMaximumImportedSteps) {
    return std::nullopt;
  }
  std::vector<bool> states;
  states.reserve(entries->size());
  for (const base::Value& entry_value : *entries) {
    const base::DictValue* entry = entry_value.GetIfDict();
    const std::string* label = entry ? entry->FindString("label") : nullptr;
    const std::optional<bool> complete =
        entry ? entry->FindBool("complete") : std::nullopt;
    if (!entry || entry->size() != 2u || !label || label->empty() ||
        label->size() > 128u || !complete) {
      return std::nullopt;
    }
    states.push_back(*complete);
  }
  return states;
}

bool HasBoundedEvidenceShape(const base::ListValue* entries) {
  if (!entries || entries->size() > kMaximumImportedEvidenceMarkers) {
    return false;
  }
  for (const base::Value& entry_value : *entries) {
    const base::DictValue* entry = entry_value.GetIfDict();
    const std::string* label = entry ? entry->FindString("label") : nullptr;
    const std::string* scope =
        entry ? entry->FindString("capture_scope") : nullptr;
    const std::string* captured_at =
        entry ? entry->FindString("captured_at") : nullptr;
    if (!entry || entry->size() != 3u || !label || label->empty() ||
        label->size() > 128u || !scope || scope->size() > 128u ||
        !captured_at || captured_at->empty() || captured_at->size() > 32u) {
      return false;
    }
  }
  return true;
}

}  // namespace

std::optional<std::string> BuildTahaiMissionCapsule(
    const MissionSummary& mission) {
  // The free-form mission title is deliberately absent. Every included field
  // comes from the bounded Mission schema and contains no browsing session,
  // URL, cookie, header, credential, screenshot, path, or page data.
  base::DictValue capsule;
  capsule.Set("schema_version", kCapsuleSchemaVersion);
  capsule.Set("kind", kCapsuleKind);
  capsule.Set("mission_id", mission.id);
  capsule.Set("mission_label_included", false);
  capsule.Set("mission_type", mission.type);
  capsule.Set("created_at", mission.created_at);
  capsule.Set("updated_at", mission.updated_at);
  capsule.Set("export_profile", mission.export_profile);
  capsule.Set("timeline_integrity_verified",
              mission.timeline_integrity_verified);
  capsule.Set("archived", mission.archived);

  const auto add_steps = [&capsule](std::string_view key,
                                    const std::vector<MissionStep>& steps) {
    base::ListValue values;
    for (const MissionStep& step : steps) {
      base::DictValue value;
      value.Set("label", step.label);
      value.Set("complete", step.complete);
      values.Append(std::move(value));
    }
    capsule.Set(key, std::move(values));
  };
  add_steps("checkpoints", mission.steps);
  add_steps("validation", mission.validation_steps);
  add_steps("rollback", mission.rollback_steps);

  base::ListValue evidence;
  for (const MissionEvidence& marker : mission.evidence) {
    base::DictValue value;
    value.Set("label", marker.label);
    value.Set("capture_scope", marker.capture_scope);
    value.Set("captured_at", marker.captured_at);
    evidence.Append(std::move(value));
  }
  capsule.Set("evidence_markers", std::move(evidence));

  base::ListValue timeline;
  for (const MissionEvent& event : mission.timeline) {
    base::DictValue value;
    value.Set("kind", event.kind);
    value.Set("detail", event.detail);
    value.Set("created_at", event.created_at);
    value.Set("previous_hash", event.previous_hash);
    value.Set("entry_hash", event.entry_hash);
    timeline.Append(std::move(value));
  }
  capsule.Set("timeline", std::move(timeline));

  std::string canonical_body;
  if (!base::JSONWriter::Write(capsule, &canonical_body)) {
    return std::nullopt;
  }
  capsule.Set("integrity_sha256", CapsuleDigest(canonical_body));
  std::string serialized;
  if (!base::JSONWriter::Write(capsule, &serialized) ||
      serialized.size() > kTahaiMissionCapsuleMaxBytes) {
    return std::nullopt;
  }
  return serialized;
}

bool VerifyTahaiMissionCapsule(std::string_view serialized_capsule) {
  if (serialized_capsule.empty() ||
      serialized_capsule.size() > kTahaiMissionCapsuleMaxBytes) {
    return false;
  }
  std::optional<base::DictValue> capsule = base::JSONReader::ReadDict(
      serialized_capsule, base::JSON_PARSE_RFC, /*max_depth=*/8);
  if (!capsule || !HasExpectedCapsuleShape(*capsule)) {
    return false;
  }
  const std::string supplied_digest = *capsule->FindString("integrity_sha256");
  if (!IsDigest(supplied_digest) || !capsule->Remove("integrity_sha256")) {
    return false;
  }
  std::string canonical_body;
  if (!base::JSONWriter::Write(*capsule, &canonical_body)) {
    return false;
  }
  const std::string calculated_digest = CapsuleDigest(canonical_body);
  return crypto::SecureMemEqual(base::as_byte_span(supplied_digest),
                                base::as_byte_span(calculated_digest));
}

std::optional<TahaiMissionCapsuleImport> ExtractTahaiMissionCapsuleImport(
    std::string_view serialized_capsule) {
  if (!VerifyTahaiMissionCapsule(serialized_capsule)) {
    return std::nullopt;
  }
  std::optional<base::DictValue> capsule = base::JSONReader::ReadDict(
      serialized_capsule, base::JSON_PARSE_RFC, /*max_depth=*/8);
  if (!capsule) {
    return std::nullopt;
  }
  const std::string* mission_type = capsule->FindString("mission_type");
  const std::string* export_profile = capsule->FindString("export_profile");
  const std::optional<std::vector<bool>> checkpoints =
      ExtractCompletionStates(capsule->FindList("checkpoints"));
  const std::optional<std::vector<bool>> validation =
      ExtractCompletionStates(capsule->FindList("validation"));
  const std::optional<std::vector<bool>> rollback =
      ExtractCompletionStates(capsule->FindList("rollback"));
  const base::ListValue* evidence = capsule->FindList("evidence_markers");
  if (!mission_type || mission_type->empty() || mission_type->size() > 32u ||
      !export_profile || export_profile->empty() ||
      export_profile->size() > 32u || !checkpoints || !validation ||
      !rollback || !HasBoundedEvidenceShape(evidence)) {
    return std::nullopt;
  }
  return TahaiMissionCapsuleImport{
      .mission_type = *mission_type,
      .export_profile = *export_profile,
      .checkpoint_complete = *checkpoints,
      .validation_complete = *validation,
      .rollback_complete = *rollback,
      .evidence_marker_count = evidence->size(),
  };
}

std::optional<std::string> SealTahaiMissionCapsule(
    const MissionSummary& mission,
    TahaiSyncProvider provider,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result) {
  const std::optional<std::string> capsule = BuildTahaiMissionCapsule(mission);
  if (!capsule) {
    if (result) {
      *result = TahaiSyncEnvelopeResult::kInvalidEnvelope;
    }
    return std::nullopt;
  }
  return SealTahaiSyncEnvelope(provider, TahaiSyncObjectType::kMissionCapsule,
                               /*explicit_opt_in=*/true, mission.id, key,
                               *capsule, result);
}

std::optional<std::string> SealTahaiMissionCapsuleWithKeyId(
    const MissionSummary& mission,
    TahaiSyncProvider provider,
    std::string_view key_id,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result) {
  const std::optional<std::string> capsule = BuildTahaiMissionCapsule(mission);
  if (!capsule) {
    if (result) {
      *result = TahaiSyncEnvelopeResult::kInvalidEnvelope;
    }
    return std::nullopt;
  }
  return SealTahaiSyncEnvelopeWithKeyId(
      provider, TahaiSyncObjectType::kMissionCapsule,
      /*explicit_opt_in=*/true, mission.id, key_id, key, *capsule, result);
}

std::optional<std::string> OpenTahaiMissionCapsule(
    std::string_view serialized_envelope,
    base::span<const uint8_t> key,
    TahaiSyncEnvelopeResult* result) {
  std::optional<TahaiOpenedSyncEnvelope> opened =
      OpenTahaiSyncEnvelope(serialized_envelope, key, result);
  if (!opened || opened->object_type != TahaiSyncObjectType::kMissionCapsule ||
      !VerifyTahaiMissionCapsule(opened->plaintext)) {
    if (result) {
      *result = TahaiSyncEnvelopeResult::kInvalidEnvelope;
    }
    return std::nullopt;
  }
  return opened->plaintext;
}

}  // namespace tahai
