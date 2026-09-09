// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_CONTRACT_H_

#include <span>
#include <string_view>

namespace tahai {

// This is intentionally separate from Chromium Sync. TAHAI must not use
// Chrome's private sync services or emulate an Edge account integration.
enum class TahaiSyncProvider {
  kNone,
  // Local envelope export is a profile-only cryptographic operation. It has
  // no network transport and can never be selected for upload.
  kLocalProfile,
  kGoogleDriveAppData,
  kOneDriveAppFolder,
};

// A finite, privacy-reviewed object vocabulary for the future encrypted
// TAHAI Sync transport. None of these objects can contain cookies, browser
// sessions, passwords, OAuth tokens, headers, raw history, or page content.
enum class TahaiSyncObjectType {
  kBookmarks,
  kModePreferences,
  kLaunchRecipes,
  kMissionLayouts,
  kCommandPreferences,
  kAdminConsoleProfiles,
  kMissionNotes,
  kEvidenceMetadata,
  kOpenTabSnapshots,
  kDeviceHandoff,
  kMissionCapsule,
  kCookies,
  kLoginSessions,
  kOAuthTokens,
  kAuthorizationHeaders,
  kPasswords,
  kRawPageContent,
};

enum class TahaiSyncInclusion {
  kDefault,
  kExplicitOptIn,
  kNever,
};

struct TahaiSyncDataPolicy {
  TahaiSyncObjectType object_type;
  TahaiSyncInclusion inclusion;
  std::string_view label;
  std::string_view safety_boundary;
};

// The scope identifies the application's isolated storage location. A
// transport still requires a TAHAI-owned OAuth client registration, approved
// native authorization flow, explicit user consent, and client-side envelope
// encryption before it may upload anything.
struct TahaiSyncProviderContract {
  TahaiSyncProvider provider;
  std::string_view label;
  std::string_view required_scope;
  std::string_view storage_boundary;
};

std::span<const TahaiSyncDataPolicy> GetTahaiSyncDataPolicies();
std::span<const TahaiSyncProviderContract> GetTahaiSyncProviderContracts();

std::string_view TahaiSyncProviderName(TahaiSyncProvider provider);
std::string_view TahaiSyncObjectTypeName(TahaiSyncObjectType object_type);

const TahaiSyncDataPolicy* FindTahaiSyncDataPolicy(
    TahaiSyncObjectType object_type);
const TahaiSyncProviderContract* FindTahaiSyncProviderContract(
    TahaiSyncProvider provider);

// Until a TAHAI-owned OAuth client is provisioned and reviewed, every cloud
// transport must stay disabled. This deliberate source-level gate prevents a
// release from accidentally presenting unconfigured storage as live sync.
bool IsTahaiSyncProviderAvailable(TahaiSyncProvider provider);
std::string_view GetTahaiSyncProviderAvailabilityMessage(
    TahaiSyncProvider provider);

// Enforces the schema boundary before a future encrypted transport is called.
// A caller must separately prove that its payload has been encrypted locally;
// this contract never receives plaintext browsing data.
bool IsTahaiSyncObjectEligibleForUpload(TahaiSyncProvider provider,
                                        TahaiSyncObjectType object_type,
                                        bool explicit_opt_in);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_CONTRACT_H_
