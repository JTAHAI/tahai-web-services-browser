// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_redactor.h"

#include <array>
#include <string>

#include "base/strings/string_util.h"

namespace tahai {

LocalOiRedactionResult RedactLocalOiExportText(std::string_view text) {
  LocalOiRedactionResult result;
  result.text = std::string(text);
  const std::array<std::string_view, 12> forbidden = {
      "authorization:", "bearer ",      "basic ",        "set-cookie:",
      "cookie:",        "access_token", "refresh_token", "api_key",
      "client_secret",  "password=",    "session=",      "oauth"};
  const std::string lowered = base::ToLowerASCII(result.text);
  for (std::string_view marker : forbidden) {
    if (lowered.find(marker) != std::string::npos) {
      result.blocked = true;
      ++result.redaction_count;
    }
  }
  if (result.blocked) {
    result.text = "[Local OI export blocked: sensitive material was detected.]";
  }
  return result;
}

}  // namespace tahai
