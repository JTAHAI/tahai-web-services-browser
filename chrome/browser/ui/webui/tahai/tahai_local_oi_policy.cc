// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_policy.h"

#include <algorithm>

#include "base/notreached.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"

namespace tahai {
namespace {
const char* PrefFor(LocalOiPolicyControl control) {
  switch (control) {
    case LocalOiPolicyControl::kEnabled:
      return prefs::kTahaiLocalOiEnabled;
    case LocalOiPolicyControl::kMissionIngestion:
      return prefs::kTahaiLocalOiMissionIngestionEnabled;
    case LocalOiPolicyControl::kArtifactIngestion:
      return prefs::kTahaiLocalOiArtifactIngestionEnabled;
    case LocalOiPolicyControl::kDocumentationReferenceIngestion:
      return prefs::kTahaiLocalOiDocumentationReferenceIngestionEnabled;
    case LocalOiPolicyControl::kOpsToolIngestion:
      return prefs::kTahaiLocalOiOpsToolIngestionEnabled;
    case LocalOiPolicyControl::kHistoryMetadata:
      return prefs::kTahaiLocalOiHistoryMetadataEnabled;
    case LocalOiPolicyControl::kReports:
      return prefs::kTahaiLocalOiReportsEnabled;
    case LocalOiPolicyControl::kExport:
      return prefs::kTahaiLocalOiExportEnabled;
    case LocalOiPolicyControl::kMspPromotion:
      return prefs::kTahaiLocalOiMspPromotionEnabled;
    case LocalOiPolicyControl::kLocalAi:
      return prefs::kTahaiLocalOiLocalAiEnabled;
  }
  NOTREACHED();
}
}  // namespace
TahaiLocalOiPolicy::TahaiLocalOiPolicy(PrefService* prefs) : prefs_(prefs) {}
bool TahaiLocalOiPolicy::IsEnabled(LocalOiPolicyControl control) const {
  return prefs_ && prefs_->GetBoolean(PrefFor(control));
}
bool TahaiLocalOiPolicy::IsManaged(LocalOiPolicyControl control) const {
  return prefs_ && prefs_->IsManagedPreference(PrefFor(control));
}
bool TahaiLocalOiPolicy::SetEnabled(LocalOiPolicyControl control,
                                    bool enabled) const {
  if (!prefs_ || IsManaged(control)) {
    return false;
  }
  prefs_->SetBoolean(PrefFor(control), enabled);
  return true;
}
int TahaiLocalOiPolicy::RetentionDays() const {
  return prefs_
             ? std::clamp(prefs_->GetInteger(prefs::kTahaiLocalOiRetentionDays),
                          1, 3650)
             : 1;
}
bool TahaiLocalOiPolicy::IsRetentionManaged() const {
  return prefs_ &&
         prefs_->IsManagedPreference(prefs::kTahaiLocalOiRetentionDays);
}
std::string_view TahaiLocalOiPolicy::Source(
    LocalOiPolicyControl control) const {
  return IsManaged(control) ? "managed policy" : "profile setting";
}
}  // namespace tahai
