// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_GUARD_PANEL_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_GUARD_PANEL_H_

#include <optional>

#include "base/functional/callback.h"
#include "base/memory/weak_ptr.h"
#include "chrome/browser/tahai_guard/guard_profile_service.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tabs/tab_strip_model_observer.h"
#include "content/public/browser/weak_document_ptr.h"
#include "content/public/browser/web_contents_observer.h"
#include "ui/base/interaction/element_identifier.h"
#include "url/origin.h"

class Browser;

namespace tahai::guard {

DECLARE_ELEMENT_IDENTIFIER_VALUE(kGuardPanelElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kGuardPauseElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kGuardSiteExceptionElementId);

// Captures one selected native pane/document. Losing that selection permanently
// invalidates this controller, even if the user switches back or restores it
// from BFCache. Every mutation checks current browser-owned identity again.
class GuardPanelController final : public TabStripModelObserver,
                                   public content::WebContentsObserver {
 public:
  explicit GuardPanelController(Browser* browser,
                                base::RepeatingClosure invalidated = {});
  ~GuardPanelController() override;
  bool IsCurrent() const;
  std::optional<GuardProfileService::Snapshot> GetSnapshot() const;
  bool IsPaused() const;
  bool CanPause() const;
  bool SetMode(TahaiGuardMode mode);
  bool SetPaused(bool paused);
  bool HasSiteException() const;
  bool CanEditSiteException() const;
  bool SetSiteException(bool excluded);
  // Explicit user action only; retains Chromium's form-repost confirmation.
  bool Reload();
  const url::Origin& origin() const { return origin_; }

 private:
  void Invalidate();
  void OnTabStripModelChanged(
      TabStripModel* model,
      const TabStripModelChange& change,
      const TabStripSelectionChange& selection) override;
  void OnTabStripModelDestroyed(TabStripModel* model) override;
  void PrimaryPageChanged(content::Page& page) override;
  void PrimaryMainFrameRenderProcessGone(
      base::TerminationStatus status) override;
  void WebContentsDestroyed() override;
  GuardProfileService* Service() const;
  std::optional<TahaiGuardConfiguration> Configuration() const;

  base::WeakPtr<Browser> browser_;
  content::WeakDocumentPtr document_;
  url::Origin origin_;
  bool invalid_ = false;
  base::RepeatingClosure invalidated_;
  raw_ptr<TabStripModel> tab_strip_model_ = nullptr;
};

bool CanShowGuardPanel(Browser* browser);
void ShowGuardPanel(Browser* browser);

}  // namespace tahai::guard

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_GUARD_PANEL_H_
