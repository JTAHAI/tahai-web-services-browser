// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/tahai/tahai_named_workspace_store.h"

#include <algorithm>
#include <cmath>
#include <set>
#include <string_view>
#include <utility>

#include "base/json/json_writer.h"
#include "base/strings/string_util.h"
#include "base/strings/utf_string_conversions.h"
#include "base/uuid.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/common/webui_url_constants.h"
#include "components/prefs/pref_service.h"
#include "components/tab_groups/tab_group_color.h"
#include "url/url_constants.h"

namespace tahai {
namespace {

bool ValidText(std::string_view text, size_t limit, bool allow_empty = false) {
  if (text.size() > limit || (!allow_empty && text.empty()) ||
      !base::IsStringUTF8(text)) {
    return false;
  }
  return std::ranges::none_of(
             text, [](unsigned char c) { return c < 0x20 || c == 0x7f; }) &&
         (allow_empty ||
          !base::TrimWhitespaceASCII(text, base::TRIM_ALL).empty());
}

bool Ratio(double value, double minimum, double maximum) {
  return std::isfinite(value) && value >= minimum && value <= maximum;
}

}  // namespace

NamedWorkspaceStore::NamedWorkspaceStore(Profile* profile)
    : profile_(profile) {}

bool NamedWorkspaceStore::enabled() const {
  return profile_ && !profile_->IsOffTheRecord() &&
         !profile_->IsGuestSession() && profile_->IsRegularProfile() &&
         profile_->GetPrefs()->FindPreference(prefs::kTahaiNamedWorkspaces) &&
         profile_->GetPrefs()->GetBoolean(prefs::kTahaiNamedWorkspacesEnabled);
}

// static
bool NamedWorkspaceStore::IsValidName(std::string_view name) {
  return ValidText(name, 120);
}

bool NamedWorkspaceStore::IsRestorableUrl(const GURL& url) {
  if (!url.is_valid() || url.spec().size() > 8192 || url.has_username() ||
      url.has_password()) {
    return false;
  }
  if (url.SchemeIsHTTPOrHTTPS() || url.spec() == url::kAboutBlankURL ||
      url.spec() == chrome::kChromeUINewTabURL) {
    return true;
  }
  // Avoid repeatedly parsing fixed internal routes for ordinary web tabs.
  const GURL canonical = CanonicalizeInternalUrl(url);
  static constexpr const char* kTrustedPages[] = {
      kTahaiTrustedNewTabURL,   kTahaiTrustedMissionURL,
      kTahaiTrustedOpsToolsURL, kTahaiTrustedProfilesURL,
      kTahaiTrustedSupportURL,  kTahaiTrustedPolicyURL,
      kTahaiTrustedModesURL,    kTahaiTrustedLocalOiURL};
  return std::ranges::any_of(kTrustedPages, [&canonical](const char* known) {
    return canonical.spec() == known;
  });
}

GURL NamedWorkspaceStore::CanonicalizeInternalUrl(const GURL& url) {
  static constexpr std::pair<const char*, const char*> kRoutes[] = {
      {kTahaiNewTabURL, kTahaiTrustedNewTabURL},
      {kTahaiMissionURL, kTahaiTrustedMissionURL},
      {kTahaiOpsToolsURL, kTahaiTrustedOpsToolsURL},
      {kTahaiProfilesURL, kTahaiTrustedProfilesURL},
      {kTahaiSupportURL, kTahaiTrustedSupportURL},
      {kTahaiPolicyURL, kTahaiTrustedPolicyURL},
      {kTahaiModesURL, kTahaiTrustedModesURL},
      {kTahaiLocalOiURL, kTahaiTrustedLocalOiURL}};
  for (const auto& [alias, trusted] : kRoutes) {
    if (url.spec() == alias) {
      return GURL(trusted);
    }
  }
  return url;
}

bool NamedWorkspaceStore::Validate(const NamedWorkspace& workspace) {
  if (!base::Uuid::ParseLowercase(workspace.id).is_valid() ||
      !IsValidName(workspace.name) ||
      !ModeService::FindDefinition(workspace.mode) ||
      (workspace.rail_state != "icons" && workspace.rail_state != "expanded" &&
       workspace.rail_state != "hidden") ||
      workspace.rail_width < 220 || workspace.rail_width > 480 ||
      workspace.tabs.empty() || workspace.tabs.size() > kMaxTabs ||
      workspace.groups.size() > workspace.tabs.size() ||
      workspace.splits.size() > workspace.tabs.size() / 2 ||
      workspace.active_tab < 0 ||
      static_cast<size_t>(workspace.active_tab) >= workspace.tabs.size()) {
    return false;
  }
  bool seen_unpinned = false;
  std::set<int> seen_groups;
  int previous_group = -1;
  for (const auto& tab : workspace.tabs) {
    if (!IsRestorableUrl(tab.url) || (seen_unpinned && tab.pinned) ||
        tab.group < -1 ||
        (tab.group >= 0 &&
         static_cast<size_t>(tab.group) >= workspace.groups.size()) ||
        (tab.pinned && tab.group != -1)) {
      return false;
    }
    seen_unpinned |= !tab.pinned;
    if (tab.group != previous_group && tab.group != -1 &&
        !seen_groups.insert(tab.group).second) {
      return false;  // Groups must occupy one contiguous interval.
    }
    previous_group = tab.group;
  }
  if (seen_groups.size() != workspace.groups.size()) {
    return false;
  }
  for (const auto& group : workspace.groups) {
    if (!ValidText(base::UTF16ToUTF8(group.title()), 256, true) ||
        !tab_groups::GetTabGroupColorLabelMap().contains(group.color())) {
      return false;
    }
  }
  std::set<int> split_members;
  for (const auto& split : workspace.splits) {
    const auto& visual = split.visual;
    if (split.tabs.size() < 2 || split.tabs.size() > 4 ||
        (visual.split_layout() != split_tabs::SplitTabLayout::kSideBySide &&
         visual.split_layout() != split_tabs::SplitTabLayout::kStacked) ||
        !Ratio(visual.split_ratio(), 0, 1) ||
        !Ratio(visual.tahai_row_ratio(), 0.1, 0.9) ||
        !Ratio(visual.tahai_column_ratio(), 0.1, 0.9)) {
      return false;
    }
    int previous = -1;
    for (int index : split.tabs) {
      if (index < 0 || static_cast<size_t>(index) >= workspace.tabs.size() ||
          (previous != -1 && index != previous + 1) ||
          !split_members.insert(index).second) {
        return false;
      }
      const auto& first = workspace.tabs[split.tabs.front()];
      if (workspace.tabs[index].group != first.group ||
          workspace.tabs[index].pinned != first.pinned) {
        return false;
      }
      previous = index;
    }
  }
  return true;
}

base::DictValue NamedWorkspaceStore::Encode(const NamedWorkspace& workspace) {
  base::DictValue value;
  value.Set("id", workspace.id);
  value.Set("name", workspace.name);
  value.Set("mode", workspace.mode);
  value.Set("rail", workspace.rail_state);
  value.Set("rail_width", workspace.rail_width);
  value.Set("active", workspace.active_tab);
  base::ListValue tabs;
  for (const auto& tab : workspace.tabs) {
    tabs.Append(base::DictValue()
                    .Set("url", tab.url.spec())
                    .Set("pinned", tab.pinned)
                    .Set("group", tab.group));
  }
  value.Set("tabs", std::move(tabs));
  base::ListValue groups;
  for (const auto& group : workspace.groups) {
    groups.Append(base::DictValue()
                      .Set("title", base::UTF16ToUTF8(group.title()))
                      .Set("color", static_cast<int>(group.color()))
                      .Set("collapsed", group.is_collapsed()));
  }
  value.Set("groups", std::move(groups));
  base::ListValue splits;
  for (const auto& split : workspace.splits) {
    base::ListValue members;
    for (int index : split.tabs) {
      members.Append(index);
    }
    splits.Append(
        base::DictValue()
            .Set("tabs", std::move(members))
            .Set("layout", static_cast<int>(split.visual.split_layout()))
            .Set("ratio", split.visual.split_ratio())
            .Set("rows", split.visual.tahai_row_ratio())
            .Set("columns", split.visual.tahai_column_ratio()));
  }
  value.Set("splits", std::move(splits));
  return value;
}

std::optional<NamedWorkspace> NamedWorkspaceStore::Decode(
    const base::DictValue& value) {
  const auto* id = value.FindString("id");
  const auto* name = value.FindString("name");
  const auto* mode = value.FindString("mode");
  const auto* rail = value.FindString("rail");
  const auto width = value.FindInt("rail_width");
  const auto active = value.FindInt("active");
  const auto* tabs = value.FindList("tabs");
  const auto* groups = value.FindList("groups");
  const auto* splits = value.FindList("splits");
  if (value.size() != 9 || !id || id->size() != 36 || !name ||
      !IsValidName(*name) || !mode || mode->size() > 32 || !rail ||
      rail->size() > 16 || !width || !active || !tabs || !groups || !splits ||
      tabs->size() > kMaxTabs || groups->size() > kMaxTabs ||
      splits->size() > kMaxTabs / 2) {
    return std::nullopt;
  }
  NamedWorkspace workspace{.id = *id,
                           .name = *name,
                           .mode = *mode,
                           .rail_state = *rail,
                           .rail_width = *width,
                           .active_tab = *active};
  for (const auto& entry : *tabs) {
    const auto* tab = entry.GetIfDict();
    if (!tab || tab->size() != 3 || !tab->FindString("url") ||
        tab->FindString("url")->size() > 8192 || !tab->FindBool("pinned") ||
        !tab->FindInt("group")) {
      return std::nullopt;
    }
    workspace.tabs.push_back({GURL(*tab->FindString("url")),
                              *tab->FindBool("pinned"),
                              *tab->FindInt("group")});
  }
  for (const auto& entry : *groups) {
    const auto* group = entry.GetIfDict();
    if (!group || group->size() != 3 || !group->FindString("title") ||
        !ValidText(*group->FindString("title"), 256, true) ||
        !group->FindInt("color") ||
        !tab_groups::GetTabGroupColorLabelMap().contains(
            static_cast<tab_groups::TabGroupColorId>(
                *group->FindInt("color"))) ||
        !group->FindBool("collapsed")) {
      return std::nullopt;
    }
    workspace.groups.emplace_back(
        base::UTF8ToUTF16(*group->FindString("title")),
        static_cast<tab_groups::TabGroupColorId>(*group->FindInt("color")),
        *group->FindBool("collapsed"));
  }
  for (const auto& entry : *splits) {
    const auto* split = entry.GetIfDict();
    if (!split || split->size() != 5 || !split->FindList("tabs") ||
        !split->FindInt("layout") || !split->FindDouble("ratio") ||
        !split->FindDouble("rows") || !split->FindDouble("columns") ||
        split->FindList("tabs")->size() > 4 ||
        !Ratio(*split->FindDouble("rows"), 0.1, 0.9) ||
        !Ratio(*split->FindDouble("columns"), 0.1, 0.9)) {
      return std::nullopt;
    }
    NamedWorkspaceSplit saved;
    saved.visual.set_split_layout(
        static_cast<split_tabs::SplitTabLayout>(*split->FindInt("layout")));
    saved.visual.set_split_ratio(*split->FindDouble("ratio"));
    saved.visual.set_tahai_grid_ratios(*split->FindDouble("rows"),
                                       *split->FindDouble("columns"));
    for (const auto& index : *split->FindList("tabs")) {
      if (!index.is_int()) {
        return std::nullopt;
      }
      saved.tabs.push_back(index.GetInt());
    }
    workspace.splits.push_back(std::move(saved));
  }
  if (!Validate(workspace)) {
    return std::nullopt;
  }
  return workspace;
}

std::optional<std::vector<NamedWorkspace>> NamedWorkspaceStore::Read() const {
  if (!enabled()) {
    return std::nullopt;
  }
  const auto& root =
      profile_->GetPrefs()->GetDict(prefs::kTahaiNamedWorkspaces);
  if (root.empty()) {
    return std::vector<NamedWorkspace>();
  }
  const auto* entries = root.FindList("entries");
  if (root.size() != 2 || root.FindInt("version") != 1 || !entries ||
      entries->size() > kMaxWorkspaces) {
    return std::nullopt;
  }
  std::vector<NamedWorkspace> result;
  std::set<std::string> ids;
  for (const auto& entry : *entries) {
    if (!entry.is_dict()) {
      return std::nullopt;
    }
    auto workspace = Decode(entry.GetDict());
    if (!workspace || !ids.insert(workspace->id).second) {
      return std::nullopt;
    }
    result.push_back(std::move(*workspace));
  }
  auto json = base::WriteJson(root);
  return json && json->size() <= 4 * 1024 * 1024
             ? std::make_optional(std::move(result))
             : std::nullopt;
}

std::optional<NamedWorkspace> NamedWorkspaceStore::Find(
    std::string_view id) const {
  auto entries = Read();
  if (entries) {
    for (auto& entry : *entries) {
      if (entry.id == id) {
        return std::move(entry);
      }
    }
  }
  return std::nullopt;
}

bool NamedWorkspaceStore::Write(const std::vector<NamedWorkspace>& workspaces) {
  if (!enabled() || workspaces.size() > kMaxWorkspaces) {
    return false;
  }
  base::ListValue entries;
  std::set<std::string> ids;
  for (const auto& entry : workspaces) {
    if (!Validate(entry) || !ids.insert(entry.id).second) {
      return false;
    }
    entries.Append(Encode(entry));
  }
  base::DictValue root;
  root.Set("version", 1);
  root.Set("entries", std::move(entries));
  // Includes URL/JSON escaping overhead; no silently evicted older entries.
  auto json = base::WriteJson(root);
  if (!json || json->size() > 4 * 1024 * 1024) {
    return false;
  }
  profile_->GetPrefs()->SetDict(prefs::kTahaiNamedWorkspaces, std::move(root));
  return true;
}

std::optional<std::string> NamedWorkspaceStore::Add(NamedWorkspace workspace) {
  auto entries = Read();
  if (!entries || entries->size() >= kMaxWorkspaces) {
    return std::nullopt;
  }
  workspace.id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  const std::string id = workspace.id;
  entries->push_back(std::move(workspace));
  return Write(*entries) ? std::make_optional(id) : std::nullopt;
}

bool NamedWorkspaceStore::Replace(std::string_view id,
                                  NamedWorkspace workspace) {
  auto entries = Read();
  if (!entries) {
    return false;
  }
  for (auto& entry : *entries) {
    if (entry.id == id) {
      workspace.id = entry.id;
      workspace.name = entry.name;
      entry = std::move(workspace);
      return Write(*entries);
    }
  }
  return false;
}

bool NamedWorkspaceStore::Rename(std::string_view id, std::string_view name) {
  auto entries = Read();
  if (entries) {
    for (auto& entry : *entries) {
      if (entry.id == id) {
        entry.name = name;
        return Write(*entries);
      }
    }
  }
  return false;
}

bool NamedWorkspaceStore::Remove(std::string_view id) {
  auto entries = Read();
  if (!entries || std::erase_if(*entries, [id](const auto& entry) {
                    return entry.id == id;
                  }) == 0) {
    return false;
  }
  return Write(*entries);
}

}  // namespace tahai
