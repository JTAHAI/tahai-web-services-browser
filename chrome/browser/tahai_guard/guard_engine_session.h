// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_GUARD_GUARD_ENGINE_SESSION_H_
#define CHROME_BROWSER_TAHAI_GUARD_GUARD_ENGINE_SESSION_H_

#include <cstdint>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "base/functional/callback.h"
#include "base/memory/ref_counted.h"
#include "base/memory/weak_ptr.h"
#include "base/process/process.h"
#include "base/sequence_checker.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/services/tahai_guard/public/mojom/guard_engine.mojom.h"
#include "mojo/public/cpp/bindings/pending_remote.h"
#include "mojo/public/cpp/bindings/remote.h"

namespace tahai::guard {

// Owns ONE filter generation and ONE separately launched sandboxed process.
// The profile owner must not share sessions across BrowserContexts. This class
// does not decide which profile/site owns a request and must not infer it from
// the currently focused pane. No rules, URLs, or outcomes are written to disk.
class GuardEngineSession final {
 public:
  // nullptr/nullopt is an explicit transport/deadline/overload failure, not an
  // Allow decision. The caller owns its documented degraded/managed policy.
  using CompileCallback = base::OnceCallback<void(mojom::ConfigureResultPtr)>;
  using CheckCallback =
      base::OnceCallback<void(std::optional<mojom::Decision>)>;
  using CosmeticsCallback = base::OnceCallback<void(std::vector<std::string>)>;

  GuardEngineSession();
  // Test-only injection of an in-process fake remote. It never grants a handle
  // to any external process and cannot terminate a caller-supplied process.
  explicit GuardEngineSession(
      mojo::PendingRemote<mojom::GuardEngine> test_engine);
  ~GuardEngineSession();

  GuardEngineSession(const GuardEngineSession&) = delete;
  GuardEngineSession& operator=(const GuardEngineSession&) = delete;

  void Compile(const std::string& rules, CompileCallback callback);
  void Check(const std::string& request_url,
             const std::string& source_origin,
             mojom::RequestKind kind,
             CheckCallback callback);
  void Stop();
  void Cosmetics(const std::string& document_url, CosmeticsCallback callback);
  // Delivered once for transport/deadline failure, including an idle crash.
  // The profile owner should post its recovery work to avoid reentrant
  // teardown.
  void SetFailureCallback(base::OnceClosure callback);
  bool ready() const;
  size_t pending_requests_for_testing() const;

 private:
  enum class State { kIdle, kCompiling, kReady, kUnusable, kStopped };
  struct PendingCheck {
    base::TimeTicks deadline;
    CheckCallback callback;
  };
  struct OwnedProcess {
    base::Process process;
    bool stop_requested = false;
  };
  struct PendingCosmetics {
    base::TimeTicks deadline;
    CosmeticsCallback callback;
  };

  void OnConfigured(mojom::ConfigureResultPtr result);
  void OnChecked(uint64_t id, mojom::Decision decision);
  void OnCosmetics(uint64_t id, const std::vector<std::string>& selectors);
  void OnDeadline();
  void Fail();
  void Finish(State state);
  void StopOwnedProcess();

  SEQUENCE_CHECKER(sequence_checker_);
  State state_ = State::kIdle;
  uint64_t next_request_id_ = 1;
  // Shared only with Launch's one-shot process callback, so cancellation before
  // process creation also terminates that late-arriving owned utility process.
  scoped_refptr<base::RefCountedData<OwnedProcess>> owned_process_;
  mojo::Remote<mojom::GuardEngine> engine_;
  CompileCallback compile_callback_;
  base::OnceClosure failure_callback_;
  base::TimeTicks compile_deadline_at_;
  std::map<uint64_t, PendingCheck> pending_;
  std::map<uint64_t, PendingCosmetics> pending_cosmetics_;
  base::OneShotTimer compile_deadline_;
  base::RepeatingTimer request_deadline_;
  base::WeakPtrFactory<GuardEngineSession> weak_factory_{this};
};

}  // namespace tahai::guard

#endif  // CHROME_BROWSER_TAHAI_GUARD_GUARD_ENGINE_SESSION_H_
