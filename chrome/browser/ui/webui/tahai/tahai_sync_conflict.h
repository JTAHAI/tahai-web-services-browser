// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_CONFLICT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_CONFLICT_H_

#include <cstdint>
#include <string>
#include <string_view>

#include "chrome/browser/ui/webui/tahai/tahai_sync_contract.h"

namespace tahai {

// Revision metadata is transport-independent, but it is security-sensitive.
// Callers must populate it only from metadata covered by an authenticated
// TAHAI Sync envelope. A transport response by itself is never authoritative.
struct TahaiSyncRevision {
  TahaiSyncObjectType object_type;
  std::string object_id;
  std::string revision_id;
  std::string parent_revision_id;
  int64_t modified_micros = 0;
  std::string device_id;
  std::string plaintext_sha256;
};

enum class TahaiSyncConflictRelation {
  kInvalid,
  kIdentical,
  kLocalDescendsRemote,
  kRemoteDescendsLocal,
  kDiverged,
};

// Every valid decision is convergent: two clients given the same authenticated
// inputs select the same canonical revision and, where required, the same
// conflict-copy identifier. No policy silently drops an explicit user record.
enum class TahaiSyncConflictAction {
  kReject,
  kNoOp,
  kUseLocal,
  kUseRemote,
  kKeepLocalAndForkRemote,
  kKeepRemoteAndForkLocal,
};

struct TahaiSyncConflictDecision {
  TahaiSyncConflictRelation relation = TahaiSyncConflictRelation::kInvalid;
  TahaiSyncConflictAction action = TahaiSyncConflictAction::kReject;
  std::string forked_object_id;
  std::string_view reason;
};

bool IsValidTahaiSyncRevision(const TahaiSyncRevision& revision);

// Resolves direct ancestry immediately. Concurrent finite preferences use a
// deterministic last-writer rule. Bookmarks and explicit user records preserve
// both revisions by assigning the non-canonical revision a stable conflict ID.
TahaiSyncConflictDecision ResolveTahaiSyncConflict(
    const TahaiSyncRevision& local,
    const TahaiSyncRevision& remote);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_CONFLICT_H_
