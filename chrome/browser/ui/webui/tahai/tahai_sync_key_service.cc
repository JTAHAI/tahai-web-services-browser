// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_sync_key_service.h"

#include <algorithm>
#include <array>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "base/base64.h"
#include "base/containers/span.h"
#include "base/functional/bind.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/task/sequenced_task_runner.h"
#include "base/time/time.h"
#include "base/values.h"
#include "chrome/common/pref_names.h"
#include "components/os_crypt/async/browser/os_crypt_async.h"
#include "components/os_crypt/async/common/encryptor.h"
#include "components/prefs/pref_service.h"
#include "crypto/random.h"
#include "crypto/sha2.h"

namespace tahai {
namespace {

constexpr int kKeyringSchemaVersion = 1;
constexpr size_t kKeyringFieldCount = 3;
constexpr size_t kKeyringEntryFieldCount = 3;
constexpr std::string_view kSchemaVersionField = "schema_version";
constexpr std::string_view kActiveKeyIdField = "active_key_id";
constexpr std::string_view kEntriesField = "entries";
constexpr std::string_view kKeyIdField = "key_id";
constexpr std::string_view kCreatedMicrosField = "created_micros";
constexpr std::string_view kProtectedKeyField = "protected_key";

struct StoredKey {
  TahaiSyncEnvelopeKey key;
  int64_t created_micros = 0;
};

struct Keyring {
  std::string active_key_id;
  std::vector<StoredKey> entries;
};

struct LoadedKeyring {
  TahaiSyncKeyResult result = TahaiSyncKeyResult::kCorruptStorage;
  std::optional<Keyring> keyring;
};

bool IsOpaqueKeyId(std::string_view value) {
  if (value.size() != crypto::kSHA256Length * 2 ||
      !base::IsStringASCII(value)) {
    return false;
  }
  return std::ranges::all_of(value, [](char character) {
    return base::IsAsciiDigit(character) ||
           (character >= 'a' && character <= 'f');
  });
}

std::string KeyId(base::span<const uint8_t> key) {
  return base::ToLowerASCII(base::HexEncode(crypto::SHA256Hash(key)));
}

std::string KeyAsString(
    const std::array<uint8_t, kTahaiSyncEnvelopeKeyBytes>& key) {
  return std::string(reinterpret_cast<const char*>(key.data()), key.size());
}

std::optional<TahaiSyncEnvelopeKey> GenerateKey() {
  std::vector<uint8_t> random =
      crypto::RandBytesAsVector(kTahaiSyncEnvelopeKeyBytes);
  if (random.size() != kTahaiSyncEnvelopeKeyBytes) {
    return std::nullopt;
  }
  TahaiSyncEnvelopeKey generated;
  std::copy(random.begin(), random.end(), generated.key.begin());
  generated.key_id = KeyId(generated.key);
  return generated;
}

std::optional<TahaiSyncEnvelopeKey> DecodeProtectedKey(
    std::string_view encoded,
    os_crypt_async::Encryptor* encryptor,
    TahaiSyncKeyResult* result) {
  const std::optional<std::vector<uint8_t>> protected_key =
      base::Base64Decode(encoded);
  if (!protected_key || protected_key->empty()) {
    *result = TahaiSyncKeyResult::kCorruptStorage;
    return std::nullopt;
  }
  os_crypt_async::Encryptor::DecryptFlags flags;
  const std::optional<std::string> decrypted =
      encryptor->DecryptData(*protected_key, &flags);
  if (!decrypted) {
    *result = flags.temporarily_unavailable
                  ? TahaiSyncKeyResult::kOsCryptTemporarilyUnavailable
                  : TahaiSyncKeyResult::kCorruptStorage;
    return std::nullopt;
  }
  if (decrypted->size() != kTahaiSyncEnvelopeKeyBytes) {
    *result = TahaiSyncKeyResult::kCorruptStorage;
    return std::nullopt;
  }
  TahaiSyncEnvelopeKey key;
  std::copy(decrypted->begin(), decrypted->end(), key.key.begin());
  key.key_id = KeyId(key.key);
  *result = TahaiSyncKeyResult::kOk;
  return key;
}

LoadedKeyring LoadKeyring(const base::DictValue& stored,
                          os_crypt_async::Encryptor* encryptor) {
  if (stored.empty()) {
    return {.result = TahaiSyncKeyResult::kOk, .keyring = Keyring()};
  }
  if (stored.size() != kKeyringFieldCount ||
      stored.FindInt(kSchemaVersionField) != kKeyringSchemaVersion) {
    return {};
  }
  const std::string* active_key_id = stored.FindString(kActiveKeyIdField);
  const base::ListValue* entries = stored.FindList(kEntriesField);
  if (!active_key_id || !IsOpaqueKeyId(*active_key_id) || !entries ||
      entries->empty() || entries->size() > kTahaiSyncKeyringMaxRetainedKeys) {
    return {};
  }

  Keyring keyring;
  keyring.active_key_id = *active_key_id;
  for (const base::Value& item : *entries) {
    const base::DictValue* entry = item.GetIfDict();
    if (!entry || entry->size() != kKeyringEntryFieldCount) {
      return {};
    }
    const std::string* key_id = entry->FindString(kKeyIdField);
    const std::string* created_micros_string =
        entry->FindString(kCreatedMicrosField);
    const std::string* protected_key = entry->FindString(kProtectedKeyField);
    int64_t created_micros = 0;
    if (!key_id || !IsOpaqueKeyId(*key_id) || !created_micros_string ||
        !base::StringToInt64(*created_micros_string, &created_micros) ||
        created_micros < 0 || !protected_key ||
        std::ranges::any_of(
            keyring.entries,
            [key_id](const StoredKey& item) {
              return item.key.key_id == *key_id;
            })) {
      return {};
    }
    TahaiSyncKeyResult key_result;
    std::optional<TahaiSyncEnvelopeKey> key =
        DecodeProtectedKey(*protected_key, encryptor, &key_result);
    if (!key) {
      return {.result = key_result};
    }
    if (key->key_id != *key_id) {
      return {};
    }
    keyring.entries.push_back(
        {.key = std::move(*key), .created_micros = created_micros});
  }
  if (!std::ranges::any_of(keyring.entries, [&keyring](const StoredKey& item) {
        return item.key.key_id == keyring.active_key_id;
      })) {
    return {};
  }
  return {.result = TahaiSyncKeyResult::kOk, .keyring = std::move(keyring)};
}

bool PersistKeyring(PrefService* prefs,
                    const Keyring& keyring,
                    os_crypt_async::Encryptor* encryptor,
                    base::DictValue* persisted_snapshot) {
  if (prefs->IsManagedPreference(prefs::kTahaiSyncKeyring) ||
      !encryptor->IsEncryptionAvailable() || keyring.entries.empty() ||
      keyring.entries.size() > kTahaiSyncKeyringMaxRetainedKeys ||
      !IsOpaqueKeyId(keyring.active_key_id)) {
    return false;
  }
  base::DictValue serialized;
  serialized.Set(kSchemaVersionField, kKeyringSchemaVersion);
  serialized.Set(kActiveKeyIdField, keyring.active_key_id);
  base::ListValue serialized_entries;
  for (const StoredKey& entry : keyring.entries) {
    if (!IsOpaqueKeyId(entry.key.key_id) || entry.created_micros < 0) {
      return false;
    }
    const std::optional<std::vector<uint8_t>> protected_key =
        encryptor->EncryptString(KeyAsString(entry.key.key));
    if (!protected_key) {
      return false;
    }
    base::DictValue serialized_entry;
    serialized_entry.Set(kKeyIdField, entry.key.key_id);
    serialized_entry.Set(kCreatedMicrosField,
                         base::NumberToString(entry.created_micros));
    serialized_entry.Set(kProtectedKeyField,
                         base::Base64Encode(*protected_key));
    serialized_entries.Append(std::move(serialized_entry));
  }
  serialized.Set(kEntriesField, std::move(serialized_entries));
  // Capture before SetDict notifies observers. The caller checks its lifetime
  // before reading preferences again; this helper must not do so after writing.
  *persisted_snapshot = serialized.Clone();
  prefs->SetDict(prefs::kTahaiSyncKeyring, std::move(serialized));
  return true;
}

std::optional<TahaiSyncEnvelopeKey> FindKey(const Keyring& keyring,
                                            std::string_view key_id) {
  const auto found = std::ranges::find_if(
      keyring.entries,
      [key_id](const StoredKey& entry) { return entry.key.key_id == key_id; });
  return found == keyring.entries.end() ? std::nullopt
                                        : std::optional(found->key);
}

int64_t CurrentMicros() {
  return base::Time::Now().ToDeltaSinceWindowsEpoch().InMicroseconds();
}

}  // namespace

TahaiSyncKeyService::TahaiSyncKeyService(
    PrefService* prefs,
    os_crypt_async::OSCryptAsync* os_crypt_async,
    bool persistence_allowed)
    : prefs_(prefs),
      os_crypt_async_(os_crypt_async),
      persistence_allowed_(persistence_allowed) {}

TahaiSyncKeyService::~TahaiSyncKeyService() = default;

TahaiSyncKeyringStatus TahaiSyncKeyService::GetStatus() const {
  TahaiSyncKeyringStatus status;
  if (!persistence_allowed_ || !prefs_ || prefs_->IsManagedPreference(prefs::kTahaiSyncKeyring)) {
    return status;
  }
  const base::Value* raw =
      prefs_->GetRawUserPrefValue(prefs::kTahaiSyncKeyring);
  if (raw && !raw->is_dict()) {
    status.has_stored_keyring = true;
    return status;
  }
  const base::DictValue& stored = prefs_->GetDict(prefs::kTahaiSyncKeyring);
  status.has_stored_keyring = !stored.empty();
  if (!status.has_stored_keyring || stored.size() != kKeyringFieldCount ||
      stored.FindInt(kSchemaVersionField) != kKeyringSchemaVersion) {
    return status;
  }
  const std::string* active_key_id = stored.FindString(kActiveKeyIdField);
  const base::ListValue* entries = stored.FindList(kEntriesField);
  if (!active_key_id || !IsOpaqueKeyId(*active_key_id) || !entries ||
      entries->empty() || entries->size() > kTahaiSyncKeyringMaxRetainedKeys) {
    return status;
  }
  for (const base::Value& entry_value : *entries) {
    const base::DictValue* entry = entry_value.GetIfDict();
    const std::string* key_id =
        entry ? entry->FindString(kKeyIdField) : nullptr;
    const std::string* created_micros =
        entry ? entry->FindString(kCreatedMicrosField) : nullptr;
    const std::string* protected_key =
        entry ? entry->FindString(kProtectedKeyField) : nullptr;
    int64_t parsed_created_micros = 0;
    if (!entry || entry->size() != kKeyringEntryFieldCount || !key_id ||
        !IsOpaqueKeyId(*key_id) || !created_micros ||
        !base::StringToInt64(*created_micros, &parsed_created_micros) ||
        parsed_created_micros < 0 || !protected_key || protected_key->empty() ||
        std::ranges::any_of(
            *entries,
            [key_id, &entry_value](const base::Value& candidate) {
              const base::DictValue* candidate_entry = candidate.GetIfDict();
              const std::string* candidate_key_id =
                  candidate_entry ? candidate_entry->FindString(kKeyIdField)
                                  : nullptr;
              return &candidate != &entry_value && candidate_key_id &&
                     *candidate_key_id == *key_id;
            })) {
      return status;
    }
  }
  status.stored_key_count = entries->size();
  status.active_key_id = *active_key_id;
  status.has_active_key =
      std::ranges::any_of(*entries, [&status](const base::Value& entry_value) {
        const base::DictValue* entry = entry_value.GetIfDict();
        const std::string* key_id =
            entry ? entry->FindString(kKeyIdField) : nullptr;
        return key_id && *key_id == status.active_key_id;
      });
  return status;
}

void TahaiSyncKeyService::EnsureActiveKey(KeyCallback callback, Authorization authorization) {
  Start(Operation::kEnsureActive, std::string(), std::move(callback), std::move(authorization));
}

void TahaiSyncKeyService::RotateActiveKey(KeyCallback callback, Authorization authorization) {
  Start(Operation::kRotateActive, std::string(), std::move(callback), std::move(authorization));
}

void TahaiSyncKeyService::GetKeyForId(std::string key_id,
                                      KeyCallback callback, Authorization authorization) {
  if (!IsOpaqueKeyId(key_id)) {
    std::move(callback).Run(TahaiSyncKeyResult::kKeyNotFound, std::nullopt);
    return;
  }
  Start(Operation::kLookup, std::move(key_id), std::move(callback), std::move(authorization));
}

void TahaiSyncKeyService::Start(Operation operation,
                                std::string key_id,
                                KeyCallback callback, Authorization authorization) {
  if (!persistence_allowed_ || !prefs_) {
    std::move(callback).Run(TahaiSyncKeyResult::kPrivateModeUnavailable,
                            std::nullopt);
    return;
  }
  if (!os_crypt_async_) {
    std::move(callback).Run(TahaiSyncKeyResult::kOsCryptUnavailable,
                            std::nullopt);
    return;
  }
  const auto alive = weak_ptr_factory_.GetWeakPtr();
  const bool authorized = !authorization || authorization.Run();
  if (!alive || !authorized) {
    std::move(callback).Run(TahaiSyncKeyResult::kPersistenceFailed,
                            std::nullopt);
    return;
  }
  if (prefs_->IsManagedPreference(prefs::kTahaiSyncKeyring) ||
      pending_operations_.size() >= 16u) {
    std::move(callback).Run(TahaiSyncKeyResult::kPersistenceFailed, std::nullopt);
    return;
  }
  pending_operations_.push_back({.operation = operation,
                                 .key_id = std::move(key_id),
                                 .callback = std::move(callback),
                                 .authorization = std::move(authorization)});
  StartNextOperation();
}

void TahaiSyncKeyService::StartNextOperation() {
  if (operation_in_flight_ || pending_operations_.empty()) {
    return;
  }
  operation_in_flight_ = true;
  os_crypt_async_->GetInstance(base::BindOnce(
      &TahaiSyncKeyService::OnEncryptorReady, weak_ptr_factory_.GetWeakPtr()));
}

void TahaiSyncKeyService::AdvanceOperationQueue() {
  operation_in_flight_ = false;
  StartNextOperation();
}

void TahaiSyncKeyService::OnEncryptorReady(
    scoped_refptr<os_crypt_async::Encryptor> encryptor) {
  if (pending_operations_.empty()) {
    operation_in_flight_ = false;
    return;
  }
  PendingOperation pending = std::move(pending_operations_.front());
  pending_operations_.pop_front();

  const auto alive = weak_ptr_factory_.GetWeakPtr();
  const bool authorized = !pending.authorization || pending.authorization.Run();
  if (!alive) {
    std::move(pending.callback)
        .Run(TahaiSyncKeyResult::kPersistenceFailed, std::nullopt);
    return;
  }
  if (prefs_->IsManagedPreference(prefs::kTahaiSyncKeyring) || !authorized) {
    FinishOperation(std::move(pending), TahaiSyncKeyResult::kPersistenceFailed, std::nullopt);
    return;
  }
  if (!encryptor || !encryptor->IsDecryptionAvailable()) {
    FinishOperation(std::move(pending), TahaiSyncKeyResult::kOsCryptUnavailable,
                    std::nullopt);
    return;
  }
  // GetDict falls back to the registered empty dictionary for a wrong-typed
  // user value. Never mistake damaged storage for permission to replace keys.
  // Check after the asynchronous provider returns, not just at admission.
  const base::Value* raw =
      prefs_->GetRawUserPrefValue(prefs::kTahaiSyncKeyring);
  if (raw && !raw->is_dict()) {
    FinishOperation(std::move(pending), TahaiSyncKeyResult::kCorruptStorage,
                    std::nullopt);
    return;
  }
  LoadedKeyring loaded =
      LoadKeyring(prefs_->GetDict(prefs::kTahaiSyncKeyring), encryptor.get());
  if (!loaded.keyring) {
    FinishOperation(std::move(pending), loaded.result, std::nullopt);
    return;
  }
  Keyring keyring = std::move(*loaded.keyring);
  if (pending.operation == Operation::kLookup) {
    std::optional<TahaiSyncEnvelopeKey> key = FindKey(keyring, pending.key_id);
    FinishOperation(
        std::move(pending),
        key ? TahaiSyncKeyResult::kOk : TahaiSyncKeyResult::kKeyNotFound,
        std::move(key));
    return;
  }

  if (pending.operation == Operation::kEnsureActive &&
      !keyring.entries.empty()) {
    FinishOperation(std::move(pending), TahaiSyncKeyResult::kOk,
                    FindKey(keyring, keyring.active_key_id));
    return;
  }

  std::optional<TahaiSyncEnvelopeKey> generated = GenerateKey();
  if (!generated) {
    FinishOperation(std::move(pending), TahaiSyncKeyResult::kPersistenceFailed,
                    std::nullopt);
    return;
  }
  keyring.active_key_id = generated->key_id;
  keyring.entries.insert(
      keyring.entries.begin(),
      {.key = *generated, .created_micros = CurrentMicros()});
  if (keyring.entries.size() > kTahaiSyncKeyringMaxRetainedKeys) {
    keyring.entries.resize(kTahaiSyncKeyringMaxRetainedKeys);
  }
  base::DictValue persisted_snapshot;
  const bool persisted =
      PersistKeyring(prefs_, keyring, encryptor.get(), &persisted_snapshot);
  if (!alive) {
    std::move(pending.callback)
        .Run(TahaiSyncKeyResult::kPersistenceFailed, std::nullopt);
    return;
  }
  const bool still_authorized =
      !pending.authorization || pending.authorization.Run();
  if (!alive) {
    std::move(pending.callback)
        .Run(TahaiSyncKeyResult::kPersistenceFailed, std::nullopt);
    return;
  }
  const auto* committed = prefs_->GetRawUserPrefValue(prefs::kTahaiSyncKeyring);
  if (!persisted || !still_authorized ||
      prefs_->IsManagedPreference(prefs::kTahaiSyncKeyring) || !committed ||
      !committed->is_dict() || committed->GetDict() != persisted_snapshot) {
    FinishOperation(std::move(pending), TahaiSyncKeyResult::kPersistenceFailed,
                    std::nullopt);
    return;
  }
  FinishOperation(std::move(pending), TahaiSyncKeyResult::kOk,
                  std::move(generated));
}

void TahaiSyncKeyService::FinishOperation(
    PendingOperation pending,
    TahaiSyncKeyResult result,
    std::optional<TahaiSyncEnvelopeKey> key) {
  // The real provider is still initializing while delivering its first
  // callbacks; re-entering GetInstance there hits its initialization CHECK.
  // A non-nestable advance also preserves FIFO completion when later callbacks
  // run inline. Another initialization client may pump messages after this
  // callback returns; never advance inside that provider's still-active task.
  // Keep the reservation set so client/pref reentry only queues work.
  // No member access after the client callback, which may destroy this owner.
  const auto runner = base::SequencedTaskRunner::GetCurrentDefault();
  const auto alive = weak_ptr_factory_.GetWeakPtr();
  std::move(pending.callback).Run(result, std::move(key));
  runner->PostNonNestableTask(
      FROM_HERE,
      base::BindOnce(&TahaiSyncKeyService::AdvanceOperationQueue, alive));
}

}  // namespace tahai
