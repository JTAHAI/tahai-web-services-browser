// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SENTINEL_SCHEDULE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SENTINEL_SCHEDULE_H_

#include <cstdint>
#include <optional>
#include <string_view>

#include "chrome/browser/ui/webui/tahai/tahai_sentinel_contract.h"

namespace tahai {

// This is scheduling state for an explicit manual recheck queue. It is not a
// timer, task runner, or authorization for background network activity.
enum class TahaiSentinelScheduleState {
  kInvalid,
  kDue,
  kScheduled,
};

// Returns a stable local display token. It does not represent a task state or
// authorize any automatic recheck.
std::string_view TahaiSentinelScheduleStateName(
    TahaiSentinelScheduleState state);

struct TahaiSentinelScheduleStatus {
  TahaiSentinelScheduleState state = TahaiSentinelScheduleState::kInvalid;
  // Zero means an operator has never completed this explicit recheck.
  int64_t last_completed_micros = 0;
  int64_t next_due_micros = 0;
  int64_t seconds_until_due = 0;
};

// Computes a display-safe due state using a validated manual-watch request and
// Windows-epoch microseconds. It never starts a timer or performs a request.
TahaiSentinelScheduleStatus GetTahaiSentinelManualScheduleStatus(
    const TahaiSentinelWatchRequest& request,
    std::optional<int64_t> last_completed_micros,
    int64_t now_micros);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SENTINEL_SCHEDULE_H_
