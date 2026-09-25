// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_surface_resize_area.h"

#include <memory>

#include "base/strings/string_number_conversions.h"
#include "chrome/browser/ui/views/frame/multi_contents_resize_area.h"
#include "chrome/browser/ui/views/frame/multi_contents_view.h"
#include "ui/base/metadata/metadata_impl_macros.h"
#include "ui/events/event.h"
#include "ui/events/keycodes/keyboard_codes.h"
#include "ui/gfx/geometry/size.h"
#include "ui/views/accessibility/view_accessibility.h"
#include "ui/views/layout/flex_layout.h"

namespace tahai {

SurfaceResizeArea::SurfaceResizeArea(MultiContentsView* contents, size_t slot)
    : ResizeArea(this), contents_(contents), slot_(slot) {
  auto* layout = SetLayoutManager(std::make_unique<views::FlexLayout>());
  layout->SetMainAxisAlignment(views::LayoutAlignment::kCenter)
      .SetCrossAxisAlignment(views::LayoutAlignment::kCenter);
  handle_ = AddChildView(std::make_unique<MultiContentsResizeHandle>());
  handle_->GetViewAccessibility().SetName(u"Resize authored pane layout");
  handle_->GetViewAccessibility().SetDescription(u"Use arrow keys to resize. Home balances this divider.");
  handle_->GetViewAccessibility().SetMinValueForRange(0);
  handle_->GetViewAccessibility().SetMaxValueForRange(100);
  SetTooltipText(u"Resize panes. Arrow keys adjust; Home balances.");
  Configure(false, 0.5);
}

void SurfaceResizeArea::Configure(bool rows, double ratio) {
  set_axis(rows ? Axis::kVertical : Axis::kHorizontal);
  handle_->SetPreferredSize(rows ? gfx::Size(32, 4) : gfx::Size(4, 32));
  handle_->GetViewAccessibility().SetValueForRange(static_cast<float>(ratio * 100));
  handle_->GetViewAccessibility().SetName(
      std::u16string(rows ? u"Resize pane rows, divider " : u"Resize pane columns, divider ") +
      base::NumberToString16(slot_ + 1));
}

views::View* SurfaceResizeArea::GetAccessibleResizeHandle() const {
  return handle_;
}

void SurfaceResizeArea::OnResize(int amount, bool done) {
  if (capture_lost_) {
    amount = last_amount_;
  }
  last_amount_ = amount;
  contents_->ResizeTahaiSurface(slot_, amount, done);
}

bool SurfaceResizeArea::OnMousePressed(const ui::MouseEvent& event) {
  if (!ResizeArea::OnMousePressed(event)) {
    return false;
  }
  last_amount_ = 0;
  return contents_->BeginTahaiSurfaceResize(slot_);
}

void SurfaceResizeArea::OnMouseReleased(const ui::MouseEvent& event) {
  const bool reset = !is_resizing() && event.IsOnlyLeftMouseButton() &&
                     event.GetClickCount() == 2;
  ResizeArea::OnMouseReleased(event);
  if (reset) {
    contents_->ResetTahaiSurfaceDivider(slot_);
  }
}

void SurfaceResizeArea::OnMouseCaptureLost() {
  capture_lost_ = true;
  ResizeArea::OnMouseCaptureLost();
  capture_lost_ = false;
}

void SurfaceResizeArea::OnGestureEvent(ui::GestureEvent* event) {
  if (event->type() == ui::EventType::kGestureTapDown) {
    last_amount_ = 0;
    contents_->BeginTahaiSurfaceResize(slot_);
  }
  const bool reset = !is_resizing() && event->type() == ui::EventType::kGestureTap &&
                     event->details().tap_count() == 2;
  ResizeArea::OnGestureEvent(event);
  if (reset) {
    contents_->ResetTahaiSurfaceDivider(slot_);
  }
}

bool SurfaceResizeArea::OnKeyPressed(const ui::KeyEvent& event) {
  if (event.IsControlDown() || event.IsAltDown() || event.IsShiftDown() || event.IsCommandDown()) {
    return false;
  }
  if (event.key_code() == ui::VKEY_HOME) {
    contents_->ResetTahaiSurfaceDivider(slot_);
    return true;
  }
  const auto decrease = axis() == Axis::kVertical ? ui::VKEY_UP : ui::VKEY_LEFT;
  const auto increase = axis() == Axis::kVertical ? ui::VKEY_DOWN : ui::VKEY_RIGHT;
  if ((event.key_code() != decrease && event.key_code() != increase) ||
      !contents_->BeginTahaiSurfaceResize(slot_)) {
    return false;
  }
  contents_->ResizeTahaiSurface(slot_, event.key_code() == decrease ? -24 : 24, true);
  return true;
}

void SurfaceResizeArea::OnMouseMoved(const ui::MouseEvent& event) { handle_->UpdateVisibility(); }
void SurfaceResizeArea::OnMouseExited(const ui::MouseEvent& event) { handle_->UpdateVisibility(); }
void SurfaceResizeArea::SetVisible(bool visible) {
  views::View::SetVisible(visible);
  handle_->UpdateVisibility();
}

BEGIN_METADATA(SurfaceResizeArea)
END_METADATA

}  // namespace tahai
