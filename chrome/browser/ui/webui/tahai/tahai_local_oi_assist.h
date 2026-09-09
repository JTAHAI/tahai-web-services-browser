// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_ASSIST_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_ASSIST_H_

#include <optional>
#include <string>
#include <string_view>
#include <vector>

namespace tahai {

// Local OI remains useful without a model. This finite vocabulary is the only
// future on-device assist surface: it cannot navigate, change a Mission,
// invoke a tool, browse a page, access an account, or perform a network call.
enum class LocalOiAssistOperation {
  kExplainSelectedFindings,
  kSummarizeSelectedRecords,
  kDraftChecklist,
  kDraftSanitizedHandoff,
};

struct LocalOiAssistRequest {
  LocalOiAssistOperation operation =
      LocalOiAssistOperation::kExplainSelectedFindings;
  // The caller must name one to eight existing profile-local entity or finding
  // IDs. The request is never expanded through search, graph traversal, or
  // history.
  std::vector<std::string> selected_record_ids;
};

// This is the only shaped data a future on-device adapter may receive. It is
// produced from an explicit Local OI selection, not from tabs, history, page
// bodies, credentials, cookies, forms, account state, or browser storage.
struct LocalOiAssistRecord {
  std::string kind;
  std::string label;
  std::string detail;
};

struct LocalOiAssistPrompt {
  LocalOiAssistOperation operation;
  std::vector<LocalOiAssistRecord> selected_records;
};

// A deterministic operator-facing brief derived only from an already-bounded
// Local OI prompt. It is not model output, is never persisted or copied, and
// has no provider, tool, navigation, or background-action capability.
struct LocalOiDeterministicBrief {
  std::string title;
  std::vector<std::string> lines;
};

// A future implementation must be backed by an on-device runtime and must
// honor the Local OI policy gate before it is called. This interface has no
// provider, URL, credential, transport, tool, navigation, or write method.
class LocalOiAssistAdapter {
 public:
  virtual ~LocalOiAssistAdapter() = default;

  virtual bool IsConfigured() const = 0;
  virtual std::optional<std::string> Generate(
      const LocalOiAssistPrompt& prompt) = 0;
};

std::string_view LocalOiAssistOperationLabel(LocalOiAssistOperation operation);
std::optional<LocalOiAssistOperation> LocalOiAssistOperationFromString(
    std::string_view operation);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_ASSIST_H_
