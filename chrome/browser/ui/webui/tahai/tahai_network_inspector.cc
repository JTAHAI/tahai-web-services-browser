// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_network_inspector.h"

#include <algorithm>
#include <memory>
#include <string>
#include <utility>

#include "base/check.h"
#include "base/functional/bind.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/strings/stringprintf.h"
#include "base/time/time.h"
#include "base/timer/timer.h"
#include "chrome/browser/profiles/profile.h"
#include "content/public/browser/storage_partition.h"
#include "mojo/public/cpp/bindings/receiver.h"
#include "net/base/address_list.h"
#include "net/base/host_port_pair.h"
#include "net/base/ip_address.h"
#include "net/base/load_flags.h"
#include "net/base/net_errors.h"
#include "net/base/network_anonymization_key.h"
#include "net/cert/cert_status_flags.h"
#include "net/cert/x509_certificate.h"
#include "net/dns/public/host_resolver_results.h"
#include "net/http/http_response_headers.h"
#include "net/ssl/ssl_connection_status_flags.h"
#include "net/ssl/ssl_info.h"
#include "net/traffic_annotation/network_traffic_annotation.h"
#include "services/network/public/cpp/resolve_host_client_base.h"
#include "services/network/public/cpp/resource_request.h"
#include "services/network/public/cpp/shared_url_loader_factory.h"
#include "services/network/public/cpp/simple_url_loader.h"
#include "services/network/public/mojom/host_resolver.mojom.h"
#include "services/network/public/mojom/network_context.mojom.h"
#include "services/network/public/mojom/url_loader.mojom.h"
#include "services/network/public/mojom/url_loader_factory.mojom.h"
#include "services/network/public/mojom/url_response_head.mojom.h"
#include "url/gurl.h"

namespace tahai {
namespace {

constexpr int kHttpsPort = 443;
constexpr size_t kMaximumHostLength = 253u;
constexpr size_t kMaximumDnsLabelLength = 63u;
constexpr size_t kMaximumDisplayedAddresses = 24u;
constexpr size_t kMaximumDisplayedAliases = 24u;
constexpr size_t kMaximumDisplayedSubjectAltNames = 24u;
constexpr size_t kMaximumCertificateDisplayBytes = 256u;
constexpr size_t kMaximumRetainedDnsTopologyCount = 64u;
constexpr int kObservedSecurityHeaderVocabularySize = 6;

int BoundedDnsTopologyCount(size_t count) {
  return static_cast<int>(std::min(count, kMaximumRetainedDnsTopologyCount));
}

int BoundedSecurityHeaderCount(int count) {
  return std::clamp(count, 0, kObservedSecurityHeaderVocabularySize);
}

std::string SanitizeCertificateDisplayValue(std::string_view value) {
  // Certificate names are untrusted peer input. Keep the diagnostic useful
  // without allowing an endpoint to create an unbounded or control-character
  // heavy value in the browser-owned Support surface. This is display only;
  // Local OI deliberately retains none of these values.
  std::string sanitized(
      base::TruncateUTF8ToByteSize(value, kMaximumCertificateDisplayBytes));
  sanitized.erase(std::remove_if(sanitized.begin(), sanitized.end(),
                                 [](char character) {
                                   const unsigned char byte =
                                       static_cast<unsigned char>(character);
                                   return byte < 0x20u || byte == 0x7fu;
                                 }),
                  sanitized.end());
  return sanitized;
}

bool IsPublicInspectionHost(std::string_view host) {
  if (host == "localhost" ||
      base::EndsWith(host, ".local", base::CompareCase::INSENSITIVE_ASCII) ||
      base::EndsWith(host, ".internal",
                     base::CompareCase::INSENSITIVE_ASCII) ||
      base::EndsWith(host, ".test", base::CompareCase::INSENSITIVE_ASCII)) {
    return false;
  }
  net::IPAddress literal_address;
  return !literal_address.AssignFromIPLiteral(host) ||
         literal_address.IsPubliclyRoutable();
}

bool HasOnlyPubliclyRoutableAddresses(
    const net::AddressList& resolved_addresses) {
  return !resolved_addresses.empty() &&
         std::all_of(resolved_addresses.begin(), resolved_addresses.end(),
                     [](const net::IPEndPoint& endpoint) {
                       return endpoint.address().IsPubliclyRoutable();
                     });
}

std::string_view InspectionOutcomeLabel(
    const TahaiNetworkInspectionResult& result) {
  if (result.target_rejected) {
    return "target rejected before DNS or HTTPS";
  }
  if (result.public_address_guard_blocked) {
    return "blocked by the public-address guard";
  }
  if (result.dns_net_error != net::OK) {
    return "DNS resolution did not complete";
  }
  if (result.request_net_error != net::OK) {
    return "HTTPS/TLS probe did not complete";
  }
  if (result.certificate_revoked) {
    return "certificate revoked";
  }
  if (result.certificate_authority_invalid) {
    return "certificate authority not trusted";
  }
  if (result.certificate_name_mismatch) {
    return "certificate does not match target";
  }
  if (result.certificate_expired) {
    return "certificate expired";
  }
  if (result.certificate_valid) {
    return "Chromium certificate validation completed";
  }
  return "TLS validation needs review";
}

net::NetworkTrafficAnnotationTag NetworkInspectionTrafficAnnotation() {
  return net::DefineNetworkTrafficAnnotation("tahai_local_network_inspection",
                                             R"(
        semantics {
          sender: "TAHAI Local OI support diagnostics"
          description:
            "When a user explicitly enters a host in TAHAI Browser's Support "
            "surface, the browser resolves that host and sends one HTTPS HEAD "
            "request to inspect the TLS handshake, status code, and the "
            "presence of six fixed HTTP security headers. Header values are "
            "not retained."
          trigger: "User presses Run DNS and TLS inspection."
          data: "A user-entered host name only."
          destination: OTHER
          internal {
            contacts { email: "support@tahai.com" }
          }
          user_data {
            type: SENSITIVE_URL
          }
          last_reviewed: "2026-08-28"
        }
        policy {
          cookies_allowed: NO
          setting:
            "This diagnostic is available only after a user explicitly enters "
            "a supported host and runs it."
          policy_exception_justification:
            "Not implemented; enterprise network policy still applies."
        })");
}

std::string FormatDate(base::Time value) {
  if (value.is_null()) {
    return "Unavailable";
  }
  base::Time::Exploded exploded;
  value.UTCExplode(&exploded);
  return base::StringPrintf("%04d-%02d-%02d", exploded.year, exploded.month,
                            exploded.day_of_month);
}

std::string TlsVersionLabel(int connection_status) {
  switch (net::SSLConnectionStatusToVersion(connection_status)) {
    case net::SSL_CONNECTION_VERSION_TLS1:
      return "TLS 1.0";
    case net::SSL_CONNECTION_VERSION_TLS1_1:
      return "TLS 1.1";
    case net::SSL_CONNECTION_VERSION_TLS1_2:
      return "TLS 1.2";
    case net::SSL_CONNECTION_VERSION_TLS1_3:
      return "TLS 1.3";
    case net::SSL_CONNECTION_VERSION_QUIC:
      return "QUIC TLS";
    case net::SSL_CONNECTION_VERSION_UNKNOWN:
    case net::SSL_CONNECTION_VERSION_SSL2:
    case net::SSL_CONNECTION_VERSION_SSL3:
    case net::SSL_CONNECTION_VERSION_MAX:
      return "Unavailable";
  }
  return "Unavailable";
}

template <typename Item>
void AppendBounded(std::vector<Item>* destination,
                   const Item& value,
                   size_t limit) {
  if (destination->size() < limit) {
    destination->push_back(value);
  }
}

class InspectionOperation final : public network::ResolveHostClientBase {
 public:
  InspectionOperation(
      scoped_refptr<network::SharedURLLoaderFactory> loader_factory,
      std::string host,
      TahaiNetworkInspector::CompletionCallback callback)
      : callback_(std::move(callback)),
        loader_factory_(std::move(loader_factory)) {
    result_.host = std::move(host);
    result_.inspected_at = base::NumberToString(
        base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds());
  }

  InspectionOperation(const InspectionOperation&) = delete;
  InspectionOperation& operator=(const InspectionOperation&) = delete;

  void Start(network::mojom::NetworkContext* network_context) {
    DCHECK(network_context);
    DCHECK(loader_factory_);
    net::HostPortPair host_port_pair(result_.host, kHttpsPort);
    network_context->ResolveHost(
        network::mojom::HostResolverHost::NewHostPortPair(
            std::move(host_port_pair)),
        net::NetworkAnonymizationKey::CreateTransient(), nullptr,
        receiver_.BindNewPipeAndPassRemote());
    receiver_.set_disconnect_handler(base::BindOnce(
        &InspectionOperation::OnComplete, base::Unretained(this),
        net::ERR_NAME_NOT_RESOLVED, net::ResolveErrorInfo(net::ERR_FAILED),
        net::AddressList(), net::HostResolverEndpointResults()));
    resolver_timeout_.Start(
        FROM_HERE, base::Seconds(12),
        base::BindOnce(&InspectionOperation::OnResolverTimeout,
                       base::Unretained(this)));
  }

 private:
  ~InspectionOperation() override = default;

  void OnComplete(int result,
                  const net::ResolveErrorInfo&,
                  const net::AddressList& resolved_addresses,
                  const net::HostResolverEndpointResults&) override {
    if (tls_probe_started_) {
      return;
    }
    resolver_timeout_.Stop();
    receiver_.reset();
    result_.dns_net_error = result;
    if (result != net::OK) {
      result_.request_net_error = result;
      Complete();
      return;
    }
    if (!HasOnlyPubliclyRoutableAddresses(resolved_addresses)) {
      result_.request_net_error = net::ERR_ADDRESS_UNREACHABLE;
      result_.public_address_guard_blocked = true;
      Complete();
      return;
    }
    size_t resolved_ipv4_count = 0u;
    size_t resolved_ipv6_count = 0u;
    for (const net::IPEndPoint& endpoint : resolved_addresses) {
      if (endpoint.address().IsIPv4()) {
        ++resolved_ipv4_count;
      } else if (endpoint.address().IsIPv6()) {
        ++resolved_ipv6_count;
      }
      AppendBounded(&result_.resolved_addresses, endpoint.address().ToString(),
                    kMaximumDisplayedAddresses);
    }
    result_.resolved_ipv4_count = BoundedDnsTopologyCount(resolved_ipv4_count);
    result_.resolved_ipv6_count = BoundedDnsTopologyCount(resolved_ipv6_count);
    result_.dns_alias_count =
        BoundedDnsTopologyCount(resolved_addresses.dns_aliases().size());
    for (const std::string& alias : resolved_addresses.dns_aliases()) {
      AppendBounded(&result_.dns_aliases, alias, kMaximumDisplayedAliases);
    }
    StartTlsProbe();
  }

  void OnResolverTimeout() {
    if (tls_probe_started_) {
      return;
    }
    receiver_.reset();
    result_.dns_net_error = net::ERR_TIMED_OUT;
    result_.request_net_error = net::ERR_TIMED_OUT;
    Complete();
  }

  void StartTlsProbe() {
    if (tls_probe_started_) {
      return;
    }
    tls_probe_started_ = true;
    auto request = std::make_unique<network::ResourceRequest>();
    request->url = GURL("https://" + result_.host + "/");
    request->method = "HEAD";
    request->credentials_mode = network::mojom::CredentialsMode::kOmit;
    request->redirect_mode = network::mojom::RedirectMode::kError;
    request->do_not_prompt_for_login = true;
    request->load_flags = net::LOAD_BYPASS_CACHE | net::LOAD_DISABLE_CACHE;

    url_loader_ = network::SimpleURLLoader::Create(
        std::move(request), NetworkInspectionTrafficAnnotation());
    url_loader_->SetAllowHttpErrorResults(true);
    url_loader_->SetTimeoutDuration(base::Seconds(12));
    url_loader_->SetURLLoaderFactoryOptions(
        GetTahaiNetworkInspectionURLLoadOptions());
    url_loader_->DownloadHeadersOnly(
        loader_factory_.get(),
        base::BindOnce(&InspectionOperation::OnTlsProbeComplete,
                       base::Unretained(this)));
  }

  void OnTlsProbeComplete(scoped_refptr<net::HttpResponseHeaders> headers) {
    result_.request_net_error = url_loader_->NetError();
    if (result_.request_net_error ==
        net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS) {
      result_.public_address_guard_blocked = true;
      Complete();
      return;
    }
    if (headers) {
      result_.http_status = headers->response_code();
      PopulateSecurityHeaderObservation(*headers);
    }
    const network::mojom::URLResponseHead* response =
        url_loader_->ResponseInfo();
    if (response && response->ssl_info) {
      PopulateTlsResult(*response->ssl_info);
    }
    Complete();
  }

  void Complete() {
    result_.elapsed_milliseconds =
        static_cast<int>((base::Time::Now() - started_at_).InMilliseconds());
    url_loader_.reset();
    loader_factory_.reset();
    std::move(callback_).Run(std::move(result_));
    delete this;
  }

  void PopulateTlsResult(const net::SSLInfo& ssl_info) {
    result_.tls_info_available = true;
    result_.certificate_status = static_cast<int>(ssl_info.cert_status);
    result_.issued_by_known_root = ssl_info.is_issued_by_known_root;
    result_.certificate_name_mismatch =
        (ssl_info.cert_status & net::CERT_STATUS_COMMON_NAME_INVALID) != 0;
    result_.certificate_authority_invalid =
        (ssl_info.cert_status & net::CERT_STATUS_AUTHORITY_INVALID) != 0;
    result_.certificate_revoked =
        (ssl_info.cert_status & net::CERT_STATUS_REVOKED) != 0;
    result_.certificate_valid = ssl_info.cert_status == 0 &&
                                !ssl_info.is_fatal_cert_error && ssl_info.cert;
    result_.tls_version = TlsVersionLabel(ssl_info.connection_status);
    result_.cipher_suite = base::StringPrintf(
        "0x%04X",
        net::SSLConnectionStatusToCipherSuite(ssl_info.connection_status));
    if (!ssl_info.cert) {
      return;
    }
    result_.certificate_subject =
        SanitizeCertificateDisplayValue(ssl_info.cert->subject().common_name);
    result_.certificate_issuer =
        SanitizeCertificateDisplayValue(ssl_info.cert->issuer().common_name);
    result_.certificate_expiry = FormatDate(ssl_info.cert->valid_expiry());
    result_.certificate_expired =
        ssl_info.cert->valid_expiry() <= base::Time::Now();
    result_.certificate_days_remaining = static_cast<int>(
        (ssl_info.cert->valid_expiry() - base::Time::Now()).InDays());
    std::vector<std::string> names;
    ssl_info.cert->GetSubjectAltName(&names, nullptr);
    for (const std::string& name : names) {
      const std::string sanitized_name = SanitizeCertificateDisplayValue(name);
      if (!sanitized_name.empty()) {
        AppendBounded(&result_.subject_alt_names, sanitized_name,
                      kMaximumDisplayedSubjectAltNames);
      }
    }
  }

  void PopulateSecurityHeaderObservation(
      const net::HttpResponseHeaders& headers) {
    result_.security_header_observation_available = true;
    result_.strict_transport_security_observed =
        headers.HasHeader("Strict-Transport-Security");
    result_.content_security_policy_observed =
        headers.HasHeader("Content-Security-Policy");
    result_.x_content_type_options_observed =
        headers.HasHeader("X-Content-Type-Options");
    result_.x_frame_options_observed = headers.HasHeader("X-Frame-Options");
    result_.referrer_policy_observed = headers.HasHeader("Referrer-Policy");
    result_.permissions_policy_observed =
        headers.HasHeader("Permissions-Policy");
    result_.observed_security_header_count = BoundedSecurityHeaderCount(
        static_cast<int>(result_.strict_transport_security_observed) +
        static_cast<int>(result_.content_security_policy_observed) +
        static_cast<int>(result_.x_content_type_options_observed) +
        static_cast<int>(result_.x_frame_options_observed) +
        static_cast<int>(result_.referrer_policy_observed) +
        static_cast<int>(result_.permissions_policy_observed));
  }

  TahaiNetworkInspectionResult result_;
  TahaiNetworkInspector::CompletionCallback callback_;
  mojo::Receiver<network::mojom::ResolveHostClient> receiver_{this};
  base::OneShotTimer resolver_timeout_;
  scoped_refptr<network::SharedURLLoaderFactory> loader_factory_;
  std::unique_ptr<network::SimpleURLLoader> url_loader_;
  bool tls_probe_started_ = false;
  const base::Time started_at_ = base::Time::Now();
};

}  // namespace

int32_t GetTahaiNetworkInspectionURLLoadOptions() {
  // ResolveHost is an informational preflight, not a pinned connection. The
  // Network Service checks the actual endpoint for this load option, before
  // sending the HTTP request, even when client security state is absent.
  // This closes public-to-private DNS rebinding between the two operations.
  return network::mojom::kURLLoadOptionBlockLocalRequest |
         network::mojom::kURLLoadOptionSendSSLInfoWithResponse |
         network::mojom::kURLLoadOptionSendSSLInfoForCertificateError;
}

bool IsValidTahaiNetworkInspectionHost(std::string_view host) {
  if (host.empty() || host.size() > kMaximumHostLength) {
    return false;
  }
  // A single-label name can be expanded by an OS or enterprise DNS search
  // suffix. Requiring a fully qualified public name (or dotted IPv4 literal)
  // keeps this explicit diagnostic from resolving an unintended intranet
  // target through local search-domain configuration.
  if (host.find('.') == std::string_view::npos) {
    return false;
  }
  size_t label_length = 0u;
  for (size_t index = 0; index < host.size(); ++index) {
    const unsigned char character = host[index];
    if ((character >= 'a' && character <= 'z') ||
        (character >= 'A' && character <= 'Z') ||
        (character >= '0' && character <= '9')) {
      if (++label_length > kMaximumDnsLabelLength) {
        return false;
      }
      continue;
    }
    if (character == '-') {
      if (label_length == 0u || ++label_length > kMaximumDnsLabelLength ||
          index + 1u == host.size() || host[index + 1u] == '.') {
        return false;
      }
      continue;
    }
    if (character == '.') {
      if (label_length == 0u) {
        return false;
      }
      label_length = 0u;
      continue;
    }
    return false;
  }
  if (label_length == 0u) {
    return false;
  }
  const GURL url("https://" + std::string(host) + "/");
  const std::string canonical_host(url.host());
  return url.is_valid() && !canonical_host.empty() && !url.has_username() &&
         !url.has_password() && !url.has_query() && !url.has_ref() &&
         IsPublicInspectionHost(canonical_host);
}

void TahaiNetworkInspector::Inspect(Profile* profile,
                                    std::string_view host,
                                    CompletionCallback callback) {
  if (!profile || !IsValidTahaiNetworkInspectionHost(host)) {
    TahaiNetworkInspectionResult result;
    result.host = std::string(host);
    result.dns_net_error = net::ERR_INVALID_ARGUMENT;
    result.request_net_error = net::ERR_INVALID_ARGUMENT;
    result.target_rejected = true;
    result.inspected_at = base::NumberToString(
        base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds());
    std::move(callback).Run(std::move(result));
    return;
  }
  content::StoragePartition* partition = profile->GetDefaultStoragePartition();
  auto* network_context = partition->GetNetworkContext();
  auto loader_factory = partition->GetURLLoaderFactoryForBrowserProcess();
  if (!network_context || !loader_factory) {
    TahaiNetworkInspectionResult result;
    result.host = base::ToLowerASCII(host);
    result.dns_net_error = net::ERR_FAILED;
    result.request_net_error = net::ERR_FAILED;
    result.inspected_at = base::NumberToString(
        base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds());
    std::move(callback).Run(std::move(result));
    return;
  }
  auto* operation = new InspectionOperation(
      std::move(loader_factory), base::ToLowerASCII(host), std::move(callback));
  operation->Start(network_context);
}

std::string BuildTahaiNetworkInspectionSafeSummary(
    const TahaiNetworkInspectionResult& result,
    bool recorded_locally) {
  const std::string target = IsValidTahaiNetworkInspectionHost(result.host)
                                 ? result.host
                                 : "Unavailable";
  const std::string https_status =
      result.http_status >= 100 && result.http_status <= 599
          ? base::NumberToString(result.http_status)
          : "Unavailable";
  const std::string days_remaining =
      result.certificate_days_remaining >= 0 &&
              result.certificate_days_remaining <= 36500
          ? base::NumberToString(result.certificate_days_remaining)
          : "Unavailable";
  const std::string ipv4_count = base::NumberToString(
      std::clamp(result.resolved_ipv4_count, 0,
                 static_cast<int>(kMaximumRetainedDnsTopologyCount)));
  const std::string ipv6_count = base::NumberToString(
      std::clamp(result.resolved_ipv6_count, 0,
                 static_cast<int>(kMaximumRetainedDnsTopologyCount)));
  const std::string alias_count = base::NumberToString(
      std::clamp(result.dns_alias_count, 0,
                 static_cast<int>(kMaximumRetainedDnsTopologyCount)));
  const std::string security_header_count = base::NumberToString(
      BoundedSecurityHeaderCount(result.observed_security_header_count));
  return base::StrCat(
      {"TAHAI Browser Sanitized Support Inspection\n",
       "Scope: explicit public DNS + TLS check with bounded HTTP header "
       "presence observation\n",
       "Target: ",
       target,
       "\nOutcome: ",
       InspectionOutcomeLabel(result),
       "\nDNS result code: ",
       base::NumberToString(result.dns_net_error),
       "\nDNS topology counts: IPv4 ",
       ipv4_count,
       "; IPv6 ",
       ipv6_count,
       "; aliases ",
       alias_count,
       "\nSelected HTTP security headers observed: ",
       result.security_header_observation_available ? security_header_count
                                                    : "Unavailable",
       " of ",
       base::NumberToString(kObservedSecurityHeaderVocabularySize),
       "\nHTTPS status: ",
       https_status,
       "\nTLS metadata: ",
       result.tls_info_available ? "available" : "unavailable",
       "\nCertificate: ",
       result.certificate_expired ? "expired"
       : result.certificate_valid ? "valid"
                                  : "review",
       "\nCertificate status class: ",
       !result.tls_info_available             ? "Unavailable"
       : result.certificate_revoked           ? "revoked"
       : result.certificate_authority_invalid ? "authority not trusted"
       : result.certificate_name_mismatch     ? "target mismatch"
                                              : "none recorded",
       "\nDays remaining: ",
       days_remaining,
       "\nLocal OI record: ",
       recorded_locally ? "recorded" : "not recorded",
       "\nExcluded: addresses, aliases, certificate names, response headers, "
       "response bodies, cookies, credentials, and browser data.\n"});
}

std::vector<std::string> BuildTahaiNetworkInspectionGuidance(
    const TahaiNetworkInspectionResult& result) {
  std::vector<std::string> guidance;
  if (result.target_rejected) {
    guidance.push_back(
        "Enter one public DNS host name or publicly routable IPv4 address "
        "without a scheme, port, path, query, or credential.");
    return guidance;
  }
  if (result.public_address_guard_blocked) {
    guidance.push_back(
        result.request_net_error ==
                net::ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS
            ? "Review the public hostname and resolver path. "
              "Chromium blocked a non-public connection endpoint "
              "during the explicit HTTPS probe."
            : "Review the public hostname and resolver path. "
              "The explicit HTTPS probe was intentionally not "
              "sent after a non-public DNS result.");
    return guidance;
  }
  if (result.dns_net_error != 0) {
    guidance.push_back(
        "Review the entered host, local DNS policy, and resolver reachability "
        "before re-running the explicit inspection.");
    return guidance;
  }
  if (result.request_net_error != 0) {
    guidance.push_back(
        "Review public HTTPS reachability and Chromium transport diagnostics; "
        "the credential-free HEAD probe did not complete.");
  }
  if (result.http_status >= 500 && result.http_status <= 599) {
    guidance.push_back(
        "Review public service health, then re-run the explicit inspection "
        "after remediation.");
  } else if (result.http_status == 401 || result.http_status == 403) {
    guidance.push_back(
        "This credential-free probe was not authenticated. Do not infer "
        "authenticated service health or add credentials to this tool.");
  }
  if (result.request_net_error == net::OK && result.http_status >= 200 &&
      result.http_status <= 399 &&
      result.security_header_observation_available &&
      BoundedSecurityHeaderCount(result.observed_security_header_count) == 0) {
    guidance.push_back(
        "No selected HTTP security headers were observed on the public "
        "credential-free response. Review the intended service posture "
        "manually; this tool neither retained values nor authenticated.");
  }
  if (result.certificate_revoked) {
    guidance.push_back(
        "Do not rely on this endpoint until the revoked certificate is "
        "replaced and a new explicit inspection records a valid result.");
  } else if (result.certificate_authority_invalid) {
    guidance.push_back(
        "Review the public certificate chain and trust configuration, then "
        "record a new explicit inspection.");
  } else if (result.certificate_name_mismatch) {
    guidance.push_back(
        "Correct the public certificate name coverage or inspect the "
        "intended host, then record a new explicit inspection.");
  } else if (result.certificate_expired) {
    guidance.push_back(
        "Renew or replace the expired certificate, then inspect the public "
        "endpoint again.");
  } else if (result.tls_info_available &&
             result.certificate_days_remaining >= 0 &&
             result.certificate_days_remaining <= 14) {
    guidance.push_back(
        "Plan certificate renewal soon and re-inspect after the change is "
        "deployed.");
  } else if (!result.tls_info_available || !result.certificate_valid) {
    guidance.push_back(
        "Review Chromium certificate diagnostics before relying on this "
        "endpoint.");
  }
  if (guidance.empty()) {
    guidance.push_back(
        "No immediate deterministic escalation was derived. Review the typed "
        "inspection details and record any follow-up explicitly.");
  }
  return guidance;
}

}  // namespace tahai
