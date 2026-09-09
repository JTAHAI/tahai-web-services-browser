// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_service.h"

#include <algorithm>
#include <limits>
#include <set>
#include <utility>

#include "base/check.h"
#include "base/memory/raw_ptr.h"
#include "base/notreached.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/time/time.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/tahai/tahai_environment_guard_registry.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_policy.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_redactor.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_sentinel_schedule.h"
#include "crypto/sha2.h"

namespace tahai {
namespace {

constexpr char kManualWatchMissionUseBasis[] =
    "Manual-only recheck configuration selected for this Mission.";
constexpr char kManualWatchMissionTargetBasis[] =
    "Manual-only recheck target selected for this Mission.";
constexpr char kEnvironmentMissionUseBasis[] =
    "Explicit Environment Guard classification selected for this Mission.";
constexpr char kDocumentationMissionUseBasis[] =
    "Explicit documentation pointer selected for this Mission.";

std::string StableLocalOiId(std::string_view seed) {
  const std::string hash = base::ToLowerASCII(base::HexEncode(
      crypto::SHA256HashString(base::StrCat({"TAHAI-LOCAL-OI-v1\n", seed}))));
  // Format the first 128 hash bits as a canonical lowercase UUID. The v4 and
  // variant nibbles are fixed solely to satisfy the local record ID format;
  // this is a deterministic identifier, not a randomness claim.
  std::string id = base::StrCat({hash.substr(0, 8), "-", hash.substr(8, 4),
                                 "-4", hash.substr(13, 3), "-8",
                                 hash.substr(17, 3), "-", hash.substr(20, 12)});
  return id;
}

void SetField(LocalOiEntityRecord* entity,
              std::string_view key,
              std::string value) {
  for (LocalOiField& field : entity->fields) {
    if (field.key == key) {
      field.value = std::move(value);
      return;
    }
  }
  entity->fields.push_back({std::string(key), std::move(value)});
}

const std::string* FindFieldValue(const LocalOiEntityRecord& entity,
                                  std::string_view key) {
  const auto field = std::find_if(
      entity.fields.begin(), entity.fields.end(),
      [key](const LocalOiField& candidate) { return candidate.key == key; });
  return field == entity.fields.end() ? nullptr : &field->value;
}

int FieldIntOrDefault(const LocalOiEntityRecord& entity,
                      std::string_view key,
                      int fallback) {
  const std::string* value = FindFieldValue(entity, key);
  int parsed = fallback;
  return value && base::StringToInt(*value, &parsed) ? parsed : fallback;
}

std::optional<int64_t> FieldTimestampOrNull(const LocalOiEntityRecord& entity,
                                            std::string_view key) {
  const std::string* value = FindFieldValue(entity, key);
  int64_t parsed = 0;
  if (!value || !IsValidLocalOiTimestamp(*value) ||
      !base::StringToInt64(*value, &parsed) || parsed <= 0) {
    return std::nullopt;
  }
  return parsed;
}

std::string FieldValueOrEmpty(const LocalOiEntityRecord& entity,
                              std::string_view key) {
  const std::string* value = FindFieldValue(entity, key);
  return value ? *value : std::string();
}

bool HasFieldValue(const LocalOiEntityRecord& entity,
                   std::string_view key,
                   std::string_view value) {
  const std::string* field = FindFieldValue(entity, key);
  return field && *field == value;
}

std::optional<TahaiChangeCapture> ChangeCaptureFromEntity(
    const LocalOiEntityRecord& entity) {
  if (entity.type != LocalOiEntityType::kToolResult ||
      entity.source != LocalOiRecordSource::kExplicitUserEntry) {
    return std::nullopt;
  }
  const std::string* kind = FindFieldValue(entity, "change_capture_kind");
  const std::string* target = FindFieldValue(entity, "change_target");
  const std::string* digest = FindFieldValue(entity, "sha256_digest");
  const std::string* captured_at =
      FindFieldValue(entity, "captured_at_windows_epoch_us");
  if (!kind || !target || !digest || !captured_at) {
    return std::nullopt;
  }
  int64_t captured_at_windows_epoch_us = 0;
  const std::optional<TahaiChangeCaptureKind> parsed_kind =
      TahaiChangeCaptureKindFromName(*kind);
  if (!parsed_kind ||
      !base::StringToInt64(*captured_at, &captured_at_windows_epoch_us)) {
    return std::nullopt;
  }
  TahaiChangeCapture capture;
  if (ValidateTahaiChangeCaptureRequest(
          {*parsed_kind, *target, *digest, captured_at_windows_epoch_us},
          &capture) != TahaiChangeCaptureValidationResult::kValid) {
    return std::nullopt;
  }
  return capture;
}

bool HasMissionChangeCaptureWithState(const LocalOiStoreData& data,
                                      std::string_view mission_id,
                                      std::string_view state) {
  return std::any_of(data.entities.begin(), data.entities.end(),
                     [mission_id, state](const LocalOiEntityRecord& entity) {
                       return entity.type == LocalOiEntityType::kToolResult &&
                              entity.mission_id == mission_id &&
                              FindFieldValue(entity, "change_capture_kind") !=
                                  nullptr &&
                              HasFieldValue(entity, "change_state", state);
                     });
}

const LocalOiEntityRecord* FindLatestChangeCapture(
    const LocalOiStoreData& data,
    const TahaiChangeCapture& capture) {
  const LocalOiEntityRecord* latest = nullptr;
  int64_t latest_timestamp = -1;
  for (const LocalOiEntityRecord& candidate : data.entities) {
    const std::optional<TahaiChangeCapture> parsed =
        ChangeCaptureFromEntity(candidate);
    if (!parsed || parsed->kind != capture.kind ||
        parsed->canonical_target != capture.canonical_target) {
      continue;
    }
    if (!latest || parsed->captured_at_windows_epoch_us > latest_timestamp ||
        (parsed->captured_at_windows_epoch_us == latest_timestamp &&
         candidate.id < latest->id)) {
      latest = &candidate;
      latest_timestamp = parsed->captured_at_windows_epoch_us;
    }
  }
  return latest;
}

bool IsDnsTlsInspectionResultForHost(const LocalOiEntityRecord& entity,
                                     std::string_view host) {
  return entity.type == LocalOiEntityType::kToolResult &&
         entity.source == LocalOiRecordSource::kOpsTool &&
         HasFieldValue(entity, "inspection_kind", "dns_tls") &&
         HasFieldValue(entity, "inspection_host", host);
}

const LocalOiEntityRecord* FindLatestDnsTlsInspectionResult(
    const LocalOiStoreData& data,
    std::string_view host) {
  const LocalOiEntityRecord* latest = nullptr;
  for (const LocalOiEntityRecord& candidate : data.entities) {
    if (!IsDnsTlsInspectionResultForHost(candidate, host)) {
      continue;
    }
    if (latest) {
      const bool candidate_is_current =
          HasFieldValue(candidate, "is_current", "true");
      const bool latest_is_current =
          HasFieldValue(*latest, "is_current", "true");
      if ((latest_is_current && !candidate_is_current) ||
          (latest_is_current == candidate_is_current &&
           candidate.updated_at <= latest->updated_at)) {
        continue;
      }
    }
    latest = &candidate;
  }
  return latest;
}

std::string JoinChangedInspectionFields(
    const LocalOiEntityRecord* previous,
    const std::vector<LocalOiField>& current_fields) {
  if (!previous) {
    return "";
  }
  std::string changed;
  for (const LocalOiField& current : current_fields) {
    const std::string* previous_value = FindFieldValue(*previous, current.key);
    if (!previous_value || *previous_value == current.value) {
      continue;
    }
    const size_t separator = changed.empty() ? 0u : 2u;
    if (changed.size() + separator + current.key.size() >
        kTahaiLocalOiMaximumSummaryLength) {
      break;
    }
    if (!changed.empty()) {
      changed += ", ";
    }
    changed += current.key;
  }
  return changed;
}

bool IsDnsOrTlsChangeCapture(TahaiChangeCaptureKind kind) {
  return kind == TahaiChangeCaptureKind::kDnsRecordDigest ||
         kind == TahaiChangeCaptureKind::kTlsCertificateDigest;
}

std::string ChangeTargetEntityId(const TahaiChangeCapture& capture) {
  return StableLocalOiId(
      base::StrCat({"change_target|", TahaiChangeCaptureKindName(capture.kind),
                    "|", capture.canonical_target}));
}

bool IsSafeArtifactLabel(std::string_view value) {
  return IsSafeLocalOiText(value, kTahaiLocalOiMaximumRecordTitleLength) &&
         value.find('/') == std::string_view::npos &&
         value.find('\\') == std::string_view::npos &&
         value.find(':') == std::string_view::npos;
}

bool IsSafeDocumentReferenceTitle(std::string_view value) {
  // This is presentation metadata only. Unlike an artifact label it may name
  // a document section, but never becomes a path, filename, URL, or lookup.
  return IsSafeLocalOiText(value, kTahaiLocalOiMaximumRecordTitleLength);
}

bool IsActiveLocalMission(const LocalOiStoreData& data,
                          std::string_view mission_id) {
  return std::any_of(data.entities.begin(), data.entities.end(),
                     [mission_id](const LocalOiEntityRecord& entity) {
                       return entity.id == mission_id &&
                              entity.type == LocalOiEntityType::kMission &&
                              !entity.archived;
                     });
}

bool IsDnsOrTlsManualWatch(TahaiSentinelWatchKind kind) {
  return kind == TahaiSentinelWatchKind::kDnsRecord ||
         kind == TahaiSentinelWatchKind::kTlsCertificate;
}

bool IsMissionDerived(const LocalOiEntityRecord& record) {
  return record.source == LocalOiRecordSource::kMission ||
         record.source == LocalOiRecordSource::kMissionEvidence ||
         record.source == LocalOiRecordSource::kMissionTimeline;
}

bool IsAtOrAfterRetentionCutoff(std::string_view timestamp,
                                int64_t cutoff_windows_epoch_us) {
  int64_t value = 0;
  return base::StringToInt64(timestamp, &value) &&
         value >= cutoff_windows_epoch_us;
}

bool PruneExpiredSupplementalLocalOiData(LocalOiStoreData* data,
                                         int retention_days) {
  CHECK(data);
  const size_t entity_count = data->entities.size();
  const size_t relationship_count = data->relationships.size();
  const size_t finding_count = data->findings.size();
  const size_t memory_count = data->memory.size();
  const size_t report_count = data->reports.size();
  constexpr int64_t kMicrosecondsPerDay = 24LL * 60LL * 60LL * 1000LL * 1000LL;
  const int64_t now =
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds();
  const int64_t cutoff =
      now - static_cast<int64_t>(retention_days) * kMicrosecondsPerDay;
  // Mission Control owns its generated Mission schema and its own retention.
  // Local OI only prunes supplemental records here, preserving the source of
  // truth for Mission records while enforcing the Local OI retention policy.
  data->entities.erase(
      std::remove_if(data->entities.begin(), data->entities.end(),
                     [cutoff](const LocalOiEntityRecord& entity) {
                       return !IsMissionDerived(entity) &&
                              !IsAtOrAfterRetentionCutoff(entity.updated_at,
                                                          cutoff);
                     }),
      data->entities.end());
  data->findings.erase(
      std::remove_if(data->findings.begin(), data->findings.end(),
                     [cutoff](const LocalOiFindingRecord& finding) {
                       return !IsAtOrAfterRetentionCutoff(finding.updated_at,
                                                          cutoff);
                     }),
      data->findings.end());
  data->memory.erase(
      std::remove_if(data->memory.begin(), data->memory.end(),
                     [cutoff](const LocalOiMemoryRecord& record) {
                       return !IsAtOrAfterRetentionCutoff(record.created_at,
                                                          cutoff);
                     }),
      data->memory.end());
  data->reports.erase(
      std::remove_if(data->reports.begin(), data->reports.end(),
                     [cutoff](const LocalOiReportRecord& report) {
                       return !IsAtOrAfterRetentionCutoff(report.created_at,
                                                          cutoff);
                     }),
      data->reports.end());
  data->relationships.erase(
      std::remove_if(
          data->relationships.begin(), data->relationships.end(),
          [data, cutoff](const LocalOiRelationshipRecord& relationship) {
            const bool endpoints_exist =
                std::any_of(data->entities.begin(), data->entities.end(),
                            [&relationship](const LocalOiEntityRecord& entity) {
                              return entity.id == relationship.source_id;
                            }) &&
                std::any_of(data->entities.begin(), data->entities.end(),
                            [&relationship](const LocalOiEntityRecord& entity) {
                              return entity.id == relationship.target_id;
                            });
            return !endpoints_exist ||
                   !IsAtOrAfterRetentionCutoff(relationship.updated_at, cutoff);
          }),
      data->relationships.end());
  return entity_count != data->entities.size() ||
         relationship_count != data->relationships.size() ||
         finding_count != data->findings.size() ||
         memory_count != data->memory.size() ||
         report_count != data->reports.size();
}

void UpsertEntity(LocalOiStoreData* data, LocalOiEntityRecord record) {
  auto existing = std::find_if(data->entities.begin(), data->entities.end(),
                               [&record](const LocalOiEntityRecord& entity) {
                                 return entity.id == record.id;
                               });
  if (existing == data->entities.end()) {
    data->entities.push_back(std::move(record));
  } else {
    *existing = std::move(record);
  }
}

void UpsertRelationship(LocalOiStoreData* data,
                        LocalOiRelationshipRecord record) {
  auto existing =
      std::find_if(data->relationships.begin(), data->relationships.end(),
                   [&record](const LocalOiRelationshipRecord& relationship) {
                     return relationship.id == record.id;
                   });
  if (existing == data->relationships.end()) {
    data->relationships.push_back(std::move(record));
  } else {
    *existing = std::move(record);
  }
}

void AddMissionRelationship(LocalOiStoreData* data,
                            LocalOiRelationshipType type,
                            std::string_view source_id,
                            std::string_view target_id,
                            std::string_view basis,
                            std::string_view timestamp) {
  const std::string id = StableLocalOiId(
      base::StrCat({"relationship|", LocalOiRelationshipTypeName(type), "|",
                    source_id, "|", target_id}));
  UpsertRelationship(data, {id, type, std::string(source_id),
                            std::string(target_id), std::string(basis),
                            std::string(timestamp), std::string(timestamp)});
}

void RemoveMissionAssociationByTargetAndBasis(LocalOiStoreData* data,
                                              LocalOiRelationshipType type,
                                              std::string_view target_id,
                                              std::string_view basis) {
  data->relationships.erase(
      std::remove_if(
          data->relationships.begin(), data->relationships.end(),
          [type, target_id, basis](const LocalOiRelationshipRecord& record) {
            return record.type == type && record.target_id == target_id &&
                   record.basis == basis;
          }),
      data->relationships.end());
}

void AddMemory(LocalOiStoreData* data,
               LocalOiMemoryAction action,
               std::string_view entity_id,
               std::string_view detail,
               std::string_view timestamp) {
  const std::string id = StableLocalOiId(
      base::StrCat({"memory|", LocalOiMemoryActionName(action), "|", entity_id,
                    "|", detail, "|", timestamp}));
  if (std::any_of(data->memory.begin(), data->memory.end(),
                  [&id](const LocalOiMemoryRecord& record) {
                    return record.id == id;
                  })) {
    return;
  }
  data->memory.push_back({id, action, std::string(entity_id),
                          std::string(detail), std::string(timestamp)});
  // Mission timelines are bounded per Mission but can legitimately exceed the
  // profile-wide local memory retention cap. Keep the newest records by their
  // typed timestamp (then ID for deterministic ties) rather than failing an
  // otherwise valid reconciliation batch.
  if (data->memory.size() > kTahaiLocalOiMaximumMemoryRecords) {
    std::stable_sort(
        data->memory.begin(), data->memory.end(),
        [](const LocalOiMemoryRecord& left, const LocalOiMemoryRecord& right) {
          if (left.created_at != right.created_at) {
            return left.created_at > right.created_at;
          }
          return left.id < right.id;
        });
    data->memory.resize(kTahaiLocalOiMaximumMemoryRecords);
  }
}

void RetainNewestReports(LocalOiStoreData* data) {
  if (data->reports.size() <= kTahaiLocalOiMaximumReports) {
    return;
  }
  std::stable_sort(
      data->reports.begin(), data->reports.end(),
      [](const LocalOiReportRecord& left, const LocalOiReportRecord& right) {
        if (left.created_at != right.created_at) {
          return left.created_at > right.created_at;
        }
        return left.id < right.id;
      });
  data->reports.resize(kTahaiLocalOiMaximumReports);
}

std::string SafeInspectionFieldValue(std::string_view value) {
  if (value.empty()) {
    return "Unavailable";
  }
  if (IsSafeLocalOiText(value, kTahaiLocalOiMaximumSummaryLength)) {
    return std::string(value);
  }
  return "Unavailable";
}

constexpr int kMaximumRetainedDnsTopologyCount = 64;
constexpr int kObservedSecurityHeaderVocabularySize = 6;

int BoundedDnsTopologyCount(int value) {
  return std::clamp(value, 0, kMaximumRetainedDnsTopologyCount);
}

int BoundedSecurityHeaderCount(int value) {
  return std::clamp(value, 0, kObservedSecurityHeaderVocabularySize);
}

LocalOiReportKind StoredReportKind(LocalOiSafeReportKind kind) {
  switch (kind) {
    case LocalOiSafeReportKind::kOverview:
      return LocalOiReportKind::kMissionHealthSummary;
    case LocalOiSafeReportKind::kSanitizedHandoff:
      return LocalOiReportKind::kOperationalHandoff;
    case LocalOiSafeReportKind::kChangeRecord:
      return LocalOiReportKind::kChangeRecord;
    case LocalOiSafeReportKind::kIncidentPacket:
      return LocalOiReportKind::kKnowledgeGapReport;
    case LocalOiSafeReportKind::kEvidenceManifest:
      return LocalOiReportKind::kEvidenceSummary;
    case LocalOiSafeReportKind::kArtifactIntegrity:
      return LocalOiReportKind::kArtifactIntegrityReport;
    case LocalOiSafeReportKind::kDiagnostic:
      return LocalOiReportKind::kDiagnosticReport;
  }
  NOTREACHED();
}

size_t CountCompleted(const std::vector<MissionStep>& steps) {
  return static_cast<size_t>(
      std::count_if(steps.begin(), steps.end(),
                    [](const MissionStep& step) { return step.complete; }));
}

void AddRunbookAndSteps(LocalOiStoreData* data,
                        const MissionSummary& mission,
                        std::string_view phase,
                        const std::vector<MissionStep>& steps) {
  const std::string id = StableLocalOiId(
      base::StrCat({"mission|", mission.id, "|runbook|", phase}));
  LocalOiEntityRecord runbook;
  runbook.id = id;
  runbook.type = LocalOiEntityType::kRunbook;
  runbook.mission_id = mission.id;
  runbook.title = base::StrCat({"Mission ", phase, " runbook"});
  runbook.summary = "Generated from bounded Mission checkpoint state.";
  runbook.source = LocalOiRecordSource::kMission;
  runbook.created_at = mission.created_at;
  runbook.updated_at = mission.updated_at;
  SetField(&runbook, "phase", std::string(phase));
  SetField(&runbook, "step_total", base::NumberToString(steps.size()));
  SetField(&runbook, "step_complete",
           base::NumberToString(CountCompleted(steps)));
  UpsertEntity(data, std::move(runbook));
  AddMissionRelationship(data, LocalOiRelationshipType::kMissionContains,
                         mission.id, id, "Mission owns this generated runbook.",
                         mission.updated_at);

  for (size_t index = 0; index < steps.size(); ++index) {
    const MissionStep& step = steps[index];
    const std::string step_id =
        StableLocalOiId(base::StrCat({"mission|", mission.id, "|step|", phase,
                                      "|", base::NumberToString(index)}));
    LocalOiEntityRecord record;
    record.id = step_id;
    record.type = LocalOiEntityType::kRunbookStep;
    record.mission_id = mission.id;
    record.title = step.label;
    record.summary = "Bounded Mission checkpoint.";
    record.source = LocalOiRecordSource::kMission;
    record.created_at = mission.created_at;
    record.updated_at = mission.updated_at;
    SetField(&record, "phase", std::string(phase));
    SetField(&record, "complete", step.complete ? "true" : "false");
    SetField(&record, "index", base::NumberToString(index));
    UpsertEntity(data, std::move(record));
    AddMissionRelationship(data, LocalOiRelationshipType::kMissionContains, id,
                           step_id, "Runbook contains this checkpoint.",
                           mission.updated_at);
  }
}

}  // namespace

TahaiLocalOiService::TahaiLocalOiService(Profile* profile)
    : profile_(profile), store_(profile->GetPrefs(), /*durable=*/true) {
  CHECK(profile_);
  // The factory selects original regular profiles only. Keep this assertion as
  // a defense in depth in case a future caller bypasses that factory.
  CHECK(!profile_->IsOffTheRecord());
  CHECK(!profile_->IsGuestSession());
  LocalOiStoreData retained = store_.data();
  if (PruneExpiredSupplementalLocalOiData(
          &retained,
          TahaiLocalOiPolicy(profile_->GetPrefs()).RetentionDays())) {
    store_.Commit(std::move(retained));
  }
}

TahaiLocalOiService::~TahaiLocalOiService() = default;

bool TahaiLocalOiService::CanWriteLocalData() const {
  return !shutdown_ && TahaiLocalOiPolicy(profile_->GetPrefs())
                           .IsEnabled(LocalOiPolicyControl::kEnabled);
}

bool TahaiLocalOiService::UpsertEntity(LocalOiEntityRecord record) {
  return CanWriteLocalData() && store_.UpsertEntity(std::move(record)) &&
         EnforceRetentionAfterDirectMutation();
}

bool TahaiLocalOiService::UpsertRelationship(LocalOiRelationshipRecord record) {
  return CanWriteLocalData() && store_.UpsertRelationship(std::move(record)) &&
         EnforceRetentionAfterDirectMutation();
}

bool TahaiLocalOiService::UpsertFinding(LocalOiFindingRecord record) {
  return CanWriteLocalData() && store_.UpsertFinding(std::move(record)) &&
         EnforceRetentionAfterDirectMutation();
}

bool TahaiLocalOiService::AppendMemory(LocalOiMemoryRecord record) {
  return CanWriteLocalData() && store_.AppendMemory(std::move(record)) &&
         EnforceRetentionAfterDirectMutation();
}

bool TahaiLocalOiService::AddReport(LocalOiReportRecord record) {
  return CanWriteLocalData() &&
         TahaiLocalOiPolicy(profile_->GetPrefs())
             .IsEnabled(LocalOiPolicyControl::kReports) &&
         store_.AddReport(std::move(record)) &&
         EnforceRetentionAfterDirectMutation();
}

bool TahaiLocalOiService::DeleteEntity(std::string_view entity_id) {
  return !shutdown_ && store_.DeleteEntity(entity_id);
}

bool TahaiLocalOiService::DeleteAllData() {
  return !shutdown_ && store_.DeleteAll();
}

bool TahaiLocalOiService::EnforceRetentionAfterDirectMutation() {
  LocalOiStoreData retained = store_.data();
  if (!PruneExpiredSupplementalLocalOiData(
          &retained,
          TahaiLocalOiPolicy(profile_->GetPrefs()).RetentionDays())) {
    return true;
  }
  return store_.Commit(std::move(retained));
}

bool TahaiLocalOiService::CommitWithRetention(LocalOiStoreData data) {
  if (!CanWriteLocalData()) {
    return false;
  }
  PruneExpiredSupplementalLocalOiData(
      &data, TahaiLocalOiPolicy(profile_->GetPrefs()).RetentionDays());
  return store_.Commit(std::move(data));
}

bool TahaiLocalOiService::RecordNetworkInspection(
    const TahaiNetworkInspectionResult& result,
    std::string_view mission_id,
    std::string_view watch_id) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kOpsToolIngestion) ||
      !IsValidTahaiNetworkInspectionHost(result.host) ||
      !IsValidLocalOiTimestamp(result.inspected_at) ||
      (!mission_id.empty() && !IsValidLocalOiId(mission_id)) ||
      (!watch_id.empty() && !IsValidLocalOiId(watch_id))) {
    return false;
  }

  LocalOiStoreData next = store_.data();
  if (!mission_id.empty() && !IsActiveLocalMission(next, mission_id)) {
    return false;
  }
  if (!watch_id.empty()) {
    const auto watch = std::find_if(
        next.entities.begin(), next.entities.end(),
        [watch_id](const LocalOiEntityRecord& record) {
          return record.id == watch_id &&
                 record.type == LocalOiEntityType::kWatch &&
                 record.source == LocalOiRecordSource::kExplicitUserEntry;
        });
    const std::optional<TahaiSentinelWatchKind> watch_kind =
        watch == next.entities.end()
            ? std::nullopt
            : TahaiSentinelWatchKindFromName(
                  FieldValueOrEmpty(*watch, "watch_kind"));
    if (!watch_kind || !IsDnsOrTlsManualWatch(*watch_kind) ||
        FieldValueOrEmpty(*watch, "watch_target") != result.host ||
        watch->mission_id != mission_id ||
        !HasFieldValue(*watch, "execution_mode", "manual_only") ||
        !HasFieldValue(*watch, "network_scheduler", "false")) {
      return false;
    }
  }
  const LocalOiEntityRecord* previous_inspection =
      FindLatestDnsTlsInspectionResult(next, result.host);
  const std::string previous_inspection_id =
      previous_inspection ? previous_inspection->id : std::string();
  const std::vector<LocalOiField> comparison_fields = {
      {"dns_ipv4_count", base::NumberToString(BoundedDnsTopologyCount(
                             result.resolved_ipv4_count))},
      {"dns_ipv6_count", base::NumberToString(BoundedDnsTopologyCount(
                             result.resolved_ipv6_count))},
      {"dns_alias_count",
       base::NumberToString(BoundedDnsTopologyCount(result.dns_alias_count))},
      {"security_header_observation_available",
       result.security_header_observation_available ? "true" : "false"},
      {"http_strict_transport_security_observed",
       result.strict_transport_security_observed ? "true" : "false"},
      {"http_content_security_policy_observed",
       result.content_security_policy_observed ? "true" : "false"},
      {"http_x_content_type_options_observed",
       result.x_content_type_options_observed ? "true" : "false"},
      {"http_x_frame_options_observed",
       result.x_frame_options_observed ? "true" : "false"},
      {"http_referrer_policy_observed",
       result.referrer_policy_observed ? "true" : "false"},
      {"http_permissions_policy_observed",
       result.permissions_policy_observed ? "true" : "false"},
      {"observed_security_header_count",
       base::NumberToString(
           BoundedSecurityHeaderCount(result.observed_security_header_count))},
      {"dns_net_error", base::NumberToString(result.dns_net_error)},
      {"request_net_error", base::NumberToString(result.request_net_error)},
      {"public_address_guard_blocked",
       result.public_address_guard_blocked ? "true" : "false"},
      {"http_status", base::NumberToString(result.http_status)},
      {"tls_certificate_valid", result.certificate_valid ? "true" : "false"},
      {"tls_certificate_expired",
       result.certificate_expired ? "true" : "false"},
      {"tls_certificate_name_mismatch",
       result.certificate_name_mismatch ? "true" : "false"},
      {"tls_certificate_authority_invalid",
       result.certificate_authority_invalid ? "true" : "false"},
      {"tls_certificate_revoked",
       result.certificate_revoked ? "true" : "false"},
      {"tls_days_remaining",
       base::NumberToString(result.certificate_days_remaining)},
      {"certificate_status", base::NumberToString(result.certificate_status)},
      {"issued_by_known_root", result.issued_by_known_root ? "true" : "false"},
      {"tls_version", SafeInspectionFieldValue(result.tls_version)},
      {"cipher_suite", SafeInspectionFieldValue(result.cipher_suite)},
  };
  const std::string changed_fields =
      JoinChangedInspectionFields(previous_inspection, comparison_fields);
  const std::string comparison_state =
      previous_inspection ? (changed_fields.empty() ? "unchanged" : "changed")
                          : "baseline";
  for (LocalOiEntityRecord& existing : next.entities) {
    if (IsDnsTlsInspectionResultForHost(existing, result.host)) {
      SetField(&existing, "is_current", "false");
    }
  }
  const std::string domain_id =
      StableLocalOiId(base::StrCat({"domain|", result.host}));
  const std::string endpoint_id =
      StableLocalOiId(base::StrCat({"endpoint|https|", result.host, "|443"}));
  // Each explicit inspection is a distinct local historical result. Do not
  // derive its ID from a wall-clock timestamp, which could collide on rapid
  // operator retries and erase the predecessor needed for comparison.
  const std::string tool_result_id = NewLocalOiId();

  LocalOiEntityRecord domain;
  domain.id = domain_id;
  domain.type = LocalOiEntityType::kDomain;
  domain.title = result.host;
  domain.summary = "Explicitly inspected aggregate DNS metadata.";
  domain.source = LocalOiRecordSource::kOpsTool;
  domain.created_at = result.inspected_at;
  domain.updated_at = result.inspected_at;
  SetField(&domain, "last_inspected", result.inspected_at);
  SetField(&domain, "dns_ipv4_count",
           base::NumberToString(
               BoundedDnsTopologyCount(result.resolved_ipv4_count)));
  SetField(&domain, "dns_ipv6_count",
           base::NumberToString(
               BoundedDnsTopologyCount(result.resolved_ipv6_count)));
  SetField(
      &domain, "dns_alias_count",
      base::NumberToString(BoundedDnsTopologyCount(result.dns_alias_count)));
  SetField(&domain, "dns_net_error",
           base::NumberToString(result.dns_net_error));
  ::tahai::UpsertEntity(&next, std::move(domain));

  LocalOiEntityRecord endpoint;
  endpoint.id = endpoint_id;
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.title = base::StrCat({result.host, ":443"});
  endpoint.summary = "Explicit HTTPS DNS and TLS inspection endpoint.";
  endpoint.source = LocalOiRecordSource::kOpsTool;
  endpoint.created_at = result.inspected_at;
  endpoint.updated_at = result.inspected_at;
  SetField(&endpoint, "dns_baseline",
           result.dns_net_error == 0 && !result.resolved_addresses.empty()
               ? "true"
               : "false");
  SetField(&endpoint, "tls_baseline",
           result.tls_info_available ? "true" : "false");
  SetField(&endpoint, "tls_info_available",
           result.tls_info_available ? "true" : "false");
  SetField(&endpoint, "last_inspected", result.inspected_at);
  SetField(&endpoint, "http_status", base::NumberToString(result.http_status));
  SetField(&endpoint, "security_header_observation_available",
           result.security_header_observation_available ? "true" : "false");
  SetField(&endpoint, "http_strict_transport_security_observed",
           result.strict_transport_security_observed ? "true" : "false");
  SetField(&endpoint, "http_content_security_policy_observed",
           result.content_security_policy_observed ? "true" : "false");
  SetField(&endpoint, "http_x_content_type_options_observed",
           result.x_content_type_options_observed ? "true" : "false");
  SetField(&endpoint, "http_x_frame_options_observed",
           result.x_frame_options_observed ? "true" : "false");
  SetField(&endpoint, "http_referrer_policy_observed",
           result.referrer_policy_observed ? "true" : "false");
  SetField(&endpoint, "http_permissions_policy_observed",
           result.permissions_policy_observed ? "true" : "false");
  SetField(&endpoint, "observed_security_header_count",
           base::NumberToString(BoundedSecurityHeaderCount(
               result.observed_security_header_count)));
  SetField(&endpoint, "request_net_error",
           base::NumberToString(result.request_net_error));
  SetField(&endpoint, "public_address_guard_blocked",
           result.public_address_guard_blocked ? "true" : "false");
  SetField(&endpoint, "tls_certificate_valid",
           result.certificate_valid ? "true" : "false");
  SetField(&endpoint, "tls_certificate_name_mismatch",
           result.certificate_name_mismatch ? "true" : "false");
  SetField(&endpoint, "tls_certificate_authority_invalid",
           result.certificate_authority_invalid ? "true" : "false");
  SetField(&endpoint, "tls_certificate_revoked",
           result.certificate_revoked ? "true" : "false");
  SetField(&endpoint, "tls_version",
           SafeInspectionFieldValue(result.tls_version));
  SetField(&endpoint, "tls_expiry",
           SafeInspectionFieldValue(result.certificate_expiry));
  SetField(&endpoint, "tls_days_remaining",
           base::NumberToString(result.certificate_days_remaining));
  SetField(&endpoint, "tls_certificate_expired",
           result.certificate_expired ? "true" : "false");
  ::tahai::UpsertEntity(&next, std::move(endpoint));

  LocalOiEntityRecord tool_result;
  tool_result.id = tool_result_id;
  tool_result.type = LocalOiEntityType::kToolResult;
  tool_result.mission_id = std::string(mission_id);
  tool_result.title = "DNS and TLS inspection";
  tool_result.summary = "User-initiated local support inspection metadata.";
  tool_result.source = LocalOiRecordSource::kOpsTool;
  tool_result.created_at = result.inspected_at;
  tool_result.updated_at = result.inspected_at;
  SetField(&tool_result, "dns_net_error",
           base::NumberToString(result.dns_net_error));
  SetField(&tool_result, "dns_ipv4_count",
           base::NumberToString(
               BoundedDnsTopologyCount(result.resolved_ipv4_count)));
  SetField(&tool_result, "dns_ipv6_count",
           base::NumberToString(
               BoundedDnsTopologyCount(result.resolved_ipv6_count)));
  SetField(
      &tool_result, "dns_alias_count",
      base::NumberToString(BoundedDnsTopologyCount(result.dns_alias_count)));
  SetField(&tool_result, "security_header_observation_available",
           result.security_header_observation_available ? "true" : "false");
  SetField(&tool_result, "http_strict_transport_security_observed",
           result.strict_transport_security_observed ? "true" : "false");
  SetField(&tool_result, "http_content_security_policy_observed",
           result.content_security_policy_observed ? "true" : "false");
  SetField(&tool_result, "http_x_content_type_options_observed",
           result.x_content_type_options_observed ? "true" : "false");
  SetField(&tool_result, "http_x_frame_options_observed",
           result.x_frame_options_observed ? "true" : "false");
  SetField(&tool_result, "http_referrer_policy_observed",
           result.referrer_policy_observed ? "true" : "false");
  SetField(&tool_result, "http_permissions_policy_observed",
           result.permissions_policy_observed ? "true" : "false");
  SetField(&tool_result, "observed_security_header_count",
           base::NumberToString(BoundedSecurityHeaderCount(
               result.observed_security_header_count)));
  SetField(&tool_result, "request_net_error",
           base::NumberToString(result.request_net_error));
  SetField(&tool_result, "public_address_guard_blocked",
           result.public_address_guard_blocked ? "true" : "false");
  SetField(&tool_result, "http_status",
           base::NumberToString(result.http_status));
  SetField(&tool_result, "tls_info_available",
           result.tls_info_available ? "true" : "false");
  SetField(&tool_result, "tls_certificate_valid",
           result.certificate_valid ? "true" : "false");
  SetField(&tool_result, "tls_certificate_name_mismatch",
           result.certificate_name_mismatch ? "true" : "false");
  SetField(&tool_result, "tls_certificate_authority_invalid",
           result.certificate_authority_invalid ? "true" : "false");
  SetField(&tool_result, "tls_certificate_revoked",
           result.certificate_revoked ? "true" : "false");
  SetField(&tool_result, "tls_certificate_expired",
           result.certificate_expired ? "true" : "false");
  SetField(&tool_result, "tls_days_remaining",
           base::NumberToString(result.certificate_days_remaining));
  SetField(&tool_result, "certificate_status",
           base::NumberToString(result.certificate_status));
  SetField(&tool_result, "issued_by_known_root",
           result.issued_by_known_root ? "true" : "false");
  SetField(&tool_result, "certificate_subject",
           SafeInspectionFieldValue(result.certificate_subject));
  SetField(&tool_result, "certificate_issuer",
           SafeInspectionFieldValue(result.certificate_issuer));
  SetField(&tool_result, "tls_version",
           SafeInspectionFieldValue(result.tls_version));
  SetField(&tool_result, "cipher_suite",
           SafeInspectionFieldValue(result.cipher_suite));
  SetField(&tool_result, "elapsed_milliseconds",
           base::NumberToString(result.elapsed_milliseconds));
  SetField(&tool_result, "inspection_kind", "dns_tls");
  SetField(&tool_result, "inspection_host", result.host);
  SetField(&tool_result, "diagnostic_comparison", comparison_state);
  SetField(&tool_result, "diagnostic_changed_fields",
           changed_fields.empty() ? "none" : changed_fields);
  SetField(&tool_result, "is_current", "true");
  ::tahai::UpsertEntity(&next, std::move(tool_result));

  AddMissionRelationship(&next, LocalOiRelationshipType::kReferenceLinksTo,
                         domain_id, endpoint_id,
                         "Domain is associated with this inspected endpoint.",
                         result.inspected_at);
  AddMissionRelationship(
      &next, LocalOiRelationshipType::kDerivedFrom, tool_result_id, endpoint_id,
      "Explicit DNS and TLS inspection derived from endpoint.",
      result.inspected_at);
  if (!watch_id.empty()) {
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kDerivedFrom, tool_result_id,
        std::string(watch_id),
        "Explicit DNS and TLS recheck derived from this manual-only local "
        "watch configuration.",
        result.inspected_at);
  }
  if (!previous_inspection_id.empty() &&
      previous_inspection_id != tool_result_id) {
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kSupersedes, tool_result_id,
        previous_inspection_id,
        "Explicit DNS and TLS inspection supersedes the prior local result.",
        result.inspected_at);
  }
  if (!mission_id.empty()) {
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kMissionTargets, mission_id,
        endpoint_id,
        "Explicit DNS and TLS inspection target selected for this Mission.",
        result.inspected_at);
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kMissionProduced, mission_id,
        tool_result_id,
        "Explicit DNS and TLS inspection result recorded for this Mission.",
        result.inspected_at);
  }
  AddMemory(&next, LocalOiMemoryAction::kOpsToolResultRecorded, tool_result_id,
            "A user-initiated DNS and TLS inspection was recorded locally.",
            result.inspected_at);
  if (!watch_id.empty()) {
    const auto watch = std::find_if(
        next.entities.begin(), next.entities.end(),
        [watch_id](const LocalOiEntityRecord& record) {
          return record.id == watch_id &&
                 record.type == LocalOiEntityType::kWatch &&
                 record.source == LocalOiRecordSource::kExplicitUserEntry;
        });
    if (watch == next.entities.end()) {
      return false;
    }
    // Completion is recorded only after the matching user-initiated DNS/TLS
    // inspection produced its bounded local result. This is history, not a
    // scheduling trigger.
    watch->updated_at = result.inspected_at;
    SetField(&*watch, "last_completed_at_windows_epoch_us",
             result.inspected_at);
  }
  if (!CommitWithRetention(std::move(next))) {
    return false;
  }
  return RecalculateFindings();
}

std::vector<LocalOiNetworkInspectionHistoryItem>
TahaiLocalOiService::NetworkInspectionHistory(std::string_view host) const {
  if (shutdown_ || !IsValidTahaiNetworkInspectionHost(host) ||
      !TahaiLocalOiPolicy(profile_->GetPrefs())
           .IsEnabled(LocalOiPolicyControl::kEnabled)) {
    return {};
  }
  std::vector<const LocalOiEntityRecord*> records;
  for (const LocalOiEntityRecord& record : store_.data().entities) {
    if (IsDnsTlsInspectionResultForHost(record, host)) {
      records.push_back(&record);
    }
  }
  std::stable_sort(
      records.begin(), records.end(),
      [](const LocalOiEntityRecord* left, const LocalOiEntityRecord* right) {
        if (left->updated_at != right->updated_at) {
          return left->updated_at > right->updated_at;
        }
        return left->id > right->id;
      });

  constexpr size_t kMaximumInspectionHistoryRows = 8u;
  std::vector<LocalOiNetworkInspectionHistoryItem> history;
  history.reserve(std::min(records.size(), kMaximumInspectionHistoryRows));
  for (const LocalOiEntityRecord* record : records) {
    if (history.size() == kMaximumInspectionHistoryRows) {
      break;
    }
    LocalOiNetworkInspectionHistoryItem item;
    item.inspected_at = record->updated_at;
    item.comparison = FieldValueOrEmpty(*record, "diagnostic_comparison");
    item.changed_fields =
        FieldValueOrEmpty(*record, "diagnostic_changed_fields");
    item.resolved_ipv4_count = BoundedDnsTopologyCount(
        FieldIntOrDefault(*record, "dns_ipv4_count", 0));
    item.resolved_ipv6_count = BoundedDnsTopologyCount(
        FieldIntOrDefault(*record, "dns_ipv6_count", 0));
    item.dns_alias_count = BoundedDnsTopologyCount(
        FieldIntOrDefault(*record, "dns_alias_count", 0));
    item.security_header_observation_available =
        FieldValueOrEmpty(*record, "security_header_observation_available") ==
        "true";
    item.observed_security_header_count = BoundedSecurityHeaderCount(
        FieldIntOrDefault(*record, "observed_security_header_count", 0));
    item.dns_net_error = FieldIntOrDefault(*record, "dns_net_error", 0);
    item.request_net_error = FieldIntOrDefault(*record, "request_net_error", 0);
    item.public_address_guard_blocked =
        FieldValueOrEmpty(*record, "public_address_guard_blocked") == "true";
    item.http_status = FieldIntOrDefault(*record, "http_status", 0);
    item.tls_info_available =
        FieldValueOrEmpty(*record, "tls_info_available") == "true";
    item.certificate_valid =
        FieldValueOrEmpty(*record, "tls_certificate_valid") == "true";
    item.certificate_expired =
        FieldValueOrEmpty(*record, "tls_certificate_expired") == "true";
    item.certificate_days_remaining =
        FieldIntOrDefault(*record, "tls_days_remaining", -1);
    history.push_back(std::move(item));
  }
  return history;
}

std::optional<LocalOiChangeCaptureOutcome>
TahaiLocalOiService::RecordChangeCapture(
    const TahaiChangeCaptureRequest& request,
    std::string_view mission_id) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kArtifactIngestion) ||
      (!mission_id.empty() && !IsValidLocalOiId(mission_id))) {
    return std::nullopt;
  }

  TahaiChangeCaptureRequest timestamped_request = request;
  timestamped_request.captured_at_windows_epoch_us =
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds();
  TahaiChangeCapture capture;
  if (ValidateTahaiChangeCaptureRequest(timestamped_request, &capture) !=
      TahaiChangeCaptureValidationResult::kValid) {
    return std::nullopt;
  }

  LocalOiStoreData next = store_.data();
  if (!mission_id.empty() && !IsActiveLocalMission(next, mission_id)) {
    return std::nullopt;
  }
  const LocalOiEntityRecord* previous = FindLatestChangeCapture(next, capture);
  std::optional<TahaiChangeCapture> previous_capture;
  std::string previous_id;
  if (previous) {
    previous_id = previous->id;
    previous_capture = ChangeCaptureFromEntity(*previous);
    if (previous_capture->captured_at_windows_epoch_us >=
        capture.captured_at_windows_epoch_us) {
      if (previous_capture->captured_at_windows_epoch_us ==
          std::numeric_limits<int64_t>::max()) {
        return std::nullopt;
      }
      capture.captured_at_windows_epoch_us =
          previous_capture->captured_at_windows_epoch_us + 1;
    }
  }
  const std::string now = LocalOiNowTimestamp();
  const std::string target_id = ChangeTargetEntityId(capture);
  for (LocalOiEntityRecord& candidate : next.entities) {
    const std::optional<TahaiChangeCapture> existing =
        ChangeCaptureFromEntity(candidate);
    if (existing && existing->kind == capture.kind &&
        existing->canonical_target == capture.canonical_target) {
      SetField(&candidate, "is_current", "false");
      candidate.updated_at = now;
    }
  }

  LocalOiEntityRecord target;
  target.id = target_id;
  target.type = IsDnsOrTlsChangeCapture(capture.kind)
                    ? LocalOiEntityType::kDomain
                    : LocalOiEntityType::kEndpoint;
  target.title = capture.canonical_target;
  target.summary =
      "Explicit Change Lens target retaining safe digest metadata only.";
  target.source = LocalOiRecordSource::kExplicitUserEntry;
  target.created_at = now;
  target.updated_at = now;
  SetField(&target, "change_tracking", "true");
  SetField(&target, "last_change_capture", now);
  SetField(&target, "last_change_capture_kind",
           std::string(TahaiChangeCaptureKindName(capture.kind)));
  ::tahai::UpsertEntity(&next, std::move(target));

  LocalOiChangeCaptureOutcome outcome;
  outcome.capture = capture;
  outcome.created_baseline = !previous_capture.has_value();
  outcome.linked_to_mission = !mission_id.empty();
  if (previous_capture) {
    outcome.comparison = CompareTahaiChangeCaptures(*previous_capture, capture);
  }
  outcome.record_id = StableLocalOiId(
      base::StrCat({"change_capture|", TahaiChangeCaptureKindName(capture.kind),
                    "|", capture.canonical_target, "|",
                    base::NumberToString(capture.captured_at_windows_epoch_us),
                    "|", capture.sha256_digest}));

  LocalOiEntityRecord record;
  record.id = outcome.record_id;
  record.type = LocalOiEntityType::kToolResult;
  record.mission_id = std::string(mission_id);
  record.title = "Explicit Change Lens digest";
  record.summary =
      "Operator-supplied SHA-256 digest; no captured material retained.";
  record.source = LocalOiRecordSource::kExplicitUserEntry;
  record.created_at = now;
  record.updated_at = now;
  SetField(&record, "change_capture_kind",
           std::string(TahaiChangeCaptureKindName(capture.kind)));
  SetField(&record, "change_target", capture.canonical_target);
  SetField(&record, "sha256_digest", capture.sha256_digest);
  SetField(&record, "captured_at_windows_epoch_us",
           base::NumberToString(capture.captured_at_windows_epoch_us));
  SetField(&record, "is_current", "true");
  SetField(&record, "change_state",
           outcome.created_baseline ? "baseline"
           : outcome.comparison == TahaiChangeComparisonResult::kChanged
               ? "changed"
               : "unchanged");
  if (!previous_id.empty()) {
    SetField(&record, "previous_capture_id", previous_id);
  }
  ::tahai::UpsertEntity(&next, std::move(record));
  AddMissionRelationship(
      &next, LocalOiRelationshipType::kDerivedFrom, outcome.record_id,
      target_id, "Explicit Change Lens digest is associated with this target.",
      now);
  if (!previous_id.empty()) {
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kSupersedes, outcome.record_id,
        previous_id,
        "This explicit digest supersedes the previous local capture.", now);
  }
  if (outcome.linked_to_mission) {
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kMissionTargets, mission_id, target_id,
        "Explicit Change Lens target selected for this Mission.", now);
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kMissionProduced, mission_id,
        outcome.record_id,
        "Explicit Change Lens result recorded for this Mission.", now);
    for (LocalOiEntityRecord& candidate : next.entities) {
      if (candidate.id != mission_id ||
          candidate.type != LocalOiEntityType::kMission) {
        continue;
      }
      if (outcome.created_baseline) {
        SetField(&candidate, "before_snapshot", "true");
      } else {
        SetField(&candidate, "after_snapshot", "true");
      }
      candidate.updated_at = now;
      break;
    }
  }
  AddMemory(
      &next, LocalOiMemoryAction::kChangeCaptureRecorded, outcome.record_id,
      outcome.created_baseline
          ? "An explicit local Change Lens baseline was recorded."
          : "An explicit local Change Lens digest was compared and recorded.",
      now);
  if (!CommitWithRetention(std::move(next)) || !RecalculateFindings()) {
    return std::nullopt;
  }
  return outcome;
}

std::vector<LocalOiChangeCaptureHistoryItem>
TahaiLocalOiService::ChangeCaptureHistory(TahaiChangeCaptureKind kind,
                                          std::string_view target) const {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kArtifactIngestion)) {
    return {};
  }
  TahaiChangeCapture lookup;
  const TahaiChangeCaptureRequest request = {
      kind, std::string(target), std::string(64u, '0'),
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds()};
  if (ValidateTahaiChangeCaptureRequest(request, &lookup) !=
      TahaiChangeCaptureValidationResult::kValid) {
    return {};
  }

  struct CaptureRecord {
    raw_ptr<const LocalOiEntityRecord> record;
    int64_t captured_at_windows_epoch_us;
  };
  std::vector<CaptureRecord> records;
  for (const LocalOiEntityRecord& record : store_.data().entities) {
    const std::optional<TahaiChangeCapture> capture =
        ChangeCaptureFromEntity(record);
    if (capture && capture->kind == lookup.kind &&
        capture->canonical_target == lookup.canonical_target) {
      records.push_back({&record, capture->captured_at_windows_epoch_us});
    }
  }
  std::stable_sort(records.begin(), records.end(),
                   [](const CaptureRecord& left, const CaptureRecord& right) {
                     if (left.captured_at_windows_epoch_us !=
                         right.captured_at_windows_epoch_us) {
                       return left.captured_at_windows_epoch_us >
                              right.captured_at_windows_epoch_us;
                     }
                     return left.record->id > right.record->id;
                   });

  constexpr size_t kMaximumChangeCaptureHistoryRows = 8u;
  std::vector<LocalOiChangeCaptureHistoryItem> history;
  history.reserve(std::min(records.size(), kMaximumChangeCaptureHistoryRows));
  for (const CaptureRecord& capture_record : records) {
    if (history.size() == kMaximumChangeCaptureHistoryRows) {
      break;
    }
    const std::string comparison =
        FieldValueOrEmpty(*capture_record.record, "change_state");
    LocalOiChangeCaptureHistoryItem item;
    item.recorded_at = capture_record.record->updated_at;
    item.comparison = comparison == "baseline" || comparison == "changed" ||
                              comparison == "unchanged"
                          ? comparison
                          : "unknown";
    item.is_current =
        HasFieldValue(*capture_record.record, "is_current", "true");
    history.push_back(std::move(item));
  }
  return history;
}

std::optional<LocalOiArtifactOutcome>
TahaiLocalOiService::RecordArtifactMetadata(
    const LocalOiArtifactRequest& request) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kArtifactIngestion) ||
      !IsSafeArtifactLabel(request.title) ||
      (!request.mission_id.empty() && !IsValidLocalOiId(request.mission_id))) {
    return std::nullopt;
  }

  TahaiChangeCapture canonical_source;
  const TahaiChangeCaptureRequest source_request = {
      TahaiChangeCaptureKind::kDownloadArtifactDigest, request.source_url,
      request.sha256_digest,
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds()};
  if (ValidateTahaiChangeCaptureRequest(source_request, &canonical_source) !=
      TahaiChangeCaptureValidationResult::kValid) {
    return std::nullopt;
  }

  LocalOiStoreData next = store_.data();
  if (!request.mission_id.empty() &&
      !IsActiveLocalMission(next, request.mission_id)) {
    return std::nullopt;
  }
  const std::string now = LocalOiNowTimestamp();
  LocalOiArtifactOutcome outcome;
  outcome.record_id = NewLocalOiId();
  outcome.canonical_source_url = canonical_source.canonical_target;
  outcome.linked_to_mission = !request.mission_id.empty();

  LocalOiEntityRecord artifact;
  artifact.id = outcome.record_id;
  artifact.type = LocalOiEntityType::kArtifact;
  artifact.mission_id = request.mission_id;
  artifact.title = request.title;
  artifact.summary =
      "Explicit artifact provenance and SHA-256 metadata; no file retained.";
  artifact.source = LocalOiRecordSource::kExplicitUserEntry;
  artifact.created_at = now;
  artifact.updated_at = now;
  SetField(&artifact, "hash_present", "true");
  SetField(&artifact, "sha256_digest", canonical_source.sha256_digest);
  SetField(&artifact, "source_origin_present", "true");
  SetField(&artifact, "source_origin", canonical_source.canonical_target);
  SetField(&artifact, "artifact_path_retained", "false");
  ::tahai::UpsertEntity(&next, std::move(artifact));
  if (outcome.linked_to_mission) {
    AddMissionRelationship(
        &next, LocalOiRelationshipType::kArtifactBelongsTo, outcome.record_id,
        request.mission_id,
        "Explicit artifact metadata belongs to this Mission.", now);
  }
  AddMemory(&next, LocalOiMemoryAction::kArtifactHashed, outcome.record_id,
            "Explicit artifact SHA-256 and source metadata recorded locally.",
            now);
  if (!CommitWithRetention(std::move(next)) || !RecalculateFindings()) {
    return std::nullopt;
  }
  return outcome;
}

std::vector<LocalOiArtifactHistoryItem> TahaiLocalOiService::ArtifactHistory(
    std::string_view source_url) const {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kArtifactIngestion)) {
    return {};
  }
  TahaiChangeCapture source;
  const TahaiChangeCaptureRequest request = {
      TahaiChangeCaptureKind::kDownloadArtifactDigest, std::string(source_url),
      std::string(64u, '0'),
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds()};
  if (ValidateTahaiChangeCaptureRequest(request, &source) !=
      TahaiChangeCaptureValidationResult::kValid) {
    return {};
  }

  std::vector<const LocalOiEntityRecord*> records;
  for (const LocalOiEntityRecord& record : store_.data().entities) {
    if (record.type == LocalOiEntityType::kArtifact &&
        record.source == LocalOiRecordSource::kExplicitUserEntry &&
        HasFieldValue(record, "source_origin", source.canonical_target) &&
        HasFieldValue(record, "source_origin_present", "true")) {
      records.push_back(&record);
    }
  }
  std::stable_sort(
      records.begin(), records.end(),
      [](const LocalOiEntityRecord* left, const LocalOiEntityRecord* right) {
        if (left->updated_at != right->updated_at) {
          return left->updated_at > right->updated_at;
        }
        return left->id > right->id;
      });

  constexpr size_t kMaximumArtifactHistoryRows = 8u;
  std::vector<LocalOiArtifactHistoryItem> history;
  history.reserve(std::min(records.size(), kMaximumArtifactHistoryRows));
  for (const LocalOiEntityRecord* record : records) {
    if (history.size() == kMaximumArtifactHistoryRows) {
      break;
    }
    history.push_back({record->updated_at, record->title,
                       HasFieldValue(*record, "hash_present", "true")});
  }
  return history;
}

std::optional<LocalOiDocumentReferenceOutcome>
TahaiLocalOiService::RecordDocumentReference(
    const LocalOiDocumentReferenceRequest& request) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(
          LocalOiPolicyControl::kDocumentationReferenceIngestion) ||
      !IsSafeDocumentReferenceTitle(request.title) ||
      !IsValidLocalOiId(request.endpoint_id) ||
      (!request.mission_id.empty() && !IsValidLocalOiId(request.mission_id))) {
    return std::nullopt;
  }

  // Share the existing public HTTPS target validator without treating the
  // reference as a Change Lens capture. The fixed dummy digest never enters
  // the store; this only canonicalizes a query-free, credential-free public
  // target and performs no navigation, DNS, network, or content access.
  TahaiChangeCapture validated_reference;
  const TahaiChangeCaptureRequest validation_request = {
      TahaiChangeCaptureKind::kContentDigest, request.reference_url,
      std::string(64u, '0'),
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds()};
  if (ValidateTahaiChangeCaptureRequest(validation_request,
                                        &validated_reference) !=
      TahaiChangeCaptureValidationResult::kValid) {
    return std::nullopt;
  }

  LocalOiStoreData next = store_.data();
  const auto endpoint = std::find_if(
      next.entities.begin(), next.entities.end(),
      [&request](const LocalOiEntityRecord& entity) {
        return entity.id == request.endpoint_id &&
               entity.type == LocalOiEntityType::kEndpoint && !entity.archived;
      });
  if (endpoint == next.entities.end()) {
    return std::nullopt;
  }
  if (!request.mission_id.empty() &&
      !IsActiveLocalMission(next, request.mission_id)) {
    return std::nullopt;
  }

  const std::string now = LocalOiNowTimestamp();
  LocalOiDocumentReferenceOutcome outcome;
  outcome.endpoint_id = request.endpoint_id;
  outcome.canonical_reference_url = validated_reference.canonical_target;
  outcome.linked_to_mission = !request.mission_id.empty();
  outcome.record_id = StableLocalOiId(
      base::StrCat({"documentation_reference|", request.endpoint_id, "|",
                    outcome.canonical_reference_url}));

  LocalOiEntityRecord reference;
  reference.id = outcome.record_id;
  reference.type = LocalOiEntityType::kDocumentReference;
  reference.mission_id = request.mission_id;
  reference.title = request.title;
  reference.summary =
      "Explicit public documentation pointer; referenced material was not "
      "opened, read, indexed, or retained.";
  reference.source = LocalOiRecordSource::kExplicitUserEntry;
  reference.created_at = now;
  reference.updated_at = now;
  const auto existing =
      std::find_if(next.entities.begin(), next.entities.end(),
                   [&outcome](const LocalOiEntityRecord& entity) {
                     return entity.id == outcome.record_id;
                   });
  if (existing != next.entities.end()) {
    reference.created_at = existing->created_at;
  }
  SetField(&reference, "endpoint_id", request.endpoint_id);
  SetField(&reference, "reference_url", outcome.canonical_reference_url);
  SetField(&reference, "reference_opened", "false");
  SetField(&reference, "content_retained", "false");
  ::tahai::UpsertEntity(&next, std::move(reference));
  AddMissionRelationship(
      &next, LocalOiRelationshipType::kReferenceLinksTo, outcome.record_id,
      request.endpoint_id,
      "Explicit local document reference identifies this endpoint.", now);
  // A pointer may be re-saved as work moves between Missions. It keeps only
  // its current explicit context edge and never infers a Mission from the
  // reference URL or endpoint host.
  RemoveMissionAssociationByTargetAndBasis(
      &next, LocalOiRelationshipType::kMissionUses, outcome.record_id,
      kDocumentationMissionUseBasis);
  if (outcome.linked_to_mission) {
    AddMissionRelationship(&next, LocalOiRelationshipType::kMissionUses,
                           request.mission_id, outcome.record_id,
                           kDocumentationMissionUseBasis, now);
  }
  AddMemory(&next, LocalOiMemoryAction::kDocumentationReferenceRecorded,
            outcome.record_id,
            "An explicit documentation reference was linked to a local "
            "endpoint without opening its source.",
            now);
  if (!CommitWithRetention(std::move(next)) || !RecalculateFindings()) {
    return std::nullopt;
  }
  return outcome;
}

std::vector<LocalOiDocumentReferenceItem>
TahaiLocalOiService::DocumentReferencesForEndpoint(
    std::string_view endpoint_id) const {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(
          LocalOiPolicyControl::kDocumentationReferenceIngestion) ||
      !IsValidLocalOiId(endpoint_id)) {
    return {};
  }
  const auto endpoint = std::find_if(
      store_.data().entities.begin(), store_.data().entities.end(),
      [endpoint_id](const LocalOiEntityRecord& entity) {
        return entity.id == endpoint_id &&
               entity.type == LocalOiEntityType::kEndpoint && !entity.archived;
      });
  if (endpoint == store_.data().entities.end()) {
    return {};
  }

  std::vector<LocalOiDocumentReferenceItem> references;
  for (const LocalOiEntityRecord& record : store_.data().entities) {
    if (record.type != LocalOiEntityType::kDocumentReference ||
        record.source != LocalOiRecordSource::kExplicitUserEntry ||
        !HasFieldValue(record, "endpoint_id", endpoint_id) ||
        !HasFieldValue(record, "reference_opened", "false") ||
        !HasFieldValue(record, "content_retained", "false") ||
        !IsSafeDocumentReferenceTitle(record.title)) {
      continue;
    }
    TahaiChangeCapture pointer;
    const TahaiChangeCaptureRequest request = {
        TahaiChangeCaptureKind::kContentDigest,
        FieldValueOrEmpty(record, "reference_url"), std::string(64u, '0'),
        base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds()};
    if (ValidateTahaiChangeCaptureRequest(request, &pointer) !=
        TahaiChangeCaptureValidationResult::kValid) {
      continue;
    }
    references.push_back(
        {record.updated_at, record.title, pointer.canonical_target});
  }
  std::stable_sort(references.begin(), references.end(),
                   [](const LocalOiDocumentReferenceItem& left,
                      const LocalOiDocumentReferenceItem& right) {
                     if (left.recorded_at != right.recorded_at) {
                       return left.recorded_at > right.recorded_at;
                     }
                     return left.reference_url > right.reference_url;
                   });
  constexpr size_t kMaximumDocumentReferencesPerEndpoint = 16u;
  if (references.size() > kMaximumDocumentReferencesPerEndpoint) {
    references.resize(kMaximumDocumentReferencesPerEndpoint);
  }
  return references;
}

std::optional<LocalOiManualWatchOutcome>
TahaiLocalOiService::ConfigureManualWatch(
    const TahaiSentinelWatchRequest& request,
    std::string_view mission_id) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kOpsToolIngestion) ||
      (!mission_id.empty() && !IsValidLocalOiId(mission_id))) {
    return std::nullopt;
  }
  std::string canonical_target;
  if (ValidateTahaiSentinelWatchRequest(request, &canonical_target) !=
      TahaiSentinelWatchValidationResult::kValid) {
    return std::nullopt;
  }

  const std::string now = LocalOiNowTimestamp();
  LocalOiStoreData next = store_.data();
  if (!mission_id.empty() && !IsActiveLocalMission(next, mission_id)) {
    return std::nullopt;
  }
  LocalOiManualWatchOutcome outcome;
  outcome.kind = request.kind;
  outcome.canonical_target = canonical_target;
  outcome.interval_seconds = request.interval_seconds;
  outcome.linked_to_mission = !mission_id.empty();
  outcome.record_id = StableLocalOiId(
      base::StrCat({"manual_watch|", TahaiSentinelWatchKindName(request.kind),
                    "|", canonical_target}));
  const std::string target_id = StableLocalOiId(base::StrCat(
      {"manual_watch_target|", TahaiSentinelWatchKindName(request.kind), "|",
       canonical_target}));
  const auto prior_watch = std::find_if(
      next.entities.begin(), next.entities.end(),
      [&outcome](const LocalOiEntityRecord& record) {
        return record.id == outcome.record_id &&
               record.type == LocalOiEntityType::kWatch &&
               record.source == LocalOiRecordSource::kExplicitUserEntry;
      });
  const bool has_prior_watch = prior_watch != next.entities.end();
  const std::string prior_watch_created_at =
      has_prior_watch ? prior_watch->created_at : std::string();
  const std::optional<int64_t> prior_last_completed =
      has_prior_watch
          ? FieldTimestampOrNull(*prior_watch,
                                 "last_completed_at_windows_epoch_us")
          : std::nullopt;

  LocalOiEntityRecord target;
  target.id = target_id;
  target.type = IsDnsOrTlsManualWatch(request.kind)
                    ? LocalOiEntityType::kDomain
                    : LocalOiEntityType::kEndpoint;
  target.title = canonical_target;
  target.summary = "Explicit manual recheck target; no observation is running.";
  target.source = LocalOiRecordSource::kExplicitUserEntry;
  target.created_at = now;
  target.updated_at = now;
  SetField(&target, "manual_recheck_target", "true");
  ::tahai::UpsertEntity(&next, std::move(target));

  LocalOiEntityRecord watch;
  watch.id = outcome.record_id;
  watch.type = LocalOiEntityType::kWatch;
  watch.mission_id = std::string(mission_id);
  watch.title =
      base::StrCat({"Manual recheck: ",
                    std::string(TahaiSentinelWatchKindName(request.kind))});
  watch.summary = canonical_target;
  watch.source = LocalOiRecordSource::kExplicitUserEntry;
  watch.created_at = has_prior_watch ? prior_watch_created_at : now;
  watch.updated_at = now;
  SetField(&watch, "watch_kind",
           std::string(TahaiSentinelWatchKindName(request.kind)));
  SetField(&watch, "watch_target", canonical_target);
  SetField(&watch, "interval_seconds",
           base::NumberToString(request.interval_seconds));
  SetField(&watch, "execution_mode", "manual_only");
  SetField(&watch, "network_scheduler", "false");
  if (prior_last_completed) {
    SetField(&watch, "last_completed_at_windows_epoch_us",
             base::NumberToString(*prior_last_completed));
  }
  ::tahai::UpsertEntity(&next, std::move(watch));
  AddMissionRelationship(
      &next, LocalOiRelationshipType::kReferenceLinksTo, outcome.record_id,
      target_id,
      "Manual recheck configuration points to this approved public target.",
      now);
  // A saved watch is a mutable configuration record. Re-saving it with a
  // different Mission (or no Mission) must not leave a stale active context
  // edge in the local graph. This never touches independently created tool
  // result relationships for the same public target.
  RemoveMissionAssociationByTargetAndBasis(
      &next, LocalOiRelationshipType::kMissionUses, outcome.record_id,
      kManualWatchMissionUseBasis);
  RemoveMissionAssociationByTargetAndBasis(
      &next, LocalOiRelationshipType::kMissionTargets, target_id,
      kManualWatchMissionTargetBasis);
  if (outcome.linked_to_mission) {
    AddMissionRelationship(&next, LocalOiRelationshipType::kMissionUses,
                           mission_id, outcome.record_id,
                           kManualWatchMissionUseBasis, now);
    AddMissionRelationship(&next, LocalOiRelationshipType::kMissionTargets,
                           mission_id, target_id,
                           kManualWatchMissionTargetBasis, now);
  }
  AddMemory(&next, LocalOiMemoryAction::kWatchConfigured, outcome.record_id,
            "A manual-only local recheck list entry was configured.", now);
  if (!CommitWithRetention(std::move(next)) || !RecalculateFindings()) {
    return std::nullopt;
  }
  return outcome;
}

std::vector<LocalOiManualWatchItem> TahaiLocalOiService::ManualWatches() const {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kOpsToolIngestion)) {
    return {};
  }
  int64_t now_micros = 0;
  const bool has_valid_now =
      base::StringToInt64(LocalOiNowTimestamp(), &now_micros) && now_micros > 0;
  std::vector<LocalOiManualWatchItem> watches;
  for (const LocalOiEntityRecord& record : store_.data().entities) {
    if (record.type != LocalOiEntityType::kWatch ||
        record.source != LocalOiRecordSource::kExplicitUserEntry ||
        !HasFieldValue(record, "execution_mode", "manual_only") ||
        !HasFieldValue(record, "network_scheduler", "false") ||
        !IsSafeLocalOiText(record.title,
                           kTahaiLocalOiMaximumRecordTitleLength)) {
      continue;
    }
    const std::optional<TahaiSentinelWatchKind> kind =
        TahaiSentinelWatchKindFromName(FieldValueOrEmpty(record, "watch_kind"));
    const std::string target = FieldValueOrEmpty(record, "watch_target");
    const int interval_seconds =
        FieldIntOrDefault(record, "interval_seconds", 0);
    std::string canonical_target;
    if (!kind || ValidateTahaiSentinelWatchRequest(
                     {*kind, target, interval_seconds}, &canonical_target) !=
                     TahaiSentinelWatchValidationResult::kValid) {
      continue;
    }
    const std::optional<int64_t> last_completed =
        FieldTimestampOrNull(record, "last_completed_at_windows_epoch_us");
    const TahaiSentinelScheduleStatus schedule =
        has_valid_now ? GetTahaiSentinelManualScheduleStatus(
                            {*kind, canonical_target, interval_seconds},
                            last_completed, now_micros)
                      : TahaiSentinelScheduleStatus();
    LocalOiManualWatchItem item;
    item.record_id = record.id;
    item.title = record.title;
    item.target = canonical_target;
    item.kind = std::string(TahaiSentinelWatchKindName(*kind));
    item.mission_id = record.mission_id;
    item.interval_seconds = interval_seconds;
    item.last_completed_at =
        last_completed ? base::NumberToString(*last_completed) : std::string();
    item.schedule_state =
        std::string(TahaiSentinelScheduleStateName(schedule.state));
    item.seconds_until_due = schedule.seconds_until_due;
    watches.push_back(std::move(item));
  }
  std::stable_sort(watches.begin(), watches.end(),
                   [](const LocalOiManualWatchItem& left,
                      const LocalOiManualWatchItem& right) {
                     if (left.target != right.target) {
                       return left.target < right.target;
                     }
                     return left.kind < right.kind;
                   });
  constexpr size_t kMaximumManualWatchRows = 16u;
  if (watches.size() > kMaximumManualWatchRows) {
    watches.resize(kMaximumManualWatchRows);
  }
  return watches;
}

std::optional<LocalOiEnvironmentClassificationOutcome>
TahaiLocalOiService::ConfigureEnvironmentClassification(
    TahaiEnvironment environment,
    std::string_view origin,
    std::string_view mission_id) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kOpsToolIngestion) ||
      (!mission_id.empty() && !IsValidLocalOiId(mission_id))) {
    return std::nullopt;
  }
  std::string canonical_origin;
  if (ValidateTahaiEnvironmentRuleOrigin(origin, &canonical_origin) !=
      TahaiEnvironmentRuleValidationResult::kValid) {
    return std::nullopt;
  }
  if (!CanSetTahaiEnvironmentGuardRule(profile_->GetPrefs(),
                                       canonical_origin)) {
    return std::nullopt;
  }

  const TahaiEnvironmentPosture& posture =
      GetTahaiEnvironmentPosture(environment);
  const std::string now = LocalOiNowTimestamp();
  LocalOiStoreData next = store_.data();
  if (!mission_id.empty() && !IsActiveLocalMission(next, mission_id)) {
    return std::nullopt;
  }
  LocalOiEnvironmentClassificationOutcome outcome;
  outcome.record_id =
      StableLocalOiId(base::StrCat({"environment_guard|", canonical_origin}));
  outcome.canonical_origin = canonical_origin;
  outcome.environment = environment;
  outcome.linked_to_mission = !mission_id.empty();

  LocalOiEntityRecord endpoint;
  endpoint.id = outcome.record_id;
  endpoint.type = LocalOiEntityType::kEndpoint;
  endpoint.mission_id = std::string(mission_id);
  endpoint.title = canonical_origin;
  endpoint.summary =
      "Explicit local Environment Guard classification; not an enforcement "
      "claim.";
  endpoint.source = LocalOiRecordSource::kExplicitUserEntry;
  endpoint.created_at = now;
  endpoint.updated_at = now;
  SetField(&endpoint, "environment",
           std::string(TahaiEnvironmentName(environment)));
  SetField(&endpoint, "show_persistent_boundary",
           posture.show_persistent_boundary ? "true" : "false");
  SetField(&endpoint, "confirm_multiline_paste",
           posture.confirm_multiline_paste ? "true" : "false");
  SetField(&endpoint, "warn_on_download_or_upload",
           posture.warn_on_download_or_upload ? "true" : "false");
  SetField(&endpoint, "require_redaction_preview",
           posture.require_redaction_preview ? "true" : "false");
  SetField(&endpoint, "block_pilot_actions",
           posture.block_pilot_actions ? "true" : "false");
  SetField(&endpoint, "native_boundary_registry", "true");
  SetField(&endpoint, "browser_wide_enforcement", "false");
  ::tahai::UpsertEntity(&next, std::move(endpoint));
  // The origin is a mutable local classification. Keep at most one current
  // Mission context edge while retaining no browser-wide enforcement claim.
  RemoveMissionAssociationByTargetAndBasis(
      &next, LocalOiRelationshipType::kMissionUses, outcome.record_id,
      kEnvironmentMissionUseBasis);
  if (outcome.linked_to_mission) {
    AddMissionRelationship(&next, LocalOiRelationshipType::kMissionUses,
                           mission_id, outcome.record_id,
                           kEnvironmentMissionUseBasis, now);
  }
  AddMemory(
      &next, LocalOiMemoryAction::kEnvironmentClassified, outcome.record_id,
      "An explicit exact-origin local environment classification was recorded.",
      now);
  if (!CommitWithRetention(std::move(next))) {
    return std::nullopt;
  }
  if (!SetTahaiEnvironmentGuardRule(profile_->GetPrefs(), environment,
                                    canonical_origin)) {
    return std::nullopt;
  }
  return outcome;
}

std::vector<LocalOiEnvironmentClassificationItem>
TahaiLocalOiService::EnvironmentClassifications() const {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kOpsToolIngestion)) {
    return {};
  }
  std::vector<LocalOiEnvironmentClassificationItem> classifications;
  for (const LocalOiEntityRecord& record : store_.data().entities) {
    if (record.type != LocalOiEntityType::kEndpoint ||
        record.source != LocalOiRecordSource::kExplicitUserEntry ||
        !HasFieldValue(record, "browser_wide_enforcement", "false")) {
      continue;
    }
    std::string canonical_origin;
    const std::optional<TahaiEnvironment> environment =
        TahaiEnvironmentFromName(FieldValueOrEmpty(record, "environment"));
    if (!environment ||
        ValidateTahaiEnvironmentRuleOrigin(record.title, &canonical_origin) !=
            TahaiEnvironmentRuleValidationResult::kValid) {
      continue;
    }
    classifications.push_back(
        {canonical_origin, std::string(TahaiEnvironmentName(*environment)),
         HasFieldValue(record, "show_persistent_boundary", "true"),
         HasFieldValue(record, "require_redaction_preview", "true"),
         HasFieldValue(record, "block_pilot_actions", "true")});
  }
  std::stable_sort(classifications.begin(), classifications.end(),
                   [](const LocalOiEnvironmentClassificationItem& left,
                      const LocalOiEnvironmentClassificationItem& right) {
                     return left.origin < right.origin;
                   });
  constexpr size_t kMaximumEnvironmentClassifications = 16u;
  if (classifications.size() > kMaximumEnvironmentClassifications) {
    classifications.resize(kMaximumEnvironmentClassifications);
  }
  return classifications;
}

bool TahaiLocalOiService::AcknowledgeFinding(std::string_view finding_id,
                                             std::string_view note) {
  return TransitionFinding(finding_id, LocalOiFindingState::kAcknowledged,
                           note);
}

bool TahaiLocalOiService::ResolveFinding(std::string_view finding_id,
                                         std::string_view reason) {
  return TransitionFinding(finding_id, LocalOiFindingState::kResolved, reason);
}

bool TahaiLocalOiService::SuppressFinding(std::string_view finding_id,
                                          std::string_view reason) {
  return TransitionFinding(finding_id, LocalOiFindingState::kSuppressed,
                           reason);
}

bool TahaiLocalOiService::ReopenFinding(std::string_view finding_id,
                                        std::string_view note) {
  return TransitionFinding(finding_id, LocalOiFindingState::kOpen, note);
}

std::vector<LocalOiSearchResult> TahaiLocalOiService::Search(
    std::string_view query) const {
  LocalOiSearchOptions options;
  options.query = std::string(query);
  return Search(options);
}

std::vector<LocalOiSearchResult> TahaiLocalOiService::Search(
    const LocalOiSearchOptions& options) const {
  if (shutdown_ || !TahaiLocalOiPolicy(profile_->GetPrefs())
                        .IsEnabled(LocalOiPolicyControl::kEnabled)) {
    return {};
  }
  return SearchLocalOiSnapshot(BuildLocalOiSnapshot(store_.data()), options);
}

std::optional<std::string> TahaiLocalOiService::GenerateSafeReport(
    LocalOiSafeReportKind kind) {
  return GenerateSafeReport(kind, LocalOiSafeReportFormat::kMarkdown);
}

std::optional<std::string> TahaiLocalOiService::GenerateSafeReport(
    LocalOiSafeReportKind kind,
    LocalOiSafeReportFormat format) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kReports) ||
      !policy.IsEnabled(LocalOiPolicyControl::kExport)) {
    return std::nullopt;
  }
  const std::string now = LocalOiNowTimestamp();
  const LocalOiRedactionResult redaction =
      RedactLocalOiExportText(BuildLocalOiSafeReport(
          BuildLocalOiSnapshot(store_.data()), kind, format, now));
  if (redaction.blocked || redaction.text.empty()) {
    return std::nullopt;
  }
  LocalOiStoreData next = store_.data();
  const std::string report_id = NewLocalOiId();
  next.reports.push_back(
      {report_id, StoredReportKind(kind),
       std::string(LocalOiSafeReportKindLabel(kind)), redaction.text,
       format == LocalOiSafeReportFormat::kJson
           ? "Generated as redacted aggregate JSON from persisted local "
             "records; no hosted audit or upload."
           : "Generated as redacted aggregate Markdown from persisted local "
             "records; no hosted audit or upload.",
       now, redaction.redaction_count});
  RetainNewestReports(&next);
  AddMemory(&next, LocalOiMemoryAction::kReportGenerated, report_id,
            "A safe aggregate Local OI report was generated.", now);
  if (!CommitWithRetention(std::move(next))) {
    return std::nullopt;
  }
  return redaction.text;
}

bool TahaiLocalOiService::RecordSafeReportCopied(LocalOiSafeReportKind kind) {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kReports) ||
      !policy.IsEnabled(LocalOiPolicyControl::kExport)) {
    return false;
  }
  LocalOiStoreData next = store_.data();
  const auto report = std::find_if(next.reports.rbegin(), next.reports.rend(),
                                   [kind](const LocalOiReportRecord& item) {
                                     return item.kind == StoredReportKind(kind);
                                   });
  if (report == next.reports.rend()) {
    return false;
  }
  const std::string now = LocalOiNowTimestamp();
  AddMemory(&next, LocalOiMemoryAction::kSafeExportCompleted, report->id,
            "A safe aggregate Local OI report was explicitly copied to the "
            "clipboard.",
            now);
  return CommitWithRetention(std::move(next));
}

std::optional<LocalOiAssistPrompt>
TahaiLocalOiService::PrepareLocalAssistPrompt(
    const LocalOiAssistRequest& request) const {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !policy.IsEnabled(LocalOiPolicyControl::kLocalAi)) {
    return std::nullopt;
  }
  return tahai::PrepareLocalOiAssistPrompt(BuildLocalOiSnapshot(store_.data()),
                                           request);
}

std::optional<LocalOiDeterministicBrief>
TahaiLocalOiService::BuildDeterministicLocalBrief(
    const LocalOiAssistRequest& request) const {
  const TahaiLocalOiPolicy policy(profile_->GetPrefs());
  if (shutdown_ || !policy.IsEnabled(LocalOiPolicyControl::kEnabled)) {
    return std::nullopt;
  }
  const std::optional<LocalOiAssistPrompt> prompt =
      tahai::PrepareLocalOiAssistPrompt(BuildLocalOiSnapshot(store_.data()),
                                        request);
  if (!prompt) {
    return std::nullopt;
  }
  return BuildLocalOiDeterministicBrief(*prompt);
}

bool TahaiLocalOiService::TransitionFinding(std::string_view finding_id,
                                            LocalOiFindingState state,
                                            std::string_view rationale) {
  if (!CanWriteLocalData() || !IsValidLocalOiId(finding_id) ||
      !IsSafeLocalOiText(rationale, kTahaiLocalOiMaximumSummaryLength)) {
    return false;
  }
  LocalOiStoreData next = store_.data();
  auto finding = std::find_if(next.findings.begin(), next.findings.end(),
                              [finding_id](const LocalOiFindingRecord& record) {
                                return record.id == finding_id;
                              });
  if (finding == next.findings.end()) {
    return false;
  }
  const std::string now = LocalOiNowTimestamp();
  LocalOiMemoryAction action = LocalOiMemoryAction::kFindingAcknowledged;
  switch (state) {
    case LocalOiFindingState::kAcknowledged:
      if (finding->state == LocalOiFindingState::kResolved) {
        return false;
      }
      finding->state = state;
      finding->acknowledged = true;
      finding->acknowledgement_note = std::string(rationale);
      action = LocalOiMemoryAction::kFindingAcknowledged;
      break;
    case LocalOiFindingState::kResolved:
      finding->state = state;
      finding->acknowledged = false;
      finding->acknowledgement_note.clear();
      finding->resolution_reason = std::string(rationale);
      action = LocalOiMemoryAction::kFindingResolved;
      break;
    case LocalOiFindingState::kSuppressed:
      finding->state = state;
      finding->acknowledged = false;
      finding->acknowledgement_note.clear();
      finding->resolution_reason = std::string(rationale);
      action = LocalOiMemoryAction::kFindingSuppressed;
      break;
    case LocalOiFindingState::kOpen:
      finding->state = state;
      finding->acknowledged = false;
      finding->acknowledgement_note.clear();
      finding->resolution_reason.clear();
      action = LocalOiMemoryAction::kFindingReopened;
      break;
  }
  finding->updated_at = now;
  AddMemory(
      &next, action, finding->id,
      "A Local OI finding lifecycle state changed by explicit operator action.",
      now);
  return CommitWithRetention(std::move(next));
}

bool TahaiLocalOiService::SyncMissions(
    const std::vector<MissionSummary>& missions) {
  if (shutdown_ ||
      !TahaiLocalOiPolicy(profile_->GetPrefs())
           .IsEnabled(LocalOiPolicyControl::kEnabled) ||
      !TahaiLocalOiPolicy(profile_->GetPrefs())
           .IsEnabled(LocalOiPolicyControl::kMissionIngestion)) {
    return false;
  }
  LocalOiStoreData next = store_.data();
  next.entities.erase(std::remove_if(next.entities.begin(), next.entities.end(),
                                     IsMissionDerived),
                      next.entities.end());
  next.relationships.erase(
      std::remove_if(
          next.relationships.begin(), next.relationships.end(),
          [&next](const LocalOiRelationshipRecord& relationship) {
            return std::none_of(
                       next.entities.begin(), next.entities.end(),
                       [&relationship](const LocalOiEntityRecord& entity) {
                         return entity.id == relationship.source_id;
                       }) ||
                   std::none_of(
                       next.entities.begin(), next.entities.end(),
                       [&relationship](const LocalOiEntityRecord& entity) {
                         return entity.id == relationship.target_id;
                       });
          }),
      next.relationships.end());

  for (const MissionSummary& mission : missions) {
    if (!IsValidLocalOiId(mission.id) ||
        !IsSafeLocalOiText(mission.title,
                           kTahaiLocalOiMaximumRecordTitleLength) ||
        !IsSafeLocalOiText(mission.type, 128u) ||
        !IsValidLocalOiTimestamp(mission.created_at) ||
        !IsValidLocalOiTimestamp(mission.updated_at)) {
      continue;
    }
    LocalOiEntityRecord root;
    root.id = mission.id;
    root.type = LocalOiEntityType::kMission;
    root.mission_id = mission.id;
    root.title = mission.title;
    root.summary = "Bounded TAHAI Mission record.";
    root.source = LocalOiRecordSource::kMission;
    root.created_at = mission.created_at;
    root.updated_at = mission.updated_at;
    root.archived = mission.archived;
    SetField(&root, "has_objective", mission.title.empty() ? "false" : "true");
    SetField(&root, "mission_type", mission.type);
    SetField(&root, "escalation_required",
             mission.escalation_required ? "true" : "false");
    SetField(&root, "preflight_incomplete",
             base::NumberToString(mission.steps.size() -
                                  CountCompleted(mission.steps)));
    SetField(&root, "validation_total",
             base::NumberToString(mission.validation_steps.size()));
    SetField(&root, "validation_complete",
             base::NumberToString(CountCompleted(mission.validation_steps)));
    SetField(&root, "rollback_total",
             base::NumberToString(mission.rollback_steps.size()));
    SetField(&root, "rollback_complete",
             base::NumberToString(CountCompleted(mission.rollback_steps)));
    const bool has_before_snapshot =
        HasMissionChangeCaptureWithState(next, mission.id, "baseline");
    const bool has_after_snapshot =
        HasMissionChangeCaptureWithState(next, mission.id, "changed") ||
        HasMissionChangeCaptureWithState(next, mission.id, "unchanged");
    SetField(&root, "before_snapshot", has_before_snapshot ? "true" : "false");
    SetField(&root, "after_snapshot", has_after_snapshot ? "true" : "false");
    ::tahai::UpsertEntity(&next, std::move(root));
    AddRunbookAndSteps(&next, mission, "runbook", mission.steps);
    AddRunbookAndSteps(&next, mission, "validation", mission.validation_steps);
    AddRunbookAndSteps(&next, mission, "rollback", mission.rollback_steps);

    for (size_t index = 0; index < mission.evidence.size(); ++index) {
      const MissionEvidence& evidence = mission.evidence[index];
      if (!IsSafeLocalOiText(evidence.label,
                             kTahaiLocalOiMaximumRecordTitleLength) ||
          !IsSafeLocalOiText(evidence.capture_scope,
                             kTahaiLocalOiMaximumSummaryLength) ||
          !IsValidLocalOiTimestamp(evidence.captured_at)) {
        continue;
      }
      const std::string id = StableLocalOiId(base::StrCat(
          {"mission|", mission.id, "|evidence|", base::NumberToString(index)}));
      LocalOiEntityRecord record;
      record.id = id;
      record.type = LocalOiEntityType::kEvidence;
      record.mission_id = mission.id;
      record.title = evidence.label;
      record.summary = evidence.capture_scope;
      record.source = LocalOiRecordSource::kMissionEvidence;
      record.created_at = evidence.captured_at;
      record.updated_at = evidence.captured_at;
      SetField(&record, "provenance_present", "true");
      SetField(&record, "capture_scope", evidence.capture_scope);
      ::tahai::UpsertEntity(&next, std::move(record));
      AddMissionRelationship(
          &next, LocalOiRelationshipType::kEvidenceSupports, id, mission.id,
          "Mission evidence supports this Mission.", evidence.captured_at);
      AddMemory(&next, LocalOiMemoryAction::kEvidenceCaptured, id,
                "Mission evidence metadata captured.", evidence.captured_at);
    }
    for (const MissionEvent& event : mission.timeline) {
      if (!IsSafeLocalOiText(event.kind, 128u) ||
          !IsSafeLocalOiText(event.detail, kTahaiLocalOiMaximumSummaryLength) ||
          !IsValidLocalOiTimestamp(event.created_at)) {
        continue;
      }
      AddMemory(&next, LocalOiMemoryAction::kMissionCreated, mission.id,
                base::StrCat({event.kind, ": ", event.detail}),
                event.created_at);
    }
  }
  if (!CommitWithRetention(std::move(next))) {
    return false;
  }
  return RecalculateFindings();
}

bool TahaiLocalOiService::RecalculateFindings() {
  if (!CanWriteLocalData()) {
    return false;
  }
  LocalOiStoreData next = store_.data();
  const std::vector<LocalOiRuleProposal> proposals =
      rule_engine_.Evaluate(next);
  std::set<std::string> active_keys;
  const std::string now = LocalOiNowTimestamp();
  for (const LocalOiRuleProposal& proposal : proposals) {
    active_keys.insert(proposal.stable_key);
    auto existing =
        std::find_if(next.findings.begin(), next.findings.end(),
                     [&proposal](const auto& finding) {
                       return finding.source_basis == proposal.source_basis;
                     });
    if (existing == next.findings.end()) {
      if (next.findings.size() >= kTahaiLocalOiMaximumFindings) {
        return false;
      }
      LocalOiFindingRecord finding;
      finding.id = NewLocalOiId();
      finding.rule_id = proposal.rule_id;
      finding.category = proposal.category;
      finding.severity = proposal.severity;
      finding.title = proposal.title;
      finding.explanation = proposal.explanation;
      finding.affected_entity_ids = proposal.affected_entity_ids;
      finding.supporting_evidence_ids = proposal.supporting_evidence_ids;
      finding.remediation = proposal.remediation;
      finding.created_at = now;
      finding.updated_at = now;
      finding.source_basis = proposal.source_basis;
      next.findings.push_back(std::move(finding));
      AddMemory(&next, LocalOiMemoryAction::kFindingCreated,
                next.findings.back().id, "Local OI finding created.", now);
      continue;
    }
    existing->category = proposal.category;
    existing->severity = proposal.severity;
    existing->title = proposal.title;
    existing->explanation = proposal.explanation;
    existing->affected_entity_ids = proposal.affected_entity_ids;
    existing->supporting_evidence_ids = proposal.supporting_evidence_ids;
    existing->remediation = proposal.remediation;
    existing->updated_at = now;
    if (existing->state == LocalOiFindingState::kResolved) {
      existing->state = LocalOiFindingState::kOpen;
      existing->acknowledged = false;
      existing->acknowledgement_note.clear();
      existing->resolution_reason.clear();
      existing->updated_at = now;
      AddMemory(&next, LocalOiMemoryAction::kFindingReopened, existing->id,
                "Local OI finding reopened after recalculation.", now);
    }
  }
  for (LocalOiFindingRecord& finding : next.findings) {
    if (base::StartsWith(finding.rule_id, "local_oi.",
                         base::CompareCase::SENSITIVE) &&
        !active_keys.contains(finding.source_basis) &&
        finding.state != LocalOiFindingState::kResolved &&
        finding.state != LocalOiFindingState::kSuppressed) {
      finding.state = LocalOiFindingState::kResolved;
      finding.resolution_reason = "The required local data is now present.";
      finding.updated_at = now;
      AddMemory(&next, LocalOiMemoryAction::kFindingResolved, finding.id,
                "Local OI finding resolved after recalculation.", now);
    }
  }
  next.entities.erase(
      std::remove_if(next.entities.begin(), next.entities.end(),
                     [](const LocalOiEntityRecord& record) {
                       return record.type == LocalOiEntityType::kFinding &&
                              record.source == LocalOiRecordSource::kRuleEngine;
                     }),
      next.entities.end());
  for (const LocalOiFindingRecord& finding : next.findings) {
    LocalOiEntityRecord entity;
    entity.id = finding.id;
    entity.type = LocalOiEntityType::kFinding;
    entity.title = finding.title;
    entity.summary = finding.explanation;
    entity.source = LocalOiRecordSource::kRuleEngine;
    entity.created_at = finding.created_at;
    entity.updated_at = finding.updated_at;
    SetField(&entity, "rule_id", finding.rule_id);
    SetField(&entity, "severity",
             std::string(LocalOiFindingSeverityName(finding.severity)));
    SetField(&entity, "state",
             std::string(LocalOiFindingStateName(finding.state)));
    ::tahai::UpsertEntity(&next, std::move(entity));
    for (const std::string& affected_id : finding.affected_entity_ids) {
      if (std::any_of(next.entities.begin(), next.entities.end(),
                      [&affected_id](const LocalOiEntityRecord& candidate) {
                        return candidate.id == affected_id;
                      })) {
        AddMissionRelationship(&next, LocalOiRelationshipType::kFindingAffects,
                               finding.id, affected_id,
                               "Rule finding affects this local record.",
                               finding.updated_at);
      }
    }
  }
  return CommitWithRetention(std::move(next));
}

void TahaiLocalOiService::Shutdown() {
  // Store writes are synchronous scoped pref commits. After this point we
  // reject all new mutations instead of queuing work past profile shutdown.
  shutdown_ = true;
}

}  // namespace tahai
