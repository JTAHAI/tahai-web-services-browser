// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_TAHAI_SKINS_SKIN_PACKAGE_STORE_H_
#define CHROME_BROWSER_TAHAI_SKINS_SKIN_PACKAGE_STORE_H_

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/files/file_path.h"
#include "base/sequence_checker.h"
#include "base/types/expected.h"
#include "chrome/common/tahai_skins/tahai_skin_manifest.h"
#include "sql/database.h"

namespace tahai::skins {

enum class SkinStoreError {
  kInvalidInput,
  kUnavailable,
  kCorrupt,
  kUnsupportedVersion,
  kNotFound,
  kAlreadyExists,
  kConflict,
  kQuotaExceeded,
};

struct StoredSkinInfo {
  TahaiSkinManifest manifest;
  std::string archive_sha256;
  int64_t archive_bytes = 0;
  std::optional<std::string> previous_sha256;
  int64_t previous_bytes = 0;
};

struct StoredSkinArchive {
  std::string id;
  std::string manifest_json;
  std::string archive_sha256;
  std::string archive;
};

// Background-sequence persistence only. A caller must admit package bytes with
// SkinDecodeSession before Install, or before using any Read result as a skin.
// The database stores opaque original archives, never extracted member paths.
// It cannot apply a skin, change preferences, or authenticate its publisher.
class SkinPackageStore final {
 public:
  static constexpr size_t kMaxInstalledSkins = 24;
  static constexpr int64_t kMaxRetainedArchiveBytes = 48 * 1024 * 1024;
  static constexpr int64_t kMaxDatabaseBytes = 80 * 1024 * 1024;

  explicit SkinPackageStore(base::FilePath profile_directory);
  ~SkinPackageStore();
  SkinPackageStore(const SkinPackageStore&) = delete;
  SkinPackageStore& operator=(const SkinPackageStore&) = delete;

  base::expected<std::vector<StoredSkinInfo>, SkinStoreError> List();
  base::expected<StoredSkinArchive, SkinStoreError> Read(
      std::string_view id,
      std::string_view expected_sha256,
      bool previous = false);
  // nullopt means ADD ONLY. Updates require the exact reviewed current hash.
  // An update retains one previous revision atomically. A same-hash no-op does
  // not replace the rollback revision. Quota failures never evict user skins.
  base::expected<void, SkinStoreError> Install(
      StoredSkinArchive admitted,
      std::optional<std::string> expected_current_sha256);
  base::expected<void, SkinStoreError> Remove(
      std::string_view id,
      std::string_view expected_current_sha256);

 private:
  base::expected<void, SkinStoreError> Open();
  void OnDatabaseError(int error, sql::Statement* statement);

  SEQUENCE_CHECKER(sequence_checker_);
  const base::FilePath database_path_;
  sql::Database database_;
  bool database_error_ = false;
  std::optional<SkinStoreError> open_error_;
};

}  // namespace tahai::skins

#endif  // CHROME_BROWSER_TAHAI_SKINS_SKIN_PACKAGE_STORE_H_
