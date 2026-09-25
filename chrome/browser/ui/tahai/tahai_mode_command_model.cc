// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"

#include <algorithm>
#include <map>

#include "base/no_destructor.h"
#include "base/json/json_writer.h"
#include "base/containers/span.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"

#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/tahai/tahai_operational_skin_controller.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "crypto/sha2.h"

namespace tahai {
namespace {

constexpr NativeModeActionDefinition kNativeActions[] = {
    {"address.focus", IDC_FOCUS_LOCATION, u"Focus address bar"},
    {"tabs.find", IDC_TAHAI_FINDER, u"Find tabs"},
    {"workspaces.open", IDC_TAHAI_NAMED_WORKSPACES, u"Open saved workspace"},
    {"mission.open", IDC_TAHAI_MISSION_CONTROL, u"Open Mission Control"},
    {"guard.open", IDC_TAHAI_GUARD_PANEL, u"Open Guard"},
    {"layout.one", IDC_TAHAI_QUAD_EXIT, u"Exit multi-view"},
    {"layout.dual", IDC_TAHAI_DUAL_VIEW, u"Side by side"},
    {"layout.tri", IDC_TAHAI_TRI_VIEW_TWO_OVER_ONE, u"Two over one"},
    {"layout.quad", IDC_TAHAI_QUAD_VIEW, u"Open 2 × 2 workspace"},
    {"layout.focus", IDC_TAHAI_QUAD_FOCUS, u"Focus active pane"},
    {"launchpad.open", IDC_TAHAI_LAUNCHPAD, u"Open launchpad"},
    {"commands.open", IDC_TAHAI_COMMAND_CENTER, u"Open Command Center"},
    {"modes.open", IDC_TAHAI_WORK_MODES, u"Choose work mode"},
    {"profiles.open", IDC_TAHAI_PROFILES, u"Manage profiles"},
    {"local-oi.open", IDC_TAHAI_LOCAL_OI, u"Open Local OI"},
    {"support.open", IDC_TAHAI_SUPPORT, u"Open support"},
    {"policy.open", IDC_TAHAI_POLICY, u"Open privacy and policy"},
};
static_assert(std::size(kNativeActions) == kMaximumNativeModeActions);

struct OwnedModeCommandGroup {
  std::vector<ModeCommandAction> primary;
  std::vector<ModeCommandAction> secondary;
  std::vector<ModeCommandAction> menu;
};

std::vector<ModeCommandAction> ResolveNativeGroup(const std::vector<std::string>& ids) {
  std::vector<ModeCommandAction> result;
  for (const auto& id : ids) {
    const auto action = FindNativeModeAction(id);
    if (!action) {
      return {};
    }
    result.push_back({action->command_id, action->label});
  }
  return result;
}

}  // namespace

std::span<const NativeModeActionDefinition> GetNativeModeActionCatalog() {
  return kNativeActions;
}

std::optional<NativeModeActionDefinition> FindNativeModeAction(std::string_view id) {
  const auto found = std::ranges::find(kNativeActions, id,
                                      &NativeModeActionDefinition::id);
  return found == std::end(kNativeActions) ? std::nullopt : std::make_optional(*found);
}

ModeCommandGroup GetModeCommandGroup(std::string_view mode_id) {
  static const base::NoDestructor<std::map<std::string, OwnedModeCommandGroup,
                                           std::less<>>> groups([] {
    std::map<std::string, OwnedModeCommandGroup, std::less<>> result;
    for (const auto& preset : GetBuiltinNativeModePresets()) {
      const auto& layout = *preset.command_layout;
      result.emplace(preset.id, OwnedModeCommandGroup{
          ResolveNativeGroup(layout.toolbar_primary),
          ResolveNativeGroup(layout.toolbar_secondary),
          ResolveNativeGroup(layout.app_menu)});
    }
    return result;
  }());
  auto found = groups->find(mode_id);
  if (found == groups->end()) {
    found = groups->find("support");
  }
  const auto& group = found->second;
  return {group.primary, group.secondary, group.menu};
}

std::optional<std::u16string_view> GetOperationalCommandLabel(int command_id) {
  switch (command_id) {
    case IDC_FOCUS_LOCATION:
      return u"Focus address bar";
    case IDC_TAHAI_FINDER:
      return u"Find tabs";
    case IDC_TAHAI_NAMED_WORKSPACES:
      return u"Open saved workspace";
    case IDC_TAHAI_MISSION_CONTROL:
      return u"Open Mission Control";
    case IDC_TAHAI_GUARD_PANEL:
      return u"Open Guard";
    case IDC_TAHAI_QUAD_EXIT:
      return u"Exit multi-view";
    case IDC_TAHAI_DUAL_VIEW:
      return u"Side by side";
    case IDC_TAHAI_TRI_VIEW_TWO_OVER_ONE:
      return u"Two over one";
    case IDC_TAHAI_QUAD_VIEW:
      return u"Open 2 × 2 workspace";
    case IDC_TAHAI_QUAD_FOCUS:
      return u"Focus active pane";
    default:
      return std::nullopt;
  }
}

std::optional<WindowModeActionSet> ResolveOperationalWindowActions(Browser* browser) {
  if (!browser || !browser->is_type_normal() ||
      !browser->GetProfile()->IsRegularProfile() ||
      browser->GetProfile()->IsOffTheRecord()) {
    return std::nullopt;
  }
  auto* controller = WindowModeController::GetForBrowser(browser);
  if (!controller || (controller->active_custom_mode_id().empty() &&
                       controller->active_operational_mode_id().empty())) {
    return std::nullopt;
  }
  WindowModeActionSet result;
  result.context.browser = browser->AsWeakPtr();
  result.context.custom_mode_id = controller->active_custom_mode_id();
  result.context.operational_mode_id = controller->active_operational_mode_id();
  if (!result.context.custom_mode_id.empty()) {
    auto* mode_service = ModeServiceFactory::GetForProfile(browser->GetProfile());
    const auto& custom_modes = mode_service->custom_modes();
    const auto custom = std::ranges::find(custom_modes, result.context.custom_mode_id,
                                          &TahaiCustomModeDefinition::id);
    if (custom == custom_modes.end() ||
        (!result.context.operational_mode_id.empty() &&
         custom->operational_mode_id != result.context.operational_mode_id)) {
      return result;
    }
    auto definition_json = base::WriteJson(SerializeTahaiCustomModeDefinition(*custom));
    if (!definition_json) {
      return result;
    }
    result.context.definition_sha256 = base::ToLowerASCII(
        base::HexEncode(crypto::SHA256Hash(base::as_byte_span(*definition_json))));
    if (custom->native_presentation) {
      const auto& presentation = *custom->native_presentation;
      const auto current = controller->CapturePresentation();
      if (controller->active_mode_id() != presentation.fixed_mode ||
          !controller->active_operational_mode_id().empty() ||
          current.skin != presentation.skin ||
          (presentation.skin && !controller->window_skin_palette())) {
        return result;
      }
      if (presentation.skin) {
        result.context.skin_id = presentation.skin->id;
        result.context.archive_sha256 = presentation.skin->archive_sha256;
      }
      for (const auto& id : custom->actions) {
        const auto action = FindNativeModeAction(id);
        if (!action) {
          result.actions.clear();
          return result;
        }
        result.actions.push_back({action->command_id, action->label});
      }
      result.toolbar_primary = custom->command_layout
          ? ResolveNativeGroup(custom->command_layout->toolbar_primary) : result.actions;
      result.toolbar_secondary = custom->command_layout
          ? ResolveNativeGroup(custom->command_layout->toolbar_secondary)
          : std::vector<ModeCommandAction>();
      result.app_menu = custom->command_layout
          ? ResolveNativeGroup(custom->command_layout->app_menu) : result.actions;
      return result;
    }
    // A legacy alias is recoverable data, not an authorization to select any
    // future package that happens to reuse the old mode's symbolic name.
    const auto current = controller->CapturePresentation();
    if (!custom->operational_skin || current.skin != custom->operational_skin) {
      return result;
    }
    result.context.operational_mode_id = custom->operational_mode_id;
  }
  const auto* manifest = controller->operational_manifest();
  const auto archive = controller->operational_archive_sha256();
  if (!manifest || !archive) {
    return result;
  }
  result.context.skin_id = manifest->appearance.id;
  result.context.archive_sha256 = *archive;
  auto activation = BuildTahaiOperationalSkinToolbarActions(
      *manifest, result.context.operational_mode_id);
  if (!activation) {
    return result;
  }
  for (int command_id : activation->command_ids) {
    auto label = GetOperationalCommandLabel(command_id);
    if (!label) {
      result.actions.clear();
      return result;
    }
    result.actions.push_back({command_id, *label});
  }
  result.toolbar_primary = result.actions;
  result.app_menu = result.actions;
  return result;
}

bool CanExecuteWindowModeAction(Browser* browser,
                                const WindowModeActionContext& context,
                                int command_id) {
  if (!browser || context.browser.get() != browser) {
    return false;
  }
  const auto current = ResolveOperationalWindowActions(browser);
  return current && context.skin_id == current->context.skin_id &&
         context.archive_sha256 == current->context.archive_sha256 &&
         context.operational_mode_id == current->context.operational_mode_id &&
         context.custom_mode_id == current->context.custom_mode_id &&
         context.definition_sha256 == current->context.definition_sha256 &&
         std::ranges::any_of(current->actions, [command_id](const auto& action) {
           return action.command_id == command_id;
         }) && chrome::IsCommandEnabled(browser, command_id);
}

bool ExecuteWindowModeAction(Browser* browser,
                             const WindowModeActionContext& context,
                             int command_id) {
  return CanExecuteWindowModeAction(browser, context, command_id) &&
         chrome::ExecuteCommand(browser, command_id);
}

}  // namespace tahai
