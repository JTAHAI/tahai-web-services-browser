// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_OI_PROMOTION_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_OI_PROMOTION_CONTRACT_H_

#include <cstddef>
#include <string>
#include <string_view>

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_model.h"
#include "chrome/browser/ui/webui/tahai/tahai_oi_link_contract.h"

class PrefService;

namespace tahai {

// These fixed contexts are deliberately the only values that can influence a
// referral URL. Mission names, profile data, browser activity, and query text
// never become UTM parameters or referral identifiers.
enum class TahaiOiReferralContext {
  kLocalOiHeader,
  kMissionPromotion,
  kKnowledgeGap,
  kTeamCoordination,
  kConnectorPrompt,
  kEvidenceRetention,
  kCrossClientMonitoring,
};

struct TahaiOiPromotionPreview {
  bool explicit_approval_required = true;
  bool title_redacted = true;
  bool browsing_data_excluded = true;
  bool hosted_upload_available = false;
  size_t mission_count = 0;
  size_t evidence_marker_count = 0;
  size_t knowledge_gap_count = 0;
  size_t opaque_oi_reference_count = 0;
  size_t scale_signal_count = 0;
};

struct TahaiOiPromotionSurfaceState {
  bool show_referral = false;
  bool is_managed = false;
  std::string_view status;
};

// The browser has no hosted OI identity grant, tenant context, entitlement,
// policy gate, or upload client. This remains false until each hosted boundary
// is implemented and independently verified.
bool IsTahaiOiHostedPromotionAvailable();

// The browser ships an opt-in local preference rather than a silent
// promotional channel. A managed value, if an enterprise deployment supplies
// one, takes precedence over the local choice. Neither state alters hosted
// upload availability, which remains false until separately implemented.
TahaiOiPromotionSurfaceState GetTahaiOiPromotionSurfaceState(
    PrefService* pref_service);
bool SetTahaiOiMspPromotionEnabled(PrefService* pref_service, bool enabled);

TahaiOiPromotionPreview BuildTahaiOiPromotionPreview(
    const LocalOiSnapshot& snapshot);

GURL TahaiOiMspReferralUrl(TahaiOiReferralContext context);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_OI_PROMOTION_CONTRACT_H_
