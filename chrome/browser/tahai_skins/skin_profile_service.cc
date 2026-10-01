// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/skin_profile_service.h"

#include <algorithm>
#include <set>
#include <utility>

#include "base/check.h"
#include "base/check_op.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/location.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/stringprintf.h"
#include "base/task/thread_pool.h"
#include "base/task/sequenced_task_runner.h"
#include "base/uuid.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/tahai_skins/tahai_skin_signature.h"
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

std::string PointerComponent(std::string_view key) {
  std::string result;
  for (char ch : key) {
    if (ch == '~') result += "~0";
    else if (ch == '/') result += "~1";
    else result += ch;
  }
  return result;
}

bool AppendRevisionChanges(const base::Value* before, const base::Value* after,
                           const std::string& path, size_t depth, size_t& bytes,
                           std::vector<SkinRevisionChange>& changes) {
  if (depth > 32) return false;
  if (before && after && *before == *after) return true;
  if ((!before || before->is_dict()) && (!after || after->is_dict())) {
    std::set<std::string> keys;
    if (before) for (auto item : before->GetDict()) keys.insert(item.first);
    if (after) for (auto item : after->GetDict()) keys.insert(item.first);
    if (!keys.empty()) {
      for (const auto& key : keys) {
        if (!AppendRevisionChanges(before ? before->GetDict().Find(key) : nullptr,
                    after ? after->GetDict().Find(key) : nullptr,
                    path + "/" + PointerComponent(key), depth + 1, bytes,
                    changes)) return false;
      }
      return true;
    }
  }
  // Array indices are intentional: ordering changes are meaningful and visible.
  if ((!before || before->is_list()) && (!after || after->is_list())) {
    const size_t old_size = before ? before->GetList().size() : 0;
    const size_t new_size = after ? after->GetList().size() : 0;
    if (old_size || new_size) {
      for (size_t i = 0; i < old_size || i < new_size; ++i) {
        if (!AppendRevisionChanges(i < old_size ? &before->GetList()[i] : nullptr,
                    i < new_size ? &after->GetList()[i] : nullptr,
                    path + "/" + base::NumberToString(i), depth + 1, bytes,
                    changes)) return false;
      }
      return true;
    }
  }
  auto old_json = before ? base::WriteJson(*before)
                         : std::make_optional(std::string("<absent>"));
  auto new_json = after ? base::WriteJson(*after)
                       : std::make_optional(std::string("<absent>"));
  if (!old_json || !new_json) return false;
  bytes += path.size() + old_json->size() + new_json->size();
  if (changes.size() >= 8192 || bytes > 2 * 1024 * 1024) return false;
  changes.push_back({path, std::move(*old_json), std::move(*new_json)});
  return true;
}

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

bool ParseStoredSkinManifest(
    const base::DictValue& value,
    TahaiSkinManifest* appearance,
    std::optional<TahaiOperationalSkinManifest>* operational) {
  if (!appearance || !operational) {
    return false;
  }
  *operational = std::nullopt;
  const std::optional<int> schema_version = value.FindInt("schema_version");
  if (!schema_version) {
    return false;
  }
  if (*schema_version == 1) {
    return ValidateTahaiSkinManifest(value, appearance) ==
           TahaiSkinManifestValidationResult::kValid;
  }
  if (*schema_version == 2) {
    TahaiOperationalSkinManifest parsed;
    if (ValidateTahaiOperationalSkinManifest(value, &parsed) !=
        TahaiOperationalSkinManifestValidationResult::kValid) {
      return false;
    }
    *appearance = parsed.appearance;
    *operational = std::move(parsed);
    return true;
  }
  return false;
}

}  // namespace

std::optional<std::vector<SkinRevisionChange>> BuildSkinRevisionDiff(
    const base::DictValue& before, const base::DictValue& after) {
  std::vector<SkinRevisionChange> changes;
  size_t bytes = 0;
  base::Value old_value(before.Clone());
  base::Value new_value(after.Clone());
  if (!AppendRevisionChanges(&old_value, &new_value, "", 0, bytes, changes))
    return std::nullopt;
  return changes;
}

SkinProfileService::SkinProfileService(Profile* profile) : profile_(profile) {
  DCHECK_CURRENTLY_ON(content::BrowserThread::UI);
  policy_registrar_.Init(profile_->GetPrefs());
  for (const char* pref :
       {prefs::kTahaiSkinsEnabled, prefs::kTahaiSkinInstallationsAllowed,
        prefs::kTahaiOperationalSkinTrustedKeys, prefs::kTahaiLocalSkinTrustedKeys}) {
    policy_registrar_.Add(
        pref, base::BindRepeating(&SkinProfileService::OnPolicyChanged,
                                  base::Unretained(this)));
  }
  if (profile_->IsRegularProfile() && !profile_->IsOffTheRecord()) {
    if (auto* theme = ThemeServiceFactory::GetForProfile(profile_)) {
      theme_observation_.Observe(theme);
      const auto applied =
          profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin).Clone();
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
        std::optional<TahaiOperationalSkinManifest> operational;
        if (value && ParseStoredSkinManifest(*value, &manifest, &operational) &&
            manifest.id == *id && known_version &&
            manifest.compatibility.min_chromium_major <= chromium_major &&
            manifest.compatibility.max_chromium_major >= chromium_major) {
          color_supplier_ =
              base::MakeRefCounted<SkinColorSupplier>(manifest.appearance);
          // An installed operational manifest has no authority merely because
          // its cached JSON is structurally valid. The stored archive is
          // decoded and signature-verified before it can become active below.
          operational_manifest_.reset();
          operational_archive_sha256_.reset();
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
                                   startup_weak_factory_.GetWeakPtr(),
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

bool SkinProfileService::CanChangeLocalPublishers() const {
  return enabled() && !busy_ &&
      !profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiLocalSkinTrustedKeys);
}

bool SkinProfileService::CanEnrollLocalPublisher() const {
  return CanChangeLocalPublishers() && installation_allowed() &&
      !profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiOperationalSkinTrustedKeys);
}

base::UnguessableToken SkinProfileService::local_publisher_generation() const {
  return publisher_generation_;
}

std::optional<std::vector<SkinPublisherReview>> SkinProfileService::GetLocalPublishers() const {
  if (!enabled()) return std::nullopt;
  const auto& stored = profile_->GetPrefs()->GetDict(prefs::kTahaiLocalSkinTrustedKeys);
  std::vector<SkinPublisherReview> result;
  if (stored.empty()) return result;
  std::vector<TahaiSkinTrustKey> keys;
  if (!ParseTahaiSkinTrustKeys(stored, &keys)) return std::nullopt;
  for (const auto& key : keys)
    result.push_back({key.id, TahaiSkinPublicKeyFingerprint(key), true});
  return result;
}

std::optional<LocalPublisherEnrollmentReview> SkinProfileService::ReviewLocalPublisher(
    std::string key_id, std::string public_key_hex) const {
  if (!CanEnrollLocalPublisher()) return std::nullopt;
  const auto current = GetLocalPublishers();
  if (!current || current->size() >= 32 ||
      std::ranges::find(*current, key_id, &SkinPublisherReview::key_id) != current->end())
    return std::nullopt;
  std::vector<TahaiSkinTrustKey> parsed;
  if (!ParseTahaiSkinTrustKeys(base::DictValue().Set("keys", base::ListValue().Append(
          base::DictValue().Set("id", key_id).Set("public_key", public_key_hex))), &parsed))
    return std::nullopt;
  return LocalPublisherEnrollmentReview{publisher_generation_, std::move(key_id),
      std::move(public_key_hex), TahaiSkinPublicKeyFingerprint(parsed.front())};
}

bool SkinProfileService::EnrollLocalPublisher(const LocalPublisherEnrollmentReview& review) {
  if (!CanEnrollLocalPublisher() || review.generation != publisher_generation_) return false;
  const auto checked = ReviewLocalPublisher(review.key_id, review.public_key_hex);
  if (!checked || checked->public_key_sha256 != review.public_key_sha256) return false;
  auto value = profile_->GetPrefs()->GetDict(prefs::kTahaiLocalSkinTrustedKeys).Clone();
  if (value.empty()) value.Set("keys", base::ListValue());
  value.FindList("keys")->Append(base::DictValue().Set("id", review.key_id)
      .Set("public_key", review.public_key_hex));
  // Observers revoke previews, retained window authority and pending restores.
  // Public keys are not secrets; no private key or signed package is persisted here.
  profile_->GetPrefs()->SetDict(prefs::kTahaiLocalSkinTrustedKeys, std::move(value));
  return true;
}

bool SkinProfileService::RemoveLocalPublisher(std::string_view key_id,
    std::string_view fingerprint, const base::UnguessableToken& generation) {
  if (!CanChangeLocalPublishers() || generation != publisher_generation_) return false;
  const auto current = GetLocalPublishers();
  if (!current || !std::ranges::any_of(*current, [&](const auto& key) {
        return key.key_id == key_id && key.public_key_sha256 == fingerprint;
      })) return false;
  const auto& stored = profile_->GetPrefs()->GetDict(prefs::kTahaiLocalSkinTrustedKeys);
  base::ListValue retained;
  for (const auto& entry : *stored.FindList("keys"))
    if (*entry.GetDict().FindString("id") != key_id) retained.Append(entry.Clone());
  profile_->GetPrefs()->SetDict(prefs::kTahaiLocalSkinTrustedKeys,
      retained.empty() ? base::DictValue() : base::DictValue().Set("keys", std::move(retained)));
  return true;
}

bool SkinProfileService::ClearLocalPublishers(const base::UnguessableToken& generation) {
  if (!CanChangeLocalPublishers() || generation != publisher_generation_) return false;
  profile_->GetPrefs()->ClearPref(prefs::kTahaiLocalSkinTrustedKeys);
  // A no-op clear still cancels any outstanding enrollment review.
  if (publisher_generation_ == generation) OnPolicyChanged();
  return true;
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

bool SkinProfileService::IsTrustedOperationalSkin(
    const DecodedSkin& skin) const {
  if (!skin.operational_manifest) {
    return true;
  }
  return PublisherForSkin(skin).has_value();
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
                           startup_weak_factory_.GetWeakPtr(), id, sha256));
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
                     startup_weak_factory_.GetWeakPtr(), id, sha256));
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
      result.skin->manifest.id != id || result.skin->archive_sha256 != sha256 ||
      !IsTrustedOperationalSkin(*result.skin)) {
    ResetOwnedAppearance();
    return;
  }
  auto applying = ScopedAppearanceChange();
  color_supplier_ = PaletteForSkin(*result.skin);
  operational_manifest_ = std::move(result.skin->operational_manifest);
  operational_archive_sha256_ = operational_manifest_
      ? std::make_optional(result.skin->archive_sha256) : std::nullopt;
  theme_observation_.GetSource()->RefreshColorPalette();
}

void SkinProfileService::PreviewFile(const base::FilePath& selected_file,
                                     Callback callback) {
  if (!Start(true, std::move(callback))) {
    return;
  }
  if (!ClearPreview()) {
    return;
  }
  preview_installable_ = true;
  base::ThreadPool::PostTaskAndReplyWithResult(
      FROM_HERE, {base::MayBlock(), base::TaskPriority::USER_VISIBLE},
      base::BindOnce(&ReadChosenLocalArchive, selected_file),
      base::BindOnce(&SkinProfileService::OnFileRead,
                     operation_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnFileRead(std::optional<std::string> archive) {
  if (!archive) {
    if (!ClearPreview()) {
      return;
    }
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
    if (!ClearPreview()) {
      return;
    }
    Finish(std::move(result));
    return;
  }
  // User packages cannot impersonate the immutable browser-owned recovery or
  // first-party identities. Names/creator metadata never establish trust.
  if (IsTahaiBuiltInSkinId(decoded.skin->manifest.id)) {
    if (!ClearPreview()) {
      return;
    }
    Finish(Result(SkinOperationStatus::kInvalidInput));
    return;
  }
  if (!IsTrustedOperationalSkin(*decoded.skin)) {
    if (!ClearPreview()) {
      return;
    }
    Finish(Result(SkinOperationStatus::kUntrusted));
    return;
  }
  if (loaded_record_ &&
      (decoded.skin->manifest.id != loaded_record_->id ||
       decoded.skin->manifest_json != loaded_record_->manifest_json ||
       decoded.skin->archive_sha256 != loaded_record_->archive_sha256)) {
    if (!ClearPreview()) {
      return;
    }
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
    if (!ClearPreview()) {
      return;
    }
    OnCatalog(std::move(catalog));
    return;
  }
  const auto found = std::ranges::find(
      *catalog, preview_->manifest.id,
      [](const StoredSkinInfo& info) { return info.manifest.id; });
  if (reading_installed_) {
    if (found == catalog->end() || !expected_current_sha256_ ||
        found->archive_sha256 != *expected_current_sha256_) {
      if (!ClearPreview()) {
        return;
      }
      Finish(Result(SkinOperationStatus::kStalePreview));
      return;
    }
  } else if (found != catalog->end()) {
    expected_current_sha256_ = found->archive_sha256;
  }
  if (expected_current_sha256_ &&
      *expected_current_sha256_ != preview_->archive_sha256) {
    // The catalog is only a locator. Compare the candidate to a fresh sandbox
    // decode of the exact CURRENT archive, including when reviewing rollback.
    store_.AsyncCall(&SkinPackageStore::Read)
        .WithArgs(preview_->manifest.id, *expected_current_sha256_, false)
        .Then(base::BindOnce(&SkinProfileService::OnRevisionArchive,
                            operation_weak_factory_.GetWeakPtr(),
                            std::move(*catalog)));
    return;
  }
  FinishPreview(std::move(*catalog));
}

void SkinProfileService::OnRevisionArchive(std::vector<StoredSkinInfo> catalog,
                                           ArchiveResult archive) {
  if (!archive.has_value()) {
    auto result = Result(SkinOperationStatus::kStoreFailed);
    result.store_error = archive.error();
    if (!ClearPreview()) {
      return;
    }
    Finish(std::move(result));
    return;
  }
  if (!preview_ || !expected_current_sha256_ ||
      archive->id != preview_->manifest.id ||
      archive->archive_sha256 != *expected_current_sha256_) {
    if (!ClearPreview()) {
      return;
    }
    Finish(Result(SkinOperationStatus::kStalePreview));
    return;
  }
  decoder_ = std::make_unique<SkinDecodeSession>();
  decoder_->Decode(archive->archive,
      base::BindOnce(&SkinProfileService::OnRevisionDecoded,
                     operation_weak_factory_.GetWeakPtr(), std::move(catalog),
                     std::move(archive->manifest_json)));
}

void SkinProfileService::OnRevisionDecoded(std::vector<StoredSkinInfo> catalog,
                                           std::string manifest_json,
                                           SkinDecodeResult decoded) {
  if (decoded.outcome != DecodeOutcome::kDecoded || !decoded.skin) {
    auto result = Result(SkinOperationStatus::kDecodeFailed);
    result.decode_error = decoded.outcome;
    if (!ClearPreview()) {
      return;
    }
    Finish(std::move(result));
    return;
  }
  if (!preview_ || !expected_current_sha256_ ||
      decoded.skin->manifest.id != preview_->manifest.id ||
      decoded.skin->archive_sha256 != *expected_current_sha256_ ||
      decoded.skin->manifest_json != manifest_json) {
    if (!ClearPreview()) {
      return;
    }
    Finish(Result(SkinOperationStatus::kStalePreview));
    return;
  }
  // Revocation need not prevent replacing a previously installed package.
  // A historical signature is reported honestly but gives no usable authority.
  const auto before = base::JSONReader::ReadDict(decoded.skin->manifest_json,
                                                 base::JSON_PARSE_RFC);
  const auto after = base::JSONReader::ReadDict(preview_->manifest_json,
                                                base::JSON_PARSE_RFC);
  auto changes = before && after ? BuildSkinRevisionDiff(*before, *after)
                                 : std::nullopt;
  if (!changes || !IsTrustedOperationalSkin(*preview_)) {
    if (!ClearPreview()) {
      return;
    }
    Finish(Result(SkinOperationStatus::kInvalidInput));
    return;
  }
  SkinRevisionReview review;
  review.current_sha256 = *expected_current_sha256_;
  review.candidate_sha256 = preview_->archive_sha256;
  review.current_operational = decoded.skin->operational_manifest.has_value();
  review.candidate_operational = preview_->operational_manifest.has_value();
  review.current_publisher = PublisherForSkin(*decoded.skin);
  review.candidate_publisher = PublisherForSkin(*preview_);
  review.changes = std::move(*changes);
  const std::vector<TahaiOperationalCapability> empty;
  const auto& old_caps = review.current_operational
      ? decoded.skin->operational_manifest->capabilities : empty;
  const auto& new_caps = review.candidate_operational
      ? preview_->operational_manifest->capabilities : empty;
  for (auto capability : new_caps) {
    if (std::ranges::find(old_caps, capability) == old_caps.end())
      review.added_capabilities.push_back(capability);
  }
  for (auto capability : old_caps) {
    if (std::ranges::find(new_caps, capability) == new_caps.end())
      review.removed_capabilities.push_back(capability);
  }
  revision_review_ = std::move(review);
  FinishPreview(std::move(catalog));
}

void SkinProfileService::FinishPreview(std::vector<StoredSkinInfo> catalog) {
  preview_token_ = base::Uuid::GenerateRandomV4().AsLowercaseString();
  auto result = Result(SkinOperationStatus::kOk);
  result.preview_token = preview_token_;
  result.catalog = std::move(catalog);
  Finish(std::move(result));
}

void SkinProfileService::PreviewInstalled(std::string id,
                                          std::string current_sha256,
                                          bool previous,
                                          Callback callback) {
  if (!Start(previous, std::move(callback))) {
    return;
  }
  if (!ClearPreview()) {
    return;
  }
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
    if (!ClearPreview()) {
      return;
    }
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
    if (!ClearPreview()) {
      return;
    }
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

std::optional<SkinPublisherReview> SkinProfileService::GetPreviewPublisherReview(
    std::string_view token) const {
  const auto* skin = GetPreview(token);
  return skin ? PublisherForSkin(*skin) : std::nullopt;
}

std::optional<SkinPublisherReview> SkinProfileService::PublisherForSkin(
    const DecodedSkin& skin) const {
  if (!enabled() || !skin.operational_manifest) return std::nullopt;
  const auto* preferences = profile_->GetPrefs();
  const bool managed = preferences->IsManagedPreference(prefs::kTahaiOperationalSkinTrustedKeys);
  // Policy is authoritative even when empty/invalid: never fall back to local
  // keys on a managed policy rejection. User/recommended policy values cannot
  // impersonate managed trust. Enrollment has a separate, non-syncing pref.
  if (!managed && preferences->IsManagedPreference(prefs::kTahaiLocalSkinTrustedKeys))
    return std::nullopt;
  std::vector<TahaiSkinTrustKey> keys;
  if (!ParseTahaiSkinTrustKeys(preferences->GetDict(managed ? prefs::kTahaiOperationalSkinTrustedKeys : prefs::kTahaiLocalSkinTrustedKeys), &keys) ||
      VerifyTahaiSkinSignature(skin, keys) != TahaiSkinSignatureResult::kValid)
    return std::nullopt;
  const auto key = std::ranges::find(keys, skin.signing_key_id, &TahaiSkinTrustKey::id);
  if (key == keys.end()) return std::nullopt;
  return SkinPublisherReview{key->id, TahaiSkinPublicKeyFingerprint(*key), !managed};
}

const SkinRevisionReview* SkinProfileService::GetPreviewRevisionReview(
    std::string_view token) const {
  return GetPreview(token) && revision_review_ ? &*revision_review_ : nullptr;
}

bool SkinProfileService::AcknowledgeRevisionReview(
    std::string_view token, std::string_view current_sha256,
    std::string_view candidate_sha256) {
  const auto* review = GetPreviewRevisionReview(token);
  if (!PreviewCanBeInstalled(token) || !review ||
      review->current_sha256 != current_sha256 ||
      review->candidate_sha256 != candidate_sha256) return false;
  revision_acknowledged_ = true;
  return true;
}

bool SkinProfileService::CanChangeAppearance() const {
  const auto* raw =
      profile_
          ? profile_->GetPrefs()->GetRawUserPrefValue(prefs::kTahaiAppliedSkin)
          : nullptr;
  return enabled() && theme_observation_.IsObserving() &&
         (!raw || raw->is_dict()) &&
         !theme_observation_.GetSource()->UsingPolicyTheme() &&
         !profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiAppliedSkin);
}

base::ScopedClosureRunner SkinProfileService::ScopedAppearanceChange() {
  const bool previous = changing_appearance_;
  changing_appearance_ = true;
  return base::ScopedClosureRunner(base::BindOnce(
      [](base::WeakPtr<SkinProfileService> service, bool previous) {
        if (service) {
          service->changing_appearance_ = previous;
        }
      },
      lifetime_weak_factory_.GetWeakPtr(), previous));
}

bool SkinProfileService::CanApplyPreview(std::string_view token) const {
  return CanChangeAppearance() && reading_installed_ && !preview_installable_ &&
         GetPreview(token);
}

bool SkinProfileService::ApplyPreview(std::string_view token) {
  if (changing_appearance_ || !CanApplyPreview(token)) {
    return false;
  }
  const auto alive = GetWeakPtr();
  const std::string reviewed_token(token);
  const auto generation = publisher_generation_;
  EndLivePreview();
  if (!alive || publisher_generation_ != generation ||
      !CanApplyPreview(reviewed_token)) {
    return false;
  }
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
  auto applying = ScopedAppearanceChange();
  auto* theme = theme_observation_.GetSource();
  theme->SetUserColorAndBrowserColorVariant(
      *seed, ui::mojom::BrowserColorVariant::kExpressive);
  if (!alive || publisher_generation_ != generation ||
      !CanApplyPreview(reviewed_token)) {
    return false;
  }
  theme->UseDeviceTheme(false);
  if (!alive || publisher_generation_ != generation ||
      !CanApplyPreview(reviewed_token)) {
    return false;
  }
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
  if (!alive || publisher_generation_ != generation ||
      !CanApplyPreview(reviewed_token)) {
    return false;
  }
  color_supplier_ = PaletteForSkin(*preview_);
  operational_manifest_ = preview_->operational_manifest;
  operational_archive_sha256_ = operational_manifest_
      ? std::make_optional(preview_->archive_sha256) : std::nullopt;
  theme->RefreshColorPalette();
  return alive && publisher_generation_ == generation && CanChangeAppearance();
}

bool SkinProfileService::ApplyBuiltIn(std::string_view id) {
  if (changing_appearance_ || !CanChangeAppearance() || busy_) {
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
  const auto alive = GetWeakPtr();
  const auto generation = publisher_generation_;
  const std::string selected_id(id);
  EndLivePreview();
  if (!alive || publisher_generation_ != generation || !CanChangeAppearance()) {
    return false;
  }
  auto applying = ScopedAppearanceChange();
  auto* theme = theme_observation_.GetSource();
  theme->SetUserColorAndBrowserColorVariant(
      *seed, ui::mojom::BrowserColorVariant::kExpressive);
  if (!alive || publisher_generation_ != generation || !CanChangeAppearance()) {
    return false;
  }
  theme->UseDeviceTheme(false);
  if (!alive || publisher_generation_ != generation || !CanChangeAppearance()) {
    return false;
  }
  color_supplier_ = base::MakeRefCounted<SkinColorSupplier>(*appearance);
  operational_manifest_.reset();
  operational_archive_sha256_.reset();
  profile_->GetPrefs()->SetDict(
      prefs::kTahaiAppliedSkin,
      base::DictValue()
          .Set("schema_version", 3)
          .Set("id", selected_id)
          .Set("seed_color",
               base::StringPrintf("%02X%02X%02X", SkColorGetR(*seed),
                                  SkColorGetG(*seed), SkColorGetB(*seed))));
  if (!alive || publisher_generation_ != generation || !CanChangeAppearance()) {
    return false;
  }
  theme->RefreshColorPalette();
  return alive && publisher_generation_ == generation && CanChangeAppearance();
}

SkinColorSupplier* SkinProfileService::GetColorSupplier() const {
  if (CanChangeAppearance() && preview_color_supplier_) {
    return preview_color_supplier_.get();
  }
  return enabled() && OwnsCurrentAppearance() ? color_supplier_.get() : nullptr;
}

std::optional<base::UnguessableToken>
SkinProfileService::BindActiveSkinToWindow() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!CanChangeAppearance() || !OwnsCurrentAppearance() ||
      !color_supplier_ || (operational_manifest_ && !GetOperationalManifest()) ||
      window_bindings_.size() + window_restores_.size() >= 32u) {
    return std::nullopt;
  }
  const auto& applied = profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
  const auto* id = applied.FindString("id");
  if (!id) {
    return std::nullopt;
  }
  const auto* hash = applied.FindString("archive_sha256");
  const auto token = base::UnguessableToken::Create();
  // Never pin a transient preview over the committed revision.
  window_bindings_.emplace(token, WindowSkinBinding{
      *id, hash ? *hash : std::string(), color_supplier_, operational_manifest_});
  return token;
}

std::optional<base::UnguessableToken>
SkinProfileService::BindPreviewToWindow(std::string_view preview_token) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!CanApplyPreview(preview_token) ||
      window_bindings_.size() + window_restores_.size() >= 32u) {
    return std::nullopt;
  }
  const auto token = base::UnguessableToken::Create();
  window_bindings_.emplace(token, WindowSkinBinding{
      preview_->manifest.id, preview_->archive_sha256, PaletteForSkin(*preview_),
      preview_->operational_manifest});
  return token;
}

const WindowSkinBinding* SkinProfileService::GetWindowBinding(
    const base::UnguessableToken& token) const {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!CanChangeAppearance()) {
    return nullptr;
  }
  const auto found = window_bindings_.find(token);
  return found == window_bindings_.end() ? nullptr : &found->second;
}

std::optional<base::UnguessableToken> SkinProfileService::CopyWindowBinding(
    const base::UnguessableToken& token) {
  const auto* source = GetWindowBinding(token);
  if (!source || window_bindings_.size() + window_restores_.size() >= 32u) {
    return std::nullopt;
  }
  const auto next = base::UnguessableToken::Create();
  window_bindings_.emplace(next, *source);
  return next;
}

void SkinProfileService::ReleaseWindowBinding(const base::UnguessableToken& token) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  window_bindings_.erase(token);
}

void SkinProfileService::RestoreWindowSkin(
    std::string id,
    std::string archive_sha256,
    WindowBindingCallback callback) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!CanChangeAppearance() || pending_catalog_mutations_ != 0 ||
      window_bindings_.size() + window_restores_.size() >= 32u ||
      id.size() < 3 || id.size() > 64 || id.front() == '-' || id.back() == '-' ||
      !std::ranges::all_of(id, [](unsigned char ch) {
        return (ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9') || ch == '-';
      })) {
    std::move(callback).Run(std::nullopt);
    return;
  }
  if (archive_sha256.empty()) {
    auto appearance = GetTahaiBuiltInSkinAppearance(id);
    if (!appearance) {
      std::move(callback).Run(std::nullopt);
      return;
    }
    const auto token = base::UnguessableToken::Create();
    window_bindings_.emplace(
        token, WindowSkinBinding{std::move(id), {},
                                 base::MakeRefCounted<SkinColorSupplier>(*appearance),
                                 std::nullopt});
    std::move(callback).Run(token);
    return;
  }
  if (IsTahaiBuiltInSkinId(id) || archive_sha256.size() != 64 ||
      !std::ranges::all_of(archive_sha256, [](unsigned char ch) {
        return (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') ||
               (ch >= 'A' && ch <= 'F');
      })) {
    std::move(callback).Run(std::nullopt);
    return;
  }
  window_restores_.push_back(
      {std::move(id), std::move(archive_sha256), std::move(callback)});
  if (window_restores_.size() == 1) {
    StartNextWindowRestore();
  }
}

void SkinProfileService::StartNextWindowRestore() {
  if (window_restores_.empty()) {
    return;
  }
  EnsureStore();
  const auto& pending = window_restores_.front();
  store_.AsyncCall(&SkinPackageStore::Read)
      .WithArgs(pending.id, pending.archive_sha256, false)
      .Then(base::BindOnce(&SkinProfileService::OnWindowRestoreArchive,
                           window_restore_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnWindowRestoreArchive(ArchiveResult archive) {
  CHECK(!window_restores_.empty());
  const auto& pending = window_restores_.front();
  if (!CanChangeAppearance() || !archive.has_value() ||
      archive->id != pending.id ||
      archive->archive_sha256 != pending.archive_sha256) {
    FinishWindowRestore(std::nullopt);
    return;
  }
  window_restore_manifest_json_ = std::move(archive->manifest_json);
  window_restore_decoder_ = std::make_unique<SkinDecodeSession>();
  window_restore_decoder_->Decode(
      archive->archive,
      base::BindOnce(&SkinProfileService::OnWindowRestoreDecoded,
                     window_restore_weak_factory_.GetWeakPtr()));
}

void SkinProfileService::OnWindowRestoreDecoded(SkinDecodeResult result) {
  CHECK(!window_restores_.empty());
  const auto& pending = window_restores_.front();
  if (!CanChangeAppearance() || result.outcome != DecodeOutcome::kDecoded ||
      !result.skin || result.skin->manifest.id != pending.id ||
      result.skin->archive_sha256 != pending.archive_sha256 ||
      result.skin->manifest_json != window_restore_manifest_json_ ||
      !IsTrustedOperationalSkin(*result.skin)) {
    FinishWindowRestore(std::nullopt);
    return;
  }
  const auto token = base::UnguessableToken::Create();
  window_bindings_.emplace(
      token, WindowSkinBinding{pending.id, pending.archive_sha256,
                               PaletteForSkin(*result.skin),
                               std::move(result.skin->operational_manifest)});
  FinishWindowRestore(token);
}

void SkinProfileService::FinishWindowRestore(
    std::optional<base::UnguessableToken> token) {
  auto callback = std::move(window_restores_.front().callback);
  window_restores_.pop_front();
  window_restore_decoder_.reset();
  window_restore_manifest_json_.reset();
  StartNextWindowRestore();
  // No member access after a client callback, which may destroy this service.
  std::move(callback).Run(token);
}

void SkinProfileService::CancelWindowRestores() {
  window_restore_weak_factory_.InvalidateWeakPtrs();
  window_restore_decoder_.reset();
  window_restore_manifest_json_.reset();
  auto cancelled = std::move(window_restores_);
  window_restores_.clear();
  for (auto& pending : cancelled) {
    // Cancellation must not reenter a policy/store mutation or Shutdown.
    base::SequencedTaskRunner::GetCurrentDefault()->PostTask(
        FROM_HERE, base::BindOnce(std::move(pending.callback), std::nullopt));
  }
}

base::CallbackListSubscription SkinProfileService::ObserveWindowBindings(
    base::RepeatingClosure callback) {
  return window_binding_changes_.Add(std::move(callback));
}

void SkinProfileService::ClearWindowBindings() {
  CancelWindowRestores();
  if (!window_bindings_.empty()) {
    window_bindings_.clear();
    window_binding_changes_.Notify();
  }
}

const TahaiOperationalSkinManifest* SkinProfileService::GetOperationalManifest()
    const {
  if (!enabled() || !OwnsCurrentAppearance() || !operational_manifest_ ||
      !operational_archive_sha256_) {
    return nullptr;
  }
  const auto& applied = profile_->GetPrefs()->GetDict(prefs::kTahaiAppliedSkin);
  const auto* id = applied.FindString("id");
  const auto* sha256 = applied.FindString("archive_sha256");
  return id && *id == operational_manifest_->appearance.id && sha256 &&
      *sha256 == *operational_archive_sha256_ ? &*operational_manifest_ : nullptr;
}

std::optional<std::string>
SkinProfileService::GetOperationalManifestArchiveSha256() const {
  return GetOperationalManifest() ? operational_archive_sha256_ : std::nullopt;
}

bool SkinProfileService::BeginLivePreview(std::string_view token) {
  if (changing_appearance_ || !CanChangeAppearance() || !GetPreview(token)) {
    return false;
  }
  const auto alive = GetWeakPtr();
  const auto generation = publisher_generation_;
  auto applying = ScopedAppearanceChange();
  preview_color_supplier_ = PaletteForSkin(*preview_);
  live_preview_timer_.Start(
      FROM_HERE, base::Seconds(30),
      base::BindOnce(&SkinProfileService::EndLivePreview,
                     lifetime_weak_factory_.GetWeakPtr()));
  theme_observation_.GetSource()->RefreshColorPalette();
  return alive && publisher_generation_ == generation && live_preview_active();
}

void SkinProfileService::EndLivePreview() {
  live_preview_timer_.Stop();
  if (!preview_color_supplier_) {
    return;
  }
  preview_color_supplier_.reset();
  if (theme_observation_.IsObserving()) {
    auto applying = ScopedAppearanceChange();
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
  const auto alive = GetWeakPtr();
  if (theme_observation_.IsObserving() &&
      theme_observation_.GetSource()->UsingPolicyTheme()) {
    ClearWindowBindings();
    if (!alive) {
      return;
    }
  }
  if (!changing_appearance_ && preview_color_supplier_) {
    // We are already inside ThemeService's observer notification. Calling
    // RefreshColorPalette() through EndLivePreview() here would re-enter the
    // observer list and trip its reentrancy guard. The external theme change
    // has already refreshed the palette, so only retire the transient preview.
    live_preview_timer_.Stop();
    preview_color_supplier_.reset();
  }
  if (!changing_appearance_ && profile_ && !OwnsCurrentAppearance() &&
      !profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiAppliedSkin)) {
    const auto* raw =
        profile_->GetPrefs()->GetRawUserPrefValue(prefs::kTahaiAppliedSkin);
    if (raw && !raw->is_dict()) {
      return;
    }
    color_supplier_.reset();
    operational_manifest_.reset();
    operational_archive_sha256_.reset();
    profile_->GetPrefs()->ClearPref(prefs::kTahaiAppliedSkin);
  }
}

void SkinProfileService::ResetOwnedAppearance() {
  if (!profile_ ||
      profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiAppliedSkin)) {
    return;
  }
  const auto alive = GetWeakPtr();
  if (OwnsCurrentAppearance()) {
    auto applying = ScopedAppearanceChange();
    color_supplier_.reset();
    operational_manifest_.reset();
    operational_archive_sha256_.reset();
    theme_observation_.GetSource()->UseDefaultTheme();
    if (!alive || !profile_ ||
        profile_->GetPrefs()->IsManagedPreference(prefs::kTahaiAppliedSkin)) {
      return;
    }
  }
  const auto* raw =
      profile_->GetPrefs()->GetRawUserPrefValue(prefs::kTahaiAppliedSkin);
  if (raw && !raw->is_dict()) {
    return;
  }
  profile_->GetPrefs()->ClearPref(prefs::kTahaiAppliedSkin);
}

bool SkinProfileService::ResetAppearance() {
  if (changing_appearance_ || !CanChangeAppearance() || busy_) {
    return false;
  }
  const auto alive = GetWeakPtr();
  const auto generation = publisher_generation_;
  EndLivePreview();
  if (!alive || publisher_generation_ != generation || !CanChangeAppearance()) {
    return false;
  }
  auto applying = ScopedAppearanceChange();
  color_supplier_.reset();
  operational_manifest_.reset();
  operational_archive_sha256_.reset();
  theme_observation_.GetSource()->UseDefaultTheme();
  if (!alive || publisher_generation_ != generation || !CanChangeAppearance()) {
    return false;
  }
  profile_->GetPrefs()->ClearPref(prefs::kTahaiAppliedSkin);
  if (!alive || publisher_generation_ != generation || !CanChangeAppearance()) {
    return false;
  }
  ClearWindowBindings();
  return alive && publisher_generation_ == generation && CanChangeAppearance();
}

void SkinProfileService::ReleasePreview(std::string_view token) {
  // Closing an old review must not cancel a newer operation in this profile.
  if (GetPreview(token)) {
    if (!ClearPreview()) {
      return;
    }
  }
}

void SkinProfileService::InstallPreview(std::string token, Callback callback) {
  if (!PreviewCanBeInstalled(token) ||
      (expected_current_sha256_ &&
       *expected_current_sha256_ != preview_->archive_sha256 &&
       (!revision_review_ || !revision_acknowledged_))) {
    std::move(callback).Run(Result(!enabled() ? SkinOperationStatus::kDisabled
                                   : !installation_allowed()
                                       ? SkinOperationStatus::kInstallDisallowed
                                       : SkinOperationStatus::kStalePreview));
    return;
  }
  if (!IsTrustedOperationalSkin(*preview_)) {
    if (!ClearPreview()) {
      return;
    }
    std::move(callback).Run(Result(SkinOperationStatus::kUntrusted));
    return;
  }
  if (!Start(true, std::move(callback))) {
    return;
  }
  StoredSkinArchive archive{preview_->manifest.id, preview_->manifest_json,
                            preview_->archive_sha256, candidate_archive_};
  ++pending_catalog_mutations_;
  CancelWindowRestores();
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
  if (!ClearPreview()) {
    return;
  }
  EnsureStore();
  ++pending_catalog_mutations_;
  CancelWindowRestores();
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
  const auto alive = GetWeakPtr();
  CHECK_GT(pending_catalog_mutations_, 0u);
  --pending_catalog_mutations_;
  // A committed removal/update retires the old appearance even when its UI
  // callback was cancelled. Compare the exact revision, not just its name.
  if (result.has_value()) {
    // In-flight decoders must not publish a revision after any committed
    // catalog mutation. A retry requires an explicit subsequent restore.
    CancelWindowRestores();
    const size_t removed = std::erase_if(window_bindings_, [&](const auto& entry) {
      return entry.second.skin_id == id &&
             entry.second.archive_sha256 == old_sha256;
    });
    if (removed) {
      window_binding_changes_.Notify();
      if (!alive) {
        return;
      }
    }
  }
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
  if (!ClearPreview()) {
    return;
  }
  Finish(std::move(result));
}

bool SkinProfileService::ClearPreview() {
  const auto alive = GetWeakPtr();
  const auto operation = operation_weak_factory_.GetWeakPtr();
  const auto generation = publisher_generation_;
  // Retire the reviewed authority before notifying theme observers. A nested
  // policy change or shutdown cannot revive or continue this older operation.
  preview_.reset();
  preview_token_.clear();
  candidate_archive_.clear();
  expected_current_sha256_.reset();
  loaded_record_.reset();
  revision_review_.reset();
  revision_acknowledged_ = false;
  preview_installable_ = false;
  reading_installed_ = false;
  EndLivePreview();
  return alive && operation && publisher_generation_ == generation;
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
  const auto alive = GetWeakPtr();
  publisher_generation_ = base::UnguessableToken::Create();
  // Cancel all stages, including store replies not yet handed to the utility.
  // Restoring identical keys must not revive work from a revoked generation.
  startup_weak_factory_.InvalidateWeakPtrs();
  startup_decoder_.reset();
  // A trust-policy update immediately removes the declarative operational
  // authority. Reapplying/reloading must re-decode and verify against the new
  // effective keys; never retain capability from a revoked trust generation.
  operational_manifest_.reset();
  operational_archive_sha256_.reset();
  ClearWindowBindings();
  if (!alive) {
    return;
  }
  if (!enabled()) {
    ResetOwnedAppearance();
    if (!alive) {
      return;
    }
  }
  if (!ClearPreview()) {
    return;
  }
  if (!alive) {
    return;
  }
  // Already-authorized background transactions may finish storing bytes, but
  // no revoked preview/callback can activate or publish them. No auto retry.
  Finish(Result(!enabled() ? SkinOperationStatus::kDisabled
                           : SkinOperationStatus::kCancelled));
}

void SkinProfileService::Cancel() {
  if (!ClearPreview()) {
    return;
  }
  Finish(Result(SkinOperationStatus::kCancelled));
}

void SkinProfileService::Shutdown() {
  if (shutdown_) {
    return;
  }
  shutdown_ = true;
  const auto alive = GetWeakPtr();
  startup_weak_factory_.InvalidateWeakPtrs();
  ClearWindowBindings();
  if (!alive) {
    return;
  }
  startup_decoder_.reset();
  theme_observation_.Reset();
  lifetime_weak_factory_.InvalidateWeakPtrs();
  policy_registrar_.RemoveAll();
  if (!ClearPreview()) {
    return;
  }
  store_.Reset();
  profile_ = nullptr;
  Finish(Result(SkinOperationStatus::kCancelled));
}

}  // namespace tahai::skins
