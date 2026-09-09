// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_MODEL_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_MODEL_H_

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_assist.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_types.h"

namespace tahai {

// TAHAI Local OI is intentionally a local projection of the bounded Mission
// schema. It does not inspect page contents, browser history, tabs, downloads,
// credentials, cookies, headers, screenshots, arbitrary notes, or accounts.
// The hosted Operational Intelligence product has different tenant, policy,
// identity, connector, and retention requirements and is not a runtime
// dependency of this browser model.
enum class LocalOiSeverity {
  kInformational,
  kAttention,
  kBlocked,
};

// Capability posture prevents a polished local surface from implying a live
// watcher, connector, model, capture pipeline, or hosted control plane that
// the browser has not actually configured.
enum class LocalOiCapabilityStage {
  kAvailableNow,
  kExplicitCaptureRequired,
  kContractReady,
  kNotConfigured,
};

struct LocalOiCapability {
  std::string id;
  std::string label;
  LocalOiCapabilityStage stage = LocalOiCapabilityStage::kNotConfigured;
  std::string detail;
};

// A contextual explanation of when an otherwise private local workflow may
// need organizational authority. It is a local rule-based signal, not an
// entitlement check, lead upload, tenant lookup, or promotion action.
struct LocalOiScaleSignal {
  std::string id;
  std::string title;
  std::string summary;
  std::string hosted_capability;
  std::string referral_context;
};

// Local OI reports are deliberately aggregate-only, even when the user gives
// the result a workflow-specific name. They are clipboard artifacts, not a
// hosted export, connector payload, or Mission promotion packet.
enum class LocalOiSafeReportKind {
  kOverview,
  kSanitizedHandoff,
  kChangeRecord,
  kIncidentPacket,
  kEvidenceManifest,
  kArtifactIntegrity,
  kDiagnostic,
};

// Safe report formats carry the same aggregate-only content. They are local
// clipboard artifacts, not an interchange protocol, hosted export, or data
// promotion pathway.
enum class LocalOiSafeReportFormat {
  kMarkdown,
  kJson,
};

struct LocalOiMissionHealth {
  // `mission_title` is only for the profile-local UI and local search result.
  // It is never included in the promotion preview or referral URL.
  std::string mission_id;
  std::string mission_title;
  std::string mission_type;
  int score = 0;
  std::string readiness;
  size_t completed_checkpoints = 0;
  size_t total_checkpoints = 0;
  size_t evidence_markers = 0;
  bool archived = false;
};

struct LocalOiFinding {
  std::string id;
  std::string mission_id;
  // Profile-local presentation only. This is never included in safe reports,
  // promotion previews, opaque OI links, or referral parameters.
  std::string mission_title;
  LocalOiSeverity severity = LocalOiSeverity::kInformational;
  LocalOiFindingState state = LocalOiFindingState::kOpen;
  bool acknowledged = false;
  std::string title;
  std::string summary;
  std::string recommendation;
  // A local numeric timestamp used only for bounded recency filtering. It is
  // never included in referral URLs, promotion previews, or safe reports.
  std::string created_at;
  // The generated local Mission rail that supports this finding. This is a
  // display label only, never a captured browser source or remote evidence.
  std::string evidence_anchor;
};

// A visible, deterministic operator queue derived from the finding engine.
// It never changes Mission state, opens a URL, collects browser data, or
// invokes a remote model. Resolving an action remains an explicit Mission
// Control operation.
struct LocalOiPriorityAction {
  std::string id;
  std::string mission_id;
  // Profile-local display metadata only. Never included in a safe report,
  // referral parameter, promotion preview, or opaque reference.
  std::string mission_title;
  LocalOiSeverity severity = LocalOiSeverity::kInformational;
  int priority = 0;
  std::string title;
  std::string rationale;
  std::string action;
  std::string evidence_anchor;
};

// A graph node in the local operational projection. It is intentionally a
// generated description of bounded Mission state—not a browser-history,
// download, document, account, page, connector, or hosted-OI entity store.
struct LocalOiEntity {
  std::string id;
  std::string mission_id;
  std::string kind;
  std::string label;
  std::string detail;
  // A local numeric timestamp used only for bounded recency filtering.
  std::string created_at;
  // A bounded private-search projection of typed field names and values. It
  // is never returned in search results, reports, promotion previews, or a
  // referral; it only allows the local UI to find its already-persisted data.
  std::string search_terms;
};

struct LocalOiRelationship {
  std::string source_id;
  std::string target_id;
  std::string relationship;
  std::string source_label;
  std::string target_label;
  // A bounded typed explanation set by the owning native subsystem. It is
  // display-only local metadata, never page content or an external lookup.
  std::string basis;
};

struct LocalOiMemoryItem {
  std::string mission_id;
  std::string kind;
  std::string detail;
  std::string created_at;
};

struct LocalOiSearchResult {
  std::string kind;
  std::string mission_id;
  std::string title;
  std::string detail;
  std::string severity;
  std::string finding_state;
  std::string created_at;
};

// A finite, local-only search request. Every filter is an exact value from a
// controlled vocabulary; this is not a generic query language, URL resolver,
// or cross-profile lookup. `maximum_age_days` accepts only 0, 1, 7, 30, or 90
// (where zero means all retained local records).
struct LocalOiSearchOptions {
  std::string query;
  std::string kind = "all";
  std::string mission_id;
  std::string severity = "all";
  std::string finding_state = "all";
  int maximum_age_days = 0;
};

// A small, local graph traversal request. The selected entity must be an
// existing persisted Local OI record, the relationship filter is one finite
// vocabulary value (or `all`), and traversal is limited to one or two hops.
// It is not a general graph query language or external identifier resolver.
struct LocalOiRelationshipExplorerOptions {
  std::string entity_id;
  std::string relationship = "all";
  int maximum_depth = 1;
};

struct LocalOiRelationshipExplorerItem {
  std::string source_id;
  std::string target_id;
  std::string relationship;
  std::string source_label;
  std::string target_label;
  std::string basis;
  int depth = 1;
};

// A deliberately compact related-record view for Local OI graph navigation.
// It exposes only the safe entity projection and an aggregate count of its
// typed local edges; it is not a raw record inspector or generic object API.
struct LocalOiEntityDetail {
  std::string id;
  std::string mission_id;
  std::string kind;
  std::string label;
  std::string detail;
  size_t direct_relationship_count = 0;
};

// Local OI may eventually use a user-configured on-device model to explain
// the existing local projection. It must never broaden collection: raw page
// content, credentials, cookies, browser history, or a remote provider are
// outside this capability boundary.
struct LocalOiAssistPosture {
  bool local_model_configured = false;
  bool remote_model_permitted = false;
  bool may_read_raw_browser_content = false;
  bool may_execute_actions = false;
  std::string_view status;
};

// A profile-local storage inventory lets the operator inspect the record
// categories Local OI currently retains without exposing record fields,
// identifiers, local paths, or a generic data-export interface.
struct LocalOiDataInventoryEntry {
  LocalOiEntityType entity_type = LocalOiEntityType::kMission;
  size_t record_count = 0u;
};

struct LocalOiDataInventory {
  int schema_version = 0;
  int generation = 0;
  size_t relationship_count = 0u;
  size_t finding_count = 0u;
  size_t memory_count = 0u;
  size_t report_count = 0u;
  std::vector<LocalOiDataInventoryEntry> entity_categories;
};

struct LocalOiSnapshot {
  std::vector<LocalOiMissionHealth> mission_health;
  std::vector<LocalOiFinding> findings;
  std::vector<LocalOiPriorityAction> priority_actions;
  std::vector<LocalOiEntity> entities;
  std::vector<LocalOiRelationship> relationships;
  std::vector<LocalOiCapability> capabilities;
  std::vector<LocalOiScaleSignal> scale_signals;
  std::vector<LocalOiMemoryItem> memory;
  size_t active_mission_count = 0;
  size_t archived_mission_count = 0;
  size_t evidence_marker_count = 0;
  size_t artifact_count = 0;
  size_t document_reference_count = 0;
  size_t endpoint_count = 0;
  size_t domain_count = 0;
  size_t diagnostic_result_count = 0;
  size_t change_capture_count = 0;
  size_t manual_watch_count = 0;
  size_t report_count = 0;
  size_t timeline_event_count = 0;
  size_t blocked_finding_count = 0;
  size_t knowledge_gap_count = 0;
  // Aggregate only. Opaque references themselves are never added to local
  // search, cards, memory, safe reports, or promotion URLs.
  size_t opaque_oi_reference_count = 0;
  size_t operator_action_count = 0;
  size_t relationship_entity_count = 0;
  // Zero with no local Mission records means "no signal", not unhealthy.
  int portfolio_health_score = 0;
};

// Builds a bounded WebUI view from actual persisted Local OI records. It has
// no fallback sample records, generated health percentage, or decorative graph
// lane: empty local data produces empty UI state.
LocalOiSnapshot BuildLocalOiSnapshot(const LocalOiStoreData& data);

// Produces counts from the same profile-local store used by the command deck.
// It neither reads browser data nor serializes raw Local OI records.
LocalOiDataInventory BuildLocalOiDataInventory(const LocalOiStoreData& data);

// Searches only the already-built local projection. Result limits keep the
// WebUI responsive and avoid turning this display feature into a data export.
std::vector<LocalOiSearchResult> SearchLocalOiSnapshot(
    const LocalOiSnapshot& snapshot,
    std::string_view query);
std::vector<LocalOiSearchResult> SearchLocalOiSnapshot(
    const LocalOiSnapshot& snapshot,
    const LocalOiSearchOptions& options);

// Traverses only the already-materialized profile-local relationship
// projection. Results are deterministically ordered and capped for a
// responsive WebUI; no navigation, content inspection, or network activity
// occurs as part of this read.
std::vector<LocalOiRelationshipExplorerItem> ExploreLocalOiRelationships(
    const LocalOiSnapshot& snapshot,
    const LocalOiRelationshipExplorerOptions& options);

// Returns a single existing entity from the current profile-local projection.
// An entity deleted between graph requests is treated as absent rather than
// resolving through any stale, external, or cross-profile reference.
std::optional<LocalOiEntityDetail> GetLocalOiEntityDetail(
    const LocalOiSnapshot& snapshot,
    std::string_view entity_id);

// Shapes one explicitly selected and bounded Local OI record set for a future
// on-device adapter. This function does not invoke an adapter or a model.
std::optional<LocalOiAssistPrompt> PrepareLocalOiAssistPrompt(
    const LocalOiSnapshot& snapshot,
    const LocalOiAssistRequest& request);

// Creates a local display-only brief for an explicit selection. A sanitized
// handoff draft intentionally includes only aggregate typed-record counts;
// it never includes labels, IDs, details, or browser-derived material.
std::optional<LocalOiDeterministicBrief> BuildLocalOiDeterministicBrief(
    const LocalOiAssistPrompt& prompt);

std::string_view LocalOiSeverityLabel(LocalOiSeverity severity);
std::string_view LocalOiCapabilityStageLabel(LocalOiCapabilityStage stage);
std::string_view LocalOiSafeReportKindLabel(LocalOiSafeReportKind kind);
std::optional<LocalOiSafeReportKind> LocalOiSafeReportKindFromString(
    std::string_view kind);
std::optional<LocalOiSafeReportFormat> LocalOiSafeReportFormatFromString(
    std::string_view format);

const LocalOiAssistPosture& GetLocalOiAssistPosture();

// A compact, non-secret report intended for deliberate manual sharing. It
// contains aggregate local posture only—never Mission names, identifiers,
// page data, account data, credentials, or raw timeline details.
std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot);
std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot,
                                   LocalOiSafeReportKind kind);
std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot,
                                   LocalOiSafeReportKind kind,
                                   LocalOiSafeReportFormat format);
std::string BuildLocalOiSafeReport(const LocalOiSnapshot& snapshot,
                                   LocalOiSafeReportKind kind,
                                   LocalOiSafeReportFormat format,
                                   std::string_view generated_at);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_MODEL_H_
