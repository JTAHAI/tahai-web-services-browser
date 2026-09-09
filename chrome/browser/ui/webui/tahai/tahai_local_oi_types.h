// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_TYPES_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_TYPES_H_

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace tahai {

// This vocabulary is intentionally local and finite. Adding an entity or edge
// requires a code review rather than accepting arbitrary browser data.
enum class LocalOiEntityType {
  kMission,
  kMissionTab,
  kPane,
  kRunbook,
  kRunbookStep,
  kEvidence,
  kArtifact,
  kEndpoint,
  kDomain,
  kDocumentReference,
  kNote,
  kToolResult,
  kWatch,
  kFinding,
  kReport,
  kExternalReference,
};

enum class LocalOiRelationshipType {
  kMissionContains,
  kMissionUses,
  kMissionTargets,
  kMissionProduced,
  kEvidenceSupports,
  kEvidenceValidates,
  kEvidenceConflictsWith,
  kArtifactBelongsTo,
  kEndpointResolvesTo,
  kFindingAffects,
  kFindingSupportedBy,
  kRunbookGoverns,
  kReferenceLinksTo,
  kSupersedes,
  kDerivedFrom,
};

enum class LocalOiFindingSeverity {
  kInformational,
  kLow,
  kMedium,
  kHigh,
  kCritical,
};

enum class LocalOiFindingState {
  kOpen,
  kAcknowledged,
  kResolved,
  kSuppressed,
};

enum class LocalOiRecordSource {
  kMission,
  kMissionTimeline,
  kMissionEvidence,
  kArtifactShelf,
  kOpsTool,
  kExplicitUserEntry,
  kRuleEngine,
  kSystem,
};

enum class LocalOiMemoryAction {
  kMissionCreated,
  kMissionRestored,
  kTabAdded,
  kPaneRoleChanged,
  kRunbookStepCompleted,
  kBlockerAdded,
  kEvidenceCaptured,
  kOpsToolResultRecorded,
  kChangeCaptureRecorded,
  kWatchConfigured,
  kEnvironmentClassified,
  kArtifactHashed,
  kDocumentationReferenceRecorded,
  kFindingCreated,
  kFindingReopened,
  kFindingAcknowledged,
  kFindingResolved,
  kFindingSuppressed,
  kReportGenerated,
  kPromotionPreviewOpened,
  kSafeExportCompleted,
  kStoreRecovered,
};

enum class LocalOiReportKind {
  kMissionHealthSummary,
  kKnowledgeGapReport,
  kChangeRecord,
  kEvidenceSummary,
  kOperationalHandoff,
  kArtifactIntegrityReport,
  kDiagnosticReport,
};

enum class LocalOiStoreStatus {
  kReady,
  kRecoveredFromCorruption,
  kUnavailable,
  kEphemeral,
};

struct LocalOiField {
  std::string key;
  std::string value;
};

// Entity text is intentionally bounded and safe metadata. It never accepts a
// raw page body, cookie, authorization header, token, password, or browser
// storage value. Typed ingestion code supplies only approved values.
struct LocalOiEntityRecord {
  std::string id;
  LocalOiEntityType type = LocalOiEntityType::kMission;
  std::string mission_id;
  std::string title;
  std::string summary;
  LocalOiRecordSource source = LocalOiRecordSource::kSystem;
  std::vector<LocalOiField> fields;
  std::string created_at;
  std::string updated_at;
  bool archived = false;
};

struct LocalOiRelationshipRecord {
  std::string id;
  LocalOiRelationshipType type = LocalOiRelationshipType::kMissionContains;
  std::string source_id;
  std::string target_id;
  std::string basis;
  std::string created_at;
  std::string updated_at;
};

struct LocalOiFindingRecord {
  std::string id;
  std::string rule_id;
  std::string category;
  LocalOiFindingSeverity severity = LocalOiFindingSeverity::kInformational;
  std::string title;
  std::string explanation;
  std::vector<std::string> affected_entity_ids;
  std::vector<std::string> supporting_evidence_ids;
  std::string remediation;
  std::string created_at;
  std::string updated_at;
  LocalOiFindingState state = LocalOiFindingState::kOpen;
  bool acknowledged = false;
  std::string acknowledgement_note;
  std::string resolution_reason;
  std::string source_basis;
  std::optional<int> confidence_percent;
};

struct LocalOiMemoryRecord {
  std::string id;
  LocalOiMemoryAction action = LocalOiMemoryAction::kMissionCreated;
  std::string entity_id;
  std::string detail;
  std::string created_at;
};

struct LocalOiReportRecord {
  std::string id;
  LocalOiReportKind kind = LocalOiReportKind::kDiagnosticReport;
  std::string title;
  std::string content;
  std::string provenance;
  std::string created_at;
  size_t redaction_count = 0;
};

constexpr int kTahaiLocalOiCurrentSchemaVersion = 2;

struct LocalOiStoreData {
  int schema_version = kTahaiLocalOiCurrentSchemaVersion;
  int generation = 0;
  std::vector<LocalOiEntityRecord> entities;
  std::vector<LocalOiRelationshipRecord> relationships;
  std::vector<LocalOiFindingRecord> findings;
  std::vector<LocalOiMemoryRecord> memory;
  std::vector<LocalOiReportRecord> reports;
};

// A fully populated allowed Mission set can include one root, three runbooks,
// and roughly ten step records per Mission. These limits remain bounded while
// accommodating the existing 500-Mission ceiling without failed reconciliation.
// The Mission service permits 500 records. A full supported Mission has a
// root, generated runbooks and checkpoints, and up to twelve evidence
// markers. This leaves room for deterministic findings without silently
// failing reconciliation at the documented Mission ceiling.
constexpr size_t kTahaiLocalOiMaximumEntities = 20000u;
constexpr size_t kTahaiLocalOiMaximumRelationships = 20000u;
constexpr size_t kTahaiLocalOiMaximumFindings = 4000u;
constexpr size_t kTahaiLocalOiMaximumMemoryRecords = 8000u;
constexpr size_t kTahaiLocalOiMaximumReports = 400u;
// The bounded DNS/TLS result stores 33 aggregate diagnostic fields. Keep a
// small fixed margin for schema-compatible additions while retaining a hard
// per-record limit.
constexpr size_t kTahaiLocalOiMaximumFieldsPerEntity = 40u;
constexpr size_t kTahaiLocalOiMaximumRecordTitleLength = 256u;
constexpr size_t kTahaiLocalOiMaximumSummaryLength = 4096u;
constexpr size_t kTahaiLocalOiMaximumReportLength = 32768u;

std::string NewLocalOiId();
std::string LocalOiNowTimestamp();

std::string_view LocalOiEntityTypeName(LocalOiEntityType type);
std::optional<LocalOiEntityType> LocalOiEntityTypeFromName(
    std::string_view name);
std::string_view LocalOiRelationshipTypeName(LocalOiRelationshipType type);
std::optional<LocalOiRelationshipType> LocalOiRelationshipTypeFromName(
    std::string_view name);
std::string_view LocalOiFindingSeverityName(LocalOiFindingSeverity severity);
std::optional<LocalOiFindingSeverity> LocalOiFindingSeverityFromName(
    std::string_view name);
std::string_view LocalOiFindingStateName(LocalOiFindingState state);
std::optional<LocalOiFindingState> LocalOiFindingStateFromName(
    std::string_view name);
std::string_view LocalOiRecordSourceName(LocalOiRecordSource source);
std::optional<LocalOiRecordSource> LocalOiRecordSourceFromName(
    std::string_view name);
std::string_view LocalOiMemoryActionName(LocalOiMemoryAction action);
std::optional<LocalOiMemoryAction> LocalOiMemoryActionFromName(
    std::string_view name);
std::string_view LocalOiReportKindName(LocalOiReportKind kind);
std::optional<LocalOiReportKind> LocalOiReportKindFromName(
    std::string_view name);

bool IsValidLocalOiId(std::string_view value);
bool IsValidLocalOiTimestamp(std::string_view value);
bool IsSafeLocalOiText(std::string_view value, size_t maximum_length);
bool IsSafeLocalOiFieldKey(std::string_view value);
bool ValidateLocalOiEntity(const LocalOiEntityRecord& record);
bool ValidateLocalOiRelationship(const LocalOiRelationshipRecord& record);
bool ValidateLocalOiFinding(const LocalOiFindingRecord& record);
bool ValidateLocalOiMemory(const LocalOiMemoryRecord& record);
bool ValidateLocalOiReport(const LocalOiReportRecord& record);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_TYPES_H_
