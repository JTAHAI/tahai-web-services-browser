// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/views/frame/multi_contents_view.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstdlib>

#include "base/check_deref.h"
#include "base/notreached.h"
#include "chrome/browser/actor/ui/actor_overlay_web_view.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_element_identifiers.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/read_anything/read_anything_immersive_overlay_view.h"
#include "chrome/browser/ui/sad_tab_helper.h"
#include "chrome/browser/ui/view_ids.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/browser/ui/views/frame/contents_container_view.h"
#include "chrome/browser/ui/views/frame/contents_separator.h"
#include "chrome/browser/ui/views/frame/contents_web_view.h"
#include "chrome/browser/ui/views/frame/custom_floating_corner.h"
#include "chrome/browser/ui/views/frame/multi_contents_background_view.h"
#include "chrome/browser/ui/views/frame/multi_contents_drop_target_view.h"
#include "chrome/browser/ui/views/frame/multi_contents_resize_area.h"
#include "chrome/browser/ui/views/frame/multi_contents_view_delegate.h"
#include "chrome/browser/ui/views/frame/multi_contents_view_drop_target_controller.h"
#include "chrome/browser/ui/views/frame/multi_contents_view_mini_toolbar.h"
#include "chrome/browser/ui/views/frame/scrim_view.h"
#include "chrome/browser/ui/views/frame/themed_background.h"
#include "chrome/browser/ui/views/new_tab_footer/footer_web_view.h"
#include "chrome/browser/ui/views/toolbar/toolbar_view.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/webui_url_constants.h"
#include "components/prefs/pref_service.h"
#include "components/split_tabs/split_tab_visual_data.h"
#include "content/public/browser/web_contents.h"
#include "content/public/common/url_constants.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/base/ozone_buildflags.h"
#include "ui/compositor/layer.h"
#include "ui/gfx/geometry/outsets.h"
#include "ui/gfx/geometry/rect.h"
#include "ui/gfx/geometry/rounded_corners_f.h"
#include "ui/views/layout/flex_layout_types.h"
#include "ui/views/layout/layout_types.h"
#include "ui/views/layout/proposed_layout.h"
#include "ui/views/view_class_properties.h"

namespace {
constexpr int kSnapDistance = 15;

constexpr float kSplitViewContentCornerRadius = 6;
constexpr gfx::RoundedCornersF kSplitViewContentRoundedCorners{
    kSplitViewContentCornerRadius};
}  // namespace

void MultiContentsView::ContentsSeparators::Reset() {
  top_separator = nullptr;
  leading_separator = nullptr;
  trailing_separator = nullptr;
  corner_separator = nullptr;
}

MultiContentsView::MultiContentsView(
    BrowserView* browser_view,
    std::unique_ptr<MultiContentsViewDelegate> delegate)
    : browser_view_(browser_view),
      delegate_(std::move(delegate)),
      split_view_insets_(gfx::Insets::TLBR(0,
                                           kSplitViewContentInset,
                                           kSplitViewContentInset,
                                           kSplitViewContentInset)) {
  SetLayoutManager(std::make_unique<views::DelegatingLayoutManager>(this));
  SetProperty(views::kElementIdentifierKey, kMultiContentsViewElementId);

  background_view_ =
      AddChildView(std::make_unique<MultiContentsBackgroundView>(browser_view));

  contents_container_views_.push_back(
      AddChildView(std::make_unique<ContentsContainerView>(browser_view_)));
  contents_container_views_[0]
      ->contents_view()
      ->set_is_primary_web_contents_for_window(true);

  resize_area_ = AddChildView(std::make_unique<MultiContentsResizeArea>(this));
  resize_area_->SetVisible(false);

  contents_container_views_.push_back(
      AddChildView(std::make_unique<ContentsContainerView>(browser_view_)));
  contents_container_views_[1]->SetVisible(false);

  for (int index = 2; index < kMaxContentsViews; ++index) {
    contents_container_views_.push_back(
        AddChildView(std::make_unique<ContentsContainerView>(browser_view_)));
    contents_container_views_.back()->SetVisible(false);
  }

  tahai_row_resize_area_ =
      AddChildView(std::make_unique<MultiContentsResizeArea>(
          this, split_tabs::TahaiGridAxis::kRows));
  tahai_column_resize_area_ =
      AddChildView(std::make_unique<MultiContentsResizeArea>(
          this, split_tabs::TahaiGridAxis::kColumns));
  tahai_row_resize_area_->SetVisible(false);
  tahai_column_resize_area_->SetVisible(false);

  drop_target_view_ =
      AddChildView(std::make_unique<MultiContentsDropTargetView>());
  drop_target_controller_ =
      std::make_unique<MultiContentsViewDropTargetController>(
          *drop_target_view_, *delegate_, g_browser_process->local_state(),
          browser_view_->browser()->tab_strip_model());

  contents_separators_.top_separator =
      AddChildView(ContentsSeparator::CreateLayerBasedContentsSeparator());
  contents_separators_.top_separator->SetProperty(
      views::kElementIdentifierKey, kContentsSeparatorTopEdgeElementId);

  contents_separators_.leading_separator =
      AddChildView(ContentsSeparator::CreateLayerBasedContentsSeparator());
  contents_separators_.leading_separator->SetProperty(
      views::kElementIdentifierKey, kContentsSeparatorLeadingEdgeElementId);

  contents_separators_.trailing_separator =
      AddChildView(ContentsSeparator::CreateLayerBasedContentsSeparator());
  contents_separators_.trailing_separator->SetProperty(
      views::kElementIdentifierKey, kContentsSeparatorTrailingEdgeElementId);

  contents_separators_.corner_separator =
      AddChildView(std::make_unique<CustomFloatingCorner>(
          *browser_view_, CornerOrientation::kTopLeading,
          views::ShapeContextTokens::kContentSeparatorRadius,
          CustomFloatingCorner::ToolbarTheme(),
          kColorToolbarContentAreaSeparator));
  contents_separators_.corner_separator->SetProperty(
      views::kElementIdentifierKey, kContentsSeparatorTopCornerElementId);

  // Create the view that will house the Lens overlay. This view is visible but
  // transparent view that is used as a container for the Lens overlay WebView.
  // It must have a higher index than contents_view so that it is drawn on top
  // of it. Uses a fill layout so that the overlay WebView can fill the entire
  // container.
  auto lens_overlay_view = std::make_unique<views::View>();
  lens_overlay_view->SetID(VIEW_ID_LENS_OVERLAY);
  lens_overlay_view->SetProperty(views::kElementIdentifierKey,
                                 kLensOverlayViewElementId);
  lens_overlay_view->SetVisible(false);
  lens_overlay_view->SetLayoutManager(std::make_unique<views::FillLayout>());
  lens_overlay_view_ = AddChildView(std::move(lens_overlay_view));

  for (auto& contents_container_view : contents_container_views_) {
    auto& view_map = container_focusable_map_[contents_container_view];

    auto* contents_view = contents_container_view->contents_view();
    view_map[contents_view->GetClassName()] = contents_view;

    contents_focused_subscriptions_.push_back(
        contents_view->AddWebContentsFocusedCallback(base::BindRepeating(
            &MultiContentsView::OnWebContentsFocused, base::Unretained(this))));

    if (auto* footer = contents_container_view->new_tab_footer_view()) {
      view_map[footer->GetClassName()] = footer;
      contents_focused_subscriptions_.push_back(
          footer->AddWebContentsFocusedCallback(base::BindRepeating(
              &MultiContentsView::OnNtpFooterFocused, base::Unretained(this))));
    }

    if (auto* actor_overlay =
            contents_container_view->actor_overlay_web_view()) {
      view_map[actor_overlay->GetClassName()] = actor_overlay;
      contents_focused_subscriptions_.push_back(
          actor_overlay->AddWebContentsFocusedCallback(
              base::BindRepeating(&MultiContentsView::OnActorOverlayFocused,
                                  base::Unretained(this))));
    }

    if (auto* read_anything_overlay =
            contents_container_view->read_anything_immersive_overlay_view()) {
      view_map[read_anything_overlay->GetClassName()] = read_anything_overlay;
      contents_focused_subscriptions_.push_back(
          read_anything_overlay->AddWebViewFocusedCallback(base::BindRepeating(
              &MultiContentsView::OnReadAnythingOverlayFocused,
              base::Unretained(this), contents_container_view)));
    }
  }

  is_drag_drop_pref_enabled_ =
      browser_view_->GetProfile()->GetPrefs()->GetBoolean(
          prefs::kSplitViewDragAndDropEnabled);

  pref_change_registrar_.Init(browser_view_->GetProfile()->GetPrefs());
  pref_change_registrar_.Add(
      prefs::kSplitViewDragAndDropEnabled,
      base::BindRepeating(&MultiContentsView::OnDragAndDropPrefStateChange,
                          base::Unretained(this)));
}

MultiContentsView::~MultiContentsView() {
  // Clear the map before `RemoveAllChildViews()` to avoid having dangling
  // pointers.
  container_focusable_map_.clear();
  if (drop_target_controller_) {
    drop_target_controller_.reset();
  }
  drop_target_view_ = nullptr;
  lens_overlay_view_ = nullptr;
  resize_area_ = nullptr;
  tahai_row_resize_area_ = nullptr;
  tahai_column_resize_area_ = nullptr;
  contents_separators_.Reset();
  background_view_ = nullptr;
  RemoveAllChildViews();
}

ContentsWebView* MultiContentsView::GetActiveContentsView() const {
  return GetActiveContentsContainerView()->contents_view();
}

ContentsWebView* MultiContentsView::GetInactiveContentsView() const {
  return GetInactiveContentsContainerView()->contents_view();
}

ContentsContainerView* MultiContentsView::GetActiveContentsContainerView()
    const {
  return contents_container_views_[active_index_];
}

ContentsContainerView* MultiContentsView::GetInactiveContentsContainerView()
    const {
  return contents_container_views_[GetInactiveIndex()];
}

const gfx::RoundedCornersF& MultiContentsView::GetBackgroundRadii() const {
  return background_view_->GetRoundedCorners();
}

void MultiContentsView::SetBackgroundRadii(const gfx::RoundedCornersF& radii) {
  if (radii == GetBackgroundRadii()) {
    return;
  }

  background_view_->SetRoundedCorners(radii);

  if (!IsInSplitView()) {
    GetActiveContentsContainerView()->SetRoundedCorners(radii);
    GetInactiveContentsContainerView()->SetRoundedCorners(
        gfx::RoundedCornersF());
  }
}

ContentsContainerView* MultiContentsView::GetContentsContainerViewFor(
    content::WebContents* web_contents) const {
  for (auto& container_view : contents_container_views_) {
    if (container_view->contents_view()->web_contents() == web_contents) {
      return container_view;
    }
  }
  return nullptr;
}

const MultiContentsView::FocusableViewMap*
MultiContentsView::GetFocusableViewsMapFor(
    const ContentsContainerView* container) const {
  auto it = container_focusable_map_.find(container);
  if (it != container_focusable_map_.end()) {
    return &it->second;
  }

  return nullptr;
}

bool MultiContentsView::IsInSplitView() const {
  return is_multi_contents_mode_;
}

size_t MultiContentsView::GetVisibleContentsCount() const {
  return std::ranges::count_if(
      contents_container_views_,
      [](const ContentsContainerView* view) { return view->GetVisible(); });
}

void MultiContentsView::SetWebContentsAtIndex(
    content::WebContents* web_contents,
    int index) {
  CHECK(index >= 0 && index < kMaxContentsViews);
  if (contents_container_views_[index]->contents_view()->web_contents() !=
      web_contents) {
    tahai_grid_resize_state_.reset();
  }
  contents_container_views_[index]->contents_view()->SetWebContents(
      web_contents);

  if (index > 0 && web_contents) {
    is_multi_contents_mode_ = true;
    contents_container_views_[index]->SetVisible(!tahai_focus_mode_);
    UpdateResizeAreaVisibility();
    UpdateContentsBorderAndOverlay();
    InvalidateLayout();
  }

  if (web_contents) {
    if (auto* sad_tab_helper = SadTabHelper::FromWebContents(web_contents)) {
      sad_tab_helper->ReinstallInWebView();
    }
  }
}

void MultiContentsView::ClearWebContents() {
  tahai_grid_resize_state_.reset();
  for (ContentsContainerView* container : contents_container_views_) {
    container->contents_view()->SetWebContents(nullptr);
  }
}

void MultiContentsView::ShowSplitView(
    split_tabs::SplitTabVisualData visual_data) {
  tahai_grid_resize_state_.reset();
  is_multi_contents_mode_ = true;
  if (!contents_container_views_[1]->GetVisible()) {
    // If split view is not visible, set the `visual_data_` and update the view
    // visibility.
    visual_data_ = visual_data;
    contents_container_views_[1]->SetVisible(!tahai_focus_mode_);
    resize_area_->SetVisible(!tahai_focus_mode_);
    resize_area_->SetLayout(visual_data.split_layout());
    UpdateContentsBorderAndOverlay();
  } else {
    // If the split view is visible, update the split visual data.
    UpdateSplitVisualData(visual_data);
  }
}

void MultiContentsView::CloseSplitView() {
  if (!IsInSplitView()) {
    return;
  }

  if (active_index_ != 0) {
    SwapContentsViews(0, active_index_);
  }
  for (size_t index = 1; index < contents_container_views_.size(); ++index) {
    contents_container_views_[index]->contents_view()->SetWebContents(nullptr);
    contents_container_views_[index]->SetVisible(false);
  }
  is_multi_contents_mode_ = false;
  tahai_focus_mode_ = false;
  resize_area_->SetVisible(false);
  tahai_grid_resize_state_.reset();
  tahai_row_resize_area_->SetVisible(false);
  tahai_column_resize_area_->SetVisible(false);
  UpdateContentsBorderAndOverlay();

  if (auto* active_contents = GetActiveContentsView()->web_contents()) {
    if (auto* sad_tab_helper = SadTabHelper::FromWebContents(active_contents)) {
      sad_tab_helper->ReinstallInWebView();
    }
  }
}

void MultiContentsView::SwapContentsInSplitView() {
  SwapContentsViews(0, 1);
}

void MultiContentsView::SwapContentsViews(size_t first, size_t second) {
  CHECK_LT(first, contents_container_views_.size());
  CHECK_LT(second, contents_container_views_.size());
  if (first == second) {
    return;
  }
  // Reorder the child views so that focus order will be consistent with
  // contents_container_views_.
  ContentsContainerView* start_view = contents_container_views_[first];
  ContentsContainerView* end_view = contents_container_views_[second];
  size_t start_view_child_index = GetIndexOf(start_view).value();
  size_t end_view_child_index = GetIndexOf(end_view).value();
  ReorderChildView(start_view, end_view_child_index);
  ReorderChildView(end_view, start_view_child_index);

  std::swap(contents_container_views_[first],
            contents_container_views_[second]);

  if (active_index_ == static_cast<int>(first)) {
    active_index_ = static_cast<int>(second);
  } else if (active_index_ == static_cast<int>(second)) {
    active_index_ = static_cast<int>(first);
  }
}

void MultiContentsView::SynchronizeContentsInSplitView(
    const std::vector<content::WebContents*>& ordered_contents,
    int active_index) {
  CHECK_GE(ordered_contents.size(), 2u);
  CHECK_LE(ordered_contents.size(), contents_container_views_.size());
  CHECK_GE(active_index, 0);
  CHECK_LT(static_cast<size_t>(active_index), ordered_contents.size());
  tahai_grid_resize_state_.reset();
  for (size_t index = 0; index < ordered_contents.size(); ++index) {
    CHECK(ordered_contents[index]);
    const auto found =
        std::find_if(contents_container_views_.begin() + index,
                     contents_container_views_.end(), [&](const auto& view) {
                       return view->contents_view()->web_contents() ==
                              ordered_contents[index];
                     });
    CHECK(found != contents_container_views_.end());
    SwapContentsViews(index, found - contents_container_views_.begin());
  }
  for (size_t index = ordered_contents.size();
       index < contents_container_views_.size(); ++index) {
    contents_container_views_[index]->contents_view()->SetWebContents(nullptr);
    contents_container_views_[index]->SetVisible(false);
  }
  // Make the model's new active pane visible before SetActiveIndex's invariant
  // check when the previous active pane was closed in Focus Pane mode.
  contents_container_views_[active_index]->SetVisible(true);
  SetActiveIndex(active_index);
  InvalidateLayout();
}

void MultiContentsView::SetActiveIndex(int index) {
  // Index should never be less than 0 or equal to or greater than the total
  // number of contents views.
  CHECK(index >= 0 && index < kMaxContentsViews);
  // Normal multi-pane activation comes from a visible pane. In Focus Pane,
  // keyboard tab navigation may select another hidden member; reveal that
  // native WebContents atomically instead of rejecting the active-target
  // change.
  CHECK(tahai_focus_mode_ || contents_container_views_[index]->GetVisible());
  active_index_ = index;
  for (size_t view_index = 0; view_index < contents_container_views_.size();
       ++view_index) {
    contents_container_views_[view_index]
        ->contents_view()
        ->set_is_primary_web_contents_for_window(
            view_index == static_cast<size_t>(active_index_));
  }
  UpdatePaneVisibility();
  UpdateContentsBorderAndOverlay();
}

bool MultiContentsView::SetTahaiFocusMode(bool enabled) {
  if (!IsInSplitView() ||
      (GetVisibleContentsCount() < 2u && !tahai_focus_mode_)) {
    return false;
  }
  if (tahai_focus_mode_ == enabled) {
    return true;
  }
  tahai_focus_mode_ = enabled;
  tahai_grid_resize_state_.reset();
  UpdatePaneVisibility();
  UpdateContentsBorderAndOverlay();
  InvalidateLayout();
  GetActiveContentsView()->RequestFocus();
  return true;
}

bool MultiContentsView::IsAnyInactiveContentsViewFocused() const {
  for (size_t index = 0; index < contents_container_views_.size(); ++index) {
    if (index != static_cast<size_t>(active_index_) &&
        contents_container_views_[index]->GetVisible() &&
        contents_container_views_[index]->contents_view()->HasFocus()) {
      return true;
    }
  }
  return false;
}

void MultiContentsView::UpdateSplitVisualData(
    const split_tabs::SplitTabVisualData& visual_data) {
  if (visual_data_ == visual_data) {
    return;
  }

  if (visual_data_.split_layout() != visual_data.split_layout()) {
    tahai_grid_resize_state_.reset();
  }
  visual_data_ = visual_data;
  resize_area_->SetLayout(visual_data.split_layout());
  InvalidateLayout();
}

void MultiContentsView::SetHighlightActiveContentsView(bool is_highlighted) {
  if (active_contents_view_highlighted_ != is_highlighted) {
    active_contents_view_highlighted_ = is_highlighted;
    UpdateContentsBorderAndOverlay();
  }
}

void MultiContentsView::ExecuteOnEachVisibleContentsView(
    base::RepeatingCallback<void(ContentsWebView*)> callback) {
  for (auto& contents_container_view : contents_container_views_) {
    if (contents_container_view->GetVisible()) {
      callback.Run(contents_container_view->contents_view());
    }
  }
}

void MultiContentsView::OnSwap() {
  CHECK(IsInSplitView());
  if (GetVisibleContentsCount() != 2u) {
    return;
  }
  delegate_->ReverseWebContents();
}

void MultiContentsView::SetTargetContentBounds(
    std::optional<TargetContentBounds> target_content_bounds) {
  if (target_content_bounds_ == target_content_bounds) {
    return;
  }
  target_content_bounds_ = target_content_bounds;

  InvalidateLayout(/*avoid_propagate_during_layout=*/true);
}

void MultiContentsView::SetIsAnimatingContent(bool is_animating) {
  for (auto& contents_container_view : contents_container_views_) {
    contents_container_view->contents_view()->SetIsAnimatingBounds(
        is_animating);
  }
}

std::vector<views::View*> MultiContentsView::GetAccessiblePanes() {
  std::vector<views::View*> accessible_panes;
  for (auto& contents_container_view : contents_container_views_) {
    if (!contents_container_view->GetVisible()) {
      continue;
    }
    auto contents_accessible_panes =
        contents_container_view->GetAccessiblePanes();
    accessible_panes.insert(accessible_panes.end(),
                            contents_accessible_panes.begin(),
                            contents_accessible_panes.end());
  }
  for (auto* divider :
       {tahai_row_resize_area_.get(), tahai_column_resize_area_.get()}) {
    if (divider->GetVisible()) {
      accessible_panes.push_back(divider->GetAccessibleResizeHandle());
    }
  }
  return accessible_panes;
}

void MultiContentsView::OnResize(int resize_amount, bool done_resizing) {
  if (GetVisibleContentsCount() != 2u) {
    return;
  }
  if (!initial_start_size_on_resize_.has_value()) {
    initial_start_size_on_resize_ = std::make_optional(
        GetResizeAxisComponent(contents_container_views_[0]->size()));
  }
  double total_size =
      GetResizeAxisComponent(contents_container_views_[0]->size()) +
      GetResizeAxisComponent(contents_container_views_[1]->size());
  double new_start_size = initial_start_size_on_resize_.value() + resize_amount;

  // If new_start_size is within the snap point sizes, update to the snap
  // point.
  delegate_->ResizeWebContents(
      CalculateRatioWithSnapPoints(new_start_size, total_size), done_resizing);

  if (done_resizing) {
    initial_start_size_on_resize_ = std::nullopt;
  }
}

// static
MultiContentsView::ViewSizes MultiContentsView::GetTahaiGridSizes(int extent,
                                                                  double ratio,
                                                                  int divider) {
  extent = std::max(0, extent);
  ViewSizes sizes;
  sizes.resize = std::clamp(divider, 0, std::max(0, extent - 2));
  const int available = extent - sizes.resize;
  const int minimum = std::min(kMinWebContentsSize, available / 2);
  ratio = std::isfinite(ratio) ? std::clamp(ratio, 0.1, 0.9) : 0.5;
  sizes.start = std::clamp(static_cast<int>(std::round(available * ratio)),
                           minimum, available - minimum);
  sizes.end = available - sizes.start;
  return sizes;
}

double MultiContentsView::GetTahaiGridRatio(
    split_tabs::TahaiGridAxis axis) const {
  return axis == split_tabs::TahaiGridAxis::kRows
             ? visual_data_.tahai_row_ratio()
             : visual_data_.tahai_column_ratio();
}

MultiContentsResizeArea* MultiContentsView::tahai_grid_resize_area_for_testing(
    split_tabs::TahaiGridAxis axis) const {
  return axis == split_tabs::TahaiGridAxis::kRows
             ? tahai_row_resize_area_.get()
             : tahai_column_resize_area_.get();
}

bool MultiContentsView::BeginTahaiGridResize(split_tabs::TahaiGridAxis axis) {
  tahai_grid_resize_state_.reset();
  const auto* tab = browser_view_->browser()->tab_strip_model()->GetActiveTab();
  if (!tab || !tab->GetSplit() || tahai_focus_mode_ ||
      GetVisibleContentsCount() < 3u) {
    return false;
  }
  gfx::Rect bounds;
  for (auto& container : contents_container_views_) {
    if (container->GetVisible()) {
      bounds.Union(container->bounds());
    }
  }
  const bool rows = axis == split_tabs::TahaiGridAxis::kRows;
  const auto* area =
      rows ? tahai_row_resize_area_.get() : tahai_column_resize_area_.get();
  const int total =
      rows ? bounds.height() - area->height() : bounds.width() - area->width();
  const int start = rows ? area->y() - bounds.y() : area->x() - bounds.x();
  if (total <= 0 || start < 0 || start > total) {
    return false;
  }
  tahai_grid_resize_state_ =
      TahaiGridResizeState{*tab->GetSplit(), axis, start, total};
  return true;
}

bool MultiContentsView::HasTahaiGridResizeTarget(
    split_tabs::TahaiGridAxis axis) const {
  const auto* tab = browser_view_->browser()->tab_strip_model()->GetActiveTab();
  return tahai_grid_resize_state_ && tab &&
         tab->GetSplit() == tahai_grid_resize_state_->split_id &&
         axis == tahai_grid_resize_state_->axis && !tahai_focus_mode_ &&
         GetVisibleContentsCount() >= 3u;
}

void MultiContentsView::OnTahaiGridResize(split_tabs::TahaiGridAxis axis,
                                          int resize_amount,
                                          bool done_resizing) {
  if (!HasTahaiGridResizeTarget(axis)) {
    tahai_grid_resize_state_.reset();
    return;
  }
  // Double arithmetic prevents overflow from an extreme drag coordinate.
  const auto state = *tahai_grid_resize_state_;
  const double requested = CalculateRatioWithSnapPoints(
      static_cast<double>(state.start) + resize_amount, state.total);
  const auto sizes = GetTahaiGridSizes(state.total, requested, 0);
  const double ratio = static_cast<double>(sizes.start) / state.total;
  const double rows = axis == split_tabs::TahaiGridAxis::kRows
                          ? ratio
                          : visual_data_.tahai_row_ratio();
  const double columns = axis == split_tabs::TahaiGridAxis::kColumns
                             ? ratio
                             : visual_data_.tahai_column_ratio();
  if (done_resizing) {
    tahai_grid_resize_state_.reset();
  }
  delegate_->ResizeTahaiGrid(rows, columns, done_resizing);
}

void MultiContentsView::ResetTahaiGridRatio(split_tabs::TahaiGridAxis axis) {
  tahai_grid_resize_state_.reset();
  if (tahai_focus_mode_ || GetVisibleContentsCount() < 3u) {
    return;
  }
  delegate_->ResizeTahaiGrid(axis == split_tabs::TahaiGridAxis::kRows
                                 ? 0.5
                                 : visual_data_.tahai_row_ratio(),
                             axis == split_tabs::TahaiGridAxis::kColumns
                                 ? 0.5
                                 : visual_data_.tahai_column_ratio(),
                             true);
}

double MultiContentsView::CalculateRatioWithSnapPoints(
    double start_size,
    double total_size) const {
  for (const double& snap_point : snap_points_) {
    double dp_snap_point = snap_point * total_size;
    if (std::abs(dp_snap_point - start_size) < kSnapDistance) {
      return snap_point;
    }
  }
  return start_size / total_size;
}

void MultiContentsView::OnThemeChanged() {
  views::View::OnThemeChanged();
  UpdateContentsBorderAndOverlay();
}

int MultiContentsView::GetInactiveIndex() const {
  for (size_t index = 0; index < contents_container_views_.size(); ++index) {
    if (index != static_cast<size_t>(active_index_)) {
      return static_cast<int>(index);
    }
  }
  NOTREACHED();
}

void MultiContentsView::UpdatePaneVisibility() {
  for (size_t index = 0; index < contents_container_views_.size(); ++index) {
    ContentsContainerView* container = contents_container_views_[index];
    const bool has_contents = container->contents_view()->web_contents();
    const bool visible =
        has_contents &&
        (!tahai_focus_mode_ || index == static_cast<size_t>(active_index_));
    container->SetVisible(visible);
  }
  UpdateResizeAreaVisibility();
}

void MultiContentsView::UpdateResizeAreaVisibility() {
  const size_t count = GetVisibleContentsCount();
  resize_area_->SetVisible(!tahai_focus_mode_ && count == 2u);
  tahai_row_resize_area_->SetVisible(!tahai_focus_mode_ && count >= 3u);
  tahai_column_resize_area_->SetVisible(!tahai_focus_mode_ && count >= 3u);
}

void MultiContentsView::OnWebContentsFocused(views::WebView* web_view) {
  if (IsInSplitView()) {
    // Check whether the widget is visible as otherwise during browser hide,
    // inactive web contents gets focus. See crbug.com/419335827
    if (GetActiveContentsView()->web_contents() != web_view->web_contents() &&
        GetWidget()->IsVisible()) {
      delegate_->WebContentsFocused(web_view->web_contents());
    }
  }
}

void MultiContentsView::OnActorOverlayFocused(views::WebView* web_view) {
  if (IsInSplitView() && GetWidget()->IsVisible()) {
    for (auto& contents_container_view : contents_container_views_) {
      if (contents_container_view->actor_overlay_web_view() &&
          contents_container_view->actor_overlay_web_view() == web_view &&
          GetActiveContentsView() != contents_container_view->contents_view()) {
        return delegate_->WebContentsFocused(
            contents_container_view->contents_view()->web_contents());
      }
    }
  }
}

void MultiContentsView::OnNtpFooterFocused(views::WebView* web_view) {
  if (IsInSplitView() && GetWidget()->IsVisible()) {
    for (auto& contents_container_view : contents_container_views_) {
      if (contents_container_view->new_tab_footer_view() &&
          contents_container_view->new_tab_footer_view() == web_view &&
          GetActiveContentsView() != contents_container_view->contents_view()) {
        return delegate_->WebContentsFocused(
            contents_container_view->contents_view()->web_contents());
      }
    }
  }
}

void MultiContentsView::OnReadAnythingOverlayFocused(
    ContentsContainerView* container,
    views::WebView* web_view) {
  if (IsInSplitView() && GetWidget()->IsVisible()) {
    if (GetActiveContentsContainerView() != container) {
      delegate_->WebContentsFocused(container->contents_view()->web_contents());
    }
  }
}

// TODO(crbug.com/397777917): Consider using FlexSpecification weights and
// interior margins instead of a custom layout once this bug is resolved.
views::ProposedLayout MultiContentsView::CalculateProposedLayout(
    const views::SizeBounds& size_bounds) const {
  views::ProposedLayout layouts;
  if (!size_bounds.is_fully_bounded()) {
    return layouts;
  }
  const int width = size_bounds.width().value();
  const int height = size_bounds.height().value();

  gfx::Rect available_space = gfx::Rect(width, height);

  const bool show_background =
      drop_target_view_->GetVisible() || IsInSplitView();
  layouts.child_layouts.emplace_back(background_view_.get(), show_background,
                                     available_space);

  if (IsDragAndDropEnabled()) {
    available_space =
        CalculateDropTargetLayout(available_space, layouts.child_layouts);
  }

  available_space =
      CalculateSeparatorLayouts(available_space, layouts.child_layouts);

  if (IsInSplitView()) {
    available_space.Inset(split_view_insets_);
  }

  const size_t visible_count = GetVisibleContentsCount();
  if (visible_count < 3u) {
    layouts.child_layouts.emplace_back(tahai_row_resize_area_.get(), false,
                                       gfx::Rect());
    layouts.child_layouts.emplace_back(tahai_column_resize_area_.get(), false,
                                       gfx::Rect());
  }
  if (tahai_focus_mode_ && visible_count == 1u) {
    for (size_t index = 0; index < contents_container_views_.size(); ++index) {
      layouts.child_layouts.emplace_back(
          contents_container_views_[index],
          index == static_cast<size_t>(active_index_), available_space);
    }
    layouts.child_layouts.emplace_back(resize_area_.get(), false, gfx::Rect());
    layouts.host_size = gfx::Size(width, height);
    return layouts;
  }
  if (visible_count >= 3u) {
    const auto columns = GetTahaiGridSizes(
        available_space.width(), visual_data_.tahai_column_ratio(),
        tahai_column_resize_area_->GetPreferredSize().width());
    const auto rows = GetTahaiGridSizes(
        available_space.height(), visual_data_.tahai_row_ratio(),
        tahai_row_resize_area_->GetPreferredSize().height());
    const int left_width = columns.start;
    const int right_width = columns.end;
    const int top_height = rows.start;
    const int bottom_height = rows.end;

    std::array<gfx::Rect, kMaxContentsViews> pane_bounds;
    if (visible_count == 3u) {
      // Tri View always fills the browser content area as two full-width rows.
      // kStacked encodes 2-over-1; kSideBySide encodes 1-over-2. Encoding the
      // choice in SplitTabVisualData means session restore preserves it without
      // introducing renderer state or a second persistence path.
      if (GetSplitLayout() == split_tabs::SplitTabLayout::kStacked) {
        pane_bounds[0] = gfx::Rect(available_space.x(), available_space.y(),
                                   left_width, top_height);
        pane_bounds[1] =
            gfx::Rect(available_space.x() + left_width + columns.resize,
                      available_space.y(), right_width, top_height);
        pane_bounds[2] = gfx::Rect(
            available_space.x(), available_space.y() + top_height + rows.resize,
            available_space.width(), bottom_height);
      } else {
        pane_bounds[0] = gfx::Rect(available_space.x(), available_space.y(),
                                   available_space.width(), top_height);
        pane_bounds[1] = gfx::Rect(
            available_space.x(), available_space.y() + top_height + rows.resize,
            left_width, bottom_height);
        pane_bounds[2] =
            gfx::Rect(available_space.x() + left_width + columns.resize,
                      available_space.y() + top_height + rows.resize,
                      right_width, bottom_height);
      }
    } else {
      pane_bounds[0] = gfx::Rect(available_space.x(), available_space.y(),
                                 left_width, top_height);
      pane_bounds[1] =
          gfx::Rect(available_space.x() + left_width + columns.resize,
                    available_space.y(), right_width, top_height);
      pane_bounds[2] = gfx::Rect(available_space.x(),
                                 available_space.y() + top_height + rows.resize,
                                 left_width, bottom_height);
      pane_bounds[3] =
          gfx::Rect(available_space.x() + left_width + columns.resize,
                    available_space.y() + top_height + rows.resize, right_width,
                    bottom_height);
    }

    for (size_t index = 0; index < contents_container_views_.size(); ++index) {
      layouts.child_layouts.emplace_back(
          contents_container_views_[index],
          contents_container_views_[index]->GetVisible(), pane_bounds[index]);
    }
    layouts.child_layouts.emplace_back(resize_area_.get(), false, gfx::Rect());
    layouts.child_layouts.emplace_back(
        tahai_row_resize_area_.get(), true,
        gfx::Rect(available_space.x(), available_space.y() + top_height,
                  available_space.width(), rows.resize));
    // In Tri View the column divider belongs only to the two-pane row; it
    // must never cover or intercept input in the full-width reference pane.
    const bool two_on_top =
        visible_count == 3u &&
        GetSplitLayout() == split_tabs::SplitTabLayout::kStacked;
    const bool two_on_bottom = visible_count == 3u && !two_on_top;
    layouts.child_layouts.emplace_back(
        tahai_column_resize_area_.get(), true,
        gfx::Rect(available_space.x() + left_width,
                  two_on_bottom ? available_space.y() + top_height + rows.resize
                                : available_space.y(),
                  columns.resize,
                  two_on_top ? top_height
                             : (two_on_bottom ? bottom_height
                                              : available_space.height())));
    layouts.host_size = gfx::Size(width, height);
    return layouts;
  }

  ViewSizes sizes = GetViewSizes(available_space);

  gfx::Rect start_rect, resize_rect, end_rect;
  if (GetSplitLayout() == split_tabs::SplitTabLayout::kSideBySide) {
    start_rect = gfx::Rect(available_space.origin(),
                           gfx::Size(sizes.start, available_space.height()));
    resize_rect = gfx::Rect(start_rect.top_right(),
                            gfx::Size(sizes.resize, available_space.height()));
    end_rect = gfx::Rect(resize_rect.top_right(),
                         gfx::Size(sizes.end, available_space.height()));
  } else {
    start_rect = gfx::Rect(available_space.origin(),
                           gfx::Size(available_space.width(), sizes.start));
    resize_rect = gfx::Rect(start_rect.bottom_left(),
                            gfx::Size(available_space.width(), sizes.resize));
    end_rect = gfx::Rect(resize_rect.bottom_left(),
                         gfx::Size(available_space.width(), sizes.end));
  }

  layouts.child_layouts.emplace_back(contents_container_views_[0].get(),
                                     contents_container_views_[0]->GetVisible(),
                                     start_rect);
  layouts.child_layouts.emplace_back(resize_area_.get(),
                                     resize_area_->GetVisible(), resize_rect);
  layouts.child_layouts.emplace_back(contents_container_views_[1].get(),
                                     contents_container_views_[1]->GetVisible(),
                                     end_rect);
  layouts.child_layouts.emplace_back(lens_overlay_view_.get(),
                                     lens_overlay_view_->GetVisible(),
                                     gfx::Rect(width, height));
  for (size_t index = 2; index < contents_container_views_.size(); ++index) {
    layouts.child_layouts.emplace_back(contents_container_views_[index], false,
                                       gfx::Rect());
  }

  layouts.host_size = gfx::Size(width, height);
  return layouts;
}

void MultiContentsView::BeforeApplyLayout(const views::ProposedLayout& layout) {
  // Announce the effective constrained geometry, including after restart and
  // viewport/DPI changes, not an unconstrained preferred ratio.
  if (GetVisibleContentsCount() >= 3u) {
    gfx::Rect pane_union;
    const gfx::Rect* row_bounds = nullptr;
    const gfx::Rect* column_bounds = nullptr;
    for (const auto& child : layout.child_layouts) {
      if (child.child_view == tahai_row_resize_area_) {
        row_bounds = &child.bounds;
      } else if (child.child_view == tahai_column_resize_area_) {
        column_bounds = &child.bounds;
      } else if (child.visible &&
                 std::ranges::any_of(contents_container_views_,
                                     [&child](const auto& container) {
                                       return child.child_view == container.get();
                                     })) {
        pane_union.Union(child.bounds);
      }
    }
    if (tahai_grid_resize_state_ && row_bounds && column_bounds) {
      const int next_total =
          tahai_grid_resize_state_->axis == split_tabs::TahaiGridAxis::kRows
              ? pane_union.height() - row_bounds->height()
              : pane_union.width() - column_bounds->width();
      if (next_total != tahai_grid_resize_state_->total) {
        // Resizing/moving the window during a drag changes its coordinate
        // system. Stop that gesture rather than applying an old pixel delta.
        tahai_grid_resize_state_.reset();
      }
    }
    if (row_bounds && pane_union.height() > row_bounds->height()) {
      tahai_row_resize_area_->UpdateTahaiAccessibleValue(
          static_cast<double>(row_bounds->y() - pane_union.y()) /
          (pane_union.height() - row_bounds->height()));
    }
    if (column_bounds && pane_union.width() > column_bounds->width()) {
      tahai_column_resize_area_->UpdateTahaiAccessibleValue(
          static_cast<double>(column_bounds->x() - pane_union.x()) /
          (pane_union.width() - column_bounds->width()));
    }
  }
  if (!target_content_bounds_) {
    for (auto& contents : contents_container_views_) {
      contents->SetTargetContentBounds(std::nullopt);
    }
    return;
  }

  if (GetVisibleContentsCount() > 2u) {
    for (auto& contents : contents_container_views_) {
      contents->SetTargetContentBounds(std::nullopt);
    }
    return;
  }

  if (!IsInSplitView()) {
    const auto outsets = -target_content_bounds_->clipped_area.ToOutsets();
    GetActiveContentsContainerView()->SetTargetContentBounds(outsets);
    GetInactiveContentsContainerView()->SetTargetContentBounds(std::nullopt);
    return;
  }

  // Need to calculate what the layout *would* be at the actual size.
  //
  // This is a bit more expensive than a normal layout but only happens during
  // animation when the target bounds are set.
  const auto target_layout = CalculateProposedLayout(
      views::SizeBounds(target_content_bounds_->actual_size));

  const auto& default_clip = target_content_bounds_->clipped_area;

  // Due to the way web contents resize, and the fact that both split views will
  // grow or shrink as the animation progresses, always clip from the trailing
  // edge for both split webviews. This reduces jumping/popping for very slow
  // websites.

  gfx::Outsets first_outsets = gfx::Outsets::TLBR(
      default_clip.top(), 0, default_clip.bottom(), default_clip.left());
  auto* const first = contents_container_views_[0].get();
  auto* const first_current = layout.GetLayoutFor(first);
  auto* const first_target = target_layout.GetLayoutFor(first);
  if (first_current && first_target) {
    first_outsets.set_right(std::max(
        0, first_target->bounds.width() - first_current->bounds.width()));
  }

  gfx::Outsets second_outsets = gfx::Outsets::TLBR(
      default_clip.top(), 0, default_clip.bottom(), default_clip.right());
  auto* const second = contents_container_views_[1].get();
  auto* const second_current = layout.GetLayoutFor(second);
  auto* const second_target = target_layout.GetLayoutFor(second);
  if (second_current && second_target) {
    second_outsets.set_right(std::max(
        0, second_target->bounds.width() - second_current->bounds.width()));
  }

  first->SetTargetContentBounds(first_outsets);
  second->SetTargetContentBounds(second_outsets);
}

gfx::Rect MultiContentsView::CalculateDropTargetLayout(
    const gfx::Rect& available_space,
    std::vector<views::ChildLayout>& child_layouts) const {
  CHECK(IsDragAndDropEnabled());
  if (!drop_target_view_->GetVisible()) {
    child_layouts.emplace_back(drop_target_view_.get(), false, gfx::Rect());
    return available_space;
  }

  CHECK(drop_target_view_->side().has_value());
  const int drop_target_size = drop_target_view_->GetSizeForAvailableSpace(
      drop_target_view_->side() == MultiContentsDropTargetView::DropSide::BOTTOM
          ? available_space.height()
          : available_space.width());

  gfx::Rect drop_target_bounds = available_space;
  gfx::Rect remaining_space = available_space;
  switch (drop_target_view_->side().value()) {
    case MultiContentsDropTargetView::DropSide::START:
      remaining_space.Inset(gfx::Insets().set_left(drop_target_size));
      break;
    case MultiContentsDropTargetView::DropSide::END:
      remaining_space.Inset(gfx::Insets().set_right(drop_target_size));
      break;
    case MultiContentsDropTargetView::DropSide::BOTTOM:
      remaining_space.Inset(gfx::Insets().set_bottom(drop_target_size));
      break;
    default:
      NOTREACHED();
  }
  drop_target_bounds.Subtract(remaining_space);

  child_layouts.emplace_back(drop_target_view_.get(), true, drop_target_bounds);
  return remaining_space;
}

gfx::Rect MultiContentsView::CalculateSeparatorLayouts(
    const gfx::Rect& available_space,
    std::vector<views::ChildLayout>& child_layouts) const {
  if (IsInSplitView()) {
    child_layouts.emplace_back(contents_separators_.top_separator.get(), false,
                               gfx::Rect());
    child_layouts.emplace_back(contents_separators_.leading_separator.get(),
                               false, gfx::Rect());
    child_layouts.emplace_back(contents_separators_.trailing_separator.get(),
                               false, gfx::Rect());
    child_layouts.emplace_back(contents_separators_.corner_separator.get(),
                               false, gfx::Rect());
    return available_space;
  }

  const int width = available_space.width();
  const int height = available_space.height();

  const int separator_height =
      contents_separators_.should_show_top
          ? contents_separators_.top_separator->GetPreferredSize().height()
          : 0;
  child_layouts.emplace_back(
      contents_separators_.top_separator.get(),
      contents_separators_.should_show_top,
      gfx::Rect(available_space.origin(), {width, separator_height}));

  const bool should_show_leading =
      drop_target_view_->side() == MultiContentsDropTargetView::DropSide::START;
  const int leading_separator_width =
      should_show_leading
          ? contents_separators_.leading_separator->GetPreferredSize().width()
          : 0;
  child_layouts.emplace_back(
      contents_separators_.leading_separator.get(), should_show_leading,
      gfx::Rect(available_space.origin(), {leading_separator_width, height}));

  const bool should_show_trailing =
      drop_target_view_->side() == MultiContentsDropTargetView::DropSide::END;

  const int trailing_separator_width =
      should_show_trailing
          ? contents_separators_.trailing_separator->GetPreferredSize().width()
          : 0;
  child_layouts.emplace_back(
      contents_separators_.trailing_separator.get(), should_show_trailing,
      gfx::Rect(available_space.right() - trailing_separator_width,
                available_space.y(), trailing_separator_width, height));

  // Place the corner separator and set its orientation.
  auto* const corner_separator = contents_separators_.corner_separator.get();
  const auto corner_preferred_size = corner_separator->GetPreferredSize();
  views::ChildLayout corner_layout(
      corner_separator, contents_separators_.should_show_top &&
                            (should_show_leading || should_show_trailing));
  if (corner_layout.visible) {
    if (should_show_leading) {
      corner_layout.bounds =
          gfx::Rect(available_space.origin(), corner_preferred_size);
      corner_separator->SetOrientation(CornerOrientation::kTopLeading);
    } else {
      corner_layout.bounds = gfx::Rect(
          gfx::Point(available_space.right() - corner_preferred_size.width(),
                     available_space.y()),
          corner_preferred_size);
      corner_separator->SetOrientation(CornerOrientation::kTopTrailing);
    }
  }
  child_layouts.push_back(corner_layout);

  return gfx::Rect(available_space.x() + leading_separator_width,
                   available_space.y() + separator_height,
                   width - trailing_separator_width - leading_separator_width,
                   height - separator_height);
}

MultiContentsView::ViewSizes MultiContentsView::GetViewSizes(
    gfx::Rect available_space) const {
  const int available_size =
      GetSplitLayout() == split_tabs::SplitTabLayout::kSideBySide
          ? available_space.width()
          : available_space.height();
  ViewSizes sizes;
  if (IsInSplitView()) {
    CHECK(contents_container_views_[0]->GetVisible() &&
          contents_container_views_[1]->GetVisible());
    sizes.resize = GetSplitLayout() == split_tabs::SplitTabLayout::kSideBySide
                       ? resize_area_->GetPreferredSize().width()
                       : resize_area_->GetPreferredSize().height();
    sizes.start = std::round(visual_data_.split_ratio() *
                             (available_size - sizes.resize));
    sizes.end = available_size - sizes.start - sizes.resize;
  } else {
    CHECK(!contents_container_views_[1]->GetVisible());
    sizes.start = available_size;
  }
  return ClampToMinSize(available_space, sizes);
}

MultiContentsView::ViewSizes MultiContentsView::ClampToMinSize(
    gfx::Rect available_space,
    ViewSizes sizes) const {
  if (!IsInSplitView()) {
    // Don't clamp if in a single-view state, where other views should be 0
    // width.
    return sizes;
  }

  const int min_size = GetMinViewSize(available_space);
  if (sizes.start < min_size) {
    const int diff = min_size - sizes.start;
    sizes.start += diff;
    sizes.end -= diff;
  } else if (sizes.end < min_size) {
    const int diff = min_size - sizes.end;
    sizes.end += diff;
    sizes.start -= diff;
  }
  return sizes;
}

int MultiContentsView::GetMinViewSize(gfx::Rect available_space) const {
  CHECK(IsInSplitView());

  // The minimum size (in the resize axis) for a content view in a split should
  // be the lesser of kMinWebContentsSize, and kMinWebContentsSizePercentage as
  // a percentage of the MultiContentsView's available size with a lower bound
  // of kConstrainedMinWebContentsSize.
  const int min_percentage =
      kMinWebContentsSizePercentage *
      (visual_data_.split_layout() == split_tabs::SplitTabLayout::kSideBySide
           ? available_space.width()
           : available_space.height());
  const int min_fixed_value =
      min_contents_size_for_testing_.value_or(kMinWebContentsSize);
  return std::min(min_fixed_value,
                  std::max(kConstrainedMinWebContentsSize, min_percentage));
}

void MultiContentsView::UpdateContentsBorderAndOverlay() {
  const bool is_in_split = IsInSplitView();
  for (auto& contents_container_view : contents_container_views_) {
    const bool is_active =
        contents_container_view->contents_view() == GetActiveContentsView();
    contents_container_view->SetRoundedCorners(
        is_in_split
            ? kSplitViewContentRoundedCorners
            : (is_active ? GetBackgroundRadii() : gfx::RoundedCornersF()));
    contents_container_view->UpdateBorderAndOverlay(
        is_in_split, is_active, is_active && active_contents_view_highlighted_);
  }
}

MultiContentsViewDropTargetController&
MultiContentsView::drop_target_controller() const {
  CHECK(IsDragAndDropEnabled());
  return *drop_target_controller_;
}

bool MultiContentsView::IsDragAndDropEnabled() const {
  // Split view drag and drop is only supported on normal browser types.
  if (!browser_view_->GetIsNormalType() || !is_drag_drop_pref_enabled_) {
    return false;
  }
  // The split-entry drop target is a two-pane affordance. Showing it over an
  // established three- or four-pane workspace is misleading and can route a
  // drop through assumptions that only hold before a split is created.
  if (IsInSplitView() && GetVisibleContentsCount() > 2u) {
    return false;
  }

  const auto* active_contents_view = GetActiveContentsView();
  if (!active_contents_view) {
    return true;
  }

  const auto* web_contents = active_contents_view->web_contents();
  return !web_contents ||
         web_contents->GetLastCommittedURL() ==
             chrome::ChromeUINewTabURLAsGURL() ||
         web_contents->GetLastCommittedURL() ==
             chrome::ChromeUINewTabPageURLAsGURL() ||
         !web_contents->GetLastCommittedURL().SchemeIs(
             content::kChromeUIScheme);
}

void MultiContentsView::OnDragAndDropPrefStateChange() {
  is_drag_drop_pref_enabled_ =
      browser_view_->GetProfile()->GetPrefs()->GetBoolean(
          prefs::kSplitViewDragAndDropEnabled);
  InvalidateLayout();
}

void MultiContentsView::SetShouldShowTopSeparator(bool should_show) {
  if (contents_separators_.should_show_top == should_show) {
    return;
  }
  contents_separators_.should_show_top = should_show;
  // This can be called during BrowserView layout, so protect against creating a
  // layout loop.
  InvalidateLayout(/*avoid_propagate_during_layout=*/true);
}

void MultiContentsView::SetSplitViewInsets(const gfx::Insets& insets) {
  if (split_view_insets_ == insets) {
    return;
  }
  split_view_insets_ = insets;
  // This can be called during BrowserView layout, so protect against creating a
  // layout loop.
  InvalidateLayout(/*avoid_propagate_during_layout=*/true);
}

int MultiContentsView::GetResizeAxisComponent(const gfx::Size& size) const {
  return (visual_data_.split_layout() ==
          split_tabs::SplitTabLayout::kSideBySide)
             ? size.width()
             : size.height();
}

BEGIN_METADATA(MultiContentsView)
END_METADATA
