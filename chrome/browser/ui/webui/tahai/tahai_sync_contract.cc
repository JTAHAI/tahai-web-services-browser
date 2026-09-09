// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_sync_contract.h"

#include <algorithm>
#include <array>

namespace tahai {
namespace {

constexpr std::array<TahaiSyncDataPolicy, 17> kDataPolicies = {{
    {TahaiSyncObjectType::kBookmarks, TahaiSyncInclusion::kDefault, "Bookmarks",
     "Structured bookmark metadata only."},
    {TahaiSyncObjectType::kModePreferences, TahaiSyncInclusion::kDefault,
     "Modes and settings", "Finite TAHAI presentation preferences only."},
    {TahaiSyncObjectType::kLaunchRecipes, TahaiSyncInclusion::kDefault,
     "Launch recipes", "Fixed, reviewable recipe identifiers only."},
    {TahaiSyncObjectType::kMissionLayouts, TahaiSyncInclusion::kDefault,
     "Mission layouts", "Pane roles and layout identifiers only."},
    {TahaiSyncObjectType::kCommandPreferences, TahaiSyncInclusion::kDefault,
     "Command preferences", "Fixed command presentation preferences only."},
    {TahaiSyncObjectType::kAdminConsoleProfiles, TahaiSyncInclusion::kDefault,
     "Admin Console Profiles", "Non-secret labels and policy metadata only."},
    {TahaiSyncObjectType::kMissionNotes, TahaiSyncInclusion::kExplicitOptIn,
     "Mission notes", "Explicitly selected, sanitized note records only."},
    {TahaiSyncObjectType::kEvidenceMetadata, TahaiSyncInclusion::kExplicitOptIn,
     "Evidence metadata",
     "Explicitly approved sanitized evidence metadata only."},
    {TahaiSyncObjectType::kOpenTabSnapshots, TahaiSyncInclusion::kExplicitOptIn,
     "Open-tab snapshots",
     "Explicit user-approved destinations only; never session state."},
    {TahaiSyncObjectType::kDeviceHandoff, TahaiSyncInclusion::kExplicitOptIn,
     "Device handoff", "Explicitly approved workspace metadata only."},
    {TahaiSyncObjectType::kMissionCapsule, TahaiSyncInclusion::kExplicitOptIn,
     "Mission capsules",
     "Explicitly approved sanitized Mission metadata only."},
    {TahaiSyncObjectType::kCookies, TahaiSyncInclusion::kNever, "Cookies",
     "Never synchronize browser cookies."},
    {TahaiSyncObjectType::kLoginSessions, TahaiSyncInclusion::kNever,
     "Login sessions", "Never synchronize browser session state."},
    {TahaiSyncObjectType::kOAuthTokens, TahaiSyncInclusion::kNever,
     "OAuth tokens", "Never synchronize authentication tokens."},
    {TahaiSyncObjectType::kAuthorizationHeaders, TahaiSyncInclusion::kNever,
     "Authorization headers", "Never synchronize request credentials."},
    {TahaiSyncObjectType::kPasswords, TahaiSyncInclusion::kNever, "Passwords",
     "Never synchronize passwords through TAHAI Sync."},
    {TahaiSyncObjectType::kRawPageContent, TahaiSyncInclusion::kNever,
     "Raw page content", "Never synchronize page bodies or browsing data."},
}};

constexpr std::array<TahaiSyncProviderContract, 3> kProviderContracts = {{
    {TahaiSyncProvider::kLocalProfile, "Local encrypted capsule",
     "No network scope",
     "Profile-local encrypted capsule export; no upload or account."},
    {TahaiSyncProvider::kGoogleDriveAppData, "Google Drive app data",
     "https://www.googleapis.com/auth/drive.appdata",
     "The application's private Drive app-data folder."},
    {TahaiSyncProvider::kOneDriveAppFolder, "Microsoft OneDrive app folder",
     "Files.ReadWrite.AppFolder",
     "The application's isolated OneDrive app folder."},
}};

}  // namespace

std::span<const TahaiSyncDataPolicy> GetTahaiSyncDataPolicies() {
  return kDataPolicies;
}

std::span<const TahaiSyncProviderContract> GetTahaiSyncProviderContracts() {
  return kProviderContracts;
}

std::string_view TahaiSyncProviderName(TahaiSyncProvider provider) {
  switch (provider) {
    case TahaiSyncProvider::kNone:
      return "none";
    case TahaiSyncProvider::kLocalProfile:
      return "local-profile";
    case TahaiSyncProvider::kGoogleDriveAppData:
      return "google-drive-app-data";
    case TahaiSyncProvider::kOneDriveAppFolder:
      return "onedrive-app-folder";
  }
  return {};
}

std::string_view TahaiSyncObjectTypeName(TahaiSyncObjectType object_type) {
  switch (object_type) {
    case TahaiSyncObjectType::kBookmarks:
      return "bookmarks";
    case TahaiSyncObjectType::kModePreferences:
      return "mode-preferences";
    case TahaiSyncObjectType::kLaunchRecipes:
      return "launch-recipes";
    case TahaiSyncObjectType::kMissionLayouts:
      return "mission-layouts";
    case TahaiSyncObjectType::kCommandPreferences:
      return "command-preferences";
    case TahaiSyncObjectType::kAdminConsoleProfiles:
      return "admin-console-profiles";
    case TahaiSyncObjectType::kMissionNotes:
      return "mission-notes";
    case TahaiSyncObjectType::kEvidenceMetadata:
      return "evidence-metadata";
    case TahaiSyncObjectType::kOpenTabSnapshots:
      return "open-tab-snapshots";
    case TahaiSyncObjectType::kDeviceHandoff:
      return "device-handoff";
    case TahaiSyncObjectType::kMissionCapsule:
      return "mission-capsule";
    case TahaiSyncObjectType::kCookies:
      return "cookies";
    case TahaiSyncObjectType::kLoginSessions:
      return "login-sessions";
    case TahaiSyncObjectType::kOAuthTokens:
      return "oauth-tokens";
    case TahaiSyncObjectType::kAuthorizationHeaders:
      return "authorization-headers";
    case TahaiSyncObjectType::kPasswords:
      return "passwords";
    case TahaiSyncObjectType::kRawPageContent:
      return "raw-page-content";
  }
  return {};
}

const TahaiSyncDataPolicy* FindTahaiSyncDataPolicy(
    TahaiSyncObjectType object_type) {
  const auto found =
      std::find_if(kDataPolicies.begin(), kDataPolicies.end(),
                   [object_type](const TahaiSyncDataPolicy& policy) {
                     return policy.object_type == object_type;
                   });
  return found == kDataPolicies.end() ? nullptr : &*found;
}

const TahaiSyncProviderContract* FindTahaiSyncProviderContract(
    TahaiSyncProvider provider) {
  const auto found =
      std::find_if(kProviderContracts.begin(), kProviderContracts.end(),
                   [provider](const TahaiSyncProviderContract& contract) {
                     return contract.provider == provider;
                   });
  return found == kProviderContracts.end() ? nullptr : &*found;
}

bool IsTahaiSyncProviderAvailable(TahaiSyncProvider provider) {
  if (provider == TahaiSyncProvider::kLocalProfile) {
    return true;
  }
  // There is no TAHAI-owned OAuth registration in this source tree yet.
  // Returning false keeps the provider contract available for validation and
  // UI disclosure while making cloud upload impossible.
  return false;
}

std::string_view GetTahaiSyncProviderAvailabilityMessage(
    TahaiSyncProvider provider) {
  if (!FindTahaiSyncProviderContract(provider)) {
    return "No TAHAI Sync provider is selected.";
  }
  if (provider == TahaiSyncProvider::kLocalProfile) {
    return "Available only for local encrypted capsule export; it cannot "
           "upload or authenticate an account.";
  }
  return "Unavailable until TAHAI provisions an owned OAuth client and "
         "completes provider review.";
}

bool IsTahaiSyncObjectEligibleForUpload(TahaiSyncProvider provider,
                                        TahaiSyncObjectType object_type,
                                        bool explicit_opt_in) {
  const TahaiSyncDataPolicy* policy = FindTahaiSyncDataPolicy(object_type);
  if (provider == TahaiSyncProvider::kLocalProfile || !policy ||
      !IsTahaiSyncProviderAvailable(provider) ||
      policy->inclusion == TahaiSyncInclusion::kNever) {
    return false;
  }
  return policy->inclusion == TahaiSyncInclusion::kDefault || explicit_opt_in;
}

}  // namespace tahai
