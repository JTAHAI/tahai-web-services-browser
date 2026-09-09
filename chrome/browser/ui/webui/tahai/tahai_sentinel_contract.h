// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SENTINEL_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SENTINEL_CONTRACT_H_

#include <optional>
#include <string>
#include <string_view>

namespace tahai {

// Sentinel Watch is constrained to externally observable, configured checks.
// It does not browse authenticated consoles, extract page content, or click
// controls. Scheduling and networking remain separate from this validator.
enum class TahaiSentinelWatchKind {
  kDnsRecord,
  kTlsCertificate,
  kRedirectChain,
  kEndpointStatus,
  kResponseHeader,
  kContentHash,
  kDownloadArtifactHash,
};

std::string_view TahaiSentinelWatchKindName(TahaiSentinelWatchKind kind);
std::optional<TahaiSentinelWatchKind> TahaiSentinelWatchKindFromName(
    std::string_view name);

struct TahaiSentinelWatchRequest {
  TahaiSentinelWatchKind kind;
  std::string target;
  int interval_seconds = 0;
};

enum class TahaiSentinelWatchValidationResult {
  kValid,
  kInvalidTarget,
  kDisallowedTarget,
  kInvalidInterval,
};

// Accepts only a public hostname for DNS/TLS checks or a canonical HTTPS URL
// without credentials, query, or fragment for HTTP and artifact checks.
TahaiSentinelWatchValidationResult ValidateTahaiSentinelWatchRequest(
    const TahaiSentinelWatchRequest& request,
    std::string* canonical_target);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SENTINEL_CONTRACT_H_
