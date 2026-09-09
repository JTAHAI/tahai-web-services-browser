// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_skin_selection.h"

#include <algorithm>
#include <array>
#include <optional>
#include <string_view>
#include <utility>

#include "chrome/browser/ui/webui/tahai/tahai_skin_catalog.h"

namespace tahai {
namespace {

constexpr int kTahaiSkinSelectionSchemaVersion = 1;
constexpr std::array<std::string_view, 3> kSelectionFields = {
    "schema_version", "profile_skin_id", "mode_skins"};
constexpr std::array<std::string_view, 6> kWorkModes = {
    "daily", "creator", "builder", "operator", "research", "support"};

bool IsKnownWorkMode(std::string_view mode_id) {
  return std::find(kWorkModes.begin(), kWorkModes.end(), mode_id) !=
         kWorkModes.end();
}

}  // namespace

TahaiSkinSelectionValidationResult ValidateTahaiSkinSelection(
    const base::DictValue& value,
    TahaiSkinSelection* parsed_selection) {
  if (!parsed_selection) {
    return TahaiSkinSelectionValidationResult::kInvalidSchema;
  }
  *parsed_selection = TahaiSkinSelection();
  if (value.size() != kSelectionFields.size() ||
      !std::all_of(value.begin(), value.end(), [](const auto& field) {
        return std::find(kSelectionFields.begin(), kSelectionFields.end(),
                         field.first) != kSelectionFields.end();
      })) {
    return TahaiSkinSelectionValidationResult::kUnknownField;
  }
  const std::optional<int> schema_version = value.FindInt("schema_version");
  const std::string* profile_skin_id = value.FindString("profile_skin_id");
  const base::DictValue* mode_skins = value.FindDict("mode_skins");
  if (!schema_version || *schema_version != kTahaiSkinSelectionSchemaVersion ||
      !profile_skin_id || !mode_skins) {
    return TahaiSkinSelectionValidationResult::kInvalidSchema;
  }
  if (!IsTahaiBuiltInSkinId(*profile_skin_id)) {
    return TahaiSkinSelectionValidationResult::kInvalidSkinId;
  }
  TahaiSkinSelection candidate;
  candidate.profile_skin_id = *profile_skin_id;
  for (const auto mode_skin : *mode_skins) {
    const std::string* skin_id = mode_skin.second.GetIfString();
    if (!IsKnownWorkMode(mode_skin.first) || !skin_id ||
        !IsTahaiBuiltInSkinId(*skin_id)) {
      return TahaiSkinSelectionValidationResult::kInvalidModeSelections;
    }
    candidate.mode_selections.push_back({mode_skin.first, *skin_id});
  }
  *parsed_selection = std::move(candidate);
  return TahaiSkinSelectionValidationResult::kValid;
}

std::string_view ResolveTahaiSkinIdForMode(const TahaiSkinSelection& selection,
                                           std::string_view mode_id) {
  const auto mode_selection = std::find_if(
      selection.mode_selections.begin(), selection.mode_selections.end(),
      [mode_id](const TahaiSkinModeSelection& candidate) {
        return candidate.mode_id == mode_id;
      });
  if (IsKnownWorkMode(mode_id) &&
      mode_selection != selection.mode_selections.end() &&
      IsTahaiBuiltInSkinId(mode_selection->skin_id)) {
    return mode_selection->skin_id;
  }
  return IsTahaiBuiltInSkinId(selection.profile_skin_id)
             ? std::string_view(selection.profile_skin_id)
             : std::string_view("stock");
}

}  // namespace tahai
