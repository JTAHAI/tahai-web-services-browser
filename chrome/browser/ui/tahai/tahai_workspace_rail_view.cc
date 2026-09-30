// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_workspace_rail_view.h"

#include <algorithm>
#include <array>
#include <iterator>
#include <limits>
#include <optional>
#include <ranges>
#include <span>
#include <string_view>

#include "base/check.h"
#include "base/functional/bind.h"
#include "base/numerics/clamped_math.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/app/vector_icons/vector_icons.h"
#include "chrome/browser/tahai_skins/skin_profile_service.h"
#include "chrome/browser/tahai_skins/skin_profile_service_factory.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"
#include "components/vector_icons/vector_icons.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/models/image_model.h"
#include "ui/color/color_provider.h"
#include "ui/events/event.h"
#include "ui/gfx/geometry/insets.h"
#include "ui/gfx/geometry/size.h"
#include "ui/native_theme/native_theme.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/background.h"
#include "ui/views/border.h"
#include "ui/views/controls/button/label_button.h"
#include "ui/views/controls/focus_ring.h"
#include "ui/views/controls/image_view.h"
#include "ui/views/controls/label.h"
#include "ui/views/controls/resize_area.h"
#include "ui/views/controls/scroll_view.h"
#include "ui/views/controls/scrollbar/overlay_scroll_bar.h"
#include "ui/views/focus/focus_manager.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/view_class_properties.h"
#include "ui/views/widget/widget.h"

namespace tahai {
namespace {

constexpr int kCollapsedRailWidth = 48;
constexpr int kMinimumExpandedRailWidth = 220;
constexpr int kMaximumExpandedRailWidth = 480;
constexpr int kResizeHandleWidth = 8;
constexpr std::array<int, 4> kExpandedRailWidthPresets = {220, 280, 360, 480};

struct RailPresentation {
  std::array<std::string_view, kMaximumNativeModeActions> module_ids;
  std::array<std::u16string_view, kMaximumNativeModeActions> modules;
  std::array<const gfx::VectorIcon*, kMaximumNativeModeActions> icons;
  std::u16string_view context;
  size_t module_count = 5u;
};

struct OperationalRailModule {
  std::string_view id;
  std::u16string_view label;
  raw_ptr<const gfx::VectorIcon> icon;
};

constexpr std::array<OperationalRailModule, 9> kOperationalRailModules = {{
    {"tabs", u"Tabs", &kTabIcon},
    {"saved-workspaces", u"Saved workspaces", &vector_icons::kFolderOpenIcon},
    {"bookmarks", u"Bookmarks", &kBookmarkManagerIcon},
    {"history", u"History", &vector_icons::kHistoryIcon},
    {"downloads", u"Downloads", &vector_icons::kDownloadIcon},
    {"mission", u"Mission Control", &kMenuBookIcon},
    {"local-oi", u"Local OI", &vector_icons::kScienceIcon},
    {"command-center", u"Command Center", &vector_icons::kChecklistIcon},
    {"guard", u"Guard", &vector_icons::kSettingsIcon},
}};

// A rail entry must lead to a browser-owned action. The rail is a companion
// surface, not an imitation of a complete independent application. Grouping
// new workflow modules behind the existing TAHAI surfaces keeps navigation,
// policy checks, and target selection in the browser command controller.
struct ModuleAction {
  int command_id;
  std::u16string_view title;
  std::u16string_view summary;
};

ModuleAction GetModuleAction(std::string_view module_id) {
  if (auto native = FindNativeModeAction(module_id)) {
    return {native->command_id, native->label,
            u"Runs this mode's native control in this window only when selected."};
  }
  if (module_id == "tabs" || module_id == "canvas-tabs" ||
      module_id == "environment-tabs" || module_id == "case-tabs") {
    return {IDC_TAB_SEARCH, u"Open tab search",
            u"Find, switch, and manage tabs in this browser window."};
  }
  if (module_id == "saved-workspaces") {
    return {IDC_TAHAI_NAMED_WORKSPACES, u"Open saved workspaces",
            u"Save and reopen named workspaces in this browser profile."};
  }
  if (module_id == "bookmarks") {
    return {IDC_SHOW_BOOKMARK_MANAGER, u"Open bookmark manager",
            u"Manage this profile's bookmarks with Chromium's bookmark tools."};
  }
  if (module_id == "history" || module_id == "workspace-search-history") {
    return {IDC_SHOW_HISTORY, u"Open history",
            u"Review browser history using Chromium's history surface."};
  }
  if (module_id == "downloads" || module_id == "build-downloads") {
    return {IDC_SHOW_DOWNLOADS, u"Open downloads",
            u"Review downloads using Chromium's download surface."};
  }
  if (module_id == "devtools-targets") {
    return {IDC_DEV_TOOLS, u"Open Developer Tools",
            u"Open Chromium Developer Tools for the active page."};
  }
  if (module_id == "local-oi" || module_id == "pane-health" ||
      module_id == "evidence-markers" || module_id == "mission-timeline") {
    return {IDC_TAHAI_LOCAL_OI, u"Open Local OI",
            u"Review local readiness, evidence markers, and generated "
            u"operational memory for this profile."};
  }
  if (module_id == "mission" || module_id == "active-runbook" || module_id == "incident-workspaces") {
    return {IDC_TAHAI_MISSION_CONTROL, u"Open Mission Control",
            u"Open the browser-owned mission workspace for this window."};
  }
  if (module_id == "case-checklist" || module_id == "diagnostics" ||
      module_id == "captures" || module_id == "handoff-preview") {
    return {IDC_TAHAI_SUPPORT, u"Open Support Desk",
            u"Open the browser-owned support workspace for this window."};
  }
  if (module_id == "command-center" || module_id == "notes") {
    return {IDC_TAHAI_COMMAND_CENTER, u"Open Command Center",
            u"Notes do not have a separate editor yet. This opens Command "
            u"Center, where available browser work tools are listed."};
  }
  if (module_id == "sources" || module_id == "outline" || module_id == "pdfs") {
    return {IDC_TAHAI_COMMAND_CENTER, u"Open Command Center",
            u"This research label opens Command Center. A separate source, "
            u"outline, or PDF tool is not available yet."};
  }
  if (module_id == "references" || module_id == "assets" ||
      module_id == "preview-sizes" || module_id == "publish-checklist") {
    return {IDC_TAHAI_COMMAND_CENTER, u"Open Command Center",
            u"This creator label opens Command Center. A separate creator "
            u"tool is not available yet."};
  }
  if (module_id == "host-groups" || module_id == "release-checklist") {
    return {IDC_TAHAI_COMMAND_CENTER, u"Open Command Center",
            u"This build label opens Command Center. A separate build tool "
            u"is not available yet."};
  }
  if (module_id == "guard") {
    return {IDC_TAHAI_GUARD_PANEL, u"Open Guard",
            u"Open the browser-owned Guard control surface."};
  }
  return {IDC_TAHAI_COMMAND_CENTER, u"Open Command Center",
          u"Open Command Center for the browser tools available in this "
          u"profile."};
}

RailPresentation GetRailPresentation(std::string_view mode_id) {
  if (mode_id == "creator") {
    return {{"canvas-tabs", "references", "assets", "preview-sizes",
             "publish-checklist"},
            {u"Canvas tabs", u"References", u"Assets", u"Preview sizes",
             u"Publish checklist"},
            {&kTabIcon, &kMenuBookIcon, &vector_icons::kPhotoIcon,
             &kResizeWindowIcon, &vector_icons::kChecklistIcon},
            u"Design and publishing"};
  }
  if (mode_id == "builder") {
    return {{"environment-tabs", "devtools-targets", "host-groups",
             "build-downloads", "release-checklist"},
            {u"Environment tabs", u"DevTools targets", u"Host groups",
             u"Build downloads", u"Release checklist"},
            {&kTabIcon, &vector_icons::kCodeIcon,
             &vector_icons::kSettingsEthernetIcon, &vector_icons::kDownloadIcon,
             &vector_icons::kChecklistIcon},
            u"Build and release"};
  }
  if (mode_id == "operator") {
    return {{"active-runbook", "mission-timeline", "pane-health",
             "evidence-markers", "incident-workspaces"},
            {u"Active runbook", u"Mission timeline", u"Pane health",
             u"Evidence markers", u"Incident workspaces"},
            {&kMenuBookIcon, &vector_icons::kReceiptLongIcon,
             &vector_icons::kScienceIcon, &vector_icons::kDescriptionIcon,
             &vector_icons::kFolderOpenIcon},
            u"Technical operations"};
  }
  if (mode_id == "research") {
    return {{"sources", "notes", "outline", "pdfs", "workspace-search-history"},
            {u"Sources", u"Notes", u"Outline", u"PDFs", u"Workspace history"},
            {&vector_icons::kSearchIcon, &vector_icons::kEditIcon,
             &vector_icons::kChecklistIcon, &vector_icons::kDescriptionIcon,
             &vector_icons::kHistoryIcon},
            u"Sources and analysis"};
  }
  if (mode_id == "support") {
    return {
        {"case-checklist", "case-tabs", "diagnostics", "captures",
         "handoff-preview"},
        {u"Case checklist", u"Case tabs", u"Diagnostics", u"Captures",
         u"Handoff preview"},
        {&vector_icons::kChecklistIcon, &kTabIcon, &vector_icons::kSettingsIcon,
         &vector_icons::kPhotoIcon, &vector_icons::kContentCopyIcon},
        u"Case resolution"};
  }
  return {{"tabs", "saved-workspaces", "bookmarks", "history", "downloads"},
          {u"Tabs and groups", u"Saved workspaces", u"Bookmarks", u"History",
           u"Downloads"},
          {&kTabIcon, &vector_icons::kFolderOpenIcon, &kBookmarkManagerIcon,
           &vector_icons::kHistoryIcon, &vector_icons::kDownloadIcon},
          u"Personal browsing"};
}

RailPresentation GetRailPresentation(
    std::string_view mode_id,
    const std::vector<std::string>& operational_modules) {
  RailPresentation presentation = GetRailPresentation(mode_id);
  if (operational_modules.empty()) {
    return presentation;
  }
  presentation.context = u"Custom operational surface";
  presentation.module_count = operational_modules.size();
  for (size_t index = 0; index < operational_modules.size(); ++index) {
    const auto found = std::ranges::find(
        kOperationalRailModules, operational_modules[index],
        &OperationalRailModule::id);
    CHECK(found != kOperationalRailModules.end());
    presentation.module_ids[index] = found->id;
    presentation.modules[index] = found->label;
    presentation.icons[index] = found->icon;
  }
  return presentation;
}

RailPresentation GetWindowRailPresentation(WindowModeController* controller) {
  const auto actions = ResolveOperationalWindowActions(controller->browser());
  if (actions && (actions->actions.empty() ||
                   controller->active_operational_mode_id().empty())) {
    RailPresentation presentation{};
    presentation.module_count = 0;
    presentation.context = actions->actions.empty()
        ? u"Mode controls unavailable; choose a mode from the toolbar"
        : u"Mode controls; all controls are also available in Finder";
    for (const auto& action : actions->actions) {
      const auto catalog = GetNativeModeActionCatalog();
      const auto native = std::ranges::find(catalog, action.command_id,
                                            &NativeModeActionDefinition::command_id);
      if (native == catalog.end()) {
        continue;
      }
      const size_t index = presentation.module_count++;
      presentation.module_ids[index] = native->id;
      presentation.modules[index] = native->label;
      presentation.icons[index] = &vector_icons::kChecklistIcon;
      if (presentation.module_count == presentation.module_ids.size()) {
        break;
      }
    }
    return presentation;
  }
  return GetRailPresentation(controller->active_mode_id(),
                              controller->operational_rail_modules());
}

bool CanRunRailModule(WindowModeController* controller, std::string_view id) {
  const auto presentation = GetWindowRailPresentation(controller);
  const auto available = std::span(presentation.module_ids).first(presentation.module_count);
  if (std::ranges::find(available, id) == available.end()) {
    return false;
  }
  if (const auto native = FindNativeModeAction(id)) {
    const auto actions = ResolveOperationalWindowActions(controller->browser());
    return actions && CanExecuteWindowModeAction(controller->browser(), actions->context,
                                                  native->command_id);
  }
  return chrome::IsCommandEnabled(controller->browser(), GetModuleAction(id).command_id);
}

}  // namespace

// A physical press belongs to the control shown when it began. Rebinding the
// same button slot during that press cannot turn release into a different
// action. Accessibility activation without a preceding press uses current UI.
class WorkspaceRailActionButton : public views::LabelButton {
  METADATA_HEADER(WorkspaceRailActionButton, views::LabelButton)

 public:
  WorkspaceRailActionButton(PressedCallback callback,
                            base::RepeatingCallback<uint64_t()> generation)
      : LabelButton(std::move(callback), u""), generation_(std::move(generation)) {
    SetInstallFocusRingOnFocus(true);
    // Keep keyboard focus inside the clipped viewport, including the 48-pixel
    // icon rail. Do not consume the 36-pixel native control's hit target.
    views::FocusRing::Get(this)->SetOutsetFocusRingDisabled(true);
    views::FocusRing::Get(this)->SetHaloInset(2);
  }

  bool OnMousePressed(const ui::MouseEvent& event) override {
    armed_generation_ = generation_.Run();
    return LabelButton::OnMousePressed(event);
  }

  bool OnKeyPressed(const ui::KeyEvent& event) override {
    if (event.key_code() == ui::VKEY_SPACE ||
        event.key_code() == ui::VKEY_RETURN) {
      // A held activation key is one gesture, not fresh consent to whichever
      // control a mode change puts under it. Enter dispatches on key-down on
      // Windows, so retaining only the release guard would miss its repeats.
      if (event.is_repeat()) {
        return true;
      }
      armed_generation_ = generation_.Run();
    }
    return LabelButton::OnKeyPressed(event);
  }

  void OnGestureEvent(ui::GestureEvent* event) override {
    if (event->type() == ui::EventType::kGestureTapDown) {
      armed_generation_ = generation_.Run();
    }
    LabelButton::OnGestureEvent(event);
  }

 protected:
  void NotifyClick(const ui::Event& event) override {
    const bool current = !armed_generation_ ||
        (!event.IsMouseEvent() && !event.IsKeyEvent() && !event.IsGestureEvent()) ||
        *armed_generation_ == generation_.Run();
    armed_generation_.reset();
    if (current) {
      // The callback may destroy this button/window. Do not access members
      // after forwarding the activation.
      LabelButton::NotifyClick(event);
    }
  }

 private:
  base::RepeatingCallback<uint64_t()> generation_;
  std::optional<uint64_t> armed_generation_;
};

BEGIN_METADATA(WorkspaceRailActionButton)
END_METADATA

// Own one physical gesture. The generic ResizeArea's capture-loss callback
// converts its initial screen coordinate a second time, so retain the last
// real delta. A mode/preset/dock change cancels the gesture rather than letting
// its later events resize the new presentation.
class WorkspaceRailResizeArea : public views::ResizeArea,
                                private views::ResizeAreaDelegate {
  METADATA_HEADER(WorkspaceRailResizeArea, views::ResizeArea)

 public:
  explicit WorkspaceRailResizeArea(WorkspaceRailView* rail)
      : ResizeArea(this), rail_(rail) {}

  void Cancel() {
    active_ = false;
    last_amount_ = 0;
  }

  bool OnMousePressed(const ui::MouseEvent& event) override {
    if (!ResizeArea::OnMousePressed(event)) {
      return false;
    }
    return Begin();
  }

  bool OnMouseDragged(const ui::MouseEvent& event) override {
    return active_ && ResizeArea::OnMouseDragged(event);
  }

  void OnMouseReleased(const ui::MouseEvent& event) override {
    ResizeArea::OnMouseReleased(event);
    if (active_) {
      OnResize(last_amount_, true);
    }
  }

  void OnMouseCaptureLost() override {
    capture_lost_ = true;
    ResizeArea::OnMouseCaptureLost();
    capture_lost_ = false;
  }

  void OnGestureEvent(ui::GestureEvent* event) override {
    if (event->type() == ui::EventType::kGestureTapDown && !Begin()) {
      return;
    }
    ResizeArea::OnGestureEvent(event);
    if (event->type() == ui::EventType::kGestureEnd && active_) {
      OnResize(last_amount_, true);
    }
  }

 private:
  bool Begin() {
    Cancel();
    active_ = rail_->BeginResize();
    if (active_) {
      window_bounds_ = GetWidget()->GetWindowBoundsInScreen();
    }
    return active_;
  }

  void OnResize(int amount, bool done) override {
    if (!active_) {
      return;
    }
    if (!GetWidget() ||
        window_bounds_ != GetWidget()->GetWindowBoundsInScreen()) {
      // A window move/resize invalidates screen-coordinate deltas. Restore
      // the last committed width without writing to the new geometry.
      rail_->OnTahaiWindowModeChanged();
      return;
    }
    if (capture_lost_) {
      amount = last_amount_;
    }
    last_amount_ = amount;
    active_ = !done;
    rail_->OnResize(amount, done);
  }

  const raw_ptr<WorkspaceRailView> rail_;
  gfx::Rect window_bounds_;
  bool active_ = false;
  bool capture_lost_ = false;
  int last_amount_ = 0;
};

BEGIN_METADATA(WorkspaceRailResizeArea)
END_METADATA

WorkspaceRailView::WorkspaceRailView(WindowModeController* mode_controller)
    : mode_controller_(mode_controller) {
  CHECK(mode_controller_);
  SetBackground(views::CreateSolidBackground(kColorToolbar));
  auto* layout = SetLayoutManager(std::make_unique<views::BoxLayout>(
      views::BoxLayout::Orientation::kVertical, gfx::Insets::VH(8, 6), 6));
  layout->set_cross_axis_alignment(
      views::BoxLayout::CrossAxisAlignment::kStretch);

  body_scroll_ = AddChildView(std::make_unique<views::ScrollView>());
  body_scroll_->SetHorizontalScrollBarMode(
      views::ScrollView::ScrollBarMode::kDisabled);
  // Bound the plain contents view so ScrollView lays out its preferred height
  // within the rail's flex allocation. Overlay scrollbars preserve the full
  // 36-pixel hit target in the collapsed rail on every Windows scrollbar style.
  body_scroll_->SetVerticalScrollBar(std::make_unique<views::OverlayScrollBar>(
      views::ScrollBar::Orientation::kVertical));
  body_scroll_->ClipHeightTo(0, std::numeric_limits<int>::max());
  body_scroll_->SetDrawOverflowIndicator(true);
  body_scroll_->SetAllowKeyboardScrolling(true);
  body_scroll_->GetViewAccessibility().SetName(
      u"Workspace controls; scroll for more");
  layout->SetFlexForView(body_scroll_, 1);
  body_ = body_scroll_->SetContents(std::make_unique<views::View>());
  auto* body_layout = body_->SetLayoutManager(std::make_unique<views::BoxLayout>(
      views::BoxLayout::Orientation::kVertical, gfx::Insets(), 6));
  body_layout->set_cross_axis_alignment(
      views::BoxLayout::CrossAxisAlignment::kStretch);
  mode_label_ = body_->AddChildView(std::make_unique<views::Label>());
  mode_context_label_ = body_->AddChildView(std::make_unique<views::Label>());
  decoration_ = body_->AddChildView(std::make_unique<views::ImageView>());
  decoration_->SetCanProcessEventsWithinSubtree(false);
  decoration_->GetViewAccessibility().SetIsIgnored(true);
  decoration_->SetVisible(false);
  collapse_button_ = AddChildView(std::make_unique<views::LabelButton>(
      base::BindRepeating(&WorkspaceRailView::ToggleCollapsed,
                          base::Unretained(this)),
      u""));
  // Expansion and hiding remain outside the scrolling contents.
  ReorderChildView(collapse_button_, 0);
  width_button_ = AddChildView(std::make_unique<views::LabelButton>(
      base::BindRepeating(&WorkspaceRailView::CyclePreferredWidth,
                          base::Unretained(this)),
      u""));
  ReorderChildView(width_button_, 1);
  for (size_t index = 0; index < module_buttons_.size(); ++index) {
    module_buttons_[index] = body_->AddChildView(std::make_unique<WorkspaceRailActionButton>(
        base::BindRepeating(&WorkspaceRailView::ActivateModule,
                            base::Unretained(this), index),
        base::BindRepeating([](WorkspaceRailView* rail) {
          return rail->binding_generation_;
        }, base::Unretained(this))));
  }
  active_section_label_ = body_->AddChildView(std::make_unique<views::Label>());
  module_summary_label_ = body_->AddChildView(std::make_unique<views::Label>());
  module_action_button_ = body_->AddChildView(std::make_unique<WorkspaceRailActionButton>(
      base::BindRepeating(&WorkspaceRailView::OpenSelectedModule,
                          base::Unretained(this)),
      base::BindRepeating([](WorkspaceRailView* rail) {
        return rail->binding_generation_;
      }, base::Unretained(this))));
  hide_button_ = AddChildView(std::make_unique<views::LabelButton>(
      base::BindRepeating(&WorkspaceRailView::HideRail, base::Unretained(this)),
      u""));
  for (auto* button : {collapse_button_.get(), width_button_.get(),
                       hide_button_.get(), module_action_button_.get()}) {
    button->SetMinSize(gfx::Size(36, 36));
    button->SetEnabledTextColors(kColorToolbarText);
    button->SetInstallFocusRingOnFocus(true);
  }
  mode_label_->SetEnabledColor(kColorToolbarText);
  mode_context_label_->SetEnabledColor(kColorToolbarText);
  active_section_label_->SetEnabledColor(kColorToolbarText);
  module_summary_label_->SetEnabledColor(kColorToolbarText);
  module_summary_label_->SetMultiLine(true);
  resize_area_ = AddChildView(std::make_unique<WorkspaceRailResizeArea>(this));
  resize_area_->SetProperty(views::kViewIgnoredByLayoutKey, true);
  resize_area_->GetViewAccessibility().SetName(u"Resize workspace rail");

  const WorkModeWorkspaceConfiguration& configuration =
      mode_controller_->active_configuration();
  is_collapsed_ = configuration.rail_state == "icons";
  is_hidden_ = configuration.rail_state == "hidden";
  preferred_width_ =
      std::clamp(configuration.rail_width, kMinimumExpandedRailWidth,
                 kMaximumExpandedRailWidth);
  mode_observation_.Observe(mode_controller_);
  UpdateModePresentation();
}

WorkspaceRailView::~WorkspaceRailView() = default;

void WorkspaceRailView::ToggleCollapsed() {
  mode_controller_->SetActiveConfigurationValue(
      "rail_state", is_collapsed_ || is_hidden_ ? "expanded" : "icons");
}

void WorkspaceRailView::HideRail() {
  mode_controller_->SetActiveConfigurationValue("rail_state", "hidden");
  // The hide control is now invisible. Move keyboard focus back to native
  // toolbar navigation; its mode menu can restore all three rail states.
  chrome::FocusToolbar(mode_controller_->browser());
}

views::LabelButton* WorkspaceRailView::module_button_for_testing(
    size_t index) const {
  return index < module_buttons_.size() ? module_buttons_[index].get()
                                        : nullptr;
}

views::ResizeArea* WorkspaceRailView::resize_area_for_testing() const {
  return resize_area_.get();
}

views::ScrollView* WorkspaceRailView::scroll_view_for_testing() const {
  return body_scroll_;
}

views::LabelButton* WorkspaceRailView::collapse_button_for_testing() const {
  return collapse_button_;
}

void WorkspaceRailView::ActivateModule(size_t index) {
  const RailPresentation presentation = GetWindowRailPresentation(mode_controller_);
  if (index >= module_buttons_.size() || index >= presentation.module_count) {
    return;
  }
  SelectModule(index);
  OpenSelectedModule();
}

void WorkspaceRailView::CyclePreferredWidth() {
  if (is_collapsed_ || is_hidden_) {
    return;
  }
  // A resize can leave the rail between named presets. Continue forward from
  // that width instead of unexpectedly resetting to the default preset.
  const auto next = std::ranges::find_if(
      kExpandedRailWidthPresets,
      [this](int width) { return width > preferred_width_; });
  preferred_width_ = next == kExpandedRailWidthPresets.end()
                         ? kExpandedRailWidthPresets.front()
                         : *next;
  mode_controller_->SetActiveConfigurationValue(
      "rail_width", base::NumberToString(preferred_width_));
  UpdateModePresentation();
  UpdateLayoutWidth();
}

void WorkspaceRailView::SelectModule(size_t index) {
  if (index >= module_buttons_.size()) {
    return;
  }
  const RailPresentation presentation = GetWindowRailPresentation(mode_controller_);
  if (index >= presentation.module_count) {
    return;
  }
  selected_module_id_ = presentation.module_ids[index];
  UpdateModePresentation();
}

void WorkspaceRailView::OpenSelectedModule() {
  if (selected_module_id_.empty() ||
      !CanRunRailModule(mode_controller_, selected_module_id_)) {
    return;
  }
  if (const auto native = FindNativeModeAction(selected_module_id_)) {
    const auto actions = ResolveOperationalWindowActions(mode_controller_->browser());
    if (actions) {
      ExecuteWindowModeAction(mode_controller_->browser(), actions->context,
                               native->command_id);
    }
    return;
  }
  const ModuleAction action = GetModuleAction(selected_module_id_);
  BrowserWindowInterface* const browser = mode_controller_->browser();
  if (browser && chrome::IsCommandEnabled(browser, action.command_id)) {
    chrome::ExecuteCommand(browser, action.command_id);
  }
}

void WorkspaceRailView::OnTahaiWindowModeChanged() {
  resize_area_->Cancel();
  const WorkModeWorkspaceConfiguration& configuration =
      mode_controller_->active_configuration();
  is_collapsed_ = configuration.rail_state == "icons";
  is_hidden_ = configuration.rail_state == "hidden";
  preferred_width_ =
      std::clamp(configuration.rail_width, kMinimumExpandedRailWidth,
                 kMaximumExpandedRailWidth);
  starting_width_on_resize_ = -1;
  const RailPresentation presentation = GetWindowRailPresentation(mode_controller_);
  if (std::find(presentation.module_ids.begin(),
                presentation.module_ids.begin() + presentation.module_count,
                selected_module_id_) ==
      presentation.module_ids.begin() + presentation.module_count) {
    selected_module_id_.clear();
  }
  UpdateModePresentation();
  UpdateLayoutWidth();
}

bool WorkspaceRailView::BeginResize() {
  starting_width_on_resize_ = -1;
  if (is_collapsed_ || is_hidden_ || !IsDrawn() || !GetWidget()) {
    return false;
  }
  starting_width_on_resize_ = preferred_width_;
  return true;
}

void WorkspaceRailView::OnResize(int resize_amount, bool done_resizing) {
  if (is_collapsed_ || is_hidden_) {
    return;
  }
  if (starting_width_on_resize_ < 0) {
    // A width preset invalidates layout asynchronously. Start a drag from the
    // requested width rather than the last arranged width so a click followed
    // immediately by a drag remains continuous.
    starting_width_on_resize_ = preferred_width_;
  }
  const bool trailing = mode_controller_->surface_design() &&
                        mode_controller_->surface_design()->rail_dock == "trailing";
  const int proposed_width = std::clamp(
      (trailing ? base::ClampSub(starting_width_on_resize_, resize_amount)
                : base::ClampAdd(starting_width_on_resize_, resize_amount)).RawValue(),
      kMinimumExpandedRailWidth, kMaximumExpandedRailWidth);
  if (done_resizing) {
    starting_width_on_resize_ = -1;
  }
  if (preferred_width_ == proposed_width) {
    if (done_resizing) {
      mode_controller_->SetActiveConfigurationValue(
          "rail_width", base::NumberToString(preferred_width_));
    }
    return;
  }
  preferred_width_ = proposed_width;
  // Keep the visible width, tooltip, and accessible name in sync while a drag
  // is in progress rather than updating only after a later mode change.
  UpdateModePresentation();
  UpdateLayoutWidth();
  if (done_resizing) {
    mode_controller_->SetActiveConfigurationValue(
        "rail_width", base::NumberToString(preferred_width_));
  }
}

gfx::Size WorkspaceRailView::CalculatePreferredSize(
    const views::SizeBounds& available_size) const {
  if (is_hidden_) {
    return gfx::Size();
  }
  return gfx::Size(is_collapsed_ ? kCollapsedRailWidth : preferred_width_, 0);
}

gfx::Size WorkspaceRailView::GetMinimumSize() const {
  if (is_hidden_) {
    return gfx::Size();
  }
  return gfx::Size(
      is_collapsed_ ? kCollapsedRailWidth : kMinimumExpandedRailWidth, 0);
}

void WorkspaceRailView::Layout(PassKey) {
  LayoutSuperclass<views::View>(this);
  const bool trailing = mode_controller_->surface_design() &&
                        mode_controller_->surface_design()->rail_dock == "trailing";
  resize_area_->SetBounds(trailing ? 0 : std::max(0, width() - kResizeHandleWidth), 0,
                          kResizeHandleWidth, height());
}

void WorkspaceRailView::OnThemeChanged() {
  views::View::OnThemeChanged();
  UpdateSkinColors();
}

void WorkspaceRailView::UpdateSkinColors() {
  if (!GetWidget() || !GetColorProvider()) {
    return;
  }
  ui::ColorVariant background = kColorToolbar;
  ui::ColorVariant foreground = kColorToolbarText;
  auto* service = skins::SkinProfileServiceFactory::GetForProfile(
      mode_controller_->browser()->GetProfile());
  const auto* palette = mode_controller_->window_skin_palette();
  if (!palette && service) {
    palette = service->GetColorSupplier();
  }
  auto* layout = static_cast<views::BoxLayout*>(GetLayoutManager());
  layout->set_between_child_spacing(
      palette && palette->density() == TahaiSkinDensity::kCompact ? 2 : 6);
  static_cast<views::BoxLayout*>(body_->GetLayoutManager())->set_between_child_spacing(
      palette && palette->density() == TahaiSkinDensity::kCompact ? 2 : 6);
  // Decoration is confined to a noninteractive rail slot, never behind text,
  // origins, permission prompts or focus indicators. All skin artwork is still.
  const bool show_art = palette && !palette->decoration().empty() &&
                        !is_collapsed_ && !is_hidden_ &&
                        GetWidget()->GetForcedColors() ==
                            ui::ColorProviderKey::ForcedColors::kNone;
  decoration_->SetVisible(show_art);
  if (show_art) {
    const auto& bitmap = palette->decoration();
    decoration_->SetImage(ui::ImageModel::FromImageSkia(
        gfx::ImageSkia::CreateFrom1xBitmap(bitmap)));
    const double scale =
        std::min(1.0, std::min(180.0 / bitmap.width(), 64.0 / bitmap.height()));
    decoration_->SetImageSize(
        gfx::Size(std::max(1, static_cast<int>(bitmap.width() * scale)),
                  std::max(1, static_cast<int>(bitmap.height() * scale))));
  } else {
    decoration_->SetImage(ui::ImageModel());
  }
  if (palette) {
    auto key = GetNativeTheme()->GetColorProviderKey(nullptr);
    key.color_mode = GetWidget()->GetColorMode();
    key.forced_colors = GetWidget()->GetForcedColors();
    if (auto color = palette->Color("rail_background", key)) {
      background = *color;
      foreground = *palette->Color("rail_foreground", key);
    }
  }
  SetBackground(views::CreateSolidBackground(background));
  body_scroll_->SetBackgroundColor(background);
  for (auto* label :
       {mode_label_.get(), mode_context_label_.get(),
        active_section_label_.get(), module_summary_label_.get()}) {
    label->SetEnabledColor(foreground);
  }
  for (auto* button : {collapse_button_.get(), width_button_.get(),
                       hide_button_.get(), module_action_button_.get()}) {
    button->SetEnabledTextColors(foreground);
  }
  const auto presentation = GetWindowRailPresentation(mode_controller_);
  for (size_t index = 0; index < module_buttons_.size(); ++index) {
    if (index >= presentation.module_count) {
      module_buttons_[index]->SetVisible(false);
      continue;
    }
    auto* button = module_buttons_[index].get();
    button->SetEnabledTextColors(foreground);
    button->SetImageModel(views::Button::STATE_NORMAL,
                          ui::ImageModel::FromVectorIcon(
                              *presentation.icons[index], foreground, 20));
    // Keep the selected marker visible without putting custom text over an
    // unrelated native hover background. The outline doesn't replace focus.
    const bool selected = selected_module_id_ == presentation.module_ids[index];
    button->SetBackground(nullptr);
    button->SetBorder(
        selected ? views::CreatePaddedBorder(
                       views::CreateRoundedRectBorder(1, 6, foreground),
                       gfx::Insets::VH(7, is_collapsed_ ? 0 : 7))
                 : views::CreateEmptyBorder(
                       gfx::Insets::VH(8, is_collapsed_ ? 0 : 8)));
  }
}

void WorkspaceRailView::UpdateModePresentation() {
  ++binding_generation_;
  const RailPresentation presentation = GetWindowRailPresentation(mode_controller_);
  const std::u16string mode_title =
      base::UTF8ToUTF16(mode_controller_->active_mode_title());

  const bool was_visible = GetVisible();
  SetVisible(!is_hidden_);
  // The hidden state can be selected from the browser or toolbar menus, not
  // only from this view's Hide button. Whichever route changed the state, a
  // hidden descendant cannot retain keyboard focus with no visible recovery
  // control; move it to the browser-owned toolbar instead.
  if (is_hidden_ && was_visible) {
    views::FocusManager* const focus_manager = GetFocusManager();
    if (focus_manager && focus_manager->GetFocusedView() &&
        Contains(focus_manager->GetFocusedView())) {
      chrome::FocusToolbar(mode_controller_->browser());
    }
  }
  body_scroll_->SetVerticalScrollBarMode(is_collapsed_
      ? views::ScrollView::ScrollBarMode::kHiddenButEnabled
      : views::ScrollView::ScrollBarMode::kEnabled);
  for (size_t index = 0; index < module_buttons_.size(); ++index) {
    const std::string next = index < presentation.module_count
        ? std::string(presentation.module_ids[index]) : std::string();
    if (!is_hidden_ && module_buttons_[index]->HasFocus() &&
        (next.empty() || next != module_button_ids_[index])) {
      collapse_button_->RequestFocus();
    }
    module_button_ids_[index] = next;
  }
  if (!is_hidden_ && module_action_button_->HasFocus() &&
      (!presentation.module_count || is_collapsed_)) {
    collapse_button_->RequestFocus();
  }
  mode_label_->SetVisible(!is_collapsed_);
  mode_label_->SetText(u"TAHAI · " + mode_title);
  mode_label_->SetTooltipText(u"Mode: " + mode_title);
  mode_label_->GetViewAccessibility().SetName(u"TAHAI work mode: " +
                                              mode_title);

  mode_context_label_->SetVisible(!is_collapsed_);
  mode_context_label_->SetText(presentation.context);
  mode_context_label_->SetTooltipText(u"Mode focus: " +
                                      std::u16string(presentation.context));
  mode_context_label_->GetViewAccessibility().SetName(
      u"Current mode focus: " + std::u16string(presentation.context));

  collapse_button_->SetText(is_collapsed_ ? u"" : u"Collapse rail");
  collapse_button_->SetImageModel(
      views::Button::STATE_NORMAL,
      ui::ImageModel::FromVectorIcon(is_collapsed_
                                         ? vector_icons::kArrowForwardIcon
                                         : vector_icons::kArrowBackIcon,
                                     kColorToolbarButtonIcon, 20));
  collapse_button_->SetBorder(
      views::CreateEmptyBorder(gfx::Insets::VH(8, is_collapsed_ ? 0 : 8)));
  collapse_button_->SetHorizontalAlignment(is_collapsed_ ? gfx::ALIGN_CENTER
                                                         : gfx::ALIGN_LEFT);
  collapse_button_->SetImageLabelSpacing(is_collapsed_ ? 0 : 10);
  collapse_button_->SetAccessibleName(
      is_collapsed_ ? u"Expand workspace rail" : u"Collapse workspace rail");
  collapse_button_->SetTooltipText(is_collapsed_ ? u"Expand workspace rail"
                                                 : u"Collapse workspace rail");

  width_button_->SetVisible(!is_collapsed_);
  resize_area_->SetVisible(!is_collapsed_ && !is_hidden_);
  hide_button_->SetText(is_collapsed_ ? u"" : u"Hide rail");
  hide_button_->SetImageModel(
      views::Button::STATE_NORMAL,
      ui::ImageModel::FromVectorIcon(vector_icons::kVisibilityOffIcon,
                                     kColorToolbarButtonIcon, 20));
  hide_button_->SetBorder(
      views::CreateEmptyBorder(gfx::Insets::VH(8, is_collapsed_ ? 0 : 8)));
  hide_button_->SetHorizontalAlignment(is_collapsed_ ? gfx::ALIGN_CENTER
                                                     : gfx::ALIGN_LEFT);
  hide_button_->SetImageLabelSpacing(is_collapsed_ ? 0 : 10);
  hide_button_->SetTooltipText(
      u"Hide workspace rail; restore from the mode menu");
  hide_button_->SetAccessibleName(
      u"Hide workspace rail; restore from the mode menu");
  if (!is_collapsed_) {
    const auto next = std::ranges::find_if(
        kExpandedRailWidthPresets,
        [this](int width) { return width > preferred_width_; });
    const int next_width = next == kExpandedRailWidthPresets.end()
                               ? kExpandedRailWidthPresets.front()
                               : *next;
    width_button_->SetText(base::NumberToString16(preferred_width_) + u" px");
    width_button_->SetTooltipText(u"Set workspace rail width to " +
                                  base::NumberToString16(next_width) +
                                  u" pixels");
    width_button_->GetViewAccessibility().SetName(
        u"Workspace rail width " + base::NumberToString16(preferred_width_) +
        u" pixels; activate to set " + base::NumberToString16(next_width) +
        u" pixels");
  }

  if (!presentation.module_count) {
    selected_module_id_.clear();
    for (const auto& button : module_buttons_) {
      button->SetVisible(false);
      button->SetEnabled(false);
    }
    active_section_label_->SetVisible(!is_collapsed_);
    active_section_label_->SetText(u"Mode controls unavailable");
    active_section_label_->SetTooltipText(u"Mode controls unavailable");
    active_section_label_->GetViewAccessibility().SetName(u"Mode controls unavailable");
    module_summary_label_->SetVisible(!is_collapsed_);
    module_summary_label_->SetText(u"Choose a valid mode from the toolbar. Missing or revoked settings do not enable replacement controls.");
    const std::u16string unavailable_summary(module_summary_label_->GetText());
    module_summary_label_->SetTooltipText(unavailable_summary);
    module_summary_label_->GetViewAccessibility().SetName(unavailable_summary);
    module_action_button_->SetVisible(false);
    module_action_button_->SetEnabled(false);
    UpdateSkinColors();
    return;
  }
  if (selected_module_id_.empty()) {
    selected_module_id_ = presentation.module_ids.front();
  }
  size_t selected_index = 0;
  for (size_t index = 0; index < module_buttons_.size(); ++index) {
    if (index >= presentation.module_count) {
      module_buttons_[index]->SetVisible(false);
      continue;
    }
    module_buttons_[index]->SetVisible(true);
    const bool is_selected =
        selected_module_id_ == presentation.module_ids[index];
    if (is_selected) {
      selected_index = index;
    }
    const std::u16string full_label(presentation.modules[index]);
    module_buttons_[index]->SetText(is_collapsed_ ? u"" : full_label);
    module_buttons_[index]->SetImageModel(
        views::Button::STATE_NORMAL,
        ui::ImageModel::FromVectorIcon(*presentation.icons[index],
                                       kColorToolbarButtonIcon, 20));
    module_buttons_[index]->SetImageModel(
        views::Button::STATE_DISABLED,
        ui::ImageModel::FromVectorIcon(*presentation.icons[index],
                                       kColorToolbarButtonIconDisabled, 20));
    module_buttons_[index]->SetMinSize(gfx::Size(36, 36));
    module_buttons_[index]->SetBorder(
        views::CreateEmptyBorder(gfx::Insets::VH(8, is_collapsed_ ? 0 : 8)));
    module_buttons_[index]->SetImageLabelSpacing(is_collapsed_ ? 0 : 10);
    module_buttons_[index]->SetHorizontalAlignment(
        is_collapsed_ ? gfx::ALIGN_CENTER : gfx::ALIGN_LEFT);
    module_buttons_[index]->SetEnabledTextColors(kColorToolbarText);
    module_buttons_[index]->SetInstallFocusRingOnFocus(true);
    module_buttons_[index]->SetBackground(
        is_selected ? views::CreateRoundedRectBackground(
                          kColorToolbarBackgroundSubtleEmphasis, 6)
                    : nullptr);
    module_buttons_[index]->SetEnabled(CanRunRailModule(
        mode_controller_, presentation.module_ids[index]));
    module_buttons_[index]->SetTooltipText(full_label);
    module_buttons_[index]->GetViewAccessibility().SetName(
        (is_selected ? u"Selected workspace section: "
                     : u"Open workspace section: ") +
        full_label);
  }
  active_section_label_->SetVisible(!is_collapsed_);
  active_section_label_->SetText(
      u"Current: " + std::u16string(presentation.modules[selected_index]));
  active_section_label_->SetTooltipText(
      u"Current workspace section: " +
      std::u16string(presentation.modules[selected_index]));
  active_section_label_->GetViewAccessibility().SetName(
      u"Current workspace section: " +
      std::u16string(presentation.modules[selected_index]));

  const ModuleAction action = GetModuleAction(selected_module_id_);
  const bool module_action_available =
      CanRunRailModule(mode_controller_, selected_module_id_);
  module_summary_label_->SetVisible(!is_collapsed_);
  module_summary_label_->SetText(action.summary);
  module_summary_label_->SetTooltipText(std::u16string(action.summary));
  module_summary_label_->GetViewAccessibility().SetName(
      std::u16string(action.summary));
  module_action_button_->SetVisible(!is_collapsed_);
  module_action_button_->SetText(action.title);
  module_action_button_->SetTooltipText(std::u16string(action.title));
  module_action_button_->SetEnabled(module_action_available);
  module_action_button_->GetViewAccessibility().SetName(
      module_action_available ? std::u16string(action.title)
                              : u"This workspace action is unavailable");
  UpdateSkinColors();
}

void WorkspaceRailView::UpdateLayoutWidth() {
  InvalidateLayout();
  if (parent()) {
    parent()->InvalidateLayout();
  }
}

BEGIN_METADATA(WorkspaceRailView)
END_METADATA

}  // namespace tahai
