// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_store.h"

#include <algorithm>
#include <limits>
#include <set>
#include <utility>

#include "base/values.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"

namespace tahai {
namespace {

constexpr char kSchemaVersionKey[] = "schema_version";
constexpr char kGenerationKey[] = "generation";
constexpr char kEntitiesKey[] = "entities";
constexpr char kRelationshipsKey[] = "relationships";
constexpr char kFindingsKey[] = "findings";
constexpr char kMemoryKey[] = "memory";
constexpr char kReportsKey[] = "reports";

constexpr char kIdKey[] = "id";
constexpr char kTypeKey[] = "type";
constexpr char kMissionIdKey[] = "mission_id";
constexpr char kTitleKey[] = "title";
constexpr char kSummaryKey[] = "summary";
constexpr char kSourceKey[] = "source";
constexpr char kFieldsKey[] = "fields";
constexpr char kCreatedAtKey[] = "created_at";
constexpr char kUpdatedAtKey[] = "updated_at";
constexpr char kArchivedKey[] = "archived";
constexpr char kKeyKey[] = "key";
constexpr char kValueKey[] = "value";
constexpr char kSourceIdKey[] = "source_id";
constexpr char kTargetIdKey[] = "target_id";
constexpr char kBasisKey[] = "basis";
constexpr char kRuleIdKey[] = "rule_id";
constexpr char kCategoryKey[] = "category";
constexpr char kSeverityKey[] = "severity";
constexpr char kExplanationKey[] = "explanation";
constexpr char kAffectedEntityIdsKey[] = "affected_entity_ids";
constexpr char kSupportingEvidenceIdsKey[] = "supporting_evidence_ids";
constexpr char kRemediationKey[] = "remediation";
constexpr char kStateKey[] = "state";
constexpr char kAcknowledgedKey[] = "acknowledged";
constexpr char kAcknowledgementNoteKey[] = "acknowledgement_note";
constexpr char kResolutionReasonKey[] = "resolution_reason";
constexpr char kSourceBasisKey[] = "source_basis";
constexpr char kConfidencePercentKey[] = "confidence_percent";
constexpr char kActionKey[] = "action";
constexpr char kEntityIdKey[] = "entity_id";
constexpr char kDetailKey[] = "detail";
constexpr char kContentKey[] = "content";
constexpr char kProvenanceKey[] = "provenance";
constexpr char kRedactionCountKey[] = "redaction_count";

bool IsLegacyRawDnsInspectionField(std::string_view key) {
  return key == "dns_addresses" || key == "dns_aliases" ||
         key == "dns_address_count" || key == "dns_addresses_fingerprint" ||
         key == "dns_aliases_fingerprint";
}

bool RemoveLegacyRawDnsInspectionFields(base::DictValue* root) {
  CHECK(root);
  base::ListValue* entities = root->FindList(kEntitiesKey);
  if (!entities) {
    return false;
  }
  for (base::Value& entity_value : *entities) {
    base::DictValue* entity = entity_value.GetIfDict();
    if (!entity) {
      return false;
    }
    base::ListValue* fields = entity->FindList(kFieldsKey);
    if (!fields) {
      return false;
    }
    for (auto field_value = fields->begin(); field_value != fields->end();) {
      const base::DictValue* field = field_value->GetIfDict();
      const std::string* key = field ? field->FindString(kKeyKey) : nullptr;
      if (key && IsLegacyRawDnsInspectionField(*key)) {
        field_value = fields->erase(field_value);
      } else {
        ++field_value;
      }
    }
  }
  return true;
}

template <typename T>
bool HasUniqueIds(const std::vector<T>& records) {
  std::set<std::string> ids;
  for (const T& record : records) {
    if (!ids.insert(record.id).second) {
      return false;
    }
  }
  return true;
}

base::ListValue SerializeStrings(const std::vector<std::string>& values) {
  base::ListValue result;
  for (const std::string& value : values) {
    result.Append(value);
  }
  return result;
}

std::optional<std::vector<std::string>> DeserializeStrings(
    const base::DictValue& dict,
    std::string_view key) {
  const base::ListValue* values = dict.FindList(key);
  if (!values || values->size() > 64u) {
    return std::nullopt;
  }
  std::vector<std::string> result;
  result.reserve(values->size());
  for (const base::Value& value : *values) {
    if (!value.is_string()) {
      return std::nullopt;
    }
    result.push_back(value.GetString());
  }
  return result;
}

bool ReadRequiredString(const base::DictValue& dict,
                        std::string_view key,
                        std::string* out) {
  const std::string* value = dict.FindString(key);
  if (!value) {
    return false;
  }
  *out = *value;
  return true;
}

base::Value SerializeEntity(const LocalOiEntityRecord& record) {
  base::DictValue dict;
  dict.Set(kIdKey, record.id);
  dict.Set(kTypeKey, LocalOiEntityTypeName(record.type));
  dict.Set(kMissionIdKey, record.mission_id);
  dict.Set(kTitleKey, record.title);
  dict.Set(kSummaryKey, record.summary);
  dict.Set(kSourceKey, LocalOiRecordSourceName(record.source));
  base::ListValue fields;
  for (const LocalOiField& field : record.fields) {
    base::DictValue serialized_field;
    serialized_field.Set(kKeyKey, field.key);
    serialized_field.Set(kValueKey, field.value);
    fields.Append(std::move(serialized_field));
  }
  dict.Set(kFieldsKey, std::move(fields));
  dict.Set(kCreatedAtKey, record.created_at);
  dict.Set(kUpdatedAtKey, record.updated_at);
  dict.Set(kArchivedKey, record.archived);
  return base::Value(std::move(dict));
}

std::optional<LocalOiEntityRecord> DeserializeEntity(const base::Value& value) {
  const base::DictValue* dict = value.GetIfDict();
  if (!dict) {
    return std::nullopt;
  }
  LocalOiEntityRecord record;
  std::string type;
  std::string source;
  if (!ReadRequiredString(*dict, kIdKey, &record.id) ||
      !ReadRequiredString(*dict, kTypeKey, &type) ||
      !ReadRequiredString(*dict, kMissionIdKey, &record.mission_id) ||
      !ReadRequiredString(*dict, kTitleKey, &record.title) ||
      !ReadRequiredString(*dict, kSummaryKey, &record.summary) ||
      !ReadRequiredString(*dict, kSourceKey, &source) ||
      !ReadRequiredString(*dict, kCreatedAtKey, &record.created_at) ||
      !ReadRequiredString(*dict, kUpdatedAtKey, &record.updated_at)) {
    return std::nullopt;
  }
  const std::optional<bool> archived = dict->FindBool(kArchivedKey);
  const base::ListValue* fields = dict->FindList(kFieldsKey);
  const std::optional<LocalOiEntityType> parsed_type =
      LocalOiEntityTypeFromName(type);
  const std::optional<LocalOiRecordSource> parsed_source =
      LocalOiRecordSourceFromName(source);
  if (!archived || !fields || !parsed_type || !parsed_source ||
      fields->size() > kTahaiLocalOiMaximumFieldsPerEntity) {
    return std::nullopt;
  }
  record.type = *parsed_type;
  record.source = *parsed_source;
  record.archived = *archived;
  for (const base::Value& serialized_field : *fields) {
    const base::DictValue* field = serialized_field.GetIfDict();
    if (!field) {
      return std::nullopt;
    }
    LocalOiField decoded_field;
    if (!ReadRequiredString(*field, kKeyKey, &decoded_field.key) ||
        !ReadRequiredString(*field, kValueKey, &decoded_field.value)) {
      return std::nullopt;
    }
    record.fields.push_back(std::move(decoded_field));
  }
  return ValidateLocalOiEntity(record) ? std::make_optional(std::move(record))
                                       : std::nullopt;
}

base::Value SerializeRelationship(const LocalOiRelationshipRecord& record) {
  base::DictValue dict;
  dict.Set(kIdKey, record.id);
  dict.Set(kTypeKey, LocalOiRelationshipTypeName(record.type));
  dict.Set(kSourceIdKey, record.source_id);
  dict.Set(kTargetIdKey, record.target_id);
  dict.Set(kBasisKey, record.basis);
  dict.Set(kCreatedAtKey, record.created_at);
  dict.Set(kUpdatedAtKey, record.updated_at);
  return base::Value(std::move(dict));
}

std::optional<LocalOiRelationshipRecord> DeserializeRelationship(
    const base::Value& value) {
  const base::DictValue* dict = value.GetIfDict();
  if (!dict) {
    return std::nullopt;
  }
  LocalOiRelationshipRecord record;
  std::string type;
  if (!ReadRequiredString(*dict, kIdKey, &record.id) ||
      !ReadRequiredString(*dict, kTypeKey, &type) ||
      !ReadRequiredString(*dict, kSourceIdKey, &record.source_id) ||
      !ReadRequiredString(*dict, kTargetIdKey, &record.target_id) ||
      !ReadRequiredString(*dict, kBasisKey, &record.basis) ||
      !ReadRequiredString(*dict, kCreatedAtKey, &record.created_at) ||
      !ReadRequiredString(*dict, kUpdatedAtKey, &record.updated_at)) {
    return std::nullopt;
  }
  const std::optional<LocalOiRelationshipType> parsed_type =
      LocalOiRelationshipTypeFromName(type);
  if (!parsed_type) {
    return std::nullopt;
  }
  record.type = *parsed_type;
  return ValidateLocalOiRelationship(record)
             ? std::make_optional(std::move(record))
             : std::nullopt;
}

base::Value SerializeFinding(const LocalOiFindingRecord& record) {
  base::DictValue dict;
  dict.Set(kIdKey, record.id);
  dict.Set(kRuleIdKey, record.rule_id);
  dict.Set(kCategoryKey, record.category);
  dict.Set(kSeverityKey, LocalOiFindingSeverityName(record.severity));
  dict.Set(kTitleKey, record.title);
  dict.Set(kExplanationKey, record.explanation);
  dict.Set(kAffectedEntityIdsKey, SerializeStrings(record.affected_entity_ids));
  dict.Set(kSupportingEvidenceIdsKey,
           SerializeStrings(record.supporting_evidence_ids));
  dict.Set(kRemediationKey, record.remediation);
  dict.Set(kCreatedAtKey, record.created_at);
  dict.Set(kUpdatedAtKey, record.updated_at);
  dict.Set(kStateKey, LocalOiFindingStateName(record.state));
  dict.Set(kAcknowledgedKey, record.acknowledged);
  dict.Set(kAcknowledgementNoteKey, record.acknowledgement_note);
  dict.Set(kResolutionReasonKey, record.resolution_reason);
  dict.Set(kSourceBasisKey, record.source_basis);
  if (record.confidence_percent) {
    dict.Set(kConfidencePercentKey, *record.confidence_percent);
  }
  return base::Value(std::move(dict));
}

std::optional<LocalOiFindingRecord> DeserializeFinding(
    const base::Value& value) {
  const base::DictValue* dict = value.GetIfDict();
  if (!dict) {
    return std::nullopt;
  }
  LocalOiFindingRecord record;
  std::string severity;
  std::string state;
  if (!ReadRequiredString(*dict, kIdKey, &record.id) ||
      !ReadRequiredString(*dict, kRuleIdKey, &record.rule_id) ||
      !ReadRequiredString(*dict, kCategoryKey, &record.category) ||
      !ReadRequiredString(*dict, kSeverityKey, &severity) ||
      !ReadRequiredString(*dict, kTitleKey, &record.title) ||
      !ReadRequiredString(*dict, kExplanationKey, &record.explanation) ||
      !ReadRequiredString(*dict, kRemediationKey, &record.remediation) ||
      !ReadRequiredString(*dict, kCreatedAtKey, &record.created_at) ||
      !ReadRequiredString(*dict, kUpdatedAtKey, &record.updated_at) ||
      !ReadRequiredString(*dict, kStateKey, &state) ||
      !ReadRequiredString(*dict, kAcknowledgementNoteKey,
                          &record.acknowledgement_note) ||
      !ReadRequiredString(*dict, kResolutionReasonKey,
                          &record.resolution_reason) ||
      !ReadRequiredString(*dict, kSourceBasisKey, &record.source_basis)) {
    return std::nullopt;
  }
  const std::optional<bool> acknowledged = dict->FindBool(kAcknowledgedKey);
  const std::optional<LocalOiFindingSeverity> parsed_severity =
      LocalOiFindingSeverityFromName(severity);
  const std::optional<LocalOiFindingState> parsed_state =
      LocalOiFindingStateFromName(state);
  const std::optional<std::vector<std::string>> affected_ids =
      DeserializeStrings(*dict, kAffectedEntityIdsKey);
  const std::optional<std::vector<std::string>> evidence_ids =
      DeserializeStrings(*dict, kSupportingEvidenceIdsKey);
  if (!acknowledged || !parsed_severity || !parsed_state || !affected_ids ||
      !evidence_ids) {
    return std::nullopt;
  }
  record.severity = *parsed_severity;
  record.state = *parsed_state;
  record.acknowledged = *acknowledged;
  record.affected_entity_ids = *affected_ids;
  record.supporting_evidence_ids = *evidence_ids;
  if (const std::optional<int> confidence =
          dict->FindInt(kConfidencePercentKey)) {
    record.confidence_percent = *confidence;
  }
  return ValidateLocalOiFinding(record) ? std::make_optional(std::move(record))
                                        : std::nullopt;
}

base::Value SerializeMemory(const LocalOiMemoryRecord& record) {
  base::DictValue dict;
  dict.Set(kIdKey, record.id);
  dict.Set(kActionKey, LocalOiMemoryActionName(record.action));
  dict.Set(kEntityIdKey, record.entity_id);
  dict.Set(kDetailKey, record.detail);
  dict.Set(kCreatedAtKey, record.created_at);
  return base::Value(std::move(dict));
}

std::optional<LocalOiMemoryRecord> DeserializeMemory(const base::Value& value) {
  const base::DictValue* dict = value.GetIfDict();
  if (!dict) {
    return std::nullopt;
  }
  LocalOiMemoryRecord record;
  std::string action;
  if (!ReadRequiredString(*dict, kIdKey, &record.id) ||
      !ReadRequiredString(*dict, kActionKey, &action) ||
      !ReadRequiredString(*dict, kEntityIdKey, &record.entity_id) ||
      !ReadRequiredString(*dict, kDetailKey, &record.detail) ||
      !ReadRequiredString(*dict, kCreatedAtKey, &record.created_at)) {
    return std::nullopt;
  }
  const std::optional<LocalOiMemoryAction> parsed_action =
      LocalOiMemoryActionFromName(action);
  if (!parsed_action) {
    return std::nullopt;
  }
  record.action = *parsed_action;
  return ValidateLocalOiMemory(record) ? std::make_optional(std::move(record))
                                       : std::nullopt;
}

base::Value SerializeReport(const LocalOiReportRecord& record) {
  base::DictValue dict;
  dict.Set(kIdKey, record.id);
  dict.Set(kTypeKey, LocalOiReportKindName(record.kind));
  dict.Set(kTitleKey, record.title);
  dict.Set(kContentKey, record.content);
  dict.Set(kProvenanceKey, record.provenance);
  dict.Set(kCreatedAtKey, record.created_at);
  dict.Set(kRedactionCountKey, static_cast<int>(record.redaction_count));
  return base::Value(std::move(dict));
}

std::optional<LocalOiReportRecord> DeserializeReport(const base::Value& value) {
  const base::DictValue* dict = value.GetIfDict();
  if (!dict) {
    return std::nullopt;
  }
  LocalOiReportRecord record;
  std::string type;
  const std::optional<int> redaction_count = dict->FindInt(kRedactionCountKey);
  if (!ReadRequiredString(*dict, kIdKey, &record.id) ||
      !ReadRequiredString(*dict, kTypeKey, &type) ||
      !ReadRequiredString(*dict, kTitleKey, &record.title) ||
      !ReadRequiredString(*dict, kContentKey, &record.content) ||
      !ReadRequiredString(*dict, kProvenanceKey, &record.provenance) ||
      !ReadRequiredString(*dict, kCreatedAtKey, &record.created_at) ||
      !redaction_count || *redaction_count < 0) {
    return std::nullopt;
  }
  const std::optional<LocalOiReportKind> parsed_kind =
      LocalOiReportKindFromName(type);
  if (!parsed_kind) {
    return std::nullopt;
  }
  record.kind = *parsed_kind;
  record.redaction_count = static_cast<size_t>(*redaction_count);
  return ValidateLocalOiReport(record) ? std::make_optional(std::move(record))
                                       : std::nullopt;
}

base::DictValue SerializeStore(const LocalOiStoreData& data) {
  base::DictValue root;
  root.Set(kSchemaVersionKey, data.schema_version);
  root.Set(kGenerationKey, data.generation);
  base::ListValue entities;
  for (const LocalOiEntityRecord& record : data.entities) {
    entities.Append(SerializeEntity(record));
  }
  root.Set(kEntitiesKey, std::move(entities));
  base::ListValue relationships;
  for (const LocalOiRelationshipRecord& record : data.relationships) {
    relationships.Append(SerializeRelationship(record));
  }
  root.Set(kRelationshipsKey, std::move(relationships));
  base::ListValue findings;
  for (const LocalOiFindingRecord& record : data.findings) {
    findings.Append(SerializeFinding(record));
  }
  root.Set(kFindingsKey, std::move(findings));
  base::ListValue memory;
  for (const LocalOiMemoryRecord& record : data.memory) {
    memory.Append(SerializeMemory(record));
  }
  root.Set(kMemoryKey, std::move(memory));
  base::ListValue reports;
  for (const LocalOiReportRecord& record : data.reports) {
    reports.Append(SerializeReport(record));
  }
  root.Set(kReportsKey, std::move(reports));
  return root;
}

std::optional<LocalOiStoreData> DeserializeStore(
    const base::DictValue& root) {
  const std::optional<int> schema_version = root.FindInt(kSchemaVersionKey);
  const std::optional<int> generation = root.FindInt(kGenerationKey);
  const base::ListValue* entities = root.FindList(kEntitiesKey);
  const base::ListValue* relationships = root.FindList(kRelationshipsKey);
  const base::ListValue* findings = root.FindList(kFindingsKey);
  const base::ListValue* memory = root.FindList(kMemoryKey);
  const base::ListValue* reports = root.FindList(kReportsKey);
  if (!schema_version || *schema_version != kTahaiLocalOiCurrentSchemaVersion ||
      !generation || *generation < 0 || !entities || !relationships ||
      !findings || !memory || !reports ||
      entities->size() > kTahaiLocalOiMaximumEntities ||
      relationships->size() > kTahaiLocalOiMaximumRelationships ||
      findings->size() > kTahaiLocalOiMaximumFindings ||
      memory->size() > kTahaiLocalOiMaximumMemoryRecords ||
      reports->size() > kTahaiLocalOiMaximumReports) {
    return std::nullopt;
  }
  LocalOiStoreData data;
  data.schema_version = *schema_version;
  data.generation = *generation;
  for (const base::Value& value : *entities) {
    std::optional<LocalOiEntityRecord> record = DeserializeEntity(value);
    if (!record) {
      return std::nullopt;
    }
    data.entities.push_back(std::move(*record));
  }
  for (const base::Value& value : *relationships) {
    std::optional<LocalOiRelationshipRecord> record =
        DeserializeRelationship(value);
    if (!record) {
      return std::nullopt;
    }
    data.relationships.push_back(std::move(*record));
  }
  for (const base::Value& value : *findings) {
    std::optional<LocalOiFindingRecord> record = DeserializeFinding(value);
    if (!record) {
      return std::nullopt;
    }
    data.findings.push_back(std::move(*record));
  }
  for (const base::Value& value : *memory) {
    std::optional<LocalOiMemoryRecord> record = DeserializeMemory(value);
    if (!record) {
      return std::nullopt;
    }
    data.memory.push_back(std::move(*record));
  }
  for (const base::Value& value : *reports) {
    std::optional<LocalOiReportRecord> record = DeserializeReport(value);
    if (!record) {
      return std::nullopt;
    }
    data.reports.push_back(std::move(*record));
  }
  if (!HasUniqueIds(data.entities) || !HasUniqueIds(data.relationships) ||
      !HasUniqueIds(data.findings) || !HasUniqueIds(data.memory) ||
      !HasUniqueIds(data.reports)) {
    return std::nullopt;
  }
  return data;
}

bool MigrateToCurrent(base::DictValue* root) {
  CHECK(root);
  int schema_version = root->FindInt(kSchemaVersionKey).value_or(0);
  if (schema_version == 0) {
    // Schema v0 was an unversioned draft document. It used the same record
    // keys, so assigning its original version and generation is lossless.
    root->Set(kSchemaVersionKey, 1);
    root->Set(kGenerationKey, root->FindInt(kGenerationKey).value_or(0));
    schema_version = 1;
  }
  if (schema_version == 1) {
    // Version 2 removes raw DNS address/alias fields and their reversible-in-
    // practice public-value fingerprints. Future records retain only bounded
    // address-family and alias counts for explainable comparisons.
    if (!RemoveLegacyRawDnsInspectionFields(root)) {
      return false;
    }
    root->Set(kSchemaVersionKey, 2);
    schema_version = 2;
  }
  return schema_version == kTahaiLocalOiCurrentSchemaVersion;
}

template <typename T>
bool UpsertById(std::vector<T>* records, T record, size_t maximum_records) {
  auto existing = std::find_if(
      records->begin(), records->end(),
      [&record](const T& candidate) { return candidate.id == record.id; });
  if (existing != records->end()) {
    *existing = std::move(record);
    return true;
  }
  if (records->size() >= maximum_records) {
    return false;
  }
  records->push_back(std::move(record));
  return true;
}

}  // namespace

TahaiLocalOiStore::TahaiLocalOiStore(PrefService* prefs, bool durable)
    : prefs_(prefs), durable_(durable) {
  CHECK(prefs_);
  Load();
}

TahaiLocalOiStore::~TahaiLocalOiStore() = default;

bool TahaiLocalOiStore::Load() {
  data_ = LocalOiStoreData();
  if (!durable_) {
    status_ = LocalOiStoreStatus::kEphemeral;
    return true;
  }
  base::DictValue root = prefs_->GetDict(prefs::kTahaiLocalOiStore).Clone();
  if (root.empty()) {
    status_ = LocalOiStoreStatus::kReady;
    return Persist();
  }
  const bool needs_persist = root.FindInt(kSchemaVersionKey).value_or(0) !=
                             kTahaiLocalOiCurrentSchemaVersion;
  if (!MigrateToCurrent(&root)) {
    status_ = LocalOiStoreStatus::kRecoveredFromCorruption;
    return Persist();
  }
  std::optional<LocalOiStoreData> loaded = DeserializeStore(root);
  if (!loaded) {
    status_ = LocalOiStoreStatus::kRecoveredFromCorruption;
    return Persist();
  }
  data_ = std::move(*loaded);
  status_ = LocalOiStoreStatus::kReady;
  return !needs_persist || Persist();
}

bool TahaiLocalOiStore::Persist() {
  if (!durable_) {
    return true;
  }
  if (!prefs_) {
    status_ = LocalOiStoreStatus::kUnavailable;
    return false;
  }
  ScopedDictPrefUpdate update(prefs_, prefs::kTahaiLocalOiStore);
  update->clear();
  update->Merge(SerializeStore(data_));
  return true;
}

bool TahaiLocalOiStore::Replace(LocalOiStoreData data) {
  data.schema_version = kTahaiLocalOiCurrentSchemaVersion;
  if (data.generation == std::numeric_limits<int>::max()) {
    return false;
  }
  ++data.generation;
  if (data.entities.size() > kTahaiLocalOiMaximumEntities ||
      data.relationships.size() > kTahaiLocalOiMaximumRelationships ||
      data.findings.size() > kTahaiLocalOiMaximumFindings ||
      data.memory.size() > kTahaiLocalOiMaximumMemoryRecords ||
      data.reports.size() > kTahaiLocalOiMaximumReports ||
      !HasUniqueIds(data.entities) || !HasUniqueIds(data.relationships) ||
      !HasUniqueIds(data.findings) || !HasUniqueIds(data.memory) ||
      !HasUniqueIds(data.reports)) {
    return false;
  }
  if (!std::all_of(data.entities.begin(), data.entities.end(),
                   ValidateLocalOiEntity) ||
      !std::all_of(data.relationships.begin(), data.relationships.end(),
                   ValidateLocalOiRelationship) ||
      !std::all_of(data.findings.begin(), data.findings.end(),
                   ValidateLocalOiFinding) ||
      !std::all_of(data.memory.begin(), data.memory.end(),
                   ValidateLocalOiMemory) ||
      !std::all_of(data.reports.begin(), data.reports.end(),
                   ValidateLocalOiReport)) {
    return false;
  }
  std::set<std::string> entity_ids;
  for (const LocalOiEntityRecord& entity : data.entities) {
    entity_ids.insert(entity.id);
  }
  if (!std::all_of(data.relationships.begin(), data.relationships.end(),
                   [&entity_ids](const LocalOiRelationshipRecord& record) {
                     return entity_ids.contains(record.source_id) &&
                            entity_ids.contains(record.target_id);
                   })) {
    return false;
  }
  data_ = std::move(data);
  return Persist();
}

bool TahaiLocalOiStore::UpsertEntity(LocalOiEntityRecord record) {
  if (!ValidateLocalOiEntity(record)) {
    return false;
  }
  LocalOiStoreData next = data_;
  if (!UpsertById(&next.entities, std::move(record),
                  kTahaiLocalOiMaximumEntities)) {
    return false;
  }
  return Replace(std::move(next));
}

bool TahaiLocalOiStore::UpsertRelationship(LocalOiRelationshipRecord record) {
  if (!ValidateLocalOiRelationship(record)) {
    return false;
  }
  LocalOiStoreData next = data_;
  if (!UpsertById(&next.relationships, std::move(record),
                  kTahaiLocalOiMaximumRelationships)) {
    return false;
  }
  return Replace(std::move(next));
}

bool TahaiLocalOiStore::UpsertFinding(LocalOiFindingRecord record) {
  if (!ValidateLocalOiFinding(record)) {
    return false;
  }
  LocalOiStoreData next = data_;
  if (!UpsertById(&next.findings, std::move(record),
                  kTahaiLocalOiMaximumFindings)) {
    return false;
  }
  return Replace(std::move(next));
}

bool TahaiLocalOiStore::AppendMemory(LocalOiMemoryRecord record) {
  if (!ValidateLocalOiMemory(record)) {
    return false;
  }
  LocalOiStoreData next = data_;
  if (!UpsertById(&next.memory, std::move(record),
                  kTahaiLocalOiMaximumMemoryRecords)) {
    return false;
  }
  return Replace(std::move(next));
}

bool TahaiLocalOiStore::AddReport(LocalOiReportRecord record) {
  if (!ValidateLocalOiReport(record)) {
    return false;
  }
  LocalOiStoreData next = data_;
  if (!UpsertById(&next.reports, std::move(record),
                  kTahaiLocalOiMaximumReports)) {
    return false;
  }
  return Replace(std::move(next));
}

bool TahaiLocalOiStore::DeleteEntity(std::string_view entity_id) {
  if (!IsValidLocalOiId(entity_id)) {
    return false;
  }
  LocalOiStoreData next = data_;
  const auto entity =
      std::remove_if(next.entities.begin(), next.entities.end(),
                     [entity_id](const LocalOiEntityRecord& record) {
                       return record.id == entity_id;
                     });
  if (entity == next.entities.end()) {
    return false;
  }
  next.entities.erase(entity, next.entities.end());
  next.relationships.erase(
      std::remove_if(next.relationships.begin(), next.relationships.end(),
                     [entity_id](const LocalOiRelationshipRecord& record) {
                       return record.source_id == entity_id ||
                              record.target_id == entity_id;
                     }),
      next.relationships.end());
  return Replace(std::move(next));
}

bool TahaiLocalOiStore::DeleteAll() {
  LocalOiStoreData empty;
  empty.generation = data_.generation;
  return Replace(std::move(empty));
}

bool TahaiLocalOiStore::Commit(LocalOiStoreData data) {
  return Replace(std::move(data));
}

bool TahaiLocalOiStore::ReplaceForTesting(LocalOiStoreData data) {
  return Replace(std::move(data));
}

}  // namespace tahai
