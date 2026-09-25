// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_WORKFLOW_JOURNAL_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_WORKFLOW_JOURNAL_H_

#include <string>
#include <string_view>

#include "base/files/file_path.h"

namespace tahai {

enum class WorkflowAttempt {
  kReserved,
  kUnknown,
  kDispatched,
  kRejected,
  kUnavailable,
};

// Hashes only opaque, validated run/revision/step identity, never user values.
// An empty result indicates a malformed identity and cannot be journaled.
std::string WorkflowAttemptKey(std::string_view mission_id,
                               std::string_view archive_sha256,
                               std::string_view workflow_id,
                               std::string_view step_id);

// Blocking background-sequence I/O. Only kReserved permits a *new* dispatch:
// its intent transaction has committed with SQLite flush-to-media enabled.
// All existing attempts, including uncertain crash outcomes, forbid replay.
// Corrupt, full, unreadable or future-version stores fail closed, never raze.
WorkflowAttempt ReserveWorkflowAttempt(const base::FilePath& profile_directory,
                                       std::string_view key);
bool RecordWorkflowAttemptResult(const base::FilePath& profile_directory,
                                  std::string_view key, bool dispatched);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_WORKFLOW_JOURNAL_H_
