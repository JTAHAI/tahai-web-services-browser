// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/views/tabs/common/split_tab_view.h"

#include <limits>
#include <vector>

#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/layout_constants.h"
#include "chrome/browser/ui/tabs/tab_style.h"
#include "chrome/browser/ui/views/tabs/common/tab_collection_animating_layout_manager.h"
#include "chrome/browser/ui/views/tabs/common/tab_collection_node.h"
#include "chrome/browser/ui/views/tabs/common/tab_drag_handler.h"
#include "chrome/browser/ui/views/tabs/common/tab_strip_collection_controller.h"
#include "chrome/browser/ui/views/tabs/common/tab_view.h"
#include "chrome/browser/ui/views/tabs/hovercard/tab_hover_card_controller.h"
#include "chrome/browser/ui/views/tabs/tab/glow_hover_controller.h"
#include "components/tabs/public/tab_collection.h"
#include "components/tabs/public/tab_interface.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/views/border.h"
#include "ui/views/layout/delegating_layout_manager.h"
#include "ui/views/layout/proposed_layout.h"
#include "ui/views/view.h"
#include "ui/views/view_class_properties.h"
#include "ui/views/view_utils.h"
#include "ui/views/widget/widget.h"

SplitTabView::SplitTabView(TabCollectionNode* collection_node)
    : collection_node_(collection_node),
      hover_controller_(gfx::Animation::ShouldRenderRichAnimation()
                            ? std::make_unique<GlowHoverController>(
                                  this,
                                  TabView::kGlowHoverAnimationDuration)
                            : nullptr) {
  SetLayoutManager(std::make_unique<views::DelegatingLayoutManager>(this));

  collection_node->set_detach_child_from_node(base::BindRepeating(
      &SplitTabView::RemoveChildViewForReparenting, base::Unretained(this)));

  node_destroyed_subscription_ =
      collection_node_->RegisterWillDestroyCallback(base::BindOnce(
          &SplitTabView::ResetCollectionNode, base::Unretained(this)));

  CHECK(collection_node_->GetController());
  auto* state_controller =
      collection_node_->GetController()->GetStateController();
  CHECK(state_controller);
  OnCollapseStateChanged(state_controller->GetCollapseState());
  collapsed_state_changed_subscription_ =
      state_controller->RegisterOnCollapseChanged(base::BindRepeating(
          &SplitTabView::OnCollapseStateChanged, base::Unretained(this)));

  // Ensures this view gets mouse events as well its children.
  SetNotifyEnterExitOnChild(true);
}

SplitTabView::~SplitTabView() = default;

void SplitTabView::OnThemeChanged() {
  views::View::OnThemeChanged();
  UpdateBorder();
}

void SplitTabView::AddedToWidget() {
  paint_as_active_subscription_ =
      GetWidget()->RegisterPaintAsActiveChangedCallback(base::BindRepeating(
          &SplitTabView::UpdateBorder, base::Unretained(this)));

  OnDataChanged();
  UpdateHovered(IsMouseHovered());
}

void SplitTabView::RemovedFromWidget() {
  paint_as_active_subscription_ = {};
}

void SplitTabView::OnMouseEntered(const ui::MouseEvent& event) {
  UpdateHovered(true);
}

void SplitTabView::OnMouseExited(const ui::MouseEvent& event) {
  UpdateHovered(false);
}

void SplitTabView::OnMouseMoved(const ui::MouseEvent& event) {
  // Linux enter/leave events are sometimes flaky, so we don't want to "miss"
  // an enter event and fail to hover the tab.
  UpdateHovered(true);
}

void SplitTabView::OnPaint(gfx::Canvas* canvas) {
  if (pinned_) {
    const std::vector<views::View*> children =
        collection_node_ ? collection_node_->GetDirectChildren()
                         : std::vector<views::View*>();
    std::optional<SkColor> background_color =
        !children.empty()
            ? views::AsViewClass<TabView>(children[0])->GetBackgroundColor()
            : std::nullopt;
    if (background_color.has_value()) {
      cc::PaintFlags flags;
      flags.setAntiAlias(true);
      flags.setColor(background_color.value());
      const float corner_radius =
          GetLayoutConstant(LayoutConstant::kVerticalTabCornerRadius) -
          GetInsets().top() / 2.0;
      canvas->DrawRoundRect(GetContentsBounds(), corner_radius, flags);
    }
  }

  views::View::OnPaint(canvas);
}

views::ProposedLayout SplitTabView::CalculateProposedLayout(
    const views::SizeBounds& size_bounds) const {
  if (collection_node_ &&
      collection_node_->orientation() == TabStripOrientation::kHorizontal) {
    return CalculateHorizontalLayout(size_bounds);
  }
  return CalculateVerticalLayout(size_bounds);
}

gfx::Size SplitTabView::GetMinimumSize() const {
  if (collection_node_ &&
      collection_node_->orientation() == TabStripOrientation::kHorizontal) {
    int min_width = 0;
    for (views::View* child : children()) {
      min_width += child->GetMinimumSize().width();
    }
    return gfx::Size(min_width, GetLayoutConstant(LayoutConstant::kTabHeight));
  }
  return views::View::GetMinimumSize();
}

std::optional<BrowserRootView::DropIndex> SplitTabView::GetLinkDropIndex(
    const gfx::Point& loc_in_view) {
  if (!collection_node_ || !collection_node_->GetController()) {
    return std::nullopt;
  }

  CHECK_GE(collection_node_->children().size(), 2ul);
  CHECK_LE(collection_node_->children().size(), 4ul);

  TabDragHandler& drag_handler =
      collection_node_->GetController()->GetDragHandler();

  // Links can't be dropped between tabs in a split collection, so route to
  // the nearest real tab for 2-up, 3-up, and Quad View alike.
  TabCollectionNode* closest_node = nullptr;
  int closest_distance = std::numeric_limits<int>::max();
  for (const auto& node : collection_node_->children()) {
    const gfx::Point center = views::View::ConvertPointToTarget(
        node->view(), this, node->view()->GetLocalBounds().CenterPoint());
    const int distance = (center - loc_in_view).LengthSquared();
    if (distance < closest_distance) {
      closest_distance = distance;
      closest_node = node.get();
    }
  }
  CHECK(closest_node);
  return drag_handler.GetLinkDropIndexForNode(*closest_node, std::nullopt);
}

double SplitTabView::GetHoverAnimationValue() const {
  if (!hover_controller_) {
    return hovered_ ? 1.0 : 0.0;
  }
  return hover_controller_->GetAnimationValue();
}

void SplitTabView::ResetCollectionNode() {
  CHECK(collection_node_);
  TabHoverCardController* hover_card_controller =
      collection_node_->GetController()->GetHoverCardController();
  if (hover_card_controller) {
    hover_card_controller->UpdateHoverCard(
        nullptr, TabSlotController::HoverCardUpdateType::kTabRemoved);
  }

  node_destroyed_subscription_ = {};
  collapsed_state_changed_subscription_ = {};
  collection_node_ = nullptr;
}

void SplitTabView::OnDataChanged() {
  const tabs::TabCollection* tab_collection =
      std::get<const tabs::TabCollection*>(collection_node_->GetNodeData());
  const std::vector<tabs::TabInterface*> tabs =
      tab_collection->GetTabsRecursive();
  pinned_ = tabs[0]->IsPinned();

  UpdateBorder();
}

void SplitTabView::UpdateBorder() {
  if (pinned_) {
    const bool is_frame_active =
        GetWidget() ? GetWidget()->ShouldPaintAsActive() : true;
    SetBorder(views::CreateRoundedRectBorder(
        GetLayoutConstant(LayoutConstant::kVerticalTabPinnedBorderThickness),
        GetLayoutConstant(LayoutConstant::kVerticalTabCornerRadius),
        is_frame_active ? kColorTabDividerFrameActive
                        : kColorTabDividerFrameInactive));
  } else if (GetBorder()) {
    SetBorder(nullptr);
  }
}

void SplitTabView::UpdateHovered(bool hovered) {
  if (hovered_ == hovered) {
    return;
  }

  hovered_ = hovered;

  float radial_highlight_opacity = 1.0f;
  for (views::View* child : children()) {
    if (auto* tab_view = views::AsViewClass<TabView>(child)) {
      tab_view->UpdateHovered(hovered_);
      radial_highlight_opacity = tab_view->radial_highlight_opacity();
    }
  }

  if (hover_controller_) {
    if (hovered_) {
      hover_controller_->SetSubtleOpacityScale(radial_highlight_opacity);
      hover_controller_->Show(TabStyle::ShowHoverStyle::kSubtle);
    } else {
      hover_controller_->Hide(TabStyle::HideHoverStyle::kGradual);
    }
  }

  SchedulePaint();
}

views::ProposedLayout SplitTabView::CalculateHorizontalLayout(
    const views::SizeBounds& size_bounds) const {
  views::ProposedLayout layouts;
  const std::vector<views::View*> children =
      collection_node_ ? collection_node_->GetDirectChildren()
                       : std::vector<views::View*>();
  if (children.size() < 2u || children.size() > 4u) {
    layouts.host_size = gfx::Size(0, 0);
    return layouts;
  }

  const int height = size_bounds.height().value_or(
      GetLayoutConstant(LayoutConstant::kTabHeight));

  // Layout children horizontally side-by-side in order.
  int x = 0;
  for (size_t i = 0; i < children.size(); ++i) {
    views::View* child = children[i];
    gfx::Rect bounds = gfx::Rect(child->GetPreferredSize());
    bounds.set_x(x);
    bounds.set_height(height);

    // Fill available width evenly if bounded.
    if (size_bounds.width().is_bounded()) {
      const int width = std::max(0, size_bounds.width().value());
      const int next_x = static_cast<int>(static_cast<int64_t>(width) *
                                          (i + 1u) / children.size());
      bounds.set_width(next_x - x);
    }
    x += bounds.width();
    layouts.child_layouts.emplace_back(child, child->GetVisible(), bounds);
  }

  layouts.host_size = gfx::Size(x, height);
  return layouts;
}

views::ProposedLayout SplitTabView::CalculateVerticalLayout(
    const views::SizeBounds& size_bounds) const {
  views::ProposedLayout layouts;
  int width = 0;
  int height = 0;

  const std::vector<views::View*> children =
      collection_node_ ? collection_node_->GetDirectChildren()
                       : std::vector<views::View*>();
  if (children.size() < 2u || children.size() > 4u) {
    layouts.host_size = gfx::Size(0, 0);
    return layouts;
  }

  const int border_thickness =
      pinned_
          ? GetLayoutConstant(LayoutConstant::kVerticalTabPinnedBorderThickness)
          : 0;

  // Layout children in order. Children will have their preferred height and
  // fill available width. If unbounded or uncollapsed and both children fit on
  // one row they will share it, otherwise they will be stacked vertically.
  if (!size_bounds.width().is_bounded() ||
      (!collapsed_ &&
       size_bounds.width().value() >=
           static_cast<int>(
               GetLayoutConstant(LayoutConstant::kVerticalTabMinWidth) *
               children.size()))) {
    int x = 0;
    for (size_t index = 0; index < children.size(); ++index) {
      auto* child = children[index];
      gfx::Rect bounds = gfx::Rect(child->GetPreferredSize());
      bounds.set_x(x);
      // Fill available width if bounded.
      if (size_bounds.width().is_bounded()) {
        const int total_gap =
            kSplitViewGap * static_cast<int>(children.size() - 1u);
        const int usable_width =
            std::max(0, size_bounds.width().value() - total_gap);
        const int prior_width = static_cast<int>(std::floor(
            static_cast<double>(usable_width) * index / children.size()));
        const int next_width =
            static_cast<int>(std::floor(static_cast<double>(usable_width) *
                                        (index + 1u) / children.size()));
        bounds.set_width(next_width - prior_width);
      }
      x += bounds.width();
      if (index + 1u < children.size()) {
        x += kSplitViewGap;
      }
      height = std::max(height, bounds.height());
      layouts.child_layouts.emplace_back(child, child->GetVisible(), bounds);
    }
    width = x;
  } else {
    int y = 0;
    for (size_t index = 0; index < children.size(); ++index) {
      auto* child = children[index];
      gfx::Rect bounds = gfx::Rect(child->GetPreferredSize());
      bounds.set_y(y);
      bounds.set_width(size_bounds.width().value());
      bounds.set_height(bounds.height());
      y += bounds.height() - 2 * border_thickness;
      if (index + 1u < children.size()) {
        y += kSplitViewGap;
      }
      layouts.child_layouts.emplace_back(child, child->GetVisible(), bounds);
    }
    width = size_bounds.width().value();
    height = y + 2 * border_thickness;
  }
  layouts.host_size = gfx::Size(width, height);
  return layouts;
}

void SplitTabView::OnCollapseStateChanged(
    tabs::VerticalTabStripCollapseState state) {
  collapsed_ = state == tabs::VerticalTabStripCollapseState::kCollapsed;
}

std::unique_ptr<views::View> SplitTabView::RemoveChildViewForReparenting(
    views::View* child_view) {
  DCHECK(std::ranges::contains(children(), child_view));
  CHECK(collection_node_);

  auto children = collection_node_->GetDirectChildren();
  auto source_layout_info = std::make_unique<
      TabCollectionAnimatingLayoutManager::SourceLayoutInfo>(
      TabCollectionAnimatingLayoutManager::SourceLayoutInfo{
          .animation_axis =
              TabCollectionAnimatingLayoutManager::AnimationAxis::kHorizontal,
          // Note: Tabs are removed from the split view collection from the
          // front first so it is necessary to test the number of children
          // in the collection when computing the animation direction.
          .animation_direction =
              (children.size() == 2 && children[0] == child_view)
                  ? TabCollectionAnimatingLayoutManager::AnimationDirection::
                        kEndToStart
                  : TabCollectionAnimatingLayoutManager::AnimationDirection::
                        kStartToEnd,
      });

  // Ensure we remove the child view before setting source layout info to
  // prevent the manager from clearing the metadata.
  auto removed_child_view = RemoveChildViewT(child_view);
  TabCollectionAnimatingLayoutManager::SetSourceLayoutInfo(
      child_view, std::move(source_layout_info));

  return removed_child_view;
}

BEGIN_METADATA(SplitTabView)
END_METADATA
