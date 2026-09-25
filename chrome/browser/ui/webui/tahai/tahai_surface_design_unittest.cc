// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/common/tahai_skins/tahai_surface_design.h"

#include <algorithm>
#include <cstdint>
#include <limits>
#include <utility>

#include "testing/gtest/include/gtest/gtest.h"

namespace tahai {
namespace {

SurfaceDesign ReferenceWorkspace() {
  return {.nodes = {
      {.kind = SurfaceNodeKind::kColumns, .first = 1, .second = 2, .percent = 30},
      {.pane = 0, .role = "reference"},
      {.kind = SurfaceNodeKind::kRows, .first = 3, .second = 4, .percent = 65},
      {.pane = 1, .role = "working"},
      {.pane = 2, .role = "tasks"}},
      .rail_dock = "trailing", .gap = 12, .keyboard_order = {1, 2, 0}};
}

bool Intersects(const SurfaceRect& a, const SurfaceRect& b) {
  return a.width && a.height && b.width && b.height &&
         a.x < b.x + b.width && b.x < a.x + a.width &&
         a.y < b.y + b.height && b.y < a.y + a.height;
}

TEST(TahaiSurfaceDesignTest, RoundTripsBoundedNativeTree) {
  const auto design = ReferenceWorkspace();
  ASSERT_TRUE(ValidateSurfaceDesign(design));
  EXPECT_EQ(3, SurfacePaneCount(design));
  EXPECT_EQ(design, DecodeSurfaceDesign(EncodeSurfaceDesign(design)));
  auto encoded = EncodeSurfaceDesign(design);
  encoded.Set("script", "alert(1)");
  EXPECT_FALSE(DecodeSurfaceDesign(encoded));
  for (const char* field : {"version", "nodes", "rail_dock", "gap",
                             "narrow_width", "short_height", "keyboard_order"}) {
    SCOPED_TRACE(field);
    encoded = EncodeSurfaceDesign(design);
    encoded.Set(field, true);
    EXPECT_FALSE(DecodeSurfaceDesign(encoded));
  }
  encoded = EncodeSurfaceDesign(design);
  encoded.FindList("nodes")->front().GetDict().Set("percent",
      0.5);
  EXPECT_FALSE(DecodeSurfaceDesign(encoded));
}

TEST(TahaiSurfaceDesignTest, RejectsCyclesAliasingMissingAndDuplicatePanes) {
  auto design = ReferenceWorkspace();
  design.nodes[0].first = 0;
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes[0].second = 1;
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes[2].second = 99;
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes[4].pane = 1;
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes[4].pane = 3;
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes.push_back({.pane = 3, .role = "preview"});
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.keyboard_order = {0, 0, 1};
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes[0].percent = 0;
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes[1].role = "chrome://settings";
  EXPECT_FALSE(ValidateSurfaceDesign(design));
  design = ReferenceWorkspace();
  design.nodes[1].first = 2;
  EXPECT_FALSE(ValidateSurfaceDesign(design));
}

TEST(TahaiSurfaceDesignTest, GeometryTilesWithoutOverlapAndKeepsMinimums) {
  auto design = ReferenceWorkspace();
  for (int ratio : {10, 30, 50, 90}) {
    design.nodes[0].percent = ratio;
    for (const auto [width, height] : {std::pair(640, 360), std::pair(900, 700),
                                     std::pair(3840, 2160)}) {
      auto result = ResolveSurfaceGeometry(design, width, height, 1);
      ASSERT_TRUE(result);
      EXPECT_FALSE(result->compact);
      ASSERT_EQ(2u, result->dividers.size());
      std::vector<SurfaceRect> rectangles;
      int area = 0;
      for (int pane = 0; pane < 3; ++pane) {
        ASSERT_TRUE(result->visible[pane]);
        const auto& bounds = result->panes[pane];
        EXPECT_GE(bounds.width, 96);
        EXPECT_GE(bounds.height, 64);
        rectangles.push_back(bounds);
      }
      EXPECT_FALSE(result->visible[3]);
      for (const auto& divider : result->dividers) {
        rectangles.push_back(divider.bounds);
        EXPECT_GT(divider.first_extent, 0);
        EXPECT_LT(divider.first_extent, divider.total_extent);
      }
      for (size_t index = 0; index < rectangles.size(); ++index) {
        const auto& bounds = rectangles[index];
        EXPECT_GE(bounds.x, 0);
        EXPECT_GE(bounds.y, 0);
        EXPECT_LE(bounds.x + bounds.width, width);
        EXPECT_LE(bounds.y + bounds.height, height);
        area += bounds.width * bounds.height;
        for (size_t next = index + 1; next < rectangles.size(); ++next) {
          EXPECT_FALSE(Intersects(bounds, rectangles[next]));
        }
      }
      EXPECT_EQ(width * height, area);
    }
  }
}

TEST(TahaiSurfaceDesignTest, GeneratedTreesTileAndRoundTripWithoutLosingPanes) {
  uint32_t seed = 1520033;
  const auto random = [&seed](int limit) {
    seed = seed * 1664525u + 1013904223u;
    return static_cast<int>((static_cast<uint64_t>(seed) * limit) >> 32);
  };
  for (int iteration = 0; iteration < 1000; ++iteration) {
    SCOPED_TRACE(iteration);
    const int count = 1 + random(4);
    SurfaceDesign design;
    int next_pane = 0;
    const auto tree = [&](auto&& self, int leaves) -> int {
      const int node = static_cast<int>(design.nodes.size());
      design.nodes.emplace_back();
      if (leaves == 1) {
        design.nodes[node] = {.pane = next_pane++, .role = "working"};
      } else {
        const int first_leaves = 1 + random(leaves - 1);
        const auto kind = random(2) ? SurfaceNodeKind::kRows
                                   : SurfaceNodeKind::kColumns;
        const int percent = 10 + random(81);
        const int first = self(self, first_leaves);
        const int second = self(self, leaves - first_leaves);
        design.nodes[node] = {.kind = kind, .first = first, .second = second,
                               .percent = percent};
      }
      return node;
    };
    tree(tree, count);
    for (int pane = 0; pane < count; ++pane) {
      design.keyboard_order.push_back(pane);
    }
    for (int index = count - 1; index > 0; --index) {
      std::swap(design.keyboard_order[index], design.keyboard_order[random(index + 1)]);
    }
    design.rail_dock = random(2) ? "leading" : "trailing";
    design.gap = 4 + random(21);
    design.narrow_width = 320 + random(1281);
    design.short_height = 200 + random(701);
    ASSERT_TRUE(ValidateSurfaceDesign(design));
    ASSERT_EQ(design, DecodeSurfaceDesign(EncodeSurfaceDesign(design)));
    const int width = random(iteration % 4 ? 3200 : 100001);
    const int height = random(iteration % 4 ? 2048 : 100001);
    const int active = random(count);
    const auto result = ResolveSurfaceGeometry(design, width, height, active);
    ASSERT_TRUE(result);
    const int visible = std::ranges::count(result->visible, true);
    ASSERT_EQ(result->compact ? (width > 0 && height > 0 ? 1 : 0) : count, visible);
    if (result->compact) {
      EXPECT_EQ(width > 0 && height > 0, result->visible[active]);
      EXPECT_TRUE(result->dividers.empty());
    } else {
      EXPECT_EQ(static_cast<size_t>(count - 1), result->dividers.size());
    }
    std::vector<SurfaceRect> rectangles;
    for (int pane = 0; pane < 4; ++pane) {
      if (result->visible[pane]) {
        const auto bounds = result->panes[pane];
        if (!result->compact) {
          EXPECT_GE(bounds.width, 96);
          EXPECT_GE(bounds.height, 64);
        }
        rectangles.push_back(bounds);
      }
    }
    for (const auto& divider : result->dividers) {
      rectangles.push_back(divider.bounds);
    }
    int64_t area = 0;
    for (size_t index = 0; index < rectangles.size(); ++index) {
      const auto& bounds = rectangles[index];
      EXPECT_GE(bounds.x, 0);
      EXPECT_GE(bounds.y, 0);
      EXPECT_GE(bounds.width, 0);
      EXPECT_GE(bounds.height, 0);
      EXPECT_LE(bounds.x + bounds.width, width);
      EXPECT_LE(bounds.y + bounds.height, height);
      area += static_cast<int64_t>(bounds.width) * bounds.height;
      for (size_t other = index + 1; other < rectangles.size(); ++other) {
        EXPECT_FALSE(Intersects(bounds, rectangles[other]));
      }
    }
    EXPECT_EQ(static_cast<int64_t>(width) * height, area);
  }
}

TEST(TahaiSurfaceDesignTest, CompactGeometryKeepsActivePaneAndNoDividers) {
  const auto design = ReferenceWorkspace();
  for (const auto [width, height] : {std::pair(300, 900), std::pair(1000, 200),
                                   std::pair(0, 0)}) {
    for (int active = 0; active < 3; ++active) {
      auto result = ResolveSurfaceGeometry(design, width, height, active);
      ASSERT_TRUE(result);
      EXPECT_TRUE(result->compact);
      EXPECT_TRUE(result->dividers.empty());
      EXPECT_EQ((SurfaceRect{0, 0, width, height}), result->panes[active]);
      for (int pane = 0; pane < 4; ++pane) {
        EXPECT_EQ(pane == active && width > 0 && height > 0, result->visible[pane]);
      }
    }
  }
  EXPECT_FALSE(ResolveSurfaceGeometry(design, -1, 1000, 1));
  EXPECT_FALSE(ResolveSurfaceGeometry(design, 1000, 800, 3));
  EXPECT_FALSE(ResolveSurfaceGeometry(design, std::numeric_limits<int>::max(), 800, 1));
}

}  // namespace
}  // namespace tahai
