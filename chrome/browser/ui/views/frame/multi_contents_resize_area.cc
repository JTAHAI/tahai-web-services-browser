// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/views/frame/multi_contents_resize_area.h"

#include "base/i18n/number_formatting.h"
#include "base/i18n/rtl.h"
#include "base/numerics/safe_conversions.h"
#include "chrome/browser/ui/color/chrome_color_id.h"
#include "chrome/browser/ui/views/frame/multi_contents_view.h"
#include "chrome/grit/generated_resources.h"
#include "components/split_tabs/split_tab_visual_data.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/compositor/layer.h"
#include "ui/compositor/layer_type.h"
#include "ui/gfx/geometry/size.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/background.h"
#include "ui/views/controls/focus_ring.h"
#include "ui/views/controls/highlight_path_generator.h"
#include "ui/views/layout/flex_layout.h"

namespace {
constexpr int kHandleCornerRadius = 2;
constexpr int kHandleOffAxisSize = 24;
constexpr int kResizeIncrement = 50;
}  // namespace

DEFINE_CLASS_ELEMENT_IDENTIFIER_VALUE(MultiContentsResizeHandle,
                                      kMultiContentsResizeHandleElementId);

DEFINE_CLASS_ELEMENT_IDENTIFIER_VALUE(MultiContentsResizeArea,
                                      kMultiContentsResizeAreaElementId);

MultiContentsResizeHandle::MultiContentsResizeHandle() {
  // Cannot use `SOLID_COLOR_LAYER`, since resize handle has rounded corners,
  // and applying layer based rounded corners will clip the focus ring.
  SetPaintToLayer(ui::LAYER_TEXTURED);
  layer()->SetFillsBoundsOpaquely(false);

  SetCanProcessEventsWithinSubtree(false);
  SetFocusBehavior(FocusBehavior::ALWAYS);
  views::FocusRing::Install(this);
  GetViewAccessibility().SetRole(ax::mojom::Role::kSlider);
  GetViewAccessibility().SetName(
      l10n_util::GetStringUTF16(IDS_ACCNAME_SPLIT_TABS_RESIZE));
  SetProperty(views::kElementIdentifierKey,
              kMultiContentsResizeHandleElementId);

  SetBackground(views::CreateRoundedRectBackground(
      kColorSidePanelHoverResizeAreaHandle, kHandleCornerRadius));
}

void MultiContentsResizeHandle::UpdateVisibility() {
  layer()->SetVisible(parent()->GetVisible() &&
                      (HasFocus() || parent()->IsMouseHovered()));
}

void MultiContentsResizeHandle::AddedToWidget() {
  GetFocusManager()->AddFocusChangeListener(this);
}

void MultiContentsResizeHandle::RemovedFromWidget() {
  GetFocusManager()->RemoveFocusChangeListener(this);
}

void MultiContentsResizeHandle::OnDidChangeFocus(views::View* before,
                                                 views::View* now) {
  UpdateVisibility();
}

BEGIN_METADATA(MultiContentsResizeHandle)
END_METADATA

MultiContentsResizeArea::MultiContentsResizeArea(
    MultiContentsView* multi_contents_view,
    std::optional<split_tabs::TahaiGridAxis> grid_axis)
    : ResizeArea(this),
      multi_contents_view_(multi_contents_view),
      grid_axis_(grid_axis) {
  flex_layout_manager_ =
      SetLayoutManager(std::make_unique<views::FlexLayout>());
  flex_layout_manager_->SetMainAxisAlignment(views::LayoutAlignment::kCenter)
      .SetCrossAxisAlignment(views::LayoutAlignment::kCenter);

  resize_handle_ = AddChildView(std::make_unique<MultiContentsResizeHandle>());
  if (grid_axis_) {
    const auto name = l10n_util::GetStringUTF16(
        *grid_axis_ == split_tabs::TahaiGridAxis::kRows
            ? IDS_TAHAI_GRID_RESIZE_ROWS
            : IDS_TAHAI_GRID_RESIZE_COLUMNS);
    resize_handle_->GetViewAccessibility().SetName(name);
    resize_handle_->GetViewAccessibility().SetDescription(
        l10n_util::GetStringUTF16(IDS_TAHAI_GRID_RESIZE_HELP));
    resize_handle_->GetViewAccessibility().SetMinValueForRange(0);
    resize_handle_->GetViewAccessibility().SetMaxValueForRange(100);
    resize_handle_->GetViewAccessibility().SetValueForRange(50);
    SetTooltipText(name + u"\n" +
                   l10n_util::GetStringUTF16(IDS_TAHAI_GRID_RESIZE_HELP));
    set_axis(*grid_axis_ == split_tabs::TahaiGridAxis::kRows
                 ? Axis::kVertical
                 : Axis::kHorizontal);
  }

  SetProperty(views::kElementIdentifierKey, kMultiContentsResizeAreaElementId);
  OnLayoutUpdated();
}

void MultiContentsResizeArea::SetLayout(split_tabs::SplitTabLayout layout) {
  if (grid_axis_) {
    return;
  }
  Axis old_axis = axis();
  set_axis(layout == split_tabs::SplitTabLayout::kSideBySide ? Axis::kHorizontal
                                                             : Axis::kVertical);
  if (axis() != old_axis) {
    OnLayoutUpdated();
  }
}

void MultiContentsResizeArea::UpdateTahaiAccessibleValue(double ratio) {
  if (grid_axis_) {
    resize_handle_->GetViewAccessibility().SetValueForRange(
        static_cast<float>(ratio * 100));
  }
}

void MultiContentsResizeArea::OnResize(int resize_amount, bool done_resizing) {
  if (grid_axis_) {
    if (finishing_at_last_delta_) {
      resize_amount = last_resize_amount_;
    }
    last_resize_amount_ = resize_amount;
    multi_contents_view_->OnTahaiGridResize(*grid_axis_, resize_amount,
                                            done_resizing);
    UpdateTahaiAccessibleValue(
        multi_contents_view_->GetTahaiGridRatio(*grid_axis_));
  } else {
    multi_contents_view_->OnResize(resize_amount, done_resizing);
  }
}

bool MultiContentsResizeArea::OnMousePressed(const ui::MouseEvent& event) {
  if (!ResizeArea::OnMousePressed(event)) {
    return false;
  }
  last_resize_amount_ = 0;
  return !grid_axis_ || multi_contents_view_->BeginTahaiGridResize(*grid_axis_);
}

void MultiContentsResizeArea::OnMouseCaptureLost() {
  // ResizeArea's capture-loss fallback uses screen coordinates as a local
  // delta. Grid dividers instead finish at the last actual drag position.
  finishing_at_last_delta_ = grid_axis_.has_value();
  ResizeArea::OnMouseCaptureLost();
  finishing_at_last_delta_ = false;
}

void MultiContentsResizeArea::OnGestureEvent(ui::GestureEvent* event) {
  if (grid_axis_ && event->type() == ui::EventType::kGestureTapDown) {
    last_resize_amount_ = 0;
    multi_contents_view_->BeginTahaiGridResize(*grid_axis_);
  }
  // If the gesture event was a double tap and was not part of a resizing event,
  // swap the contents views.
  if (!is_resizing() && event->type() == ui::EventType::kGestureTap &&
      event->details().tap_count() == 2) {
    if (grid_axis_) {
      if (multi_contents_view_->HasTahaiGridResizeTarget(*grid_axis_)) {
        multi_contents_view_->ResetTahaiGridRatio(*grid_axis_);
      }
    } else {
      multi_contents_view_->OnSwap();
    }
  }
  ResizeArea::OnGestureEvent(event);
}

void MultiContentsResizeArea::OnMouseReleased(const ui::MouseEvent& event) {
  // If the mouse event was a left double click and was not part of a resizing
  // event, swap the contents views.
  if (!is_resizing() && event.IsOnlyLeftMouseButton() &&
      event.GetClickCount() == 2) {
    if (grid_axis_) {
      if (multi_contents_view_->HasTahaiGridResizeTarget(*grid_axis_)) {
        multi_contents_view_->ResetTahaiGridRatio(*grid_axis_);
      }
    } else {
      multi_contents_view_->OnSwap();
    }
  }
  ResizeArea::OnMouseReleased(event);
}

bool MultiContentsResizeArea::OnKeyPressed(const ui::KeyEvent& event) {
  if (grid_axis_ && (event.IsControlDown() || event.IsAltDown() ||
                     event.IsShiftDown() || event.IsCommandDown())) {
    return false;  // Do not intercept browser or accessibility accelerators.
  }
  if (grid_axis_ && event.key_code() == ui::VKEY_HOME) {
    multi_contents_view_->ResetTahaiGridRatio(*grid_axis_);
    resize_handle_->GetViewAccessibility().SetValueForRange(50);
    GetViewAccessibility().AnnounceText(
        l10n_util::GetStringUTF16(IDS_TAHAI_GRID_RESIZE_RESET));
    return true;
  }
  int resize_amount = 0;
  if (event.key_code() == DecreaseContentsSizeKeyCode()) {
    resize_amount = -kResizeIncrement;
  } else if (event.key_code() == IncreaseContentsSizeKeyCode()) {
    resize_amount = kResizeIncrement;
  }

  if (resize_amount == 0) {
    return false;
  }

  if (grid_axis_ && !multi_contents_view_->BeginTahaiGridResize(*grid_axis_)) {
    return false;
  }
  OnResize(resize_amount, true);

  if ((axis() == Axis::kHorizontal ? multi_contents_view_->width()
                                   : multi_contents_view_->height()) > 0) {
    const int start_percent = base::ClampRound(
        (grid_axis_ ? multi_contents_view_->GetTahaiGridRatio(*grid_axis_)
                    : multi_contents_view_->GetSplitRatio()) *
        100);
    const int end_percent = 100 - start_percent;

    auto [start_label_id, end_label_id] = GetAccessibleAlertStringIds();
    const int alert_string_id =
        axis() == Axis::kHorizontal
            ? IDS_SPLIT_VIEW_RESIZE_ACCESSIBLE_ALERT
            : IDS_SPLIT_VIEW_RESIZE_ACCESSIBLE_ALERT_STACKED;
    GetViewAccessibility().AnnounceText(l10n_util::GetStringFUTF16(
        alert_string_id, l10n_util::GetStringUTF16(start_label_id),
        base::FormatPercent(start_percent),
        l10n_util::GetStringUTF16(end_label_id),
        base::FormatPercent(end_percent)));
  }
  return true;
}

void MultiContentsResizeArea::OnMouseMoved(const ui::MouseEvent& event) {
  resize_handle_->UpdateVisibility();
}

void MultiContentsResizeArea::OnMouseExited(const ui::MouseEvent& event) {
  resize_handle_->UpdateVisibility();
}

void MultiContentsResizeArea::SetVisible(bool visible) {
  views::View::SetVisible(visible);
  resize_handle_->UpdateVisibility();
}

void MultiContentsResizeArea::OnLayoutUpdated() {
  flex_layout_manager_->SetOrientation(
      axis() == Axis::kHorizontal ? views::LayoutOrientation::kVertical
                                  : views::LayoutOrientation::kHorizontal);

  gfx::Size preferred_size(kHandleResizeAxisSize + kHandleResizeAxisPadding,
                           kHandleOffAxisSize);
  gfx::Size resize_handle_preferred_size(kHandleResizeAxisSize,
                                         kHandleOffAxisSize);
  if (axis() == Axis::kVertical) {
    preferred_size.Transpose();
    resize_handle_preferred_size.Transpose();
  }
  SetPreferredSize(preferred_size);
  resize_handle_->SetPreferredSize(resize_handle_preferred_size);
}

ui::KeyboardCode MultiContentsResizeArea::DecreaseContentsSizeKeyCode() {
  return axis() == Axis::kHorizontal
             ? (base::i18n::IsRTL() ? ui::VKEY_RIGHT : ui::VKEY_LEFT)
             : ui::VKEY_UP;
}

ui::KeyboardCode MultiContentsResizeArea::IncreaseContentsSizeKeyCode() {
  return axis() == Axis::kHorizontal
             ? (base::i18n::IsRTL() ? ui::VKEY_LEFT : ui::VKEY_RIGHT)
             : ui::VKEY_DOWN;
}

std::pair<int, int> MultiContentsResizeArea::GetAccessibleAlertStringIds() {
  return axis() == Axis::kHorizontal
             ? (base::i18n::IsRTL()
                    ? std::
                          pair{IDS_SPLIT_VIEW_RESIZE_RIGHT_SIDE_ACCESSIBLE_ALERT,
                               IDS_SPLIT_VIEW_RESIZE_LEFT_SIDE_ACCESSIBLE_ALERT}
                    : std::
                          pair{IDS_SPLIT_VIEW_RESIZE_LEFT_SIDE_ACCESSIBLE_ALERT,
                               IDS_SPLIT_VIEW_RESIZE_RIGHT_SIDE_ACCESSIBLE_ALERT})
             : std::pair{IDS_SPLIT_VIEW_RESIZE_TOP_SIDE_ACCESSIBLE_ALERT,
                         IDS_SPLIT_VIEW_RESIZE_BOTTOM_SIDE_ACCESSIBLE_ALERT};
}

BEGIN_METADATA(MultiContentsResizeArea)
END_METADATA
