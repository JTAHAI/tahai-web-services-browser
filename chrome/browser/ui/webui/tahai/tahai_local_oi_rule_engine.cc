// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_rule_engine.h"

#include <algorithm>
#include <optional>
#include <string_view>

#include "base/strings/string_number_conversions.h"

namespace tahai {
namespace {

const LocalOiEntityRecord* FindEntity(const LocalOiStoreData& data,
                                      std::string_view id) {
  const auto it = std::find_if(
      data.entities.begin(), data.entities.end(),
      [id](const LocalOiEntityRecord& entity) { return entity.id == id; });
  return it == data.entities.end() ? nullptr : &*it;
}

const LocalOiField* FindField(const LocalOiEntityRecord& entity,
                              std::string_view key) {
  const auto it = std::find_if(
      entity.fields.begin(), entity.fields.end(),
      [key](const LocalOiField& field) { return field.key == key; });
  return it == entity.fields.end() ? nullptr : &*it;
}

bool HasFieldValue(const LocalOiEntityRecord& entity,
                   std::string_view key,
                   std::string_view value) {
  const LocalOiField* field = FindField(entity, key);
  return field && field->value == value;
}

int FieldInt(const LocalOiEntityRecord& entity,
             std::string_view key,
             int fallback) {
  const LocalOiField* field = FindField(entity, key);
  int value = fallback;
  return field && base::StringToInt(field->value, &value) ? value : fallback;
}

bool HasEntity(const LocalOiStoreData& data,
               LocalOiEntityType type,
               std::string_view mission_id) {
  return std::any_of(data.entities.begin(), data.entities.end(),
                     [type, mission_id](const LocalOiEntityRecord& entity) {
                       return entity.type == type &&
                              entity.mission_id == mission_id &&
                              !entity.archived;
                     });
}

bool HasRelatedEntityWithField(const LocalOiStoreData& data,
                               LocalOiEntityType type,
                               std::string_view mission_id,
                               std::string_view key,
                               std::string_view value) {
  return std::any_of(
      data.entities.begin(), data.entities.end(),
      [type, mission_id, key, value](const LocalOiEntityRecord& entity) {
        return entity.type == type && entity.mission_id == mission_id &&
               HasFieldValue(entity, key, value);
      });
}

bool HasDocumentationReferenceForEndpoint(const LocalOiStoreData& data,
                                          std::string_view endpoint_id) {
  return std::any_of(data.entities.begin(), data.entities.end(),
                     [endpoint_id](const LocalOiEntityRecord& entity) {
                       return entity.type ==
                                  LocalOiEntityType::kDocumentReference &&
                              !entity.archived &&
                              HasFieldValue(entity, "endpoint_id", endpoint_id);
                     });
}

bool IsEnvironmentGuardReference(const LocalOiEntityRecord& entity) {
  return entity.type == LocalOiEntityType::kEndpoint &&
         FindField(entity, "environment") &&
         HasFieldValue(entity, "browser_wide_enforcement", "false");
}

void AddProposal(std::vector<LocalOiRuleProposal>* proposals,
                 std::string_view rule_id,
                 std::string_view category,
                 LocalOiFindingSeverity severity,
                 std::string_view title,
                 std::string_view explanation,
                 std::vector<std::string> affected,
                 std::vector<std::string> evidence,
                 std::string_view remediation,
                 std::string_view key_entity) {
  LocalOiRuleProposal proposal;
  proposal.stable_key = std::string(rule_id) + ":" + std::string(key_entity);
  proposal.rule_id = std::string(rule_id);
  proposal.category = std::string(category);
  proposal.severity = severity;
  proposal.title = std::string(title);
  proposal.explanation = std::string(explanation);
  proposal.affected_entity_ids = std::move(affected);
  proposal.supporting_evidence_ids = std::move(evidence);
  proposal.remediation = std::string(remediation);
  proposal.source_basis = proposal.stable_key;
  proposals->push_back(std::move(proposal));
}

void EvaluateMissionReadiness(const LocalOiStoreData& data,
                              const LocalOiEntityRecord& mission,
                              std::vector<LocalOiRuleProposal>* proposals) {
  const std::vector<std::string> affected = {mission.id};
  if (!HasFieldValue(mission, "has_objective", "true")) {
    AddProposal(
        proposals, "local_oi.mission.no_objective.v1", "mission_readiness",
        LocalOiFindingSeverity::kHigh, "Mission has no objective",
        "The local Mission record has no bounded objective field.", affected,
        {}, "Add a bounded objective in Mission Control.", mission.id);
  }
  if (!HasEntity(data, LocalOiEntityType::kRunbook, mission.id)) {
    AddProposal(proposals, "local_oi.mission.no_runbook.v1",
                "mission_readiness", LocalOiFindingSeverity::kHigh,
                "Mission has no runbook",
                "No local runbook record is linked to this Mission.", affected,
                {}, "Create or restore the Mission runbook.", mission.id);
  }
  if (!HasRelatedEntityWithField(data, LocalOiEntityType::kRunbook, mission.id,
                                 "phase", "validation")) {
    AddProposal(proposals, "local_oi.mission.no_validation_plan.v1",
                "mission_readiness", LocalOiFindingSeverity::kHigh,
                "Mission has no validation plan",
                "No local validation runbook is linked to this Mission.",
                affected, {}, "Add validation steps before closeout.",
                mission.id);
  }
  if (!HasRelatedEntityWithField(data, LocalOiEntityType::kRunbook, mission.id,
                                 "phase", "rollback")) {
    AddProposal(proposals, "local_oi.mission.no_rollback_condition.v1",
                "mission_readiness", LocalOiFindingSeverity::kHigh,
                "Mission has no rollback condition",
                "No rollback runbook is linked to this Mission.", affected, {},
                "Record rollback authority, trigger, and a restore path.",
                mission.id);
  }
  if (HasFieldValue(mission, "escalation_required", "true")) {
    AddProposal(
        proposals, "local_oi.mission.unresolved_blocker.v1",
        "operational_follow_through", LocalOiFindingSeverity::kHigh,
        "Mission has an unresolved blocker",
        "Mission Control records escalation as required.", affected, {},
        "Clear the blocker or keep the Mission in an explicit handoff state.",
        mission.id);
  }
  const int incomplete_preflight = FieldInt(mission, "preflight_incomplete", 0);
  if (incomplete_preflight > 0) {
    AddProposal(proposals, "local_oi.mission.preflight_incomplete.v1",
                "mission_readiness", LocalOiFindingSeverity::kMedium,
                "Required preflight checks are incomplete",
                "The Mission has unfinished preflight checkpoints.", affected,
                {}, "Complete or explicitly defer each preflight check.",
                mission.id);
  }
  if (!HasEntity(data, LocalOiEntityType::kEvidence, mission.id)) {
    AddProposal(
        proposals, "local_oi.mission.no_evidence.v1", "evidence_intelligence",
        LocalOiFindingSeverity::kMedium, "Mission has no recent evidence",
        "No local evidence record is linked to this Mission.", affected, {},
        "Capture approved evidence metadata for the current work.", mission.id);
  }
  const bool has_evidence =
      HasEntity(data, LocalOiEntityType::kEvidence, mission.id);
  const int validation_complete = FieldInt(mission, "validation_complete", 0);
  const int validation_total = FieldInt(mission, "validation_total", 0);
  if (has_evidence && validation_total > 0 &&
      validation_complete < validation_total) {
    AddProposal(
        proposals, "local_oi.mission.evidence_no_final_validation.v1",
        "mission_readiness", LocalOiFindingSeverity::kMedium,
        "Evidence exists but final validation is incomplete",
        "Local evidence is present while validation checkpoints remain open.",
        affected, {}, "Complete final validation or record why it is deferred.",
        mission.id);
  }
  if (mission.archived &&
      HasFieldValue(mission, "escalation_required", "true")) {
    AddProposal(proposals, "local_oi.mission.complete_with_blockers.v1",
                "operational_follow_through", LocalOiFindingSeverity::kHigh,
                "Archived Mission retains unresolved blockers",
                "The Mission was archived while escalation remains required.",
                affected, {},
                "Restore it to resolve the blocker or record a handoff.",
                mission.id);
  }
  if (HasFieldValue(mission, "mission_type", "change") &&
      !HasFieldValue(mission, "before_snapshot", "true")) {
    AddProposal(proposals, "local_oi.change.no_before_snapshot.v1",
                "change_intelligence", LocalOiFindingSeverity::kMedium,
                "Change has no before snapshot",
                "The local change Mission has no approved before-state record.",
                affected, {},
                "Capture a safe before snapshot or document the limitation.",
                mission.id);
  }
  if (HasFieldValue(mission, "mission_type", "change") &&
      !HasFieldValue(mission, "after_snapshot", "true")) {
    AddProposal(proposals, "local_oi.change.no_after_snapshot.v1",
                "change_intelligence", LocalOiFindingSeverity::kMedium,
                "Change has no after snapshot",
                "The local change Mission has no approved after-state record.",
                affected, {},
                "Capture a safe after snapshot or document the limitation.",
                mission.id);
  }
}

void EvaluateRecordQuality(const LocalOiStoreData& data,
                           const LocalOiEntityRecord& entity,
                           std::vector<LocalOiRuleProposal>* proposals) {
  const std::vector<std::string> affected = {entity.id};
  if (entity.type == LocalOiEntityType::kEndpoint &&
      !IsEnvironmentGuardReference(entity)) {
    if (!HasDocumentationReferenceForEndpoint(data, entity.id)) {
      AddProposal(proposals, "local_oi.knowledge.endpoint_no_documentation.v1",
                  "knowledge_gap", LocalOiFindingSeverity::kLow,
                  "Referenced endpoint has no documentation",
                  "No approved document reference identifies this endpoint.",
                  affected, {},
                  "Add a safe document reference for the endpoint.", entity.id);
    }
    if (!HasFieldValue(entity, "dns_baseline", "true") ||
        !HasFieldValue(entity, "tls_baseline", "true")) {
      AddProposal(
          proposals, "local_oi.knowledge.endpoint_no_baseline.v1",
          "knowledge_gap", LocalOiFindingSeverity::kLow,
          "Endpoint has no current TLS or DNS baseline",
          "The endpoint record lacks at least one typed baseline marker.",
          affected, {}, "Record approved DNS and TLS result summaries.",
          entity.id);
    }
    if (HasFieldValue(entity, "tls_certificate_revoked", "true")) {
      AddProposal(
          proposals, "local_oi.endpoint.tls_certificate_revoked.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kCritical,
          "Endpoint certificate is revoked",
          "The explicit local TLS inspection recorded Chromium's revoked "
          "certificate status. This finding retains only the fixed failure "
          "class and no certificate chain.",
          affected, {},
          "Stop relying on this endpoint until its certificate is replaced and "
          "a new explicit inspection records a valid result.",
          entity.id);
    } else if (HasFieldValue(entity, "tls_certificate_authority_invalid",
                             "true")) {
      AddProposal(
          proposals, "local_oi.endpoint.tls_certificate_authority_invalid.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kHigh,
          "Endpoint certificate authority is not trusted",
          "The explicit local TLS inspection recorded Chromium's untrusted "
          "certificate-authority status. This finding retains only the fixed "
          "failure class and no certificate chain.",
          affected, {},
          "Review the public certificate chain and trust configuration, then "
          "record a new explicit inspection.",
          entity.id);
    } else if (HasFieldValue(entity, "tls_certificate_name_mismatch", "true")) {
      AddProposal(
          proposals, "local_oi.endpoint.tls_certificate_name_mismatch.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kHigh,
          "Endpoint certificate does not match the target",
          "The explicit local TLS inspection recorded Chromium's certificate "
          "name-mismatch status. This finding retains only the fixed failure "
          "class and no certificate chain.",
          affected, {},
          "Correct the public certificate name coverage or inspect the "
          "intended host, then record a new explicit inspection.",
          entity.id);
    } else if (HasFieldValue(entity, "tls_info_available", "true") &&
               !HasFieldValue(entity, "tls_certificate_valid", "true")) {
      AddProposal(
          proposals, "local_oi.endpoint.tls_certificate_invalid.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kHigh,
          "Endpoint certificate did not validate",
          "The explicit local TLS inspection reported a certificate problem.",
          affected, {},
          "Review Chromium's certificate diagnostics before relying on this "
          "endpoint.",
          entity.id);
    }
    if (HasFieldValue(entity, "tls_info_available", "true")) {
      const int days_remaining = FieldInt(entity, "tls_days_remaining", -1);
      if (HasFieldValue(entity, "tls_certificate_expired", "true")) {
        AddProposal(proposals, "local_oi.endpoint.tls_certificate_expired.v1",
                    "endpoint_intelligence", LocalOiFindingSeverity::kCritical,
                    "Endpoint certificate is expired",
                    "The local TLS inspection recorded a certificate expiry in "
                    "the past.",
                    affected, {},
                    "Renew or replace the certificate, then inspect again.",
                    entity.id);
      } else if (days_remaining >= 0 && days_remaining <= 3) {
        AddProposal(
            proposals, "local_oi.endpoint.tls_certificate_imminent.v1",
            "endpoint_intelligence", LocalOiFindingSeverity::kHigh,
            "Endpoint certificate expires imminently",
            "The local TLS inspection recorded three or fewer days remaining.",
            affected, {},
            "Prioritize certificate renewal and re-inspect after deployment.",
            entity.id);
      } else if (days_remaining >= 0 && days_remaining <= 14) {
        AddProposal(proposals, "local_oi.endpoint.tls_certificate_expiring.v1",
                    "endpoint_intelligence", LocalOiFindingSeverity::kMedium,
                    "Endpoint certificate expires soon",
                    "The local TLS inspection recorded fourteen or fewer days "
                    "remaining.",
                    affected, {},
                    "Plan certificate renewal and re-inspect after deployment.",
                    entity.id);
      }
    }
    if (HasFieldValue(entity, "tls_info_available", "true") &&
        (HasFieldValue(entity, "tls_version", "TLS 1.0") ||
         HasFieldValue(entity, "tls_version", "TLS 1.1"))) {
      AddProposal(
          proposals, "local_oi.endpoint.legacy_tls_version.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kMedium,
          "Endpoint uses a legacy TLS version",
          "The explicit local TLS inspection recorded TLS 1.0 or TLS 1.1. "
          "This is a transport observation, not an authenticated service "
          "assessment.",
          affected, {},
          "Confirm the intended public transport policy and remove legacy TLS "
          "support where appropriate, then record a new explicit inspection.",
          entity.id);
    }
    const int dns_net_error = FieldInt(entity, "dns_net_error", 0);
    if (dns_net_error != 0) {
      AddProposal(proposals, "local_oi.endpoint.dns_resolution_failed.v1",
                  "endpoint_intelligence", LocalOiFindingSeverity::kMedium,
                  "Endpoint DNS resolution failed",
                  "The explicit local DNS inspection returned a network error.",
                  affected, {},
                  "Check the entered host, local DNS policy, and resolver "
                  "reachability.",
                  entity.id);
    }
    const int request_net_error = FieldInt(entity, "request_net_error", 0);
    if (HasFieldValue(entity, "public_address_guard_blocked", "true")) {
      AddProposal(
          proposals, "local_oi.endpoint.public_address_guard_blocked.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kMedium,
          "Public address guard blocked inspection",
          "DNS did not resolve exclusively to publicly routable addresses, so "
          "the explicit HTTPS probe was not sent.",
          affected, {},
          "Review the public hostname and resolver path before re-running the "
          "explicit inspection.",
          entity.id);
    } else if (request_net_error != 0) {
      AddProposal(
          proposals, "local_oi.endpoint.https_probe_failed.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kMedium,
          "Explicit HTTPS probe failed",
          "The user-initiated credential-free HTTPS HEAD probe returned a "
          "network error. No page content or authenticated request was made.",
          affected, {},
          "Review transport diagnostics and inspect the public endpoint again "
          "after correcting the network condition.",
          entity.id);
    }
    const int http_status = FieldInt(entity, "http_status", 0);
    if (http_status >= 500 && http_status <= 599) {
      AddProposal(
          proposals, "local_oi.endpoint.https_server_error.v1",
          "endpoint_intelligence", LocalOiFindingSeverity::kMedium,
          "Explicit HTTPS probe returned a server error",
          "The user-initiated credential-free HTTPS HEAD probe returned a "
          "5xx status. Redirects were disabled and no response body or raw "
          "headers were collected.",
          affected, {},
          "Review the public service health and re-run the explicit probe "
          "after remediation.",
          entity.id);
    }
    if (request_net_error == 0 && http_status >= 200 && http_status <= 399 &&
        HasFieldValue(entity, "security_header_observation_available",
                      "true") &&
        FieldInt(entity, "observed_security_header_count", -1) == 0) {
      AddProposal(
          proposals, "local_oi.endpoint.http_security_headers_not_observed.v1",
          "knowledge_gap", LocalOiFindingSeverity::kLow,
          "No selected HTTP security headers were observed",
          "The credential-free public HEAD response did not expose any of the "
          "six fixed security headers that Local OI observes by presence only. "
          "No header values or authenticated response data were retained.",
          affected, {},
          "Review the intended public service security-header posture outside "
          "Local OI, then record a new explicit inspection.",
          entity.id);
    }
  }
  if (entity.type == LocalOiEntityType::kArtifact) {
    if (!HasFieldValue(entity, "hash_present", "true")) {
      AddProposal(
          proposals, "local_oi.artifact.missing_hash.v1",
          "artifact_intelligence", LocalOiFindingSeverity::kMedium,
          "Artifact has no hash",
          "The artifact metadata does not contain an approved checksum.",
          affected, {}, "Hash the artifact before relying on it.", entity.id);
    }
    if (!HasFieldValue(entity, "source_origin_present", "true")) {
      AddProposal(proposals, "local_oi.artifact.source_missing.v1",
                  "artifact_intelligence", LocalOiFindingSeverity::kLow,
                  "Artifact source origin is missing",
                  "The artifact metadata has no approved provenance field.",
                  affected, {}, "Record safe source provenance metadata.",
                  entity.id);
    }
    if (entity.mission_id.empty()) {
      AddProposal(proposals, "local_oi.artifact.not_linked_to_mission.v1",
                  "artifact_intelligence", LocalOiFindingSeverity::kLow,
                  "Artifact is not linked to a Mission",
                  "The artifact record has no local Mission association.",
                  affected, {},
                  "Associate the artifact with an active Mission.", entity.id);
    }
    const LocalOiField* source_origin = FindField(entity, "source_origin");
    const LocalOiField* sha256_digest = FindField(entity, "sha256_digest");
    if (source_origin && sha256_digest) {
      const auto conflicting = std::find_if(
          data.entities.begin(), data.entities.end(),
          [&entity, source_origin,
           sha256_digest](const LocalOiEntityRecord& candidate) {
            const LocalOiField* candidate_origin =
                FindField(candidate, "source_origin");
            const LocalOiField* candidate_digest =
                FindField(candidate, "sha256_digest");
            return candidate.type == LocalOiEntityType::kArtifact &&
                   !candidate.archived && candidate.id > entity.id &&
                   candidate_origin && candidate_digest &&
                   candidate_origin->value == source_origin->value &&
                   candidate_digest->value != sha256_digest->value;
          });
      if (conflicting != data.entities.end()) {
        AddProposal(
            proposals, "local_oi.artifact.same_source_different_hash.v1",
            "artifact_intelligence", LocalOiFindingSeverity::kHigh,
            "Artifact source has conflicting hashes",
            "Two explicit local artifact records name the same approved "
            "source but retain different SHA-256 values. The values are not "
            "displayed in this finding.",
            {entity.id, conflicting->id}, {},
            "Verify the approved artifact outside Local OI, then record the "
            "intended provenance and retire the conflicting local record.",
            entity.id);
      }
    }
  }
  if (entity.type == LocalOiEntityType::kEvidence) {
    if (!HasFieldValue(entity, "provenance_present", "true")) {
      AddProposal(proposals, "local_oi.evidence.missing_provenance.v1",
                  "evidence_intelligence", LocalOiFindingSeverity::kMedium,
                  "Evidence is missing provenance",
                  "The evidence record does not explain its local source.",
                  affected, {}, "Record an approved local provenance label.",
                  entity.id);
    }
    if (entity.mission_id.empty()) {
      AddProposal(proposals, "local_oi.knowledge.evidence_no_mission.v1",
                  "knowledge_gap", LocalOiFindingSeverity::kLow,
                  "Evidence has no associated Mission",
                  "The evidence record is not linked to a local Mission.",
                  affected, {}, "Associate it with a Mission or remove it.",
                  entity.id);
    }
  }
  if (entity.type == LocalOiEntityType::kToolResult &&
      HasFieldValue(entity, "is_current", "true") &&
      HasFieldValue(entity, "change_state", "changed")) {
    AddProposal(
        proposals, "local_oi.change.digest_changed.v1", "change_intelligence",
        LocalOiFindingSeverity::kMedium, "Explicit Change Lens digest changed",
        "The newest operator-supplied SHA-256 digest differs from the prior "
        "local digest for the same approved target. No source material was "
        "collected or reconstructed.",
        affected, {},
        "Review the approved source outside Local OI, then record a new "
        "baseline or resolve this local finding.",
        entity.id);
  }
  if (entity.type == LocalOiEntityType::kToolResult &&
      HasFieldValue(entity, "inspection_kind", "dns_tls") &&
      HasFieldValue(entity, "is_current", "true") &&
      HasFieldValue(entity, "diagnostic_comparison", "changed")) {
    AddProposal(
        proposals, "local_oi.diagnostic.transport_metadata_changed.v1",
        "endpoint_intelligence", LocalOiFindingSeverity::kMedium,
        "Explicit DNS/TLS inspection metadata changed",
        "The newest user-initiated DNS/TLS result differs from the prior "
        "local result for this host in one or more bounded transport fields. "
        "No page body, raw header, credential, or browser data was compared.",
        affected, {},
        "Review the explicit support results, confirm the intended change, "
        "and inspect again after remediation.",
        entity.id);
  }
  if (entity.type == LocalOiEntityType::kNote && entity.mission_id.empty()) {
    AddProposal(proposals, "local_oi.knowledge.note_no_affected_entity.v1",
                "knowledge_gap", LocalOiFindingSeverity::kLow,
                "Operational note has no affected entity",
                "The explicitly entered note is not associated with a Mission.",
                affected, {},
                "Associate the note with an affected local record.", entity.id);
  }
}

void EvaluateRelationshipIntegrity(
    const LocalOiStoreData& data,
    std::vector<LocalOiRuleProposal>* proposals) {
  for (const LocalOiRelationshipRecord& relationship : data.relationships) {
    if (!FindEntity(data, relationship.source_id) ||
        !FindEntity(data, relationship.target_id)) {
      AddProposal(proposals, "local_oi.knowledge.orphaned_relationship.v1",
                  "knowledge_gap", LocalOiFindingSeverity::kLow,
                  "Relationship references deleted data",
                  "A typed relationship endpoint is no longer present locally.",
                  {relationship.source_id, relationship.target_id}, {},
                  "Remove or reconnect the orphaned relationship.",
                  relationship.id);
    }
  }
}

}  // namespace

TahaiLocalOiRuleEngine::TahaiLocalOiRuleEngine() = default;
TahaiLocalOiRuleEngine::~TahaiLocalOiRuleEngine() = default;

std::vector<LocalOiRuleProposal> TahaiLocalOiRuleEngine::Evaluate(
    const LocalOiStoreData& data) const {
  std::vector<LocalOiRuleProposal> proposals;
  for (const LocalOiEntityRecord& entity : data.entities) {
    if (entity.type == LocalOiEntityType::kMission) {
      EvaluateMissionReadiness(data, entity, &proposals);
    }
    EvaluateRecordQuality(data, entity, &proposals);
  }
  EvaluateRelationshipIntegrity(data, &proposals);
  return proposals;
}

}  // namespace tahai
