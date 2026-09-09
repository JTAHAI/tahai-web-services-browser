// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_GUARD_CSS_H_
#define CHROME_COMMON_TAHAI_GUARD_CSS_H_

#include <string>
#include <string_view>
#include <vector>

namespace tahai::guard {

inline constexpr size_t kMaxCosmeticSelectors = 16384;
inline constexpr size_t kMaxCosmeticBytes = 512 * 1024;

// Only selectors cross this boundary; the renderer supplies the single fixed
// display declaration. Reject CSS rule/at-rule/comment/escape injection even
// if the sandboxed parser returns compromised data.
inline bool IsSafeCosmeticSelector(std::string_view selector) {
  if (selector.empty() || selector.size() > 2048 || selector.contains("/*") ||
      selector.contains("*/")) {
    return false;
  }
  for (unsigned char c : selector) {
    if (c < 32 || c == 127 || c == '{' || c == '}' || c == ';' || c == '@' ||
        c == '\\') {
      return false;
    }
  }
  return true;
}

inline bool AreSafeCosmeticSelectors(
    const std::vector<std::string>& selectors) {
  if (selectors.size() > kMaxCosmeticSelectors) {
    return false;
  }
  size_t bytes = 0;
  for (const auto& selector : selectors) {
    if (!IsSafeCosmeticSelector(selector) ||
        selector.size() > kMaxCosmeticBytes - bytes) {
      return false;
    }
    bytes += selector.size();
  }
  return true;
}

}  // namespace tahai::guard
#endif  // CHROME_COMMON_TAHAI_GUARD_CSS_H_
