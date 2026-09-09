// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_finder.h"

#include <algorithm>

#include "base/test/run_until.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/ui/accelerator_table.h"
#include "chrome/browser/ui/browser.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/tabs/tab_strip_model.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/browser/ui/views/frame/browser_view.h"
#include "chrome/test/base/in_process_browser_test.h"
#include "chrome/test/base/ui_test_utils.h"
#include "content/public/test/browser_test.h"
#include "ui/base/accelerators/accelerator.h"
#include "ui/events/event.h"
#include "ui/views/controls/textfield/textfield.h"
#include "ui/views/focus/focus_manager.h"
#include "ui/views/interaction/element_tracker_views.h"
#include "ui/views/test/widget_test.h"
#include "ui/views/widget/widget.h"
#include "url/gurl.h"

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
  auto* destination = browser()->tab_strip_model()->GetActiveWebContents();
  chrome::NewTab(browser());
  const auto count = browser()->tab_strip_model()->count();
  ASSERT_NE(destination, browser()->tab_strip_model()->GetActiveWebContents());

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

  views::test::WidgetDestroyedWaiter destroyed(search->GetWidget());
  ui::KeyEvent enter(ui::EventType::kKeyPressed, ui::VKEY_RETURN, ui::EF_NONE);
  static_cast<views::View*>(search)->OnKeyEvent(&enter);
  EXPECT_TRUE(enter.handled());
  destroyed.Wait();
  ASSERT_TRUE(base::test::RunUntil([&] {
    return browser()->tab_strip_model()->GetActiveWebContents() == destination;
  }));
  EXPECT_EQ(count, browser()->tab_strip_model()->count());
  EXPECT_FALSE(Search());
  ASSERT_TRUE(focus->ProcessAccelerator(accelerator));
  ASSERT_TRUE(base::test::RunUntil([&] { return Search() != nullptr; }));
}

IN_PROC_BROWSER_TEST_F(TahaiFinderBrowserTest,
                       SwitchesExistingTabAndRejectsClosedWindow) {
  Browser* second = CreateBrowser(browser()->GetProfile());
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      second, GURL("data:text/html,<title>FinderNeedle Work</title>")));
  auto results = FindBrowserItems(browser(), u"finderneedle WORK");
  ASSERT_EQ(1u, results.size());
  EXPECT_EQ(FinderResult::Kind::kTab, results[0].kind);
  auto* original = second->tab_strip_model()->GetActiveWebContents();
  const auto count = second->tab_strip_model()->count();
  EXPECT_TRUE(ActivateFinderResult(browser(), results[0]));
  EXPECT_EQ(original, second->tab_strip_model()->GetActiveWebContents());
  EXPECT_EQ(count, second->tab_strip_model()->count());
  CloseBrowserSynchronously(second);
  EXPECT_FALSE(ActivateFinderResult(browser(), results[0]));
  EXPECT_TRUE(FindBrowserItems(browser(), u"finderneedle").empty());
}

IN_PROC_BROWSER_TEST_F(TahaiFinderBrowserTest,
                       PrivateResultsAndSavedWorkspacesStaySeparated) {
  ASSERT_TRUE(ui_test_utils::NavigateToURL(
      browser(), GURL("data:text/html,<title>SharedNeedle regular</title>")));
  Browser* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
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
