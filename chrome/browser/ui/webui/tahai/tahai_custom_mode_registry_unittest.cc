// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_custom_mode_registry.h"

#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

base::DictValue ValidRegistry() {
  base::DictValue mode;
  mode.Set("id", "research-copy");
  mode.Set("title", "Research copy");
  mode.Set("operational_mode_id", "research");
  mode.Set("workspace_id", "research-review");
  base::ListValue modes;
  modes.Append(std::move(mode));
  base::DictValue registry;
  registry.Set("modes", std::move(modes));
  return registry;
}

base::DictValue NativeRegistry() {
  TahaiCustomModeDefinition mode{
      .id = "native-review",
      .title = "Independent review",
      .workspace_id = "saved-review",
      .native_presentation = WindowPresentation{
          .fixed_mode = "research", .rail_state = "expanded", .rail_width = 330,
          .configuration = {{"theme", "light"}, {"accent", "violet"},
              {"surface", "paper"}, {"density", "comfortable"},
              {"header", "standard"}, {"start_surface", "mission"},
              {"layout", "dual"}, {"layout_variant", "dual-side"},
              {"template", "source-review"}, {"rail_width", "330"},
              {"rail_state", "expanded"}, {"show_runbook_rail", "true"},
              {"compact_controls", "false"}}},
      .actions = {"mission.open", "layout.dual"}};
  return base::DictValue().Set("modes", base::ListValue().Append(
      SerializeTahaiCustomModeDefinition(mode)));
}

TEST(TahaiCustomModeRegistryTest, NativeModesRoundTripWithoutOperationalSkin) {
  const auto registry = NativeRegistry();
  std::vector<TahaiCustomModeDefinition> parsed;
  ASSERT_EQ(TahaiCustomModeValidationResult::kValid,
            ValidateTahaiCustomModeDefinitions(registry, &parsed));
  ASSERT_EQ(1u, parsed.size());
  ASSERT_TRUE(parsed[0].native_presentation);
  EXPECT_TRUE(parsed[0].operational_mode_id.empty());
  EXPECT_FALSE(parsed[0].operational_skin);
  EXPECT_EQ(registry.FindList("modes")->front().GetDict(),
            SerializeTahaiCustomModeDefinition(parsed[0]));
}

TEST(TahaiCustomModeRegistryTest, BuiltinPresetsUseValidatedLocalSchema) {
  const auto& presets = GetBuiltinNativeModePresets();
  ASSERT_EQ(6u, presets.size());
  for (const auto& preset : presets) {
    SCOPED_TRACE(preset.id);
    ASSERT_TRUE(preset.native_presentation);
    ASSERT_TRUE(preset.command_layout);
    EXPECT_FALSE(preset.operational_skin);
    EXPECT_TRUE(preset.workspace_id.empty());
    auto registry = base::DictValue().Set("modes", base::ListValue().Append(
        SerializeTahaiCustomModeDefinition(preset)));
    std::vector<TahaiCustomModeDefinition> parsed;
    ASSERT_EQ(TahaiCustomModeValidationResult::kValid,
              ValidateTahaiCustomModeDefinitions(registry, &parsed));
    ASSERT_EQ(1u, parsed.size());
    EXPECT_EQ(preset, parsed.front());
    EXPECT_EQ(&preset, FindBuiltinNativeModePreset(preset.id));
  }
  EXPECT_EQ(nullptr, FindBuiltinNativeModePreset("unknown"));
}

TEST(TahaiCustomModeRegistryTest, NativeCommandPlacementsAreOrderedSubsets) {
  auto registry = NativeRegistry();
  const NativeModeCommandLayout layout{{"layout.dual", "mission.open"},
                                       {}, {"mission.open"}};
  registry.FindList("modes")->front().GetDict().Set(
      "command_layout", EncodeNativeModeCommandLayout(layout));
  std::vector<TahaiCustomModeDefinition> parsed;
  ASSERT_EQ(TahaiCustomModeValidationResult::kValid,
            ValidateTahaiCustomModeDefinitions(registry, &parsed));
  ASSERT_TRUE(parsed[0].command_layout);
  EXPECT_EQ(layout, *parsed[0].command_layout);
  EXPECT_EQ(registry.FindList("modes")->front().GetDict(),
            SerializeTahaiCustomModeDefinition(parsed[0]));
  for (const auto& bad : {
      base::ListValue().Append("support.open"),
      base::ListValue().Append("mission.open").Append("mission.open"),
      base::ListValue().Append(1),
      base::ListValue().Append("https://example.test")}) {
    auto invalid = registry.Clone();
    invalid.FindList("modes")->front().GetDict().FindDict("command_layout")
        ->Set("toolbar_primary", bad.Clone());
    EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidActions,
              ValidateTahaiCustomModeDefinitions(invalid, &parsed));
    EXPECT_TRUE(parsed.empty());
  }
  for (const auto& bad : {base::DictValue(),
          EncodeNativeModeCommandLayout(layout).Set("script", "alert(1)")}) {
    auto invalid = registry.Clone();
    invalid.FindList("modes")->front().GetDict().Set("command_layout", bad.Clone());
    EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidActions,
              ValidateTahaiCustomModeDefinitions(invalid, &parsed));
    EXPECT_TRUE(parsed.empty());
  }
}

TEST(TahaiCustomModeRegistryTest, NativeModesRejectExecutableAndAmbiguousControls) {
  for (const auto& actions : {base::ListValue(),
          base::ListValue().Append("mission.open").Append("mission.open"),
          base::ListValue().Append("https://example.test"),
          base::ListValue().Append("javascript:alert(1)"),
          base::ListValue().Append("clipboard.read"),
          base::ListValue().Append(123)}) {
    auto registry = NativeRegistry();
    registry.FindList("modes")->front().GetDict().Set("actions", actions.Clone());
    std::vector<TahaiCustomModeDefinition> parsed;
    EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidActions,
              ValidateTahaiCustomModeDefinitions(registry, &parsed));
    EXPECT_TRUE(parsed.empty());
  }
}

TEST(TahaiCustomModeRegistryTest, NativeModesRejectNestedOrPartialPresentation) {
  for (const char* field : {"custom_mode", "operational_mode"}) {
    auto registry = NativeRegistry();
    registry.FindList("modes")->front().GetDict().FindDict("presentation")
        ->Set(field, "another-mode");
    std::vector<TahaiCustomModeDefinition> parsed;
    EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidPresentation,
              ValidateTahaiCustomModeDefinitions(registry, &parsed));
    EXPECT_TRUE(parsed.empty());
  }
  auto registry = NativeRegistry();
  registry.FindList("modes")->front().GetDict().FindDict("presentation")
      ->Remove("configuration");
  std::vector<TahaiCustomModeDefinition> parsed;
  EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidPresentation,
            ValidateTahaiCustomModeDefinitions(registry, &parsed));
  registry = NativeRegistry();
  registry.FindList("modes")->front().GetDict().Set("url", "https://example.test");
  EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidSchema,
            ValidateTahaiCustomModeDefinitions(registry, &parsed));
}

TEST(TahaiCustomModeRegistryTest, OperationalAliasesPinExactRevision) {
  auto registry = ValidRegistry();
  registry.FindList("modes")->front().GetDict().Set("skin", base::DictValue()
      .Set("id", "review-skin").Set("sha256", std::string(64, 'a')));
  std::vector<TahaiCustomModeDefinition> parsed;
  ASSERT_EQ(TahaiCustomModeValidationResult::kValid,
            ValidateTahaiCustomModeDefinitions(registry, &parsed));
  ASSERT_TRUE(parsed[0].operational_skin);
  EXPECT_EQ(registry.FindList("modes")->front().GetDict(),
            SerializeTahaiCustomModeDefinition(parsed[0]));
  registry.FindList("modes")->front().GetDict().FindDict("skin")->Set("sha256", "");
  EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidPresentation,
            ValidateTahaiCustomModeDefinitions(registry, &parsed));
  EXPECT_TRUE(parsed.empty());
}

TEST(TahaiCustomModeRegistryTest, AcceptsBoundedDeclarativeDefinition) {
  std::vector<TahaiCustomModeDefinition> parsed;
  EXPECT_EQ(TahaiCustomModeValidationResult::kValid,
            ValidateTahaiCustomModeDefinitions(ValidRegistry(), &parsed));
  ASSERT_EQ(1u, parsed.size());
  EXPECT_EQ("research-copy", parsed[0].id);
  EXPECT_EQ("research", parsed[0].operational_mode_id);
}

TEST(TahaiCustomModeRegistryTest, RejectsUnexpectedOrExecutableFields) {
  base::DictValue registry = ValidRegistry();
  registry.FindList("modes")->front().GetDict().Set(
      "url", "https://untrusted.example/");
  std::vector<TahaiCustomModeDefinition> parsed;
  EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidSchema,
            ValidateTahaiCustomModeDefinitions(registry, &parsed));
  EXPECT_TRUE(parsed.empty());
}

TEST(TahaiCustomModeRegistryTest, RejectsMalformedOrControlCharacterTitles) {
  base::DictValue malformed = ValidRegistry();
  malformed.FindList("modes")->front().GetDict().Set(
      "title", std::string("broken\x01" "title"));
  std::vector<TahaiCustomModeDefinition> parsed;
  EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidTitle,
            ValidateTahaiCustomModeDefinitions(malformed, &parsed));

  base::DictValue control = ValidRegistry();
  control.FindList("modes")->front().GetDict().Set("title", "Review\nmode");
  EXPECT_EQ(TahaiCustomModeValidationResult::kInvalidTitle,
            ValidateTahaiCustomModeDefinitions(control, &parsed));
}

}  // namespace
}  // namespace tahai
