// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_MISSION_SERVICE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_MISSION_SERVICE_H_

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/functional/callback_forward.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"
#include "chrome/browser/ui/webui/tahai/tahai_oi_link_contract.h"
#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"
#include "components/keyed_service/core/keyed_service.h"

class PrefService;
class Profile;

namespace os_crypt_async {
class Encryptor;
class OSCryptAsync;
}

namespace tahai {

// Browser-owned, not an author-supplied grant lifetime. Includes reservation
// and result journaling; pause/archive cannot extend an in-flight attempt.
inline constexpr base::TimeDelta kMissionNativeAttemptTimeout = base::Seconds(10);

struct TahaiMissionCapsuleImport;
struct TahaiOperationalWorkflow;

struct MissionStep {
  std::string label;
  bool complete = false;
  std::string condition_input_id;
  std::string condition_equals;
  std::string workflow_step_id;
  bool requires_native_action = false;
  // Empty for inert steps; native steps use a closed browser-owned vocabulary.
  // This is display/checkpoint state, never permission to execute or replay.
  std::string action_state;
  std::optional<TahaiWorkflowAssignment> assignment;
  int wait_seconds = 0;
  int wait_remaining_ms = 0;
  // Empty for non-waits; ready/waiting/paused/complete/timed-out for a wait.
  std::string wait_state;
  // Runtime-only monotonic origin. Never serialize or trust a persisted clock.
  std::optional<base::TimeTicks> wait_started;
  int wait_timeout_seconds = 0;
  int wait_timeout_remaining_ms = 0;
  // Live-process only, never deserialize a clock or restart an attempt.
  std::optional<base::TimeTicks> native_action_started;
  // Empty or the fixed token "deadline-exceeded"; no arbitrary diagnostic data.
  std::string native_action_error;
  std::optional<TahaiWorkflowNumericCondition> numeric_condition;
  bool condition_from_variable = false;
  // Frozen only by explicit forward progress. Omission is unresolved; false
  // records a skipped branch. Never copied into a shareable definition.
  std::optional<bool> variable_condition_result;
  // Compound predicates also use the recorded decision field above, including
  // input-only trees; it is a frozen branch outcome, never action authority.
  std::optional<TahaiWorkflowPredicate> predicate;
};

struct MissionEvent {
  // A fixed vocabulary that drives the locally rendered Timeline filters. It
  // never contains a URL, page title, payload, or other browsing data.
  std::string kind;
  std::string detail;
  std::string created_at;
  // Every generated event is locally chained to its immediately preceding
  // event. The browser never places page contents or credentials in either
  // input to this digest.
  std::string previous_hash;
  std::string entry_hash;
};

struct MissionEvidence {
  // Evidence markers deliberately describe only the operator action, never
  // the current page, its title, its URL, a screenshot, or page data.
  std::string label;
  std::string capture_scope;
  std::string captured_at;
};

// A note is profile-local mission context supplied by the person, not evidence
// and not browser/page data. Notes are screened before persistence and are
// deliberately absent from handoffs, Evidence Packs, and Mission Capsules.
struct MissionNote {
  std::string text;
  std::string created_at;
};

// A snapshot of a reviewed workflow's local input definition and its value.
// Values remain profile-local run state: they are never copied to Evidence
// Packs, handoffs, capsules, skin exports, or timeline records.
struct MissionWorkflowInput {
  std::string id;
  std::string name;
  std::string type;
  bool required = false;
  std::vector<std::string> options;
  std::string value;
  bool is_protected = false;
  // Ciphertext only. Protected plaintext is never retained in a snapshot.
  std::string protected_value;
  // Runtime-only state; never trusted from preferences.
  bool protected_storage_ready = false;
  bool protected_has_value = false;
  std::optional<TahaiWorkflowInputValidation> validation;
};

// A local Mission pins only the identity and archive revision of the reviewed
// operational workflow that created it. It never retains package bytes,
// browsing data, a URL, credentials, or a grant.
struct OperationalWorkflowSource {
  std::string skin_id;
  std::string workflow_id;
  std::string archive_sha256;
  // A local run is deliberately a state machine, not a replay engine. A
  // restart retains this state and requires a new explicit transition.
  std::string run_state = "ready";
  int adapter_version = 0;
};

struct MissionSummary {
  std::string id;
  std::string title;
  std::string type;
  std::string created_at;
  std::string updated_at;
  std::vector<MissionStep> steps;
  std::vector<MissionStep> validation_steps;
  std::vector<MissionStep> rollback_steps;
  bool escalation_required = false;
  std::string export_profile;
  std::vector<MissionEvidence> evidence;
  std::vector<MissionNote> notes;
  std::vector<MissionWorkflowInput> workflow_inputs;
  // Bindings only; final values reference the same immutable terminal run's
  // validated input storage. Never duplicate protected ciphertext or plaintext.
  std::vector<TahaiOperationalWorkflowOutput> workflow_outputs;
  struct Variable {
    TahaiOperationalWorkflowInput definition;
    std::string value;
    // Protected slots never retain plaintext in value. Readiness is runtime
    // only and is recomputed with this profile's OS encryption provider.
    std::string protected_value;
    bool protected_storage_ready = false;
    bool protected_has_value = false;
  };
  // Bounded run-local data; protected sources can only flow to protected slots.
  // Neither plaintext nor ciphertext enters designs or routine evidence export.
  std::vector<Variable> workflow_variables;
  std::vector<MissionEvent> timeline;
  // Future hosted handoff metadata remains inert in the browser. This is a
  // validated opaque record only; it cannot carry a tenant, auth material,
  // browsing data, raw content, or an arbitrary remote destination.
  std::optional<TahaiOiLink> oi_link;
  // Legacy timeline records are migrated into a local chain, but are never
  // represented as cryptographically verified historical evidence.
  bool timeline_integrity_verified = true;
  // Archived missions are retained as immutable local records. They may be
  // restored or used as the source for a fresh generated runbook, but their
  // checkpoint, evidence, escalation, and export state cannot be changed.
  bool archived = false;
  std::optional<OperationalWorkflowSource> operational_workflow;
  // Browser-owned freshness token for local assignment controls. Runtime only:
  // never persisted/exported; renewed on load and each accepted run mutation.
  std::string mutation_token;
};

bool IsMissionWorkflowStepConditionSatisfied(const MissionSummary& mission, size_t index);
bool IsMissionWorkflowStepConditionResolved(const MissionSummary& mission, size_t index);

// A branch must have an explicit answer even when its input is otherwise
// optional. An unset choice is unresolved, never an implicit false/skip.
bool IsMissionWorkflowInputRequired(const MissionSummary& mission,
                                    const MissionWorkflowInput& input);
bool HasMissionWorkflowInputValue(const MissionWorkflowInput& input);

// Safe local presentation projection. Protected plaintext/ciphertext is never
// returned. No output can resolve before all work is explicitly succeeded.
struct MissionWorkflowOutputValue {
  std::string type;
  bool is_protected = false;
  bool has_value = false;
  bool unavailable = false;
  std::string value;
};
std::optional<MissionWorkflowOutputValue> ResolveMissionWorkflowOutput(
    const MissionSummary& mission, std::string_view output_id);

bool CanBeginMissionNativeStep(const MissionSummary& mission, size_t step_index);
// nullopt for a non-pending or invalid clock; zero once its deadline expires.
std::optional<int> MissionWorkflowNativeTimeRemaining(const MissionStep& step);
bool HasValidMissionWorkflowVariables(const MissionSummary& mission);
bool CanAssignMissionWorkflowVariable(const MissionSummary& mission,
                                      size_t step_index);
// Value-free preflight reason for a calculation. It never executes a step or
// persists an outcome. Empty means no calculation error (or a copy assignment).
std::string_view MissionWorkflowCalculationError(const MissionSummary& mission, size_t step_index);
bool HasValidMissionWorkflowWaits(const MissionSummary& mission);
// Rounded up, so fractional elapsed milliseconds never shorten a delay.
std::optional<int> MissionWorkflowWaitRemaining(const MissionStep& step);
// No deadline returns nullopt. Otherwise the same active monotonic clock is
// used for both the delay and its completion deadline.
std::optional<int> MissionWorkflowWaitTimeoutRemaining(const MissionStep& step);
bool IsMissionWorkflowInputBranchLocked(const MissionSummary& mission,
                                       std::string_view input_id);
bool CanControlMissionWorkflowWait(const MissionSummary& mission,
                                   size_t step_index, bool complete);
// Manual review only after a failed/cancelled run has no in-flight attempt.
// Never grants action authority, changes the terminal state or permits replay.
bool CanReviewMissionRecovery(const MissionSummary& mission);

// Owns Mission metadata for one Profile. Ordinary notes/inputs are screened;
// explicitly protected inputs are OS-encrypted, masked, and never exposed to
// exporters or action adapters. No cookies, page data, authentication state or
// connector authority is collected. A URL is only a stored reference.
class MissionService : public KeyedService {
 public:
  explicit MissionService(Profile* profile);
  MissionService(const MissionService&) = delete;
  MissionService& operator=(const MissionService&) = delete;
  ~MissionService() override;
  void Shutdown() override;

  const std::vector<MissionSummary>& missions() const { return missions_; }
  // Called when Mission Control opens, including when this service already
  // exists. Retires a one-shot native handoff after one attempt; false means
  // it was rejected and the UI must report that no new run was created.
  bool ConsumeQueuedOperationalWorkflow();
  std::optional<MissionSummary> CreateMission(std::string_view title,
                                              std::string_view type);
  // Starts a local checklist snapshot from a workflow that has already passed
  // the operational-skin trust and activation boundary. Workflow actions are
  // represented as explicit steps only; this method never executes one. New
  // native handoffs opt into the versioned, separately guarded action adapter;
  // legacy callers retain inert checklist semantics by default.
  std::optional<MissionSummary> CreateOperationalWorkflowMission(
      const TahaiOperationalWorkflow& workflow,
      std::string_view skin_id,
      std::string_view archive_sha256,
      bool native_adapter = false);
  // These only change local state. The document-bound native handler must
  // separately resolve trusted command authority and commit the attempt
  // journal before dispatch. Completion cannot bypass a pending action.
  bool BeginNativeWorkflowStep(std::string_view mission_id, size_t step_index);
  // Rejection/uncertain outcome closes the run as failed (or preserves explicit
  // cancellation). An uncertain attempt is never claimed to have had no effect.
  bool FinishNativeWorkflowStep(std::string_view mission_id, size_t step_index,
                                std::string_view result);
  // One explicit local typed copy and checkpoint update, in the same saved run
  // record. Never an external effect, implicit replay, or plaintext downgrade.
  bool AssignWorkflowVariable(std::string_view mission_id, size_t step_index);
  // Start/resume or acknowledge an elapsed local wait. No automatic completion
  // or subsequent action is dispatched. Pause/restart require explicit resume.
  bool ControlWorkflowWait(std::string_view mission_id, size_t step_index,
                           bool complete);
  // Transitions only a revision-pinned operational checklist through the
  // browser-owned local state machine. It never executes a workflow action,
  // replays a command, or changes an archived Mission.
  bool SetOperationalWorkflowRunState(std::string_view mission_id,
                                      std::string_view run_state);
  // Creates a fresh local Mission from a previously authenticated capsule.
  // Source identity, title, timestamps, and event ledger are never restored.
  std::optional<MissionSummary> ImportSanitizedMissionCapsule(
      const TahaiMissionCapsuleImport& capsule);
  bool ToggleStep(std::string_view mission_id, size_t step_index);
  bool ToggleValidationStep(std::string_view mission_id, size_t step_index);
  bool ToggleRollbackStep(std::string_view mission_id, size_t step_index);
  bool ToggleEscalation(std::string_view mission_id);
  bool AddEvidenceMarker(std::string_view mission_id);
  // Stores a bounded, profile-local annotation after sensitive-material
  // screening. It has no browser, page, export, or remote side effect.
  bool AddLocalNote(std::string_view mission_id, std::string_view note);
  // Writes one already-defined, bounded local input value. It never invokes a
  // page action, connector, command, or workflow step.
  bool SetOperationalWorkflowInputValue(std::string_view mission_id,
                                        std::string_view input_id,
                                        std::string_view value);
  // Validates saved ciphertext without resuming a run or returning plaintext.
  void PrepareProtectedWorkflowInputs(os_crypt_async::OSCryptAsync* provider,
                                     base::OnceCallback<void(bool)> callback);
  bool SetExportProfile(std::string_view mission_id,
                        std::string_view export_profile);
  bool ArchiveMission(std::string_view mission_id);
  bool RestoreMission(std::string_view mission_id);
  std::optional<MissionSummary> DuplicateMission(std::string_view mission_id);
  bool DeleteMission(std::string_view mission_id);
  bool persistence_enabled() const;
  base::WeakPtr<MissionService> GetWeakPtr() { return weak_factory_.GetWeakPtr(); }

 private:
  MissionSummary* FindMission(std::string_view mission_id);
  void Load();
  void Save();
  bool CanStoreProtectedInputs() const;
  bool ExpireWorkflowDeadlines();
  void ScheduleWorkflowDeadline();
  void OnWorkflowDeadline();
  void OnProtectedInputEncryptor(base::OnceCallback<void(bool)> callback,
                                scoped_refptr<os_crypt_async::Encryptor> encryptor);

  const raw_ptr<Profile> profile_;
  const raw_ptr<PrefService> prefs_;
  std::vector<MissionSummary> missions_;
  scoped_refptr<os_crypt_async::Encryptor> input_encryptor_;
  bool shutting_down_ = false;
  // One bounded wakeup for the earliest wait/native deadline across local runs.
  base::OneShotTimer workflow_deadline_timer_;
  base::WeakPtrFactory<MissionService> weak_factory_{this};
};

class MissionServiceFactory : public ProfileKeyedServiceFactory {
 public:
  static MissionService* GetForProfile(Profile* profile);
  static MissionServiceFactory* GetInstance();

  MissionServiceFactory(const MissionServiceFactory&) = delete;
  MissionServiceFactory& operator=(const MissionServiceFactory&) = delete;

 private:
  friend base::NoDestructor<MissionServiceFactory>;

  MissionServiceFactory();
  ~MissionServiceFactory() override;

  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_MISSION_SERVICE_H_
