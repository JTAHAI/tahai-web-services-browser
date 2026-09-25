// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_OPERATIONAL_SKIN_CONTROLLER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_OPERATIONAL_SKIN_CONTROLLER_H_

#include <optional>
#include <string_view>
#include <vector>

#include "chrome/browser/ui/tahai/tahai_custom_mode_registry.h"
#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"

namespace tahai {

// A browser-owned resolution result. A skin supplies only an action's symbolic
// name; this type is intentionally an integer command id rather than a
// callback, URL, process, or executable capability.
struct TahaiOperationalSkinActivation {
  std::vector<int> command_ids;
};

// Resolves the small, audited vocabulary accepted by the v2 manifest to
// existing browser command ids. It has no side effects and grants nothing.
std::optional<int> GetTahaiOperationalSkinCommand(std::string_view action);

// Produces only the layout, rail and start-surface commands for a single
// already-validated mode. Declared menu actions are validated, never dispatched.
// The caller must still obtain an explicit user gesture and check command
// availability before dispatching every result.
std::optional<TahaiOperationalSkinActivation>
BuildTahaiOperationalSkinActivation(
    const TahaiOperationalSkinManifest& manifest,
    std::string_view mode_id);

// Produces just the symbolic actions declared by a verified mode for a
// contextual native menu. Presentation defaults are not implicitly added to
// the menu; a mode may explicitly offer an allowlisted layout action.
std::optional<TahaiOperationalSkinActivation>
BuildTahaiOperationalSkinToolbarActions(
    const TahaiOperationalSkinManifest& manifest,
    std::string_view mode_id);

// Resolves a persisted custom mode only through its validated operational
// mode reference. Its workspace reference is restored separately by the
// browser-owned named-workspace controller after the command activation.
std::optional<TahaiOperationalSkinActivation>
BuildTahaiCustomModeActivation(const TahaiOperationalSkinManifest& manifest,
                               const TahaiCustomModeDefinition& mode);

// The contextual-toolbar companion to BuildTahaiCustomModeActivation().
// A title or workspace id never participates in command selection.
std::optional<TahaiOperationalSkinActivation>
BuildTahaiCustomModeToolbarActions(
    const TahaiOperationalSkinManifest& manifest,
    const TahaiCustomModeDefinition& mode);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_OPERATIONAL_SKIN_CONTROLLER_H_
