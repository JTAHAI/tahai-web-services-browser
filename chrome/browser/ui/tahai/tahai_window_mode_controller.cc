// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"

#include "base/check.h"
#include "base/strings/string_number_conversions.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/views/frame/browser_view.h"

namespace tahai {

WindowModeController::WindowModeController(Browser* browser)
    : browser_(browser),
      mode_service_(ModeServiceFactory::GetForProfile(browser->GetProfile())) {
  CHECK(browser_);
  CHECK(mode_service_);
  active_mode_id_ = std::string(mode_service_->active_mode().id);
  active_configuration_ =
      mode_service_->configuration_for_mode(active_mode_id_);
  mode_service_observation_.Observe(mode_service_);
}

WindowModeController::~WindowModeController() = default;

// static
std::string_view WindowModeController::RailStateForCommandId(int command_id) {
  switch (command_id) {
    case IDC_TAHAI_RAIL_ICONS:
      return "icons";
    case IDC_TAHAI_RAIL_EXPANDED:
      return "expanded";
    case IDC_TAHAI_RAIL_HIDDEN:
      return "hidden";
    default:
      return {};
  }
}

// static
WindowModeController* WindowModeController::GetForBrowser(Browser* browser) {
  if (!browser) {
    return nullptr;
  }
  BrowserView* browser_view = BrowserView::GetBrowserViewForBrowser(browser);
  return browser_view ? browser_view->tahai_window_mode_controller() : nullptr;
}

const WorkModeDefinition& WindowModeController::active_mode() const {
  const WorkModeDefinition* definition =
      ModeService::FindDefinition(active_mode_id_);
  CHECK(definition);
  return *definition;
}

const WorkModeWorkspaceConfiguration&
WindowModeController::active_configuration() const {
  return active_configuration_;
}

bool WindowModeController::SetActiveMode(std::string_view mode_id) {
  const WorkModeDefinition* definition = ModeService::FindDefinition(mode_id);
  if (!definition) {
    return false;
  }
  // The native chooser is an explicit per-window action, including when the
  // user re-selects the currently displayed mode.
  follows_profile_default_ = false;
  if (active_mode_id_ == definition->id && !workspace_rail_override_) {
    return true;
  }
  workspace_rail_override_ = false;
  active_mode_id_ = std::string(definition->id);
  active_configuration_ =
      mode_service_->configuration_for_mode(active_mode_id_);
  NotifyModeChanged();
  return true;
}

bool WindowModeController::MakeActiveModeProfileDefault() {
  // Once made the default, this window intentionally follows subsequent
  // profile-default changes again. Other windows keep their local choice.
  follows_profile_default_ = true;
  return mode_service_->SetActiveMode(active_mode_id_);
}

bool WindowModeController::SetActiveConfigurationValue(std::string_view key,
                                                       std::string_view value) {
  if (workspace_rail_override_ &&
      (key == "rail_state" || key == "rail_width")) {
    auto next = active_configuration_;
    if (key == "rail_state") {
      if (value != "icons" && value != "expanded" && value != "hidden") {
        return false;
      }
      next.rail_state = value;
    } else if (!base::StringToInt(value, &next.rail_width) ||
               next.rail_width < 220 || next.rail_width > 480) {
      return false;
    }
    if (next != active_configuration_) {
      active_configuration_ = std::move(next);
      NotifyModeChanged();
    }
    return true;
  }
  return mode_service_->SetConfigurationValueForMode(active_mode_id_, key,
                                                     value);
}

bool WindowModeController::ApplyWorkspacePresentation(
    std::string_view mode_id,
    std::string_view rail_state,
    int rail_width) {
  if (!ModeService::FindDefinition(mode_id) ||
      (rail_state != "icons" && rail_state != "expanded" &&
       rail_state != "hidden") ||
      rail_width < 220 || rail_width > 480) {
    return false;
  }
  auto next = mode_service_->configuration_for_mode(mode_id);
  next.rail_state = rail_state;
  next.rail_width = rail_width;
  const bool changed =
      active_mode_id_ != mode_id || active_configuration_ != next;
  active_mode_id_ = mode_id;
  active_configuration_ = std::move(next);
  follows_profile_default_ = false;
  workspace_rail_override_ = true;
  if (changed) {
    NotifyModeChanged();
  }
  return true;
}

void WindowModeController::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void WindowModeController::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void WindowModeController::OnTahaiActiveModeChanged() {
  if (!follows_profile_default_) {
    return;
  }
  const std::string_view profile_mode_id = mode_service_->active_mode().id;
  if (active_mode_id_ == profile_mode_id) {
    return;
  }
  workspace_rail_override_ = false;
  active_mode_id_ = profile_mode_id;
  active_configuration_ =
      mode_service_->configuration_for_mode(active_mode_id_);
  NotifyModeChanged();
}

void WindowModeController::OnTahaiModeConfigurationChanged() {
  auto next = mode_service_->configuration_for_mode(active_mode_id_);
  if (workspace_rail_override_) {
    next.rail_state = active_configuration_.rail_state;
    next.rail_width = active_configuration_.rail_width;
  }
  if (next == active_configuration_) {
    return;
  }
  active_configuration_ = next;
  NotifyModeChanged();
}

void WindowModeController::NotifyModeChanged() {
  for (Observer& observer : observers_) {
    observer.OnTahaiWindowModeChanged();
  }
}

}  // namespace tahai
