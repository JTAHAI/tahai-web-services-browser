// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/tahai/tahai_pane_layout_transition.h"

#include <algorithm>
#include <vector>

#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tabs/tab_strip_model_delegate.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/browser/ui/views/frame/multi_contents_view.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/common/webui_url_constants.h"
#include "components/tabs/public/split_tab_data.h"
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_contents.h"

namespace tahai {
namespace {

std::vector<tabs::TabHandle> SplitMembers(
    const split_tabs::SplitTabData& split) {
  std::vector<tabs::TabHandle> members;
  for (auto* tab : split.ListTabs()) {
    members.push_back(tab->GetHandle());
  }
  return members;
}

}  // namespace

bool ApplyNativePaneLayout(Browser* browser,
                           size_t member_count,
                           split_tabs::SplitTabLayout layout,
                           const PaneCreationCallback& create_pane) {
  if (!browser || !browser->is_type_normal() || member_count < 2 ||
      member_count > 4 ||
      (layout != split_tabs::SplitTabLayout::kSideBySide &&
       layout != split_tabs::SplitTabLayout::kStacked)) {
    return false;
  }
  const auto weak_browser = browser->AsWeakPtr();
  auto* model = browser->tab_strip_model();
  if (!model->delegate()->IsTabStripEditable() || !model->GetActiveTab()) {
    return false;
  }
  const auto original = model->GetActiveTab()->GetHandle();
  const auto original_split = original.Get()->GetSplit();
  const auto original_group = original.Get()->GetGroup();
  const bool original_pinned = original.Get()->IsPinned();
  auto visual_data = split_tabs::SplitTabVisualData(layout, 0.5);
  std::vector<tabs::TabHandle> original_members;
  if (original_split) {
    auto* split = model->GetSplitData(*original_split);
    visual_data = *split->visual_data();
    original_members = SplitMembers(*split);
    if (original_members.size() == member_count) {
      if (auto* view = BrowserView::GetBrowserViewForBrowser(browser)) {
        view->multi_contents_view()->SetTahaiFocusMode(false);
      }
      model->UpdateSplitLayout(*original_split, layout);
      return true;
    }
  }
  const auto original_visual_data = visual_data;
  visual_data.set_split_layout(layout);

  std::vector<tabs::TabHandle> existing;
  for (int i = 0; i < model->count(); ++i) {
    existing.push_back(model->GetTabAtIndex(i)->GetHandle());
  }
  std::vector<tabs::TabHandle> members = {original};
  // Keep current sibling panes before considering unrelated free tabs.
  for (auto handle : original_members) {
    if (members.size() < member_count && handle != original) {
      members.push_back(handle);
    }
  }
  for (auto handle : existing) {
    auto* tab = handle.Get();
    if (members.size() < member_count && !tab->IsSplit() &&
        tab->GetGroup() == original_group &&
        tab->IsPinned() == original_pinned &&
        std::ranges::find(members, handle) == members.end()) {
      members.push_back(handle);
    }
  }

  const GURL new_tab_url(chrome::kChromeUINewTabURL);
  std::vector<tabs::TabHandle> created;
  base::ScopedClosureRunner rollback(base::BindOnce(
      [](base::WeakPtr<Browser> weak_browser, const GURL& new_tab_url,
         std::vector<tabs::TabHandle>* created) {
        // No raw tab pointer survives calls that may destroy or move a
        // tab/window. Reacquire the model after each browser-lifetime check.
        for (auto handle : *created) {
          if (!weak_browser) {
            return;
          }
          auto* model = weak_browser->tab_strip_model();
          auto* tab = handle.Get();
          if (!tab || model->GetIndexOfTab(tab) == TabStripModel::kNoTab ||
              tab->IsSplit()) {
            continue;
          }
          auto* contents = tab->GetContents();
          const GURL visible = contents->GetVisibleURL();
          const bool is_new_tab =
              visible.is_empty() || visible == new_tab_url ||
              visible == GURL(kTahaiNewTabURL) ||
              visible == GURL(kTahaiTrustedNewTabURL);
          if (contents->GetBrowserContext() != weak_browser->GetProfile() ||
              !is_new_tab || contents->GetController().GetEntryCount() > 1 ||
              contents->NeedToFireBeforeUnloadOrUnloadEvents()) {
            continue;  // Never discard a pane that acquired independent work.
          }
          chrome::CloseWebContents(weak_browser.get(), contents, false);
        }
      },
      weak_browser, new_tab_url, base::Unretained(&created)));

  const auto is_original_unchanged = [&] {
    if (!weak_browser || !original.Get() ||
        model->GetIndexOfTab(original.Get()) == TabStripModel::kNoTab ||
        model->GetActiveTab() != original.Get() ||
        original.Get()->GetGroup() != original_group ||
        original.Get()->IsPinned() != original_pinned ||
        original.Get()->GetSplit() != original_split) {
      return false;
    }
    return !original_split ||
           (model->ContainsSplit(*original_split) &&
            SplitMembers(*model->GetSplitData(*original_split)) ==
                original_members &&
            *model->GetSplitData(*original_split)->visual_data() ==
                original_visual_data);
  };

  while (members.size() < member_count) {
    if (!is_original_unchanged()) {
      return false;
    }
    // Append after the current split; inserting inside it can itself unsplit
    // its collection. Background creation preserves active pane and focus.
    content::WebContents* contents =
        create_pane
            ? create_pane.Run(-1, original_group, original_pinned)
            : chrome::AddAndReturnTabAt(browser, new_tab_url, -1, false,
                                        original_group, original_pinned);
    if (!weak_browser || !contents) {
      return false;
    }
    auto* tab = tabs::TabInterface::MaybeGetFromContents(contents);
    if (!tab || model->GetIndexOfTab(tab) == TabStripModel::kNoTab ||
        std::ranges::find(existing, tab->GetHandle()) != existing.end() ||
        std::ranges::find(created, tab->GetHandle()) != created.end()) {
      return false;
    }
    created.push_back(tab->GetHandle());
    if (contents->GetBrowserContext() != browser->GetProfile() || tab->IsSplit() ||
        tab->GetGroup() != original_group ||
        tab->IsPinned() != original_pinned) {
      return false;
    }
    members.push_back(tab->GetHandle());
  }

  if (!is_original_unchanged()) {
    return false;
  }
  std::vector<int> indices;
  for (auto handle : members) {
    auto* tab = handle.Get();
    if (!tab || model->GetIndexOfTab(tab) == TabStripModel::kNoTab ||
        tab->GetContents()->GetBrowserContext() != browser->GetProfile() ||
        tab->GetGroup() != original_group ||
        tab->IsPinned() != original_pinned ||
        (tab->IsSplit() && tab->GetSplit() != original_split)) {
      return false;
    }
    indices.push_back(model->GetIndexOfTab(tab));
  }
  std::ranges::sort(indices);
  if (original_split) {
    model->RemoveSplit(*original_split);
  }
  // No navigation/creation callbacks occur after the destructive boundary.
  // TabStripModel guards synchronous observer reentrancy during these edits.
  const auto split_id = model->AddToNewTahaiWorkspace(indices, visual_data);
  rollback.ReplaceClosure(base::OnceClosure());
  return model->GetSplitData(split_id)->ListTabs().size() == member_count;
}

}  // namespace tahai
