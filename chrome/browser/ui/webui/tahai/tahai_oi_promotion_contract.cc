// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_oi_promotion_contract.h"

#include <string>
#include <string_view>

#include "base/notreached.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"

namespace tahai {
namespace {

constexpr char kOiMspReferralBase[] =
    "https://ops.tahaiportal.com?utm_source=tahai_browser&"
    "utm_medium=in_product&utm_campaign=local_oi_to_msp&utm_content=";

std::string_view ReferralContent(TahaiOiReferralContext context) {
  switch (context) {
    case TahaiOiReferralContext::kLocalOiHeader:
      return "local_oi_header";
    case TahaiOiReferralContext::kMissionPromotion:
      return "mission_promotion";
    case TahaiOiReferralContext::kKnowledgeGap:
      return "knowledge_gap";
    case TahaiOiReferralContext::kTeamCoordination:
      return "team_assignment";
    case TahaiOiReferralContext::kConnectorPrompt:
      return "connector_prompt";
    case TahaiOiReferralContext::kEvidenceRetention:
      return "evidence_retention";
    case TahaiOiReferralContext::kCrossClientMonitoring:
      return "cross_client_monitoring";
  }
  NOTREACHED();
}

}  // namespace

bool IsTahaiOiHostedPromotionAvailable() {
  return false;
}

TahaiOiPromotionSurfaceState GetTahaiOiPromotionSurfaceState(
    PrefService* pref_service) {
  if (!pref_service) {
    return {false, true, "Hosted OI promotion is unavailable in this profile."};
  }
  const bool managed = pref_service->IsManagedPreference(
      prefs::kTahaiLocalOiMspPromotionEnabled);
  const bool enabled =
      pref_service->GetBoolean(prefs::kTahaiLocalOiMspPromotionEnabled);
  if (enabled) {
    return {true, managed,
            managed ? "Hosted OI referral is enabled by managed preference."
                    : "Hosted OI referral is enabled for this profile."};
  }
  return {false, managed,
          managed ? "Hosted OI referral is disabled by managed preference."
                  : "Hosted OI referral is disabled for this profile."};
}

bool SetTahaiOiMspPromotionEnabled(PrefService* pref_service, bool enabled) {
  if (!pref_service || pref_service->IsManagedPreference(
                           prefs::kTahaiLocalOiMspPromotionEnabled)) {
    return false;
  }
  pref_service->SetBoolean(prefs::kTahaiLocalOiMspPromotionEnabled, enabled);
  return true;
}

TahaiOiPromotionPreview BuildTahaiOiPromotionPreview(
    const LocalOiSnapshot& snapshot) {
  TahaiOiPromotionPreview preview;
  preview.mission_count = snapshot.mission_health.size();
  preview.evidence_marker_count = snapshot.evidence_marker_count;
  preview.knowledge_gap_count = snapshot.knowledge_gap_count;
  preview.opaque_oi_reference_count = snapshot.opaque_oi_reference_count;
  preview.scale_signal_count = snapshot.scale_signals.size();
  return preview;
}

GURL TahaiOiMspReferralUrl(TahaiOiReferralContext context) {
  return GURL(std::string(kOiMspReferralBase) +
              std::string(ReferralContent(context)));
}

}  // namespace tahai
