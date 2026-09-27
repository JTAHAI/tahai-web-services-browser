// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"

#include <array>
#include <string>
#include <limits>
#include <utility>

#include "base/json/json_reader.h"
#include "base/strings/string_number_conversions.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

base::DictValue TokenSet() {
  base::DictValue tokens;
  tokens.Set("shell_background", "#090514");
  tokens.Set("toolbar_background", "#090514");
  tokens.Set("toolbar_foreground", "#f6f8ff");
  tokens.Set("tab_background", "#120b1f");
  tokens.Set("tab_foreground", "#f6f8ff");
  tokens.Set("rail_background", "#120b1f");
  tokens.Set("rail_foreground", "#f6f8ff");
  tokens.Set("accent", "#9348ed");
  tokens.Set("panel_background", "#120b1f");
  tokens.Set("panel_foreground", "#f6f8ff");
  return tokens;
}

base::DictValue ValidOperationalSkin() {
  base::DictValue manifest;
  manifest.Set("schema_version", 2);
  manifest.Set("id", "research-flight");
  manifest.Set("name", "Research Flight");
  manifest.Set("creator", "TAHAI Example Studio");
  manifest.Set("license", "CC-BY-4.0");
  base::DictValue compatibility;
  compatibility.Set("min_chromium_major", 152);
  compatibility.Set("max_chromium_major", 152);
  manifest.Set("compatibility", std::move(compatibility));
  base::DictValue appearance;
  appearance.Set("density", "comfortable");
  appearance.Set("reduced_motion", true);
  appearance.Set("light_tokens", TokenSet());
  appearance.Set("dark_tokens", TokenSet());
  appearance.Set("high_contrast_tokens", TokenSet());
  manifest.Set("appearance", std::move(appearance));
  base::ListValue assets;
  base::DictValue preview;
  preview.Set("path", "assets/preview.png");
  preview.Set("sha256", std::string(64, 'a'));
  preview.Set("purpose", "preview");
  assets.Append(std::move(preview));
  manifest.Set("assets", std::move(assets));

  base::DictValue operational;
  base::ListValue capabilities;
  capabilities.Append("workspace-layout");
  capabilities.Append("mission-checklist");
  capabilities.Append("guard-control");
  operational.Set("capabilities", std::move(capabilities));
  base::ListValue surfaces;
  base::DictValue surface;
  surface.Set("id", "research-quad");
  surface.Set("layout", "quad");
  surface.Set("rail_state", "expanded");
  surface.Set("start_surface", "mission");
  base::ListValue rail_modules;
  rail_modules.Append("mission");
  rail_modules.Append("local-oi");
  rail_modules.Append("guard");
  surface.Set("rail_modules", std::move(rail_modules));
  surfaces.Append(std::move(surface));
  operational.Set("surfaces", std::move(surfaces));
  base::ListValue workflows;
  base::DictValue workflow;
  workflow.Set("id", "source-review");
  workflow.Set("name", "Source review");
  base::ListValue steps;
  base::DictValue first_step;
  first_step.Set("id", "review-sources");
  first_step.Set("name", "Review selected sources");
  first_step.Set("kind", "instruction");
  steps.Append(std::move(first_step));
  base::DictValue second_step;
  second_step.Set("id", "open-checklist");
  second_step.Set("name", "Open the local checklist");
  second_step.Set("kind", "run-command");
  second_step.Set("action", "mission.open");
  steps.Append(std::move(second_step));
  workflow.Set("steps", std::move(steps));
  workflows.Append(std::move(workflow));
  operational.Set("workflows", std::move(workflows));
  base::ListValue modes;
  base::DictValue mode;
  mode.Set("id", "research-flight");
  mode.Set("name", "Research Flight");
  mode.Set("surface", "research-quad");
  mode.Set("workflow", "source-review");
  base::ListValue actions;
  actions.Append("tabs.find");
  actions.Append("mission.open");
  actions.Append("layout.quad");
  mode.Set("actions", std::move(actions));
  modes.Append(std::move(mode));
  operational.Set("modes", std::move(modes));
  manifest.Set("operational", std::move(operational));
  return manifest;
}

TEST(TahaiOperationalSkinManifestTest,
     ValidatesInertSurfaceModeAndWorkflowDeclaration) {
  TahaiOperationalSkinManifest parsed;
  EXPECT_EQ(
      TahaiOperationalSkinManifestValidationResult::kValid,
      ValidateTahaiOperationalSkinManifest(ValidOperationalSkin(), &parsed));
  ASSERT_EQ(1u, parsed.surfaces.size());
  EXPECT_EQ(TahaiOperationalSurfaceLayout::kQuad, parsed.surfaces[0].layout);
  EXPECT_EQ(std::vector<std::string>({"mission", "local-oi", "guard"}),
            parsed.surfaces[0].rail_modules);
  ASSERT_EQ(1u, parsed.workflows.size());
  ASSERT_EQ(2u, parsed.workflows[0].steps.size());
  EXPECT_EQ(TahaiOperationalWorkflowStepKind::kRunCommand,
            parsed.workflows[0].steps[1].kind);
  EXPECT_EQ("mission.open", parsed.workflows[0].steps[1].action);
  ASSERT_EQ(1u, parsed.modes.size());
  EXPECT_EQ("research-quad", parsed.modes[0].surface_id);
}

TEST(TahaiOperationalSkinManifestTest, SurfaceDesignMustMatchNativePaneCount) {
  auto manifest = ValidOperationalSkin();
  auto& surface = manifest.FindDict("operational")->FindList("surfaces")->front().GetDict();
  SurfaceDesign design{
      .nodes = {{.kind = SurfaceNodeKind::kColumns, .first = 1, .second = 2},
                {.pane = 0, .role = "reference"},
                {.pane = 1, .role = "working"}},
      .keyboard_order = {1, 0}};
  surface.Set("design", EncodeSurfaceDesign(design));
  TahaiOperationalSkinManifest parsed;
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidSurface,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  surface.Set("layout", "dual");
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  ASSERT_EQ(1u, parsed.surfaces.size());
  EXPECT_EQ(design, parsed.surfaces.front().design);
  // Older surfaces retain their native layout without an authored tree.
  surface.Remove("design");
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  EXPECT_FALSE(parsed.surfaces.front().design);
}

TEST(TahaiOperationalSkinManifestTest,
       RejectsUnknownFieldsAndUngovernedActions) {
  base::DictValue unknown = ValidOperationalSkin();
  unknown.Set("script", "alert(1)");
  TahaiOperationalSkinManifest parsed;
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kUnknownField,
            ValidateTahaiOperationalSkinManifest(unknown, &parsed));

  base::DictValue ungoverned = ValidOperationalSkin();
  base::DictValue* operational = ungoverned.FindDict("operational");
  ASSERT_TRUE(operational);
  base::ListValue* capabilities = operational->FindList("capabilities");
  ASSERT_TRUE(capabilities);
  capabilities->clear();
  capabilities->Append("workspace-layout");
  auto& surface = operational->FindList("surfaces")->front().GetDict();
  surface.Set("start_surface", "launchpad");
  surface.Remove("rail_modules");
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
            ValidateTahaiOperationalSkinManifest(ungoverned, &parsed));

  TahaiSkinManifest v1;
  EXPECT_EQ(TahaiSkinManifestValidationResult::kInvalidSchema,
            ValidateTahaiSkinManifest(ValidOperationalSkin(), &v1));
}

TEST(TahaiOperationalSkinManifestTest,
     SurfaceAndWorkflowBindingsCannotBypassCapabilityDeclarations) {
  for (const char* missing : {"workspace-layout", "mission-checklist",
                              "guard-control"}) {
    SCOPED_TRACE(missing);
    auto manifest = ValidOperationalSkin();
    auto* capabilities = manifest.FindDict("operational")->FindList("capabilities");
    capabilities->EraseValue(base::Value(missing));
    TahaiOperationalSkinManifest parsed;
    ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
              ValidateTahaiOperationalSkinManifest(ValidOperationalSkin(), &parsed));
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidSurface,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
    EXPECT_TRUE(parsed.surfaces.empty());
    EXPECT_TRUE(parsed.capabilities.empty());
  }

  auto manifest = ValidOperationalSkin();
  auto* operational = manifest.FindDict("operational");
  operational->Set("capabilities", base::ListValue().Append("workspace-layout"));
  auto& surface = operational->FindList("surfaces")->front().GetDict();
  surface.Set("layout", "one");
  surface.Set("start_surface", "launchpad");
  surface.Remove("rail_modules");
  operational->FindList("workflows")->front().GetDict().FindList("steps")->resize(1);
  operational->FindList("modes")->front().GetDict().Set(
      "actions", base::ListValue().Append("layout.one"));
  TahaiOperationalSkinManifest parsed;
  // A purely instructional workflow still becomes a Mission checklist.
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidMode,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  operational->FindList("capabilities")->Append("mission-checklist");
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  operational->FindList("capabilities")->EraseValue(base::Value("workspace-layout"));
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidSurface,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
}

TEST(TahaiOperationalSkinManifestTest,
       RejectsUnknownOrRepeatedOperationalRailModules) {
  TahaiOperationalSkinManifest parsed;
  base::DictValue unknown = ValidOperationalSkin();
  base::DictValue* operational = unknown.FindDict("operational");
  ASSERT_TRUE(operational);
  base::ListValue* surfaces = operational->FindList("surfaces");
  ASSERT_TRUE(surfaces);
  base::DictValue* surface = (*surfaces)[0].GetIfDict();
  ASSERT_TRUE(surface);
  base::ListValue* modules = surface->FindList("rail_modules");
  ASSERT_TRUE(modules);
  modules->Append("https://example.test");
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidSurface,
            ValidateTahaiOperationalSkinManifest(unknown, &parsed));

  base::DictValue duplicate = ValidOperationalSkin();
  operational = duplicate.FindDict("operational");
  ASSERT_TRUE(operational);
  surfaces = operational->FindList("surfaces");
  ASSERT_TRUE(surfaces);
  surface = (*surfaces)[0].GetIfDict();
  ASSERT_TRUE(surface);
  modules = surface->FindList("rail_modules");
  ASSERT_TRUE(modules);
  modules->Append("mission");
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidSurface,
            ValidateTahaiOperationalSkinManifest(duplicate, &parsed));
}

TEST(TahaiOperationalSkinManifestTest,
     RejectsWrongTypedOptionalWorkflowFields) {
  for (const char* field : {"inputs", "when", "action"}) {
    SCOPED_TRACE(field);
    base::DictValue manifest = ValidOperationalSkin();
    auto& workflow = manifest.FindDict("operational")
                         ->FindList("workflows")->front().GetDict();
    if (std::string_view(field) == "inputs") {
      workflow.Set(field, "invalid");
    } else {
      workflow.FindList("steps")->front().GetDict().Set(field, 1);
    }
    TahaiOperationalSkinManifest parsed;
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
    EXPECT_TRUE(parsed.workflows.empty());
  }
}

TEST(TahaiOperationalSkinManifestTest, RejectsWrongTypedOptionalSurfaceFields) {
  for (const char* field : {"rail_modules", "design"}) {
    auto manifest = ValidOperationalSkin();
    manifest.FindDict("operational")->FindList("surfaces")->front().GetDict()
        .Set(field, true);
    TahaiOperationalSkinManifest parsed;
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidSurface,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
    EXPECT_TRUE(parsed.surfaces.empty());
  }
}

TEST(TahaiOperationalSkinManifestTest,
     ValidatesBoundedLocalWorkflowInputsWithoutCapabilities) {
  base::DictValue manifest = ValidOperationalSkin();
  base::DictValue* operational = manifest.FindDict("operational");
  ASSERT_TRUE(operational);
  base::ListValue* workflows = operational->FindList("workflows");
  ASSERT_TRUE(workflows);
  base::DictValue* workflow = (*workflows)[0].GetIfDict();
  ASSERT_TRUE(workflow);
  base::ListValue inputs;
  base::DictValue question;
  question.Set("id", "research-question");
  question.Set("name", "Research question");
  question.Set("type", "text");
  question.Set("required", true);
  inputs.Append(std::move(question));
  base::DictValue scope;
  scope.Set("id", "review-scope");
  scope.Set("name", "Review scope");
  scope.Set("type", "selection");
  scope.Set("required", false);
  base::ListValue options;
  options.Append("Personal");
  options.Append("Team");
  scope.Set("options", std::move(options));
  inputs.Append(std::move(scope));
  workflow->Set("inputs", std::move(inputs));

  TahaiOperationalSkinManifest parsed;
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  ASSERT_EQ(2u, parsed.workflows[0].inputs.size());
  EXPECT_EQ(TahaiOperationalWorkflowInputType::kText,
            parsed.workflows[0].inputs[0].type);
  EXPECT_TRUE(parsed.workflows[0].inputs[0].required);
  EXPECT_EQ(std::vector<std::string>({"Personal", "Team"}),
            parsed.workflows[0].inputs[1].options);

  base::ListValue* steps = workflow->FindList("steps");
  ASSERT_TRUE(steps);
  base::DictValue* conditional_step = (*steps)[0].GetIfDict();
  ASSERT_TRUE(conditional_step);
  base::DictValue condition;
  condition.Set("input", "review-scope");
  condition.Set("equals", "Team");
  conditional_step->Set("when", std::move(condition));
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  EXPECT_EQ("review-scope", parsed.workflows[0].steps[0].condition_input_id);
  EXPECT_EQ("Team", parsed.workflows[0].steps[0].condition_equals);

  base::DictValue invalid = ValidOperationalSkin();
  operational = invalid.FindDict("operational");
  ASSERT_TRUE(operational);
  workflows = operational->FindList("workflows");
  ASSERT_TRUE(workflows);
  workflow = (*workflows)[0].GetIfDict();
  ASSERT_TRUE(workflow);
  base::ListValue invalid_inputs;
  base::DictValue invalid_selection;
  invalid_selection.Set("id", "unsafe-input");
  invalid_selection.Set("name", "Unsafe input");
  invalid_selection.Set("type", "selection");
  invalid_selection.Set("required", true);
  base::ListValue invalid_options;
  invalid_options.Append("https://example.test");
  invalid_selection.Set("options", std::move(invalid_options));
  invalid_inputs.Append(std::move(invalid_selection));
  workflow->Set("inputs", std::move(invalid_inputs));
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
            ValidateTahaiOperationalSkinManifest(invalid, &parsed));
}

TEST(TahaiOperationalSkinManifestTest, TimedWaitsAreBoundedDefinitionsWithoutClockStateOrActions) {
  const auto source = base::JSONReader::ReadDict(R"({
    "id":"wait-workflow","name":"Timed wait",
    "steps":[{"id":"delay","name":"Delay","kind":"wait","wait":{"seconds":3}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source);
  TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &parsed));
  EXPECT_EQ(TahaiOperationalWorkflowStepKind::kWait, parsed.steps[0].kind);
  EXPECT_EQ(3, parsed.steps[0].wait_seconds);
  for (int seconds : {1, 86400}) {
    auto valid = source->Clone();
    (*valid.FindList("steps"))[0].GetDict().FindDict("wait")->Set("seconds", seconds);
    EXPECT_TRUE(ValidateTahaiOperationalWorkflow(valid, {}, &parsed));
    EXPECT_EQ(seconds, parsed.steps[0].wait_seconds);
  }
  for (const char* wait : {"null", "{}", "[]", "true", R"({"seconds":0})", R"({"seconds":-1})",
      R"({"seconds":86401})", R"({"seconds":1.5})", R"({"seconds":true})", R"({"seconds":"3"})",
      R"({"seconds":3,"started":1})", R"({"seconds":3,"remaining_ms":0})"}) {
    auto invalid = source->Clone();
    (*invalid.FindList("steps"))[0].GetDict().Set("wait", base::JSONReader::Read(wait, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << wait;
    EXPECT_TRUE(parsed.steps.empty());
  }
  for (const char* field : {"action", "assign", "wait_started", "wait_state", "value"}) {
    auto invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().Set(field, "invalid");
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << field;
  }
  auto invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().Remove("wait");
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().Set("kind", "checkpoint");
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
}

TEST(TahaiOperationalSkinManifestTest, WaitDeadlinesRequireBoundedLaterWholeSeconds) {
  const auto source = base::JSONReader::ReadDict(R"({
    "id":"wait-workflow","name":"Timed wait",
    "steps":[{"id":"delay","name":"Delay","kind":"wait","wait":{"seconds":3,"timeout_seconds":5}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source);
  TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &parsed));
  EXPECT_EQ(3, parsed.steps[0].wait_seconds); EXPECT_EQ(5, parsed.steps[0].wait_timeout_seconds);
  for (const char* timeout : {"0", "-1", "3", "2", "86401", "4.5", "true", "null", "\"5\"", "{}", "[]"}) {
    auto invalid = source->Clone();
    (*invalid.FindList("steps"))[0].GetDict().FindDict("wait")->Set("timeout_seconds",
        base::JSONReader::Read(timeout, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << timeout;
  }
  auto changed = source->Clone();
  (*changed.FindList("steps"))[0].GetDict().FindDict("wait")->Set("timeout_seconds", 86400);
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(changed, {}, &parsed)); EXPECT_EQ(86400, parsed.steps[0].wait_timeout_seconds);
  (*changed.FindList("steps"))[0].GetDict().FindDict("wait")->Remove("timeout_seconds");
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(changed, {}, &parsed)); EXPECT_EQ(0, parsed.steps[0].wait_timeout_seconds);
  (*changed.FindList("steps"))[0].GetDict().FindDict("wait")->Set("timeout_remaining_ms", 4000);
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(changed, {}, &parsed));
}

TEST(TahaiOperationalSkinManifestTest, TypedVariablesAndAssignmentsRejectPrivacyDowngradesAndMalformedBindings) {
  const auto source = base::JSONReader::ReadDict(R"({
    "id":"variables-workflow","name":"Variables workflow",
    "inputs":[{"id":"amount","name":"Amount","type":"number","required":false}],
    "variables":[{"id":"total","name":"Total","type":"number","validation":{"minimum":2,"maximum":4}},
                 {"id":"copy","name":"Copy","type":"number"}],
    "steps":[{"id":"assign-total","name":"Assign total","kind":"assign-variable","assign":{"variable":"total","from":{"input":"amount"}}},
             {"id":"assign-copy","name":"Assign copy","kind":"assign-variable","assign":{"variable":"copy","from":{"variable":"total"}}}],
    "outputs":[{"id":"result","name":"Result","from":{"variable":"copy"}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source);
  TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &parsed));
  ASSERT_EQ(2u, parsed.variables.size());
  EXPECT_EQ(TahaiOperationalWorkflowStepKind::kAssignVariable, parsed.steps[0].kind);
  EXPECT_TRUE(parsed.steps[1].assignment->from_variable);
  EXPECT_TRUE(parsed.outputs[0].from_variable);
  base::Value encoded(SerializeTahaiWorkflowVariables(parsed.variables));
  std::vector<TahaiOperationalWorkflowInput> variables;
  ASSERT_TRUE(ParseTahaiWorkflowVariables(&encoded, &variables));
  EXPECT_EQ(parsed.variables, variables);
  for (const char* field : {"value", "default", "protected", "required", "script"}) {
    auto invalid = source->Clone();
    (*invalid.FindList("variables"))[0].GetDict().Set(field, true);
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << field;
    EXPECT_TRUE(parsed.variables.empty());
  }
  for (const char* assignment : {R"(null)", R"({})",
      R"({"variable":"missing","from":{"input":"amount"}})",
      R"({"variable":"total","from":{"input":"missing"}})",
      R"({"variable":"total","from":{"variable":"missing"}})",
      R"({"variable":"total","from":{"input":"amount","variable":"copy"}})",
      R"({"variable":"total","from":{"input":"amount"},"value":"3"})"}) {
    auto invalid = source->Clone();
    (*invalid.FindList("steps"))[0].GetDict().Set("assign",
        base::JSONReader::Read(assignment, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << assignment;
  }
  for (const char* type : {"text", "boolean", "date", "url", "selection"}) {
    auto invalid = source->Clone();
    (*invalid.FindList("inputs"))[0].GetDict().Set("type", type);
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  }
  auto invalid = source->Clone();
  (*invalid.FindList("inputs"))[0].GetDict().Set("protected", true);
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  invalid = source->Clone();
  (*invalid.FindList("steps"))[0].GetDict().Set("kind", "checkpoint");
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  invalid = source->Clone();
  invalid.FindList("variables")->Append((*source->FindList("variables"))[0].Clone());
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  invalid = source->Clone();
  invalid.Set("variables", base::Value());
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
}

TEST(TahaiOperationalSkinManifestTest, NumericConditionsAreClosedTypedAndExcludeProtectedInputs) {
  const auto source = base::JSONReader::ReadDict(R"({
    "id":"numeric-branch","name":"Numeric branch",
    "inputs":[{"id":"amount","name":"Amount","type":"number","required":false}],
    "steps":[{"id":"review","name":"Review","kind":"checkpoint",
      "when":{"input":"amount","compare":{"op":"greater-than","number":3.125}}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source); TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &parsed));
  EXPECT_EQ("amount", parsed.steps[0].condition_input_id); EXPECT_TRUE(parsed.steps[0].condition_equals.empty());
  ASSERT_TRUE(parsed.steps[0].numeric_condition); EXPECT_EQ(3.125, parsed.steps[0].numeric_condition->number);
  base::Value encoded(SerializeTahaiWorkflowNumericCondition(*parsed.steps[0].numeric_condition));
  TahaiWorkflowNumericCondition condition;
  ASSERT_TRUE(ParseTahaiWorkflowNumericCondition(&encoded, &condition));
  EXPECT_EQ(*parsed.steps[0].numeric_condition, condition);
  for (const char* compare : {"null", "[]", "{}", R"({"op":"equal","number":true})",
      R"({"op":"equal","number":"3"})", R"({"op":"equal","number":1000000000001})",
      R"({"op":["equal"],"number":3})", R"({"op":"eval","number":3})",
      R"({"op":"equal"})", R"({"op":"equal","number":3,"script":"no"})"}) {
    auto invalid = source->Clone();
    (*invalid.FindList("steps"))[0].GetDict().FindDict("when")->Set("compare",
        base::JSONReader::Read(compare, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << compare;
    EXPECT_TRUE(parsed.steps.empty());
  }
  for (const char* field : {"protected", "type"}) {
    auto invalid = source->Clone(); auto& input = (*invalid.FindList("inputs"))[0].GetDict();
    if (std::string_view(field) == "protected") input.Set(field, true); else input.Set(field, "text");
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  }
  auto invalid = source->Clone();
  (*invalid.FindList("steps"))[0].GetDict().FindDict("when")->Set("equals", "3.125");
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().FindDict("when")->Set("input", "missing");
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
}

TEST(TahaiOperationalSkinManifestTest, NumericComparisonsCoverEveryBoundaryWithoutCoercion) {
  for (const auto& [operation, expected] : {
      std::pair{"equal", std::array{false, true, false}}, {"not-equal", {true, false, true}},
      {"less-than", {true, false, false}}, {"at-most", {true, true, false}},
      {"greater-than", {false, false, true}}, {"at-least", {false, true, true}}}) {
    for (int index = 0; index < 3; ++index) {
      const auto result = CompareTahaiWorkflowNumber(index + 2, {operation, 3});
      ASSERT_TRUE(result); EXPECT_EQ(expected[index], *result) << operation << ' ' << index;
    }
  }
  EXPECT_EQ(true, CompareTahaiWorkflowNumber(-0.0, {"equal", 0.0}));
  EXPECT_EQ(true, CompareTahaiWorkflowNumber(1e256, {"greater-than", 1e12}));
  EXPECT_FALSE(CompareTahaiWorkflowNumber(std::numeric_limits<double>::infinity(), {"equal", 3}));
  EXPECT_FALSE(CompareTahaiWorkflowNumber(3, {"equal", std::numeric_limits<double>::quiet_NaN()}));
  EXPECT_FALSE(CompareTahaiWorkflowNumber(3, {"eval", 3}));
  EXPECT_FALSE(CompareTahaiWorkflowNumber(3, {"equal", 1e12 + 1}));
  base::Value invalid(SerializeTahaiWorkflowNumericCondition({"equal", std::numeric_limits<double>::infinity()}));
  TahaiWorkflowNumericCondition condition{"equal", 3};
  EXPECT_FALSE(ParseTahaiWorkflowNumericCondition(&invalid, &condition)); EXPECT_TRUE(condition.operation.empty());
}

TEST(TahaiOperationalSkinManifestTest, VariableConditionsUseExplicitNamespacesAndNeverAdmitRunDecisions) {
  const auto source = base::JSONReader::ReadDict(R"({
    "id":"variable-branch","name":"Variable branch",
    "inputs":[{"id":"amount","name":"Private input","type":"number","required":false,"protected":true}],
    "variables":[{"id":"amount","name":"Saved amount","type":"number"}],
    "steps":[{"id":"review","name":"Review","kind":"checkpoint",
      "when":{"variable":"amount","compare":{"op":"greater-than","number":3.125}}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source); TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &parsed));
  EXPECT_TRUE(parsed.steps[0].condition_from_variable); EXPECT_EQ("amount", parsed.steps[0].condition_input_id);
  for (const char* condition : {R"({"variable":"missing","equals":"true"})",
      R"({"input":"amount","compare":{"op":"equal","number":3}})",
      R"({"input":"amount","variable":"amount","compare":{"op":"equal","number":3}})",
      R"({"variable":true,"equals":"true"})", R"({"variable":"amount","equals":"3"})",
      R"({"variable":"amount","compare":{"op":"equal","number":3},"result":true})"}) {
    auto invalid = source->Clone();
    (*invalid.FindList("steps"))[0].GetDict().Set("when", base::JSONReader::Read(condition, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << condition;
    EXPECT_TRUE(parsed.steps.empty());
  }
  for (const char* type : {"boolean", "selection"}) {
    auto typed = source->Clone(); auto& variable = (*typed.FindList("variables"))[0].GetDict();
    variable.Set("type", type);
    if (std::string_view(type) == "selection") variable.Set("options", base::ListValue().Append("Yes").Append("No"));
    (*typed.FindList("steps"))[0].GetDict().Set("when", base::DictValue().Set("variable", "amount").Set("equals",
        std::string_view(type) == "boolean" ? "true" : "Yes"));
    EXPECT_TRUE(ValidateTahaiOperationalWorkflow(typed, {}, &parsed));
    variable.Set("protected", true); EXPECT_FALSE(ValidateTahaiOperationalWorkflow(typed, {}, &parsed));
  }
  for (const char* key : {"variable_condition_result", "condition_from_variable"}) {
    auto invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().Set(key, true);
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  }
}

TEST(TahaiOperationalSkinManifestTest, ProtectedVariableBindingsAreMonotonicAndExcludeConditionsCalculationsAndRunData) {
  auto source = base::JSONReader::ReadDict(R"({"id":"private-flow","name":"Private flow",
    "inputs":[{"id":"secret","name":"Secret","type":"number","required":false,"protected":true}],
    "variables":[{"id":"first","name":"First","type":"number","protected":true},
                 {"id":"second","name":"Second","type":"number","protected":true}],
    "steps":[{"id":"copy-one","name":"Copy one","kind":"assign-variable","assign":{"variable":"first","from":{"input":"secret"}}},
             {"id":"copy-two","name":"Copy two","kind":"assign-variable","assign":{"variable":"second","from":{"variable":"first"}}}],
    "outputs":[{"id":"result","name":"Result","from":{"variable":"second"}}]})", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source); TahaiOperationalWorkflow workflow;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &workflow)); ASSERT_TRUE(workflow.variables[0].is_protected);
  base::Value wire(SerializeTahaiWorkflowVariables(workflow.variables)); std::vector<TahaiOperationalWorkflowInput> parsed;
  ASSERT_TRUE(ParseTahaiWorkflowVariables(&wire, &parsed)); EXPECT_EQ(workflow.variables, parsed);
  for (size_t index : {0u, 1u}) {
    auto invalid = source->Clone(); (*invalid.FindList("variables"))[index].GetDict().Set("protected", false);
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &workflow));
  }
  auto upgraded = source->Clone(); (*upgraded.FindList("inputs"))[0].GetDict().Set("protected", false);
  EXPECT_TRUE(ValidateTahaiOperationalWorkflow(upgraded, {}, &workflow));
  for (const char* field : {"value", "protected_value", "protected_has_value", "protected_storage_ready", "default", "required"}) {
    auto invalid = source->Clone(); (*invalid.FindList("variables"))[0].GetDict().Set(field, true);
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &workflow));
  }
  auto invalid = source->Clone(); (*invalid.FindList("variables"))[0].GetDict().Set("protected", "true");
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &workflow));
  invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().Set("when",
      base::DictValue().Set("variable", "first").Set("compare", base::DictValue().Set("op", "equal").Set("number", 0)));
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &workflow));
  invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().Set("assign",
      base::DictValue().Set("variable", "first").Set("expression", base::DictValue().Set("number", 0)));
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &workflow));
}

TEST(TahaiOperationalSkinManifestTest, BoundedRepeatsExpandDistinctStepsWithoutChangingAuthoredDefinitions) {
  auto source = base::JSONReader::ReadDict(R"({"id":"repeat-flow","name":"Repeat flow",
    "steps":[{"id":"before","name":"Before","kind":"instruction"},
             {"id":"review","name":"Review","kind":"checkpoint"},
             {"id":"delay","name":"Delay","kind":"wait","wait":{"seconds":3,"timeout_seconds":5}}],
    "repeats":[{"id":"rounds","from":"review","through":"delay","count":3}]})", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source); TahaiOperationalWorkflow workflow;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &workflow));
  ASSERT_EQ(3u, workflow.steps.size()); ASSERT_EQ(1u, workflow.repeats.size());
  const auto expanded = ExpandTahaiWorkflowSteps(workflow); ASSERT_TRUE(expanded); ASSERT_EQ(7u, expanded->size());
  EXPECT_EQ("before", (*expanded)[0].id); EXPECT_EQ("r-rounds-2-review", (*expanded)[3].id);
  EXPECT_EQ("[3/3] Delay", (*expanded)[6].name); EXPECT_EQ(3, (*expanded)[6].wait_seconds);
  EXPECT_EQ(5, (*expanded)[6].wait_timeout_seconds); EXPECT_EQ("review", workflow.steps[1].id);
  base::Value wire(SerializeTahaiWorkflowRepeats(workflow.repeats)); std::vector<TahaiWorkflowRepeat> parsed;
  ASSERT_TRUE(ParseTahaiWorkflowRepeats(&wire, &parsed)); EXPECT_EQ(workflow.repeats, parsed);
  workflow.repeats.clear(); EXPECT_EQ("review", (*ExpandTahaiWorkflowSteps(workflow))[1].id);
  workflow.steps.resize(4, workflow.steps.back());
  for (size_t i = 0; i < workflow.steps.size(); ++i) workflow.steps[i].id = "step-" + base::NumberToString(i);
  workflow.repeats = {{"rounds", "step-0", "step-3", 8}};
  ASSERT_TRUE(ExpandTahaiWorkflowSteps(workflow)); EXPECT_EQ(32u, ExpandTahaiWorkflowSteps(workflow)->size());
  auto extra = workflow.steps.back(); extra.id = "extra"; workflow.steps.push_back(extra);
  EXPECT_FALSE(ExpandTahaiWorkflowSteps(workflow));
}

TEST(TahaiOperationalSkinManifestTest, BoundedRepeatsRejectOverlapCollisionsCoercionAndExpansionOverflow) {
  auto source = base::JSONReader::ReadDict(R"({"id":"repeat-flow","name":"Repeat flow",
    "steps":[{"id":"first","name":"First","kind":"checkpoint"},{"id":"last","name":"Last","kind":"checkpoint"}]})", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source); TahaiOperationalWorkflow workflow;
  for (const char* repeats : {"null", "{}", "true", "[null]", "[{}]",
       R"([{"id":"rounds","from":"first","through":"last","count":true}])",
       R"([{"id":"rounds","from":"first","through":"last","count":"2"}])",
       R"([{"id":"rounds","from":"first","through":"last","count":2.5}])",
       R"([{"id":"rounds","from":"first","through":"last","count":1}])",
       R"([{"id":"rounds","from":"first","through":"last","count":9}])",
       R"([{"id":"rounds","from":"last","through":"first","count":2}])",
       R"([{"id":"rounds","from":"first","through":"missing","count":2}])",
       R"([{"id":"rounds","from":"first","through":"last","count":2,"result":true}])",
       R"([{"id":"rounds","from":"first","through":"last","count":2},{"id":"again","from":"last","through":"last","count":2}])",
       R"([{"id":"rounds","from":"first","through":"first","count":2},{"id":"rounds","from":"last","through":"last","count":2}])"}) {
    auto invalid = source->Clone(); invalid.Set("repeats", base::JSONReader::Read(repeats, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &workflow)) << repeats;
    EXPECT_TRUE(workflow.steps.empty()); EXPECT_TRUE(workflow.repeats.empty());
  }
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &workflow));
  workflow.repeats = {{"rounds", "first", "last", 2}};
  auto invalid = workflow; invalid.steps.push_back({"r-rounds-1-first", "Collision", TahaiOperationalWorkflowStepKind::kCheckpoint});
  EXPECT_FALSE(ExpandTahaiWorkflowSteps(invalid));
  invalid = workflow; invalid.steps[0].name.assign(123, 'a'); EXPECT_FALSE(ExpandTahaiWorkflowSteps(invalid));
  invalid = workflow; invalid.repeats[0].id.assign(64, 'a'); EXPECT_FALSE(ExpandTahaiWorkflowSteps(invalid));
  invalid = workflow; invalid.repeats[0].count = -1; EXPECT_FALSE(ExpandTahaiWorkflowSteps(invalid));
}

TEST(TahaiOperationalSkinManifestTest, CompoundPredicatesAreClosedBoundedAndValidateEveryReference) {
  auto source = base::JSONReader::ReadDict(R"({"id":"compound","name":"Compound",
    "inputs":[{"id":"approved","name":"Approved","type":"boolean","required":false}],
    "variables":[{"id":"total","name":"Total","type":"number"}],
    "steps":[{"id":"branch","name":"Branch","kind":"checkpoint","when":{"all":[
      {"input":"approved","equals":"true"},{"not":{"variable":"total","compare":{"op":"at-most","number":3}}}]}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(source); TahaiOperationalWorkflow workflow;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source, {}, &workflow)); ASSERT_TRUE(workflow.steps[0].predicate);
  EXPECT_TRUE(workflow.steps[0].condition_input_id.empty()); EXPECT_FALSE(workflow.steps[0].condition_from_variable);
  const auto predicate = *workflow.steps[0].predicate;
  base::Value encoded(SerializeTahaiWorkflowPredicate(predicate)); TahaiWorkflowPredicate parsed;
  ASSERT_TRUE(ParseTahaiWorkflowPredicate(&encoded, &parsed)); EXPECT_EQ(predicate, parsed);
  EXPECT_TRUE(TahaiWorkflowPredicateUsesSource(parsed, false, "approved"));
  EXPECT_TRUE(TahaiWorkflowPredicateUsesSource(parsed, true, "total"));
  EXPECT_FALSE(TahaiWorkflowPredicateUsesSource(parsed, false, "total"));
  for (const char* text : {R"({"all":[]})", R"({"any":[{"input":"approved","equals":"true"}]})",
      R"({"not":[]})", R"({"not":null})", R"({"all":"true"})",
      R"({"not":{"variable":"total","equals":"3"}})",
      R"({"any":[{"input":"approved","equals":"true"},{"input":"missing","equals":"true"}]})",
      R"({"not":{"input":"approved","equals":"yes"}})", R"({"not":{"input":"approved","equals":"true"},"result":true})"}) {
    auto invalid = source->Clone(); (*invalid.FindList("steps"))[0].GetDict().Set("when", base::JSONReader::Read(text, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &workflow)) << text;
  }
  auto private_source = source->Clone(); (*private_source.FindList("inputs"))[0].GetDict().Set("protected", true);
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(private_source, {}, &workflow));
  TahaiWorkflowPredicate tree = predicate.arguments[0];
  for (int i = 0; i < 4; ++i) { TahaiWorkflowPredicate parent; parent.operation = "all"; parent.arguments = {tree, tree}; tree = std::move(parent); }
  EXPECT_TRUE(CheckTahaiWorkflowPredicate(tree, [](const TahaiWorkflowPredicate&) { return true; })); // 31 nodes, 5 levels.
  TahaiWorkflowPredicate deeper; deeper.operation = "not"; deeper.arguments = {tree};
  EXPECT_FALSE(CheckTahaiWorkflowPredicate(deeper, [](const TahaiWorkflowPredicate&) { return true; }));
  EXPECT_TRUE(SerializeTahaiWorkflowPredicate(deeper).empty());
  auto wide = predicate; wide.arguments.assign(9, predicate.arguments[0]);
  EXPECT_FALSE(CheckTahaiWorkflowPredicate(wide, [](const TahaiWorkflowPredicate&) { return true; }));
  auto mixed = predicate; mixed.source_id = "approved";
  EXPECT_FALSE(CheckTahaiWorkflowPredicate(mixed, [](const TahaiWorkflowPredicate&) { return true; }));
  mixed = predicate; mixed.from_variable = true;
  EXPECT_FALSE(CheckTahaiWorkflowPredicate(mixed, [](const TahaiWorkflowPredicate&) { return true; }));
}

TEST(TahaiOperationalSkinManifestTest, CompoundEvaluationNeverShortCircuitsUnknownValuesIntoAuthority) {
  TahaiWorkflowPredicate left; left.source_id = "left"; left.equals = "true";
  auto right = left; right.source_id = "right";
  for (const char* op : {"all", "any"}) for (bool a : {false, true}) for (bool b : {false, true}) {
    TahaiWorkflowPredicate group; group.operation = op; group.arguments = {left, right};
    int visited = 0;
    const auto result = EvaluateTahaiWorkflowPredicate(group, [&](const TahaiWorkflowPredicate& leaf) -> std::optional<bool> {
      ++visited; return leaf.source_id == "left" ? a : b;
    });
    EXPECT_EQ(std::string_view(op) == "all" ? a && b : a || b, result); EXPECT_EQ(2, visited);
    visited = 0;
    EXPECT_FALSE(EvaluateTahaiWorkflowPredicate(group, [&](const TahaiWorkflowPredicate& leaf) -> std::optional<bool> {
      ++visited; return leaf.source_id == "left" ? std::make_optional(a) : std::nullopt;
    })); EXPECT_EQ(2, visited);
  }
  TahaiWorkflowPredicate negate; negate.operation = "not"; negate.arguments = {left};
  EXPECT_EQ(false, EvaluateTahaiWorkflowPredicate(negate, [](const TahaiWorkflowPredicate&) { return std::optional<bool>(true); }));
  EXPECT_FALSE(EvaluateTahaiWorkflowPredicate(negate, [](const TahaiWorkflowPredicate&) { return std::optional<bool>(); }));
  negate.operation = "eval";
  EXPECT_FALSE(EvaluateTahaiWorkflowPredicate(negate, [](const TahaiWorkflowPredicate&) { ADD_FAILURE(); return std::optional<bool>(true); }));
}

TEST(TahaiOperationalSkinManifestTest, BooleanAssignmentsAreBoundedTypedAndExcludeProtectedSources) {
  auto valid = base::JSONReader::ReadDict(R"({"id":"boolean-work","name":"Boolean work",
    "inputs":[{"id":"source","name":"Source","type":"boolean","required":false}],
    "variables":[{"id":"result","name":"Result","type":"boolean"}],
    "steps":[{"id":"calculate","name":"Calculate","kind":"assign-variable",
      "assign":{"variable":"result","boolean_expression":{"not":{"input":"source","equals":"true"}}}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(valid); TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*valid, {}, &parsed));
  const auto assignment = *parsed.steps[0].assignment;
  base::Value encoded(SerializeTahaiWorkflowAssignment(assignment)); TahaiWorkflowAssignment decoded;
  ASSERT_TRUE(ParseTahaiWorkflowAssignment(&encoded, &decoded)); EXPECT_EQ(assignment, decoded);
  for (const char* text : {"null", "[]", "{}", R"({"input":"missing","equals":"true"})",
      R"({"input":"source","equals":true})", R"({"all":[]})", R"({"eval":"source"})"}) {
    auto invalid = valid->Clone();
    invalid.FindList("steps")->front().GetDict().FindDict("assign")->Set(
        "boolean_expression", base::JSONReader::Read(text, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << text;
  }
  for (const char* collection : {"inputs", "variables"}) {
    auto invalid = valid->Clone(); invalid.FindList(collection)->front().GetDict().Set("protected", true);
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
    invalid = valid->Clone(); invalid.FindList(collection)->front().GetDict().Set("type", "text");
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  }
  for (int kind = 0; kind < 5; ++kind) {
    auto conflict = assignment;
    if (kind == 0) conflict.expression = TahaiWorkflowNumericExpression{};
    if (kind == 1) conflict.text_expression = TahaiWorkflowTextExpression{};
    if (kind == 2) conflict.source_id = "source";
    if (kind == 3) conflict.from_variable = true;
    if (kind == 4) conflict.from_action_status = true;
    encoded = base::Value(SerializeTahaiWorkflowAssignment(conflict));
    EXPECT_FALSE(ParseTahaiWorkflowAssignment(&encoded, &decoded));
  }
  TahaiWorkflowPredicate tree; tree.source_id = "source"; tree.equals = "true";
  for (int i = 0; i < 4; ++i) { TahaiWorkflowPredicate parent; parent.operation = "all"; parent.arguments = {tree, tree}; tree = parent; }
  auto bounded = assignment; bounded.boolean_expression = tree;
  encoded = base::Value(SerializeTahaiWorkflowAssignment(bounded)); EXPECT_TRUE(ParseTahaiWorkflowAssignment(&encoded, &decoded));
  TahaiWorkflowPredicate deeper; deeper.operation = "not"; deeper.arguments = {tree}; bounded.boolean_expression = deeper;
  encoded = base::Value(SerializeTahaiWorkflowAssignment(bounded)); EXPECT_FALSE(ParseTahaiWorkflowAssignment(&encoded, &decoded));
}

TEST(TahaiOperationalSkinManifestTest, TextExpressionsAreClosedBoundedTypedAndExcludeProtectedSources) {
  auto valid = base::JSONReader::ReadDict(R"({"id":"text-work","name":"Text work",
    "inputs":[{"id":"source","name":"Source","type":"text","required":false}],
    "variables":[{"id":"result","name":"Result","type":"text"}],
    "steps":[{"id":"format","name":"Format","kind":"assign-variable",
      "assign":{"variable":"result","text_expression":{"op":"concat","args":[{"input":"source"},{"text":"suffix"}]}}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(valid); TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*valid, {}, &parsed));
  const auto assignment = *parsed.steps[0].assignment;
  base::Value encoded(SerializeTahaiWorkflowAssignment(assignment)); TahaiWorkflowAssignment decoded;
  EXPECT_TRUE(ParseTahaiWorkflowAssignment(&encoded, &decoded)); EXPECT_EQ(assignment, decoded);
  for (const char* text : {"null", "[]", "{}", R"({"text":true})", R"({"text":"\n"})", R"({"text":"\u007f"})",
      R"({"input":"missing"})", R"({"number":1})", R"({"text":"a","input":"source"})",
      R"({"op":"eval","args":[]})", R"({"op":"concat","args":[{"text":"a"}]})",
      R"({"op":"replace","args":[{"text":"a"},{"text":"b"}]})"}) {
    auto invalid = valid->Clone();
    (*invalid.FindList("steps"))[0].GetDict().FindDict("assign")->Set("text_expression", base::JSONReader::Read(text, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << text;
  }
  for (const char* collection : {"inputs", "variables"}) {
    auto invalid = valid->Clone(); (*invalid.FindList(collection))[0].GetDict().Set("protected", true);
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
    invalid = valid->Clone(); (*invalid.FindList(collection))[0].GetDict().Set("type", "number");
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  }
  auto conflict = assignment; conflict.expression = TahaiWorkflowNumericExpression{};
  encoded = base::Value(SerializeTahaiWorkflowAssignment(conflict)); EXPECT_FALSE(ParseTahaiWorkflowAssignment(&encoded, &decoded));
  conflict = assignment; conflict.source_id = "source";
  encoded = base::Value(SerializeTahaiWorkflowAssignment(conflict)); EXPECT_FALSE(ParseTahaiWorkflowAssignment(&encoded, &decoded));
  TahaiWorkflowTextExpression tree; tree.text = "x";
  for (int i = 0; i < 4; ++i) { TahaiWorkflowTextExpression parent; parent.operation = "concat"; parent.arguments = {tree, tree}; tree = parent; }
  auto bounded = assignment; bounded.text_expression = tree;
  encoded = base::Value(SerializeTahaiWorkflowAssignment(bounded)); EXPECT_TRUE(ParseTahaiWorkflowAssignment(&encoded, &decoded));
  TahaiWorkflowTextExpression too_deep; too_deep.operation = "trim-space"; too_deep.arguments = {tree};
  bounded.text_expression = too_deep; encoded = base::Value(SerializeTahaiWorkflowAssignment(bounded)); EXPECT_FALSE(ParseTahaiWorkflowAssignment(&encoded, &decoded));
}

TEST(TahaiOperationalSkinManifestTest, TextExpressionEvaluationUsesLiteralBoundedUnicodeAndFixedErrors) {
  auto evaluate = [](std::string_view json) {
    auto node = base::JSONReader::Read(json, base::JSON_PARSE_RFC);
    base::Value source(base::DictValue().Set("variable", "result").Set("text_expression", std::move(*node)));
    TahaiWorkflowAssignment assignment;
    if (!ParseTahaiWorkflowAssignment(&source, &assignment)) return TahaiWorkflowTextResult{{}, "invalid-expression"};
    return EvaluateTahaiWorkflowTextExpression(*assignment.text_expression,
        [](std::string_view id, bool variable) -> std::optional<std::string> {
          if (id == "source" && !variable) return " Aa \xc3\xa9\xf0\x9f\x98\x80 ";
          return std::nullopt;
        });
  };
  EXPECT_EQ("", evaluate(R"({"text":""})").value);
  EXPECT_EQ("Aa \xc3\xa9\xf0\x9f\x98\x80", evaluate(R"({"op":"trim-space","args":[{"input":"source"}]})").value);
  EXPECT_EQ(" AA \xc3\xa9\xf0\x9f\x98\x80 ", evaluate(R"({"op":"upper-ascii","args":[{"input":"source"}]})").value);
  EXPECT_EQ(" aa \xc3\xa9\xf0\x9f\x98\x80 ", evaluate(R"({"op":"lower-ascii","args":[{"input":"source"}]})").value);
  EXPECT_EQ("xa", evaluate(R"({"op":"replace","args":[{"text":"aaa"},{"text":"aa"},{"text":"x"}]})").value);
  EXPECT_EQ("a$&a", evaluate(R"({"op":"replace","args":[{"text":"a.a"},{"text":"."},{"text":"$&"}]})").value);
  EXPECT_EQ("aaa", evaluate(R"({"op":"replace","args":[{"text":"a"},{"text":"a"},{"text":"aaa"}]})").value);
  EXPECT_EQ("missing-text", evaluate(R"({"variable":"unset"})").error);
  EXPECT_EQ("empty-search", evaluate(R"({"op":"replace","args":[{"text":"a"},{"text":""},{"text":"b"}]})").error);
  TahaiWorkflowTextExpression limit; limit.text = std::string(256, 'a');
  TahaiWorkflowTextExpression one; one.text = "a";
  TahaiWorkflowTextExpression twice; twice.text = "aa";
  TahaiWorkflowTextExpression expression; expression.operation = "concat"; expression.arguments = {limit, one};
  auto resolve = [](std::string_view, bool) -> std::optional<std::string> { return std::nullopt; };
  EXPECT_EQ("result-too-long", EvaluateTahaiWorkflowTextExpression(expression, resolve).error);
  expression.operation = "replace"; expression.arguments = {limit, one, twice};
  EXPECT_EQ("result-too-long", EvaluateTahaiWorkflowTextExpression(expression, resolve).error);
  one.text = std::string("\xc0\xaf", 2);
  EXPECT_EQ("invalid-expression", EvaluateTahaiWorkflowTextExpression(one, resolve).error);
  one.text = "\xef\xbf\xbf";
  EXPECT_EQ("invalid-expression", EvaluateTahaiWorkflowTextExpression(one, resolve).error);
}

TEST(TahaiOperationalSkinManifestTest, NumericExpressionsAreClosedBoundedAndRejectProtectedReferences) {
  auto valid = base::JSONReader::ReadDict(R"({
    "id":"math","name":"Math",
    "inputs":[{"id":"amount","name":"Amount","type":"number","required":false}],
    "variables":[{"id":"total","name":"Total","type":"number"}],
    "steps":[{"id":"calculate","name":"Calculate","kind":"assign-variable",
      "assign":{"variable":"total","expression":{"op":"add","args":[{"input":"amount"},{"variable":"total"}]}}}]
  })", base::JSON_PARSE_RFC);
  ASSERT_TRUE(valid);
  TahaiOperationalWorkflow parsed;
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*valid, {}, &parsed));
  const auto expected = *parsed.steps[0].assignment;
  base::Value encoded(SerializeTahaiWorkflowAssignment(expected));
  TahaiWorkflowAssignment restored;
  ASSERT_TRUE(ParseTahaiWorkflowAssignment(&encoded, &restored)); EXPECT_EQ(expected, restored);
  for (const char* expression : {"null", "[]", "{}", R"({"number":true})", R"({"number":"1"})",
      R"({"number":1000000000001})", R"({"input":"missing"})", R"({"variable":"missing"})",
      R"({"number":1,"input":"amount"})", R"({"op":"eval","args":[]})",
      R"({"op":"add","args":[{"number":1}]})", R"({"op":"abs","args":[{"number":1},{"number":2}]})",
      R"({"op":"add","args":[{"number":1},{"number":2}],"script":"run"})",
      R"({"op":["add"],"args":[{"number":1},{"number":2}]})",
      R"({"op":null,"args":[{"number":1},{"number":2}]})",
      R"({"op":{},"args":[{"number":1},{"number":2}]})",
      R"({"op":1,"args":[{"number":1},{"number":2}]})"}) {
    auto invalid = valid->Clone();
    (*invalid.FindList("steps"))[0].GetDict().FindDict("assign")->Set("expression",
        base::JSONReader::Read(expression, base::JSON_PARSE_RFC)->Clone());
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed)) << expression;
    EXPECT_TRUE(parsed.steps.empty());
  }
  for (const char* field : {"protected", "type"}) {
    auto invalid = valid->Clone(); auto& input = (*invalid.FindList("inputs"))[0].GetDict();
    if (std::string_view(field) == "protected") input.Set(field, true); else input.Set(field, "text");
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  }
  auto invalid = valid->Clone();
  (*invalid.FindList("steps"))[0].GetDict().FindDict("assign")->Set("from", base::DictValue().Set("input", "amount"));
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(invalid, {}, &parsed));
  base::Value tree(base::DictValue().Set("number", 1));
  for (int depth = 1; depth < 5; ++depth)
    tree = base::Value(base::DictValue().Set("op", "add").Set("args", base::ListValue().Append(tree.Clone()).Append(tree.Clone())));
  (*valid->FindList("steps"))[0].GetDict().FindDict("assign")->Set("expression", tree.Clone());
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*valid, {}, &parsed));  // Exactly 31 nodes, five levels.
  (*valid->FindList("steps"))[0].GetDict().FindDict("assign")->Set("expression",
      base::DictValue().Set("op", "abs").Set("args", base::ListValue().Append(std::move(tree))));
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(*valid, {}, &parsed));
}

TEST(TahaiOperationalSkinManifestTest, NumericEvaluatorEnforcesEveryIntermediateAndDecimalResultBudget) {
  const auto resolve = [](std::string_view id, bool variable) -> std::optional<double> {
    if (id == "amount" && !variable) return 3;
    if (id == "factor" && variable) return 2;
    return std::nullopt;
  };
  const auto evaluate = [&](std::string_view text) {
    auto expression = base::JSONReader::Read(text, base::JSON_PARSE_RFC);
    base::Value source(base::DictValue().Set("variable", "total").Set("expression", std::move(*expression)));
    TahaiWorkflowAssignment assignment;
    if (!ParseTahaiWorkflowAssignment(&source, &assignment)) return TahaiWorkflowCalculationResult{{}, "invalid-expression"};
    return EvaluateTahaiWorkflowNumericExpression(*assignment.expression, resolve);
  };
  for (const auto& item : {std::pair{"add", 5.0}, {"subtract", 1.0}, {"multiply", 6.0},
                          {"divide", 1.5}, {"min", 2.0}, {"max", 3.0}}) {
    const auto result = evaluate(std::string(R"({"op":")") + item.first + R"(","args":[{"input":"amount"},{"variable":"factor"}]})");
    ASSERT_TRUE(result.value); EXPECT_EQ(item.second, *result.value); EXPECT_TRUE(result.error.empty());
  }
  EXPECT_EQ(3.0, evaluate(R"({"op":"abs","args":[{"number":-3}]})").value);
  EXPECT_EQ(-3.0, evaluate(R"({"op":"negate","args":[{"number":3}]})").value);
  EXPECT_EQ("missing-number", evaluate(R"({"input":"missing"})").error);
  EXPECT_EQ("division-by-zero", evaluate(R"({"op":"divide","args":[{"number":1},{"number":-0.0}]})").error);
  EXPECT_EQ("number-out-of-range", evaluate(R"({"op":"min","args":[{"op":"multiply","args":[{"number":1000000000000},{"number":2}]},{"number":1}]})").error);
  TahaiWorkflowNumericExpression malformed; malformed.number = 1; malformed.input_id = "amount";
  EXPECT_EQ("invalid-expression", EvaluateTahaiWorkflowNumericExpression(malformed, resolve).error);
  malformed = {}; malformed.number = std::numeric_limits<double>::infinity();
  EXPECT_EQ("invalid-expression", EvaluateTahaiWorkflowNumericExpression(malformed, resolve).error);
  EXPECT_EQ("0", FormatTahaiWorkflowCalculation(-0.0));
  EXPECT_EQ("0.0000001", FormatTahaiWorkflowCalculation(1e-7));
  EXPECT_EQ("1000000000000", FormatTahaiWorkflowCalculation(1e12));
  const auto tiny = FormatTahaiWorkflowCalculation(1e-254); ASSERT_TRUE(tiny); EXPECT_EQ(256u, tiny->size());
  EXPECT_FALSE(FormatTahaiWorkflowCalculation(-1e-254));
  EXPECT_FALSE(FormatTahaiWorkflowCalculation(1e-255));
  EXPECT_FALSE(FormatTahaiWorkflowCalculation(1e12 + 1));
  EXPECT_FALSE(FormatTahaiWorkflowCalculation(std::numeric_limits<double>::quiet_NaN()));
}

TEST(TahaiOperationalSkinManifestTest, NamedOutputsAreBoundedBindingsWithoutValuesOrPrivacyOverrides) {
  auto manifest = ValidOperationalSkin();
  auto& workflow = manifest.FindDict("operational")->FindList("workflows")->front().GetDict();
  workflow.Set("inputs", base::ListValue().Append(base::DictValue()
      .Set("id", "private-input").Set("name", "Private input").Set("type", "text")
      .Set("required", true).Set("protected", true)));
  const TahaiOperationalWorkflowOutput definition{"final-result", "Final result", "private-input"};
  const std::vector<TahaiOperationalWorkflowOutput> expected{definition};
  workflow.Set("outputs", SerializeTahaiWorkflowOutputs(expected));
  TahaiOperationalSkinManifest parsed;
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  EXPECT_EQ(expected, parsed.workflows[0].outputs);
  for (const char* invalid : {"null", "{}", "true", "[null]", "[{}]",
      R"([{"id":"final-result","name":"Result","from":{"input":"missing"}}])",
      R"([{"id":"final-result","name":"Result","from":{"variable":"private-input"}}])",
      R"([{"id":"final-result","name":"Result","from":{"input":"private-input","page":"body"}}])",
      R"([{"id":"final-result","name":"Result","from":{"input":"private-input"},"protected":false}])",
      R"([{"id":"final-result","name":"Result","from":{"input":"private-input"},"value":"must-not-export"}])",
      R"([{"id":"final-result","name":"Result","from":{"input":"private-input"},"type":"text"}])",
      R"([{"id":"final-result","name":"Result","from":{"input":"private-input"},"destination":"https://example.test"}])"}) {
    SCOPED_TRACE(invalid);
    workflow.Set("outputs", base::JSONReader::Read(invalid, base::JSON_PARSE_RFC)->Clone());
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
    EXPECT_TRUE(parsed.workflows.empty());
  }
  std::vector<TahaiOperationalWorkflowOutput> outputs;
  for (int i = 0; i < 12; ++i) outputs.push_back({"result-" + std::to_string(i), "Result", "private-input"});
  workflow.Set("outputs", SerializeTahaiWorkflowOutputs(outputs));
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  outputs.push_back({"result-extra", "Result", "private-input"});
  workflow.Set("outputs", SerializeTahaiWorkflowOutputs(outputs));
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  outputs = {definition, definition};
  workflow.Set("outputs", SerializeTahaiWorkflowOutputs(outputs));
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  workflow.Remove("outputs");
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  EXPECT_TRUE(parsed.workflows[0].outputs.empty());
}

TEST(TahaiOperationalSkinManifestTest,
     CompensationChecklistsAreBoundedManualAndRoundTrip) {
  const std::vector<TahaiWorkflowCompensationStep> expected = {
      {"confirm-authority", "Confirm the actual authority"},
      {"record-outcome", "Record the actual outcome"}};
  base::Value encoded(SerializeTahaiWorkflowCompensationSteps(expected));
  std::vector<TahaiWorkflowCompensationStep> parsed;
  ASSERT_TRUE(ParseTahaiWorkflowCompensationSteps(&encoded, &parsed));
  EXPECT_EQ(expected, parsed);

  auto manifest = ValidOperationalSkin();
  auto& workflow = manifest.FindDict("operational")
                       ->FindList("workflows")
                       ->front()
                       .GetDict();
  workflow.Set("compensation_steps",
               SerializeTahaiWorkflowCompensationSteps(expected));
  TahaiOperationalSkinManifest manifest_parsed;
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &manifest_parsed));
  EXPECT_EQ(expected, manifest_parsed.workflows[0].compensation_steps);

  for (const char* invalid : {
           "null", "{}", "[]", "[{}]",
           R"([{"id":"confirm-authority","name":"Confirm","action":"delete"}])",
           R"([{"id":"confirm-authority","name":"Confirm","url":"https://example.test"}])",
           R"([{"id":"same-item","name":"One"},{"id":"same-item","name":"Two"}])"}) {
    SCOPED_TRACE(invalid);
    auto value = base::JSONReader::Read(invalid, base::JSON_PARSE_RFC);
    ASSERT_TRUE(value);
    EXPECT_FALSE(ParseTahaiWorkflowCompensationSteps(&*value, &parsed));
    workflow.Set("compensation_steps", std::move(*value));
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
              ValidateTahaiOperationalSkinManifest(manifest, &manifest_parsed));
  }
  std::vector<TahaiWorkflowCompensationStep> too_many;
  for (int i = 0; i < 9; ++i)
    too_many.push_back({"review-" + std::to_string(i), "Review outcome"});
  base::Value too_many_value(SerializeTahaiWorkflowCompensationSteps(too_many));
  EXPECT_FALSE(ParseTahaiWorkflowCompensationSteps(&too_many_value, &parsed));
  EXPECT_TRUE(ParseTahaiWorkflowCompensationSteps(nullptr, &parsed));
  EXPECT_TRUE(parsed.empty());
}

TEST(TahaiOperationalSkinManifestTest, InputValidationRulesAreClosedTypedAndBounded) {
  auto manifest = ValidOperationalSkin();
  auto& workflow = manifest.FindDict("operational")->FindList("workflows")->front().GetDict();
  workflow.Set("inputs", base::ListValue().Append(base::DictValue()
      .Set("id", "bounded-input").Set("name", "Bounded input")
      .Set("type", "text").Set("required", true)));
  auto& input = workflow.FindList("inputs")->front().GetDict();
  TahaiOperationalSkinManifest parsed;
  input.Set("validation", base::DictValue().Set("min_bytes", 2).Set("max_bytes", 8));
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  ASSERT_TRUE(parsed.workflows[0].inputs[0].validation);
  EXPECT_EQ(2, parsed.workflows[0].inputs[0].validation->min_bytes);
  for (const char* invalid : {"null", "[]", "true", "{}", "{\"min_bytes\":null}",
      "{\"max_bytes\":true}", "{\"min_bytes\":1.5}", "{\"max_bytes\":257}",
      "{\"max_bytes\":0}", "{\"min_bytes\":-1}", "{\"min_bytes\":4,\"max_bytes\":3}",
      "{\"pattern\":\".*\"}", "{\"minimum\":0}", "{\"min_bytes\":0,\"value\":\"hidden\"}"}) {
    SCOPED_TRACE(invalid);
    input.Set("validation", base::JSONReader::Read(invalid, base::JSON_PARSE_RFC)->Clone());
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
    EXPECT_TRUE(parsed.workflows.empty());
  }
  input.Set("type", "number");
  input.Set("validation", base::DictValue().Set("minimum", -0.5).Set("maximum", 3));
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  const auto rules = parsed.workflows[0].inputs[0].validation;
  base::Value encoded(SerializeTahaiWorkflowInputValidation(*rules));
  std::optional<TahaiWorkflowInputValidation> roundtrip;
  EXPECT_TRUE(ParseTahaiWorkflowInputValidation(&encoded, "number", &roundtrip));
  EXPECT_EQ(rules, roundtrip);
  for (const char* invalid : {"{\"minimum\":true}", "{\"maximum\":\"4\"}",
      "{\"minimum\":4,\"maximum\":3}", "{\"minimum\":-1000000000001}",
      "{\"maximum\":1000000000001}", "{\"minimum\":0,\"max_bytes\":3}"}) {
    auto value = base::JSONReader::Read(invalid, base::JSON_PARSE_RFC);
    ASSERT_TRUE(value);
    EXPECT_FALSE(ParseTahaiWorkflowInputValidation(&*value, "number", &roundtrip));
    EXPECT_FALSE(roundtrip);
  }
  for (const char* type : {"boolean", "selection", "date", "unknown"}) {
    EXPECT_FALSE(ParseTahaiWorkflowInputValidation(&encoded, type, &roundtrip));
  }
  TahaiWorkflowInputValidation nonfinite;
  nonfinite.minimum = std::numeric_limits<double>::infinity();
  EXPECT_FALSE(IsValidTahaiWorkflowInputValidation(nonfinite, "number"));
  nonfinite.minimum = std::numeric_limits<double>::quiet_NaN();
  EXPECT_FALSE(IsValidTahaiWorkflowInputValidation(nonfinite, "number"));
  EXPECT_TRUE(ParseTahaiWorkflowInputValidation(nullptr, "text", &roundtrip));
  EXPECT_FALSE(roundtrip);
}

TEST(TahaiOperationalSkinManifestTest, InputValidationMatchesUtf8BytesAndInclusiveNumbers) {
  const TahaiWorkflowInputValidation bytes{2, 4, {}, {}};
  for (const char* type : {"text", "url"}) {
    EXPECT_TRUE(MatchesTahaiWorkflowInputValidation(bytes, type, ""));
    EXPECT_TRUE(MatchesTahaiWorkflowInputValidation(bytes, type, "\xc3\xa9"));
    EXPECT_TRUE(MatchesTahaiWorkflowInputValidation(bytes, type, "abcd"));
    EXPECT_FALSE(MatchesTahaiWorkflowInputValidation(bytes, type, "a"));
    EXPECT_FALSE(MatchesTahaiWorkflowInputValidation(bytes, type, "abcde"));
  }
  const TahaiWorkflowInputValidation numbers{{}, {}, -0.5, 3.0};
  for (const char* value : {"", "-.5", "+0.0", "3", "003.00"})
    EXPECT_TRUE(MatchesTahaiWorkflowInputValidation(numbers, "number", value));
  for (const char* value : {"-.51", "3.01", "NaN", "inf", "not-a-number"})
    EXPECT_FALSE(MatchesTahaiWorkflowInputValidation(numbers, "number", value));
  EXPECT_FALSE(MatchesTahaiWorkflowInputValidation(numbers, "text", ""));
  EXPECT_FALSE(MatchesTahaiWorkflowInputValidation(TahaiWorkflowInputValidation{}, "number", ""));
}

TEST(TahaiOperationalSkinManifestTest, ProtectedInputsAreDefinitionsWithoutValuesOrBranchAuthority) {
  auto manifest = ValidOperationalSkin();
  auto& workflow = manifest.FindDict("operational")->FindList("workflows")->front().GetDict();
  base::DictValue input;
  input.Set("id", "private-input");
  input.Set("name", "Private input");
  input.Set("type", "boolean");
  input.Set("required", true);
  input.Set("protected", true);
  base::ListValue inputs;
  inputs.Append(std::move(input));
  workflow.Set("inputs", std::move(inputs));
  TahaiOperationalSkinManifest parsed;
  ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  EXPECT_TRUE(parsed.workflows[0].inputs[0].is_protected);
  auto& field = workflow.FindList("inputs")->front().GetDict();
  field.Set("protected", "true");
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  field.Set("protected", true);
  for (const char* embedded : {"value", "default", "protected_value"}) {
    field.Set(embedded, "must-not-be-in-a-design");
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
    field.Remove(embedded);
  }
  base::DictValue when;
  when.Set("input", "private-input");
  when.Set("equals", "true");
  workflow.FindList("steps")->front().GetDict().Set("when", std::move(when));
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  field.Set("protected", false);
  EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
            ValidateTahaiOperationalSkinManifest(manifest, &parsed));
}

TEST(TahaiOperationalSkinManifestTest,
     DateAndUrlInputsAreTypedDeclarationsWithoutDefaultsOrBranches) {
  for (const auto type : {TahaiOperationalWorkflowInputType::kDate,
                          TahaiOperationalWorkflowInputType::kUrl}) {
    const auto name = TahaiOperationalWorkflowInputTypeName(type);
    SCOPED_TRACE(name);
    base::DictValue manifest = ValidOperationalSkin();
    auto& workflow = manifest.FindDict("operational")
                         ->FindList("workflows")->front().GetDict();
    base::ListValue inputs;
    inputs.Append(base::DictValue().Set("id", "typed-input")
                      .Set("name", "Typed input").Set("type", name)
                      .Set("required", true));
    workflow.Set("inputs", std::move(inputs));
    TahaiOperationalSkinManifest parsed;
    ASSERT_EQ(TahaiOperationalSkinManifestValidationResult::kValid,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
    ASSERT_EQ(1u, parsed.workflows[0].inputs.size());
    EXPECT_EQ(type, parsed.workflows[0].inputs[0].type);
    auto& input = workflow.FindList("inputs")->front().GetDict();
    for (const char* field : {"value", "default", "sensitive", "options"}) {
      input.Set(field, "not a package value");
      EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
                ValidateTahaiOperationalSkinManifest(manifest, &parsed));
      input.Remove(field);
    }
    workflow.FindList("steps")->front().GetDict().Set(
        "when", base::DictValue().Set("input", "typed-input")
                    .Set("equals", "2026-09-25"));
    EXPECT_EQ(TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow,
              ValidateTahaiOperationalSkinManifest(manifest, &parsed));
  }
  EXPECT_TRUE(TahaiOperationalWorkflowInputTypeName(
      static_cast<TahaiOperationalWorkflowInputType>(999)).empty());
}

TEST(TahaiOperationalSkinManifestTest, ActionStatusBindingsAreTypedPrecedingAndIterationScoped) {
  const auto source = base::JSONReader::ReadDict(R"json({"id":"action-results","name":"Action results",
    "variables":[{"id":"outcome","name":"Outcome","type":"text"}],
    "steps":[{"id":"dispatch","name":"Dispatch","kind":"run-command","action":"layout.dual"},
      {"id":"capture","name":"Capture status","kind":"assign-variable","assign":{"variable":"outcome","from":{"action_status":"dispatch"}}}],
    "repeats":[{"id":"rounds","from":"dispatch","through":"capture","count":2}]
  })json",base::JSON_PARSE_RFC); ASSERT_TRUE(source);
  TahaiOperationalWorkflow workflow;
  const std::array capabilities={TahaiOperationalCapability::kWorkspaceLayout};
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(*source,capabilities,&workflow));
  ASSERT_TRUE(workflow.steps[1].assignment->from_action_status);
  TahaiWorkflowAssignment roundtrip; const auto serialized=base::Value(SerializeTahaiWorkflowAssignment(*workflow.steps[1].assignment));
  ASSERT_TRUE(ParseTahaiWorkflowAssignment(&serialized,&roundtrip)); EXPECT_EQ(*workflow.steps[1].assignment,roundtrip);
  const auto expanded=ExpandTahaiWorkflowSteps(workflow); ASSERT_TRUE(expanded); ASSERT_EQ(4u,expanded->size());
  EXPECT_EQ("r-rounds-1-dispatch",(*expanded)[1].assignment->source_id);
  EXPECT_EQ("r-rounds-2-dispatch",(*expanded)[3].assignment->source_id);
  EXPECT_EQ("dispatch",workflow.steps[1].assignment->source_id);
  for(const char* kind:{"missing","self","instruction","protected","numeric","ambiguous","expression"}) {
    SCOPED_TRACE(kind); auto changed=source->Clone(); auto& steps=*changed.FindList("steps");
    auto& assign=*steps[1].GetDict().FindDict("assign"); auto& target=changed.FindList("variables")->front().GetDict();
    const std::string change(kind);
    if(change=="missing") assign.FindDict("from")->Set("action_status","missing");
    if(change=="self") assign.FindDict("from")->Set("action_status","capture");
    if(change=="instruction") {steps[0].GetDict().Set("kind","instruction");steps[0].GetDict().Remove("action");}
    if(change=="protected") target.Set("protected",true);
    if(change=="numeric") target.Set("type","number");
    if(change=="ambiguous") assign.FindDict("from")->Set("variable","outcome");
    if(change=="expression") assign.Set("expression",base::DictValue().Set("number",1));
    EXPECT_FALSE(ValidateTahaiOperationalWorkflow(changed,capabilities,&workflow));
    EXPECT_TRUE(workflow.steps.empty());
  }
  // Only the inert queue parser may temporarily accept a stripped action marker.
  auto handoff=source->Clone(); auto& first=handoff.FindList("steps")->front().GetDict();first.Set("kind","instruction");first.Remove("action");
  EXPECT_FALSE(ValidateTahaiOperationalWorkflow(handoff,{},&workflow));
  ASSERT_TRUE(ValidateTahaiOperationalWorkflow(handoff,{},&workflow,true));
  EXPECT_FALSE(ValidateTahaiWorkflowActionBindings(workflow.steps));
  workflow.steps[0].kind=TahaiOperationalWorkflowStepKind::kRunCommand;
  EXPECT_TRUE(ValidateTahaiWorkflowActionBindings(workflow.steps));
}

}  // namespace
}  // namespace tahai
