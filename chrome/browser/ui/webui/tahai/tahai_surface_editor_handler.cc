// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_surface_editor_handler.h"

#include "base/functional/bind.h"
#include "base/memory/raw_ptr.h"
#include "chrome/browser/profiles/profile.h"
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

// Legacy callers use zero. New Studio requests carry a positive document-local
// ID; control messages must name that exact trial, never whichever is current.
std::optional<int> RequestId(const base::ListValue& args, size_t index) {
  if (args.size() == index) return 0;
  if (args.size() == index + 1u && args[index].is_int() && args[index].GetInt() > 0)
    return args[index].GetInt();
  return std::nullopt;
}

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
    auto* browser = window ? window : nullptr;
    if (!browser ||
        !(browser->GetType() == BrowserWindowInterface::Type::TYPE_NORMAL) ||
        browser->GetProfile() != profile_ ||
        browser->GetTabStripModel()->GetActiveWebContents() != contents) {
      return nullptr;
    }
    return WindowModeController::GetForBrowser(browser);
  }

  void Reply(std::string_view result, int request_id) {
    if (Target(false)) {
      AllowJavascript();
      CallJavascriptFunction("tahaiSurfacePreviewResult", base::Value(result),
                             base::Value(request_id));
    }
  }

  bool OwnsCurrentPreview(WindowModeController* target, int request_id) const {
    return target && target == preview_controller_.get() && preview_token_ &&
           request_id == preview_request_id_ &&
           preview_document_.AsRenderFrameHostIfValid() ==
               web_contents()->GetPrimaryMainFrame() &&
           target->IsSurfacePreviewCurrent(*preview_token_);
  }

  bool AcceptNewRequestId(int request_id) {
    auto* frame = web_contents()->GetPrimaryMainFrame();
    if (!frame) return false;
    if (request_document_.AsRenderFrameHostIfValid() != frame) {
      // A reload may reuse the WebUI handler, but the new document's counter
      // starts over. Keep replay protection within each document, not across it.
      greatest_request_id_ = 0;
      request_document_ = frame->GetWeakDocumentPtr();
    }
    if (request_id == 0) return greatest_request_id_ == 0;
    if (request_id <= greatest_request_id_) return false;
    greatest_request_id_ = request_id;
    return true;
  }

  void Preview(const base::ListValue& args) {
    auto* target = Target(true);
    const auto request_id = RequestId(args, 1u);
    auto design = request_id && args[0].is_dict()
        ? DecodeSurfaceDesign(args[0].GetDict()) : std::nullopt;
    if (!target || !design || !AcceptNewRequestId(*request_id)) {
      Reply("rejected", request_id.value_or(0));
      return;
    }
    RevertOwnedPreview();
    auto token = target->BeginSurfacePreview(std::move(*design));
    if (!token) {
      Reply("pane-count", *request_id);
      return;
    }
    preview_token_ = token;
    preview_request_id_ = *request_id;
    preview_controller_ = target->GetWeakPtr();
    preview_document_ = web_contents()->GetPrimaryMainFrame()->GetWeakDocumentPtr();
    Reply("previewing", *request_id);
  }

  void Keep(const base::ListValue& args) {
    auto* target = Target(true);
    const auto request_id = RequestId(args, 0u);
    if (!request_id || !OwnsCurrentPreview(target, *request_id)) {
      // A stale/malformed keep must not cancel a newer trial either.
      Reply("expired", request_id.value_or(0));
      return;
    }
    const bool kept = target->CommitSurfacePreview(*preview_token_);
    preview_token_.reset();
    preview_controller_.reset();
    preview_document_ = {};
    preview_request_id_ = 0;
    Reply(kept ? "kept" : "expired", *request_id);
  }

  void Revert(const base::ListValue& args) {
    const auto request_id = RequestId(args, 0u);
    if (request_id && Target(false)) {
      const bool owned = *request_id == preview_request_id_;
      if (owned) RevertOwnedPreview();
      Reply(owned ? "reverted" : "expired", *request_id);
    }
  }

  void Reset(const base::ListValue& args) {
    auto* target = Target(true);
    const auto request_id = RequestId(args, 0u);
    if (!request_id || !target || !AcceptNewRequestId(*request_id)) {
      Reply("rejected", request_id.value_or(0));
      return;
    }
    RevertOwnedPreview();
    target->SetSurfaceDesign(std::nullopt);
    Reply("reset", *request_id);
  }

  void State(const base::ListValue& args) {
    const auto request_id = RequestId(args, 0u);
    if (request_id) {
      Reply(OwnsCurrentPreview(Target(false), *request_id) ? "previewing" : "expired",
            *request_id);
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
    preview_request_id_ = 0;
  }

  const raw_ptr<Profile> profile_;
  base::WeakPtr<WindowModeController> preview_controller_;
  std::optional<base::UnguessableToken> preview_token_;
  int preview_request_id_ = 0;
  int greatest_request_id_ = 0;
  content::WeakDocumentPtr request_document_;
  content::WeakDocumentPtr preview_document_;
};

}  // namespace

std::unique_ptr<content::WebUIMessageHandler> CreateSurfaceEditorHandler(Profile* profile) {
  return std::make_unique<SurfaceEditorHandler>(profile);
}

}  // namespace tahai
