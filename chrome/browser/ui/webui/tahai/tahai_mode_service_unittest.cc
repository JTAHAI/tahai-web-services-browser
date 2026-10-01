// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_mode_service.h"

#include <memory>

#include "base/functional/callback.h"
#include "base/test/bind.h"
#include "chrome/common/pref_names.h"
#include "chrome/test/base/testing_profile.h"
#include "components/sync_preferences/testing_pref_service_syncable.h"
#include "content/public/test/browser_task_environment.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

class ModeObserver : public ModeService::Observer {
 public:
  void OnTahaiActiveModeChanged() override {
    ++active_changes;
    if (on_active) {
      on_active.Run();
    }
  }
  void OnTahaiModeConfigurationChanged() override {
    ++configuration_changes;
    if (on_configuration) {
      on_configuration.Run();
    }
  }
  int active_changes = 0;
  int configuration_changes = 0;
  base::RepeatingClosure on_active;
  base::RepeatingClosure on_configuration;
};

class TahaiModeServiceTest : public testing::Test {
 protected:
  content::BrowserTaskEnvironment environment_;
  TestingProfile profile_;
};

TEST_F(TahaiModeServiceTest, ExternalPreferencesAndPolicyRemainAuthoritative) {
  ModeService service(&profile_);
  ModeObserver observer;
  service.AddObserver(&observer);
  auto* preferences = profile_.GetTestingPrefService();
  preferences->SetString(prefs::kTahaiActiveWorkMode, "creator");
  EXPECT_EQ("creator", service.active_mode().id);
  EXPECT_EQ(1, observer.active_changes);
  preferences->SetManagedPref(prefs::kTahaiActiveWorkMode,
                              base::Value("operator"));
  EXPECT_EQ("operator", service.active_mode().id);
  EXPECT_FALSE(service.SetActiveMode("daily"));
  EXPECT_EQ(
      "creator",
      preferences->GetUserPrefValue(prefs::kTahaiActiveWorkMode)->GetString());

  base::DictValue settings;
  settings.Set("focus", true);
  settings.EnsureDict("configurations")
      ->EnsureDict("operator")
      ->Set("theme", "light");
  preferences->SetManagedPref(prefs::kTahaiWorkModePreferences,
                              base::Value(std::move(settings)));
  EXPECT_TRUE(service.IsModifierEnabled("focus"));
  EXPECT_EQ("light", service.active_configuration().theme_id);
  EXPECT_FALSE(service.SetModifierEnabled("focus", false));
  EXPECT_FALSE(service.SetActiveConfigurationValue("theme", "dark"));
  EXPECT_FALSE(service.ResetActiveConfiguration());
  preferences->RemoveManagedPref(prefs::kTahaiActiveWorkMode);
  EXPECT_EQ("creator", service.active_mode().id);
  service.RemoveObserver(&observer);
}

TEST_F(TahaiModeServiceTest, ConfigurationWritesPreserveUnknownAndOtherModes) {
  ModeService service(&profile_);
  auto* preferences = profile_.GetTestingPrefService();
  base::DictValue settings;
  settings.Set("future_top_level", "keep");
  auto* saved = settings.EnsureDict("configurations");
  saved->EnsureDict("daily")->Set("future_field", "keep");
  saved->EnsureDict("future_mode")->Set("opaque", 17);
  saved->EnsureDict("creator")->Set("theme", "light");
  preferences->SetDict(prefs::kTahaiWorkModePreferences, std::move(settings));
  ASSERT_EQ("light", service.configuration_for_mode("creator").theme_id);
  ASSERT_TRUE(
      service.SetConfigurationValueForMode("daily", "density", "compact"));
  const auto& result = preferences->GetDict(prefs::kTahaiWorkModePreferences);
  EXPECT_EQ("keep", *result.FindString("future_top_level"));
  const auto* configurations = result.FindDict("configurations");
  ASSERT_TRUE(configurations);
  EXPECT_EQ("keep",
            *configurations->FindDict("daily")->FindString("future_field"));
  EXPECT_EQ(17, configurations->FindDict("future_mode")->FindInt("opaque"));
  EXPECT_EQ(1u, configurations->FindDict("creator")->size());
  EXPECT_EQ("light", *configurations->FindDict("creator")->FindString("theme"));
  ASSERT_TRUE(service.ResetConfigurationForMode("daily"));
  EXPECT_EQ("keep", *preferences->GetDict(prefs::kTahaiWorkModePreferences)
                         .FindDict("configurations")
                         ->FindDict("daily")
                         ->FindString("future_field"));
}

TEST_F(TahaiModeServiceTest, MalformedPreferencesAreReadOnly) {
  ModeService service(&profile_);
  auto* preferences = profile_.GetTestingPrefService();
  for (const auto& invalid : {"configurations", "focus"}) {
    base::DictValue settings;
    settings.Set(invalid, "future-or-corrupt");
    const auto before = settings.Clone();
    preferences->SetDict(prefs::kTahaiWorkModePreferences, std::move(settings));
    EXPECT_FALSE(service.SetModifierEnabled("watch", true));
    EXPECT_FALSE(service.SetActiveConfigurationValue("theme", "light"));
    EXPECT_FALSE(service.ResetActiveConfiguration());
    EXPECT_EQ(before, preferences->GetDict(prefs::kTahaiWorkModePreferences));
  }
  base::DictValue settings;
  settings.EnsureDict("configurations")
      ->EnsureDict("creator")
      ->Set("theme", 42);
  const auto before = settings.Clone();
  preferences->SetDict(prefs::kTahaiWorkModePreferences, std::move(settings));
  EXPECT_FALSE(service.SetConfigurationValueForMode("daily", "theme", "light"));
  EXPECT_EQ(before, preferences->GetDict(prefs::kTahaiWorkModePreferences));
  preferences->SetUserPref(prefs::kTahaiActiveWorkMode, base::Value(42));
  EXPECT_FALSE(service.SetActiveMode("creator"));
  EXPECT_EQ(
      42, preferences->GetUserPrefValue(prefs::kTahaiActiveWorkMode)->GetInt());
  preferences->SetUserPref(prefs::kTahaiWorkModePreferences,
                           base::Value("corrupt"));
  EXPECT_FALSE(service.SetModifierEnabled("focus", true));
  EXPECT_EQ("corrupt",
            preferences->GetUserPrefValue(prefs::kTahaiWorkModePreferences)
                ->GetString());
}

TEST_F(TahaiModeServiceTest, UnknownActiveModeIsNotRewrittenOnLoad) {
  auto* preferences = profile_.GetTestingPrefService();
  preferences->SetString(prefs::kTahaiActiveWorkMode, "future-mode");
  ModeService service(&profile_);
  EXPECT_EQ("daily", service.active_mode().id);
  EXPECT_EQ("future-mode", preferences->GetString(prefs::kTahaiActiveWorkMode));
  // An explicit user selection is distinct from a load-time repair. It must
  // persist even when the safe in-memory fallback already shows Daily.
  EXPECT_TRUE(service.SetActiveMode("daily"));
  EXPECT_EQ("daily", preferences->GetString(prefs::kTahaiActiveWorkMode));
}

TEST_F(TahaiModeServiceTest, DensityMigrationProducesCanonicalSnapshots) {
  base::DictValue settings;
  auto* configurations = settings.EnsureDict("configurations");
  auto* daily = configurations->EnsureDict("daily");
  daily->Set("density", "spacious");
  daily->Set("compact_controls", true);
  configurations->EnsureDict("creator")->Set("compact_controls", true);
  const auto original = settings.Clone();
  profile_.GetPrefs()->SetDict(prefs::kTahaiWorkModePreferences,
                               std::move(settings));
  ModeService service(&profile_);
  EXPECT_FALSE(service.active_configuration().compact_controls);
  EXPECT_EQ("spacious", service.active_configuration().density_id);
  EXPECT_EQ("compact", service.configuration_for_mode("creator").density_id);
  for (const auto& mode : ModeService::definitions()) {
    EXPECT_TRUE(ModeService::DecodeConfiguration(
        mode.id, ModeService::EncodeConfiguration(
                     service.configuration_for_mode(mode.id))));
  }
  EXPECT_EQ(original,
            profile_.GetPrefs()->GetDict(prefs::kTahaiWorkModePreferences));
}

TEST_F(TahaiModeServiceTest, ReentrantNotificationsAreDeferred) {
  ModeService service(&profile_);
  ModeObserver observer;
  observer.on_active = base::BindLambdaForTesting([&] {
    if (observer.active_changes == 1) {
      EXPECT_TRUE(service.SetActiveMode("builder"));
      EXPECT_TRUE(service.SetModifierEnabled("focus", true));
      EXPECT_EQ(1, observer.active_changes);
      EXPECT_EQ(0, observer.configuration_changes);
    }
  });
  service.AddObserver(&observer);
  // An observer superseded the requested mode; the caller must not claim it
  // remained selected, even though both explicit writes were valid.
  EXPECT_FALSE(service.SetActiveMode("creator"));
  environment_.RunUntilIdle();
  EXPECT_EQ("builder", service.active_mode().id);
  EXPECT_TRUE(service.IsModifierEnabled("focus"));
  EXPECT_EQ(2, observer.active_changes);
  EXPECT_EQ(1, observer.configuration_changes);
  service.RemoveObserver(&observer);
}

TEST_F(TahaiModeServiceTest, ObserverCanDestroyServiceDuringPreferenceWrite) {
  auto service = std::make_unique<ModeService>(&profile_);
  ModeObserver observer;
  observer.on_configuration = base::BindLambdaForTesting([&] {
    service->RemoveObserver(&observer);
    service.reset();
  });
  service->AddObserver(&observer);
  EXPECT_FALSE(
      service->SetConfigurationValueForMode("daily", "theme", "light"));
  EXPECT_FALSE(service);
  environment_.RunUntilIdle();
  EXPECT_EQ(1, observer.configuration_changes);
}

TEST_F(TahaiModeServiceTest,
       ShutdownRejectsAllMutationsAndDropsQueuedNotifications) {
  ModeService service(&profile_);
  ModeObserver observer;
  observer.on_active = base::BindLambdaForTesting([&] {
    EXPECT_TRUE(service.SetModifierEnabled("focus", true));
    service.Shutdown();
  });
  service.AddObserver(&observer);
  EXPECT_FALSE(service.SetActiveMode("creator"));
  const auto saved =
      profile_.GetPrefs()->GetDict(prefs::kTahaiWorkModePreferences).Clone();
  EXPECT_FALSE(service.SetActiveMode("daily"));
  EXPECT_FALSE(service.SetModifierEnabled("focus", false));
  EXPECT_FALSE(service.SetActiveConfigurationValue("theme", "light"));
  EXPECT_FALSE(service.ResetActiveConfiguration());
  EXPECT_FALSE(service.DuplicateBuiltinModePreset("creator", "After shutdown"));
  environment_.RunUntilIdle();
  EXPECT_EQ(0, observer.configuration_changes);
  EXPECT_EQ(saved,
            profile_.GetPrefs()->GetDict(prefs::kTahaiWorkModePreferences));
  service.RemoveObserver(&observer);
}

TEST_F(TahaiModeServiceTest, ModifierChangesNotifyOnceAndNoopsDoNotPersist) {
  ModeService service(&profile_);
  ModeObserver observer;
  service.AddObserver(&observer);
  EXPECT_TRUE(service.SetModifierEnabled("focus", false));
  EXPECT_FALSE(
      profile_.GetPrefs()->HasPrefPath(prefs::kTahaiWorkModePreferences));
  EXPECT_EQ(0, observer.configuration_changes);
  EXPECT_TRUE(service.SetModifierEnabled("focus", true));
  EXPECT_EQ(1, observer.configuration_changes);
  EXPECT_TRUE(service.SetModifierEnabled("focus", true));
  EXPECT_EQ(1, observer.configuration_changes);
  service.RemoveObserver(&observer);
}

TEST_F(TahaiModeServiceTest, PrivateEditsCannotAcknowledgeSupersededSettings) {
  ModeService service(profile_.GetPrimaryOTRProfile(true));
  ModeObserver observer;
  observer.on_configuration = base::BindLambdaForTesting([&] {
    if (observer.configuration_changes == 1) {
      EXPECT_TRUE(service.SetActiveConfigurationValue("theme", "dark"));
    }
  });
  service.AddObserver(&observer);
  EXPECT_FALSE(service.SetActiveConfigurationValue("theme", "light"));
  environment_.RunUntilIdle();
  EXPECT_EQ("dark", service.active_configuration().theme_id);
  observer.on_configuration = base::BindLambdaForTesting([&] {
    if (service.IsModifierEnabled("focus")) {
      EXPECT_TRUE(service.SetModifierEnabled("focus", false));
    }
  });
  EXPECT_FALSE(service.SetModifierEnabled("focus", true));
  environment_.RunUntilIdle();
  EXPECT_FALSE(service.IsModifierEnabled("focus"));
  observer.on_configuration.Reset();
  ASSERT_TRUE(service.SetActiveConfigurationValue("theme", "light"));
  observer.on_configuration =
      base::BindLambdaForTesting([&] { service.Shutdown(); });
  EXPECT_FALSE(service.ResetActiveConfiguration());
  service.RemoveObserver(&observer);
  EXPECT_FALSE(
      profile_.GetPrefs()->HasPrefPath(prefs::kTahaiWorkModePreferences));
}

TEST_F(TahaiModeServiceTest, PrivateObserverCanDestroyServiceDuringEdit) {
  auto service =
      std::make_unique<ModeService>(profile_.GetPrimaryOTRProfile(true));
  ModeObserver observer;
  observer.on_configuration = base::BindLambdaForTesting([&] {
    service->RemoveObserver(&observer);
    service.reset();
  });
  service->AddObserver(&observer);
  EXPECT_FALSE(service->SetActiveConfigurationValue("theme", "light"));
  EXPECT_FALSE(service);
  environment_.RunUntilIdle();
  EXPECT_FALSE(
      profile_.GetPrefs()->HasPrefPath(prefs::kTahaiWorkModePreferences));
}

}  // namespace
}  // namespace tahai
