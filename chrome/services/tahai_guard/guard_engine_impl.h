// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_SERVICES_TAHAI_GUARD_GUARD_ENGINE_IMPL_H_
#define CHROME_SERVICES_TAHAI_GUARD_GUARD_ENGINE_IMPL_H_

#include <memory>
#include <string>

#include "base/sequence_checker.h"
#include "chrome/services/tahai_guard/public/mojom/guard_engine.mojom.h"
#include "mojo/public/cpp/bindings/pending_receiver.h"
#include "mojo/public/cpp/bindings/receiver.h"

namespace tahai::guard {

// Utility-process only. A single sequence owns the Rust engine (the upstream
// single-thread feature deliberately makes it neither Send nor Sync).
class GuardEngineImpl final : public mojom::GuardEngine {
 public:
  explicit GuardEngineImpl(mojo::PendingReceiver<mojom::GuardEngine> receiver);
  ~GuardEngineImpl() override;
  void Cosmetics(const std::string& document_url,
                 CosmeticsCallback callback) override;

  GuardEngineImpl(const GuardEngineImpl&) = delete;
  GuardEngineImpl& operator=(const GuardEngineImpl&) = delete;

 private:
  struct EngineState;
  void Configure(const std::string& rules, ConfigureCallback callback) override;
  void Match(const std::string& request_url,
             const std::string& source_origin,
             mojom::RequestKind kind,
             MatchCallback callback) override;

  SEQUENCE_CHECKER(sequence_checker_);
  bool configure_attempted_ = false;
  std::unique_ptr<EngineState> engine_;
  // Last member: close incoming calls before releasing the engine.
  mojo::Receiver<mojom::GuardEngine> receiver_{this};
};

}  // namespace tahai::guard

#endif  // CHROME_SERVICES_TAHAI_GUARD_GUARD_ENGINE_IMPL_H_
