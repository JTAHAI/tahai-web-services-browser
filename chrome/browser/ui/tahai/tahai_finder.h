// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_FINDER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_FINDER_H_

#include <string>
#include <optional>
#include <string_view>
#include <vector>

#include "base/memory/weak_ptr.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"
#include "ui/base/interaction/element_identifier.h"

class Browser;
namespace content {
class WebContents;
}

namespace tahai {

DECLARE_ELEMENT_IDENTIFIER_VALUE(kFinderSearchElementId);
DECLARE_ELEMENT_IDENTIFIER_VALUE(kFinderResultsElementId);

struct FinderResult {
  enum class Kind { kCommand, kTab, kWorkspace, kModeAction };
  Kind kind;
  std::u16string title;
  std::u16string detail;
  int command_id = 0;
  base::WeakPtr<Browser> browser;
  base::WeakPtr<content::WebContents> contents;
  std::string workspace_id;
  std::optional<WindowModeActionContext> mode_action_context;
};

// Profile equality is exact: private windows never search the original profile.
// Results carry native object identity and are revalidated before activation.
std::vector<FinderResult> FindBrowserItems(Browser* source,
                                           std::u16string_view query);
bool ActivateFinderResult(Browser* source, const FinderResult& result);
void ShowFinder(Browser* browser);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_FINDER_H_
