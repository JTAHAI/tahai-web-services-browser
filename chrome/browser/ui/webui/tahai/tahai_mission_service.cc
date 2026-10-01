// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"

#include <algorithm>
#include <array>
#include <initializer_list>
#include <limits>
#include <memory>
#include <set>
#include <utility>

#include "base/base64.h"
#include "base/containers/span.h"
#include "base/files/file_path.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/time/time.h"
#include "base/uuid.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/tahai/tahai_operational_workflow_queue.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_capsule.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_redactor.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"
#include "components/prefs/pref_service.h"
#include "components/os_crypt/async/browser/os_crypt_async.h"
#include "components/os_crypt/async/common/encryptor.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "crypto/sha2.h"
#include "url/gurl.h"

namespace tahai {
namespace {

constexpr std::array<std::string_view, 11> kAllowedMissionTypes = {
    "incident",      "change",      "audit",         "deployment",
    "investigation", "maintenance", "documentation", "migration",
    "admin",         "support",     "development"};

constexpr size_t kMaximumMissions = 500u;
constexpr std::array<std::string_view, 20> kKnownMissionFields = {
    "id",
    "title",
    "type",
    "created_at",
    "updated_at",
    "operational_workflow",
    "steps",
    "validation_steps",
    "rollback_steps",
    "escalation_required",
    "archived",
    "export_profile",
    "timeline_integrity_verified",
    "links",
    "evidence",
    "notes",
    "workflow_inputs",
    "workflow_variables",
    "workflow_outputs",
    "timeline"};
constexpr size_t kMaximumTimelineEvents = 64u;
constexpr size_t kMaximumEvidenceMarkers = 12u;
constexpr size_t kMaximumMissionNotes = 24u;
constexpr size_t kMaximumMissionNoteLength = 512u;
constexpr size_t kMaximumOperationalWorkflowSteps = 32u;
constexpr size_t kMaximumOperationalWorkflowInputs = 12u;
constexpr size_t kMaximumOperationalWorkflowInputLength = 256u;
constexpr std::string_view kDuplicateTitleSuffix = " copy";

constexpr std::array<std::string_view, 6> kAllowedTimelineKinds = {
    "mission", "runbook", "validation", "rollback", "evidence", "export"};
constexpr std::array<std::string_view, 6> kAllowedExportProfiles = {
    "sanitized-handoff", "internal",    "incident-packet",
    "change-record",     "itdocs-sync", "psa-ticket-note"};
constexpr std::array<std::string_view, 7> kOperationalWorkflowRunStates = {
    "ready", "running", "waiting-for-input", "paused", "succeeded",
    "failed", "cancelled"};

bool HasKnownStoredFields(
    const base::DictValue* record,
    std::initializer_list<std::string_view> fields) {
  return !record || std::ranges::all_of(*record, [&fields](const auto entry) {
    return std::ranges::find(fields, entry.first) != fields.end();
  });
}

bool HasKnownMissionNestedFields(const base::DictValue& mission) {
  const auto check_records = [&mission](
      std::string_view key, std::initializer_list<std::string_view> fields) {
    const auto* records = mission.FindList(key);
    return !records || std::ranges::all_of(*records, [&fields](const auto& item) {
      return HasKnownStoredFields(item.GetIfDict(), fields);
    });
  };
  if (!HasKnownStoredFields(mission.FindDict("operational_workflow"),
                           {"skin_id", "workflow_id", "archive_sha256",
                            "run_state", "adapter_version"}) ||
      !HasKnownStoredFields(mission.FindDict("links"), {"oi"}) ||
      !HasKnownStoredFields(
          mission.FindDict("links") ? mission.FindDict("links")->FindDict("oi")
                                    : nullptr,
          {"opaque_reference", "hosted_deep_link"}) ||
      !check_records("evidence", {"label", "capture_scope", "captured_at"}) ||
      !check_records("notes", {"text", "created_at"}) ||
      !check_records("timeline", {"kind", "detail", "created_at",
                                  "previous_hash", "entry_hash"}) ||
      !check_records("workflow_outputs", {"id", "name", "from"}) ||
      !check_records("workflow_inputs",
                     {"id", "name", "type", "required", "value", "options",
                      "validation", "protected", "protected_value"}) ||
      !check_records("workflow_variables",
                     {"id", "name", "type", "options", "validation",
                      "protected", "value", "protected_value"})) {
    return false;
  }
  for (const auto key : {"steps", "validation_steps", "rollback_steps"}) {
    if (std::string_view(key) != "steps" ||
        !mission.FindDict("operational_workflow")) {
      // Fixed-family and compensation steps restore only these two fields.
      // Treat ignored operational metadata as unsupported, including any
      // nested expression that the fixed-family loader would never parse.
      if (!check_records(key, {"label", "complete"})) {
        return false;
      }
      continue;
    }
    if (!check_records(key,
                       {"label", "complete", "assign", "wait_seconds",
                        "wait_remaining_ms", "wait_state", "wait_timeout_seconds",
                        "wait_timeout_remaining_ms", "workflow_step_id",
                        "requires_native_action", "action_state", "native_action_error",
                        "condition_predicate", "variable_condition_result",
                        "condition_input_id", "condition_from_variable",
                        "condition_compare", "condition_equals"})) {
      return false;
    }
  }
  // The operational expression/output parsers already reject unknown nested
  // fields. Input records are restored manually, so cover their rule objects
  // here as well. Legacy malformed known fields retain their existing handling.
  for (const auto key : {"workflow_inputs", "workflow_variables"}) {
    if (const auto* records = mission.FindList(key)) {
      for (const auto& item : *records) {
        const auto* record = item.GetIfDict();
        if (record && !HasKnownStoredFields(record->FindDict("validation"),
                    {"min_bytes", "max_bytes", "minimum", "maximum"})) {
          return false;
        }
      }
    }
  }
  return true;
}

bool IsAllowedType(std::string_view type) {
  for (std::string_view allowed : kAllowedMissionTypes) {
    if (type == allowed) {
      return true;
    }
  }
  return false;
}

bool IsAllowedTimelineKind(std::string_view kind) {
  for (std::string_view allowed : kAllowedTimelineKinds) {
    if (kind == allowed) {
      return true;
    }
  }
  return false;
}

bool IsAllowedExportProfile(std::string_view profile) {
  for (std::string_view allowed : kAllowedExportProfiles) {
    if (profile == allowed) {
      return true;
    }
  }
  return false;
}

bool IsOperationalWorkflowRunState(std::string_view state) {
  return std::ranges::find(kOperationalWorkflowRunStates, state) !=
         kOperationalWorkflowRunStates.end();
}

bool IsTerminalWorkflowState(std::string_view state) {
  return state == "succeeded" || state == "failed" || state == "cancelled";
}

bool IsAllowedOperationalWorkflowTransition(std::string_view from,
                                            std::string_view to) {
  if (!IsOperationalWorkflowRunState(from) ||
      !IsOperationalWorkflowRunState(to) || from == to) {
    return false;
  }
  if (from == "ready") {
    // A browser-owned launch can fail before the first command is dispatched;
    // retain that result rather than pretending the checklist never started.
    return to == "running" || to == "waiting-for-input" || to == "failed" ||
           to == "cancelled";
  }
  if (from == "running") {
    return to == "waiting-for-input" || to == "paused" ||
           to == "succeeded" || to == "failed" || to == "cancelled";
  }
  if (from == "waiting-for-input") {
    return to == "running" || to == "paused" || to == "failed" ||
           to == "cancelled";
  }
  if (from == "paused") {
    return to == "running" || to == "failed" || to == "cancelled";
  }
  return false;
}

bool IsOperationalWorkflowStateEvent(std::string_view detail) {
  constexpr std::string_view kPrefix = "Operational workflow state: ";
  return detail.starts_with(kPrefix) &&
         IsOperationalWorkflowRunState(detail.substr(kPrefix.size()));
}

bool IsSafeTitle(std::string_view title) {
  if (title.empty() || title.size() > 128u || !base::IsStringUTF8(title)) {
    return false;
  }
  for (char c : title) {
    if (static_cast<unsigned char>(c) < 0x20u || c == '\x7f') {
      return false;
    }
  }
  return true;
}

bool IsSafeMissionNote(std::string_view note) {
  if (note.empty() || note.size() > kMaximumMissionNoteLength ||
      !base::IsStringUTF8(note)) {
    return false;
  }
  if (!std::all_of(note.begin(), note.end(), [](unsigned char character) {
        return character >= 0x20u && character != 0x7fu;
      })) {
    return false;
  }
  // This is an operational annotation, not a mini document, URL field, or
  // account/contact record. Reject common transport and identity delimiters
  // before the shared sensitive-material screen makes the final decision.
  return note.find("//") == std::string_view::npos &&
         note.find('@') == std::string_view::npos &&
         note.find('\\') == std::string_view::npos &&
         note.find(':') == std::string_view::npos;
}

bool IsSafeOperationalIdentifier(std::string_view value) {
  if (value.size() < 3u || value.size() > 64u || value.front() == '-' ||
      value.back() == '-') {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '-';
  });
}

bool IsSafeTimestamp(std::string_view timestamp) {
  if (timestamp.empty() || timestamp.size() > 32u) {
    return false;
  }
  return std::all_of(timestamp.begin(), timestamp.end(),
                     [](char c) { return c >= '0' && c <= '9'; });
}

bool IsLedgerHash(std::string_view value) {
  return value.size() == 64u &&
         std::all_of(value.begin(), value.end(), [](char c) {
           return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') ||
                  (c >= 'A' && c <= 'F');
         });
}

std::string LedgerHash(std::string_view mission_id,
                       std::string_view kind,
                       std::string_view detail,
                       std::string_view created_at,
                       std::string_view previous_hash) {
  // All values are generated from the fixed Mission schema. The separators
  // make the concatenation unambiguous without accepting page data.
  return base::HexEncode(crypto::SHA256HashString(
      base::StrCat({"TAHAI-MISSION-LEDGER-v1\n", mission_id, "\n", kind, "\n",
                    detail, "\n", created_at, "\n", previous_hash})));
}

void RebuildTimelineLedger(MissionSummary* mission) {
  CHECK(mission);
  std::string previous_hash;
  for (auto event = mission->timeline.rbegin();
       event != mission->timeline.rend(); ++event) {
    event->previous_hash = previous_hash;
    event->entry_hash = LedgerHash(mission->id, event->kind, event->detail,
                                   event->created_at, previous_hash);
    previous_hash = event->entry_hash;
  }
}

bool VerifyTimelineLedger(const MissionSummary& mission) {
  for (size_t index = 0; index < mission.timeline.size(); ++index) {
    const MissionEvent& event = mission.timeline[index];
    if (!IsLedgerHash(event.entry_hash) ||
        (!event.previous_hash.empty() && !IsLedgerHash(event.previous_hash)) ||
        event.entry_hash != LedgerHash(mission.id, event.kind, event.detail,
                                       event.created_at, event.previous_hash)) {
      return false;
    }
    if (index + 1u < mission.timeline.size() &&
        event.previous_hash != mission.timeline[index + 1u].entry_hash) {
      return false;
    }
  }
  return true;
}

std::string DuplicateTitle(std::string_view title) {
  CHECK_LE(kDuplicateTitleSuffix.size(), 128u);
  return base::StrCat(
      {base::TruncateUTF8ToByteSize(title, 128u - kDuplicateTitleSuffix.size()),
       kDuplicateTitleSuffix});
}

std::string NowAsWindowsEpochMicros() {
  return base::NumberToString(
      base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds());
}

std::vector<MissionStep> DefaultSteps(std::string_view type) {
  if (type == "incident") {
    return {{"Confirm impact and ownership", false},
            {"Capture a safe current-state summary", false},
            {"Validate recovery or escalation", false},
            {"Record closeout status", false}};
  }
  if (type == "change" || type == "deployment" || type == "migration") {
    return {{"Confirm approved scope", false},
            {"Capture pre-change state", false},
            {"Perform the approved change", false},
            {"Validate the target", false},
            {"Record rollback or closeout", false}};
  }
  if (type == "audit") {
    return {{"Confirm audit scope", false},
            {"Collect approved references", false},
            {"Validate findings", false},
            {"Record handoff status", false}};
  }
  if (type == "admin") {
    return {{"Confirm authorized administrative scope", false},
            {"Capture approved starting state", false},
            {"Apply one bounded administrative change", false},
            {"Validate the affected service", false},
            {"Record closeout status", false}};
  }
  if (type == "support") {
    return {{"Confirm customer scope and authorization", false},
            {"Capture a safe issue summary", false},
            {"Perform the approved support step", false},
            {"Validate the recovery or next action", false},
            {"Record handoff status", false}};
  }
  if (type == "development") {
    return {{"Confirm reproducible scope", false},
            {"Capture safe source and target context", false},
            {"Perform the development or debug step", false},
            {"Validate the result against the target", false},
            {"Record next action or closeout", false}};
  }
  return {{"Define the bounded outcome", false},
          {"Capture approved context", false},
          {"Perform the work", false},
          {"Validate the result", false},
          {"Record closeout status", false}};
}

std::vector<MissionStep> DefaultValidationSteps(std::string_view type) {
  return {{"Confirm the expected browser-visible result", false},
          {"Confirm the approved operator can continue", false},
          {type == "incident" ? "Confirm recovery or escalation state"
                              : "Confirm the bounded outcome",
           false}};
}

std::vector<MissionStep> DefaultRollbackSteps(std::string_view type) {
  return {{"Confirm rollback authority and trigger", false},
          {type == "incident" ? "Confirm escalation owner"
                              : "Confirm safe restore path",
           false},
          {"Record rollback or no-rollback decision", false}};
}

std::optional<std::vector<MissionStep>> OperationalCompensationSteps(
    const TahaiOperationalWorkflow& workflow) {
  if (workflow.compensation_steps.empty()) return std::vector<MissionStep>();
  base::Value encoded(SerializeTahaiWorkflowCompensationSteps(
      workflow.compensation_steps));
  std::vector<TahaiWorkflowCompensationStep> parsed;
  if (!ParseTahaiWorkflowCompensationSteps(&encoded, &parsed) ||
      parsed != workflow.compensation_steps) return std::nullopt;
  std::vector<MissionStep> steps;
  steps.reserve(parsed.size());
  for (const auto& step : parsed) {
    if (!IsSafeOperationalIdentifier(step.id) || !IsSafeTitle(step.name))
      return std::nullopt;
    steps.push_back({step.name, false});
  }
  return steps;
}

std::optional<std::vector<MissionStep>> OperationalWorkflowSteps(
    const TahaiOperationalWorkflow& workflow, bool native_adapter) {
  const auto expanded = ExpandTahaiWorkflowSteps(workflow);
  if (!IsSafeOperationalIdentifier(workflow.id) || !IsSafeTitle(workflow.name) ||
      !expanded || !ValidateTahaiWorkflowActionBindings(workflow.steps) || (!native_adapter && !workflow.repeats.empty())) {
    return std::nullopt;
  }
  std::vector<MissionStep> steps;
  steps.reserve(expanded->size());
  std::set<std::string> ids;
  for (const TahaiOperationalWorkflowStep& step : *expanded) {
    if (step.predicate && (!native_adapter || step.predicate->operation.empty() ||
        !step.condition_input_id.empty() || !step.condition_equals.empty() || step.numeric_condition || step.condition_from_variable ||
        !ValidateTahaiWorkflowPredicate(*step.predicate, workflow.inputs, workflow.variables))) return std::nullopt;
    if (!IsSafeOperationalIdentifier(step.id) || !IsSafeTitle(step.name) ||
        !ids.insert(step.id).second ||
        ((step.kind == TahaiOperationalWorkflowStepKind::kAssignVariable) !=
          step.assignment.has_value()) ||
        ((step.kind == TahaiOperationalWorkflowStepKind::kWait) != (step.wait_seconds != 0)) ||
        (step.wait_seconds && (!native_adapter || !step.action.empty() || step.wait_seconds < 1 || step.wait_seconds > 86400)) ||
        (step.wait_timeout_seconds && (!step.wait_seconds || step.wait_timeout_seconds <= step.wait_seconds ||
                                       step.wait_timeout_seconds > 86400)) ||
        (step.assignment && (!native_adapter ||
          !ValidateTahaiWorkflowAssignment(*step.assignment, workflow.inputs, workflow.variables)))) {
      return std::nullopt;
    }
    const auto& condition_sources = step.condition_from_variable ? workflow.variables : workflow.inputs;
    if ((step.condition_from_variable && !native_adapter) ||
        ((!step.condition_input_id.empty() || !step.condition_equals.empty() || step.numeric_condition || step.condition_from_variable) &&
        (!IsSafeOperationalIdentifier(step.condition_input_id) ||
         (step.numeric_condition ? (!native_adapter || !step.condition_equals.empty() ||
             !IsValidTahaiWorkflowNumericCondition(*step.numeric_condition)) : !IsSafeMissionNote(step.condition_equals)) ||
         std::none_of(condition_sources.begin(), condition_sources.end(),
                      [&step](const TahaiOperationalWorkflowInput& input) {
                        return input.id == step.condition_input_id;
                      })))) {
      return std::nullopt;
    }
    steps.push_back({step.name, false, step.condition_input_id,
                     step.condition_equals});
    steps.back().assignment = step.assignment;
    steps.back().numeric_condition = step.numeric_condition;
    steps.back().condition_from_variable = step.condition_from_variable;
    steps.back().predicate = step.predicate;
    if (step.wait_seconds) {
      steps.back().wait_seconds = step.wait_seconds;
      steps.back().wait_remaining_ms = step.wait_seconds * 1000;
      steps.back().wait_state = "ready";
      steps.back().wait_timeout_seconds = step.wait_timeout_seconds;
      steps.back().wait_timeout_remaining_ms = step.wait_timeout_seconds * 1000;
    }
    if (native_adapter) {
      steps.back().workflow_step_id = step.id;
      steps.back().requires_native_action =
          step.kind == TahaiOperationalWorkflowStepKind::kRunCommand;
      if (steps.back().requires_native_action) {
        steps.back().action_state = "ready";
      }
    }
  }
  return steps;
}

std::optional<std::vector<MissionWorkflowInput>> OperationalWorkflowInputs(
    const TahaiOperationalWorkflow& workflow) {
  if (workflow.inputs.size() > kMaximumOperationalWorkflowInputs) {
    return std::nullopt;
  }
  std::vector<MissionWorkflowInput> inputs;
  inputs.reserve(workflow.inputs.size());
  for (const TahaiOperationalWorkflowInput& input : workflow.inputs) {
    if (!IsSafeOperationalIdentifier(input.id) || !IsSafeTitle(input.name) ||
        std::ranges::any_of(inputs, [&input](const auto& existing) {
          return existing.id == input.id;
        })) {
      return std::nullopt;
    }
    std::string type(TahaiOperationalWorkflowInputTypeName(input.type));
    if (type.empty() || (type == "selection" && input.options.empty()) ||
        (type != "selection" && !input.options.empty()) ||
        input.options.size() > 12u ||
        !IsValidTahaiWorkflowInputValidation(input.validation, type)) {
      return std::nullopt;
    }
    for (const std::string& option : input.options) {
      if (!IsSafeMissionNote(option) ||
          std::count(input.options.begin(), input.options.end(), option) != 1) {
        return std::nullopt;
      }
    }
    inputs.push_back({input.id, input.name, std::move(type), input.required,
                      input.options, {}, input.is_protected});
    inputs.back().validation = input.validation;
  }
  return inputs;
}

bool IsValidWorkflowDate(std::string_view value) {
  // An ISO calendar date, not a timestamp: no locale or timezone conversion.
  if (value.size() != 10u || value[4] != '-' || value[7] != '-') {
    return false;
  }
  for (size_t index = 0; index < value.size(); ++index) {
    if (index != 4u && index != 7u &&
        (value[index] < '0' || value[index] > '9')) {
      return false;
    }
  }
  int year = 0;
  int month = 0;
  int day = 0;
  if (!base::StringToInt(value.substr(0, 4), &year) || year < 1 ||
      !base::StringToInt(value.substr(5, 2), &month) || month < 1 || month > 12 ||
      !base::StringToInt(value.substr(8, 2), &day) || day < 1) {
    return false;
  }
  constexpr std::array<int, 12> days = {31, 28, 31, 30, 31, 30,
                                      31, 31, 30, 31, 30, 31};
  const bool leap = year % 4 == 0 && (year % 100 != 0 || year % 400 == 0);
  return day <= days[month - 1] + (month == 2 && leap ? 1 : 0);
}

bool IsValidWorkflowUrl(std::string_view value) {
  // Store an explicit reference, never navigate, fetch, inspect or grant it.
  // Reject URL parser repairs and credential-bearing authorities. Values stay
  // outside all design and routine evidence exports, including query/fragment.
  if (!std::ranges::all_of(value, [](unsigned char character) {
        return character > 0x20u && character < 0x7fu && character != '\\';
      })) {
    return false;
  }
  const GURL url(value);
  const size_t separator = value.find("://");
  if (separator == std::string_view::npos) {
    return false;
  }
  auto authority = value.substr(separator + 3);
  authority = authority.substr(0, authority.find_first_of("/?#"));
  return url.is_valid() && url.SchemeIsHTTPOrHTTPS() && url.has_host() &&
         !url.has_username() && !url.has_password() && !authority.empty() &&
         authority.find('@') == std::string_view::npos;
}

bool IsValidOperationalWorkflowInputValue(const MissionWorkflowInput& input,
                                          std::string_view value) {
  if (value.size() > kMaximumOperationalWorkflowInputLength ||
      !MatchesTahaiWorkflowInputValidation(input.validation, input.type, value) ||
      !base::IsStringUTF8(value) ||
      std::ranges::any_of(value, [](unsigned char c) { return c < 0x20 || c == 0x7f; }) ||
      (!input.is_protected && RedactLocalOiExportText(value).blocked)) {
    return false;
  }
  if (value.empty()) {
    // A required field may be blank in an unfinished draft. The transition
    // into running enforces completeness; save/restore must retain the field.
    return true;
  }
  if (input.type == "text") {
    return input.is_protected || IsSafeMissionNote(value);
  }
  if (input.type == "date") {
    return IsValidWorkflowDate(value);
  }
  if (input.type == "url") {
    return IsValidWorkflowUrl(value);
  }
  if (input.type == "number") {
    bool seen_digit = false;
    bool seen_decimal = false;
    for (size_t index = 0; index < value.size(); ++index) {
      const char character = value[index];
      if (character >= '0' && character <= '9') {
        seen_digit = true;
      } else if (character == '.' && !seen_decimal) {
        seen_decimal = true;
      } else if ((character == '-' || character == '+') && index == 0u) {
        continue;
      } else {
        return false;
      }
    }
    return seen_digit;
  }
  if (input.type == "boolean") {
    return value == "true" || value == "false";
  }
  return input.type == "selection" &&
         std::find(input.options.begin(), input.options.end(), value) !=
             input.options.end();
}

// Encryption authenticates the run, profile, reviewed revision and complete
// field definition. A copied ciphertext must not satisfy another field/run.
base::DictValue ProtectedInputContext(const Profile& profile,
                                     const MissionSummary& mission,
                                     const MissionWorkflowInput& input) {
  CHECK(mission.operational_workflow);
  const auto& source = *mission.operational_workflow;
  base::DictValue context;
  context.Set("purpose", "tahai.workflow.input.v1");
  context.Set("profile", profile.GetPath().AsUTF8Unsafe());
  context.Set("mission", mission.id);
  context.Set("skin", source.skin_id);
  context.Set("revision", source.archive_sha256);
  context.Set("workflow", source.workflow_id);
  context.Set("input", input.id);
  context.Set("type", input.type);
  context.Set("name", input.name);
  context.Set("required", input.required);
  if (input.validation) context.Set("validation",
      SerializeTahaiWorkflowInputValidation(*input.validation));
  base::ListValue options;
  for (const auto& option : input.options) options.Append(option);
  context.Set("options", std::move(options));
  return context;
}

bool IsProtectedCiphertextShape(std::string_view value) {
  std::string decoded;
  return value.empty() ||
         (value.size() <= 8192 && base::Base64Decode(value, &decoded) &&
          !decoded.empty() && base::Base64Encode(decoded) == value);
}

std::optional<std::string> DecryptProtectedValue(const MissionWorkflowInput& input,
    const base::DictValue& context, const os_crypt_async::Encryptor& encryptor) {
  std::string encrypted;
  if (input.protected_value.empty() ||
      !IsProtectedCiphertextShape(input.protected_value) ||
      !base::Base64Decode(input.protected_value, &encrypted)) return std::nullopt;
  const auto plaintext = encryptor.DecryptData(base::as_byte_span(encrypted));
  if (!plaintext || plaintext->size() > 6144) return std::nullopt;
  auto payload = base::JSONReader::ReadDict(*plaintext, base::JSON_PARSE_RFC);
  const auto* value = payload ? payload->FindString("value") : nullptr;
  if (!value || value->empty() ||
      !IsValidOperationalWorkflowInputValue(input, *value)) return std::nullopt;
  const std::string result = *value;
  payload->Remove("value");
  return *payload == context ? std::make_optional(result) : std::nullopt;
}

bool ValidateProtectedInput(const Profile& profile, const MissionSummary& mission,
                            const MissionWorkflowInput& input,
                            const os_crypt_async::Encryptor& encryptor) {
  return DecryptProtectedValue(input, ProtectedInputContext(profile, mission, input), encryptor).has_value();
}

MissionWorkflowInput VariableInput(const MissionSummary::Variable& variable) {
  const auto& definition = variable.definition;
  MissionWorkflowInput input{definition.id, definition.name,
      std::string(TahaiOperationalWorkflowInputTypeName(definition.type)), false,
      definition.options, variable.value};
  input.is_protected = definition.is_protected;
  input.protected_value = variable.protected_value;
  input.protected_storage_ready = variable.protected_storage_ready;
  input.protected_has_value = variable.protected_has_value;
  input.validation = definition.validation;
  return input;
}

base::DictValue ProtectedVariableContext(const Profile& profile,
    const MissionSummary& mission, const MissionSummary::Variable& variable) {
  auto context = ProtectedInputContext(profile, mission, VariableInput(variable));
  context.Set("purpose", "tahai.workflow.variable.v1");
  context.Remove("input");
  context.Set("variable", variable.definition.id);
  return context;
}

std::optional<MissionWorkflowInput> AssignmentSource(const MissionSummary& mission,
                                                   const TahaiWorkflowAssignment& assignment) {
  if (assignment.expression || assignment.text_expression || assignment.boolean_expression || assignment.from_action_status) return std::nullopt;
  if (assignment.from_variable) {
    const auto origin = std::ranges::find_if(mission.workflow_variables,
        [&assignment](const auto& item) { return item.definition.id == assignment.source_id; });
    if (origin != mission.workflow_variables.end()) return VariableInput(*origin);
  } else {
    const auto origin = std::ranges::find(mission.workflow_inputs, assignment.source_id, &MissionWorkflowInput::id);
    if (origin != mission.workflow_inputs.end()) return *origin;
  }
  return std::nullopt;
}

std::optional<MissionWorkflowInput> ConditionSource(const MissionStep& step,
    const std::vector<MissionWorkflowInput>& inputs,
    const std::vector<MissionSummary::Variable>& variables) {
  if (step.condition_from_variable) {
    const auto item = std::ranges::find_if(variables, [&step](const auto& variable) {
      return variable.definition.id == step.condition_input_id;
    });
    if (item != variables.end()) return VariableInput(*item);
  } else {
    const auto item = std::ranges::find(inputs, step.condition_input_id, &MissionWorkflowInput::id);
    if (item != inputs.end()) return *item;
  }
  return std::nullopt;
}

bool RecordsCondition(const MissionStep& step) {
  return step.condition_from_variable || step.predicate.has_value();
}

bool ConditionUsesInput(const MissionStep& step, std::string_view id) {
  return step.predicate ? TahaiWorkflowPredicateUsesSource(*step.predicate, false, id) :
      !step.condition_from_variable && step.condition_input_id == id;
}

bool ValidConditionLeaf(const MissionWorkflowInput& input, const TahaiWorkflowPredicate& leaf) {
  if (input.is_protected) return false;
  if (leaf.compare) return input.type == "number";
  return input.type == "boolean" ? leaf.equals == "true" || leaf.equals == "false" :
      input.type == "selection" && std::ranges::find(input.options, leaf.equals) != input.options.end();
}

// Branches admit ordinary boolean/selection equality or a closed numeric
// comparison. Protected values and arbitrary expressions cannot become a
// predicate through profile preferences. Definitions are revalidated on use.
bool HasValidOperationalWorkflowConditions(
    const std::vector<MissionStep>& steps,
    const std::vector<MissionWorkflowInput>& inputs,
    const std::vector<MissionSummary::Variable>& variables) {
  bool unrecorded_branch_seen = false;
  for (const MissionStep& step : steps) {
    unrecorded_branch_seen |= RecordsCondition(step) && !step.variable_condition_result;
    if (unrecorded_branch_seen && (step.complete ||
        (step.requires_native_action && step.action_state != "ready") ||
        (step.wait_seconds && step.wait_state != "ready"))) return false;
    if ((!RecordsCondition(step) && step.variable_condition_result) ||
        (RecordsCondition(step) && (step.complete ||
            (step.requires_native_action && step.action_state != "ready") ||
            (step.wait_seconds && step.wait_state != "ready")) && step.variable_condition_result != true)) return false;
    if (step.predicate) {
      if (step.predicate->operation.empty() || !step.condition_input_id.empty() || !step.condition_equals.empty() ||
          step.numeric_condition || step.condition_from_variable ||
          !CheckTahaiWorkflowPredicate(*step.predicate, [&](const TahaiWorkflowPredicate& leaf) {
            MissionStep source; source.condition_input_id = leaf.source_id; source.condition_from_variable = leaf.from_variable;
            const auto input = ConditionSource(source, inputs, variables);
            return input && ValidConditionLeaf(*input, leaf);
          })) return false;
      continue;
    }
    if (step.condition_input_id.empty()) {
      if (!step.condition_equals.empty() || step.numeric_condition || step.condition_from_variable || step.variable_condition_result) {
        return false;
      }
      continue;
    }
    const auto input = ConditionSource(step, inputs, variables);
    if (!input || input->is_protected) {
      return false;
    }
    if (step.numeric_condition) {
      if (input->type != "number" || !step.condition_equals.empty() ||
          !IsValidTahaiWorkflowNumericCondition(*step.numeric_condition)) return false;
      continue;
    }
    if (input->type == "boolean") {
      if (step.condition_equals != "true" && step.condition_equals != "false") {
        return false;
      }
      continue;
    }
    if (input->type != "selection" ||
        std::find(input->options.begin(), input->options.end(),
                  step.condition_equals) == input->options.end()) {
      return false;
    }
  }
  return true;
}

std::optional<bool> OperationalConditionResult(const MissionSummary& mission,
                                              const MissionStep& step) {
  if (RecordsCondition(step) && step.variable_condition_result) return step.variable_condition_result;
  if (step.predicate) return EvaluateTahaiWorkflowPredicate(*step.predicate, [&](const TahaiWorkflowPredicate& leaf) -> std::optional<bool> {
    MissionStep source; source.condition_input_id = leaf.source_id; source.condition_from_variable = leaf.from_variable;
    source.condition_equals = leaf.equals; source.numeric_condition = leaf.compare;
    return OperationalConditionResult(mission, source);
  });
  if (step.condition_input_id.empty()) {
    return true;
  }
  const auto input = ConditionSource(step, mission.workflow_inputs, mission.workflow_variables);
  if (!input || input->is_protected || input->value.empty() ||
      !IsValidOperationalWorkflowInputValue(*input, input->value)) return std::nullopt;
  if (step.numeric_condition) {
    double number = 0;
    return input->type == "number" && IsValidOperationalWorkflowInputValue(*input, input->value) &&
        base::StringToDouble(input->value, &number) &&
        CompareTahaiWorkflowNumber(number, *step.numeric_condition).value_or(false);
  }
  return input->value == step.condition_equals;
}

bool IsOperationalStepAvailable(const MissionSummary& mission, const MissionStep& step) {
  return OperationalConditionResult(mission, step).value_or(false);
}

bool HasUnresolvedConditionThrough(const MissionSummary& mission, size_t index) {
  for (size_t i = 0; i <= index && i < mission.steps.size(); ++i)
    if (!OperationalConditionResult(mission, mission.steps[i]).has_value()) return true;
  return false;
}

bool HasUnrecordedCondition(const MissionSummary& mission) {
  return std::ranges::any_of(mission.steps, [](const auto& step) {
    return RecordsCondition(step) && !step.variable_condition_result;
  });
}

// Freeze decisions before changing variables or recording an effect. Later
// assignments cannot insert skipped work behind that effect. Reopening an
// ordinary checkpoint never erases an already consumed variable/compound decision.
void FreezeRecordedConditionsThrough(MissionSummary& mission, size_t index) {
  for (size_t i = 0; i <= index && i < mission.steps.size(); ++i) {
    auto& step = mission.steps[i];
    if (RecordsCondition(step) && !step.variable_condition_result)
      step.variable_condition_result = OperationalConditionResult(mission, step);
  }
}

bool MatchesGeneratedStepEvent(std::string_view detail,
                               std::string_view prefix,
                               const std::vector<MissionStep>& steps) {
  for (const MissionStep& step : steps) {
    if (detail == base::StrCat({prefix, " completed: ", step.label}) ||
        detail == base::StrCat({prefix, " reopened: ", step.label})) {
      return true;
    }
  }
  return false;
}

bool IsGeneratedTimelineDetail(const MissionSummary& mission,
                               std::string_view kind,
                               std::string_view detail) {
  if (kind == "mission") {
    return detail == "Mission created" || detail == "Mission loaded" ||
           detail == "Mission archived" || detail == "Mission restored" ||
           (mission.operational_workflow &&
            (detail == "Operational workflow created" ||
             detail == "Operational workflow loaded" ||
             IsOperationalWorkflowStateEvent(detail)));
  }
  if (kind == "runbook") {
    return detail == "Operator escalation marked required" ||
           detail == "Operator escalation marked cleared" ||
           detail == "Profile-local mission note added" ||
           (mission.operational_workflow &&
            (detail == "Native workflow action pending" ||
             detail == "Local workflow wait started" ||
             detail == "Local workflow wait resumed" ||
             detail == "Local workflow wait timed out" ||
             detail == "Native workflow action dispatched" ||
             detail == "Native workflow action rejected" ||
             detail == "Native workflow action deadline exceeded; outcome unknown" ||
             detail == "Native workflow action unknown")) ||
           MatchesGeneratedStepEvent(detail, "Checkpoint", mission.steps);
  }
  if (kind == "validation") {
    return MatchesGeneratedStepEvent(detail, "Validation",
                                     mission.validation_steps);
  }
  if (kind == "rollback") {
    return MatchesGeneratedStepEvent(detail, "Rollback",
                                     mission.rollback_steps) ||
           (mission.operational_workflow &&
            MatchesGeneratedStepEvent(detail, "Recovery review", mission.rollback_steps));
  }
  if (kind == "evidence") {
    return detail == "Evidence marker added";
  }
  return kind == "export" && detail == "Export profile selected";
}

void AppendGeneratedEvent(MissionSummary* mission,
                          std::string_view kind,
                          std::string detail) {
  CHECK(mission);
  CHECK(IsAllowedTimelineKind(kind));
  const std::string now = NowAsWindowsEpochMicros();
  const std::string previous_hash = mission->timeline.empty()
                                        ? std::string()
                                        : mission->timeline.front().entry_hash;
  MissionEvent event{std::string(kind), std::move(detail), now, previous_hash,
                     std::string()};
  event.entry_hash = LedgerHash(mission->id, event.kind, event.detail,
                                event.created_at, event.previous_hash);
  mission->timeline.insert(mission->timeline.begin(), std::move(event));
  if (mission->timeline.size() > kMaximumTimelineEvents) {
    mission->timeline.resize(kMaximumTimelineEvents);
  }
  mission->updated_at = now;
  mission->mutation_token = base::Uuid::GenerateRandomV4().AsLowercaseString();
}

bool ToggleGeneratedStep(MissionSummary* mission,
                         std::vector<MissionStep>* steps,
                         size_t step_index,
                         std::string_view timeline_kind,
                         std::string_view label) {
  if (!mission || !steps || step_index >= steps->size()) {
    return false;
  }
  const bool recovery_review = steps == &mission->rollback_steps && CanReviewMissionRecovery(*mission);
  if (mission->operational_workflow &&
      ((!recovery_review && mission->operational_workflow->run_state != "running") ||
       !HasValidOperationalWorkflowConditions(mission->steps, mission->workflow_inputs, mission->workflow_variables))) {
    return false;
  }
  MissionStep& step = (*steps)[step_index];
  if (step.assignment || step.wait_seconds || (recovery_review && step.requires_native_action)) return false;
  if (step.requires_native_action && step.action_state != "dispatched") {
    return false;
  }
  if (!step.complete && !IsOperationalStepAvailable(*mission, step)) {
    return false;
  }
  if (steps == &mission->steps && !step.complete) {
    if (HasUnresolvedConditionThrough(*mission, step_index)) return false;
    FreezeRecordedConditionsThrough(*mission, step_index);
  }
  step.complete = !step.complete;
  AppendGeneratedEvent(
      mission, timeline_kind,
      base::StrCat(
          {label, step.complete ? " completed: " : " reopened: ", step.label}));
  return true;
}

bool IsValidId(std::string_view id) {
  return base::Uuid::ParseLowercase(id).is_valid();
}

}  // namespace

bool IsMissionWorkflowInputRequired(const MissionSummary& mission,
                                    const MissionWorkflowInput& input) {
  return input.required ||
         std::ranges::any_of(mission.steps, [&input](const MissionStep& step) {
           return ConditionUsesInput(step, input.id);
         });
}

bool CanReviewMissionRecovery(const MissionSummary& mission) {
  if (mission.archived || !mission.operational_workflow ||
      (mission.operational_workflow->run_state != "failed" &&
       mission.operational_workflow->run_state != "cancelled")) return false;
  // Cancellation is not proof that a previously dispatched effect did not
  // happen. Wait for its bounded result/unknown state before recording review.
  return std::ranges::none_of(mission.steps, [](const auto& step) {
           return step.action_state == "pending" || step.wait_state == "waiting";
         }) && HasValidMissionWorkflowVariables(mission) &&
         HasValidMissionWorkflowWaits(mission) &&
         HasValidOperationalWorkflowConditions(mission.steps, mission.workflow_inputs, mission.workflow_variables);
}

bool HasMissionWorkflowInputValue(const MissionWorkflowInput& input) {
  return input.is_protected
      ? input.protected_storage_ready && input.protected_has_value
      : !input.value.empty();
}

bool CanBeginMissionNativeStep(const MissionSummary& mission, size_t index) {
  if (mission.archived || !mission.operational_workflow ||
      mission.operational_workflow->adapter_version != 1 ||
      mission.operational_workflow->run_state != "running" ||
      !HasValidMissionWorkflowVariables(mission) || !HasValidMissionWorkflowWaits(mission) ||
      !HasValidOperationalWorkflowConditions(mission.steps, mission.workflow_inputs, mission.workflow_variables) ||
      index >= mission.steps.size() || mission.steps[index].complete ||
      !mission.steps[index].requires_native_action ||
      mission.steps[index].action_state != "ready" ||
      mission.steps[index].native_action_started || !mission.steps[index].native_action_error.empty() ||
      !IsOperationalStepAvailable(mission, mission.steps[index]) ||
      HasUnresolvedConditionThrough(mission, index) ||
      std::ranges::any_of(mission.workflow_inputs, [&mission](const auto& input) {
        return !IsValidOperationalWorkflowInputValue(input, input.value) ||
               (!HasMissionWorkflowInputValue(input) && IsMissionWorkflowInputRequired(mission, input));
      }) || std::ranges::any_of(mission.steps, [](const auto& step) {
        return step.action_state == "pending";
      })) {
    return false;
  }
  // Earlier applicable checkpoints must be reviewed before the next command.
  for (size_t previous = 0; previous < index; ++previous) {
    if (IsOperationalStepAvailable(mission, mission.steps[previous]) &&
        !mission.steps[previous].complete) {
      return false;
    }
  }
  return true;
}

std::optional<int> MissionWorkflowNativeTimeRemaining(const MissionStep& step) {
  if (!step.requires_native_action || step.action_state != "pending" ||
      !step.native_action_started || step.complete || !step.native_action_error.empty()) return std::nullopt;
  const auto now = base::TimeTicks::Now();
  if (now < *step.native_action_started) return std::nullopt;
  return static_cast<int>(std::max<int64_t>(0,
      (kMissionNativeAttemptTimeout - (now - *step.native_action_started)).InMillisecondsRoundedUp()));
}

namespace {
TahaiWorkflowCalculationResult CalculateAssignment(const MissionSummary& mission,
                                                    const TahaiWorkflowAssignment& assignment) {
  if (!assignment.expression) return {{}, "invalid-expression"};
  return EvaluateTahaiWorkflowNumericExpression(*assignment.expression,
      [&](std::string_view id, bool variable) -> std::optional<double> {
        std::optional<MissionWorkflowInput> input;
        if (variable) {
          const auto item = std::ranges::find_if(mission.workflow_variables,
              [id](const auto& item) { return item.definition.id == id; });
          if (item != mission.workflow_variables.end()) input = VariableInput(*item);
        } else {
          const auto item = std::ranges::find(mission.workflow_inputs, id, &MissionWorkflowInput::id);
          if (item != mission.workflow_inputs.end() && !item->is_protected) input = *item;
        }
        if (!input || input->is_protected || input->type != "number" || input->value.empty() ||
            !IsValidOperationalWorkflowInputValue(*input, input->value)) return std::nullopt;
        double value = 0;
        if (!base::StringToDouble(input->value, &value)) return std::numeric_limits<double>::infinity();
        return value;
      });
}

TahaiWorkflowTextResult CalculateTextAssignment(const MissionSummary& mission,
                                               const TahaiWorkflowAssignment& assignment) {
  if (!assignment.text_expression) return {{}, "invalid-expression"};
  return EvaluateTahaiWorkflowTextExpression(*assignment.text_expression,
      [&](std::string_view id, bool variable) -> std::optional<std::string> {
        std::optional<MissionWorkflowInput> input;
        if (variable) {
          const auto item = std::ranges::find_if(mission.workflow_variables,
              [id](const auto& item) { return item.definition.id == id; });
          if (item != mission.workflow_variables.end()) input = VariableInput(*item);
        } else {
          const auto item = std::ranges::find(mission.workflow_inputs, id, &MissionWorkflowInput::id);
          if (item != mission.workflow_inputs.end()) input = *item;
        }
        if (!input || input->is_protected || input->type != "text" || input->value.empty() ||
            !IsValidOperationalWorkflowInputValue(*input, input->value)) return std::nullopt;
        return input->value;
      });
}

std::optional<std::string> AssignmentValue(const MissionSummary& mission,
                                          const TahaiWorkflowAssignment& assignment) {
  if (assignment.boolean_expression) {
    MissionStep condition;
    condition.predicate = assignment.boolean_expression;
    const auto result = OperationalConditionResult(mission, condition);
    if (!result) return std::nullopt;
    return *result ? "true" : "false";
  }
  if (assignment.from_action_status) {
    const auto origin = std::ranges::find(mission.steps, assignment.source_id, &MissionStep::workflow_step_id);
    if (origin != mission.steps.end() && origin->requires_native_action &&
        (origin->action_state == "dispatched" || origin->action_state == "rejected" || origin->action_state == "unknown"))
      return origin->action_state;
    return std::nullopt;
  }
  if (assignment.text_expression) return CalculateTextAssignment(mission, assignment).value;
  if (assignment.expression) {
    const auto result = CalculateAssignment(mission, assignment);
    return result.value ? FormatTahaiWorkflowCalculation(*result.value) : std::nullopt;
  }
  if (assignment.from_variable) {
    const auto origin = std::ranges::find_if(mission.workflow_variables,
        [&assignment](const auto& item) { return item.definition.id == assignment.source_id; });
    if (origin != mission.workflow_variables.end() && !origin->definition.is_protected) return origin->value;
  } else {
    const auto origin = std::ranges::find(mission.workflow_inputs, assignment.source_id,
                                         &MissionWorkflowInput::id);
    if (origin != mission.workflow_inputs.end() && !origin->is_protected &&
        IsValidOperationalWorkflowInputValue(*origin, origin->value)) return origin->value;
  }
  return std::nullopt;
}
}  // namespace

bool IsMissionWorkflowStepConditionSatisfied(const MissionSummary& mission, size_t index) {
  return index < mission.steps.size() &&
      HasValidOperationalWorkflowConditions(mission.steps, mission.workflow_inputs, mission.workflow_variables) &&
      IsOperationalStepAvailable(mission, mission.steps[index]);
}

bool IsMissionWorkflowStepConditionResolved(const MissionSummary& mission, size_t index) {
  return index < mission.steps.size() &&
      HasValidOperationalWorkflowConditions(mission.steps, mission.workflow_inputs, mission.workflow_variables) &&
      OperationalConditionResult(mission, mission.steps[index]).has_value();
}

bool HasValidMissionWorkflowVariables(const MissionSummary& mission) {
  std::vector<TahaiOperationalWorkflowInput> variables;
  for (const auto& variable : mission.workflow_variables) {
    if (!IsValidOperationalWorkflowInputValue(VariableInput(variable), variable.value) ||
        (variable.definition.is_protected ? !variable.value.empty() || !IsProtectedCiphertextShape(variable.protected_value) :
         !variable.protected_value.empty())) return false;
    variables.push_back(variable.definition);
  }
  base::Value encoded(SerializeTahaiWorkflowVariables(variables));
  std::vector<TahaiOperationalWorkflowInput> checked;
  if (!ParseTahaiWorkflowVariables(&encoded, &checked) || variables != checked) return false;
  for (const auto& step : mission.steps) {
    if (!step.assignment) continue;
    if (!mission.operational_workflow || mission.operational_workflow->adapter_version != 1 ||
        step.requires_native_action || !step.action_state.empty()) return false;
    const auto& assignment = *step.assignment;
    const auto target = std::ranges::find(variables, assignment.variable_id,
                                         &TahaiOperationalWorkflowInput::id);
    if (target == variables.end()) return false;
    if (assignment.from_action_status) {
      const auto origin = std::ranges::find(mission.steps, assignment.source_id, &MissionStep::workflow_step_id);
      if (!ValidateTahaiWorkflowAssignment(assignment, {}, variables) || origin == mission.steps.end() ||
          !origin->requires_native_action || &*origin >= &step ||
          std::ranges::count(mission.steps, assignment.source_id, &MissionStep::workflow_step_id) != 1) return false;
    } else if (assignment.expression || assignment.text_expression || assignment.boolean_expression) {
      std::vector<TahaiOperationalWorkflowInput> inputs;
      for (const auto& input : mission.workflow_inputs) {
        // Retain the exact wire type; dates/URLs/unknown values must never be
        // treated as booleans (or implicitly converted for any calculation).
        std::optional<TahaiOperationalWorkflowInputType> type;
        for (const auto candidate : {TahaiOperationalWorkflowInputType::kText,
             TahaiOperationalWorkflowInputType::kNumber, TahaiOperationalWorkflowInputType::kBoolean,
             TahaiOperationalWorkflowInputType::kSelection, TahaiOperationalWorkflowInputType::kDate,
             TahaiOperationalWorkflowInputType::kUrl}) {
          if (TahaiOperationalWorkflowInputTypeName(candidate) == input.type) type = candidate;
        }
        if (!type) return false;
        TahaiOperationalWorkflowInput definition{input.id, input.name, *type, input.required, input.options};
        definition.is_protected = input.is_protected;
        definition.validation = input.validation;
        inputs.push_back(std::move(definition));
      }
      if (!ValidateTahaiWorkflowAssignment(assignment, inputs, variables)) return false;
    } else if (assignment.from_variable) {
      if (!ValidateTahaiWorkflowAssignment(assignment, {}, variables)) return false;
    } else {
      const auto origin = std::ranges::find(mission.workflow_inputs, assignment.source_id,
                                           &MissionWorkflowInput::id);
      if (origin == mission.workflow_inputs.end() || (origin->is_protected && !target->is_protected) ||
          origin->type != TahaiOperationalWorkflowInputTypeName(target->type) ||
          !IsSafeOperationalIdentifier(assignment.source_id) ||
          std::ranges::count(mission.workflow_inputs, assignment.source_id, &MissionWorkflowInput::id) != 1)
        return false;
    }
  }
  return true;
}

std::string_view MissionWorkflowCalculationError(const MissionSummary& mission, size_t index) {
  if (index >= mission.steps.size() || !mission.steps[index].assignment ||
      (!mission.steps[index].assignment->expression && !mission.steps[index].assignment->text_expression &&
       !mission.steps[index].assignment->boolean_expression)) return {};
  if (!HasValidMissionWorkflowVariables(mission)) return "invalid-expression";
  const auto& assignment = *mission.steps[index].assignment;
  if (assignment.boolean_expression)
    return AssignmentValue(mission, assignment) ? std::string_view() : "missing-condition-value";
  std::optional<std::string> text;
  if (assignment.text_expression) {
    const auto result = CalculateTextAssignment(mission, assignment);
    if (!result.value) return result.error;
    text = result.value;
  } else {
    const auto result = CalculateAssignment(mission, assignment);
    if (!result.value) return result.error;
    text = FormatTahaiWorkflowCalculation(*result.value);
  }
  if (!text) return "result-too-long";
  const auto target = std::ranges::find_if(mission.workflow_variables,
      [&assignment](const auto& item) { return item.definition.id == assignment.variable_id; });
  if (target == mission.workflow_variables.end() ||
      !IsValidOperationalWorkflowInputValue(VariableInput(*target), *text)) return "target-constraint";
  return {};
}

bool CanAssignMissionWorkflowVariable(const MissionSummary& mission, size_t index) {
  if (mission.archived || !mission.operational_workflow ||
      mission.operational_workflow->adapter_version != 1 ||
      mission.operational_workflow->run_state != "running" ||
      index >= mission.steps.size() || mission.steps[index].complete ||
      !mission.steps[index].assignment || !HasValidMissionWorkflowVariables(mission) ||
      !HasValidMissionWorkflowWaits(mission) ||
      !HasValidOperationalWorkflowConditions(mission.steps, mission.workflow_inputs, mission.workflow_variables) ||
      !IsOperationalStepAvailable(mission, mission.steps[index]) ||
      HasUnresolvedConditionThrough(mission, index) ||
      std::ranges::any_of(mission.steps, [](const auto& step) { return step.action_state == "pending"; }) ||
      std::ranges::any_of(mission.workflow_inputs, [&mission](const auto& input) {
        return !IsValidOperationalWorkflowInputValue(input, input.value) ||
               (IsMissionWorkflowInputRequired(mission, input) && !HasMissionWorkflowInputValue(input));
      })) return false;
  for (size_t previous = 0; previous < index; ++previous) {
    if (IsOperationalStepAvailable(mission, mission.steps[previous]) &&
        !mission.steps[previous].complete) return false;
  }
  const auto& assignment = *mission.steps[index].assignment;
  const auto value = AssignmentValue(mission, assignment);
  const auto target = std::ranges::find_if(mission.workflow_variables,
      [&assignment](const auto& item) { return item.definition.id == assignment.variable_id; });
  if (target == mission.workflow_variables.end()) return false;
  const auto origin = AssignmentSource(mission, assignment);
  if (origin && origin->is_protected) {
    // Bounds on decrypted text are checked transactionally in the service.
    // A locked/corrupt nonempty source can never be mistaken for a clear.
    return target->definition.is_protected && origin->value.empty() &&
        IsProtectedCiphertextShape(origin->protected_value) &&
        (origin->protected_value.empty() || (origin->protected_storage_ready && origin->protected_has_value && target->protected_storage_ready &&
            (target->protected_value.empty() || target->protected_has_value)));
  }
  // A blank source explicitly clears an optional variable; there is no default
  // or conversion. Target constraints are evaluated before any state changes.
  return value && (!target->definition.is_protected || value->empty() || (target->protected_storage_ready &&
      (target->protected_value.empty() || target->protected_has_value))) &&
         IsValidOperationalWorkflowInputValue(VariableInput(*target), *value);
}

namespace {
std::optional<int> WaitClockRemaining(const MissionStep& step, int seconds, int milliseconds) {
  if (seconds < 1 || seconds > 86400 || milliseconds < 0 || milliseconds > seconds * 1000)
    return std::nullopt;
  if (step.wait_state != "waiting") {
    if (step.wait_started || (step.wait_state != "ready" && step.wait_state != "paused" &&
                              step.wait_state != "complete" && step.wait_state != "timed-out")) return std::nullopt;
    return milliseconds;
  }
  const auto now = base::TimeTicks::Now();
  if (!step.wait_started || now < *step.wait_started) return std::nullopt;
  const auto remaining = base::Milliseconds(milliseconds) -
                         (now - *step.wait_started);
  return static_cast<int>(std::max<int64_t>(0, remaining.InMillisecondsRoundedUp()));
}
}  // namespace

std::optional<int> MissionWorkflowWaitRemaining(const MissionStep& step) {
  return WaitClockRemaining(step, step.wait_seconds, step.wait_remaining_ms);
}

std::optional<int> MissionWorkflowWaitTimeoutRemaining(const MissionStep& step) {
  if (step.wait_timeout_seconds <= step.wait_seconds) return std::nullopt;
  return WaitClockRemaining(step, step.wait_timeout_seconds, step.wait_timeout_remaining_ms);
}

bool IsMissionWorkflowInputBranchLocked(const MissionSummary& mission,
                                       std::string_view input_id) {
  bool branch_reached = false;
  for (const auto& step : mission.steps) {
    branch_reached = branch_reached || ConditionUsesInput(step, input_id);
    // Compound decisions remain recorded even after reopening checkpoints.
    if (ConditionUsesInput(step, input_id) && step.predicate && step.variable_condition_result) return true;
    // A skipped branch is also consumed when subsequent work has started.
    // Otherwise editing its answer could insert an action behind a recorded
    // checkpoint or external attempt. Earlier work does not lock later choices.
    if (branch_reached && (step.complete || (step.wait_seconds && step.wait_state != "ready") ||
        (step.requires_native_action && step.action_state != "ready"))) return true;
  }
  return false;
}

bool HasValidMissionWorkflowWaits(const MissionSummary& mission) {
  size_t active = 0;
  for (const auto& step : mission.steps) {
    if (!step.wait_seconds) {
      if (step.wait_remaining_ms || !step.wait_state.empty() || step.wait_started ||
          step.wait_timeout_seconds || step.wait_timeout_remaining_ms) return false;
      continue;
    }
    if (!mission.operational_workflow || mission.operational_workflow->adapter_version != 1 ||
        step.requires_native_action || step.assignment || !step.action_state.empty() ||
        !MissionWorkflowWaitRemaining(step) || step.complete != (step.wait_state == "complete") ||
        (step.wait_state == "complete" && step.wait_remaining_ms != 0) ||
        (step.wait_state == "ready" && step.wait_remaining_ms != step.wait_seconds * 1000)) return false;
    if (step.wait_timeout_seconds) {
      const auto timeout = MissionWorkflowWaitTimeoutRemaining(step);
      if (!timeout || step.wait_timeout_remaining_ms < step.wait_remaining_ms ||
          (step.wait_state == "ready" && step.wait_timeout_remaining_ms != step.wait_timeout_seconds * 1000) ||
          (step.wait_state == "complete" && step.wait_timeout_remaining_ms != 0) ||
          (step.wait_state == "paused" && *timeout == 0)) return false;
    } else if (step.wait_timeout_remaining_ms || step.wait_state == "timed-out") return false;
    if (step.wait_state == "timed-out" &&
        (step.wait_remaining_ms || step.wait_timeout_remaining_ms ||
         mission.operational_workflow->run_state != "failed")) return false;
    if (step.wait_state == "waiting") {
      if (mission.archived || mission.operational_workflow->run_state != "running" || ++active > 1u) return false;
    }
  }
  return true;
}

bool CanControlMissionWorkflowWait(const MissionSummary& mission, size_t index, bool complete) {
  if (mission.archived || !mission.operational_workflow ||
      mission.operational_workflow->adapter_version != 1 ||
      mission.operational_workflow->run_state != "running" || index >= mission.steps.size() ||
      !HasValidMissionWorkflowWaits(mission) || !HasValidMissionWorkflowVariables(mission) ||
      !HasValidOperationalWorkflowConditions(mission.steps, mission.workflow_inputs, mission.workflow_variables) ||
      !mission.steps[index].wait_seconds || mission.steps[index].complete ||
      !IsOperationalStepAvailable(mission, mission.steps[index]) ||
      HasUnresolvedConditionThrough(mission, index) ||
      std::ranges::any_of(mission.steps, [](const auto& step) { return step.action_state == "pending"; }) ||
      std::ranges::any_of(mission.workflow_inputs, [&mission](const auto& input) {
        return !IsValidOperationalWorkflowInputValue(input, input.value) ||
               (IsMissionWorkflowInputRequired(mission, input) && !HasMissionWorkflowInputValue(input));
      })) return false;
  for (size_t previous = 0; previous < index; ++previous) {
    if (IsOperationalStepAvailable(mission, mission.steps[previous]) && !mission.steps[previous].complete) return false;
  }
  const auto& step = mission.steps[index];
  if (step.wait_timeout_seconds && MissionWorkflowWaitTimeoutRemaining(step).value_or(0) == 0) return false;
  return complete ? step.wait_state == "waiting" && MissionWorkflowWaitRemaining(step) == 0
                  : (step.wait_state == "ready" || step.wait_state == "paused") &&
                      std::ranges::none_of(mission.steps, [](const auto& item) { return item.wait_state == "waiting"; });
}

namespace {
void MarkWaitTimedOut(MissionSummary& mission, MissionStep& step) {
  step.wait_state = "timed-out";
  step.wait_remaining_ms = step.wait_timeout_remaining_ms = 0;
  step.wait_started.reset();
  step.complete = false;
  mission.operational_workflow->run_state = "failed";
  AppendGeneratedEvent(&mission, "runbook", "Local workflow wait timed out");
}

bool SuspendMissionWaits(MissionSummary& mission) {
  bool changed = false;
  for (auto& step : mission.steps) {
    if (step.wait_state != "waiting") continue;
    const auto remaining = MissionWorkflowWaitRemaining(step);
    const auto timeout = MissionWorkflowWaitTimeoutRemaining(step);
    if (timeout == 0 && mission.operational_workflow) {
      MarkWaitTimedOut(mission, step);
      changed = true;
      continue;
    }
    if (remaining) step.wait_remaining_ms = *remaining;
    if (timeout) step.wait_timeout_remaining_ms = *timeout;
    step.wait_state = remaining ? "paused" : "invalid";
    step.wait_started.reset();
    changed = true;
  }
  return changed;
}

void CloseUncertainNativeAttempt(MissionSummary& mission, MissionStep& step, bool expired) {
  step.action_state = "unknown";
  step.complete = false;
  step.native_action_started.reset();
  step.native_action_error = expired ? "deadline-exceeded" : "";
  if (mission.operational_workflow && mission.operational_workflow->run_state != "cancelled")
    mission.operational_workflow->run_state = "failed";
  AppendGeneratedEvent(&mission, "runbook", expired
      ? "Native workflow action deadline exceeded; outcome unknown" : "Native workflow action unknown");
}
}  // namespace

std::optional<MissionWorkflowOutputValue> ResolveMissionWorkflowOutput(
    const MissionSummary& mission, std::string_view output_id) {
  if (!mission.operational_workflow ||
      mission.operational_workflow->run_state != "succeeded" ||
      HasUnrecordedCondition(mission) ||
      !HasValidMissionWorkflowVariables(mission) ||
      !HasValidMissionWorkflowWaits(mission) ||
      !HasValidOperationalWorkflowConditions(mission.steps, mission.workflow_inputs, mission.workflow_variables) ||
      HasUnresolvedConditionThrough(mission, mission.steps.size()) ||
      std::ranges::any_of(mission.workflow_inputs, [&mission](const auto& input) {
        return !IsValidOperationalWorkflowInputValue(input, input.value) ||
               (input.is_protected && !input.value.empty()) ||
               (IsMissionWorkflowInputRequired(mission, input) &&
                (input.is_protected ? input.protected_value.empty() : input.value.empty()));
      }) ||
      std::ranges::any_of(mission.steps, [&mission](const auto& step) {
        return IsOperationalStepAvailable(mission, step) &&
               (!step.complete || (step.requires_native_action && step.action_state != "dispatched"));
      })) return std::nullopt;
  std::vector<std::string_view> input_ids;
  for (const auto& input : mission.workflow_inputs) input_ids.push_back(input.id);
  std::vector<std::string_view> variable_ids;
  for (const auto& variable : mission.workflow_variables) variable_ids.push_back(variable.definition.id);
  if (!ValidateTahaiWorkflowOutputs(mission.workflow_outputs, input_ids, variable_ids)) return std::nullopt;
  const auto output = std::ranges::find(mission.workflow_outputs, output_id,
                                       &TahaiOperationalWorkflowOutput::id);
  if (output == mission.workflow_outputs.end()) return std::nullopt;
  if (output->from_variable) {
    const auto variable = std::ranges::find_if(mission.workflow_variables,
        [&output](const auto& item) { return item.definition.id == output->input_id; });
    if (variable == mission.workflow_variables.end()) return std::nullopt;
    const auto input = VariableInput(*variable);
    const bool has_value = HasMissionWorkflowInputValue(input);
    return MissionWorkflowOutputValue{
        input.type, input.is_protected, has_value,
        input.is_protected && !input.protected_value.empty() && !has_value,
        input.is_protected ? std::string() : input.value};
  }
  const auto input = std::ranges::find(mission.workflow_inputs, output->input_id,
                                      &MissionWorkflowInput::id);
  if (input == mission.workflow_inputs.end() ||
      (input->is_protected && !input->value.empty()) ||
      !IsValidOperationalWorkflowInputValue(*input, input->value)) return std::nullopt;
  MissionWorkflowOutputValue result;
  result.type = input->type;
  result.is_protected = input->is_protected;
  result.has_value = HasMissionWorkflowInputValue(*input);
  result.unavailable = input->is_protected && !input->protected_value.empty() && !result.has_value;
  if (!input->is_protected) result.value = input->value;
  return result;
}

MissionService::MissionService(Profile* profile)
    : profile_(profile), prefs_(profile->GetPrefs()) {
  CHECK(profile_);
  CHECK(prefs_);
  // An off-the-record profile must not surface the regular profile's mission
  // metadata through its overlay preferences. Its mission session starts
  // empty and remains memory-only.
  if (persistence_enabled()) {
    Load();
  }
}

MissionService::~MissionService() = default;

void MissionService::Shutdown() {
  if (shutting_down_) return;
  if (!SettleWorkflowDeadlines()) {
    return;
  }
  shutting_down_ = true;
  workflow_deadline_timer_.Stop();
  weak_factory_.InvalidateWeakPtrs();
  bool changed = false;
  for (auto& mission : missions_) {
    for (auto& step : mission.steps) {
      if (step.requires_native_action && step.action_state == "pending") {
        CloseUncertainNativeAttempt(mission, step, false);
        changed = true;
      }
    }
    if (!SuspendMissionWaits(mission)) continue;
    changed = true;
    if (mission.operational_workflow && mission.operational_workflow->run_state == "running") {
      mission.operational_workflow->run_state = "paused";
      AppendGeneratedEvent(&mission, "mission", "Operational workflow state: paused");
    }
  }
  if (changed && CanStoreProtectedInputs()) Save();
}

bool MissionService::ExpireWorkflowDeadlines() {
  if (shutting_down_ || !persistence_enabled() || !profile_->IsRegularProfile() ||
      profile_->IsGuestSession() || profile_->IsSystemProfile()) return false;
  bool changed = false;
  for (auto& mission : missions_) {
    if (mission.operational_workflow && mission.operational_workflow->adapter_version == 1) {
      for (auto& step : mission.steps) {
        const auto remaining = MissionWorkflowNativeTimeRemaining(step);
        if (step.requires_native_action && step.action_state == "pending" && remaining.value_or(0) == 0) {
          CloseUncertainNativeAttempt(mission, step, remaining.has_value());
          changed = true;
        }
      }
    }
    if (!CanStoreProtectedInputs() || mission.archived || !mission.operational_workflow ||
        mission.operational_workflow->run_state != "running" ||
        !HasValidMissionWorkflowWaits(mission)) continue;
    for (auto& step : mission.steps) {
      if (step.wait_state != "waiting" || !step.wait_timeout_seconds ||
          MissionWorkflowWaitTimeoutRemaining(step) != 0) continue;
      MarkWaitTimedOut(mission, step);
      changed = true;
      break;
    }
  }
  return changed;
}

void MissionService::ScheduleWorkflowDeadline() {
  workflow_deadline_timer_.Stop();
  if (shutting_down_ || !persistence_enabled() || !profile_->IsRegularProfile() ||
      profile_->IsGuestSession() || profile_->IsSystemProfile()) return;
  std::optional<int> earliest;
  for (const auto& mission : missions_) {
    if (mission.operational_workflow && mission.operational_workflow->adapter_version == 1) {
      for (const auto& step : mission.steps) {
        if (!step.requires_native_action || step.action_state != "pending") continue;
        const int remaining = MissionWorkflowNativeTimeRemaining(step).value_or(0);
        if (!earliest || remaining < *earliest) earliest = remaining;
      }
    }
    if (!CanStoreProtectedInputs() || mission.archived || !mission.operational_workflow ||
        mission.operational_workflow->run_state != "running" || !HasValidMissionWorkflowWaits(mission)) continue;
    for (const auto& step : mission.steps) {
      if (step.wait_state != "waiting" || !step.wait_timeout_seconds) continue;
      const auto remaining = MissionWorkflowWaitTimeoutRemaining(step);
      if (remaining && (!earliest || *remaining < *earliest)) earliest = remaining;
    }
  }
  if (earliest) workflow_deadline_timer_.Start(FROM_HERE, base::Milliseconds(std::max(1, *earliest)),
      this, &MissionService::OnWorkflowDeadline);
}

void MissionService::OnWorkflowDeadline() {
  if (ExpireWorkflowDeadlines()) Save();
  else ScheduleWorkflowDeadline();
}

bool MissionService::SettleWorkflowDeadlines() {
  // Saving an expired attempt synchronously notifies preference observers.
  // They may destroy this service or shut it down before the caller resumes.
  const auto weak = weak_factory_.GetWeakPtr();
  OnWorkflowDeadline();
  return !!weak;
}

bool MissionService::CanMutateStorage() const {
  if (prefs_->IsManagedPreference(prefs::kTahaiMissions)) {
    return false;
  }
  const base::Value* raw = prefs_->GetRawUserPrefValue(prefs::kTahaiMissions);
  // Private sessions are deliberately memory-only; regular profiles must not
  // overwrite a wrong-typed value hidden by PrefService's registered default.
  if (!persistence_enabled()) {
    return true;
  }
  return loaded_storage_writable_ && (!raw || raw->is_list()) &&
         (raw ? loaded_storage_ && *raw == *loaded_storage_ : !loaded_storage_);
}

bool MissionService::CanStoreProtectedInputs() const {
  return persistence_enabled() && profile_->IsRegularProfile() &&
         !profile_->IsGuestSession() && !profile_->IsSystemProfile() &&
         CanMutateStorage();
}

void MissionService::PrepareProtectedWorkflowInputs(
    os_crypt_async::OSCryptAsync* provider,
    base::OnceCallback<void(bool)> callback) {
  if (shutting_down_) { std::move(callback).Run(false); return; }
  if (!provider || !CanStoreProtectedInputs()) {
    OnProtectedInputEncryptor(std::move(callback), nullptr);
    return;
  }
  provider->GetInstance(base::BindOnce(&MissionService::OnProtectedInputEncryptor,
                                     weak_factory_.GetWeakPtr(), std::move(callback)));
}

void MissionService::OnProtectedInputEncryptor(
    base::OnceCallback<void(bool)> callback,
    scoped_refptr<os_crypt_async::Encryptor> encryptor) {
  if (shutting_down_) { std::move(callback).Run(false); return; }
  if (!SettleWorkflowDeadlines()) {
    std::move(callback).Run(false);
    return;
  }
  input_encryptor_ = CanStoreProtectedInputs() && encryptor &&
                             encryptor->IsEncryptionAvailable() &&
                             encryptor->IsDecryptionAvailable()
                         ? std::move(encryptor) : nullptr;
  for (auto& mission : missions_) {
    for (auto& input : mission.workflow_inputs) {
      if (!input.is_protected) continue;
      input.protected_storage_ready = !!input_encryptor_;
      input.protected_has_value = input_encryptor_ && mission.operational_workflow &&
          ValidateProtectedInput(*profile_, mission, input, *input_encryptor_);
    }
    for (auto& variable : mission.workflow_variables) {
      if (!variable.definition.is_protected) continue;
      variable.protected_storage_ready = !!input_encryptor_;
      variable.protected_has_value = input_encryptor_ && mission.operational_workflow &&
          DecryptProtectedValue(VariableInput(variable), ProtectedVariableContext(*profile_, mission, variable),
                                *input_encryptor_).has_value();
    }
    if (mission.operational_workflow && mission.operational_workflow->run_state == "running" &&
        std::ranges::any_of(mission.workflow_inputs, [&mission](const auto& input) {
          return IsMissionWorkflowInputRequired(mission, input) && !HasMissionWorkflowInputValue(input);
        })) {
      SuspendMissionWaits(mission);
      if (mission.operational_workflow->run_state != "failed") {
        mission.operational_workflow->run_state = "waiting-for-input";
        AppendGeneratedEvent(&mission, "mission", "Operational workflow state: waiting-for-input");
      }
    }
  }
  // Never rewrite a ciphertext on failure, nor resume a run after unlocking.
  ScheduleWorkflowDeadline();
  std::move(callback).Run(!!input_encryptor_);
}

bool MissionService::ConsumeQueuedOperationalWorkflow() {
  if (shutting_down_) {
    return false;
  }
  const auto* raw =
      prefs_->GetRawUserPrefValue(prefs::kTahaiPendingOperationalWorkflow);
  if (prefs_->IsManagedPreference(prefs::kTahaiPendingOperationalWorkflow) ||
      (raw && !raw->is_dict())) {
    return false;
  }
  if (!persistence_enabled() ||
      prefs_->GetDict(prefs::kTahaiPendingOperationalWorkflow).empty()) {
    return true;
  }
  const auto queued = GetQueuedOperationalWorkflowLaunch(profile_);
  if (!queued) {
    ClearQueuedOperationalWorkflowLaunch(profile_);
    return false;
  }
  const auto weak = weak_factory_.GetWeakPtr();
  // Consume the launch before any mission notification. A callback must not
  // replay the same launch, including when it destroys this service. Failed
  // creation must not create an unexpected run on a later visit either.
  const bool consumed = ClearQueuedOperationalWorkflowLaunch(profile_);
  if (!weak || !consumed) {
    return false;
  }
  const auto mission = CreateOperationalWorkflowMission(
      queued->workflow, queued->skin_id, queued->archive_sha256,
      queued->adapter_version == 1);
  if (!weak || !mission) {
    return false;
  }
  const bool needs_input = std::ranges::any_of(
      mission->workflow_inputs,
      [&mission](const MissionWorkflowInput& input) {
        return IsMissionWorkflowInputRequired(*mission, input);
      });
  return SetOperationalWorkflowRunState(
      mission->id, needs_input ? "waiting-for-input" : "running");
}

std::optional<MissionSummary> MissionService::CreateMission(
    std::string_view title,
    std::string_view type) {
  if (shutting_down_ || !CanMutateStorage()) {
    return std::nullopt;
  }
  if (!IsSafeTitle(title) || !IsAllowedType(type) ||
      missions_.size() >= kMaximumMissions) {
    return std::nullopt;
  }
  MissionSummary mission;
  mission.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  mission.title = std::string(title);
  mission.type = std::string(type);
  mission.created_at = NowAsWindowsEpochMicros();
  mission.updated_at = mission.created_at;
  mission.steps = DefaultSteps(type);
  mission.validation_steps = DefaultValidationSteps(type);
  mission.rollback_steps = DefaultRollbackSteps(type);
  mission.export_profile = "sanitized-handoff";
  AppendGeneratedEvent(&mission, "mission", "Mission created");
  missions_.push_back(mission);
  Save();
  return mission;
}

std::optional<MissionSummary> MissionService::CreateOperationalWorkflowMission(
    const TahaiOperationalWorkflow& workflow,
    std::string_view skin_id,
    std::string_view archive_sha256,
    bool native_adapter) {
  if (shutting_down_ || !CanMutateStorage() ||
      (native_adapter && !CanStoreProtectedInputs())) {
    return std::nullopt;
  }
  const std::optional<std::vector<MissionStep>> steps =
      OperationalWorkflowSteps(workflow, native_adapter);
  const std::optional<std::vector<MissionWorkflowInput>> inputs =
      OperationalWorkflowInputs(workflow);
  const std::optional<std::vector<MissionStep>> compensation_steps =
      OperationalCompensationSteps(workflow);
  if (std::ranges::any_of(workflow.steps, [](const auto& step) { return step.wait_seconds != 0; }) &&
      (!native_adapter || !CanStoreProtectedInputs() || shutting_down_)) return std::nullopt;
  std::vector<std::string_view> input_ids;
  for (const auto& input : workflow.inputs) input_ids.push_back(input.id);
  base::Value encoded_variables(SerializeTahaiWorkflowVariables(workflow.variables));
  std::vector<TahaiOperationalWorkflowInput> variables;
  if (!ParseTahaiWorkflowVariables(&encoded_variables, &variables) ||
      variables != workflow.variables ||
      (!variables.empty() &&
       (!native_adapter || !persistence_enabled() ||
        !profile_->IsRegularProfile() || profile_->IsGuestSession() ||
        profile_->IsSystemProfile() || !CanMutateStorage()))) {
    return std::nullopt;
  }
  std::vector<std::string_view> variable_ids;
  for (const auto& variable : variables) variable_ids.push_back(variable.id);
  std::vector<MissionSummary::Variable> variable_state;
  for (const auto& variable : variables) variable_state.push_back({variable, {}});
  if (!steps || !inputs || !compensation_steps || !IsSafeOperationalIdentifier(skin_id) ||
      !ValidateTahaiWorkflowOutputs(workflow.outputs, input_ids, variable_ids) ||
      !IsLedgerHash(archive_sha256) ||
      !HasValidOperationalWorkflowConditions(*steps, *inputs, variable_state) ||
      (!CanStoreProtectedInputs() && std::ranges::any_of(*inputs,
          [](const auto& input) { return input.is_protected; })) ||
      missions_.size() >= kMaximumMissions) {
    return std::nullopt;
  }
  MissionSummary mission;
  mission.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  mission.title = workflow.name;
  // A workflow snapshot is a local documentation/checklist Mission. It is not
  // an elevated operation type and never inherits a web origin or authority.
  mission.type = "documentation";
  mission.created_at = NowAsWindowsEpochMicros();
  mission.updated_at = mission.created_at;
  mission.steps = *steps;
  mission.workflow_inputs = *inputs;
  mission.workflow_outputs = workflow.outputs;
  mission.workflow_variables = std::move(variable_state);
  for (auto& variable : mission.workflow_variables) {
    variable.protected_storage_ready = variable.definition.is_protected && input_encryptor_ &&
        input_encryptor_->IsEncryptionAvailable() && input_encryptor_->IsDecryptionAvailable();
  }
  for (auto& input : mission.workflow_inputs) {
    input.protected_storage_ready = input.is_protected && input_encryptor_ &&
        input_encryptor_->IsEncryptionAvailable() && input_encryptor_->IsDecryptionAvailable();
  }
  mission.validation_steps = DefaultValidationSteps(mission.type);
  mission.rollback_steps = compensation_steps->empty()
      ? DefaultRollbackSteps(mission.type) : *compensation_steps;
  mission.export_profile = "sanitized-handoff";
  mission.operational_workflow = OperationalWorkflowSource{
      std::string(skin_id), workflow.id, std::string(archive_sha256), "ready",
      native_adapter ? 1 : 0};
  AppendGeneratedEvent(&mission, "mission", "Operational workflow created");
  missions_.push_back(mission);
  Save();
  return mission;
}

bool MissionService::BeginNativeWorkflowStep(std::string_view id, size_t index,
                                            std::string* pending_token,
                                            std::string_view expected_token) {
  const std::string owned_id(id);
  const auto* reviewed = FindMission(owned_id);
  // Deadline settlement can notify observers before the attempt is opened.
  // Never turn their replacement review into authority for this invocation.
  const std::string reviewed_token =
      expected_token.empty() && reviewed ? reviewed->mutation_token
                                        : std::string(expected_token);
  if (!SettleWorkflowDeadlines()) {
    return false;
  }
  auto* mission = FindMission(owned_id);
  if (shutting_down_ || !CanStoreProtectedInputs() ||
      !mission || mission->mutation_token != reviewed_token ||
      !CanBeginMissionNativeStep(*mission, index)) {
    return false;
  }
  FreezeRecordedConditionsThrough(*mission, index);
  mission->steps[index].action_state = "pending";
  mission->steps[index].native_action_started = base::TimeTicks::Now();
  AppendGeneratedEvent(mission, "runbook", "Native workflow action pending");
  if (pending_token) {
    *pending_token = mission->mutation_token;
  }
  Save();
  return true;
}

bool MissionService::CanContinueNativeWorkflowStep(std::string_view id,
                                                   size_t index) const {
  if (shutting_down_ || !CanStoreProtectedInputs()) {
    return false;
  }
  const auto mission = std::ranges::find(missions_, id, &MissionSummary::id);
  return mission != missions_.end() && !mission->archived &&
         mission->operational_workflow &&
         mission->operational_workflow->adapter_version == 1 &&
         mission->operational_workflow->run_state == "running" &&
         index < mission->steps.size() &&
         mission->steps[index].requires_native_action &&
         mission->steps[index].action_state == "pending" &&
         MissionWorkflowNativeTimeRemaining(mission->steps[index]).value_or(0) > 0;
}

bool MissionService::AssignWorkflowVariable(std::string_view id, size_t index,
                                            std::string_view expected_token) {
  const std::string owned_id(id);
  const std::string reviewed_token(expected_token);
  if (!SettleWorkflowDeadlines()) {
    return false;
  }
  auto* mission = FindMission(owned_id);
  if (shutting_down_ || !persistence_enabled() ||
      !profile_->IsRegularProfile() || profile_->IsGuestSession() ||
      profile_->IsSystemProfile() || !CanMutateStorage() || !mission ||
      (!reviewed_token.empty() && mission->mutation_token != reviewed_token) ||
      !CanAssignMissionWorkflowVariable(*mission, index)) {
    return false;
  }
  const auto& assignment = *mission->steps[index].assignment;
  auto target = std::ranges::find_if(mission->workflow_variables,
      [&assignment](const auto& item) { return item.definition.id == assignment.variable_id; });
  std::optional<std::string> value = AssignmentValue(*mission, assignment);
  const auto origin = AssignmentSource(*mission, assignment);
  if (origin && origin->is_protected) {
    if (!target->definition.is_protected || !origin->value.empty()) return false;
    if (origin->protected_value.empty()) value = std::string();
    else {
      if (!input_encryptor_ || !input_encryptor_->IsDecryptionAvailable()) return false;
      auto context = ProtectedInputContext(*profile_, *mission, *origin);
      if (assignment.from_variable) {
        const auto variable = std::ranges::find_if(mission->workflow_variables,
            [&assignment](const auto& item) { return item.definition.id == assignment.source_id; });
        if (variable == mission->workflow_variables.end()) return false;
        context = ProtectedVariableContext(*profile_, *mission, *variable);
      }
      value = DecryptProtectedValue(*origin, context, *input_encryptor_);
    }
  }
  if (!value || !IsValidOperationalWorkflowInputValue(VariableInput(*target), *value)) return false;
  std::string ciphertext;
  if (target->definition.is_protected && !value->empty()) {
    if (!CanStoreProtectedInputs() || !input_encryptor_ || !input_encryptor_->IsEncryptionAvailable() ||
        !input_encryptor_->IsDecryptionAvailable()) return false;
    auto payload = ProtectedVariableContext(*profile_, *mission, *target);
    payload.Set("value", *value);
    const auto plaintext = base::WriteJson(payload);
    if (!plaintext || plaintext->size() > 6144) return false;
    const auto encrypted = input_encryptor_->EncryptString(*plaintext);
    if (!encrypted || encrypted->empty()) return false;
    ciphertext = base::Base64Encode(*encrypted);
    if (!IsProtectedCiphertextShape(ciphertext)) return false;
  }
  // No progress, decision, old value or token changes before validation and
  // encryption succeed. Even a self-copy gets a freshly bound ciphertext.
  FreezeRecordedConditionsThrough(*mission, index);
  if (target->definition.is_protected) {
    target->protected_value = std::move(ciphertext);
    target->protected_has_value = !value->empty();
    target->value.clear();
  } else target->value = std::move(*value);
  mission->steps[index].complete = true;
  AppendGeneratedEvent(mission, "runbook",
      base::StrCat({"Checkpoint completed: ", mission->steps[index].label}));
  Save();
  return true;
}

bool MissionService::ControlWorkflowWait(std::string_view id, size_t index,
                                        bool complete,
                                        std::string_view expected_token) {
  const std::string owned_id(id);
  const std::string reviewed_token(expected_token);
  if (!SettleWorkflowDeadlines()) {
    return false;
  }
  auto* mission = FindMission(owned_id);
  if (shutting_down_ || !CanStoreProtectedInputs() || !mission ||
      (!reviewed_token.empty() && mission->mutation_token != reviewed_token) ||
      !CanControlMissionWorkflowWait(*mission, index, complete)) return false;
  auto& step = mission->steps[index];
  FreezeRecordedConditionsThrough(*mission, index);
  if (complete) {
    step.wait_state = "complete";
    step.wait_remaining_ms = 0;
    step.wait_timeout_remaining_ms = 0;
    step.wait_started.reset();
    step.complete = true;
    AppendGeneratedEvent(mission, "runbook", base::StrCat({"Checkpoint completed: ", step.label}));
  } else {
    const bool resume = step.wait_state == "paused";
    step.wait_state = "waiting";
    step.wait_started = base::TimeTicks::Now();
    AppendGeneratedEvent(mission, "runbook", resume ? "Local workflow wait resumed" : "Local workflow wait started");
  }
  Save();
  return true;
}

bool MissionService::FinishNativeWorkflowStep(std::string_view id, size_t index,
                                             std::string_view result) {
  const std::string owned_id(id);
  const std::string owned_result(result);
  result = owned_result;
  if (!SettleWorkflowDeadlines()) {
    return false;
  }
  auto* mission = FindMission(owned_id);
  if (shutting_down_ || !persistence_enabled() || !profile_->IsRegularProfile() ||
      profile_->IsGuestSession() || profile_->IsSystemProfile() ||
      !mission || !mission->operational_workflow ||
      mission->operational_workflow->adapter_version != 1 ||
      index >= mission->steps.size() || !mission->steps[index].requires_native_action ||
      mission->steps[index].action_state != "pending" ||
      (result != "dispatched" && result != "rejected" && result != "unknown")) {
    return false;
  }
  // Managed policy can suppress the timer's persistence path, but cannot
  // extend the dispatch/result deadline or bless a late success callback.
  const auto remaining = MissionWorkflowNativeTimeRemaining(mission->steps[index]);
  if (remaining.value_or(0) == 0) {
    CloseUncertainNativeAttempt(*mission, mission->steps[index], remaining.has_value());
    if (CanMutateStorage()) {
      Save();
    }
    return false;
  }
  // A cancellation/archive may race the journal. Retain the outcome, never
  // resume or replay it. Unknown does not mean the effect did not happen.
  mission->steps[index].action_state = std::string(result);
  mission->steps[index].native_action_started.reset();
  if (result != "dispatched") {
    mission->steps[index].complete = false;
    if (mission->operational_workflow->run_state != "cancelled") {
      SuspendMissionWaits(*mission);
      mission->operational_workflow->run_state = "failed";
    }
  }
  AppendGeneratedEvent(mission, "runbook",
                       base::StrCat({"Native workflow action ", result}));
  // A policy may have arrived during journal I/O. Retain the closed attempt
  // in memory and in the durable journal, but never overwrite managed storage.
  if (CanMutateStorage()) {
    Save();
  }
  return true;
}

bool MissionService::SetOperationalWorkflowRunState(
    std::string_view mission_id,
    std::string_view run_state,
    std::string_view expected_token) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  const std::string owned_id(mission_id);
  const std::string reviewed_token(expected_token);
  const std::string owned_run_state(run_state);
  run_state = owned_run_state;
  if (!SettleWorkflowDeadlines() || shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(owned_id);
  if (shutting_down_ || !mission || mission->archived || !mission->operational_workflow ||
      (!reviewed_token.empty() && mission->mutation_token != reviewed_token) ||
      (!IsOperationalWorkflowRunState(run_state) ||
       (mission->operational_workflow->run_state != run_state &&
        !IsAllowedOperationalWorkflowTransition(
          mission->operational_workflow->run_state, run_state)))) {
    return false;
  }
  // Launch can already have placed a recipe in its requested state before a
  // second UI surface reports that same state. Treat a duplicate report as an
  // idempotent acknowledgement: never duplicate events or re-save sensitive
  // workflow inputs merely because browser surfaces raced.
  if (mission->operational_workflow->run_state == run_state) return true;
  if (!CanStoreProtectedInputs() && (std::ranges::any_of(mission->workflow_inputs,
      [](const auto& input) { return input.is_protected; }) ||
      std::ranges::any_of(mission->workflow_variables, [](const auto& variable) { return variable.definition.is_protected; }))) return false;
  if ((run_state == "running" || run_state == "succeeded") &&
      (!HasValidMissionWorkflowVariables(*mission) || !HasValidMissionWorkflowWaits(*mission) ||
       !HasValidOperationalWorkflowConditions(mission->steps, mission->workflow_inputs, mission->workflow_variables) ||
       std::any_of(mission->workflow_inputs.begin(),
                  mission->workflow_inputs.end(),
                  [mission](const MissionWorkflowInput& input) {
                    return IsMissionWorkflowInputRequired(*mission, input) &&
                           !HasMissionWorkflowInputValue(input);
                  }))) {
    return false;
  }
  if (run_state == "succeeded" &&
      (HasUnresolvedConditionThrough(*mission, mission->steps.size()) ||
       std::ranges::any_of(mission->steps, [mission](const MissionStep& step) {
        return IsOperationalStepAvailable(*mission, step) && !step.complete;
      }))) {
    return false;
  }
  if (run_state == "succeeded") FreezeRecordedConditionsThrough(*mission, mission->steps.size());
  if (run_state != "running") {
    SuspendMissionWaits(*mission);
    if (mission->operational_workflow->run_state == "failed" && run_state != "failed") {
      Save();
      return false;
    }
  }
  mission->operational_workflow->run_state = std::string(run_state);
  AppendGeneratedEvent(
      mission, "mission",
      base::StrCat({"Operational workflow state: ", run_state}));
  Save();
  return true;
}

std::optional<MissionSummary> MissionService::ImportSanitizedMissionCapsule(
    const TahaiMissionCapsuleImport& capsule) {
  if (!IsAllowedType(capsule.mission_type) ||
      !IsAllowedExportProfile(capsule.export_profile) ||
      capsule.checkpoint_complete.size() !=
          DefaultSteps(capsule.mission_type).size() ||
      capsule.validation_complete.size() !=
          DefaultValidationSteps(capsule.mission_type).size() ||
      capsule.rollback_complete.size() !=
          DefaultRollbackSteps(capsule.mission_type).size() ||
      capsule.evidence_marker_count > kMaximumEvidenceMarkers) {
    return std::nullopt;
  }

  if (shutting_down_ || !CanMutateStorage() ||
      missions_.size() >= kMaximumMissions) {
    return std::nullopt;
  }
  // Construct the entire sanitized import before one durable commit. A pref
  // observer may revoke policy or destroy this service during Save(); chaining
  // public mutations with CHECKs would crash or leave a partially imported run.
  MissionSummary imported;
  imported.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  imported.title = "Imported encrypted capsule";
  imported.type = capsule.mission_type;
  imported.created_at = NowAsWindowsEpochMicros();
  imported.updated_at = imported.created_at;
  imported.steps = DefaultSteps(imported.type);
  imported.validation_steps = DefaultValidationSteps(imported.type);
  imported.rollback_steps = DefaultRollbackSteps(imported.type);
  imported.export_profile = capsule.export_profile;
  AppendGeneratedEvent(&imported, "mission", "Mission created");
  for (size_t index = 0; index < capsule.checkpoint_complete.size(); ++index) {
    if (capsule.checkpoint_complete[index]) {
      imported.steps[index].complete = true;
      AppendGeneratedEvent(&imported, "runbook",
                           base::StrCat({"Checkpoint completed: ",
                                         imported.steps[index].label}));
    }
  }
  for (size_t index = 0; index < capsule.validation_complete.size(); ++index) {
    if (capsule.validation_complete[index]) {
      imported.validation_steps[index].complete = true;
      AppendGeneratedEvent(
          &imported, "validation",
          base::StrCat({"Validation completed: ",
                        imported.validation_steps[index].label}));
    }
  }
  for (size_t index = 0; index < capsule.rollback_complete.size(); ++index) {
    if (capsule.rollback_complete[index]) {
      imported.rollback_steps[index].complete = true;
      AppendGeneratedEvent(
          &imported, "rollback",
          base::StrCat(
              {"Rollback completed: ", imported.rollback_steps[index].label}));
    }
  }
  AppendGeneratedEvent(&imported, "export", "Export profile selected");
  for (size_t count = 0; count < capsule.evidence_marker_count; ++count) {
    imported.evidence.push_back({"Operator-confirmed evidence marker",
                                 "operator-confirmed",
                                 NowAsWindowsEpochMicros()});
    AppendGeneratedEvent(&imported, "evidence", "Evidence marker added");
  }
  missions_.push_back(imported);
  Save();
  return imported;
}

bool MissionService::ToggleStep(std::string_view mission_id,
                                size_t step_index,
                                std::string_view expected_token) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  const std::string owned_id(mission_id);
  const std::string reviewed_token(expected_token);
  if (!SettleWorkflowDeadlines() || shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(owned_id);
  if (!mission || mission->archived ||
      (!reviewed_token.empty() && mission->mutation_token != reviewed_token) ||
      !ToggleGeneratedStep(mission, &mission->steps, step_index, "runbook",
                           "Checkpoint")) {
    return false;
  }
  Save();
  return true;
}

bool MissionService::ToggleValidationStep(std::string_view mission_id,
                                          size_t step_index) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived ||
      !ToggleGeneratedStep(mission, &mission->validation_steps, step_index,
                           "validation", "Validation")) {
    return false;
  }
  Save();
  return true;
}

bool MissionService::ToggleRollbackStep(std::string_view mission_id,
                                        size_t step_index) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  const auto* prior = FindMission(mission_id);
  if (!prior) return false;
  const std::string owned_id(mission_id);
  const std::string token = prior->mutation_token;
  if (!SettleWorkflowDeadlines() || shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(owned_id);
  // A newly settled deadline changes what the person is reviewing. Require a
  // fresh document/token instead of acknowledging recovery against stale UI.
  if (!mission || mission->mutation_token != token || mission->archived ||
      !ToggleGeneratedStep(mission, &mission->rollback_steps, step_index,
                           "rollback", CanReviewMissionRecovery(*mission) ? "Recovery review" : "Rollback")) {
    return false;
  }
  Save();
  return true;
}

bool MissionService::ToggleEscalation(std::string_view mission_id) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived) {
    return false;
  }
  mission->escalation_required = !mission->escalation_required;
  AppendGeneratedEvent(mission, "runbook",
                       mission->escalation_required
                           ? "Operator escalation marked required"
                           : "Operator escalation marked cleared");
  Save();
  return true;
}

bool MissionService::AddEvidenceMarker(std::string_view mission_id) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived ||
      mission->evidence.size() >= kMaximumEvidenceMarkers) {
    return false;
  }
  const std::string now = NowAsWindowsEpochMicros();
  mission->evidence.push_back(
      {"Operator-confirmed evidence marker", "operator-confirmed", now});
  AppendGeneratedEvent(mission, "evidence", "Evidence marker added");
  Save();
  return true;
}

bool MissionService::AddLocalNote(std::string_view mission_id,
                                  std::string_view note) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived ||
      mission->notes.size() >= kMaximumMissionNotes ||
      !IsSafeMissionNote(note) || RedactLocalOiExportText(note).blocked) {
    return false;
  }
  const std::string now = NowAsWindowsEpochMicros();
  mission->notes.push_back({std::string(note), now});
  // Keep the ledger useful without placing the note's text in a durable event
  // chain or a generated exportable status record.
  AppendGeneratedEvent(mission, "runbook", "Profile-local mission note added");
  Save();
  return true;
}

bool MissionService::SetOperationalWorkflowInputValue(
    std::string_view mission_id,
    std::string_view input_id,
    std::string_view value,
    std::string_view expected_token) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  const std::string owned_id(mission_id);
  const std::string reviewed_token(expected_token);
  const std::string owned_input_id(input_id);
  const std::string owned_value(value);
  input_id = owned_input_id;
  value = owned_value;
  if (!SettleWorkflowDeadlines() || shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(owned_id);
  if (!mission || mission->archived || !mission->operational_workflow ||
      (!reviewed_token.empty() && mission->mutation_token != reviewed_token) ||
      IsTerminalWorkflowState(mission->operational_workflow->run_state) ||
      std::ranges::any_of(mission->steps, [](const auto& step) {
        return step.action_state == "pending";
      }) ||
      !IsSafeOperationalIdentifier(input_id)) {
    return false;
  }
  const auto input = std::find_if(
      mission->workflow_inputs.begin(), mission->workflow_inputs.end(),
      [input_id](const MissionWorkflowInput& candidate) {
        return candidate.id == input_id;
      });
  if (input == mission->workflow_inputs.end() ||
      !IsValidOperationalWorkflowInputValue(*input, value)) {
    return false;
  }
  if (input->is_protected && !CanStoreProtectedInputs()) return false;
  if (!input->is_protected && input->value == value) {
    return true;
  }
  // Changing a branch cannot reinterpret completed/started work. Checkpoints
  // may be reopened; assignments, native attempts and waits cannot be replayed.
  if (IsMissionWorkflowInputBranchLocked(*mission, input_id)) {
    return false;
  }
  if (input->is_protected) {
    std::string ciphertext;
    if (!value.empty()) {
      if (!input_encryptor_ || !input_encryptor_->IsEncryptionAvailable() ||
          !input_encryptor_->IsDecryptionAvailable()) return false;
      auto payload = ProtectedInputContext(*profile_, *mission, *input);
      payload.Set("value", value);
      const auto plaintext = base::WriteJson(payload);
      if (!plaintext || plaintext->size() > 6144) return false;
      const auto encrypted = input_encryptor_->EncryptString(*plaintext);
      if (!encrypted || encrypted->empty()) return false;
      ciphertext = base::Base64Encode(*encrypted);
      if (!IsProtectedCiphertextShape(ciphertext)) return false;
      input->protected_storage_ready = true;
    }
    // Commit only after encryption succeeded; clearing is an explicit action
    // and remains possible when the original OS key is unavailable.
    input->protected_value = std::move(ciphertext);
    input->protected_has_value = !value.empty();
    input->value.clear();
  } else {
    input->value = std::string(value);
  }
  if (IsMissionWorkflowInputRequired(*mission, *input) && value.empty() &&
      mission->operational_workflow->run_state == "running") {
    SuspendMissionWaits(*mission);
    if (mission->operational_workflow->run_state != "failed") {
      mission->operational_workflow->run_state = "waiting-for-input";
      AppendGeneratedEvent(mission, "mission",
                           "Operational workflow state: waiting-for-input");
    }
  }
  // Values are deliberately absent from the generated timeline so a local
  // typed value never becomes evidence, handoff, capsule, or export content.
  mission->mutation_token = base::Uuid::GenerateRandomV4().AsLowercaseString();
  Save();
  return true;
}

bool MissionService::SetExportProfile(std::string_view mission_id,
                                      std::string_view export_profile) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived ||
      !IsAllowedExportProfile(export_profile)) {
    return false;
  }
  mission->export_profile = std::string(export_profile);
  AppendGeneratedEvent(mission, "export", "Export profile selected");
  Save();
  return true;
}

bool MissionService::ArchiveMission(std::string_view mission_id,
                                    std::string_view expected_token) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  const std::string owned_id(mission_id);
  const std::string reviewed_token(expected_token);
  if (!SettleWorkflowDeadlines() || shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(owned_id);
  if (!mission || mission->archived ||
      (!reviewed_token.empty() && mission->mutation_token != reviewed_token)) {
    return false;
  }
  mission->archived = true;
  SuspendMissionWaits(*mission);
  // Archiving suspends the whole run, not just an active local wait. Merely
  // restoring a record must not re-enable the next native action/assignment.
  // An in-flight attempt still settles on its existing bounded deadline.
  if (mission->operational_workflow &&
      mission->operational_workflow->run_state == "running") {
    mission->operational_workflow->run_state = "paused";
    AppendGeneratedEvent(mission, "mission", "Operational workflow state: paused");
  }
  AppendGeneratedEvent(mission, "mission", "Mission archived");
  Save();
  return true;
}

bool MissionService::RestoreMission(std::string_view mission_id) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || !mission->archived) {
    return false;
  }
  mission->archived = false;
  AppendGeneratedEvent(mission, "mission", "Mission restored");
  Save();
  return true;
}

std::optional<MissionSummary> MissionService::DuplicateMission(
    std::string_view mission_id) {
  const MissionSummary* mission = FindMission(mission_id);
  if (!mission) {
    return std::nullopt;
  }
  // Copy the fixed mission family only. Operator state, evidence markers, and
  // timeline entries are deliberately not carried into a new runbook.
  return CreateMission(DuplicateTitle(mission->title), mission->type);
}

bool MissionService::DeleteMission(std::string_view mission_id) {
  if (shutting_down_ || !CanMutateStorage()) {
    return false;
  }
  if (!IsValidId(mission_id)) {
    return false;
  }
  const auto found = std::find_if(missions_.begin(), missions_.end(),
                                  [mission_id](const MissionSummary& mission) {
                                    return mission.id == mission_id;
                                  });
  if (found == missions_.end() || !found->archived) {
    return false;
  }
  missions_.erase(found);
  Save();
  return true;
}

bool MissionService::persistence_enabled() const {
  return !profile_->IsOffTheRecord();
}

void MissionService::Load() {
  missions_.clear();
  loaded_storage_writable_ = true;
  const auto* raw = prefs_->GetRawUserPrefValue(prefs::kTahaiMissions);
  const auto& stored = prefs_->GetList(prefs::kTahaiMissions);
  if ((raw && !raw->is_list()) || stored.size() > kMaximumMissions ||
      (raw && raw->GetList().size() > kMaximumMissions)) {
    // Do not clone an unbounded collection or replace unsupported storage with
    // the registered default. Recovery must preserve the original bytes.
    loaded_storage_.reset();
    loaded_storage_writable_ = false;
    return;
  }
  loaded_storage_ = raw ? std::make_optional(raw->Clone()) : std::nullopt;
  std::set<std::string> loaded_ids;
  for (const base::Value& mission_value : stored) {
    const base::DictValue* dict = mission_value.GetIfDict();
    if (!dict) {
      loaded_storage_writable_ = false;
      continue;
    }
    for (const auto entry : *dict) {
      if (std::ranges::find(kKnownMissionFields, entry.first) ==
          kKnownMissionFields.end()) {
        loaded_storage_writable_ = false;
        break;
      }
    }
    if (!HasKnownMissionNestedFields(*dict)) {
      // A supported outer record can still carry newer nested data. Read its
      // known projection, but never rebuild storage and erase that data.
      loaded_storage_writable_ = false;
    }
    const std::string* id = dict->FindString("id");
    const std::string* title = dict->FindString("title");
    const std::string* type = dict->FindString("type");
    const std::string* created_at = dict->FindString("created_at");
    if (!id || !title || !type || !created_at || !IsValidId(*id) ||
        !IsSafeTitle(*title) || !IsSafeTimestamp(*created_at) ||
        !IsAllowedType(*type) || !loaded_ids.insert(*id).second) {
      // Saving only the accepted subset would silently erase an unsupported
      // record (including future data) or a duplicate. Keep readable records
      // visible, but do not permit a partial collection to be rewritten.
      loaded_storage_writable_ = false;
      continue;
    }
    MissionSummary mission;
    mission.id = *id;
    mission.mutation_token = base::Uuid::GenerateRandomV4().AsLowercaseString();
    mission.title = *title;
    mission.type = *type;
    mission.created_at = *created_at;
    if (const std::string* updated_at = dict->FindString("updated_at");
        updated_at && IsSafeTimestamp(*updated_at)) {
      mission.updated_at = *updated_at;
    } else {
      mission.updated_at = *created_at;
    }

    const auto load_steps = [&](std::string_view key,
                                std::vector<MissionStep>* destination) {
      CHECK(destination);
      // Step text is generated from the fixed mission family. Preferences can
      // restore completion state, but never replace generated labels.
      if (const base::ListValue* saved_steps = dict->FindList(key)) {
        for (size_t index = 0;
             index < saved_steps->size() && index < destination->size();
             ++index) {
          const base::DictValue* step = (*saved_steps)[index].GetIfDict();
          const std::string* label = step ? step->FindString("label") : nullptr;
          const std::optional<bool> complete =
              step ? step->FindBool("complete") : std::nullopt;
          if (!label || !complete || *label != (*destination)[index].label) {
            continue;
          }
          (*destination)[index].complete = *complete;
        }
      }
    };
    mission.steps = DefaultSteps(mission.type);
    mission.validation_steps = DefaultValidationSteps(mission.type);
    mission.rollback_steps = DefaultRollbackSteps(mission.type);
    // A trusted operational workflow is saved as a bounded local snapshot.
    // Unlike fixed Mission families, its generated labels are allowed to be
    // restored only when its pinned source record and every saved step pass
    // the same small preference schema. Nothing in this path executes a
    // workflow action or restores an action name from preferences.
    if (const base::DictValue* source =
            dict->FindDict("operational_workflow")) {
      const std::string* skin_id = source->FindString("skin_id");
      const std::string* workflow_id = source->FindString("workflow_id");
      const std::string* archive_sha256 =
          source->FindString("archive_sha256");
      const std::string* run_state = source->FindString("run_state");
      const int adapter_version = source->FindInt("adapter_version").value_or(0);
      const base::ListValue* saved_steps = dict->FindList("steps");
      if (skin_id && workflow_id && archive_sha256 && saved_steps &&
          IsSafeOperationalIdentifier(*skin_id) &&
          IsSafeOperationalIdentifier(*workflow_id) &&
          IsLedgerHash(*archive_sha256) &&
          (!run_state || IsOperationalWorkflowRunState(*run_state)) &&
          (!source->contains("adapter_version") ||
           source->FindInt("adapter_version") == 0 ||
           source->FindInt("adapter_version") == 1) &&
          !saved_steps->empty() &&
          saved_steps->size() <= kMaximumOperationalWorkflowSteps) {
        std::vector<MissionStep> restored_steps;
        restored_steps.reserve(saved_steps->size());
        bool valid_steps = true;
        bool interrupted_wait = false;
        bool interrupted_timeout = false;
        std::set<std::string> step_ids;
        for (const base::Value& saved_step : *saved_steps) {
          const base::DictValue* step = saved_step.GetIfDict();
          const std::string* label = step ? step->FindString("label") : nullptr;
          const std::optional<bool> complete =
              step ? step->FindBool("complete") : std::nullopt;
          const std::string* condition_input_id =
              step ? step->FindString("condition_input_id") : nullptr;
          const std::string* condition_equals =
              step ? step->FindString("condition_equals") : nullptr;
          const bool has_input = step && step->contains("condition_input_id");
          const bool has_equals = step && step->contains("condition_equals");
          const bool has_compare = step && step->contains("condition_compare");
          if (!label || !complete || !IsSafeTitle(*label) ||
              has_input != (has_equals || has_compare) || (has_equals && has_compare) ||
              (has_input && (!condition_input_id || !IsSafeOperationalIdentifier(*condition_input_id))) ||
              (has_equals && (!condition_equals || !IsSafeMissionNote(*condition_equals)))) {
            valid_steps = false;
            break;
          }
          restored_steps.push_back(
              {*label, *complete,
               condition_input_id ? *condition_input_id : std::string(),
               condition_equals ? *condition_equals : std::string()});
          if (step->contains("condition_predicate")) {
            TahaiWorkflowPredicate predicate;
            if (adapter_version != 1 || has_input || has_equals || has_compare || step->contains("condition_from_variable") ||
                !ParseTahaiWorkflowPredicate(step->Find("condition_predicate"), &predicate) || predicate.operation.empty()) {
              valid_steps = false; break;
            }
            restored_steps.back().predicate = std::move(predicate);
          }
          if (step->contains("condition_from_variable")) {
            if (adapter_version != 1 || !has_input ||
                step->FindBool("condition_from_variable") != true) { valid_steps = false; break; }
            restored_steps.back().condition_from_variable = true;
          }
          if (step->contains("variable_condition_result")) {
            const auto decision = step->FindBool("variable_condition_result");
            if (!RecordsCondition(restored_steps.back()) || !decision) { valid_steps = false; break; }
            restored_steps.back().variable_condition_result = decision;
          }
          if (has_compare) {
            TahaiWorkflowNumericCondition condition;
            if (adapter_version != 1 || !ParseTahaiWorkflowNumericCondition(step->Find("condition_compare"), &condition)) {
              valid_steps = false; break;
            }
            restored_steps.back().numeric_condition = std::move(condition);
          }
          if (step->contains("assign")) {
            TahaiWorkflowAssignment assignment;
            if (adapter_version != 1 || !ParseTahaiWorkflowAssignment(step->Find("assign"), &assignment)) {
              valid_steps = false;
              break;
            }
            restored_steps.back().assignment = std::move(assignment);
          }
          if (step->contains("wait_started") || step->contains("native_action_started")) {
            valid_steps = false; break;
          }
          if (step->contains("native_action_error")) {
            const auto* error = step->FindString("native_action_error");
            if (adapter_version != 1 || !error || *error != "deadline-exceeded" || *complete ||
                !step->FindBool("requires_native_action").value_or(false) ||
                !step->FindString("action_state") || *step->FindString("action_state") != "unknown") {
              valid_steps = false; break;
            }
            restored_steps.back().native_action_error = *error;
          }
          if (step->contains("wait_seconds") || step->contains("wait_remaining_ms") || step->contains("wait_state") ||
              step->contains("wait_timeout_seconds") || step->contains("wait_timeout_remaining_ms")) {
            const auto seconds = step->FindInt("wait_seconds");
            const auto remaining = step->FindInt("wait_remaining_ms");
            const auto* wait_state = step->FindString("wait_state");
            if (adapter_version != 1 || !seconds || *seconds < 1 || *seconds > 86400 || !remaining ||
                *remaining < 0 || *remaining > *seconds * 1000 || !wait_state ||
                (*wait_state != "ready" && *wait_state != "waiting" && *wait_state != "paused" &&
                 *wait_state != "complete" && *wait_state != "timed-out") ||
                (*wait_state == "waiting" && (interrupted_wait || !run_state || *run_state != "running" ||
                                               dict->FindBool("archived").value_or(false)))) {
              valid_steps = false; break;
            }
            auto& restored = restored_steps.back();
            restored.wait_seconds = *seconds;
            restored.wait_remaining_ms = *remaining;
            // Never deserialize a clock or credit time that was not saved.
            // A crash can repeat part of a delay, but cannot skip that delay.
            restored.wait_state = *wait_state == "waiting" ? "paused" : *wait_state;
            if (*wait_state == "waiting") interrupted_wait = true;
            if (step->contains("wait_timeout_seconds") || step->contains("wait_timeout_remaining_ms")) {
              const auto timeout = step->FindInt("wait_timeout_seconds");
              const auto timeout_remaining = step->FindInt("wait_timeout_remaining_ms");
              if (!timeout || *timeout <= *seconds || *timeout > 86400 || !timeout_remaining ||
                  *timeout_remaining < 0 || *timeout_remaining > *timeout * 1000) { valid_steps = false; break; }
              restored.wait_timeout_seconds = *timeout;
              restored.wait_timeout_remaining_ms = *timeout_remaining;
              if (*wait_state == "waiting" && *timeout_remaining == 0) {
                restored.wait_state = "timed-out";
                interrupted_timeout = true;
              }
            }
          }
          if (adapter_version == 1) {
            const auto* step_id = step->FindString("workflow_step_id");
            const auto native = step->FindBool("requires_native_action");
            const auto* state = step->FindString("action_state");
            if (!step_id || !IsSafeOperationalIdentifier(*step_id) ||
                !step_ids.insert(*step_id).second || !native || !state ||
                (*native && *state != "ready" && *state != "pending" &&
                 *state != "dispatched" && *state != "rejected" &&
                 *state != "unknown") || (!*native && !state->empty())) {
              valid_steps = false;
              break;
            }
            auto& restored = restored_steps.back();
            restored.workflow_step_id = *step_id;
            restored.requires_native_action = *native;
            restored.action_state = *state == "pending" ? "unknown" : *state;
            if (*native && restored.action_state != "dispatched") {
              restored.complete = false;
            }
          }
        }
        std::vector<MissionStep> restored_compensation;
        if (valid_steps) {
          if (const base::ListValue* saved_compensation =
                  dict->FindList("rollback_steps")) {
            if (saved_compensation->empty() ||
                saved_compensation->size() > kMaximumOperationalWorkflowSteps) {
              valid_steps = false;
            } else {
              restored_compensation.reserve(saved_compensation->size());
              for (const base::Value& saved_step : *saved_compensation) {
                const base::DictValue* step = saved_step.GetIfDict();
                const std::string* label =
                    step ? step->FindString("label") : nullptr;
                const std::optional<bool> complete =
                    step ? step->FindBool("complete") : std::nullopt;
                if (!step || step->size() != 2 || !label || !complete ||
                    !IsSafeTitle(*label)) {
                  valid_steps = false;
                  break;
                }
                restored_compensation.push_back({*label, *complete});
              }
            }
          }
        }
        if (valid_steps) {
          mission.operational_workflow = OperationalWorkflowSource{
              *skin_id, *workflow_id, *archive_sha256,
              run_state ? *run_state : "ready", adapter_version};
          if (interrupted_wait) mission.operational_workflow->run_state = "paused";
          if (interrupted_timeout) mission.operational_workflow->run_state = "failed";
          mission.steps = std::move(restored_steps);
          if (!restored_compensation.empty()) {
            mission.rollback_steps = std::move(restored_compensation);
          }
          const base::ListValue* saved_inputs = dict->FindList("workflow_inputs");
          bool valid_inputs = !dict->contains("workflow_inputs") ||
                              (saved_inputs && saved_inputs->size() <=
                                                   kMaximumOperationalWorkflowInputs);
          if (valid_inputs && saved_inputs) {
            for (const base::Value& saved_input : *saved_inputs) {
              const base::DictValue* input = saved_input.GetIfDict();
              const std::string* input_id = input ? input->FindString("id") : nullptr;
              const std::string* input_name = input ? input->FindString("name") : nullptr;
              const std::string* input_type = input ? input->FindString("type") : nullptr;
              const std::optional<bool> required =
                  input ? input->FindBool("required") : std::nullopt;
              const std::string* input_value = input ? input->FindString("value") : nullptr;
              const base::ListValue* options = input ? input->FindList("options") : nullptr;
              const auto protected_flag = input ? input->FindBool("protected") : std::nullopt;
              const auto* ciphertext = input ? input->FindString("protected_value") : nullptr;
              if (!input_id || !input_name || !input_type || !required ||
                  (input && input->contains("protected") && !protected_flag) ||
                  (protected_flag.value_or(false) &&
                   (!ciphertext || ciphertext->size() > 8192 ||
                    !input_value || !input_value->empty())) ||
                  (!protected_flag.value_or(false) && input && input->contains("protected_value")) ||
                  !input_value || !IsSafeOperationalIdentifier(*input_id) ||
                  !IsSafeTitle(*input_name) ||
                  (input_type && *input_type != "text" && *input_type != "number" &&
                   *input_type != "boolean" && *input_type != "selection" &&
                   *input_type != "date" && *input_type != "url") ||
                  std::any_of(mission.workflow_inputs.begin(),
                              mission.workflow_inputs.end(),
                              [input_id](const MissionWorkflowInput& current) {
                                return current.id == *input_id;
                              })) {
                valid_inputs = false;
                break;
              }
              MissionWorkflowInput restored{*input_id, *input_name, *input_type,
                                            *required, {}, *input_value};
              restored.is_protected = protected_flag.value_or(false);
              if (!ParseTahaiWorkflowInputValidation(input->Find("validation"),
                                                    restored.type, &restored.validation)) {
                valid_inputs = false;
                break;
              }
              if (restored.is_protected) restored.protected_value = *ciphertext;
              if (options) {
                if (options->empty() || options->size() > 12u) {
                  valid_inputs = false;
                  break;
                }
                for (const base::Value& option : *options) {
                  const std::string* option_value = option.GetIfString();
                  if (!option_value || !IsSafeMissionNote(*option_value) ||
                      std::count(restored.options.begin(), restored.options.end(),
                                 *option_value) != 0) {
                    valid_inputs = false;
                    break;
                  }
                  restored.options.push_back(*option_value);
                }
              }
              if (!valid_inputs ||
                  (restored.type == "selection" && restored.options.empty()) ||
                  (restored.type != "selection" && !restored.options.empty()) ||
                  !IsValidOperationalWorkflowInputValue(restored,
                                                        restored.value)) {
                valid_inputs = false;
                break;
              }
              mission.workflow_inputs.push_back(std::move(restored));
            }
            if (!valid_inputs) {
              mission.workflow_inputs.clear();
            }
          }
          std::vector<std::string_view> input_ids;
          for (const auto& input : mission.workflow_inputs) input_ids.push_back(input.id);
          bool valid_variables = true;
          if (const auto* saved = dict->Find("workflow_variables")) {
            const auto* list = saved->GetIfList();
            base::ListValue definitions;
            std::vector<std::string> values;
            valid_variables = list && list->size() <= 12u && adapter_version == 1;
            if (valid_variables) for (const auto& item : *list) {
              const auto* variable = item.GetIfDict();
              const bool protected_slot = variable && variable->FindBool("protected").value_or(false);
              const auto* current = variable ? variable->FindString(protected_slot ? "protected_value" : "value") : nullptr;
              if (!current) { valid_variables = false; break; }
              auto definition = variable->Clone();
              definition.Remove(protected_slot ? "protected_value" : "value");
              definitions.Append(std::move(definition));
              values.push_back(*current);
            }
            base::Value encoded(std::move(definitions));
            std::vector<TahaiOperationalWorkflowInput> variables;
            valid_variables = valid_variables && ParseTahaiWorkflowVariables(&encoded, &variables);
            if (valid_variables) for (size_t index = 0; index < variables.size(); ++index) {
              MissionSummary::Variable variable{std::move(variables[index]), {}};
              if (variable.definition.is_protected) variable.protected_value = std::move(values[index]);
              else variable.value = std::move(values[index]);
              mission.workflow_variables.push_back(std::move(variable));
            }
          }
          std::vector<std::string_view> variable_ids;
          for (const auto& variable : mission.workflow_variables) variable_ids.push_back(variable.definition.id);
          if (!valid_inputs ||
              !valid_variables || !HasValidMissionWorkflowVariables(mission) || !HasValidMissionWorkflowWaits(mission) ||
              (mission.operational_workflow->run_state == "succeeded" && HasUnrecordedCondition(mission)) ||
              !ParseTahaiWorkflowOutputs(dict->Find("workflow_outputs"), input_ids,
                                         &mission.workflow_outputs, variable_ids) ||
              !HasValidOperationalWorkflowConditions(mission.steps,
                                                      mission.workflow_inputs, mission.workflow_variables)) {
            mission.operational_workflow.reset();
            mission.steps = DefaultSteps(mission.type);
            mission.workflow_inputs.clear();
            mission.workflow_outputs.clear();
            mission.workflow_variables.clear();
          }
        }
      }
    }
    if (!mission.operational_workflow) {
      if (dict->contains("operational_workflow")) {
        loaded_storage_writable_ = false;
      }
      for (const auto key :
           {"workflow_inputs", "workflow_variables", "workflow_outputs"}) {
        const auto* value = dict->Find(key);
        if (value && (!value->is_list() || !value->GetList().empty())) {
          loaded_storage_writable_ = false;
        }
      }
      load_steps("steps", &mission.steps);
    }
    load_steps("validation_steps", &mission.validation_steps);
    load_steps("rollback_steps", &mission.rollback_steps);
    if (const std::optional<bool> escalation =
            dict->FindBool("escalation_required")) {
      mission.escalation_required = *escalation;
    }
    if (const std::optional<bool> archived = dict->FindBool("archived")) {
      mission.archived = *archived;
    }
    if (const std::optional<bool> integrity =
            dict->FindBool("timeline_integrity_verified")) {
      mission.timeline_integrity_verified = *integrity;
    }
    if (const std::string* export_profile = dict->FindString("export_profile");
        export_profile && IsAllowedExportProfile(*export_profile)) {
      mission.export_profile = *export_profile;
    } else {
      mission.export_profile = "sanitized-handoff";
    }
    // `links.oi` is future-facing, inert metadata. Read only a small
    // allowlisted shape so profile preferences cannot turn it into an
    // arbitrary hosted URL, data payload, or credential container.
    if (const base::DictValue* links = dict->FindDict("links")) {
      if (const base::DictValue* oi = links->FindDict("oi")) {
        const std::string* opaque_reference =
            oi->FindString("opaque_reference");
        const std::string* hosted_deep_link =
            oi->FindString("hosted_deep_link");
        if (opaque_reference) {
          TahaiOiLink link;
          link.opaque_reference = *opaque_reference;
          if (hosted_deep_link) {
            link.hosted_deep_link = GURL(*hosted_deep_link);
          }
          if (IsValidTahaiOiLink(link)) {
            mission.oi_link = std::move(link);
          }
        }
      }
    }
    if (const base::ListValue* saved_evidence = dict->FindList("evidence")) {
      for (const base::Value& evidence_value : *saved_evidence) {
        const base::DictValue* evidence = evidence_value.GetIfDict();
        const std::string* label =
            evidence ? evidence->FindString("label") : nullptr;
        const std::string* scope =
            evidence ? evidence->FindString("capture_scope") : nullptr;
        const std::string* captured_at =
            evidence ? evidence->FindString("captured_at") : nullptr;
        if (!label || !scope || !captured_at ||
            *label != "Operator-confirmed evidence marker" ||
            *scope != "operator-confirmed" || !IsSafeTimestamp(*captured_at)) {
          continue;
        }
        mission.evidence.push_back({*label, *scope, *captured_at});
        if (mission.evidence.size() == kMaximumEvidenceMarkers) {
          break;
        }
      }
    }
    if (const base::ListValue* saved_notes = dict->FindList("notes")) {
      for (const base::Value& note_value : *saved_notes) {
        const base::DictValue* note = note_value.GetIfDict();
        const std::string* text = note ? note->FindString("text") : nullptr;
        const std::string* note_created_at =
            note ? note->FindString("created_at") : nullptr;
        if (!text || !note_created_at || !IsSafeMissionNote(*text) ||
            RedactLocalOiExportText(*text).blocked ||
            !IsSafeTimestamp(*note_created_at)) {
          continue;
        }
        mission.notes.push_back({*text, *note_created_at});
        if (mission.notes.size() == kMaximumMissionNotes) {
          break;
        }
      }
    }
    bool discarded_ledger_record =
        dict->contains("timeline") && !dict->FindList("timeline");
    if (const base::ListValue* saved_timeline = dict->FindList("timeline")) {
      for (const base::Value& event_value : *saved_timeline) {
        const base::DictValue* event = event_value.GetIfDict();
        const std::string* kind = event ? event->FindString("kind") : nullptr;
        const std::string* detail =
            event ? event->FindString("detail") : nullptr;
        const std::string* event_created_at =
            event ? event->FindString("created_at") : nullptr;
        if (!kind || !detail || !event_created_at ||
            !IsAllowedTimelineKind(*kind) ||
            !IsGeneratedTimelineDetail(mission, *kind, *detail) ||
            !IsSafeTimestamp(*event_created_at)) {
          discarded_ledger_record = true;
          continue;
        }
        const std::string* previous_hash = event->FindString("previous_hash");
        const std::string* entry_hash = event->FindString("entry_hash");
        if ((previous_hash || entry_hash) &&
            (!previous_hash || !entry_hash ||
             (!previous_hash->empty() && !IsLedgerHash(*previous_hash)) ||
             !IsLedgerHash(*entry_hash))) {
          // Never admit malformed ledger fields or silently turn a partially
          // discarded history into a verified evidence record.
          discarded_ledger_record = true;
          continue;
        }
        mission.timeline.push_back({*kind, *detail, *event_created_at,
                                    previous_hash ? *previous_hash : "",
                                    entry_hash ? *entry_hash : ""});
        if (mission.timeline.size() == kMaximumTimelineEvents) {
          break;
        }
      }
    }
    if (mission.timeline.empty()) {
      AppendGeneratedEvent(&mission, "mission", "Mission loaded");
    } else if (std::any_of(mission.timeline.begin(), mission.timeline.end(),
                           [](const MissionEvent& event) {
                             return event.entry_hash.empty();
                           })) {
      RebuildTimelineLedger(&mission);
      mission.timeline_integrity_verified = false;
    } else if (!VerifyTimelineLedger(mission)) {
      mission.timeline.clear();
      mission.timeline_integrity_verified = false;
      AppendGeneratedEvent(&mission, "mission", "Mission loaded");
    }
    // An anchored suffix can still verify after a malformed oldest event was
    // discarded. That proves only the retained suffix, not the loaded history.
    // Likewise, a preexisting integrity warning is sticky even when no events
    // remain; loading or later edits must not manufacture historical evidence.
    if (discarded_ledger_record) {
      mission.timeline_integrity_verified = false;
    }
    // A persisted pending attempt has already become unknown above. Older
    // snapshots could also leave a rejected/unknown run active (or even claim
    // success). Close it without replay or a preference write during load.
    // Explicit cancellation remains cancellation; its step still shows why
    // the external outcome needs review.
    if (mission.operational_workflow &&
        mission.operational_workflow->adapter_version == 1 &&
        mission.operational_workflow->run_state != "cancelled" &&
        mission.operational_workflow->run_state != "failed" &&
        std::ranges::any_of(mission.steps, [](const auto& step) {
          return step.requires_native_action &&
                 (step.action_state == "rejected" || step.action_state == "unknown");
        })) {
      mission.operational_workflow->run_state = "failed";
      AppendGeneratedEvent(&mission, "mission", "Operational workflow state: failed");
    }
    // Older versions suspended only runs with a currently waiting timer.
    // Preserve terminal results, but restore every archived active run paused
    // so unarchiving alone is never a resume gesture.
    if (mission.archived && mission.operational_workflow &&
        mission.operational_workflow->run_state == "running") {
      mission.operational_workflow->run_state = "paused";
      AppendGeneratedEvent(&mission, "mission",
                           "Operational workflow state: paused");
    }
    // Older snapshots could leave an optional branch choice unset while
    // reporting a running checklist. Restore the unresolved gate explicitly;
    // this is a local state correction, never a command replay.
    if (!mission.archived && mission.operational_workflow &&
        mission.operational_workflow->run_state == "running" &&
        std::ranges::any_of(mission.workflow_inputs, [&mission](const auto& input) {
          return !HasMissionWorkflowInputValue(input) &&
                 IsMissionWorkflowInputRequired(mission, input);
        })) {
      mission.operational_workflow->run_state = "waiting-for-input";
      AppendGeneratedEvent(&mission, "mission",
                           "Operational workflow state: waiting-for-input");
    }
    missions_.push_back(std::move(mission));
    if (missions_.size() == kMaximumMissions) {
      break;
    }
  }
}

void MissionService::Save() {
  ExpireWorkflowDeadlines();
  ScheduleWorkflowDeadline();
  if (!persistence_enabled() || !CanMutateStorage()) {
    return;
  }
  ScopedListPrefUpdate update(prefs_, prefs::kTahaiMissions);
  update->clear();
  for (const MissionSummary& mission : missions_) {
    base::DictValue value;
    value.Set("id", mission.id);
    value.Set("title", mission.title);
    value.Set("type", mission.type);
    value.Set("created_at", mission.created_at);
    value.Set("updated_at", mission.updated_at);
    if (mission.operational_workflow) {
      base::DictValue source;
      source.Set("skin_id", mission.operational_workflow->skin_id);
      source.Set("workflow_id", mission.operational_workflow->workflow_id);
      source.Set("archive_sha256", mission.operational_workflow->archive_sha256);
      source.Set("run_state", mission.operational_workflow->run_state);
      source.Set("adapter_version", mission.operational_workflow->adapter_version);
      value.Set("operational_workflow", std::move(source));
    }
    const auto save_steps = [&value](std::string_view key,
                                     const std::vector<MissionStep>& steps) {
      base::ListValue saved_steps;
      for (const MissionStep& step : steps) {
        base::DictValue step_value;
        step_value.Set("label", step.label);
        step_value.Set("complete", step.complete);
        if (step.assignment) step_value.Set("assign", SerializeTahaiWorkflowAssignment(*step.assignment));
        if (step.wait_seconds) {
          step_value.Set("wait_seconds", step.wait_seconds);
          step_value.Set("wait_remaining_ms", MissionWorkflowWaitRemaining(step).value_or(step.wait_remaining_ms));
          step_value.Set("wait_state", step.wait_state);
          if (step.wait_timeout_seconds) {
            step_value.Set("wait_timeout_seconds", step.wait_timeout_seconds);
            step_value.Set("wait_timeout_remaining_ms", MissionWorkflowWaitTimeoutRemaining(step).value_or(step.wait_timeout_remaining_ms));
          }
        }
        if (!step.workflow_step_id.empty()) {
          step_value.Set("workflow_step_id", step.workflow_step_id);
          step_value.Set("requires_native_action", step.requires_native_action);
          step_value.Set("action_state", step.action_state);
          if (!step.native_action_error.empty()) step_value.Set("native_action_error", step.native_action_error);
        }
        if (step.predicate) step_value.Set("condition_predicate", SerializeTahaiWorkflowPredicate(*step.predicate));
        if (step.variable_condition_result) step_value.Set("variable_condition_result", *step.variable_condition_result);
        if (!step.condition_input_id.empty()) {
          step_value.Set("condition_input_id", step.condition_input_id);
          if (step.condition_from_variable) step_value.Set("condition_from_variable", true);
          if (step.numeric_condition) step_value.Set("condition_compare", SerializeTahaiWorkflowNumericCondition(*step.numeric_condition));
          else step_value.Set("condition_equals", step.condition_equals);
        }
        saved_steps.Append(std::move(step_value));
      }
      value.Set(key, std::move(saved_steps));
    };
    save_steps("steps", mission.steps);
    save_steps("validation_steps", mission.validation_steps);
    save_steps("rollback_steps", mission.rollback_steps);
    value.Set("escalation_required", mission.escalation_required);
    value.Set("archived", mission.archived);
    value.Set("export_profile", mission.export_profile);
    value.Set("timeline_integrity_verified",
              mission.timeline_integrity_verified);
    // Persist no hosted metadata unless the inert reference meets the same
    // strict contract used at load time. The browser exposes no mutation,
    // upload, authentication, or navigation path for this record.
    if (mission.oi_link && IsValidTahaiOiLink(*mission.oi_link)) {
      base::DictValue oi_link;
      oi_link.Set("opaque_reference", mission.oi_link->opaque_reference);
      if (!mission.oi_link->hosted_deep_link.is_empty()) {
        oi_link.Set("hosted_deep_link",
                    mission.oi_link->hosted_deep_link.spec());
      }
      base::DictValue links;
      links.Set("oi", std::move(oi_link));
      value.Set("links", std::move(links));
    }
    base::ListValue evidence;
    for (const MissionEvidence& marker : mission.evidence) {
      base::DictValue evidence_value;
      evidence_value.Set("label", marker.label);
      evidence_value.Set("capture_scope", marker.capture_scope);
      evidence_value.Set("captured_at", marker.captured_at);
      evidence.Append(std::move(evidence_value));
    }
    value.Set("evidence", std::move(evidence));
    base::ListValue notes;
    for (const MissionNote& note : mission.notes) {
      if (!IsSafeMissionNote(note.text) ||
          RedactLocalOiExportText(note.text).blocked ||
          !IsSafeTimestamp(note.created_at)) {
        continue;
      }
      base::DictValue note_value;
      note_value.Set("text", note.text);
      note_value.Set("created_at", note.created_at);
      notes.Append(std::move(note_value));
    }
    value.Set("notes", std::move(notes));
    base::ListValue workflow_inputs;
    if (mission.operational_workflow) {
      for (const MissionWorkflowInput& input : mission.workflow_inputs) {
        if (!IsSafeOperationalIdentifier(input.id) || !IsSafeTitle(input.name) ||
            !IsValidOperationalWorkflowInputValue(input, input.value)) {
          continue;
        }
        base::DictValue saved_input;
        saved_input.Set("id", input.id);
        saved_input.Set("name", input.name);
        saved_input.Set("type", input.type);
        saved_input.Set("required", input.required);
        saved_input.Set("value", input.value);
        if (input.validation) saved_input.Set("validation",
            SerializeTahaiWorkflowInputValidation(*input.validation));
        if (input.is_protected) {
          CHECK(input.value.empty());
          saved_input.Set("protected", true);
          saved_input.Set("protected_value", input.protected_value);
        }
        if (!input.options.empty()) {
          base::ListValue options;
          for (const std::string& option : input.options) {
            if (!IsSafeMissionNote(option)) {
              continue;
            }
            options.Append(option);
          }
          if (!options.empty()) {
            saved_input.Set("options", std::move(options));
          }
        }
        workflow_inputs.Append(std::move(saved_input));
      }
    }
    value.Set("workflow_inputs", std::move(workflow_inputs));
    if (mission.operational_workflow && !mission.workflow_variables.empty()) {
      std::vector<TahaiOperationalWorkflowInput> definitions;
      for (const auto& variable : mission.workflow_variables) definitions.push_back(variable.definition);
      auto variables = SerializeTahaiWorkflowVariables(definitions);
      for (size_t index = 0; index < variables.size(); ++index) {
        const auto& variable = mission.workflow_variables[index];
        variables[index].GetDict().Set(variable.definition.is_protected ? "protected_value" : "value",
                                      variable.definition.is_protected ? variable.protected_value : variable.value);
      }
      value.Set("workflow_variables", std::move(variables));
    }
    if (mission.operational_workflow && !mission.workflow_outputs.empty()) {
      value.Set("workflow_outputs", SerializeTahaiWorkflowOutputs(mission.workflow_outputs));
    }
    base::ListValue timeline;
    for (const MissionEvent& event : mission.timeline) {
      base::DictValue event_value;
      event_value.Set("kind", event.kind);
      event_value.Set("detail", event.detail);
      event_value.Set("created_at", event.created_at);
      event_value.Set("previous_hash", event.previous_hash);
      event_value.Set("entry_hash", event.entry_hash);
      timeline.Append(std::move(event_value));
    }
    value.Set("timeline", std::move(timeline));
    update->Append(std::move(value));
  }
  // Record the committed snapshot before ScopedListPrefUpdate notifies clients;
  // an observer may replace storage, revoke policy or destroy this service.
  loaded_storage_ = base::Value(update->Clone());
}

MissionSummary* MissionService::FindMission(std::string_view mission_id) {
  if (!IsValidId(mission_id)) {
    return nullptr;
  }
  const auto found = std::find_if(missions_.begin(), missions_.end(),
                                  [mission_id](const MissionSummary& mission) {
                                    return mission.id == mission_id;
                                  });
  return found == missions_.end() ? nullptr : &*found;
}

MissionService* MissionServiceFactory::GetForProfile(Profile* profile) {
  return static_cast<MissionService*>(
      GetInstance()->GetServiceForBrowserContext(profile, true));
}

MissionServiceFactory* MissionServiceFactory::GetInstance() {
  static base::NoDestructor<MissionServiceFactory> instance;
  return instance.get();
}

MissionServiceFactory::MissionServiceFactory()
    : ProfileKeyedServiceFactory(
          "tahai::MissionService",
          ProfileSelections::Builder()
              .WithRegular(ProfileSelection::kOwnInstance)
              .WithGuest(ProfileSelection::kOwnInstance)
              .Build()) {}

MissionServiceFactory::~MissionServiceFactory() = default;

std::unique_ptr<KeyedService>
MissionServiceFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  return std::make_unique<MissionService>(static_cast<Profile*>(context));
}

}  // namespace tahai
