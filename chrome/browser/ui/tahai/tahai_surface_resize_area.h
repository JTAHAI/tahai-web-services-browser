// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_SURFACE_RESIZE_AREA_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_SURFACE_RESIZE_AREA_H_

#include <cstddef>

#include "base/memory/raw_ptr.h"
#include "ui/views/controls/resize_area.h"
#include "ui/views/controls/resize_area_delegate.h"

class MultiContentsView;
class MultiContentsResizeHandle;

namespace tahai {

class SurfaceResizeArea : public views::ResizeArea,
                          public views::ResizeAreaDelegate {
  METADATA_HEADER(SurfaceResizeArea, views::ResizeArea)
 public:
  SurfaceResizeArea(MultiContentsView* contents, size_t slot);
  void Configure(bool rows, double ratio);
  views::View* GetAccessibleResizeHandle() const;
  void OnResize(int amount, bool done) override;
  bool OnMousePressed(const ui::MouseEvent& event) override;
  void OnMouseReleased(const ui::MouseEvent& event) override;
  void OnMouseCaptureLost() override;
  void OnGestureEvent(ui::GestureEvent* event) override;
  bool OnKeyPressed(const ui::KeyEvent& event) override;
  void OnMouseMoved(const ui::MouseEvent& event) override;
  void OnMouseExited(const ui::MouseEvent& event) override;
  void SetVisible(bool visible) override;

 private:
  const raw_ptr<MultiContentsView> contents_;
  const size_t slot_;
  raw_ptr<MultiContentsResizeHandle> handle_;
  int last_amount_ = 0;
  bool capture_lost_ = false;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_SURFACE_RESIZE_AREA_H_
