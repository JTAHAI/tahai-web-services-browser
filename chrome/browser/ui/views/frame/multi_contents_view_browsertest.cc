// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/views/frame/multi_contents_view.h"

#include <algorithm>
#include <limits>
#include <span>
#include <string>
#include <vector>

#include "base/check_deref.h"
#include "base/files/file_path.h"
#include "base/notreached.h"
#include "base/scoped_observation.h"
#include "base/strings/string_number_conversions.h"
#include "base/test/bind.h"
#include "base/test/run_until.h"
#include "base/test/scoped_feature_list.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/autocomplete/chrome_autocomplete_scheme_classifier.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/tabs/split_tab_metrics.h"
#include "chrome/browser/ui/tabs/tab_enums.h"
#include "chrome/browser/ui/tabs/tab_group_model.h"
#include "chrome/browser/ui/tabs/tab_model.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/browser/ui/tahai/tahai_pane_layout_transition.h"
#include "chrome/browser/ui/tahai/tahai_window_mode_controller.h"
#include "chrome/browser/ui/tahai/tahai_workspace_rail_view.h"
#include "chrome/browser/ui/ui_features.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/browser/ui/views/frame/custom_floating_corner.h"
#include "chrome/browser/ui/views/frame/multi_contents_drop_target_view.h"
#include "chrome/browser/ui/views/frame/multi_contents_resize_area.h"
#include "chrome/browser/ui/views/frame/multi_contents_view_delegate.h"
#include "chrome/browser/ui/views/frame/multi_contents_view_drop_target_controller.h"
#include "chrome/browser/ui/views/tabs/dragging/tab_drag_controller.h"
#include "chrome/browser/ui/views/test/split_view_browser_test_mixin.h"
#include "chrome/browser/ui/views/toolbar/toolbar_view.h"
#include "chrome/browser/ui/webui/tahai/tahai_mission_service.h"
#include "chrome/common/pref_names.h"
#include "chrome/common/tahai_url_constants.h"
#include "chrome/common/webui_url_constants.h"
#include "chrome/grit/generated_resources.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/interactive_test_utils.h"
#include "chrome/test/base/ui_test_utils.h"
#include "components/prefs/pref_service.h"
#include "components/tabs/public/split_tab_data.h"
#include "components/tabs/public/tab_group.h"
#include "content/public/browser/navigation_controller.h"
#include "content/public/browser/web_ui.h"
#include "content/public/browser/webui_config_map.h"
#include "content/public/common/url_constants.h"
#include "content/public/test/browser_test.h"
#include "content/public/test/browser_test_utils.h"
#include "content/public/test/test_navigation_observer.h"
#include "testing/gmock/include/gmock/gmock.h"
#include "third_party/blink/public/mojom/frame/fullscreen.mojom.h"
#include "ui/base/dragdrop/drag_drop_types.h"
#include "ui/base/dragdrop/drop_target_event.h"
#include "ui/base/dragdrop/mojom/drag_drop_types.mojom.h"
#include "ui/base/dragdrop/os_exchange_data.h"
#include "ui/base/dragdrop/os_exchange_data_provider.h"
#include "ui/base/interaction/element_tracker.h"
#include "ui/base/l10n/l10n_util.h"
#include "ui/base/ozone_buildflags.h"
#include "ui/compositor/layer_tree_owner.h"
#include "ui/events/event.h"
#include "ui/ozone/public/ozone_platform.h"
#include "ui/views/controls/button/label_button.h"
#include "ui/views/controls/separator.h"
#include "ui/views/controls/textfield/textfield.h"
#include "ui/views/focus/focus_manager.h"
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/layout/proposed_layout.h"
#include "ui/views/test/button_test_api.h"
#include "ui/views/test/widget_test.h"
#include "ui/views/view_utils.h"
#include "url/gurl.h"
#include "url/url_constants.h"

using testing::Return;
using testing::ReturnRef;

namespace {

class TahaiWebUIBrowserTest : public InProcessBrowserTest {};

bool NavigateAndVerifyTahaiSurface(content::WebContents* contents,
                                   const char* url,
                                   const char* title,
                                   const char* body_marker) {
  content::TestNavigationObserver navigation_observer(contents);
  contents->GetController().LoadURLWithParams(
      content::NavigationController::LoadURLParams(GURL(url)));
  navigation_observer.Wait();
  if (!navigation_observer.last_navigation_succeeded()) {
    ADD_FAILURE() << "navigation failed for " << url
                  << " net_error=" << navigation_observer.last_net_error_code()
                  << " navigation_url="
                  << navigation_observer.last_navigation_url();
    return false;
  }
  if (contents->GetVisibleURL() != GURL(url)) {
    ADD_FAILURE() << "visible URL changed for " << url << ": "
                  << contents->GetVisibleURL();
    return false;
  }
  const std::string actual_title =
      content::EvalJs(contents, "document.title").ExtractString();
  if (actual_title != title) {
    ADD_FAILURE() << "wrong title for " << url << ": " << actual_title;
    return false;
  }
  const std::string body =
      content::EvalJs(contents, "document.body.innerText").ExtractString();
  if (body.find(body_marker) == std::string::npos) {
    ADD_FAILURE() << "missing surface marker for " << url;
    return false;
  }
  return true;
}

class MockDragController : public TabDragTarget::DragController {
 public:
  MockDragController() = default;
  MockDragController(const MockDragController&) = delete;
  MockDragController& operator=(const MockDragController&) = delete;
  ~MockDragController() override = default;

  MOCK_METHOD(std::unique_ptr<tabs::TabModel>,
              DetachTabAtForInsertion,
              (int),
              (override));
  MOCK_METHOD(const DragSessionData&, GetSessionData, (), (const, override));
  MOCK_METHOD(const TabDragContext*, GetAttachedContext, (), (const, override));
};

void CompareLayouts(const std::vector<views::ChildLayout>& expected,
                    const std::vector<views::ChildLayout>& actual) {
  EXPECT_EQ(actual.size(), expected.size());
  for (const auto& expected_child : expected) {
    bool found = false;
    for (const auto& actual_child : actual) {
      if (expected_child.child_view == actual_child.child_view) {
        found = true;
        EXPECT_EQ(expected_child, actual_child)
            << "Expected layout " << actual_child.ToString() << " to equal "
            << expected_child.ToString();
        break;
      }
    }
    EXPECT_TRUE(found) << "Expected to find layout for "
                       << expected_child.child_view->GetClassName();
  }
}

// Populate a browser with blank tabs before creating a Quad View. This keeps
// the layout tests focused on native tab collection and pane behavior, rather
// than allowing asynchronous New Tab Page work to outlive fixture teardown.
void AddBlankTabsUntilCount(Browser* browser, size_t target_count) {
  TabStripModel* model = browser->tab_strip_model();
  while (static_cast<size_t>(model->count()) < target_count) {
    chrome::AddSelectedTabWithURL(browser, GURL(url::kAboutBlankURL),
                                  ui::PAGE_TRANSITION_AUTO_TOPLEVEL);
  }
  model->ActivateTabAt(0);
}

}  // namespace

class MultiContentsViewBrowserTest
    : public SplitViewBrowserTestMixin<InProcessBrowserTest> {};

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNamedWorkspaceRestoresIntoIndependentWindow) {
  AddBlankTabsUntilCount(browser(), 6u);
  auto* model = browser()->tab_strip_model();
  model->SetTabPinned(0, true);
  const auto group = model->AddToNewGroup({1, 2, 3, 4});
  model->ChangeTabGroupVisuals(
      group, tab_groups::TabGroupVisualData(
                 u"Evidence", tab_groups::TabGroupColorId::kBlue));
  model->ActivateTabAt(2);
  split_tabs::SplitTabVisualData visual(split_tabs::SplitTabLayout::kStacked,
                                        0.6);
  visual.set_tahai_grid_ratios(0.35, 0.65);
  const auto original_split =
      model->AddToNewTahaiWorkspace({1, 2, 3, 4}, visual);
  auto* mode = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(mode);
  ASSERT_TRUE(mode->ApplyWorkspacePresentation("research", "expanded", 330));
  auto snapshot = tahai::CaptureNamedWorkspace(browser(), "Restored evidence");
  ASSERT_TRUE(snapshot.workspace);
  auto id =
      tahai::NamedWorkspaceStore(browser()->GetProfile()).Add(*snapshot.workspace);
  ASSERT_TRUE(id);
  auto* original_active = model->GetActiveWebContents();
  auto* restored = tahai::OpenNamedWorkspace(browser(), *id);
  ASSERT_TRUE(restored);
  EXPECT_NE(browser(), restored);
  EXPECT_EQ(browser()->GetProfile(), restored->GetProfile());
  auto* restored_model = restored->tab_strip_model();
  ASSERT_EQ(6, restored_model->count());
  EXPECT_TRUE(restored_model->GetTabAtIndex(0)->IsPinned());
  EXPECT_EQ(2, restored_model->active_index());
  ASSERT_TRUE(restored_model->GetActiveTab()->GetSplit());
  auto* split =
      restored_model->GetSplitData(*restored_model->GetActiveTab()->GetSplit());
  EXPECT_EQ(4u, split->ListTabs().size());
  EXPECT_EQ(visual, *split->visual_data());
  const auto restored_group = restored_model->GetActiveTab()->GetGroup();
  ASSERT_TRUE(restored_group);
  EXPECT_EQ(u"Evidence", restored_model->group_model()
                             ->GetTabGroup(*restored_group)
                             ->visual_data()
                             ->title());
  auto* restored_mode = tahai::WindowModeController::GetForBrowser(restored);
  ASSERT_TRUE(restored_mode);
  EXPECT_EQ("research", restored_mode->active_mode_id());
  EXPECT_EQ("expanded", restored_mode->active_configuration().rail_state);
  EXPECT_EQ(330, restored_mode->active_configuration().rail_width);
  ASSERT_TRUE(
      restored_mode->SetActiveConfigurationValue("rail_state", "hidden"));
  EXPECT_EQ("expanded", mode->active_configuration().rail_state);
  ASSERT_TRUE(restored_mode->MakeActiveModeProfileDefault());
  auto* profile_modes =
      tahai::ModeServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(profile_modes->SetActiveMode("support"));
  EXPECT_EQ("support", restored_mode->active_mode_id());
  EXPECT_EQ(profile_modes->configuration_for_mode("support").rail_state,
            restored_mode->active_configuration().rail_state);
  ASSERT_TRUE(
      restored_mode->SetActiveConfigurationValue("rail_state", "expanded"));
  EXPECT_EQ("expanded",
            profile_modes->configuration_for_mode("support").rail_state);
  EXPECT_EQ("research", mode->active_mode_id());
  EXPECT_EQ(6, model->count());
  EXPECT_EQ(original_active, model->GetActiveWebContents());
  EXPECT_EQ(original_split, model->GetActiveTab()->GetSplit());
  EXPECT_TRUE(
      restored_model->GetWebContentsAt(5)->GetController().NeedsReload());
  EXPECT_FALSE(restored_model->GetWebContentsAt(5)->IsLoading());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNamedWorkspaceDoesNotCrossPrivateProfiles) {
  AddBlankTabsUntilCount(browser(), 2u);
  auto snapshot = tahai::CaptureNamedWorkspace(browser(), "Regular only");
  ASSERT_TRUE(snapshot.workspace);
  auto id =
      tahai::NamedWorkspaceStore(browser()->GetProfile()).Add(*snapshot.workspace);
  ASSERT_TRUE(id);
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(private_browser);
  const auto private_snapshot =
      tahai::CaptureNamedWorkspace(private_browser, "Do not persist");
  EXPECT_FALSE(private_snapshot.workspace);
  EXPECT_EQ(tahai::NamedWorkspaceCaptureFailure::kUnavailable,
            private_snapshot.failure);
  EXPECT_EQ(nullptr, tahai::OpenNamedWorkspace(private_browser, *id));
  EXPECT_FALSE(
      chrome::IsCommandEnabled(private_browser, IDC_TAHAI_NAMED_WORKSPACES));
  EXPECT_EQ(nullptr, tahai::OpenNamedWorkspace(browser(), "missing"));
  EXPECT_EQ(2, browser()->tab_strip_model()->count());
  EXPECT_EQ(1, private_browser->tab_strip_model()->count());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNamedWorkspaceNativeManagerSavesFromButton) {
  AddBlankTabsUntilCount(browser(), 2u);
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_NAMED_WORKSPACES));
  views::Widget* manager = nullptr;
  ASSERT_TRUE(base::test::RunUntil([&] {
    for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
             browser()->GetWindow()->GetNativeWindow())) {
      views::Widget* widget = widget_ptr.get();
      if (widget->IsVisible() &&
          widget->widget_delegate()->GetWindowTitle() ==
              l10n_util::GetStringUTF16(IDS_TAHAI_WORKSPACES_TITLE)) {
        manager = widget;
        return true;
      }
    }
    return false;
  }));
  auto* tracker = views::ElementTrackerViews::GetInstance();
  const auto context = views::ElementTrackerViews::GetContextForWidget(manager);
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_NAMED_WORKSPACES));
  size_t managers = 0;
  for (const auto& widget_ptr : views::Widget::GetAllOwnedWidgets(
           browser()->GetWindow()->GetNativeWindow())) {
    views::Widget* widget = widget_ptr.get();
    managers +=
        tracker->GetFirstMatchingView(
            tahai::kNamedWorkspaceNameElementId,
            views::ElementTrackerViews::GetContextForWidget(widget), false)
            ? 1u
            : 0u;
  }
  EXPECT_EQ(1u, managers);
  auto* name = tracker->GetFirstMatchingViewAs<views::Textfield>(
      tahai::kNamedWorkspaceNameElementId, context);
  auto* save = tracker->GetFirstMatchingViewAs<views::LabelButton>(
      tahai::kNamedWorkspaceSaveElementId, context);
  ASSERT_TRUE(name);
  ASSERT_TRUE(save);
  name->SetText(u"Native manager review");
  views::test::ButtonTestApi(save).NotifyDefaultMouseClick();
  auto entries = tahai::NamedWorkspaceStore(browser()->GetProfile()).Read();
  ASSERT_TRUE(entries);
  ASSERT_EQ(1u, entries->size());
  EXPECT_EQ("Native manager review", entries->front().name);
  EXPECT_EQ(2u, entries->front().tabs.size());
  EXPECT_TRUE(name->GetText().empty());
  views::test::WidgetDestroyedWaiter destroyed(manager);
  manager->Close();
  destroyed.Wait();
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiLayoutFailureRetainsOriginalSplit) {
  AddBlankTabsUntilCount(browser(), 2u);
  ASSERT_TRUE(chrome::OpenTahaiDualView(browser(),
                                        chrome::TahaiDualViewLayout::kStacked));
  auto* model = browser()->tab_strip_model();
  const auto split_id = *model->GetActiveTab()->GetSplit();
  model->UpdateSplitRatio(split_id, 0.65);
  const auto expected = *model->GetSplitData(split_id)->visual_data();
  const auto members = model->GetSplitData(split_id)->ListTabs();
  auto* active = model->GetActiveWebContents();
  int attempts = 0;
  auto create = base::BindLambdaForTesting(
      [&](int index, std::optional<tab_groups::TabGroupId> group,
          bool pinned) -> content::WebContents* {
        if (++attempts == 2) {
          return nullptr;
        }
        return chrome::AddAndReturnTabAt(browser(),
                                         GURL(chrome::kChromeUINewTabURL),
                                         index, false, group, pinned);
      });
  EXPECT_FALSE(tahai::ApplyNativePaneLayout(
      browser(), 4, split_tabs::SplitTabLayout::kSideBySide, create));
  RunScheduledLayouts();
  EXPECT_EQ(2, attempts);
  EXPECT_EQ(2, model->count());
  ASSERT_TRUE(model->ContainsSplit(split_id));
  EXPECT_EQ(members, model->GetSplitData(split_id)->ListTabs());
  EXPECT_EQ(expected, *model->GetSplitData(split_id)->visual_data());
  EXPECT_EQ(active, model->GetActiveWebContents());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiLayoutFailurePreservesChangedCreatedPane) {
  AddBlankTabsUntilCount(browser(), 2u);
  ASSERT_TRUE(chrome::OpenTahaiDualView(
      browser(), chrome::TahaiDualViewLayout::kSideBySide));
  auto* model = browser()->tab_strip_model();
  const auto split_id = *model->GetActiveTab()->GetSplit();
  int attempts = 0;
  auto create = base::BindLambdaForTesting(
      [&](int index, std::optional<tab_groups::TabGroupId> group,
          bool pinned) -> content::WebContents* {
        if (++attempts == 2) {
          return nullptr;
        }
        // An independently navigated pane must not be swept up by rollback.
        return chrome::AddAndReturnTabAt(browser(), GURL(url::kAboutBlankURL),
                                         index, false, group, pinned);
      });
  EXPECT_FALSE(tahai::ApplyNativePaneLayout(
      browser(), 4, split_tabs::SplitTabLayout::kSideBySide, create));
  EXPECT_EQ(3, model->count());
  EXPECT_EQ(split_id, model->GetActiveTab()->GetSplit());
  EXPECT_EQ(2u, model->GetSplitData(split_id)->ListTabs().size());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiLayoutRejectsExistingAndForeignCreationResults) {
  AddBlankTabsUntilCount(browser(), 2u);
  ASSERT_TRUE(chrome::OpenTahaiDualView(
      browser(), chrome::TahaiDualViewLayout::kSideBySide));
  auto* model = browser()->tab_strip_model();
  const auto split_id = *model->GetActiveTab()->GetSplit();
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(private_browser);
  for (auto* contents :
       {model->GetActiveWebContents(),
        private_browser->tab_strip_model()->GetActiveWebContents()}) {
    auto create = base::BindLambdaForTesting(
        [contents](int, std::optional<tab_groups::TabGroupId>, bool) {
          return contents;
        });
    EXPECT_FALSE(tahai::ApplyNativePaneLayout(
        browser(), 3, split_tabs::SplitTabLayout::kStacked, create));
    EXPECT_EQ(2, model->count());
    EXPECT_EQ(1, private_browser->tab_strip_model()->count());
    EXPECT_EQ(split_id, model->GetActiveTab()->GetSplit());
  }
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiLayoutShrinkKeepsExistingSiblingPanes) {
  AddBlankTabsUntilCount(browser(), 5u);
  auto* model = browser()->tab_strip_model();
  model->ActivateTabAt(3);
  model->AddToNewTahaiWorkspace({2, 3, 4}, split_tabs::SplitTabVisualData());
  const auto retained_left = model->GetTabAtIndex(2)->GetHandle();
  const auto retained_active = model->GetActiveTab()->GetHandle();
  const auto unrelated = model->GetTabAtIndex(0)->GetHandle();
  ASSERT_TRUE(chrome::OpenTahaiDualView(
      browser(), chrome::TahaiDualViewLayout::kSideBySide));
  const auto* split = model->GetSplitData(*model->GetActiveTab()->GetSplit());
  ASSERT_EQ(2u, split->ListTabs().size());
  EXPECT_EQ(retained_left.Get(), split->ListTabs()[0]);
  EXPECT_EQ(retained_active.Get(), split->ListTabs()[1]);
  EXPECT_FALSE(unrelated.Get()->IsSplit());
  EXPECT_EQ(retained_active.Get(), model->GetActiveTab());
  EXPECT_EQ(5, model->count());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiGridGeometryNeverOverlapsAtTinySizes) {
  for (int extent : {0, 1, 2, 9, 10, 50, 399, 400, 410, 1000, 10000}) {
    for (double ratio : {-1.0, 0.1, 0.3, 0.5, 0.9, 2.0,
                         std::numeric_limits<double>::quiet_NaN(),
                         std::numeric_limits<double>::infinity()}) {
      SCOPED_TRACE(extent);
      const auto sizes =
          MultiContentsView::GetTahaiGridSizes(extent, ratio, 10);
      EXPECT_GE(sizes.start, 0);
      EXPECT_GE(sizes.resize, 0);
      EXPECT_GE(sizes.end, 0);
      EXPECT_EQ(extent, sizes.start + sizes.resize + sizes.end);
      if (extent >= 410) {
        EXPECT_GE(sizes.start, 200);
        EXPECT_GE(sizes.end, 200);
      }
    }
  }
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiGridDividersResizeResetAndKeepTabs) {
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1280, 900));
  AddBlankTabsUntilCount(browser(), 4u);
  auto* model = browser()->tab_strip_model();
  auto* view = multi_contents_view();
  for (int layout = 0; layout < 3; ++layout) {
    SCOPED_TRACE(layout);
    ASSERT_TRUE(
        layout == 2
            ? chrome::OpenTahaiQuadView(browser())
            : chrome::OpenTahaiTriView(
                  browser(), layout == 0
                                 ? chrome::TahaiTriViewLayout::kTwoOverOne
                                 : chrome::TahaiTriViewLayout::kOneOverTwo));
    RunScheduledLayouts();
    auto* active = model->GetActiveWebContents();
    const auto split_id = *model->GetActiveTab()->GetSplit();
    const auto members = model->GetSplitData(split_id)->ListTabs();
    auto* rows = view->tahai_grid_resize_area_for_testing(
        split_tabs::TahaiGridAxis::kRows);
    auto* columns = view->tahai_grid_resize_area_for_testing(
        split_tabs::TahaiGridAxis::kColumns);
    ASSERT_TRUE(rows->GetVisible());
    ASSERT_TRUE(columns->GetVisible());
    const auto& panes = view->contents_container_views();
    if (layout < 2) {
      const auto* reference = panes[layout == 0 ? 2 : 0].get();
      EXPECT_FALSE(reference->bounds().Intersects(columns->bounds()));
    }
    for (auto axis : {split_tabs::TahaiGridAxis::kRows,
                      split_tabs::TahaiGridAxis::kColumns}) {
      const double before = view->GetTahaiGridRatio(axis);
      ASSERT_TRUE(view->BeginTahaiGridResize(axis));
      view->OnTahaiGridResize(axis, 50, false);
      RunScheduledLayouts();
      view->OnTahaiGridResize(axis, 50, true);
      RunScheduledLayouts();
      EXPECT_GT(view->GetTahaiGridRatio(axis), before);
      EXPECT_EQ(model->GetSplitData(split_id)->ListTabs(), members);
      EXPECT_EQ(model->GetActiveWebContents(), active);
      view->ResetTahaiGridRatio(axis);
      RunScheduledLayouts();
      EXPECT_DOUBLE_EQ(0.5, view->GetTahaiGridRatio(axis));
    }
    // Reach the divider through browser pane traversal before arrow dispatch.
    panes[view->GetVisibleContentsCount() - 1]->contents_view()->RequestFocus();
    ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_FOCUS_NEXT_PANE));
    EXPECT_TRUE(rows->GetAccessibleResizeHandle()->HasFocus());
    ASSERT_TRUE(rows->OnKeyPressed(
        ui::KeyEvent(ui::EventType::kKeyPressed, ui::VKEY_UP, ui::EF_NONE)));
    RunScheduledLayouts();
    EXPECT_LT(view->GetTahaiGridRatio(split_tabs::TahaiGridAxis::kRows), 0.5);
    ASSERT_TRUE(rows->OnKeyPressed(
        ui::KeyEvent(ui::EventType::kKeyPressed, ui::VKEY_HOME, ui::EF_NONE)));
    RunScheduledLayouts();
    EXPECT_DOUBLE_EQ(0.5,
                     view->GetTahaiGridRatio(split_tabs::TahaiGridAxis::kRows));
  }
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiGridResizeCannotCrossTabSetsOrFocusMode) {
  AddBlankTabsUntilCount(browser(), 5u);
  ASSERT_TRUE(chrome::OpenTahaiQuadView(browser()));
  RunScheduledLayouts();
  auto* model = browser()->tab_strip_model();
  auto* view = multi_contents_view();
  const auto split_id = *model->GetActiveTab()->GetSplit();
  ASSERT_TRUE(view->BeginTahaiGridResize(split_tabs::TahaiGridAxis::kColumns));
  model->ActivateTabAt(4);
  RunScheduledLayouts();
  view->OnTahaiGridResize(split_tabs::TahaiGridAxis::kColumns, 150, true);
  EXPECT_DOUBLE_EQ(
      0.5, model->GetSplitData(split_id)->visual_data()->tahai_column_ratio());
  model->ActivateTabAt(0);
  RunScheduledLayouts();
  ASSERT_TRUE(view->SetTahaiFocusMode(true));
  RunScheduledLayouts();
  EXPECT_FALSE(view->BeginTahaiGridResize(split_tabs::TahaiGridAxis::kRows));
  EXPECT_FALSE(
      view->tahai_grid_resize_area_for_testing(split_tabs::TahaiGridAxis::kRows)
          ->GetVisible());
  EXPECT_FALSE(view->tahai_grid_resize_area_for_testing(
                       split_tabs::TahaiGridAxis::kColumns)
                   ->GetVisible());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiGridCaptureLossAndOrientationKeepRatios) {
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1280, 900));
  AddBlankTabsUntilCount(browser(), 3u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  RunScheduledLayouts();
  auto* view = multi_contents_view();
  auto* model = browser()->tab_strip_model();
  const auto split_id = *model->GetActiveTab()->GetSplit();
  auto* rows = view->tahai_grid_resize_area_for_testing(
      split_tabs::TahaiGridAxis::kRows);
  const ui::MouseEvent press(
      ui::EventType::kMousePressed, gfx::PointF(2, 2), gfx::PointF(2, 2),
      base::TimeTicks(), ui::EF_LEFT_MOUSE_BUTTON, ui::EF_LEFT_MOUSE_BUTTON);
  ASSERT_TRUE(rows->OnMousePressed(press));
  const ui::MouseEvent drag(ui::EventType::kMouseDragged, gfx::PointF(2, 52),
                            gfx::PointF(2, 52), base::TimeTicks(),
                            ui::EF_LEFT_MOUSE_BUTTON, 0);
  ASSERT_TRUE(rows->OnMouseDragged(drag));
  RunScheduledLayouts();
  const double ratio =
      view->GetTahaiGridRatio(split_tabs::TahaiGridAxis::kRows);
  EXPECT_GT(ratio, 0.5);
  rows->OnMouseCaptureLost();
  RunScheduledLayouts();
  EXPECT_DOUBLE_EQ(ratio,
                   view->GetTahaiGridRatio(split_tabs::TahaiGridAxis::kRows));
  model->ActivateTabAt(1);
  auto* active = model->GetActiveWebContents();
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kOneOverTwo));
  RunScheduledLayouts();
  EXPECT_EQ(split_id, model->GetActiveTab()->GetSplit());
  EXPECT_EQ(active, model->GetActiveWebContents());
  EXPECT_DOUBLE_EQ(ratio,
                   view->GetTahaiGridRatio(split_tabs::TahaiGridAxis::kRows));
  ASSERT_TRUE(view->BeginTahaiGridResize(split_tabs::TahaiGridAxis::kColumns));
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1180, 900));
  RunScheduledLayouts();
  EXPECT_FALSE(
      view->HasTahaiGridResizeTarget(split_tabs::TahaiGridAxis::kColumns));
  view->OnTahaiGridResize(split_tabs::TahaiGridAxis::kColumns, 150, true);
  EXPECT_DOUBLE_EQ(
      0.5, view->GetTahaiGridRatio(split_tabs::TahaiGridAxis::kColumns));
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiQuadLayoutFocusAndRestore) {
  AddBlankTabsUntilCount(browser(), 4u);
  TabStripModel* model = browser()->tab_strip_model();
  ASSERT_TRUE(chrome::OpenTahaiQuadView(browser()));
  RunScheduledLayouts();

  ASSERT_TRUE(multi_contents_view()->IsInSplitView());
  ASSERT_EQ(multi_contents_view()->GetVisibleContentsCount(), 4u);
  const auto& panes = multi_contents_view()->contents_container_views();
  ASSERT_EQ(panes.size(), 4u);
  for (size_t index = 0; index < panes.size(); ++index) {
    EXPECT_TRUE(panes[index]->GetVisible());
    EXPECT_FALSE(panes[index]->bounds().IsEmpty());
    EXPECT_EQ(panes[index]->contents_view()->web_contents(),
              model->GetWebContentsAt(static_cast<int>(index)));
  }
  EXPECT_FALSE(panes[0]->bounds().Intersects(panes[1]->bounds()));
  EXPECT_FALSE(panes[0]->bounds().Intersects(panes[2]->bounds()));
  EXPECT_FALSE(panes[1]->bounds().Intersects(panes[3]->bounds()));

  model->ActivateTabAt(2);
  EXPECT_EQ(multi_contents_view()->GetActiveIndex(), 2);
  ASSERT_TRUE(chrome::SetTahaiQuadFocusMode(browser(), true));
  EXPECT_TRUE(chrome::IsTahaiQuadFocusMode(browser()));
  RunScheduledLayouts();
  EXPECT_EQ(multi_contents_view()->GetVisibleContentsCount(), 1u);
  EXPECT_TRUE(panes[2]->GetVisible());

  model->ActivateTabAt(1);
  RunScheduledLayouts();
  EXPECT_EQ(multi_contents_view()->GetActiveIndex(), 1);
  EXPECT_EQ(multi_contents_view()->GetVisibleContentsCount(), 1u);
  EXPECT_TRUE(panes[1]->GetVisible());

  ASSERT_TRUE(chrome::SetTahaiQuadFocusMode(browser(), false));
  RunScheduledLayouts();
  EXPECT_EQ(multi_contents_view()->GetVisibleContentsCount(), 4u);
  EXPECT_EQ(multi_contents_view()->GetActiveIndex(), 1);

  // Closing a pane reflows to 3-up while preserving native focus/exit
  // controls. Exiting keeps all surviving tabs and the active target.
  model->CloseWebContentsAt(3, TabCloseTypes::CLOSE_USER_GESTURE);
  RunScheduledLayouts();
  EXPECT_TRUE(chrome::IsTahaiTriView(browser()));
  EXPECT_EQ(multi_contents_view()->GetVisibleContentsCount(), 3u);
  content::WebContents* active_contents = model->GetActiveWebContents();
  ASSERT_TRUE(chrome::ExitTahaiQuadView(browser()));
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());
  EXPECT_EQ(model->GetActiveWebContents(), active_contents);
  EXPECT_EQ(model->count(), 3);
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiQuadReorderAndExitPreserveActiveContents) {
  AddBlankTabsUntilCount(browser(), 4u);
  TabStripModel* model = browser()->tab_strip_model();
  ASSERT_TRUE(chrome::OpenTahaiQuadView(browser()));
  model->ActivateTabAt(3);
  content::WebContents* active_contents = model->GetActiveWebContents();
  ContentsWebView* active_view = multi_contents_view()->GetActiveContentsView();
  content::WebContents* moved_contents = model->GetWebContentsAt(0);

  model->MoveWebContentsAt(0, 2, false);
  RunScheduledLayouts();
  ASSERT_TRUE(chrome::IsTahaiQuadView(browser()));
  EXPECT_EQ(model->GetWebContentsAt(2), moved_contents);
  EXPECT_EQ(model->GetActiveWebContents(), active_contents);
  EXPECT_EQ(multi_contents_view()->GetActiveContentsView(), active_view);
  const auto& panes = multi_contents_view()->contents_container_views();
  for (int index = 0; index < 4; ++index) {
    EXPECT_EQ(panes[index]->contents_view()->web_contents(),
              model->GetWebContentsAt(index));
  }

  model->CloseWebContentsAt(0, TabCloseTypes::CLOSE_USER_GESTURE);
  RunScheduledLayouts();
  ASSERT_TRUE(chrome::IsTahaiTriView(browser()));
  EXPECT_EQ(multi_contents_view()->GetVisibleContentsCount(), 3u);
  EXPECT_EQ(multi_contents_view()->GetActiveIndex(), 2);
  EXPECT_EQ(multi_contents_view()->GetActiveContentsView(), active_view);
  for (int index = 0; index < 3; ++index) {
    EXPECT_EQ(panes[index]->contents_view()->web_contents(),
              model->GetWebContentsAt(index));
  }

  ASSERT_TRUE(chrome::ExitTahaiMultiView(browser()));
  RunScheduledLayouts();
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());
  EXPECT_EQ(multi_contents_view()->GetActiveIndex(), 0);
  EXPECT_EQ(multi_contents_view()->GetActiveContentsView(), active_view);
  EXPECT_EQ(multi_contents_view()->GetActiveContentsView()->web_contents(),
            active_contents);
  EXPECT_EQ(model->GetActiveWebContents(), active_contents);
  EXPECT_EQ(model->count(), 3);
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiQuadWorksInIncognitoWithoutCrossProfileTabs) {
  Browser* incognito = CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(incognito);
  AddBlankTabsUntilCount(incognito, 4u);
  ASSERT_TRUE(chrome::OpenTahaiQuadView(incognito));
  TabStripModel* model = incognito->tab_strip_model();
  ASSERT_EQ(model->count(), 4);
  ASSERT_TRUE(model->GetActiveTab()->IsSplit());
  EXPECT_EQ(model->GetSplitData(model->GetActiveTab()->GetSplit().value())
                ->ListTabs()
                .size(),
            4u);
  EXPECT_TRUE(std::ranges::all_of(
      model->GetSplitData(model->GetActiveTab()->GetSplit().value())
          ->ListTabs(),
      [incognito](tabs::TabInterface* tab) {
        return tab->GetContents()->GetBrowserContext() == incognito->GetProfile();
      }));
  MultiContentsView* incognito_view =
      BrowserView::GetBrowserViewForBrowser(incognito)->multi_contents_view();
  ASSERT_TRUE(incognito_view);
  EXPECT_EQ(incognito_view->GetVisibleContentsCount(), 4u);
  // Exercise the production persistence boundary in the private window.
  incognito_view->delegate_for_testing()->ResizeTahaiGrid(0.35, 0.65, true);
  const auto* private_data =
      model->GetSplitData(*model->GetActiveTab()->GetSplit())->visual_data();
  EXPECT_DOUBLE_EQ(0.35, private_data->tahai_row_ratio());
  EXPECT_DOUBLE_EQ(0.65, private_data->tahai_column_ratio());
  EXPECT_FALSE(browser()->tab_strip_model()->GetActiveTab()->IsSplit());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiDualAndTriLayoutsFillWindowAndStayIndependent) {
  AddBlankTabsUntilCount(browser(), 3u);
  TabStripModel* model = browser()->tab_strip_model();
  for (int index = 0; index < 3; ++index) {
    ASSERT_TRUE(content::ExecJs(model->GetWebContentsAt(index),
                                "document.title = 'TAHAI pane " +
                                    base::NumberToString(index) +
                                    "'; window.tahaiPaneState = 'pane-" +
                                    base::NumberToString(index) + "';"));
  }

  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  RunScheduledLayouts();
  ASSERT_TRUE(chrome::IsTahaiTriView(browser()));
  ASSERT_EQ(multi_contents_view()->GetVisibleContentsCount(), 3u);
  const auto& panes = multi_contents_view()->contents_container_views();
  ASSERT_GE(panes.size(), 4u);
  EXPECT_EQ(panes[0]->bounds().y(), panes[1]->bounds().y());
  EXPECT_EQ(panes[0]->bounds().height(), panes[1]->bounds().height());
  EXPECT_LT(panes[0]->bounds().bottom(), panes[2]->bounds().y());
  EXPECT_EQ(panes[0]->bounds().x(), panes[2]->bounds().x());
  EXPECT_EQ(panes[1]->bounds().right(), panes[2]->bounds().right());
  EXPECT_GT(panes[2]->bounds().width(), panes[0]->bounds().width());

  // Activate and mutate only pane 2. The other native WebContents must retain
  // their own DOM state and titles.
  model->ActivateTabAt(1);
  EXPECT_EQ(multi_contents_view()->GetActiveIndex(), 1);
  ASSERT_TRUE(
      content::ExecJs(model->GetActiveWebContents(),
                      "window.tahaiPaneState = 'pane-1-navigated'; "
                      "document.body.textContent = 'independent pane 1';"));
  EXPECT_EQ(content::EvalJs(model->GetWebContentsAt(0), "window.tahaiPaneState")
                .ExtractString(),
            "pane-0");
  EXPECT_EQ(content::EvalJs(model->GetWebContentsAt(1), "window.tahaiPaneState")
                .ExtractString(),
            "pane-1-navigated");
  EXPECT_EQ(content::EvalJs(model->GetWebContentsAt(2), "window.tahaiPaneState")
                .ExtractString(),
            "pane-2");

  model->ActivateTabAt(0);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kOneOverTwo));
  RunScheduledLayouts();
  EXPECT_EQ(panes[1]->bounds().y(), panes[2]->bounds().y());
  EXPECT_EQ(panes[1]->bounds().height(), panes[2]->bounds().height());
  EXPECT_LT(panes[0]->bounds().bottom(), panes[1]->bounds().y());
  EXPECT_EQ(panes[0]->bounds().x(), panes[1]->bounds().x());
  EXPECT_EQ(panes[0]->bounds().right(), panes[2]->bounds().right());
  EXPECT_GT(panes[0]->bounds().width(), panes[1]->bounds().width());

  ASSERT_TRUE(chrome::OpenTahaiDualView(browser(),
                                        chrome::TahaiDualViewLayout::kStacked));
  RunScheduledLayouts();
  ASSERT_TRUE(chrome::IsTahaiDualView(browser()));
  ASSERT_EQ(multi_contents_view()->GetVisibleContentsCount(), 2u);
  EXPECT_EQ(panes[0]->bounds().x(), panes[1]->bounds().x());
  EXPECT_LT(panes[0]->bounds().bottom(), panes[1]->bounds().y());

  ASSERT_TRUE(chrome::OpenTahaiDualView(
      browser(), chrome::TahaiDualViewLayout::kSideBySide));
  RunScheduledLayouts();
  EXPECT_EQ(panes[0]->bounds().y(), panes[1]->bounds().y());
  EXPECT_LT(panes[0]->bounds().right(), panes[1]->bounds().x());
  EXPECT_TRUE(chrome::ExitTahaiMultiView(browser()));
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiDualAndTriRemainProfileIsolated) {
  Browser* incognito = CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(incognito);
  AddBlankTabsUntilCount(incognito, 3u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      incognito, chrome::TahaiTriViewLayout::kTwoOverOne));
  TabStripModel* model = incognito->tab_strip_model();
  ASSERT_TRUE(model->GetActiveTab()->IsSplit());
  auto members = model->GetSplitData(model->GetActiveTab()->GetSplit().value())
                     ->ListTabs();
  ASSERT_EQ(members.size(), 3u);
  EXPECT_TRUE(
      std::ranges::all_of(members, [incognito](tabs::TabInterface* tab) {
        return tab->GetContents()->GetBrowserContext() == incognito->GetProfile();
      }));

  ASSERT_TRUE(chrome::OpenTahaiDualView(incognito,
                                        chrome::TahaiDualViewLayout::kStacked));
  members = model->GetSplitData(model->GetActiveTab()->GetSplit().value())
                ->ListTabs();
  ASSERT_EQ(members.size(), 2u);
  EXPECT_TRUE(
      std::ranges::all_of(members, [incognito](tabs::TabInterface* tab) {
        return tab->GetContents()->GetBrowserContext() == incognito->GetProfile();
      }));
}

// Exercise the public supported TAHAI WebUI route and the actual
// renderer-backed Mission Control surface. This deliberately verifies the
// product route rather than an implementation-only host.
IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionControlLoadsThroughPublicRoute) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  Profile* profile = browser()->GetProfile();
  ASSERT_TRUE(profile);
  tahai::MissionService seeded_service(profile);
  ASSERT_TRUE(
      seeded_service.CreateMission("Sensitive mission title", "incident"));
  EXPECT_TRUE(content::WebUIConfigMap::GetInstance().GetConfig(
      profile, GURL(tahai::kTahaiTrustedMissionURL)));
  EXPECT_FALSE(content::WebUIConfigMap::GetInstance().GetConfig(
      profile, GURL("chrome://tahai/unregistered/")));

  // Avoid the convenience navigation helpers: their initial LoadStop wait can
  // wait on stock NTP network work that this test intentionally replaces.
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiMissionURL, "Mission Control",
      "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "Boolean(document.querySelector('#new-mission-form') && "
          "document.querySelector('.mission-grid') && "
          "[...document.querySelectorAll('.card strong')].some(node => "
          "node.textContent === 'Mission') && "
          "[...document.querySelectorAll('.card strong')].some(node => "
          "node.textContent === 'Export safety') && "
          "document.querySelectorAll('[data-tahai-mission-action=launch-recipe]"
          "').length === 10 && "
          "document.querySelectorAll('[data-tahai-mission-action=copy-handoff]'"
          ").length === 1 && "
          "document.querySelectorAll('[data-tahai-mission-action=add-evidence]'"
          ").length === 1 && "
          "document.querySelectorAll('[data-tahai-mission-action=copy-evidence]"
          "').length === 1 && "
          "document.querySelectorAll('[data-tahai-mission-action=copy-capsule]"
          "').length === 1 && "
          "document.body.textContent.includes('Mission Black Box') && "
          "document.querySelectorAll('[data-tahai-timeline-filter]').length "
          "=== 7 && "
          "document.querySelectorAll('[data-tahai-export-profile]').length === "
          "1 && "
          "[...document.querySelectorAll('[data-tahai-mission-action=launch-"
          "recipe]')].every("
          "button => /^[-a-z0-9]+$/.test(button.dataset.tahaiRecipeId || '')))")
          .ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-mission-"
                              "action=copy-handoff]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Sanitized checkpoint status copied. Mission name and browsing data "
           "were omitted.";
  }));
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-mission-"
                              "action=copy-evidence]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Sanitized Evidence Pack copied. It contains generated status only.";
  }));
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-mission-"
                              "action=copy-capsule]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Sanitized Mission Capsule copied. Inspect it before sharing; it "
           "contains no sessions or page data.";
  }));
}

// A recipe is not a renderer-provided navigation primitive: the renderer can
// submit only a fixed library identifier, after which the browser creates four
// native HTTPS tabs and groups them in the existing Quad View implementation.
IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiRecipeLaunchCreatesGovernedQuadView) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiMissionURL, "Mission Control",
      "Real tabs. Real WebContents. Bounded mission state."));

  TabStripModel* model = browser()->tab_strip_model();
  const int initial_tab_count = model->count();
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-recipe-id="
                              "incident-triage]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return model->count() == initial_tab_count + 4 &&
           chrome::IsTahaiQuadView(browser());
  }));

  const auto split = model->GetActiveTab()->GetSplit();
  ASSERT_TRUE(split.has_value());
  const auto tabs = model->GetSplitData(*split)->ListTabs();
  ASSERT_EQ(tabs.size(), 4u);
  for (tabs::TabInterface* tab : tabs) {
    EXPECT_TRUE(tab->GetContents()->GetVisibleURL().SchemeIs("https"));
  }

  // Close every launched tab explicitly. The fixed public destinations are
  // intentionally allowed to begin their normal navigations, but the test
  // must not leave those renderers to browser-process teardown.
  while (model->count() > initial_tab_count) {
    model->CloseWebContentsAt(initial_tab_count, TabCloseTypes::CLOSE_NONE);
  }
  EXPECT_EQ(model->count(), initial_tab_count);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionModelPersistsBoundedCheckpointState) {
  Profile* profile = browser()->GetProfile();
  ASSERT_TRUE(profile);
  std::string mission_id;
  {
    tahai::MissionService service(profile);
    const auto mission =
        service.CreateMission("Native checkpoint test", "change");
    ASSERT_TRUE(mission.has_value());
    ASSERT_FALSE(mission->steps.empty());
    ASSERT_FALSE(mission->validation_steps.empty());
    ASSERT_FALSE(mission->rollback_steps.empty());
    mission_id = mission->id;
    EXPECT_TRUE(service.ToggleStep(mission_id, 0u));
    EXPECT_TRUE(service.ToggleValidationStep(mission_id, 0u));
    EXPECT_TRUE(service.ToggleRollbackStep(mission_id, 0u));
    EXPECT_TRUE(service.ToggleEscalation(mission_id));
    EXPECT_TRUE(service.AddEvidenceMarker(mission_id));
    EXPECT_TRUE(service.SetExportProfile(mission_id, "change-record"));
    EXPECT_FALSE(service.ToggleStep(mission_id, mission->steps.size()));
  }

  tahai::MissionService reloaded(profile);
  const auto found =
      std::find_if(reloaded.missions().begin(), reloaded.missions().end(),
                   [&mission_id](const tahai::MissionSummary& mission) {
                     return mission.id == mission_id;
                   });
  ASSERT_NE(found, reloaded.missions().end());
  EXPECT_TRUE(found->steps.front().complete);
  EXPECT_TRUE(found->validation_steps.front().complete);
  EXPECT_TRUE(found->rollback_steps.front().complete);
  EXPECT_TRUE(found->escalation_required);
  EXPECT_EQ("change-record", found->export_profile);
  ASSERT_EQ(1u, found->evidence.size());
  ASSERT_EQ(7u, found->timeline.size());
  EXPECT_EQ("Export profile selected", found->timeline.front().detail);
  EXPECT_EQ("export", found->timeline.front().kind);
  EXPECT_FALSE(reloaded.DeleteMission(mission_id));
  EXPECT_TRUE(reloaded.ArchiveMission(mission_id));
  EXPECT_TRUE(reloaded.DeleteMission(mission_id));
  EXPECT_FALSE(reloaded.DeleteMission(mission_id));

  const auto admin = reloaded.CreateMission("Admin parity", "admin");
  const auto support = reloaded.CreateMission("Support parity", "support");
  const auto development =
      reloaded.CreateMission("Development parity", "development");
  ASSERT_TRUE(admin.has_value());
  ASSERT_TRUE(support.has_value());
  ASSERT_TRUE(development.has_value());
  EXPECT_EQ("Confirm authorized administrative scope",
            admin->steps.front().label);
  EXPECT_EQ("Confirm customer scope and authorization",
            support->steps.front().label);
  EXPECT_EQ("Confirm reproducible scope", development->steps.front().label);
  EXPECT_TRUE(reloaded.ArchiveMission(admin->id));
  EXPECT_TRUE(reloaded.ArchiveMission(support->id));
  EXPECT_TRUE(reloaded.ArchiveMission(development->id));
  EXPECT_TRUE(reloaded.DeleteMission(admin->id));
  EXPECT_TRUE(reloaded.DeleteMission(support->id));
  EXPECT_TRUE(reloaded.DeleteMission(development->id));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest, TahaiNewTabLoadsThroughRoute) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  auto* mission_service =
      tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(mission_service);
  ASSERT_TRUE(mission_service->CreateMission("Launchpad persistence", "audit"));
  content::TestNavigationObserver navigation_observer(contents);
  contents->GetController().LoadURLWithParams(
      content::NavigationController::LoadURLParams(
          chrome::ChromeUINewTabURLAsGURL()));
  navigation_observer.Wait();
  ASSERT_TRUE(navigation_observer.last_navigation_succeeded());
  // BrowserURLHandler rewrites the URL that is loaded while deliberately
  // preserving chrome://newtab/ as the virtual URL shown to the user. Verify
  // that contract here, then assert the TAHAI-owned document below so this
  // cannot pass against Chromium's stock NTP.
  EXPECT_EQ(contents->GetVisibleURL(), chrome::ChromeUINewTabURLAsGURL());
  EXPECT_EQ(content::EvalJs(contents, "document.title").ExtractString(),
            "New Tab");
  EXPECT_TRUE(content::EvalJs(contents, "document.body.innerText")
                  .ExtractString()
                  .find("Focused browsing across complex work.") !=
              std::string::npos);
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "document.querySelector('.mark').naturalWidth > 0 && "
          "document.querySelector('.hero-art img').naturalWidth > 0 && "
          "document.body.textContent.includes('Native professional "
          "workspace') && "
          "document.body.textContent.includes('First 10 minutes') && "
          "document.body.textContent.includes('Start with ordinary browsing') "
          "&& "
          "document.body.textContent.includes('Recent missions') && "
          "document.body.textContent.includes('Launchpad persistence') && "
          "document.body.textContent.includes('Alt+Shift+M')")
          .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest, TahaiOpsToolsLoadsThroughRoute) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiOpsToolsURL,
                                            "Operator Command Center",
                                            "ALLOWLISTED BROWSER ACTIONS"));
  EXPECT_TRUE(content::EvalJs(contents,
                              "document.querySelectorAll('#command-list "
                              ".command').length === 14 && "
                              "['modes.open','mission.open','profiles.open','"
                              "support.open','policy.open'].every("
                              "name => "
                              "Boolean(document.querySelector(`[data-tahai-"
                              "command=\"${name}\"]`)))")
                  .ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-command="
                              "\"mission.open\"]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return contents->GetVisibleURL() == GURL(tahai::kTahaiMissionURL);
  }));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest, TahaiProfilesLoadsThroughRoute) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiProfilesURL, "Profile Administration",
      "Real Chromium isolation—not colored tab groups."));
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "Boolean(document.querySelector('a[href=\"chrome://profile-picker/"
          "\"]') && "
          "document.querySelector('a[href=\"chrome://settings/"
          "manageProfile\"]') && "
          "document.querySelector('a[href=\"chrome://settings/privacy\"]') && "
          "document.querySelectorAll('[data-tahai-identity-lane]').length >= "
          "2 && document.querySelector('script[src=\"/profiles.js\"]'))")
          .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest, TahaiSupportLoadsThroughRoute) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSupportURL,
                                            "Support",
                                            "Diagnose without exporting"));
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "Boolean(document.querySelector('[data-tahai-support-"
                      "action=copy-summary]') && "
                      "document.querySelector('#support-status') && "
                      "document.querySelector('script[src=\"/support.js\"]'))")
          .ExtractBool());
  // The support copy control has a browser-side message handler. Keep this
  // assertion here so the page cannot regress into an attractive but inert
  // renderer-only support surface.
  ASSERT_EQ(1u, contents->GetWebUI()->GetHandlersForTesting()->size());
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-support-"
                              "action=copy-summary]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#support-status').textContent")
               .ExtractString() ==
           "Sanitized support summary copied. It contains no browsing data or "
           "secrets.";
  }));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest, TahaiPolicyLoadsThroughRoute) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiPolicyURL,
                                            "Policy",
                                            "Policy can restrict features."));
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "document.body.textContent.includes('TAHAI Sync is not "
                      "Chrome Sync or Edge Sync') && "
                      "document.body.textContent.includes('Identity lanes') && "
                      "document.body.textContent.includes('Environment Guard')")
          .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiLocalOiRendersPrivateOperationalCommandDeck) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiLocalOiURL, "TAHAI Local OI",
      "See operational readiness without giving up your browser data."));
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "document.body.textContent.includes('Relationship graph') && "
          "document.body.textContent.includes('Private local index') && "
          "document.body.textContent.includes('uploads nothing')")
          .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiModeCommandGroupsStayModeSpecific) {
  const auto command_ids =
      [](std::span<const tahai::ModeCommandAction> actions) {
        std::vector<int> ids;
        for (const tahai::ModeCommandAction& action : actions) {
          ids.push_back(action.command_id);
        }
        return ids;
      };

  const tahai::ModeCommandGroup daily = tahai::GetModeCommandGroup("daily");
  EXPECT_THAT(
      command_ids(daily.toolbar_primary),
      testing::ElementsAre(IDC_TAHAI_NAMED_WORKSPACES, IDC_TAHAI_PROFILES));
  EXPECT_THAT(command_ids(daily.toolbar_secondary),
              testing::ElementsAre(IDC_TAHAI_WORK_MODES, IDC_TAHAI_PROFILES));

  const tahai::ModeCommandGroup builder = tahai::GetModeCommandGroup("builder");
  EXPECT_THAT(command_ids(builder.toolbar_secondary),
              testing::ElementsAre(IDC_TAHAI_WORK_MODES, IDC_TAHAI_LOCAL_OI));
  EXPECT_THAT(
      command_ids(builder.app_menu),
      testing::ElementsAre(IDC_TAHAI_COMMAND_CENTER, IDC_TAHAI_MISSION_CONTROL,
                           IDC_TAHAI_LOCAL_OI, IDC_TAHAI_WORK_MODES));

  const tahai::ModeCommandGroup operator_mode =
      tahai::GetModeCommandGroup("operator");
  EXPECT_THAT(command_ids(operator_mode.toolbar_primary),
              testing::ElementsAre(IDC_TAHAI_MISSION_CONTROL,
                                   IDC_TAHAI_COMMAND_CENTER));
  EXPECT_THAT(command_ids(operator_mode.app_menu),
              testing::ElementsAre(IDC_TAHAI_MISSION_CONTROL,
                                   IDC_TAHAI_LOCAL_OI, IDC_TAHAI_COMMAND_CENTER,
                                   IDC_TAHAI_SUPPORT, IDC_TAHAI_WORK_MODES));

  const tahai::ModeCommandGroup support = tahai::GetModeCommandGroup("support");
  EXPECT_THAT(command_ids(support.toolbar_secondary),
              testing::ElementsAre(IDC_TAHAI_LOCAL_OI, IDC_TAHAI_POLICY));
  EXPECT_THAT(command_ids(tahai::GetModeCommandGroup("unexpected").app_menu),
              testing::ElementsAre(IDC_TAHAI_SUPPORT, IDC_TAHAI_MISSION_CONTROL,
                                   IDC_TAHAI_LOCAL_OI, IDC_TAHAI_POLICY,
                                   IDC_TAHAI_WORK_MODES));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiUnknownSubresourceDoesNotTerminateBrowser) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiModesURL, "Work Modes", "Choose a work mode."));

  content::TestNavigationObserver navigation_observer(contents);
  contents->GetController().LoadURLWithParams(
      content::NavigationController::LoadURLParams(
          GURL("chrome://tahai/missing-tahai-resource")));
  navigation_observer.Wait();
  ASSERT_TRUE(navigation_observer.last_navigation_succeeded());
  EXPECT_EQ("Not found",
            content::EvalJs(contents, "document.title").ExtractString());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiModesAreTrustedAndExplicitlySelected) {
  ChromeAutocompleteSchemeClassifier scheme_classifier(browser()->GetProfile());
  EXPECT_EQ(metrics::OmniboxInputType::URL,
            scheme_classifier.GetInputTypeForScheme(tahai::kTahaiScheme));
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  const int original_tab_count = browser()->tab_strip_model()->count();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiModesURL, "Work Modes", "Choose a work mode."));
  ASSERT_EQ(1u, contents->GetWebUI()->GetHandlersForTesting()->size());
  EXPECT_TRUE(content::EvalJs(
                  contents,
                  "document.body.textContent.includes('Creator Studio') && "
                  "Boolean(document.querySelector('[data-tahai-mode=creator]')"
                  ".closest('.card'))")
                  .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "Boolean(document.querySelector('[data-tahai-modifier=watch]')"
          ".parentElement.nextElementSibling && "
          "document.querySelector('[data-tahai-modifier=watch]')"
          ".parentElement.nextElementSibling.dataset.tahaiCommand === "
          "'quad.open')")
          .ExtractBool());
  EXPECT_TRUE(content::EvalJs(
                  contents,
                  "document.body.textContent.includes('TAHAI Web Services') && "
                  "document.body.textContent.includes('TAHAI IT Docs') && "
                  "document.body.textContent.includes('TAHAI Operational "
                  "Intelligence')")
                  .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "['daily','creator','builder','operator','research','support']"
          ".every(id => Boolean(document.querySelector('.mode-card.mode-' + "
          "id)))")
          .ExtractBool());
  content::TestNavigationObserver mode_navigation(contents);
  ASSERT_TRUE(content::ExecJs(
      contents, "document.querySelector('[data-tahai-mode=creator]').click()"));
  mode_navigation.Wait();
  ASSERT_TRUE(mode_navigation.last_navigation_succeeded());
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "document.querySelector('.mode-actions h2')?.textContent"
                      ".includes('Creator Studio')")
          .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "document.body.classList.contains('mode-creator') && "
                      "document.body.textContent.includes('Neon Studio')")
          .ExtractBool());
  EXPECT_EQ(GURL(tahai::kTahaiModesURL), contents->GetVisibleURL());
  ASSERT_TRUE(content::ExecJs(
      contents,
      "document.querySelector('[data-tahai-open-dialog=mode-customize]')"
      ".click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
                           "document.querySelector('#mode-customize').open")
        .ExtractBool();
  }));
  ASSERT_TRUE(content::ExecJs(
      contents, "document.querySelector('#mode-customize').close()"));
  content::TestNavigationObserver configuration_navigation(contents);
  ASSERT_TRUE(
      content::ExecJs(contents,
                      "document.querySelector('[data-tahai-mode-config=theme]"
                      "[data-tahai-value=light]').click()"));
  configuration_navigation.Wait();
  ASSERT_TRUE(configuration_navigation.last_navigation_succeeded());
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "document.body.classList.contains('theme-light') && "
                      "document.body.classList.contains('mode-creator')")
          .ExtractBool());
  EXPECT_TRUE(
      content::EvalJs(
          contents,
          "Boolean(document.querySelector('[data-tahai-mode-config=accent]"
          "[data-tahai-value=slate]') && "
          "document.querySelector('[data-tahai-mode-config=surface]"
          "[data-tahai-value=paper]') && "
          "document.querySelector('[data-tahai-mode-config=density]"
          "[data-tahai-value=spacious]') && "
          "document.querySelector('[data-tahai-mode-config=header]"
          "[data-tahai-value=minimal]') && "
          "document.querySelector('[data-tahai-mode-config=layout_variant]"
          "[data-tahai-value=tri-one-over-two]'))")
          .ExtractBool());
  content::TestNavigationObserver accent_navigation(contents);
  ASSERT_TRUE(
      content::ExecJs(contents,
                      "document.querySelector('[data-tahai-mode-config=accent]"
                      "[data-tahai-value=slate]').click()"));
  accent_navigation.Wait();
  ASSERT_TRUE(accent_navigation.last_navigation_succeeded());
  EXPECT_TRUE(content::EvalJs(
                  contents, "document.body.classList.contains('accent-slate')")
                  .ExtractBool());
  content::TestNavigationObserver layout_navigation(contents);
  ASSERT_TRUE(content::ExecJs(
      contents,
      "document.querySelector('[data-tahai-mode-config=layout_variant]"
      "[data-tahai-value=tri-one-over-two]').click()"));
  layout_navigation.Wait();
  ASSERT_TRUE(layout_navigation.last_navigation_succeeded());
  tahai::ModeService reloaded_mode_service(browser()->GetProfile());
  EXPECT_EQ("tri-one-over-two",
            reloaded_mode_service.active_configuration().layout_variant_id);
  ASSERT_TRUE(content::ExecJs(
      contents,
      "document.querySelector('[data-tahai-open-dialog=mode-templates]')"
      ".click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
                           "document.querySelector('#mode-templates').open")
        .ExtractBool();
  }));
  ASSERT_TRUE(content::ExecJs(
      contents, "document.querySelector('#mode-templates').close()"));
  content::TestNavigationObserver template_navigation(contents);
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-template="
                              "creative-brief]').click()"));
  template_navigation.Wait();
  ASSERT_TRUE(template_navigation.last_navigation_succeeded());
  EXPECT_EQ(GURL(tahai::kTahaiMissionURL), contents->GetVisibleURL());
  EXPECT_TRUE(
      content::EvalJs(contents,
                      "document.body.textContent.includes('Creative brief')")
          .ExtractBool());
  EXPECT_EQ(original_tab_count, browser()->tab_strip_model()->count());
}

// TAHAI's operational surfaces must be browser commands, not merely pages that
// are reachable only when the user already knows a chrome:// URL. Exercise the
// same commands used by the app menu and accelerators in a normal browser.
IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiBrowserCommandsExposeOperationalSurfaces) {
  struct SurfaceCommand {
    int command_id;
    const char* url;
    const char* title;
  };
  constexpr SurfaceCommand kSurfaceCommands[] = {
      {IDC_TAHAI_LAUNCHPAD, tahai::kTahaiNewTabURL, "New Tab"},
      {IDC_TAHAI_MISSION_CONTROL, tahai::kTahaiMissionURL, "Mission Control"},
      {IDC_TAHAI_COMMAND_CENTER, tahai::kTahaiOpsToolsURL,
       "Operator Command Center"},
      {IDC_TAHAI_WORK_MODES, tahai::kTahaiModesURL, "Work Modes"},
      {IDC_TAHAI_PROFILES, tahai::kTahaiProfilesURL, "Profile Administration"},
      {IDC_TAHAI_SUPPORT, tahai::kTahaiSupportURL, "Support"},
      {IDC_TAHAI_POLICY, tahai::kTahaiPolicyURL, "Policy"},
  };

  TabStripModel* model = browser()->tab_strip_model();
  ASSERT_TRUE(model);
  const int initial_tab_count = model->count();
  for (const SurfaceCommand& surface : kSurfaceCommands) {
    ASSERT_TRUE(chrome::IsCommandEnabled(browser(), surface.command_id));
    ASSERT_TRUE(chrome::ExecuteCommand(browser(), surface.command_id));
    ASSERT_TRUE(base::test::RunUntil([&] {
      content::WebContents* active = model->GetActiveWebContents();
      return active && active->GetVisibleURL() == GURL(surface.url);
    }));
    EXPECT_EQ(content::EvalJs(model->GetActiveWebContents(), "document.title")
                  .ExtractString(),
              surface.title);
  }

  while (model->count() > initial_tab_count) {
    model->CloseWebContentsAt(model->count() - 1, TabCloseTypes::CLOSE_NONE);
  }
  EXPECT_EQ(model->count(), initial_tab_count);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiToolbarAdaptsToTheActiveMode) {
  BrowserView* browser_view = BrowserView::GetBrowserViewForBrowser(browser());
  ASSERT_TRUE(browser_view);
  tahai::WindowModeController* controller =
      browser_view->tahai_window_mode_controller();
  ASSERT_TRUE(controller);
  tahai::WorkspaceRailView* rail = browser_view->tahai_workspace_rail();
  ASSERT_TRUE(rail);
  ToolbarView* toolbar = browser_view->toolbar();
  ASSERT_TRUE(toolbar);

  ASSERT_TRUE(toolbar->tahai_mode_button());
  ASSERT_TRUE(toolbar->tahai_primary_button());
  ASSERT_TRUE(toolbar->tahai_secondary_button());
  ASSERT_TRUE(toolbar->tahai_layout_button());
  EXPECT_TRUE(toolbar->tahai_mode_button()->GetVisible());
  EXPECT_TRUE(toolbar->tahai_primary_button()->GetVisible());
  EXPECT_TRUE(toolbar->tahai_secondary_button()->GetVisible());
  EXPECT_TRUE(toolbar->tahai_layout_button()->GetVisible());
  EXPECT_EQ(u"Daily Driver", toolbar->tahai_mode_button()->GetText());
  EXPECT_EQ(u"Workspace", toolbar->tahai_primary_button()->GetText());
  EXPECT_EQ(u"Profiles", toolbar->tahai_secondary_button()->GetText());
  EXPECT_EQ(u"Layout", toolbar->tahai_layout_button()->GetText());
  EXPECT_TRUE(rail->is_collapsed());
  EXPECT_EQ(48, rail->GetPreferredSize().width());
  EXPECT_EQ("tabs", rail->selected_module_id());
  rail->SelectModule(2);
  EXPECT_EQ("bookmarks", rail->selected_module_id());
  RunScheduledLayouts();
  EXPECT_LE(rail->bounds().right(), browser_view->contents_container()->x());

  ASSERT_TRUE(controller->SetActiveMode("operator"));
  RunScheduledLayouts();
  EXPECT_EQ(u"Operator Mode", toolbar->tahai_mode_button()->GetText());
  EXPECT_EQ(u"Mission", toolbar->tahai_primary_button()->GetText());
  EXPECT_EQ(u"Support", toolbar->tahai_secondary_button()->GetText());
  EXPECT_FALSE(rail->is_collapsed());
  EXPECT_EQ(280, rail->GetPreferredSize().width());
  EXPECT_EQ("active-runbook", rail->selected_module_id());
  rail->SelectModule(3);
  EXPECT_EQ("evidence-markers", rail->selected_module_id());
  rail->OpenSelectedModule();
  ASSERT_TRUE(base::test::RunUntil([&] {
    content::WebContents* active =
        browser()->tab_strip_model()->GetActiveWebContents();
    return active && active->GetVisibleURL() == GURL(tahai::kTahaiLocalOiURL);
  }));
  rail->CyclePreferredWidth();
  EXPECT_EQ(360, rail->GetPreferredSize().width());
  rail->OnResize(90, /*done_resizing=*/true);
  EXPECT_EQ(450, rail->GetPreferredSize().width());
  rail->OnResize(1000, /*done_resizing=*/true);
  EXPECT_EQ(480, rail->GetPreferredSize().width());
  rail->OnResize(-1000, /*done_resizing=*/true);
  EXPECT_EQ(220, rail->GetPreferredSize().width());
  rail->OnResize(10, /*done_resizing=*/true);
  EXPECT_EQ(230, rail->GetPreferredSize().width());
  // Cycling from a user-dragged width advances to the next preset instead of
  // jumping back to the default width.
  rail->CyclePreferredWidth();
  EXPECT_EQ(280, rail->GetPreferredSize().width());
  EXPECT_LE(rail->bounds().right(), browser_view->contents_container()->x());

  // A mode selection changes the current Browser window only. A sibling
  // starts from the profile default and retains its own independent state.
  Browser* browser2 = CreateBrowser(browser()->GetProfile());
  BrowserView* browser_view2 = BrowserView::GetBrowserViewForBrowser(browser2);
  ASSERT_TRUE(browser_view2);
  tahai::WindowModeController* controller2 =
      browser_view2->tahai_window_mode_controller();
  ASSERT_TRUE(controller2);
  tahai::WorkspaceRailView* rail2 = browser_view2->tahai_workspace_rail();
  ASSERT_TRUE(rail2);
  ToolbarView* toolbar2 = browser_view2->toolbar();
  ASSERT_TRUE(toolbar2);
  EXPECT_EQ("daily", controller2->active_mode_id());
  EXPECT_EQ(u"Daily Driver", toolbar2->tahai_mode_button()->GetText());
  EXPECT_TRUE(rail2->is_collapsed());
  EXPECT_EQ("tabs", rail2->selected_module_id());

  ASSERT_TRUE(controller2->SetActiveMode("creator"));
  EXPECT_EQ("operator", controller->active_mode_id());
  EXPECT_EQ(u"Operator Mode", toolbar->tahai_mode_button()->GetText());
  EXPECT_EQ(u"Creator Studio", toolbar2->tahai_mode_button()->GetText());
  EXPECT_EQ(u"Workspace", toolbar2->tahai_primary_button()->GetText());
  EXPECT_EQ(u"Command Center", toolbar2->tahai_secondary_button()->GetText());
  EXPECT_FALSE(rail2->is_collapsed());
  EXPECT_EQ("canvas-tabs", rail2->selected_module_id());

  // Making an explicitly selected mode the profile default does not rewrite
  // an already-open sibling, but a future window starts from that default.
  ASSERT_TRUE(chrome::IsCommandEnabled(browser2, IDC_TAHAI_MAKE_MODE_DEFAULT));
  ASSERT_TRUE(chrome::ExecuteCommand(browser2, IDC_TAHAI_MAKE_MODE_DEFAULT));
  auto* mode_service =
      tahai::ModeServiceFactory::GetForProfile(browser()->GetProfile());
  EXPECT_EQ("creator", mode_service->active_mode().id);
  EXPECT_EQ("tri", mode_service->active_configuration().layout_id);
  EXPECT_EQ("tri-one-over-two",
            mode_service->active_configuration().layout_variant_id);

  Browser* browser3 = CreateBrowser(browser()->GetProfile());
  BrowserView* browser_view3 = BrowserView::GetBrowserViewForBrowser(browser3);
  ASSERT_TRUE(browser_view3);
  tahai::WindowModeController* controller3 =
      browser_view3->tahai_window_mode_controller();
  ASSERT_TRUE(controller3);
  EXPECT_EQ("creator", controller3->active_mode_id());

  // A settings-level default update reaches windows that still follow that
  // default, while preserving the earlier per-window Operator selection.
  ASSERT_TRUE(mode_service->SetActiveMode("research"));
  EXPECT_EQ("operator", controller->active_mode_id());
  EXPECT_EQ("research", controller3->active_mode_id());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiModeChangesOnlyRelayoutAffectedWindows) {
  class Counter : public tahai::WindowModeController::Observer {
   public:
    void OnTahaiWindowModeChanged() override { ++changes; }
    int changes = 0;
  } counter;
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller);
  ASSERT_TRUE(controller->SetActiveMode("daily"));
  auto* service =
      tahai::ModeServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  base::ScopedObservation<tahai::WindowModeController,
                          tahai::WindowModeController::Observer>
      observation(&counter);
  observation.Observe(controller);
  const auto initial = controller->active_configuration();
  const int tabs_before = browser()->tab_strip_model()->count();
  const auto* contents_before =
      browser()->tab_strip_model()->GetActiveWebContents();
  const auto& other = service->configuration_for_mode("creator");
  ASSERT_TRUE(service->SetConfigurationValueForMode(
      "creator", "rail_state",
      other.rail_state == "hidden" ? "icons" : "hidden"));
  EXPECT_EQ(0, counter.changes);
  EXPECT_EQ(initial, controller->active_configuration());
  const std::string next = initial.rail_state == "hidden" ? "icons" : "hidden";
  ASSERT_TRUE(controller->SetActiveConfigurationValue("rail_state", next));
  EXPECT_EQ(1, counter.changes);
  EXPECT_EQ(next, controller->active_configuration().rail_state);
  ASSERT_TRUE(controller->SetActiveConfigurationValue("rail_state", next));
  EXPECT_EQ(1, counter.changes);
  EXPECT_EQ(tabs_before, browser()->tab_strip_model()->count());
  EXPECT_EQ(contents_before,
            browser()->tab_strip_model()->GetActiveWebContents());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiRailHasOnlyIconsLabelsOrHidden) {
  auto* browser_view = BrowserView::GetBrowserViewForBrowser(browser());
  ASSERT_TRUE(browser_view);
  auto* rail = browser_view->tahai_workspace_rail();
  auto* controller = browser_view->tahai_window_mode_controller();
  ASSERT_TRUE(rail);
  ASSERT_TRUE(controller);
  const int tab_count = browser()->tab_strip_model()->count();
  for (const auto& mode : tahai::ModeService::definitions()) {
    ASSERT_TRUE(controller->SetActiveMode(mode.id));
    ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_ICONS));
    RunScheduledLayouts();
    EXPECT_TRUE(rail->GetVisible());
    EXPECT_TRUE(rail->is_collapsed());
    EXPECT_EQ(48, rail->GetPreferredSize().width());
    for (size_t index = 0; index < 5; ++index) {
      auto* button = rail->module_button_for_testing(index);
      ASSERT_TRUE(button);
      EXPECT_TRUE(button->GetText().empty());
      EXPECT_TRUE(button->HasImage(views::Button::STATE_NORMAL));
      EXPECT_GE(button->width(), 36);
      EXPECT_GE(button->height(), 36);
    }
    ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_EXPANDED));
    RunScheduledLayouts();
    EXPECT_FALSE(rail->is_collapsed());
    EXPECT_GE(rail->GetPreferredSize().width(), 220);
    for (size_t index = 0; index < 5; ++index) {
      auto* button = rail->module_button_for_testing(index);
      EXPECT_GT(button->GetText().size(), 2u);
      EXPECT_TRUE(button->HasImage(views::Button::STATE_NORMAL));
    }
    ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_HIDDEN));
    RunScheduledLayouts();
    EXPECT_TRUE(rail->is_hidden());
    EXPECT_FALSE(rail->GetVisible());
    EXPECT_EQ(0, rail->GetPreferredSize().width());
    EXPECT_EQ(0, rail->GetMinimumSize().width());
    // Restore is a browser command, not a button inside the hidden view.
    ASSERT_TRUE(chrome::IsCommandEnabled(browser(), IDC_TAHAI_RAIL_ICONS));
    ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_ICONS));
    EXPECT_TRUE(rail->GetVisible());
    EXPECT_FALSE(rail->is_hidden());
  }
  EXPECT_EQ(tab_count, browser()->tab_strip_model()->count());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiCollapsedRailActivatesAndRestoresPreferences) {
  auto* browser_view = BrowserView::GetBrowserViewForBrowser(browser());
  ASSERT_TRUE(browser_view);
  auto* rail = browser_view->tahai_workspace_rail();
  auto* controller = browser_view->tahai_window_mode_controller();
  ASSERT_TRUE(rail);
  ASSERT_TRUE(controller);
  ASSERT_TRUE(controller->SetActiveMode("daily"));
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_ICONS));
  views::test::ButtonTestApi(rail->module_button_for_testing(2))
      .NotifyDefaultMouseClick();
  ASSERT_TRUE(base::test::RunUntil([&] {
    return browser()
               ->tab_strip_model()
               ->GetActiveWebContents()
               ->GetVisibleURL() == GURL(chrome::kChromeUIBookmarksURL);
  }));
  EXPECT_EQ("bookmarks", rail->selected_module_id());
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_EXPANDED));
  rail->OnResize(30, /*done_resizing=*/false);
  rail->OnResize(30, /*done_resizing=*/true);
  EXPECT_EQ(310, controller->active_configuration().rail_width);
  EXPECT_EQ("bookmarks", rail->selected_module_id());
  rail->module_button_for_testing(2)->RequestFocus();
  ASSERT_EQ(rail->module_button_for_testing(2),
            browser_view->GetFocusManager()->GetFocusedView());
  // Hiding from a browser-owned recovery menu must also move focus out of
  // the removed native rail, not only the in-rail Hide button path.
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_HIDDEN));
  EXPECT_FALSE(rail->GetVisible());
  auto* focused_view = browser_view->GetFocusManager()->GetFocusedView();
  ASSERT_TRUE(focused_view);
  EXPECT_FALSE(rail->Contains(focused_view));
  EXPECT_TRUE(browser_view->toolbar()->Contains(focused_view));
  Browser* second_browser = CreateBrowser(browser()->GetProfile());
  auto* second_view = BrowserView::GetBrowserViewForBrowser(second_browser);
  ASSERT_TRUE(second_view);
  EXPECT_TRUE(second_view->tahai_workspace_rail()->is_hidden());
  ASSERT_TRUE(chrome::ExecuteCommand(second_browser, IDC_TAHAI_RAIL_EXPANDED));
  EXPECT_EQ(310,
            second_view->tahai_workspace_rail()->GetPreferredSize().width());
  EXPECT_TRUE(rail->GetVisible());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_IsSupported) {
  EXPECT_TRUE(multi_contents_view()->IsDragAndDropEnabled());

  Browser::CreateParams app_browser_params =
      Browser::CreateParams::CreateForApp("AppName", true, gfx::Rect(),
                                          browser()->GetProfile(), false);
  Browser* app_browser = Browser::Create(app_browser_params);

  EXPECT_FALSE(BrowserView::GetBrowserViewForBrowser(app_browser)
                   ->multi_contents_view()
                   ->IsDragAndDropEnabled());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_EndDropTarget) {
  ui::OSExchangeData data;
  const GURL kDropUrl("http://www.chromium.org/");
  data.SetURL(kDropUrl, u"Chromium");
  gfx::PointF point = {10, 10};
  ui::DropTargetEvent event(data, point, point, ui::DragDropTypes::DRAG_LINK);

  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::END,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);
  auto drop_cb = drop_target_view()->GetDropCallback(event);
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  ui::mojom::DragOperation output_drag_op = ui::mojom::DragOperation::kNone;
  std::move(drop_cb).Run(event, output_drag_op,
                         /*drag_image_layer_owner=*/nullptr);

  EXPECT_TRUE(multi_contents_view()->IsInSplitView());

  // After the drop, a new tab should be created in the split view.
  // The original tab is at index 0, the new tab from the drop is at index 1.
  ASSERT_EQ(2, browser()->tab_strip_model()->count());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->tab_strip_model()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(kDropUrl,
            browser()->tab_strip_model()->GetWebContentsAt(1)->GetURL());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_StartDropTarget) {
  ui::OSExchangeData data;
  const GURL kDropUrl("http://www.chromium.org/");
  data.SetURL(kDropUrl, u"Chromium");
  gfx::PointF point = {10, 10};
  ui::DropTargetEvent event(data, point, point, ui::DragDropTypes::DRAG_LINK);

  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::START,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);
  auto drop_cb = drop_target_view()->GetDropCallback(event);
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  ui::mojom::DragOperation output_drag_op = ui::mojom::DragOperation::kNone;
  std::move(drop_cb).Run(event, output_drag_op,
                         /*drag_image_layer_owner=*/nullptr);

  EXPECT_TRUE(multi_contents_view()->IsInSplitView());

  // After the drop, a new tab should be created in the split view.
  // The original tab is at index 0, the new tab from the drop is at index 1.
  ASSERT_EQ(2, browser()->tab_strip_model()->count());
  EXPECT_EQ(kDropUrl,
            browser()->tab_strip_model()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->tab_strip_model()->GetWebContentsAt(1)->GetURL());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_PinnedWithStartDropTarget) {
  browser()->tab_strip_model()->SetTabPinned(0, true);

  ui::OSExchangeData data;
  const GURL kDropUrl("http://www.chromium.org/");
  data.SetURL(kDropUrl, u"Chromium");
  gfx::PointF point = {10, 10};
  ui::DropTargetEvent event(data, point, point, ui::DragDropTypes::DRAG_LINK);

  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::START,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);
  auto drop_cb = drop_target_view()->GetDropCallback(event);
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  ui::mojom::DragOperation output_drag_op = ui::mojom::DragOperation::kNone;
  std::move(drop_cb).Run(event, output_drag_op,
                         /*drag_image_layer_owner=*/nullptr);

  EXPECT_TRUE(multi_contents_view()->IsInSplitView());

  // After the drop, a new tab should be created in the split view. The original
  // tab is at index 0, the new tab from the drop is at index 1. Both tabs
  // should be pinned.
  ASSERT_EQ(2, browser()->tab_strip_model()->count());
  EXPECT_EQ(kDropUrl,
            browser()->tab_strip_model()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->tab_strip_model()->GetWebContentsAt(1)->GetURL());
  EXPECT_TRUE(browser()->tab_strip_model()->GetTabAtIndex(0)->IsPinned());
  EXPECT_TRUE(browser()->tab_strip_model()->GetTabAtIndex(1)->IsPinned());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_GroupedWithEndDropTarget) {
  browser()->tab_strip_model()->AddToNewGroup({0});

  ui::OSExchangeData data;
  const GURL kDropUrl("http://www.chromium.org/");
  data.SetURL(kDropUrl, u"Chromium");
  gfx::PointF point = {10, 10};
  ui::DropTargetEvent event(data, point, point, ui::DragDropTypes::DRAG_LINK);

  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::END,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);
  auto drop_cb = drop_target_view()->GetDropCallback(event);
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  ui::mojom::DragOperation output_drag_op = ui::mojom::DragOperation::kNone;
  std::move(drop_cb).Run(event, output_drag_op,
                         /*drag_image_layer_owner=*/nullptr);

  EXPECT_TRUE(multi_contents_view()->IsInSplitView());

  // After the drop, a new tab should be created in the split view. The original
  // tab is at index 0, the new tab from the drop is at index 1. Both tabs
  // should be in a group.
  ASSERT_EQ(2, browser()->tab_strip_model()->count());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->tab_strip_model()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(kDropUrl,
            browser()->tab_strip_model()->GetWebContentsAt(1)->GetURL());
  EXPECT_TRUE(
      browser()->tab_strip_model()->GetTabAtIndex(0)->GetGroup().has_value());
  EXPECT_TRUE(
      browser()->tab_strip_model()->GetTabAtIndex(1)->GetGroup().has_value());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_BlockJavascriptUrl) {
  ui::OSExchangeData data;
  const GURL kDropUrl("javascript:alert(1)");
  data.SetURL(kDropUrl, u"javascript");
  gfx::PointF point = {10, 10};
  ui::DropTargetEvent event(data, point, point, ui::DragDropTypes::DRAG_LINK);

  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::START,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);
  auto drop_cb = drop_target_view()->GetDropCallback(event);
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  ui::mojom::DragOperation output_drag_op = ui::mojom::DragOperation::kNone;
  std::move(drop_cb).Run(event, output_drag_op,
                         /*drag_image_layer_owner=*/nullptr);

  EXPECT_TRUE(multi_contents_view()->IsInSplitView());

  // After the drop, a new tab should be created in the split view.
  // The original tab is at index 0, the new tab from the drop is at index 1.
  ASSERT_EQ(2, browser()->tab_strip_model()->count());
  EXPECT_EQ(GURL(content::kBlockedURL),
            browser()->tab_strip_model()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->tab_strip_model()->GetWebContentsAt(1)->GetURL());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleTabDrop_EndDropTarget) {
  TabStripModel* tab_strip_model = browser()->tab_strip_model();
  ASSERT_EQ(1, tab_strip_model->count());
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  // Show the drop target on the end side.
  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::END,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);

  // Create a second browser with a tab to be dragged.
  Browser* browser2 = CreateBrowser(browser()->GetProfile());
  content::WebContents* contents_to_drop =
      browser2->GetTabStripModel()->GetActiveWebContents();

  // Mock the drag controller to simulate a tab drop.
  MockDragController controller;
  DragSessionData session_data;
  session_data.source_view_index_ = 0;
  EXPECT_CALL(controller, GetSessionData).WillOnce(ReturnRef(session_data));
  EXPECT_CALL(controller, DetachTabAtForInsertion(0))
      .WillOnce(
          Return(browser2->GetTabStripModel()->DetachTabAtForInsertion(0)));

  // Handle the tab drop.
  multi_contents_view()->drop_target_controller().HandleTabDrop(controller);

  // Verify the state after the drop.
  EXPECT_TRUE(multi_contents_view()->IsInSplitView());
  ASSERT_EQ(2, tab_strip_model->count());
  EXPECT_EQ(contents_to_drop, tab_strip_model->GetWebContentsAt(1));
  EXPECT_EQ(1, tab_strip_model->active_index());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleTabDrop_StartDropTarget) {
  TabStripModel* tab_strip_model = browser()->tab_strip_model();
  content::WebContents* original_contents =
      tab_strip_model->GetActiveWebContents();
  ASSERT_EQ(1, tab_strip_model->count());
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  // Show the drop target on the start side.
  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::START,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);

  // Create a second browser with a tab to be dragged.
  Browser* browser2 = CreateBrowser(browser()->GetProfile());
  content::WebContents* contents_to_drop =
      browser2->GetTabStripModel()->GetActiveWebContents();

  // Mock the drag controller to simulate a tab drop.
  MockDragController controller;
  DragSessionData session_data;
  session_data.source_view_index_ = 0;
  EXPECT_CALL(controller, GetSessionData).WillOnce(ReturnRef(session_data));
  EXPECT_CALL(controller, DetachTabAtForInsertion(0))
      .WillOnce(
          Return(browser2->GetTabStripModel()->DetachTabAtForInsertion(0)));

  // Handle the tab drop.
  multi_contents_view()->drop_target_controller().HandleTabDrop(controller);

  // Verify the state after the drop.
  EXPECT_TRUE(multi_contents_view()->IsInSplitView());
  ASSERT_EQ(2, tab_strip_model->count());
  EXPECT_EQ(contents_to_drop, tab_strip_model->GetWebContentsAt(0));
  EXPECT_EQ(original_contents, tab_strip_model->GetWebContentsAt(1));
  EXPECT_EQ(0, tab_strip_model->active_index());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest, DragAndDropEnabledPref) {
  // Drag and drop should be enabled by default.
  EXPECT_TRUE(multi_contents_view()->IsDragAndDropEnabled());

  // Disable drag and drop.
  browser()->GetProfile()->GetPrefs()->SetBoolean(
      prefs::kSplitViewDragAndDropEnabled, false);
  EXPECT_FALSE(multi_contents_view()->IsDragAndDropEnabled());

  // Enable drag and drop.
  browser()->GetProfile()->GetPrefs()->SetBoolean(
      prefs::kSplitViewDragAndDropEnabled, true);
  EXPECT_TRUE(multi_contents_view()->IsDragAndDropEnabled());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       DragAndDropDisabledForChromePages) {
  // Drag and drop should be enabled for normal pages.
  ASSERT_TRUE(
      ui_test_utils::NavigateToURL(browser(), GURL(url::kAboutBlankURL)));
  EXPECT_TRUE(multi_contents_view()->IsDragAndDropEnabled());

  // Drag and drop should be disabled for chrome:// pages.
  ASSERT_TRUE(
      ui_test_utils::NavigateToURL(browser(), GURL("chrome://version")));
  EXPECT_FALSE(multi_contents_view()->IsDragAndDropEnabled());

  // Drag and drop should be enabled for chrome://newtab.
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(),
                                           chrome::ChromeUINewTabURLAsGURL()));
  EXPECT_TRUE(multi_contents_view()->IsDragAndDropEnabled());
}

// Test class for WebContents ReLayout.
class MultiContentsViewWebContentsReLayoutBrowserTest
    : public SplitViewBrowserTestMixin<InProcessBrowserTest> {
 protected:
  static constexpr char kReLayoutTestURL[] = "/re_layout_test.html";

  void SetUpOnMainThread() override {
    CreateTestServer(base::FilePath(FILE_PATH_LITERAL("chrome/test/data")));
    EXPECT_TRUE(embedded_test_server()->InitializeAndListen());
    embedded_test_server()->StartAcceptingConnections();
  }

  void CheckNoResizeHappened() {
    auto* tab_strip_model = browser()->tab_strip_model();
    const GURL test_url = embedded_test_server()->GetURL(kReLayoutTestURL);
    for (int i = 0; i < tab_strip_model->count(); i++) {
      auto* web_contents = tab_strip_model->GetWebContentsAt(i);
      EXPECT_TRUE(content::WaitForLoadStop(web_contents));
      if (web_contents->GetLastCommittedURL() != test_url) {
        continue;
      }
      EXPECT_EQ(false, content::EvalJs(web_contents, "window.has_resized"));
    }
  }

  int GetResizeCount(content::WebContents* web_contents) {
    return content::EvalJs(web_contents, "window.resize_count").ExtractInt();
  }

  void CreateSplitTabAndLoadReLayoutTestPage() {
    CreateSplitView();
    LoadReLayoutTestPageInActiveSplitTabs();
  }

  void CreateSplitView() {
    auto* tab_strip_model = browser()->tab_strip_model();
    const int active_index = tab_strip_model->active_index();

    RunScheduledLayouts();
    chrome::NewSplitTab(browser(), split_tabs::SplitTabLayout::kSideBySide,
                        split_tabs::SplitTabCreatedSource::kToolbarButton);
    EXPECT_TRUE(content::WaitForLoadStop(
        tab_strip_model->GetWebContentsAt(active_index + 1)));
    RunScheduledLayouts();
  }

  void LoadReLayoutTestPageInActiveSplitTabs() {
    auto* tab_strip_model = browser()->tab_strip_model();
    const int active_index = tab_strip_model->active_index();
    split_tabs::SplitTabId split_id =
        tab_strip_model->GetSplitForTab(active_index).value();
    split_tabs::SplitTabData* split_data =
        tab_strip_model->GetSplitData(split_id);
    ASSERT_TRUE(split_data);

    const GURL test_url = embedded_test_server()->GetURL(kReLayoutTestURL);
    for (tabs::TabInterface* tab : split_data->ListTabs()) {
      tab->GetContents()->GetController().LoadURL(test_url, content::Referrer(),
                                                  ui::PAGE_TRANSITION_TYPED,
                                                  std::string());
      EXPECT_TRUE(content::WaitForLoadStop(tab->GetContents()));
    }
  }
};

IN_PROC_BROWSER_TEST_F(
    MultiContentsViewWebContentsReLayoutBrowserTest,
    SwitchingTabsShouldNotTriggerWebContentsReLayout_SplitNoSplit) {
  auto* tab_strip_model = browser()->tab_strip_model();

  const GURL test_url = embedded_test_server()->GetURL(kReLayoutTestURL);

  // Load the test page in the active tab.
  tab_strip_model->GetActiveWebContents()->GetController().LoadURL(
      test_url, content::Referrer(), ui::PAGE_TRANSITION_TYPED, std::string());
  EXPECT_TRUE(
      content::WaitForLoadStop(tab_strip_model->GetActiveWebContents()));

  // Add a new tab and open split view.
  EXPECT_TRUE(
      AddTabAtIndex(1, GURL(url::kAboutBlankURL), ui::PAGE_TRANSITION_TYPED));
  CreateSplitTabAndLoadReLayoutTestPage();

  // Focus on the split tab.
  tab_strip_model->GetWebContentsAt(1)->Focus();
  RunScheduledLayouts();

  // Switching tabs should not trigger a re-layout.
  tab_strip_model->ActivateTabAt(
      0, TabStripUserGestureDetails(
             TabStripUserGestureDetails::GestureType::kOther));
  RunScheduledLayouts();
  tab_strip_model->ActivateTabAt(
      1, TabStripUserGestureDetails(
             TabStripUserGestureDetails::GestureType::kOther));
  RunScheduledLayouts();

  // No resize should have happened in the web contents.
  CheckNoResizeHappened();
}

IN_PROC_BROWSER_TEST_F(
    MultiContentsViewWebContentsReLayoutBrowserTest,
    SwitchingTabsShouldNotTriggerWebContentsReLayout_SplitSplit) {
  auto* tab_strip_model = browser()->tab_strip_model();

  const GURL test_url = embedded_test_server()->GetURL(kReLayoutTestURL);

  // Open split view and test page.
  CreateSplitTabAndLoadReLayoutTestPage();

  // Focus on the split tab.
  tab_strip_model->GetWebContentsAt(1)->Focus();

  // Add a dummy non-split tab to prevent NTP redirection.
  EXPECT_TRUE(
      AddTabAtIndex(2, GURL(url::kAboutBlankURL), ui::PAGE_TRANSITION_TYPED));
  tab_strip_model->GetWebContentsAt(1)->Focus();

  // Add a new tab and open split view.
  EXPECT_TRUE(
      AddTabAtIndex(3, GURL(url::kAboutBlankURL), ui::PAGE_TRANSITION_TYPED));
  CreateSplitView();

  // Change the size.
  multi_contents_view()->OnResize(multi_contents_view()->width() * 0.3, true);
  RunScheduledLayouts();

  // Load the test page in the active tab and split tab.
  LoadReLayoutTestPageInActiveSplitTabs();
  RunScheduledLayouts();

  // Switching tabs should not trigger a re-layout.
  tab_strip_model->ActivateTabAt(
      0, TabStripUserGestureDetails(
             TabStripUserGestureDetails::GestureType::kOther));
  RunScheduledLayouts();
  tab_strip_model->ActivateTabAt(
      3, TabStripUserGestureDetails(
             TabStripUserGestureDetails::GestureType::kOther));
  RunScheduledLayouts();

  // No resize should have happened in the web contents.
  CheckNoResizeHappened();
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewWebContentsReLayoutBrowserTest,
                       EnterAndExitFullscreenInSplitTabShouldResizeTwoTimes) {
  auto* tab_strip_model = browser()->tab_strip_model();

  const GURL test_url = embedded_test_server()->GetURL(kReLayoutTestURL);

  CreateSplitView();

  // Change the size.
  multi_contents_view()->OnResize(multi_contents_view()->width() * 0.3, true);
  RunScheduledLayouts();

  // Load the test page in the active tab and split tab.
  LoadReLayoutTestPageInActiveSplitTabs();
  RunScheduledLayouts();

  // Focus on the split tab.
  tab_strip_model->GetWebContentsAt(1)->Focus();
  RunScheduledLayouts();

  // Enter fullscreen in the split tab.
  content::WebContents* split_tab = tab_strip_model->GetWebContentsAt(1);
  split_tab->GetDelegate()->EnterFullscreenModeForTab(
      split_tab->GetPrimaryMainFrame(), {});
  ui_test_utils::FullscreenWaiter(browser(), {.tab_fullscreen = true}).Wait();
  RunScheduledLayouts();

  EXPECT_TRUE(base::test::RunUntil(
      [this, split_tab]() { return GetResizeCount(split_tab) >= 1; }));

  // Exit fullscreen in the split tab.
  split_tab->GetDelegate()->ExitFullscreenModeForTab(split_tab);
  ui_test_utils::FullscreenWaiter(
      browser(), ui_test_utils::FullscreenWaiter::kNoFullscreen)
      .Wait();
  RunScheduledLayouts();

  int expected_resize = 2;
#if BUILDFLAG(IS_OZONE)
  if (ui::OzonePlatform::RunningOnWaylandForTest()) {
    // On Wayland, entering and exiting fullscreen each trigger 2 resizes. There
    // is an immediate synchronous layout followed by an async layout after the
    // Wayland compositor responds.
    expected_resize = 4;
  }
#elif BUILDFLAG(IS_MAC)
  // The WebContents is resized three times when entering and exiting fullscreen
  // due to the layout process involving the new `main_container_`:
  // 1. `BrowserViewLayout` sets the bounds of `main_container_`. The default
  //    layout manager for `main_container_` immediately resizes its child,
  //    `contents_container_`, to fit.
  // 2. `BrowserViewLayout` then explicitly sets the bounds of
  //    `contents_container_` itself, triggering a second layout.
  // 3. `BrowserViewLayout` also updates separators in `MultiContentsView`,
  //    which calls `InvalidateLayout()`, scheduling a final, asynchronous
  //    layout pass.
  expected_resize = 3;
#endif

  EXPECT_TRUE(base::test::RunUntil([this, split_tab, expected_resize]() {
    return GetResizeCount(split_tab) >= expected_resize;
  }));
  RunScheduledLayouts();

  // The WebContents is resized two times, one each when entering and exiting
  // fullscreen.
  EXPECT_EQ(GetResizeCount(split_tab), expected_resize);
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest, OnlyFocusTabsInSplitView) {
  // Set up tab strip with a regular tab and two split views with the last split
  // view being active.
  auto* tab_strip_model = browser()->tab_strip_model();

  EXPECT_TRUE(
      AddTabAtIndex(1, GURL(url::kAboutBlankURL), ui::PAGE_TRANSITION_TYPED));
  chrome::NewSplitTab(browser(), split_tabs::SplitTabLayout::kSideBySide,
                      split_tabs::SplitTabCreatedSource::kToolbarButton);
  EXPECT_TRUE(
      AddTabAtIndex(3, GURL(url::kAboutBlankURL), ui::PAGE_TRANSITION_TYPED));
  chrome::NewSplitTab(browser(), split_tabs::SplitTabLayout::kSideBySide,
                      split_tabs::SplitTabCreatedSource::kToolbarButton);

  ASSERT_EQ(5, browser()->tab_strip_model()->count());
  const int active_index = tab_strip_model->active_index();
  ASSERT_EQ(4, active_index);
  EXPECT_TRUE(tab_strip_model->GetActiveTab()->IsSplit());
  EXPECT_FALSE(tab_strip_model->GetTabAtIndex(0)->IsSplit());
  EXPECT_TRUE(tab_strip_model->GetTabAtIndex(1)->IsSplit());

  auto* delegate = multi_contents_view()->delegate_for_testing();
  // Focusing a tab outside the active split doesn't change the active index.
  delegate->WebContentsFocused(tab_strip_model->GetWebContentsAt(0));
  EXPECT_EQ(tab_strip_model->active_index(), active_index);

  // Focusing a split tab outside the active split doesn't change the active
  // index.
  delegate->WebContentsFocused(tab_strip_model->GetWebContentsAt(1));
  EXPECT_EQ(tab_strip_model->active_index(), active_index);

  // Focusing a tab inside the active split changes the active index.
  delegate->WebContentsFocused(tab_strip_model->GetWebContentsAt(3));
  EXPECT_EQ(tab_strip_model->active_index(), 3);
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest, LeadingSeparatorLayout) {
  MultiContentsView* view = multi_contents_view();
  view->SetShouldShowTopSeparator(true);
  view->drop_target_view_->Show(
      MultiContentsDropTargetView::DropSide::START,
      MultiContentsDropTargetView::DropTargetState::kFull,
      MultiContentsDropTargetView::DragType::kLink);
  view->drop_target_view_->animation_for_testing().End();

  gfx::Rect initial_bounds(10, 20, 100, 80);
  std::vector<views::ChildLayout> actual_child_layouts;

  gfx::Rect remaining_space =
      view->CalculateSeparatorLayouts(initial_bounds, actual_child_layouts);

  constexpr int kSeparatorThickness = views::Separator::kThickness;

  gfx::Rect expected_remaining_space(
      initial_bounds.x() + kSeparatorThickness,
      initial_bounds.y() + kSeparatorThickness,
      initial_bounds.width() - kSeparatorThickness,
      initial_bounds.height() - kSeparatorThickness);
  EXPECT_EQ(expected_remaining_space, remaining_space);

  std::vector<views::ChildLayout> expected_separator_layouts;
  expected_separator_layouts.emplace_back(
      view->contents_separators_.top_separator.get(), true,
      gfx::Rect(10, 20, 100, kSeparatorThickness));
  expected_separator_layouts.emplace_back(
      view->contents_separators_.leading_separator.get(), true,
      gfx::Rect(10, 20, kSeparatorThickness, 80));
  expected_separator_layouts.emplace_back(
      view->contents_separators_.trailing_separator.get(), false,
      gfx::Rect(10 + 100, 20, 0, 80));
  expected_separator_layouts.emplace_back(
      view->contents_separators_.corner_separator.get(), true,
      gfx::Rect(
          initial_bounds.origin(),
          view->contents_separators_.corner_separator->GetPreferredSize()));

  CompareLayouts(expected_separator_layouts, actual_child_layouts);
  EXPECT_EQ(
      CornerOrientation::kTopLeading,
      view->contents_separators_.corner_separator->orientation_for_testing());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest, TrailingSeparatorLayout) {
  MultiContentsView* view = multi_contents_view();
  view->SetShouldShowTopSeparator(true);
  view->drop_target_view_->Show(
      MultiContentsDropTargetView::DropSide::END,
      MultiContentsDropTargetView::DropTargetState::kFull,
      MultiContentsDropTargetView::DragType::kLink);
  view->drop_target_view_->animation_for_testing().End();

  gfx::Rect initial_bounds(10, 20, 100, 80);
  std::vector<views::ChildLayout> actual_child_layouts;

  gfx::Rect remaining_space =
      view->CalculateSeparatorLayouts(initial_bounds, actual_child_layouts);

  constexpr int kSeparatorThickness = views::Separator::kThickness;

  gfx::Rect expected_remaining_space(
      initial_bounds.x(), initial_bounds.y() + kSeparatorThickness,
      initial_bounds.width() - kSeparatorThickness,
      initial_bounds.height() - kSeparatorThickness);
  EXPECT_EQ(expected_remaining_space, remaining_space);

  std::vector<views::ChildLayout> expected_separator_layouts;
  expected_separator_layouts.emplace_back(
      view->contents_separators_.top_separator.get(), true,
      gfx::Rect(10, 20, 100, kSeparatorThickness));
  expected_separator_layouts.emplace_back(
      view->contents_separators_.leading_separator.get(), false,
      gfx::Rect(10, 20, 0, 80));
  expected_separator_layouts.emplace_back(
      view->contents_separators_.trailing_separator.get(), true,
      gfx::Rect(10 + 100 - kSeparatorThickness, 20, kSeparatorThickness, 80));
  expected_separator_layouts.emplace_back(
      view->contents_separators_.corner_separator.get(), true,
      gfx::Rect(
          gfx::Point(initial_bounds.right() -
                         view->contents_separators_.corner_separator
                             ->GetPreferredSize()
                             .width(),
                     initial_bounds.y()),
          view->contents_separators_.corner_separator->GetPreferredSize()));

  CompareLayouts(expected_separator_layouts, actual_child_layouts);
  EXPECT_EQ(
      CornerOrientation::kTopTrailing,
      view->contents_separators_.corner_separator->orientation_for_testing());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest, DropTargetLayout) {
  MultiContentsView* view = multi_contents_view();
  gfx::Rect initial_bounds(10, 20, 1000, 800);

  // Drop target hidden.
  {
    std::vector<views::ChildLayout> actual_child_layouts;
    view->drop_target_view_->SetVisible(false);
    view->drop_target_view_->animation_for_testing().End();
    gfx::Rect remaining_space =
        view->CalculateDropTargetLayout(initial_bounds, actual_child_layouts);

    EXPECT_EQ(initial_bounds, remaining_space);
    EXPECT_EQ(1u, actual_child_layouts.size());
    EXPECT_EQ(view->drop_target_view_.get(),
              actual_child_layouts[0].child_view);
    EXPECT_FALSE(actual_child_layouts[0].visible);
  }

  // Drop target is on the START side.
  {
    std::vector<views::ChildLayout> actual_child_layouts;
    view->drop_target_view_->Show(
        MultiContentsDropTargetView::DropSide::START,
        MultiContentsDropTargetView::DropTargetState::kFull,
        MultiContentsDropTargetView::DragType::kLink);
    view->drop_target_view_->animation_for_testing().End();
    gfx::Rect remaining_space =
        view->CalculateDropTargetLayout(initial_bounds, actual_child_layouts);

    const int drop_target_width =
        view->drop_target_view_->GetSizeForAvailableSpace(
            initial_bounds.width());
    gfx::Rect expected_remaining_space(
        initial_bounds.x() + drop_target_width, initial_bounds.y(),
        initial_bounds.width() - drop_target_width, initial_bounds.height());
    EXPECT_EQ(expected_remaining_space, remaining_space);

    std::vector<views::ChildLayout> expected_child_layouts;
    expected_child_layouts.emplace_back(
        view->drop_target_view_.get(), true,
        gfx::Rect(initial_bounds.x(), initial_bounds.y(), drop_target_width,
                  initial_bounds.height()));
    CompareLayouts(expected_child_layouts, actual_child_layouts);
  }

  // Drop target is on the END side.
  {
    std::vector<views::ChildLayout> actual_child_layouts;
    view->drop_target_view_->Show(
        MultiContentsDropTargetView::DropSide::END,
        MultiContentsDropTargetView::DropTargetState::kFull,
        MultiContentsDropTargetView::DragType::kLink);
    view->drop_target_view_->animation_for_testing().End();
    gfx::Rect remaining_space =
        view->CalculateDropTargetLayout(initial_bounds, actual_child_layouts);

    const int drop_target_width =
        view->drop_target_view_->GetSizeForAvailableSpace(
            initial_bounds.width());
    gfx::Rect expected_remaining_space(
        initial_bounds.x(), initial_bounds.y(),
        initial_bounds.width() - drop_target_width, initial_bounds.height());
    EXPECT_EQ(expected_remaining_space, remaining_space);

    std::vector<views::ChildLayout> expected_child_layouts;
    expected_child_layouts.emplace_back(
        view->drop_target_view_.get(), true,
        gfx::Rect(initial_bounds.right() - drop_target_width,
                  initial_bounds.y(), drop_target_width,
                  initial_bounds.height()));
    CompareLayouts(expected_child_layouts, actual_child_layouts);
  }

  // Drop target is on the BOTTOM side.
  {
    std::vector<views::ChildLayout> actual_child_layouts;
    view->drop_target_view_->Show(
        MultiContentsDropTargetView::DropSide::BOTTOM,
        MultiContentsDropTargetView::DropTargetState::kFull,
        MultiContentsDropTargetView::DragType::kLink);
    view->drop_target_view_->animation_for_testing().End();
    gfx::Rect remaining_space =
        view->CalculateDropTargetLayout(initial_bounds, actual_child_layouts);

    const int drop_target_height =
        view->drop_target_view_->GetSizeForAvailableSpace(
            initial_bounds.height());
    gfx::Rect expected_remaining_space(
        initial_bounds.x(), initial_bounds.y(), initial_bounds.width(),
        initial_bounds.height() - drop_target_height);
    EXPECT_EQ(expected_remaining_space, remaining_space);

    std::vector<views::ChildLayout> expected_child_layouts;
    expected_child_layouts.emplace_back(
        view->drop_target_view_.get(), true,
        gfx::Rect(initial_bounds.x(),
                  initial_bounds.bottom() - drop_target_height,
                  initial_bounds.width(), drop_target_height));
    CompareLayouts(expected_child_layouts, actual_child_layouts);
  }
}
