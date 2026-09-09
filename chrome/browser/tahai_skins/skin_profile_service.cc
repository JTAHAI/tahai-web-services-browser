// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/skin_profile_service.h"

#include <algorithm>
#include <utility>

#include "base/auto_reset.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/location.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/stringprintf.h"
#include "base/task/thread_pool.h"
#include "base/uuid.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/themes/theme_service_factory.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"
#include "components/prefs/pref_service.h"
#include "components/version_info/version_info.h"
#include "content/public/browser/browser_thread.h"
#include "ui/base/mojom/themes.mojom.h"

namespace tahai::skins {
namespace {

SkinOperationResult Result(SkinOperationStatus status) {
  return {status, std::nullopt, std::nullopt, {}, {}};
}

scoped_refptr<SkinColorSupplier> PaletteForSkin(const DecodedSkin& skin) {
  SkBitmap decoration;
  for (const auto& asset : skin.manifest.assets) {
    if (asset.purpose == TahaiSkinAssetPurpose::kShellDecoration) {
      const auto found =
          std::ranges::find(skin.assets, asset.path, &DecodedSkinAsset::path);
      if (found != skin.assets.end()) {
        decoration = found->bitmap;
        break;
      }
    }
  }
  return base::MakeRefCounted<SkinColorSupplier>(skin.manifest.appearance,
                                                 decoration);
}

std::optional<SkColor> ParseColor(std::string_view encoded) {
  uint32_t rgb = 0;
  if (encoded.size() != 6 || !base::HexStringToUInt(encoded, &rgb)) {
    return std::nullopt;
  }
  return SkColorSetRGB((rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff);
}

std::optional<std::string> ReadChosenLocalArchive(base::FilePath path) {
  // The native chooser supplies a local absolute file, not a URL, UNC share or
  // device path. Never fetch anything from a manifest or extracted member.
  if (!path.IsAbsolute() || path.ReferencesParent() ||
      path.value().starts_with(L"\\\\") || path.value().starts_with(L"//")) {
    return std::nullopt;
  }
  std::string archive;
  if (!base::ReadFileToStringWithMaxSize(path, &archive, kMaxArchiveBytes) ||
      archive.empty()) {
    return std::nullopt;
  }
  return archive;
}

}  // namespace

SkinProfileService::SkinProfileService(Profile* profile) : profile_(profile) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  policy_registrar_.Init(profile_->GetPrefs());
  for (const char* pref :
       {prefs::kTahaiSkinsEnabled, prefs::kTahaiSkinInstallationsAllowed}) {
    policy_registrar_.Add(
        pref, base::BindRepeating(&SkinProfileService::OnPolicyChanged,
                                  base::Unretained(this)));
  }
  if (profile_->IsRegularProfile() && !profile_->IsOffTheRecord()) {
    if (auto* theme = ThemeServiceFactory::GetForProfile(profile_)) {
      theme_observation_.Observe(theme);
      const auto& applied =
          profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
      const auto* json = applied.FindString("manifest_json");
      const auto* id = applied.FindString("id");
      if (id && applied.FindInt("schema_version") == 3) {
        if (auto appearance = GetTahaiBuiltInSkinAppearance(*id)) {
          color_supplier_ =
              base::MakeRefCounted<SkinColorSupplier>(*appearance);
        }
      }
      int chromium_major = 0;
      const bool known_version = base::StringToInt(
          version_info::GetMajorVersionNumber(), &chromium_major);
      if (json && id && json->size() <= kMaxManifestBytes) {
        const auto value =
            base::JSONReader::ReadDict(*json, base::JSON_PARSE_RFC);
        TahaiSkinManifest manifest;
        if (value &&
            ValidateTahaiSkinManifest(*value, &manifest) ==
                TahaiSkinManifestValidationResult::kValid &&
            manifest.id == *id && known_version &&
            manifest.compatibility.min_chromium_major <= chromium_major &&
            manifest.compatibility.max_chromium_major >= chromium_major) {
          color_supplier_ =
              base::MakeRefCounted<SkinColorSupplier>(manifest.appearance);
        }
      }
      if (!enabled()) {
        ResetOwnedAppearance();
      } else {
        OnThemeChanged();
        // Reconcile old UI-owned removals and externally missing/corrupt stores
        // without requiring the user to reopen the manager after startup.
        if (OwnsCurrentAppearance() && applied.FindInt("schema_version") != 3) {
          const auto& selection =
              profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
          EnsureStore();
          store_.AsyncCall(&SkinPackageStore::List)
              .Then(base::BindOnce(&SkinProfileService::OnStartupCatalog,
                                   lifetime_weak_factory_.GetWeakPtr(),
                                   *selection.FindString("id"),
                                   *selection.FindString("archive_sha256")));
        }
      }
    }
  }
}

SkinProfileService::~SkinProfileService() {
  callback_.Reset();
  Shutdown();
}

bool SkinProfileService::enabled() const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return !shutdown_ && profile_->IsRegularProfile() &&
         !profile_->IsOffTheRecord() && !profile_->IsGuestSession() &&
         profile_->GetPrefs()->GetBoolean(prefs::kTahaiSkinsEnabled);
}

bool SkinProfileService::installation_allowed() const {
  return enabled() && profile_->GetPrefs()->GetBoolean(
                          prefs::kTahaiSkinInstallationsAllowed);
}

bool SkinProfileService::busy() const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return busy_;
}

base::WeakPtr<SkinProfileService> SkinProfileService::GetWeakPtr() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return lifetime_weak_factory_.GetWeakPtr();
}

bool SkinProfileService::Start(bool requires_install, Callback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!enabled() || (requires_install && !installation_allowed()) || busy_) {
    std::move(callback).Run(Result(!enabled() ? SkinOperationStatus::kDisabled
                                   : requires_install && !installation_allowed()
                                       ? SkinOperationStatus::kInstallDisallowed
                                       : SkinOperationStatus::kBusy));
    return false;
  }
  busy_ = true;
  callback_ = std::move(callback);
  return true;
}

void SkinProfileService::EnsureStore() {
  if (store_.is_null()) {
    store_.emplace(base::ThreadPool::CreateSequencedTaskRunner(
                       {base::MayBlock(), base::TaskPriority::USER_VISIBLE,
                        base::TaskShutdownBehavior::BLOCK_SHUTDOWN}),
                   profile_->GetPath());
  }
}

void SkinProfileService::List(Callback callback) {
  if (!Start(false, std::move(callback))) {
    return;
  }
  EnsureStore();
  store_.AsyncCall(&SkinPackageStore::List)
      .Then(base::BindOnce(&SkinProfileService::OnCatalog,
                           operation_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnCatalog(CatalogResult catalog) {
  if (!catalog.has_value()) {
    auto result = Result(SkinOperationStatus::kStoreFailed);
    result.store_error = catalog.error();
    Finish(std::move(result));
    return;
  }
  auto result = Result(SkinOperationStatus::kOk);
  result.catalog = std::move(*catalog);
  Finish(std::move(result));
}

void SkinProfileService::OnStartupCatalog(std::string id,
                                          std::string sha256,
                                          CatalogResult catalog) {
  const auto& applied = profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
  if (!applied.FindString("id") || *applied.FindString("id") != id ||
      !applied.FindString("archive_sha256") ||
      *applied.FindString("archive_sha256") != sha256) {
    return;
  }
  if (!catalog.has_value() ||
      !std::ranges::any_of(*catalog, [&](const auto& entry) {
        return entry.manifest.id == id && entry.archive_sha256 == sha256;
      })) {
    ResetOwnedAppearance();
    return;
  }
  store_.AsyncCall(&SkinPackageStore::Read)
      .WithArgs(id, sha256, false)
      .Then(base::BindOnce(&SkinProfileService::OnStartupArchive,
                           lifetime_weak_factory_.GetWeakPtr(), id, sha256));
}

void SkinProfileService::OnStartupArchive(std::string id,
                                          std::string sha256,
                                          ArchiveResult archive) {
  const auto& applied = profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
  if (!enabled() || !applied.FindString("archive_sha256") ||
      *applied.FindString("archive_sha256") != sha256 ||
      !OwnsCurrentAppearance()) {
    return;
  }
  if (!archive.has_value()) {
    ResetOwnedAppearance();
    return;
  }
  startup_decoder_ = std::make_unique<SkinDecodeSession>();
  startup_decoder_->Decode(
      archive->archive,
      base::BindOnce(&SkinProfileService::OnStartupDecoded,
                     lifetime_weak_factory_.GetWeakPtr(), id, sha256));
}

void SkinProfileService::OnStartupDecoded(std::string id,
                                          std::string sha256,
                                          SkinDecodeResult result) {
  startup_decoder_.reset();
  const auto& applied = profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
  if (!enabled() || !applied.FindString("id") ||
      *applied.FindString("id") != id ||
      !applied.FindString("archive_sha256") ||
      *applied.FindString("archive_sha256") != sha256 ||
      !OwnsCurrentAppearance()) {
    return;
  }
  if (result.outcome != DecodeOutcome::kDecoded || !result.skin ||
      result.skin->manifest.id != id || result.skin->archive_sha256 != sha256) {
    ResetOwnedAppearance();
    return;
  }
  base::AutoReset<bool> applying(&changing_appearance_, true);
  color_supplier_ = PaletteForSkin(*result.skin);
  theme_observation_.GetSource()->RefreshColorPalette();
}

void SkinProfileService::PreviewFile(const base::FilePath& selected_file,
                                     Callback callback) {
  if (!Start(true, std::move(callback))) {
    return;
  }
  ClearPreview();
  preview_installable_ = true;
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&ReadChosenLocalArchive, selected_file),
      base::BindOnce(&SkinProfileService::OnFileRead,
                     operation_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnFileRead(std::optional<std::string> archive) {
  if (!archive) {
    ClearPreview();
    Finish(Result(SkinOperationStatus::kReadFailed));
    return;
  }
  candidate_archive_ = std::move(*archive);
  DecodeCandidate();
}

void SkinProfileService::DecodeCandidate() {
  decoder_ = std::make_unique<SkinDecodeSession>();
  decoder_->Decode(candidate_archive_,
                   base::BindOnce(&SkinProfileService::OnDecoded,
                                  operation_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnDecoded(SkinDecodeResult decoded) {
  if (decoded.outcome != DecodeOutcome::kDecoded || !decoded.skin) {
    auto result = Result(SkinOperationStatus::kDecodeFailed);
    result.decode_error = decoded.outcome;
    ClearPreview();
    Finish(std::move(result));
    return;
  }
  // User packages cannot impersonate the immutable browser-owned recovery or
  // first-party identities. Names/creator metadata never establish trust.
  if (IsTahaiBuiltInSkinId(decoded.skin->manifest.id)) {
    ClearPreview();
    Finish(Result(SkinOperationStatus::kInvalidInput));
    return;
  }
  if (loaded_record_ &&
      (decoded.skin->manifest.id != loaded_record_->id ||
       decoded.skin->manifest_json != loaded_record_->manifest_json ||
       decoded.skin->archive_sha256 != loaded_record_->archive_sha256)) {
    ClearPreview();
    Finish(Result(SkinOperationStatus::kInvalidInput));
    return;
  }
  preview_ = std::move(decoded.skin);
  loaded_record_.reset();
  EnsureStore();
  store_.AsyncCall(&SkinPackageStore::List)
      .Then(base::BindOnce(&SkinProfileService::OnPreviewCatalog,
                           operation_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnPreviewCatalog(CatalogResult catalog) {
  if (!catalog.has_value()) {
    ClearPreview();
    OnCatalog(std::move(catalog));
    return;
  }
  const auto found = std::ranges::find(
      *catalog, preview_->manifest.id,
      [](const StoredSkinInfo& info) { return info.manifest.id; });
  if (reading_installed_) {
    if (found == catalog->end() || !expected_current_sha256_ ||
        found->archive_sha256 != *expected_current_sha256_) {
      ClearPreview();
      Finish(Result(SkinOperationStatus::kStalePreview));
      return;
    }
  } else if (found != catalog->end()) {
    expected_current_sha256_ = found->archive_sha256;
  }
  preview_token_ = base::Uuid::GenerateRandomV4().AsLowercaseString();
  auto result = Result(SkinOperationStatus::kOk);
  result.preview_token = preview_token_;
  result.catalog = std::move(*catalog);
  Finish(std::move(result));
}

void SkinProfileService::PreviewInstalled(std::string id,
                                          std::string current_sha256,
                                          bool previous,
                                          Callback callback) {
  if (!Start(previous, std::move(callback))) {
    return;
  }
  ClearPreview();
  reading_installed_ = true;
  preview_installable_ = previous;
  EnsureStore();
  store_.AsyncCall(&SkinPackageStore::List)
      .Then(base::BindOnce(&SkinProfileService::OnInstalledCatalog,
                           operation_weak_factory_.GetWeakPtr(), std::move(id),
                           std::move(current_sha256), previous));
}

void SkinProfileService::OnInstalledCatalog(std::string id,
                                            std::string current_sha256,
                                            bool previous,
                                            CatalogResult catalog) {
  if (!catalog.has_value()) {
    OnCatalog(std::move(catalog));
    return;
  }
  const auto found = std::ranges::find(
      *catalog, id,
      [](const StoredSkinInfo& info) { return info.manifest.id; });
  if (found == catalog->end() || found->archive_sha256 != current_sha256 ||
      (previous && !found->previous_sha256)) {
    ClearPreview();
    Finish(Result(SkinOperationStatus::kStalePreview));
    return;
  }
  expected_current_sha256_ = current_sha256;
  std::string revision = previous ? *found->previous_sha256 : current_sha256;
  store_.AsyncCall(&SkinPackageStore::Read)
      .WithArgs(std::move(id), std::move(revision), previous)
      .Then(base::BindOnce(&SkinProfileService::OnArchiveRead,
                           operation_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnArchiveRead(ArchiveResult archive) {
  if (!archive.has_value()) {
    auto result = Result(SkinOperationStatus::kStoreFailed);
    result.store_error = archive.error();
    ClearPreview();
    Finish(std::move(result));
    return;
  }
  candidate_archive_ = std::move(archive->archive);
  loaded_record_ = std::move(*archive);
  DecodeCandidate();
}

const DecodedSkin* SkinProfileService::GetPreview(
    std::string_view token) const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  return enabled() && !busy_ && !token.empty() && token == preview_token_
             ? preview_.get()
             : nullptr;
}

bool SkinProfileService::PreviewCanBeInstalled(std::string_view token) const {
  return installation_allowed() && preview_installable_ && GetPreview(token);
}

bool SkinProfileService::CanChangeAppearance() const {
  return enabled() && theme_observation_.IsObserving() &&
         !theme_observation_.GetSource()->UsingPolicyTheme() &&
         !profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiAppliedSkin);
}

bool SkinProfileService::CanApplyPreview(std::string_view token) const {
  return CanChangeAppearance() && reading_installed_ && !preview_installable_ &&
         GetPreview(token);
}

bool SkinProfileService::ApplyPreview(std::string_view token) {
  if (!CanApplyPreview(token)) {
    return false;
  }
  EndLivePreview();
  const auto& colors = preview_->manifest.appearance.light_tokens.colors;
  const auto accent =
      std::ranges::find(colors, std::string("accent"),
                        [](const auto& item) { return item.first; });
  if (accent == colors.end() || !accent->second.starts_with('#')) {
    return false;
  }
  const auto seed = ParseColor(std::string_view(accent->second).substr(1));
  if (!seed) {
    return false;
  }
  base::AutoReset<bool> applying(&changing_appearance_, true);
  auto* theme = theme_observation_.GetSource();
  theme->SetUserColorAndBrowserColorVariant(
      *seed, ui::mojom::BrowserColorVariant::kExpressive);
  theme->UseDeviceTheme(false);
  profile_->GetPrefs()->SetDict(
      prefs::kTahaiAppliedSkin,
      base::DictValue()
          .Set("schema_version", 2)
          .Set("id", preview_->manifest.id)
          .Set("archive_sha256", preview_->archive_sha256)
          .Set("manifest_json", preview_->manifest_json)
          .Set("seed_color",
               base::StringPrintf("%02X%02X%02X", SkColorGetR(*seed),
                                  SkColorGetG(*seed), SkColorGetB(*seed))));
  color_supplier_ = PaletteForSkin(*preview_);
  theme->RefreshColorPalette();
  return true;
}

bool SkinProfileService::ApplyBuiltIn(std::string_view id) {
  if (!CanChangeAppearance() || busy_) {
    return false;
  }
  if (id == "stock") {
    return ResetAppearance();
  }
  auto appearance = GetTahaiBuiltInSkinAppearance(id);
  if (!appearance) {
    return false;
  }
  const auto& tokens = appearance->light_tokens.colors;
  auto accent = std::ranges::find(
      tokens, "accent", [](const auto& token) { return token.first; });
  if (accent == tokens.end()) {
    return false;
  }
  auto seed = ParseColor(std::string_view(accent->second).substr(1));
  if (!seed) {
    return false;
  }
  EndLivePreview();
  base::AutoReset<bool> applying(&changing_appearance_, true);
  auto* theme = theme_observation_.GetSource();
  theme->SetUserColorAndBrowserColorVariant(
      *seed, ui::mojom::BrowserColorVariant::kExpressive);
  theme->UseDeviceTheme(false);
  color_supplier_ = base::MakeRefCounted<SkinColorSupplier>(*appearance);
  profile_->GetPrefs()->SetDict(
      prefs::kTahaiAppliedSkin,
      base::DictValue()
          .Set("schema_version", 3)
          .Set("id", std::string(id))
          .Set("seed_color",
               base::StringPrintf("%02X%02X%02X", SkColorGetR(*seed),
                                  SkColorGetG(*seed), SkColorGetB(*seed))));
  theme->RefreshColorPalette();
  return true;
}

SkinColorSupplier* SkinProfileService::GetColorSupplier() const {
  if (CanChangeAppearance() && preview_color_supplier_) {
    return preview_color_supplier_.get();
  }
  return enabled() && OwnsCurrentAppearance() ? color_supplier_.get() : nullptr;
}

bool SkinProfileService::BeginLivePreview(std::string_view token) {
  if (!CanChangeAppearance() || !GetPreview(token)) {
    return false;
  }
  base::AutoReset<bool> applying(&changing_appearance_, true);
  preview_color_supplier_ = PaletteForSkin(*preview_);
  live_preview_timer_.Start(
      FROM_HERE, base::Seconds(30),
      base::BindOnce(&SkinProfileService::EndLivePreview,
                     lifetime_weak_factory_.GetWeakPtr()));
  theme_observation_.GetSource()->RefreshColorPalette();
  return true;
}

void SkinProfileService::EndLivePreview() {
  live_preview_timer_.Stop();
  if (!preview_color_supplier_) {
    return;
  }
  preview_color_supplier_.reset();
  if (theme_observation_.IsObserving()) {
    base::AutoReset<bool> applying(&changing_appearance_, true);
    theme_observation_.GetSource()->RefreshColorPalette();
  }
}

std::string SkinProfileService::ExportPreview(std::string_view token) const {
  return GetPreview(token) ? candidate_archive_ : std::string();
}

bool SkinProfileService::OwnsCurrentAppearance() const {
  if (!profile_ || !theme_observation_.IsObserving()) {
    return false;
  }
  const auto& applied = profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
  const auto* encoded = applied.FindString("seed_color");
  auto* theme = theme_observation_.GetSource();
  const bool known_schema =
      (applied.size() == 4 && applied.FindInt("schema_version") == 1) ||
      (applied.size() == 5 && applied.FindInt("schema_version") == 2 &&
       color_supplier_) ||
      (applied.size() == 3 && applied.FindInt("schema_version") == 3 &&
       color_supplier_ && applied.FindString("id") &&
       GetTahaiBuiltInSkinAppearance(*applied.FindString("id")).has_value());
  return known_schema && applied.FindString("id") &&
         (applied.FindInt("schema_version") == 3 ||
          applied.FindString("archive_sha256")) &&
         encoded && ParseColor(*encoded).has_value() &&
         theme->GetUserColor() == ParseColor(*encoded) &&
         theme->GetBrowserColorVariant() ==
             ui::mojom::BrowserColorVariant::kExpressive &&
         !theme->UsingDeviceTheme() && !theme->UsingExtensionTheme() &&
         !theme->UsingPolicyTheme();
}

void SkinProfileService::OnThemeChanged() {
  if (!changing_appearance_ && preview_color_supplier_) {
    EndLivePreview();
  }
  if (!changing_appearance_ && profile_ && !OwnsCurrentAppearance() &&
      !profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiAppliedSkin)) {
    color_supplier_.reset();
    profile_->GetPrefs()->ClearPref(prefs::kTahaiAppliedSkin);
  }
}

void SkinProfileService::ResetOwnedAppearance() {
  if (!profile_ ||
      profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiAppliedSkin)) {
    return;
  }
  if (OwnsCurrentAppearance()) {
    base::AutoReset<bool> applying(&changing_appearance_, true);
    color_supplier_.reset();
    theme_observation_.GetSource()->UseDefaultTheme();
  }
  profile_->GetPrefs()->ClearPref(prefs::kTahaiAppliedSkin);
}

bool SkinProfileService::ResetAppearance() {
  if (!CanChangeAppearance() || busy_) {
    return false;
  }
  EndLivePreview();
  base::AutoReset<bool> applying(&changing_appearance_, true);
  color_supplier_.reset();
  theme_observation_.GetSource()->UseDefaultTheme();
  profile_->GetPrefs()->ClearPref(prefs::kTahaiAppliedSkin);
  return true;
}

void SkinProfileService::ReleasePreview(std::string_view token) {
  // Closing an old review must not cancel a newer operation in this profile.
  if (GetPreview(token)) {
    ClearPreview();
  }
}

void SkinProfileService::InstallPreview(std::string token, Callback callback) {
  if (!PreviewCanBeInstalled(token)) {
    std::move(callback).Run(Result(!enabled() ? SkinOperationStatus::kDisabled
                                   : !installation_allowed()
                                       ? SkinOperationStatus::kInstallDisallowed
                                       : SkinOperationStatus::kStalePreview));
    return;
  }
  if (!Start(true, std::move(callback))) {
    return;
  }
  StoredSkinArchive archive{preview_->manifest.id, preview_->manifest_json,
                            preview_->archive_sha256, candidate_archive_};
  store_.AsyncCall(&SkinPackageStore::Install)
      .WithArgs(std::move(archive), expected_current_sha256_)
      .Then(base::BindOnce(
          &SkinProfileService::OnMutationCommitted,
          lifetime_weak_factory_.GetWeakPtr(), preview_->manifest.id,
          expected_current_sha256_ == preview_->archive_sha256
              ? std::string()
              : expected_current_sha256_.value_or(""),
          base::BindOnce(&SkinProfileService::OnStored,
                         operation_weak_factory_.GetWeakPtr())));
}

void SkinProfileService::Remove(std::string id,
                                std::string current_sha256,
                                Callback callback) {
  if (!Start(false, std::move(callback))) {
    return;
  }
  ClearPreview();
  EnsureStore();
  store_.AsyncCall(&SkinPackageStore::Remove)
      .WithArgs(id, current_sha256)
      .Then(
          base::BindOnce(&SkinProfileService::OnMutationCommitted,
                         lifetime_weak_factory_.GetWeakPtr(), std::move(id),
                         std::move(current_sha256),
                         base::BindOnce(&SkinProfileService::OnStored,
                                        operation_weak_factory_.GetWeakPtr())));
}

void SkinProfileService::OnMutationCommitted(
    std::string id,
    std::string old_sha256,
    base::OnceCallback<void(StoreResult)> completion,
    StoreResult result) {
  // A committed removal/update retires the old appearance even when its UI
  // callback was cancelled. Compare the exact revision, not just its name.
  const auto& applied = profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
  if (result.has_value() && applied.FindString("id") &&
      *applied.FindString("id") == id && applied.FindString("archive_sha256") &&
      *applied.FindString("archive_sha256") == old_sha256) {
    ResetOwnedAppearance();
  }
  std::move(completion).Run(std::move(result));
}

void SkinProfileService::OnStored(StoreResult stored) {
  auto result = Result(stored.has_value() ? SkinOperationStatus::kOk
                                          : SkinOperationStatus::kStoreFailed);
  if (!stored.has_value()) {
    result.store_error = stored.error();
  }
  ClearPreview();
  Finish(std::move(result));
}

void SkinProfileService::ClearPreview() {
  EndLivePreview();
  preview_.reset();
  preview_token_.clear();
  candidate_archive_.clear();
  expected_current_sha256_.reset();
  loaded_record_.reset();
  preview_installable_ = false;
  reading_installed_ = false;
}

void SkinProfileService::Finish(SkinOperationResult result) {
  operation_weak_factory_.InvalidateWeakPtrs();
  decoder_.reset();
  busy_ = false;
  auto callback = std::move(callback_);
  if (callback) {
    std::move(callback).Run(std::move(result));
  }
}

void SkinProfileService::OnPolicyChanged() {
  if (!enabled()) {
    ResetOwnedAppearance();
  }
  ClearPreview();
  // Already-authorized background transactions may finish storing bytes, but
  // no revoked preview/callback can activate or publish them. No auto retry.
  Finish(Result(!enabled() ? SkinOperationStatus::kDisabled
                           : SkinOperationStatus::kCancelled));
}

void SkinProfileService::Cancel() {
  ClearPreview();
  Finish(Result(SkinOperationStatus::kCancelled));
}

void SkinProfileService::Shutdown() {
  if (shutdown_) {
    return;
  }
  shutdown_ = true;
  startup_decoder_.reset();
  theme_observation_.Reset();
  lifetime_weak_factory_.InvalidateWeakPtrs();
  policy_registrar_.RemoveAll();
  ClearPreview();
  store_.Reset();
  Finish(Result(SkinOperationStatus::kCancelled));
  profile_ = nullptr;
}

}  // namespace tahai::skins
