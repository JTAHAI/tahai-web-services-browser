// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"

#include <map>
#include <set>
#include <vector>

#include "base/uuid.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_tabrestore.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/tabs/tab_group_model.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tabs/tab_strip_model_delegate.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "components/sessions/core/serialized_navigation_entry.h"
#include "components/tabs/public/split_tab_data.h"
#include "components/tabs/public/tab_group.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_contents.h"

namespace tahai {

NamedWorkspaceCaptureResult CaptureNamedWorkspace(Browser* browser,
                                                  std::string_view name) {
  if (!browser || !browser->is_type_normal() ||
      !NamedWorkspaceStore(browser->GetProfile()).enabled()) {
    return {.failure = NamedWorkspaceCaptureFailure::kUnavailable};
  }
  auto* mode = WindowModeController::GetForBrowser(browser);
  auto* model = browser->tab_strip_model();
  if (!mode || !model->delegate()->IsTabStripEditable()) {
    return {.failure = NamedWorkspaceCaptureFailure::kUnsupportedLayout};
  }
  if (model->empty()) {
    return {.failure = NamedWorkspaceCaptureFailure::kNoTabs};
  }
  if (static_cast<size_t>(model->count()) > NamedWorkspaceStore::kMaxTabs) {
    return {.failure = NamedWorkspaceCaptureFailure::kTooManyTabs};
  }
  NamedWorkspace workspace;
  workspace.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  workspace.name = name;
  workspace.mode = mode->active_mode_id();
  workspace.rail_state = mode->active_configuration().rail_state;
  workspace.rail_width = mode->active_configuration().rail_width;
  workspace.active_tab = model->active_index();
  std::map<tab_groups::TabGroupId, int> group_indices;
  std::set<split_tabs::SplitTabId> seen_splits;
  for (int index = 0; index < model->count(); ++index) {
    auto* tab = model->GetTabAtIndex(index);
    const GURL url = tab->GetContents()->GetVisibleURL();
    if (!NamedWorkspaceStore::IsRestorableUrl(url)) {
      // Never silently omit an unsupported tab.
      return {.failure = NamedWorkspaceCaptureFailure::kUnsupportedTab};
    }
    int group_index = -1;
    if (auto group = tab->GetGroup()) {
      if (!group_indices.contains(*group)) {
        group_indices[*group] = static_cast<int>(workspace.groups.size());
        workspace.groups.push_back(
            *model->group_model()->GetTabGroup(*group)->visual_data());
      }
      group_index = group_indices[*group];
    }
    workspace.tabs.push_back({url, tab->IsPinned(), group_index});
    if (auto split = tab->GetSplit();
        split && seen_splits.insert(*split).second) {
      auto* data = model->GetSplitData(*split);
      if (!data) {
        return {.failure = NamedWorkspaceCaptureFailure::kUnsupportedLayout};
      }
      NamedWorkspaceSplit saved;
      saved.visual = *data->visual_data();
      for (auto* pane : data->ListTabs()) {
        saved.tabs.push_back(model->GetIndexOfTab(pane));
      }
      workspace.splits.push_back(std::move(saved));
    }
  }
  if (!NamedWorkspaceStore::Validate(workspace)) {
    return {.failure = NamedWorkspaceCaptureFailure::kUnsupportedLayout};
  }
  return {.workspace = std::move(workspace)};
}

Browser* OpenNamedWorkspace(Browser* source, std::string_view id) {
  if (!source || !source->is_type_normal()) {
    return nullptr;
  }
  auto workspace = NamedWorkspaceStore(source->GetProfile()).Find(id);
  if (!workspace || !NamedWorkspaceStore::Validate(*workspace) ||
      Browser::GetCreationStatusForProfile(source->GetProfile()) !=
          Browser::CreationStatus::kOk) {
    return nullptr;
  }
  Browser* restored =
      Browser::Create(Browser::CreateParams(source->GetProfile(), true));
  if (!restored) {
    return nullptr;
  }
  const auto weak_restored = restored->AsWeakPtr();
  auto* model = restored->tab_strip_model();
  if (!model->empty() ||
      (!workspace->groups.empty() && !model->SupportsTabGroups())) {
    restored->GetWindow()->Show();
    return nullptr;
  }
  // Chromium's restore path creates background WebContents without renderer
  // processes. Only visible panes need loading; do not fetch 64 URLs at once.
  for (size_t index = 0; index < workspace->tabs.size(); ++index) {
    const auto& tab = workspace->tabs[index];
    sessions::SerializedNavigationEntry entry;
    entry.set_index(0);
    // A URL-only restore has no serialized PageState containing an already
    // rewritten actual URL. Use only our exact trusted route mapping.
    entry.set_virtual_url(
        NamedWorkspaceStore::CanonicalizeInternalUrl(tab.url));
    entry.set_transition_type(ui::PAGE_TRANSITION_AUTO_BOOKMARK);
    const std::vector<sessions::SerializedNavigationEntry> navigations{entry};
    auto* contents = chrome::AddRestoredTab(
        restored, navigations, static_cast<int>(index), 0, {}, std::nullopt,
        false, tab.pinned, {}, {}, nullptr, {}, {}, false, false);
    if (!weak_restored) {
      return nullptr;
    }
    if (!contents || contents->GetBrowserContext() != restored->GetProfile() ||
        model->count() != static_cast<int>(index + 1)) {
      // An unusual browser observer changed the new window. Preserve any
      // work it may have acquired; never force-close a partially opened window.
      restored->GetWindow()->Show();
      return nullptr;
    }
  }
  std::vector<tab_groups::TabGroupId> groups;
  for (size_t group = 0; group < workspace->groups.size(); ++group) {
    std::vector<int> indices;
    for (size_t index = 0; index < workspace->tabs.size(); ++index) {
      if (workspace->tabs[index].group == static_cast<int>(group)) {
        indices.push_back(static_cast<int>(index));
      }
    }
    groups.push_back(model->AddToNewGroup(indices));
    if (!weak_restored) {
      return nullptr;
    }
  }
  for (const auto& split : workspace->splits) {
    model->RestoreSplit(split_tabs::SplitTabId::GenerateNew(), split.tabs,
                        split.visual);
    if (!weak_restored) {
      return nullptr;
    }
  }
  model->ActivateTabAt(workspace->active_tab);
  if (!weak_restored) {
    return nullptr;
  }
  for (size_t group = 0; group < groups.size(); ++group) {
    auto visual = workspace->groups[group];
    // Keep the active pane reachable even if a malformed old session had
    // marked its enclosing group collapsed.
    if (workspace->tabs[workspace->active_tab].group ==
        static_cast<int>(group)) {
      visual =
          tab_groups::TabGroupVisualData(visual.title(), visual.color(), false);
    }
    model->ChangeTabGroupVisuals(groups[group], visual);
    if (!weak_restored) {
      return nullptr;
    }
  }
  auto* mode = WindowModeController::GetForBrowser(restored);
  if (!mode ||
      !mode->ApplyWorkspacePresentation(workspace->mode, workspace->rail_state,
                                        workspace->rail_width)) {
    restored->GetWindow()->Show();
    return nullptr;
  }
  restored->GetWindow()->Show();
  return restored;
}

}  // namespace tahai
