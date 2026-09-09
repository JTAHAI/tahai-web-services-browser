// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_sync_conflict.h"

#include <algorithm>
#include <string>
#include <string_view>
#include <tuple>

#include "base/strings/string_util.h"

namespace tahai {
namespace {

constexpr size_t kMaxObjectIdBytes = 128;
constexpr size_t kMaxRevisionIdBytes = 128;
constexpr size_t kMaxDeviceIdBytes = 64;
// A conflict-copy ID remains in the 128-byte opaque object-ID vocabulary while
// retaining the *complete* authenticated plaintext digest. Truncating the
// digest to a short display token would make distinct divergent revisions
// collide at a materially lower work factor.
constexpr size_t kConflictObjectPrefixBytes = 54;

bool IsOpaqueToken(std::string_view value, size_t maximum_bytes) {
  if (value.empty() || value.size() > maximum_bytes ||
      !base::IsStringASCII(value)) {
    return false;
  }
  return std::ranges::all_of(value, [](char character) {
    return base::IsAsciiAlpha(character) || base::IsAsciiDigit(character) ||
           character == '-' || character == '_' || character == '.' ||
           character == ':';
  });
}

bool IsSha256(std::string_view value) {
  return value.size() == 64 && std::ranges::all_of(value, [](char character) {
           return base::IsAsciiDigit(character) ||
                  (character >= 'a' && character <= 'f');
         });
}

bool IsPreserveBothType(TahaiSyncObjectType object_type) {
  switch (object_type) {
    case TahaiSyncObjectType::kBookmarks:
    case TahaiSyncObjectType::kMissionNotes:
    case TahaiSyncObjectType::kEvidenceMetadata:
    case TahaiSyncObjectType::kOpenTabSnapshots:
    case TahaiSyncObjectType::kDeviceHandoff:
    case TahaiSyncObjectType::kMissionCapsule:
      return true;
    case TahaiSyncObjectType::kModePreferences:
    case TahaiSyncObjectType::kLaunchRecipes:
    case TahaiSyncObjectType::kMissionLayouts:
    case TahaiSyncObjectType::kCommandPreferences:
    case TahaiSyncObjectType::kAdminConsoleProfiles:
    case TahaiSyncObjectType::kCookies:
    case TahaiSyncObjectType::kLoginSessions:
    case TahaiSyncObjectType::kOAuthTokens:
    case TahaiSyncObjectType::kAuthorizationHeaders:
    case TahaiSyncObjectType::kPasswords:
    case TahaiSyncObjectType::kRawPageContent:
      return false;
  }
  return false;
}

bool LocalIsCanonical(const TahaiSyncRevision& local,
                      const TahaiSyncRevision& remote) {
  return std::tie(local.modified_micros, local.device_id, local.revision_id,
                  local.plaintext_sha256) >
         std::tie(remote.modified_micros, remote.device_id, remote.revision_id,
                  remote.plaintext_sha256);
}

std::string ConflictObjectId(const TahaiSyncRevision& revision) {
  const std::string_view object_prefix(
      revision.object_id.data(),
      std::min(revision.object_id.size(), kConflictObjectPrefixBytes));
  return std::string(object_prefix) + ".conflict." + revision.plaintext_sha256;
}

TahaiSyncConflictDecision Reject(std::string_view reason) {
  return {
      .relation = TahaiSyncConflictRelation::kInvalid,
      .action = TahaiSyncConflictAction::kReject,
      .reason = reason,
  };
}

}  // namespace

bool IsValidTahaiSyncRevision(const TahaiSyncRevision& revision) {
  const TahaiSyncDataPolicy* policy =
      FindTahaiSyncDataPolicy(revision.object_type);
  if (!policy || policy->inclusion == TahaiSyncInclusion::kNever ||
      !IsOpaqueToken(revision.object_id, kMaxObjectIdBytes) ||
      !IsOpaqueToken(revision.revision_id, kMaxRevisionIdBytes) ||
      (!revision.parent_revision_id.empty() &&
       !IsOpaqueToken(revision.parent_revision_id, kMaxRevisionIdBytes)) ||
      revision.parent_revision_id == revision.revision_id ||
      revision.modified_micros < 0 ||
      !IsOpaqueToken(revision.device_id, kMaxDeviceIdBytes) ||
      !IsSha256(revision.plaintext_sha256)) {
    return false;
  }
  return true;
}

TahaiSyncConflictDecision ResolveTahaiSyncConflict(
    const TahaiSyncRevision& local,
    const TahaiSyncRevision& remote) {
  if (!IsValidTahaiSyncRevision(local) || !IsValidTahaiSyncRevision(remote)) {
    return Reject(
        "A revision failed the finite authenticated metadata schema.");
  }
  if (local.object_type != remote.object_type ||
      local.object_id != remote.object_id) {
    return Reject("Revisions do not identify the same sync object.");
  }
  if (local.revision_id == remote.revision_id) {
    if (local.plaintext_sha256 != remote.plaintext_sha256) {
      return Reject(
          "One revision ID authenticates conflicting payload digests.");
    }
    return {
        .relation = TahaiSyncConflictRelation::kIdentical,
        .action = TahaiSyncConflictAction::kNoOp,
        .reason =
            "The authenticated revision and payload digest are identical.",
    };
  }
  if (local.parent_revision_id == remote.revision_id) {
    return {
        .relation = TahaiSyncConflictRelation::kLocalDescendsRemote,
        .action = TahaiSyncConflictAction::kUseLocal,
        .reason =
            "The local revision directly descends from the remote revision.",
    };
  }
  if (remote.parent_revision_id == local.revision_id) {
    return {
        .relation = TahaiSyncConflictRelation::kRemoteDescendsLocal,
        .action = TahaiSyncConflictAction::kUseRemote,
        .reason =
            "The remote revision directly descends from the local revision.",
    };
  }

  const bool local_is_canonical = LocalIsCanonical(local, remote);
  if (!IsPreserveBothType(local.object_type)) {
    return {
        .relation = TahaiSyncConflictRelation::kDiverged,
        .action = local_is_canonical ? TahaiSyncConflictAction::kUseLocal
                                     : TahaiSyncConflictAction::kUseRemote,
        .reason =
            "Concurrent finite settings use a deterministic canonical "
            "revision.",
    };
  }

  const TahaiSyncRevision& forked = local_is_canonical ? remote : local;
  return {
      .relation = TahaiSyncConflictRelation::kDiverged,
      .action = local_is_canonical
                    ? TahaiSyncConflictAction::kKeepLocalAndForkRemote
                    : TahaiSyncConflictAction::kKeepRemoteAndForkLocal,
      .forked_object_id = ConflictObjectId(forked),
      .reason =
          "Concurrent user records preserve both authenticated revisions.",
  };
}

}  // namespace tahai
