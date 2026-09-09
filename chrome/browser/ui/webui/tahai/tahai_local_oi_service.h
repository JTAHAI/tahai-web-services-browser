// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_SERVICE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_SERVICE_H_

#include <optional>
#include <string_view>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "chrome/browser/ui/webui/tahai/tahai_change_lens_contract.h"
#include "chrome/browser/ui/webui/tahai/tahai_environment_guard.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_model.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_rule_engine.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_store.h"
#include "chrome/browser/ui/webui/tahai/tahai_network_inspector.h"
#include "chrome/browser/ui/webui/tahai/tahai_sentinel_contract.h"
#include "components/keyed_service/core/keyed_service.h"

class Profile;

namespace tahai {

struct MissionSummary;

// The result of an explicit safe-digest comparison. The record ID and all
// fields refer only to local typed metadata; no captured material is retained.
struct LocalOiChangeCaptureOutcome {
  std::string record_id;
  TahaiChangeCapture capture;
  bool created_baseline = false;
  bool linked_to_mission = false;
  TahaiChangeComparisonResult comparison =
      TahaiChangeComparisonResult::kInvalidCapture;
};

// An artifact record is intentionally metadata-only. `title` is a human
// label and is never resolved as a filename or local path; `source_url` must be
// a public, query-free HTTPS URL; `sha256_digest` is a lowercase SHA-256 value.
struct LocalOiArtifactRequest {
  std::string title;
  std::string source_url;
  std::string sha256_digest;
  std::string mission_id;
};

struct LocalOiArtifactOutcome {
  std::string record_id;
  std::string canonical_source_url;
  bool linked_to_mission = false;
};

// A document reference is deliberately a label and a public, query-free HTTPS
// pointer. Local OI never opens, reads, indexes, screenshots, or copies the
// referenced material; the endpoint association is a local typed edge only.
struct LocalOiDocumentReferenceRequest {
  std::string title;
  std::string reference_url;
  std::string endpoint_id;
  std::string mission_id;
};

struct LocalOiDocumentReferenceOutcome {
  std::string record_id;
  std::string canonical_reference_url;
  std::string endpoint_id;
  bool linked_to_mission = false;
};

struct LocalOiManualWatchOutcome {
  std::string record_id;
  std::string canonical_target;
  TahaiSentinelWatchKind kind = TahaiSentinelWatchKind::kDnsRecord;
  int interval_seconds = 0;
  bool linked_to_mission = false;
};

struct LocalOiEnvironmentClassificationOutcome {
  std::string record_id;
  std::string canonical_origin;
  TahaiEnvironment environment = TahaiEnvironment::kProduction;
  bool linked_to_mission = false;
};

// A bounded, profile-local view of a past explicit DNS/TLS inspection. It
// excludes address and alias values, certificate names, header data, response
// bodies, credentials, and any browser activity. It retains only bounded DNS
// address-family/alias and fixed-vocabulary HTTP security-header counts. It
// is not a watcher feed.
struct LocalOiNetworkInspectionHistoryItem {
  std::string inspected_at;
  std::string comparison;
  std::string changed_fields;
  int resolved_ipv4_count = 0;
  int resolved_ipv6_count = 0;
  int dns_alias_count = 0;
  bool security_header_observation_available = false;
  int observed_security_header_count = 0;
  int dns_net_error = 0;
  int request_net_error = 0;
  bool public_address_guard_blocked = false;
  int http_status = 0;
  bool tls_info_available = false;
  bool certificate_valid = false;
  bool certificate_expired = false;
  int certificate_days_remaining = -1;
};

// A bounded, profile-local view of a prior explicit Change Lens record. It
// deliberately omits the supplied digest and target; the caller must already
// hold the validated exact kind/target context that scopes this local read.
struct LocalOiChangeCaptureHistoryItem {
  std::string recorded_at;
  std::string comparison;
  bool is_current = false;
};

// A bounded view of explicit artifact-integrity metadata for one approved
// public source origin. It intentionally excludes the origin, digest, local
// path, file name, bytes, and any download/browser record.
struct LocalOiArtifactHistoryItem {
  std::string recorded_at;
  std::string label;
  bool digest_recorded = false;
};

// The visible posture from one explicit local Environment Guard entry. It is
// metadata only: it does not reflect page inspection, navigation policy,
// account state, or browser-wide protection.
struct LocalOiEnvironmentClassificationItem {
  std::string origin;
  std::string environment;
  bool persistent_boundary = false;
  bool redaction_preview = false;
  bool pilot_actions_blocked = false;
};

// One validated documentation pointer currently associated with an explicit
// local endpoint. It is link metadata only; referenced material never enters
// this structure or the Local OI store.
struct LocalOiDocumentReferenceItem {
  std::string recorded_at;
  std::string label;
  std::string reference_url;
};

// A validated manual-only recheck configuration. Its due state is only an
// operator aid; it is not a scheduled task, watch feed, or background network
// activity.
struct LocalOiManualWatchItem {
  std::string record_id;
  std::string title;
  std::string target;
  std::string kind;
  std::string mission_id;
  int interval_seconds = 0;
  std::string last_completed_at;
  std::string schedule_state;
  int seconds_until_due = 0;
};

// The profile-local entry point for all Local OI data. It is deliberately
// narrow: typed browser subsystems can contribute validated records, while a
// page, extension, or arbitrary URL cannot reach the store directly.
class TahaiLocalOiService : public KeyedService {
 public:
  explicit TahaiLocalOiService(Profile* profile);
  TahaiLocalOiService(const TahaiLocalOiService&) = delete;
  TahaiLocalOiService& operator=(const TahaiLocalOiService&) = delete;
  ~TahaiLocalOiService() override;

  const LocalOiStoreData& data() const { return store_.data(); }
  LocalOiStoreStatus store_status() const { return store_.status(); }
  bool available() const { return !shutdown_; }

  bool UpsertEntity(LocalOiEntityRecord record);
  bool UpsertRelationship(LocalOiRelationshipRecord record);
  bool UpsertFinding(LocalOiFindingRecord record);
  bool AppendMemory(LocalOiMemoryRecord record);
  bool AddReport(LocalOiReportRecord record);
  bool DeleteEntity(std::string_view entity_id);
  bool DeleteAllData();

  // Persists the bounded metadata from a user-initiated DNS/TLS inspection.
  // It accepts no arbitrary page, request, or response data and remains gated
  // by the Local OI operations-tool policy preference.
  // `mission_id`, when supplied, must identify an active local Mission.
  // `watch_id`, when supplied, must identify a matching DNS/TLS manual-watch
  // configuration with the same Mission context. The inspection data remains
  // the same bounded metadata; associations add only typed local context.
  bool RecordNetworkInspection(const TahaiNetworkInspectionResult& result,
                               std::string_view mission_id = {},
                               std::string_view watch_id = {});

  // Returns the newest bounded history rows for one validated public support
  // host. It never causes an inspection, schedules work, or expose raw
  // transport artifacts.
  std::vector<LocalOiNetworkInspectionHistoryItem> NetworkInspectionHistory(
      std::string_view host) const;

  // Records an operator-supplied SHA-256 digest after Change Lens validation.
  // This is a comparison of two safe digests only; it cannot fetch, retain,
  // reconstruct, or export the original DNS/TLS/HTTP/download material.
  std::optional<LocalOiChangeCaptureOutcome> RecordChangeCapture(
      const TahaiChangeCaptureRequest& request,
      std::string_view mission_id = {});

  // Returns newest local comparison states for one exact validated Change Lens
  // kind/target pair. It never fetches a target, reads a digest, schedules a
  // capture, or exposes the digest to the caller.
  std::vector<LocalOiChangeCaptureHistoryItem> ChangeCaptureHistory(
      TahaiChangeCaptureKind kind,
      std::string_view target) const;

  // Records explicitly supplied artifact provenance and integrity metadata.
  // It never opens the URL, reads a local file, derives a hash, or stores a
  // local path, file name, response body, header, credential, or cookie.
  std::optional<LocalOiArtifactOutcome> RecordArtifactMetadata(
      const LocalOiArtifactRequest& request);

  // Returns newest local artifact-integrity metadata for one exact validated
  // public source origin. It neither opens the origin nor accesses the
  // download shelf, filesystem, bytes, or supplied digest.
  std::vector<LocalOiArtifactHistoryItem> ArtifactHistory(
      std::string_view source_url) const;

  // Records a safe, operator-entered documentation pointer for an existing
  // local Endpoint, optionally with an active local Mission context. It never
  // navigates to the reference or turns Local OI into a documentation
  // connector, corpus, or browser-content collector.
  std::optional<LocalOiDocumentReferenceOutcome> RecordDocumentReference(
      const LocalOiDocumentReferenceRequest& request);

  // Returns current explicit documentation pointers for one active local
  // Endpoint. The read does not navigate, fetch, index, or open a pointer.
  std::vector<LocalOiDocumentReferenceItem> DocumentReferencesForEndpoint(
      std::string_view endpoint_id) const;

  // Saves a user-configured manual recheck list entry. It records a manual
  // cadence reference, initiates no network request, and creates no background
  // watcher.
  std::optional<LocalOiManualWatchOutcome> ConfigureManualWatch(
      const TahaiSentinelWatchRequest& request,
      std::string_view mission_id = {});

  // Returns current validated manual-only recheck configurations and a local
  // due-state calculation. It does not execute, queue, or revalidate a target
  // over the network.
  std::vector<LocalOiManualWatchItem> ManualWatches() const;

  // Stores an exact-origin local classification and posture. This is not a
  // network request, a permission boundary, or universal navigation guard;
  // callers must not represent this metadata as browser-wide enforcement.
  std::optional<LocalOiEnvironmentClassificationOutcome>
  ConfigureEnvironmentClassification(TahaiEnvironment environment,
                                     std::string_view origin,
                                     std::string_view mission_id = {});

  // Returns the current bounded, exact-origin Environment Guard registry. The
  // read does not inspect a page, navigate, enforce browser policy, or make a
  // network request.
  std::vector<LocalOiEnvironmentClassificationItem> EnvironmentClassifications()
      const;

  // Explicit operator transitions are local-only. They never suppress a
  // browser warning or security interstitial; they affect only a Local OI
  // finding and require bounded operator-entered rationale.
  bool AcknowledgeFinding(std::string_view finding_id, std::string_view note);
  bool ResolveFinding(std::string_view finding_id, std::string_view reason);
  bool SuppressFinding(std::string_view finding_id, std::string_view reason);
  bool ReopenFinding(std::string_view finding_id, std::string_view note);

  // Search and report generation operate solely on the existing typed local
  // store. A generated report is persisted locally and returned only for an
  // explicit local clipboard action by the WebUI caller.
  std::vector<LocalOiSearchResult> Search(std::string_view query) const;
  std::vector<LocalOiSearchResult> Search(
      const LocalOiSearchOptions& options) const;
  std::optional<std::string> GenerateSafeReport(LocalOiSafeReportKind kind);
  std::optional<std::string> GenerateSafeReport(LocalOiSafeReportKind kind,
                                                LocalOiSafeReportFormat format);

  // Records a completed explicit clipboard export against the newest report
  // of this kind. This never reads clipboard contents or creates an upload.
  bool RecordSafeReportCopied(LocalOiSafeReportKind kind);

  // Prepares, but never executes, a narrow on-device assist prompt. The
  // caller must supply an explicit bounded Local OI record selection and a
  // future on-device adapter must separately be configured.
  std::optional<LocalOiAssistPrompt> PrepareLocalAssistPrompt(
      const LocalOiAssistRequest& request) const;

  // Creates a deterministic display-only brief without requiring a local AI
  // runtime. It operates only on an explicit bounded selection in this
  // profile-local store and never persists, copies, exports, or executes it.
  std::optional<LocalOiDeterministicBrief> BuildDeterministicLocalBrief(
      const LocalOiAssistRequest& request) const;

  // Reconciles the bounded, profile-local Mission schema only. It does not
  // inspect ordinary tabs, history, page bodies, account state, or network
  // traffic. The caller supplies the owning profile's MissionService records.
  bool SyncMissions(const std::vector<MissionSummary>& missions);
  bool RecalculateFindings();

  // KeyedService:
  void Shutdown() override;

 private:
  bool CanWriteLocalData() const;
  bool EnforceRetentionAfterDirectMutation();
  bool CommitWithRetention(LocalOiStoreData data);
  bool TransitionFinding(std::string_view finding_id,
                         LocalOiFindingState state,
                         std::string_view rationale);

  const raw_ptr<Profile> profile_;
  TahaiLocalOiStore store_;
  TahaiLocalOiRuleEngine rule_engine_;
  bool shutdown_ = false;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_SERVICE_H_
