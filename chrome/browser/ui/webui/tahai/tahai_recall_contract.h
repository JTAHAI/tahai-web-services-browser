// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_RECALL_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_RECALL_CONTRACT_H_

#include <optional>
#include <string_view>

namespace tahai {

// Maps one finite TAHAI Recall scope to the matching persisted Local OI
// projection kind. Unsupported browser-data scopes (history, tabs, downloads,
// credentials, and page content) deliberately have no mapping.
std::optional<std::string_view> TahaiRecallScopeToLocalOiKind(
    std::string_view scope);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_RECALL_CONTRACT_H_
