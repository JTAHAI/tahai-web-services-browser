// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_workflow_journal.h"

#include <algorithm>

#include "base/containers/span.h"
#include "base/files/file_util.h"
#include "base/functional/bind.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/uuid.h"
#include "crypto/sha2.h"
#include "sql/database.h"
#include "sql/statement.h"
#include "sql/transaction.h"

namespace tahai {
namespace {

constexpr char kAttemptsSchema[] =
    "CREATE TABLE attempts(attempt_key TEXT PRIMARY KEY NOT NULL,"
    "state TEXT NOT NULL CHECK(state IN ('intent','dispatched','rejected')))";

bool ValidHash(std::string_view hash) {
  return hash.size() == 64 && std::ranges::all_of(hash, [](char c) {
    return (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
  });
}

bool ValidId(std::string_view id) {
  return id.size() >= 3 && id.size() <= 64 && id.front() != '-' &&
      id.back() != '-' && std::ranges::all_of(id, [](char c) {
        return (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-';
      });
}

class Journal {
 public:
  Journal()
      : database_(sql::DatabaseOptions().set_wal_mode(false).set_no_sync(false)
                      .set_page_size(4096).set_cache_size(32)
                      .set_mmap_enabled(false).set_flush_to_media(true),
                  sql::Database::Tag("TahaiWorkflowJournal")) {
    database_.set_error_callback(base::BindRepeating(
        [](bool* failed, int, sql::Statement*) { *failed = true; }, &failed_));
  }

  bool Open(const base::FilePath& profile, bool create) {
    if (!profile.IsAbsolute() || profile.ReferencesParent() ||
        !base::DirectoryExists(profile)) {
      return false;
    }
    const auto path = profile.AppendASCII("TAHAI Workflow Journal");
    const bool existed = base::PathExists(path);
    if (!existed && !create) {
      return false;
    }
    if (existed) {
      auto size = base::GetFileSize(path);
      if (!size || *size <= 0 || *size > 8 * 1024 * 1024) {
        return false;
      }
    }
    if (!database_.Open(path)) {
      return false;
    }
    sql::Statement version(database_.GetUniqueStatement("PRAGMA user_version"));
    if (!version.Step() || version.GetColumnType(0) != sql::ColumnType::kInteger ||
        version.ColumnInt(0) != (existed ? 1 : 0)) {
      return false;
    }
    version.Clear();
    sql::Statement page(database_.GetUniqueStatement("PRAGMA page_size"));
    if (!page.Step() || page.ColumnInt(0) != 4096) {
      return false;
    }
    page.Clear();
    if (!database_.Execute("PRAGMA max_page_count=2048")) {
      return false;
    }
    if (!existed) {
      sql::Transaction transaction(&database_);
      if (!transaction.Begin() || !database_.Execute(kAttemptsSchema) ||
          !database_.Execute("PRAGMA user_version=1") || !transaction.Commit()) {
        return false;
      }
    }
    // A version number and table name are not enough: a changed table or an
    // INSERT trigger could acknowledge an intent without retaining its row.
    // This private, versioned database has one exact schema. Reject unfamiliar
    // objects without running their triggers, migrating, repairing or razing.
    sql::Statement schema(database_.GetUniqueStatement(
        "SELECT type,name,sql FROM sqlite_schema "
        "WHERE name NOT GLOB 'sqlite_*'"));
    if (!schema.Step() || schema.ColumnStringView(0) != "table" ||
        schema.ColumnStringView(1) != "attempts" ||
        schema.ColumnStringView(2) != kAttemptsSchema || schema.Step() ||
        !schema.Succeeded()) {
      return false;
    }
    return !failed_;
  }

  WorkflowAttempt Reserve(std::string_view key) {
    sql::Transaction transaction(&database_);
    if (!transaction.Begin()) {
      return WorkflowAttempt::kUnavailable;
    }
    sql::Statement query(database_.GetUniqueStatement(
        "SELECT state FROM attempts WHERE attempt_key=?"));
    query.BindString(0, key);
    if (query.Step()) {
      if (query.GetColumnType(0) != sql::ColumnType::kText) {
        return WorkflowAttempt::kUnavailable;
      }
      const auto state = query.ColumnString(0);
      // Reading a previous result can reconcile local display state but never
      // authorizes a second dispatch, even after profile preferences roll back.
      return state == "intent" ? WorkflowAttempt::kUnknown :
          state == "dispatched" ? WorkflowAttempt::kDispatched :
          state == "rejected" ? WorkflowAttempt::kRejected : WorkflowAttempt::kUnavailable;
    }
    if (!query.Succeeded() || failed_) {
      return WorkflowAttempt::kUnavailable;
    }
    query.Clear();
    sql::Statement count(database_.GetUniqueStatement("SELECT count(*) FROM attempts"));
    if (!count.Step() || count.ColumnInt64(0) >= 16384) {
      return WorkflowAttempt::kUnavailable;
    }
    count.Clear();
    sql::Statement insert(database_.GetUniqueStatement(
        "INSERT INTO attempts(attempt_key,state) VALUES(?,'intent')"));
    insert.BindString(0, key);
    if (!insert.Run() || database_.GetLastChangeCount() != 1 || failed_ ||
        !transaction.Commit()) {
      return WorkflowAttempt::kUnavailable;
    }
    return WorkflowAttempt::kReserved;
  }

  bool Finish(std::string_view key, bool dispatched) {
    sql::Transaction transaction(&database_);
    if (!transaction.Begin()) {
      return false;
    }
    sql::Statement update(database_.GetUniqueStatement(
        "UPDATE attempts SET state=? WHERE attempt_key=? AND state='intent'"));
    update.BindString(0, dispatched ? "dispatched" : "rejected");
    update.BindString(1, key);
    return update.Run() && !failed_ && database_.GetLastChangeCount() == 1 &&
           transaction.Commit();
  }

 private:
  bool failed_ = false;
  sql::Database database_;
};

}  // namespace

std::string WorkflowAttemptKey(std::string_view mission_id,
                               std::string_view archive_sha256,
                               std::string_view workflow_id,
                               std::string_view step_id) {
  if (!base::Uuid::ParseLowercase(mission_id).is_valid() ||
      !ValidHash(archive_sha256) || !ValidId(workflow_id) || !ValidId(step_id)) {
    return {};
  }
  const auto identity = base::StrCat({"tahai-native-v1\n", mission_id, "\n",
                                    archive_sha256, "\n", workflow_id, "\n", step_id});
  return base::ToLowerASCII(base::HexEncode(crypto::SHA256Hash(base::as_byte_span(identity))));
}

WorkflowAttempt ReserveWorkflowAttempt(const base::FilePath& profile,
                                       std::string_view key) {
  if (!ValidHash(key)) {
    return WorkflowAttempt::kUnavailable;
  }
  Journal journal;
  return journal.Open(profile, true) ? journal.Reserve(key) : WorkflowAttempt::kUnavailable;
}

bool RecordWorkflowAttemptResult(const base::FilePath& profile,
                                  std::string_view key, bool dispatched) {
  if (!ValidHash(key)) {
    return false;
  }
  Journal journal;
  return journal.Open(profile, false) && journal.Finish(key, dispatched);
}

}  // namespace tahai
