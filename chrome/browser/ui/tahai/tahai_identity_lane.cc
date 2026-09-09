// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_identity_lane.h"

#include <algorithm>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/containers/span.h"
#include "base/files/file_path.h"
#include "base/functional/bind.h"
#include "base/functional/callback_helpers.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/profiles/profile_attributes_entry.h"
#include "chrome/browser/profiles/profile_attributes_storage.h"
#include "chrome/browser/profiles/profile_manager.h"
#include "chrome/browser/ui/navigator/browser_navigator.h"
#include "chrome/browser/ui/navigator/browser_navigator_params.h"
#include "chrome/common/tahai_url_constants.h"
#include "crypto/sha2.h"
#include "ui/base/page_transition_types.h"
#include "ui/base/window_open_disposition.h"
#include "url/gurl.h"

namespace tahai {
namespace {

std::string LaneIdForPath(const base::FilePath& profile_path) {
  // The lane id must distinguish regular profiles whose directory names happen
  // to match (for example, profiles managed by separate user-data roots).
  // Hashing the complete native path keeps the value opaque to callers while
  // avoiding basename collisions. The path itself is never surfaced or
  // persisted by the Identity Lane API.
  const std::string digest = crypto::SHA256HashString(
      base::StrCat({"TAHAI-IDENTITY-LANE-v1\n", profile_path.AsUTF8Unsafe()}));
  return base::HexEncode(base::as_byte_span(digest).first<16>());
}

ProfileAttributesEntry* FindLaneEntry(ProfileManager* profile_manager,
                                      std::string_view lane_id) {
  if (!profile_manager || lane_id.size() != 32) {
    return nullptr;
  }
  for (ProfileAttributesEntry* entry :
       profile_manager->GetProfileAttributesStorage()
           .GetAllProfilesAttributesSortedForDisplay()) {
    if (!entry->IsOmitted() && !entry->IsEphemeral() &&
        LaneIdForPath(entry->GetPath()) == lane_id) {
      return entry;
    }
  }
  return nullptr;
}

void OnIdentityLaneProfileLoaded(const GURL& destination,
                                 TahaiIdentityLaneOpenCallback callback,
                                 Profile* profile) {
  if (!profile || profile->IsOffTheRecord() || profile->IsGuestSession() ||
      profile->ShutdownStarted()) {
    std::move(callback).Run(TahaiIdentityLaneOpenResult::kProfileUnavailable);
    return;
  }
  NavigateParams params(profile, destination, ui::PAGE_TRANSITION_TYPED);
  params.disposition = WindowOpenDisposition::NEW_WINDOW;
  Navigate(&params);
  std::move(callback).Run(
      params.navigated_or_inserted_contents
          ? TahaiIdentityLaneOpenResult::kOpened
          : TahaiIdentityLaneOpenResult::kProfileUnavailable);
}

}  // namespace

std::vector<TahaiIdentityLane> GetTahaiIdentityLanes(
    ProfileManager* profile_manager,
    const Profile* active_profile) {
  if (!profile_manager) {
    return {};
  }
  std::vector<TahaiIdentityLane> lanes;
  for (ProfileAttributesEntry* entry :
       profile_manager->GetProfileAttributesStorage()
           .GetAllProfilesAttributesSortedForDisplay()) {
    if (entry->IsOmitted() || entry->IsEphemeral()) {
      continue;
    }
    lanes.push_back({
        .lane_id = LaneIdForPath(entry->GetPath()),
        .display_name = entry->GetLocalProfileName(),
        .is_active =
            active_profile &&
            active_profile->GetOriginalProfile()->GetPath() == entry->GetPath(),
        .signin_required = entry->IsSigninRequired(),
    });
  }
  return lanes;
}

bool IsValidTahaiIdentityLaneDestination(const GURL& destination) {
  if (!destination.is_valid() || destination.has_username() ||
      destination.has_password() || destination.spec().size() > 2048) {
    return false;
  }
  return destination.SchemeIs("https") ||
         destination.SchemeIs(kTahaiScheme);
}

bool OpenTahaiIdentityLane(ProfileManager* profile_manager,
                           std::string_view lane_id,
                           const GURL& destination,
                           TahaiIdentityLaneOpenCallback callback) {
  if (!callback) {
    return false;
  }
  if (!IsValidTahaiIdentityLaneDestination(destination)) {
    std::move(callback).Run(TahaiIdentityLaneOpenResult::kInvalidDestination);
    return true;
  }
  ProfileAttributesEntry* entry = FindLaneEntry(profile_manager, lane_id);
  if (!entry) {
    std::move(callback).Run(TahaiIdentityLaneOpenResult::kUnknownLane);
    return true;
  }
  if (entry->IsSigninRequired()) {
    std::move(callback).Run(TahaiIdentityLaneOpenResult::kSigninRequired);
    return true;
  }
  auto split_callback = base::SplitOnceCallback(std::move(callback));
  if (!profile_manager->LoadProfileByPath(
          entry->GetPath(), /*incognito=*/false,
          base::BindOnce(&OnIdentityLaneProfileLoaded, destination,
                         std::move(split_callback.first)))) {
    std::move(split_callback.second)
        .Run(TahaiIdentityLaneOpenResult::kProfileUnavailable);
  }
  return true;
}

}  // namespace tahai
