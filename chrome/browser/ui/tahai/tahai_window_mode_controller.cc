// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"

#include <algorithm>
#include <array>

#include "base/check.h"
#include "base/functional/bind.h"
#include "base/json/json_writer.h"
#include "base/strings/string_number_conversions.h"
#include "base/task/single_thread_task_runner.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/sessions/session_service_factory.h"
#include "chrome/browser/tahai_skins/skin_profile_service.h"
#include "chrome/browser/tahai_skins/skin_profile_service_factory.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/browser/ui/views/frame/contents_container_view.h"
#include "chrome/browser/ui/views/frame/contents_web_view.h"
#include "chrome/browser/ui/views/frame/multi_contents_view.h"
#include "ui/views/widget/widget.h"

namespace tahai {
namespace {

constexpr std::array<std::string_view, 9> kOperationalRailModuleIds = {
    "tabs", "saved-workspaces", "bookmarks", "history", "downloads",
    "mission", "local-oi", "command-center", "guard"};

bool IsOperationalRailModule(std::string_view module_id) {
  return std::find(kOperationalRailModuleIds.begin(),
                   kOperationalRailModuleIds.end(), module_id) !=
         kOperationalRailModuleIds.end();
}

}  // namespace

WindowModeController::WindowModeController(BrowserWindowInterface* browser)
    : browser_(browser),
      mode_service_(ModeServiceFactory::GetForProfile(browser->GetProfile())) {
  CHECK(browser_);
  CHECK(mode_service_);
  active_mode_id_ = std::string(mode_service_->active_mode().id);
  active_configuration_ =
      mode_service_->configuration_for_mode(active_mode_id_);
  mode_service_observation_.Observe(mode_service_);
  if (auto* skin_service = skins::SkinProfileServiceFactory::GetForProfile(browser->GetProfile())) {
    skin_service_ = skin_service->GetWeakPtr();
    skin_binding_subscription_ = skin_service->ObserveWindowBindings(base::BindRepeating(
        &WindowModeController::OnWindowSkinBindingsChanged, base::Unretained(this)));
  }
}

WindowModeController::~WindowModeController() {
  weak_factory_.InvalidateWeakPtrs();
  ReleaseWindowSkin();
}

skins::SkinColorSupplier* WindowModeController::window_skin_palette() const {
  const auto* binding = skin_service_ && window_skin_binding_
      ? skin_service_->GetWindowBinding(*window_skin_binding_) : nullptr;
  return binding ? binding->palette.get() : nullptr;
}

const TahaiOperationalSkinManifest* WindowModeController::operational_manifest() const {
  if (!skin_service_) {
    return nullptr;
  }
  if (!window_skin_binding_ && requested_window_skin_) {
    return nullptr;
  }
  if (!window_skin_binding_) {
    return skin_service_->GetOperationalManifest();
  }
  const auto* binding = skin_service_->GetWindowBinding(*window_skin_binding_);
  return binding && binding->operational_manifest
      ? &*binding->operational_manifest : nullptr;
}

std::optional<std::string> WindowModeController::operational_archive_sha256() const {
  if (!skin_service_ || !operational_manifest()) {
    return std::nullopt;
  }
  if (!window_skin_binding_) {
    return skin_service_->GetOperationalManifestArchiveSha256();
  }
  return skin_service_->GetWindowBinding(*window_skin_binding_)->archive_sha256;
}

bool WindowModeController::ApplyReviewedWindowSkin(std::string_view preview_token) {
  auto next = skin_service_ ? skin_service_->BindPreviewToWindow(preview_token)
                            : std::nullopt;
  if (!next) {
    return false;
  }
  const auto kept_design = CapturePresentation().surface_design;
  ReleaseWindowSkin();
  surface_design_ = kept_design;
  ClearCustomModeBinding();
  window_skin_binding_ = next;
  const auto* binding = skin_service_->GetWindowBinding(*next);
  requested_window_skin_ =
      WindowSkinReference{binding->skin_id, binding->archive_sha256};
  follows_profile_default_ = false;
  OnWindowSkinBindingsChanged();
  return true;
}

bool WindowModeController::SelectOperationalMode(std::string_view mode_id) {
  if (!skin_service_) {
    return false;
  }
  const auto* manifest = operational_manifest();
  if (!manifest) {
    return false;
  }
  const auto mode = std::ranges::find(manifest->modes, mode_id,
                                     &TahaiOperationalMode::id);
  if (mode == manifest->modes.end()) {
    return false;
  }
  const std::string selected_id = mode->id;
  const std::string title = mode->name;
  if (!window_skin_binding_) {
    const auto next = skin_service_->BindActiveSkinToWindow();
    if (!next) {
      return false;
    }
    window_skin_binding_ = next;
    const auto* binding = skin_service_->GetWindowBinding(*next);
    requested_window_skin_ =
        WindowSkinReference{binding->skin_id, binding->archive_sha256};
  }
  const auto kept_design = CapturePresentation().surface_design;
  DiscardSurfacePreview();
  surface_design_ = kept_design;
  ClearCustomModeBinding();
  active_operational_mode_id_ = selected_id;
  active_operational_mode_title_ = title;
  follows_profile_default_ = false;
  OnWindowSkinBindingsChanged();
  return true;
}

bool WindowModeController::CopyWindowSkinFrom(const WindowModeController& source) {
  if (this == &source) {
    return true;
  }
  if (!skin_service_ || skin_service_.get() != source.skin_service_.get() ||
      (source.requested_window_skin_ && !source.window_skin_binding_)) {
    return false;
  }
  const auto next = source.window_skin_binding_
      ? skin_service_->CopyWindowBinding(*source.window_skin_binding_)
      : skin_service_->BindActiveSkinToWindow();
  if (!next) {
    return false;
  }
  const auto kept_design = CapturePresentation().surface_design;
  ReleaseWindowSkin();
  surface_design_ = kept_design;
  ClearCustomModeBinding();
  window_skin_binding_ = next;
  const auto* binding = skin_service_->GetWindowBinding(*next);
  requested_window_skin_ =
      WindowSkinReference{binding->skin_id, binding->archive_sha256};
  follows_profile_default_ = false;
  OnWindowSkinBindingsChanged();
  return true;
}

void WindowModeController::ReleaseWindowSkin() {
  DiscardSurfacePreview();
  ++window_restore_generation_;
  restoring_window_skin_ = false;
  requested_window_skin_.reset();
  if (skin_service_ && window_skin_binding_) {
    skin_service_->ReleaseWindowBinding(*window_skin_binding_);
  }
  window_skin_binding_.reset();
  active_operational_mode_id_.clear();
  active_operational_mode_title_.clear();
  surface_design_.reset();
  custom_surface_definition_.reset();
}

void WindowModeController::ClearWindowSkin() {
  const auto kept_design = CapturePresentation().surface_design;
  ReleaseWindowSkin();
  surface_design_ = kept_design;
  ClearCustomModeBinding();
  OnWindowSkinBindingsChanged();
}

void WindowModeController::ClearCustomModeBinding() {
  // An explicit appearance change leaves the preset's authority behind, not
  // the person's kept geometry or rail width. Do not retain local_configuration_
  // with an empty custom id: future edits would target a nonexistent preset.
  const int rail_width = active_configuration_.rail_width;
  const std::string rail_state = active_configuration_.rail_state;
  if (local_configuration_) {
    active_configuration_ = mode_service_->configuration_for_mode(active_mode_id_);
    active_configuration_.rail_width = rail_width;
    active_configuration_.rail_state = rail_state;
  }
  local_configuration_ = false;
  workspace_rail_override_ = true;
  follows_profile_default_ = false;
  active_custom_mode_id_.clear();
  active_custom_mode_title_.clear();
  operational_rail_modules_.clear();
  custom_surface_definition_.reset();
}

void WindowModeController::OnWindowSkinBindingsChanged() {
  const auto weak_this = weak_factory_.GetWeakPtr();
  NotifyModeChanged();
  if (!weak_this) {
    return;
  }
  if (auto* view = BrowserView::GetBrowserViewForBrowser(browser_)) {
    if (view->GetWidget()) {
      view->GetWidget()->ThemeChanged();
    }
  }
}

WindowPresentation WindowModeController::CapturePresentation() const {
  return {.fixed_mode = active_mode_id_,
          .rail_state = active_configuration_.rail_state,
          .rail_width = active_configuration_.rail_width,
          .rail_modules = operational_rail_modules_,
          .skin = requested_window_skin_,
          .operational_mode = active_operational_mode_id_,
          .custom_mode = active_custom_mode_id_,
          .configuration = local_configuration_
                               ? ModeService::EncodeConfiguration(active_configuration_)
                               : std::map<std::string, std::string>(),
          .surface_design = surface_preview_ ? surface_preview_->baseline : surface_design_};
}

std::optional<std::string> WindowModeController::SerializePresentation() const {
  auto presentation = CapturePresentation();
  if (!ValidateWindowPresentation(presentation)) {
    return std::nullopt;
  }
  return base::WriteJson(EncodeWindowPresentation(presentation));
}

bool WindowModeController::RestorePresentation(
    const WindowPresentation& presentation) {
  if (!(browser_->GetType() == BrowserWindowInterface::Type::TYPE_NORMAL) ||
      !browser_->GetProfile()->IsRegularProfile() ||
      browser_->GetProfile()->IsOffTheRecord() ||
      !ValidateWindowPresentation(presentation)) {
    return false;
  }
  ReleaseWindowSkin();
  active_mode_id_ = presentation.fixed_mode;
  active_configuration_ = mode_service_->configuration_for_mode(active_mode_id_);
  local_configuration_ = !presentation.configuration.empty();
  if (local_configuration_) {
    active_configuration_ = *ModeService::DecodeConfiguration(
        presentation.fixed_mode, presentation.configuration);
  }
  active_configuration_.rail_state = presentation.rail_state;
  active_configuration_.rail_width = presentation.rail_width;
  operational_rail_modules_ = presentation.rail_modules;
  surface_design_ = presentation.surface_design;
  requested_window_skin_ = presentation.skin;
  active_operational_mode_id_ = presentation.operational_mode;
  active_custom_mode_id_ = presentation.custom_mode;
  active_custom_mode_title_.clear();
  const auto custom = std::ranges::find(mode_service_->custom_modes(),
                                       active_custom_mode_id_,
                                       &TahaiCustomModeDefinition::id);
  if (custom != mode_service_->custom_modes().end() && custom->native_presentation) {
    custom_surface_definition_ = custom->native_presentation->surface_design;
  }
  follows_profile_default_ = false;
  workspace_rail_override_ = true;
  restoring_window_skin_ = presentation.skin.has_value() && skin_service_;
  const uint64_t generation = window_restore_generation_;
  RefreshRestoredModeTitles();
  const auto weak_this = weak_factory_.GetWeakPtr();
  OnWindowSkinBindingsChanged();
  if (!weak_this) {
    return false;
  }
  // An observer may have applied a newer appearance while handling the update.
  // Do not start the superseded skin restore or report it as the current mode.
  if (window_restore_generation_ != generation ||
      CapturePresentation() != presentation) {
    return false;
  }
  if (!restoring_window_skin_) {
    return true;
  }
  // The callback still runs after the window closes, so a newly issued service
  // token is released rather than leaked when its intended owner has gone.
  skin_service_->RestoreWindowSkin(
      presentation.skin->id, presentation.skin->archive_sha256,
      base::BindOnce(
          [](base::WeakPtr<WindowModeController> controller,
             base::WeakPtr<skins::SkinProfileService> service,
             uint64_t expected_generation,
             std::optional<base::UnguessableToken> token) {
            if (!controller ||
                controller->window_restore_generation_ != expected_generation) {
              if (service && token) {
                service->ReleaseWindowBinding(*token);
              }
              return;
            }
            controller->restoring_window_skin_ = false;
            controller->window_skin_binding_ = token;
            controller->RefreshRestoredModeTitles();
            controller->OnWindowSkinBindingsChanged();
          },
          weak_factory_.GetWeakPtr(), skin_service_, generation));
  return true;
}

void WindowModeController::RefreshRestoredModeTitles() {
  active_operational_mode_title_.clear();
  active_custom_mode_title_.clear();
  const auto custom = std::ranges::find(mode_service_->custom_modes(),
                                       active_custom_mode_id_,
                                       &TahaiCustomModeDefinition::id);
  if (custom != mode_service_->custom_modes().end() && custom->native_presentation) {
    if (active_operational_mode_id_.empty() &&
        custom->native_presentation->fixed_mode == active_mode_id_ &&
        custom->native_presentation->skin == requested_window_skin_) {
      active_custom_mode_title_ = custom->title;
    }
    return;
  }
  const auto* manifest = operational_manifest();
  if (!manifest || active_operational_mode_id_.empty()) {
    return;
  }
  const auto mode = std::ranges::find(manifest->modes, active_operational_mode_id_,
                                     &TahaiOperationalMode::id);
  if (mode == manifest->modes.end()) {
    return;
  }
  active_operational_mode_title_ = mode->name;
  if (custom != mode_service_->custom_modes().end() &&
      custom->operational_mode_id == active_operational_mode_id_ &&
      custom->operational_skin && custom->operational_skin == requested_window_skin_) {
    active_custom_mode_title_ = custom->title;
  }
}

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
WindowModeController* WindowModeController::GetForBrowser(
    BrowserWindowInterface* browser) {
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

std::string_view WindowModeController::active_mode_title() const {
  if (restoring_window_skin_) {
    return "Restoring skin";
  }
  if (requested_window_skin_ && !window_skin_palette()) {
    return "Unavailable skin";
  }
  if ((!active_operational_mode_id_.empty() &&
       active_operational_mode_title_.empty()) ||
      (!active_custom_mode_id_.empty() && active_custom_mode_title_.empty())) {
    return "Unavailable mode";
  }
  if (active_custom_mode_title_.empty() && !active_operational_mode_title_.empty()) {
    return active_operational_mode_title_;
  }
  return active_custom_mode_title_.empty()
             ? active_mode().title
             : std::string_view(active_custom_mode_title_);
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
  if (active_mode_id_ == definition->id && !workspace_rail_override_ &&
      active_custom_mode_id_.empty() && operational_rail_modules_.empty() &&
      !window_skin_binding_ && !requested_window_skin_ && !local_configuration_ &&
      !surface_design_) {
    NotifyModeChanged();
    return true;
  }
  workspace_rail_override_ = false;
  local_configuration_ = false;
  ReleaseWindowSkin();
  active_custom_mode_id_.clear();
  active_custom_mode_title_.clear();
  operational_rail_modules_.clear();
  active_mode_id_ = std::string(definition->id);
  active_configuration_ =
      mode_service_->configuration_for_mode(active_mode_id_);
  OnWindowSkinBindingsChanged();
  return true;
}

bool WindowModeController::SetCustomModePresentation(
    std::string_view custom_mode_id) {
  const auto custom = std::ranges::find(
      mode_service_->custom_modes(), custom_mode_id,
      &TahaiCustomModeDefinition::id);
  if (custom == mode_service_->custom_modes().end()) {
    return false;
  }
  if (custom->native_presentation &&
      (!active_operational_mode_id_.empty() ||
       custom->native_presentation->fixed_mode != active_mode_id_ ||
       custom->native_presentation->skin != requested_window_skin_)) {
    return false;
  }
  if (!custom->native_presentation &&
      (!custom->operational_skin || !operational_manifest() ||
       custom->operational_mode_id != active_operational_mode_id_ ||
       custom->operational_skin != requested_window_skin_)) {
    return false;
  }
  follows_profile_default_ = false;
  if (custom->native_presentation) {
    DiscardSurfacePreview();
    active_configuration_ = *ModeService::DecodeConfiguration(
        custom->native_presentation->fixed_mode,
        custom->native_presentation->configuration);
    local_configuration_ = true;
    workspace_rail_override_ = true;
    surface_design_ = custom->native_presentation->surface_design;
    custom_surface_definition_ = surface_design_;
  }
  if (active_custom_mode_id_ == custom->id &&
      active_custom_mode_title_ == custom->title) {
    NotifyModeChanged();
    return true;
  }
  active_custom_mode_id_ = custom->id;
  active_custom_mode_title_ = custom->title;
  NotifyModeChanged();
  return true;
}

bool WindowModeController::SetOperationalRailModules(
    std::vector<std::string> module_ids) {
  if (module_ids.size() > 5u ||
      std::any_of(module_ids.begin(), module_ids.end(),
                  [](const std::string& module_id) {
                    return !IsOperationalRailModule(module_id);
                  }) ||
      std::any_of(module_ids.begin(), module_ids.end(),
                  [&module_ids](const std::string& module_id) {
                    return std::count(module_ids.begin(), module_ids.end(),
                                      module_id) != 1;
                  })) {
    return false;
  }
  if (operational_rail_modules_ == module_ids) {
    return true;
  }
  operational_rail_modules_ = std::move(module_ids);
  NotifyModeChanged();
  return true;
}

bool WindowModeController::SetSurfaceDesign(std::optional<SurfaceDesign> design) {
  if (design && !ValidateSurfaceDesign(*design)) {
    return false;
  }
  const bool was_preview = surface_preview_.has_value();
  DiscardSurfacePreview();
  if (surface_design_ != design || was_preview) {
    surface_design_ = std::move(design);
    follows_profile_default_ = false;
    NotifyModeChanged();
  }
  return true;
}

std::optional<base::UnguessableToken> WindowModeController::BeginSurfacePreview(
    SurfaceDesign design) {
  if (!ValidateSurfaceDesign(design) ||
      !(browser_->GetType() == BrowserWindowInterface::Type::TYPE_NORMAL) ||
      !browser_->GetProfile()->IsRegularProfile() ||
      browser_->GetProfile()->IsOffTheRecord()) {
    return std::nullopt;
  }
  const auto tabs = SurfaceTabs();
  if (tabs.size() != static_cast<size_t>(SurfacePaneCount(design))) {
    return std::nullopt;
  }
  const auto token = base::UnguessableToken::Create();
  // Replacing a trial retains the original baseline, not the last trial.
  surface_preview_ = SurfacePreview{
      token, surface_preview_ ? surface_preview_->baseline : surface_design_, tabs};
  surface_design_ = std::move(design);
  surface_preview_timer_.Start(FROM_HERE, base::Seconds(30), base::BindOnce(
      [](base::WeakPtr<WindowModeController> controller,
         base::UnguessableToken expected) {
        if (controller) {
          controller->CancelSurfacePreview(expected);
        }
      }, weak_factory_.GetWeakPtr(), token));
  NotifyModeChanged();
  return token;
}

bool WindowModeController::IsSurfacePreviewCurrent(
    const base::UnguessableToken& token) const {
  return surface_preview_ && surface_preview_->token == token;
}

bool WindowModeController::CommitSurfacePreview(
    const base::UnguessableToken& token) {
  if (!IsSurfacePreviewCurrent(token)) {
    return false;
  }
  if (surface_preview_->tabs != SurfaceTabs()) {
    CancelSurfacePreview(token);
    return false;
  }
  DiscardSurfacePreview();
  follows_profile_default_ = false;
  NotifyModeChanged();
  return true;
}

bool WindowModeController::CancelSurfacePreview(
    const base::UnguessableToken& token) {
  if (!IsSurfacePreviewCurrent(token)) {
    return false;
  }
  surface_design_ = surface_preview_->baseline;
  DiscardSurfacePreview();
  NotifyModeChanged();
  return true;
}

void WindowModeController::DiscardSurfacePreview() {
  surface_preview_timer_.Stop();
  surface_preview_.reset();
}

std::vector<tabs::TabHandle> WindowModeController::SurfaceTabs() const {
  auto* view = BrowserView::GetBrowserViewForBrowser(browser_);
  auto* contents = view ? view->multi_contents_view() : nullptr;
  std::vector<tabs::TabHandle> handles;
  if (contents) {
    for (const auto& pane : contents->contents_container_views()) {
      if (auto* web_contents = pane->contents_view()->web_contents()) {
        auto* tab = tabs::TabInterface::GetFromContents(web_contents);
        if (!tab) {
          return {};
        }
        handles.push_back(tab->GetHandle());
      }
    }
  }
  return handles;
}

bool WindowModeController::SetSurfaceDividerPercent(int node, int percent) {
  if (!surface_design_ || node < 0 ||
      static_cast<size_t>(node) >= surface_design_->nodes.size() ||
      surface_design_->nodes[node].kind == SurfaceNodeKind::kPane ||
      percent < 10 || percent > 90) {
    return false;
  }
  surface_design_->nodes[node].percent = percent;
  NotifyModeChanged(/*preserve_surface_resize=*/true);
  return true;
}

bool WindowModeController::MakeActiveModeProfileDefault() {
  // Once made the default, this window intentionally follows subsequent
  // profile-default changes again. Other windows keep their local choice.
  const bool had_custom_presentation = !active_custom_mode_id_.empty() ||
                                       !operational_rail_modules_.empty() ||
                                       requested_window_skin_.has_value() ||
                                       local_configuration_ || surface_design_;
  ReleaseWindowSkin();
  follows_profile_default_ = true;
  local_configuration_ = false;
  workspace_rail_override_ = false;
  active_configuration_ = mode_service_->configuration_for_mode(active_mode_id_);
  active_custom_mode_id_.clear();
  active_custom_mode_title_.clear();
  operational_rail_modules_.clear();
  const auto weak_this = weak_factory_.GetWeakPtr();
  const bool changed = mode_service_->SetActiveMode(active_mode_id_);
  // SetActiveMode() legitimately has no observer notification if this was
  // already the profile default. The visible custom label still changed.
  if (weak_this && changed && had_custom_presentation) {
    OnWindowSkinBindingsChanged();
  }
  return changed;
}

bool WindowModeController::SetActiveConfigurationValue(std::string_view key,
                                                       std::string_view value) {
  if (local_configuration_ && key != "rail_state" && key != "rail_width") {
    return mode_service_->SetNativeCustomModeConfiguration(
        active_custom_mode_id_, key, value);
  }
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

bool WindowModeController::ResetActiveConfiguration() {
  if (!local_configuration_) {
    return mode_service_->ResetConfigurationForMode(active_mode_id_);
  }
  const auto weak_this = weak_factory_.GetWeakPtr();
  const std::string custom_id = active_custom_mode_id_;
  if (!mode_service_->ResetNativeCustomModeConfiguration(custom_id) ||
      !weak_this || !local_configuration_ ||
      active_custom_mode_id_ != custom_id) {
    return false;
  }
  const auto custom = std::ranges::find(mode_service_->custom_modes(),
                                       active_custom_mode_id_,
                                       &TahaiCustomModeDefinition::id);
  if (custom == mode_service_->custom_modes().end() || !custom->native_presentation) {
    return false;
  }
  active_configuration_ = *ModeService::DecodeConfiguration(active_mode_id_,
                              custom->native_presentation->configuration);
  NotifyModeChanged();
  return true;
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
  const bool changed = active_mode_id_ != mode_id ||
                       active_configuration_ != next ||
                       !active_custom_mode_id_.empty() ||
                       !operational_rail_modules_.empty() ||
                       !active_operational_mode_id_.empty() ||
                       restoring_window_skin_ || surface_design_.has_value();
  if (restoring_window_skin_) {
    ReleaseWindowSkin();
  }
  active_mode_id_ = mode_id;
  active_custom_mode_id_.clear();
  active_custom_mode_title_.clear();
  active_operational_mode_id_.clear();
  active_operational_mode_title_.clear();
  operational_rail_modules_.clear();
  surface_design_.reset();
  custom_surface_definition_.reset();
  DiscardSurfacePreview();
  active_configuration_ = std::move(next);
  follows_profile_default_ = false;
  workspace_rail_override_ = true;
  local_configuration_ = false;
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
  if (active_mode_id_ == profile_mode_id && active_custom_mode_id_.empty()) {
    return;
  }
  workspace_rail_override_ = false;
  local_configuration_ = false;
  active_custom_mode_id_.clear();
  active_custom_mode_title_.clear();
  operational_rail_modules_.clear();
  active_mode_id_ = profile_mode_id;
  active_configuration_ =
      mode_service_->configuration_for_mode(active_mode_id_);
  NotifyModeChanged();
}

void WindowModeController::OnTahaiModeConfigurationChanged() {
  // Keep a missing or revoked reference visibly unavailable. Falling back to
  // the built-in action set here would silently broaden a deleted custom mode.
  // Always notify for an active custom mode: actions may change without a rename.
  const bool custom_presentation_changed = !active_custom_mode_id_.empty();
  if (custom_presentation_changed) {
    RefreshRestoredModeTitles();
  }
  auto next = local_configuration_ ? active_configuration_
                                  : mode_service_->configuration_for_mode(active_mode_id_);
  if (local_configuration_) {
    const auto custom = std::ranges::find(mode_service_->custom_modes(),
                                         active_custom_mode_id_,
                                         &TahaiCustomModeDefinition::id);
    if (custom != mode_service_->custom_modes().end() &&
        custom->native_presentation &&
        custom->native_presentation->fixed_mode == active_mode_id_) {
      if (custom->native_presentation->surface_design != custom_surface_definition_) {
        DiscardSurfacePreview();
        custom_surface_definition_ = custom->native_presentation->surface_design;
        surface_design_ = custom_surface_definition_;
      }
      next = *ModeService::DecodeConfiguration(active_mode_id_,
                           custom->native_presentation->configuration);
      // Dragging/collapsing the rail is still a per-window operation even
      // when two windows use the same saved custom definition.
      next.rail_state = active_configuration_.rail_state;
      next.rail_width = active_configuration_.rail_width;
    }
  } else if (workspace_rail_override_) {
    next.rail_state = active_configuration_.rail_state;
    next.rail_width = active_configuration_.rail_width;
  }
  if (next == active_configuration_ && !custom_presentation_changed) {
    return;
  }
  active_configuration_ = next;
  NotifyModeChanged();
}

void WindowModeController::NotifyModeChanged(bool preserve_surface_resize) {
  // An observer may apply a replacement mode. Chromium's ObserverList forbids
  // recursive iteration; deliver the latest presentation on a later UI task.
  if (notifying_mode_change_) {
    if (!mode_notification_pending_) {
      mode_notification_pending_ = true;
      base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
          FROM_HERE,
          base::BindOnce(
              [](base::WeakPtr<WindowModeController> controller) {
                if (controller && controller->mode_notification_pending_) {
                  controller->NotifyModeChanged();
                }
              },
              weak_factory_.GetWeakPtr()));
    }
    return;
  }
  mode_notification_pending_ = false;
  notifying_mode_change_ = true;
  const auto weak_this = weak_factory_.GetWeakPtr();
  if (auto* view = BrowserView::GetBrowserViewForBrowser(browser_)) {
    if (auto* contents = view->multi_contents_view()) {
      contents->SetTahaiSurfaceDesign(surface_design_, preserve_surface_resize);
    }
  }
  if (!weak_this) {
    return;
  }
  if ((browser_->GetType() == BrowserWindowInterface::Type::TYPE_NORMAL) &&
      browser_->GetProfile()->IsRegularProfile() &&
      !browser_->GetProfile()->IsOffTheRecord()) {
    if (auto* session = SessionServiceFactory::GetForProfileIfExisting(
            browser_->GetProfile())) {
      if (auto json = SerializePresentation()) {
        session->AddWindowExtraData(browser_->GetSessionID(),
                                    kWindowPresentationSessionKey, *json);
      }
    }
  }
  for (Observer& observer : observers_) {
    observer.OnTahaiWindowModeChanged();
    if (!weak_this) {
      return;
    }
  }
  notifying_mode_change_ = false;
}

}  // namespace tahai
