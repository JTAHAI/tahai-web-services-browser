// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_window_presentation.h"

#include "base/json/json_writer.h"
#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

WindowPresentation ExamplePresentation() {
  return {.fixed_mode = "research",
          .rail_state = "expanded",
          .rail_width = 330,
          .rail_modules = {"mission", "guard", "saved-workspaces"},
          .skin = WindowSkinReference{"research-flight", std::string(64, 'a')},
          .operational_mode = "source-review",
          .custom_mode = "weekly-review"};
}

TEST(TahaiWindowPresentationTest, RoundTripsOnlyInertWindowPresentation) {
  const auto original = ExamplePresentation();
  ASSERT_TRUE(ValidateWindowPresentation(original));
  const auto encoded = EncodeWindowPresentation(original);
  EXPECT_EQ(original, DecodeWindowPresentation(encoded));
  const auto json = base::WriteJson(encoded);
  ASSERT_TRUE(json);
  EXPECT_EQ(original, ParseWindowPresentation(*json));
  EXPECT_FALSE(encoded.contains("token"));
  EXPECT_FALSE(encoded.contains("grants"));
  EXPECT_FALSE(encoded.contains("actions"));
  auto builtin = original;
  builtin.skin = WindowSkinReference{"terminal-green", ""};
  builtin.operational_mode.clear();
  builtin.custom_mode.clear();
  EXPECT_EQ(builtin, DecodeWindowPresentation(EncodeWindowPresentation(builtin)));
  builtin.skin.reset();
  EXPECT_EQ(builtin, DecodeWindowPresentation(EncodeWindowPresentation(builtin)));
}

TEST(TahaiWindowPresentationTest, RejectsUnboundedAndAmbiguousReferences) {
  const auto valid = ExamplePresentation();
  for (const char* field : {"version", "mode", "rail", "width", "modules",
                             "skin", "operational_mode", "custom_mode"}) {
    SCOPED_TRACE(field);
    auto encoded = EncodeWindowPresentation(valid);
    encoded.Set(field, true);
    EXPECT_FALSE(DecodeWindowPresentation(encoded));
  }
  auto encoded = EncodeWindowPresentation(valid);
  encoded.Set("version", 2);
  EXPECT_FALSE(DecodeWindowPresentation(encoded));
  encoded = EncodeWindowPresentation(valid);
  encoded.Set("grants", base::ListValue());
  EXPECT_FALSE(DecodeWindowPresentation(encoded));
  encoded = EncodeWindowPresentation(valid);
  encoded.FindDict("skin")->Set("token", "forged");
  EXPECT_FALSE(DecodeWindowPresentation(encoded));
  EXPECT_FALSE(ParseWindowPresentation(std::string(4097, ' ')));
  EXPECT_FALSE(ParseWindowPresentation("{broken"));
  for (const std::string id : {"../external", "a", "unknown_builtin", "-bad"}) {
    auto next = valid;
    next.skin->id = id;
    EXPECT_FALSE(ValidateWindowPresentation(next));
  }
  auto next = valid;
  next.skin->archive_sha256 = std::string(64, 'g');
  EXPECT_FALSE(ValidateWindowPresentation(next));
  next = valid;
  next.skin->id = "terminal-green";
  EXPECT_FALSE(ValidateWindowPresentation(next));
  next = valid;
  next.skin->archive_sha256.clear();
  EXPECT_FALSE(ValidateWindowPresentation(next));
  next = valid;
  next.skin.reset();
  EXPECT_FALSE(ValidateWindowPresentation(next));
  next = valid;
  next.operational_mode.clear();
  next.custom_mode = "invalid custom id";
  EXPECT_FALSE(ValidateWindowPresentation(next));
}

TEST(TahaiWindowPresentationTest, RestoresInertSurfaceTreeAndRejectsMalformedTree) {
  auto original = ExamplePresentation();
  original.surface_design = SurfaceDesign{
      .nodes = {{.kind = SurfaceNodeKind::kColumns, .first = 1, .second = 2,
                 .percent = 35},
                {.pane = 0, .role = "reference"},
                {.pane = 1, .role = "working"}},
      .rail_dock = "trailing", .keyboard_order = {1, 0}};
  ASSERT_TRUE(ValidateWindowPresentation(original));
  const auto json = base::WriteJson(EncodeWindowPresentation(original));
  ASSERT_TRUE(json);
  EXPECT_LT(json->size(), 4096u);
  EXPECT_EQ(original, ParseWindowPresentation(*json));
  auto encoded = EncodeWindowPresentation(original);
  encoded.Set("surface_design", true);
  EXPECT_FALSE(DecodeWindowPresentation(encoded));
  original.surface_design->nodes[0].first = 0;
  EXPECT_FALSE(ValidateWindowPresentation(original));
  EXPECT_FALSE(DecodeWindowPresentation(EncodeWindowPresentation(original)));
}

TEST(TahaiWindowPresentationTest, BoundsRailAndModeWithoutExecutingCommands) {
  const auto valid = ExamplePresentation();
  for (int width : {-1, 219, 481, 1000000}) {
    auto next = valid;
    next.rail_width = width;
    EXPECT_FALSE(ValidateWindowPresentation(next));
  }
  for (const char* mode : {"", "nonexistent", "chrome://settings"}) {
    auto next = valid;
    next.fixed_mode = mode;
    EXPECT_FALSE(ValidateWindowPresentation(next));
  }
  auto next = valid;
  next.rail_modules.push_back("mission");
  EXPECT_FALSE(ValidateWindowPresentation(next));
  next = valid;
  next.rail_modules = {"tabs", "mission", "guard", "history", "bookmarks", "downloads"};
  EXPECT_FALSE(ValidateWindowPresentation(next));
  next = valid;
  next.rail_modules = {"javascript:alert(1)"};
  EXPECT_FALSE(ValidateWindowPresentation(next));
}

}  // namespace
}  // namespace tahai
