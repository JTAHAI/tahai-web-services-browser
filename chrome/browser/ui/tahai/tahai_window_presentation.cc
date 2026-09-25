// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_window_presentation.h"

#include <algorithm>
#include <array>
#include <set>

#include "base/json/json_reader.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"

namespace tahai {
namespace {

bool Identifier(std::string_view text) {
  return text.size() >= 3 && text.size() <= 64 && text.front() != '-' &&
         text.back() != '-' &&
         std::ranges::all_of(text, [](unsigned char ch) {
           return (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') ||
                  ch == '-';
         });
}

}  // namespace

bool ValidateWindowPresentation(const WindowPresentation& presentation) {
  if (presentation.surface_design && !ValidateSurfaceDesign(*presentation.surface_design)) {
    return false;
  }
  if (!ModeService::FindDefinition(presentation.fixed_mode) ||
      (presentation.rail_state != "icons" &&
       presentation.rail_state != "expanded" &&
       presentation.rail_state != "hidden") ||
      presentation.rail_width < 220 || presentation.rail_width > 480 ||
      presentation.rail_modules.size() > 5 ||
      (!presentation.operational_mode.empty() &&
       (!presentation.skin || !Identifier(presentation.operational_mode))) ||
      (!presentation.custom_mode.empty() &&
       !Identifier(presentation.custom_mode))) {
    return false;
  }
  static constexpr std::array<std::string_view, 9> kModules = {
      "tabs", "saved-workspaces", "bookmarks", "history", "downloads",
      "mission", "local-oi", "command-center", "guard"};
  std::set<std::string> seen;
  for (const auto& module : presentation.rail_modules) {
    if (std::ranges::find(kModules, module) == kModules.end() ||
        !seen.insert(module).second) {
      return false;
    }
  }
  if (!presentation.configuration.empty()) {
    const auto configuration = ModeService::DecodeConfiguration(
        presentation.fixed_mode, presentation.configuration);
    if (!configuration || configuration->rail_state != presentation.rail_state ||
        configuration->rail_width != presentation.rail_width) {
      return false;
    }
  }
  if (presentation.skin) {
    const auto& skin = *presentation.skin;
    if (!Identifier(skin.id)) {
      return false;
    }
    if (skin.archive_sha256.empty()) {
      return GetTahaiBuiltInSkinAppearance(skin.id).has_value() &&
             presentation.operational_mode.empty();
    }
    if (IsTahaiBuiltInSkinId(skin.id) || skin.archive_sha256.size() != 64 ||
        !std::ranges::all_of(skin.archive_sha256, [](unsigned char ch) {
          return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') ||
                 (ch >= 'A' && ch <= 'F');
        })) {
      return false;
    }
  }
  return true;
}

base::DictValue EncodeWindowPresentation(const WindowPresentation& presentation) {
  base::ListValue modules;
  for (const auto& module : presentation.rail_modules) {
    modules.Append(module);
  }
  base::DictValue value;
  value.Set("version", 1);
  value.Set("mode", presentation.fixed_mode);
  value.Set("rail", presentation.rail_state);
  value.Set("width", presentation.rail_width);
  value.Set("modules", std::move(modules));
  value.Set("operational_mode", presentation.operational_mode);
  value.Set("custom_mode", presentation.custom_mode);
  if (presentation.surface_design) {
    value.Set("surface_design", EncodeSurfaceDesign(*presentation.surface_design));
  }
  if (!presentation.configuration.empty()) {
    base::DictValue configuration;
    for (const auto& [key, token] : presentation.configuration) {
      configuration.Set(key, token);
    }
    value.Set("configuration", std::move(configuration));
  }
  if (presentation.skin) {
    value.Set("skin", base::DictValue()
                          .Set("id", presentation.skin->id)
                          .Set("sha256", presentation.skin->archive_sha256));
  }
  return value;
}

std::optional<WindowPresentation> DecodeWindowPresentation(
    const base::DictValue& value) {
  const auto* mode = value.FindString("mode");
  const auto* rail = value.FindString("rail");
  const auto width = value.FindInt("width");
  const auto* modules = value.FindList("modules");
  const auto* operational = value.FindString("operational_mode");
  const auto* custom = value.FindString("custom_mode");
  if (value.size() != 7u + (value.contains("skin") ? 1u : 0u) +
                          (value.contains("configuration") ? 1u : 0u) +
                          (value.contains("surface_design") ? 1u : 0u) ||
      value.FindInt("version") != 1 || !mode || !rail || !width || !modules ||
      modules->size() > 5 || !operational || !custom) {
    return std::nullopt;
  }
  WindowPresentation presentation{.fixed_mode = *mode,
                                  .rail_state = *rail,
                                  .rail_width = *width,
                                  .operational_mode = *operational,
                                  .custom_mode = *custom};
  if (value.contains("surface_design")) {
    const auto* design = value.FindDict("surface_design");
    presentation.surface_design = design ? DecodeSurfaceDesign(*design) : std::nullopt;
    if (!presentation.surface_design) {
      return std::nullopt;
    }
  }
  if (value.contains("configuration")) {
    const auto* configuration = value.FindDict("configuration");
    if (!configuration || configuration->size() != 13u) {
      return std::nullopt;
    }
    for (const auto [key, token] : *configuration) {
      if (!token.is_string()) {
        return std::nullopt;
      }
      presentation.configuration.emplace(key, token.GetString());
    }
  }
  for (const auto& module : *modules) {
    if (!module.is_string()) {
      return std::nullopt;
    }
    presentation.rail_modules.push_back(module.GetString());
  }
  if (value.contains("skin")) {
    const auto* skin = value.FindDict("skin");
    if (!skin || skin->size() != 2 || !skin->FindString("id") ||
        !skin->FindString("sha256")) {
      return std::nullopt;
    }
    presentation.skin =
        WindowSkinReference{*skin->FindString("id"), *skin->FindString("sha256")};
  }
  return ValidateWindowPresentation(presentation)
             ? std::make_optional(std::move(presentation))
             : std::nullopt;
}

std::optional<WindowPresentation> ParseWindowPresentation(std::string_view json) {
  if (json.size() > 4096) {
    return std::nullopt;
  }
  auto value = base::JSONReader::ReadDict(json, base::JSON_PARSE_RFC);
  return value ? DecodeWindowPresentation(*value) : std::nullopt;
}

}  // namespace tahai
