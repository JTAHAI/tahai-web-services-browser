// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_guard_panel.h"

#include <algorithm>
#include <array>
#include <memory>
#include <string>
#include <utility>

#include "base/functional/bind.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "base/timer/timer.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_guard/guard_profile_service_factory.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration_registry.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/common/pref_names.h"
#include "chrome/grit/generated_resources.h"
#include "components/prefs/pref_change_registrar.h"
#include "components/prefs/pref_service.h"
#include "components/strings/grit/components_strings.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/page.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/models/simple_combobox_model.h"
#include "ui/base/mojom/dialog_button.mojom.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/controls/button/md_text_button.h"
#include "ui/views/controls/combobox/combobox.h"
#include "ui/views/controls/label.h"
#include "ui/views/controls/scroll_view.h"
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/view_class_properties.h"
#include "ui/views/widget/widget.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai::guard {

DEFINE_ELEMENT_IDENTIFIER_VALUE(kGuardPanelElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kGuardPauseElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kGuardSiteExceptionElementId);

bool CanShowGuardPanel(Browser* browser) {
  return browser && browser->is_type_normal() &&
         !browser->GetProfile()->IsGuestSession() &&
         !browser->GetProfile()->IsSystemProfile();
}

GuardPanelController::GuardPanelController(Browser* browser,
                                           base::RepeatingClosure invalidated)
    : browser_(browser ? browser->AsWeakPtr() : base::WeakPtr<Browser>()),
      invalidated_(std::move(invalidated)) {
  if (!CanShowGuardPanel(browser)) {
    invalid_ = true;
    return;
  }
  tab_strip_model_ = browser->tab_strip_model();
  tab_strip_model_->AddObserver(this);
  Observe(browser->tab_strip_model()->GetActiveWebContents());
  if (web_contents() && web_contents()->GetPrimaryMainFrame()) {
    auto* frame = web_contents()->GetPrimaryMainFrame();
    document_ = frame->GetWeakDocumentPtr();
    origin_ = frame->GetLastCommittedOrigin();
  }
}

GuardPanelController::~GuardPanelController() {
  if (tab_strip_model_) {
    tab_strip_model_->RemoveObserver(this);
  }
}

bool GuardPanelController::IsCurrent() const {
  auto* frame = document_.AsRenderFrameHostIfValid();
  return !invalid_ && browser_ && CanShowGuardPanel(browser_.get()) && frame &&
         frame->IsActive() && frame->IsRenderFrameLive() &&
         frame->GetPage().IsPrimary() && frame->IsInPrimaryMainFrame() &&
         frame->GetLastCommittedURL().SchemeIsHTTPOrHTTPS() &&
         !frame->GetParentOrOuterDocumentOrEmbedder() && web_contents() &&
         web_contents()->GetPrimaryMainFrame() == frame &&
         web_contents()->GetBrowserContext() == browser_->GetProfile() &&
         browser_->tab_strip_model()->GetActiveWebContents() ==
             web_contents() &&
         frame->GetLastCommittedOrigin() == origin_ && !origin_.opaque() &&
         origin_.GetURL().SchemeIsHTTPOrHTTPS();
}

GuardProfileService* GuardPanelController::Service() const {
  return IsCurrent()
             ? GuardProfileServiceFactory::GetForProfile(browser_->GetProfile())
             : nullptr;
}

std::optional<GuardProfileService::Snapshot> GuardPanelController::GetSnapshot()
    const {
  auto* service = Service();
  return service ? std::make_optional(service->GetSnapshot()) : std::nullopt;
}

bool GuardPanelController::IsPaused() const {
  auto* service = Service();
  return service &&
         service->IsPagePaused(
             document_.AsRenderFrameHostIfValid()->GetPageUkmSourceId());
}

bool GuardPanelController::CanPause() const {
  const auto state = GetSnapshot();
  return state && !state->managed && state->mode != TahaiGuardMode::kOff &&
         !HasSiteException() &&
         (IsPaused() || state->status == GuardProfileService::Status::kReady ||
          state->status == GuardProfileService::Status::kLastKnownGood);
}

bool GuardPanelController::SetPaused(bool paused) {
  auto* service = Service();
  return service && (!paused || CanPause()) &&
         service->SetPagePaused(*document_.AsRenderFrameHostIfValid(), paused);
}

bool GuardPanelController::SetMode(TahaiGuardMode mode) {
  const auto state = GetSnapshot();
  auto configuration = Configuration();
  if (!state || state->managed || state->private_session || !configuration) {
    return false;
  }
  configuration->mode = mode;
  return SetTahaiGuardConfigurationForProfile(browser_->GetProfile(),
                                              *configuration);
}

std::optional<TahaiGuardConfiguration> GuardPanelController::Configuration()
    const {
  if (!IsCurrent()) {
    return std::nullopt;
  }
  TahaiGuardConfiguration configuration;
  const auto& stored =
      browser_->GetProfile()->GetPrefs()->GetDict(prefs::kTahaiGuardConfiguration);
  if (stored.empty() && !browser_->GetProfile()->GetPrefs()->IsManagedPreference(
                            prefs::kTahaiGuardConfiguration)) {
    return configuration;
  }
  if (ValidateTahaiGuardConfiguration(stored, &configuration) !=
      TahaiGuardConfigurationValidationResult::kValid) {
    return std::nullopt;
  }
  return configuration;
}

bool GuardPanelController::HasSiteException() const {
  const auto configuration = Configuration();
  return configuration &&
         std::ranges::any_of(
             configuration->site_overrides, [&](const auto& entry) {
               return entry.canonical_origin == origin_.GetURL().spec() &&
                      entry.mode == TahaiGuardSiteOverrideMode::kOff;
             });
}

bool GuardPanelController::CanEditSiteException() const {
  const auto state = GetSnapshot();
  return state && !state->managed && !state->private_session &&
         state->status != GuardProfileService::Status::kStopped &&
         state->mode != TahaiGuardMode::kOff &&
         origin_.GetURL().SchemeIs("https") && Configuration().has_value();
}

bool GuardPanelController::SetSiteException(bool excluded) {
  if (!CanEditSiteException()) {
    return false;
  }
  auto configuration = Configuration();
  if (!configuration) {
    return false;
  }
  const auto origin = origin_.GetURL().spec();
  // Removing a network exception must not erase unrelated origins or a future
  // cosmetic-only choice. An explicit new exception replaces this origin only.
  std::erase_if(configuration->site_overrides, [&](const auto& entry) {
    return entry.canonical_origin == origin &&
           (excluded || entry.mode == TahaiGuardSiteOverrideMode::kOff);
  });
  if (excluded) {
    configuration->site_overrides.push_back(
        {origin, TahaiGuardSiteOverrideMode::kOff});
  }
  return SetTahaiGuardConfigurationForProfile(browser_->GetProfile(),
                                              *configuration);
}

bool GuardPanelController::Reload() {
  if (!IsCurrent()) {
    return false;
  }
  web_contents()->GetController().Reload(content::ReloadType::NORMAL, true);
  return true;
}

void GuardPanelController::Invalidate() {
  if (std::exchange(invalid_, true)) {
    return;
  }
  if (invalidated_) {
    invalidated_.Run();
  }
}

void GuardPanelController::OnTabStripModelChanged(
    TabStripModel*,
    const TabStripModelChange&,
    const TabStripSelectionChange& selection) {
  if (selection.active_tab_changed()) {
    Invalidate();
  }
}

void GuardPanelController::OnTabStripModelDestroyed(TabStripModel*) {
  tab_strip_model_ = nullptr;
  Invalidate();
}
void GuardPanelController::PrimaryPageChanged(content::Page&) {
  Invalidate();
}
void GuardPanelController::PrimaryMainFrameRenderProcessGone(
    base::TerminationStatus) {
  Invalidate();
}
void GuardPanelController::WebContentsDestroyed() {
  Invalidate();
}

namespace {

int StatusMessage(const GuardProfileService::Snapshot& state) {
  using Status = GuardProfileService::Status;
  switch (state.status) {
    case Status::kOff:
      return IDS_TAHAI_GUARD_STATUS_OFF;
    case Status::kNoRules:
      return IDS_TAHAI_GUARD_STATUS_NO_RULES;
    case Status::kCompiling:
      return IDS_TAHAI_GUARD_STATUS_COMPILING;
    case Status::kReady:
      return IDS_TAHAI_GUARD_STATUS_READY;
    case Status::kLastKnownGood:
      return IDS_TAHAI_GUARD_STATUS_PREVIOUS;
    case Status::kUnsupportedMode:
      return IDS_TAHAI_GUARD_STATUS_UNSUPPORTED;
    case Status::kInvalidConfiguration:
      return IDS_TAHAI_GUARD_STATUS_INVALID;
    case Status::kUnavailable:
    case Status::kStopped:
      return IDS_TAHAI_GUARD_STATUS_UNAVAILABLE;
  }
}

class GuardPanelView final : public views::DialogDelegate {
 public:
  explicit GuardPanelView(Browser* browser) : browser_(browser->AsWeakPtr()) {
    auto contents = std::make_unique<views::View>();
    contents_ = contents.get();
    SetContentsView(std::move(contents));
    contents_->SetProperty(views::kElementIdentifierKey, kGuardPanelElementId);
    SetTitle(l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_PANEL_TITLE));
    SetButtons(static_cast<int>(ui::mojom::DialogButton::kCancel));
    SetButtonLabel(ui::mojom::DialogButton::kCancel,
                   l10n_util::GetStringUTF16(IDS_CLOSE));
    SetShowCloseButton(true);
    SetCanResize(true);
    auto* layout =
        contents_->SetLayoutManager(std::make_unique<views::BoxLayout>(
            views::BoxLayout::Orientation::kVertical, gfx::Insets(16), 0));
    contents_->SetPreferredSize(gfx::Size(560, 580));
    auto* scroll =
        contents_->AddChildView(std::make_unique<views::ScrollView>());
    scroll->SetHorizontalScrollBarMode(
        views::ScrollView::ScrollBarMode::kDisabled);
    scroll->ClipHeightTo(120, 540);
    layout->SetFlexForView(scroll, 1);
    rows_ = scroll->SetContents(std::make_unique<views::View>());
    rows_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(4), 12));
    controller_ = std::make_unique<GuardPanelController>(
        browser, base::BindRepeating(&GuardPanelView::ContextLost,
                                     weak_factory_.GetWeakPtr()));
    origin_ = Label();
    origin_->SetAllowCharacterBreak(true);
    origin_->SetElideBehavior(gfx::NO_ELIDE);
    status_ = Label();
    mode_ = rows_->AddChildView(std::make_unique<views::Combobox>(
        std::make_unique<ui::SimpleComboboxModel>(
            std::vector<ui::SimpleComboboxModel::Item>{
                ui::SimpleComboboxModel::Item(u"Off"),
                ui::SimpleComboboxModel::Item(u"Balanced"),
                ui::SimpleComboboxModel::Item(u"Strict"),
                ui::SimpleComboboxModel::Item(u"Custom")})));
    mode_->GetViewAccessibility().SetName(
        l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_MODE));
    mode_->SetCallback(base::BindRepeating(&GuardPanelView::ChangeMode,
                                           weak_factory_.GetWeakPtr()));
    boundary_ = Label();
    Label()->SetText(l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_PANEL_SCOPE));
    pause_ = Button(&GuardPanelView::Pause, IDS_TAHAI_GUARD_PAUSE);
    pause_->SetProperty(views::kElementIdentifierKey, kGuardPauseElementId);
    Label()->SetText(l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_PAUSE_SCOPE));
    exception_ =
        Button(&GuardPanelView::Exception, IDS_TAHAI_GUARD_EXCLUDE_SITE);
    exception_->SetProperty(views::kElementIdentifierKey,
                            kGuardSiteExceptionElementId);
    Label()->SetText(
        l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_EXCEPTION_SCOPE));
    reload_ = Button(&GuardPanelView::Reload, IDS_TAHAI_GUARD_RELOAD);
    counters_ = Label();
    Button(&GuardPanelView::Refresh, IDS_TAHAI_GUARD_REFRESH);
    Button(&GuardPanelView::Settings, IDS_TAHAI_GUARD_MANAGE_RULES);
    feedback_ = Label();
    preferences_.Init(browser->GetProfile()->GetPrefs());
    for (const char* name :
         {prefs::kTahaiGuardConfiguration, prefs::kTahaiGuardCustomRules}) {
      preferences_.Add(name, base::BindRepeating(&GuardPanelView::Refresh,
                                                 weak_factory_.GetWeakPtr()));
    }
    Refresh();
    refresh_timer_.Start(FROM_HERE, base::Milliseconds(500),
                         base::BindRepeating(&GuardPanelView::Refresh,
                                             weak_factory_.GetWeakPtr()));
  }

  void WindowClosing() override {
    // A closed/replaced panel must not retain queued button authority until
    // asynchronous widget destruction finishes.
    weak_factory_.InvalidateWeakPtrs();
    refresh_timer_.Stop();
    preferences_.RemoveAll();
    controller_.reset();
    rows_ = nullptr;
    origin_ = nullptr;
    status_ = nullptr;
    mode_ = nullptr;
    boundary_ = nullptr;
    counters_ = nullptr;
    feedback_ = nullptr;
    pause_ = nullptr;
    exception_ = nullptr;
    reload_ = nullptr;
    contents_ = nullptr;
    views::DialogDelegate::WindowClosing();
  }

 private:
  views::Label* Label() {
    auto* label = rows_->AddChildView(std::make_unique<views::Label>());
    label->SetMultiLine(true);
    label->SetHorizontalAlignment(gfx::ALIGN_LEFT);
    return label;
  }
  views::MdTextButton* Button(void (GuardPanelView::*action)(), int message) {
    return rows_->AddChildView(std::make_unique<views::MdTextButton>(
        base::BindRepeating(action, weak_factory_.GetWeakPtr()),
        l10n_util::GetStringUTF16(message)));
  }
  void Feedback(bool success) {
    const auto text = l10n_util::GetStringUTF16(
        success ? IDS_TAHAI_GUARD_CHANGED : IDS_TAHAI_GUARD_CHANGE_DENIED);
    feedback_->SetText(text);
    feedback_->GetViewAccessibility().AnnounceText(text);
  }
  void Pause() {
    const bool result = controller_->SetPaused(!controller_->IsPaused());
    Refresh();
    Feedback(result);
  }
  void ChangeMode() {
    constexpr std::array modes = {
        TahaiGuardMode::kOff, TahaiGuardMode::kBalanced,
        TahaiGuardMode::kStrict, TahaiGuardMode::kCustom};
    const auto selected = mode_->GetSelectedIndex();
    if (selected && *selected < std::size(modes)) {
      Feedback(controller_->SetMode(modes[*selected]));
      Refresh();
    }
  }
  void Exception() {
    const bool result =
        controller_->SetSiteException(!controller_->HasSiteException());
    Refresh();
    Feedback(result);
  }
  void Reload() { Feedback(controller_->Reload()); }
  void Settings() {
    if (browser_) {
      chrome::ExecuteCommand(browser_.get(), IDC_TAHAI_SUPPORT);
    }
  }
  void ContextLost() {
    feedback_->SetText({});
    Refresh();
    status_->GetViewAccessibility().AnnounceText(status_->GetText());
  }
  void Refresh() {
    const auto state = controller_->GetSnapshot();
    const bool paused = controller_->IsPaused();
    const bool excluded = controller_->HasSiteException();
    mode_->SetEnabled(state && !state->managed && !state->private_session);
    if (state) {
      constexpr std::array modes = {
          TahaiGuardMode::kOff, TahaiGuardMode::kBalanced,
          TahaiGuardMode::kStrict, TahaiGuardMode::kCustom};
      const auto found = std::ranges::find(modes, state->mode);
      if (found != std::end(modes)) {
        mode_->SetSelectedIndex(found - std::begin(modes));
      }
    }
    origin_->SetText(state
                         ? base::UTF8ToUTF16(controller_->origin().Serialize())
                         : std::u16string());
    auto status = l10n_util::GetStringUTF16(state ? StatusMessage(*state)
                                                  : IDS_TAHAI_GUARD_STALE_PAGE);
    // Recovery must not hide an unavailable engine: worker/background requests
    // may still require filtering even when this document has a user pause.
    if (paused || excluded) {
      status += u"\n" + l10n_util::GetStringUTF16(
                            paused ? IDS_TAHAI_GUARD_STATUS_PAUSED
                                   : IDS_TAHAI_GUARD_STATUS_EXCLUDED);
    }
    status_->SetText(status);
    std::u16string boundary;
    if (state && state->managed) {
      boundary = l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_MANAGED);
    }
    if (state && state->private_session) {
      if (!boundary.empty()) {
        boundary += u"\n";
      }
      boundary += l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_PRIVATE);
    }
    boundary_->SetText(boundary);
    pause_->SetText(l10n_util::GetStringUTF16(paused ? IDS_TAHAI_GUARD_RESUME
                                                     : IDS_TAHAI_GUARD_PAUSE));
    pause_->SetEnabled(controller_->CanPause());
    exception_->SetText(
        l10n_util::GetStringUTF16(excluded ? IDS_TAHAI_GUARD_INCLUDE_SITE
                                           : IDS_TAHAI_GUARD_EXCLUDE_SITE));
    exception_->SetEnabled(controller_->CanEditSiteException());
    reload_->SetEnabled(controller_->IsCurrent());
    counters_->SetText(
        state && state->statistics_enabled
            ? l10n_util::GetStringFUTF16(
                  IDS_TAHAI_GUARD_COUNTS,
                  base::NumberToString16(state->allowed),
                  base::NumberToString16(state->blocked),
                  base::NumberToString16(state->unavailable))
            : l10n_util::GetStringUTF16(IDS_TAHAI_GUARD_NO_COUNTS));
  }
  base::WeakPtr<Browser> browser_;
  raw_ptr<views::View> contents_ = nullptr;
  std::unique_ptr<GuardPanelController> controller_;
  raw_ptr<views::View> rows_ = nullptr;
  raw_ptr<views::Label> origin_ = nullptr;
  raw_ptr<views::Label> status_ = nullptr;
  raw_ptr<views::Combobox> mode_ = nullptr;
  raw_ptr<views::Label> boundary_ = nullptr;
  raw_ptr<views::Label> counters_ = nullptr;
  raw_ptr<views::Label> feedback_ = nullptr;
  raw_ptr<views::MdTextButton> pause_ = nullptr;
  raw_ptr<views::MdTextButton> exception_ = nullptr;
  raw_ptr<views::MdTextButton> reload_ = nullptr;
  PrefChangeRegistrar preferences_;
  base::RepeatingTimer refresh_timer_;
  base::WeakPtrFactory<GuardPanelView> weak_factory_{this};
};

}  // namespace

void ShowGuardPanel(Browser* browser) {
  if (!CanShowGuardPanel(browser)) {
    return;
  }
  // Explicitly reopening from the native menu captures the newly selected
  // pane. An old panel never silently retargets a security-changing action.
  for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
           browser->GetWindow()->GetNativeWindow())) {
    views::Widget* widget = widget_ptr.get();
    if (views::ElementTrackerViews::GetInstance()->GetFirstMatchingView(
            kGuardPanelElementId,
            views::ElementTrackerViews::GetContextForWidget(widget), false)) {
      widget->Close();
    }
  }
  views::DialogDelegate::CreateDialogWidget(
      new GuardPanelView(browser), browser->GetWindow()->GetNativeWindow(),
      browser->GetWindow()->GetNativeWindow())
      ->Show();
}

}  // namespace tahai::guard
