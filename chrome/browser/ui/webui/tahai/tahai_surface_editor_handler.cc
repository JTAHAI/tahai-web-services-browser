// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_surface_editor_handler.h"

#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/browser_window/public/global_browser_collection.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/weak_document_ptr.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/web_ui_message_handler.h"

namespace tahai {
namespace {

class SurfaceEditorHandler final : public content::WebUIMessageHandler,
                                   public content::WebContentsObserver {
 public:
  explicit SurfaceEditorHandler(Profile* profile) : profile_(profile) {}
  ~SurfaceEditorHandler() override { RevertOwnedPreview(); }

  void RegisterMessages() override {
    Observe(web_ui()->GetWebContents());
    web_ui()->RegisterMessageCallback("previewTahaiSurface", base::BindRepeating(
        &SurfaceEditorHandler::Preview, base::Unretained(this)));
    web_ui()->RegisterMessageCallback("keepTahaiSurface", base::BindRepeating(
        &SurfaceEditorHandler::Keep, base::Unretained(this)));
    web_ui()->RegisterMessageCallback("revertTahaiSurface", base::BindRepeating(
        &SurfaceEditorHandler::Revert, base::Unretained(this)));
    web_ui()->RegisterMessageCallback("resetTahaiSurface", base::BindRepeating(
        &SurfaceEditorHandler::Reset, base::Unretained(this)));
    web_ui()->RegisterMessageCallback("getTahaiSurfacePreviewState", base::BindRepeating(
        &SurfaceEditorHandler::State, base::Unretained(this)));
  }

  void PrimaryPageChanged(content::Page& page) override { RevertOwnedPreview(); }
  void WebContentsDestroyed() override { RevertOwnedPreview(); }
  void OnJavascriptDisallowed() override { RevertOwnedPreview(); }

 private:
  WindowModeController* Target(bool require_gesture) {
    auto* contents = web_contents();
    if (!contents || !profile_->IsRegularProfile() || profile_->IsOffTheRecord() ||
        profile_->IsGuestSession() || profile_->IsSystemProfile() ||
        contents->GetBrowserContext() != profile_ ||
        profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiSkinStudioDraft)) {
      return nullptr;
    }
    const auto& url = contents->GetLastCommittedURL();
    if (url != GURL(kTahaiSkinStudioURL) && url != GURL(kTahaiTrustedSkinStudioURL)) {
      return nullptr;
    }
    auto* frame = contents->GetPrimaryMainFrame();
    if (!frame || (require_gesture && !frame->HasTransientUserActivation())) {
      return nullptr;
    }
    auto* window = GlobalBrowserCollection::GetInstance()->FindBrowserWithTab(contents);
    auto* browser = window ? window->GetBrowserForMigrationOnly() : nullptr;
    if (!browser || !browser->is_type_normal() || browser->GetProfile() != profile_ ||
        browser->tab_strip_model()->GetActiveWebContents() != contents) {
      return nullptr;
    }
    return WindowModeController::GetForBrowser(browser);
  }

  void Reply(std::string_view result) {
    if (Target(false)) {
      AllowJavascript();
      CallJavascriptFunction("tahaiSurfacePreviewResult", base::Value(result));
    }
  }

  bool OwnsCurrentPreview(WindowModeController* target) const {
    return target && target == preview_controller_.get() && preview_token_ &&
           preview_document_.AsRenderFrameHostIfValid() ==
               web_contents()->GetPrimaryMainFrame() &&
           target->IsSurfacePreviewCurrent(*preview_token_);
  }

  void Preview(const base::ListValue& args) {
    auto* target = Target(true);
    auto design = args.size() == 1u && args[0].is_dict()
        ? DecodeSurfaceDesign(args[0].GetDict()) : std::nullopt;
    if (!target || !design) {
      Reply("rejected");
      return;
    }
    RevertOwnedPreview();
    auto token = target->BeginSurfacePreview(std::move(*design));
    if (!token) {
      Reply("pane-count");
      return;
    }
    preview_token_ = token;
    preview_controller_ = target->GetWeakPtr();
    preview_document_ = web_contents()->GetPrimaryMainFrame()->GetWeakDocumentPtr();
    Reply("previewing");
  }

  void Keep(const base::ListValue& args) {
    auto* target = Target(true);
    if (!args.empty() || !OwnsCurrentPreview(target)) {
      RevertOwnedPreview();
      Reply("expired");
      return;
    }
    const bool kept = target->CommitSurfacePreview(*preview_token_);
    preview_token_.reset();
    preview_controller_.reset();
    Reply(kept ? "kept" : "expired");
  }

  void Revert(const base::ListValue& args) {
    if (args.empty() && Target(false)) {
      RevertOwnedPreview();
      Reply("reverted");
    }
  }

  void Reset(const base::ListValue& args) {
    auto* target = Target(true);
    if (!args.empty() || !target) {
      Reply("rejected");
      return;
    }
    RevertOwnedPreview();
    target->SetSurfaceDesign(std::nullopt);
    Reply("reset");
  }

  void State(const base::ListValue& args) {
    if (args.empty()) {
      Reply(OwnsCurrentPreview(Target(false)) ? "previewing" : "expired");
    }
  }

  void RevertOwnedPreview() {
    // A stale document can only cancel its own unguessable transaction. It
    // cannot revert a replacement trial or a subsequent native mode selection.
    if (preview_controller_ && preview_token_) {
      preview_controller_->CancelSurfacePreview(*preview_token_);
    }
    preview_token_.reset();
    preview_controller_.reset();
    preview_document_ = {};
  }

  const raw_ptr<Profile> profile_;
  base::WeakPtr<WindowModeController> preview_controller_;
  std::optional<base::UnguessableToken> preview_token_;
  content::WeakDocumentPtr preview_document_;
};

}  // namespace

std::unique_ptr<content::WebUIMessageHandler> CreateSurfaceEditorHandler(Profile* profile) {
  return std::make_unique<SurfaceEditorHandler>(profile);
}

}  // namespace tahai
