// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include <algorithm>
#include <string>

#include "base/auto_reset.h"
#include "base/callback_list.h"
#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/i18n/case_conversion.h"
#include "base/memory/weak_ptr.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/dialogs/browser_dialogs.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/common/pref_names.h"
#include "chrome/grit/generated_resources.h"
#include "components/prefs/pref_change_registrar.h"
#include "components/strings/grit/components_strings.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/models/dialog_model.h"
#include "ui/base/mojom/dialog_button.mojom.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/controls/button/md_text_button.h"
#include "ui/views/controls/label.h"
#include "ui/views/controls/scroll_view.h"
#include "ui/views/controls/textfield/textfield.h"
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/view_class_properties.h"
#include "ui/views/widget/widget.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai {
DEFINE_ELEMENT_IDENTIFIER_VALUE(kNamedWorkspaceNameElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kNamedWorkspaceSaveElementId);
namespace {

std::u16string TabPreview(const NamedWorkspace& workspace) {
  std::u16string preview;
  const size_t visible_tabs = std::min<size_t>(3, workspace.tabs.size());
  for (size_t index = 0; index < visible_tabs; ++index) {
    const GURL& url = workspace.tabs[index].url;
    std::string label(url.host());
    if (label.empty()) {
      label = std::string(url.scheme());
    }
    if (!preview.empty()) {
      preview.append(u" · ");
    }
    preview.append(base::UTF8ToUTF16(label));
  }
  if (workspace.tabs.size() > visible_tabs) {
    preview.append(u" · …");
  }
  return preview;
}

class NamedWorkspaceManagerView final : public views::DialogDelegate {
 public:
  explicit NamedWorkspaceManagerView(Browser* browser)
      : browser_(browser->AsWeakPtr()) {
    auto contents = std::make_unique<views::View>();
    contents_ = contents.get();
    SetContentsView(std::move(contents));
    SetTitle(l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACES_TITLE));
    SetButtons(static_cast<int>(ui::mojom::DialogButton::kCancel));
    SetButtonLabel(ui::mojom::DialogButton::kCancel,
                   l10n_util::GetStringUTF16(IDS_CLOSE));
    SetShowCloseButton(true);
    SetCanResize(true);
    auto* layout = contents_->SetLayoutManager(
        std::make_unique<views::BoxLayout>(
            views::BoxLayout::Orientation::kVertical, gfx::Insets(20), 12));
    contents_->SetPreferredSize(gfx::Size(620, 600));
    auto* explanation = contents_->AddChildView(
        std::make_unique<views::Label>(
            l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACES_PRIVACY)));
    explanation->SetMultiLine(true);
    explanation->SetHorizontalAlignment(gfx::ALIGN_LEFT);
    auto* save_row =
        contents_->AddChildView(std::make_unique<views::View>());
    auto* save_layout =
        save_row->SetLayoutManager(std::make_unique<views::BoxLayout>(
            views::BoxLayout::Orientation::kHorizontal, gfx::Insets(), 8));
    name_ = save_row->AddChildView(std::make_unique<views::Textfield>());
    name_->SetProperty(views::kElementIdentifierKey,
                       kNamedWorkspaceNameElementId);
    name_->SetPlaceholderText(
        l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_NAME));
    name_->GetViewAccessibility().SetName(
        l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_NAME));
    save_layout->SetFlexForView(name_, 1);
    filter_ = contents_->AddChildView(std::make_unique<views::Textfield>());
    filter_->SetPlaceholderText(
        l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACES_FILTER));
    filter_->GetViewAccessibility().SetName(
        l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACES_FILTER));
    filter_change_subscription_ = filter_->AddTextChangedCallback(
        base::BindRepeating(&NamedWorkspaceManagerView::Refresh,
                            weak_factory_.GetWeakPtr()));
    save_ = save_row->AddChildView(std::make_unique<views::MdTextButton>(
        base::BindRepeating(&NamedWorkspaceManagerView::Save,
                            weak_factory_.GetWeakPtr()),
        l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_SAVE)));
    save_->SetProperty(views::kElementIdentifierKey,
                       kNamedWorkspaceSaveElementId);
    cancel_rename_ = contents_->AddChildView(
        std::make_unique<views::MdTextButton>(
            base::BindRepeating(&NamedWorkspaceManagerView::ResetName,
                                weak_factory_.GetWeakPtr()),
            l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_CANCEL_RENAME)));
    cancel_rename_->SetVisible(false);
    status_ = contents_->AddChildView(std::make_unique<views::Label>());
    status_->SetMultiLine(true);
    status_->SetHorizontalAlignment(gfx::ALIGN_LEFT);
    auto* scroll =
        contents_->AddChildView(std::make_unique<views::ScrollView>());
    scroll->ClipHeightTo(120, 370);
    layout->SetFlexForView(scroll, 1);
    rows_ = scroll->SetContents(std::make_unique<views::View>());
    rows_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(), 12));
    Refresh();
    pref_changes_.Init(browser->GetProfile()->GetPrefs());
    for (const char* pref :
         {prefs::kTahaiNamedWorkspacesEnabled, prefs::kTahaiNamedWorkspaces}) {
      pref_changes_.Add(pref,
                        base::BindRepeating(&NamedWorkspaceManagerView::Refresh,
                                            weak_factory_.GetWeakPtr()));
    }
    SetInitiallyFocusedView(name_);
  }

  void WindowClosing() override {
    weak_factory_.InvalidateWeakPtrs();
    pref_changes_.RemoveAll();
    name_ = nullptr;
    filter_ = nullptr;
    save_ = nullptr;
    cancel_rename_ = nullptr;
    status_ = nullptr;
    rows_ = nullptr;
    contents_ = nullptr;
    views::DialogDelegate::WindowClosing();
  }

 private:
  void StatusText(std::u16string text) {
    status_->SetText(text);
    status_->GetViewAccessibility().AnnounceText(text);
  }

  void Status(int message) {
    StatusText(l10n_util::GetStringUTF16(message));
  }

  int CaptureFailureMessage(NamedWorkspaceCaptureFailure failure) const {
    switch (failure) {
      case NamedWorkspaceCaptureFailure::kUnavailable:
        return IDS_TAHAI_WORKSPACE_SAVE_UNAVAILABLE;
      case NamedWorkspaceCaptureFailure::kNoTabs:
        return IDS_TAHAI_WORKSPACE_SAVE_NO_TABS;
      case NamedWorkspaceCaptureFailure::kTooManyTabs:
        return IDS_TAHAI_WORKSPACE_SAVE_TOO_MANY_TABS;
      case NamedWorkspaceCaptureFailure::kUnsupportedTab:
        return IDS_TAHAI_WORKSPACE_SAVE_UNSUPPORTED_TAB;
      case NamedWorkspaceCaptureFailure::kUnsupportedLayout:
        return IDS_TAHAI_WORKSPACE_SAVE_UNSUPPORTED_LAYOUT;
      case NamedWorkspaceCaptureFailure::kNone:
        return IDS_TAHAI_WORKSPACE_SAVE_FAILED;
    }
    return IDS_TAHAI_WORKSPACE_SAVE_FAILED;
  }

  void ResetName() {
    rename_id_.clear();
    name_->SetText({});
    save_->SetText(l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_SAVE));
    cancel_rename_->SetVisible(false);
    name_->RequestFocus();
  }

  void Save() {
    if (!browser_) {
      return;
    }
    NamedWorkspaceStore store(browser_->GetProfile());
    const auto name = base::UTF16ToUTF8(name_->GetText());
    if (!NamedWorkspaceStore::IsValidName(name)) {
      Status(IDS_TAHAI_WORKSPACE_SAVE_INVALID_NAME);
      return;
    }
    const auto entries = store.Read();
    if (!entries) {
      Status(IDS_TAHAI_WORKSPACE_SAVE_UNAVAILABLE);
      return;
    }
    bool saved = false;
    if (!rename_id_.empty()) {
      saved = store.Rename(rename_id_, name);
    } else {
      if (entries->size() >= NamedWorkspaceStore::kMaxWorkspaces) {
        Status(IDS_TAHAI_WORKSPACE_SAVE_AT_CAPACITY);
        return;
      }
      auto capture = CaptureNamedWorkspace(browser_.get(), name);
      if (!capture.workspace) {
        Status(CaptureFailureMessage(capture.failure));
        return;
      }
      saved = store.Add(std::move(*capture.workspace)).has_value();
    }
    if (saved) {
      ResetName();
      Refresh();
    }
    Status(saved ? IDS_TAHAI_WORKSPACE_SAVED
                 : IDS_TAHAI_WORKSPACE_SAVE_STORAGE_FAILED);
  }

  void Open(std::string id) {
    if (browser_) {
      Status(OpenNamedWorkspace(browser_.get(), id)
                 ? IDS_TAHAI_WORKSPACE_OPENED
                 : IDS_TAHAI_WORKSPACE_OPEN_FAILED);
    }
  }

  void Rename(std::string id) {
    if (!browser_) {
      return;
    }
    auto entry = NamedWorkspaceStore(browser_->GetProfile()).Find(id);
    if (!entry) {
      Status(IDS_TAHAI_WORKSPACE_OPEN_FAILED);
      Refresh();
      return;
    }
    rename_id_ = std::move(id);
    name_->SetText(base::UTF8ToUTF16(entry->name));
    name_->SelectAll(false);
    name_->RequestFocus();
    save_->SetText(l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_RENAME));
    cancel_rename_->SetVisible(true);
  }

  void ConfirmDelete(std::string id) {
    if (!browser_) {
      return;
    }
    auto entry = NamedWorkspaceStore(browser_->GetProfile()).Find(id);
    if (!entry) {
      Refresh();
      return;
    }
    auto model =
        ui::DialogModel::Builder()
            .SetTitle(
                l10n_util::GetStringFUTF16(IDS_TAHAI_WORKSPACE_DELETE_TITLE,
                                           base::UTF8ToUTF16(entry->name)))
            .AddParagraph(ui::DialogModelLabel(
                l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_DELETE_DETAIL)))
            .AddOkButton(
                base::BindOnce(&NamedWorkspaceManagerView::Delete,
                               weak_factory_.GetWeakPtr(), std::move(id)),
                ui::DialogModel::Button::Params().SetLabel(
                    l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_DELETE)))
            .AddCancelButton(base::DoNothing())
            .Build();
    chrome::ShowBrowserModal(browser_.get(), std::move(model));
  }

  void ConfirmUpdate(std::string id) {
    if (!browser_) {
      return;
    }
    auto entry = NamedWorkspaceStore(browser_->GetProfile()).Find(id);
    if (!entry) {
      Refresh();
      return;
    }
    auto model =
        ui::DialogModel::Builder()
            .SetTitle(
                l10n_util::GetStringFUTF16(IDS_TAHAI_WORKSPACE_UPDATE_TITLE,
                                           base::UTF8ToUTF16(entry->name)))
            .AddParagraph(ui::DialogModelLabel(
                l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_UPDATE_DETAIL)))
            .AddOkButton(
                base::BindOnce(&NamedWorkspaceManagerView::Update,
                               weak_factory_.GetWeakPtr(), std::move(id)),
                ui::DialogModel::Button::Params().SetLabel(
                    l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_UPDATE)))
            .AddCancelButton(base::DoNothing())
            .Build();
    chrome::ShowBrowserModal(browser_.get(), std::move(model));
  }

  void Update(std::string id) {
    if (!browser_) {
      return;
    }
    NamedWorkspaceStore store(browser_->GetProfile());
    auto entry = store.Find(id);
    if (!entry) {
      Refresh();
      return;
    }
    auto capture = CaptureNamedWorkspace(browser_.get(), entry->name);
    if (!capture.workspace) {
      Status(CaptureFailureMessage(capture.failure));
      return;
    }
    const bool updated = store.Replace(id, std::move(*capture.workspace));
    Refresh();
    Status(updated ? IDS_TAHAI_WORKSPACE_UPDATED
                   : IDS_TAHAI_WORKSPACE_SAVE_STORAGE_FAILED);
    name_->RequestFocus();
  }

  void Delete(std::string id) {
    if (!browser_) {
      return;
    }
    const bool removed = NamedWorkspaceStore(browser_->GetProfile()).Remove(id);
    if (rename_id_ == id) {
      ResetName();
    }
    Refresh();
    Status(removed ? IDS_TAHAI_WORKSPACE_DELETED
                   : IDS_TAHAI_WORKSPACE_OPEN_FAILED);
    name_->RequestFocus();
  }

  void Refresh() {
    if (refreshing_) {
      return;
    }
    base::AutoReset refreshing(&refreshing_, true);
    rows_->RemoveAllChildViews();
    auto entries = browser_ ? NamedWorkspaceStore(browser_->GetProfile()).Read()
                            : std::nullopt;
    save_->SetEnabled(entries.has_value());
    name_->SetEnabled(entries.has_value());
    filter_->SetEnabled(entries.has_value());
    if (!entries) {
      // Revoke already-rendered record names too when policy or store
      // validation makes the feature unavailable.
      rename_id_.clear();
      name_->SetText({});
      filter_->SetText({});
      cancel_rename_->SetVisible(false);
      save_->SetText(l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_SAVE));
      status_->SetText({});
    }
    if (!entries || entries->empty()) {
      auto* empty = rows_->AddChildView(std::make_unique<views::Label>(
          l10n_util::GetStringUTF16(entries
                                        ? IDS_TAHAI_WORKSPACES_EMPTY
                                        : IDS_TAHAI_WORKSPACES_UNAVAILABLE)));
      empty->SetMultiLine(true);
      return;
    }
    const std::u16string filter = base::i18n::ToLower(filter_->GetText());
    size_t shown = 0;
    for (const auto& entry : *entries) {
      const auto name = base::UTF8ToUTF16(entry.name);
      if (!filter.empty() &&
          base::i18n::ToLower(name).find(filter) == std::u16string::npos) {
        continue;
      }
      ++shown;
      auto* card = rows_->AddChildView(std::make_unique<views::View>());
      card->SetLayoutManager(std::make_unique<views::BoxLayout>(
          views::BoxLayout::Orientation::kVertical, gfx::Insets(8), 6));
      auto* title = card->AddChildView(std::make_unique<views::Label>(name));
      title->SetHorizontalAlignment(gfx::ALIGN_LEFT);
      title->SetMultiLine(true);
      auto* details = card->AddChildView(
          std::make_unique<views::Label>(l10n_util::GetStringFUTF16(
              IDS_TAHAI_WORKSPACE_DETAILS,
              base::NumberToString16(entry.tabs.size()),
              base::NumberToString16(entry.groups.size()),
              base::NumberToString16(entry.splits.size()))));
      details->SetHorizontalAlignment(gfx::ALIGN_LEFT);
      auto* preview = card->AddChildView(
          std::make_unique<views::Label>(l10n_util::GetStringFUTF16(
              IDS_TAHAI_WORKSPACE_TAB_PREVIEW, TabPreview(entry))));
      preview->SetHorizontalAlignment(gfx::ALIGN_LEFT);
      preview->SetMultiLine(true);
      auto* buttons = card->AddChildView(std::make_unique<views::View>());
      buttons->SetLayoutManager(std::make_unique<views::BoxLayout>(
          views::BoxLayout::Orientation::kHorizontal, gfx::Insets(), 8));
      auto* open = buttons->AddChildView(std::make_unique<views::MdTextButton>(
          base::BindRepeating(&NamedWorkspaceManagerView::Open,
                              weak_factory_.GetWeakPtr(), entry.id),
          l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_OPEN)));
      open->GetViewAccessibility().SetName(l10n_util::GetStringFUTF16(
          IDS_TAHAI_WORKSPACE_OPEN_ACCESSIBLE, name));
      auto* update =
          buttons->AddChildView(std::make_unique<views::MdTextButton>(
              base::BindRepeating(&NamedWorkspaceManagerView::ConfirmUpdate,
                                  weak_factory_.GetWeakPtr(), entry.id),
              l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_UPDATE)));
      update->GetViewAccessibility().SetName(l10n_util::GetStringFUTF16(
          IDS_TAHAI_WORKSPACE_UPDATE_ACCESSIBLE, name));
      auto* rename =
          buttons->AddChildView(std::make_unique<views::MdTextButton>(
              base::BindRepeating(&NamedWorkspaceManagerView::Rename,
                                  weak_factory_.GetWeakPtr(), entry.id),
              l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_RENAME)));
      rename->GetViewAccessibility().SetName(l10n_util::GetStringFUTF16(
          IDS_TAHAI_WORKSPACE_RENAME_ACCESSIBLE, name));
      auto* remove =
          buttons->AddChildView(std::make_unique<views::MdTextButton>(
              base::BindRepeating(&NamedWorkspaceManagerView::ConfirmDelete,
                                  weak_factory_.GetWeakPtr(), entry.id),
              l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACE_DELETE)));
      remove->GetViewAccessibility().SetName(l10n_util::GetStringFUTF16(
          IDS_TAHAI_WORKSPACE_DELETE_ACCESSIBLE, name));
    }
    if (shown == 0) {
      auto* empty = rows_->AddChildView(std::make_unique<views::Label>(
          l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACES_NO_MATCHES)));
      empty->SetMultiLine(true);
    }
  }

  base::WeakPtr<Browser> browser_;
  raw_ptr<views::View> contents_ = nullptr;
  raw_ptr<views::Textfield> name_ = nullptr;
  raw_ptr<views::Textfield> filter_ = nullptr;
  raw_ptr<views::MdTextButton> save_ = nullptr;
  raw_ptr<views::MdTextButton> cancel_rename_ = nullptr;
  raw_ptr<views::Label> status_ = nullptr;
  raw_ptr<views::View> rows_ = nullptr;
  std::string rename_id_;
  bool refreshing_ = false;
  base::CallbackListSubscription filter_change_subscription_;
  PrefChangeRegistrar pref_changes_;
  base::WeakPtrFactory<NamedWorkspaceManagerView> weak_factory_{this};
};

}  // namespace

void ShowNamedWorkspaceManager(Browser* browser) {
  if (!browser || !browser->is_type_normal() ||
      !NamedWorkspaceStore(browser->GetProfile()).enabled()) {
    return;
  }
  // Reuse this browser's existing manager instead of accumulating independent
  // editor windows and duplicated profile observers on repeated activation.
  for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
           browser->GetWindow()->GetNativeWindow())) {
    views::Widget* widget = widget_ptr.get();
    if (views::ElementTrackerViews::GetInstance()->GetFirstMatchingView(
            kNamedWorkspaceNameElementId,
            views::ElementTrackerViews::GetContextForWidget(widget), false)) {
      widget->Show();
      widget->Activate();
      return;
    }
  }
  views::DialogDelegate::CreateDialogWidget(
      new NamedWorkspaceManagerView(browser),
      browser->GetWindow()->GetNativeWindow(),
      browser->GetWindow()->GetNativeWindow())
      ->Show();
}

}  // namespace tahai
