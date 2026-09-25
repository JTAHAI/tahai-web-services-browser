// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_COMMON_TAHAI_SKINS_TAHAI_SURFACE_DESIGN_H_
#define CHROME_COMMON_TAHAI_SKINS_TAHAI_SURFACE_DESIGN_H_

#include <array>
#include <optional>
#include <string>
#include <vector>

#include "base/values.h"

namespace tahai {

enum class SurfaceNodeKind { kPane, kRows, kColumns };

// A bounded binary layout tree. Nodes refer only to local node/pane indices;
// they never identify a Browser, WebContents, URL, renderer or action.
struct SurfaceNode {
  bool operator==(const SurfaceNode&) const = default;
  SurfaceNodeKind kind = SurfaceNodeKind::kPane;
  int pane = -1;
  std::string role;
  int first = -1;
  int second = -1;
  int percent = 50;
};

struct SurfaceDesign {
  bool operator==(const SurfaceDesign&) const = default;
  std::vector<SurfaceNode> nodes;  // Node zero is the root; at most seven nodes.
  std::string rail_dock = "leading";
  int gap = 8;
  int narrow_width = 640;
  int short_height = 360;
  std::vector<int> keyboard_order;
};

struct SurfaceRect {
  bool operator==(const SurfaceRect&) const = default;
  int x = 0;
  int y = 0;
  int width = 0;
  int height = 0;
};

struct SurfaceDivider {
  int node = -1;
  bool rows = false;
  SurfaceRect bounds;
  int first_extent = 0;
  int total_extent = 0;
};

struct SurfaceGeometry {
  std::array<SurfaceRect, 4> panes;
  std::array<bool, 4> visible = {};
  std::vector<SurfaceDivider> dividers;
  bool compact = false;
};

// Strict admission and canonical persistence. Invalid, aliased, cyclic,
// disconnected or over-deep graphs fail as a whole; they are never repaired.
bool ValidateSurfaceDesign(const SurfaceDesign& design);
int SurfacePaneCount(const SurfaceDesign& design);
base::DictValue EncodeSurfaceDesign(const SurfaceDesign& design);
std::optional<SurfaceDesign> DecodeSurfaceDesign(const base::DictValue& value);

// Pure native layout, in DIPs. Below the requested breakpoint or the tree's
// minimum size, show the active pane without changing tab membership or order.
std::optional<SurfaceGeometry> ResolveSurfaceGeometry(
    const SurfaceDesign& design, int width, int height, int active_pane);

}  // namespace tahai

#endif  // CHROME_COMMON_TAHAI_SKINS_TAHAI_SURFACE_DESIGN_H_
