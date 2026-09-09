// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/services/tahai_guard/domain_resolver.h"

#include <string>
#include <string_view>

#include "net/base/registry_controlled_domains/registry_controlled_domain.h"

namespace tahai::guard {

size_t RegistrableDomainStart(rust::Str host) {
  const std::string_view name(host.data(), host.size());
  // Request and list parsers can both call this resolver. Bound it
  // independently of the caller and never return an offset outside the original
  // UTF-8 input.
  if (name.empty() || name.size() > 253) {
    return 0;
  }
  const std::string domain =
      net::registry_controlled_domains::GetDomainAndRegistry(
          name, net::registry_controlled_domains::INCLUDE_PRIVATE_REGISTRIES);
  if (domain.empty() || !name.ends_with(domain)) {
    return 0;
  }
  return name.size() - domain.size();
}

}  // namespace tahai::guard
