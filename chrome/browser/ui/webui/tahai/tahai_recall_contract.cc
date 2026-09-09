// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_recall_contract.h"

namespace tahai {

std::optional<std::string_view> TahaiRecallScopeToLocalOiKind(
    std::string_view scope) {
  if (scope == "all") {
    return "all";
  }
  if (scope == "mission") {
    return "mission";
  }
  if (scope == "finding") {
    return "finding";
  }
  if (scope == "endpoint") {
    return "endpoint";
  }
  if (scope == "artifact") {
    return "artifact";
  }
  if (scope == "reference") {
    return "document_reference";
  }
  if (scope == "tool") {
    return "tool_result";
  }
  if (scope == "watch") {
    return "watch";
  }
  if (scope == "memory") {
    return "memory";
  }
  return std::nullopt;
}

}  // namespace tahai
