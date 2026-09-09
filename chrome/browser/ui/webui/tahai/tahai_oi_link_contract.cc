// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_oi_link_contract.h"

#include <algorithm>
#include <string_view>

#include "base/strings/string_util.h"

namespace tahai {

bool IsValidTahaiOiOpaqueReference(std::string_view reference) {
  if (reference.size() < 8u || reference.size() > 128u ||
      !base::StartsWith(reference, "oi_", base::CompareCase::SENSITIVE)) {
    return false;
  }
  return std::all_of(reference.begin(), reference.end(),
                     [](unsigned char character) {
                       return base::IsAsciiLower(character) ||
                              base::IsAsciiDigit(character) || character == '_';
                     });
}

bool IsValidTahaiOiHostedDeepLink(const GURL& url) {
  return url.is_valid() && url.SchemeIs("https") &&
         url.host() == "ops.tahaiportal.com" && !url.has_username() &&
         !url.has_password() && !url.has_query() && !url.has_ref() &&
         (url.path() == "/" ||
          base::StartsWith(url.path(), "/oi/",
                           base::CompareCase::SENSITIVE));
}

bool IsValidTahaiOiLink(const TahaiOiLink& link) {
  return IsValidTahaiOiOpaqueReference(link.opaque_reference) &&
         (link.hosted_deep_link.is_empty() ||
          IsValidTahaiOiHostedDeepLink(link.hosted_deep_link));
}

}  // namespace tahai
