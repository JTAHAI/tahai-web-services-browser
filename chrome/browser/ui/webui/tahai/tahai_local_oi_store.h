// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_STORE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_STORE_H_

#include <optional>
#include <string_view>

#include "base/memory/raw_ptr.h"
#include "chrome/browser/ui/webui/tahai/tahai_local_oi_types.h"

class PrefService;

namespace tahai {

// A bounded, versioned profile preference document. A single scoped pref
// mutation commits every related record together; the store never reaches into
// browser history, cookies, page bodies, disk paths, or external services.
class TahaiLocalOiStore {
 public:
  TahaiLocalOiStore(PrefService* prefs, bool durable);
  TahaiLocalOiStore(const TahaiLocalOiStore&) = delete;
  TahaiLocalOiStore& operator=(const TahaiLocalOiStore&) = delete;
  ~TahaiLocalOiStore();

  const LocalOiStoreData& data() const { return data_; }
  LocalOiStoreStatus status() const { return status_; }
  bool is_durable() const { return durable_; }

  bool UpsertEntity(LocalOiEntityRecord record);
  bool UpsertRelationship(LocalOiRelationshipRecord record);
  bool UpsertFinding(LocalOiFindingRecord record);
  bool AppendMemory(LocalOiMemoryRecord record);
  bool AddReport(LocalOiReportRecord record);
  bool DeleteEntity(std::string_view entity_id);
  bool DeleteAll();
  // Used by the Local OI service to atomically apply a typed ingestion or
  // deterministic recalculation batch. It is not exposed to WebUI messages.
  bool Commit(LocalOiStoreData data);
  bool ReplaceForTesting(LocalOiStoreData data);

 private:
  bool Load();
  bool Persist();
  bool Replace(LocalOiStoreData data);

  const raw_ptr<PrefService> prefs_;
  const bool durable_;
  LocalOiStoreStatus status_ = LocalOiStoreStatus::kUnavailable;
  LocalOiStoreData data_;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_STORE_H_
