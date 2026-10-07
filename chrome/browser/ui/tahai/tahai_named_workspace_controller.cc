// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"

#include <algorithm>
#include <map>
#include <optional>
#include <set>
#include <utility>
#include <vector>

#include "base/memory/weak_ptr.h"
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
#include "components/tabs/public/tab_interface.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_contents.h"

namespace tahai {

Browser* ActivateNativeCustomMode(Browser* source, std::string_view id) {
  if (!source || !(source->is_type_normal()) ||
      !source->GetProfile()->IsRegularProfile() ||
      source->GetProfile()->IsOffTheRecord()) {
    return nullptr;
  }
  auto* modes = ModeServiceFactory::GetForProfile(source->GetProfile());
  if (!modes) {
    return nullptr;
  }
  const auto custom = std::ranges::find(modes->custom_modes(), id,
                                       &TahaiCustomModeDefinition::id);
  if (custom == modes->custom_modes().end() || !custom->native_presentation) {
    return nullptr;
  }
  // Copy before creating a window, which may synchronously notify observers.
  auto presentation = *custom->native_presentation;
  presentation.custom_mode = custom->id;
  const std::string workspace_id = custom->workspace_id;
  if (!ValidateWindowPresentation(presentation)) {
    return nullptr;
  }
  Browser* target =
      workspace_id.empty() ? source : OpenNamedWorkspace(source, workspace_id);
  auto* controller = WindowModeController::GetForBrowser(target);
  if (!controller) {
    return nullptr;
  }
  const auto weak_target = target->AsWeakPtr();
  return controller->RestorePresentation(presentation) ? weak_target.get()
                                                       : nullptr;
}

NamedWorkspaceCaptureResult CaptureNamedWorkspace(Browser* browser,
                                                  std::string_view name) {
  if (!browser || !(browser->is_type_normal()) ||
      !NamedWorkspaceStore(browser->GetProfile()).enabled()) {
    return {.failure = NamedWorkspaceCaptureFailure::kUnavailable};
  }
  auto* mode = WindowModeController::GetForBrowser(browser);
  auto* model = browser->tab_strip_model();
  if (!mode || !model || !model->delegate()->IsTabStripEditable()) {
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
  workspace.presentation = mode->CapturePresentation();
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
  if (!source || !(source->is_type_normal())) {
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
  if (!model || !model->empty() ||
      (!workspace->groups.empty() && !model->SupportsTabGroups())) {
    restored->GetWindow()->Show();
    return nullptr;
  }
  struct RestoredTabIdentity {
    base::WeakPtr<tabs::TabInterface> tab;
    base::WeakPtr<content::WebContents> contents;
  };
  std::vector<RestoredTabIdentity> identities;
  std::vector<std::optional<tab_groups::TabGroupId>> expected_groups(
      workspace->tabs.size());
  std::vector<std::optional<split_tabs::SplitTabId>> expected_splits(
      workspace->tabs.size());
  std::vector<std::pair<tab_groups::TabGroupId, tab_groups::TabGroupVisualData>>
      applied_visuals;
  bool active_tab_selected = false;
  const auto matches_restored_tabs = [&] {
    if (!weak_restored || restored->tab_strip_model() != model ||
        model->count() != static_cast<int>(identities.size())) {
      return false;
    }
    for (size_t index = 0; index < identities.size(); ++index) {
      const auto& identity = identities[index];
      if (!identity.tab || !identity.contents ||
          model->GetTabAtIndex(static_cast<int>(index)) != identity.tab.get() ||
          identity.tab->GetContents() != identity.contents.get() ||
          identity.tab->IsPinned() != workspace->tabs[index].pinned ||
          identity.tab->GetGroup() != expected_groups[index] ||
          identity.tab->GetSplit() != expected_splits[index] ||
          (expected_groups[index] &&
           !model->group_model()->ContainsTabGroup(*expected_groups[index])) ||
          (expected_splits[index] &&
           !model->GetSplitData(*expected_splits[index]))) {
        return false;
      }
    }
    for (const auto& [group, visual] : applied_visuals) {
      if (!model->group_model()->ContainsTabGroup(group) ||
          *model->group_model()->GetTabGroup(group)->visual_data() != visual) {
        return false;
      }
    }
    return !active_tab_selected ||
           model->active_index() == workspace->active_tab;
  };
  const auto preserve_interrupted_window = [&]() -> Browser* {
    if (weak_restored) {
      restored->GetWindow()->Show();
    }
    return nullptr;
  };
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
    if (!contents || model->count() != static_cast<int>(index + 1) ||
        model->GetWebContentsAt(static_cast<int>(index)) != contents ||
        contents->GetBrowserContext() != restored->GetProfile()) {
      // An unusual browser observer changed the new window. Preserve any
      // work it may have acquired; never force-close a partially opened window.
      return preserve_interrupted_window();
    }
    identities.push_back(
        {model->GetTabAtIndex(static_cast<int>(index))->GetWeakPtr(),
         contents->GetWeakPtr()});
    if (!matches_restored_tabs()) {
      return preserve_interrupted_window();
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
    for (int index : indices) {
      expected_groups[index] = groups.back();
    }
    if (!matches_restored_tabs()) {
      return preserve_interrupted_window();
    }
  }
  for (const auto& split : workspace->splits) {
    const auto split_id = split_tabs::SplitTabId::GenerateNew();
    model->RestoreSplit(split_id, split.tabs, split.visual);
    for (int index : split.tabs) {
      expected_splits[index] = split_id;
    }
    if (!matches_restored_tabs()) {
      return preserve_interrupted_window();
    }
  }
  model->ActivateTabAt(workspace->active_tab);
  active_tab_selected = true;
  if (!matches_restored_tabs()) {
    return preserve_interrupted_window();
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
    applied_visuals.emplace_back(groups[group], visual);
    // Group visual observers are synchronous and can legitimately rearrange
    // tabs or remove the next group without destroying the window. Never use
    // the saved indices/IDs again unless their identities still match.
    if (!matches_restored_tabs()) {
      return preserve_interrupted_window();
    }
  }
  auto* mode = WindowModeController::GetForBrowser(restored);
  const bool presentation_restored =
      mode && (workspace->presentation
                   ? mode->RestorePresentation(*workspace->presentation)
                   : mode->ApplyWorkspacePresentation(workspace->mode,
                                                      workspace->rail_state,
                                                      workspace->rail_width));
  // Presentation and Show() notify native observers, which can close a window.
  // Never return or dereference its raw pointer after those callbacks.
  if (!matches_restored_tabs()) {
    return preserve_interrupted_window();
  }
  restored->GetWindow()->Show();
  return presentation_restored && matches_restored_tabs() ? weak_restored.get()
                                                          : nullptr;
}

}  // namespace tahai
