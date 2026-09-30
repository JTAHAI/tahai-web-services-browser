// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/skin_package_store.h"

#include <algorithm>
#include <memory>
#include <string>
#include <utility>

#include "base/check.h"
#include "base/containers/span.h"
#include "base/files/file_util.h"
#include "base/files/scoped_temp_dir.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/test/task_environment.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_operational_skin_manifest.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"
#include "crypto/sha2.h"
#include "sql/statement.h"
#include "sql/sqlite_result_code_values.h"
#include "sql/test/drive_error_test_vfs.h"
#include "sql/test/test_helpers.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai::skins {
namespace {

std::string Hash(std::string_view bytes) {
  return base::ToLowerASCII(
      base::HexEncode(crypto::SHA256Hash(base::as_byte_span(bytes))));
}

// Persistence fixtures, not validated ZIPs. Archive/image admission is tested
// separately through the actual sandboxed decoder in browser_tests.
StoredSkinArchive Fixture(std::string id, std::string bytes) {
  base::DictValue manifest;
  manifest.Set("schema_version", 1);
  manifest.Set("id", id);
  manifest.Set("name", "Storage fixture");
  manifest.Set("creator", "TAHAI storage tests");
  manifest.Set("license", "Apache-2.0");
  base::DictValue compatibility;
  compatibility.Set("min_chromium_major", 1);
  compatibility.Set("max_chromium_major", 999);
  manifest.Set("compatibility", std::move(compatibility));
  base::DictValue tokens;
  for (const char* key :
       {"shell_background", "toolbar_background", "tab_background",
        "rail_background", "panel_background"}) {
    tokens.Set(key, "#000000");
  }
  for (const char* key : {"toolbar_foreground", "tab_foreground",
                          "rail_foreground", "panel_foreground", "accent"}) {
    tokens.Set(key, "#ffffff");
  }
  base::DictValue appearance;
  appearance.Set("density", "comfortable");
  appearance.Set("reduced_motion", true);
  appearance.Set("light_tokens", tokens.Clone());
  appearance.Set("dark_tokens", tokens.Clone());
  appearance.Set("high_contrast_tokens", std::move(tokens));
  manifest.Set("appearance", std::move(appearance));
  base::DictValue preview;
  preview.Set("path", "assets/preview.png");
  preview.Set("sha256", Hash("preview fixture"));
  preview.Set("purpose", "preview");
  base::ListValue assets;
  assets.Append(std::move(preview));
  manifest.Set("assets", std::move(assets));
  auto json = base::WriteJson(manifest);
  CHECK(json);
  return {std::move(id), std::move(*json), Hash(bytes), std::move(bytes)};
}

StoredSkinArchive OperationalFixture(std::string id, std::string bytes) {
  StoredSkinArchive archive = Fixture(std::move(id), std::move(bytes));
  auto manifest = base::JSONReader::ReadDict(archive.manifest_json,
                                             base::JSON_PARSE_RFC, 16);
  CHECK(manifest);
  manifest->Set("schema_version", 2);
  base::DictValue operational;
  base::ListValue capabilities;
  capabilities.Append("workspace-layout");
  capabilities.Append("mission-checklist");
  capabilities.Append("guard-control");
  operational.Set("capabilities", std::move(capabilities));
  base::ListValue surfaces;
  base::DictValue surface;
  surface.Set("id", "focus-surface");
  surface.Set("layout", "quad");
  surface.Set("rail_state", "expanded");
  surface.Set("start_surface", "mission");
  base::ListValue rail_modules;
  rail_modules.Append("mission");
  rail_modules.Append("local-oi");
  rail_modules.Append("guard");
  surface.Set("rail_modules", std::move(rail_modules));
  surfaces.Append(std::move(surface));
  operational.Set("surfaces", std::move(surfaces));
  base::ListValue workflows;
  base::DictValue workflow;
  workflow.Set("id", "source-review");
  workflow.Set("name", "Source review");
  base::ListValue steps;
  base::DictValue step;
  step.Set("id", "review-sources");
  step.Set("name", "Review selected sources");
  step.Set("kind", "instruction");
  steps.Append(std::move(step));
  base::DictValue command;
  command.Set("id", "open-checklist");
  command.Set("name", "Open the local checklist");
  command.Set("kind", "run-command");
  command.Set("action", "mission.open");
  steps.Append(std::move(command));
  workflow.Set("steps", std::move(steps));
  workflows.Append(std::move(workflow));
  operational.Set("workflows", std::move(workflows));
  base::ListValue modes;
  base::DictValue mode;
  mode.Set("id", "research-flight");
  mode.Set("name", "Research Flight");
  mode.Set("surface", "focus-surface");
  mode.Set("workflow", "source-review");
  base::ListValue actions;
  actions.Append("tabs.find");
  actions.Append("mission.open");
  actions.Append("layout.quad");
  mode.Set("actions", std::move(actions));
  modes.Append(std::move(mode));
  operational.Set("modes", std::move(modes));
  manifest->Set("operational", std::move(operational));
  auto json = base::WriteJson(*manifest);
  CHECK(json);
  archive.manifest_json = std::move(*json);
  return archive;
}

class TahaiSkinStoreTest : public testing::Test {
 public:
  void SetUp() override { ASSERT_TRUE(directory_.CreateUniqueTempDir()); }

 protected:
  base::test::TaskEnvironment task_environment_;
  base::ScopedTempDir directory_;
};

TEST_F(TahaiSkinStoreTest, AtomicUpdateRetainsOneRevisionAcrossRestart) {
  const auto first = Fixture("local-skin", "version one");
  const auto second = Fixture("local-skin", "version two");
  const auto third = Fixture("local-skin", "version three");
  {
    SkinPackageStore store(directory_.GetPath());
    ASSERT_TRUE(store.Install(first, std::nullopt).has_value());
    EXPECT_EQ(SkinStoreError::kAlreadyExists,
              store.Install(second, std::nullopt).error());
    EXPECT_EQ(SkinStoreError::kConflict,
              store.Install(second, Hash("stale reviewed revision")).error());
    ASSERT_TRUE(store.Install(second, first.archive_sha256).has_value());
    ASSERT_TRUE(store.Install(second, second.archive_sha256).has_value());
    auto prior = store.Read(first.id, first.archive_sha256, true);
    ASSERT_TRUE(prior.has_value());
    EXPECT_EQ(first.archive, prior->archive);
  }
  SkinPackageStore reopened(directory_.GetPath());
  auto current = reopened.Read(second.id, second.archive_sha256);
  ASSERT_TRUE(current.has_value());
  EXPECT_EQ(second.archive, current->archive);
  ASSERT_TRUE(reopened.Install(third, second.archive_sha256).has_value());
  EXPECT_EQ(SkinStoreError::kConflict,
            reopened.Read(first.id, first.archive_sha256, true).error());
  auto prior = reopened.Read(second.id, second.archive_sha256, true);
  ASSERT_TRUE(prior.has_value());
  EXPECT_EQ(second.archive, prior->archive);
}

TEST_F(TahaiSkinStoreTest,
       OperationalPackagesUseTheExistingBoundedStoreAndRollback) {
  SkinPackageStore store(directory_.GetPath());
  const auto first = OperationalFixture("operational-skin", "version one");
  const auto second = OperationalFixture("operational-skin", "version two");
  ASSERT_TRUE(store.Install(first, std::nullopt).has_value());
  ASSERT_TRUE(store.Install(second, first.archive_sha256).has_value());
  auto catalog = store.List();
  ASSERT_TRUE(catalog.has_value());
  ASSERT_EQ(1u, catalog->size());
  EXPECT_EQ("operational-skin", catalog->front().manifest.id);
  auto rollback = store.Read(first.id, first.archive_sha256, true);
  ASSERT_TRUE(rollback.has_value());
  EXPECT_EQ(first.manifest_json, rollback->manifest_json);
}

TEST_F(TahaiSkinStoreTest,
       RemovalRequiresReviewedRevisionAndStaysProfileLocal) {
  base::ScopedTempDir other_directory;
  ASSERT_TRUE(other_directory.CreateUniqueTempDir());
  SkinPackageStore first(directory_.GetPath());
  SkinPackageStore second(other_directory.GetPath());
  const auto archive = Fixture("local-skin", "profile one");
  ASSERT_TRUE(first.Install(archive, std::nullopt).has_value());
  auto unrelated = second.List();
  ASSERT_TRUE(unrelated.has_value());
  EXPECT_TRUE(unrelated->empty());
  EXPECT_EQ(SkinStoreError::kConflict,
            first.Remove(archive.id, Hash("stale")).error());
  ASSERT_TRUE(first.Read(archive.id, archive.archive_sha256).has_value());
  ASSERT_TRUE(first.Remove(archive.id, archive.archive_sha256).has_value());
  EXPECT_EQ(SkinStoreError::kNotFound,
            first.Read(archive.id, archive.archive_sha256).error());
}

TEST_F(TahaiSkinStoreTest, InvalidInputCannotReplaceExistingData) {
  for (const auto& builtin : GetTahaiBuiltInSkinCatalog()) {
    SkinPackageStore reserved(directory_.GetPath());
    EXPECT_EQ(SkinStoreError::kInvalidInput,
              reserved
                  .Install(Fixture(std::string(builtin.id), "untrusted"),
                           std::nullopt)
                  .error());
  }
  SkinPackageStore store(directory_.GetPath());
  const auto original = Fixture("local-skin", "original");
  ASSERT_TRUE(store.Install(original, std::nullopt).has_value());
  auto invalid = Fixture("local-skin", "changed");
  invalid.archive_sha256 = Hash("wrong digest");
  EXPECT_EQ(SkinStoreError::kInvalidInput,
            store.Install(invalid, original.archive_sha256).error());
  invalid = Fixture("local-skin", "changed");
  invalid.id = "../another";
  EXPECT_EQ(SkinStoreError::kInvalidInput,
            store.Install(invalid, original.archive_sha256).error());
  invalid = Fixture("local-skin", "changed");
  invalid.manifest_json = "{}";
  EXPECT_EQ(SkinStoreError::kInvalidInput,
            store.Install(invalid, original.archive_sha256).error());
  auto current = store.Read(original.id, original.archive_sha256);
  ASSERT_TRUE(current.has_value());
  EXPECT_EQ(original.archive, current->archive);
}

TEST_F(TahaiSkinStoreTest, QuotasRejectWithoutEvictingPackagesOrRollback) {
  SkinPackageStore store(directory_.GetPath());
  for (size_t i = 0; i < SkinPackageStore::kMaxInstalledSkins; ++i) {
    ASSERT_TRUE(store
                    .Install(Fixture("skin-" + base::NumberToString(i), "one"),
                             std::nullopt)
                    .has_value());
  }
  EXPECT_EQ(SkinStoreError::kQuotaExceeded,
            store.Install(Fixture("one-more", "one"), std::nullopt).error());
  auto list = store.List();
  ASSERT_TRUE(list.has_value());
  EXPECT_EQ(SkinPackageStore::kMaxInstalledSkins, list->size());

  base::ScopedTempDir full_directory;
  ASSERT_TRUE(full_directory.CreateUniqueTempDir());
  SkinPackageStore full(full_directory.GetPath());
  const std::string large(8 * 1024 * 1024, 'x');
  for (int i = 0; i < 6; ++i) {
    ASSERT_TRUE(full.Install(Fixture("large-" + base::NumberToString(i), large),
                             std::nullopt)
                    .has_value());
  }
  EXPECT_EQ(
      SkinStoreError::kQuotaExceeded,
      full.Install(Fixture("large-0", "small revision"), Hash(large)).error());
  auto retained = full.Read("large-0", Hash(large));
  ASSERT_TRUE(retained.has_value());
  EXPECT_EQ(large.size(), retained->archive.size());
}

TEST_F(TahaiSkinStoreTest, UnknownVersionAndCorruptionAreNeverRazed) {
  const auto original = Fixture("local-skin", "original");
  {
    SkinPackageStore store(directory_.GetPath());
    ASSERT_TRUE(store.Install(original, std::nullopt).has_value());
  }
  const auto path = directory_.GetPath().AppendASCII("TAHAI Skins");
  {
    sql::Database database(sql::test::kTestTag);
    ASSERT_TRUE(database.Open(path));
    ASSERT_TRUE(database.Execute("PRAGMA user_version=99"));
  }
  std::string before;
  ASSERT_TRUE(base::ReadFileToString(path, &before));
  {
    SkinPackageStore store(directory_.GetPath());
    EXPECT_EQ(SkinStoreError::kUnsupportedVersion, store.List().error());
    EXPECT_EQ(SkinStoreError::kUnsupportedVersion,
              store.Install(Fixture("new-skin", "new"), std::nullopt).error());
  }
  std::string after;
  ASSERT_TRUE(base::ReadFileToString(path, &after));
  EXPECT_EQ(Hash(before), Hash(after));
  {
    sql::Database database(sql::test::kTestTag);
    ASSERT_TRUE(database.Open(path));
    ASSERT_TRUE(database.Execute("PRAGMA user_version=1"));
    ASSERT_TRUE(database.Execute("UPDATE skins SET archive=x'00010203'"));
  }
  SkinPackageStore corrupt(directory_.GetPath());
  EXPECT_EQ(SkinStoreError::kCorrupt,
            corrupt.Read(original.id, original.archive_sha256).error());
}

TEST_F(TahaiSkinStoreTest, UnexpectedSchemaCannotDiscardRollbackOrAcknowledgeUpdate) {
  const auto first = OperationalFixture("operational-skin", "version one");
  const auto second = OperationalFixture("operational-skin", "version two");
  const auto third = OperationalFixture("operational-skin", "version three");
  {
    SkinPackageStore store(directory_.GetPath());
    ASSERT_TRUE(store.Install(first, std::nullopt).has_value());
    ASSERT_TRUE(store.Install(second, first.archive_sha256).has_value());
  }
  const auto path = directory_.GetPath().AppendASCII("TAHAI Skins");
  {
    sql::Database database(sql::test::kTestTag);
    ASSERT_TRUE(database.Open(path));
    ASSERT_TRUE(database.Execute(
        "CREATE TRIGGER erase_rollback AFTER UPDATE ON skins BEGIN "
        "UPDATE skins SET previous_manifest=NULL,previous_hash=NULL,"
        "previous_archive=NULL; END"));
  }
  std::string before, after;
  ASSERT_TRUE(base::ReadFileToString(path, &before));
  {
    SkinPackageStore store(directory_.GetPath());
    EXPECT_EQ(SkinStoreError::kCorrupt, store.List().error());
    EXPECT_EQ(SkinStoreError::kCorrupt,
              store.Install(third, second.archive_sha256).error());
    EXPECT_EQ(SkinStoreError::kCorrupt,
              store.Remove(second.id, second.archive_sha256).error());
    EXPECT_EQ(SkinStoreError::kCorrupt,
              store.Read(first.id, first.archive_sha256, true).error());
  }
  ASSERT_TRUE(base::ReadFileToString(path, &after));
  EXPECT_EQ(before, after);
}

TEST_F(TahaiSkinStoreTest, DiskFullUpdatePreservesCurrentAndRollbackAfterReopen) {
  sql::test::DriveErrorTestVfs vfs;
  const auto first = OperationalFixture("operational-skin", "version one");
  const auto second = OperationalFixture("operational-skin", "version two");
  const auto third = OperationalFixture("operational-skin", std::string(1024 * 1024, 'x'));
  {
    SkinPackageStore store(directory_.GetPath());
    ASSERT_TRUE(store.Install(first, std::nullopt).has_value());
    ASSERT_TRUE(store.Install(second, first.archive_sha256).has_value());
    vfs.set_drive_full(true);
    const auto failed = store.Install(third, second.archive_sha256);
    vfs.set_drive_full(false);  // Always restore I/O before closing the store.
    ASSERT_FALSE(failed.has_value());
    EXPECT_EQ(SkinStoreError::kUnavailable, failed.error());
    EXPECT_NE(vfs.errors_produced().end(), std::ranges::find(
        vfs.errors_produced(), sql::SqliteErrorCode::kFullDisk));
    // A connection which saw an I/O error stays inert, even if space returns.
    EXPECT_EQ(SkinStoreError::kUnavailable, store.List().error());
  }
  SkinPackageStore reopened(directory_.GetPath());
  auto current = reopened.Read(second.id, second.archive_sha256);
  ASSERT_TRUE(current.has_value());
  EXPECT_EQ(second.archive, current->archive);
  auto previous = reopened.Read(first.id, first.archive_sha256, true);
  ASSERT_TRUE(previous.has_value());
  EXPECT_EQ(first.archive, previous->archive);
  EXPECT_EQ(SkinStoreError::kConflict, reopened.Read(third.id, third.archive_sha256).error());
  ASSERT_TRUE(reopened.Install(third, second.archive_sha256).has_value());
  previous = reopened.Read(second.id, second.archive_sha256, true);
  ASSERT_TRUE(previous.has_value());
  EXPECT_EQ(second.archive, previous->archive);
}

TEST_F(TahaiSkinStoreTest, DiskFullRemovalPreservesCurrentAndRollbackAfterReopen) {
  sql::test::DriveErrorTestVfs vfs;
  const auto first = OperationalFixture("operational-skin", "version one");
  const auto second = OperationalFixture("operational-skin", "version two");
  {
    SkinPackageStore store(directory_.GetPath());
    ASSERT_TRUE(store.Install(first, std::nullopt).has_value());
    ASSERT_TRUE(store.Install(second, first.archive_sha256).has_value());
    vfs.set_drive_full(true);
    const auto failed = store.Remove(second.id, second.archive_sha256);
    vfs.set_drive_full(false);
    ASSERT_FALSE(failed.has_value());
    EXPECT_EQ(SkinStoreError::kUnavailable, failed.error());
    EXPECT_NE(vfs.errors_produced().end(), std::ranges::find(
        vfs.errors_produced(), sql::SqliteErrorCode::kFullDisk));
  }
  SkinPackageStore reopened(directory_.GetPath());
  auto current = reopened.Read(second.id, second.archive_sha256);
  ASSERT_TRUE(current.has_value());
  EXPECT_EQ(second.archive, current->archive);
  auto previous = reopened.Read(first.id, first.archive_sha256, true);
  ASSERT_TRUE(previous.has_value());
  EXPECT_EQ(first.archive, previous->archive);
  ASSERT_TRUE(reopened.Remove(second.id, second.archive_sha256).has_value());
  auto catalog = reopened.List();
  ASSERT_TRUE(catalog.has_value());
  EXPECT_TRUE(catalog->empty());
}

}  // namespace
}  // namespace tahai::skins
