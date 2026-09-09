// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#ifndef CHROME_BROWSER_UI_VIEWS_FRAME_MULTI_CONTENTS_RESIZE_AREA_H_
#define CHROME_BROWSER_UI_VIEWS_FRAME_MULTI_CONTENTS_RESIZE_AREA_H_

#include <optional>

#include "base/memory/raw_ptr.h"
#include "components/split_tabs/split_tab_visual_data.h"
#include "ui/base/interaction/element_identifier.h"
#include "ui/events/keycodes/keyboard_codes.h"
#include "ui/views/controls/resize_area.h"
#include "ui/views/controls/resize_area_delegate.h"
#include "ui/views/focus/focus_manager.h"
#include "ui/views/view.h"

class MultiContentsView;

namespace split_tabs {
enum class SplitTabLayout;
}

namespace views {
class FlexLayout;
}

// Keyboard-accessible drag handle icon intended to be drawn on top of a
// MultiContentsResizeArea.
class MultiContentsResizeHandle : public views::View,
                                  public views::FocusChangeListener {
  METADATA_HEADER(MultiContentsResizeHandle, views::View)

 public:
  DECLARE_CLASS_ELEMENT_IDENTIFIER_VALUE(kMultiContentsResizeHandleElementId);

  MultiContentsResizeHandle();

  void UpdateVisibility();

  // views::View:
  void AddedToWidget() override;
  void RemovedFromWidget() override;

  // FocusChangeListener:
  void OnDidChangeFocus(views::View* before, views::View* now) override;
};

// ResizeArea meant to draw in between WebContents within a MultiContentsView,
// and responsiveness to key events via a focusable MultiContentsResizeHandle.
class MultiContentsResizeArea : public views::ResizeArea,
                                public views::ResizeAreaDelegate {
  METADATA_HEADER(MultiContentsResizeArea, ResizeArea)

 public:
  static constexpr int kHandleResizeAxisPadding = 6;
  static constexpr int kHandleResizeAxisSize = 4;

  DECLARE_CLASS_ELEMENT_IDENTIFIER_VALUE(kMultiContentsResizeAreaElementId);

  explicit MultiContentsResizeArea(
      MultiContentsView* multi_contents_view,
      std::optional<split_tabs::TahaiGridAxis> grid_axis = std::nullopt);

  void SetLayout(split_tabs::SplitTabLayout layout);
  void UpdateTahaiAccessibleValue(double ratio);
  views::View* GetAccessibleResizeHandle() const {
    return resize_handle_.get();
  }
  void OnResize(int resize_amount, bool done_resizing) override;

  // views::ResizeArea:
  void OnGestureEvent(ui::GestureEvent* event) override;
  bool OnMousePressed(const ui::MouseEvent& event) override;
  void OnMouseCaptureLost() override;
  void OnMouseReleased(const ui::MouseEvent& event) override;
  bool OnKeyPressed(const ui::KeyEvent& event) override;
  void OnMouseMoved(const ui::MouseEvent& event) override;
  void OnMouseExited(const ui::MouseEvent& event) override;
  void SetVisible(bool visible) override;

 private:
  // Sets the layout manager orientation and preferred size according to the
  // split view layout.
  void OnLayoutUpdated();

  ui::KeyboardCode DecreaseContentsSizeKeyCode();
  ui::KeyboardCode IncreaseContentsSizeKeyCode();

  std::pair<int, int> GetAccessibleAlertStringIds();

  raw_ptr<MultiContentsView> multi_contents_view_;
  raw_ptr<MultiContentsResizeHandle> resize_handle_;

  raw_ptr<views::FlexLayout> flex_layout_manager_;
  const std::optional<split_tabs::TahaiGridAxis> grid_axis_;
  int last_resize_amount_ = 0;
  bool finishing_at_last_delta_ = false;
};

#endif  // CHROME_BROWSER_UI_VIEWS_FRAME_MULTI_CONTENTS_RESIZE_AREA_H_
