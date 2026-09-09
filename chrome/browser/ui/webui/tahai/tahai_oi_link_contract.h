// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_OI_LINK_CONTRACT_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_OI_LINK_CONTRACT_H_

#include <string>
#include <string_view>

#include "url/gurl.h"

namespace tahai {

// `links.oi` is a deliberately narrow future promotion seam. It can identify
// an already-authorized hosted record without carrying a tenant identifier,
// access token, browser data, account data, or a user-provided URL. The local
// browser neither creates nor follows these references today.
struct TahaiOiLink {
  std::string opaque_reference;
  GURL hosted_deep_link;
};

// Opaque references are generated outside the browser and must not embed a
// customer, tenant, mission title, credential, or arbitrary free-form value.
bool IsValidTahaiOiOpaqueReference(std::string_view reference);

// Only the fixed Operational Intelligence host and a path-only deep link are
// permitted. Query strings, fragments, credentials, and alternate origins are
// rejected so the URL cannot become a data transfer channel.
bool IsValidTahaiOiHostedDeepLink(const GURL& url);

// A valid `links.oi` record requires an opaque reference. A deep link is
// optional, but when retained it must pass the fixed-origin validation above.
bool IsValidTahaiOiLink(const TahaiOiLink& link);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_OI_LINK_CONTRACT_H_
