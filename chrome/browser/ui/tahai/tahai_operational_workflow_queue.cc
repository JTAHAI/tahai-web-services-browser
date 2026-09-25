// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_operational_workflow_queue.h"

#include <algorithm>
#include <set>
#include <utility>

#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"

namespace tahai {
namespace {

bool IsSafeIdentifier(std::string_view value) {
  if (value.size() < 3u || value.size() > 64u || value.front() == '-' ||
      value.back() == '-') {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '-';
  });
}

bool IsSafeLabel(std::string_view value) {
  return !value.empty() && value.size() <= 128u &&
         std::all_of(value.begin(), value.end(), [](char character) {
           return static_cast<unsigned char>(character) >= 0x20u;
         });
}

bool IsSha256(std::string_view value) {
  return value.size() == 64u &&
         std::all_of(value.begin(), value.end(), [](char character) {
           return (character >= '0' && character <= '9') ||
                  (character >= 'a' && character <= 'f') ||
                  (character >= 'A' && character <= 'F');
         });
}

bool IsQueueProfile(Profile* profile) {
  return profile && profile->IsRegularProfile() && !profile->IsOffTheRecord();
}

}  // namespace

bool QueueOperationalWorkflowLaunch(Profile* profile,
                                    const TahaiOperationalWorkflow& workflow,
                                    std::string_view skin_id,
                                    std::string_view archive_sha256) {
  if (!IsQueueProfile(profile) || !IsSafeIdentifier(skin_id) ||
      !IsSafeIdentifier(workflow.id) || !IsSafeLabel(workflow.name) ||
      !IsSha256(archive_sha256) || workflow.steps.empty() ||
      workflow.steps.size() > 32u || !ValidateTahaiWorkflowActionBindings(workflow.steps) || !ExpandTahaiWorkflowSteps(workflow)) {
    return false;
  }
  base::ListValue steps;
  base::ListValue command_steps;
  for (const TahaiOperationalWorkflowStep& step : workflow.steps) {
    if (!IsSafeIdentifier(step.id) || !IsSafeLabel(step.name)) {
      return false;
    }
    if ((step.kind == TahaiOperationalWorkflowStepKind::kAssignVariable) !=
        step.assignment.has_value()) return false;
    if (step.assignment && !ValidateTahaiWorkflowAssignment(*step.assignment, workflow.inputs, workflow.variables)) return false;
    if ((step.kind == TahaiOperationalWorkflowStepKind::kWait) != (step.wait_seconds != 0)) return false;
    if (step.wait_seconds && !step.action.empty()) return false;
    if (step.wait_timeout_seconds && (!step.wait_seconds || step.wait_timeout_seconds <= step.wait_seconds ||
                                     step.wait_timeout_seconds > 86400)) return false;
    base::DictValue saved_step;
    saved_step.Set("id", step.id);
    saved_step.Set("name", step.name);
    if (step.kind == TahaiOperationalWorkflowStepKind::kRunCommand) {
      command_steps.Append(step.id);
    }
    // The Mission adapter retains review checkpoints but cannot dispatch a
    // package's action. That authority belongs to a separate native broker.
    saved_step.Set("kind", step.kind ==
                                   TahaiOperationalWorkflowStepKind::kCheckpoint
                               ? "checkpoint"
                               : step.kind == TahaiOperationalWorkflowStepKind::kAssignVariable
                                     ? "assign-variable" : step.kind == TahaiOperationalWorkflowStepKind::kWait
                                         ? "wait" : "instruction");
    if (step.wait_seconds) {
      base::DictValue wait;
      wait.Set("seconds", step.wait_seconds);
      if (step.wait_timeout_seconds) wait.Set("timeout_seconds", step.wait_timeout_seconds);
      saved_step.Set("wait", std::move(wait));
    }
    if (step.assignment) saved_step.Set("assign",
        SerializeTahaiWorkflowAssignment(*step.assignment));
    if (step.predicate) {
      if (step.predicate->operation.empty() || !step.condition_input_id.empty() || !step.condition_equals.empty() ||
          step.numeric_condition || step.condition_from_variable) return false;
      saved_step.Set("when", SerializeTahaiWorkflowPredicate(*step.predicate));
    }
    if (!step.condition_input_id.empty() || !step.condition_equals.empty() || step.numeric_condition || step.condition_from_variable) {
      base::DictValue when;
      when.Set(step.condition_from_variable ? "variable" : "input", step.condition_input_id);
      if (step.numeric_condition) when.Set("compare", SerializeTahaiWorkflowNumericCondition(*step.numeric_condition));
      if (!step.numeric_condition || !step.condition_equals.empty()) when.Set("equals", step.condition_equals);
      saved_step.Set("when", std::move(when));
    }
    steps.Append(std::move(saved_step));
  }
  if (workflow.inputs.size() > 12u) {
    return false;
  }
  base::ListValue inputs;
  for (const TahaiOperationalWorkflowInput& input : workflow.inputs) {
    if (!IsValidTahaiWorkflowInputValidation(
            input.validation, TahaiOperationalWorkflowInputTypeName(input.type))) {
      return false;
    }
    base::DictValue saved_input;
    saved_input.Set("id", input.id);
    saved_input.Set("name", input.name);
    saved_input.Set("type", TahaiOperationalWorkflowInputTypeName(input.type));
    saved_input.Set("required", input.required);
    if (input.is_protected) saved_input.Set("protected", true);
    if (input.validation) saved_input.Set("validation",
        SerializeTahaiWorkflowInputValidation(*input.validation));
    if (input.type == TahaiOperationalWorkflowInputType::kSelection ||
        !input.options.empty()) {
      base::ListValue options;
      for (const std::string& option : input.options) {
        options.Append(option);
      }
      saved_input.Set("options", std::move(options));
    }
    inputs.Append(std::move(saved_input));
  }
  base::DictValue saved_workflow;
  saved_workflow.Set("id", workflow.id);
  saved_workflow.Set("name", workflow.name);
  saved_workflow.Set("inputs", std::move(inputs));
  saved_workflow.Set("steps", std::move(steps));
  saved_workflow.Set("variables", SerializeTahaiWorkflowVariables(workflow.variables));
  if (!workflow.repeats.empty()) saved_workflow.Set("repeats", SerializeTahaiWorkflowRepeats(workflow.repeats));
  std::vector<std::string_view> input_ids;
  for (const auto& input : workflow.inputs) input_ids.push_back(input.id);
  std::vector<std::string_view> variable_ids;
  for (const auto& variable : workflow.variables) variable_ids.push_back(variable.id);
  if (!ValidateTahaiWorkflowOutputs(workflow.outputs, input_ids, variable_ids)) return false;
  if (!workflow.outputs.empty()) saved_workflow.Set(
      "outputs", SerializeTahaiWorkflowOutputs(workflow.outputs));
  TahaiOperationalWorkflow validated;
  if (!ValidateTahaiOperationalWorkflow(saved_workflow, {}, &validated, true)) {
    return false;
  }
  base::DictValue queued;
  queued.Set("schema_version", 3);
  queued.Set("skin_id", skin_id);
  queued.Set("archive_sha256", archive_sha256);
  queued.Set("workflow", std::move(saved_workflow));
  queued.Set("command_steps", std::move(command_steps));
  profile->GetPrefs()->SetDict(prefs::kTahaiPendingOperationalWorkflow,
                               std::move(queued));
  return true;
}

std::optional<QueuedOperationalWorkflowLaunch>
GetQueuedOperationalWorkflowLaunch(Profile* profile) {
  if (!IsQueueProfile(profile)) {
    return std::nullopt;
  }
  const base::DictValue& queued =
      profile->GetPrefs()->GetDict(prefs::kTahaiPendingOperationalWorkflow);
  const std::string* skin_id = queued.FindString("skin_id");
  const std::string* archive_sha256 = queued.FindString("archive_sha256");
  if (queued.contains("schema_version")) {
    const base::DictValue* workflow = queued.FindDict("workflow");
    QueuedOperationalWorkflowLaunch result;
    const auto version = queued.FindInt("schema_version");
    if (!((version == 2 && queued.size() == 4u) ||
          (version == 3 && queued.size() == 5u)) ||
        !skin_id || !IsSafeIdentifier(*skin_id) || !archive_sha256 ||
        !IsSha256(*archive_sha256) || !workflow ||
        !ValidateTahaiOperationalWorkflow(*workflow, {}, &result.workflow, true)) {
      return std::nullopt;
    }
    if (version == 3) {
      const auto* commands = queued.FindList("command_steps");
      if (!commands || commands->size() > result.workflow.steps.size()) {
        return std::nullopt;
      }
      std::set<std::string> seen;
      for (const auto& entry : *commands) {
        const auto* id = entry.GetIfString();
        if (!id || !seen.insert(*id).second) {
          return std::nullopt;
        }
        auto step = std::ranges::find(result.workflow.steps, *id,
                                      &TahaiOperationalWorkflowStep::id);
        if (step == result.workflow.steps.end() ||
            step->kind != TahaiOperationalWorkflowStepKind::kInstruction) {
          return std::nullopt;
        }
        // Retain only that a step requires the native adapter. Resolve its
        // actual command again from the trusted revision at invocation time.
        step->kind = TahaiOperationalWorkflowStepKind::kRunCommand;
      }
      result.adapter_version = 1;
    }
    if (!ValidateTahaiWorkflowActionBindings(result.workflow.steps)) return std::nullopt;
    result.skin_id = *skin_id;
    result.archive_sha256 = *archive_sha256;
    return result;
  }
  // Accept the prior inert handoff shape for profiles written by early v2.
  const std::string* workflow_id = queued.FindString("workflow_id");
  const std::string* workflow_name = queued.FindString("workflow_name");
  const base::ListValue* steps = queued.FindList("steps");
  if (queued.size() != 5u || !queued.contains("skin_id") ||
      !queued.contains("workflow_id") || !queued.contains("workflow_name") ||
      !queued.contains("archive_sha256") || !queued.contains("steps") ||
      !skin_id || !workflow_id || !workflow_name || !archive_sha256 || !steps ||
      !IsSafeIdentifier(*skin_id) || !IsSafeIdentifier(*workflow_id) ||
      !IsSafeLabel(*workflow_name) || !IsSha256(*archive_sha256) ||
      steps->empty() || steps->size() > 32u) {
    return std::nullopt;
  }
  QueuedOperationalWorkflowLaunch result;
  result.skin_id = *skin_id;
  result.archive_sha256 = *archive_sha256;
  result.workflow.id = *workflow_id;
  result.workflow.name = *workflow_name;
  for (const base::Value& value : *steps) {
    const base::DictValue* step = value.GetIfDict();
    const std::string* id = step ? step->FindString("id") : nullptr;
    const std::string* name = step ? step->FindString("name") : nullptr;
    if (!step || step->size() != 2u || !step->contains("id") ||
        !step->contains("name") || !id || !name || !IsSafeIdentifier(*id) ||
        !IsSafeLabel(*name)) {
      return std::nullopt;
    }
    result.workflow.steps.push_back(
        {*id, *name, TahaiOperationalWorkflowStepKind::kInstruction, {}});
  }
  return result;
}

void ClearQueuedOperationalWorkflowLaunch(Profile* profile) {
  if (IsQueueProfile(profile)) {
    profile->GetPrefs()->ClearPref(prefs::kTahaiPendingOperationalWorkflow);
  }
}

}  // namespace tahai
