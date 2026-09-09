// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_NAMED_WORKSPACE_STORE_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_NAMED_WORKSPACE_STORE_H_

#include <cstddef>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/values.h"
#include "components/split_tabs/split_tab_visual_data.h"
#include "components/tab_groups/tab_group_visual_data.h"
#include "url/gurl.h"

class Profile;

namespace tahai {

struct NamedWorkspaceTab {
  GURL url;
  bool pinned = false;
  int group = -1;
};

struct NamedWorkspaceSplit {
  std::vector<int> tabs;
  split_tabs::SplitTabVisualData visual;
};

// Only an explicit save captures these local navigation references. No page
// bodies, cookies, form values, navigation history, or security authority.
struct NamedWorkspace {
  std::string id;
  std::string name;
  std::string mode;
  std::string rail_state;
  int rail_width = 280;
  int active_tab = 0;
  std::vector<NamedWorkspaceTab> tabs;
  std::vector<tab_groups::TabGroupVisualData> groups;
  std::vector<NamedWorkspaceSplit> splits;
};

// UI-sequence, profile-local, non-syncable pref storage. Every operation reads
// the latest value so concurrent windows cannot overwrite each other's saves.
// Corrupt/unknown-version stores fail closed without rewriting existing data.
class NamedWorkspaceStore {
 public:
  static constexpr size_t kMaxWorkspaces = 24;
  static constexpr size_t kMaxTabs = 64;

  explicit NamedWorkspaceStore(Profile* profile);
  bool enabled() const;
  // Uses the same byte, encoding, and control-character rules used when a
  // workspace is written. Callers use this to give a specific remedy before a
  // save attempt rather than collapsing every validation problem into a
  // generic failure.
  static bool IsValidName(std::string_view name);
  std::optional<std::vector<NamedWorkspace>> Read() const;
  std::optional<NamedWorkspace> Find(std::string_view id) const;
  // Always adds a new id; never silently overwrites another saved workspace.
  std::optional<std::string> Add(NamedWorkspace workspace);
  // Replaces the saved snapshot with the current window after an explicit UI
  // confirmation. The stable id and the saved workspace's name are retained.
  bool Replace(std::string_view id, NamedWorkspace workspace);
  bool Rename(std::string_view id, std::string_view name);
  bool Remove(std::string_view id);

  static bool IsRestorableUrl(const GURL& url);
  static GURL CanonicalizeInternalUrl(const GURL& url);
  static bool Validate(const NamedWorkspace& workspace);
  static base::DictValue Encode(const NamedWorkspace& workspace);
  static std::optional<NamedWorkspace> Decode(const base::DictValue& value);

 private:
  bool Write(const std::vector<NamedWorkspace>& workspaces);
  const raw_ptr<Profile> profile_;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_NAMED_WORKSPACE_STORE_H_
