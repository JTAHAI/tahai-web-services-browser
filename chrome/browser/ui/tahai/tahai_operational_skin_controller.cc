// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_operational_skin_controller.h"

#include <algorithm>
#include <array>
#include <string>

#include "chrome/app/chrome_command_ids.h"

namespace tahai {
namespace {

struct CommandDefinition {
  std::string_view action;
  int command_id;
};

constexpr std::array<CommandDefinition, 10> kCommands = {{
    {"address.focus", IDC_FOCUS_LOCATION},
    {"tabs.find", IDC_TAHAI_FINDER},
    {"workspaces.open", IDC_TAHAI_NAMED_WORKSPACES},
    {"mission.open", IDC_TAHAI_MISSION_CONTROL},
    {"guard.open", IDC_TAHAI_GUARD_PANEL},
    {"layout.one", IDC_TAHAI_QUAD_EXIT},
    {"layout.dual", IDC_TAHAI_DUAL_VIEW},
    {"layout.tri", IDC_TAHAI_TRI_VIEW_TWO_OVER_ONE},
    {"layout.quad", IDC_TAHAI_QUAD_VIEW},
    {"layout.focus", IDC_TAHAI_QUAD_FOCUS},
}};

std::optional<int> FindCommand(std::string_view action) {
  const auto found = std::find_if(kCommands.begin(), kCommands.end(),
                                  [action](const CommandDefinition& candidate) {
                                    return candidate.action == action;
                                  });
  return found == kCommands.end() ? std::nullopt
                                  : std::optional<int>(found->command_id);
}

const TahaiOperationalMode* FindMode(
    const TahaiOperationalSkinManifest& manifest,
    std::string_view mode_id) {
  const auto mode =
      std::find_if(manifest.modes.begin(), manifest.modes.end(),
                   [mode_id](const TahaiOperationalMode& candidate) {
                     return candidate.id == mode_id;
                   });
  return mode == manifest.modes.end() ? nullptr : &*mode;
}

std::optional<std::string_view> LayoutAction(
    TahaiOperationalSurfaceLayout layout) {
  switch (layout) {
    case TahaiOperationalSurfaceLayout::kOne:
      return "layout.one";
    case TahaiOperationalSurfaceLayout::kDual:
      return "layout.dual";
    case TahaiOperationalSurfaceLayout::kTri:
      return "layout.tri";
    case TahaiOperationalSurfaceLayout::kQuad:
      return "layout.quad";
  }
  return std::nullopt;
}

std::optional<int> RailCommand(TahaiOperationalRailState rail_state) {
  switch (rail_state) {
    case TahaiOperationalRailState::kIcons:
      return IDC_TAHAI_RAIL_ICONS;
    case TahaiOperationalRailState::kExpanded:
      return IDC_TAHAI_RAIL_EXPANDED;
    case TahaiOperationalRailState::kHidden:
      return IDC_TAHAI_RAIL_HIDDEN;
  }
  return std::nullopt;
}

std::optional<int> StartSurfaceCommand(std::string_view start_surface) {
  if (start_surface == "launchpad") {
    return IDC_TAHAI_LAUNCHPAD;
  }
  if (start_surface == "mission") {
    return IDC_TAHAI_MISSION_CONTROL;
  }
  if (start_surface == "commands") {
    return IDC_TAHAI_COMMAND_CENTER;
  }
  if (start_surface == "modes") {
    return IDC_TAHAI_WORK_MODES;
  }
  return std::nullopt;
}

void AppendUnique(std::vector<int>* command_ids, std::optional<int> command) {
  if (command && std::find(command_ids->begin(), command_ids->end(),
                           *command) == command_ids->end()) {
    command_ids->push_back(*command);
  }
}

}  // namespace

std::optional<int> GetTahaiOperationalSkinCommand(std::string_view action) {
  return FindCommand(action);
}

std::optional<TahaiOperationalSkinActivation>
BuildTahaiOperationalSkinActivation(
    const TahaiOperationalSkinManifest& manifest,
    std::string_view mode_id) {
  const TahaiOperationalMode* mode = FindMode(manifest, mode_id);
  if (!mode || !IsTahaiOperationalActionDeclared(manifest.capabilities,
                                                 "mission.open")) {
    return std::nullopt;
  }
  const auto surface =
      std::find_if(manifest.surfaces.begin(), manifest.surfaces.end(),
                   [mode](const TahaiOperationalSurface& candidate) {
                     return candidate.id == mode->surface_id;
                   });
  if (surface == manifest.surfaces.end() ||
      !HasTahaiOperationalSurfaceCapabilities(manifest.capabilities, *surface)) {
    return std::nullopt;
  }

  TahaiOperationalSkinActivation activation;
  const std::optional<std::string_view> layout = LayoutAction(surface->layout);
  if (!layout) {
    return std::nullopt;
  }
  AppendUnique(&activation.command_ids, FindCommand(*layout));
  const std::optional<int> rail = RailCommand(surface->rail_state);
  if (!rail) {
    return std::nullopt;
  }
  AppendUnique(&activation.command_ids, rail);
  const std::optional<int> start_surface =
      StartSurfaceCommand(surface->start_surface);
  if (!start_surface) {
    return std::nullopt;
  }
  AppendUnique(&activation.command_ids, start_surface);
  for (const std::string& action : mode->actions) {
    if (!FindCommand(action) ||
        !IsTahaiOperationalActionDeclared(manifest.capabilities, action)) {
      return std::nullopt;
    }
    // These are available menu actions, not startup instructions. Executing
    // them here can replace the requested layout, steal focus, or open every
    // panel merely because the user selected a mode.
  }
  return activation;
}

std::optional<TahaiOperationalSkinActivation>
BuildTahaiOperationalSkinToolbarActions(
    const TahaiOperationalSkinManifest& manifest,
    std::string_view mode_id) {
  const TahaiOperationalMode* mode = FindMode(manifest, mode_id);
  if (!mode) {
    return std::nullopt;
  }

  TahaiOperationalSkinActivation activation;
  for (const std::string& action : mode->actions) {
    const std::optional<int> command = FindCommand(action);
    if (!command ||
        !IsTahaiOperationalActionDeclared(manifest.capabilities, action)) {
      return std::nullopt;
    }
    AppendUnique(&activation.command_ids, command);
  }
  return activation;
}

std::optional<TahaiOperationalSkinActivation>
BuildTahaiCustomModeActivation(const TahaiOperationalSkinManifest& manifest,
                               const TahaiCustomModeDefinition& mode) {
  // Do not interpret the title or workspace reference as browser input. The
  // only activation authority is the already-validated symbolic mode ID.
  return BuildTahaiOperationalSkinActivation(manifest,
                                              mode.operational_mode_id);
}

std::optional<TahaiOperationalSkinActivation>
BuildTahaiCustomModeToolbarActions(
    const TahaiOperationalSkinManifest& manifest,
    const TahaiCustomModeDefinition& mode) {
  return BuildTahaiOperationalSkinToolbarActions(manifest,
                                                  mode.operational_mode_id);
}

}  // namespace tahai
