// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_H_
#define CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_H_

#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/scoped_observation.h"
#include "base/sequence_checker.h"
#include "base/threading/sequence_bound.h"
#include "base/timer/timer.h"
#include "chrome/browser/tahai_skins/skin_color_supplier.h"
#include "chrome/browser/tahai_skins/skin_decode_session.h"
#include "chrome/browser/tahai_skins/skin_package_store.h"
#include "chrome/browser/themes/theme_service.h"
#include "chrome/browser/themes/theme_service_observer.h"
#include "components/keyed_service/core/keyed_service.h"
#include "components/prefs/pref_change_registrar.h"

class Profile;

namespace tahai::skins {

enum class SkinOperationStatus {
  kOk,
  kDisabled,
  kInstallDisallowed,
  kBusy,
  kCancelled,
  kInvalidInput,
  kReadFailed,
  kDecodeFailed,
  kStoreFailed,
  kStalePreview,
};

struct SkinOperationResult {
  SkinOperationStatus status;
  std::optional<SkinStoreError> store_error;
  std::optional<DecodeOutcome> decode_error;
  std::string preview_token;
  std::vector<StoredSkinInfo> catalog;
};

// Regular-profile-only native owner. No WebUI message handler exposes this
// service. Opening a file requires a browser-owned explicit chooser operation;
// preview, installing/rolling back and applying are separate user actions.
// Appearance belongs to the profile, never to the lifetime of its manager UI.
class SkinProfileService final : public KeyedService,
                                 public ThemeServiceObserver {
 public:
  using Callback = base::OnceCallback<void(SkinOperationResult)>;

  explicit SkinProfileService(Profile* profile);
  ~SkinProfileService() override;
  void Shutdown() override;

  bool enabled() const;
  bool installation_allowed() const;
  bool busy() const;
  base::WeakPtr<SkinProfileService> GetWeakPtr();
  void List(Callback callback);
  void PreviewFile(const base::FilePath& selected_file, Callback callback);
  // Uses the reviewed CURRENT hash even when asking for the rollback revision.
  void PreviewInstalled(std::string id,
                        std::string current_sha256,
                        bool previous,
                        Callback callback);
  // The pointer is only valid on this UI sequence until any operation, policy
  // change, cancellation or shutdown. Consumers must never cache it.
  const DecodedSkin* GetPreview(std::string_view token) const;
  bool PreviewCanBeInstalled(std::string_view token) const;
  bool CanChangeAppearance() const;
  bool CanApplyPreview(std::string_view token) const;
  bool ApplyPreview(std::string_view token);
  bool ApplyBuiltIn(std::string_view id);
  // Live preview never writes theme preferences. Timeout, cancellation and
  // process restart leave the previously committed appearance intact.
  bool BeginLivePreview(std::string_view token);
  void EndLivePreview();
  bool live_preview_active() const { return live_preview_timer_.IsRunning(); }
  std::string ExportPreview(std::string_view token) const;
  bool ResetAppearance();
  SkinColorSupplier* GetColorSupplier() const;
  void OnThemeChanged() override;
  void ReleasePreview(std::string_view token);
  void InstallPreview(std::string token, Callback callback);
  void Remove(std::string id, std::string current_sha256, Callback callback);
  void Cancel();

 private:
  using CatalogResult =
      base::expected<std::vector<StoredSkinInfo>, SkinStoreError>;
  using ArchiveResult = base::expected<StoredSkinArchive, SkinStoreError>;
  using StoreResult = base::expected<void, SkinStoreError>;

  bool Start(bool requires_install, Callback callback);
  void EnsureStore();
  void OnCatalog(CatalogResult result);
  void OnStartupCatalog(std::string id,
                        std::string sha256,
                        CatalogResult result);
  void OnStartupArchive(std::string id,
                        std::string sha256,
                        ArchiveResult archive);
  void OnStartupDecoded(std::string id,
                        std::string sha256,
                        SkinDecodeResult result);
  void OnFileRead(std::optional<std::string> archive);
  void DecodeCandidate();
  void OnDecoded(SkinDecodeResult result);
  void OnPreviewCatalog(CatalogResult result);
  void OnInstalledCatalog(std::string id,
                          std::string current_sha256,
                          bool previous,
                          CatalogResult result);
  void OnArchiveRead(ArchiveResult result);
  void OnStored(StoreResult result);
  void OnMutationCommitted(std::string id,
                           std::string old_sha256,
                           base::OnceCallback<void(StoreResult)> completion,
                           StoreResult result);
  bool OwnsCurrentAppearance() const;
  void ResetOwnedAppearance();
  void OnPolicyChanged();
  void ClearPreview();
  void Finish(SkinOperationResult result);

  SEQUENCE_CHECKER(sequence_checker_);
  raw_ptr<Profile> profile_;
  bool shutdown_ = false;
  bool busy_ = false;
  Callback callback_;
  base::SequenceBound<SkinPackageStore> store_;
  PrefChangeRegistrar policy_registrar_;
  std::unique_ptr<SkinDecodeSession> decoder_;
  std::unique_ptr<SkinDecodeSession> startup_decoder_;
  std::unique_ptr<DecodedSkin> preview_;
  std::string preview_token_;
  std::string candidate_archive_;
  std::optional<std::string> expected_current_sha256_;
  std::optional<StoredSkinArchive> loaded_record_;
  bool preview_installable_ = false;
  bool reading_installed_ = false;
  bool changing_appearance_ = false;
  scoped_refptr<SkinColorSupplier> color_supplier_;
  scoped_refptr<SkinColorSupplier> preview_color_supplier_;
  base::OneShotTimer live_preview_timer_;
  base::ScopedObservation<ThemeService, ThemeServiceObserver>
      theme_observation_{this};
  base::WeakPtrFactory<SkinProfileService> operation_weak_factory_{this};
  base::WeakPtrFactory<SkinProfileService> lifetime_weak_factory_{this};
};

}  // namespace tahai::skins

#endif  // CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_H_
