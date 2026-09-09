// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_types.h"

#include <algorithm>
#include <array>

#include "base/strings/string_number_conversions.h"
#include "base/time/time.h"
#include "base/uuid.h"

namespace tahai {
namespace {

template <typename Enum, size_t N>
std::optional<Enum> EnumFromName(
    std::string_view name,
    const std::array<std::pair<Enum, std::string_view>, N>& entries) {
  for (const auto& [value, entry_name] : entries) {
    if (name == entry_name) {
      return value;
    }
  }
  return std::nullopt;
}

template <typename Enum, size_t N>
std::string_view EnumName(
    Enum value,
    const std::array<std::pair<Enum, std::string_view>, N>& entries) {
  for (const auto& [entry_value, entry_name] : entries) {
    if (value == entry_value) {
      return entry_name;
    }
  }
  return "invalid";
}

constexpr std::array<std::pair<LocalOiEntityType, std::string_view>, 16>
    kEntityTypes = {
        {{LocalOiEntityType::kMission, "mission"},
         {LocalOiEntityType::kMissionTab, "mission_tab"},
         {LocalOiEntityType::kPane, "pane"},
         {LocalOiEntityType::kRunbook, "runbook"},
         {LocalOiEntityType::kRunbookStep, "runbook_step"},
         {LocalOiEntityType::kEvidence, "evidence"},
         {LocalOiEntityType::kArtifact, "artifact"},
         {LocalOiEntityType::kEndpoint, "endpoint"},
         {LocalOiEntityType::kDomain, "domain"},
         {LocalOiEntityType::kDocumentReference, "document_reference"},
         {LocalOiEntityType::kNote, "note"},
         {LocalOiEntityType::kToolResult, "tool_result"},
         {LocalOiEntityType::kWatch, "watch"},
         {LocalOiEntityType::kFinding, "finding"},
         {LocalOiEntityType::kReport, "report"},
         {LocalOiEntityType::kExternalReference, "external_reference"}}};

constexpr std::array<std::pair<LocalOiRelationshipType, std::string_view>, 15>
    kRelationshipTypes = {
        {{LocalOiRelationshipType::kMissionContains, "mission_contains"},
         {LocalOiRelationshipType::kMissionUses, "mission_uses"},
         {LocalOiRelationshipType::kMissionTargets, "mission_targets"},
         {LocalOiRelationshipType::kMissionProduced, "mission_produced"},
         {LocalOiRelationshipType::kEvidenceSupports, "evidence_supports"},
         {LocalOiRelationshipType::kEvidenceValidates, "evidence_validates"},
         {LocalOiRelationshipType::kEvidenceConflictsWith,
          "evidence_conflicts_with"},
         {LocalOiRelationshipType::kArtifactBelongsTo, "artifact_belongs_to"},
         {LocalOiRelationshipType::kEndpointResolvesTo, "endpoint_resolves_to"},
         {LocalOiRelationshipType::kFindingAffects, "finding_affects"},
         {LocalOiRelationshipType::kFindingSupportedBy, "finding_supported_by"},
         {LocalOiRelationshipType::kRunbookGoverns, "runbook_governs"},
         {LocalOiRelationshipType::kReferenceLinksTo, "reference_links_to"},
         {LocalOiRelationshipType::kSupersedes, "supersedes"},
         {LocalOiRelationshipType::kDerivedFrom, "derived_from"}}};

constexpr std::array<std::pair<LocalOiFindingSeverity, std::string_view>, 5>
    kFindingSeverities = {
        {{LocalOiFindingSeverity::kInformational, "informational"},
         {LocalOiFindingSeverity::kLow, "low"},
         {LocalOiFindingSeverity::kMedium, "medium"},
         {LocalOiFindingSeverity::kHigh, "high"},
         {LocalOiFindingSeverity::kCritical, "critical"}}};

constexpr std::array<std::pair<LocalOiFindingState, std::string_view>, 4>
    kFindingStates = {{{LocalOiFindingState::kOpen, "open"},
                       {LocalOiFindingState::kAcknowledged, "acknowledged"},
                       {LocalOiFindingState::kResolved, "resolved"},
                       {LocalOiFindingState::kSuppressed, "suppressed"}}};

constexpr std::array<std::pair<LocalOiRecordSource, std::string_view>, 8>
    kRecordSources = {
        {{LocalOiRecordSource::kMission, "mission"},
         {LocalOiRecordSource::kMissionTimeline, "mission_timeline"},
         {LocalOiRecordSource::kMissionEvidence, "mission_evidence"},
         {LocalOiRecordSource::kArtifactShelf, "artifact_shelf"},
         {LocalOiRecordSource::kOpsTool, "ops_tool"},
         {LocalOiRecordSource::kExplicitUserEntry, "explicit_user_entry"},
         {LocalOiRecordSource::kRuleEngine, "rule_engine"},
         {LocalOiRecordSource::kSystem, "system"}}};

constexpr std::array<std::pair<LocalOiMemoryAction, std::string_view>, 22>
    kMemoryActions = {{
        {LocalOiMemoryAction::kMissionCreated, "mission_created"},
        {LocalOiMemoryAction::kMissionRestored, "mission_restored"},
        {LocalOiMemoryAction::kTabAdded, "tab_added"},
        {LocalOiMemoryAction::kPaneRoleChanged, "pane_role_changed"},
        {LocalOiMemoryAction::kRunbookStepCompleted, "runbook_step_completed"},
        {LocalOiMemoryAction::kBlockerAdded, "blocker_added"},
        {LocalOiMemoryAction::kEvidenceCaptured, "evidence_captured"},
        {LocalOiMemoryAction::kOpsToolResultRecorded,
         "ops_tool_result_recorded"},
        {LocalOiMemoryAction::kChangeCaptureRecorded,
         "change_capture_recorded"},
        {LocalOiMemoryAction::kWatchConfigured, "watch_configured"},
        {LocalOiMemoryAction::kEnvironmentClassified, "environment_classified"},
        {LocalOiMemoryAction::kArtifactHashed, "artifact_hashed"},
        {LocalOiMemoryAction::kDocumentationReferenceRecorded,
         "documentation_reference_recorded"},
        {LocalOiMemoryAction::kFindingCreated, "finding_created"},
        {LocalOiMemoryAction::kFindingReopened, "finding_reopened"},
        {LocalOiMemoryAction::kFindingAcknowledged, "finding_acknowledged"},
        {LocalOiMemoryAction::kFindingResolved, "finding_resolved"},
        {LocalOiMemoryAction::kFindingSuppressed, "finding_suppressed"},
        {LocalOiMemoryAction::kReportGenerated, "report_generated"},
        {LocalOiMemoryAction::kPromotionPreviewOpened,
         "promotion_preview_opened"},
        {LocalOiMemoryAction::kSafeExportCompleted, "safe_export_completed"},
        {LocalOiMemoryAction::kStoreRecovered, "store_recovered"},
    }};

constexpr std::array<std::pair<LocalOiReportKind, std::string_view>, 7>
    kReportKinds = {
        {{LocalOiReportKind::kMissionHealthSummary, "mission_health_summary"},
         {LocalOiReportKind::kKnowledgeGapReport, "knowledge_gap_report"},
         {LocalOiReportKind::kChangeRecord, "change_record"},
         {LocalOiReportKind::kEvidenceSummary, "evidence_summary"},
         {LocalOiReportKind::kOperationalHandoff, "operational_handoff"},
         {LocalOiReportKind::kArtifactIntegrityReport,
          "artifact_integrity_report"},
         {LocalOiReportKind::kDiagnosticReport, "diagnostic_report"}}};

bool IsKnownEnumName(std::string_view value) {
  return !value.empty() && value != "invalid";
}

bool ValidateReferencedIds(const std::vector<std::string>& ids) {
  return ids.size() <= 64u &&
         std::all_of(ids.begin(), ids.end(), IsValidLocalOiId);
}

}  // namespace

std::string NewLocalOiId() {
  return base::Uuid::GenerateRandomV4().AsLowercaseString();
}

std::string LocalOiNowTimestamp() {
  return base::NumberToString(
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds());
}

std::string_view LocalOiEntityTypeName(LocalOiEntityType type) {
  return EnumName(type, kEntityTypes);
}

std::optional<LocalOiEntityType> LocalOiEntityTypeFromName(
    std::string_view name) {
  return EnumFromName(name, kEntityTypes);
}

std::string_view LocalOiRelationshipTypeName(LocalOiRelationshipType type) {
  return EnumName(type, kRelationshipTypes);
}

std::optional<LocalOiRelationshipType> LocalOiRelationshipTypeFromName(
    std::string_view name) {
  return EnumFromName(name, kRelationshipTypes);
}

std::string_view LocalOiFindingSeverityName(LocalOiFindingSeverity severity) {
  return EnumName(severity, kFindingSeverities);
}

std::optional<LocalOiFindingSeverity> LocalOiFindingSeverityFromName(
    std::string_view name) {
  return EnumFromName(name, kFindingSeverities);
}

std::string_view LocalOiFindingStateName(LocalOiFindingState state) {
  return EnumName(state, kFindingStates);
}

std::optional<LocalOiFindingState> LocalOiFindingStateFromName(
    std::string_view name) {
  return EnumFromName(name, kFindingStates);
}

std::string_view LocalOiRecordSourceName(LocalOiRecordSource source) {
  return EnumName(source, kRecordSources);
}

std::optional<LocalOiRecordSource> LocalOiRecordSourceFromName(
    std::string_view name) {
  return EnumFromName(name, kRecordSources);
}

std::string_view LocalOiMemoryActionName(LocalOiMemoryAction action) {
  return EnumName(action, kMemoryActions);
}

std::optional<LocalOiMemoryAction> LocalOiMemoryActionFromName(
    std::string_view name) {
  return EnumFromName(name, kMemoryActions);
}

std::string_view LocalOiReportKindName(LocalOiReportKind kind) {
  return EnumName(kind, kReportKinds);
}

std::optional<LocalOiReportKind> LocalOiReportKindFromName(
    std::string_view name) {
  return EnumFromName(name, kReportKinds);
}

bool IsValidLocalOiId(std::string_view value) {
  return base::Uuid::ParseLowercase(value).is_valid();
}

bool IsValidLocalOiTimestamp(std::string_view value) {
  int64_t ignored = 0;
  return value.size() <= 32u && !value.empty() &&
         base::StringToInt64(value, &ignored) && ignored >= 0;
}

bool IsSafeLocalOiText(std::string_view value, size_t maximum_length) {
  if (value.empty() || value.size() > maximum_length) {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](unsigned char character) {
    return character >= 0x20u && character != 0x7fu;
  });
}

bool IsSafeLocalOiFieldKey(std::string_view value) {
  if (value.empty() || value.size() > 64u) {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](unsigned char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '_';
  });
}

bool ValidateLocalOiEntity(const LocalOiEntityRecord& record) {
  if (!IsValidLocalOiId(record.id) ||
      !IsKnownEnumName(LocalOiEntityTypeName(record.type)) ||
      !IsKnownEnumName(LocalOiRecordSourceName(record.source)) ||
      !IsSafeLocalOiText(record.title, kTahaiLocalOiMaximumRecordTitleLength) ||
      !IsSafeLocalOiText(record.summary, kTahaiLocalOiMaximumSummaryLength) ||
      !IsValidLocalOiTimestamp(record.created_at) ||
      !IsValidLocalOiTimestamp(record.updated_at) ||
      (!record.mission_id.empty() && !IsValidLocalOiId(record.mission_id)) ||
      record.fields.size() > kTahaiLocalOiMaximumFieldsPerEntity) {
    return false;
  }
  return std::all_of(record.fields.begin(), record.fields.end(),
                     [](const LocalOiField& field) {
                       return IsSafeLocalOiFieldKey(field.key) &&
                              IsSafeLocalOiText(
                                  field.value,
                                  kTahaiLocalOiMaximumSummaryLength);
                     });
}

bool ValidateLocalOiRelationship(const LocalOiRelationshipRecord& record) {
  return IsValidLocalOiId(record.id) &&
         IsKnownEnumName(LocalOiRelationshipTypeName(record.type)) &&
         IsValidLocalOiId(record.source_id) &&
         IsValidLocalOiId(record.target_id) &&
         record.source_id != record.target_id &&
         IsSafeLocalOiText(record.basis, kTahaiLocalOiMaximumSummaryLength) &&
         IsValidLocalOiTimestamp(record.created_at) &&
         IsValidLocalOiTimestamp(record.updated_at);
}

bool ValidateLocalOiFinding(const LocalOiFindingRecord& record) {
  if (!IsValidLocalOiId(record.id) || record.rule_id.empty() ||
      record.rule_id.size() > 128u || record.category.empty() ||
      record.category.size() > 128u ||
      !IsKnownEnumName(LocalOiFindingSeverityName(record.severity)) ||
      !IsKnownEnumName(LocalOiFindingStateName(record.state)) ||
      !IsSafeLocalOiText(record.title, kTahaiLocalOiMaximumRecordTitleLength) ||
      !IsSafeLocalOiText(record.explanation,
                         kTahaiLocalOiMaximumSummaryLength) ||
      !IsSafeLocalOiText(record.remediation,
                         kTahaiLocalOiMaximumSummaryLength) ||
      !IsSafeLocalOiText(record.source_basis,
                         kTahaiLocalOiMaximumSummaryLength) ||
      !IsValidLocalOiTimestamp(record.created_at) ||
      !IsValidLocalOiTimestamp(record.updated_at) ||
      !ValidateReferencedIds(record.affected_entity_ids) ||
      !ValidateReferencedIds(record.supporting_evidence_ids) ||
      (record.acknowledged &&
       !IsSafeLocalOiText(record.acknowledgement_note,
                          kTahaiLocalOiMaximumSummaryLength)) ||
      (!record.resolution_reason.empty() &&
       !IsSafeLocalOiText(record.resolution_reason,
                          kTahaiLocalOiMaximumSummaryLength)) ||
      (record.confidence_percent &&
       (*record.confidence_percent < 0 || *record.confidence_percent > 100))) {
    return false;
  }
  return !(record.state == LocalOiFindingState::kAcknowledged &&
           !record.acknowledged);
}

bool ValidateLocalOiMemory(const LocalOiMemoryRecord& record) {
  return IsValidLocalOiId(record.id) &&
         IsKnownEnumName(LocalOiMemoryActionName(record.action)) &&
         IsValidLocalOiId(record.entity_id) &&
         IsSafeLocalOiText(record.detail, kTahaiLocalOiMaximumSummaryLength) &&
         IsValidLocalOiTimestamp(record.created_at);
}

bool ValidateLocalOiReport(const LocalOiReportRecord& record) {
  return IsValidLocalOiId(record.id) &&
         IsKnownEnumName(LocalOiReportKindName(record.kind)) &&
         IsSafeLocalOiText(record.title,
                           kTahaiLocalOiMaximumRecordTitleLength) &&
         IsSafeLocalOiText(record.content, kTahaiLocalOiMaximumReportLength) &&
         IsSafeLocalOiText(record.provenance,
                           kTahaiLocalOiMaximumSummaryLength) &&
         IsValidLocalOiTimestamp(record.created_at) &&
         record.redaction_count <= 10000u;
}

}  // namespace tahai
