// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_skin_studio_draft.h"

#include <optional>
#include <utility>

#include "base/check.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/version_info/version_info.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"
#include "components/prefs/pref_service.h"

namespace tahai {
namespace {

constexpr char kManifestJsonKey[] = "manifest_json";

constexpr char kDefaultDraft[] = R"TAHAI({
  "schema_version": 2,
  "id": "my-operational-skin",
  "name": "My Operational Skin",
  "creator": "Local author",
  "license": "BSD-3-Clause",
  "compatibility": {
    "min_chromium_major": 154,
    "max_chromium_major": 154
  },
  "appearance": {
    "density": "comfortable",
    "reduced_motion": false,
    "light_tokens": {
      "shell_background": "#f6f3fc", "toolbar_background": "#ffffff",
      "toolbar_foreground": "#1b092e", "tab_background": "#eee6fa",
      "tab_foreground": "#1b092e", "rail_background": "#6e4aaf",
      "rail_foreground": "#ffffff", "accent": "#6e4aaf",
      "panel_background": "#ffffff", "panel_foreground": "#1b092e"
    },
    "dark_tokens": {
      "shell_background": "#07050e", "toolbar_background": "#090612",
      "toolbar_foreground": "#f6f8ff", "tab_background": "#171026",
      "tab_foreground": "#f6f8ff", "rail_background": "#100a1b",
      "rail_foreground": "#d9e0f2", "accent": "#c4a5ff",
      "panel_background": "#100a1b", "panel_foreground": "#f6f8ff"
    },
    "high_contrast_tokens": {
      "shell_background": "#000000", "toolbar_background": "#000000",
      "toolbar_foreground": "#ffffff", "tab_background": "#000000",
      "tab_foreground": "#ffffff", "rail_background": "#000000",
      "rail_foreground": "#ffffff", "accent": "#00ffff",
      "panel_background": "#000000", "panel_foreground": "#ffffff"
    }
  },
  "assets": [{
    "path": "assets/preview.png",
    "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    "purpose": "preview"
  }],
  "operational": {
    "capabilities": ["workspace-layout", "mission-checklist", "guard-control"],
    "surfaces": [{
      "id": "my-workspace", "layout": "dual", "rail_state": "expanded",
      "start_surface": "mission", "rail_modules": ["mission", "local-oi", "guard"]
    }],
    "workflows": [{
      "id": "my-checklist", "name": "My local checklist",
      "steps": [{"id": "review", "name": "Review before acting", "kind": "checkpoint"}]
    }],
    "modes": [{
      "id": "my-mode", "name": "My mode", "surface": "my-workspace",
      "workflow": "my-checklist", "actions": ["layout.dual", "mission.open"]
    }]
  }
})TAHAI";

TahaiSkinStudioDraftResult ValidateAndCanonicalize(std::string manifest_json) {
  if (manifest_json.empty() || manifest_json.size() > skins::kMaxManifestBytes) {
    return {TahaiSkinStudioDraftStatus::kTooLarge, {}};
  }
  auto value = base::JSONReader::ReadAndReturnValueWithError(
      manifest_json, base::JSON_PARSE_RFC);
  TahaiOperationalSkinManifest parsed;
  if (!value) {
    return {TahaiSkinStudioDraftStatus::kInvalidJson, {}, "syntax",
            value.error().line, value.error().column};
  }
  if (!value->is_dict()) {
    return {TahaiSkinStudioDraftStatus::kInvalidManifest, {}, "root-object"};
  }
  const auto validation =
      ValidateTahaiOperationalSkinManifest(value->GetDict(), &parsed);
  if (validation != TahaiOperationalSkinManifestValidationResult::kValid) {
    std::string diagnostic;
    switch (validation) {
      case TahaiOperationalSkinManifestValidationResult::kValid:
        break;
      case TahaiOperationalSkinManifestValidationResult::kUnknownField:
        diagnostic = "unknown-field";
        break;
      case TahaiOperationalSkinManifestValidationResult::kInvalidSchema:
        diagnostic = "schema";
        break;
      case TahaiOperationalSkinManifestValidationResult::kInvalidAppearance:
        diagnostic = "appearance";
        break;
      case TahaiOperationalSkinManifestValidationResult::kInvalidCapabilities:
        diagnostic = "capabilities";
        break;
      case TahaiOperationalSkinManifestValidationResult::kInvalidSurface:
        diagnostic = "surface";
        break;
      case TahaiOperationalSkinManifestValidationResult::kInvalidWorkflow:
        diagnostic = "workflow";
        break;
      case TahaiOperationalSkinManifestValidationResult::kInvalidMode:
        diagnostic = "mode";
        break;
    }
    return {TahaiSkinStudioDraftStatus::kInvalidManifest, {},
            std::move(diagnostic)};
  }
  std::string canonical;
  if (!base::JSONWriter::WriteWithOptions(
          *value, base::JSONWriter::OPTIONS_PRETTY_PRINT, &canonical)) {
    return {TahaiSkinStudioDraftStatus::kInvalidJson, {}};
  }
  // The persisted/exported representation must satisfy the same byte budget
  // as the next load. Formatting a compact source can otherwise turn a
  // successful save into an unreadable draft on restart.
  if (canonical.empty() || canonical.size() > skins::kMaxManifestBytes) {
    return {TahaiSkinStudioDraftStatus::kTooLarge, {}};
  }
  return {TahaiSkinStudioDraftStatus::kOk, std::move(canonical)};
}

}  // namespace

std::string GetTahaiSkinStudioDefaultDraft() {
  // Only a new browser-owned draft targets the running engine. Never widen a
  // saved/imported author's compatibility range or rewrite a signed package.
  auto draft = base::JSONReader::ReadDict(kDefaultDraft, base::JSON_PARSE_RFC);
  CHECK(draft);
  auto* compatibility = draft->FindDict("compatibility");
  CHECK(compatibility);
  const int major = version_info::GetMajorVersionNumberAsInt();
  compatibility->Set("min_chromium_major", major);
  compatibility->Set("max_chromium_major", major);
  auto encoded = base::WriteJson(*draft);
  CHECK(encoded);
  return std::move(*encoded);
}

TahaiSkinStudioDraftResult LoadTahaiSkinStudioDraft(PrefService* prefs) {
  if (!prefs) {
    return {TahaiSkinStudioDraftStatus::kUnavailable, {}};
  }
  const std::string* saved =
      prefs->GetDict(prefs::kTahaiSkinStudioDraft).FindString(kManifestJsonKey);
  TahaiSkinStudioDraftResult result =
      ValidateAndCanonicalize(saved ? *saved : GetTahaiSkinStudioDefaultDraft());
  if (result.status != TahaiSkinStudioDraftStatus::kOk) {
    result = ValidateAndCanonicalize(GetTahaiSkinStudioDefaultDraft());
  }
  if (prefs->IsManagedPreference(prefs::kTahaiSkinStudioDraft)) {
    result.status = TahaiSkinStudioDraftStatus::kManaged;
  }
  return result;
}

TahaiSkinStudioDraftResult SaveTahaiSkinStudioDraft(
    PrefService* prefs,
    std::string manifest_json) {
  if (!prefs) {
    return {TahaiSkinStudioDraftStatus::kUnavailable, {}};
  }
  if (prefs->IsManagedPreference(prefs::kTahaiSkinStudioDraft)) {
    TahaiSkinStudioDraftResult result = LoadTahaiSkinStudioDraft(prefs);
    result.status = TahaiSkinStudioDraftStatus::kManaged;
    return result;
  }
  TahaiSkinStudioDraftResult result =
      ValidateAndCanonicalize(std::move(manifest_json));
  if (result.status != TahaiSkinStudioDraftStatus::kOk) {
    return result;
  }
  prefs->SetDict(prefs::kTahaiSkinStudioDraft,
                 base::DictValue().Set(kManifestJsonKey, result.manifest_json));
  return result;
}

}  // namespace tahai
