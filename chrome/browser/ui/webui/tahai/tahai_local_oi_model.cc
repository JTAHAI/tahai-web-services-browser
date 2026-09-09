// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_model.h"

#include <algorithm>
#include <array>
#include <set>
#include <string>
#include <utility>

#include "base/json/json_writer.h"
#include "base/notreached.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/time/time.h"
#include "base/values.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_redactor.h"

namespace tahai {
namespace {

constexpr size_t kMaximumSearchResults = 40u;
constexpr size_t kMaximumEntitySearchTermsLength = 2048u;
constexpr size_t kMaximumRelationshipExplorerResults = 48u;
constexpr size_t kMaximumLocalOiAssistRecords = 8u;
constexpr size_t kMaximumLocalOiAssistDetailLength = 512u;
constexpr std::array<LocalOiEntityType, 16> kLocalOiEntityTypes = {
    LocalOiEntityType::kMission,     LocalOiEntityType::kMissionTab,
    LocalOiEntityType::kPane,        LocalOiEntityType::kRunbook,
    LocalOiEntityType::kRunbookStep, LocalOiEntityType::kEvidence,
    LocalOiEntityType::kArtifact,    LocalOiEntityType::kEndpoint,
    LocalOiEntityType::kDomain,      LocalOiEntityType::kDocumentReference,
    LocalOiEntityType::kNote,        LocalOiEntityType::kToolResult,
    LocalOiEntityType::kWatch,       LocalOiEntityType::kFinding,
    LocalOiEntityType::kReport,      LocalOiEntityType::kExternalReference,
};

std::string_view LocalOiBriefRecordKind(std::string_view kind) {
  if (kind == "mission" || kind == "mission_tab" || kind == "pane" ||
      kind == "runbook" || kind == "runbook_step" || kind == "evidence" ||
      kind == "artifact" || kind == "endpoint" || kind == "domain" ||
      kind == "document_reference" || kind == "note" || kind == "tool_result" ||
      kind == "watch" || kind == "finding" || kind == "report" ||
      kind == "external_reference") {
    return kind;
  }
  return "typed record";
}

std::string CountedLocalOiBriefKinds(const LocalOiAssistPrompt& prompt) {
  std::vector<std::pair<std::string_view, size_t>> kinds;
  for (const LocalOiAssistRecord& record : prompt.selected_records) {
    const std::string_view kind = LocalOiBriefRecordKind(record.kind);
    const auto existing = std::find_if(
        kinds.begin(), kinds.end(),
        [kind](const auto& candidate) { return candidate.first == kind; });
    if (existing == kinds.end()) {
      kinds.emplace_back(kind, 1u);
    } else {
      ++existing->second;
    }
  }
  std::string output;
  for (size_t index = 0u; index < kinds.size(); ++index) {
    if (index > 0u) {
      output.append(index + 1u == kinds.size() ? " and " : ", ");
    }
    output.append(base::NumberToString(kinds[index].second));
    output.push_back(' ');
    output.append(kinds[index].first);
    output.append(kinds[index].second == 1u ? " record" : " records");
  }
  return output;
}

bool ContainsCaseInsensitive(std::string_view value, std::string_view query) {
  return base::ToLowerASCII(value).find(base::ToLowerASCII(query)) !=
         std::string::npos;
}

bool IsSearchableQuery(std::string_view query) {
  return !query.empty() && query.size() <= 128u &&
         std::all_of(query.begin(), query.end(), [](unsigned char character) {
           return base::IsAsciiPrintable(character);
         });
}

bool IsAllowedSearchKind(std::string_view kind) {
  return kind == "all" || kind == "finding" || kind == "memory" ||
         LocalOiEntityTypeFromName(kind).has_value();
}

bool IsAllowedSearchSeverity(std::string_view severity) {
  return severity == "all" || severity == "information" ||
         severity == "attention" || severity == "blocked";
}

bool IsAllowedSearchFindingState(std::string_view finding_state) {
  return finding_state == "all" || finding_state == "open" ||
         finding_state == "acknowledged" || finding_state == "suppressed";
}

bool IsAllowedSearchAgeDays(int maximum_age_days) {
  return maximum_age_days == 0 || maximum_age_days == 1 ||
         maximum_age_days == 7 || maximum_age_days == 30 ||
         maximum_age_days == 90;
}

bool IsValidSearchOptions(const LocalOiSearchOptions& options) {
  return IsSearchableQuery(options.query) &&
         IsAllowedSearchKind(options.kind) &&
         (options.mission_id.empty() || IsValidLocalOiId(options.mission_id)) &&
         IsAllowedSearchSeverity(options.severity) &&
         IsAllowedSearchFindingState(options.finding_state) &&
         IsAllowedSearchAgeDays(options.maximum_age_days);
}

bool IsValidRelationshipExplorerOptions(
    const LocalOiRelationshipExplorerOptions& options) {
  return IsValidLocalOiId(options.entity_id) &&
         (options.relationship == "all" ||
          LocalOiRelationshipTypeFromName(options.relationship).has_value()) &&
         (options.maximum_depth == 1 || options.maximum_depth == 2);
}

bool IsAtMostSearchAge(std::string_view timestamp, int maximum_age_days) {
  if (maximum_age_days == 0) {
    return true;
  }
  int64_t timestamp_value = 0;
  if (!base::StringToInt64(timestamp, &timestamp_value)) {
    return false;
  }
  const int64_t cutoff = (base::Time::Now() - base::Days(maximum_age_days))
                             .ToDeltaSinceWindowsEpoch()
                             .InMicroseconds();
  return timestamp_value >= cutoff;
}

int SearchMatchScore(std::string_view title,
                     std::string_view detail,
                     std::string_view searchable_terms,
                     std::string_view query) {
  if (ContainsCaseInsensitive(title, query)) {
    return 3;
  }
  if (ContainsCaseInsensitive(detail, query)) {
    return 2;
  }
  return ContainsCaseInsensitive(searchable_terms, query) ? 1 : 0;
}

bool MatchesSearchFilters(const LocalOiSearchOptions& options,
                          std::string_view kind,
                          std::string_view mission_id,
                          std::string_view severity,
                          std::string_view finding_state,
                          std::string_view timestamp) {
  return (options.kind == "all" || options.kind == kind) &&
         (options.mission_id.empty() || options.mission_id == mission_id) &&
         (options.severity == "all" || options.severity == severity) &&
         (options.finding_state == "all" ||
          options.finding_state == finding_state) &&
         IsAtMostSearchAge(timestamp, options.maximum_age_days);
}

const LocalOiEntityRecord* FindEntity(const LocalOiStoreData& data,
                                      std::string_view id) {
  const auto it = std::find_if(
      data.entities.begin(), data.entities.end(),
      [id](const LocalOiEntityRecord& entity) { return entity.id == id; });
  return it == data.entities.end() ? nullptr : &*it;
}

const LocalOiEntityRecord* FindMission(const LocalOiStoreData& data,
                                       std::string_view id) {
  const LocalOiEntityRecord* entity = FindEntity(data, id);
  return entity && entity->type == LocalOiEntityType::kMission ? entity
                                                               : nullptr;
}

std::string MissionIdForAffectedEntity(const LocalOiStoreData& data,
                                       std::string_view entity_id) {
  const LocalOiEntityRecord* entity = FindEntity(data, entity_id);
  if (!entity) {
    return {};
  }
  if (entity->type == LocalOiEntityType::kMission) {
    return entity->id;
  }
  if (FindMission(data, entity->mission_id)) {
    return entity->mission_id;
  }

  // Tool and support records can be context-linked through a typed Mission
  // relationship while retaining an empty intrinsic mission_id. Resolve only
  // direct Mission edges; we never infer a Mission from a page, tab, host,
  // account, or arbitrary relationship chain.
  std::string mission_id;
  for (const LocalOiRelationshipRecord& relationship : data.relationships) {
    std::string_view candidate_id;
    if (relationship.source_id == entity_id) {
      candidate_id = relationship.target_id;
    } else if (relationship.target_id == entity_id) {
      candidate_id = relationship.source_id;
    } else {
      continue;
    }
    const LocalOiEntityRecord* candidate = FindMission(data, candidate_id);
    if (!candidate || (!mission_id.empty() && candidate->id >= mission_id)) {
      continue;
    }
    mission_id = candidate->id;
  }
  return mission_id;
}

std::string MissionTitleForId(const LocalOiStoreData& data,
                              std::string_view mission_id) {
  const LocalOiEntityRecord* mission = FindMission(data, mission_id);
  return mission ? mission->title : "Local OI";
}

std::string FieldValue(const LocalOiEntityRecord& entity,
                       std::string_view key) {
  const auto it = std::find_if(
      entity.fields.begin(), entity.fields.end(),
      [key](const LocalOiField& field) { return field.key == key; });
  return it == entity.fields.end() ? std::string() : it->value;
}

int FieldInt(const LocalOiEntityRecord& entity, std::string_view key) {
  int value = 0;
  return base::StringToInt(FieldValue(entity, key), &value) ? value : 0;
}

std::string BoundedEntitySearchTerms(const LocalOiEntityRecord& entity) {
  std::string terms = base::StrCat({entity.title, " ", entity.summary});
  if (terms.size() > kMaximumEntitySearchTermsLength) {
    terms.resize(kMaximumEntitySearchTermsLength);
  }
  for (const LocalOiField& field : entity.fields) {
    if (terms.size() >= kMaximumEntitySearchTermsLength) {
      break;
    }
    terms += " ";
    terms += field.key;
    if (terms.size() >= kMaximumEntitySearchTermsLength) {
      terms.resize(kMaximumEntitySearchTermsLength);
      break;
    }
    terms += " ";
    const size_t remaining = kMaximumEntitySearchTermsLength - terms.size();
    terms.append(field.value.substr(0u, remaining));
  }
  return terms;
}

LocalOiSeverity ViewSeverity(LocalOiFindingSeverity severity) {
  if (severity == LocalOiFindingSeverity::kCritical ||
      severity == LocalOiFindingSeverity::kHigh) {
    return LocalOiSeverity::kBlocked;
  }
  if (severity == LocalOiFindingSeverity::kMedium ||
      severity == LocalOiFindingSeverity::kLow) {
    return LocalOiSeverity::kAttention;
  }
  return LocalOiSeverity::kInformational;
}

int ActionPriority(LocalOiFindingSeverity severity) {
  switch (severity) {
    case LocalOiFindingSeverity::kCritical:
      return 100;
    case LocalOiFindingSeverity::kHigh:
      return 80;
    case LocalOiFindingSeverity::kMedium:
      return 60;
    case LocalOiFindingSeverity::kLow:
      return 40;
    case LocalOiFindingSeverity::kInformational:
      return 20;
  }
  return 0;
}

}  // namespace

std::string_view LocalOiSeverityLabel(LocalOiSeverity severity) {
  switch (severity) {
    case LocalOiSeverity::kInformational:
      return "information";
    case LocalOiSeverity::kAttention:
      return "attention";
    case LocalOiSeverity::kBlocked:
      return "blocked";
  }
  NOTREACHED();
}

std::string_view LocalOiCapabilityStageLabel(LocalOiCapabilityStage stage) {
  switch (stage) {
    case LocalOiCapabilityStage::kAvailableNow:
      return "available now";
    case LocalOiCapabilityStage::kExplicitCaptureRequired:
      return "explicit capture required";
    case LocalOiCapabilityStage::kContractReady:
      return "contract ready";
    case LocalOiCapabilityStage::kNotConfigured:
      return "not configured";
  }
  NOTREACHED();
}

std::string_view LocalOiSafeReportKindLabel(LocalOiSafeReportKind kind) {
  switch (kind) {
    case LocalOiSafeReportKind::kOverview:
      return "Mission Health Summary";
    case LocalOiSafeReportKind::kSanitizedHandoff:
      return "Operational Handoff";
    case LocalOiSafeReportKind::kChangeRecord:
      return "Change Record";
    case LocalOiSafeReportKind::kIncidentPacket:
      return "Knowledge Gap Report";
    case LocalOiSafeReportKind::kEvidenceManifest:
      return "Evidence Summary";
    case LocalOiSafeReportKind::kArtifactIntegrity:
      return "Artifact Integrity Report";
    case LocalOiSafeReportKind::kDiagnostic:
      return "Local OI Diagnostic Report";
  }
  NOTREACHED();
}

std::optional<LocalOiSafeReportKind> LocalOiSafeReportKindFromString(
    std::string_view kind) {
  if (kind == "overview") {
    return LocalOiSafeReportKind::kOverview;
  }
  if (kind == "sanitized-handoff") {
    return LocalOiSafeReportKind::kSanitizedHandoff;
  }
  if (kind == "change-record") {
    return LocalOiSafeReportKind::kChangeRecord;
  }
  if (kind == "incident-packet") {
    return LocalOiSafeReportKind::kIncidentPacket;
  }
  if (kind == "evidence-manifest") {
    return LocalOiSafeReportKind::kEvidenceManifest;
  }
  if (kind == "artifact-integrity") {
    return LocalOiSafeReportKind::kArtifactIntegrity;
  }
  if (kind == "diagnostic-report") {
    return LocalOiSafeReportKind::kDiagnostic;
  }
  return std::nullopt;
}

std::optional<LocalOiSafeReportFormat> LocalOiSafeReportFormatFromString(
    std::string_view format) {
  if (format == "markdown") {
    return LocalOiSafeReportFormat::kMarkdown;
  }
  if (format == "json") {
    return LocalOiSafeReportFormat::kJson;
  }
  return std::nullopt;
}

std::string_view LocalOiAssistOperationLabel(LocalOiAssistOperation operation) {
  switch (operation) {
    case LocalOiAssistOperation::kExplainSelectedFindings:
      return "Explain selected findings";
    case LocalOiAssistOperation::kSummarizeSelectedRecords:
      return "Summarize selected records";
    case LocalOiAssistOperation::kDraftChecklist:
      return "Draft checklist";
    case LocalOiAssistOperation::kDraftSanitizedHandoff:
      return "Draft sanitized handoff";
  }
  NOTREACHED();
}

std::optional<LocalOiAssistOperation> LocalOiAssistOperationFromString(
    std::string_view operation) {
  if (operation == "explain-findings") {
    return LocalOiAssistOperation::kExplainSelectedFindings;
  }
  if (operation == "summarize-records") {
    return LocalOiAssistOperation::kSummarizeSelectedRecords;
  }
  if (operation == "draft-checklist") {
    return LocalOiAssistOperation::kDraftChecklist;
  }
  if (operation == "draft-sanitized-handoff") {
    return LocalOiAssistOperation::kDraftSanitizedHandoff;
  }
  return std::nullopt;
}

const LocalOiAssistPosture& GetLocalOiAssistPosture() {
  static constexpr LocalOiAssistPosture kPosture = {
      false, false, false, false,
      "Local AI not configured. Local OI uses deterministic rules only."};
  return kPosture;
}

LocalOiSnapshot BuildLocalOiSnapshot(const LocalOiStoreData& data) {
  LocalOiSnapshot snapshot;
  for (const LocalOiEntityRecord& record : data.entities) {
    snapshot.entities.push_back(
        {record.id, record.mission_id,
         std::string(LocalOiEntityTypeName(record.type)), record.title,
         record.summary, record.updated_at, BoundedEntitySearchTerms(record)});
    if (record.type == LocalOiEntityType::kEvidence) {
      ++snapshot.evidence_marker_count;
    }
    if (record.type == LocalOiEntityType::kArtifact) {
      ++snapshot.artifact_count;
    }
    if (record.type == LocalOiEntityType::kDocumentReference) {
      ++snapshot.document_reference_count;
    }
    if (record.type == LocalOiEntityType::kEndpoint) {
      ++snapshot.endpoint_count;
    }
    if (record.type == LocalOiEntityType::kDomain) {
      ++snapshot.domain_count;
    }
    if (record.type == LocalOiEntityType::kToolResult) {
      ++snapshot.diagnostic_result_count;
      if (!FieldValue(record, "change_capture_kind").empty()) {
        ++snapshot.change_capture_count;
      }
    }
    if (record.type == LocalOiEntityType::kWatch) {
      ++snapshot.manual_watch_count;
    }
    if (record.type != LocalOiEntityType::kMission) {
      continue;
    }
    LocalOiMissionHealth health;
    health.mission_id = record.id;
    health.mission_title = record.title;
    health.mission_type = FieldValue(record, "mission_type");
    health.archived = record.archived;
    health.completed_checkpoints =
        static_cast<size_t>(FieldInt(record, "validation_complete") +
                            FieldInt(record, "rollback_complete"));
    health.total_checkpoints =
        static_cast<size_t>(FieldInt(record, "validation_total") +
                            FieldInt(record, "rollback_total"));
    health.evidence_markers = static_cast<size_t>(
        std::count_if(data.entities.begin(), data.entities.end(),
                      [&record](const auto& entity) {
                        return entity.type == LocalOiEntityType::kEvidence &&
                               entity.mission_id == record.id;
                      }));
    health.readiness = health.total_checkpoints == 0u ? "Insufficient data"
                       : record.archived              ? "archived"
                                                      : "assessed locally";
    // A percentage is shown only when all tracked checkpoint totals exist.
    health.score = health.total_checkpoints == 0u
                       ? -1
                       : static_cast<int>(100u * health.completed_checkpoints /
                                          health.total_checkpoints);
    if (record.archived) {
      ++snapshot.archived_mission_count;
    } else {
      ++snapshot.active_mission_count;
    }
    snapshot.mission_health.push_back(std::move(health));
  }
  for (const LocalOiRelationshipRecord& record : data.relationships) {
    const LocalOiEntityRecord* source = FindEntity(data, record.source_id);
    const LocalOiEntityRecord* target = FindEntity(data, record.target_id);
    if (!source || !target) {
      continue;
    }
    snapshot.relationships.push_back(
        {record.source_id, record.target_id,
         std::string(LocalOiRelationshipTypeName(record.type)), source->title,
         target->title, record.basis});
  }
  for (const LocalOiFindingRecord& record : data.findings) {
    if (record.state == LocalOiFindingState::kResolved) {
      continue;
    }
    const std::string mission_id =
        record.affected_entity_ids.empty()
            ? std::string()
            : MissionIdForAffectedEntity(data,
                                         record.affected_entity_ids.front());
    const std::string mission_title = MissionTitleForId(data, mission_id);
    snapshot.findings.push_back(
        {record.id, mission_id, mission_title, ViewSeverity(record.severity),
         record.state, record.acknowledged, record.title, record.explanation,
         record.remediation, record.created_at, record.source_basis});
    if (record.state != LocalOiFindingState::kSuppressed) {
      snapshot.priority_actions.push_back(
          {record.id, mission_id, mission_title, ViewSeverity(record.severity),
           ActionPriority(record.severity), record.title, record.explanation,
           record.remediation, record.source_basis});
    }
    if (record.severity == LocalOiFindingSeverity::kHigh ||
        record.severity == LocalOiFindingSeverity::kCritical) {
      ++snapshot.blocked_finding_count;
    }
    if (record.category == "knowledge_gap") {
      ++snapshot.knowledge_gap_count;
    }
  }
  for (const LocalOiMemoryRecord& record : data.memory) {
    snapshot.memory.push_back(
        {record.entity_id, std::string(LocalOiMemoryActionName(record.action)),
         record.detail, record.created_at});
  }
  snapshot.timeline_event_count = snapshot.memory.size();
  snapshot.report_count = data.reports.size();
  snapshot.relationship_entity_count = snapshot.entities.size();
  snapshot.operator_action_count = snapshot.priority_actions.size();
  std::stable_sort(snapshot.priority_actions.begin(),
                   snapshot.priority_actions.end(),
                   [](const auto& left, const auto& right) {
                     return left.priority > right.priority;
                   });
  return snapshot;
}

LocalOiDataInventory BuildLocalOiDataInventory(const LocalOiStoreData& data) {
  LocalOiDataInventory inventory;
  inventory.schema_version = data.schema_version;
  inventory.generation = data.generation;
  inventory.relationship_count = data.relationships.size();
  inventory.finding_count = data.findings.size();
  inventory.memory_count = data.memory.size();
  inventory.report_count = data.reports.size();
  inventory.entity_categories.reserve(kLocalOiEntityTypes.size());
  for (const LocalOiEntityType type : kLocalOiEntityTypes) {
    inventory.entity_categories.push_back(
        {type, static_cast<size_t>(
                   std::count_if(data.entities.begin(), data.entities.end(),
                                 [type](const LocalOiEntityRecord& record) {
                                   return record.type == type;
                                 }))});
  }
  return inventory;
}

std::vector<LocalOiSearchResult> SearchLocalOiSnapshot(
    const LocalOiSnapshot& snapshot,
    std::string_view query) {
  LocalOiSearchOptions options;
  options.query = std::string(query);
  return SearchLocalOiSnapshot(snapshot, options);
}

std::vector<LocalOiSearchResult> SearchLocalOiSnapshot(
    const LocalOiSnapshot& snapshot,
    const LocalOiSearchOptions& options) {
  struct RankedSearchResult {
    LocalOiSearchResult result;
    int match_score = 0;
  };
  std::vector<RankedSearchResult> ranked_results;
  if (!IsValidSearchOptions(options)) {
    return {};
  }
  const auto append = [&ranked_results](LocalOiSearchResult result,
                                        int match_score) {
    ranked_results.push_back({std::move(result), match_score});
  };
  for (const LocalOiEntity& entity : snapshot.entities) {
    const int match_score = SearchMatchScore(
        entity.label, entity.detail, entity.search_terms, options.query);
    if (match_score > 0 &&
        MatchesSearchFilters(options, entity.kind, entity.mission_id, "", "",
                             entity.created_at)) {
      append({entity.kind, entity.mission_id, entity.label, entity.detail, "",
              "", entity.created_at},
             match_score);
    }
  }
  for (const LocalOiFinding& finding : snapshot.findings) {
    const std::string_view severity = LocalOiSeverityLabel(finding.severity);
    const std::string_view finding_state =
        LocalOiFindingStateName(finding.state);
    const int match_score = SearchMatchScore(
        finding.title, finding.recommendation, finding.summary, options.query);
    if (match_score > 0 &&
        MatchesSearchFilters(options, "finding", finding.mission_id, severity,
                             finding_state, finding.created_at)) {
      append({"finding", finding.mission_id, finding.title,
              finding.recommendation, std::string(severity),
              std::string(finding_state), finding.created_at},
             match_score);
    }
  }
  for (const LocalOiMemoryItem& memory : snapshot.memory) {
    const int match_score = SearchMatchScore(memory.kind, memory.detail,
                                             memory.detail, options.query);
    if (match_score > 0 &&
        MatchesSearchFilters(options, "memory", memory.mission_id, "", "",
                             memory.created_at)) {
      append({"memory", memory.mission_id, memory.kind, memory.detail, "", "",
              memory.created_at},
             match_score);
    }
  }
  std::stable_sort(
      ranked_results.begin(), ranked_results.end(),
      [](const RankedSearchResult& left, const RankedSearchResult& right) {
        if (left.match_score != right.match_score) {
          return left.match_score > right.match_score;
        }
        if (left.result.kind != right.result.kind) {
          return left.result.kind < right.result.kind;
        }
        if (left.result.title != right.result.title) {
          return left.result.title < right.result.title;
        }
        if (left.result.mission_id != right.result.mission_id) {
          return left.result.mission_id < right.result.mission_id;
        }
        return left.result.created_at > right.result.created_at;
      });
  std::vector<LocalOiSearchResult> results;
  results.reserve(std::min(kMaximumSearchResults, ranked_results.size()));
  for (const RankedSearchResult& result : ranked_results) {
    if (results.size() == kMaximumSearchResults) {
      break;
    }
    results.push_back(result.result);
  }
  return results;
}

std::vector<LocalOiRelationshipExplorerItem> ExploreLocalOiRelationships(
    const LocalOiSnapshot& snapshot,
    const LocalOiRelationshipExplorerOptions& options) {
  if (!IsValidRelationshipExplorerOptions(options)) {
    return {};
  }
  const bool selected_entity_exists =
      std::any_of(snapshot.entities.begin(), snapshot.entities.end(),
                  [&options](const LocalOiEntity& entity) {
                    return entity.id == options.entity_id;
                  });
  if (!selected_entity_exists) {
    return {};
  }

  std::set<std::string> frontier = {options.entity_id};
  std::set<size_t> visited_relationships;
  std::vector<LocalOiRelationshipExplorerItem> results;
  for (int depth = 1; depth <= options.maximum_depth && !frontier.empty();
       ++depth) {
    std::set<std::string> next_frontier;
    for (size_t index = 0u; index < snapshot.relationships.size(); ++index) {
      const LocalOiRelationship& relationship = snapshot.relationships[index];
      if ((options.relationship != "all" &&
           relationship.relationship != options.relationship) ||
          visited_relationships.find(index) != visited_relationships.end()) {
        continue;
      }
      const bool source_matches =
          frontier.find(relationship.source_id) != frontier.end();
      const bool target_matches =
          frontier.find(relationship.target_id) != frontier.end();
      if (!source_matches && !target_matches) {
        continue;
      }
      visited_relationships.insert(index);
      next_frontier.insert(source_matches ? relationship.target_id
                                          : relationship.source_id);
      results.push_back({relationship.source_id, relationship.target_id,
                         relationship.relationship, relationship.source_label,
                         relationship.target_label, relationship.basis, depth});
    }
    frontier = std::move(next_frontier);
  }
  std::stable_sort(results.begin(), results.end(),
                   [](const LocalOiRelationshipExplorerItem& left,
                      const LocalOiRelationshipExplorerItem& right) {
                     if (left.depth != right.depth) {
                       return left.depth < right.depth;
                     }
                     if (left.relationship != right.relationship) {
                       return left.relationship < right.relationship;
                     }
                     if (left.source_label != right.source_label) {
                       return left.source_label < right.source_label;
                     }
                     if (left.target_label != right.target_label) {
                       return left.target_label < right.target_label;
                     }
                     return left.basis < right.basis;
                   });
  if (results.size() > kMaximumRelationshipExplorerResults) {
    results.resize(kMaximumRelationshipExplorerResults);
  }
  return results;
}

std::optional<LocalOiEntityDetail> GetLocalOiEntityDetail(
    const LocalOiSnapshot& snapshot,
    std::string_view entity_id) {
  if (!IsValidLocalOiId(entity_id)) {
    return std::nullopt;
  }
  const auto entity =
      std::find_if(snapshot.entities.begin(), snapshot.entities.end(),
                   [entity_id](const LocalOiEntity& candidate) {
                     return candidate.id == entity_id;
                   });
  if (entity == snapshot.entities.end()) {
    return std::nullopt;
  }
  const size_t relationship_count = static_cast<size_t>(std::count_if(
      snapshot.relationships.begin(), snapshot.relationships.end(),
      [entity_id](const LocalOiRelationship& relationship) {
        return relationship.source_id == entity_id ||
               relationship.target_id == entity_id;
      }));
  return LocalOiEntityDetail{entity->id,     entity->mission_id,
                             entity->kind,   entity->label,
                             entity->detail, relationship_count};
}

std::optional<LocalOiAssistPrompt> PrepareLocalOiAssistPrompt(
    const LocalOiSnapshot& snapshot,
    const LocalOiAssistRequest& request) {
  if (request.selected_record_ids.empty() ||
      request.selected_record_ids.size() > kMaximumLocalOiAssistRecords) {
    return std::nullopt;
  }

  std::set<std::string> selected_ids;
  LocalOiAssistPrompt prompt;
  prompt.operation = request.operation;
  prompt.selected_records.reserve(request.selected_record_ids.size());
  for (const std::string& record_id : request.selected_record_ids) {
    if (!IsValidLocalOiId(record_id) ||
        !selected_ids.insert(record_id).second) {
      return std::nullopt;
    }
    const std::optional<LocalOiEntityDetail> entity =
        GetLocalOiEntityDetail(snapshot, record_id);
    if (entity) {
      prompt.selected_records.push_back(
          {entity->kind, entity->label,
           entity->detail.substr(0u, kMaximumLocalOiAssistDetailLength)});
      continue;
    }
    const auto finding =
        std::find_if(snapshot.findings.begin(), snapshot.findings.end(),
                     [&record_id](const LocalOiFinding& candidate) {
                       return candidate.id == record_id;
                     });
    if (finding == snapshot.findings.end()) {
      return std::nullopt;
    }
    prompt.selected_records.push_back(
        {"finding", finding->title,
         base::StrCat(
             {finding->summary, " Recommendation: ", finding->recommendation})
             .substr(0u, kMaximumLocalOiAssistDetailLength)});
  }
  return prompt;
}

std::optional<LocalOiDeterministicBrief> BuildLocalOiDeterministicBrief(
    const LocalOiAssistPrompt& prompt) {
  if (prompt.selected_records.empty() ||
      prompt.selected_records.size() > kMaximumLocalOiAssistRecords) {
    return std::nullopt;
  }
  for (const LocalOiAssistRecord& record : prompt.selected_records) {
    if (!IsSafeLocalOiText(record.kind, 128u) ||
        !IsSafeLocalOiText(record.label,
                           kTahaiLocalOiMaximumRecordTitleLength) ||
        !IsSafeLocalOiText(record.detail, kMaximumLocalOiAssistDetailLength)) {
      return std::nullopt;
    }
  }

  const std::string selected_count =
      base::NumberToString(prompt.selected_records.size());
  const std::string counted_kinds = CountedLocalOiBriefKinds(prompt);
  LocalOiDeterministicBrief brief;
  switch (prompt.operation) {
    case LocalOiAssistOperation::kExplainSelectedFindings:
      brief.title = "Deterministic Local OI review";
      brief.lines.push_back(
          base::StrCat({"Selected: ", counted_kinds,
                        ". Review the typed local context "
                        "below; this view does not infer, browse, or act."}));
      for (const LocalOiAssistRecord& record : prompt.selected_records) {
        brief.lines.push_back(
            base::StrCat({"Review ", LocalOiBriefRecordKind(record.kind), ": ",
                          record.label, " — ", record.detail}));
      }
      break;
    case LocalOiAssistOperation::kSummarizeSelectedRecords:
      brief.title = "Deterministic Local OI summary";
      brief.lines.push_back(
          base::StrCat({"Summary scope: ", selected_count, " selected ",
                        selected_count == "1" ? "record" : "records", " (",
                        counted_kinds, ")."}));
      for (const LocalOiAssistRecord& record : prompt.selected_records) {
        brief.lines.push_back(
            base::StrCat({LocalOiBriefRecordKind(record.kind), ": ",
                          record.label, " — ", record.detail}));
      }
      break;
    case LocalOiAssistOperation::kDraftChecklist:
      brief.title = "Deterministic local review checklist";
      brief.lines.push_back(base::StrCat(
          {"Checklist scope: ", counted_kinds,
           ". Complete each review deliberately; this draft performs no "
           "operation."}));
      for (size_t index = 0u; index < prompt.selected_records.size(); ++index) {
        const LocalOiAssistRecord& record = prompt.selected_records[index];
        brief.lines.push_back(
            base::StrCat({base::NumberToString(index + 1u), ". Review ",
                          LocalOiBriefRecordKind(record.kind), ": ",
                          record.label, ". Local context: ", record.detail}));
      }
      break;
    case LocalOiAssistOperation::kDraftSanitizedHandoff:
      brief.title = "Deterministic sanitized handoff scope";
      brief.lines.push_back(
          base::StrCat({"Scope: ", selected_count, " selected Local OI ",
                        selected_count == "1" ? "record" : "records", " (",
                        counted_kinds, ")."}));
      brief.lines.push_back(
          "Excluded: record labels, identifiers, details, page content, "
          "browser data, downloads, headers, cookies, credentials, and "
          "account data.");
      brief.lines.push_back(
          "This display-only scope is not an export, promotion, sync, or "
          "hosted handoff.");
      break;
  }
  return brief;
}

std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot) {
  return BuildLocalOiSafeReport(snapshot, LocalOiSafeReportKind::kOverview);
}

std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot,
                                   LocalOiSafeReportKind kind) {
  return BuildLocalOiSafeReport(snapshot, kind,
                                LocalOiSafeReportFormat::kMarkdown);
}

std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot,
                                   LocalOiSafeReportKind kind,
                                   LocalOiSafeReportFormat format) {
  return BuildLocalOiSafeReport(snapshot, kind, format, LocalOiNowTimestamp());
}

std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot,
                                   LocalOiSafeReportKind kind,
                                   LocalOiSafeReportFormat format,
                                   std::string_view generated_at) {
  const std::string safe_generated_at = IsValidLocalOiTimestamp(generated_at)
                                            ? std::string(generated_at)
                                            : "unavailable";
  if (format == LocalOiSafeReportFormat::kJson) {
    base::DictValue report;
    report.Set("schema", "tahai_local_oi_safe_report_v1");
    report.Set("format", "json");
    report.Set("report_kind", std::string(LocalOiSafeReportKindLabel(kind)));
    report.Set("status", "local-only");
    report.Set("generated_at", safe_generated_at);
    report.Set("limitations",
               "No hosted audit, synchronization, connector, account, or "
               "browser-content capture.");
    base::DictValue counts;
    counts.Set("active_missions",
               static_cast<int>(snapshot.active_mission_count));
    counts.Set("open_findings", static_cast<int>(snapshot.findings.size()));
    counts.Set("knowledge_gaps",
               static_cast<int>(snapshot.knowledge_gap_count));
    counts.Set("evidence_records",
               static_cast<int>(snapshot.evidence_marker_count));
    counts.Set("artifact_integrity_records",
               static_cast<int>(snapshot.artifact_count));
    counts.Set("documentation_references",
               static_cast<int>(snapshot.document_reference_count));
    counts.Set("diagnostic_results",
               static_cast<int>(snapshot.diagnostic_result_count));
    counts.Set("change_captures",
               static_cast<int>(snapshot.change_capture_count));
    counts.Set("manual_recheck_entries",
               static_cast<int>(snapshot.manual_watch_count));
    counts.Set("generated_reports", static_cast<int>(snapshot.report_count));
    report.Set("counts", std::move(counts));
    std::string serialized;
    if (!base::JSONWriter::Write(report, &serialized)) {
      return {};
    }
    return RedactLocalOiExportText(serialized).text;
  }
  std::string report = base::StrCat(
      {"TAHAI Local OI ",
       LocalOiSafeReportKindLabel(kind),
       "\nStatus: local-only, generated from persisted Local OI records.\n",
       "Generated at: ",
       safe_generated_at,
       "\nActive Missions: ",
       base::NumberToString(snapshot.active_mission_count),
       "\nOpen findings: ",
       base::NumberToString(snapshot.findings.size()),
       "\nKnowledge gaps: ",
       base::NumberToString(snapshot.knowledge_gap_count),
       "\nEvidence records: ",
       base::NumberToString(snapshot.evidence_marker_count),
       "\nArtifact integrity records: ",
       base::NumberToString(snapshot.artifact_count),
       "\nDocumentation references: ",
       base::NumberToString(snapshot.document_reference_count),
       "\nExplicit diagnostic results: ",
       base::NumberToString(snapshot.diagnostic_result_count),
       "\nChange Lens captures: ",
       base::NumberToString(snapshot.change_capture_count),
       "\nManual recheck entries: ",
       base::NumberToString(snapshot.manual_watch_count),
       "\nGenerated local reports: ",
       base::NumberToString(snapshot.report_count),
       "\nLimitations: no hosted audit, synchronization, connector, account, "
       "or browser-content capture.\n"});
  switch (kind) {
    case LocalOiSafeReportKind::kOverview:
      report += "Report focus: aggregate local operational posture only.\n";
      break;
    case LocalOiSafeReportKind::kSanitizedHandoff:
      report +=
          base::StrCat({"Report focus: handoff posture with ",
                        base::NumberToString(snapshot.operator_action_count),
                        " deterministic action(s) and ",
                        base::NumberToString(snapshot.blocked_finding_count),
                        " blocked local condition(s).\n"});
      break;
    case LocalOiSafeReportKind::kChangeRecord:
      report +=
          base::StrCat({"Report focus: explicit change posture with ",
                        base::NumberToString(snapshot.change_capture_count),
                        " safe-digest capture(s), ",
                        base::NumberToString(snapshot.diagnostic_result_count),
                        " diagnostic result(s), and ",
                        base::NumberToString(snapshot.manual_watch_count),
                        " manual-only recheck entry or entries.\n"});
      break;
    case LocalOiSafeReportKind::kIncidentPacket:
      report += base::StrCat(
          {"Report focus: local knowledge-gap posture with ",
           base::NumberToString(snapshot.knowledge_gap_count), " gap(s), ",
           base::NumberToString(snapshot.blocked_finding_count),
           " blocked local condition(s), and ",
           base::NumberToString(snapshot.evidence_marker_count),
           " evidence marker(s).\n"});
      break;
    case LocalOiSafeReportKind::kEvidenceManifest:
      report +=
          base::StrCat({"Report focus: local evidence inventory with ",
                        base::NumberToString(snapshot.evidence_marker_count),
                        " evidence marker(s), ",
                        base::NumberToString(snapshot.artifact_count),
                        " artifact integrity record(s), and ",
                        base::NumberToString(snapshot.document_reference_count),
                        " documentation pointer(s).\n"});
      break;
    case LocalOiSafeReportKind::kArtifactIntegrity:
      report +=
          base::StrCat({"Report focus: local artifact-integrity posture with ",
                        base::NumberToString(snapshot.artifact_count),
                        " explicit artifact record(s), ",
                        base::NumberToString(snapshot.change_capture_count),
                        " safe-digest comparison(s), and ",
                        base::NumberToString(snapshot.knowledge_gap_count),
                        " knowledge-gap signal(s).\n"});
      break;
    case LocalOiSafeReportKind::kDiagnostic:
      report += base::StrCat(
          {"Report focus: local diagnostic posture with ",
           base::NumberToString(snapshot.diagnostic_result_count),
           " explicit tool result(s), ",
           base::NumberToString(snapshot.endpoint_count),
           " endpoint record(s), ", base::NumberToString(snapshot.domain_count),
           " domain record(s), and ",
           base::NumberToString(snapshot.manual_watch_count),
           " manual-only recheck entry or entries.\n"});
      break;
  }
  return RedactLocalOiExportText(report).text;
}

}  // namespace tahai
