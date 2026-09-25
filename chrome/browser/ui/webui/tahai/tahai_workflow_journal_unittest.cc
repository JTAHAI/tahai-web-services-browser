// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_workflow_journal.h"

#include <string>

#include "base/files/file_util.h"
#include "base/files/scoped_temp_dir.h"
#include "base/uuid.h"
#include "sql/database.h"
#include "testing/gtest/include/gtest/gtest.h"

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

}  // namespace
}  // namespace tahai
