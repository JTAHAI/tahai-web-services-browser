// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_change_lens_contract.h"

#include <algorithm>
#include <optional>
#include <string>
#include <string_view>
#include <utility>

#include "base/notreached.h"
#include "base/strings/string_util.h"
#include "chrome/browser/ui/webui/tahai/tahai_sentinel_contract.h"

namespace tahai {
namespace {

bool IsDigest(std::string_view value) {
  return value.size() == 64u &&
         std::all_of(value.begin(), value.end(), [](unsigned char character) {
           return base::IsAsciiLower(character) ||
                  base::IsAsciiDigit(character);
         });
}

TahaiSentinelWatchKind SentinelKindFor(TahaiChangeCaptureKind kind) {
  switch (kind) {
    case TahaiChangeCaptureKind::kDnsRecordDigest:
      return TahaiSentinelWatchKind::kDnsRecord;
    case TahaiChangeCaptureKind::kTlsCertificateDigest:
      return TahaiSentinelWatchKind::kTlsCertificate;
    case TahaiChangeCaptureKind::kRedirectChainDigest:
      return TahaiSentinelWatchKind::kRedirectChain;
    case TahaiChangeCaptureKind::kEndpointStatusDigest:
      return TahaiSentinelWatchKind::kEndpointStatus;
    case TahaiChangeCaptureKind::kResponseHeaderDigest:
      return TahaiSentinelWatchKind::kResponseHeader;
    case TahaiChangeCaptureKind::kContentDigest:
      return TahaiSentinelWatchKind::kContentHash;
    case TahaiChangeCaptureKind::kDownloadArtifactDigest:
      return TahaiSentinelWatchKind::kDownloadArtifactHash;
  }
  NOTREACHED();
}

bool IsComparableCapture(const TahaiChangeCapture& capture) {
  return !capture.canonical_target.empty() && IsDigest(capture.sha256_digest) &&
         capture.captured_at_windows_epoch_us > 0;
}

}  // namespace

std::string_view TahaiChangeCaptureKindName(TahaiChangeCaptureKind kind) {
  switch (kind) {
    case TahaiChangeCaptureKind::kDnsRecordDigest:
      return "dns_record";
    case TahaiChangeCaptureKind::kTlsCertificateDigest:
      return "tls_certificate";
    case TahaiChangeCaptureKind::kRedirectChainDigest:
      return "redirect_chain";
    case TahaiChangeCaptureKind::kEndpointStatusDigest:
      return "endpoint_status";
    case TahaiChangeCaptureKind::kResponseHeaderDigest:
      return "response_header";
    case TahaiChangeCaptureKind::kContentDigest:
      return "content";
    case TahaiChangeCaptureKind::kDownloadArtifactDigest:
      return "download_artifact";
  }
  NOTREACHED();
}

std::optional<TahaiChangeCaptureKind> TahaiChangeCaptureKindFromName(
    std::string_view name) {
  if (name == "dns_record") {
    return TahaiChangeCaptureKind::kDnsRecordDigest;
  }
  if (name == "tls_certificate") {
    return TahaiChangeCaptureKind::kTlsCertificateDigest;
  }
  if (name == "redirect_chain") {
    return TahaiChangeCaptureKind::kRedirectChainDigest;
  }
  if (name == "endpoint_status") {
    return TahaiChangeCaptureKind::kEndpointStatusDigest;
  }
  if (name == "response_header") {
    return TahaiChangeCaptureKind::kResponseHeaderDigest;
  }
  if (name == "content") {
    return TahaiChangeCaptureKind::kContentDigest;
  }
  if (name == "download_artifact") {
    return TahaiChangeCaptureKind::kDownloadArtifactDigest;
  }
  return std::nullopt;
}

TahaiChangeCaptureValidationResult ValidateTahaiChangeCaptureRequest(
    const TahaiChangeCaptureRequest& request,
    TahaiChangeCapture* validated_capture) {
  if (!validated_capture) {
    return TahaiChangeCaptureValidationResult::kInvalidTarget;
  }
  *validated_capture = TahaiChangeCapture();
  if (!IsDigest(request.sha256_digest)) {
    return TahaiChangeCaptureValidationResult::kInvalidDigest;
  }
  if (request.captured_at_windows_epoch_us <= 0) {
    return TahaiChangeCaptureValidationResult::kInvalidTimestamp;
  }

  std::string canonical_target;
  const TahaiSentinelWatchRequest sentinel_request = {
      SentinelKindFor(request.kind), request.target,
      // This invokes only the Sentinel request validator; it never schedules
      // an observation or opens a network connection.
      60};
  if (ValidateTahaiSentinelWatchRequest(sentinel_request, &canonical_target) !=
      TahaiSentinelWatchValidationResult::kValid) {
    return TahaiChangeCaptureValidationResult::kInvalidTarget;
  }

  *validated_capture = {request.kind, std::move(canonical_target),
                        request.sha256_digest,
                        request.captured_at_windows_epoch_us};
  return TahaiChangeCaptureValidationResult::kValid;
}

TahaiChangeComparisonResult CompareTahaiChangeCaptures(
    const TahaiChangeCapture& before,
    const TahaiChangeCapture& after) {
  if (!IsComparableCapture(before) || !IsComparableCapture(after)) {
    return TahaiChangeComparisonResult::kInvalidCapture;
  }
  if (before.kind != after.kind ||
      before.canonical_target != after.canonical_target) {
    return TahaiChangeComparisonResult::kDifferentSubject;
  }
  return before.sha256_digest == after.sha256_digest
             ? TahaiChangeComparisonResult::kUnchanged
             : TahaiChangeComparisonResult::kChanged;
}

}  // namespace tahai
