// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/tahai_skins/skin_package_store.h"

#include <memory>
#include <string>
#include <utility>

#include "base/check.h"
#include "base/containers/span.h"
#include "base/files/file_util.h"
#include "base/files/scoped_temp_dir.h"
#include "base/json/json_writer.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/test/task_environment.h"
#include "chrome/common/tahai_skins/skin_limits.h"
#include "chrome/common/tahai_skins/tahai_skin_catalog.h"
#include "crypto/sha2.h"
#include "sql/statement.h"
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

}  // namespace
}  // namespace tahai::skins
