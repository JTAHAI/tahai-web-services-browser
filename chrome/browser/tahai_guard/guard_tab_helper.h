// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
#ifndef CHROME_BROWSER_TAHAI_GUARD_GUARD_TAB_HELPER_H_
#define CHROME_BROWSER_TAHAI_GUARD_GUARD_TAB_HELPER_H_

#include "base/callback_list.h"
#include "base/memory/weak_ptr.h"
#include "content/public/browser/web_contents_observer.h"
#include "content/public/browser/web_contents_user_data.h"

namespace tahai::guard {
class GuardProfileService;
class GuardTabHelper final
    : public content::WebContentsObserver,
      public content::WebContentsUserData<GuardTabHelper> {
 public:
  ~GuardTabHelper() override;

 private:
  friend class content::WebContentsUserData<GuardTabHelper>;
  explicit GuardTabHelper(content::WebContents* contents);
  void DidFinishNavigation(content::NavigationHandle* navigation) override;
  void PrimaryPageChanged(content::Page& page) override;
  void ScheduleRefresh();
  void Refresh();
  bool refresh_pending_ = false;
  base::WeakPtr<GuardProfileService> service_;
  base::CallbackListSubscription subscription_;
  base::WeakPtrFactory<GuardTabHelper> weak_factory_{this};
  WEB_CONTENTS_USER_DATA_KEY_DECL();
};
}  // namespace tahai::guard
#endif  // CHROME_BROWSER_TAHAI_GUARD_GUARD_TAB_HELPER_H_
