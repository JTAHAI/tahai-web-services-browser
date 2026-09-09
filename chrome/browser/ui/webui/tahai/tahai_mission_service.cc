// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"

#include <algorithm>
#include <array>
#include <memory>
#include <utility>

#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/time/time.h"
#include "base/uuid.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_capsule.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "crypto/sha2.h"

namespace tahai {
namespace {

constexpr std::array<std::string_view, 11> kAllowedMissionTypes = {
    "incident",      "change",      "audit",         "deployment",
    "investigation", "maintenance", "documentation", "migration",
    "admin",         "support",     "development"};

constexpr size_t kMaximumMissions = 500u;
constexpr size_t kMaximumTimelineEvents = 64u;
constexpr size_t kMaximumEvidenceMarkers = 12u;
constexpr std::string_view kDuplicateTitleSuffix = " copy";

constexpr std::array<std::string_view, 6> kAllowedTimelineKinds = {
    "mission", "runbook", "validation", "rollback", "evidence", "export"};
constexpr std::array<std::string_view, 6> kAllowedExportProfiles = {
    "sanitized-handoff", "internal",    "incident-packet",
    "change-record",     "itdocs-sync", "psa-ticket-note"};

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

bool IsSafeTitle(std::string_view title) {
  if (title.empty() || title.size() > 128u) {
    return false;
  }
  for (char c : title) {
    if (static_cast<unsigned char>(c) < 0x20u) {
      return false;
    }
  }
  return true;
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
  return base::StrCat({title.substr(0, 128u - kDuplicateTitleSuffix.size()),
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

bool IsGeneratedTimelineDetail(std::string_view type,
                               std::string_view kind,
                               std::string_view detail) {
  if (kind == "mission") {
    return detail == "Mission created" || detail == "Mission loaded" ||
           detail == "Mission archived" || detail == "Mission restored";
  }
  if (kind == "runbook") {
    return detail == "Operator escalation marked required" ||
           detail == "Operator escalation marked cleared" ||
           MatchesGeneratedStepEvent(detail, "Checkpoint", DefaultSteps(type));
  }
  if (kind == "validation") {
    return MatchesGeneratedStepEvent(detail, "Validation",
                                     DefaultValidationSteps(type));
  }
  if (kind == "rollback") {
    return MatchesGeneratedStepEvent(detail, "Rollback",
                                     DefaultRollbackSteps(type));
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
}

bool ToggleGeneratedStep(MissionSummary* mission,
                         std::vector<MissionStep>* steps,
                         size_t step_index,
                         std::string_view timeline_kind,
                         std::string_view label) {
  if (!mission || !steps || step_index >= steps->size()) {
    return false;
  }
  MissionStep& step = (*steps)[step_index];
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

std::optional<MissionSummary> MissionService::CreateMission(
    std::string_view title,
    std::string_view type) {
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

  const std::optional<MissionSummary> created =
      CreateMission("Imported encrypted capsule", capsule.mission_type);
  if (!created) {
    return std::nullopt;
  }
  const std::string mission_id = created->id;
  for (size_t index = 0; index < capsule.checkpoint_complete.size(); ++index) {
    if (capsule.checkpoint_complete[index]) {
      CHECK(ToggleStep(mission_id, index));
    }
  }
  for (size_t index = 0; index < capsule.validation_complete.size(); ++index) {
    if (capsule.validation_complete[index]) {
      CHECK(ToggleValidationStep(mission_id, index));
    }
  }
  for (size_t index = 0; index < capsule.rollback_complete.size(); ++index) {
    if (capsule.rollback_complete[index]) {
      CHECK(ToggleRollbackStep(mission_id, index));
    }
  }
  CHECK(SetExportProfile(mission_id, capsule.export_profile));
  for (size_t count = 0; count < capsule.evidence_marker_count; ++count) {
    CHECK(AddEvidenceMarker(mission_id));
  }
  MissionSummary* imported = FindMission(mission_id);
  CHECK(imported);
  return *imported;
}

bool MissionService::ToggleStep(std::string_view mission_id,
                                size_t step_index) {
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived ||
      !ToggleGeneratedStep(mission, &mission->steps, step_index, "runbook",
                           "Checkpoint")) {
    return false;
  }
  Save();
  return true;
}

bool MissionService::ToggleValidationStep(std::string_view mission_id,
                                          size_t step_index) {
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
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived ||
      !ToggleGeneratedStep(mission, &mission->rollback_steps, step_index,
                           "rollback", "Rollback")) {
    return false;
  }
  Save();
  return true;
}

bool MissionService::ToggleEscalation(std::string_view mission_id) {
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

bool MissionService::SetExportProfile(std::string_view mission_id,
                                      std::string_view export_profile) {
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

bool MissionService::ArchiveMission(std::string_view mission_id) {
  MissionSummary* mission = FindMission(mission_id);
  if (!mission || mission->archived) {
    return false;
  }
  mission->archived = true;
  AppendGeneratedEvent(mission, "mission", "Mission archived");
  Save();
  return true;
}

bool MissionService::RestoreMission(std::string_view mission_id) {
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
  for (const base::Value& mission_value :
       prefs_->GetList(prefs::kTahaiMissions)) {
    const base::DictValue* dict = mission_value.GetIfDict();
    if (!dict) {
      continue;
    }
    const std::string* id = dict->FindString("id");
    const std::string* title = dict->FindString("title");
    const std::string* type = dict->FindString("type");
    const std::string* created_at = dict->FindString("created_at");
    if (!id || !title || !type || !created_at || !IsValidId(*id) ||
        !IsSafeTitle(*title) || !IsSafeTimestamp(*created_at) ||
        !IsAllowedType(*type)) {
      continue;
    }
    MissionSummary mission;
    mission.id = *id;
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
    load_steps("steps", &mission.steps);
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
    bool discarded_ledger_record = false;
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
            !IsGeneratedTimelineDetail(mission.type, *kind, *detail) ||
            !IsSafeTimestamp(*event_created_at)) {
          continue;
        }
        const std::string* previous_hash = event->FindString("previous_hash");
        const std::string* entry_hash = event->FindString("entry_hash");
        if ((previous_hash || entry_hash) &&
            (!previous_hash || !entry_hash ||
             (!previous_hash->empty() && !IsLedgerHash(*previous_hash)) ||
             !IsLedgerHash(*entry_hash))) {
          // An otherwise valid generated record with a malformed ledger is
          // different from an arbitrary preference payload. Keep the latter
          // out of Mission state silently; retain an explicit integrity
          // warning for the former so it cannot be exported as evidence.
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
      mission.timeline_integrity_verified = !discarded_ledger_record;
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
    missions_.push_back(std::move(mission));
    if (missions_.size() == kMaximumMissions) {
      break;
    }
  }
}

void MissionService::Save() {
  if (!persistence_enabled()) {
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
    const auto save_steps = [&value](std::string_view key,
                                     const std::vector<MissionStep>& steps) {
      base::ListValue saved_steps;
      for (const MissionStep& step : steps) {
        base::DictValue step_value;
        step_value.Set("label", step.label);
        step_value.Set("complete", step.complete);
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
