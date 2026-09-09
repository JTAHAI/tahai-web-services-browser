// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
#include "chrome/browser/tahai_guard/guard_tab_helper.h"

#include "base/functional/bind.h"
#include "base/task/sequenced_task_runner.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_guard/guard_profile_service.h"
#include "chrome/browser/tahai_guard/guard_profile_service_factory.h"
#include "chrome/common/chrome_render_frame.mojom.h"
#include "content/public/browser/document_user_data.h"
#include "content/public/browser/navigation_handle.h"
#include "content/public/browser/page.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/web_contents.h"
#include "mojo/public/cpp/bindings/associated_remote.h"
#include "third_party/blink/public/common/associated_interfaces/associated_interface_provider.h"
#include "url/gurl.h"

namespace tahai::guard {
namespace {
// Lifetime follows the actual document, including back/forward cache. Both
// sides discard old pipes on a new document; late utility replies cannot be
// replayed into a reused renderer frame.
class GuardDocument final : public content::DocumentUserData<GuardDocument> {
 public:
  ~GuardDocument() override = default;
  void NavigationCommitted(GuardProfileService* service) {
    // Path/query-dependent generichide exceptions can change with pushState.
    // Fragments alone do not affect filtering and must not re-query the engine.
    if (url_ != render_frame_host().GetLastCommittedURL().GetWithoutRef()) {
      Refresh(service);
    }
  }
  void Refresh(GuardProfileService* service) {
    auto& frame = render_frame_host();
    if (!frame.IsActive() || !frame.IsRenderFrameLive()) {
      return;
    }
    url_ = frame.GetLastCommittedURL().GetWithoutRef();
    if (!remote_.is_bound()) {
      mojo::AssociatedRemote<chrome::mojom::ChromeRenderFrame> chrome_frame;
      frame.GetRemoteAssociatedInterfaces()->GetInterface(&chrome_frame);
      chrome_frame->BindTahaiGuardDocument(
          remote_.BindNewEndpointAndPassReceiver());
    }
    ++revision_;
    remote_->SetSelectors({});
    if (service) {
      service->GetCosmeticSelectors(
          frame, base::BindOnce(&GuardDocument::Apply,
                                weak_factory_.GetWeakPtr(), revision_));
    }
  }

 private:
  friend class content::DocumentUserData<GuardDocument>;
  explicit GuardDocument(content::RenderFrameHost* frame)
      : DocumentUserData(frame) {}
  void Apply(uint64_t revision, std::vector<std::string> selectors) {
    if (revision == revision_ && render_frame_host().IsActive() &&
        render_frame_host().GetPage().IsPrimary()) {
      remote_->SetSelectors(selectors);
    }
  }
  uint64_t revision_ = 0;
  GURL url_;
  mojo::AssociatedRemote<chrome::mojom::TahaiGuardDocument> remote_;
  base::WeakPtrFactory<GuardDocument> weak_factory_{this};
  DOCUMENT_USER_DATA_KEY_DECL();
};
DOCUMENT_USER_DATA_KEY_IMPL(GuardDocument);
}  // namespace

GuardTabHelper::GuardTabHelper(content::WebContents* contents)
    : WebContentsObserver(contents), WebContentsUserData(*contents) {
  auto* service = GuardProfileServiceFactory::GetForProfile(
      Profile::FromBrowserContext(contents->GetBrowserContext()));
  if (service) {
    service_ = service->GetWeakPtr();
    subscription_ = service->ObserveCosmetics(base::BindRepeating(
        &GuardTabHelper::ScheduleRefresh, weak_factory_.GetWeakPtr()));
  }
}
GuardTabHelper::~GuardTabHelper() = default;

void GuardTabHelper::DidFinishNavigation(
    content::NavigationHandle* navigation) {
  if (navigation->HasCommitted()) {
    auto* frame = navigation->GetRenderFrameHost();
    if (frame->GetPage().IsPrimary() && frame->IsActive()) {
      // A new subframe should not re-query every already-filtered document.
      GuardDocument::GetOrCreateForCurrentDocument(frame)->NavigationCommitted(
          service_.get());
    }
  }
}
void GuardTabHelper::PrimaryPageChanged(content::Page&) {
  ScheduleRefresh();
}
void GuardTabHelper::ScheduleRefresh() {
  if (refresh_pending_) {
    return;
  }
  refresh_pending_ = true;
  base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE,
      base::BindOnce(&GuardTabHelper::Refresh, weak_factory_.GetWeakPtr()));
}
void GuardTabHelper::Refresh() {
  refresh_pending_ = false;
  web_contents()->GetPrimaryMainFrame()->ForEachRenderFrameHost(
      [this](content::RenderFrameHost* frame) {
        if (frame->GetBrowserContext() == web_contents()->GetBrowserContext() &&
            frame->GetPage().IsPrimary() && frame->IsActive()) {
          GuardDocument::GetOrCreateForCurrentDocument(frame)->Refresh(
              service_.get());
        }
      });
}
WEB_CONTENTS_USER_DATA_KEY_IMPL(GuardTabHelper);
}  // namespace tahai::guard
