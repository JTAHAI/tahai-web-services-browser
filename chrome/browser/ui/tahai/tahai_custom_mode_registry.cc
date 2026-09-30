// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_custom_mode_registry.h"

#include <algorithm>
#include <set>

#include "base/check.h"
#include "base/no_destructor.h"
#include "base/strings/string_util.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"

namespace tahai {
namespace {

constexpr size_t kMaximumCustomModes = 24;

bool IsIdentifier(const std::string& value) {
  return value.size() >= 3 && value.size() <= 64 && value.front() != '-' &&
         value.back() != '-' &&
         std::ranges::all_of(value, [](char character) {
           return (character >= 'a' && character <= 'z') ||
                  (character >= '0' && character <= '9') ||
                  character == '-';
         });
}

bool IsSafeTitle(const std::string& value) {
  if (value.empty() || value.size() > 80u || !base::IsStringUTF8(value)) {
    return false;
  }
  // Labels are always rendered as text, but retaining control characters in a
  // profile preference would still let one custom entry obscure surrounding
  // controls or accessibility output after a restart.
  return std::ranges::none_of(value, [](unsigned char character) {
    return character < 0x20 || character == 0x7f;
  });
}

}  // namespace

base::DictValue EncodeNativeModeCommandLayout(const NativeModeCommandLayout& layout) {
  const auto encode = [](const std::vector<std::string>& group) {
    base::ListValue result;
    for (const auto& id : group) {
      result.Append(id);
    }
    return result;
  };
  return base::DictValue()
      .Set("toolbar_primary", encode(layout.toolbar_primary))
      .Set("toolbar_secondary", encode(layout.toolbar_secondary))
      .Set("app_menu", encode(layout.app_menu));
}

std::optional<NativeModeCommandLayout> DecodeNativeModeCommandLayout(
    const base::DictValue& value, const std::vector<std::string>& actions) {
  if (value.size() != 3u) {
    return std::nullopt;
  }
  NativeModeCommandLayout result;
  const auto decode = [&](const char* key, std::vector<std::string>* group) {
    const auto* list = value.FindList(key);
    if (!list || list->size() > GetNativeModeActionCatalog().size()) {
      return false;
    }
    std::set<std::string> seen;
    for (const auto& item : *list) {
      if (!item.is_string() || !FindNativeModeAction(item.GetString()) ||
          std::ranges::find(actions, item.GetString()) == actions.end() ||
          !seen.insert(item.GetString()).second) {
        return false;
      }
      group->push_back(item.GetString());
    }
    return true;
  };
  if (!decode("toolbar_primary", &result.toolbar_primary) ||
      !decode("toolbar_secondary", &result.toolbar_secondary) ||
      !decode("app_menu", &result.app_menu)) {
    return std::nullopt;
  }
  return result;
}

base::DictValue SerializeTahaiCustomModeDefinition(
    const TahaiCustomModeDefinition& definition) {
  base::DictValue value;
  value.Set("id", definition.id);
  value.Set("title", definition.title);
  value.Set("workspace_id", definition.workspace_id);
  if (definition.native_presentation) {
    value.Set("kind", "native");
    value.Set("presentation", EncodeWindowPresentation(*definition.native_presentation));
    base::ListValue actions;
    for (const auto& action : definition.actions) {
      actions.Append(action);
    }
    value.Set("actions", std::move(actions));
    if (definition.command_layout) {
      value.Set("command_layout", EncodeNativeModeCommandLayout(*definition.command_layout));
    }
  } else {
    value.Set("operational_mode_id", definition.operational_mode_id);
    if (definition.operational_skin) {
      value.Set("skin", base::DictValue()
                            .Set("id", definition.operational_skin->id)
                            .Set("sha256", definition.operational_skin->archive_sha256));
    }
  }
  return value;
}

TahaiCustomModeValidationResult ValidateTahaiCustomModeDefinitions(
    const base::DictValue& value,
    std::vector<TahaiCustomModeDefinition>* definitions) {
  if (!definitions) {
    return TahaiCustomModeValidationResult::kInvalidSchema;
  }
  definitions->clear();
  const base::ListValue* modes = value.FindList("modes");
  if (!modes || modes->size() > kMaximumCustomModes || value.size() != 1u) {
    return modes && modes->size() > kMaximumCustomModes
               ? TahaiCustomModeValidationResult::kExceededLimit
               : TahaiCustomModeValidationResult::kInvalidSchema;
  }
  std::set<std::string> ids;
  for (const base::Value& entry : *modes) {
    const base::DictValue* mode = entry.GetIfDict();
    const bool native = mode && mode->FindString("kind") &&
                        *mode->FindString("kind") == "native";
    if (!mode || mode->size() != (native ? (mode->contains("command_layout") ? 7u : 6u)
                                        : mode->contains("skin") ? 5u : 4u)) {
      definitions->clear();
      return TahaiCustomModeValidationResult::kInvalidSchema;
    }
    const std::string* id = mode->FindString("id");
    const std::string* title = mode->FindString("title");
    const std::string* operational_mode_id =
        mode->FindString("operational_mode_id");
    const std::string* workspace_id = mode->FindString("workspace_id");
    if (!id || !IsIdentifier(*id)) {
      definitions->clear();
      return TahaiCustomModeValidationResult::kInvalidIdentifier;
    }
    if (!title || !IsSafeTitle(*title)) {
      definitions->clear();
      return TahaiCustomModeValidationResult::kInvalidTitle;
    }
    if (!native && (!operational_mode_id || !IsIdentifier(*operational_mode_id))) {
      definitions->clear();
      return TahaiCustomModeValidationResult::kInvalidOperationalMode;
    }
    if (!workspace_id || (!workspace_id->empty() && !IsIdentifier(*workspace_id))) {
      definitions->clear();
      return TahaiCustomModeValidationResult::kInvalidWorkspace;
    }
    if (!ids.insert(*id).second) {
      definitions->clear();
      return TahaiCustomModeValidationResult::kDuplicate;
    }
    TahaiCustomModeDefinition parsed{.id = *id, .title = *title,
        .operational_mode_id = native ? std::string() : *operational_mode_id,
        .workspace_id = *workspace_id};
    if (native) {
      const auto* presentation = mode->FindDict("presentation");
      parsed.native_presentation = presentation
          ? DecodeWindowPresentation(*presentation) : std::nullopt;
      if (!parsed.native_presentation ||
          parsed.native_presentation->configuration.empty() ||
          !parsed.native_presentation->custom_mode.empty() ||
          !parsed.native_presentation->operational_mode.empty()) {
        definitions->clear();
        return TahaiCustomModeValidationResult::kInvalidPresentation;
      }
      const auto* actions = mode->FindList("actions");
      std::set<std::string> seen_actions;
      if (!actions || actions->empty() || actions->size() > GetNativeModeActionCatalog().size()) {
        definitions->clear();
        return TahaiCustomModeValidationResult::kInvalidActions;
      }
      for (const auto& action : *actions) {
        if (!action.is_string() || !FindNativeModeAction(action.GetString()) ||
            !seen_actions.insert(action.GetString()).second) {
          definitions->clear();
          return TahaiCustomModeValidationResult::kInvalidActions;
        }
        parsed.actions.push_back(action.GetString());
      }
      if (mode->contains("command_layout")) {
        const auto* layout = mode->FindDict("command_layout");
        parsed.command_layout = layout
            ? DecodeNativeModeCommandLayout(*layout, parsed.actions) : std::nullopt;
        if (!parsed.command_layout) {
          definitions->clear();
          return TahaiCustomModeValidationResult::kInvalidActions;
        }
      }
    } else if (mode->contains("skin")) {
      const auto* skin = mode->FindDict("skin");
      if (!skin || skin->size() != 2 || !skin->FindString("id") ||
          !skin->FindString("sha256") || skin->FindString("sha256")->empty()) {
        definitions->clear();
        return TahaiCustomModeValidationResult::kInvalidPresentation;
      }
      parsed.operational_skin = WindowSkinReference{*skin->FindString("id"),
                                                    *skin->FindString("sha256")};
      WindowPresentation reference{.fixed_mode = "daily", .rail_state = "icons",
                                    .skin = parsed.operational_skin,
                                    .operational_mode = *operational_mode_id};
      if (!ValidateWindowPresentation(reference)) {
        definitions->clear();
        return TahaiCustomModeValidationResult::kInvalidPresentation;
      }
    }
    definitions->push_back(std::move(parsed));
  }
  return TahaiCustomModeValidationResult::kValid;
}

const std::vector<TahaiCustomModeDefinition>& GetBuiltinNativeModePresets() {
  static const base::NoDestructor<std::vector<TahaiCustomModeDefinition>> presets([] {
    struct Preset {
      const char* id;
      const char* title;
      const char* theme;
      const char* surface;
      const char* density;
      const char* header;
      const char* start;
      const char* layout;
      const char* variant;
      const char* mission_template;
      const char* rail;
      bool runbook;
      NativeModeCommandLayout commands;
    };
    const Preset source[] = {
        {"daily", "Daily Driver", "dark", "mode", "comfortable", "standard",
         "launchpad", "one", "one", "daily-review", "icons", false,
         {{"workspaces.open", "profiles.open"}, {"modes.open", "profiles.open"},
          {"workspaces.open", "modes.open", "profiles.open"}}},
        {"creator", "Creator Studio", "dark", "quiet", "comfortable", "standard",
         "mission", "tri", "tri-one-over-two", "creative-brief", "expanded", true,
         {{"commands.open", "launchpad.open"}, {"modes.open", "commands.open"},
          {"commands.open", "launchpad.open", "modes.open"}}},
        {"builder", "Builder Mode", "dark", "grid", "comfortable", "compact",
         "mission", "tri", "tri-two-over-one", "build-plan", "expanded", true,
         {{"commands.open", "mission.open"}, {"modes.open", "local-oi.open"},
          {"commands.open", "mission.open", "local-oi.open", "modes.open"}}},
        {"operator", "Operator Mode", "dark", "grid", "compact", "standard",
         "mission", "quad", "quad", "incident-bridge", "expanded", true,
         {{"mission.open", "commands.open"}, {"local-oi.open", "modes.open"},
          {"mission.open", "local-oi.open", "commands.open", "support.open", "modes.open"}}},
        {"research", "Research Desk", "light", "paper", "comfortable", "standard",
         "mission", "dual", "dual-side", "source-review", "expanded", true,
         {{"launchpad.open", "commands.open"}, {"modes.open", "profiles.open"},
          {"launchpad.open", "commands.open", "modes.open"}}},
        {"support", "Support Desk", "light", "quiet", "comfortable", "standard",
         "mission", "tri", "tri-one-over-two", "support-case", "expanded", true,
         {{"support.open", "mission.open"}, {"local-oi.open", "policy.open"},
          {"support.open", "mission.open", "local-oi.open", "policy.open", "modes.open"}}},
    };
    base::ListValue serialized;
    for (const auto& preset : source) {
      TahaiCustomModeDefinition mode{
          .id = preset.id, .title = preset.title,
          .native_presentation = WindowPresentation{
              .fixed_mode = preset.id, .rail_state = preset.rail,
              .configuration = {{"theme", preset.theme}, {"accent", "mode"},
                  {"surface", preset.surface}, {"density", preset.density},
                  {"header", preset.header}, {"start_surface", preset.start},
                  {"layout", preset.layout}, {"layout_variant", preset.variant},
                  {"template", preset.mission_template}, {"rail_width", "280"},
                  {"rail_state", preset.rail},
                  {"show_runbook_rail", preset.runbook ? "true" : "false"},
                  {"compact_controls", std::string_view(preset.density) == "compact"
                                           ? "true" : "false"}}},
          .command_layout = preset.commands};
      for (const auto* group : {&preset.commands.toolbar_primary,
                                &preset.commands.toolbar_secondary,
                                &preset.commands.app_menu}) {
        for (const auto& id : *group) {
          if (std::ranges::find(mode.actions, id) == mode.actions.end()) {
            mode.actions.push_back(id);
          }
        }
      }
      serialized.Append(SerializeTahaiCustomModeDefinition(mode));
    }
    std::vector<TahaiCustomModeDefinition> validated;
    CHECK(ValidateTahaiCustomModeDefinitions(
              base::DictValue().Set("modes", std::move(serialized)), &validated) ==
          TahaiCustomModeValidationResult::kValid);
    return validated;
  }());
  return *presets;
}

const TahaiCustomModeDefinition* FindBuiltinNativeModePreset(std::string_view id) {
  const auto& presets = GetBuiltinNativeModePresets();
  const auto found = std::ranges::find(presets, id, &TahaiCustomModeDefinition::id);
  return found == presets.end() ? nullptr : &*found;
}

}  // namespace tahai
