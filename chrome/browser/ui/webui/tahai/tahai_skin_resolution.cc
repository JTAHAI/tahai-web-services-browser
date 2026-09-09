// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_skin_resolution.h"

#include <algorithm>

#include "chrome/browser/ui/webui/tahai/tahai_skin_catalog.h"

namespace tahai {
namespace {

constexpr std::string_view kStockSkinId = "stock";

bool IsValidSkinCandidate(const std::optional<std::string_view>& candidate) {
  return candidate && IsTahaiBuiltInSkinId(*candidate);
}

const TahaiSkinModeSelection* FindModeSelection(
    const TahaiSkinSelection& selection,
    std::string_view mode_id) {
  const auto selection_it = std::find_if(
      selection.mode_selections.begin(), selection.mode_selections.end(),
      [mode_id](const TahaiSkinModeSelection& candidate) {
        return candidate.mode_id == mode_id;
      });
  return selection_it == selection.mode_selections.end() ? nullptr
                                                         : &*selection_it;
}

}  // namespace

TahaiSkinResolution ResolveTahaiSkinIdentity(
    const TahaiSkinResolutionRequest& request) {
  if (request.force_stock_recovery) {
    return {kStockSkinId, TahaiSkinResolutionSource::kStartupSafeRecovery};
  }
  if (IsValidSkinCandidate(request.enterprise_skin_id)) {
    return {*request.enterprise_skin_id,
            TahaiSkinResolutionSource::kEnterprisePolicy};
  }
  if (IsValidSkinCandidate(request.mission_skin_id)) {
    return {*request.mission_skin_id,
            TahaiSkinResolutionSource::kMissionAssignment};
  }
  if (!request.profile_selection) {
    return {kStockSkinId, TahaiSkinResolutionSource::kStockFallback};
  }
  if (const TahaiSkinModeSelection* mode_selection =
          FindModeSelection(*request.profile_selection, request.active_mode_id);
      mode_selection && IsTahaiBuiltInSkinId(mode_selection->skin_id)) {
    return {mode_selection->skin_id, TahaiSkinResolutionSource::kModeSelection};
  }
  if (IsTahaiBuiltInSkinId(request.profile_selection->profile_skin_id)) {
    return {request.profile_selection->profile_skin_id,
            TahaiSkinResolutionSource::kProfileSelection};
  }
  return {kStockSkinId, TahaiSkinResolutionSource::kStockFallback};
}

}  // namespace tahai
