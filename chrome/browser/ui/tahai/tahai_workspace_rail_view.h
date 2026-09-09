// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_WORKSPACE_RAIL_VIEW_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_WORKSPACE_RAIL_VIEW_H_

#include <array>
#include <cstddef>
#include <string>
#include <string_view>

#include "base/memory/raw_ptr.h"
#include "base/scoped_observation.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "ui/base/metadata/metadata_header_macros.h"
#include "ui/views/controls/resize_area_delegate.h"
#include "ui/views/metadata/view_factory.h"
#include "ui/views/view.h"

namespace views {
class Label;
class ImageView;
class LabelButton;
class ResizeArea;
}  // namespace views

namespace tahai {

// A window-local companion rail for workspaces and mode-specific navigation.
// It deliberately lives beside Chromium's existing tab and side-panel surfaces
// instead of replacing them. The host BrowserView layout reserves its width so
// web contents never render beneath it.
class WorkspaceRailView : public views::View,
                          public WindowModeController::Observer,
                          public views::ResizeAreaDelegate {
  METADATA_HEADER(WorkspaceRailView, views::View)

 public:
  explicit WorkspaceRailView(WindowModeController* mode_controller);
  WorkspaceRailView(const WorkspaceRailView&) = delete;
  WorkspaceRailView& operator=(const WorkspaceRailView&) = delete;
  ~WorkspaceRailView() override;

  bool is_collapsed() const { return is_collapsed_; }
  bool is_hidden() const { return is_hidden_; }
  std::string_view selected_module_id() const { return selected_module_id_; }
  // Returns a browser-owned module control for accessibility/layout tests.
  views::LabelButton* module_button_for_testing(size_t index) const;
  void ToggleCollapsed();
  void HideRail();
  void CyclePreferredWidth();
  void SelectModule(size_t index);
  void OpenSelectedModule();

  // WindowModeController::Observer:
  void OnTahaiWindowModeChanged() override;

  // views::ResizeAreaDelegate:
  void OnResize(int resize_amount, bool done_resizing) override;

  // views::View:
  gfx::Size CalculatePreferredSize(
      const views::SizeBounds& available_size) const override;
  gfx::Size GetMinimumSize() const override;
  void Layout(PassKey) override;
  void OnThemeChanged() override;

 private:
  void ActivateModule(size_t index);
  void UpdateModePresentation();
  void UpdateSkinColors();
  void UpdateLayoutWidth();

  const raw_ptr<WindowModeController> mode_controller_;
  raw_ptr<views::Label> mode_label_ = nullptr;
  raw_ptr<views::ImageView> decoration_ = nullptr;
  raw_ptr<views::Label> mode_context_label_ = nullptr;
  raw_ptr<views::LabelButton> collapse_button_ = nullptr;
  raw_ptr<views::LabelButton> width_button_ = nullptr;
  raw_ptr<views::LabelButton> hide_button_ = nullptr;
  raw_ptr<views::Label> active_section_label_ = nullptr;
  raw_ptr<views::Label> module_summary_label_ = nullptr;
  raw_ptr<views::LabelButton> module_action_button_ = nullptr;
  std::array<raw_ptr<views::LabelButton>, 5> module_buttons_;
  raw_ptr<views::ResizeArea> resize_area_ = nullptr;
  base::ScopedObservation<WindowModeController, WindowModeController::Observer>
      mode_observation_{this};
  bool is_collapsed_ = true;
  bool is_hidden_ = false;
  int preferred_width_ = 280;
  int starting_width_on_resize_ = -1;
  std::string selected_module_id_;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_WORKSPACE_RAIL_VIEW_H_
