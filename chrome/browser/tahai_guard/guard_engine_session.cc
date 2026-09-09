// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_guard/guard_engine_session.h"

#include <limits>
#include <utility>

#include "base/functional/bind.h"
#include "base/location.h"
#include "base/strings/string_util.h"
#include "chrome/common/tahai_guard_css.h"
#include "chrome/grit/generated_resources.h"
#include "content/public/browser/browser_thread.h"
#include "content/public/browser/service_process_host.h"

namespace tahai::guard {
namespace {

constexpr size_t kMaxRulesBytes = 4 * 1024 * 1024;
constexpr size_t kMaxUrlBytes = 8192;
constexpr size_t kMaxPendingRequests = 128;
constexpr auto kCompileTimeout = base::Seconds(30);
constexpr auto kRequestTimeout = base::Milliseconds(500);
constexpr auto kDeadlineResolution = base::Milliseconds(50);

mojom::ConfigureResultPtr CompileError(mojom::ConfigureStatus status) {
  auto result = mojom::ConfigureResult::New();
  result->status = status;
  return result;
}

}  // namespace

GuardEngineSession::GuardEngineSession() {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
}

GuardEngineSession::GuardEngineSession(
    mojo::PendingRemote<mojom::GuardEngine> test_engine)
    : engine_(std::move(test_engine)) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
}

GuardEngineSession::~GuardEngineSession() {
  Stop();
}

bool GuardEngineSession::ready() const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return state_ == State::kReady;
}

size_t GuardEngineSession::pending_requests_for_testing() const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return pending_.size();
}

void GuardEngineSession::Compile(const std::string& rules,
                                 CompileCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (state_ != State::kIdle) {
    std::move(callback).Run(
        CompileError(mojom::ConfigureStatus::kAlreadyConfigured));
    return;
  }
  if (rules.size() > kMaxRulesBytes || !base::IsStringUTF8(rules)) {
    state_ = State::kUnusable;
    engine_.reset();
    std::move(callback).Run(CompileError(
        rules.size() > kMaxRulesBytes ? mojom::ConfigureStatus::kInputTooLarge
                                      : mojom::ConfigureStatus::kInvalidInput));
    return;
  }
  state_ = State::kCompiling;
  compile_deadline_at_ = base::TimeTicks::Now() + kCompileTimeout;
  compile_callback_ = std::move(callback);
  if (!engine_.is_bound()) {
    owned_process_ = base::MakeRefCounted<base::RefCountedData<OwnedProcess>>();
    engine_ = content::ServiceProcessHost::Launch<mojom::GuardEngine>(
        content::ServiceProcessHost::Options()
            .WithDisplayName(IDS_TAHAI_GUARD_ENGINE_PROCESS_NAME)
            .WithProcessCallback(base::BindOnce(
                [](scoped_refptr<base::RefCountedData<OwnedProcess>> owned,
                   const base::Process& process) {
                  owned->data.process = process.Duplicate();
                  if (owned->data.stop_requested &&
                      owned->data.process.IsValid()) {
                    owned->data.process.Terminate(1, /*wait=*/false);
                    owned->data.process.Close();
                  }
                },
                owned_process_))
            .Pass());
  }
  engine_.set_disconnect_handler(
      base::BindOnce(&GuardEngineSession::Fail, weak_factory_.GetWeakPtr()));
  compile_deadline_.Start(
      FROM_HERE, kCompileTimeout,
      base::BindOnce(&GuardEngineSession::Fail, weak_factory_.GetWeakPtr()));
  engine_->Configure(rules, base::BindOnce(&GuardEngineSession::OnConfigured,
                                           weak_factory_.GetWeakPtr()));
}

void GuardEngineSession::OnConfigured(mojom::ConfigureResultPtr result) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (state_ != State::kCompiling) {
    return;
  }
  if (base::TimeTicks::Now() >= compile_deadline_at_) {
    Fail();
    return;
  }
  compile_deadline_.Stop();
  if (!result || result->accepted_rules > 150000 ||
      result->ignored_rules > 150000 ||
      result->accepted_rules + result->ignored_rules > 150000 ||
      result->status == mojom::ConfigureStatus::kAlreadyConfigured ||
      (result->status != mojom::ConfigureStatus::kReady &&
       result->accepted_rules != 0) ||
      (result->status == mojom::ConfigureStatus::kReady &&
       result->accepted_rules == 0)) {
    Fail();
    return;
  }
  state_ = result->status == mojom::ConfigureStatus::kReady ? State::kReady
                                                            : State::kUnusable;
  if (state_ == State::kUnusable) {
    engine_.reset();
    StopOwnedProcess();
  }
  // The callback may destroy this session. Do not access members afterward.
  std::move(compile_callback_).Run(std::move(result));
}

void GuardEngineSession::Check(const std::string& request_url,
                               const std::string& source_origin,
                               mojom::RequestKind kind,
                               CheckCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!ready() ||
      pending_.size() + pending_cosmetics_.size() >= kMaxPendingRequests ||
      next_request_id_ == std::numeric_limits<uint64_t>::max()) {
    std::move(callback).Run(std::nullopt);
    return;
  }
  if (request_url.size() > kMaxUrlBytes ||
      source_origin.size() > kMaxUrlBytes || !base::IsStringUTF8(request_url) ||
      !base::IsStringUTF8(source_origin)) {
    std::move(callback).Run(mojom::Decision::kInvalidRequest);
    return;
  }
  const uint64_t id = next_request_id_++;
  pending_.emplace(id, PendingCheck{base::TimeTicks::Now() + kRequestTimeout,
                                    std::move(callback)});
  if (!request_deadline_.IsRunning()) {
    request_deadline_.Start(FROM_HERE, kDeadlineResolution,
                            base::BindRepeating(&GuardEngineSession::OnDeadline,
                                                weak_factory_.GetWeakPtr()));
  }
  engine_->Match(request_url, source_origin, kind,
                 base::BindOnce(&GuardEngineSession::OnChecked,
                                weak_factory_.GetWeakPtr(), id));
}

void GuardEngineSession::OnChecked(uint64_t id, mojom::Decision decision) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  auto found = pending_.find(id);
  if (found == pending_.end()) {
    return;
  }
  // Timer delivery can be delayed by a busy UI sequence. A late IPC response
  // must not convert an expired request into a timely allow/block decision.
  if (base::TimeTicks::Now() >= found->second.deadline) {
    Fail();
    return;
  }
  CheckCallback callback = std::move(found->second.callback);
  pending_.erase(found);
  if (pending_.empty() && pending_cosmetics_.empty()) {
    request_deadline_.Stop();
  }
  std::move(callback).Run(decision);
}

void GuardEngineSession::OnDeadline() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  const base::TimeTicks now = base::TimeTicks::Now();
  for (const auto& [id, request] : pending_) {
    if (request.deadline <= now) {
      Fail();
      return;
    }
  }
  for (const auto& [id, request] : pending_cosmetics_) {
    if (request.deadline <= now) {
      Fail();
      return;
    }
  }
}

void GuardEngineSession::Cosmetics(const std::string& document_url,
                                   CosmeticsCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!ready() || document_url.size() > kMaxUrlBytes ||
      !base::IsStringUTF8(document_url) ||
      pending_.size() + pending_cosmetics_.size() >= kMaxPendingRequests ||
      next_request_id_ == std::numeric_limits<uint64_t>::max()) {
    std::move(callback).Run({});
    return;
  }
  const uint64_t id = next_request_id_++;
  pending_cosmetics_.emplace(
      id, PendingCosmetics{base::TimeTicks::Now() + kRequestTimeout,
                           std::move(callback)});
  if (!request_deadline_.IsRunning()) {
    request_deadline_.Start(FROM_HERE, kDeadlineResolution,
                            base::BindRepeating(&GuardEngineSession::OnDeadline,
                                                weak_factory_.GetWeakPtr()));
  }
  engine_->Cosmetics(document_url,
                     base::BindOnce(&GuardEngineSession::OnCosmetics,
                                    weak_factory_.GetWeakPtr(), id));
}

void GuardEngineSession::OnCosmetics(
    uint64_t id,
    const std::vector<std::string>& selectors) {
  const auto found = pending_cosmetics_.find(id);
  if (found == pending_cosmetics_.end()) {
    return;
  }
  if (base::TimeTicks::Now() >= found->second.deadline ||
      !AreSafeCosmeticSelectors(selectors)) {
    Fail();
    return;
  }
  auto callback = std::move(found->second.callback);
  pending_cosmetics_.erase(found);
  if (pending_.empty() && pending_cosmetics_.empty()) {
    request_deadline_.Stop();
  }
  std::move(callback).Run(selectors);
}

void GuardEngineSession::StopOwnedProcess() {
  if (!owned_process_) {
    return;
  }
  owned_process_->data.stop_requested = true;
  if (owned_process_->data.process.IsValid()) {
    // This is only the handle obtained for this session's newly launched
    // utility, never a user browser process or a process discovered by name.
    owned_process_->data.process.Terminate(1, /*wait=*/false);
    owned_process_->data.process.Close();
  }
}

void GuardEngineSession::Finish(State state) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  state_ = state;
  compile_deadline_.Stop();
  request_deadline_.Stop();
  weak_factory_.InvalidateWeakPtrs();
  engine_.reset();
  StopOwnedProcess();
  CompileCallback compile_callback = std::move(compile_callback_);
  base::OnceClosure failure_callback = std::move(failure_callback_);
  auto pending = std::move(pending_);
  pending_.clear();
  auto cosmetics = std::move(pending_cosmetics_);
  pending_cosmetics_.clear();
  // All state cleanup precedes external callbacks: they may delete this owner.
  if (compile_callback) {
    std::move(compile_callback).Run(nullptr);
  }
  for (auto& [id, request] : pending) {
    std::move(request.callback).Run(std::nullopt);
  }
  for (auto& [id, request] : cosmetics) {
    std::move(request.callback).Run({});
  }
  if (state == State::kUnusable && failure_callback) {
    std::move(failure_callback).Run();
  }
}

void GuardEngineSession::SetFailureCallback(base::OnceClosure callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  failure_callback_ = std::move(callback);
}

void GuardEngineSession::Fail() {
  Finish(State::kUnusable);
}
void GuardEngineSession::Stop() {
  Finish(State::kStopped);
}

}  // namespace tahai::guard
