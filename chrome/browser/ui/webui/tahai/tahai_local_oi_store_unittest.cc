// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/webui/tahai/tahai_local_oi_store.h"

#include "base/values.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_registry_simple.h"
#include "components/prefs/scoped_user_pref_update.h"
#include "components/prefs/testing_pref_service.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

constexpr char kEntityId[] = "11111111-1111-4111-8111-111111111111";
constexpr char kSecondEntityId[] = "22222222-2222-4222-8222-222222222222";

LocalOiEntityRecord MakeMission(std::string_view id) {
  return {std::string(id),
          LocalOiEntityType::kMission,
          std::string(id),
          "Synthetic Mission",
          "Synthetic fixture only.",
          LocalOiRecordSource::kMission,
          {{"has_objective", "true"}},
          "1",
          "1",
          false};
}

class TahaiLocalOiStoreTest : public testing::Test {
 protected:
  void SetUp() override {
    prefs_.registry()->RegisterDictionaryPref(prefs::kTahaiLocalOiStore);
  }

  TestingPrefServiceSimple prefs_;
};

TEST_F(TahaiLocalOiStoreTest, PersistsValidatedEntityAcrossStoreInstances) {
  {
    TahaiLocalOiStore store(&prefs_, /*durable=*/true);
    EXPECT_TRUE(store.UpsertEntity(MakeMission(kEntityId)));
    EXPECT_EQ(1u, store.data().entities.size());
  }
  TahaiLocalOiStore reloaded(&prefs_, /*durable=*/true);
  ASSERT_EQ(1u, reloaded.data().entities.size());
  EXPECT_EQ(kEntityId, reloaded.data().entities.front().id);
  EXPECT_EQ(LocalOiStoreStatus::kReady, reloaded.status());
}

TEST_F(TahaiLocalOiStoreTest, RejectsSelfReferentialRelationship) {
  TahaiLocalOiStore store(&prefs_, /*durable=*/true);
  LocalOiRelationshipRecord relationship;
  relationship.id = kSecondEntityId;
  relationship.type = LocalOiRelationshipType::kMissionContains;
  relationship.source_id = kEntityId;
  relationship.target_id = kEntityId;
  relationship.basis = "Synthetic fixture only.";
  relationship.created_at = "1";
  relationship.updated_at = "1";
  EXPECT_FALSE(store.UpsertRelationship(std::move(relationship)));
}

TEST_F(TahaiLocalOiStoreTest, CorruptDocumentRecoversToEmptyCurrentSchema) {
  {
    ScopedDictPrefUpdate update(&prefs_, prefs::kTahaiLocalOiStore);
    update->Set("schema_version", 999);
  }
  TahaiLocalOiStore recovered(&prefs_, /*durable=*/true);
  EXPECT_EQ(LocalOiStoreStatus::kRecoveredFromCorruption, recovered.status());
  EXPECT_TRUE(recovered.data().entities.empty());
  EXPECT_EQ(kTahaiLocalOiCurrentSchemaVersion, recovered.data().schema_version);
}

TEST_F(TahaiLocalOiStoreTest, SchemaV1MigrationRemovesRawDnsInspectionFields) {
  {
    TahaiLocalOiStore store(&prefs_, /*durable=*/true);
    ASSERT_TRUE(store.UpsertEntity(MakeMission(kEntityId)));
  }
  {
    ScopedDictPrefUpdate update(&prefs_, prefs::kTahaiLocalOiStore);
    update->Set("schema_version", 1);
    base::ListValue* entities = update->FindList("entities");
    ASSERT_TRUE(entities);
    ASSERT_FALSE(entities->empty());
    base::DictValue* entity = entities->front().GetIfDict();
    ASSERT_TRUE(entity);
    base::ListValue* fields = entity->FindList("fields");
    ASSERT_TRUE(fields);
    for (const char* key :
         {"dns_addresses", "dns_aliases", "dns_address_count",
          "dns_addresses_fingerprint", "dns_aliases_fingerprint"}) {
      base::DictValue legacy_field;
      legacy_field.Set("key", key);
      legacy_field.Set("value", "203.0.113.17");
      fields->Append(std::move(legacy_field));
    }
  }

  TahaiLocalOiStore migrated(&prefs_, /*durable=*/true);
  ASSERT_EQ(kTahaiLocalOiCurrentSchemaVersion, migrated.data().schema_version);
  ASSERT_EQ(1u, migrated.data().entities.size());
  for (const LocalOiField& field : migrated.data().entities.front().fields) {
    EXPECT_NE("dns_addresses", field.key);
    EXPECT_NE("dns_aliases", field.key);
    EXPECT_NE("dns_address_count", field.key);
    EXPECT_NE("dns_addresses_fingerprint", field.key);
    EXPECT_NE("dns_aliases_fingerprint", field.key);
    EXPECT_NE("203.0.113.17", field.value);
  }
}

TEST_F(TahaiLocalOiStoreTest, EphemeralStoreDoesNotWritePreference) {
  TahaiLocalOiStore store(&prefs_, /*durable=*/false);
  EXPECT_TRUE(store.UpsertEntity(MakeMission(kEntityId)));
  EXPECT_TRUE(prefs_.GetDict(prefs::kTahaiLocalOiStore).empty());
  EXPECT_EQ(LocalOiStoreStatus::kEphemeral, store.status());
}

}  // namespace
}  // namespace tahai
