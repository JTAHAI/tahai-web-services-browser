// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"

#include <algorithm>
#include <map>
#include <array>
#include <cmath>
#include <optional>
#include <set>
#include <string_view>
#include <utility>

#include "base/containers/span.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
namespace tahai {
namespace {

constexpr int kOperationalSkinSchemaVersion = 2;
constexpr size_t kMaximumOperationalCapabilities = 4u;
constexpr size_t kMaximumOperationalSurfaces = 12u;
constexpr size_t kMaximumOperationalModes = 12u;
constexpr size_t kMaximumOperationalWorkflows = 24u;
constexpr size_t kMaximumWorkflowSteps = 32u;
constexpr size_t kMaximumWorkflowInputs = 12u;
constexpr size_t kMaximumWorkflowInputOptions = 12u;
constexpr size_t kMaximumModeActions = 12u;
constexpr size_t kMaximumRailModules = 5u;
constexpr size_t kMaximumMetadataLength = 128u;

constexpr std::array<std::string_view, 9> kManifestFields = {
    "schema_version", "id",         "name",   "creator",    "license",
    "compatibility",  "appearance", "assets", "operational"};
constexpr std::array<std::string_view, 7> kAppearanceFields = {
    "id",         "name",  "creator", "license", "compatibility",
    "appearance", "assets"};
constexpr std::array<std::string_view, 4> kOperationalFields = {
    "capabilities", "surfaces", "workflows", "modes"};
constexpr std::array<std::string_view, 6> kSurfaceFields = {
    "id", "layout", "rail_state", "start_surface", "rail_modules", "design"};
constexpr std::array<std::string_view, 7> kWorkflowFields = {
    "id", "name", "inputs", "steps", "outputs", "variables", "repeats"};
constexpr std::array<std::string_view, 7> kWorkflowInputFields = {
    "id", "name", "type", "required", "options", "protected", "validation"};
constexpr std::array<std::string_view, 7> kWorkflowStepFields = {
    "id", "name", "kind", "action", "when", "assign", "wait"};
constexpr std::array<std::string_view, 5> kModeFields = {
    "id", "name", "surface", "workflow", "actions"};

struct CapabilityDefinition {
  std::string_view id;
  TahaiOperationalCapability capability;
};
constexpr std::array<CapabilityDefinition, 4> kCapabilities = {{
    {"browser-navigation", TahaiOperationalCapability::kBrowserNavigation},
    {"workspace-layout", TahaiOperationalCapability::kWorkspaceLayout},
    {"mission-checklist", TahaiOperationalCapability::kMissionChecklist},
    {"guard-control", TahaiOperationalCapability::kGuardControl},
}};

struct ActionDefinition {
  std::string_view id;
  TahaiOperationalCapability capability;
};
constexpr std::array<ActionDefinition, 10> kActions = {{
    {"address.focus", TahaiOperationalCapability::kBrowserNavigation},
    {"tabs.find", TahaiOperationalCapability::kWorkspaceLayout},
    {"workspaces.open", TahaiOperationalCapability::kWorkspaceLayout},
    {"mission.open", TahaiOperationalCapability::kMissionChecklist},
    {"guard.open", TahaiOperationalCapability::kGuardControl},
    {"layout.one", TahaiOperationalCapability::kWorkspaceLayout},
    {"layout.dual", TahaiOperationalCapability::kWorkspaceLayout},
    {"layout.tri", TahaiOperationalCapability::kWorkspaceLayout},
    {"layout.quad", TahaiOperationalCapability::kWorkspaceLayout},
    {"layout.focus", TahaiOperationalCapability::kWorkspaceLayout},
}};

constexpr std::array<std::string_view, 9> kRailModules = {
    "tabs", "saved-workspaces", "bookmarks", "history", "downloads",
    "mission", "local-oi", "command-center", "guard"};

template <size_t N>
bool HasOnlyFields(const base::DictValue& value,
                   const std::array<std::string_view, N>& allowed) {
  return std::all_of(value.begin(), value.end(), [&allowed](const auto& item) {
    return std::find(allowed.begin(), allowed.end(), item.first) !=
           allowed.end();
  });
}

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

bool IsSafeMetadata(std::string_view value) {
  if (value.empty() || value.size() > kMaximumMetadataLength) {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return character >= 0x20 && character <= 0x7e && character != '"' &&
           character != '\\' && character != '<' && character != '>';
  });
}

bool IsSafeWorkflowInputOption(std::string_view value) {
  // Selection labels are local presentation values, not destinations or
  // identity records. Keep their grammar tighter than generic skin metadata
  // so an option cannot masquerade as a URL, contact, path, or header.
  return IsSafeMetadata(value) && value.find("://") == std::string_view::npos &&
         value.find('@') == std::string_view::npos &&
         value.find('\\') == std::string_view::npos &&
         value.find(':') == std::string_view::npos;
}

bool IsKnownStartSurface(std::string_view value) {
  return value == "launchpad" || value == "mission" || value == "commands" ||
         value == "modes";
}

std::optional<TahaiOperationalSurfaceLayout> ParseLayout(
    std::string_view value) {
  if (value == "one") {
    return TahaiOperationalSurfaceLayout::kOne;
  }
  if (value == "dual") {
    return TahaiOperationalSurfaceLayout::kDual;
  }
  if (value == "tri") {
    return TahaiOperationalSurfaceLayout::kTri;
  }
  if (value == "quad") {
    return TahaiOperationalSurfaceLayout::kQuad;
  }
  return std::nullopt;
}

std::optional<TahaiOperationalRailState> ParseRailState(
    std::string_view value) {
  if (value == "icons") {
    return TahaiOperationalRailState::kIcons;
  }
  if (value == "expanded") {
    return TahaiOperationalRailState::kExpanded;
  }
  if (value == "hidden") {
    return TahaiOperationalRailState::kHidden;
  }
  return std::nullopt;
}

std::optional<TahaiOperationalWorkflowStepKind> ParseStepKind(
    std::string_view value) {
  if (value == "instruction") {
    return TahaiOperationalWorkflowStepKind::kInstruction;
  }
  if (value == "checkpoint") {
    return TahaiOperationalWorkflowStepKind::kCheckpoint;
  }
  if (value == "run-command") {
    return TahaiOperationalWorkflowStepKind::kRunCommand;
  }
  if (value == "assign-variable") {
    return TahaiOperationalWorkflowStepKind::kAssignVariable;
  }
  if (value == "wait") return TahaiOperationalWorkflowStepKind::kWait;
  return std::nullopt;
}

std::optional<TahaiOperationalWorkflowInputType> ParseInputType(
    std::string_view value) {
  if (value == "text") {
    return TahaiOperationalWorkflowInputType::kText;
  }
  if (value == "number") {
    return TahaiOperationalWorkflowInputType::kNumber;
  }
  if (value == "boolean") {
    return TahaiOperationalWorkflowInputType::kBoolean;
  }
  if (value == "selection") {
    return TahaiOperationalWorkflowInputType::kSelection;
  }
  if (value == "date") {
    return TahaiOperationalWorkflowInputType::kDate;
  }
  if (value == "url") {
    return TahaiOperationalWorkflowInputType::kUrl;
  }
  return std::nullopt;
}

const CapabilityDefinition* FindCapability(std::string_view value) {
  const auto found =
      std::find_if(kCapabilities.begin(), kCapabilities.end(),
                   [value](const auto& entry) { return entry.id == value; });
  return found == kCapabilities.end() ? nullptr : &*found;
}

const ActionDefinition* FindAction(std::string_view value) {
  const auto found =
      std::find_if(kActions.begin(), kActions.end(),
                   [value](const auto& entry) { return entry.id == value; });
  return found == kActions.end() ? nullptr : &*found;
}

bool HasCapability(base::span<const TahaiOperationalCapability> capabilities,
                   TahaiOperationalCapability required) {
  return std::find(capabilities.begin(), capabilities.end(), required) !=
         capabilities.end();
}

bool ContainsId(base::span<const std::string> ids, std::string_view id) {
  return std::find(ids.begin(), ids.end(), id) != ids.end();
}

bool IsKnownRailModule(std::string_view module) {
  return std::ranges::find(kRailModules, module) != kRailModules.end();
}

bool ParseRailModules(const base::ListValue* source,
                      std::vector<std::string>* modules) {
  if (!modules) {
    return false;
  }
  modules->clear();
  // Omission keeps the existing mode-owned rail presentation for v2 packages
  // created before this optional surface-composition field existed.
  if (!source) {
    return true;
  }
  if (source->empty() || source->size() > kMaximumRailModules) {
    return false;
  }
  for (const base::Value& value : *source) {
    const std::string* module = value.GetIfString();
    if (!module || !IsKnownRailModule(*module) ||
        ContainsId(*modules, *module)) {
      return false;
    }
    modules->push_back(*module);
  }
  return true;
}

bool ParseActions(const base::ListValue& source,
                  base::span<const TahaiOperationalCapability> capabilities,
                  std::vector<std::string>* actions) {
  if (!actions || source.empty() || source.size() > kMaximumModeActions) {
    return false;
  }
  std::vector<std::string> candidate;
  for (const base::Value& value : source) {
    const std::string* action_name = value.GetIfString();
    if (!action_name ||
        !IsTahaiOperationalActionDeclared(capabilities, *action_name) ||
        ContainsId(candidate, *action_name)) {
      return false;
    }
    candidate.push_back(*action_name);
  }
  *actions = std::move(candidate);
  return true;
}

bool ParseWorkflowSteps(
    const base::ListValue& source,
    base::span<const TahaiOperationalCapability> capabilities,
    base::span<const TahaiOperationalWorkflowInput> inputs,
    base::span<const TahaiOperationalWorkflowInput> variables,
    std::vector<TahaiOperationalWorkflowStep>* steps) {
  if (!steps || source.empty() || source.size() > kMaximumWorkflowSteps) {
    return false;
  }
  std::vector<TahaiOperationalWorkflowStep> candidate;
  for (const base::Value& value : source) {
    const base::DictValue* step = value.GetIfDict();
    if (!step || !HasOnlyFields(*step, kWorkflowStepFields)) {
      return false;
    }
    const std::string* id = step->FindString("id");
    const std::string* name = step->FindString("name");
    const std::string* kind_name = step->FindString("kind");
    const std::string* action_name = step->FindString("action");
    const base::DictValue* condition = step->FindDict("when");
    const auto kind = kind_name ? ParseStepKind(*kind_name) : std::nullopt;
    if (!id || !name || !kind || !IsSafeIdentifier(*id) ||
        !IsSafeMetadata(*name) ||
        std::find_if(candidate.begin(), candidate.end(),
                     [id](const auto& current) { return current.id == *id; }) !=
            candidate.end()) {
      return false;
    }
    TahaiOperationalWorkflowStep parsed{*id, *name, *kind, {}, {}, {}};
    if (*kind == TahaiOperationalWorkflowStepKind::kRunCommand) {
      if (!action_name ||
          !IsTahaiOperationalActionDeclared(capabilities, *action_name)) {
        return false;
      }
      parsed.action = *action_name;
    } else if (step->contains("action")) {
      return false;
    }
    if (*kind == TahaiOperationalWorkflowStepKind::kAssignVariable) {
      TahaiWorkflowAssignment assignment;
      if (!ParseTahaiWorkflowAssignment(step->Find("assign"), &assignment) ||
          !ValidateTahaiWorkflowAssignment(assignment, inputs, variables)) return false;
      parsed.assignment = std::move(assignment);
    } else if (step->contains("assign")) {
      return false;
    }
    if (*kind == TahaiOperationalWorkflowStepKind::kWait) {
      const auto* wait = step->FindDict("wait");
      const auto seconds = wait ? wait->FindInt("seconds") : std::nullopt;
      if (!wait || !seconds || *seconds < 1 || *seconds > 86400 ||
          (wait->size() != 1u && wait->size() != 2u)) return false;
      if (wait->contains("timeout_seconds")) {
        const auto timeout = wait->FindInt("timeout_seconds");
        if (!timeout || *timeout <= *seconds || *timeout > 86400) return false;
        parsed.wait_timeout_seconds = *timeout;
      } else if (wait->size() != 1u) return false;
      parsed.wait_seconds = *seconds;
    } else if (step->contains("wait")) {
      return false;
    }
    if (step->contains("when") && !condition) {
      return false;
    }
    if (condition) {
      if (condition->contains("all") || condition->contains("any") || condition->contains("not")) {
        TahaiWorkflowPredicate predicate;
        if (!ParseTahaiWorkflowPredicate(step->Find("when"), &predicate) ||
            !ValidateTahaiWorkflowPredicate(predicate, inputs, variables)) return false;
        parsed.predicate = std::move(predicate);
        candidate.push_back(std::move(parsed));
        continue;
      }
      if (condition->size() != 2 ||
          (condition->contains("input") == condition->contains("variable")) ||
          (condition->contains("equals") == condition->contains("compare"))) {
        return false;
      }
      parsed.condition_from_variable = condition->contains("variable");
      const auto origins = parsed.condition_from_variable ? variables : inputs;
      const std::string* input_id = condition->FindString(parsed.condition_from_variable ? "variable" : "input");
      const std::string* equals = condition->FindString("equals");
      const auto input = input_id
          ? std::find_if(origins.begin(), origins.end(),
                         [input_id](const TahaiOperationalWorkflowInput& item) {
                           return item.id == *input_id;
                         })
          : origins.end();
      if (!input_id || input == origins.end() || input->is_protected) {
        return false;
      }
      parsed.condition_input_id = *input_id;
      if (condition->contains("compare")) {
        TahaiWorkflowNumericCondition numeric;
        if (input->type != TahaiOperationalWorkflowInputType::kNumber ||
            !ParseTahaiWorkflowNumericCondition(condition->Find("compare"), &numeric)) return false;
        parsed.numeric_condition = std::move(numeric);
      } else {
        if (!equals || !IsSafeWorkflowInputOption(*equals)) return false;
        const bool allowed =
            (input->type == TahaiOperationalWorkflowInputType::kBoolean &&
             (*equals == "true" || *equals == "false")) ||
            (input->type == TahaiOperationalWorkflowInputType::kSelection &&
             ContainsId(input->options, *equals));
        if (!allowed) return false;
        parsed.condition_equals = *equals;
      }
    }
    candidate.push_back(std::move(parsed));
  }
  *steps = std::move(candidate);
  return true;
}

bool ParseWorkflowInputs(
    const base::ListValue* source,
    std::vector<TahaiOperationalWorkflowInput>* inputs) {
  if (!inputs) {
    return false;
  }
  inputs->clear();
  // `inputs` was added after the initial v2 declaration. Omission preserves
  // compatibility with existing signed v2 workflow packages.
  if (!source) {
    return true;
  }
  if (source->size() > kMaximumWorkflowInputs) {
    return false;
  }
  std::vector<TahaiOperationalWorkflowInput> candidate;
  for (const base::Value& value : *source) {
    const base::DictValue* input = value.GetIfDict();
    if (!input || !HasOnlyFields(*input, kWorkflowInputFields)) {
      return false;
    }
    const std::string* id = input->FindString("id");
    const std::string* name = input->FindString("name");
    const std::string* type_name = input->FindString("type");
    const std::optional<bool> required = input->FindBool("required");
    const std::optional<bool> is_protected = input->FindBool("protected");
    const base::ListValue* options = input->FindList("options");
    const auto type = type_name ? ParseInputType(*type_name) : std::nullopt;
    if (!id || !name || !type || !required ||
        (input->contains("protected") && !is_protected) || !IsSafeIdentifier(*id) ||
        !IsSafeMetadata(*name) ||
        std::find_if(candidate.begin(), candidate.end(),
                     [id](const auto& current) { return current.id == *id; }) !=
            candidate.end()) {
      return false;
    }
    TahaiOperationalWorkflowInput parsed{*id, *name, *type, *required, {}};
    parsed.is_protected = is_protected.value_or(false);
    if (!ParseTahaiWorkflowInputValidation(input->Find("validation"), *type_name,
                                          &parsed.validation)) {
      return false;
    }
    if (*type == TahaiOperationalWorkflowInputType::kSelection) {
      if (!options || options->empty() ||
          options->size() > kMaximumWorkflowInputOptions) {
        return false;
      }
      for (const base::Value& option : *options) {
        const std::string* option_name = option.GetIfString();
        if (!option_name || !IsSafeWorkflowInputOption(*option_name) ||
            ContainsId(parsed.options, *option_name)) {
          return false;
        }
        parsed.options.push_back(*option_name);
      }
    } else if (input->contains("options")) {
      return false;
    }
    candidate.push_back(std::move(parsed));
  }
  *inputs = std::move(candidate);
  return true;
}

}  // namespace

bool IsValidTahaiWorkflowInputValidation(
    const std::optional<TahaiWorkflowInputValidation>& rules,
    std::string_view type) {
  if (!rules) return true;
  const auto& r = *rules;
  const bool lengths = r.min_bytes.has_value() || r.max_bytes.has_value();
  const bool numbers = r.minimum.has_value() || r.maximum.has_value();
  if (lengths == numbers ||
      (lengths && type != "text" && type != "url") ||
      (numbers && type != "number")) return false;
  if ((r.min_bytes && (*r.min_bytes < 0 || *r.min_bytes > 256)) ||
      (r.max_bytes && (*r.max_bytes < 1 || *r.max_bytes > 256)) ||
      r.min_bytes.value_or(0) > r.max_bytes.value_or(256)) return false;
  const auto finite = [](const std::optional<double>& n) {
    return !n || (std::isfinite(*n) && std::abs(*n) <= 1e12);
  };
  return finite(r.minimum) && finite(r.maximum) &&
         (!r.minimum || !r.maximum || *r.minimum <= *r.maximum);
}

bool ParseTahaiWorkflowInputValidation(
    const base::Value* value, std::string_view type,
    std::optional<TahaiWorkflowInputValidation>* rules) {
  if (!rules) return false;
  rules->reset();
  if (!value) return true;
  const auto* dict = value->GetIfDict();
  constexpr std::array<std::string_view, 4> fields = {
      "min_bytes", "max_bytes", "minimum", "maximum"};
  if (!dict || !HasOnlyFields(*dict, fields)) return false;
  TahaiWorkflowInputValidation parsed;
  parsed.min_bytes = dict->FindInt("min_bytes");
  parsed.max_bytes = dict->FindInt("max_bytes");
  parsed.minimum = dict->FindDouble("minimum");
  parsed.maximum = dict->FindDouble("maximum");
  if ((dict->contains("min_bytes") && !parsed.min_bytes) ||
      (dict->contains("max_bytes") && !parsed.max_bytes) ||
      (dict->contains("minimum") && !parsed.minimum) ||
      (dict->contains("maximum") && !parsed.maximum) ||
      !IsValidTahaiWorkflowInputValidation(parsed, type)) return false;
  *rules = parsed;
  return true;
}

base::DictValue SerializeTahaiWorkflowInputValidation(
    const TahaiWorkflowInputValidation& rules) {
  base::DictValue value;
  if (rules.min_bytes) value.Set("min_bytes", *rules.min_bytes);
  if (rules.max_bytes) value.Set("max_bytes", *rules.max_bytes);
  if (rules.minimum) value.Set("minimum", *rules.minimum);
  if (rules.maximum) value.Set("maximum", *rules.maximum);
  return value;
}

bool MatchesTahaiWorkflowInputValidation(
    const std::optional<TahaiWorkflowInputValidation>& rules,
    std::string_view type, std::string_view value) {
  if (!IsValidTahaiWorkflowInputValidation(rules, type)) return false;
  if (!rules || value.empty()) return true;
  if (type == "text" || type == "url") {
    return value.size() >= static_cast<size_t>(rules->min_bytes.value_or(0)) &&
           value.size() <= static_cast<size_t>(rules->max_bytes.value_or(256));
  }
  double number = 0;
  return base::StringToDouble(value, &number) && std::isfinite(number) &&
         (!rules->minimum || number >= *rules->minimum) &&
         (!rules->maximum || number <= *rules->maximum);
}

std::string_view TahaiOperationalWorkflowInputTypeName(
    TahaiOperationalWorkflowInputType type) {
  switch (type) {
    case TahaiOperationalWorkflowInputType::kText:
      return "text";
    case TahaiOperationalWorkflowInputType::kNumber:
      return "number";
    case TahaiOperationalWorkflowInputType::kBoolean:
      return "boolean";
    case TahaiOperationalWorkflowInputType::kSelection:
      return "selection";
    case TahaiOperationalWorkflowInputType::kDate:
      return "date";
    case TahaiOperationalWorkflowInputType::kUrl:
      return "url";
  }
  return {};
}

bool IsTahaiOperationalActionDeclared(
    base::span<const TahaiOperationalCapability> capabilities,
    std::string_view action) {
  const ActionDefinition* definition = FindAction(action);
  return definition && HasCapability(capabilities, definition->capability);
}

bool HasTahaiOperationalSurfaceCapabilities(
    base::span<const TahaiOperationalCapability> capabilities,
    const TahaiOperationalSurface& surface) {
  // Even the one-pane layout can leave a split and change the window. Rail
  // presentation cannot be used to smuggle in an undeclared command button.
  if (!HasCapability(capabilities,
                     TahaiOperationalCapability::kWorkspaceLayout)) {
    return false;
  }
  if ((surface.start_surface == "mission" ||
       ContainsId(surface.rail_modules, "mission")) &&
      !HasCapability(capabilities,
                     TahaiOperationalCapability::kMissionChecklist)) {
    return false;
  }
  return !ContainsId(surface.rail_modules, "guard") ||
         HasCapability(capabilities, TahaiOperationalCapability::kGuardControl);
}

bool ValidateTahaiWorkflowOutputs(
    base::span<const TahaiOperationalWorkflowOutput> outputs,
    base::span<const std::string_view> input_ids,
    base::span<const std::string_view> variable_ids) {
  if (outputs.size() > 12u) return false;
  for (const auto& output : outputs) {
    if (!IsSafeIdentifier(output.id) || !IsSafeMetadata(output.name) ||
        !IsSafeIdentifier(output.input_id) ||
        std::ranges::count(output.from_variable ? variable_ids : input_ids,
                           output.input_id) != 1 ||
        std::ranges::count(outputs, output.id,
                           &TahaiOperationalWorkflowOutput::id) != 1) return false;
  }
  return true;
}

bool ParseTahaiWorkflowOutputs(
    const base::Value* source, base::span<const std::string_view> input_ids,
    std::vector<TahaiOperationalWorkflowOutput>* outputs,
    base::span<const std::string_view> variable_ids) {
  if (!outputs) return false;
  outputs->clear();
  if (!source) return true;
  const auto* list = source->GetIfList();
  if (!list || list->size() > 12u) return false;
  constexpr std::array<std::string_view, 3> fields = {"id", "name", "from"};
  std::vector<TahaiOperationalWorkflowOutput> candidate;
  for (const auto& item : *list) {
    const auto* dict = item.GetIfDict();
    if (!dict || !HasOnlyFields(*dict, fields)) return false;
    const auto* id = dict->FindString("id");
    const auto* name = dict->FindString("name");
    const auto* from = dict->FindDict("from");
    const bool variable = from && from->contains("variable");
    const auto* input = from ? from->FindString(variable ? "variable" : "input") : nullptr;
    if (!id || !name || !from || from->size() != 1u || !input) return false;
    candidate.push_back({*id, *name, *input, variable});
  }
  if (!ValidateTahaiWorkflowOutputs(candidate, input_ids, variable_ids)) return false;
  *outputs = std::move(candidate);
  return true;
}

base::ListValue SerializeTahaiWorkflowOutputs(
    base::span<const TahaiOperationalWorkflowOutput> outputs) {
  base::ListValue result;
  for (const auto& output : outputs) {
    result.Append(base::DictValue().Set("id", output.id).Set("name", output.name)
        .Set("from", base::DictValue().Set(output.from_variable ? "variable" : "input", output.input_id)));
  }
  return result;
}

bool ParseTahaiWorkflowVariables(
    const base::Value* source,
    std::vector<TahaiOperationalWorkflowInput>* variables) {
  if (!variables) return false;
  variables->clear();
  if (!source) return true;
  const auto* list = source->GetIfList();
  if (!list || list->size() > 12u) return false;
  constexpr std::array<std::string_view, 6> fields = {
      "id", "name", "type", "options", "validation", "protected"};
  base::ListValue inputs;
  for (const auto& item : *list) {
    const auto* definition = item.GetIfDict();
    if (!definition || !HasOnlyFields(*definition, fields)) return false;
    auto input = definition->Clone();
    input.Set("required", false);
    inputs.Append(std::move(input));
  }
  return ParseWorkflowInputs(&inputs, variables);
}

base::ListValue SerializeTahaiWorkflowVariables(
    base::span<const TahaiOperationalWorkflowInput> variables) {
  base::ListValue result;
  for (const auto& variable : variables) {
    base::DictValue definition;
    definition.Set("id", variable.id);
    definition.Set("name", variable.name);
    definition.Set("type", TahaiOperationalWorkflowInputTypeName(variable.type));
    if (variable.validation) definition.Set("validation",
        SerializeTahaiWorkflowInputValidation(*variable.validation));
    if (!variable.options.empty()) {
      base::ListValue options;
      for (const auto& option : variable.options) options.Append(option);
      definition.Set("options", std::move(options));
    }
    // Preserve invalid flags so round-trip validation cannot silently strip them.
    if (variable.required) definition.Set("required", true);
    if (variable.is_protected) definition.Set("protected", true);
    result.Append(std::move(definition));
  }
  return result;
}

namespace {
bool CalculationNumber(double value) {
  return std::isfinite(value) && std::abs(value) <= 1e12;
}

bool ExpressionText(std::string_view value) {
  return value.size() <= 256 && base::IsStringUTF8(value) &&
      std::ranges::none_of(value, [](unsigned char c) { return c < 32 || c == 127; });
}

size_t TextArity(std::string_view operation) {
  if (operation == "trim-space" || operation == "lower-ascii" || operation == "upper-ascii") return 1;
  if (operation == "concat") return 2;
  if (operation == "replace") return 3;
  return 0;
}

bool ParseTextExpression(const base::Value& source, TahaiWorkflowTextExpression* expression,
                         size_t depth, size_t* count) {
  if (depth > 5 || ++*count > 31) return false;
  const auto* node = source.GetIfDict();
  if (!node) return false;
  if (node->size() == 1) {
    if (const auto* text = node->FindString("text"); text && ExpressionText(*text)) {
      expression->text = *text; return true;
    }
    if (const auto* input = node->FindString("input"); input && IsSafeIdentifier(*input)) {
      expression->input_id = *input; return true;
    }
    if (const auto* variable = node->FindString("variable"); variable && IsSafeIdentifier(*variable)) {
      expression->variable_id = *variable; return true;
    }
    return false;
  }
  const auto* operation = node->FindString("op");
  const auto* arguments = node->FindList("args");
  if (node->size() != 2 || !operation || !arguments || !TextArity(*operation) ||
      arguments->size() != TextArity(*operation)) return false;
  expression->operation = *operation;
  for (const auto& argument : *arguments) {
    expression->arguments.emplace_back();
    if (!ParseTextExpression(argument, &expression->arguments.back(), depth + 1, count)) return false;
  }
  return true;
}

bool CheckTextExpression(const TahaiWorkflowTextExpression& expression, size_t depth,
    size_t* count, base::FunctionRef<bool(std::string_view, bool)> reference) {
  if (depth > 5 || ++*count > 31 ||
      static_cast<int>(expression.text.has_value()) + !expression.input_id.empty() +
          !expression.variable_id.empty() + !expression.operation.empty() != 1) return false;
  if (expression.operation.empty()) {
    if (!expression.arguments.empty()) return false;
    if (expression.text) return ExpressionText(*expression.text);
    const bool variable = !expression.variable_id.empty();
    const auto& id = variable ? expression.variable_id : expression.input_id;
    return IsSafeIdentifier(id) && reference(id, variable);
  }
  if (!TextArity(expression.operation) || expression.arguments.size() != TextArity(expression.operation)) return false;
  return std::ranges::all_of(expression.arguments, [&](const auto& argument) {
    return CheckTextExpression(argument, depth + 1, count, reference);
  });
}

base::DictValue SerializeTextExpression(const TahaiWorkflowTextExpression& expression) {
  if (expression.text) return base::DictValue().Set("text", *expression.text);
  if (!expression.input_id.empty()) return base::DictValue().Set("input", expression.input_id);
  if (!expression.variable_id.empty()) return base::DictValue().Set("variable", expression.variable_id);
  base::ListValue arguments;
  for (const auto& argument : expression.arguments) arguments.Append(SerializeTextExpression(argument));
  return base::DictValue().Set("op", expression.operation).Set("args", std::move(arguments));
}

TahaiWorkflowTextResult CalculateText(const TahaiWorkflowTextExpression& expression,
    base::FunctionRef<std::optional<std::string>(std::string_view, bool)> resolve) {
  if (expression.operation.empty()) {
    const auto value = expression.text ? expression.text :
        resolve(expression.variable_id.empty() ? expression.input_id : expression.variable_id,
                !expression.variable_id.empty());
    if (!value || (!expression.text && value->empty())) return {{}, "missing-text"};
    return ExpressionText(*value) ? TahaiWorkflowTextResult{*value, {}}
                                 : TahaiWorkflowTextResult{{}, "invalid-text"};
  }
  std::vector<std::string> values;
  for (const auto& argument : expression.arguments) {
    const auto result = CalculateText(argument, resolve);
    if (!result.value) return result;
    values.push_back(*result.value);
  }
  std::string value = values[0];
  if (expression.operation == "concat") {
    if (value.size() + values[1].size() > 256) return {{}, "result-too-long"};
    value += values[1];
  } else if (expression.operation == "trim-space") {
    base::TrimString(value, " ", &value);
  } else if (expression.operation == "lower-ascii") value = base::ToLowerASCII(value);
  else if (expression.operation == "upper-ascii") value = base::ToUpperASCII(value);
  else if (expression.operation == "replace") {
    if (values[1].empty()) return {{}, "empty-search"};
    // Literal non-overlapping replacement, never re-scan inserted text. Check
    // the bound before each append, not after an unbounded replacement allocation.
    value.clear();
    size_t offset = 0;
    for (;;) {
      const size_t found = values[0].find(values[1], offset);
      const size_t end = found == std::string::npos ? values[0].size() : found;
      if (value.size() + end - offset > 256) return {{}, "result-too-long"};
      value.append(values[0], offset, end - offset);
      if (found == std::string::npos) break;
      if (value.size() + values[2].size() > 256) return {{}, "result-too-long"};
      value += values[2];
      offset = found + values[1].size();
    }
  }
  return {std::move(value), {}};
}

size_t CalculationArity(std::string_view operation) {
  if (operation == "abs" || operation == "negate") return 1;
  if (operation == "add" || operation == "subtract" || operation == "multiply" ||
      operation == "divide" || operation == "min" || operation == "max") return 2;
  return 0;
}

bool ParseCalculation(const base::Value& source, TahaiWorkflowNumericExpression* expression,
                      size_t depth, size_t* count) {
  if (depth > 5 || ++*count > 31) return false;
  const auto* node = source.GetIfDict();
  if (!node) return false;
  if (node->size() == 1) {
    if (const auto number = node->FindDouble("number"); number && CalculationNumber(*number)) {
      expression->number = *number; return true;
    }
    if (const auto* input = node->FindString("input"); input && IsSafeIdentifier(*input)) {
      expression->input_id = *input; return true;
    }
    if (const auto* variable = node->FindString("variable"); variable && IsSafeIdentifier(*variable)) {
      expression->variable_id = *variable; return true;
    }
    return false;
  }
  const auto* operation = node->FindString("op");
  const auto* arguments = node->FindList("args");
  if (node->size() != 2 || !operation || !arguments || !CalculationArity(*operation) ||
      arguments->size() != CalculationArity(*operation)) return false;
  expression->operation = *operation;
  for (const auto& argument : *arguments) {
    expression->arguments.emplace_back();
    if (!ParseCalculation(argument, &expression->arguments.back(), depth + 1, count)) return false;
  }
  return true;
}

bool CheckCalculation(const TahaiWorkflowNumericExpression& expression, size_t depth,
                      size_t* count, base::FunctionRef<bool(std::string_view, bool)> reference) {
  if (depth > 5 || ++*count > 31 ||
      static_cast<int>(expression.number.has_value()) + !expression.input_id.empty() +
          !expression.variable_id.empty() + !expression.operation.empty() != 1) return false;
  if (expression.operation.empty()) {
    if (!expression.arguments.empty()) return false;
    if (expression.number) return CalculationNumber(*expression.number);
    const bool variable = !expression.variable_id.empty();
    const auto& id = variable ? expression.variable_id : expression.input_id;
    return IsSafeIdentifier(id) && reference(id, variable);
  }
  if (!CalculationArity(expression.operation) ||
      expression.arguments.size() != CalculationArity(expression.operation)) return false;
  return std::ranges::all_of(expression.arguments, [&](const auto& argument) {
    return CheckCalculation(argument, depth + 1, count, reference);
  });
}

base::DictValue SerializeCalculation(const TahaiWorkflowNumericExpression& expression) {
  if (expression.number) return base::DictValue().Set("number", *expression.number);
  if (!expression.input_id.empty()) return base::DictValue().Set("input", expression.input_id);
  if (!expression.variable_id.empty()) return base::DictValue().Set("variable", expression.variable_id);
  base::ListValue arguments;
  for (const auto& argument : expression.arguments) arguments.Append(SerializeCalculation(argument));
  return base::DictValue().Set("op", expression.operation).Set("args", std::move(arguments));
}

TahaiWorkflowCalculationResult Calculate(const TahaiWorkflowNumericExpression& expression,
    base::FunctionRef<std::optional<double>(std::string_view, bool)> resolve) {
  if (expression.operation.empty()) {
    const auto value = expression.number ? expression.number :
        resolve(expression.variable_id.empty() ? expression.input_id : expression.variable_id,
                !expression.variable_id.empty());
    if (!value) return {{}, "missing-number"};
    return CalculationNumber(*value) ? TahaiWorkflowCalculationResult{*value, {}}
                                    : TahaiWorkflowCalculationResult{{}, "number-out-of-range"};
  }
  const auto first = Calculate(expression.arguments[0], resolve);
  if (!first.value) return first;
  double value = *first.value;
  if (expression.operation == "abs") value = std::abs(value);
  else if (expression.operation == "negate") value = -value;
  else {
    const auto second = Calculate(expression.arguments[1], resolve);
    if (!second.value) return second;
    const double right = *second.value;
    if (expression.operation == "add") value += right;
    else if (expression.operation == "subtract") value -= right;
    else if (expression.operation == "multiply") value *= right;
    else if (expression.operation == "divide") {
      if (right == 0) return {{}, "division-by-zero"};
      value /= right;
    } else if (expression.operation == "min") value = std::min(value, right);
    else if (expression.operation == "max") value = std::max(value, right);
  }
  return CalculationNumber(value) ? TahaiWorkflowCalculationResult{value, {}}
                                  : TahaiWorkflowCalculationResult{{}, "number-out-of-range"};
}
}  // namespace

TahaiWorkflowCalculationResult EvaluateTahaiWorkflowNumericExpression(
    const TahaiWorkflowNumericExpression& expression,
    base::FunctionRef<std::optional<double>(std::string_view, bool)> resolve) {
  size_t count = 0;
  if (!CheckCalculation(expression, 1, &count, [](std::string_view, bool) { return true; }))
    return {{}, "invalid-expression"};
  return Calculate(expression, resolve);
}

TahaiWorkflowTextResult EvaluateTahaiWorkflowTextExpression(
    const TahaiWorkflowTextExpression& expression,
    base::FunctionRef<std::optional<std::string>(std::string_view, bool)> resolve) {
  size_t count = 0;
  if (!CheckTextExpression(expression, 1, &count, [](std::string_view, bool) { return true; }))
    return {{}, "invalid-expression"};
  return CalculateText(expression, resolve);
}

std::optional<std::string> FormatTahaiWorkflowCalculation(double value) {
  if (!CalculationNumber(value)) return std::nullopt;
  std::string result = base::NumberToString(value == 0 ? 0.0 : value);
  const auto exponent_at = result.find_first_of("eE");
  if (exponent_at == std::string::npos) return result;
  int exponent = 0;
  if (!base::StringToInt(std::string_view(result).substr(exponent_at + 1), &exponent) ||
      exponent < -254 || exponent > 12) return std::nullopt;
  std::string digits = result.substr(0, exponent_at);
  const bool negative = digits.front() == '-';
  if (negative) digits.erase(0, 1);
  const auto dot = digits.find('.');
  const int position = static_cast<int>(dot == std::string::npos ? digits.size() : dot) + exponent;
  if (dot != std::string::npos) digits.erase(dot, 1);
  if (position <= 0) result = "0." + std::string(-position, '0') + digits;
  else if (static_cast<size_t>(position) >= digits.size()) result = digits + std::string(position - digits.size(), '0');
  else { result = digits; result.insert(position, "."); }
  if (negative) result.insert(0, "-");
  return result.size() <= 256 ? std::make_optional(std::move(result)) : std::nullopt;
}

bool IsValidTahaiWorkflowNumericCondition(const TahaiWorkflowNumericCondition& condition) {
  return CalculationNumber(condition.number) &&
      (condition.operation == "equal" || condition.operation == "not-equal" ||
       condition.operation == "less-than" || condition.operation == "at-most" ||
       condition.operation == "greater-than" || condition.operation == "at-least");
}

bool ParseTahaiWorkflowNumericCondition(const base::Value* source,
                                       TahaiWorkflowNumericCondition* condition) {
  if (!condition) return false;
  *condition = {};
  const auto* dict = source ? source->GetIfDict() : nullptr;
  const auto* operation = dict ? dict->FindString("op") : nullptr;
  const auto number = dict ? dict->FindDouble("number") : std::nullopt;
  if (!dict || dict->size() != 2 || !operation || !number ||
      !IsValidTahaiWorkflowNumericCondition({*operation, *number})) return false;
  *condition = {*operation, *number};
  return true;
}

base::DictValue SerializeTahaiWorkflowNumericCondition(const TahaiWorkflowNumericCondition& condition) {
  if (!IsValidTahaiWorkflowNumericCondition(condition)) return {};
  return base::DictValue().Set("op", condition.operation).Set("number", condition.number);
}

std::optional<bool> CompareTahaiWorkflowNumber(double value,
                                              const TahaiWorkflowNumericCondition& condition) {
  if (!std::isfinite(value) || !IsValidTahaiWorkflowNumericCondition(condition)) return std::nullopt;
  if (condition.operation == "equal") return value == condition.number;
  if (condition.operation == "not-equal") return value != condition.number;
  if (condition.operation == "less-than") return value < condition.number;
  if (condition.operation == "at-most") return value <= condition.number;
  if (condition.operation == "greater-than") return value > condition.number;
  return value >= condition.number;
}

namespace {
bool PredicateArity(std::string_view op, size_t size) {
  return op == "not" ? size == 1 : (op == "all" || op == "any") && size >= 2 && size <= 8;
}

bool CheckPredicate(const TahaiWorkflowPredicate& node, size_t depth, size_t& count,
    base::FunctionRef<bool(const TahaiWorkflowPredicate&)> check_leaf) {
  if (depth > 5 || ++count > 31) return false;
  if (node.operation.empty()) {
    return node.arguments.empty() && IsSafeIdentifier(node.source_id) &&
        (node.compare ? node.equals.empty() && IsValidTahaiWorkflowNumericCondition(*node.compare)
                      : IsSafeWorkflowInputOption(node.equals)) && check_leaf(node);
  }
  return node.source_id.empty() && !node.from_variable && node.equals.empty() && !node.compare &&
      PredicateArity(node.operation, node.arguments.size()) &&
      std::ranges::all_of(node.arguments, [&](const auto& child) { return CheckPredicate(child, depth + 1, count, check_leaf); });
}

bool ParsePredicate(const base::Value& source, TahaiWorkflowPredicate& result, size_t depth, size_t& count) {
  if (depth > 5 || ++count > 31) return false;
  const auto* node = source.GetIfDict();
  if (!node) return false;
  if (node->size() == 1) {
    for (const char* op : {"all", "any", "not"}) {
      const auto* value = node->Find(op); if (!value) continue;
      result.operation = op;
      if (result.operation == "not") {
        result.arguments.emplace_back();
        return ParsePredicate(*value, result.arguments.back(), depth + 1, count);
      }
      const auto* children = value->GetIfList();
      if (!children || !PredicateArity(op, children->size())) return false;
      for (const auto& child : *children) {
        result.arguments.emplace_back();
        if (!ParsePredicate(child, result.arguments.back(), depth + 1, count)) return false;
      }
      return true;
    }
    return false;
  }
  if (node->size() != 2 || node->contains("input") == node->contains("variable") ||
      node->contains("equals") == node->contains("compare")) return false;
  result.from_variable = node->contains("variable");
  const auto* id = node->FindString(result.from_variable ? "variable" : "input");
  if (!id || !IsSafeIdentifier(*id)) return false;
  result.source_id = *id;
  if (node->contains("compare")) {
    TahaiWorkflowNumericCondition comparison;
    if (!ParseTahaiWorkflowNumericCondition(node->Find("compare"), &comparison)) return false;
    result.compare = std::move(comparison);
  } else {
    const auto* equals = node->FindString("equals");
    if (!equals || !IsSafeWorkflowInputOption(*equals)) return false;
    result.equals = *equals;
  }
  return true;
}

base::DictValue SerializePredicate(const TahaiWorkflowPredicate& node) {
  if (node.operation.empty()) {
    base::DictValue leaf; leaf.Set(node.from_variable ? "variable" : "input", node.source_id);
    if (node.compare) leaf.Set("compare", SerializeTahaiWorkflowNumericCondition(*node.compare));
    else leaf.Set("equals", node.equals);
    return leaf;
  }
  if (node.operation == "not") return base::DictValue().Set("not", SerializePredicate(node.arguments[0]));
  base::ListValue children;
  for (const auto& child : node.arguments) children.Append(SerializePredicate(child));
  return base::DictValue().Set(node.operation, std::move(children));
}

std::optional<bool> EvaluatePredicate(const TahaiWorkflowPredicate& node,
    base::FunctionRef<std::optional<bool>(const TahaiWorkflowPredicate&)> evaluate_leaf) {
  if (node.operation.empty()) return evaluate_leaf(node);
  bool result = node.operation != "any", resolved = true;
  for (const auto& child : node.arguments) {
    const auto value = EvaluatePredicate(child, evaluate_leaf);
    if (!value) { resolved = false; continue; }
    if (node.operation == "not") result = !*value;
    else if (node.operation == "all") result &= *value;
    else result |= *value;
  }
  return resolved ? std::make_optional(result) : std::nullopt;
}
}  // namespace

bool ParseTahaiWorkflowPredicate(const base::Value* source, TahaiWorkflowPredicate* predicate) {
  if (!predicate) return false;
  *predicate = {}; TahaiWorkflowPredicate candidate; size_t count = 0;
  if (!source || !ParsePredicate(*source, candidate, 1, count)) return false;
  *predicate = std::move(candidate); return true;
}

bool CheckTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate,
    base::FunctionRef<bool(const TahaiWorkflowPredicate&)> check_leaf) {
  size_t count = 0; return CheckPredicate(predicate, 1, count, check_leaf);
}

base::DictValue SerializeTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate) {
  if (!CheckTahaiWorkflowPredicate(predicate, [](const TahaiWorkflowPredicate&) { return true; })) return {};
  return SerializePredicate(predicate);
}

bool ValidateTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate,
    base::span<const TahaiOperationalWorkflowInput> inputs,
    base::span<const TahaiOperationalWorkflowInput> variables) {
  return CheckTahaiWorkflowPredicate(predicate, [&](const TahaiWorkflowPredicate& leaf) {
    const auto origins = leaf.from_variable ? variables : inputs;
    const auto source = std::ranges::find(origins, leaf.source_id, &TahaiOperationalWorkflowInput::id);
    if (source == origins.end() || source->is_protected ||
        std::ranges::count(origins, leaf.source_id, &TahaiOperationalWorkflowInput::id) != 1) return false;
    if (leaf.compare) return source->type == TahaiOperationalWorkflowInputType::kNumber;
    return source->type == TahaiOperationalWorkflowInputType::kBoolean ? leaf.equals == "true" || leaf.equals == "false" :
        source->type == TahaiOperationalWorkflowInputType::kSelection && ContainsId(source->options, leaf.equals);
  });
}

bool TahaiWorkflowPredicateUsesSource(const TahaiWorkflowPredicate& predicate, bool variable, std::string_view id) {
  bool found = false;
  const bool valid = CheckTahaiWorkflowPredicate(predicate, [&](const TahaiWorkflowPredicate& leaf) {
    found |= leaf.from_variable == variable && (id.empty() || id == leaf.source_id); return true;
  });
  return valid && found;
}

std::optional<bool> EvaluateTahaiWorkflowPredicate(const TahaiWorkflowPredicate& predicate,
    base::FunctionRef<std::optional<bool>(const TahaiWorkflowPredicate&)> evaluate_leaf) {
  if (!CheckTahaiWorkflowPredicate(predicate, [](const TahaiWorkflowPredicate&) { return true; })) return std::nullopt;
  return EvaluatePredicate(predicate, evaluate_leaf);
}

bool ParseTahaiWorkflowAssignment(const base::Value* source,
                                 TahaiWorkflowAssignment* assignment) {
  if (!assignment) return false;
  *assignment = {};
  const auto* dict = source ? source->GetIfDict() : nullptr;
  const auto* target = dict ? dict->FindString("variable") : nullptr;
  if (dict && dict->size() == 2 && target && IsSafeIdentifier(*target) && dict->contains("text_expression")) {
    TahaiWorkflowTextExpression expression;
    size_t count = 0;
    if (!ParseTextExpression(*dict->Find("text_expression"), &expression, 1, &count)) return false;
    assignment->variable_id = *target;
    assignment->text_expression = std::move(expression);
    return true;
  }
  if (dict && dict->size() == 2 && target && IsSafeIdentifier(*target) && dict->contains("expression")) {
    TahaiWorkflowNumericExpression expression;
    size_t count = 0;
    if (!ParseCalculation(*dict->Find("expression"), &expression, 1, &count)) return false;
    assignment->variable_id = *target;
    assignment->expression = std::move(expression);
    return true;
  }
  const auto* from = dict ? dict->FindDict("from") : nullptr;
  const bool variable = from && from->contains("variable");
  const bool action_status = from && from->contains("action_status");
  const auto* origin = from ? from->FindString(action_status ? "action_status" : variable ? "variable" : "input") : nullptr;
  if (!dict || dict->size() != 2u || !target || !from || from->size() != 1u ||
      !origin || !IsSafeIdentifier(*target) || !IsSafeIdentifier(*origin)) return false;
  *assignment = {*target, *origin, variable};
  assignment->from_action_status = action_status;
  return true;
}

base::DictValue SerializeTahaiWorkflowAssignment(
    const TahaiWorkflowAssignment& assignment) {
  if (assignment.from_action_status) {
    auto from = base::DictValue().Set("action_status", assignment.source_id);
    if (assignment.from_variable) from.Set("variable", assignment.source_id);
    auto result = base::DictValue().Set("variable", assignment.variable_id).Set("from", std::move(from));
    // Contradictory in-memory shapes remain invalid after serialization.
    if (assignment.expression) result.Set("expression", base::Value());
    if (assignment.text_expression) result.Set("text_expression", base::Value());
    return result;
  }
  if (assignment.text_expression) {
    size_t count = 0;
    auto result = base::DictValue().Set("variable", assignment.variable_id);
    if (!CheckTextExpression(*assignment.text_expression, 1, &count, [](std::string_view, bool) { return true; })) {
      result.Set("text_expression", base::Value());
      return result;
    }
    result.Set("text_expression", SerializeTextExpression(*assignment.text_expression));
    if (assignment.expression) result.Set("expression", base::Value());
    if (!assignment.source_id.empty() || assignment.from_variable)
      result.Set("from", base::DictValue().Set(assignment.from_variable ? "variable" : "input", assignment.source_id));
    return result;
  }
  if (assignment.expression) {
    size_t count = 0;
    if (!CheckCalculation(*assignment.expression, 1, &count, [](std::string_view, bool) { return true; }))
      return base::DictValue().Set("variable", assignment.variable_id).Set("expression", base::Value());
    auto result = base::DictValue().Set("variable", assignment.variable_id)
        .Set("expression", SerializeCalculation(*assignment.expression));
    // Do not silently drop a contradictory in-memory copy binding.
    if (!assignment.source_id.empty() || assignment.from_variable)
      result.Set("from", base::DictValue().Set(assignment.from_variable ? "variable" : "input", assignment.source_id));
    return result;
  }
  return base::DictValue().Set("variable", assignment.variable_id).Set("from",
      base::DictValue().Set(assignment.from_variable ? "variable" : "input", assignment.source_id));
}

bool ValidateTahaiWorkflowAssignment(
    const TahaiWorkflowAssignment& assignment,
    base::span<const TahaiOperationalWorkflowInput> inputs,
    base::span<const TahaiOperationalWorkflowInput> variables) {
  const auto origins = assignment.from_variable ? variables : inputs;
  const auto target = std::ranges::find(variables, assignment.variable_id,
                                       &TahaiOperationalWorkflowInput::id);
  if (assignment.from_action_status) {
    return !assignment.from_variable && !assignment.expression && !assignment.text_expression &&
        IsSafeIdentifier(assignment.source_id) && IsSafeIdentifier(assignment.variable_id) &&
        target != variables.end() && !target->required && !target->is_protected &&
        (target->type == TahaiOperationalWorkflowInputType::kText || target->type == TahaiOperationalWorkflowInputType::kSelection) &&
        std::ranges::count(variables, assignment.variable_id, &TahaiOperationalWorkflowInput::id) == 1;
  }
  if (assignment.text_expression) {
    if (assignment.expression || !assignment.source_id.empty() || assignment.from_variable ||
        !IsSafeIdentifier(assignment.variable_id) || target == variables.end() ||
        target->type != TahaiOperationalWorkflowInputType::kText || target->is_protected || target->required ||
        std::ranges::count(variables, assignment.variable_id, &TahaiOperationalWorkflowInput::id) != 1) return false;
    size_t count = 0;
    return CheckTextExpression(*assignment.text_expression, 1, &count, [&](std::string_view id, bool variable) {
      const auto definitions = variable ? variables : inputs;
      const auto item = std::ranges::find(definitions, id, &TahaiOperationalWorkflowInput::id);
      return item != definitions.end() && !item->is_protected && item->type == TahaiOperationalWorkflowInputType::kText &&
          std::ranges::count(definitions, id, &TahaiOperationalWorkflowInput::id) == 1;
    });
  }
  if (assignment.expression) {
    if (!assignment.source_id.empty() || assignment.from_variable || !IsSafeIdentifier(assignment.variable_id) ||
        target == variables.end() || target->type != TahaiOperationalWorkflowInputType::kNumber ||
        target->is_protected || target->required ||
        std::ranges::count(variables, assignment.variable_id, &TahaiOperationalWorkflowInput::id) != 1) return false;
    size_t count = 0;
    return CheckCalculation(*assignment.expression, 1, &count, [&](std::string_view id, bool variable) {
      const auto definitions = variable ? variables : inputs;
      const auto item = std::ranges::find(definitions, id, &TahaiOperationalWorkflowInput::id);
      return item != definitions.end() && !item->is_protected &&
          item->type == TahaiOperationalWorkflowInputType::kNumber &&
          std::ranges::count(definitions, id, &TahaiOperationalWorkflowInput::id) == 1;
    });
  }
  const auto origin = std::ranges::find(origins, assignment.source_id,
                                       &TahaiOperationalWorkflowInput::id);
  return IsSafeIdentifier(assignment.variable_id) && IsSafeIdentifier(assignment.source_id) &&
         target != variables.end() && origin != origins.end() &&
         !target->required && (!origin->is_protected || target->is_protected) &&
         target->type == origin->type &&
         std::ranges::count(variables, assignment.variable_id, &TahaiOperationalWorkflowInput::id) == 1 &&
         std::ranges::count(origins, assignment.source_id, &TahaiOperationalWorkflowInput::id) == 1;
}

bool ParseTahaiWorkflowRepeats(const base::Value* source,
                              std::vector<TahaiWorkflowRepeat>* repeats) {
  if (!repeats) return false;
  repeats->clear();
  if (!source) return true;
  const auto* list = source->GetIfList();
  if (!list || list->size() > 8u) return false;
  std::vector<TahaiWorkflowRepeat> candidate;
  std::set<std::string> ids;
  for (const auto& value : *list) {
    const auto* dict = value.GetIfDict();
    const auto* id = dict ? dict->FindString("id") : nullptr;
    const auto* from = dict ? dict->FindString("from") : nullptr;
    const auto* through = dict ? dict->FindString("through") : nullptr;
    const auto count = dict ? dict->FindInt("count") : std::nullopt;
    if (!dict || dict->size() != 4u || !id || !from || !through || !count ||
        !IsSafeIdentifier(*id) || !IsSafeIdentifier(*from) ||
        !IsSafeIdentifier(*through) || *count < 2 || *count > 8 ||
        !ids.insert(*id).second) return false;
    candidate.push_back({*id, *from, *through, *count});
  }
  *repeats = std::move(candidate);
  return true;
}

base::ListValue SerializeTahaiWorkflowRepeats(
    base::span<const TahaiWorkflowRepeat> repeats) {
  base::ListValue result;
  for (const auto& repeat : repeats) {
    base::DictValue value;
    value.Set("id", repeat.id);
    value.Set("from", repeat.from);
    value.Set("through", repeat.through);
    value.Set("count", repeat.count);
    result.Append(std::move(value));
  }
  return result;
}

std::optional<std::vector<TahaiOperationalWorkflowStep>>
ExpandTahaiWorkflowSteps(const TahaiOperationalWorkflow& workflow) {
  if (workflow.steps.empty() || workflow.steps.size() > kMaximumWorkflowSteps || workflow.repeats.size() > 8u)
    return std::nullopt;
  base::Value encoded(SerializeTahaiWorkflowRepeats(workflow.repeats));
  std::vector<TahaiWorkflowRepeat> checked;
  if (!ParseTahaiWorkflowRepeats(&encoded, &checked)) return std::nullopt;
  std::set<std::string> authored_ids;
  for (const auto& step : workflow.steps) {
    if (!IsSafeIdentifier(step.id) || !IsSafeMetadata(step.name) ||
        !authored_ids.insert(step.id).second) return std::nullopt;
  }
  struct Range { size_t first; size_t last; size_t repeat_index; };
  std::vector<Range> ranges;
  std::set<size_t> claimed;
  size_t expanded_size = workflow.steps.size();
  for (size_t repeat_index = 0; repeat_index < workflow.repeats.size(); ++repeat_index) {
    const auto& repeat = workflow.repeats[repeat_index];
    const auto first = std::ranges::find(workflow.steps, repeat.from, &TahaiOperationalWorkflowStep::id);
    const auto last = std::ranges::find(workflow.steps, repeat.through, &TahaiOperationalWorkflowStep::id);
    if (first == workflow.steps.end() || last == workflow.steps.end() || first > last) return std::nullopt;
    const size_t begin = first - workflow.steps.begin(), end = last - workflow.steps.begin();
    for (size_t i = begin; i <= end; ++i) if (!claimed.insert(i).second) return std::nullopt;
    expanded_size += (end - begin + 1) * (repeat.count - 1);
    if (expanded_size > kMaximumWorkflowSteps) return std::nullopt;
    ranges.push_back({begin, end, repeat_index});
  }
  std::vector<TahaiOperationalWorkflowStep> result;
  std::map<std::string, std::string> preceding;
  const auto append = [&](TahaiOperationalWorkflowStep step, const std::string& authored_id) {
    if (step.assignment && step.assignment->from_action_status) {
      const auto source = preceding.find(step.assignment->source_id);
      if (source == preceding.end()) return false;
      step.assignment->source_id = source->second;
    }
    preceding[authored_id] = step.id;
    result.push_back(std::move(step));
    return true;
  };
  std::set<std::string> expanded_ids;
  for (size_t i = 0; i < workflow.steps.size();) {
    const auto range = std::ranges::find(ranges, i, &Range::first);
    if (range == ranges.end()) {
      if (!expanded_ids.insert(workflow.steps[i].id).second) return std::nullopt;
      if (!append(workflow.steps[i], workflow.steps[i].id)) return std::nullopt;
      ++i;
      continue;
    }
    const auto& repeat = workflow.repeats[range->repeat_index];
    for (int iteration = 1; iteration <= repeat.count; ++iteration) {
      for (size_t j = range->first; j <= range->last; ++j) {
        auto step = workflow.steps[j];
        step.id = "r-" + repeat.id + "-" + base::NumberToString(iteration) + "-" + step.id;
        step.name = "[" + base::NumberToString(iteration) + "/" + base::NumberToString(repeat.count) + "] " + step.name;
        if (!IsSafeIdentifier(step.id) || !IsSafeMetadata(step.name) ||
            authored_ids.contains(step.id) || !expanded_ids.insert(step.id).second) return std::nullopt;
        if (!append(std::move(step), workflow.steps[j].id)) return std::nullopt;
      }
    }
    i = range->last + 1;
  }
  return result;
}

bool ValidateTahaiWorkflowActionBindings(base::span<const TahaiOperationalWorkflowStep> steps,
                                        bool inert_native_handoff) {
  std::set<std::string> preceding;
  for (const auto& step : steps) {
    if (step.assignment && step.assignment->from_action_status &&
        !preceding.contains(step.assignment->source_id)) return false;
    if (step.kind == TahaiOperationalWorkflowStepKind::kRunCommand ||
        (inert_native_handoff && step.kind == TahaiOperationalWorkflowStepKind::kInstruction)) preceding.insert(step.id);
  }
  return true;
}

bool ValidateTahaiOperationalWorkflow(
    const base::DictValue& source,
    base::span<const TahaiOperationalCapability> capabilities,
    TahaiOperationalWorkflow* workflow, bool inert_native_handoff) {
  if (!workflow) {
    return false;
  }
  *workflow = {};
  const std::string* id = source.FindString("id");
  const std::string* name = source.FindString("name");
  const base::ListValue* inputs = source.FindList("inputs");
  const base::ListValue* steps = source.FindList("steps");
  if (!HasOnlyFields(source, kWorkflowFields) || !id || !name || !steps ||
      !IsSafeIdentifier(*id) || !IsSafeMetadata(*name) ||
      (source.contains("inputs") && !inputs)) {
    return false;
  }
  TahaiOperationalWorkflow candidate{*id, *name, {}, {}};
  if (!ParseWorkflowInputs(inputs, &candidate.inputs) ||
      !ParseTahaiWorkflowVariables(source.Find("variables"), &candidate.variables) ||
      !ParseWorkflowSteps(*steps, capabilities, candidate.inputs, candidate.variables,
                          &candidate.steps) ||
      !ParseTahaiWorkflowRepeats(source.Find("repeats"), &candidate.repeats) ||
      !ValidateTahaiWorkflowActionBindings(candidate.steps, inert_native_handoff) ||
      !ExpandTahaiWorkflowSteps(candidate)) {
    return false;
  }
  std::vector<std::string_view> input_ids;
  for (const auto& input : candidate.inputs) input_ids.push_back(input.id);
  std::vector<std::string_view> variable_ids;
  for (const auto& variable : candidate.variables) variable_ids.push_back(variable.id);
  if (!ParseTahaiWorkflowOutputs(source.Find("outputs"), input_ids,
                                &candidate.outputs, variable_ids)) return false;
  *workflow = std::move(candidate);
  return true;
}

TahaiOperationalSkinManifestValidationResult
ValidateTahaiOperationalSkinManifest(
    const base::DictValue& manifest,
    TahaiOperationalSkinManifest* parsed_manifest) {
  if (!parsed_manifest) {
    return TahaiOperationalSkinManifestValidationResult::kInvalidSchema;
  }
  *parsed_manifest = TahaiOperationalSkinManifest();
  if (!HasOnlyFields(manifest, kManifestFields)) {
    return TahaiOperationalSkinManifestValidationResult::kUnknownField;
  }
  const std::optional<int> schema_version = manifest.FindInt("schema_version");
  const base::DictValue* operational = manifest.FindDict("operational");
  if (!schema_version || *schema_version != kOperationalSkinSchemaVersion ||
      !operational || !HasOnlyFields(*operational, kOperationalFields)) {
    return TahaiOperationalSkinManifestValidationResult::kInvalidSchema;
  }

  // Validate the complete v1 appearance portion through the production v1
  // validator. The schema is rewritten in an isolated copy only.
  base::DictValue appearance_manifest;
  appearance_manifest.Set("schema_version", 1);
  for (std::string_view field : kAppearanceFields) {
    const base::Value* value = manifest.Find(field);
    if (!value) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidAppearance;
    }
    appearance_manifest.Set(field, value->Clone());
  }
  TahaiSkinManifest appearance;
  if (ValidateTahaiSkinManifest(appearance_manifest, &appearance) !=
      TahaiSkinManifestValidationResult::kValid) {
    return TahaiOperationalSkinManifestValidationResult::kInvalidAppearance;
  }

  const base::ListValue* capability_values =
      operational->FindList("capabilities");
  const base::ListValue* surface_values = operational->FindList("surfaces");
  const base::ListValue* workflow_values = operational->FindList("workflows");
  const base::ListValue* mode_values = operational->FindList("modes");
  if (!capability_values || !surface_values || !workflow_values ||
      !mode_values || capability_values->empty() ||
      capability_values->size() > kMaximumOperationalCapabilities ||
      surface_values->empty() ||
      surface_values->size() > kMaximumOperationalSurfaces ||
      workflow_values->empty() ||
      workflow_values->size() > kMaximumOperationalWorkflows ||
      mode_values->empty() || mode_values->size() > kMaximumOperationalModes) {
    return TahaiOperationalSkinManifestValidationResult::kInvalidSchema;
  }

  TahaiOperationalSkinManifest candidate;
  candidate.appearance = std::move(appearance);
  for (const base::Value& value : *capability_values) {
    const std::string* capability_name = value.GetIfString();
    const CapabilityDefinition* capability =
        capability_name ? FindCapability(*capability_name) : nullptr;
    if (!capability ||
        HasCapability(candidate.capabilities, capability->capability)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidCapabilities;
    }
    candidate.capabilities.push_back(capability->capability);
  }

  std::vector<std::string> surface_ids;
  for (const base::Value& value : *surface_values) {
    const base::DictValue* surface = value.GetIfDict();
    if (!surface || !HasOnlyFields(*surface, kSurfaceFields)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidSurface;
    }
    const std::string* id = surface->FindString("id");
    const std::string* layout_name = surface->FindString("layout");
    const std::string* rail_state_name = surface->FindString("rail_state");
    const std::string* start_surface = surface->FindString("start_surface");
    const base::ListValue* rail_modules = surface->FindList("rail_modules");
    const auto layout = layout_name ? ParseLayout(*layout_name) : std::nullopt;
    const auto rail_state =
        rail_state_name ? ParseRailState(*rail_state_name) : std::nullopt;
    if (!id || !start_surface || !layout || !rail_state ||
        !IsSafeIdentifier(*id) || !IsKnownStartSurface(*start_surface) ||
        ContainsId(surface_ids, *id)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidSurface;
    }
    std::vector<std::string> parsed_rail_modules;
    if ((surface->contains("rail_modules") && !rail_modules) ||
        !ParseRailModules(rail_modules, &parsed_rail_modules)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidSurface;
    }
    std::optional<SurfaceDesign> design;
    if (surface->contains("design")) {
      const auto* source = surface->FindDict("design");
      design = source ? DecodeSurfaceDesign(*source) : std::nullopt;
      const int expected_panes = *layout == TahaiOperationalSurfaceLayout::kOne ? 1
          : *layout == TahaiOperationalSurfaceLayout::kDual ? 2
          : *layout == TahaiOperationalSurfaceLayout::kTri ? 3 : 4;
      if (!design || SurfacePaneCount(*design) != expected_panes) {
        return TahaiOperationalSkinManifestValidationResult::kInvalidSurface;
      }
    }
    TahaiOperationalSurface parsed{
        *id, *layout, *rail_state, *start_surface,
        std::move(parsed_rail_modules), std::move(design)};
    if (!HasTahaiOperationalSurfaceCapabilities(candidate.capabilities, parsed)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidSurface;
    }
    surface_ids.push_back(*id);
    candidate.surfaces.push_back(std::move(parsed));
  }

  std::vector<std::string> workflow_ids;
  for (const base::Value& value : *workflow_values) {
    const base::DictValue* workflow = value.GetIfDict();
    TahaiOperationalWorkflow parsed;
    if (!workflow ||
        !ValidateTahaiOperationalWorkflow(*workflow, candidate.capabilities,
                                           &parsed) ||
        ContainsId(workflow_ids, parsed.id)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow;
    }
    workflow_ids.push_back(parsed.id);
    candidate.workflows.push_back(std::move(parsed));
  }

  std::vector<std::string> mode_ids;
  for (const base::Value& value : *mode_values) {
    const base::DictValue* mode = value.GetIfDict();
    if (!mode || !HasOnlyFields(*mode, kModeFields)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidMode;
    }
    const std::string* id = mode->FindString("id");
    const std::string* name = mode->FindString("name");
    const std::string* surface_id = mode->FindString("surface");
    const std::string* workflow_id = mode->FindString("workflow");
    const base::ListValue* actions = mode->FindList("actions");
    if (!id || !name || !surface_id || !workflow_id || !actions ||
        !IsSafeIdentifier(*id) || !IsSafeMetadata(*name) ||
        !ContainsId(surface_ids, *surface_id) ||
        !ContainsId(workflow_ids, *workflow_id) || ContainsId(mode_ids, *id)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidMode;
    }
    TahaiOperationalMode parsed{*id, *name, *surface_id, *workflow_id, {}};
    // Every v2 mode binds a local Mission workflow, including modes whose
    // start surface is not Mission. Activation must disclose this capability.
    if (!IsTahaiOperationalActionDeclared(candidate.capabilities,
                                          "mission.open") ||
        !ParseActions(*actions, candidate.capabilities, &parsed.actions)) {
      return TahaiOperationalSkinManifestValidationResult::kInvalidMode;
    }
    mode_ids.push_back(*id);
    candidate.modes.push_back(std::move(parsed));
  }

  *parsed_manifest = std::move(candidate);
  return TahaiOperationalSkinManifestValidationResult::kValid;
}

}  // namespace tahai
