// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/services/tahai_guard/guard_engine_impl.h"

#include <string_view>
#include <utility>
#include <vector>

#include "base/strings/string_util.h"
#include "chrome/services/tahai_guard/engine.rs.h"
#include "url/gurl.h"

namespace tahai::guard {
namespace {

constexpr size_t kMaxRulesBytes = 4 * 1024 * 1024;
constexpr size_t kMaxUrlBytes = 8192;

std::string_view EngineRequestKind(mojom::RequestKind kind) {
  switch (kind) {
    case mojom::RequestKind::kDocument:
      return "document";
    case mojom::RequestKind::kSubdocument:
      return "subdocument";
    case mojom::RequestKind::kScript:
      return "script";
    case mojom::RequestKind::kStylesheet:
      return "stylesheet";
    case mojom::RequestKind::kImage:
      return "image";
    case mojom::RequestKind::kFont:
      return "font";
    case mojom::RequestKind::kMedia:
      return "media";
    case mojom::RequestKind::kObject:
      return "object";
    case mojom::RequestKind::kXmlHttpRequest:
      return "xmlhttprequest";
    case mojom::RequestKind::kPing:
      return "ping";
    case mojom::RequestKind::kOther:
      return "other";
  }
  return "other";
}

mojom::ConfigureStatus PublicCompileStatus(ffi::CompileStatus status) {
  switch (status) {
    case ffi::CompileStatus::Ready:
      return mojom::ConfigureStatus::kReady;
    case ffi::CompileStatus::NoRules:
      return mojom::ConfigureStatus::kNoRules;
    case ffi::CompileStatus::InputTooLarge:
      return mojom::ConfigureStatus::kInputTooLarge;
    case ffi::CompileStatus::InvalidInput:
      return mojom::ConfigureStatus::kInvalidInput;
    default:
      return mojom::ConfigureStatus::kInvalidInput;
  }
}

mojom::Decision PublicDecision(ffi::MatchResult result) {
  switch (result) {
    case ffi::MatchResult::Allow:
      return mojom::Decision::kAllow;
    case ffi::MatchResult::Block:
      return mojom::Decision::kBlock;
    case ffi::MatchResult::InvalidRequest:
      return mojom::Decision::kInvalidRequest;
    case ffi::MatchResult::NotConfigured:
      return mojom::Decision::kNotConfigured;
    default:
      return mojom::Decision::kInvalidRequest;
  }
}

bool IsHttpUrl(const GURL& url) {
  return url.is_valid() && url.SchemeIsHTTPOrHTTPS() && url.has_host() &&
         !url.has_username() && !url.has_password();
}

}  // namespace

struct GuardEngineImpl::EngineState {
  explicit EngineState(const std::string& rules)
      : value(ffi::compile_engine(rules)) {}
  rust::Box<ffi::FilterEngine> value;
};

GuardEngineImpl::GuardEngineImpl(
    mojo::PendingReceiver<mojom::GuardEngine> receiver)
    : receiver_(this, std::move(receiver)) {}

GuardEngineImpl::~GuardEngineImpl() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
}

void GuardEngineImpl::Cosmetics(const std::string& document_url,
                                CosmeticsCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  std::vector<std::string> selectors;
  if (engine_ && document_url.size() <= kMaxUrlBytes &&
      IsHttpUrl(GURL(document_url))) {
    for (const auto& selector :
         engine_->value->cosmetic_selectors(document_url)) {
      selectors.emplace_back(selector);
    }
  }
  std::move(callback).Run(std::move(selectors));
}

void GuardEngineImpl::Configure(const std::string& rules,
                                ConfigureCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  auto result = mojom::ConfigureResult::New();
  if (configure_attempted_) {
    result->status = mojom::ConfigureStatus::kAlreadyConfigured;
  } else {
    configure_attempted_ = true;
    if (rules.size() > kMaxRulesBytes) {
      result->status = mojom::ConfigureStatus::kInputTooLarge;
    } else if (!base::IsStringUTF8(rules)) {
      result->status = mojom::ConfigureStatus::kInvalidInput;
    } else {
      // No exception/unwind crosses CXX. With Chromium's abort-on-panic Rust
      // configuration a panic terminates only this sandboxed utility. Browser
      // ownership handles disconnect/deadline as engine failure, never allow.
      engine_ = std::make_unique<EngineState>(rules);
      result->status = PublicCompileStatus(engine_->value->status());
      result->accepted_rules = engine_->value->accepted_rules();
      result->ignored_rules = engine_->value->ignored_rules();
    }
  }
  std::move(callback).Run(std::move(result));
}

void GuardEngineImpl::Match(const std::string& request_url,
                            const std::string& source_origin,
                            mojom::RequestKind kind,
                            MatchCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!engine_) {
    std::move(callback).Run(mojom::Decision::kNotConfigured);
    return;
  }
  if (request_url.size() > kMaxUrlBytes ||
      source_origin.size() > kMaxUrlBytes) {
    std::move(callback).Run(mojom::Decision::kInvalidRequest);
    return;
  }
  const GURL request(request_url);
  const GURL origin(source_origin);
  if (!IsHttpUrl(request) ||
      (!source_origin.empty() && (!IsHttpUrl(origin) || origin.has_query() ||
                                  origin.has_ref() || origin.path() != "/"))) {
    std::move(callback).Run(mojom::Decision::kInvalidRequest);
    return;
  }
  GURL::Replacements without_fragment;
  without_fragment.ClearRef();
  const GURL normalized_request = request.ReplaceComponents(without_fragment);
  const std::string request_kind(EngineRequestKind(kind));
  std::move(callback).Run(PublicDecision(engine_->value->check(
      normalized_request.spec(), origin.spec(), request_kind)));
}

}  // namespace tahai::guard
