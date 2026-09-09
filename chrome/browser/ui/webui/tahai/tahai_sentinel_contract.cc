// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_sentinel_contract.h"

#include <algorithm>
#include <optional>

#include "base/strings/string_util.h"
#include "net/base/ip_address.h"
#include "url/gurl.h"

namespace tahai {
namespace {

constexpr int kMinimumWatchIntervalSeconds = 60;
constexpr int kMaximumWatchIntervalSeconds = 24 * 60 * 60;

bool IsDnsOrTlsWatch(TahaiSentinelWatchKind kind) {
  return kind == TahaiSentinelWatchKind::kDnsRecord ||
         kind == TahaiSentinelWatchKind::kTlsCertificate;
}

bool IsSafePublicHostname(std::string_view hostname) {
  if (hostname.empty() || hostname.size() > 253u || hostname == "localhost" ||
      base::EndsWith(hostname, ".local",
                     base::CompareCase::INSENSITIVE_ASCII) ||
      base::EndsWith(hostname, ".internal",
                     base::CompareCase::INSENSITIVE_ASCII) ||
      base::EndsWith(hostname, ".test",
                     base::CompareCase::INSENSITIVE_ASCII)) {
    return false;
  }
  // Do not allow a local DNS search suffix to reinterpret an explicit Sentinel
  // hostname. Public DNS names and dotted IPv4 literals are accepted; bare
  // labels are not.
  if (hostname.find('.') == std::string_view::npos) {
    return false;
  }
  net::IPAddress literal_address;
  if (literal_address.AssignFromIPLiteral(hostname) &&
      !literal_address.IsPubliclyRoutable()) {
    return false;
  }
  if (!std::all_of(hostname.begin(), hostname.end(), [](char character) {
        return (character >= 'a' && character <= 'z') ||
               (character >= 'A' && character <= 'Z') ||
               (character >= '0' && character <= '9') || character == '-' ||
               character == '.';
      })) {
    return false;
  }

  // Do not treat a character-class match as a valid DNS name. The shared
  // validator protects explicit Change Lens, artifact, and manual-watch
  // entry points as well as the support surface, so it rejects malformed
  // label boundaries rather than relying on a resolver to reinterpret them.
  size_t label_start = 0;
  while (label_start < hostname.size()) {
    const size_t label_end = hostname.find('.', label_start);
    const size_t end =
        label_end == std::string_view::npos ? hostname.size() : label_end;
    const std::string_view label =
        hostname.substr(label_start, end - label_start);
    if (label.empty() || label.size() > 63u || label.front() == '-' ||
        label.back() == '-') {
      return false;
    }
    if (label_end == std::string_view::npos) {
      break;
    }
    label_start = label_end + 1u;
  }
  return hostname.back() != '.';
}

}  // namespace

std::string_view TahaiSentinelWatchKindName(TahaiSentinelWatchKind kind) {
  switch (kind) {
    case TahaiSentinelWatchKind::kDnsRecord:
      return "dns_record";
    case TahaiSentinelWatchKind::kTlsCertificate:
      return "tls_certificate";
    case TahaiSentinelWatchKind::kRedirectChain:
      return "redirect_chain";
    case TahaiSentinelWatchKind::kEndpointStatus:
      return "endpoint_status";
    case TahaiSentinelWatchKind::kResponseHeader:
      return "response_header";
    case TahaiSentinelWatchKind::kContentHash:
      return "content_hash";
    case TahaiSentinelWatchKind::kDownloadArtifactHash:
      return "download_artifact_hash";
  }
  NOTREACHED();
}

std::optional<TahaiSentinelWatchKind> TahaiSentinelWatchKindFromName(
    std::string_view name) {
  if (name == "dns_record") {
    return TahaiSentinelWatchKind::kDnsRecord;
  }
  if (name == "tls_certificate") {
    return TahaiSentinelWatchKind::kTlsCertificate;
  }
  if (name == "redirect_chain") {
    return TahaiSentinelWatchKind::kRedirectChain;
  }
  if (name == "endpoint_status") {
    return TahaiSentinelWatchKind::kEndpointStatus;
  }
  if (name == "response_header") {
    return TahaiSentinelWatchKind::kResponseHeader;
  }
  if (name == "content_hash") {
    return TahaiSentinelWatchKind::kContentHash;
  }
  if (name == "download_artifact_hash") {
    return TahaiSentinelWatchKind::kDownloadArtifactHash;
  }
  return std::nullopt;
}

TahaiSentinelWatchValidationResult ValidateTahaiSentinelWatchRequest(
    const TahaiSentinelWatchRequest& request,
    std::string* canonical_target) {
  if (!canonical_target) {
    return TahaiSentinelWatchValidationResult::kInvalidTarget;
  }
  canonical_target->clear();
  if (request.interval_seconds < kMinimumWatchIntervalSeconds ||
      request.interval_seconds > kMaximumWatchIntervalSeconds) {
    return TahaiSentinelWatchValidationResult::kInvalidInterval;
  }
  if (IsDnsOrTlsWatch(request.kind)) {
    if (!IsSafePublicHostname(request.target)) {
      return TahaiSentinelWatchValidationResult::kDisallowedTarget;
    }
    *canonical_target = base::ToLowerASCII(request.target);
    return TahaiSentinelWatchValidationResult::kValid;
  }

  GURL target(request.target);
  if (!target.is_valid() || !target.SchemeIs("https") || !target.has_host() ||
      target.has_username() || target.has_password() || target.has_query() ||
      target.has_ref()) {
    return TahaiSentinelWatchValidationResult::kInvalidTarget;
  }
  if (!IsSafePublicHostname(target.host())) {
    return TahaiSentinelWatchValidationResult::kDisallowedTarget;
  }
  *canonical_target = target.spec();
  return TahaiSentinelWatchValidationResult::kValid;
}

}  // namespace tahai
