// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_H_
#define CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_H_

#include <deque>
#include <map>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "base/callback_list.h"
#include "base/files/file_path.h"
#include "base/functional/callback.h"
#include "base/functional/callback_helpers.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/weak_ptr.h"
#include "base/scoped_observation.h"
#include "base/sequence_checker.h"
#include "base/threading/sequence_bound.h"
#include "base/timer/timer.h"
#include "base/unguessable_token.h"
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
  kUntrusted,
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

// Immutable installed revision retained for one window. It holds no archive,
// entered workflow values, website data or grants. Only this service can issue
// its process-local lookup token; preferences cannot manufacture a binding.
struct WindowSkinBinding {
  std::string skin_id;
  std::string archive_sha256;
  scoped_refptr<SkinColorSupplier> palette;
  std::optional<TahaiOperationalSkinManifest> operational_manifest;
};

struct SkinPublisherReview {
  std::string key_id;
  std::string public_key_sha256;
  bool locally_enrolled = false;
};

struct LocalPublisherEnrollmentReview {
  base::UnguessableToken generation;
  std::string key_id;
  std::string public_key_hex;
  std::string public_key_sha256;
};

struct SkinRevisionChange {
  // JSON Pointer (RFC 6901), not a filesystem path or executable selector.
  std::string path;
  std::string before;
  std::string after;
};

// Only for sandbox-admitted immutable design manifests, never run/profile
// values. Over-budget comparisons fail wholly, without a partial review.
std::optional<std::vector<SkinRevisionChange>> BuildSkinRevisionDiff(
    const base::DictValue& before, const base::DictValue& after);

struct SkinRevisionReview {
  std::string current_sha256;
  std::string candidate_sha256;
  bool current_operational = false;
  bool candidate_operational = false;
  // Missing for appearance-only or a historical publisher no longer trusted
  // by current trust. Historical bytes never receive authority from review.
  std::optional<SkinPublisherReview> current_publisher;
  std::optional<SkinPublisherReview> candidate_publisher;
  std::vector<TahaiOperationalCapability> added_capabilities;
  std::vector<TahaiOperationalCapability> removed_capabilities;
  std::vector<SkinRevisionChange> changes;
};

// Regular-profile-only native owner. No WebUI message handler exposes this
// service. Opening a file requires a browser-owned explicit chooser operation;
// preview, installing/rolling back and applying are separate user actions.
// Appearance belongs to the profile, never to the lifetime of its manager UI.
class SkinProfileService final : public KeyedService,
                                 public ThemeServiceObserver {
 public:
  using Callback = base::OnceCallback<void(SkinOperationResult)>;
  using WindowBindingCallback =
      base::OnceCallback<void(std::optional<base::UnguessableToken>)>;

  explicit SkinProfileService(Profile* profile);
  ~SkinProfileService() override;
  void Shutdown() override;

  bool enabled() const;
  bool installation_allowed() const;
  bool busy() const;
  bool CanEnrollLocalPublisher() const;
  // Public keys only. No WebUI, package import or website exposes these native
  // management calls. Reviews confer no trust until the separate confirmation.
  std::optional<LocalPublisherEnrollmentReview> ReviewLocalPublisher(
      std::string key_id, std::string public_key_hex) const;
  bool EnrollLocalPublisher(const LocalPublisherEnrollmentReview& review);
  std::optional<std::vector<SkinPublisherReview>> GetLocalPublishers() const;
  base::UnguessableToken local_publisher_generation() const;
  bool RemoveLocalPublisher(std::string_view key_id,
                            std::string_view fingerprint,
                            const base::UnguessableToken& generation);
  bool ClearLocalPublishers(const base::UnguessableToken& generation);
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
  // Browser-derived signing identity from CURRENT effective trust. The
  // package's author label is not a verified real-world publisher identity.
  std::optional<SkinPublisherReview> GetPreviewPublisherReview(
      std::string_view token) const;
  const SkinRevisionReview* GetPreviewRevisionReview(std::string_view token) const;
  // Native review only. Requires both exact revisions; a stale confirmation
  // cannot acknowledge another candidate. Does not install, apply or grant.
  bool AcknowledgeRevisionReview(std::string_view token,
                                std::string_view current_sha256,
                                std::string_view candidate_sha256);
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
  std::optional<base::UnguessableToken> BindActiveSkinToWindow();
  std::optional<base::UnguessableToken> BindPreviewToWindow(std::string_view token);
  std::optional<base::UnguessableToken> CopyWindowBinding(
      const base::UnguessableToken& token);
  // Valid only until a service mutation. Callers copy any definition needed
  // across native command dispatch or asynchronous work.
  const WindowSkinBinding* GetWindowBinding(
      const base::UnguessableToken& token) const;
  void ReleaseWindowBinding(const base::UnguessableToken& token);
  // Resolve an inert saved reference. Re-read and sandbox-decode the exact
  // CURRENT installed revision and reverify current publisher policy. An old
  // rollback archive is not silently reactivated. Requests are bounded and
  // decoded serially, separately from the manager's explicit preview.
  void RestoreWindowSkin(std::string id,
                         std::string archive_sha256,
                         WindowBindingCallback callback);
  base::CallbackListSubscription ObserveWindowBindings(base::RepeatingClosure callback);
  // Returns the active declarative operational definition only while this
  // profile still owns the applied TAHAI appearance. Callers must map actions
  // through browser-owned controllers and user grants; a skin never receives
  // a callable browser command.
  const TahaiOperationalSkinManifest* GetOperationalManifest() const;
  // Returns the exact archive revision backing the active operational
  // manifest. This is identity-only provenance for a locally created Mission;
  // callers receive no archive bytes or preference dictionary.
  std::optional<std::string> GetOperationalManifestArchiveSha256() const;
  void OnThemeChanged() override;
  void ReleasePreview(std::string_view token);
  void InstallPreview(std::string token, Callback callback);
  void Remove(std::string id, std::string current_sha256, Callback callback);
  void Cancel();

 private:
  friend class SkinProfileServiceTestPeer;
  using CatalogResult =
      base::expected<std::vector<StoredSkinInfo>, SkinStoreError>;
  using ArchiveResult = base::expected<StoredSkinArchive, SkinStoreError>;
  using StoreResult = base::expected<void, SkinStoreError>;

  bool Start(bool requires_install, Callback callback);
  bool IsTrustedOperationalSkin(const DecodedSkin& skin) const;
  bool CanChangeLocalPublishers() const;
  std::optional<SkinPublisherReview> PublisherForSkin(const DecodedSkin& skin) const;
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
  void OnRevisionArchive(std::vector<StoredSkinInfo> catalog, ArchiveResult archive);
  void OnRevisionDecoded(std::vector<StoredSkinInfo> catalog,
                         std::string manifest_json, SkinDecodeResult decoded);
  void FinishPreview(std::vector<StoredSkinInfo> catalog);
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
  base::ScopedClosureRunner ScopedAppearanceChange();
  void ResetOwnedAppearance();
  void OnPolicyChanged();
  bool ClearPreview();
  void Finish(SkinOperationResult result);
  void ClearWindowBindings();
  void StartNextWindowRestore();
  void OnWindowRestoreArchive(ArchiveResult archive);
  void OnWindowRestoreDecoded(SkinDecodeResult result);
  void FinishWindowRestore(std::optional<base::UnguessableToken> token);
  void CancelWindowRestores();

  struct PendingWindowRestore {
    std::string id;
    std::string archive_sha256;
    WindowBindingCallback callback;
  };

  SEQUENCE_CHECKER(sequence_checker_);
  raw_ptr<Profile> profile_;
  bool shutdown_ = false;
  base::UnguessableToken publisher_generation_ = base::UnguessableToken::Create();
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
  std::optional<SkinRevisionReview> revision_review_;
  bool revision_acknowledged_ = false;
  bool preview_installable_ = false;
  bool reading_installed_ = false;
  bool changing_appearance_ = false;
  scoped_refptr<SkinColorSupplier> color_supplier_;
  scoped_refptr<SkinColorSupplier> preview_color_supplier_;
  std::optional<TahaiOperationalSkinManifest> operational_manifest_;
  // Paired only with a successfully decoded, signature-verified manifest.
  // Preferences are a requested selection, not proof of its reviewed revision.
  std::optional<std::string> operational_archive_sha256_;
  std::map<base::UnguessableToken, WindowSkinBinding> window_bindings_;
  base::RepeatingClosureList window_binding_changes_;
  std::deque<PendingWindowRestore> window_restores_;
  std::unique_ptr<SkinDecodeSession> window_restore_decoder_;
  std::optional<std::string> window_restore_manifest_json_;
  size_t pending_catalog_mutations_ = 0;
  base::OneShotTimer live_preview_timer_;
  base::ScopedObservation<ThemeService, ThemeServiceObserver>
      theme_observation_{this};
  base::WeakPtrFactory<SkinProfileService> operation_weak_factory_{this};
  base::WeakPtrFactory<SkinProfileService> startup_weak_factory_{this};
  base::WeakPtrFactory<SkinProfileService> window_restore_weak_factory_{this};
  base::WeakPtrFactory<SkinProfileService> lifetime_weak_factory_{this};
};

}  // namespace tahai::skins

#endif  // CHROME_BROWSER_TAHAI_SKINS_SKIN_PROFILE_SERVICE_H_
