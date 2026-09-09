// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_sentinel_schedule.h"

#include <algorithm>
#include <limits>
#include <string>

namespace tahai {

std::string_view TahaiSentinelScheduleStateName(
    TahaiSentinelScheduleState state) {
  switch (state) {
    case TahaiSentinelScheduleState::kInvalid:
      return "invalid";
    case TahaiSentinelScheduleState::kDue:
      return "due";
    case TahaiSentinelScheduleState::kScheduled:
      return "scheduled";
  }
  return "invalid";
}

TahaiSentinelScheduleStatus GetTahaiSentinelManualScheduleStatus(
    const TahaiSentinelWatchRequest& request,
    std::optional<int64_t> last_completed_micros,
    int64_t now_micros) {
  std::string canonical_target;
  if (now_micros <= 0 ||
      ValidateTahaiSentinelWatchRequest(request, &canonical_target) !=
          TahaiSentinelWatchValidationResult::kValid ||
      (last_completed_micros && *last_completed_micros <= 0)) {
    return {};
  }

  TahaiSentinelScheduleStatus status;
  if (!last_completed_micros) {
    status.state = TahaiSentinelScheduleState::kDue;
    status.seconds_until_due = 0;
    return status;
  }
  status.last_completed_micros = *last_completed_micros;
  // A restored profile or a clock correction can leave completion metadata in
  // the future. Sentinel is only a manual cadence aid, so stale/future local
  // time must never suppress the next explicit operator recheck.
  if (*last_completed_micros > now_micros) {
    status.state = TahaiSentinelScheduleState::kDue;
    status.seconds_until_due = 0;
    return status;
  }
  const int64_t interval_micros =
      static_cast<int64_t>(request.interval_seconds) * 1000000;
  if (*last_completed_micros >
      std::numeric_limits<int64_t>::max() - interval_micros) {
    return {};
  }
  status.next_due_micros = *last_completed_micros + interval_micros;
  if (status.next_due_micros <= now_micros) {
    status.state = TahaiSentinelScheduleState::kDue;
    status.seconds_until_due = 0;
    return status;
  }
  status.state = TahaiSentinelScheduleState::kScheduled;
  status.seconds_until_due =
      (status.next_due_micros - now_micros + 999999) / 1000000;
  return status;
}

}  // namespace tahai
