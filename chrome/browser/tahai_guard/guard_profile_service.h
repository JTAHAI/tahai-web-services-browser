// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_GUARD_GUARD_PROFILE_SERVICE_H_
#define CHROME_BROWSER_TAHAI_GUARD_GUARD_PROFILE_SERVICE_H_

#include <cstdint>
#include <map>
#include <memory>
#include <optional>
#include <set>
#include <string>
#include <vector>

#include "base/callback_list.h"
#include "base/containers/unique_ptr_adapters.h"
#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/sequence_checker.h"
#include "base/timer/timer.h"
#include "chrome/browser/tahai_guard/guard_engine_session.h"
#include "chrome/browser/tahai_guard/tahai_guard_configuration.h"
#include "components/keyed_service/core/keyed_service.h"
#include "components/prefs/pref_change_registrar.h"
#include "url/gurl.h"
#include "url/origin.h"

class Profile;
namespace content {
class RenderFrameHost;
}

namespace tahai::guard {

class GuardURLLoaderFactory;

// Each regular or incognito Profile owns separate utility generations. An
// incognito instance reads effective settings from its own PrefService without
// writing preferences or collecting counters. It never borrows the original
// profile's service, utility process, requests, or decision state. Guest and
// system profiles are not selected.
// All request attribution must come from the browser's factory creation path.
class GuardProfileService final : public KeyedService {
 public:
  enum class Status {
    kOff,
    kNoRules,
    kCompiling,
    kReady,
    kLastKnownGood,
    kUnavailable,
    kUnsupportedMode,
    kInvalidConfiguration,
    kStopped,
  };
  enum class Result {
    kAllow,
    kBlock,
    kBypassed,
    kPagePaused,
    kContextChanged,
    kUnavailable,
    // Mandatory managed configuration never silently turns failure into Allow.
    kRequiredUnavailable,
  };
  enum class UpdateResult {
    kInstalled,
    kDenied,
    kBusy,
    kInvalidInput,
    kCompileFailed,
    kCancelled,
  };
  struct Snapshot {
    Status status;
    TahaiGuardMode mode;
    bool private_session;
    bool managed;
    bool statistics_enabled;
    uint32_t accepted_rules;
    uint32_t ignored_rules;
    uint64_t allowed;
    uint64_t blocked;
    uint64_t unavailable;
  };
  using CheckCallback = base::OnceCallback<void(Result)>;
  using UpdateCallback = base::OnceCallback<void(UpdateResult)>;
  using SessionFactory =
      base::RepeatingCallback<std::unique_ptr<GuardEngineSession>()>;

  explicit GuardProfileService(Profile* profile,
                               SessionFactory test_session_factory = {});
  ~GuardProfileService() override;
  void Shutdown() override;

  // Only explicitly submitted Custom rules use this replacement path. A
  // successful immutable replacement is committed to this profile's non-sync
  // pref; a failed update preserves both the previous pref and live engine.
  // Balanced and Strict use browser-bundled network rules instead.
  void InstallCustomRules(std::string rules, UpdateCallback callback);
  bool ClearCustomRules();

  // Native document-bound recovery. IDs come only from browser factory
  // creation, are never persisted/logged, and never come from ResourceRequest.
  bool SetPagePaused(content::RenderFrameHost& document, bool paused);
  bool IsPagePaused(int64_t browser_page_id) const;
  // Browser-owned documents only; replies are rechecked after asynchronous
  // work.
  void GetCosmeticSelectors(content::RenderFrameHost& document,
                            GuardEngineSession::CosmeticsCallback callback);
  base::CallbackListSubscription ObserveCosmetics(
      base::RepeatingClosure callback);

  void Check(const GURL& request_url,
             const std::optional<url::Origin>& source_origin,
             const std::optional<url::Origin>& top_origin,
             mojom::RequestKind kind,
             CheckCallback callback,
             std::optional<int64_t> browser_page_id = std::nullopt);
  Snapshot GetSnapshot() const;
  base::WeakPtr<GuardProfileService> GetWeakPtr();
  void OwnFactory(std::unique_ptr<GuardURLLoaderFactory> factory);
  void RemoveFactory(GuardURLLoaderFactory* factory);

 private:
  friend class GuardProfileServiceTestPeer;
  class PausedPage;
  void RemovePagePause(int64_t browser_page_id);

  void OnPreferencesChanged();
  void StartCandidate(std::string rules, bool persist, UpdateCallback callback);
  void OnConfigured(uint64_t generation, mojom::ConfigureResultPtr result);
  void OnEngineFailure(uint64_t generation);
  void ScheduleRestart();
  void Restart();
  void StopGenerations();
  bool Mandatory() const;
  bool CanApplyCosmetics(content::RenderFrameHost& document) const;
  std::optional<Result> ImmediateResult(
      const GURL& request_url,
      const std::optional<url::Origin>& top_origin,
      std::optional<int64_t> browser_page_id) const;
  void OnChecked(uint64_t revision,
                 GURL request_url,
                 std::optional<url::Origin> top_origin,
                 std::optional<int64_t> browser_page_id,
                 CheckCallback callback,
                 std::optional<mojom::Decision> decision);
  void Complete(CheckCallback callback,
                Result result,
                std::optional<int64_t> browser_page_id = std::nullopt);
  void Deliver(uint64_t revision,
               CheckCallback callback,
               Result result,
               std::optional<int64_t> browser_page_id);

  SEQUENCE_CHECKER(sequence_checker_);
  const raw_ptr<Profile> profile_;
  SessionFactory session_factory_;
  PrefChangeRegistrar preferences_;
  TahaiGuardConfiguration configuration_;
  bool valid_configuration_ = false;
  bool managed_ = false;
  bool stopped_ = false;
  bool last_update_failed_ = false;
  bool persist_candidate_ = false;
  uint64_t revision_ = 0;
  uint64_t next_generation_ = 1;
  uint64_t active_generation_ = 0;
  uint64_t candidate_generation_ = 0;
  std::unique_ptr<GuardEngineSession> active_;
  std::unique_ptr<GuardEngineSession> candidate_;
  std::string active_rules_;
  std::string candidate_rules_;
  UpdateCallback update_callback_;
  uint32_t accepted_rules_ = 0;
  uint32_t ignored_rules_ = 0;
  uint64_t allowed_ = 0;
  uint64_t blocked_ = 0;
  uint64_t unavailable_ = 0;
  unsigned restart_attempts_ = 0;
  base::OneShotTimer restart_timer_;
  base::RepeatingClosureList cosmetic_observers_;
  std::map<int64_t, std::unique_ptr<PausedPage>> paused_pages_;
  std::set<std::unique_ptr<GuardURLLoaderFactory>, base::UniquePtrComparator>
      factories_;
  base::WeakPtrFactory<GuardProfileService> weak_factory_{this};
};

}  // namespace tahai::guard

#endif  // CHROME_BROWSER_TAHAI_GUARD_GUARD_PROFILE_SERVICE_H_
