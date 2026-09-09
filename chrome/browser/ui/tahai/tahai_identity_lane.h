// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_IDENTITY_LANE_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_IDENTITY_LANE_H_

#include <string>
#include <string_view>
#include <vector>

#include "base/functional/callback_forward.h"

class GURL;
class Profile;
class ProfileManager;

namespace tahai {

// An Identity Lane is a presentation and routing layer over a real regular
// Chromium Profile. TAHAI never creates a second cookie jar, token cache, or
// permission store inside one Profile and never treats a tab group as an
// identity boundary.
struct TahaiIdentityLane {
  std::string lane_id;
  std::u16string display_name;
  bool is_active = false;
  bool signin_required = false;
};

enum class TahaiIdentityLaneOpenResult {
  kOpened,
  kUnknownLane,
  kSigninRequired,
  kInvalidDestination,
  kProfileUnavailable,
};

using TahaiIdentityLaneOpenCallback =
    base::OnceCallback<void(TahaiIdentityLaneOpenResult)>;

// Returns only visible, persistent regular profiles. It omits profile paths,
// account identifiers, email addresses, cookies, and authentication state.
std::vector<TahaiIdentityLane> GetTahaiIdentityLanes(
    ProfileManager* profile_manager,
    const Profile* active_profile);

bool IsValidTahaiIdentityLaneDestination(const GURL& destination);

// Loads the existing Chromium Profile represented by `lane_id` and navigates
// in a new window owned by that Profile. The opaque lane identifier is resolved
// against ProfileAttributesStorage; it is never interpreted as a path.
bool OpenTahaiIdentityLane(ProfileManager* profile_manager,
                           std::string_view lane_id,
                           const GURL& destination,
                           TahaiIdentityLaneOpenCallback callback);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_IDENTITY_LANE_H_
