// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_pack_manifest.h"

#include <algorithm>
#include <array>
#include <optional>
#include <string_view>
#include <utility>

#include "url/gurl.h"

namespace tahai {
namespace {

constexpr int kTahaiPackSchemaVersion = 1;
constexpr size_t kMaximumCapabilities = 10u;
constexpr size_t kMaximumOrigins = 32u;

constexpr std::array<std::string_view, 6> kManifestFields = {
    "schema_version", "id",           "name",
    "signing_key_id", "capabilities", "allowed_origins"};

constexpr std::array<std::pair<std::string_view, TahaiPackCapability>, 10>
    kCapabilityNames = {{
        {"mode", TahaiPackCapability::kMode},
        {"mission-recipe", TahaiPackCapability::kMissionRecipe},
        {"admin-console-profile", TahaiPackCapability::kAdminConsoleProfile},
        {"runbook-template", TahaiPackCapability::kRunbookTemplate},
        {"safe-domain-catalog", TahaiPackCapability::kSafeDomainCatalog},
        {"ops-tool-definition", TahaiPackCapability::kOpsToolDefinition},
        {"evidence-template", TahaiPackCapability::kEvidenceTemplate},
        {"command-center-entry", TahaiPackCapability::kCommandCenterEntry},
        {"export-template", TahaiPackCapability::kExportTemplate},
        {"managed-policy-preset", TahaiPackCapability::kManagedPolicyPreset},
    }};

bool IsSafeIdentifier(std::string_view value) {
  if (value.empty() || value.size() > 64u || value.front() == '-' ||
      value.back() == '-') {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return (character >= 'a' && character <= 'z') ||
           (character >= '0' && character <= '9') || character == '-';
  });
}

bool IsSafeName(std::string_view value) {
  if (value.empty() || value.size() > 128u) {
    return false;
  }
  return std::all_of(value.begin(), value.end(), [](char character) {
    return character >= 0x20 && character <= 0x7e && character != '"' &&
           character != '\\';
  });
}

const TahaiPackCapability* FindCapability(std::string_view name) {
  const auto found = std::find_if(
      kCapabilityNames.begin(), kCapabilityNames.end(),
      [name](const auto& candidate) { return candidate.first == name; });
  return found == kCapabilityNames.end() ? nullptr : &found->second;
}

bool IsExactHttpsOrigin(std::string_view value, std::string* canonical_origin) {
  GURL origin{std::string(value)};
  if (!origin.is_valid() || !origin.SchemeIs("https") || !origin.has_host() ||
      origin.has_username() || origin.has_password() || origin.has_query() ||
      origin.has_ref() || origin.path() != "/") {
    return false;
  }
  const std::string canonical = origin.DeprecatedGetOriginAsURL().spec();
  if (canonical != origin.spec()) {
    return false;
  }
  *canonical_origin = canonical;
  return true;
}

}  // namespace

TahaiPackManifestValidationResult ValidateTahaiPackManifest(
    const base::DictValue& manifest,
    TahaiPackManifest* parsed_manifest) {
  if (!parsed_manifest) {
    return TahaiPackManifestValidationResult::kInvalidSchema;
  }
  *parsed_manifest = TahaiPackManifest();

  for (const auto field : manifest) {
    if (std::find(kManifestFields.begin(), kManifestFields.end(),
                  field.first) == kManifestFields.end()) {
      return TahaiPackManifestValidationResult::kUnknownField;
    }
  }

  const std::optional<int> schema_version = manifest.FindInt("schema_version");
  const std::string* id = manifest.FindString("id");
  const std::string* name = manifest.FindString("name");
  const std::string* signing_key_id = manifest.FindString("signing_key_id");
  const base::ListValue* capabilities = manifest.FindList("capabilities");
  const base::ListValue* allowed_origins = manifest.FindList("allowed_origins");
  if (!schema_version || *schema_version != kTahaiPackSchemaVersion || !id ||
      !name || !signing_key_id || !capabilities || !allowed_origins) {
    return TahaiPackManifestValidationResult::kInvalidSchema;
  }
  if (!IsSafeIdentifier(*id)) {
    return TahaiPackManifestValidationResult::kInvalidIdentifier;
  }
  if (!IsSafeName(*name)) {
    return TahaiPackManifestValidationResult::kInvalidName;
  }
  if (!IsSafeIdentifier(*signing_key_id)) {
    return TahaiPackManifestValidationResult::kInvalidSigningKey;
  }
  if (capabilities->empty() || capabilities->size() > kMaximumCapabilities) {
    return TahaiPackManifestValidationResult::kInvalidCapabilities;
  }

  TahaiPackManifest candidate;
  candidate.id = *id;
  candidate.name = *name;
  candidate.signing_key_id = *signing_key_id;
  for (const base::Value& value : *capabilities) {
    const std::string* capability_name = value.GetIfString();
    const TahaiPackCapability* capability =
        capability_name ? FindCapability(*capability_name) : nullptr;
    if (!capability ||
        std::find(candidate.capabilities.begin(), candidate.capabilities.end(),
                  *capability) != candidate.capabilities.end()) {
      return TahaiPackManifestValidationResult::kInvalidCapabilities;
    }
    candidate.capabilities.push_back(*capability);
  }

  if (allowed_origins->empty() || allowed_origins->size() > kMaximumOrigins) {
    return TahaiPackManifestValidationResult::kInvalidOrigins;
  }
  for (const base::Value& value : *allowed_origins) {
    const std::string* origin = value.GetIfString();
    std::string canonical_origin;
    if (!origin || !IsExactHttpsOrigin(*origin, &canonical_origin) ||
        std::find(candidate.allowed_origins.begin(),
                  candidate.allowed_origins.end(),
                  canonical_origin) != candidate.allowed_origins.end()) {
      return TahaiPackManifestValidationResult::kInvalidOrigins;
    }
    candidate.allowed_origins.push_back(std::move(canonical_origin));
  }

  *parsed_manifest = std::move(candidate);
  return TahaiPackManifestValidationResult::kValid;
}

}  // namespace tahai
