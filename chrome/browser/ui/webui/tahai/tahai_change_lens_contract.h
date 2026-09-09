// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_CHANGE_LENS_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_CHANGE_LENS_CONTRACT_H_

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>

namespace tahai {

// Change Lens works from an explicitly supplied, fixed-size digest. It never
// accepts page bodies, screenshots, selected text, authorization headers,
// cookies, credentials, or arbitrary notes. A future capture UI must obtain
// the operator's approval and produce this restricted metadata separately.
enum class TahaiChangeCaptureKind {
  kDnsRecordDigest,
  kTlsCertificateDigest,
  kRedirectChainDigest,
  kEndpointStatusDigest,
  kResponseHeaderDigest,
  kContentDigest,
  kDownloadArtifactDigest,
};

std::string_view TahaiChangeCaptureKindName(TahaiChangeCaptureKind kind);
std::optional<TahaiChangeCaptureKind> TahaiChangeCaptureKindFromName(
    std::string_view name);

struct TahaiChangeCaptureRequest {
  TahaiChangeCaptureKind kind;
  std::string target;
  std::string sha256_digest;
  int64_t captured_at_windows_epoch_us = 0;
};

// This is the only payload retained by the Change Lens comparison contract.
// `canonical_target` is a public hostname or query-free public HTTPS URL;
// `sha256_digest` is normalized lowercase hexadecimal.
struct TahaiChangeCapture {
  TahaiChangeCaptureKind kind;
  std::string canonical_target;
  std::string sha256_digest;
  int64_t captured_at_windows_epoch_us = 0;
};

enum class TahaiChangeCaptureValidationResult {
  kValid,
  kInvalidTarget,
  kInvalidDigest,
  kInvalidTimestamp,
};

// Clears `validated_capture` on every failure. Validation is deterministic
// and does not issue a DNS, TLS, HTTP, download, or browser-content request.
TahaiChangeCaptureValidationResult ValidateTahaiChangeCaptureRequest(
    const TahaiChangeCaptureRequest& request,
    TahaiChangeCapture* validated_capture);

enum class TahaiChangeComparisonResult {
  kUnchanged,
  kChanged,
  kDifferentSubject,
  kInvalidCapture,
};

// Compares two separately validated digest records. It is intentionally not a
// diff engine and cannot recover or reveal the captured material.
TahaiChangeComparisonResult CompareTahaiChangeCaptures(
    const TahaiChangeCapture& before,
    const TahaiChangeCapture& after);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_CHANGE_LENS_CONTRACT_H_
