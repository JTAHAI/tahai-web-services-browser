// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/skin_package_store.h"

#include <algorithm>
#include <set>
#include <utility>

#include "base/containers/span.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/json/json_reader.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"
#include "crypto/sha2.h"
#include "sql/statement.h"
#include "sql/transaction.h"

namespace tahai::skins {
namespace {

bool ValidHash(std::string_view value) {
  return value.size() == 64 && std::ranges::all_of(value, [](char c) {
           return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
         });
}

bool ValidId(std::string_view value) {
  return !IsTahaiBuiltInSkinId(value) && value.size() >= 3 &&
         value.size() <= 64 && value.front() != '-' && value.back() != '-' &&
         std::ranges::all_of(value, [](char c) {
           return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'z') || c == '-';
         });
}

std::string Hash(std::string_view archive) {
  return base::ToLowerASCII(
      base::HexEncode(crypto::SHA256Hash(base::as_byte_span(archive))));
}

bool ParseManifest(std::string_view text, TahaiSkinManifest* manifest) {
  if (text.empty() || text.size() > kMaxManifestBytes) {
    return false;
  }
  const auto value = base::JSONReader::ReadDict(text, base::JSON_PARSE_RFC, 16);
  return value && ValidateTahaiSkinManifest(*value, manifest) ==
                      TahaiSkinManifestValidationResult::kValid;
}

constexpr int64_t kMaxArchiveBytesInt64 =
    static_cast<int64_t>(kMaxArchiveBytes);

}  // namespace

SkinPackageStore::SkinPackageStore(base::FilePath profile_directory)
    : database_path_(profile_directory.AppendASCII("TAHAI Skins")),
      database_(sql::DatabaseOptions()
                    .set_page_size(4096)
                    .set_cache_size(128)
                    .set_mmap_enabled(false)
                    .set_flush_to_media(true),
                sql::Database::Tag("TahaiSkins")) {
  database_.set_error_callback(base::BindRepeating(
      &SkinPackageStore::OnDatabaseError, base::Unretained(this)));
}

SkinPackageStore::~SkinPackageStore() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  database_.Close();
}

void SkinPackageStore::OnDatabaseError(int error, sql::Statement* statement) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  // No SQL values, archive paths, bytes or metadata are logged. Do not raze or
  // auto-recover the user's package database on corruption/I/O failure.
  database_error_ = true;
}

base::expected<void, SkinStoreError> SkinPackageStore::Open() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (open_error_) {
    return base::unexpected(*open_error_);
  }
  if (database_error_) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  if (database_.is_open()) {
    return base::ok();
  }
  if (!database_path_.IsAbsolute() || database_path_.ReferencesParent() ||
      !base::DirectoryExists(database_path_.DirName())) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  const bool existed = base::PathExists(database_path_);
  if (existed) {
    const auto size = base::GetFileSize(database_path_);
    if (!size || *size <= 0 || *size > kMaxDatabaseBytes) {
      return base::unexpected(SkinStoreError::kCorrupt);
    }
  }
  if (!database_.Open(database_path_)) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  const auto fail = [this](SkinStoreError error) {
    // Keep the connection inert until destruction; statements on this stack
    // must be destroyed before Close. Never raze an incompatible database.
    open_error_ = error;
    return base::unexpected(error);
  };
  sql::Statement version(database_.GetUniqueStatement("PRAGMA user_version"));
  if (!version.Step() ||
      version.GetColumnType(0) != sql::ColumnType::kInteger) {
    return fail(SkinStoreError::kCorrupt);
  }
  const int version_number = version.ColumnInt(0);
  version.Clear();
  if (existed && version_number != 1) {
    return fail(SkinStoreError::kUnsupportedVersion);
  }
  if (!existed && version_number != 0) {
    return fail(SkinStoreError::kCorrupt);
  }
  sql::Statement page_size(database_.GetUniqueStatement("PRAGMA page_size"));
  if (!page_size.Step() || page_size.ColumnInt(0) != 4096) {
    return fail(SkinStoreError::kCorrupt);
  }
  page_size.Clear();
  // Bound physical growth, including metadata/free pages, separately from the
  // retained archive quota. Deleted package cells are overwritten by SQLite.
  if (!database_.Execute("PRAGMA max_page_count=20480") ||
      !database_.Execute("PRAGMA secure_delete=ON")) {
    return fail(SkinStoreError::kUnavailable);
  }
  if (!existed) {
    sql::Transaction transaction(&database_);
    if (!transaction.Begin() ||
        !database_.Execute(
            "CREATE TABLE skins("
            "id TEXT PRIMARY KEY NOT NULL,"
            "manifest_json TEXT NOT NULL,archive_hash TEXT NOT NULL,"
            "archive BLOB NOT NULL,previous_manifest TEXT,"
            "previous_hash TEXT,previous_archive BLOB)") ||
        !database_.Execute("PRAGMA user_version=1") || !transaction.Commit()) {
      // Let the transaction roll back before closing this connection.
      open_error_ = SkinStoreError::kUnavailable;
      return base::unexpected(*open_error_);
    }
  } else if (!database_.DoesTableExist("skins")) {
    return fail(SkinStoreError::kCorrupt);
  }
  return base::ok();
}

base::expected<std::vector<StoredSkinInfo>, SkinStoreError>
SkinPackageStore::List() {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (auto opened = Open(); !opened.has_value()) {
    return base::unexpected(opened.error());
  }
  sql::Statement query(database_.GetUniqueStatement(
      "SELECT id,manifest_json,archive_hash,length(archive),"
      "previous_manifest,previous_hash,length(previous_archive),"
      "typeof(archive),typeof(previous_archive) FROM skins ORDER BY id LIMIT "
      "25"));
  std::vector<StoredSkinInfo> entries;
  std::set<std::string> ids;
  int64_t total = 0;
  while (query.Step()) {
    if (entries.size() >= kMaxInstalledSkins ||
        query.GetColumnType(0) != sql::ColumnType::kText ||
        query.GetColumnType(1) != sql::ColumnType::kText ||
        query.GetColumnType(2) != sql::ColumnType::kText ||
        query.GetColumnType(3) != sql::ColumnType::kInteger ||
        query.ColumnStringView(7) != "blob") {
      return base::unexpected(SkinStoreError::kCorrupt);
    }
    StoredSkinInfo entry;
    if (!ValidId(query.ColumnStringView(0)) ||
        !ValidHash(query.ColumnStringView(2)) ||
        !ParseManifest(query.ColumnStringView(1), &entry.manifest) ||
        entry.manifest.id != query.ColumnStringView(0) ||
        !ids.insert(entry.manifest.id).second) {
      return base::unexpected(SkinStoreError::kCorrupt);
    }
    entry.archive_sha256 = query.ColumnString(2);
    entry.archive_bytes = query.ColumnInt64(3);
    const bool previous = query.GetColumnType(4) != sql::ColumnType::kNull;
    if (previous) {
      TahaiSkinManifest previous_manifest;
      if (query.GetColumnType(4) != sql::ColumnType::kText ||
          query.GetColumnType(5) != sql::ColumnType::kText ||
          query.GetColumnType(6) != sql::ColumnType::kInteger ||
          query.ColumnStringView(8) != "blob" ||
          !ValidHash(query.ColumnStringView(5)) ||
          !ParseManifest(query.ColumnStringView(4), &previous_manifest) ||
          previous_manifest.id != entry.manifest.id) {
        return base::unexpected(SkinStoreError::kCorrupt);
      }
      entry.previous_sha256 = query.ColumnString(5);
      entry.previous_bytes = query.ColumnInt64(6);
      if (*entry.previous_sha256 == entry.archive_sha256) {
        return base::unexpected(SkinStoreError::kCorrupt);
      }
    } else if (query.GetColumnType(5) != sql::ColumnType::kNull ||
               query.GetColumnType(6) != sql::ColumnType::kNull ||
               query.ColumnStringView(8) != "null") {
      return base::unexpected(SkinStoreError::kCorrupt);
    }
    if (entry.archive_bytes <= 0 ||
        entry.archive_bytes > kMaxArchiveBytesInt64 ||
        (previous && (entry.previous_bytes <= 0 ||
                      entry.previous_bytes > kMaxArchiveBytesInt64))) {
      return base::unexpected(SkinStoreError::kCorrupt);
    }
    total += entry.archive_bytes + entry.previous_bytes;
    if (total > kMaxRetainedArchiveBytes) {
      return base::unexpected(SkinStoreError::kCorrupt);
    }
    entries.push_back(std::move(entry));
  }
  if (!query.Succeeded() || database_error_) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  return entries;
}

base::expected<StoredSkinArchive, SkinStoreError> SkinPackageStore::Read(
    std::string_view id,
    std::string_view expected_sha256,
    bool previous) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!ValidId(id) || !ValidHash(expected_sha256)) {
    return base::unexpected(SkinStoreError::kInvalidInput);
  }
  auto entries = List();
  if (!entries.has_value()) {
    return base::unexpected(entries.error());
  }
  const auto found = std::ranges::find(
      *entries, id,
      [](const StoredSkinInfo& entry) { return entry.manifest.id; });
  if (found == entries->end()) {
    return base::unexpected(SkinStoreError::kNotFound);
  }
  if ((previous && (!found->previous_sha256 ||
                    *found->previous_sha256 != expected_sha256)) ||
      (!previous && found->archive_sha256 != expected_sha256)) {
    return base::unexpected(SkinStoreError::kConflict);
  }
  sql::Statement query(
      previous ? database_.GetUniqueStatement(
                     "SELECT previous_manifest,previous_archive FROM skins "
                     "WHERE id=? AND previous_hash=? AND "
                     "length(previous_archive)<=9437184")
               : database_.GetUniqueStatement(
                     "SELECT manifest_json,archive FROM skins "
                     "WHERE id=? AND archive_hash=? AND "
                     "length(archive)<=9437184"));
  query.BindString(0, id);
  query.BindString(1, expected_sha256);
  if (!query.Step() || query.GetColumnType(0) != sql::ColumnType::kText ||
      query.GetColumnType(1) != sql::ColumnType::kBlob) {
    return base::unexpected(SkinStoreError::kCorrupt);
  }
  StoredSkinArchive result;
  result.id = id;
  result.manifest_json = query.ColumnString(0);
  result.archive_sha256 = expected_sha256;
  const auto blob = query.ColumnBlob(1);
  if (blob.empty() || blob.size() > kMaxArchiveBytes) {
    return base::unexpected(SkinStoreError::kCorrupt);
  }
  result.archive.assign(blob.begin(), blob.end());
  if (Hash(result.archive) != expected_sha256) {
    return base::unexpected(SkinStoreError::kCorrupt);
  }
  return result;
}

base::expected<void, SkinStoreError> SkinPackageStore::Install(
    StoredSkinArchive admitted,
    std::optional<std::string> expected_current_sha256) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  TahaiSkinManifest manifest;
  if (!ValidId(admitted.id) || !ValidHash(admitted.archive_sha256) ||
      !ParseManifest(admitted.manifest_json, &manifest) ||
      manifest.id != admitted.id || admitted.archive.empty() ||
      admitted.archive.size() > kMaxArchiveBytes ||
      Hash(admitted.archive) != admitted.archive_sha256 ||
      (expected_current_sha256 && !ValidHash(*expected_current_sha256))) {
    return base::unexpected(SkinStoreError::kInvalidInput);
  }
  if (auto opened = Open(); !opened.has_value()) {
    return base::unexpected(opened.error());
  }
  sql::Transaction transaction(&database_);
  if (!transaction.Begin()) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  auto entries = List();
  if (!entries.has_value()) {
    return base::unexpected(entries.error());
  }
  const auto found = std::ranges::find(
      *entries, admitted.id,
      [](const StoredSkinInfo& entry) { return entry.manifest.id; });
  const bool updating = found != entries->end();
  if (updating && !expected_current_sha256) {
    return base::unexpected(SkinStoreError::kAlreadyExists);
  }
  if (!updating && expected_current_sha256) {
    return base::unexpected(SkinStoreError::kNotFound);
  }
  if (updating && found->archive_sha256 != *expected_current_sha256) {
    return base::unexpected(SkinStoreError::kConflict);
  }
  if (updating && found->archive_sha256 == admitted.archive_sha256) {
    return base::ok();
  }
  int64_t retained = admitted.archive.size();
  for (const auto& entry : *entries) {
    retained += entry.archive_bytes + entry.previous_bytes;
  }
  if (updating) {
    retained -= found->previous_bytes;
  }
  if (retained > kMaxRetainedArchiveBytes ||
      (!updating && entries->size() >= kMaxInstalledSkins)) {
    return base::unexpected(SkinStoreError::kQuotaExceeded);
  }
  sql::Statement write(
      updating ? database_.GetUniqueStatement(
                     "UPDATE skins SET previous_manifest=manifest_json,"
                     "previous_hash=archive_hash,previous_archive=archive,"
                     "manifest_json=?,archive_hash=?,archive=? WHERE id=? AND "
                     "archive_hash=?")
               : database_.GetUniqueStatement(
                     "INSERT INTO skins(manifest_json,archive_hash,archive,id) "
                     "VALUES(?,?,?,?)"));
  write.BindString(0, admitted.manifest_json);
  write.BindString(1, admitted.archive_sha256);
  write.BindBlob(2, base::as_byte_span(admitted.archive));
  write.BindString(3, admitted.id);
  if (updating) {
    write.BindString(4, *expected_current_sha256);
  }
  if (!write.Run() || database_.GetLastChangeCount() != 1 || database_error_ ||
      !transaction.Commit()) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  return base::ok();
}

base::expected<void, SkinStoreError> SkinPackageStore::Remove(
    std::string_view id,
    std::string_view expected_current_sha256) {
  DCHECK_CALLED_ON_VALID_SEQUENCE(sequence_checker_);
  if (!ValidId(id) || !ValidHash(expected_current_sha256)) {
    return base::unexpected(SkinStoreError::kInvalidInput);
  }
  if (auto opened = Open(); !opened.has_value()) {
    return base::unexpected(opened.error());
  }
  sql::Transaction transaction(&database_);
  if (!transaction.Begin()) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  auto entries = List();
  if (!entries.has_value()) {
    return base::unexpected(entries.error());
  }
  const auto found = std::ranges::find(
      *entries, id,
      [](const StoredSkinInfo& entry) { return entry.manifest.id; });
  if (found == entries->end()) {
    return base::unexpected(SkinStoreError::kNotFound);
  }
  if (found->archive_sha256 != expected_current_sha256) {
    return base::unexpected(SkinStoreError::kConflict);
  }
  sql::Statement remove(database_.GetUniqueStatement(
      "DELETE FROM skins WHERE id=? AND archive_hash=?"));
  remove.BindString(0, id);
  remove.BindString(1, expected_current_sha256);
  if (!remove.Run() || database_.GetLastChangeCount() != 1 || database_error_ ||
      !transaction.Commit()) {
    return base::unexpected(SkinStoreError::kUnavailable);
  }
  return base::ok();
}

}  // namespace tahai::skins
