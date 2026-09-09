// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_SERVICES_TAHAI_GUARD_DOMAIN_RESOLVER_H_
#define CHROME_SERVICES_TAHAI_GUARD_DOMAIN_RESOLVER_H_

#include <cstddef>

#include "third_party/rust/cxx/v1/cxx.h"

namespace tahai::guard {

// Byte offset of eTLD+1 using Chromium's built-in PSL, including private
// registries. No network or disk lookup. Zero means use the complete host.
size_t RegistrableDomainStart(rust::Str host);

}  // namespace tahai::guard

#endif  // CHROME_SERVICES_TAHAI_GUARD_DOMAIN_RESOLVER_H_
