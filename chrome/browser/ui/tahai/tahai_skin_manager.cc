// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_skin_manager.h"

#include <algorithm>
#include <map>
#include <memory>
#include <utility>

#include "base/files/important_file_writer.h"
#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/memory/weak_ptr.h"
#include "base/no_destructor.h"
#include "base/strings/utf_string_conversions.h"
#include "base/task/sequenced_task_runner.h"
#include "base/task/thread_pool.h"
#include "base/timer/timer.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_skins/skin_profile_service.h"
#include "chrome/browser/tahai_skins/skin_profile_service_factory.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/dialogs/browser_dialogs.h"
#include "chrome/browser/ui/select_file_policy/chrome_select_file_policy.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"
#include "chrome/grit/browser_resources.h"
#include "chrome/grit/generated_resources.h"
#include "components/prefs/pref_change_registrar.h"
#include "components/prefs/pref_service.h"
#include "components/strings/grit/components_strings.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/models/dialog_model.h"
#include "ui/base/models/image_model.h"
#include "ui/base/mojom/dialog_button.mojom.h"
#include "ui/base/resource/resource_bundle.h"
#include "ui/gfx/image/image_skia.h"
#include "ui/shell_dialogs/select_file_dialog.h"
#include "ui/shell_dialogs/selected_file_info.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/controls/button/md_text_button.h"
#include "ui/views/controls/image_view.h"
#include "ui/views/controls/label.h"
#include "ui/views/controls/scroll_view.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/view_class_properties.h"
#include "ui/views/widget/widget.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai::skins {
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerImportElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerInstallElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPreviewElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerReviewElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerApplyElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerResetElementId);
namespace {

class SkinManagerView;
using Managers = std::map<Profile*, base::WeakPtr<SkinManagerView>>;
Managers& OpenManagers() {
  static base::NoDestructor<Managers> managers;
  return *managers;
}

// A single native manager per regular profile owns review operations. There
// is no WebUI bridge, renderer file path, network fetch, or automatic install.
class SkinManagerView final : public views::DialogDelegate,
                              public ui::SelectFileDialog::Listener {
 public:
  explicit SkinManagerView(Browser* browser)
      : browser_(browser->AsWeakPtr()),
        profile_key_(browser->GetProfile()),
        service_(SkinProfileServiceFactory::GetForProfile(browser->GetProfile())
                     ->GetWeakPtr()) {
    auto contents = std::make_unique<views::View>();
    contents_ = contents.get();
    SetContentsView(std::move(contents));
    SetTitle(l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_MANAGER));
    SetButtons(static_cast<int>(ui::mojom::DialogButton::kCancel));
    SetButtonLabel(ui::mojom::DialogButton::kCancel,
                   l10n_util::GetStringUTF16(IDS_CLOSE));
    SetShowCloseButton(true);
    SetCanResize(true);
    contents_->SetPreferredSize(gfx::Size(680, 700));
    auto* layout =
        contents_->SetLayoutManager(std::make_unique<views::BoxLayout>(
            views::BoxLayout::Orientation::kVertical, gfx::Insets(20), 10));
    Label(contents_.get(),
          l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_PACKAGE_ONLY));
    Label(contents_.get(),
          l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_TRUST_NOTICE));
    auto* commands = Row(contents_.get());
    import_ = Button(commands, IDS_TAHAI_SKINS_IMPORT,
                     base::BindRepeating(&SkinManagerView::ChooseFile,
                                         weak_factory_.GetWeakPtr()));
    import_->SetProperty(views::kElementIdentifierKey,
                         kSkinManagerImportElementId);
    refresh_ = Button(commands, IDS_TAHAI_SKINS_REFRESH,
                      base::BindRepeating(&SkinManagerView::Refresh,
                                          weak_factory_.GetWeakPtr()));
    discard_ = Button(commands, IDS_TAHAI_SKINS_DISCARD_REVIEW,
                      base::BindRepeating(&SkinManagerView::Discard,
                                          weak_factory_.GetWeakPtr()));
    auto* creator_commands = Row(contents_.get());
    creator_ = Button(creator_commands, IDS_TAHAI_SKINS_CREATOR_KIT,
                      base::BindRepeating(&SkinManagerView::SaveCreatorKit,
                                          weak_factory_.GetWeakPtr()));
    reset_ = Button(creator_commands, IDS_TAHAI_SKINS_RESET,
                    base::BindRepeating(&SkinManagerView::ResetAppearance,
                                        weak_factory_.GetWeakPtr()));
    reset_->SetProperty(views::kElementIdentifierKey,
                        kSkinManagerResetElementId);
    status_ = Label(contents_.get(), {});
    auto* scroll =
        contents_->AddChildView(std::make_unique<views::ScrollView>());
    scroll->ClipHeightTo(180, 540);
    layout->SetFlexForView(scroll, 1);
    auto* body = scroll->SetContents(std::make_unique<views::View>());
    body->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(), 12));
    review_ = body->AddChildView(std::make_unique<views::View>());
    review_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(8), 8));
    summary_ = Label(review_, {});
    Label(review_, l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_ARTWORK_NOTICE));
    image_ = review_->AddChildView(std::make_unique<views::ImageView>());
    image_->SetProperty(views::kElementIdentifierKey,
                        kSkinManagerPreviewElementId);
    image_->GetViewAccessibility().SetName(
        l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_ARTWORK_NOTICE));
    install_ = Button(review_, IDS_TAHAI_SKINS_INSTALL,
                      base::BindRepeating(&SkinManagerView::ConfirmInstall,
                                          weak_factory_.GetWeakPtr()));
    install_->SetProperty(views::kElementIdentifierKey,
                          kSkinManagerInstallElementId);
    apply_ = Button(review_, IDS_TAHAI_SKINS_APPLY,
                    base::BindRepeating(&SkinManagerView::ApplyAppearance,
                                        weak_factory_.GetWeakPtr()));
    apply_->SetProperty(views::kElementIdentifierKey,
                        kSkinManagerApplyElementId);
    auto* preview_commands = Row(review_);
    try_ = Button(preview_commands, IDS_TAHAI_SKINS_TRY,
                  base::BindRepeating(&SkinManagerView::TryAppearance,
                                      weak_factory_.GetWeakPtr()));
    revert_ = Button(preview_commands, IDS_TAHAI_SKINS_REVERT,
                     base::BindRepeating(&SkinManagerView::RevertAppearance,
                                         weak_factory_.GetWeakPtr()));
    export_ = Button(review_, IDS_TAHAI_SKINS_EXPORT,
                     base::BindRepeating(&SkinManagerView::ExportSkin,
                                         weak_factory_.GetWeakPtr()));
    review_->SetVisible(false);
    rows_ = body->AddChildView(std::make_unique<views::View>());
    rows_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(), 12));
    pref_changes_.Init(browser->GetProfile()->GetPrefs());
    for (const char* pref :
         {prefs::kTahaiSkinsEnabled, prefs::kTahaiSkinInstallationsAllowed}) {
      pref_changes_.Add(pref,
                        base::BindRepeating(&SkinManagerView::OnPolicyChanged,
                                            weak_factory_.GetWeakPtr()));
    }
    SetInitiallyFocusedView(import_);
    Refresh();
  }

  ~SkinManagerView() override { Detach(); }
  base::WeakPtr<SkinManagerView> GetWeakPtr() {
    return weak_factory_.GetWeakPtr();
  }

 private:
  enum class ReviewKind { kFile, kInstalled, kPrevious };

  static views::Label* Label(views::View* parent, std::u16string text) {
    auto* label = parent->AddChildView(std::make_unique<views::Label>(text));
    label->SetMultiLine(true);
    label->SetHorizontalAlignment(gfx::ALIGN_LEFT);
    return label;
  }
  static views::View* Row(views::View* parent) {
    auto* row = parent->AddChildView(std::make_unique<views::View>());
    row->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kHorizontal, gfx::Insets(), 8));
    return row;
  }
  static views::MdTextButton* Button(views::View* parent,
                                     int message,
                                     base::RepeatingClosure action) {
    return parent->AddChildView(std::make_unique<views::MdTextButton>(
        std::move(action), l10n_util::GetStringUTF16(message)));
  }
  void Status(int message) {
    auto text = l10n_util::GetStringUTF16(message);
    status_->SetText(text);
    status_->GetViewAccessibility().AnnounceText(text);
  }
  void Status(const SkinOperationResult& result) {
    int message = IDS_TAHAI_SKINS_OPERATION_FAILED;
    switch (result.status) {
      case SkinOperationStatus::kOk:
        message = IDS_TAHAI_SKINS_STORED;
        break;
      case SkinOperationStatus::kDisabled:
      case SkinOperationStatus::kInstallDisallowed:
        message = IDS_TAHAI_SKINS_POLICY_BLOCKED;
        break;
      case SkinOperationStatus::kBusy:
        message = IDS_TAHAI_SKINS_BUSY;
        break;
      case SkinOperationStatus::kCancelled:
        message = IDS_TAHAI_SKINS_CANCELLED;
        break;
      case SkinOperationStatus::kStalePreview:
        message = IDS_TAHAI_SKINS_STALE;
        break;
      case SkinOperationStatus::kReadFailed:
        message = IDS_TAHAI_SKINS_READ_FAILED;
        break;
      case SkinOperationStatus::kDecodeFailed:
      case SkinOperationStatus::kInvalidInput:
        message = IDS_TAHAI_SKINS_INVALID;
        break;
      case SkinOperationStatus::kStoreFailed:
        if (result.store_error == SkinStoreError::kQuotaExceeded) {
          message = IDS_TAHAI_SKINS_QUOTA;
        } else if (result.store_error == SkinStoreError::kConflict ||
                   result.store_error == SkinStoreError::kAlreadyExists) {
          message = IDS_TAHAI_SKINS_STALE;
        }
        break;
    }
    Status(message);
  }
  void Controls() {
    if (closed_) {
      return;
    }
    const bool idle = !closed_ && browser_ && service_ && service_->enabled() &&
                      !service_->busy() && !choosing_ && !confirming_ &&
                      !exporting_;
    creator_->SetEnabled(idle &&
                         ChromeSelectFilePolicy::FileSelectDialogsAllowed());
    import_->SetEnabled(idle && service_->installation_allowed());
    refresh_->SetEnabled(idle);
    rows_->SetEnabled(idle);
    install_->SetEnabled(idle &&
                         service_->PreviewCanBeInstalled(preview_token_));
    apply_->SetEnabled(idle && service_->CanApplyPreview(preview_token_));
    try_->SetEnabled(idle && service_->CanChangeAppearance() &&
                     service_->GetPreview(preview_token_));
    revert_->SetEnabled(idle && service_->live_preview_active());
    export_->SetEnabled(idle && service_->GetPreview(preview_token_));
    reset_->SetEnabled(idle && service_->CanChangeAppearance());
    discard_->SetEnabled(!closed_ && !confirming_ && !choosing_ &&
                         (operation_owned_ || !preview_token_.empty()));
  }
  bool Begin() {
    if (!browser_ || !service_ || !service_->enabled() || choosing_ ||
        confirming_ || exporting_ || service_->busy()) {
      return false;
    }
    operation_owned_ = true;
    // No nested user actions while a native operation is pending.
    import_->SetEnabled(false);
    creator_->SetEnabled(false);
    refresh_->SetEnabled(false);
    install_->SetEnabled(false);
    apply_->SetEnabled(false);
    try_->SetEnabled(false);
    revert_->SetEnabled(false);
    export_->SetEnabled(false);
    reset_->SetEnabled(false);
    rows_->SetEnabled(false);
    discard_->SetEnabled(true);
    Status(IDS_TAHAI_SKINS_BUSY);
    return true;
  }
  void ClearReview() {
    preview_status_timer_.Stop();
    if (service_ && !preview_token_.empty()) {
      service_->ReleasePreview(preview_token_);
    }
    preview_token_.clear();
    summary_->SetText({});
    image_->SetImage(ui::ImageModel());
    apply_->SetVisible(false);
    review_->SetVisible(false);
  }
  void Refresh() {
    if (!Begin()) {
      Controls();
      if (!service_ || !service_->enabled()) {
        rows_->RemoveAllChildViews();
        ClearReview();
        Status(IDS_TAHAI_SKINS_POLICY_BLOCKED);
      }
      return;
    }
    service_->List(base::BindOnce(&SkinManagerView::OnCatalog,
                                  reply_factory_.GetWeakPtr()));
  }
  void OnCatalog(SkinOperationResult result) {
    operation_owned_ = false;
    rows_->RemoveAllChildViews();
    if (result.status != SkinOperationStatus::kOk) {
      ClearReview();
      Status(result);
    } else {
      Label(rows_, l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_BUILT_IN));
      views::View* palette_row = nullptr;
      size_t palette_index = 0;
      for (const auto& palette : GetTahaiBuiltInSkinCatalog()) {
        if (palette_index++ % 3 == 0) {
          palette_row = Row(rows_);
        }
        auto* button =
            palette_row->AddChildView(std::make_unique<views::MdTextButton>(
                base::BindRepeating(&SkinManagerView::ApplyBuiltIn,
                                    weak_factory_.GetWeakPtr(),
                                    std::string(palette.id)),
                base::UTF8ToUTF16(palette.display_name)));
        button->SetTooltipText(base::UTF8ToUTF16(palette.description));
        button->SetEnabled(service_ && service_->CanChangeAppearance());
      }
      Label(rows_, l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_LOCAL));
      if (result.catalog.empty()) {
        Label(rows_, l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_EMPTY));
      }
      for (const auto& entry : result.catalog) {
        auto* card = rows_->AddChildView(std::make_unique<views::View>());
        card->SetLayoutManager(std::make_unique<views::BoxLayout>(
            views::BoxLayout::Orientation::kVertical, gfx::Insets(8), 6));
        const auto name = base::UTF8ToUTF16(entry.manifest.name);
        Label(card,
              l10n_util::GetStringFUTF16(IDS_TAHAI_SKINS_CATALOG_ENTRY, name,
                                         base::UTF8ToUTF16(entry.manifest.id)));
        auto* buttons = Row(card);
        auto* current = Button(
            buttons, IDS_TAHAI_SKINS_REVIEW,
            base::BindRepeating(&SkinManagerView::ReviewInstalled,
                                weak_factory_.GetWeakPtr(), entry.manifest.id,
                                entry.archive_sha256, false));
        current->SetProperty(views::kElementIdentifierKey,
                             kSkinManagerReviewElementId);
        current->GetViewAccessibility().SetName(l10n_util::GetStringFUTF16(
            IDS_TAHAI_SKINS_REVIEW_ACCESSIBLE, name));
        if (entry.previous_sha256) {
          auto* previous = Button(
              buttons, IDS_TAHAI_SKINS_REVIEW_PREVIOUS,
              base::BindRepeating(&SkinManagerView::ReviewInstalled,
                                  weak_factory_.GetWeakPtr(), entry.manifest.id,
                                  entry.archive_sha256, true));
          previous->SetEnabled(service_ && service_->installation_allowed());
          previous->GetViewAccessibility().SetName(l10n_util::GetStringFUTF16(
              IDS_TAHAI_SKINS_PREVIOUS_ACCESSIBLE, name));
        }
        auto* remove = Button(
            buttons, IDS_TAHAI_SKINS_REMOVE,
            base::BindRepeating(&SkinManagerView::ConfirmRemove,
                                weak_factory_.GetWeakPtr(), entry.manifest.id,
                                entry.archive_sha256));
        remove->GetViewAccessibility().SetName(l10n_util::GetStringFUTF16(
            IDS_TAHAI_SKINS_REMOVE_ACCESSIBLE, name));
      }
      Status(IDS_TAHAI_SKINS_CATALOG_READY);
    }
    Controls();
  }
  void ChooseFile() {
    if (!service_ || !service_->installation_allowed() ||
        !ChromeSelectFilePolicy::FileSelectDialogsAllowed() || !Begin()) {
      return;
    }
    ClearReview();
    operation_owned_ = false;
    choosing_ = true;
    Controls();
    file_dialog_ = ui::SelectFileDialog::Create(
        this, std::make_unique<ChromeSelectFilePolicy>(
                  browser_->tab_strip_model()->GetActiveWebContents()));
    ui::SelectFileDialog::FileTypeInfo types;
    types.extensions = {{FILE_PATH_LITERAL("tahaiskin")}};
    file_dialog_->SelectFile(ui::SelectFileDialog::SELECT_OPEN_FILE,
                             l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_IMPORT),
                             base::FilePath(), &types, 1,
                             FILE_PATH_LITERAL("tahaiskin"),
                             GetWidget()->GetNativeWindow());
  }
  void SaveCreatorKit() {
    if (!ChromeSelectFilePolicy::FileSelectDialogsAllowed() || !Begin()) {
      return;
    }
    operation_owned_ = false;
    choosing_ = true;
    exporting_ = true;
    exporting_skin_ = false;
    Controls();
    file_dialog_ = ui::SelectFileDialog::Create(
        this, std::make_unique<ChromeSelectFilePolicy>(
                  browser_->tab_strip_model()->GetActiveWebContents()));
    ui::SelectFileDialog::FileTypeInfo types;
    types.extensions = {{FILE_PATH_LITERAL("zip")}};
    file_dialog_->SelectFile(
        ui::SelectFileDialog::SELECT_SAVEAS_FILE,
        l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_CREATOR_KIT),
        base::FilePath(FILE_PATH_LITERAL("tahai-skin-creator-kit.zip")), &types,
        1, FILE_PATH_LITERAL("zip"), GetWidget()->GetNativeWindow());
  }
  void OnCreatorKitSaved(bool saved) {
    exporting_ = false;
    Controls();
    Status(saved ? (exporting_skin_ ? IDS_TAHAI_SKINS_EXPORTED
                                    : IDS_TAHAI_SKINS_CREATOR_SAVED)
                 : IDS_TAHAI_SKINS_OPERATION_FAILED);
    exporting_skin_ = false;
  }
  void ExportSkin() {
    if (!service_ || !service_->GetPreview(preview_token_) ||
        !ChromeSelectFilePolicy::FileSelectDialogsAllowed() || !Begin()) {
      return;
    }
    operation_owned_ = false;
    choosing_ = exporting_ = exporting_skin_ = true;
    Controls();
    file_dialog_ = ui::SelectFileDialog::Create(
        this, std::make_unique<ChromeSelectFilePolicy>(
                  browser_->tab_strip_model()->GetActiveWebContents()));
    ui::SelectFileDialog::FileTypeInfo types;
    types.extensions = {{FILE_PATH_LITERAL("tahaiskin")}};
    file_dialog_->SelectFile(
        ui::SelectFileDialog::SELECT_SAVEAS_FILE,
        l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_EXPORT),
        base::FilePath(FILE_PATH_LITERAL("reviewed-skin.tahaiskin")), &types, 1,
        FILE_PATH_LITERAL("tahaiskin"), GetWidget()->GetNativeWindow());
  }
  void FileSelected(const ui::SelectedFileInfo& file, int index) override {
    choosing_ = false;
    file_dialog_.reset();
    if (exporting_) {
      if (!service_ || !service_->enabled() ||
          !ChromeSelectFilePolicy::FileSelectDialogsAllowed() ||
          !file.path().IsAbsolute() || file.path().ReferencesParent() ||
          file.path().value().starts_with(L"\\\\")) {
        OnCreatorKitSaved(false);
        return;
      }
      auto data =
          exporting_skin_
              ? service_->ExportPreview(preview_token_)
              : ui::ResourceBundle::GetSharedInstance().LoadDataResourceString(
                    IDR_TAHAI_SKIN_CREATOR_KIT);
      base::ThreadPool::PostTaskAndReplyWithResult(
          FROM_HERE,
          {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
           base::TaskShutdownBehavior::BLOCK_SHUTDOWN},
          base::BindOnce(
              [](base::FilePath path, std::string bytes) {
                return !bytes.empty() &&
                       base::ImportantFileWriter::WriteFileAtomically(path,
                                                                      bytes);
              },
              file.path(), std::move(data)),
          base::BindOnce(&SkinManagerView::OnCreatorKitSaved,
                         reply_factory_.GetWeakPtr()));
      return;
    }
    if (!service_ || !service_->installation_allowed() ||
        !ChromeSelectFilePolicy::FileSelectDialogsAllowed() || !Begin()) {
      Controls();
      Status(IDS_TAHAI_SKINS_POLICY_BLOCKED);
      return;
    }
    review_kind_ = ReviewKind::kFile;
    service_->PreviewFile(file.path(),
                          base::BindOnce(&SkinManagerView::OnPreview,
                                         reply_factory_.GetWeakPtr()));
  }
  void FileSelectionCanceled() override {
    choosing_ = false;
    exporting_ = false;
    exporting_skin_ = false;
    file_dialog_.reset();
    Controls();
    Status(IDS_TAHAI_SKINS_CANCELLED);
  }
  void ReviewInstalled(std::string id, std::string hash, bool previous) {
    if (!Begin()) {
      return;
    }
    ClearReview();
    review_kind_ = previous ? ReviewKind::kPrevious : ReviewKind::kInstalled;
    service_->PreviewInstalled(std::move(id), std::move(hash), previous,
                               base::BindOnce(&SkinManagerView::OnPreview,
                                              reply_factory_.GetWeakPtr()));
  }
  void OnPreview(SkinOperationResult result) {
    operation_owned_ = false;
    const auto* skin =
        service_ ? service_->GetPreview(result.preview_token) : nullptr;
    if (result.status != SkinOperationStatus::kOk || !skin) {
      ClearReview();
      Status(result);
      Controls();
      return;
    }
    preview_token_ = result.preview_token;
    summary_->SetText(l10n_util::GetStringFUTF16(
        IDS_TAHAI_SKINS_REVIEW_DETAILS, base::UTF8ToUTF16(skin->manifest.name),
        base::UTF8ToUTF16(skin->manifest.id),
        base::UTF8ToUTF16(skin->manifest.creator),
        base::UTF8ToUTF16(skin->manifest.license),
        base::UTF8ToUTF16(skin->archive_sha256)));
    for (const auto& asset : skin->manifest.assets) {
      if (asset.purpose != TahaiSkinAssetPurpose::kPreview) {
        continue;
      }
      const auto image =
          std::ranges::find(skin->assets, asset.path, &DecodedSkinAsset::path);
      if (image != skin->assets.end()) {
        image_->SetImage(ui::ImageModel::FromImageSkia(
            gfx::ImageSkia::CreateFrom1xBitmap(image->bitmap)));
        const double scale =
            std::min(1.0, std::min(320.0 / image->bitmap.width(),
                                   180.0 / image->bitmap.height()));
        image_->SetImageSize(gfx::Size(
            std::max(1, static_cast<int>(image->bitmap.width() * scale)),
            std::max(1, static_cast<int>(image->bitmap.height() * scale))));
      }
    }
    const bool exists =
        std::ranges::any_of(result.catalog, [&](const StoredSkinInfo& item) {
          return item.manifest.id == skin->manifest.id;
        });
    install_->SetText(l10n_util::GetStringUTF16(
        review_kind_ == ReviewKind::kPrevious ? IDS_TAHAI_SKINS_RESTORE
        : exists                              ? IDS_TAHAI_SKINS_UPDATE
                                              : IDS_TAHAI_SKINS_INSTALL));
    install_->SetVisible(review_kind_ != ReviewKind::kInstalled);
    apply_->SetVisible(review_kind_ == ReviewKind::kInstalled);
    review_->SetVisible(true);
    Status(IDS_TAHAI_SKINS_REVIEW_READY);
    Controls();
  }
  void ConfirmInstall() {
    if (!browser_ || !service_ || confirming_ ||
        !service_->PreviewCanBeInstalled(preview_token_)) {
      return;
    }
    confirming_ = true;
    Controls();
    auto model =
        ui::DialogModel::Builder()
            .SetTitle(l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_CONFIRM_STORE))
            .AddParagraph(ui::DialogModelLabel(l10n_util::GetStringUTF16(
                IDS_TAHAI_SKINS_CONFIRM_STORE_DETAIL)))
            .AddParagraph(
                ui::DialogModelLabel(std::u16string(summary_->GetText())))
            .AddOkButton(base::BindOnce(&SkinManagerView::Install,
                                        weak_factory_.GetWeakPtr(),
                                        preview_token_))
            .AddCancelButton(base::BindOnce(&SkinManagerView::EndConfirmation,
                                            weak_factory_.GetWeakPtr()))
            .SetDialogDestroyingCallback(base::BindOnce(
                &SkinManagerView::EndConfirmation, weak_factory_.GetWeakPtr()))
            .Build();
    chrome::ShowBrowserModal(browser_.get(), std::move(model));
  }
  void EndConfirmation() {
    confirming_ = false;
    Controls();
  }
  void Install(std::string token) {
    confirming_ = false;
    if (!Begin()) {
      Controls();
      return;
    }
    service_->InstallPreview(std::move(token),
                             base::BindOnce(&SkinManagerView::OnMutation,
                                            reply_factory_.GetWeakPtr()));
  }
  void ConfirmRemove(std::string id, std::string hash) {
    if (!browser_ || !service_ || !service_->enabled() || service_->busy() ||
        confirming_) {
      return;
    }
    confirming_ = true;
    Controls();
    auto model =
        ui::DialogModel::Builder()
            .SetTitle(l10n_util::GetStringFUTF16(IDS_TAHAI_SKINS_CONFIRM_REMOVE,
                                                 base::UTF8ToUTF16(id)))
            .AddParagraph(ui::DialogModelLabel(l10n_util::GetStringUTF16(
                IDS_TAHAI_SKINS_CONFIRM_REMOVE_DETAIL)))
            .AddOkButton(base::BindOnce(&SkinManagerView::Remove,
                                        weak_factory_.GetWeakPtr(),
                                        std::move(id), std::move(hash)))
            .AddCancelButton(base::BindOnce(&SkinManagerView::EndConfirmation,
                                            weak_factory_.GetWeakPtr()))
            .SetDialogDestroyingCallback(base::BindOnce(
                &SkinManagerView::EndConfirmation, weak_factory_.GetWeakPtr()))
            .Build();
    chrome::ShowBrowserModal(browser_.get(), std::move(model));
  }
  void Remove(std::string id, std::string hash) {
    confirming_ = false;
    if (!Begin()) {
      Controls();
      return;
    }
    service_->Remove(std::move(id), std::move(hash),
                     base::BindOnce(&SkinManagerView::OnMutation,
                                    reply_factory_.GetWeakPtr()));
  }
  void OnMutation(SkinOperationResult result) {
    operation_owned_ = false;
    ClearReview();
    if (result.status == SkinOperationStatus::kOk) {
      Refresh();
    }
    Status(result);
    Controls();
  }
  void Discard() {
    reply_factory_.InvalidateWeakPtrs();
    if (operation_owned_ && service_) {
      service_->Cancel();
    }
    operation_owned_ = false;
    ClearReview();
    Controls();
    Status(IDS_TAHAI_SKINS_CANCELLED);
  }
  void ApplyAppearance() {
    if (!browser_ || !service_ || review_kind_ != ReviewKind::kInstalled) {
      return;
    }
    if (!service_->ApplyPreview(preview_token_)) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      Controls();
      return;
    }
    Status(IDS_TAHAI_SKINS_APPLIED);
    preview_status_timer_.Stop();
    Controls();
  }
  void ResetAppearance() {
    if (!browser_) {
      return;
    }
    Status(service_ && service_->ResetAppearance()
               ? IDS_TAHAI_SKINS_RESET_COMPLETE
               : IDS_TAHAI_SKINS_POLICY_BLOCKED);
    Controls();
  }
  void ApplyBuiltIn(std::string id) {
    if (service_ && service_->ApplyBuiltIn(id)) {
      preview_status_timer_.Stop();
      Status(IDS_TAHAI_SKINS_APPLIED);
      Controls();
    }
  }
  void TryAppearance() {
    if (!service_ || !service_->BeginLivePreview(preview_token_)) {
      return;
    }
    Status(IDS_TAHAI_SKINS_TRY_ACTIVE);
    Controls();
    preview_status_timer_.Start(
        FROM_HERE, base::Milliseconds(250),
        base::BindRepeating(&SkinManagerView::UpdatePreviewStatus,
                            weak_factory_.GetWeakPtr()));
  }
  void UpdatePreviewStatus() {
    if (!service_ || !service_->live_preview_active()) {
      preview_status_timer_.Stop();
      Status(IDS_TAHAI_SKINS_TRY_ENDED);
      Controls();
    }
  }
  void RevertAppearance() {
    if (service_) {
      service_->EndLivePreview();
    }
    UpdatePreviewStatus();
  }
  void OnPolicyChanged() {
    exporting_ = false;
    // Re-enabling policy later does not revive a chooser opened under the old
    // authorization. Late OS results must have no listener/operation to target.
    if (file_dialog_) {
      file_dialog_->ListenerDestroyed();
      file_dialog_.reset();
      choosing_ = false;
      exporting_ = false;
    }
    Discard();
    rows_->RemoveAllChildViews();
    // The profile owner's pref observer may run after ours; refresh only once
    // all policy observers have revoked their in-flight callbacks.
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce(&SkinManagerView::Refresh, weak_factory_.GetWeakPtr()));
  }
  void WindowClosing() override {
    Detach();
    import_ = nullptr;
    creator_ = nullptr;
    refresh_ = nullptr;
    discard_ = nullptr;
    install_ = nullptr;
    apply_ = nullptr;
    try_ = nullptr;
    revert_ = nullptr;
    export_ = nullptr;
    reset_ = nullptr;
    status_ = nullptr;
    summary_ = nullptr;
    image_ = nullptr;
    review_ = nullptr;
    rows_ = nullptr;
    contents_ = nullptr;
    views::DialogDelegate::WindowClosing();
  }
  void Detach() {
    if (closed_) {
      return;
    }
    closed_ = true;
    pref_changes_.RemoveAll();
    reply_factory_.InvalidateWeakPtrs();
    if (file_dialog_) {
      file_dialog_->ListenerDestroyed();
      file_dialog_.reset();
    }
    if (operation_owned_ && service_) {
      service_->Cancel();
    }
    ClearReview();
    auto found = OpenManagers().find(profile_key_);
    if (found != OpenManagers().end() && found->second.get() == this) {
      OpenManagers().erase(found);
    }
    profile_key_ = nullptr;
    weak_factory_.InvalidateWeakPtrs();
  }

  base::WeakPtr<Browser> browser_;
  // Only an opaque registry key. Never dereferenced after profile shutdown.
  raw_ptr<Profile> profile_key_;
  base::WeakPtr<SkinProfileService> service_;
  raw_ptr<views::View> contents_ = nullptr;
  scoped_refptr<ui::SelectFileDialog> file_dialog_;
  PrefChangeRegistrar pref_changes_;
  raw_ptr<views::MdTextButton> import_ = nullptr;
  raw_ptr<views::MdTextButton> creator_ = nullptr;
  raw_ptr<views::MdTextButton> refresh_ = nullptr;
  raw_ptr<views::MdTextButton> discard_ = nullptr;
  raw_ptr<views::MdTextButton> install_ = nullptr;
  raw_ptr<views::MdTextButton> apply_ = nullptr;
  raw_ptr<views::MdTextButton> try_ = nullptr;
  raw_ptr<views::MdTextButton> revert_ = nullptr;
  raw_ptr<views::MdTextButton> export_ = nullptr;
  raw_ptr<views::MdTextButton> reset_ = nullptr;
  raw_ptr<views::Label> status_ = nullptr;
  raw_ptr<views::Label> summary_ = nullptr;
  raw_ptr<views::ImageView> image_ = nullptr;
  raw_ptr<views::View> review_ = nullptr;
  raw_ptr<views::View> rows_ = nullptr;
  std::string preview_token_;
  ReviewKind review_kind_ = ReviewKind::kFile;
  bool operation_owned_ = false;
  bool confirming_ = false;
  bool choosing_ = false;
  bool exporting_ = false;
  bool exporting_skin_ = false;
  base::RepeatingTimer preview_status_timer_;
  bool closed_ = false;
  base::WeakPtrFactory<SkinManagerView> reply_factory_{this};
  base::WeakPtrFactory<SkinManagerView> weak_factory_{this};
};
}  // namespace

bool CanShowSkinManager(Browser* browser) {
  return browser && browser->is_type_normal() &&
         browser->GetProfile()->IsRegularProfile() &&
         !browser->GetProfile()->IsOffTheRecord() &&
         !browser->GetProfile()->IsGuestSession() &&
         !browser->GetProfile()->IsSystemProfile();
}

void ShowSkinManager(Browser* browser) {
  if (!CanShowSkinManager(browser)) {
    return;
  }
  auto found = OpenManagers().find(browser->GetProfile());
  if (found != OpenManagers().end() && found->second) {
    found->second->GetWidget()->Show();
    found->second->GetWidget()->Activate();
    return;
  }
  auto* view = new SkinManagerView(browser);
  OpenManagers()[browser->GetProfile()] = view->GetWeakPtr();
  views::DialogDelegate::CreateDialogWidget(
      view, browser->GetWindow()->GetNativeWindow(),
      browser->GetWindow()->GetNativeWindow())
      ->Show();
}
}  // namespace tahai::skins
