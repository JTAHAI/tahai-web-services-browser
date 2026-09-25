// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/common/tahai_skins/tahai_surface_design.h"

#include <algorithm>
#include <array>
#include <functional>
#include <set>
#include <string_view>
#include <utility>

namespace tahai {
namespace {

constexpr std::array<std::string_view, 5> kRoles = {
    "working", "reference", "tasks", "preview", "notes"};

const char* KindName(SurfaceNodeKind kind) {
  switch (kind) {
    case SurfaceNodeKind::kPane: return "pane";
    case SurfaceNodeKind::kRows: return "rows";
    case SurfaceNodeKind::kColumns: return "columns";
  }
  return "";
}

}  // namespace

int SurfacePaneCount(const SurfaceDesign& design) {
  return static_cast<int>(std::ranges::count(
      design.nodes, SurfaceNodeKind::kPane, &SurfaceNode::kind));
}

bool ValidateSurfaceDesign(const SurfaceDesign& design) {
  if (design.nodes.empty() || design.nodes.size() > 7u ||
      (design.rail_dock != "leading" && design.rail_dock != "trailing") ||
      design.gap < 4 || design.gap > 24 || design.narrow_width < 320 ||
      design.narrow_width > 1600 || design.short_height < 200 ||
      design.short_height > 900) {
    return false;
  }
  std::set<int> visited;
  std::set<int> panes;
  const std::function<bool(int, int)> visit = [&](int index, int depth) {
    if (index < 0 || static_cast<size_t>(index) >= design.nodes.size() ||
        depth > 4 || !visited.insert(index).second) {
      return false;
    }
    const auto& node = design.nodes[index];
    if (node.kind == SurfaceNodeKind::kPane) {
      return node.pane >= 0 && node.pane < 4 && node.first == -1 &&
             node.second == -1 && node.percent == 50 &&
             std::ranges::find(kRoles, node.role) != kRoles.end() &&
             panes.insert(node.pane).second;
    }
    return (node.kind == SurfaceNodeKind::kRows ||
            node.kind == SurfaceNodeKind::kColumns) &&
           node.pane == -1 && node.role.empty() && node.percent >= 10 &&
           node.percent <= 90 && visit(node.first, depth + 1) &&
           visit(node.second, depth + 1);
  };
  if (!visit(0, 1) || visited.size() != design.nodes.size() ||
      panes.size() != design.keyboard_order.size()) {
    return false;
  }
  for (size_t index = 0; index < panes.size(); ++index) {
    if (!panes.contains(static_cast<int>(index))) {
      return false;
    }
  }
  return std::set<int>(design.keyboard_order.begin(), design.keyboard_order.end()) == panes;
}

base::DictValue EncodeSurfaceDesign(const SurfaceDesign& design) {
  base::ListValue nodes;
  for (const auto& node : design.nodes) {
    base::DictValue value;
    value.Set("kind", KindName(node.kind));
    if (node.kind == SurfaceNodeKind::kPane) {
      value.Set("pane", node.pane);
      value.Set("role", node.role);
    } else {
      value.Set("first", node.first);
      value.Set("second", node.second);
      value.Set("percent", node.percent);
    }
    nodes.Append(std::move(value));
  }
  base::ListValue order;
  for (int pane : design.keyboard_order) {
    order.Append(pane);
  }
  return base::DictValue().Set("version", 1).Set("nodes", std::move(nodes))
      .Set("rail_dock", design.rail_dock).Set("gap", design.gap)
      .Set("narrow_width", design.narrow_width).Set("short_height", design.short_height)
      .Set("keyboard_order", std::move(order));
}

std::optional<SurfaceDesign> DecodeSurfaceDesign(const base::DictValue& value) {
  const auto* nodes = value.FindList("nodes");
  const auto* dock = value.FindString("rail_dock");
  const auto gap = value.FindInt("gap");
  const auto narrow = value.FindInt("narrow_width");
  const auto height = value.FindInt("short_height");
  const auto* order = value.FindList("keyboard_order");
  if (value.size() != 7u || value.FindInt("version") != 1 || !nodes ||
      nodes->empty() || nodes->size() > 7u || !dock || !gap || !narrow ||
      !height || !order || order->size() > 4u) {
    return std::nullopt;
  }
  SurfaceDesign design{.rail_dock = *dock, .gap = *gap,
                        .narrow_width = *narrow, .short_height = *height};
  for (const auto& entry : *nodes) {
    const auto* node = entry.GetIfDict();
    const auto* kind = node ? node->FindString("kind") : nullptr;
    if (!kind) {
      return std::nullopt;
    }
    SurfaceNode parsed;
    if (*kind == "pane") {
      const auto pane = node->FindInt("pane");
      const auto* role = node->FindString("role");
      if (node->size() != 3u || !pane || !role) {
        return std::nullopt;
      }
      parsed.pane = *pane;
      parsed.role = *role;
    } else {
      const auto first = node->FindInt("first");
      const auto second = node->FindInt("second");
      const auto percent = node->FindInt("percent");
      if (node->size() != 4u || !first || !second || !percent ||
          (*kind != "rows" && *kind != "columns")) {
        return std::nullopt;
      }
      parsed.kind = *kind == "rows" ? SurfaceNodeKind::kRows : SurfaceNodeKind::kColumns;
      parsed.first = *first;
      parsed.second = *second;
      parsed.percent = *percent;
    }
    design.nodes.push_back(std::move(parsed));
  }
  for (const auto& pane : *order) {
    if (!pane.is_int()) {
      return std::nullopt;
    }
    design.keyboard_order.push_back(pane.GetInt());
  }
  return ValidateSurfaceDesign(design) ? std::make_optional(std::move(design))
                                        : std::nullopt;
}

std::optional<SurfaceGeometry> ResolveSurfaceGeometry(
    const SurfaceDesign& design, int width, int height, int active_pane) {
  if (!ValidateSurfaceDesign(design) || width < 0 || height < 0 ||
      width > 100000 || height > 100000 || active_pane < 0 ||
      active_pane >= SurfacePaneCount(design)) {
    return std::nullopt;
  }
  std::array<std::pair<int, int>, 7> minimums;
  const std::function<void(int)> measure = [&](int index) {
    const auto& node = design.nodes[index];
    if (node.kind == SurfaceNodeKind::kPane) {
      minimums[index] = {96, 64};
      return;
    }
    measure(node.first);
    measure(node.second);
    const auto [first_width, first_height] = minimums[node.first];
    const auto [second_width, second_height] = minimums[node.second];
    minimums[index] = node.kind == SurfaceNodeKind::kRows
        ? std::pair(std::max(first_width, second_width), first_height + second_height + design.gap)
        : std::pair(first_width + second_width + design.gap, std::max(first_height, second_height));
  };
  measure(0);
  SurfaceGeometry geometry;
  geometry.compact = width < std::max(design.narrow_width, minimums[0].first) ||
                     height < std::max(design.short_height, minimums[0].second);
  if (geometry.compact) {
    geometry.visible[active_pane] = width > 0 && height > 0;
    geometry.panes[active_pane] = {0, 0, width, height};
    return geometry;
  }
  const std::function<void(int, SurfaceRect)> place = [&](int index, SurfaceRect bounds) {
    const auto& node = design.nodes[index];
    if (node.kind == SurfaceNodeKind::kPane) {
      geometry.visible[node.pane] = true;
      geometry.panes[node.pane] = bounds;
      return;
    }
    const bool rows = node.kind == SurfaceNodeKind::kRows;
    const int total = (rows ? bounds.height : bounds.width) - design.gap;
    const int minimum_first = rows ? minimums[node.first].second : minimums[node.first].first;
    const int minimum_second = rows ? minimums[node.second].second : minimums[node.second].first;
    const int first_extent = std::clamp(total * node.percent / 100, minimum_first,
                                         total - minimum_second);
    SurfaceRect first = bounds, second = bounds, divider = bounds;
    if (rows) {
      first.height = first_extent;
      divider.y += first_extent;
      divider.height = design.gap;
      second.y += first_extent + design.gap;
      second.height = total - first_extent;
    } else {
      first.width = first_extent;
      divider.x += first_extent;
      divider.width = design.gap;
      second.x += first_extent + design.gap;
      second.width = total - first_extent;
    }
    geometry.dividers.push_back({index, rows, divider, first_extent, total});
    place(node.first, first);
    place(node.second, second);
  };
  place(0, {0, 0, width, height});
  return geometry;
}

}  // namespace tahai
