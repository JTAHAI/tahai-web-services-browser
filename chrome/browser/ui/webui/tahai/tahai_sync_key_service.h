// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_KEY_SERVICE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_KEY_SERVICE_H_

#include <array>
#include <cstddef>
#include <deque>
#include <optional>
#include <string>

#include "base/functional/callback.h"
#include "base/memory/raw_ptr.h"
#include "base/memory/scoped_refptr.h"
#include "base/memory/weak_ptr.h"
#include "chrome/browser/ui/webui/tahai/tahai_sync_envelope.h"

class PrefService;

namespace os_crypt_async {
class Encryptor;
class OSCryptAsync;
}  // namespace os_crypt_async

namespace tahai {

inline constexpr size_t kTahaiSyncKeyringMaxRetainedKeys = 3;

enum class TahaiSyncKeyResult {
  kOk,
  kOsCryptUnavailable,
  kOsCryptTemporarilyUnavailable,
  kPrivateModeUnavailable,
  kCorruptStorage,
  kKeyNotFound,
  kPersistenceFailed,
};

// Key material exists only in a callback on the browser process. It is never
// surfaced to WebUI, sent to a provider, or written to plaintext preferences.
struct TahaiSyncEnvelopeKey {
  std::string key_id;
  std::array<uint8_t, kTahaiSyncEnvelopeKeyBytes> key;
};

struct TahaiSyncKeyringStatus {
  bool has_stored_keyring = false;
  bool has_active_key = false;
  size_t stored_key_count = 0;
  std::string active_key_id;
};

// Keeps the TAHAI-owned envelope-key lifecycle separate from Chromium Sync and
// every cloud provider. The only persistence path is profile preferences
// wrapped by Chromium's OS-backed encryptor.
class TahaiSyncKeyService {
 public:
  using KeyCallback =
      base::OnceCallback<void(TahaiSyncKeyResult,
                              std::optional<TahaiSyncEnvelopeKey>)>;

  TahaiSyncKeyService(PrefService* prefs,
                      os_crypt_async::OSCryptAsync* os_crypt_async,
                      bool persistence_allowed = true);
  ~TahaiSyncKeyService();

  TahaiSyncKeyService(const TahaiSyncKeyService&) = delete;
  TahaiSyncKeyService& operator=(const TahaiSyncKeyService&) = delete;

  TahaiSyncKeyringStatus GetStatus() const;

  // Creates the initial random AES-256 key when no keyring exists.
  void EnsureActiveKey(KeyCallback callback);

  // Retains a bounded decrypt-only history so existing capsules can be opened
  // after a rotation. Recovery/export is deliberately not implemented here.
  void RotateActiveKey(KeyCallback callback);

  // Looks up a previously persisted key by its public opaque identifier.
  void GetKeyForId(std::string key_id, KeyCallback callback);

 private:
  enum class Operation {
    kEnsureActive,
    kRotateActive,
    kLookup,
  };

  struct PendingOperation {
    Operation operation;
    std::string key_id;
    KeyCallback callback;
  };

  void Start(Operation operation, std::string key_id, KeyCallback callback);
  void StartNextOperation();
  void OnEncryptorReady(scoped_refptr<os_crypt_async::Encryptor> encryptor);
  void FinishOperation(PendingOperation pending,
                       TahaiSyncKeyResult result,
                       std::optional<TahaiSyncEnvelopeKey> key);

  const raw_ptr<PrefService> prefs_;
  const raw_ptr<os_crypt_async::OSCryptAsync> os_crypt_async_;
  // Off-the-record preference overlays can read the regular profile's stored
  // values. Do not use one for a capsule key lifecycle, even transiently.
  const bool persistence_allowed_;
  // OS Crypt callbacks are asynchronous. Serializing mutations prevents two
  // rapid exports/rotations from both reading the same old keyring and then
  // overwriting one another's newly persisted active key.
  std::deque<PendingOperation> pending_operations_;
  bool operation_in_flight_ = false;
  base::WeakPtrFactory<TahaiSyncKeyService> weak_ptr_factory_{this};
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SYNC_KEY_SERVICE_H_
