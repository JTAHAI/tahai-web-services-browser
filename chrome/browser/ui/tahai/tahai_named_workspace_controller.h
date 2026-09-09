// Copyright 2026 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_NAMED_WORKSPACE_CONTROLLER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_NAMED_WORKSPACE_CONTROLLER_H_

#include <optional>

#include "chrome/browser/ui/tahai/tahai_named_workspace_store.h"
#include "ui/base/interaction/element_identifier.h"

class Browser;

namespace tahai {

DECLARE_ELEMENT_IDENTIFIER_VALUE(kNamedWorkspaceNameElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kNamedWorkspaceSaveElementId);

enum class NamedWorkspaceCaptureFailure {
  kNone,
  kUnavailable,
  kNoTabs,
  kTooManyTabs,
  kUnsupportedTab,
  kUnsupportedLayout,
};

struct NamedWorkspaceCaptureResult {
  std::optional<NamedWorkspace> workspace;
  NamedWorkspaceCaptureFailure failure = NamedWorkspaceCaptureFailure::kNone;
};

// Browser-owned entry points only, never callable by arbitrary page script.
// The failure is intentionally specific enough for the native manager to tell
// the user what to fix. No variant omits a tab or rewrites current state.
NamedWorkspaceCaptureResult CaptureNamedWorkspace(Browser* browser,
                                                  std::string_view name);
// Returns a newly created window in the same regular profile. The source
// window is never closed, navigated, or reordered. This restores navigation
// references, not unsaved forms or authenticated sessions in another profile.
Browser* OpenNamedWorkspace(Browser* source, std::string_view id);
void ShowNamedWorkspaceManager(Browser* browser);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_NAMED_WORKSPACE_CONTROLLER_H_
