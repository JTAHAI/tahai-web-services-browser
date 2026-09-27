// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_workflow_journal.h"

#include <string>

#include "base/command_line.h"
#include "base/files/file_util.h"
#include "base/files/scoped_temp_dir.h"
#include "base/test/multiprocess_test.h"
#include "base/test/test_timeouts.h"
#include "base/uuid.h"
#include "sql/database.h"
#include "sql/statement.h"
#include "sql/transaction.h"
#include "testing/gtest/include/gtest/gtest.h"
#include "testing/multiprocess_func_list.h"

namespace tahai {
namespace {

TEST(TahaiWorkflowJournalTest, IntentSurvivesReopenAndCannotReplay) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const auto key = WorkflowAttemptKey(base::Uuid::GenerateRandomV4().AsLowercaseString(),
                                      std::string(64, 'a'), "workflow", "step-one");
  ASSERT_EQ(64u, key.size());
  EXPECT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), key));
  EXPECT_EQ(WorkflowAttempt::kUnknown, ReserveWorkflowAttempt(directory.GetPath(), key));
  ASSERT_TRUE(RecordWorkflowAttemptResult(directory.GetPath(), key, true));
  EXPECT_EQ(WorkflowAttempt::kDispatched, ReserveWorkflowAttempt(directory.GetPath(), key));
  EXPECT_FALSE(RecordWorkflowAttemptResult(directory.GetPath(), key, false));
  EXPECT_EQ(WorkflowAttempt::kDispatched, ReserveWorkflowAttempt(directory.GetPath(), key));
}

TEST(TahaiWorkflowJournalTest, RejectedAttemptCannotBeRetried) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const std::string key(64, 'b');
  EXPECT_FALSE(RecordWorkflowAttemptResult(directory.GetPath(), key, true));
  EXPECT_FALSE(base::PathExists(directory.GetPath().AppendASCII("TAHAI Workflow Journal")));
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), key));
  ASSERT_TRUE(RecordWorkflowAttemptResult(directory.GetPath(), key, false));
  EXPECT_EQ(WorkflowAttempt::kRejected, ReserveWorkflowAttempt(directory.GetPath(), key));
  EXPECT_FALSE(RecordWorkflowAttemptResult(directory.GetPath(), key, true));
}

TEST(TahaiWorkflowJournalTest, KeysAreBoundedAndSeparateRunsRevisionsAndSteps) {
  const auto id = base::Uuid::GenerateRandomV4().AsLowercaseString();
  const std::string sha(64, 'a');
  const auto key = WorkflowAttemptKey(id, sha, "workflow", "step-one");
  EXPECT_EQ(key, WorkflowAttemptKey(id, sha, "workflow", "step-one"));
  EXPECT_NE(key, WorkflowAttemptKey(id, sha, "workflow", "step-two"));
  EXPECT_NE(key, WorkflowAttemptKey(id, sha, "workflow-two", "step-one"));
  EXPECT_NE(key, WorkflowAttemptKey(id, std::string(64, 'b'), "workflow", "step-one"));
  EXPECT_NE(key, WorkflowAttemptKey(base::Uuid::GenerateRandomV4().AsLowercaseString(),
                                   sha, "workflow", "step-one"));
  EXPECT_TRUE(WorkflowAttemptKey("../path", sha, "workflow", "step-one").empty());
  EXPECT_TRUE(WorkflowAttemptKey(id, "bad", "workflow", "step-one").empty());
  EXPECT_TRUE(WorkflowAttemptKey(id, sha, "../workflow", "step-one").empty());
  EXPECT_TRUE(WorkflowAttemptKey(id, sha, "workflow", "https://example.com").empty());
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  EXPECT_EQ(WorkflowAttempt::kUnavailable, ReserveWorkflowAttempt(directory.GetPath(), "../bad"));
  EXPECT_FALSE(base::PathExists(directory.GetPath().AppendASCII("TAHAI Workflow Journal")));
  EXPECT_EQ(WorkflowAttempt::kUnavailable,
            ReserveWorkflowAttempt(base::FilePath(FILE_PATH_LITERAL("relative")), key));
  const auto first = WorkflowAttemptKey(id, sha, "workflow", "r-rounds-1-focus");
  const auto second = WorkflowAttemptKey(id, sha, "workflow", "r-rounds-2-focus");
  ASSERT_NE(first, second);
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), first));
  ASSERT_TRUE(RecordWorkflowAttemptResult(directory.GetPath(), first, true));
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), second));
  EXPECT_EQ(WorkflowAttempt::kDispatched, ReserveWorkflowAttempt(directory.GetPath(), first));
  EXPECT_EQ(WorkflowAttempt::kUnknown, ReserveWorkflowAttempt(directory.GetPath(), second));
}

TEST(TahaiWorkflowJournalTest, CorruptFileIsPreservedWithoutDispatch) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const auto path = directory.GetPath().AppendASCII("TAHAI Workflow Journal");
  ASSERT_TRUE(base::WriteFile(path, "preserve invalid database"));
  EXPECT_EQ(WorkflowAttempt::kUnavailable,
            ReserveWorkflowAttempt(directory.GetPath(), std::string(64, 'c')));
  std::string after;
  ASSERT_TRUE(base::ReadFileToString(path, &after));
  EXPECT_EQ("preserve invalid database", after);
}

TEST(TahaiWorkflowJournalTest, FutureVersionIsPreservedAndNotExecuted) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const auto path = directory.GetPath().AppendASCII("TAHAI Workflow Journal");
  const std::string key(64, 'd');
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), key));
  {
    sql::Database database(sql::Database::Tag("TahaiWorkflowJournal"));
    ASSERT_TRUE(database.Open(path));
    ASSERT_TRUE(database.Execute("PRAGMA user_version=999"));
  }
  std::string before, after;
  ASSERT_TRUE(base::ReadFileToString(path, &before));
  EXPECT_EQ(WorkflowAttempt::kUnavailable, ReserveWorkflowAttempt(directory.GetPath(), key));
  EXPECT_FALSE(RecordWorkflowAttemptResult(directory.GetPath(), key, true));
  ASSERT_TRUE(base::ReadFileToString(path, &after));
  EXPECT_EQ(before, after);
}

TEST(TahaiWorkflowJournalTest, QuotaCannotDiscardOldAttemptToAllowReplay) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const std::string key(64, 'e');
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), key));
  {
    sql::Database database(sql::Database::Tag("TahaiWorkflowJournal"));
    ASSERT_TRUE(database.Open(directory.GetPath().AppendASCII("TAHAI Workflow Journal")));
    ASSERT_TRUE(database.Execute(
        "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<16383) "
        "INSERT INTO attempts SELECT printf('%064x',x),'intent' FROM n"));
  }
  EXPECT_EQ(WorkflowAttempt::kUnavailable,
            ReserveWorkflowAttempt(directory.GetPath(), std::string(64, 'f')));
  EXPECT_EQ(WorkflowAttempt::kUnknown, ReserveWorkflowAttempt(directory.GetPath(), key));
}

TEST(TahaiWorkflowJournalTest, UnexpectedSchemaCannotAcknowledgeUnpersistedIntent) {
  for (const std::string mutation : {
           "CREATE TRIGGER discard_intent BEFORE INSERT ON attempts "
           "BEGIN SELECT RAISE(IGNORE); END",
           "ALTER TABLE attempts RENAME TO old_attempts;"
           "CREATE TABLE attempts(attempt_key TEXT, state TEXT);"
           "INSERT INTO attempts SELECT * FROM old_attempts;"
           "DROP TABLE old_attempts"}) {
    SCOPED_TRACE(mutation);
    base::ScopedTempDir directory;
    ASSERT_TRUE(directory.CreateUniqueTempDir());
    const auto path = directory.GetPath().AppendASCII("TAHAI Workflow Journal");
    const std::string existing(64, 'a');
    ASSERT_EQ(WorkflowAttempt::kReserved,
              ReserveWorkflowAttempt(directory.GetPath(), existing));
    ASSERT_TRUE(RecordWorkflowAttemptResult(directory.GetPath(), existing, true));
    {
      sql::Database database(sql::Database::Tag("TahaiWorkflowJournal"));
      ASSERT_TRUE(database.Open(path));
      ASSERT_TRUE(database.Execute(mutation));
    }
    std::string before, after;
    ASSERT_TRUE(base::ReadFileToString(path, &before));
    EXPECT_EQ(WorkflowAttempt::kUnavailable,
              ReserveWorkflowAttempt(directory.GetPath(), std::string(64, 'b')));
    EXPECT_EQ(WorkflowAttempt::kUnavailable,
              ReserveWorkflowAttempt(directory.GetPath(), existing));
    EXPECT_FALSE(RecordWorkflowAttemptResult(directory.GetPath(), existing, false));
    ASSERT_TRUE(base::ReadFileToString(path, &after));
    EXPECT_EQ(before, after);
  }
}

TEST(TahaiWorkflowJournalTest, BlockedRollbackJournalCannotAuthorizeOrEraseAttempts) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const auto path = directory.GetPath().AppendASCII("TAHAI Workflow Journal");
  const std::string finished(64, 'a'), uncertain(64, 'b'), fresh(64, 'c');
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), finished));
  ASSERT_TRUE(RecordWorkflowAttemptResult(directory.GetPath(), finished, true));
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), uncertain));
  const auto rollback = sql::Database::JournalPath(path);
  if (base::PathExists(rollback)) {
    ASSERT_EQ(0, base::GetFileSize(rollback).value_or(-1));
    ASSERT_TRUE(base::DeleteFile(rollback));
  }
  // An actual temporary filesystem obstruction, not a mocked success/failure
  // response. It prevents SQLite from opening its required rollback journal.
  ASSERT_TRUE(base::CreateDirectory(rollback));
  EXPECT_EQ(WorkflowAttempt::kUnavailable, ReserveWorkflowAttempt(directory.GetPath(), fresh));
  EXPECT_FALSE(RecordWorkflowAttemptResult(directory.GetPath(), uncertain, true));
  ASSERT_TRUE(base::DeletePathRecursively(rollback));  // Only our empty temp directory.
  EXPECT_EQ(WorkflowAttempt::kDispatched, ReserveWorkflowAttempt(directory.GetPath(), finished));
  EXPECT_EQ(WorkflowAttempt::kUnknown, ReserveWorkflowAttempt(directory.GetPath(), uncertain));
  EXPECT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), fresh));
}

TEST(TahaiWorkflowJournalTest, ExclusiveWriterCannotAuthorizeOrEraseAttempts) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const std::string finished(64, 'a'), uncertain(64, 'b'), fresh(64, 'c');
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), finished));
  ASSERT_TRUE(RecordWorkflowAttemptResult(directory.GetPath(), finished, true));
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), uncertain));
  {
    sql::Database locker(sql::Database::Tag("TahaiWorkflowJournal"));
    ASSERT_TRUE(locker.Open(directory.GetPath().AppendASCII("TAHAI Workflow Journal")));
    ASSERT_TRUE(locker.Execute("BEGIN EXCLUSIVE"));
    EXPECT_EQ(WorkflowAttempt::kUnavailable, ReserveWorkflowAttempt(directory.GetPath(), fresh));
    EXPECT_FALSE(RecordWorkflowAttemptResult(directory.GetPath(), uncertain, true));
    ASSERT_TRUE(locker.Execute("ROLLBACK"));
  }
  EXPECT_EQ(WorkflowAttempt::kDispatched, ReserveWorkflowAttempt(directory.GetPath(), finished));
  EXPECT_EQ(WorkflowAttempt::kUnknown, ReserveWorkflowAttempt(directory.GetPath(), uncertain));
  EXPECT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), fresh));
}

MULTIPROCESS_TEST_MAIN(TahaiJournalInterruptedWriter) {
  const auto profile = base::CommandLine::ForCurrentProcess()->GetSwitchValuePath(
      "tahai-journal-crash-profile");
  if (!profile.IsAbsolute() || profile.ReferencesParent()) return 1;
  const auto path = profile.AppendASCII("TAHAI Workflow Journal");
  if (!base::PathExists(path)) return 2;
  sql::Database database(sql::DatabaseOptions().set_wal_mode(false)
                             .set_cache_size(1).set_flush_to_media(true),
                         sql::Database::Tag("TahaiWorkflowJournal"));
  if (!database.Open(path) || !database.Execute("PRAGMA cache_spill=ON")) return 3;
  sql::Transaction transaction(&database);
  if (!transaction.Begin() ||
      !database.Execute("UPDATE attempts SET state='rejected'") ||
      !database.Execute(
          "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<512) "
          "INSERT INTO attempts SELECT printf('%064x',x),'intent' FROM n") ||
      base::GetFileSize(sql::Database::JournalPath(path)).value_or(0) <= 0) return 4;
  // Abruptly exit with a live transaction and dirty spilled pages. Neither the
  // transaction nor the database destructor gets a chance to roll back.
  base::Process::TerminateCurrentProcessImmediately(23);
}

TEST(TahaiWorkflowJournalTest, AbruptWriterExitRollsBackWithoutReplay) {
  base::ScopedTempDir directory;
  ASSERT_TRUE(directory.CreateUniqueTempDir());
  const auto path = directory.GetPath().AppendASCII("TAHAI Workflow Journal");
  const std::string finished(64, 'a'), uncertain(64, 'b');
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), finished));
  ASSERT_TRUE(RecordWorkflowAttemptResult(directory.GetPath(), finished, true));
  ASSERT_EQ(WorkflowAttempt::kReserved, ReserveWorkflowAttempt(directory.GetPath(), uncertain));
  auto command = base::GetMultiProcessTestChildBaseCommandLine();
  command.AppendSwitchPath("tahai-journal-crash-profile", directory.GetPath());
  base::LaunchOptions options;
  options.start_hidden = true;
  auto child = base::SpawnMultiProcessTestChild("TahaiJournalInterruptedWriter", command, options);
  ASSERT_TRUE(child.IsValid());
  int exit_code = -1;
  const bool exited = base::WaitForMultiprocessTestChildExit(
      child, TestTimeouts::action_timeout(), &exit_code);
  if (!exited) EXPECT_TRUE(base::TerminateMultiProcessTestChild(child, 99, true));
  ASSERT_TRUE(exited);
  ASSERT_EQ(23, exit_code);
  ASSERT_GT(base::GetFileSize(sql::Database::JournalPath(path)).value_or(0), 0);
  EXPECT_EQ(WorkflowAttempt::kDispatched, ReserveWorkflowAttempt(directory.GetPath(), finished));
  EXPECT_EQ(WorkflowAttempt::kUnknown, ReserveWorkflowAttempt(directory.GetPath(), uncertain));
  sql::Database database(sql::Database::Tag("TahaiWorkflowJournal"));
  ASSERT_TRUE(database.Open(path));
  sql::Statement count(database.GetUniqueStatement("SELECT count(*) FROM attempts"));
  ASSERT_TRUE(count.Step());
  EXPECT_EQ(2, count.ColumnInt(0));
}

}  // namespace
}  // namespace tahai
