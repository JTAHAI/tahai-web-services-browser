// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_PANE_LAYOUT_TRANSITION_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_PANE_LAYOUT_TRANSITION_H_

#include <cstddef>
#include <optional>

#include "base/functional/callback.h"
#include "components/split_tabs/split_tab_visual_data.h"
#include "components/tab_groups/tab_group_id.h"

class Browser;
namespace content {
class WebContents;
}

namespace tahai {

// A browser-owned creation seam; never supplied by a renderer. The default
// creates a background New Tab Page through Chromium's navigation path.
using PaneCreationCallback = base::RepeatingCallback<
    content::WebContents*(int, std::optional<tab_groups::TabGroupId>, bool)>;

// Prepare all members before dismantling an existing split. On failure, keep
// the original split and remove only newly created, unchanged empty panes.
// Existing tabs and panes that acquired navigation/unload state are untouched.
bool ApplyNativePaneLayout(Browser* browser,
                           size_t member_count,
                           split_tabs::SplitTabLayout layout,
                           const PaneCreationCallback& create_pane = {});

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_PANE_LAYOUT_TRANSITION_H_
