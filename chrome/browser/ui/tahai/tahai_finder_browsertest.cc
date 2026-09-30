// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_finder.h"

#include <algorithm>

#include "base/test/run_until.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/ui/accelerator_table.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/browser_window/public/browser_window_interface.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/ui_test_utils.h"
#include "content/public/test/browser_test.h"
#include "ui/base/accelerators/accelerator.h"
#include "ui/events/event.h"
#include "ui/views/controls/scroll_view.h"
#include "ui/views/controls/textfield/textfield.h"
#include "ui/views/focus/focus_manager.h"
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/test/views_test_utils.h"
#include "ui/views/test/widget_test.h"
#include "ui/views/widget/widget.h"
#include "url/gurl.h"
#include "url/url_constants.h"

namespace tahai {
namespace {
class TahaiFinderBrowserTest : public InProcessBrowserTest {
 protected:
  views::Textfield* Search() {
    for (const auto& widget : views::Widget::GetAllOwnedWidgets(
             browser()->GetWindow()->GetNativeWindow())) {
      if (auto* search =
              views::ElementTrackerViews::GetInstance()
                  ->GetFirstMatchingViewAs<views::Textfield>(
                      kFinderSearchElementId,
                      views::ElementTrackerViews::GetContextForWidget(
                          widget.get()),
                      false)) {
        return search;
      }
    }
    return nullptr;
  }

  void TearDownOnMainThread() override {
    if (auto* search = Search()) {
      search->GetWidget()->CloseNow();
    }
    InProcessBrowserTest::TearDownOnMainThread();
  }
};

IN_PROC_BROWSER_TEST_F(TahaiFinderBrowserTest,
                       ShortcutSearchEnterAndReopenUseNativeViews) {
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      browser(), GURL("data:text/html,<title>KeyboardNeedle</title>")));
  auto* destination = browser()->GetTabStripModel()->GetActiveWebContents();
  // Add a neutral second tab directly. Going through the stock New Tab
  // command exercises profile-specific NTP plumbing that is unrelated to
  // Finder and leaves global browser UI widgets alive during test teardown.
  browser()->GetTabStripModel()->delegate()->AddTabAt(GURL(url::kAboutBlankURL),
                                                      -1, true);
  const auto count = browser()->GetTabStripModel()->count();
  ASSERT_NE(destination, browser()->GetTabStripModel()->GetActiveWebContents());

  ui::Accelerator accelerator;
  ASSERT_TRUE(GetAcceleratorForCommandId(IDC_TAHAI_FINDER, &accelerator));
  EXPECT_EQ(ui::VKEY_SPACE, accelerator.key_code());
  EXPECT_TRUE(accelerator.IsCtrlDown());
  EXPECT_TRUE(accelerator.IsShiftDown());
  auto* focus =
      BrowserView::GetBrowserViewForBrowser(browser())->GetFocusManager();
  ASSERT_TRUE(focus->ProcessAccelerator(accelerator));
  ASSERT_TRUE(base::test::RunUntil([&] { return Search() != nullptr; }));
  auto* search = Search();
  ShowFinder(browser());
  EXPECT_EQ(search, Search());
  EXPECT_EQ(search, search->GetFocusManager()->GetFocusedView());
  search->InsertOrReplaceText(u"keyboardneedle");

  ui::KeyEvent enter(ui::EventType::kKeyPressed, ui::VKEY_RETURN, ui::EF_NONE);
  static_cast<views::View*>(search)->OnKeyEvent(&enter);
  EXPECT_TRUE(enter.handled());
  search->GetWidget()->CloseNow();
  base::RunLoop().RunUntilIdle();
  ASSERT_TRUE(base::test::RunUntil([&] {
    return browser()->GetTabStripModel()->GetActiveWebContents() == destination;
  }));
  EXPECT_EQ(count, browser()->GetTabStripModel()->count());
  EXPECT_FALSE(Search());
  ASSERT_TRUE(focus->ProcessAccelerator(accelerator));
  ASSERT_TRUE(base::test::RunUntil([&] { return Search() != nullptr; }));
  auto* reopened = Search();
  reopened->GetWidget()->CloseNow();
  base::RunLoop().RunUntilIdle();
}

IN_PROC_BROWSER_TEST_F(TahaiFinderBrowserTest,
                       EveryResultRemainsReachableAfterDialogResize) {
  // Local blank tabs guarantee overflow without network or profile fixtures.
  while (browser()->GetTabStripModel()->count() < 16) {
    browser()->GetTabStripModel()->delegate()->AddTabAt(
        GURL(url::kAboutBlankURL), -1, false);
  }
  const auto tab_count = browser()->GetTabStripModel()->count();
  auto* original = browser()->GetTabStripModel()->GetActiveWebContents();
  const auto result_count = FindBrowserItems(browser(), u"").size();
  ASSERT_GE(result_count, 16u);
  ShowFinder(browser());
  ASSERT_TRUE(base::test::RunUntil([&] { return Search() != nullptr; }));
  auto* search = Search();
  auto* widget = search->GetWidget();
  auto* scroll = views::ElementTrackerViews::GetInstance()
                     ->GetFirstMatchingViewAs<views::ScrollView>(
                         kFinderResultsElementId,
                         views::ElementTrackerViews::GetContextForWidget(widget),
                         false);
  ASSERT_TRUE(scroll);
  auto* rows = scroll->contents();
  ASSERT_TRUE(rows);
  ASSERT_EQ(result_count, rows->children().size());
  for (const auto& size : {gfx::Size(680, 420), gfx::Size(960, 640)}) {
    widget->SetBounds(gfx::Rect(gfx::Point(50, 50), size));
    views::test::RunScheduledLayout(widget);
    EXPECT_LE(widget->GetWindowBoundsInScreen().height(), size.height());
    ASSERT_GT(scroll->height(), 0);
    ASSERT_GT(rows->height(), scroll->height());
    // Search owns arrow navigation: wrapping Up reveals the last result,
    // wrapping Down reveals the first, without executing either result.
    search->RequestFocus();
    ui::KeyEvent up(ui::EventType::kKeyPressed, ui::VKEY_UP, ui::EF_NONE);
    static_cast<views::View*>(search)->OnKeyEvent(&up);
    EXPECT_TRUE(up.handled());
    views::test::RunScheduledLayout(widget);
    EXPECT_EQ(search, widget->GetFocusManager()->GetFocusedView());
    EXPECT_GT(scroll->CurrentOffset().y(), 0);
    EXPECT_EQ(rows->children().back()->height(),
              rows->children().back()->GetVisibleBounds().height());
    ui::KeyEvent down(ui::EventType::kKeyPressed, ui::VKEY_DOWN, ui::EF_NONE);
    static_cast<views::View*>(search)->OnKeyEvent(&down);
    EXPECT_TRUE(down.handled());
    views::test::RunScheduledLayout(widget);
    EXPECT_EQ(0, scroll->CurrentOffset().y());
    for (size_t index = 0; index < rows->children().size(); ++index) {
      auto* row = rows->children()[index].get();
      if (index == 0) {
        row->RequestFocus();
      } else {
        widget->GetFocusManager()->AdvanceFocus(false);
      }
      views::test::RunScheduledLayout(widget);
      EXPECT_EQ(row, widget->GetFocusManager()->GetFocusedView());
      EXPECT_GE(row->height(), 36);
      EXPECT_EQ(row->height(), row->GetVisibleBounds().height());
    }
    EXPECT_GT(scroll->CurrentOffset().y(), 0);
    EXPECT_EQ(tab_count, browser()->GetTabStripModel()->count());
    EXPECT_EQ(original, browser()->GetTabStripModel()->GetActiveWebContents());
  }
  // Replacing the list while scrolled to its tail must not strand the single
  // remaining result outside the viewport or execute a removed result.
  search->RequestFocus();
  search->InsertOrReplaceText(u"creator template");
  views::test::RunScheduledLayout(widget);
  ASSERT_EQ(1u, rows->children().size());
  EXPECT_EQ(0, scroll->CurrentOffset().y());
  EXPECT_EQ(rows->children()[0]->height(),
            rows->children()[0]->GetVisibleBounds().height());
  EXPECT_EQ(original, browser()->GetTabStripModel()->GetActiveWebContents());
}

IN_PROC_BROWSER_TEST_F(TahaiFinderBrowserTest,
                       SwitchesExistingTabAndRejectsClosedWindow) {
  BrowserWindowInterface* second = CreateBrowser(browser()->GetProfile());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      second, GURL("data:text/html,<title>FinderNeedle Work</title>")));
  auto results = FindBrowserItems(browser(), u"finderneedle WORK");
  ASSERT_EQ(1u, results.size());
  EXPECT_EQ(FinderResult::Kind::kTab, results[0].kind);
  auto* original = second->GetTabStripModel()->GetActiveWebContents();
  const auto count = second->GetTabStripModel()->count();
  EXPECT_TRUE(ActivateFinderResult(browser(), results[0]));
  EXPECT_EQ(original, second->GetTabStripModel()->GetActiveWebContents());
  EXPECT_EQ(count, second->GetTabStripModel()->count());
  CloseBrowserSynchronously(second);
  EXPECT_FALSE(ActivateFinderResult(browser(), results[0]));
  EXPECT_TRUE(FindBrowserItems(browser(), u"finderneedle").empty());
}

IN_PROC_BROWSER_TEST_F(TahaiFinderBrowserTest,
                       PrivateResultsAndSavedWorkspacesStaySeparated) {
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      browser(), GURL("data:text/html,<title>SharedNeedle regular</title>")));
  BrowserWindowInterface* private_browser =
      CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      private_browser,
      GURL("data:text/html,<title>SharedNeedle private</title>")));
  const auto regular = FindBrowserItems(browser(), u"sharedneedle");
  const auto private_results =
      FindBrowserItems(private_browser, u"sharedneedle");
  ASSERT_EQ(1u, regular.size());
  ASSERT_EQ(1u, private_results.size());
  EXPECT_EQ(browser(), regular[0].browser.get());
  EXPECT_EQ(private_browser, private_results[0].browser.get());
  EXPECT_FALSE(ActivateFinderResult(private_browser, regular[0]));
  EXPECT_FALSE(ActivateFinderResult(browser(), private_results[0]));
  const auto all_private = FindBrowserItems(private_browser, u"");
  EXPECT_FALSE(std::ranges::any_of(all_private, [](const auto& item) {
    return item.kind == FinderResult::Kind::kWorkspace ||
           item.command_id == IDC_TAHAI_SKIN_MANAGER;
  }));
}

IN_PROC_BROWSER_TEST_F(TahaiFinderBrowserTest,
                       CommandAliasesAreBoundedAndAllowlisted) {
  const auto results = FindBrowserItems(browser(), u"creator template");
  ASSERT_EQ(1u, results.size());
  EXPECT_EQ(IDC_TAHAI_SKIN_MANAGER, results[0].command_id);
  EXPECT_TRUE(FindBrowserItems(browser(), std::u16string(257, u'a')).empty());
  auto forged = results[0];
  forged.command_id = IDC_CLOSE_WINDOW;
  EXPECT_FALSE(ActivateFinderResult(browser(), forged));
}
}  // namespace
}  // namespace tahai
