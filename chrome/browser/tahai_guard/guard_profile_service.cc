// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_guard/guard_profile_service.h"

#include <array>
#include <limits>
#include <utility>

#include "base/check.h"
#include "base/functional/bind.h"
#include "base/location.h"
#include "base/no_destructor.h"
#include "base/strings/strcat.h"
#include "base/strings/string_util.h"
#include "base/task/bind_post_task.h"
#include "base/task/sequenced_task_runner.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_guard/guard_url_loader_factory.h"
#include "chrome/common/pref_names.h"
#include "chrome/grit/browser_resources.h"
#include "components/prefs/pref_service.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/page.h"
#include "content/public/browser/render_frame_host.h"
#include "content/public/browser/weak_document_ptr.h"
#include "content/public/browser/web_contents.h"
#include "content/public/browser/web_contents_observer.h"
#include "services/metrics/public/cpp/ukm_source_id.h"
#include "ui/base/resource/resource_bundle.h"

namespace tahai::guard {
namespace {

constexpr size_t kMaxRulesBytes = 4 * 1024 * 1024;
constexpr size_t kMaxPausedPages = 128;
constexpr std::array kRestartDelays = {base::Seconds(1), base::Seconds(5),
                                       base::Seconds(30)};

// Browser-bundled, network-only baseline. These rules are compiled in the
// sandboxed Guard utility process and are updated with the browser; no list is
// fetched in the background. Custom mode is still an explicit, complete
// profile-local replacement supplied by the person or administrator.
constexpr std::string_view kBalancedRules = R"RULES(
! TAHAI Guard balanced rules
||doubleclick.net^
||doubleclick.com^
||googlesyndication.com^
||googleadservices.com^
||google-analytics.com^
||googletagmanager.com^
||adservice.google.com^
||adsystem.com^
||adnxs.com^
||adsrvr.org^
||amazon-adsystem.com^
||advertising.com^
||adform.net^
||adroll.com^
||criteo.com^
||criteo.net^
||demdex.net^
||everesttech.net^
||scorecardresearch.com^
||quantserve.com^
||taboola.com^
||outbrain.com^
||moatads.com^
||mathtag.com^
||hotjar.com^
||mixpanel.com^
||segment.com^
||segment.io^
||amplitude.com^
||app-measurement.com^
||connect.facebook.net^
||analytics.twitter.com^
||bat.bing.com^
||snap.licdn.com^
)RULES";

constexpr std::string_view kStrictAdditionalRules = R"RULES(
! TAHAI Guard strict additions
||advertising.yahoo.com^
||ads.yahoo.com^
||analytics.tiktok.com^
||pixel.tiktok.com^
||analytics.pinterest.com^
||ct.pinterest.com^
||pixel.quantserve.com^
||chartbeat.com^
||newrelic.com^
||nr-data.net^
||mouseflow.com^
||fullstory.com^
||smartlook.com^
||optimizely.com^
||optimizelycdn.com^
||vwo.com^
||cdn.segment.com^
||tags.tiqcdn.com^
||tealiumiq.com^
)RULES";

std::string RulesForMode(TahaiGuardMode mode,
                         std::string_view custom_rules = {}) {
  switch (mode) {
    case TahaiGuardMode::kBalanced: {
      static const base::NoDestructor<std::string> rules(base::StrCat(
          {kBalancedRules,
           ui::ResourceBundle::GetSharedInstance().LoadDataResourceString(
               IDR_TAHAI_GUARD_EASYLIST)}));
      return *rules;
    }
    case TahaiGuardMode::kStrict: {
      static const base::NoDestructor<std::string> rules(base::StrCat(
          {RulesForMode(TahaiGuardMode::kBalanced), kStrictAdditionalRules,
           ui::ResourceBundle::GetSharedInstance().LoadDataResourceString(
               IDR_TAHAI_GUARD_EASYPRIVACY)}));
      return *rules;
    }
    case TahaiGuardMode::kCustom:
      return std::string(custom_rules);
    case TahaiGuardMode::kOff:
      return {};
  }
  return {};
}

void PostUpdate(GuardProfileService::UpdateCallback callback,
                GuardProfileService::UpdateResult result) {
  if (callback) {
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(std::move(callback), result));
  }
}

bool IsWebOrigin(const std::optional<url::Origin>& origin) {
  return origin && !origin->opaque() && origin->GetURL().SchemeIsHTTPOrHTTPS();
}

void Increment(uint64_t& counter) {
  if (counter != std::numeric_limits<uint64_t>::max()) {
    ++counter;
  }
}

}  // namespace

class GuardProfileService::PausedPage final
    : public content::WebContentsObserver {
 public:
  PausedPage(base::WeakPtr<GuardProfileService> service,
             content::RenderFrameHost& document)
      : WebContentsObserver(
            content::WebContents::FromRenderFrameHost(&document)),
        service_(std::move(service)),
        document_(document.GetWeakDocumentPtr()),
        page_id_(document.GetPageUkmSourceId()) {}
  bool IsCurrent() const {
    auto* document = document_.AsRenderFrameHostIfValid();
    return document && document->IsActive() && document->IsRenderFrameLive() &&
           document->GetPage().IsPrimary() && web_contents() &&
           web_contents()->GetPrimaryMainFrame() == document &&
           document->GetPageUkmSourceId() == page_id_;
  }
  void PrimaryPageChanged(content::Page&) override { Revoke(); }
  void PrimaryMainFrameRenderProcessGone(base::TerminationStatus) override {
    Revoke();
  }
  void WebContentsDestroyed() override { Revoke(); }

 private:
  void Revoke() {
    if (service_) {
      // Removes this observer. No access to members after the call.
      service_->RemovePagePause(page_id_);
    }
  }
  base::WeakPtr<GuardProfileService> service_;
  content::WeakDocumentPtr document_;
  const int64_t page_id_;
};

GuardProfileService::GuardProfileService(Profile* profile,
                                         SessionFactory test_session_factory)
    : profile_(profile), session_factory_(std::move(test_session_factory)) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  CHECK(profile_);
  CHECK(!profile_->IsGuestSession());
  CHECK(!profile_->IsSystemProfile());
  if (!session_factory_) {
    session_factory_ = base::BindRepeating(
        [] { return std::make_unique<GuardEngineSession>(); });
  }
  preferences_.Init(profile_->GetPrefs());
  for (const char* name :
       {prefs::kTahaiGuardConfiguration, prefs::kTahaiGuardCustomRules}) {
    preferences_.Add(
        name, base::BindRepeating(&GuardProfileService::OnPreferencesChanged,
                                  base::Unretained(this)));
  }
  OnPreferencesChanged();
}

GuardProfileService::~GuardProfileService() {
  Shutdown();
}

void GuardProfileService::Shutdown() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (stopped_) {
    return;
  }
  stopped_ = true;
  preferences_.RemoveAll();
  paused_pages_.clear();
  StopGenerations();
  weak_factory_.InvalidateWeakPtrs();
  factories_.clear();
}

void GuardProfileService::OwnFactory(
    std::unique_ptr<GuardURLLoaderFactory> factory) {
  if (!stopped_) {
    factories_.insert(std::move(factory));
  }
}

void GuardProfileService::RemoveFactory(GuardURLLoaderFactory* factory) {
  const auto found = factories_.find(factory);
  CHECK(found != factories_.end());
  factories_.erase(found);
}

base::WeakPtr<GuardProfileService> GuardProfileService::GetWeakPtr() {
  // Invalidating existing weak pointers is not enough: GetWeakPtr() normally
  // creates a new valid weak reference after invalidation. Never expose a new
  // usable service handle once profile shutdown has begun.
  return stopped_ ? base::WeakPtr<GuardProfileService>()
                  : weak_factory_.GetWeakPtr();
}

void GuardProfileService::StopGenerations() {
  cosmetic_observers_.Notify();
  restart_timer_.Stop();
  ++revision_;
  active_generation_ = 0;
  candidate_generation_ = 0;
  // Clearing IDs before stopping prevents failure/cancellation callbacks from
  // reactivating a discarded generation. External callbacks are always posted.
  candidate_.reset();
  active_.reset();
  candidate_rules_.clear();
  active_rules_.clear();
  accepted_rules_ = 0;
  ignored_rules_ = 0;
  PostUpdate(std::move(update_callback_), UpdateResult::kCancelled);
}

void GuardProfileService::OnPreferencesChanged() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (stopped_) {
    return;
  }
  ++revision_;
  cosmetic_observers_.Notify();
  // Any settings/rule revision ends temporary recovery. A new mandatory
  // configuration cannot inherit a user's earlier page pause.
  paused_pages_.clear();
  PrefService* prefs = profile_->GetPrefs();
  managed_ = prefs->IsManagedPreference(prefs::kTahaiGuardConfiguration);
  const base::DictValue& stored =
      prefs->GetDict(prefs::kTahaiGuardConfiguration);
  valid_configuration_ = stored.empty() && !managed_;
  configuration_ = TahaiGuardConfiguration();
  if (!stored.empty()) {
    valid_configuration_ =
        ValidateTahaiGuardConfiguration(stored, &configuration_) ==
        TahaiGuardConfigurationValidationResult::kValid;
  }
  // Protection settings inherit through the incognito PrefService, not through
  // a redirected regular service. Incognito decisions must not count toward the
  // regular session or opt in merely because regular statistics were enabled.
  if (profile_->IsOffTheRecord()) {
    configuration_.local_statistics_enabled = false;
  }
  if (!configuration_.local_statistics_enabled) {
    allowed_ = blocked_ = unavailable_ = 0;
  }
  if (!valid_configuration_ || configuration_.mode == TahaiGuardMode::kOff) {
    StopGenerations();
    return;
  }
  const std::string rules = RulesForMode(
      configuration_.mode, prefs->GetString(prefs::kTahaiGuardCustomRules));
  if (candidate_ && persist_candidate_ &&
      (managed_ || prefs->IsManagedPreference(prefs::kTahaiGuardCustomRules))) {
    StopGenerations();
  }
  if (rules.size() > kMaxRulesBytes) {
    StopGenerations();
    last_update_failed_ = true;
    return;
  }
  if (rules.empty()) {
    StopGenerations();
    last_update_failed_ = false;
    return;
  }
  if ((active_ && active_->ready() && rules == active_rules_) ||
      (candidate_ && rules == candidate_rules_)) {
    return;
  }
  StopGenerations();
  restart_attempts_ = 0;
  StartCandidate(rules, /*persist=*/false, {});
}

bool GuardProfileService::Mandatory() const {
  return managed_ &&
         (!valid_configuration_ || configuration_.mode != TahaiGuardMode::kOff);
}

void GuardProfileService::InstallCustomRules(std::string rules,
                                             UpdateCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  PrefService* prefs = profile_->GetPrefs();
  if (stopped_ || profile_->IsOffTheRecord() || !valid_configuration_ ||
      managed_ || prefs->IsManagedPreference(prefs::kTahaiGuardCustomRules) ||
      configuration_.mode != TahaiGuardMode::kCustom) {
    PostUpdate(std::move(callback), UpdateResult::kDenied);
    return;
  }
  if (candidate_) {
    PostUpdate(std::move(callback), UpdateResult::kBusy);
    return;
  }
  if (rules.empty() || rules.size() > kMaxRulesBytes ||
      !base::IsStringUTF8(rules)) {
    PostUpdate(std::move(callback), UpdateResult::kInvalidInput);
    return;
  }
  restart_timer_.Stop();
  restart_attempts_ = 0;
  StartCandidate(std::move(rules), /*persist=*/true, std::move(callback));
}

bool GuardProfileService::ClearCustomRules() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  PrefService* prefs = profile_->GetPrefs();
  if (stopped_ || profile_->IsOffTheRecord() || managed_ ||
      prefs->IsManagedPreference(prefs::kTahaiGuardCustomRules)) {
    return false;
  }
  // Clearing an unused Custom list must not stop a bundled engine. A no-op
  // SetString does not notify observers, so stopping here could disable Guard
  // indefinitely when the stored Custom list was already empty.
  prefs->SetString(prefs::kTahaiGuardCustomRules, "");
  OnPreferencesChanged();
  return true;
}

bool GuardProfileService::SetPagePaused(content::RenderFrameHost& document,
                                        bool paused) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (stopped_ || document.GetBrowserContext() != profile_ ||
      !document.IsInPrimaryMainFrame() || !document.IsActive() ||
      !document.IsRenderFrameLive() || !document.GetPage().IsPrimary() ||
      document.GetParentOrOuterDocumentOrEmbedder() ||
      !document.GetLastCommittedURL().SchemeIsHTTPOrHTTPS() ||
      !document.GetLastCommittedOrigin().GetURL().SchemeIsHTTPOrHTTPS() ||
      document.GetPageUkmSourceId() == ukm::kInvalidSourceId) {
    return false;
  }
  const int64_t page_id = document.GetPageUkmSourceId();
  if (!paused) {
    RemovePagePause(page_id);
    return true;
  }
  if (managed_ || !valid_configuration_ ||
      configuration_.mode == TahaiGuardMode::kOff || !active_ ||
      !active_->ready()) {
    return false;
  }
  if (IsPagePaused(page_id)) {
    return true;
  }
  if (paused_pages_.size() >= kMaxPausedPages) {
    return false;
  }
  paused_pages_.insert_or_assign(
      page_id, std::make_unique<PausedPage>(GetWeakPtr(), document));
  cosmetic_observers_.Notify();
  return true;
}

void GuardProfileService::RemovePagePause(int64_t browser_page_id) {
  if (paused_pages_.erase(browser_page_id)) {
    cosmetic_observers_.Notify();
  }
}

base::CallbackListSubscription GuardProfileService::ObserveCosmetics(
    base::RepeatingClosure callback) {
  return cosmetic_observers_.Add(std::move(callback));
}

bool GuardProfileService::CanApplyCosmetics(
    content::RenderFrameHost& document) const {
  if (stopped_ || !valid_configuration_ || !active_ || !active_->ready() ||
      document.GetBrowserContext() != profile_ || !document.IsActive() ||
      !document.IsRenderFrameLive() || !document.GetPage().IsPrimary() ||
      document.IsNestedWithinFencedFrame() ||
      !document.GetLastCommittedURL().SchemeIsHTTPOrHTTPS() ||
      document.GetLastCommittedOrigin().opaque()) {
    return false;
  }
  auto* main = document.GetMainFrame();
  if (main->GetParentOrOuterDocumentOrEmbedder() ||
      !main->GetLastCommittedURL().SchemeIsHTTPOrHTTPS() ||
      main->GetLastCommittedOrigin().opaque() ||
      IsPagePaused(main->GetPageUkmSourceId())) {
    return false;
  }
  return ResolveTahaiGuardSettingsForUrl(
             configuration_, main->GetLastCommittedOrigin().GetURL())
      .cosmetic_filtering_enabled;
}

void GuardProfileService::GetCosmeticSelectors(
    content::RenderFrameHost& document,
    GuardEngineSession::CosmeticsCallback callback) {
  if (!CanApplyCosmetics(document)) {
    std::move(callback).Run({});
    return;
  }
  // The filter engine needs the document URL but never credentials or
  // fragments.
  GURL::Replacements clear;
  clear.ClearUsername();
  clear.ClearPassword();
  clear.ClearRef();
  active_->Cosmetics(
      document.GetLastCommittedURL().ReplaceComponents(clear).spec(),
      base::BindOnce(
          [](base::WeakPtr<GuardProfileService> service,
             content::WeakDocumentPtr document, uint64_t revision,
             GuardEngineSession::CosmeticsCallback callback,
             std::vector<std::string> selectors) {
            auto* frame = document.AsRenderFrameHostIfValid();
            if (!service || !frame || revision != service->revision_ ||
                !service->CanApplyCosmetics(*frame)) {
              selectors.clear();
            }
            std::move(callback).Run(std::move(selectors));
          },
          GetWeakPtr(), document.GetWeakDocumentPtr(), revision_,
          std::move(callback)));
}

bool GuardProfileService::IsPagePaused(int64_t browser_page_id) const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (stopped_ || managed_ || !valid_configuration_ ||
      configuration_.mode == TahaiGuardMode::kOff) {
    return false;
  }
  const auto found = paused_pages_.find(browser_page_id);
  return found != paused_pages_.end() && found->second->IsCurrent();
}

void GuardProfileService::StartCandidate(std::string rules,
                                         bool persist,
                                         UpdateCallback callback) {
  if (rules.empty() || rules.size() > kMaxRulesBytes ||
      !base::IsStringUTF8(rules) ||
      next_generation_ == std::numeric_limits<uint64_t>::max()) {
    last_update_failed_ = true;
    PostUpdate(std::move(callback), UpdateResult::kInvalidInput);
    return;
  }
  CHECK(!candidate_);
  persist_candidate_ = persist;
  update_callback_ = std::move(callback);
  candidate_rules_ = std::move(rules);
  candidate_generation_ = next_generation_++;
  candidate_ = session_factory_.Run();
  CHECK(candidate_);
  candidate_->SetFailureCallback(base::BindPostTaskToCurrentDefault(
      base::BindOnce(&GuardProfileService::OnEngineFailure,
                     weak_factory_.GetWeakPtr(), candidate_generation_)));
  candidate_->Compile(candidate_rules_,
                      base::BindPostTaskToCurrentDefault(base::BindOnce(
                          &GuardProfileService::OnConfigured,
                          weak_factory_.GetWeakPtr(), candidate_generation_)));
}

void GuardProfileService::OnConfigured(uint64_t generation,
                                       mojom::ConfigureResultPtr result) {
  if (stopped_ || generation != candidate_generation_ || !candidate_) {
    return;
  }
  UpdateCallback callback = std::move(update_callback_);
  const bool persist = persist_candidate_;
  if (!result || result->status != mojom::ConfigureStatus::kReady ||
      !candidate_->ready()) {
    candidate_generation_ = 0;
    candidate_.reset();
    candidate_rules_.clear();
    last_update_failed_ = true;
    PostUpdate(std::move(callback), UpdateResult::kCompileFailed);
    if (!persist &&
        (!result || result->status == mojom::ConfigureStatus::kReady ||
         restart_attempts_ != 0)) {
      ScheduleRestart();
    }
    return;
  }
  // Publish first, then drain the old engine. Failed candidates never replace
  // either the previous live generation or the user's durable rule text.
  auto previous = std::move(active_);
  active_ = std::move(candidate_);
  active_generation_ = generation;
  candidate_generation_ = 0;
  active_rules_ = std::move(candidate_rules_);
  candidate_rules_.clear();
  accepted_rules_ = result->accepted_rules;
  ignored_rules_ = result->ignored_rules;
  last_update_failed_ = false;
  ++revision_;
  previous.reset();
  cosmetic_observers_.Notify();
  if (persist) {
    CHECK(!profile_->IsOffTheRecord());
    profile_->GetPrefs()->SetString(prefs::kTahaiGuardCustomRules,
                                    active_rules_);
  }
  PostUpdate(std::move(callback), UpdateResult::kInstalled);
}

void GuardProfileService::OnEngineFailure(uint64_t generation) {
  if (!stopped_ && generation == active_generation_) {
    last_update_failed_ = true;
    ++revision_;
    cosmetic_observers_.Notify();
    ScheduleRestart();
  }
}

void GuardProfileService::ScheduleRestart() {
  if (stopped_ || candidate_ || restart_timer_.IsRunning() ||
      restart_attempts_ >= kRestartDelays.size() || !valid_configuration_ ||
      configuration_.mode == TahaiGuardMode::kOff) {
    return;
  }
  restart_timer_.Start(FROM_HERE, kRestartDelays[restart_attempts_++],
                       base::BindOnce(&GuardProfileService::Restart,
                                      weak_factory_.GetWeakPtr()));
}

void GuardProfileService::Restart() {
  if (stopped_ || candidate_) {
    return;
  }
  active_generation_ = 0;
  active_.reset();
  const std::string rules = RulesForMode(
      configuration_.mode,
      profile_->GetPrefs()->GetString(prefs::kTahaiGuardCustomRules));
  if (rules.size() > kMaxRulesBytes) {
    last_update_failed_ = true;
    return;
  }
  StartCandidate(rules, /*persist=*/false, {});
}

std::optional<GuardProfileService::Result> GuardProfileService::ImmediateResult(
    const GURL& request_url,
    const std::optional<url::Origin>& top_origin,
    std::optional<int64_t> browser_page_id) const {
  if (stopped_) {
    return Mandatory() ? Result::kRequiredUnavailable : Result::kUnavailable;
  }
  if (!request_url.SchemeIsHTTPOrHTTPS()) {
    return Result::kBypassed;
  }
  const Result unavailable =
      Mandatory() ? Result::kRequiredUnavailable : Result::kUnavailable;
  if (!valid_configuration_) {
    return unavailable;
  }
  if (configuration_.mode == TahaiGuardMode::kOff) {
    return Result::kBypassed;
  }
  if (browser_page_id && IsPagePaused(*browser_page_id)) {
    return Result::kPagePaused;
  }
  if (IsWebOrigin(top_origin) &&
      ResolveTahaiGuardSettingsForUrl(configuration_, top_origin->GetURL())
              .network_mode == TahaiGuardMode::kOff) {
    return Result::kBypassed;
  }
  if (!active_ || !active_->ready()) {
    return unavailable;
  }
  return std::nullopt;
}

void GuardProfileService::Check(const GURL& request_url,
                                const std::optional<url::Origin>& source_origin,
                                const std::optional<url::Origin>& top_origin,
                                mojom::RequestKind kind,
                                CheckCallback callback,
                                std::optional<int64_t> browser_page_id) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (stopped_) {
    // Complete callers already holding a raw service reference without
    // reviving a WeakPtr, touching profile preferences, or launching work.
    // Shutdown is never a bypass of mandatory configuration.
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(std::move(callback),
                                  Mandatory() ? Result::kRequiredUnavailable
                                              : Result::kUnavailable));
    return;
  }
  if (auto immediate =
          ImmediateResult(request_url, top_origin, browser_page_id)) {
    Complete(std::move(callback), *immediate, browser_page_id);
    return;
  }
  if (request_url.possibly_invalid_spec().size() > 8192) {
    Complete(std::move(callback),
             Mandatory() ? Result::kRequiredUnavailable : Result::kUnavailable);
    return;
  }
  GURL::Replacements sanitization;
  sanitization.ClearUsername();
  sanitization.ClearPassword();
  sanitization.ClearRef();
  const GURL match_url = request_url.ReplaceComponents(sanitization);
  active_->Check(
      match_url.spec(),
      IsWebOrigin(source_origin) ? source_origin->GetURL().spec()
                                 : std::string(),
      kind,
      base::BindOnce(&GuardProfileService::OnChecked,
                     weak_factory_.GetWeakPtr(), revision_, match_url,
                     top_origin, browser_page_id, std::move(callback)));
}

void GuardProfileService::OnChecked(uint64_t revision,
                                    GURL request_url,
                                    std::optional<url::Origin> top_origin,
                                    std::optional<int64_t> browser_page_id,
                                    CheckCallback callback,
                                    std::optional<mojom::Decision> decision) {
  if (auto immediate =
          ImmediateResult(request_url, top_origin, browser_page_id)) {
    Complete(std::move(callback), *immediate, browser_page_id);
  } else if (revision != revision_ || !decision ||
             (*decision != mojom::Decision::kAllow &&
              *decision != mojom::Decision::kBlock)) {
    Complete(std::move(callback),
             Mandatory() ? Result::kRequiredUnavailable : Result::kUnavailable);
  } else {
    Complete(std::move(callback), *decision == mojom::Decision::kBlock
                                      ? Result::kBlock
                                      : Result::kAllow);
  }
}

void GuardProfileService::Complete(CheckCallback callback,
                                   Result result,
                                   std::optional<int64_t> browser_page_id) {
  base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
      FROM_HERE,
      base::BindOnce(&GuardProfileService::Deliver, weak_factory_.GetWeakPtr(),
                     revision_, std::move(callback), result, browser_page_id));
}

void GuardProfileService::Deliver(uint64_t revision,
                                  CheckCallback callback,
                                  Result result,
                                  std::optional<int64_t> browser_page_id) {
  // Preferences can change between IPC completion and delivery. In particular,
  // a queued Allow must not cross a new mandatory configuration revision.
  if (revision != revision_) {
    result = Mandatory() ? Result::kRequiredUnavailable
             : configuration_.mode == TahaiGuardMode::kOff ? Result::kBypassed
             : result == Result::kPagePaused ? Result::kContextChanged
                                             : Result::kUnavailable;
  }
  if (result == Result::kPagePaused &&
      (!browser_page_id || !IsPagePaused(*browser_page_id))) {
    result = Result::kContextChanged;
  }
  if (!stopped_ && configuration_.local_statistics_enabled) {
    if (result == Result::kAllow) {
      Increment(allowed_);
    } else if (result == Result::kBlock) {
      Increment(blocked_);
    } else if (result == Result::kUnavailable ||
               result == Result::kRequiredUnavailable ||
               result == Result::kContextChanged) {
      Increment(unavailable_);
    }
  }
  std::move(callback).Run(result);
}

GuardProfileService::Snapshot GuardProfileService::GetSnapshot() const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  Status status = Status::kUnavailable;
  if (stopped_) {
    status = Status::kStopped;
  } else if (!valid_configuration_) {
    status = Status::kInvalidConfiguration;
  } else if (configuration_.mode == TahaiGuardMode::kOff) {
    status = Status::kOff;
  } else if (active_ && active_->ready()) {
    status = last_update_failed_ ? Status::kLastKnownGood : Status::kReady;
  } else if (candidate_) {
    status = Status::kCompiling;
  } else if (!last_update_failed_ && active_rules_.empty() &&
             configuration_.mode == TahaiGuardMode::kCustom) {
    status = Status::kNoRules;
  }
  return {status,
          configuration_.mode,
          profile_->IsOffTheRecord(),
          managed_,
          configuration_.local_statistics_enabled,
          accepted_rules_,
          ignored_rules_,
          allowed_,
          blocked_,
          unavailable_};
}

}  // namespace tahai::guard
