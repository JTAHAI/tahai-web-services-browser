// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PACK_MANIFEST_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PACK_MANIFEST_H_

#include <string>
#include <vector>

#include "base/values.h"

namespace tahai {

// TAHAI Packs extend operational vocabulary, never the browser's authority.
// The manifest has no code, script, connector, executable, credential, or
// filesystem field. A separate signed-package verifier must validate the
// package bytes before an accepted manifest can be installed.
enum class TahaiPackCapability {
  kMode,
  kMissionRecipe,
  kAdminConsoleProfile,
  kRunbookTemplate,
  kSafeDomainCatalog,
  kOpsToolDefinition,
  kEvidenceTemplate,
  kCommandCenterEntry,
  kExportTemplate,
  kManagedPolicyPreset,
};

struct TahaiPackManifest {
  int schema_version = 1;
  std::string id;
  std::string name;
  std::string signing_key_id;
  std::vector<TahaiPackCapability> capabilities;
  // Canonical HTTPS origins only. No wildcard, path, query, fragment, or
  // embedded credential is retained in the approved manifest.
  std::vector<std::string> allowed_origins;
};

enum class TahaiPackManifestValidationResult {
  kValid,
  kUnknownField,
  kInvalidSchema,
  kInvalidIdentifier,
  kInvalidName,
  kInvalidSigningKey,
  kInvalidCapabilities,
  kInvalidOrigins,
};

// Parses only a strict declarative manifest. `parsed_manifest` is reset on
// every failure, so callers cannot accidentally use a partly accepted pack.
TahaiPackManifestValidationResult ValidateTahaiPackManifest(
    const base::DictValue& manifest,
    TahaiPackManifest* parsed_manifest);

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_PACK_MANIFEST_H_
