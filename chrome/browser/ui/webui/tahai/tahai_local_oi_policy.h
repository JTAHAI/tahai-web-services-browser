// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_POLICY_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_POLICY_H_

#include <string_view>

#include "base/memory/raw_ptr.h"

class PrefService;

namespace tahai {

enum class LocalOiPolicyControl {
  kEnabled,
  kMissionIngestion,
  kArtifactIngestion,
  kDocumentationReferenceIngestion,
  kOpsToolIngestion,
  kHistoryMetadata,
  kReports,
  kExport,
  kMspPromotion,
  kLocalAi,
};

// Reads regular or managed Chromium prefs. Managed values are authoritative;
// no control causes a network operation or expands collection by itself.
class TahaiLocalOiPolicy {
 public:
  explicit TahaiLocalOiPolicy(PrefService* prefs);
  bool IsEnabled(LocalOiPolicyControl control) const;
  bool IsManaged(LocalOiPolicyControl control) const;
  // Changes only an unmanaged profile setting. This does not erase data,
  // initiate collection, or authorize a network operation; callers still use
  // the owning subsystem's explicit action and policy checks.
  bool SetEnabled(LocalOiPolicyControl control, bool enabled) const;
  int RetentionDays() const;
  bool IsRetentionManaged() const;
 std::string_view Source(LocalOiPolicyControl control) const;

 private:
  const raw_ptr<PrefService> prefs_;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_POLICY_H_
