// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_skin_selection_registry.h"

#include <optional>
#include <utility>

#include "chrome/browser/profiles/profile.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"

namespace tahai {
namespace {

constexpr int kTahaiSkinSelectionSchemaVersion = 1;

std::optional<base::DictValue> SerializeTahaiSkinSelection(
    const TahaiSkinSelection& selection) {
  base::DictValue value;
  value.Set("schema_version", kTahaiSkinSelectionSchemaVersion);
  value.Set("profile_skin_id", selection.profile_skin_id);
  base::DictValue mode_skins;
  for (const TahaiSkinModeSelection& mode_selection :
       selection.mode_selections) {
    if (mode_skins.contains(mode_selection.mode_id)) {
      return std::nullopt;
    }
    mode_skins.Set(mode_selection.mode_id, mode_selection.skin_id);
  }
  value.Set("mode_skins", std::move(mode_skins));
  return value;
}

}  // namespace

TahaiSkinSelection GetTahaiSkinSelection(const PrefService* prefs) {
  TahaiSkinSelection selection;
  if (!prefs) {
    return selection;
  }
  TahaiSkinSelection parsed;
  if (ValidateTahaiSkinSelection(prefs->GetDict(prefs::kTahaiSkinSelection),
                                 &parsed) ==
      TahaiSkinSelectionValidationResult::kValid) {
    return parsed;
  }
  return selection;
}

TahaiSkinSelection GetTahaiSkinSelectionForProfile(const Profile* profile) {
  if (!profile || profile->IsOffTheRecord()) {
    return TahaiSkinSelection();
  }
  return GetTahaiSkinSelection(profile->GetPrefs());
}

bool SetTahaiSkinSelection(PrefService* prefs,
                           const TahaiSkinSelection& selection) {
  if (!prefs || prefs->IsManagedPreference(prefs::kTahaiSkinSelection)) {
    return false;
  }
  std::optional<base::DictValue> serialized =
      SerializeTahaiSkinSelection(selection);
  TahaiSkinSelection parsed;
  if (!serialized || ValidateTahaiSkinSelection(*serialized, &parsed) !=
                         TahaiSkinSelectionValidationResult::kValid) {
    return false;
  }
  prefs->SetDict(prefs::kTahaiSkinSelection, std::move(*serialized));
  return true;
}

bool SetTahaiSkinSelectionForProfile(Profile* profile,
                                     const TahaiSkinSelection& selection) {
  return profile && !profile->IsOffTheRecord() &&
         SetTahaiSkinSelection(profile->GetPrefs(), selection);
}

}  // namespace tahai
