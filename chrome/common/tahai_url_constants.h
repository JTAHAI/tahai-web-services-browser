// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_URL_CONSTANTS_H_
#define CHROME_COMMON_TAHAI_URL_CONSTANTS_H_

namespace tahai {

// TAHAI's public URLs are product-owned aliases. BrowserURLHandler rewrites
// them to the trusted Chrome WebUI host below while preserving the public URL
// in the location bar. The custom scheme never receives a URL loader, WebUI
// bindings, or independent privileges; execution stays on chrome://tahai so
// Chromium's normal WebUI process, CSP, and loader enforcement remain intact.
inline constexpr char kTahaiScheme[] = "tahai";
inline constexpr char kTahaiChromeHost[] = "tahai";

inline constexpr char kTahaiNewTabURL[] = "tahai://home/";
inline constexpr char kTahaiMissionURL[] = "tahai://mission/";
inline constexpr char kTahaiOpsToolsURL[] = "tahai://commands/";
inline constexpr char kTahaiProfilesURL[] = "tahai://profiles/";
inline constexpr char kTahaiSupportURL[] = "tahai://support/";
inline constexpr char kTahaiPolicyURL[] = "tahai://policy/";
inline constexpr char kTahaiModesURL[] = "tahai://modes/";
inline constexpr char kTahaiLocalOiURL[] = "tahai://local-oi/";

inline constexpr char kTahaiTrustedNewTabURL[] = "chrome://tahai/";
inline constexpr char kTahaiTrustedMissionURL[] = "chrome://tahai/mission/";
inline constexpr char kTahaiTrustedOpsToolsURL[] = "chrome://tahai/ops-tools/";
inline constexpr char kTahaiTrustedProfilesURL[] = "chrome://tahai/profiles/";
inline constexpr char kTahaiTrustedSupportURL[] = "chrome://tahai/support/";
inline constexpr char kTahaiTrustedPolicyURL[] = "chrome://tahai/policy/";
inline constexpr char kTahaiTrustedModesURL[] = "chrome://tahai/modes/";
inline constexpr char kTahaiTrustedLocalOiURL[] = "chrome://tahai/local-oi/";

}  // namespace tahai

#endif  // CHROME_COMMON_TAHAI_URL_CONSTANTS_H_
