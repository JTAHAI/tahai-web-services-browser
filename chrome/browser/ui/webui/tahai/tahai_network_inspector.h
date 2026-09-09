// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_NETWORK_INSPECTOR_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_NETWORK_INSPECTOR_H_

#include <cstdint>
#include <string>
#include <string_view>
#include <vector>

#include "base/functional/callback_forward.h"

class Profile;

namespace tahai {

// A result from one explicit, user-initiated support inspection. It contains
// DNS and TLS transport metadata plus presence-only observations from a fixed
// public HTTP security-header vocabulary for the supplied host. No URL path,
// request body, cookies, browser storage, authorization header, response body,
// or response-header value is collected or persisted.
struct TahaiNetworkInspectionResult {
  std::string host;
  std::vector<std::string> resolved_addresses;
  std::vector<std::string> dns_aliases;
  // Aggregate-only DNS topology metadata for Local OI retention. These counts
  // are bounded by the inspector and contain no address or alias values.
  int resolved_ipv4_count = 0;
  int resolved_ipv6_count = 0;
  int dns_alias_count = 0;
  int dns_net_error = 0;
  int request_net_error = 0;
  bool target_rejected = false;
  bool public_address_guard_blocked = false;
  int http_status = 0;
  // These are observations of a fixed, public response-header vocabulary from
  // the one explicit credential-free HEAD response. Header values are never
  // retained. They do not claim an authenticated or browser-wide posture.
  bool security_header_observation_available = false;
  bool strict_transport_security_observed = false;
  bool content_security_policy_observed = false;
  bool x_content_type_options_observed = false;
  bool x_frame_options_observed = false;
  bool referrer_policy_observed = false;
  bool permissions_policy_observed = false;
  int observed_security_header_count = 0;
  bool tls_info_available = false;
  bool certificate_valid = false;
  bool issued_by_known_root = false;
  int certificate_status = 0;
  // Fixed certificate failure classes derived from Chromium's certificate
  // status flags. They carry no certificate name, chain, or error detail.
  bool certificate_name_mismatch = false;
  bool certificate_authority_invalid = false;
  bool certificate_revoked = false;
  std::string certificate_subject;
  std::string certificate_issuer;
  std::string certificate_expiry;
  int certificate_days_remaining = -1;
  bool certificate_expired = false;
  std::vector<std::string> subject_alt_names;
  std::string tls_version;
  std::string cipher_suite;
  int elapsed_milliseconds = 0;
  std::string inspected_at;
};

// A strict public-host-only validator. It accepts fully qualified public DNS
// host names and dotted IPv4 literals but deliberately rejects bare labels,
// schemes, ports, paths, queries, credentials, loopback/private/reserved
// literal addresses, local host-name suffixes, control characters, and
// non-ASCII input. The resulting HTTPS probe always targets port 443 with
// credentials omitted and redirects disabled.
bool IsValidTahaiNetworkInspectionHost(std::string_view host);

// Production loader options shared with regression coverage. The connection-
// time local-address block is mandatory even after a public DNS preflight.
int32_t GetTahaiNetworkInspectionURLLoadOptions();

class TahaiNetworkInspector {
 public:
  using CompletionCallback =
      base::OnceCallback<void(TahaiNetworkInspectionResult)>;

  TahaiNetworkInspector() = delete;

  // Starts a bounded DNS + TLS inspection with a presence-only fixed-header
  // observation for one user-supplied host. The caller owns presentation and
  // any deliberate Local OI persistence; this helper never creates a watch,
  // schedules a retry, or communicates with a hosted TAHAI service.
  static void Inspect(Profile* profile,
                      std::string_view host,
                      CompletionCallback callback);
};

// Builds an explicit clipboard handoff from typed result fields only. It omits
// address and alias values, certificate names, response-header values and
// bodies,
// cookies, credentials, browser data, and all page content. Bounded aggregate
// DNS family counts may be included.
std::string BuildTahaiNetworkInspectionSafeSummary(
    const TahaiNetworkInspectionResult& result,
    bool recorded_locally);

// Produces a compact, deterministic, display-only support checklist from a
// completed inspection's typed outcome. It never names the target, address,
// alias, certificate, header, body, credential, cookie, or browser data, and
// it does not persist, copy, schedule, or rerun an inspection.
std::vector<std::string> BuildTahaiNetworkInspectionGuidance(
    const TahaiNetworkInspectionResult& result);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_NETWORK_INSPECTOR_H_
