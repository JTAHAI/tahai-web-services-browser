// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_REDACTOR_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_REDACTOR_H_

#include <cstddef>
#include <string>
#include <string_view>

namespace tahai {

struct LocalOiRedactionResult {
  std::string text;
  size_t redaction_count = 0;
  bool blocked = false;
};

// A narrow last-line safeguard for explicit Local OI copy/export. Typed record
// validation remains the primary boundary; this rejects or removes obvious
// credentials, session material, authorization data, and credentialed URLs.
LocalOiRedactionResult RedactLocalOiExportText(std::string_view text);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_LOCAL_OI_REDACTOR_H_
