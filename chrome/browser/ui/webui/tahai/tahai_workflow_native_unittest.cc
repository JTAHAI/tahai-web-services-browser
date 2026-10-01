// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include <string>

#include "base/test/bind.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/ui/tahai/tahai_operational_workflow_queue.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"
#include "chrome/browser/ui/webui/tahai/tahai_workflow_native_handler.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"
#include "chrome/test/base/testing_profile.h"
#include "components/prefs/pref_change_registrar.h"
#include "components/prefs/pref_service.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "content/public/test/browser_task_environment.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

class TahaiWorkflowNativeTest : public testing::Test {
 protected:
  void SetUp() override {
    manifest_.appearance.id = "reviewed-skin";
    manifest_.capabilities = {TahaiOperationalCapability::kBrowserNavigation};
    TahaiOperationalWorkflow workflow;
    workflow.id = "review-flow";
    workflow.name = "Review flow";
    workflow.inputs = {
        {"approved", "Approved", TahaiOperationalWorkflowInputType::kBoolean, false, {}},
        {"review-day", "Review day", TahaiOperationalWorkflowInputType::kDate, false, {}},
        {"reference", "Reference site", TahaiOperationalWorkflowInputType::kUrl, false, {}}};
    workflow.steps = {
        {"scope", "Review scope", TahaiOperationalWorkflowStepKind::kCheckpoint, {}},
        {"focus", "Focus address", TahaiOperationalWorkflowStepKind::kRunCommand,
          "address.focus", "approved", "true"}};
    manifest_.workflows.push_back(workflow);
    manifest_.modes.push_back({"review-mode", "Review mode", "surface", workflow.id, {}});
    service_ = std::make_unique<MissionService>(&profile_);
    const auto created = service_->CreateOperationalWorkflowMission(
        workflow, manifest_.appearance.id, sha_, true);
    ASSERT_TRUE(created);
    id_ = created->id;
    ASSERT_TRUE(service_->SetOperationalWorkflowInputValue(id_, "approved", "true"));
    ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "running"));
  }
  const MissionSummary& mission() { return service_->missions().front(); }
  std::optional<int> Resolve(const MissionSummary& snapshot) {
    return ResolveMissionNativeCommand(manifest_, "review-mode", sha_, snapshot, 1);
  }
  content::BrowserTaskEnvironment environment_{
      base::test::TaskEnvironment::TimeSource::MOCK_TIME};
  TestingProfile profile_;
  TahaiOperationalSkinManifest manifest_;
  std::unique_ptr<MissionService> service_;
  std::string sha_ = std::string(64, 'a');
  std::string id_;
};

TEST_F(TahaiWorkflowNativeTest, DispatchNeedsPrecedingCheckpointAndSeparateResultReview) {
  EXPECT_FALSE(Resolve(mission()));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(mission()));
  EXPECT_FALSE(service_->ToggleStep(id_, 1));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(mission()));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  EXPECT_FALSE(service_->ToggleStep(id_, 1));
  EXPECT_FALSE(service_->SetOperationalWorkflowInputValue(id_, "approved", "false"));
  EXPECT_FALSE(service_->FinishNativeWorkflowStep(id_, 1, "succeeded"));
  ASSERT_TRUE(service_->FinishNativeWorkflowStep(id_, 1, "dispatched"));
  EXPECT_FALSE(mission().steps[1].complete);
  EXPECT_FALSE(Resolve(mission()));
  EXPECT_FALSE(service_->SetOperationalWorkflowRunState(id_, "succeeded"));
  ASSERT_TRUE(service_->ToggleStep(id_, 1));
  ASSERT_TRUE(service_->ToggleStep(id_, 1));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  EXPECT_FALSE(service_->SetOperationalWorkflowInputValue(id_, "approved", "false"));
  ASSERT_TRUE(service_->ToggleStep(id_, 1));
  EXPECT_TRUE(service_->SetOperationalWorkflowRunState(id_, "succeeded"));
}

TEST_F(TahaiWorkflowNativeTest, BoundedRepeatActionsPinEveryIterationAndCannotReuseCompletedAttempts) {
  auto& workflow = manifest_.workflows[0]; workflow.repeats = {{"rounds", "scope", "focus", 2}};
  const auto created = service_->CreateOperationalWorkflowMission(workflow, manifest_.appearance.id, sha_, true); ASSERT_TRUE(created);
  const auto id = created->id;
  ASSERT_TRUE(service_->SetOperationalWorkflowInputValue(id, "approved", "true"));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id, "running"));
  const auto& run = service_->missions().back(); ASSERT_EQ(4u, run.steps.size());
  auto resolve = [&](size_t index) { return ResolveMissionNativeCommand(manifest_, "review-mode", sha_, run, index); };
  EXPECT_FALSE(resolve(3)); ASSERT_TRUE(service_->ToggleStep(id, 0)); EXPECT_EQ(IDC_FOCUS_LOCATION, resolve(1));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id, 1)); EXPECT_EQ(IDC_FOCUS_LOCATION, resolve(1));
  ASSERT_TRUE(service_->FinishNativeWorkflowStep(id, 1, "dispatched")); ASSERT_TRUE(service_->ToggleStep(id, 1));
  EXPECT_FALSE(resolve(1)); EXPECT_FALSE(service_->BeginNativeWorkflowStep(id, 1));
  ASSERT_TRUE(service_->ToggleStep(id, 2)); EXPECT_EQ(IDC_FOCUS_LOCATION, resolve(3));
  EXPECT_EQ("r-rounds-1-focus", run.steps[1].workflow_step_id); EXPECT_EQ("r-rounds-2-focus", run.steps[3].workflow_step_id);
  auto tampered = run; tampered.steps[3].workflow_step_id = tampered.steps[1].workflow_step_id;
  EXPECT_FALSE(ResolveMissionNativeCommand(manifest_, "review-mode", sha_, tampered, 3));
  workflow.repeats[0].count = 3; EXPECT_FALSE(resolve(3)); workflow.repeats[0].count = 2;
  workflow.repeats[0].through = "scope"; EXPECT_FALSE(resolve(3)); workflow.repeats[0].through = "focus";
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id, 3)); ASSERT_TRUE(service_->FinishNativeWorkflowStep(id, 3, "unknown"));
  EXPECT_FALSE(resolve(3)); EXPECT_FALSE(service_->BeginNativeWorkflowStep(id, 3));
}

TEST_F(TahaiWorkflowNativeTest, ProtectedVariablePrivacyIsPinnedBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto& workflow = manifest_.workflows[0];
  workflow.variables = {{"private-value", "Private value", TahaiOperationalWorkflowInputType::kText, false, {}, true}};
  auto snapshot = mission(); snapshot.workflow_variables = {{workflow.variables[0], {}}};
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  snapshot.workflow_variables[0].definition.is_protected = false; EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_variables[0].definition.is_protected = true;
  snapshot.workflow_variables[0].value = "plaintext"; EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_variables[0].value.clear(); snapshot.workflow_variables[0].protected_value = "bad"; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, DateAndUrlTypeChangesCannotRebindTrustedAction) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_EQ(IDC_FOCUS_LOCATION, Resolve(mission()));
  for (size_t index : {1u, 2u}) {
    MissionSummary tampered = mission();
    tampered.workflow_inputs[index].type = "text";
    EXPECT_FALSE(Resolve(tampered));
  }
}

TEST_F(TahaiWorkflowNativeTest, ResolverRejectsAlteredSnapshotRevisionModeOrDeclaration) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(Resolve(mission()));
  auto altered = mission();
  altered.steps[1].workflow_step_id = "another-step";
  EXPECT_FALSE(Resolve(altered));
  altered = mission(); altered.steps[1].condition_equals = "false";
  EXPECT_FALSE(Resolve(altered));
  altered = mission(); altered.workflow_inputs[0].required = true;
  EXPECT_FALSE(Resolve(altered));
  altered = mission(); altered.workflow_inputs[1].is_protected = true;
  EXPECT_FALSE(Resolve(altered));
  altered = mission(); altered.workflow_inputs[0].value.clear();
  EXPECT_FALSE(Resolve(altered));
  altered = mission(); altered.operational_workflow->adapter_version = 0;
  EXPECT_FALSE(Resolve(altered));
  altered = mission(); altered.operational_workflow->archive_sha256 = std::string(64, 'b');
  EXPECT_FALSE(Resolve(altered));
  altered = mission(); altered.operational_workflow->skin_id = "other-skin";
  EXPECT_FALSE(Resolve(altered));
  EXPECT_FALSE(ResolveMissionNativeCommand(manifest_, "other-mode", sha_, mission(), 1));
  manifest_.capabilities.clear();
  EXPECT_FALSE(Resolve(mission()));
  manifest_.capabilities = {TahaiOperationalCapability::kBrowserNavigation};
  manifest_.workflows[0].steps[1].action = "arbitrary-command";
  EXPECT_FALSE(Resolve(mission()));
}

TEST_F(TahaiWorkflowNativeTest, ValidationRulesCannotBeChangedRemovedOrBypassedAtDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission();
  const TahaiWorkflowInputValidation rules{20, 64, {}, {}};
  manifest_.workflows[0].inputs[2].validation = rules;
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_inputs[2].validation = rules;
  EXPECT_TRUE(Resolve(snapshot));  // Optional and unset is legitimate.
  snapshot.workflow_inputs[2].value = "https://x.test/";
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_inputs[2].value = "https://example.test/review";
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  snapshot.workflow_inputs[2].validation->min_bytes = 0;
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_inputs[2].validation.reset();
  EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, NamedOutputBindingsMustMatchTheTrustedRevision) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission();
  manifest_.workflows[0].outputs = {{"result", "Result", "reference"}};
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_outputs = manifest_.workflows[0].outputs;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  snapshot.workflow_outputs[0].input_id = "review-day";
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_outputs = manifest_.workflows[0].outputs;
  snapshot.workflow_outputs[0].name = "Different result";
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_outputs = manifest_.workflows[0].outputs;
  snapshot.workflow_outputs[0].id = "different-result";
  EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, WaitDefinitionAndCompletionMustMatchBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission(); auto& definition = manifest_.workflows[0].steps[0];
  definition.kind = TahaiOperationalWorkflowStepKind::kWait; definition.wait_seconds = 3;
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[0].wait_seconds = 3; snapshot.steps[0].wait_remaining_ms = 0;
  snapshot.steps[0].wait_state = "complete";
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  const auto valid = snapshot;
  snapshot.steps[0].wait_seconds = 2; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].wait_remaining_ms = 1; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].wait_state = "waiting";
  snapshot.steps[0].complete = false; snapshot.steps[0].wait_started = base::TimeTicks::Now();
  EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].wait_state = "paused"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].wait_started = base::TimeTicks::Now(); EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; definition.kind = TahaiOperationalWorkflowStepKind::kCheckpoint; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, WaitDeadlineCannotBeChangedOrRemovedBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission(); auto& definition = manifest_.workflows[0].steps[0];
  definition.kind = TahaiOperationalWorkflowStepKind::kWait; definition.wait_seconds = 3; definition.wait_timeout_seconds = 5;
  snapshot.steps[0].wait_seconds = 3; snapshot.steps[0].wait_state = "complete";
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[0].wait_timeout_seconds = 5;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  const auto valid = snapshot;
  snapshot.steps[0].wait_timeout_seconds = 6; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].wait_timeout_remaining_ms = 1; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].wait_state = "timed-out"; snapshot.steps[0].complete = false;
  snapshot.operational_workflow->run_state = "failed"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; definition.wait_timeout_seconds = 0; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, VariableDefinitionsAndAssignmentsMustMatchBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission();
  auto& workflow = manifest_.workflows[0];
  workflow.variables = {{"saved-reference", "Saved reference", TahaiOperationalWorkflowInputType::kUrl, false, {}}};
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_variables.push_back({workflow.variables[0], "https://example.test/local"});
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  workflow.steps[0].kind = TahaiOperationalWorkflowStepKind::kAssignVariable;
  workflow.steps[0].assignment = TahaiWorkflowAssignment{"saved-reference", "reference", false};
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[0].assignment = workflow.steps[0].assignment;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  snapshot.steps[0].assignment->source_id = "review-day";
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[0].assignment = workflow.steps[0].assignment;
  snapshot.workflow_variables[0].definition.name = "Different definition";
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_variables[0].definition = workflow.variables[0];
  snapshot.workflow_variables[0].value = "https://example.test/?access_token=secret";
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_variables[0].value = "https://example.test/local";
  snapshot.workflow_inputs[2].is_protected = true;
  workflow.inputs[2].is_protected = true;
  EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, NumericBranchDefinitionAndAnswerAreRecheckedBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission(); auto& workflow = manifest_.workflows[0];
  workflow.inputs.push_back({"amount", "Amount", TahaiOperationalWorkflowInputType::kNumber, false, {}});
  snapshot.workflow_inputs.push_back({"amount", "Amount", "number", false, {}, "4"});
  workflow.steps[1].condition_input_id = "amount"; workflow.steps[1].condition_equals.clear();
  workflow.steps[1].numeric_condition = TahaiWorkflowNumericCondition{"greater-than", 3};
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[1].condition_input_id = "amount"; snapshot.steps[1].condition_equals.clear();
  snapshot.steps[1].numeric_condition = workflow.steps[1].numeric_condition;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot)); const auto valid = snapshot;
  snapshot.workflow_inputs.back().value = "3"; EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_inputs.back().value.clear(); EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[1].numeric_condition->number = 2; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[1].numeric_condition->operation = "not-equal"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[1].condition_equals = "4"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.workflow_inputs.back().is_protected = true; workflow.inputs.back().is_protected = true;
  EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, VariableBranchNamespaceAndRecordedDecisionAreCheckedBeforeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission(); auto& workflow = manifest_.workflows[0];
  workflow.variables = {{"approved", "Saved choice", TahaiOperationalWorkflowInputType::kBoolean, false, {}}};
  snapshot.workflow_variables.push_back({workflow.variables[0], "false"});
  workflow.steps[1].condition_from_variable = true;
  EXPECT_FALSE(Resolve(snapshot));  // Input and variable IDs cannot be confused.
  snapshot.steps[1].condition_from_variable = true;
  EXPECT_FALSE(Resolve(snapshot)); snapshot.workflow_variables[0].value.clear(); EXPECT_FALSE(Resolve(snapshot));
  snapshot.workflow_variables[0].value = "true"; EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  snapshot.steps[1].action_state = "pending"; snapshot.steps[1].native_action_started = base::TimeTicks::Now();
  EXPECT_FALSE(Resolve(snapshot));  // Pending needs a decision recorded before reservation.
  snapshot.steps[1].variable_condition_result = true;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  snapshot.workflow_variables[0].value = "false";
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));  // Uses the already recorded decision.
  snapshot.steps[1].variable_condition_result = false; EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[1].variable_condition_result = true; workflow.steps[1].condition_from_variable = false;
  EXPECT_FALSE(Resolve(snapshot)); workflow.steps[1].condition_from_variable = true;
  snapshot.workflow_variables[0].definition.is_protected = true; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, CompoundPredicateDefinitionsAndPendingDecisionsArePinnedBeforeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0)); auto snapshot = mission(); auto& workflow = manifest_.workflows[0];
  TahaiWorkflowPredicate leaf; leaf.source_id = "approved"; leaf.equals = "true";
  TahaiWorkflowPredicate group; group.operation = "all"; group.arguments = {leaf, leaf};
  workflow.steps[1].condition_input_id.clear(); workflow.steps[1].condition_equals.clear(); workflow.steps[1].predicate = group;
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[1].condition_input_id.clear(); snapshot.steps[1].condition_equals.clear(); snapshot.steps[1].predicate = group;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot));
  snapshot.steps[1].predicate->operation = "any"; EXPECT_FALSE(Resolve(snapshot)); snapshot.steps[1].predicate = group;
  snapshot.steps[1].action_state = "pending"; snapshot.steps[1].native_action_started = base::TimeTicks::Now();
  EXPECT_FALSE(Resolve(snapshot)); snapshot.steps[1].variable_condition_result = true;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot)); snapshot.steps[1].variable_condition_result = false; EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[1].variable_condition_result = true; snapshot.steps[1].predicate->arguments[1].equals = "false";
  EXPECT_FALSE(Resolve(snapshot)); snapshot.steps[1].predicate = group;
  workflow.inputs[0].is_protected = true; snapshot.workflow_inputs[0].is_protected = true; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, ActionStatusBindingsAreExactlyPinnedBeforeAnyDispatch) {
  auto& workflow=manifest_.workflows[0];
  workflow.inputs.push_back({"dispatch","Separate input",TahaiOperationalWorkflowInputType::kText,false,{}});
  workflow.variables={{"outcome","Outcome",TahaiOperationalWorkflowInputType::kText,false,{}}};
  workflow.steps={{"dispatch","Dispatch address",TahaiOperationalWorkflowStepKind::kRunCommand,"address.focus"},
      {"capture","Record dispatch",TahaiOperationalWorkflowStepKind::kAssignVariable}};
  workflow.steps[1].assignment=TahaiWorkflowAssignment{"outcome","dispatch",false,{}, {},true};
  const auto created=service_->CreateOperationalWorkflowMission(workflow,manifest_.appearance.id,sha_,true);ASSERT_TRUE(created);
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id,"running"));
  const auto valid=service_->missions().back();
  const auto resolve=[&](const MissionSummary& run){return ResolveMissionNativeCommand(manifest_,"review-mode",sha_,run,0);};
  EXPECT_EQ(IDC_FOCUS_LOCATION,resolve(valid));
  auto tampered=valid;tampered.steps[1].assignment->from_action_status=false;EXPECT_FALSE(resolve(tampered));
  tampered=valid;tampered.steps[1].assignment->source_id="capture";EXPECT_FALSE(resolve(tampered));
  tampered=valid;tampered.steps[1].assignment->from_variable=true;EXPECT_FALSE(resolve(tampered));
  tampered=valid;tampered.workflow_variables[0].definition.is_protected=true;EXPECT_FALSE(resolve(tampered));
  workflow.steps[1].assignment->from_action_status=false;EXPECT_FALSE(resolve(valid));
}

TEST_F(TahaiWorkflowNativeTest, BooleanAssignmentsRemainExactlyRevisionPinnedBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0)); auto snapshot = mission(); auto& workflow = manifest_.workflows[0];
  workflow.variables = {{"result", "Result", TahaiOperationalWorkflowInputType::kBoolean, false, {}}};
  snapshot.workflow_variables.push_back({workflow.variables[0], "true"});
  TahaiWorkflowPredicate predicate; predicate.source_id = "result"; predicate.from_variable = true; predicate.equals = "true";
  workflow.steps[0].kind = TahaiOperationalWorkflowStepKind::kAssignVariable;
  TahaiWorkflowAssignment assignment; assignment.variable_id = "result"; assignment.boolean_expression = predicate;
  workflow.steps[0].assignment = assignment;
  EXPECT_FALSE(Resolve(snapshot)); snapshot.steps[0].assignment = assignment;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot)); const auto valid = snapshot;
  snapshot.steps[0].assignment->boolean_expression->equals = "false"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].assignment->boolean_expression->from_variable = false; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].assignment->expression = TahaiWorkflowNumericExpression{}; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.workflow_variables[0].definition.is_protected = true; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, TextExpressionsRemainExactlyRevisionPinnedBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0)); auto snapshot = mission(); auto& workflow = manifest_.workflows[0];
  workflow.variables = {{"result", "Result", TahaiOperationalWorkflowInputType::kText, false, {}}};
  snapshot.workflow_variables.push_back({workflow.variables[0], "ABC"});
  TahaiWorkflowTextExpression text; text.text = "abc";
  TahaiWorkflowTextExpression expression; expression.operation = "upper-ascii"; expression.arguments = {text};
  workflow.steps[0].kind = TahaiOperationalWorkflowStepKind::kAssignVariable;
  workflow.steps[0].assignment = TahaiWorkflowAssignment{"result", {}, false, {}, expression};
  EXPECT_FALSE(Resolve(snapshot)); snapshot.steps[0].assignment = workflow.steps[0].assignment;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot)); const auto valid = snapshot;
  snapshot.steps[0].assignment->text_expression->operation = "lower-ascii"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].assignment->text_expression->arguments[0].text = "changed"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].assignment->expression = TahaiWorkflowNumericExpression{}; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.workflow_variables[0].definition.is_protected = true; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, CalculationDefinitionsMustMatchExactlyBeforeNativeDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto snapshot = mission(); auto& workflow = manifest_.workflows[0];
  workflow.variables = {{"total", "Total", TahaiOperationalWorkflowInputType::kNumber, false, {}}};
  snapshot.workflow_variables.push_back({workflow.variables[0], "3"});
  TahaiWorkflowNumericExpression left; left.number = 1;
  TahaiWorkflowNumericExpression right; right.number = 2;
  TahaiWorkflowNumericExpression expression; expression.operation = "add"; expression.arguments = {left, right};
  workflow.steps[0].kind = TahaiOperationalWorkflowStepKind::kAssignVariable;
  workflow.steps[0].assignment = TahaiWorkflowAssignment{"total", {}, false, expression};
  EXPECT_FALSE(Resolve(snapshot));
  snapshot.steps[0].assignment = workflow.steps[0].assignment;
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(snapshot)); const auto valid = snapshot;
  snapshot.steps[0].assignment->expression->operation = "subtract"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].assignment->expression->arguments[0].number = 2;
  EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.steps[0].assignment->source_id = "reference"; EXPECT_FALSE(Resolve(snapshot));
  snapshot = valid; snapshot.workflow_variables[0].definition.is_protected = true; EXPECT_FALSE(Resolve(snapshot));
}

TEST_F(TahaiWorkflowNativeTest, RestartNeverReplaysPendingActionOrRestoresFalseCompletion) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  service_.reset();
  service_ = std::make_unique<MissionService>(&profile_);
  ASSERT_EQ(1u, service_->missions().size());
  EXPECT_EQ(1, mission().operational_workflow->adapter_version);
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("failed", mission().operational_workflow->run_state);
  EXPECT_FALSE(mission().steps[1].complete);
  EXPECT_FALSE(service_->ToggleStep(id_, 1));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  EXPECT_FALSE(Resolve(mission()));
  EXPECT_FALSE(service_->SetOperationalWorkflowRunState(id_, "succeeded"));
}

TEST_F(TahaiWorkflowNativeTest, PausedCancelledAndArchivedRunsCannotDispatch) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "paused"));
  EXPECT_FALSE(Resolve(mission()));
  ASSERT_TRUE(service_->FinishNativeWorkflowStep(id_, 1, "dispatched"));
  EXPECT_EQ("paused", mission().operational_workflow->run_state);
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "running"));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  EXPECT_TRUE(service_->ToggleStep(id_, 1));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "cancelled"));
  EXPECT_FALSE(Resolve(mission()));
  ASSERT_TRUE(service_->ArchiveMission(id_));
  EXPECT_FALSE(Resolve(mission()));
}

TEST_F(TahaiWorkflowNativeTest,
       ArchiveRestoreNeverImplicitlyResumesNativeWork) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_EQ(IDC_FOCUS_LOCATION, Resolve(mission()));
  ASSERT_TRUE(service_->ArchiveMission(id_));
  EXPECT_EQ("paused", mission().operational_workflow->run_state);
  EXPECT_FALSE(Resolve(mission()));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  ASSERT_TRUE(service_->RestoreMission(id_));
  EXPECT_EQ("paused", mission().operational_workflow->run_state);
  EXPECT_FALSE(Resolve(mission()));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "running"));
  ASSERT_EQ(IDC_FOCUS_LOCATION, Resolve(mission()));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  ASSERT_TRUE(service_->ArchiveMission(id_));
  EXPECT_EQ("paused", mission().operational_workflow->run_state);
  ASSERT_TRUE(service_->FinishNativeWorkflowStep(id_, 1, "dispatched"));
  EXPECT_EQ("dispatched", mission().steps[1].action_state);
  EXPECT_EQ("paused", mission().operational_workflow->run_state);
  ASSERT_TRUE(service_->RestoreMission(id_));
  EXPECT_FALSE(service_->ToggleStep(id_, 1));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "running"));
  ASSERT_TRUE(service_->ToggleStep(id_, 1));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "succeeded"));
  ASSERT_TRUE(service_->ArchiveMission(id_));
  ASSERT_TRUE(service_->RestoreMission(id_));
  EXPECT_EQ("succeeded", mission().operational_workflow->run_state);
  EXPECT_FALSE(service_->SetOperationalWorkflowRunState(id_, "running"));
}

TEST_F(TahaiWorkflowNativeTest,
       LegacyArchivedRunningSnapshotRequiresExplicitResume) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  auto saved = profile_.GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  ASSERT_EQ(1u, saved.size());
  saved.front().GetDict().Set("archived", true);
  profile_.GetPrefs()->SetList(prefs::kTahaiMissions, std::move(saved));
  service_ = std::make_unique<MissionService>(&profile_);
  ASSERT_EQ(1u, service_->missions().size());
  ASSERT_TRUE(mission().operational_workflow);
  EXPECT_TRUE(mission().archived);
  EXPECT_EQ("paused", mission().operational_workflow->run_state);
  EXPECT_TRUE(mission().timeline_integrity_verified);
  ASSERT_TRUE(service_->RestoreMission(id_));
  EXPECT_FALSE(Resolve(mission()));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  service_ = std::make_unique<MissionService>(&profile_);
  EXPECT_EQ("paused", mission().operational_workflow->run_state);
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "running"));
  EXPECT_EQ(IDC_FOCUS_LOCATION, Resolve(mission()));
}

TEST_F(TahaiWorkflowNativeTest, LegacyMissionNeverAcquiresCommandAuthority) {
  auto legacy = service_->CreateOperationalWorkflowMission(
      manifest_.workflows[0], manifest_.appearance.id, sha_);
  ASSERT_TRUE(legacy);
  ASSERT_TRUE(service_->SetOperationalWorkflowInputValue(legacy->id, "approved", "true"));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(legacy->id, "running"));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(legacy->id, 1));
  ASSERT_TRUE(service_->ToggleStep(legacy->id, 0));
  EXPECT_TRUE(service_->ToggleStep(legacy->id, 1));
}

TEST_F(TahaiWorkflowNativeTest, RejectedAndUnknownOutcomesFailRunWithoutReplayOrOutputs) {
  for (const char* result : {"rejected", "unknown"}) {
    SCOPED_TRACE(result);
    auto workflow = manifest_.workflows.front();
    workflow.outputs = {{"answer", "Answer", "approved"}};
    workflow.steps.push_back({"after", "After", TahaiOperationalWorkflowStepKind::kCheckpoint});
    const auto created = service_->CreateOperationalWorkflowMission(workflow, manifest_.appearance.id, sha_, true);
    ASSERT_TRUE(created);
    ASSERT_TRUE(service_->SetOperationalWorkflowInputValue(created->id, "approved", "true"));
    ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id, "running"));
    ASSERT_TRUE(service_->ToggleStep(created->id, 0));
    ASSERT_TRUE(service_->BeginNativeWorkflowStep(created->id, 1));
    ASSERT_TRUE(service_->FinishNativeWorkflowStep(created->id, 1, result));
    const auto& run = service_->missions().back();
    EXPECT_EQ("failed", run.operational_workflow->run_state);
    EXPECT_EQ(result, run.steps[1].action_state);
    EXPECT_FALSE(run.steps[1].complete);
    EXPECT_FALSE(service_->BeginNativeWorkflowStep(created->id, 1));
    EXPECT_FALSE(service_->FinishNativeWorkflowStep(created->id, 1, "dispatched"));
    EXPECT_FALSE(service_->ToggleStep(created->id, 2));
    EXPECT_FALSE(service_->SetOperationalWorkflowRunState(created->id, "running"));
    EXPECT_FALSE(service_->SetOperationalWorkflowRunState(created->id, "succeeded"));
    EXPECT_FALSE(service_->SetOperationalWorkflowInputValue(created->id, "approved", "false"));
    EXPECT_FALSE(ResolveMissionWorkflowOutput(run, "answer"));
    EXPECT_EQ(std::string("Native workflow action ") + result, run.timeline.front().detail);
  }
}

TEST_F(TahaiWorkflowNativeTest, LateFailurePreservesCancellationAndClosesPausedOrArchivedRun) {
  for (const char* state : {"paused", "cancelled", "archived"}) {
    SCOPED_TRACE(state);
    const auto created = service_->CreateOperationalWorkflowMission(
        manifest_.workflows.front(), manifest_.appearance.id, sha_, true);
    ASSERT_TRUE(created);
    ASSERT_TRUE(service_->SetOperationalWorkflowInputValue(created->id, "approved", "true"));
    ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id, "running"));
    ASSERT_TRUE(service_->ToggleStep(created->id, 0));
    ASSERT_TRUE(service_->BeginNativeWorkflowStep(created->id, 1));
    if (std::string_view(state) == "archived") ASSERT_TRUE(service_->ArchiveMission(created->id));
    else ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id, state));
    ASSERT_TRUE(service_->FinishNativeWorkflowStep(created->id, 1, "unknown"));
    EXPECT_EQ(std::string_view(state) == "cancelled" ? "cancelled" : "failed",
              service_->missions().back().operational_workflow->run_state);
    if (std::string_view(state) == "archived") ASSERT_TRUE(service_->RestoreMission(created->id));
    EXPECT_FALSE(service_->SetOperationalWorkflowRunState(created->id, "running"));
    EXPECT_FALSE(service_->BeginNativeWorkflowStep(created->id, 1));
    EXPECT_FALSE(service_->ToggleStep(created->id, 1));
  }
}

TEST_F(TahaiWorkflowNativeTest, SavedNativeFailuresCloseWithoutRewritingPreferencesOrFalseSuccess) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  const auto saved = profile_.GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  for (const char* action : {"pending", "rejected", "unknown"}) {
    for (const char* state : {"running", "paused", "succeeded", "cancelled"}) {
      SCOPED_TRACE(action);
      SCOPED_TRACE(state);
      service_.reset();
      auto snapshot = saved.Clone();
      auto& record = snapshot[0].GetDict();
      record.FindDict("operational_workflow")->Set("run_state", state);
      auto& step = (*record.FindList("steps"))[1].GetDict();
      step.Set("action_state", action); step.Set("complete", true);
      profile_.GetPrefs()->SetList(prefs::kTahaiMissions, snapshot.Clone());
      service_ = std::make_unique<MissionService>(&profile_);
      ASSERT_EQ(1u, service_->missions().size());
      ASSERT_TRUE(mission().operational_workflow);
      EXPECT_EQ(std::string_view(state) == "cancelled" ? "cancelled" : "failed",
                mission().operational_workflow->run_state);
      EXPECT_EQ(std::string_view(action) == "pending" ? "unknown" : action, mission().steps[1].action_state);
      EXPECT_FALSE(mission().steps[1].complete);
      EXPECT_FALSE(Resolve(mission()));
      EXPECT_FALSE(service_->SetOperationalWorkflowRunState(id_, "running"));
      EXPECT_EQ(snapshot, profile_.GetPrefs()->GetList(prefs::kTahaiMissions));
    }
  }
}

TEST_F(TahaiWorkflowNativeTest, ManagedPolicyDuringNativeCompletionCannotRewriteUserStorage) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  auto* preferences = profile_.GetTestingPrefService();
  const auto user_saved = preferences->GetUserPrefValue(prefs::kTahaiMissions)->Clone();
  preferences->SetManagedPref(prefs::kTahaiMissions, base::Value(base::ListValue()));
  ASSERT_TRUE(service_->FinishNativeWorkflowStep(id_, 1, "unknown"));
  EXPECT_EQ("failed", mission().operational_workflow->run_state);
  EXPECT_TRUE(preferences->GetList(prefs::kTahaiMissions).empty());
  EXPECT_EQ(user_saved, *preferences->GetUserPrefValue(prefs::kTahaiMissions));
  preferences->RemoveManagedPref(prefs::kTahaiMissions);
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  EXPECT_FALSE(service_->SetOperationalWorkflowRunState(id_, "running"));
  service_.reset(); service_ = std::make_unique<MissionService>(&profile_);
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("failed", mission().operational_workflow->run_state);
}

TEST_F(TahaiWorkflowNativeTest, NativeDeadlineExpiresWithoutRendererAndSurvivesRestart) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  const auto token = mission().mutation_token;
  EXPECT_EQ(10000, MissionWorkflowNativeTimeRemaining(mission().steps[1]));
  const auto& saved = profile_.GetPrefs()->GetList(prefs::kTahaiMissions).front().GetDict();
  EXPECT_FALSE((*saved.FindList("steps"))[1].GetDict().contains("native_action_started"));
  environment_.FastForwardBy(base::Milliseconds(9999));
  EXPECT_EQ("pending", mission().steps[1].action_state);
  EXPECT_EQ(1, MissionWorkflowNativeTimeRemaining(mission().steps[1]));
  environment_.FastForwardBy(base::Milliseconds(1));
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("deadline-exceeded", mission().steps[1].native_action_error);
  EXPECT_EQ("failed", mission().operational_workflow->run_state);
  EXPECT_FALSE(mission().steps[1].native_action_started);
  EXPECT_FALSE(mission().steps[1].complete);
  EXPECT_NE(token, mission().mutation_token);
  EXPECT_EQ("Native workflow action deadline exceeded; outcome unknown", mission().timeline.front().detail);
  EXPECT_FALSE(service_->FinishNativeWorkflowStep(id_, 1, "dispatched"));
  EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
  const auto stored = profile_.GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  service_.reset(); service_ = std::make_unique<MissionService>(&profile_);
  ASSERT_TRUE(mission().operational_workflow);
  EXPECT_EQ("deadline-exceeded", mission().steps[1].native_action_error);
  EXPECT_EQ("failed", mission().operational_workflow->run_state);
  EXPECT_TRUE(mission().timeline_integrity_verified);
  EXPECT_EQ(stored, profile_.GetPrefs()->GetList(prefs::kTahaiMissions));
  const auto events = mission().timeline.size();
  environment_.FastForwardBy(base::Hours(1));
  EXPECT_EQ(events, mission().timeline.size());
  EXPECT_FALSE(Resolve(mission()));
}

TEST_F(TahaiWorkflowNativeTest, NativeDeadlineCannotBeBypassedBeforeTimerDeliveryOrWithInvalidClock) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  EXPECT_TRUE(Resolve(mission()));
  auto invalid = mission(); invalid.steps[1].native_action_started.reset();
  EXPECT_FALSE(Resolve(invalid));
  EXPECT_FALSE(MissionWorkflowNativeTimeRemaining(invalid.steps[1]));
  invalid = mission(); invalid.steps[1].native_action_started = base::TimeTicks::Now() + base::Seconds(1);
  EXPECT_FALSE(Resolve(invalid));
  environment_.AdvanceClock(kMissionNativeAttemptTimeout);
  // The task has not run yet. Both dispatch resolution and completion still
  // enforce the absolute process-local deadline synchronously.
  EXPECT_EQ("pending", mission().steps[1].action_state);
  EXPECT_FALSE(Resolve(mission()));
  EXPECT_FALSE(service_->FinishNativeWorkflowStep(id_, 1, "dispatched"));
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("deadline-exceeded", mission().steps[1].native_action_error);
  const auto events = mission().timeline.size();
  environment_.RunUntilIdle();
  EXPECT_EQ(events, mission().timeline.size());
}

TEST_F(TahaiWorkflowNativeTest, NativeDeadlineMutationSurvivesOwnerDeletion) {
  for (const char* operation : {"begin", "assign", "wait", "finish", "state",
                                "step", "rollback", "input", "archive"}) {
    SCOPED_TRACE(operation);
    if (!service_) {
      service_ = std::make_unique<MissionService>(&profile_);
    }
    const auto created = service_->CreateOperationalWorkflowMission(
        manifest_.workflows.front(), manifest_.appearance.id, sha_, true);
    ASSERT_TRUE(created);
    const std::string id = created->id;
    ASSERT_TRUE(
        service_->SetOperationalWorkflowInputValue(id, "approved", "true"));
    ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id, "running"));
    ASSERT_TRUE(service_->ToggleStep(id, 0));
    ASSERT_TRUE(service_->BeginNativeWorkflowStep(id, 1));
    environment_.AdvanceClock(kMissionNativeAttemptTimeout);
    PrefChangeRegistrar registrar;
    registrar.Init(profile_.GetPrefs());
    registrar.Add(prefs::kTahaiMissions,
                  base::BindLambdaForTesting([&] { service_.reset(); }));
    const std::string_view action(operation);
    bool result = true;
    if (action == "begin") {
      result = service_->BeginNativeWorkflowStep(id, 1);
    } else if (action == "assign") {
      result = service_->AssignWorkflowVariable(id, 0);
    } else if (action == "wait") {
      result = service_->ControlWorkflowWait(id, 0, false);
    } else if (action == "finish") {
      result = service_->FinishNativeWorkflowStep(id, 1, "dispatched");
    } else if (action == "state") {
      result = service_->SetOperationalWorkflowRunState(id, "paused");
    } else if (action == "step") {
      result = service_->ToggleStep(id, 0);
    } else if (action == "rollback") {
      result = service_->ToggleRollbackStep(id, 0);
    } else if (action == "input") {
      result =
          service_->SetOperationalWorkflowInputValue(id, "approved", "false");
    } else if (action == "archive") {
      result = service_->ArchiveMission(id);
    }
    EXPECT_FALSE(result);
    EXPECT_FALSE(service_);
    registrar.RemoveAll();
    MissionService reloaded(&profile_);
    EXPECT_EQ("unknown", reloaded.missions().back().steps[1].action_state);
    EXPECT_EQ("deadline-exceeded",
              reloaded.missions().back().steps[1].native_action_error);
  }
}

TEST_F(TahaiWorkflowNativeTest, NativeDeadlineShutdownSurvivesOwnerDeletion) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.AdvanceClock(kMissionNativeAttemptTimeout);
  PrefChangeRegistrar registrar;
  registrar.Init(profile_.GetPrefs());
  registrar.Add(prefs::kTahaiMissions,
                base::BindLambdaForTesting([&] { service_.reset(); }));
  service_->Shutdown();
  EXPECT_FALSE(service_);
  registrar.RemoveAll();
  MissionService reloaded(&profile_);
  EXPECT_EQ("unknown", reloaded.missions().front().steps[1].action_state);
  EXPECT_EQ("deadline-exceeded",
            reloaded.missions().front().steps[1].native_action_error);
}

TEST_F(TahaiWorkflowNativeTest,
       NativeDeadlineEncryptorCallbackSurvivesOwnerDeletion) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.AdvanceClock(kMissionNativeAttemptTimeout);
  PrefChangeRegistrar registrar;
  registrar.Init(profile_.GetPrefs());
  registrar.Add(prefs::kTahaiMissions,
                base::BindLambdaForTesting([&] { service_.reset(); }));
  bool completed = false;
  service_->PrepareProtectedWorkflowInputs(
      nullptr, base::BindLambdaForTesting([&](bool ready) {
        EXPECT_FALSE(ready);
        completed = true;
      }));
  EXPECT_TRUE(completed);
  EXPECT_FALSE(service_);
}

TEST_F(TahaiWorkflowNativeTest,
       NativeDeadlineRechecksMutationPolicyAfterNotification) {
  const auto other = service_->CreateMission("Unchanged mission", "incident");
  ASSERT_TRUE(other);
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.AdvanceClock(kMissionNativeAttemptTimeout);
  bool revoked = false;
  PrefChangeRegistrar registrar;
  registrar.Init(profile_.GetPrefs());
  registrar.Add(prefs::kTahaiMissions, base::BindLambdaForTesting([&] {
                  if (revoked) {
                    return;
                  }
                  revoked = true;
                  profile_.GetTestingPrefService()->SetManagedPref(
                      prefs::kTahaiMissions, base::Value(base::ListValue()));
                }));
  EXPECT_FALSE(service_->ToggleStep(other->id, 0));
  EXPECT_TRUE(revoked);
  EXPECT_FALSE(service_->missions().back().steps[0].complete);
  EXPECT_EQ("unknown", mission().steps[1].action_state);
}

TEST_F(TahaiWorkflowNativeTest, NativeDeadlinePinsBorrowedMutationArguments) {
  const auto other =
      service_->CreateMission("Removed during notification", "incident");
  ASSERT_TRUE(other);
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.AdvanceClock(kMissionNativeAttemptTimeout);
  const std::string_view borrowed_id(service_->missions().back().id);
  bool removed = false;
  PrefChangeRegistrar registrar;
  registrar.Init(profile_.GetPrefs());
  registrar.Add(prefs::kTahaiMissions, base::BindLambdaForTesting([&] {
                  if (removed) {
                    return;
                  }
                  removed = true;
                  EXPECT_TRUE(service_->DeleteMission(other->id));
                }));
  EXPECT_FALSE(service_->ToggleStep(borrowed_id, 0));
  EXPECT_TRUE(removed);
  EXPECT_EQ(1u, service_->missions().size());
}

TEST_F(TahaiWorkflowNativeTest,
       QueuedWorkflowCannotReplayOrResumeAfterOwnerDeletion) {
  for (const char* boundary : {"consume", "create"}) {
    SCOPED_TRACE(boundary);
    service_ = std::make_unique<MissionService>(&profile_);
    ASSERT_TRUE(QueueOperationalWorkflowLaunch(
        &profile_, manifest_.workflows.front(), manifest_.appearance.id, sha_));
    const size_t previous = service_->missions().size();
    PrefChangeRegistrar registrar;
    registrar.Init(profile_.GetPrefs());
    registrar.Add(std::string_view(boundary) == "consume"
                      ? prefs::kTahaiPendingOperationalWorkflow
                      : prefs::kTahaiMissions,
                  base::BindLambdaForTesting([&] { service_.reset(); }));
    EXPECT_FALSE(service_->ConsumeQueuedOperationalWorkflow());
    EXPECT_FALSE(service_);
    EXPECT_FALSE(GetQueuedOperationalWorkflowLaunch(&profile_));
    registrar.RemoveAll();
    MissionService reloaded(&profile_);
    EXPECT_TRUE(reloaded.ConsumeQueuedOperationalWorkflow());
    EXPECT_EQ(previous + (std::string_view(boundary) == "create" ? 1u : 0u),
              reloaded.missions().size());
  }
}

TEST_F(TahaiWorkflowNativeTest,
       QueuedWorkflowPreservesManagedAndUnknownStorage) {
  auto* preferences = profile_.GetTestingPrefService();
  for (const char* corruption : {"type", "version", "managed"}) {
    SCOPED_TRACE(corruption);
    const std::string_view shape(corruption);
    if (shape == "type") {
      preferences->SetUserPref(prefs::kTahaiPendingOperationalWorkflow,
                               base::Value("wrong type"));
    } else if (shape == "version") {
      preferences->SetDict(
          prefs::kTahaiPendingOperationalWorkflow,
          base::DictValue().Set("schema_version", 100).Set("future", true));
    } else {
      ASSERT_TRUE(
          QueueOperationalWorkflowLaunch(&profile_, manifest_.workflows.front(),
                                         manifest_.appearance.id, sha_));
      preferences->SetManagedPref(prefs::kTahaiPendingOperationalWorkflow,
                                  base::Value(base::DictValue()));
    }
    const auto original =
        preferences
            ->GetRawUserPrefValue(prefs::kTahaiPendingOperationalWorkflow)
            ->Clone();
    const size_t count = service_->missions().size();
    EXPECT_FALSE(GetQueuedOperationalWorkflowLaunch(&profile_));
    EXPECT_FALSE(QueueOperationalWorkflowLaunch(
        &profile_, manifest_.workflows.front(), manifest_.appearance.id, sha_));
    EXPECT_FALSE(ClearQueuedOperationalWorkflowLaunch(&profile_));
    EXPECT_FALSE(service_->ConsumeQueuedOperationalWorkflow());
    EXPECT_EQ(original, *preferences->GetRawUserPrefValue(
                            prefs::kTahaiPendingOperationalWorkflow));
    EXPECT_EQ(count, service_->missions().size());
    preferences->RemoveManagedPref(prefs::kTahaiPendingOperationalWorkflow);
    preferences->ClearPref(prefs::kTahaiPendingOperationalWorkflow);
  }
}

TEST_F(TahaiWorkflowNativeTest,
       QueuedWorkflowNotificationCannotReplaceConsumedLaunch) {
  for (const char* interruption : {"replacement", "reentry", "policy"}) {
    SCOPED_TRACE(interruption);
    const std::string_view change(interruption);
    ASSERT_TRUE(QueueOperationalWorkflowLaunch(
        &profile_, manifest_.workflows.front(), manifest_.appearance.id, sha_));
    const size_t count = service_->missions().size();
    bool notified = false;
    PrefChangeRegistrar registrar;
    registrar.Init(profile_.GetPrefs());
    registrar.Add(
        change == "reentry" ? prefs::kTahaiMissions
                            : prefs::kTahaiPendingOperationalWorkflow,
        base::BindLambdaForTesting([&] {
          if (notified) {
            return;
          }
          notified = true;
          if (change == "replacement") {
            auto replacement = manifest_.workflows.front();
            replacement.id = "replacement-flow";
            EXPECT_TRUE(QueueOperationalWorkflowLaunch(
                &profile_, replacement, manifest_.appearance.id, sha_));
          } else if (change == "policy") {
            profile_.GetTestingPrefService()->SetManagedPref(
                prefs::kTahaiPendingOperationalWorkflow,
                base::Value(base::DictValue()));
          } else {
            EXPECT_TRUE(service_->ConsumeQueuedOperationalWorkflow());
          }
        }));
    EXPECT_EQ(change == "reentry",
              service_->ConsumeQueuedOperationalWorkflow());
    EXPECT_TRUE(notified);
    EXPECT_EQ(count + (change == "reentry" ? 1u : 0u),
              service_->missions().size());
    if (change == "replacement") {
      const auto retained = GetQueuedOperationalWorkflowLaunch(&profile_);
      ASSERT_TRUE(retained);
      EXPECT_EQ("replacement-flow", retained->workflow.id);
    }
    registrar.RemoveAll();
    profile_.GetTestingPrefService()->RemoveManagedPref(
        prefs::kTahaiPendingOperationalWorkflow);
    profile_.GetPrefs()->ClearPref(prefs::kTahaiPendingOperationalWorkflow);
  }
}

TEST_F(TahaiWorkflowNativeTest, NativeCompletionDisarmsDeadlineAndLateResultsCannotOverwriteOutcome) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.FastForwardBy(base::Milliseconds(9999));
  ASSERT_TRUE(service_->FinishNativeWorkflowStep(id_, 1, "dispatched"));
  EXPECT_FALSE(mission().steps[1].native_action_started);
  EXPECT_TRUE(mission().steps[1].native_action_error.empty());
  const auto events = mission().timeline.size();
  environment_.FastForwardBy(base::Hours(1));
  EXPECT_EQ("dispatched", mission().steps[1].action_state);
  EXPECT_EQ("running", mission().operational_workflow->run_state);
  EXPECT_EQ(events, mission().timeline.size());
  EXPECT_FALSE(service_->FinishNativeWorkflowStep(id_, 1, "unknown"));
  ASSERT_TRUE(service_->ToggleStep(id_, 1));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(id_, "succeeded"));
}

TEST_F(TahaiWorkflowNativeTest, NativeDeadlineContinuesAcrossPauseCancelArchiveAndOtherRuns) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.FastForwardBy(base::Seconds(2));
  for (const char* state : {"paused", "cancelled", "archived"}) {
    SCOPED_TRACE(state);
    const auto created = service_->CreateOperationalWorkflowMission(
        manifest_.workflows.front(), manifest_.appearance.id, sha_, true);
    ASSERT_TRUE(created);
    ASSERT_TRUE(service_->SetOperationalWorkflowInputValue(created->id, "approved", "true"));
    ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id, "running"));
    ASSERT_TRUE(service_->ToggleStep(created->id, 0));
    ASSERT_TRUE(service_->BeginNativeWorkflowStep(created->id, 1));
    if (std::string_view(state) == "archived") ASSERT_TRUE(service_->ArchiveMission(created->id));
    else ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id, state));
  }
  environment_.FastForwardBy(base::Seconds(8));
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("pending", service_->missions().back().steps[1].action_state);
  environment_.FastForwardBy(base::Seconds(2));
  ASSERT_EQ(4u, service_->missions().size());
  for (const auto& run : service_->missions()) {
    EXPECT_EQ("unknown", run.steps[1].action_state);
    EXPECT_EQ("deadline-exceeded", run.steps[1].native_action_error);
    EXPECT_FALSE(run.steps[1].complete);
    EXPECT_FALSE(service_->SetOperationalWorkflowRunState(run.id, "running"));
  }
  EXPECT_EQ("failed", service_->missions()[1].operational_workflow->run_state);
  EXPECT_EQ("cancelled", service_->missions()[2].operational_workflow->run_state);
  EXPECT_TRUE(service_->missions()[3].archived);
  EXPECT_EQ("failed", service_->missions()[3].operational_workflow->run_state);
}

TEST_F(TahaiWorkflowNativeTest, NativeDeadlineCannotBlessLateManagedResultOrResumeAfterShutdown) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  auto* preferences = profile_.GetTestingPrefService();
  const auto user_saved = preferences->GetUserPrefValue(prefs::kTahaiMissions)->Clone();
  preferences->SetManagedPref(prefs::kTahaiMissions, base::Value(base::ListValue()));
  environment_.FastForwardBy(kMissionNativeAttemptTimeout);
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ(user_saved, *preferences->GetUserPrefValue(prefs::kTahaiMissions));
  EXPECT_FALSE(service_->FinishNativeWorkflowStep(id_, 1, "dispatched"));
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("deadline-exceeded", mission().steps[1].native_action_error);
  EXPECT_EQ(user_saved, *preferences->GetUserPrefValue(prefs::kTahaiMissions));
  preferences->RemoveManagedPref(prefs::kTahaiMissions);
  service_.reset(); service_ = std::make_unique<MissionService>(&profile_);
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("failed", mission().operational_workflow->run_state);
  const auto created = service_->CreateOperationalWorkflowMission(
      manifest_.workflows.front(), manifest_.appearance.id, sha_, true);
  ASSERT_TRUE(created);
  ASSERT_TRUE(service_->SetOperationalWorkflowInputValue(created->id, "approved", "true"));
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(service_->ToggleStep(created->id, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(created->id, 1));
  service_->Shutdown();
  EXPECT_EQ("unknown", service_->missions().back().steps[1].action_state);
  EXPECT_TRUE(service_->missions().back().steps[1].native_action_error.empty());
  EXPECT_FALSE(service_->missions().back().steps[1].native_action_started);
  const auto saved = preferences->GetList(prefs::kTahaiMissions).Clone();
  EXPECT_FALSE(service_->FinishNativeWorkflowStep(created->id, 1, "dispatched"));
  environment_.FastForwardBy(base::Hours(1));
  EXPECT_EQ(saved, preferences->GetList(prefs::kTahaiMissions));
}

TEST_F(TahaiWorkflowNativeTest, SharedDeadlineTimerKeepsNativeAndAuthoredWaitBudgetsIndependent) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.FastForwardBy(base::Seconds(1));
  TahaiOperationalWorkflow workflow;
  workflow.id = "wait-flow"; workflow.name = "Wait flow";
  workflow.steps = {{"delay", "Delay", TahaiOperationalWorkflowStepKind::kWait}};
  workflow.steps[0].wait_seconds = 3; workflow.steps[0].wait_timeout_seconds = 5;
  const auto created = service_->CreateOperationalWorkflowMission(workflow, manifest_.appearance.id, sha_, true);
  ASSERT_TRUE(created);
  ASSERT_TRUE(service_->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(service_->ControlWorkflowWait(created->id, 0, false));
  environment_.FastForwardBy(base::Seconds(5));
  EXPECT_EQ("timed-out", service_->missions().back().steps[0].wait_state);
  EXPECT_EQ("pending", mission().steps[1].action_state);
  EXPECT_EQ(4000, MissionWorkflowNativeTimeRemaining(mission().steps[1]));
  const auto wait_events = service_->missions().back().timeline.size();
  environment_.FastForwardBy(base::Seconds(4));
  EXPECT_EQ("unknown", mission().steps[1].action_state);
  EXPECT_EQ("deadline-exceeded", mission().steps[1].native_action_error);
  EXPECT_EQ(wait_events, service_->missions().back().timeline.size());
}

TEST_F(TahaiWorkflowNativeTest, PersistedNativeClocksAndMalformedDeadlineErrorsAreInert) {
  ASSERT_TRUE(service_->ToggleStep(id_, 0));
  ASSERT_TRUE(service_->BeginNativeWorkflowStep(id_, 1));
  environment_.FastForwardBy(kMissionNativeAttemptTimeout);
  const auto saved = profile_.GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  for (int variant = 0; variant < 7; ++variant) {
    SCOPED_TRACE(variant);
    service_.reset();
    auto changed = saved.Clone();
    auto& record = changed[0].GetDict();
    auto& step = (*record.FindList("steps"))[1].GetDict();
    switch (variant) {
      case 0: step.Set("native_action_started", "untrusted-clock"); break;
      case 1: step.Set("native_action_error", "password=not-real"); break;
      case 2: step.Set("native_action_error", 0); break;
      case 3: step.Set("action_state", "pending"); break;
      case 4: step.Set("complete", true); break;
      case 5: step.Set("requires_native_action", false); step.Set("action_state", ""); break;
      case 6: record.FindDict("operational_workflow")->Set("adapter_version", 0); break;
    }
    profile_.GetPrefs()->SetList(prefs::kTahaiMissions, changed.Clone());
    service_ = std::make_unique<MissionService>(&profile_);
    EXPECT_FALSE(mission().operational_workflow);
    EXPECT_FALSE(service_->BeginNativeWorkflowStep(id_, 1));
    EXPECT_EQ(changed, profile_.GetPrefs()->GetList(prefs::kTahaiMissions));
  }
}

}  // namespace
}  // namespace tahai
