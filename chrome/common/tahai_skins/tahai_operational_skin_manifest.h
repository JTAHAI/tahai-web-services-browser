// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_SKINS_TAHAI_OPERATIONAL_SKIN_MANIFEST_H_
#define CHROME_COMMON_TAHAI_SKINS_TAHAI_OPERATIONAL_SKIN_MANIFEST_H_

#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/containers/span.h"
#include "base/functional/function_ref.h"
#include "base/values.h"
#include "chrome/common/tahai_skins/tahai_skin_manifest.h"
#include "chrome/common/tahai_skins/tahai_surface_design.h"

namespace tahai {

// Version 2 keeps the version 1 appearance schema intact and adds a strictly
// declarative operational description. It is intentionally not executable:
// it cannot name a URL, script, native command id, widget, credential, file,
// connector, or remote resource. A future browser-owned runtime maps these
// stable symbolic names to separately reviewed operations and user grants.
enum class TahaiOperationalSurfaceLayout {
  kOne,
  kDual,
  kTri,
  kQuad,
};

enum class TahaiOperationalRailState {
  kIcons,
  kExpanded,
  kHidden,
};

enum class TahaiOperationalCapability {
  kBrowserNavigation,
  kWorkspaceLayout,
  kMissionChecklist,
  kGuardControl,
};

enum class TahaiOperationalWorkflowStepKind {
  kInstruction,
  kCheckpoint,
  kRunCommand,
  kAssignVariable,
  kWait,
};

// Workflow input definitions are a bounded local form contract. They do not
// name a web form, page selector, credential, or remote data binding.
// Values are created only by the profile-local Mission runtime and never by
// package parsing or activation.
enum class TahaiOperationalWorkflowInputType {
  kText,
  kNumber,
  kBoolean,
  kSelection,
  kDate,
  kUrl,
};

// One wire vocabulary for package handoff, run persistence and native dispatch.
// Unknown enum values return an empty name and cannot authorize an input.
std::string_view TahaiOperationalWorkflowInputTypeName(
    TahaiOperationalWorkflowInputType type);

// Optional, closed validation rules. Lengths count UTF-8 bytes (not displayed
// characters); numeric limits use finite IEEE-754 values within +/- 1e12.
// No regular expressions, scripts, external lookups, or implicit defaults.
struct TahaiWorkflowInputValidation {
  std::optional<int> min_bytes;
  std::optional<int> max_bytes;
  std::optional<double> minimum;
  std::optional<double> maximum;
  bool operator==(const TahaiWorkflowInputValidation&) const = default;
};

bool IsValidTahaiWorkflowInputValidation(
    const std::optional<TahaiWorkflowInputValidation>& rules,
    std::string_view type);
// A missing value is backwards compatible; explicit null/empty/unknown rules
// fail closed. Output is reset on failure.
bool ParseTahaiWorkflowInputValidation(
    const base::Value* value, std::string_view type,
    std::optional<TahaiWorkflowInputValidation>* rules);
base::DictValue SerializeTahaiWorkflowInputValidation(
    const TahaiWorkflowInputValidation& rules);
// This supplements, rather than replaces, type/privacy checks. Blank values
// remain allowed for drafts/clear; required-before-start is enforced separately.
bool MatchesTahaiWorkflowInputValidation(
    const std::optional<TahaiWorkflowInputValidation>& rules,
    std::string_view type, std::string_view value);

struct TahaiOperationalWorkflowInput {
  std::string id;
  std::string name;
  TahaiOperationalWorkflowInputType type =
      TahaiOperationalWorkflowInputType::kText;
  bool required = false;
  // Used only by kSelection. Each value is a closed presentation value, never
  // a URL, credential, command, browser object, or arbitrary payload.
  std::vector<std::string> options;
  // Local run values use OS-backed encryption and cannot be branch predicates.
  bool is_protected = false;
  std::optional<TahaiWorkflowInputValidation> validation;
  bool operator==(const TahaiOperationalWorkflowInput&) const = default;
};

// Variables use the same typed/privacy contract, but have no required flag or
// initial value. Only explicit assignment steps may change run values.
bool ParseTahaiWorkflowVariables(
    const base::Value* source,
    std::vector<TahaiOperationalWorkflowInput>* variables);
base::ListValue SerializeTahaiWorkflowVariables(
    base::span<const TahaiOperationalWorkflowInput> variables);

// Closed arithmetic tree: exactly one of number/input/variable/op. Operations
// have one or two arguments; at most 31 nodes and five levels including leaves.
// No strings of code, property access, implicit coercion or external effects.
struct TahaiWorkflowNumericExpression {
  std::optional<double> number;
  std::string input_id;
  std::string variable_id;
  std::string operation;
  std::vector<TahaiWorkflowNumericExpression> arguments;
  bool operator==(const TahaiWorkflowNumericExpression&) const = default;
};

struct TahaiWorkflowCalculationResult {
  std::optional<double> value;
  // Closed, value-free diagnostic token; empty on success.
  std::string_view error;
};
TahaiWorkflowCalculationResult EvaluateTahaiWorkflowNumericExpression(
    const TahaiWorkflowNumericExpression& expression,
    base::FunctionRef<std::optional<double>(std::string_view, bool)> resolve);
// Same decimal-only grammar as ordinary numeric inputs, at most 256 bytes.
// Expands exponent notation without rounding or permitting unbounded output.
std::optional<std::string> FormatTahaiWorkflowCalculation(double value);

// Bounded string construction, not a script/template language. Text constants
// and ordinary text references only. All intermediate UTF-8 values <=256 bytes.
struct TahaiWorkflowTextExpression {
  std::optional<std::string> text;
  std::string input_id;
  std::string variable_id;
  std::string operation;
  std::vector<TahaiWorkflowTextExpression> arguments;
  bool operator==(const TahaiWorkflowTextExpression&) const = default;
};
struct TahaiWorkflowTextResult {
  std::optional<std::string> value;
  std::string_view error;
};
TahaiWorkflowTextResult EvaluateTahaiWorkflowTextExpression(
    const TahaiWorkflowTextExpression& expression,
    base::FunctionRef<std::optional<std::string>(std::string_view, bool)> resolve);

struct TahaiWorkflowAssignment {
  std::string variable_id;
  std::string source_id;
  bool from_variable = false;
  std::optional<TahaiWorkflowNumericExpression> expression;
  std::optional<TahaiWorkflowTextExpression> text_expression;
  // Closed browser dispatch status, never website data or proof of completion.
  // The source must be a preceding run-command step in the same workflow.
  bool from_action_status = false;
  bool operator==(const TahaiWorkflowAssignment&) const = default;
};
bool ParseTahaiWorkflowAssignment(const base::Value* source,
                                 TahaiWorkflowAssignment* assignment);
base::DictValue SerializeTahaiWorkflowAssignment(
    const TahaiWorkflowAssignment& assignment);
bool ValidateTahaiWorkflowAssignment(
    const TahaiWorkflowAssignment& assignment,
    base::span<const TahaiOperationalWorkflowInput> inputs,
    base::span<const TahaiOperationalWorkflowInput> variables);

struct TahaiOperationalSurface {
  std::string id;
  TahaiOperationalSurfaceLayout layout = TahaiOperationalSurfaceLayout::kOne;
  TahaiOperationalRailState rail_state = TahaiOperationalRailState::kIcons;
  std::string start_surface;
  // Optional ordered native rail modules. These are presentation identifiers,
  // not arbitrary extensions, URLs, scripts, or command names.
  std::vector<std::string> rail_modules;
  std::optional<SurfaceDesign> design;
};

// A finite comparison against one ordinary numeric input. No expression code,
// protected reference, website state or run value belongs in this declaration.
struct TahaiWorkflowNumericCondition {
  std::string operation;
  double number = 0;
  bool operator==(const TahaiWorkflowNumericCondition&) const = default;
};
bool IsValidTahaiWorkflowNumericCondition(const TahaiWorkflowNumericCondition& condition);
bool ParseTahaiWorkflowNumericCondition(const base::Value* source,
                                       TahaiWorkflowNumericCondition* condition);
base::DictValue SerializeTahaiWorkflowNumericCondition(const TahaiWorkflowNumericCondition& condition);
std::optional<bool> CompareTahaiWorkflowNumber(double value,
                                              const TahaiWorkflowNumericCondition& condition);

// A closed boolean tree. Leaves use the existing input/variable comparisons;
// all/any have 2..8 children, not has one. Maximum 31 nodes and five levels.
struct TahaiWorkflowPredicate {
  std::string source_id;
  bool from_variable = false;
  std::string equals;
  std::optional<TahaiWorkflowNumericCondition> compare;
  std::string operation;
  std::vector<TahaiWorkflowPredicate> arguments;
  bool operator==(const TahaiWorkflowPredicate&) const = default;
};
bool ParseTahaiWorkflowPredicate(const base::Value* source, TahaiWorkflowPredicate* predicate);
base::DictValue SerializeTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate);
bool CheckTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate,
    base::FunctionRef<bool(const TahaiWorkflowPredicate&)> check_leaf);
bool ValidateTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate,
    base::span<const TahaiOperationalWorkflowInput> inputs,
    base::span<const TahaiOperationalWorkflowInput> variables);
bool TahaiWorkflowPredicateUsesSource(const TahaiWorkflowPredicate& predicate,
                                     bool variable, std::string_view id = {});
// Every referenced value must resolve, including otherwise short-circuited
// branches. Null is unresolved/invalid, never an implicit false or permission.
std::optional<bool> EvaluateTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate,
    base::FunctionRef<std::optional<bool>(const TahaiWorkflowPredicate&)> evaluate_leaf);

struct TahaiOperationalWorkflowStep {
  std::string id;
  std::string name;
  TahaiOperationalWorkflowStepKind kind =
      TahaiOperationalWorkflowStepKind::kInstruction;
  // Set only for kRunCommand. This is a symbolic action name and has no side
  // effect while a manifest is parsed or installed.
  std::string action;
  // An optional local input condition. It can only refer to an ordinary
  // input declared in this workflow and has no relationship to web content,
  // navigation, a remote event, or an external side effect.
  std::string condition_input_id;
  std::string condition_equals;
  std::optional<TahaiWorkflowAssignment> assignment;
  // Explicit local delay, 1..86400 seconds; zero for every other step kind.
  // No wall-clock timestamp or runtime timer state belongs in a declaration.
  int wait_seconds = 0;
  // Optional active-time completion deadline, greater than wait_seconds and
  // at most 86400 seconds. Zero means no deadline, not immediate expiry.
  int wait_timeout_seconds = 0;
  // Mutually exclusive with condition_equals; uses condition_input_id.
  std::optional<TahaiWorkflowNumericCondition> numeric_condition;
  // Selects the variable namespace for condition_input_id. Ordinary variables
  // use the same closed comparisons; runtime decisions are not declarations.
  bool condition_from_variable = false;
  // Compound when alternative. Mutually exclusive with all legacy leaf fields.
  std::optional<TahaiWorkflowPredicate> predicate;
};

// A named, run-local result binding. Type, validation and sensitivity are
// inherited from the input/variable; a package cannot override or declassify them.
// This declaration contains no result value and performs no external write.
struct TahaiOperationalWorkflowOutput {
  std::string id;
  std::string name;
  std::string input_id;
  bool from_variable = false;
  bool operator==(const TahaiOperationalWorkflowOutput&) const = default;
};

bool ValidateTahaiWorkflowOutputs(
    base::span<const TahaiOperationalWorkflowOutput> outputs,
    base::span<const std::string_view> input_ids,
    base::span<const std::string_view> variable_ids = {});
// Omission means no outputs for existing v2 packages. Malformed declarations
// fail as a whole and reset the output vector; no dangling binding is repaired.
bool ParseTahaiWorkflowOutputs(
    const base::Value* source, base::span<const std::string_view> input_ids,
    std::vector<TahaiOperationalWorkflowOutput>* outputs,
    base::span<const std::string_view> variable_ids = {});
base::ListValue SerializeTahaiWorkflowOutputs(
    base::span<const TahaiOperationalWorkflowOutput> outputs);

// An inclusive, contiguous sequence repeated a fixed number of times. Ranges
// cannot overlap or nest. Expansion is bounded before a run is created; it
// never dispatches actions and each iteration receives a distinct step ID.
struct TahaiWorkflowRepeat {
  std::string id;
  std::string from;
  std::string through;
  int count = 0;
  bool operator==(const TahaiWorkflowRepeat&) const = default;
};

bool ParseTahaiWorkflowRepeats(const base::Value* source,
                              std::vector<TahaiWorkflowRepeat>* repeats);
base::ListValue SerializeTahaiWorkflowRepeats(
    base::span<const TahaiWorkflowRepeat> repeats);

struct TahaiOperationalWorkflow {
  std::string id;
  std::string name;
  std::vector<TahaiOperationalWorkflowInput> inputs;
  std::vector<TahaiOperationalWorkflowStep> steps;
  std::vector<TahaiOperationalWorkflowOutput> outputs;
  std::vector<TahaiOperationalWorkflowInput> variables;
  std::vector<TahaiWorkflowRepeat> repeats;
};

// Validates repeat ranges, expanded identifiers/labels and the total 32-step
// quota, including in-memory callers. Empty repeats preserve existing IDs.
std::optional<std::vector<TahaiOperationalWorkflowStep>>
ExpandTahaiWorkflowSteps(const TahaiOperationalWorkflow& workflow);

struct TahaiOperationalMode {
  std::string id;
  std::string name;
  std::string surface_id;
  std::string workflow_id;
  std::vector<std::string> actions;
};

struct TahaiOperationalSkinManifest {
  int schema_version = 2;
  TahaiSkinManifest appearance;
  std::vector<TahaiOperationalCapability> capabilities;
  std::vector<TahaiOperationalSurface> surfaces;
  std::vector<TahaiOperationalWorkflow> workflows;
  std::vector<TahaiOperationalMode> modes;
};

enum class TahaiOperationalSkinManifestValidationResult {
  kValid,
  kUnknownField,
  kInvalidSchema,
  kInvalidAppearance,
  kInvalidCapabilities,
  kInvalidSurface,
  kInvalidWorkflow,
  kInvalidMode,
};

// Validates a complete v2 operational-skin declaration. The output resets on
// every failure. Validation performs no I/O, installation, appearance change,
// action dispatch, grant decision, navigation, or workflow execution. Version
// 1 packages remain validated by ValidateTahaiSkinManifest().
TahaiOperationalSkinManifestValidationResult
ValidateTahaiOperationalSkinManifest(
    const base::DictValue& manifest,
    TahaiOperationalSkinManifest* parsed_manifest);

// The package parser and native handoff use the same bounded workflow schema.
// An empty capability list admits no browser commands; local typed assignments
// still require explicit execution through the Mission adapter.
// Resets the output on failure; never installs or executes a declaration.
bool ValidateTahaiOperationalWorkflow(
    const base::DictValue& source,
    base::span<const TahaiOperationalCapability> capabilities,
    TahaiOperationalWorkflow* workflow,
    bool inert_native_handoff = false);

bool ValidateTahaiWorkflowActionBindings(
    base::span<const TahaiOperationalWorkflowStep> steps,
    bool inert_native_handoff = false);

// Shared declaration checks for parsing and native dispatch. These are not
// grants: publisher trust, the invoking window and command policy must still
// be verified at use. Unknown action names always fail closed.
bool IsTahaiOperationalActionDeclared(
    base::span<const TahaiOperationalCapability> capabilities,
    std::string_view action);
bool HasTahaiOperationalSurfaceCapabilities(
    base::span<const TahaiOperationalCapability> capabilities,
    const TahaiOperationalSurface& surface);

}  // namespace tahai

#endif  // CHROME_COMMON_TAHAI_SKINS_TAHAI_OPERATIONAL_SKIN_MANIFEST_H_
