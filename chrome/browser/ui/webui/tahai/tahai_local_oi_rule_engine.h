// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_RULE_ENGINE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_RULE_ENGINE_H_

#include <string>
#include <vector>

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_types.h"

namespace tahai {

// A rule proposal has no side effects. The service reconciles proposals with
// persisted finding lifecycle state, making recalculation deterministic and
// idempotent rather than producing a new finding on every visit.
struct LocalOiRuleProposal {
  std::string stable_key;
  std::string rule_id;
  std::string category;
  LocalOiFindingSeverity severity = LocalOiFindingSeverity::kInformational;
  std::string title;
  std::string explanation;
  std::vector<std::string> affected_entity_ids;
  std::vector<std::string> supporting_evidence_ids;
  std::string remediation;
  std::string source_basis;
};

class TahaiLocalOiRuleEngine {
 public:
  TahaiLocalOiRuleEngine();
  TahaiLocalOiRuleEngine(const TahaiLocalOiRuleEngine&) = delete;
  TahaiLocalOiRuleEngine& operator=(const TahaiLocalOiRuleEngine&) = delete;
  ~TahaiLocalOiRuleEngine();

  std::vector<LocalOiRuleProposal> Evaluate(const LocalOiStoreData& data) const;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_RULE_ENGINE_H_
