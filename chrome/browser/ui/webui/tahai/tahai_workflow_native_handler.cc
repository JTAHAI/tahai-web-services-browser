// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_workflow_native_handler.h"

#include <algorithm>
#include <string>
#include <utility>

#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "base/no_destructor.h"
#include "base/task/thread_pool.h"
#include "base/task/sequenced_task_runner.h"
#include "base/time/time.h"
#include "base/uuid.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_operational_skin_controller.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_workflow_journal.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/weak_document_ptr.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_message_handler.h"

namespace tahai {

std::string CompleteMissionNativeAttempt(base::WeakPtr<MissionService> service,
                                         std::string_view id,
                                         size_t index,
                                         std::string_view result) {
  if (!service) {
    return "unavailable";
  }
  const std::string owned_id(id);
  service->FinishNativeWorkflowStep(owned_id, index, result);
  if (!service) {
    return "unavailable";
  }
  const auto mission =
      std::ranges::find(service->missions(), owned_id, &MissionSummary::id);
  if (mission == service->missions().end() || index >= mission->steps.size()) {
    return "unavailable";
  }
  const auto& state = mission->steps[index].action_state;
  return state == "dispatched" || state == "rejected" || state == "unknown"
             ? state
             : "unavailable";
}

namespace {

scoped_refptr<base::SequencedTaskRunner> JournalSequence() {
  // Serializes the quota/first-open boundary across documents. Shutdown may
  // abandon a result; an already committed intent then remains non-replayable.
  static const base::NoDestructor<scoped_refptr<base::SequencedTaskRunner>> runner(
      base::ThreadPool::CreateSequencedTaskRunner(
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
           base::TaskShutdownBehavior::CONTINUE_ON_SHUTDOWN}));
  return *runner;
}

class WorkflowNativeHandler final : public content::WebUIMessageHandler,
                                    public content::WebContentsObserver {
 public:
  explicit WorkflowNativeHandler(Profile* profile) : profile_(profile) {}
  ~WorkflowNativeHandler() override { Cancel(); }
  void RegisterMessages() override {
    Observe(web_ui()->GetWebContents());
    web_ui()->RegisterMessageCallback("runTahaiNativeWorkflowStep", base::BindRepeating(
        &WorkflowNativeHandler::Run, base::Unretained(this)));
  }
  void PrimaryPageChanged(content::Page&) override { Cancel(); }
  void WebContentsDestroyed() override { Cancel(); }
  void OnJavascriptDisallowed() override { Cancel(); }

 private:
  struct Invocation {
    std::string id;
    size_t index;
    std::string key;
    std::string mutation_token;
    std::string mode_id;
    std::string custom_mode_id;
    int command;
    base::WeakPtr<WindowModeController> window;
    content::WeakDocumentPtr document;
    base::TimeTicks deadline;
  };

  WindowModeController* Target(bool gesture) {
    auto* contents = web_contents();
    if (!contents || !profile_->IsRegularProfile() || profile_->IsOffTheRecord() ||
        profile_->IsGuestSession() || profile_->IsSystemProfile() ||
        contents->GetBrowserContext() != profile_ ||
        profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiMissions)) {
      return nullptr;
    }
    const auto& url = contents->GetLastCommittedURL();
    if (url != GURL(kTahaiMissionURL) && url != GURL(kTahaiTrustedMissionURL)) {
      return nullptr;
    }
    auto* frame = contents->GetPrimaryMainFrame();
    if (!frame || (gesture && !frame->HasTransientUserActivation())) {
      return nullptr;
    }
    auto* window = GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(contents);
    auto* browser = window ? window->GetBrowserForMigrationOnly() : nullptr;
    if (!browser || !browser->is_type_normal() || browser->GetProfile() != profile_ ||
        browser->tab_strip_model()->GetActiveWebContents() != contents) {
      return nullptr;
    }
    return WindowModeController::GetForBrowser(browser);
  }

  const MissionSummary* Find(MissionService* service, std::string_view id) {
    if (!service) return nullptr;
    const auto found = std::ranges::find(service->missions(), id, &MissionSummary::id);
    return found == service->missions().end() ? nullptr : &*found;
  }

  std::optional<int> Resolve(WindowModeController* target, const MissionSummary* mission,
                              size_t index) {
    if (!target || !mission) return std::nullopt;
    const auto* manifest = target->operational_manifest();
    const auto sha = target->operational_archive_sha256();
    if (!manifest || !sha) return std::nullopt;
    auto command = ResolveMissionNativeCommand(*manifest, target->active_operational_mode_id(),
                                               *sha, *mission, index);
    return command && chrome::IsCommandEnabled(target->browser(), *command) ? command : std::nullopt;
  }

  void Reply(std::string_view id, size_t index, std::string_view result) {
    auto* contents = web_contents();
    if (!contents || (contents->GetLastCommittedURL() != GURL(kTahaiMissionURL) &&
                      contents->GetLastCommittedURL() != GURL(kTahaiTrustedMissionURL))) return;
    AllowJavascript();
    CallJavascriptFunction("tahaiNativeWorkflowResult", base::Value(id),
                           base::Value(static_cast<int>(index)), base::Value(result));
  }

  void Run(const base::ListValue& args) {
    if (args.size() != 3 || !args[0].is_string() || !args[1].is_int() || !args[2].is_string() ||
        args[2].GetString().size() != 36 || !base::Uuid::ParseLowercase(args[2].GetString()).is_valid() ||
        args[0].GetString().size() != 36 ||
        !base::Uuid::ParseLowercase(args[0].GetString()).is_valid() ||
        args[1].GetInt() < 0 || args[1].GetInt() >= 32) return;
    const auto id = args[0].GetString();
    const size_t index = args[1].GetInt();
    auto* target = Target(true);
    auto* service = target ? MissionServiceFactory::GetForProfile(profile_) : nullptr;
    const auto* mission = Find(service, id);
    if (!mission || mission->mutation_token != args[2].GetString()) { Reply(id, index, "unavailable"); return; }
    auto command = Resolve(target, mission, index);
    if (active_ || !command || !CanBeginMissionNativeStep(*mission, index)) {
      const std::string_view state = mission && index < mission->steps.size()
          ? mission->steps[index].action_state : std::string_view();
      Reply(id, index, state == "pending" || state == "dispatched" ||
          state == "rejected" || state == "unknown" ? state : "unavailable");
      return;
    }
    auto key = WorkflowAttemptKey(id, mission->operational_workflow->archive_sha256,
                                  mission->operational_workflow->workflow_id,
                                  mission->steps[index].workflow_step_id);
    if (key.empty()) {
      Reply(id, index, "unavailable");
      return;
    }
    const auto self = weak_factory_.GetWeakPtr();
    const auto service_weak = service->GetWeakPtr();
    const Invocation invocation{
        id,
        index,
        key,
        mission->mutation_token,
        std::string(target->active_operational_mode_id()),
        std::string(target->active_custom_mode_id()),
        *command,
        target->GetWeakPtr(),
        web_contents()->GetPrimaryMainFrame()->GetWeakDocumentPtr(),
        base::TimeTicks::Now() + kMissionNativeAttemptTimeout};
    // Block reentrant launches before Begin notifies observers. Cancellation
    // retires this invocation before closing its attempt, never after
    // callbacks.
    active_ = invocation;
    std::string pending_token;
    const bool began = service->BeginNativeWorkflowStep(
        id, index, &pending_token, invocation.mutation_token);
    if (!self) {
      // Cancel may have run before Begin actually opened the attempt (while
      // settling another deadline). Close it without touching this dead UI.
      if (began) {
        CompleteMissionNativeAttempt(service_weak, id, index, "unknown");
      }
      return;
    }
    const auto* pending = Find(service_weak.get(), id);
    if (!began || !service_weak || !invocation.window || !active_ ||
        active_->key != invocation.key ||
        Target(false) != invocation.window.get() ||
        invocation.document.AsRenderFrameHostIfValid() !=
            web_contents()->GetPrimaryMainFrame() ||
        invocation.window->active_operational_mode_id() != invocation.mode_id ||
        invocation.window->active_custom_mode_id() !=
            invocation.custom_mode_id ||
        !pending || pending->mutation_token != pending_token ||
        !service_weak->CanContinueNativeWorkflowStep(id, index) ||
        Resolve(invocation.window.get(), pending, index) !=
            invocation.command) {
      active_.reset();
      const auto accepted = began ? CompleteMissionNativeAttempt(
                                        service_weak, id, index, "rejected")
                                  : std::string("unavailable");
      if (self) {
        Reply(id, index, accepted);
      }
      return;
    }
    active_->mutation_token = std::move(pending_token);
    Reply(id, index, "pending");
    if (!self) {
      return;
    }
    JournalSequence()->PostTaskAndReplyWithResult(FROM_HERE,
        base::BindOnce(&ReserveWorkflowAttempt, profile_->GetPath(), std::move(key)),
        base::BindOnce(&WorkflowNativeHandler::Reserved, weak_factory_.GetWeakPtr()));
  }

  void Reserved(WorkflowAttempt attempt) {
    if (!active_) return;
    auto* service = MissionServiceFactory::GetForProfile(profile_);
    const Invocation invocation = *active_;
    if (!service) {
      active_.reset();
      Reply(invocation.id, invocation.index, "unavailable");
      return;
    }
    if (attempt != WorkflowAttempt::kReserved) {
      const std::string_view result = attempt == WorkflowAttempt::kDispatched ? "dispatched" :
          attempt == WorkflowAttempt::kRejected ? "rejected" : "unknown";
      active_.reset();
      const auto self = weak_factory_.GetWeakPtr();
      const auto accepted = CompleteMissionNativeAttempt(
          service->GetWeakPtr(), invocation.id, invocation.index, result);
      if (self) {
        Reply(invocation.id, invocation.index, accepted);
      }
      return;
    }
    auto* target = Target(false);
    const auto* mission = Find(service, invocation.id);
    const auto command = Resolve(target, mission, invocation.index);
    const bool valid =
        target && target == invocation.window.get() && mission &&
        service->CanContinueNativeWorkflowStep(invocation.id,
                                               invocation.index) &&
        target->active_operational_mode_id() == invocation.mode_id &&
        target->active_custom_mode_id() == invocation.custom_mode_id &&
        invocation.document.AsRenderFrameHostIfValid() ==
            web_contents()->GetPrimaryMainFrame() &&
        base::TimeTicks::Now() < invocation.deadline &&
        mission->mutation_token == invocation.mutation_token &&
        command == invocation.command;
    const auto path = profile_->GetPath();
    auto service_weak = service->GetWeakPtr();
    auto self = weak_factory_.GetWeakPtr();
    auto runner = JournalSequence();
    // The command may navigate/destroy this WebUI synchronously. Keep only
    // value copies and weak service/document references across dispatch.
    active_.reset();
    const bool dispatched = valid && base::TimeTicks::Now() < invocation.deadline &&
        MissionWorkflowNativeTimeRemaining(mission->steps[invocation.index]).value_or(0) > 0 &&
        chrome::ExecuteCommand(target->browser(), *command);
    runner->PostTaskAndReplyWithResult(FROM_HERE,
        base::BindOnce(&RecordWorkflowAttemptResult, path, invocation.key, dispatched),
        base::BindOnce([](base::WeakPtr<MissionService> mission_service,
                          base::WeakPtr<WorkflowNativeHandler> handler,
                          std::string id, size_t index, bool did_dispatch, bool saved) {
          const std::string_view result = !saved ? "unknown" : did_dispatch ? "dispatched" : "rejected";
          const auto accepted =
              CompleteMissionNativeAttempt(mission_service, id, index, result);
          if (handler) handler->Reply(id, index, accepted);
        }, service_weak, self, invocation.id, invocation.index, dispatched));
  }

  void Cancel() {
    weak_factory_.InvalidateWeakPtrs();
    const auto invocation = std::exchange(active_, std::nullopt);
    if (invocation) {
      auto* service = MissionServiceFactory::GetForProfile(profile_);
      if (service) {
        service->FinishNativeWorkflowStep(invocation->id, invocation->index,
                                          "unknown");
      }
    }
  }

  const raw_ptr<Profile> profile_;
  std::optional<Invocation> active_;
  base::WeakPtrFactory<WorkflowNativeHandler> weak_factory_{this};
};

}  // namespace

std::optional<int> ResolveMissionNativeCommand(
    const TahaiOperationalSkinManifest& manifest, std::string_view mode_id,
    std::string_view archive_sha256, const MissionSummary& mission, size_t index) {
  if (!mission.operational_workflow || mission.archived ||
      mission.operational_workflow->adapter_version != 1 ||
      mission.operational_workflow->run_state != "running" ||
      manifest.appearance.id != mission.operational_workflow->skin_id ||
      archive_sha256 != mission.operational_workflow->archive_sha256) return std::nullopt;
  const auto mode = std::ranges::find(manifest.modes, mode_id, &TahaiOperationalMode::id);
  if (mode == manifest.modes.end() || mode->workflow_id != mission.operational_workflow->workflow_id)
    return std::nullopt;
  const auto workflow = std::ranges::find(manifest.workflows, mode->workflow_id,
                                         &TahaiOperationalWorkflow::id);
  if (workflow == manifest.workflows.end() || workflow->name != mission.title ||
      workflow->inputs.size() != mission.workflow_inputs.size() || index >= mission.steps.size())
    return std::nullopt;
  const auto expanded = ExpandTahaiWorkflowSteps(*workflow);
  if (!expanded || expanded->size() != mission.steps.size()) return std::nullopt;
  if (workflow->outputs != mission.workflow_outputs) return std::nullopt;
  if (workflow->variables.size() != mission.workflow_variables.size() ||
      !HasValidMissionWorkflowVariables(mission)) return std::nullopt;
  for (size_t i = 0; i < workflow->variables.size(); ++i) {
    if (workflow->variables[i] != mission.workflow_variables[i].definition) return std::nullopt;
  }
  for (size_t i = 0; i < expanded->size(); ++i) {
    const auto& reviewed = (*expanded)[i];
    const auto& local = mission.steps[i];
    if (reviewed.id != local.workflow_step_id || reviewed.name != local.label ||
        reviewed.condition_input_id != local.condition_input_id ||
        reviewed.condition_equals != local.condition_equals ||
        reviewed.numeric_condition != local.numeric_condition ||
        reviewed.condition_from_variable != local.condition_from_variable ||
        reviewed.predicate != local.predicate ||
        reviewed.assignment != local.assignment ||
        reviewed.wait_seconds != local.wait_seconds ||
        reviewed.wait_timeout_seconds != local.wait_timeout_seconds ||
        ((reviewed.kind == TahaiOperationalWorkflowStepKind::kWait) != (local.wait_seconds != 0)) ||
        ((reviewed.kind == TahaiOperationalWorkflowStepKind::kAssignVariable) != local.assignment.has_value()) ||
        (reviewed.kind == TahaiOperationalWorkflowStepKind::kRunCommand) != local.requires_native_action)
      return std::nullopt;
  }
  for (size_t i = 0; i < workflow->inputs.size(); ++i) {
    const auto& reviewed = workflow->inputs[i];
    const auto& local = mission.workflow_inputs[i];
    if (reviewed.id != local.id || reviewed.name != local.name ||
        TahaiOperationalWorkflowInputTypeName(reviewed.type) != local.type ||
        reviewed.required != local.required ||
        reviewed.options != local.options ||
        reviewed.is_protected != local.is_protected ||
        reviewed.validation != local.validation) return std::nullopt;
  }
  MissionSummary available = mission;
  if (available.steps[index].action_state == "pending") {
    // Validate recorded decisions before normalizing the in-flight attempt for
    // the ready-state preflight. A lost branch decision cannot be recreated
    // from a subsequently changed variable during asynchronous dispatch.
    if (!IsMissionWorkflowStepConditionResolved(mission, index)) return std::nullopt;
    if (MissionWorkflowNativeTimeRemaining(available.steps[index]).value_or(0) == 0) return std::nullopt;
    available.steps[index].action_state = "ready";
    available.steps[index].native_action_started.reset();
  }
  if (!CanBeginMissionNativeStep(available, index)) return std::nullopt;
  const auto& action = (*expanded)[index].action;
  if (!IsTahaiOperationalActionDeclared(manifest.capabilities, action)) return std::nullopt;
  return GetTahaiOperationalSkinCommand(action);
}

std::unique_ptr<content::WebUIMessageHandler> CreateWorkflowNativeHandler(Profile* profile) {
  return std::make_unique<WorkflowNativeHandler>(profile);
}

}  // namespace tahai
