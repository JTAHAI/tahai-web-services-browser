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
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_skins/skin_profile_service.h"
#include "chrome/browser/tahai_skins/skin_profile_service_factory.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/dialogs/browser_dialogs.h"
#include "chrome/browser/ui/select_file_policy/chrome_select_file_policy.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/browser/ui/tahai/tahai_operational_skin_controller.h"
#include "chrome/browser/ui/tahai/tahai_operational_workflow_queue.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
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
#include "ui/views/controls/button/checkbox.h"
#include "ui/views/controls/image_view.h"
#include "ui/views/controls/label.h"
#include "ui/views/controls/scroll_view.h"
#include "ui/views/controls/textarea/textarea.h"
#include "ui/views/controls/textfield/textfield.h"
#include "ui/views/layout/box_layout.h"
#include "ui/views/view_class_properties.h"
#include "ui/views/widget/widget.h"
#include "ui/views/window/dialog_delegate.h"

namespace tahai::skins {
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerImportElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerInstallElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPreviewElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerReviewElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerTrustReviewElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerRevisionReviewElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerRevisionDiffElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerRevisionAckElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPublishersElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPublisherKeyIdElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPublisherKeyElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPublisherReviewKeyElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerPublisherRevokeElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerApplyElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerApplyWindowElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerResetWindowElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerResetElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerActivateModeElementId);
DEFINE_ELEMENT_IDENTIFIER_VALUE(kSkinManagerActivateCustomModeElementId);
namespace {

std::u16string CapabilityLabel(TahaiOperationalCapability capability) {
  switch (capability) {
    case TahaiOperationalCapability::kBrowserNavigation: return u"Browser navigation";
    case TahaiOperationalCapability::kWorkspaceLayout: return u"Workspace layout";
    case TahaiOperationalCapability::kMissionChecklist: return u"Mission checklist";
    case TahaiOperationalCapability::kGuardControl: return u"Guard controls";
  }
}

std::u16string RevisionSummary(const SkinRevisionReview& review, bool compact = false) {
  std::u16string text = u"Replacing installed revision:\n" +
      base::UTF8ToUTF16(review.current_sha256) + u"\nWith reviewed revision:\n" +
      base::UTF8ToUTF16(review.candidate_sha256);
  const auto describe = [](bool operational,
                           const std::optional<SkinPublisherReview>& publisher) {
    if (!operational) return std::u16string(u"appearance-only; no operational publisher authority");
    if (!publisher) return std::u16string(u"NOT verified under current trust; historical bytes only");
    return (publisher->locally_enrolled ? u"locally enrolled / " : u"mandatory policy / ") +
        base::UTF8ToUTF16(publisher->key_id) + u" / SHA-256 " +
        base::UTF8ToUTF16(publisher->public_key_sha256);
  };
  if (!compact) {
    text += u"\nInstalled publisher: " + describe(review.current_operational, review.current_publisher);
    text += u"\nCandidate publisher: " + describe(review.candidate_operational, review.candidate_publisher);
  }
  if (review.current_publisher && review.candidate_publisher) {
    text += review.current_publisher->public_key_sha256 == review.candidate_publisher->public_key_sha256
        ? u"\nSigning public key unchanged."
        : u"\nWARNING: Signing public key CHANGED. Verify the new key independently.";
  } else if (review.current_operational || review.candidate_operational) {
    text += u"\nPublisher continuity is NOT established across these revisions.";
  }
  text += u"\nAdded capabilities:";
  if (review.added_capabilities.empty()) text += u" none.";
  for (auto cap : review.added_capabilities) text += u"\n+ " + CapabilityLabel(cap);
  text += u"\nRemoved capabilities:";
  if (review.removed_capabilities.empty()) text += u" none.";
  for (auto cap : review.removed_capabilities) text += u"\n- " + CapabilityLabel(cap);
  text += compact
      ? u"\nOnly these reviewed revisions are confirmed. No automatic activation or external grants."
      : u"\nThe definition comparison below includes appearance, assets, layouts, modes, inputs and steps. Installation does not apply the skin, migrate pinned runs or grant external permissions. Rollback also requires this review.";
  return text;
}

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
                     ->GetWeakPtr()),
        mode_service_(ModeServiceFactory::GetForProfile(browser->GetProfile())) {
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
    reset_window_ = contents_->AddChildView(std::make_unique<views::MdTextButton>(
        base::BindRepeating(&SkinManagerView::ResetWindowAppearance,
                            weak_factory_.GetWeakPtr()),
        u"Use profile appearance in this window"));
    reset_window_->SetProperty(views::kElementIdentifierKey,
                               kSkinManagerResetWindowElementId);
    status_ = Label(contents_.get(), {});
    publishers_ = contents_->AddChildView(std::make_unique<views::MdTextButton>(
        base::BindRepeating(&SkinManagerView::TogglePublishers, weak_factory_.GetWeakPtr()),
        u"Manage local publisher trust"));
    publishers_->SetProperty(views::kElementIdentifierKey, kSkinManagerPublishersElementId);
    auto* scroll =
        contents_->AddChildView(std::make_unique<views::ScrollView>());
    scroll->ClipHeightTo(180, 540);
    layout->SetFlexForView(scroll, 1);
    auto* body = scroll->SetContents(std::make_unique<views::View>());
    body->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(), 12));
    publisher_panel_ = body->AddChildView(std::make_unique<views::View>());
    publisher_panel_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(8), 8));
    Label(publisher_panel_, u"Trust a creator's signing PUBLIC key only after independently verifying its fingerprint. Never paste a private key. This is profile-local trust, not identity verification or a website permission. Mandatory publisher policy overrides local keys.");
    Label(publisher_panel_, u"Signing key ID (lowercase letters, digits and hyphens)");
    publisher_key_id_ = publisher_panel_->AddChildView(std::make_unique<views::Textfield>());
    publisher_key_id_->SetProperty(views::kElementIdentifierKey, kSkinManagerPublisherKeyIdElementId);
    publisher_key_id_->GetViewAccessibility().SetName(u"Signing key ID");
    Label(publisher_panel_, u"Ed25519 PUBLIC key (64 lowercase hexadecimal characters)");
    publisher_key_ = publisher_panel_->AddChildView(std::make_unique<views::Textfield>());
    publisher_key_->SetProperty(views::kElementIdentifierKey, kSkinManagerPublisherKeyElementId);
    publisher_key_->GetViewAccessibility().SetName(u"Ed25519 public key, not a private key");
    publisher_review_key_ = publisher_panel_->AddChildView(std::make_unique<views::MdTextButton>(
        base::BindRepeating(&SkinManagerView::ReviewPublisherKey, weak_factory_.GetWeakPtr()), u"Review public-key fingerprint"));
    publisher_review_key_->SetProperty(views::kElementIdentifierKey, kSkinManagerPublisherReviewKeyElementId);
    publisher_rows_ = publisher_panel_->AddChildView(std::make_unique<views::View>());
    publisher_rows_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(), 8));
    publisher_panel_->SetVisible(false);
    review_ = body->AddChildView(std::make_unique<views::View>());
    review_->SetLayoutManager(std::make_unique<views::BoxLayout>(
        views::BoxLayout::Orientation::kVertical, gfx::Insets(8), 8));
    summary_ = Label(review_, {});
    trust_review_ = Label(review_, {});
    trust_review_->SetProperty(views::kElementIdentifierKey, kSkinManagerTrustReviewElementId);
    trust_review_->SetAllowCharacterBreak(true);
    trust_review_->SetSelectable(true);
    revision_review_ = Label(review_, {});
    revision_review_->SetProperty(views::kElementIdentifierKey, kSkinManagerRevisionReviewElementId);
    revision_review_->SetAllowCharacterBreak(true);
    revision_review_->SetSelectable(true);
    revision_diff_ = review_->AddChildView(std::make_unique<views::Textarea>());
    revision_diff_->SetProperty(views::kElementIdentifierKey, kSkinManagerRevisionDiffElementId);
    revision_diff_->SetReadOnly(true);
    revision_diff_->GetViewAccessibility().SetName(u"Installed to proposed skin definition changes. Minus is installed; plus is proposed. Paths are JSON Pointers with zero-based array positions.");
    revision_diff_->SetPreferredSize(gfx::Size(580, 200));
    revision_ack_ = review_->AddChildView(std::make_unique<views::Checkbox>(
        u"I reviewed the revision, publisher and capability changes above.",
        base::BindRepeating(&SkinManagerView::Controls, weak_factory_.GetWeakPtr())));
    revision_ack_->SetProperty(views::kElementIdentifierKey, kSkinManagerRevisionAckElementId);
    revision_ack_->SetMultiLine(true);
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
    apply_->SetText(u"Apply as profile default");
    apply_window_ = review_->AddChildView(std::make_unique<views::MdTextButton>(
        base::BindRepeating(&SkinManagerView::ApplyWindowAppearance,
                            weak_factory_.GetWeakPtr()),
        u"Apply to this window"));
    apply_window_->SetProperty(views::kElementIdentifierKey,
                               kSkinManagerApplyWindowElementId);
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
         {prefs::kTahaiSkinsEnabled, prefs::kTahaiSkinInstallationsAllowed,
          prefs::kTahaiOperationalSkinTrustedKeys, prefs::kTahaiLocalSkinTrustedKeys}) {
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
  void SelectTargetWindow(Browser* browser) {
    if (browser_.get() == browser) {
      return;
    }
    // Do not redirect an outstanding chooser/confirmation to a different
    // window. A new idle invocation starts a fresh review for its target.
    if (!browser || browser->GetProfile() != profile_key_ || !service_ ||
        service_->busy() || choosing_ || confirming_ || exporting_) {
      Status(IDS_TAHAI_SKINS_BUSY);
      return;
    }
    browser_ = browser->AsWeakPtr();
    Refresh();
  }

 private:
  enum class ReviewKind { kFile, kInstalled, kPrevious };
  void TogglePublishers() {
    if (!service_ || service_->busy() || confirming_) return;
    publisher_panel_->SetVisible(!publisher_panel_->GetVisible());
    PopulatePublishers();
    if (publisher_panel_->GetVisible()) {
      publisher_panel_->ScrollViewToVisible();
      if (publisher_key_id_->GetEnabled()) publisher_key_id_->RequestFocus();
    }
  }
  void PopulatePublishers() {
    publisher_rows_->RemoveAllChildViews();
    if (!service_) return;
    Label(publisher_rows_, service_->CanEnrollLocalPublisher()
        ? u"Local keys can authorize signed packages after separate import review. Up to 32 keys; replacing an ID requires explicit revocation first."
        : u"Enrollment unavailable: mandatory policy, installation restrictions or profile state take precedence. Local keys below may be suspended by policy.");
    const auto keys = service_->GetLocalPublishers();
    const auto generation = service_->local_publisher_generation();
    if (!keys) {
      Label(publisher_rows_, u"Local key data is invalid or unavailable. No partial list is trusted. Clear local trust to recover; installed packages are kept.");
    } else if (keys->empty()) {
      Label(publisher_rows_, u"No locally enrolled publishers.");
    } else {
      for (const auto& key : *keys) {
        auto* label = Label(publisher_rows_, base::UTF8ToUTF16(key.key_id) +
            u"\nPublic-key SHA-256: " + base::UTF8ToUTF16(key.public_key_sha256));
        label->SetAllowCharacterBreak(true);
        label->SetSelectable(true);
        auto* revoke = publisher_rows_->AddChildView(std::make_unique<views::MdTextButton>(
            base::BindRepeating(&SkinManagerView::ConfirmRevokePublisher, weak_factory_.GetWeakPtr(),
                key.key_id, key.public_key_sha256, generation), u"Revoke this local key"));
        revoke->SetProperty(views::kElementIdentifierKey, kSkinManagerPublisherRevokeElementId);
      }
    }
    publisher_rows_->AddChildView(std::make_unique<views::MdTextButton>(
        base::BindRepeating(&SkinManagerView::ConfirmRevokePublisher,
            weak_factory_.GetWeakPtr(), std::string(), std::string(), generation),
        u"Clear all local publisher trust"));
  }
  void ReviewPublisherKey() {
    if (!browser_ || !service_ || confirming_ || !service_->CanEnrollLocalPublisher()) return;
    std::optional<LocalPublisherEnrollmentReview> review;
    if (publisher_key_id_->GetText().size() <= 64 && publisher_key_->GetText().size() == 64) {
      review = service_->ReviewLocalPublisher(base::UTF16ToUTF8(publisher_key_id_->GetText()),
                                              base::UTF16ToUTF8(publisher_key_->GetText()));
    }
    publisher_key_->SetText({});
    publisher_key_id_->SetText({});
    if (!review) {
      status_->SetText(u"Key not accepted. Use a new valid key ID and a 64-character lowercase Ed25519 public key. Existing IDs, invalid local data, policy restrictions and the 32-key limit require attention.");
      return;
    }
    if (!ClearReview()) {
      return;
    }
    confirming_ = true;
    Controls();
    auto model = ui::DialogModel::Builder()
        .SetTitle(u"Trust this local publisher?")
        .AddParagraph(ui::DialogModelLabel(u"Compare this fingerprint through an independent trusted channel. Trust permits future signature-verified operational packages from this key to enter review, not automatic installation, website access or external actions. The key ID is self-described, not a verified person or organization."))
        .AddParagraph(ui::DialogModelLabel(u"Key ID: " + base::UTF8ToUTF16(review->key_id) +
            u"\nPublic-key SHA-256: " + base::UTF8ToUTF16(review->public_key_sha256)))
        .AddOkButton(base::BindOnce(&SkinManagerView::EnrollPublisher, weak_factory_.GetWeakPtr(), *review))
        .AddCancelButton(base::BindOnce(&SkinManagerView::EndConfirmation, weak_factory_.GetWeakPtr()))
        .SetDialogDestroyingCallback(base::BindOnce(&SkinManagerView::EndConfirmation, weak_factory_.GetWeakPtr()))
        .Build();
    chrome::ShowBrowserModal(browser_.get(), std::move(model));
  }
  void EnrollPublisher(LocalPublisherEnrollmentReview review) {
    confirming_ = false;
    if (!service_ || !service_->EnrollLocalPublisher(review)) {
      status_->SetText(u"Trust was not changed. The review is stale, policy changed, or the key is not valid. Review again.");
      Controls();
      return;
    }
    status_->SetText(u"Public key enrolled for this profile. Import and review the signed package separately. No package was installed or activated.");
    PopulatePublishers();
    Controls();
  }
  void ConfirmRevokePublisher(std::string id, std::string fingerprint,
                              base::UnguessableToken generation) {
    if (!browser_ || !service_ || service_->busy() || confirming_) return;
    confirming_ = true;
    Controls();
    auto model = ui::DialogModel::Builder()
        .SetTitle(u"Revoke local publisher trust?")
        .AddParagraph(ui::DialogModelLabel(id.empty()
            ? u"Clear ALL locally enrolled signing keys in this profile?"
            : u"Revoke key " + base::UTF8ToUTF16(id) + u"\nPublic-key SHA-256: " + base::UTF8ToUTF16(fingerprint)))
        .AddParagraph(ui::DialogModelLabel(u"Local operational authority and pending reviews are invalidated immediately. Installed archives and Mission history are kept. This cannot undo prior actions and does not modify mandatory publisher policy."))
        .AddOkButton(base::BindOnce(&SkinManagerView::RevokePublisher, weak_factory_.GetWeakPtr(), id, fingerprint, generation))
        .AddCancelButton(base::BindOnce(&SkinManagerView::EndConfirmation, weak_factory_.GetWeakPtr()))
        .SetDialogDestroyingCallback(base::BindOnce(&SkinManagerView::EndConfirmation, weak_factory_.GetWeakPtr()))
        .Build();
    chrome::ShowBrowserModal(browser_.get(), std::move(model));
  }
  void RevokePublisher(std::string id, std::string fingerprint,
                       base::UnguessableToken generation) {
    confirming_ = false;
    const bool changed = service_ && (id.empty() ? service_->ClearLocalPublishers(generation)
        : service_->RemoveLocalPublisher(id, fingerprint, generation));
    status_->SetText(changed ? u"Local trust revoked; archives and run history retained."
                            : u"Trust was not changed. Review is stale or policy/profile state forbids the change.");
    PopulatePublishers();
    Controls();
  }
  WindowModeController* TargetController() const {
    return WindowModeController::GetForBrowser(browser_.get());
  }
  const TahaiOperationalSkinManifest* EffectiveOperationalManifest() const {
    const auto* controller = TargetController();
    return controller ? controller->operational_manifest() : nullptr;
  }
  std::optional<std::string> EffectiveArchiveSha256() const {
    const auto* controller = TargetController();
    return controller ? controller->operational_archive_sha256() : std::nullopt;
  }

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
      case SkinOperationStatus::kUntrusted:
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
    publishers_->SetEnabled(idle);
    publisher_key_id_->SetEnabled(idle && service_->CanEnrollLocalPublisher());
    publisher_key_->SetEnabled(idle && service_->CanEnrollLocalPublisher());
    publisher_review_key_->SetEnabled(idle && service_->CanEnrollLocalPublisher());
    publisher_rows_->SetEnabled(idle);
    refresh_->SetEnabled(idle);
    rows_->SetEnabled(idle);
    install_->SetEnabled(idle &&
                         service_->PreviewCanBeInstalled(preview_token_) &&
                         (!service_->GetPreviewRevisionReview(preview_token_) || revision_ack_->GetChecked()));
    revision_ack_->SetEnabled(idle);
    apply_->SetEnabled(idle && service_->CanApplyPreview(preview_token_));
    apply_window_->SetEnabled(idle && service_->CanApplyPreview(preview_token_));
    reset_window_->SetEnabled(idle);
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
    apply_window_->SetEnabled(false);
    reset_window_->SetEnabled(false);
    try_->SetEnabled(false);
    revert_->SetEnabled(false);
    export_->SetEnabled(false);
    reset_->SetEnabled(false);
    rows_->SetEnabled(false);
    discard_->SetEnabled(true);
    Status(IDS_TAHAI_SKINS_BUSY);
    return true;
  }
  bool ClearReview() {
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    preview_status_timer_.Stop();
    const auto service = service_;
    const std::string token = std::exchange(preview_token_, {});
    summary_->SetText({});
    trust_review_->SetText({});
    revision_review_->SetText({});
    revision_diff_->SetText({});
    revision_ack_->SetChecked(false);
    image_->SetImage(ui::ImageModel());
    apply_->SetVisible(false);
    apply_window_->SetVisible(false);
    review_->SetVisible(false);
    if (service && !token.empty()) {
      service->ReleasePreview(token);
    }
    return alive && (closed_ || (target && browser_.get() == target.get()));
  }
  void Refresh() {
    if (!Begin()) {
      Controls();
      if (!service_ || !service_->enabled()) {
        rows_->RemoveAllChildViews();
        if (!ClearReview()) {
          return;
        }
        Status(IDS_TAHAI_SKINS_POLICY_BLOCKED);
      }
      return;
    }
    service_->List(base::BindOnce(&SkinManagerView::OnCatalog,
                                  reply_factory_.GetWeakPtr()));
  }
  void OnCatalog(SkinOperationResult result) {
    operation_owned_ = false;
    PopulatePublishers();
    rows_->RemoveAllChildViews();
    if (result.status != SkinOperationStatus::kOk) {
      if (!ClearReview()) {
        return;
      }
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
      const TahaiOperationalSkinManifest* operational =
          EffectiveOperationalManifest();
      if (operational) {
        Label(rows_, u"Active operational skin modes");
        for (const TahaiOperationalMode& mode : operational->modes) {
          auto* activate =
              rows_->AddChildView(std::make_unique<views::MdTextButton>(
                  base::BindRepeating(&SkinManagerView::ActivateOperationalMode,
                                      weak_factory_.GetWeakPtr(), mode.id),
                  base::UTF8ToUTF16("Activate " + mode.name)));
          activate->SetProperty(views::kElementIdentifierKey,
                                kSkinManagerActivateModeElementId);
          activate->SetTooltipText(
              u"Applies this mode's workspace and opens its local workflow.");
          activate->SetEnabled(
              BuildTahaiOperationalSkinActivation(*operational, mode.id)
                  .has_value());
        }
      }
      if (mode_service_ && !mode_service_->custom_modes().empty()) {
        Label(rows_, u"Saved custom modes");
        for (const TahaiCustomModeDefinition& mode : mode_service_->custom_modes()) {
          auto* activate = rows_->AddChildView(
              std::make_unique<views::MdTextButton>(
                  base::BindRepeating(&SkinManagerView::ActivateCustomMode,
                                      weak_factory_.GetWeakPtr(), mode.id),
                  base::UTF8ToUTF16("Activate " + mode.title)));
          activate->SetProperty(views::kElementIdentifierKey,
                                kSkinManagerActivateCustomModeElementId);
          activate->SetTooltipText(
              mode.native_presentation
                  ? u"Restores the saved workspace and reverifies any pinned "
                    u"skin. No controls run automatically."
                  : u"Requires the exact reviewed operational skin revision.");
          activate->SetEnabled(
              mode.native_presentation.has_value() ||
              (operational && mode.operational_skin &&
               mode.operational_skin->id == operational->appearance.id &&
               mode.operational_skin->archive_sha256 == EffectiveArchiveSha256() &&
               BuildTahaiCustomModeActivation(*operational, mode).has_value()));
        }
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
    if (!ClearReview()) {
      return;
    }
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
    if (!ClearReview()) {
      return;
    }
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
      if (!ClearReview()) {
        return;
      }
      Status(result);
      Controls();
      return;
    }
    preview_token_ = result.preview_token;
    std::u16string trust_text = u"Appearance-only package. The creator name is self-described, not a verified publisher identity. No operational capabilities are granted.";
    if (skin->operational_manifest) {
      const auto publisher = service_->GetPreviewPublisherReview(preview_token_);
      if (!publisher) {
        if (!ClearReview()) {
          return;
        }
        Status(SkinOperationResult{SkinOperationStatus::kUntrusted, std::nullopt, std::nullopt, {}, {}});
        Controls();
        return;
      }
      trust_text = std::u16string(publisher->locally_enrolled
          ? u"Operational signature verified against a public key you explicitly enrolled in this profile.\nSigning key: "
          : u"Operational signature verified against mandatory publisher policy at review.\nSigning key: ") +
          base::UTF8ToUTF16(publisher->key_id) + u"\nPublic-key SHA-256: " +
          base::UTF8ToUTF16(publisher->public_key_sha256) +
          u"\nThe creator name is self-described; this verifies a signing key, not a real-world organization.\nDeclared capabilities:";
      for (const auto capability : skin->operational_manifest->capabilities) {
        switch (capability) {
          case TahaiOperationalCapability::kBrowserNavigation:
            trust_text += u"\n• Browser navigation — focus the address field.";
            break;
          case TahaiOperationalCapability::kWorkspaceLayout:
            trust_text += u"\n• Workspace layout — change panes and open Finder/workspaces.";
            break;
          case TahaiOperationalCapability::kMissionChecklist:
            trust_text += u"\n• Mission checklist — create and manage a local workflow run.";
            break;
          case TahaiOperationalCapability::kGuardControl:
            trust_text += u"\n• Guard controls — open the browser-owned Guard controls, not bypass filtering.";
            break;
        }
      }
      if (skin->operational_manifest->capabilities.empty()) trust_text += u" none.";
      trust_text += u"\nInstallation rechecks current trust and policy and does not grant website data, credentials, connectors, or permission to send, publish or delete. New permissions are never accepted automatically.";
    }
    trust_review_->SetText(trust_text);
    const auto* revision = service_->GetPreviewRevisionReview(preview_token_);
    revision_review_->SetVisible(revision != nullptr);
    revision_diff_->SetVisible(revision != nullptr);
    revision_ack_->SetVisible(revision != nullptr);
    revision_ack_->SetChecked(false);
    revision_review_->SetText(revision ? RevisionSummary(*revision) : std::u16string());
    std::string diff;
    if (revision) {
      diff = "Definition changes (JSON Pointer; array positions start at zero)\n- installed\n+ proposed\n\n";
      for (const auto& change : revision->changes)
        diff += change.path + "\n- " + change.before + "\n+ " + change.after + "\n\n";
      if (revision->changes.empty())
        diff += "No parsed definition changes. Archive bytes or signature metadata changed; review the revision and publisher identity above.\n";
    }
    revision_diff_->SetText(base::UTF8ToUTF16(diff));
    revision_diff_->Scroll({0});
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
    apply_window_->SetVisible(review_kind_ == ReviewKind::kInstalled);
    review_->SetVisible(true);
    Status(IDS_TAHAI_SKINS_REVIEW_READY);
    Controls();
  }
  void ConfirmInstall() {
    if (!browser_ || !service_ || confirming_ ||
        !service_->PreviewCanBeInstalled(preview_token_)) {
      return;
    }
    const auto* revision = service_->GetPreviewRevisionReview(preview_token_);
    if (revision && !revision_ack_->GetChecked()) return;
    const std::string current = revision ? revision->current_sha256 : "";
    const std::string candidate = revision ? revision->candidate_sha256 : "";
    confirming_ = true;
    Controls();
    auto model =
        ui::DialogModel::Builder()
            .SetTitle(l10n_util::GetStringUTF16(IDS_TAHAI_SKINS_CONFIRM_STORE))
            .AddParagraph(ui::DialogModelLabel(l10n_util::GetStringUTF16(
                IDS_TAHAI_SKINS_CONFIRM_STORE_DETAIL)))
            .AddParagraph(
                ui::DialogModelLabel(std::u16string(summary_->GetText())))
            .AddParagraph(ui::DialogModelLabel(revision
                ? u"You acknowledged the publisher, capability and definition comparison in the package review."
                : std::u16string(trust_review_->GetText())))
            .AddParagraph(ui::DialogModelLabel(revision
                ? RevisionSummary(*revision, true)
                : u"No installed revision is being replaced."))
            .AddOkButton(base::BindOnce(&SkinManagerView::Install,
                                        weak_factory_.GetWeakPtr(),
                                        preview_token_, current, candidate))
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
  void Install(std::string token, std::string current, std::string candidate) {
    confirming_ = false;
    if (!current.empty() && (!service_ || !service_->AcknowledgeRevisionReview(token, current, candidate))) {
      Status(IDS_TAHAI_SKINS_STALE);
      Controls();
      return;
    }
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
    const auto alive = weak_factory_.GetWeakPtr();
    operation_owned_ = false;
    if (!ClearReview()) {
      return;
    }
    if (result.status == SkinOperationStatus::kOk) {
      Refresh();
      if (!alive) {
        return;
      }
    }
    Status(result);
    Controls();
  }
  void Discard() {
    const auto alive = weak_factory_.GetWeakPtr();
    reply_factory_.InvalidateWeakPtrs();
    if (operation_owned_ && service_) {
      service_->Cancel();
      if (!alive) {
        return;
      }
    }
    operation_owned_ = false;
    if (!ClearReview()) {
      return;
    }
    Controls();
    Status(IDS_TAHAI_SKINS_CANCELLED);
  }
  void ApplyWindowAppearance() {
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    auto* controller = TargetController();
    const bool applied =
        controller && controller->ApplyReviewedWindowSkin(preview_token_);
    if (!alive || !target || browser_.get() != target.get()) {
      return;
    }
    if (!applied) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      return;
    }
    service_->EndLivePreview();
    if (!alive || !target || browser_.get() != target.get()) {
      return;
    }
    Refresh();
  }
  void ResetWindowAppearance() {
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    if (auto* controller = TargetController()) {
      controller->ClearWindowSkin();
      if (!alive || !target || browser_.get() != target.get()) {
        return;
      }
      Refresh();
    }
  }
  void ApplyAppearance() {
    if (!browser_ || !service_ || review_kind_ != ReviewKind::kInstalled) {
      return;
    }
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    const bool applied = service_->ApplyPreview(preview_token_);
    if (!alive || !target || browser_.get() != target.get()) {
      return;
    }
    if (!applied) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      Controls();
      return;
    }
    Status(IDS_TAHAI_SKINS_APPLIED);
    preview_status_timer_.Stop();
    Controls();
    // Reload the catalog so a newly applied v2 skin exposes its mode buttons
    // without making the person close and reopen the manager.
    Refresh();
  }
  void ResetAppearance() {
    if (!browser_) {
      return;
    }
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    const bool reset = service_ && service_->ResetAppearance();
    if (!alive || !target || browser_.get() != target.get()) {
      return;
    }
    Status(reset ? IDS_TAHAI_SKINS_RESET_COMPLETE
                 : IDS_TAHAI_SKINS_POLICY_BLOCKED);
    Controls();
  }
  void ApplyBuiltIn(std::string id) {
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    const bool applied = service_ && service_->ApplyBuiltIn(id);
    if (!alive || !target || browser_.get() != target.get()) {
      return;
    }
    if (applied) {
      preview_status_timer_.Stop();
      Status(IDS_TAHAI_SKINS_APPLIED);
      Controls();
    }
  }
  // Every native mutation below may synchronously notify observers, destroy
  // this dialog/window, retarget the manager or revoke a skin binding. Own the
  // reviewed data and recheck weak owners and authority between each dispatch.
  void RunOperationalActivation(
      BrowserWindowInterface* target_browser,
      const TahaiOperationalSkinActivation& activation,
      const TahaiOperationalWorkflow& workflow,
      const std::vector<std::string>& rail_modules,
      const std::optional<SurfaceDesign>& surface_design,
      const std::string& skin_id,
      const std::string& archive_sha256,
      const std::string& mode_id,
      const std::string& custom_mode_id = {}) {
    if (activating_ || !browser_ || !target_browser || !service_) {
      return;
    }
    const auto alive = weak_factory_.GetWeakPtr();
    const auto source = browser_;
    const auto target = target_browser->GetWeakPtr();
    const auto profile = target->GetProfile()->GetWeakPtr();
    auto* target_controller = WindowModeController::GetForBrowser(target.get());
    auto* source_controller = TargetController();
    if (!target_controller || !source_controller) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      return;
    }
    const auto controller = target_controller->GetWeakPtr();
    const auto origin = source_controller->GetWeakPtr();
    activating_ = true;
    base::ScopedClosureRunner reset(base::BindOnce(
        [](base::WeakPtr<SkinManagerView> view) {
          if (view) {
            view->activating_ = false;
          }
        },
        alive));
    const auto owners_current = [&] {
      return alive && source && target && profile && controller && origin &&
             alive->service_ && alive->browser_.get() == source.get();
    };
    const auto failed = [&] {
      if (alive && alive->browser_.get() == source.get()) {
        alive->Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      }
    };
    const auto revision_current = [&] {
      if (!owners_current()) {
        return false;
      }
      const auto* manifest = controller->operational_manifest();
      return manifest && manifest->appearance.id == skin_id &&
             controller->operational_archive_sha256() == archive_sha256;
    };
    bool custom_selected = false;
    const auto selection_current = [&] {
      return revision_current() &&
             controller->active_operational_mode_id() == mode_id &&
             (!custom_selected ||
              controller->active_custom_mode_id() == custom_mode_id);
    };
    // Preflight before changing the target; each command is also rechecked at
    // use. A saved workspace can target another window, but never another
    // profile.
    if (target->GetProfile() != source->GetProfile() ||
        std::ranges::any_of(activation.command_ids,
                            [&](int command_id) {
                              return !chrome::IsCommandEnabled(target.get(),
                                                               command_id);
                            }) ||
        !chrome::IsCommandEnabled(target.get(), IDC_TAHAI_MISSION_CONTROL) ||
        !controller->CopyWindowSkinFrom(*origin) || !revision_current()) {
      failed();
      return;
    }
    // Keep rail changes local to the selected window, not the profile template.
    if (!controller->ApplyWorkspacePresentation(
            controller->active_mode_id(),
            controller->active_configuration().rail_state,
            controller->active_configuration().rail_width) ||
        !revision_current() || !controller->SelectOperationalMode(mode_id) ||
        !selection_current()) {
      failed();
      return;
    }
    for (int command_id : activation.command_ids) {
      if (command_id == IDC_TAHAI_MISSION_CONTROL) {
        continue;
      }
      if (!selection_current() ||
          !chrome::IsCommandEnabled(target.get(), command_id) ||
          !chrome::ExecuteCommand(target.get(), command_id) ||
          !selection_current()) {
        failed();
        return;
      }
    }
    if (!custom_mode_id.empty()) {
      custom_selected = true;
      if (!controller->SetCustomModePresentation(custom_mode_id) ||
          !selection_current()) {
        failed();
        return;
      }
    }
    if (!controller->SetOperationalRailModules(rail_modules) ||
        !selection_current() || !controller->SetSurfaceDesign(surface_design) ||
        !selection_current()) {
      failed();
      return;
    }
    if (!QueueOperationalWorkflowLaunch(profile.get(), workflow, skin_id,
                                        archive_sha256)) {
      failed();
      return;
    }
    const auto queued_snapshot =
        profile->GetPrefs()
            ->GetDict(prefs::kTahaiPendingOperationalWorkflow)
            .Clone();
    if (!selection_current() ||
        !chrome::IsCommandEnabled(target.get(), IDC_TAHAI_MISSION_CONTROL) ||
        !chrome::ExecuteCommand(target.get(), IDC_TAHAI_MISSION_CONTROL)) {
      if (profile &&
          profile->GetPrefs()->GetDict(
              prefs::kTahaiPendingOperationalWorkflow) == queued_snapshot) {
        ClearQueuedOperationalWorkflowLaunch(profile.get());
      }
      failed();
      return;
    }
    if (selection_current()) {
      alive->Status(IDS_TAHAI_SKINS_APPLIED);
    }
  }
  void ActivateOperationalMode(std::string mode_id) {
    if (!browser_ || !service_) {
      return;
    }
    const TahaiOperationalSkinManifest* operational =
        EffectiveOperationalManifest();
    const auto activation =
        operational ? BuildTahaiOperationalSkinActivation(*operational, mode_id)
                    : std::nullopt;
    if (!activation) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      return;
    }
    const auto mode = std::ranges::find(operational->modes, mode_id,
                                        &TahaiOperationalMode::id);
    const auto workflow =
        mode == operational->modes.end()
            ? operational->workflows.end()
            : std::ranges::find(operational->workflows, mode->workflow_id,
                                &TahaiOperationalWorkflow::id);
    const auto surface =
        mode == operational->modes.end()
            ? operational->surfaces.end()
            : std::ranges::find(operational->surfaces, mode->surface_id,
                                &TahaiOperationalSurface::id);
    const std::optional<std::string> archive_sha256 =
        EffectiveArchiveSha256();
    if (workflow == operational->workflows.end() ||
        surface == operational->surfaces.end() || !archive_sha256) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      return;
    }
    // Native commands can synchronously notify profile/UI observers. Own the
    // reviewed snapshot across dispatch instead of retaining store iterators.
    const TahaiOperationalWorkflow workflow_snapshot = *workflow;
    const std::vector<std::string> rail_modules = surface->rail_modules;
    const auto surface_design = surface->design;
    const std::string skin_id = operational->appearance.id;
    RunOperationalActivation(browser_.get(), *activation, workflow_snapshot,
                             rail_modules, surface_design, skin_id,
                             *archive_sha256, mode_id);
  }
  void ActivateCustomMode(std::string custom_mode_id) {
    if (activating_ || !browser_ || !mode_service_) {
      return;
    }
    const auto custom = std::ranges::find(
        mode_service_->custom_modes(), custom_mode_id,
        &TahaiCustomModeDefinition::id);
    if (custom != mode_service_->custom_modes().end() &&
        custom->native_presentation) {
      const auto alive = weak_factory_.GetWeakPtr();
      Browser* target = ActivateNativeCustomMode(browser_.get(), custom_mode_id);
      if (!alive) {
        return;
      }
      if (target) {
        status_->SetText(u"Mode opened. Any retained skin is being reverified; the window shows unavailable skins. No mode controls were run.");
        status_->GetViewAccessibility().AnnounceText(status_->GetText());
      } else {
        Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      }
      return;
    }
    const TahaiOperationalSkinManifest* operational =
        EffectiveOperationalManifest();
    const auto activation =
        operational && custom != mode_service_->custom_modes().end() &&
                custom->operational_skin &&
                custom->operational_skin->id == operational->appearance.id &&
                custom->operational_skin->archive_sha256 == EffectiveArchiveSha256()
            ? BuildTahaiCustomModeActivation(*operational, *custom)
            : std::nullopt;
    if (!activation) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      return;
    }
    const auto mode = std::ranges::find(
        operational->modes, custom->operational_mode_id,
        &TahaiOperationalMode::id);
    const auto workflow =
        mode == operational->modes.end()
            ? operational->workflows.end()
            : std::ranges::find(operational->workflows, mode->workflow_id,
                                &TahaiOperationalWorkflow::id);
    const auto surface =
        mode == operational->modes.end()
            ? operational->surfaces.end()
            : std::ranges::find(operational->surfaces, mode->surface_id,
                                &TahaiOperationalSurface::id);
    const std::optional<std::string> archive_sha256 =
        EffectiveArchiveSha256();
    if (workflow == operational->workflows.end() ||
        surface == operational->surfaces.end() || !archive_sha256) {
      Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
      return;
    }
    const TahaiOperationalWorkflow workflow_snapshot = *workflow;
    const std::vector<std::string> rail_modules = surface->rail_modules;
    const auto surface_design = surface->design;
    const std::string skin_id = operational->appearance.id;
    const TahaiCustomModeDefinition custom_snapshot = *custom;
    Browser* target = browser_.get();
    const auto alive = weak_factory_.GetWeakPtr();
    const auto source = browser_;
    if (!custom_snapshot.workspace_id.empty()) {
      // A saved workspace is restored only by Chromium's browser-owned
      // controller. It opens a separate regular-profile window and cannot
      // accept a renderer-provided URL or mutate the source window.
      target = OpenNamedWorkspace(target, custom_snapshot.workspace_id);
      if (!alive || !source || browser_.get() != source.get()) {
        return;
      }
      if (!target) {
        Status(IDS_TAHAI_SKINS_OPERATION_FAILED);
        return;
      }
    }
    RunOperationalActivation(
        target, *activation, workflow_snapshot, rail_modules, surface_design,
        skin_id, *archive_sha256, custom_snapshot.operational_mode_id,
        custom_snapshot.id);
  }
  void TryAppearance() {
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    const bool started = service_ && service_->BeginLivePreview(preview_token_);
    if (!alive || !target || browser_.get() != target.get()) {
      return;
    }
    if (!started) {
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
    const auto alive = weak_factory_.GetWeakPtr();
    const auto target = browser_;
    if (service_) {
      service_->EndLivePreview();
    }
    if (!alive || !target || browser_.get() != target.get()) {
      return;
    }
    UpdatePreviewStatus();
  }
  void OnPolicyChanged() {
    const auto alive = weak_factory_.GetWeakPtr();
    exporting_ = false;
    publisher_key_->SetText({});
    publisher_key_id_->SetText({});
    // Re-enabling policy later does not revive a chooser opened under the old
    // authorization. Late OS results must have no listener/operation to target.
    if (file_dialog_) {
      file_dialog_->ListenerDestroyed();
      file_dialog_.reset();
      choosing_ = false;
      exporting_ = false;
    }
    Discard();
    if (!alive) {
      return;
    }
    rows_->RemoveAllChildViews();
    // The profile owner's pref observer may run after ours; refresh only once
    // all policy observers have revoked their in-flight callbacks.
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE,
        base::BindOnce(&SkinManagerView::Refresh, weak_factory_.GetWeakPtr()));
  }
  void WindowClosing() override {
    const auto alive = lifetime_factory_.GetWeakPtr();
    Detach();
    if (!alive) {
      return;
    }
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
    trust_review_ = nullptr;
    publishers_ = nullptr;
    publisher_panel_ = nullptr;
    publisher_rows_ = nullptr;
    publisher_key_id_ = nullptr;
    publisher_key_ = nullptr;
    publisher_review_key_ = nullptr;
    revision_review_ = nullptr;
    revision_diff_ = nullptr;
    revision_ack_ = nullptr;
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
    const auto alive = weak_factory_.GetWeakPtr();
    pref_changes_.RemoveAll();
    reply_factory_.InvalidateWeakPtrs();
    if (file_dialog_) {
      file_dialog_->ListenerDestroyed();
      file_dialog_.reset();
    }
    if (operation_owned_ && service_) {
      service_->Cancel();
      if (!alive) {
        return;
      }
    }
    if (!ClearReview()) {
      return;
    }
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
  raw_ptr<ModeService> mode_service_;
  raw_ptr<views::View> contents_ = nullptr;
  scoped_refptr<ui::SelectFileDialog> file_dialog_;
  PrefChangeRegistrar pref_changes_;
  raw_ptr<views::MdTextButton> import_ = nullptr;
  raw_ptr<views::MdTextButton> publishers_ = nullptr;
  raw_ptr<views::View> publisher_panel_ = nullptr;
  raw_ptr<views::View> publisher_rows_ = nullptr;
  raw_ptr<views::Textfield> publisher_key_id_ = nullptr;
  raw_ptr<views::Textfield> publisher_key_ = nullptr;
  raw_ptr<views::MdTextButton> publisher_review_key_ = nullptr;
  raw_ptr<views::MdTextButton> creator_ = nullptr;
  raw_ptr<views::MdTextButton> refresh_ = nullptr;
  raw_ptr<views::MdTextButton> discard_ = nullptr;
  raw_ptr<views::MdTextButton> install_ = nullptr;
  raw_ptr<views::MdTextButton> apply_ = nullptr;
  raw_ptr<views::MdTextButton> apply_window_ = nullptr;
  raw_ptr<views::MdTextButton> reset_window_ = nullptr;
  raw_ptr<views::MdTextButton> try_ = nullptr;
  raw_ptr<views::MdTextButton> revert_ = nullptr;
  raw_ptr<views::MdTextButton> export_ = nullptr;
  raw_ptr<views::MdTextButton> reset_ = nullptr;
  raw_ptr<views::Label> status_ = nullptr;
  raw_ptr<views::Label> summary_ = nullptr;
  raw_ptr<views::Label> trust_review_ = nullptr;
  raw_ptr<views::Label> revision_review_ = nullptr;
  raw_ptr<views::Textarea> revision_diff_ = nullptr;
  raw_ptr<views::Checkbox> revision_ack_ = nullptr;
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
  bool activating_ = false;
  base::RepeatingTimer preview_status_timer_;
  bool closed_ = false;
  base::WeakPtrFactory<SkinManagerView> reply_factory_{this};
  base::WeakPtrFactory<SkinManagerView> weak_factory_{this};
  // Unlike callback weak pointers, this is not invalidated by Detach(). It
  // guards cleanup that must distinguish a closed view from a deleted view.
  base::WeakPtrFactory<SkinManagerView> lifetime_factory_{this};
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
    const auto manager = found->second;
    manager->SelectTargetWindow(browser);
    if (!manager || !manager->GetWidget()) {
      return;
    }
    manager->GetWidget()->Show();
    if (manager && manager->GetWidget()) {
      manager->GetWidget()->Activate();
    }
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
