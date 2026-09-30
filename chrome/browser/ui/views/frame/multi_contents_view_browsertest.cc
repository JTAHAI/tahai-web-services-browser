// Copyright 2025 The Chromium Authors
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "chrome/browser/ui/views/frame/multi_contents_view.h"

#include <algorithm>
#include <limits>
#include <memory>
#include <span>
#include <string>
#include <utility>
#include <vector>

#include "base/check_deref.h"
#include "base/files/file_path.h"
#include "base/json/json_reader.h"
#include "base/json/json_writer.h"
#include "base/notreached.h"
#include "base/scoped_observation.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/utf_string_conversions.h"
#include "base/test/bind.h"
#include "base/test/run_until.h"
#include "base/test/scoped_feature_list.h"
#include "base/test/test_future.h"
#include "chrome/app/chrome_command_ids.h"
#include "chrome/browser/autocomplete/chrome_autocomplete_scheme_classifier.h"
#include "chrome/browser/browser_process.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/browser/ui/browser_commands.h"
#include "chrome/browser/ui/browser_tabstrip.h"
#include "chrome/browser/ui/browser_window.h"
#include "chrome/browser/ui/browser_window/public/create_browser_window.h"
#include "chrome/browser/ui/tabs/split_tab_metrics.h"
#include "chrome/browser/ui/tabs/tab_enums.h"
#include "chrome/browser/ui/tabs/tab_group_model.h"
#include "chrome/browser/ui/tabs/tab_model.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_named_workspace_controller.h"
#include "chrome/browser/ui/tahai/tahai_operational_workflow_queue.h"
#include "chrome/browser/ui/tahai/tahai_pane_layout_transition.h"
#include "chrome/browser/ui/tahai/tahai_skin_studio_draft.h"
#include "chrome/browser/ui/tahai/tahai_surface_resize_area.h"
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
#include "ui/base/clipboard/clipboard.h"
#include "ui/base/clipboard/clipboard_buffer.h"
#include "ui/base/clipboard/scoped_clipboard_writer.h"
#include "ui/base/clipboard/test/clipboard_test_util.h"
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
#include "ui/views/controls/scroll_view.h"
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

class TahaiWebUIBrowserTest : public InProcessBrowserTest {
 protected:
  void SeedCapabilityGrantFixture() {
    base::ListValue grants;
    for (const auto* operation : {"read-explicit-selection", "navigate-approved-origin"}) {
      grants.Append(base::DictValue().Set("provider_id", "review-fixture")
          .Set("revision_sha256", std::string(64, 'a'))
          .Set("origin", "https://review.example/").Set("operation", operation));
    }
    browser()->GetProfile()->GetPrefs()->SetDict(prefs::kTahaiCapabilityGrants,
        base::DictValue().Set("schema_version", 1).Set("grants", std::move(grants)));
  }
};

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
void AddBlankTabsUntilCount(BrowserWindowInterface* browser,
                            size_t target_count) {
  TabStripModel* model = browser->GetTabStripModel();
  while (static_cast<size_t>(model->count()) < target_count) {
    chrome::AddSelectedTabWithURL(browser, GURL(url::kAboutBlankURL),
                                  ui::PAGE_TRANSITION_AUTO_TOPLEVEL);
  }
  model->ActivateTabAt(0);
}

tahai::SurfaceDesign ReferenceSurfaceDesign() {
  return {.nodes = {
      {.kind = tahai::SurfaceNodeKind::kColumns, .first = 1, .second = 2, .percent = 30},
      {.pane = 0, .role = "reference"},
      {.kind = tahai::SurfaceNodeKind::kRows, .first = 3, .second = 4, .percent = 65},
      {.pane = 1, .role = "working"}, {.pane = 2, .role = "tasks"}},
      .rail_dock = "trailing", .gap = 12, .keyboard_order = {1, 2, 0}};
}

}  // namespace

class MultiContentsViewBrowserTest
    : public SplitViewBrowserTestMixin<InProcessBrowserTest> {};

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNamedWorkspaceRestoresIntoIndependentWindow) {
  AddBlankTabsUntilCount(browser(), 6u);
  auto* model = browser()->GetTabStripModel();
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
  auto* restored_model = restored->GetTabStripModel();
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
                       TahaiCustomModePresentationTracksSavedDefinitions) {
  auto* mode_service =
      tahai::ModeServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(mode_service);
  ASSERT_TRUE(mode_service->CreateNativeCustomMode("Incident Review",
      {.fixed_mode = "operator", .rail_state = "expanded"},
      {"mission.open"}, ""));
  ASSERT_EQ(1u, mode_service->custom_modes().size());
  const std::string custom_id = mode_service->custom_modes().front().id;

  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller);
  ASSERT_TRUE(controller->SetActiveMode("operator"));
  ASSERT_TRUE(controller->SetCustomModePresentation(custom_id));
  EXPECT_EQ("operator", controller->active_mode_id());
  EXPECT_EQ("Incident Review", controller->active_mode_title());

  // Making the underlying fixed mode a profile default cannot leave a custom
  // label attached to this window when the service has no mode-change event.
  ASSERT_TRUE(controller->MakeActiveModeProfileDefault());
  EXPECT_EQ("Operator Mode", controller->active_mode_title());
  ASSERT_TRUE(controller->SetCustomModePresentation(custom_id));

  // The custom presentation is a local window choice, not a profile default.
  BrowserWindowInterface* sibling = CreateBrowser(browser()->GetProfile());
  auto* sibling_controller =
      tahai::WindowModeController::GetForBrowser(sibling);
  ASSERT_TRUE(sibling_controller);
  EXPECT_NE("Incident Review", sibling_controller->active_mode_title());

  ASSERT_TRUE(mode_service->RenameCustomMode(custom_id, "Escalation Review"));
  EXPECT_EQ("Escalation Review", controller->active_mode_title());
  ASSERT_TRUE(mode_service->RemoveCustomMode(custom_id));
  EXPECT_EQ("Unavailable mode", controller->active_mode_title());
  const auto unavailable = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(unavailable);
  EXPECT_TRUE(unavailable->actions.empty());
  EXPECT_FALSE(controller->SetCustomModePresentation(custom_id));
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiOperationalRailChoiceNeverChangesSiblingTemplate) {
  auto* first = tahai::WindowModeController::GetForBrowser(browser());
  auto* mode_service = tahai::ModeServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(first);
  ASSERT_TRUE(mode_service);
  BrowserWindowInterface* sibling = CreateBrowser(browser()->GetProfile());
  auto* second = tahai::WindowModeController::GetForBrowser(sibling);
  ASSERT_TRUE(second);
  const auto original = second->active_configuration();
  const std::string mode_id(first->active_mode_id());
  const auto original_template = mode_service->configuration_for_mode(mode_id);
  ASSERT_TRUE(first->ApplyWorkspacePresentation(
      mode_id, first->active_configuration().rail_state,
      first->active_configuration().rail_width));
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_HIDDEN));
  EXPECT_EQ("hidden", first->active_configuration().rail_state);
  EXPECT_EQ(original, second->active_configuration());
  EXPECT_EQ(original_template, mode_service->configuration_for_mode(mode_id));
  ASSERT_TRUE(first->SetOperationalRailModules({"mission", "tabs"}));
  ASSERT_TRUE(first->ApplyWorkspacePresentation(mode_id, "icons", 240));
  EXPECT_TRUE(first->operational_rail_modules().empty());
  EXPECT_EQ(original, second->active_configuration());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNativeModesAreIndependentRestorableAndRevocable) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  auto* first = tahai::WindowModeController::GetForBrowser(browser());
  BrowserWindowInterface* sibling = CreateBrowser(GetProfile());
  auto* second = tahai::WindowModeController::GetForBrowser(sibling);
  ASSERT_TRUE(service);
  ASSERT_TRUE(first);
  ASSERT_TRUE(second);
  const auto sibling_before = second->CapturePresentation();
  const int tab_count = browser()->GetTabStripModel()->count();
  ASSERT_TRUE(service->SetConfigurationValueForMode("research", "accent", "amber"));
  ASSERT_TRUE(service->CreateNativeCustomMode("Independent research",
      {.fixed_mode = "research", .rail_state = "expanded", .rail_width = 360},
      {"mission.open", "layout.quad"}, ""));
  const std::string id = service->custom_modes()[0].id;
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  EXPECT_EQ(tab_count, browser()->GetTabStripModel()->count());
  EXPECT_FALSE(chrome::IsTahaiMultiView(browser()));
  EXPECT_EQ("Independent research", first->active_mode_title());
  EXPECT_EQ(sibling_before, second->CapturePresentation());
  auto actions = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(actions);
  ASSERT_EQ(2u, actions->actions.size());
  EXPECT_TRUE(tahai::CanExecuteWindowModeAction(browser(), actions->context,
                                               IDC_TAHAI_MISSION_CONTROL));
  EXPECT_FALSE(tahai::CanExecuteWindowModeAction(sibling, actions->context,
                                                IDC_TAHAI_MISSION_CONTROL));
  EXPECT_FALSE(tahai::CanExecuteWindowModeAction(browser(), actions->context,
                                                IDC_TAHAI_LOCAL_OI));
  ASSERT_TRUE(service->SetConfigurationValueForMode("research", "accent", "teal"));
  EXPECT_EQ("amber", first->active_configuration().accent_id);
  ASSERT_TRUE(first->SetActiveConfigurationValue("accent", "violet"));
  EXPECT_EQ("teal", service->configuration_for_mode("research").accent_id);
  EXPECT_EQ("violet", first->active_configuration().accent_id);
  EXPECT_FALSE(tahai::CanExecuteWindowModeAction(browser(), actions->context,
                                                IDC_TAHAI_MISSION_CONTROL));
  actions = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(actions);
  ASSERT_TRUE(tahai::ExecuteWindowModeAction(browser(), actions->context,
                                             IDC_TAHAI_MISSION_CONTROL));
  ASSERT_TRUE(content::WaitForLoadStop(
      browser()->GetTabStripModel()->GetActiveWebContents()));
  EXPECT_EQ(
      GURL(tahai::kTahaiMissionURL),
      browser()->GetTabStripModel()->GetActiveWebContents()->GetVisibleURL());
  const auto saved = tahai::CaptureNamedWorkspace(browser(), "Independent saved workspace");
  ASSERT_TRUE(saved.workspace);
  const auto workspace_id = tahai::NamedWorkspaceStore(GetProfile()).Add(*saved.workspace);
  ASSERT_TRUE(workspace_id);
  BrowserWindowInterface* restored =
      tahai::OpenNamedWorkspace(browser(), *workspace_id);
  ASSERT_TRUE(restored);
  auto* restored_mode = tahai::WindowModeController::GetForBrowser(restored);
  ASSERT_TRUE(restored_mode);
  EXPECT_EQ(first->CapturePresentation(), restored_mode->CapturePresentation());
  EXPECT_EQ("Independent research", restored_mode->active_mode_title());
  EXPECT_FALSE(chrome::IsTahaiMultiView(restored));
  ASSERT_TRUE(service->RemoveCustomMode(id));
  EXPECT_EQ("Unavailable mode", first->active_mode_title());
  EXPECT_EQ("Unavailable mode", restored_mode->active_mode_title());
  EXPECT_EQ("violet", first->active_configuration().accent_id);
  EXPECT_FALSE(tahai::ExecuteWindowModeAction(browser(), actions->context,
                                              IDC_TAHAI_MISSION_CONTROL));
  const auto revoked = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(revoked);
  EXPECT_TRUE(revoked->actions.empty());
  EXPECT_EQ(id, first->CapturePresentation().custom_mode);
  ASSERT_TRUE(first->SetActiveMode("daily"));
  EXPECT_FALSE(tahai::ResolveOperationalWindowActions(browser()));
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNativeModeMissingSkinCannotBroadenActions) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  ASSERT_TRUE(service->CreateNativeCustomMode("Missing skin",
      {.fixed_mode = "daily", .rail_state = "icons",
       .skin = tahai::WindowSkinReference{"not-installed", std::string(64, 'a')}},
      {"mission.open"}, ""));
  const std::string id = service->custom_modes()[0].id;
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(base::test::RunUntil([&] {
    return !controller->window_skin_restore_pending();
  }));
  EXPECT_EQ("Unavailable skin", controller->active_mode_title());
  const auto actions = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(actions);
  EXPECT_TRUE(actions->actions.empty());
  EXPECT_FALSE(tahai::ExecuteWindowModeAction(browser(), actions->context,
                                              IDC_TAHAI_MISSION_CONTROL));
  EXPECT_EQ(id, controller->CapturePresentation().custom_mode);
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNativeRailUsesCurrentModeControlsAndLocalWidth) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  ASSERT_TRUE(service->CreateNativeCustomMode("Rail controls",
      {.fixed_mode = "research", .rail_state = "expanded", .rail_width = 360},
      {"mission.open", "workspaces.open"}, ""));
  const std::string id = service->custom_modes()[0].id;
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  BrowserWindowInterface* sibling = CreateBrowser(GetProfile());
  ASSERT_EQ(sibling, tahai::ActivateNativeCustomMode(sibling, id));
  auto* first = tahai::WindowModeController::GetForBrowser(browser());
  auto* second = tahai::WindowModeController::GetForBrowser(sibling);
  auto* rail = BrowserView::GetBrowserViewForBrowser(browser())->tahai_workspace_rail();
  ASSERT_TRUE(rail);
  EXPECT_EQ(u"Open Mission Control", rail->module_button_for_testing(0)->GetText());
  EXPECT_EQ(u"Open saved workspace", rail->module_button_for_testing(1)->GetText());
  EXPECT_FALSE(rail->module_button_for_testing(2)->GetVisible());
  ASSERT_TRUE(first->SetActiveConfigurationValue("rail_width", "410"));
  EXPECT_EQ(410, first->active_configuration().rail_width);
  EXPECT_EQ(360, second->active_configuration().rail_width);
  EXPECT_EQ(360, service->custom_modes()[0].native_presentation->rail_width);
  ASSERT_TRUE(first->SetActiveConfigurationValue("accent", "amber"));
  EXPECT_EQ(410, first->active_configuration().rail_width);
  EXPECT_EQ(360, second->active_configuration().rail_width);
  EXPECT_EQ("amber", second->active_configuration().accent_id);
  const auto old_actions = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(old_actions);
  ASSERT_TRUE(service->UpdateNativeCustomMode(id, "Rail controls", {"support.open"}, ""));
  EXPECT_EQ(u"Open support", rail->module_button_for_testing(0)->GetText());
  EXPECT_FALSE(rail->module_button_for_testing(1)->GetVisible());
  EXPECT_FALSE(tahai::ExecuteWindowModeAction(browser(), old_actions->context,
                                              IDC_TAHAI_MISSION_CONTROL));
  ASSERT_TRUE(service->UpdateNativeCustomMode(id, "Rail controls", {"mission.open"}, ""));
  rail->SelectModule(0);
  rail->OpenSelectedModule();
  ASSERT_TRUE(content::WaitForLoadStop(browser()->tab_strip_model()->GetActiveWebContents()));
  EXPECT_EQ(GURL(tahai::kTahaiMissionURL),
            browser()->tab_strip_model()->GetActiveWebContents()->GetVisibleURL());
  ASSERT_TRUE(service->RemoveCustomMode(id));
  EXPECT_FALSE(rail->module_button_for_testing(0)->GetVisible());
  const int count = browser()->GetTabStripModel()->count();
  rail->SelectModule(1);
  rail->OpenSelectedModule();
  EXPECT_EQ(count, browser()->GetTabStripModel()->count());
  EXPECT_TRUE(rail->selected_module_id().empty());
  // Recovery presentation stays usable after deletion without granting an action.
  rail->HideRail();
  EXPECT_TRUE(rail->is_hidden());
  EXPECT_FALSE(BrowserView::GetBrowserViewForBrowser(sibling)->tahai_workspace_rail()->is_hidden());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNativeRailExposesEveryControlAndScrollsKeyboardFocus) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  std::vector<std::string> actions;
  for (const auto& action : tahai::GetNativeModeActionCatalog()) {
    actions.emplace_back(action.id);
  }
  ASSERT_EQ(tahai::kMaximumNativeModeActions, actions.size());
  ASSERT_TRUE(service->CreateNativeCustomMode("All native controls",
      {.fixed_mode = "research", .rail_state = "expanded", .rail_width = 280},
      actions, ""));
  const std::string id = service->custom_modes()[0].id;
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  auto* view = BrowserView::GetBrowserViewForBrowser(browser());
  auto* rail = view->tahai_workspace_rail();
  ASSERT_TRUE(rail);
  ASSERT_TRUE(ui_test_utils::BringBrowserWindowToFront(browser()));
  auto* scroll = rail->scroll_view_for_testing();
  ASSERT_TRUE(scroll);
  const int count = browser()->tab_strip_model()->count();
  const auto url =
      browser()->GetTabStripModel()->GetActiveWebContents()->GetVisibleURL();
  for (const auto& size : {gfx::Size(960, 640), gfx::Size(1280, 800)}) {
    browser()->GetWindow()->SetBounds(gfx::Rect(gfx::Point(), size));
    for (int state : {IDC_TAHAI_RAIL_EXPANDED, IDC_TAHAI_RAIL_ICONS}) {
      ASSERT_TRUE(chrome::ExecuteCommand(browser(), state));
      RunScheduledLayouts();
      ASSERT_GT(scroll->height(), 0);
      ASSERT_GT(scroll->contents()->height(), scroll->height());
      const bool collapsed = state == IDC_TAHAI_RAIL_ICONS;
      EXPECT_EQ(collapsed ? views::ScrollView::ScrollBarMode::kHiddenButEnabled
                           : views::ScrollView::ScrollBarMode::kEnabled,
                scroll->GetVerticalScrollBarMode());
      size_t focused_controls = 0;
      for (size_t index = 0; index < actions.size(); ++index) {
        SCOPED_TRACE(actions[index]);
        auto* button = rail->module_button_for_testing(index);
        ASSERT_TRUE(button);
        ASSERT_TRUE(button->GetVisible());
        EXPECT_GE(button->width(), 36);
        EXPECT_GE(button->height(), 36);
        if (collapsed) {
          EXPECT_TRUE(button->GetText().empty());
        } else {
          EXPECT_EQ(tahai::GetNativeModeActionCatalog()[index].label, button->GetText());
        }
        // Disabled actions (for example Exit multi-view without a split) stay
        // visible, but native Tab traversal must not focus or execute them.
        EXPECT_EQ(chrome::IsCommandEnabled(
                      browser(),
                      tahai::GetNativeModeActionCatalog()[index].command_id),
                  button->GetEnabled());
        if (!button->GetEnabled()) {
          EXPECT_FALSE(button->IsFocusable());
          continue;
        }
        // Tab traversal must include controls outside the original viewport.
        if (focused_controls++ == 0) {
          button->RequestFocus();
        } else {
          view->GetFocusManager()->AdvanceFocus(false);
        }
        RunScheduledLayouts();
        EXPECT_EQ(button, view->GetFocusManager()->GetFocusedView());
        EXPECT_EQ(button->height(), button->GetVisibleBounds().height());
        EXPECT_GE(button->GetVisibleBounds().width(), 36);
      }
      EXPECT_GE(focused_controls, actions.size() - 2u);
      EXPECT_EQ(rail->module_button_for_testing(actions.size() - 1),
                view->GetFocusManager()->GetFocusedView());
      EXPECT_GT(scroll->CurrentOffset().y(), 0);
      EXPECT_FALSE(rail->collapse_button_for_testing()->GetVisibleBounds().IsEmpty());
      EXPECT_EQ(count, browser()->GetTabStripModel()->count());
      EXPECT_EQ(url, browser()
                         ->GetTabStripModel()
                         ->GetActiveWebContents()
                         ->GetVisibleURL());
    }
  }
  EXPECT_EQ(nullptr, rail->module_button_for_testing(actions.size()));
  // Removing the focused tail cannot leave focus in a hidden stale slot.
  ASSERT_TRUE(service->UpdateNativeCustomMode(id, "One control", {"mission.open"}, ""));
  EXPECT_EQ(rail->collapse_button_for_testing(), view->GetFocusManager()->GetFocusedView());
  EXPECT_FALSE(rail->module_button_for_testing(actions.size() - 1)->GetVisible());
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_TAHAI_RAIL_HIDDEN));
  EXPECT_FALSE(rail->Contains(view->GetFocusManager()->GetFocusedView()));
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiRailPressCannotRunAReboundControl) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  ASSERT_TRUE(service->CreateNativeCustomMode("Press binding",
      {.fixed_mode = "research", .rail_state = "expanded"}, {"mission.open"}, ""));
  const std::string id = service->custom_modes()[0].id;
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  auto* rail = BrowserView::GetBrowserViewForBrowser(browser())->tahai_workspace_rail();
  RunScheduledLayouts();
  auto* button = rail->module_button_for_testing(0);
  ASSERT_TRUE(button);
  const auto url = browser()->tab_strip_model()->GetActiveWebContents()->GetVisibleURL();
  const gfx::Point point = button->GetLocalBounds().CenterPoint();
  const ui::MouseEvent press(ui::EventType::kMousePressed, point, point,
      base::TimeTicks::Now(), ui::EF_LEFT_MOUSE_BUTTON, ui::EF_LEFT_MOUSE_BUTTON);
  ASSERT_TRUE(button->OnMousePressed(press));
  ASSERT_TRUE(service->UpdateNativeCustomMode(id, "Replacement", {"support.open"}, ""));
  const ui::MouseEvent release(ui::EventType::kMouseReleased, point, point,
      base::TimeTicks::Now(), ui::EF_LEFT_MOUSE_BUTTON, ui::EF_LEFT_MOUSE_BUTTON);
  // Direct notification exercises the binding guard even if normal native
  // button state would cancel release when its focus/presentation changes.
  views::test::ButtonTestApi(button).NotifyClick(release);
  EXPECT_EQ(
      url,
      browser()->GetTabStripModel()->GetActiveWebContents()->GetVisibleURL());
  const ui::KeyEvent key(ui::EventType::kKeyPressed, ui::VKEY_SPACE, ui::EF_NONE);
  button->OnKeyPressed(key);
  ASSERT_TRUE(service->UpdateNativeCustomMode(id, "Second replacement", {"mission.open"}, ""));
  const ui::KeyEvent key_up(ui::EventType::kKeyReleased, ui::VKEY_SPACE, ui::EF_NONE);
  views::test::ButtonTestApi(button).NotifyClick(key_up);
  EXPECT_EQ(url, browser()->tab_strip_model()->GetActiveWebContents()->GetVisibleURL());
  // A new deliberate activation can still run the now-visible control.
  views::test::ButtonTestApi(button).NotifyDefaultMouseClick();
  ASSERT_TRUE(content::WaitForLoadStop(browser()->tab_strip_model()->GetActiveWebContents()));
  EXPECT_EQ(GURL(tahai::kTahaiMissionURL),
            browser()->tab_strip_model()->GetActiveWebContents()->GetVisibleURL());
  const ui::KeyEvent enter(ui::EventType::kKeyPressed, ui::VKEY_RETURN, ui::EF_NONE);
  ASSERT_TRUE(button->OnKeyPressed(enter));
  ASSERT_TRUE(content::WaitForLoadStop(browser()->tab_strip_model()->GetActiveWebContents()));
  ASSERT_TRUE(service->UpdateNativeCustomMode(id, "Held-key replacement", {"support.open"}, ""));
  const ui::KeyEvent repeat(ui::EventType::kKeyPressed, ui::VKEY_RETURN, ui::EF_IS_REPEAT);
  ASSERT_TRUE(button->OnKeyPressed(repeat));
  EXPECT_EQ(GURL(tahai::kTahaiMissionURL),
            browser()->tab_strip_model()->GetActiveWebContents()->GetVisibleURL());
  const ui::KeyEvent enter_up(ui::EventType::kKeyReleased, ui::VKEY_RETURN, ui::EF_NONE);
  button->OnKeyReleased(enter_up);
  ASSERT_TRUE(button->OnKeyPressed(enter));
  ASSERT_TRUE(content::WaitForLoadStop(browser()->tab_strip_model()->GetActiveWebContents()));
  EXPECT_EQ(GURL(tahai::kTahaiSupportURL),
            browser()->tab_strip_model()->GetActiveWebContents()->GetVisibleURL());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNamedWorkspaceDoesNotCrossPrivateProfiles) {
  AddBlankTabsUntilCount(browser(), 2u);
  auto snapshot = tahai::CaptureNamedWorkspace(browser(), "Regular only");
  ASSERT_TRUE(snapshot.workspace);
  auto id =
      tahai::NamedWorkspaceStore(browser()->GetProfile()).Add(*snapshot.workspace);
  ASSERT_TRUE(id);
  BrowserWindowInterface* private_browser =
      CreateIncognitoBrowser(browser()->GetProfile());
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
  EXPECT_EQ(2, browser()->GetTabStripModel()->count());
  EXPECT_EQ(1, private_browser->GetTabStripModel()->count());
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
  BrowserWindowInterface* private_browser =
      CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(private_browser);
  for (auto* contents :
       {model->GetActiveWebContents(),
        private_browser->GetTabStripModel()->GetActiveWebContents()}) {
    auto create = base::BindLambdaForTesting(
        [contents](int, std::optional<tab_groups::TabGroupId>, bool) {
          return contents;
        });
    EXPECT_FALSE(tahai::ApplyNativePaneLayout(
        browser(), 3, split_tabs::SplitTabLayout::kStacked, create));
    EXPECT_EQ(2, model->count());
    EXPECT_EQ(1, private_browser->GetTabStripModel()->count());
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
                       TahaiRailCaptureLossAndStaleGesturesKeepCommittedWidth) {
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1280, 900));
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  auto* rail = BrowserView::GetBrowserViewForBrowser(browser())->tahai_workspace_rail();
  auto* handle = rail->resize_area_for_testing();
  ASSERT_TRUE(handle);
  const ui::MouseEvent press(
      ui::EventType::kMousePressed, gfx::PointF(2, 2), gfx::PointF(2, 2),
      base::TimeTicks(), ui::EF_LEFT_MOUSE_BUTTON, ui::EF_LEFT_MOUSE_BUTTON);
  for (const bool trailing : {false, true}) {
    SCOPED_TRACE(trailing);
    ASSERT_TRUE(controller->ApplyWorkspacePresentation("daily", "expanded", 280));
    tahai::SurfaceDesign design{
        .nodes = {{.pane = 0, .role = "working"}},
        .rail_dock = trailing ? "trailing" : "leading", .keyboard_order = {0}};
    ASSERT_TRUE(controller->SetSurfaceDesign(design));
    RunScheduledLayouts();
    const gfx::PointF point(trailing ? -38 : 42, 2);
    const ui::MouseEvent drag(ui::EventType::kMouseDragged, point, point,
                              base::TimeTicks(), ui::EF_LEFT_MOUSE_BUTTON, 0);
    ASSERT_TRUE(handle->OnMousePressed(press));
    ASSERT_TRUE(handle->OnMouseDragged(drag));
    EXPECT_EQ(320, rail->GetPreferredSize().width());
    RunScheduledLayouts();
    handle->OnMouseCaptureLost();
    EXPECT_EQ(320, controller->active_configuration().rail_width);
    EXPECT_EQ(320, rail->GetPreferredSize().width());
    handle->OnMouseCaptureLost();
    EXPECT_EQ(320, controller->active_configuration().rail_width);

    ASSERT_TRUE(handle->OnMousePressed(press));
    ASSERT_TRUE(handle->OnMouseDragged(drag));
    ASSERT_TRUE(controller->ApplyWorkspacePresentation("research", "expanded", 360));
    RunScheduledLayouts();
    EXPECT_FALSE(handle->OnMouseDragged(drag));
    handle->OnMouseCaptureLost();
    EXPECT_EQ(360, controller->active_configuration().rail_width);
    EXPECT_EQ(360, rail->GetPreferredSize().width());

    ASSERT_TRUE(handle->OnMousePressed(press));
    design.rail_dock = trailing ? "leading" : "trailing";
    ASSERT_TRUE(controller->SetSurfaceDesign(design));
    RunScheduledLayouts();
    EXPECT_FALSE(handle->OnMouseDragged(drag));
    handle->OnMouseCaptureLost();
    EXPECT_EQ(360, controller->active_configuration().rail_width);
  }
  ASSERT_TRUE(controller->ApplyWorkspacePresentation("daily", "expanded", 280));
  RunScheduledLayouts();
  ASSERT_TRUE(handle->OnMousePressed(press));
  const ui::MouseEvent drag(ui::EventType::kMouseDragged, gfx::PointF(42, 2),
                            gfx::PointF(42, 2), base::TimeTicks(),
                            ui::EF_LEFT_MOUSE_BUTTON, 0);
  ASSERT_TRUE(handle->OnMouseDragged(drag));
  browser()->GetWindow()->SetBounds(gfx::Rect(100, 50, 1180, 850));
  RunScheduledLayouts();
  handle->OnMouseCaptureLost();
  EXPECT_EQ(280, controller->active_configuration().rail_width);
  EXPECT_EQ(280, rail->GetPreferredSize().width());

  ASSERT_TRUE(handle->OnMousePressed(press));
  ASSERT_TRUE(handle->OnMouseDragged(drag));
  ASSERT_TRUE(controller->SetActiveConfigurationValue("rail_state", "hidden"));
  ASSERT_TRUE(controller->SetActiveConfigurationValue("rail_state", "expanded"));
  RunScheduledLayouts();
  EXPECT_FALSE(handle->OnMouseDragged(drag));
  handle->OnMouseCaptureLost();
  EXPECT_EQ(280, controller->active_configuration().rail_width);
  // A new gesture after invalidation still works normally.
  ASSERT_TRUE(handle->OnMousePressed(press));
  ASSERT_TRUE(handle->OnMouseDragged(drag));
  handle->OnMouseCaptureLost();
  EXPECT_EQ(320, controller->active_configuration().rail_width);
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiAuthoredSurfaceResizesDocksAndPreservesNativeTabs) {
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1480, 900));
  AddBlankTabsUntilCount(browser(), 3u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  auto* model = browser()->tab_strip_model();
  const auto split = *model->GetActiveTab()->GetSplit();
  const auto members = model->GetSplitData(split)->ListTabs();
  auto* active = model->GetActiveWebContents();
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller->ApplyWorkspacePresentation("research", "expanded", 280));
  auto design = ReferenceSurfaceDesign();
  ASSERT_TRUE(controller->SetSurfaceDesign(design));
  RunScheduledLayouts();
  auto* view = multi_contents_view();
  ASSERT_TRUE(view->HasTahaiSurfaceDesign());
  EXPECT_FALSE(view->surface_is_compact_for_testing());
  const auto& panes = view->contents_container_views();
  EXPECT_EQ(panes[0]->y(), panes[1]->y());
  EXPECT_EQ(panes[0]->bounds().bottom(), panes[2]->bounds().bottom());
  EXPECT_EQ(panes[1]->x(), panes[2]->x());
  EXPECT_EQ(panes[1]->width(), panes[2]->width());
  for (size_t i = 0; i < 3u; ++i) {
    EXPECT_TRUE(panes[i]->GetVisible());
    for (size_t j = i + 1; j < 3u; ++j) {
      EXPECT_FALSE(panes[i]->bounds().Intersects(panes[j]->bounds()));
    }
    for (size_t slot = 0; slot < 2u; ++slot) {
      EXPECT_FALSE(panes[i]->bounds().Intersects(
          view->surface_divider_for_testing(slot)->bounds()));
    }
  }
  auto* rail = BrowserView::GetBrowserViewForBrowser(browser())->tahai_workspace_rail();
  ASSERT_TRUE(rail->GetVisible());
  EXPECT_LE(view->GetBoundsInScreen().right(), rail->GetBoundsInScreen().x());
  rail->OnResize(-25, true);
  RunScheduledLayouts();
  EXPECT_EQ(305, controller->active_configuration().rail_width);
  ASSERT_TRUE(view->BeginTahaiSurfaceResize(0));
  view->ResizeTahaiSurface(0, 50, false);
  RunScheduledLayouts();
  const int adjusted = controller->surface_design()->nodes[0].percent;
  EXPECT_GT(adjusted, 30);
  view->ResizeTahaiSurface(0, 50, true);
  RunScheduledLayouts();
  EXPECT_EQ(adjusted, controller->surface_design()->nodes[0].percent);
  EXPECT_EQ(members, model->GetSplitData(split)->ListTabs());
  EXPECT_EQ(active, model->GetActiveWebContents());
  auto json = controller->SerializePresentation();
  ASSERT_TRUE(json);
  auto restored = tahai::ParseWindowPresentation(*json);
  ASSERT_TRUE(restored);
  EXPECT_EQ(controller->surface_design(), restored->surface_design);
  ASSERT_TRUE(controller->SetSurfaceDesign(std::nullopt));
  RunScheduledLayouts();
  EXPECT_LE(rail->GetBoundsInScreen().right(), view->GetBoundsInScreen().x());
  EXPECT_EQ(members, model->GetSplitData(split)->ListTabs());
  EXPECT_TRUE(view->tahai_grid_resize_area_for_testing(
      split_tabs::TahaiGridAxis::kRows)->GetVisible());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiAuthoredSurfaceKeyboardAndCompactFocusRecovery) {
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1280, 900));
  AddBlankTabsUntilCount(browser(), 3u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  auto* model = browser()->tab_strip_model();
  const auto split = *model->GetActiveTab()->GetSplit();
  const auto members = model->GetSplitData(split)->ListTabs();
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller->ApplyWorkspacePresentation("research", "hidden", 280));
  auto design = ReferenceSurfaceDesign();
  design.narrow_width = 1000;
  ASSERT_TRUE(controller->SetSurfaceDesign(design));
  RunScheduledLayouts();
  auto* view = multi_contents_view();
  const auto& panes = view->contents_container_views();
  EXPECT_LT(view->GetIndexOf(panes[1]), view->GetIndexOf(panes[2]));
  EXPECT_LT(view->GetIndexOf(panes[2]), view->GetIndexOf(panes[0]));
  panes[1]->contents_view()->RequestFocus();
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_FOCUS_NEXT_PANE));
  EXPECT_TRUE(panes[2]->contents_view()->HasFocus());
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_FOCUS_NEXT_PANE));
  EXPECT_TRUE(panes[0]->contents_view()->HasFocus());
  ASSERT_TRUE(chrome::ExecuteCommand(browser(), IDC_FOCUS_NEXT_PANE));
  auto* divider = view->surface_divider_for_testing(0);
  EXPECT_TRUE(divider->GetAccessibleResizeHandle()->HasFocus());
  ASSERT_TRUE(divider->OnKeyPressed(
      ui::KeyEvent(ui::EventType::kKeyPressed, ui::VKEY_RIGHT, ui::EF_NONE)));
  RunScheduledLayouts();
  EXPECT_GT(controller->surface_design()->nodes[0].percent, 30);
  ASSERT_TRUE(divider->OnKeyPressed(
      ui::KeyEvent(ui::EventType::kKeyPressed, ui::VKEY_HOME, ui::EF_NONE)));
  RunScheduledLayouts();
  EXPECT_EQ(50, controller->surface_design()->nodes[0].percent);
  EXPECT_FALSE(divider->OnKeyPressed(
      ui::KeyEvent(ui::EventType::kKeyPressed, ui::VKEY_LEFT, ui::EF_CONTROL_DOWN)));
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 900, 900));
  RunScheduledLayouts();
  ASSERT_TRUE(view->surface_is_compact_for_testing());
  EXPECT_EQ(1u, view->GetVisibleContentsCount());
  EXPECT_TRUE(view->GetActiveContentsView()->HasFocus());
  EXPECT_FALSE(divider->GetVisible());
  model->ActivateTabAt(1);
  RunScheduledLayouts();
  EXPECT_EQ(model->GetActiveWebContents(), view->GetActiveContentsView()->web_contents());
  EXPECT_TRUE(view->GetActiveContentsContainerView()->GetVisible());
  EXPECT_EQ(1u, view->GetVisibleContentsCount());
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1280, 900));
  RunScheduledLayouts();
  EXPECT_FALSE(view->surface_is_compact_for_testing());
  EXPECT_EQ(3u, view->GetVisibleContentsCount());
  EXPECT_EQ(members, model->GetSplitData(split)->ListTabs());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiAuthoredResizeCannotOutliveTabModeOrWindowGeometry) {
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1280, 900));
  AddBlankTabsUntilCount(browser(), 4u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller->ApplyWorkspacePresentation("research", "hidden", 280));
  ASSERT_TRUE(controller->SetSurfaceDesign(ReferenceSurfaceDesign()));
  RunScheduledLayouts();
  auto* view = multi_contents_view();
  ASSERT_TRUE(view->BeginTahaiSurfaceResize(0));
  browser()->GetTabStripModel()->ActivateTabAt(3);
  RunScheduledLayouts();
  view->ResizeTahaiSurface(0, 100, true);
  EXPECT_EQ(30, controller->surface_design()->nodes[0].percent);
  EXPECT_FALSE(view->HasTahaiSurfaceDesign());
  browser()->GetTabStripModel()->ActivateTabAt(0);
  RunScheduledLayouts();
  ASSERT_TRUE(view->BeginTahaiSurfaceResize(0));
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1180, 900));
  RunScheduledLayouts();
  view->ResizeTahaiSurface(0, 100, true);
  EXPECT_EQ(30, controller->surface_design()->nodes[0].percent);
  ASSERT_TRUE(view->BeginTahaiSurfaceResize(0));
  ASSERT_TRUE(controller->SetActiveMode("daily"));
  RunScheduledLayouts();
  view->ResizeTahaiSurface(0, 100, true);
  EXPECT_FALSE(controller->surface_design());
  EXPECT_FALSE(view->HasTahaiSurfaceDesign());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiSurfacePreviewRequiresCommitAndRejectsStaleTrials) {
  AddBlankTabsUntilCount(browser(), 4u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  const auto baseline = ReferenceSurfaceDesign();
  ASSERT_TRUE(controller->SetSurfaceDesign(baseline));
  auto trial = baseline;
  trial.nodes[0].percent = 60;
  auto first = controller->BeginSurfacePreview(trial);
  ASSERT_TRUE(first);
  EXPECT_EQ(trial, controller->surface_design());
  EXPECT_EQ(baseline, controller->CapturePresentation().surface_design);
  trial.nodes[0].percent = 80;
  auto second = controller->BeginSurfacePreview(trial);
  ASSERT_TRUE(second);
  EXPECT_NE(first, second);
  EXPECT_FALSE(controller->CancelSurfacePreview(*first));
  EXPECT_FALSE(controller->CommitSurfacePreview(*first));
  EXPECT_EQ(baseline, controller->CapturePresentation().surface_design);
  EXPECT_TRUE(controller->CancelSurfacePreview(*second));
  EXPECT_EQ(baseline, controller->surface_design());
  auto kept = controller->BeginSurfacePreview(trial);
  ASSERT_TRUE(kept);
  EXPECT_TRUE(controller->CommitSurfacePreview(*kept));
  EXPECT_EQ(trial, controller->CapturePresentation().surface_design);
  auto stale = controller->BeginSurfacePreview(baseline);
  ASSERT_TRUE(stale);
  browser()->tab_strip_model()->ActivateTabAt(3);
  RunScheduledLayouts();
  EXPECT_FALSE(controller->CommitSurfacePreview(*stale));
  EXPECT_EQ(trial, controller->surface_design());
  browser()->tab_strip_model()->ActivateTabAt(0);
  RunScheduledLayouts();
  auto superseded = controller->BeginSurfacePreview(baseline);
  ASSERT_TRUE(superseded);
  ASSERT_TRUE(controller->SetActiveMode("daily"));
  EXPECT_FALSE(controller->CancelSurfacePreview(*superseded));
  EXPECT_FALSE(controller->surface_design());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiSurfaceStudioEditsPreviewsAndRevertsOnNavigation) {
  browser()->GetWindow()->SetBounds(gfx::Rect(0, 0, 1280, 900));
  AddBlankTabsUntilCount(browser(), 3u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(
      browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  auto* contents = browser()->GetTabStripModel()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
                                           "TAHAI Skin Studio", "Surface canvas"));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    document.getElementById('surface-template').value = 'tri';
    document.getElementById('surface-template-use').click();
    document.getElementById('surface-dock').value = 'trailing';
    document.getElementById('surface-dock').dispatchEvent(new Event('change'));
    document.getElementById('surface-node-0-percent').value = '35';
    document.getElementById('surface-node-0-percent').dispatchEvent(new Event('change'));
    document.getElementById('surface-try').click();
  )JS"));
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(base::test::RunUntil([&] { return controller->surface_design().has_value(); }));
  EXPECT_FALSE(controller->CapturePresentation().surface_design);
  EXPECT_EQ(35, controller->surface_design()->nodes[0].percent);
  EXPECT_EQ("trailing", controller->surface_design()->rail_dock);
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(url::kAboutBlankURL)));
  EXPECT_FALSE(controller->surface_design());
  // A different trusted TAHAI route cannot invoke Studio's geometry bridge.
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
                                           "TAHAI Mission Control", "Mission"));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    chrome.send('previewTahaiSurface', [{version: 1, nodes: [{kind:'pane', pane:0, role:'working'}],
      rail_dock:'trailing', gap:8, narrow_width:640, short_height:360, keyboard_order:[0]}]);
  )JS"));
  EXPECT_FALSE(controller->surface_design());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
                                           "TAHAI Skin Studio", "Surface canvas"));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    document.getElementById('surface-template').value = 'tri';
    document.getElementById('surface-template-use').click();
    document.getElementById('surface-try').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] { return controller->surface_design().has_value(); }));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "!document.getElementById('surface-keep').disabled").ExtractBool(); }));
  ASSERT_TRUE(content::ExecJs(contents, "document.getElementById('surface-keep').click();"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return controller->CapturePresentation().surface_design.has_value();
  }));
  const auto kept = controller->surface_design();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(url::kAboutBlankURL)));
  EXPECT_EQ(kept, controller->surface_design());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiSurfaceStudioRejectsStaleEditsAndTrialRequests) {
  AddBlankTabsUntilCount(browser(), 3u);
  ASSERT_TRUE(chrome::OpenTahaiTriView(browser(), chrome::TahaiTriViewLayout::kTwoOverOne));
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(controller);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Surface canvas"));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const get=id=>document.getElementById('surface-'+id),source=document.getElementById('skin-studio-source');
      get('template').value='tri';get('template-use').click();
      const stale=get('node-0-percent');get('template').value='one';get('template-use').click();
      const before=source.value;stale.value='17';stale.dispatchEvent(new Event('change'));
      if(source.value!==before)return false;
      get('template').value='tri';get('template-use').click();
      window.surfaceRequestFixture=JSON.parse(source.value).operational.surfaces[0].design;
      window.surfaceRequestReplies=[];
      const original=window.tahaiSurfacePreviewResult;
      window.tahaiSurfacePreviewResult=(result,id)=>{window.surfaceRequestReplies.push({result,id});original(result,id)};
      return true;
    })()
  )JS").ExtractBool());
  auto send_and_wait = [&](const std::string& script, int count, int id,
                           std::string_view result) {
    EXPECT_TRUE(content::ExecJs(contents, script));
    EXPECT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
        content::JsReplace("window.surfaceRequestReplies.length === $1", count)).ExtractBool(); }));
    EXPECT_EQ(id, content::EvalJs(contents, "window.surfaceRequestReplies.at(-1).id"));
    EXPECT_EQ(result, content::EvalJs(contents, "window.surfaceRequestReplies.at(-1).result"));
  };
  send_and_wait("surfaceRequestFixture.nodes[0].percent=35;chrome.send('previewTahaiSurface',[surfaceRequestFixture,71]);", 1, 71, "previewing");
  ASSERT_TRUE(controller->surface_design());
  EXPECT_EQ(35, controller->surface_design()->nodes[0].percent);
  send_and_wait("surfaceRequestFixture.nodes[0].percent=65;chrome.send('previewTahaiSurface',[surfaceRequestFixture,72]);", 2, 72, "previewing");
  send_and_wait("chrome.send('keepTahaiSurface',[71]);", 3, 71, "expired");
  send_and_wait("chrome.send('revertTahaiSurface',[71]);", 4, 71, "expired");
  send_and_wait("chrome.send('keepTahaiSurface',[]);", 5, 0, "expired");
  send_and_wait("surfaceRequestFixture.nodes[0].percent=45;chrome.send('previewTahaiSurface',[surfaceRequestFixture,71]);", 6, 71, "rejected");
  send_and_wait("chrome.send('resetTahaiSurface',[71]);", 7, 71, "rejected");
  ASSERT_TRUE(controller->surface_design());
  EXPECT_EQ(65, controller->surface_design()->nodes[0].percent);
  EXPECT_FALSE(controller->CapturePresentation().surface_design);
  send_and_wait("chrome.send('keepTahaiSurface',[72]);", 8, 72, "kept");
  ASSERT_TRUE(controller->CapturePresentation().surface_design);
  EXPECT_EQ(65, controller->CapturePresentation().surface_design->nodes[0].percent);
  send_and_wait("chrome.send('keepTahaiSurface',[72]);", 9, 72, "expired");
  EXPECT_EQ(65, controller->CapturePresentation().surface_design->nodes[0].percent);
  // A fresh Studio document starts its request counter at one, even when a
  // browser-side WebUI handler is reused. It still cannot replace the kept
  // layout without another explicit Keep.
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Surface canvas"));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    document.getElementById('surface-template').value='tri';
    document.getElementById('surface-template-use').click();
    document.getElementById('surface-try').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "!document.getElementById('surface-keep').disabled").ExtractBool(); }));
  ASSERT_TRUE(controller->surface_design());
  EXPECT_EQ(50, controller->surface_design()->nodes[0].percent);
  EXPECT_EQ(65, controller->CapturePresentation().surface_design->nodes[0].percent);
  ASSERT_TRUE(content::ExecJs(contents, "document.getElementById('surface-revert').click();"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return controller->surface_design() && controller->surface_design()->nodes[0].percent == 65;
  }));
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       TahaiNativeSurfacePresetUpdatesPreserveWindowLocalResizing) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  auto design = ReferenceSurfaceDesign();
  ASSERT_TRUE(service->CreateNativeCustomMode("Independent layout",
      {.fixed_mode = "research", .rail_state = "expanded", .surface_design = design},
      {"mission.open"}, ""));
  const std::string id = service->custom_modes()[0].id;
  BrowserWindowInterface* sibling = CreateBrowser(GetProfile());
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  ASSERT_EQ(sibling, tahai::ActivateNativeCustomMode(sibling, id));
  auto* first = tahai::WindowModeController::GetForBrowser(browser());
  auto* second = tahai::WindowModeController::GetForBrowser(sibling);
  EXPECT_EQ(design, first->surface_design());
  EXPECT_EQ(design, second->surface_design());
  // Restoring a layout never creates tabs to match its declared pane count.
  EXPECT_EQ(1, browser()->GetTabStripModel()->count());
  EXPECT_EQ(1, sibling->GetTabStripModel()->count());
  ASSERT_TRUE(first->SetSurfaceDividerPercent(0, 40));
  ASSERT_TRUE(service->SetNativeCustomModeConfiguration(id, "accent", "amber"));
  EXPECT_EQ(40, first->surface_design()->nodes[0].percent);
  EXPECT_EQ(30, second->surface_design()->nodes[0].percent);
  EXPECT_EQ(30, service->custom_modes()[0].native_presentation->surface_design->nodes[0].percent);
  design.nodes[0].percent = 55;
  ASSERT_TRUE(service->SetNativeCustomModeSurface(id, design));
  EXPECT_EQ(design, first->surface_design());
  EXPECT_EQ(design, second->surface_design());
  ASSERT_TRUE(service->SetNativeCustomModeSurface(id, std::nullopt));
  EXPECT_FALSE(first->surface_design());
  EXPECT_FALSE(second->surface_design());
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
  TabStripModel* model = browser()->GetTabStripModel();
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
  BrowserWindowInterface* incognito =
      CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(incognito);
  AddBlankTabsUntilCount(incognito, 4u);
  ASSERT_TRUE(chrome::OpenTahaiQuadView(incognito));
  TabStripModel* model = incognito->GetTabStripModel();
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
  EXPECT_FALSE(browser()->GetTabStripModel()->GetActiveTab()->IsSplit());
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
  BrowserWindowInterface* incognito =
      CreateIncognitoBrowser(browser()->GetProfile());
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
                       TahaiStockLaunchpadUsesRoyalDefaultAppearance) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiNewTabURL, "TAHAI New Tab",
      "THE Operational Browser."));
  EXPECT_TRUE(content::EvalJs(
                  contents,
                  "document.body.classList.contains('mode-daily') && "
                  "!document.body.classList.contains('theme-light') && "
                  "getComputedStyle(document.body).backgroundColor === "
                  "'rgb(7, 5, 14)' && "
                  "getComputedStyle(document.querySelector('.button.primary'))"
                  ".color === 'rgb(27, 9, 46)'")
                  .ExtractBool());
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
                           "document.querySelector('.brand .mark').complete")
        .ExtractBool();
  }));
  EXPECT_EQ(512, content::EvalJs(contents,
                                 "document.querySelector('.brand .mark')"
                                 ".naturalWidth")
                     .ExtractInt());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioPrivateSurfaceNeverReadsRegularDraft) {
  auto* profile = browser()->GetProfile();
  auto source = base::JSONReader::ReadDict(tahai::GetTahaiSkinStudioDefaultDraft(), base::JSON_PARSE_RFC);
  ASSERT_TRUE(source);
  source->Set("name", "Regular-only draft privacy sentinel");
  const auto json = base::WriteJson(*source);
  ASSERT_TRUE(json);
  ASSERT_EQ(tahai::TahaiSkinStudioDraftStatus::kOk,
            tahai::SaveTahaiSkinStudioDraft(profile->GetPrefs(), *json).status);
  const auto before = profile->GetPrefs()->GetDict(prefs::kTahaiSkinStudioDraft).Clone();
  auto* regular = browser()->GetTabStripModel()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(regular, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(regular,
      "document.querySelector('#skin-studio-source').value.includes('Regular-only draft privacy sentinel')").ExtractBool());
  auto* private_browser = CreateIncognitoBrowser(profile);
  ASSERT_TRUE(private_browser);
  auto* private_contents =
      private_browser->GetTabStripModel()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(private_contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(private_contents,
      "document.querySelector('#skin-studio-source').readOnly && "
      "document.querySelector('#skin-studio-source').value === '' && "
      "!document.documentElement.outerHTML.includes('Regular-only draft privacy sentinel')").ExtractBool());
  ASSERT_TRUE(content::ExecJs(private_contents, content::JsReplace(
      "window.privateDraftReply='pending';window.tahaiSkinStudioDraftSaved=s=>window.privateDraftReply=s;"
      "chrome.send('saveTahaiSkinStudioDraft',[$1]);", *json)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(private_contents, "window.privateDraftReply==='unavailable'").ExtractBool();
  }));
  EXPECT_EQ(before, profile->GetPrefs()->GetDict(prefs::kTahaiSkinStudioDraft));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiCapabilityReviewRevokesWhileDisabledAndHidesPrivateState) {
  SeedCapabilityGrantFixture();
  auto* prefs = browser()->GetProfile()->GetPrefs();
  prefs->SetBoolean(prefs::kTahaiSkinsEnabled, false);
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiPolicyURL,
      "TAHAI Policy", "Policy can restrict features. It cannot grant authorization."));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelectorAll('#capability-grants button').length===2").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents,
      "document.querySelector('#capability-grants').textContent.includes('https://review.example/') && "
      "document.querySelector('#capability-grants').textContent.includes('Read explicitly selected content')").ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('#capability-grants button').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#capability-status').textContent.startsWith('Grant revoked.')").ExtractBool();
  }));
  const auto& remaining = prefs->GetDict(prefs::kTahaiCapabilityGrants);
  ASSERT_EQ(1u, remaining.FindList("grants")->size());
  EXPECT_EQ("navigate-approved-origin",
      *remaining.FindList("grants")->front().GetDict().FindString("operation"));
  const auto before = remaining.Clone();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiPolicyURL)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelectorAll('#capability-grants button').length===1").ExtractBool();
  }));
  auto* private_browser = CreateIncognitoBrowser(browser()->GetProfile());
  ASSERT_TRUE(private_browser);
  auto* private_contents = private_browser->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(private_contents, tahai::kTahaiPolicyURL,
      "TAHAI Policy", "Policy can restrict features. It cannot grant authorization."));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(private_contents,
        "document.querySelector('#capability-status').textContent.includes('unavailable')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(private_contents,
      "document.querySelector('#capability-grants').children.length===0 && "
      "!document.documentElement.outerHTML.includes('review.example')").ExtractBool());
  EXPECT_EQ(before, prefs->GetDict(prefs::kTahaiCapabilityGrants));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiCapabilityReviewRejectsUnreviewedAndGesturelessRevocation) {
  SeedCapabilityGrantFixture();
  auto* prefs = browser()->GetProfile()->GetPrefs();
  const auto before = prefs->GetDict(prefs::kTahaiCapabilityGrants).Clone();
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  // The general surface helper evaluates the page with a synthetic gesture.
  // This negative case must begin without ever granting activation.
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiPolicyURL)));
  EXPECT_FALSE(content::EvalJs(contents, "navigator.userActivation.isActive",
      content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.reviewToken='';window.revoked=null;
    window.tahaiCapabilityGrants=(available,token)=>window.reviewToken=token;
    window.tahaiCapabilityRevoked=result=>window.revoked=result;
    chrome.send('getTahaiCapabilityGrants',[]);
  )JS", content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.reviewToken.length>0",
        content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool();
  }));
  ASSERT_TRUE(content::ExecJs(contents,
      "chrome.send('revokeTahaiCapabilityGrant',[window.reviewToken,0])",
      content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.revoked===false",
        content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool();
  }));
  EXPECT_EQ(before, prefs->GetDict(prefs::kTahaiCapabilityGrants));
  // A denied attempt consumes the review; adding a gesture cannot replay it.
  ASSERT_TRUE(content::ExecJs(contents,
      "window.revoked=null;chrome.send('revokeTahaiCapabilityGrant',[window.reviewToken,0])"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.revoked===false").ExtractBool();
  }));
  EXPECT_EQ(before, prefs->GetDict(prefs::kTahaiCapabilityGrants));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.reviewAvailable=null;
    window.tahaiCapabilityGrants=available=>window.reviewAvailable=available;
    chrome.send('getTahaiCapabilityGrants',[]);
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.reviewAvailable===false").ExtractBool();
  }));
  EXPECT_EQ(before, prefs->GetDict(prefs::kTahaiCapabilityGrants));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioDiagnosticsStayBoundToSubmittedSource) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiSkinStudioURL, "TAHAI Skin Studio",
      "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.studioReplies=[];
    window.deliverStudioReply=window.tahaiSkinStudioDraftSaved;
    window.tahaiSkinStudioDraftSaved=(...args)=>window.studioReplies.push(args);
    document.querySelector('#skin-studio-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.studioReplies.length===1").ExtractBool();
  }));
  const auto before = browser()->GetProfile()->GetPrefs()->GetDict(
      prefs::kTahaiSkinStudioDraft).Clone();
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const source=document.querySelector('#skin-studio-source');
      source.value='{\n"private-sentinel": invalid}';
      source.dispatchEvent(new Event('input',{bubbles:true}));
      const status=document.querySelector('#skin-studio-status'), before=status.textContent;
      window.deliverStudioReply(...window.studioReplies[0]);
      const ignored=status.textContent===before;
      document.querySelector('#skin-studio-save').click();
      return ignored;
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.studioReplies.length===2").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const reply=window.studioReplies[1];
      window.deliverStudioReply(...reply);
      const status=document.querySelector('#skin-studio-status').textContent;
      return reply[0]==='invalid-json'&&reply[1].category==='syntax'&&
        reply[1].line===2&&reply[1].column>0&&reply[2]===2&&
        status.includes('line 2, column ')&&!status.includes('private-sentinel');
    })()
  )JS").ExtractBool());
  EXPECT_EQ(before, browser()->GetProfile()->GetPrefs()->GetDict(
      prefs::kTahaiSkinStudioDraft));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const source=document.querySelector('#skin-studio-source');
    source.value='[]';source.dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#skin-studio-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.studioReplies.length===3").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    window.deliverStudioReply(...window.studioReplies[2]);
    document.querySelector('#skin-studio-status').textContent.includes('one JSON object')
  )JS").ExtractBool());
  EXPECT_EQ(before, browser()->GetProfile()->GetPrefs()->GetDict(
      prefs::kTahaiSkinStudioDraft));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioSavesOnlyValidatedDraftSource) {
  content::WebContents* contents =
      browser()->GetTabStripModel()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  Profile* profile = browser()->GetProfile();
  ASSERT_TRUE(profile);
  EXPECT_TRUE(content::WebUIConfigMap::GetInstance().GetConfig(
      profile, GURL(tahai::kTahaiTrustedSkinStudioURL)));

  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiSkinStudioURL, "TAHAI Skin Studio",
      "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(
                  contents,
                  "Boolean(document.querySelector('#skin-studio-source') && "
                  "document.querySelector('#skin-studio-save') && "
                  "document.querySelector('#skin-studio-undo') && "
                  "document.querySelector('#skin-studio-redo') && "
                  "document.querySelector('#skin-studio-copy') && "
                  "document.querySelector('#skin-studio-download') && "
                  "document.querySelector('#skin-studio-import') && "
                  "document.querySelector('#skin-studio-layout') && "
                  "document.querySelector('#skin-studio-rail') && "
                  "document.querySelector('#skin-studio-start') && "
                  "document.querySelectorAll('[data-tahai-rail-module]').length === 9 && "
                  "document.querySelector('#skin-studio-rail-order') && "
                  "document.querySelector('#skin-studio-workflow-name') && "
                  "document.querySelector('#skin-studio-step-kind') && "
                  "document.querySelector('#skin-studio-step-name') && "
                  "document.querySelector('#skin-studio-add-step') && "
                  "document.querySelector('#skin-studio-input-type') && "
                  "document.querySelector('#skin-studio-input-name') && "
                  "document.querySelector('#skin-studio-input-options') && "
                  "document.querySelector('#skin-studio-input-required') && "
                  "document.querySelector('#skin-studio-add-input') && "
                  "document.querySelector('#skin-studio-workflow-inputs') && "
                  "document.querySelectorAll('#skin-studio-tokens "
                  "input[type=color]').length === 10)")
                  .ExtractBool());
  ASSERT_TRUE(content::ExecJs(
      contents, "document.querySelector('#skin-studio-save').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#skin-studio-status').textContent")
               .ExtractString()
               .find("Validated and saved") != std::string::npos;
  }));

  ASSERT_TRUE(content::ExecJs(
      contents,
      "const previousStudioCallback=window.tahaiSkinStudioDraftSaved;"
      "window.tahaiSkinStudioDraftSaved=(...args)=>{window.tahaiSavedResult=args[0];"
      "previousStudioCallback(...args)};"
      "const color=document.querySelector('#skin-studio-tokens "
      "input[type=color]');color.value='#123456';"
      "color.dispatchEvent(new Event('input',{bubbles:true}))"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "window.tahaiSavedResult === 'saved'")
               .ExtractBool();
  }));
  ASSERT_TRUE(content::ExecJs(
      contents,
      "window.tahaiSavedResult='pending';"
      "const layout=document.querySelector('#skin-studio-layout');"
      "layout.value='quad';layout.dispatchEvent(new Event('change',{bubbles:true}))"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.tahaiSavedResult === 'saved'")
        .ExtractBool();
  }));

  ASSERT_TRUE(content::ExecJs(
      contents,
      "window.tahaiSavedResult='pending';"
      "document.querySelector('#skin-studio-input-type').value='selection';"
      "document.querySelector('#skin-studio-input-type').dispatchEvent(new Event('change',{bubbles:true}));"
      "document.querySelector('#skin-studio-input-name').value='Review scope';"
      "document.querySelector('#skin-studio-input-options').value='Personal, Team';"
      "document.querySelector('#skin-studio-input-required').checked=true;"
      "document.querySelector('#skin-studio-add-input').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.tahaiSavedResult === 'saved'")
        .ExtractBool();
  }));
  ASSERT_TRUE(content::ExecJs(
      contents,
      "window.tahaiSavedResult='pending';"
      "const railModule=document.querySelector('[data-tahai-rail-module=downloads]');"
      "railModule.checked=true;railModule.dispatchEvent(new Event('change',{bubbles:true}))"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.tahaiSavedResult === 'saved'")
        .ExtractBool();
  }));
  ASSERT_TRUE(content::ExecJs(
      contents,
      "window.tahaiSavedResult='pending';"
      "document.querySelectorAll('#skin-studio-rail-order button')[1].click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.tahaiSavedResult === 'saved'")
        .ExtractBool();
  }));
  ASSERT_TRUE(content::ExecJs(
      contents,
      "window.tahaiSavedResult='pending';"
      "document.querySelector('#skin-studio-step-name').value="
      "'Document the research handoff';"
      "document.querySelector('#skin-studio-add-step').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "window.tahaiSavedResult === 'saved'")
        .ExtractBool();
  }));

  ASSERT_TRUE(content::ExecJs(
      contents,
      "const studioSource=document.querySelector('#skin-studio-source');"
      "const beforeUndo=studioSource.value;studioSource.value=beforeUndo.replace("
      "'my-operational-skin','undoable-operational-skin');"
      "studioSource.dispatchEvent(new Event('input',{bubbles:true}));"
      "document.querySelector('#skin-studio-undo').click()"));
  EXPECT_TRUE(content::EvalJs(
                  contents,
                  "document.querySelector('#skin-studio-source').value."
                  "includes('my-operational-skin') && !document.querySelector("
                  "'#skin-studio-source').value.includes('undoable-operational-skin')")
                  .ExtractBool());

  // Invalid editor input never overwrites the last validated profile draft.
  ASSERT_TRUE(content::ExecJs(
      contents,
      "document.querySelector('#skin-studio-source').value="
      "'{\\\"schema_version\\\":2}';"
      "document.querySelector('#skin-studio-save').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#skin-studio-status').textContent")
               .ExtractString()
               .find("not a valid v2") != std::string::npos;
  }));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiSkinStudioURL, "TAHAI Skin Studio",
      "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(
                  contents,
                  "document.querySelector('#skin-studio-source').value."
                  "includes('my-operational-skin') && "
                  "document.querySelector('#skin-studio-source').value."
                  "includes('#123456') && "
                  "document.querySelector('#skin-studio-source').value."
                  "includes('\\\"layout\\\": \\\"quad\\\"') && "
                  "document.querySelector('#skin-studio-source').value."
                  "includes('\\\"rail_modules\\\"') && "
                  "document.querySelector('#skin-studio-source').value."
                  "includes('\\\"downloads\\\"') && "
                  "(()=>{const rail=JSON.parse(document.querySelector('#skin-studio-source').value)."
                  "operational.surfaces[0].rail_modules;return rail.indexOf('local-oi') < "
                  "rail.indexOf('mission')})() && "
                  "document.querySelector('#skin-studio-source').value."
                  "includes('Document the research handoff') && "
                  "document.querySelector('#skin-studio-source').value."
                  "includes('Review scope') && document.querySelector("
                  "'#skin-studio-source').value.includes('Personal')")
                  .ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioUndoRespectsTextFieldsAndRestoresSource) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.historyOriginal = document.querySelector('#skin-studio-source').value;
    document.querySelector('#skin-studio-input-type').value='text';
    document.querySelector('#skin-studio-input-type').dispatchEvent(new Event('change'));
    document.querySelector('#skin-studio-input-name').value='Private sample';
    document.querySelector('#skin-studio-input-protected').checked=true;
    document.querySelector('#skin-studio-add-input').click();
    window.historyEdited = document.querySelector('#skin-studio-source').value;
    document.querySelector('#skin-studio-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  ASSERT_TRUE(ui_test_utils::BringBrowserWindowToFront(browser()));
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('#skin-studio-simulation-inputs input[type=password]').focus()"));
  ASSERT_TRUE(ui_test_utils::SendKeyPressSync(browser(), ui::VKEY_X, false, false, false, false));
  EXPECT_FALSE(content::EvalJs(contents,
      "document.querySelector('#skin-studio-simulation-inputs input[type=password]').value").ExtractString().empty());
  ASSERT_TRUE(ui_test_utils::SendKeyPressSync(browser(), ui::VKEY_Z, true, false, false, false));
  EXPECT_EQ("", content::EvalJs(contents,
      "document.querySelector('#skin-studio-simulation-inputs input[type=password]').value"));
  EXPECT_TRUE(content::EvalJs(contents,
      "document.querySelector('#skin-studio-source').value===window.historyEdited").ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('#skin-studio-source').focus()"));
  ASSERT_TRUE(ui_test_utils::SendKeyPressSync(browser(), ui::VKEY_Z, true, false, false, false));
  EXPECT_TRUE(content::EvalJs(contents,
      "document.querySelector('#skin-studio-source').value===window.historyOriginal").ExtractBool());
  ASSERT_TRUE(ui_test_utils::SendKeyPressSync(browser(), ui::VKEY_Y, true, false, false, false));
  EXPECT_TRUE(content::EvalJs(contents,
      "document.querySelector('#skin-studio-source').value===window.historyEdited && "
      "document.querySelector('#skin-studio-simulation-inputs input[type=password]').value===''").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (()=>{
      const source=document.querySelector('#skin-studio-source');
      source.value='é'.repeat(32769);source.dispatchEvent(new Event('input'));
      if(!document.querySelector('#skin-studio-redo').disabled)return false;
      document.querySelector('#skin-studio-undo').click();
      return source.value===window.historyEdited && document.querySelector('#skin-studio-redo').disabled;
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioLocalStartersPersistWithoutAuthorityOrBindingChanges) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* prefs = browser()->GetProfile()->GetPrefs();
  const auto grants = prefs->GetDict(prefs::kTahaiCapabilityGrants).Clone();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source=document.querySelector('#skin-studio-source');
      const before=source.value, original=JSON.parse(before);
      const choice=document.querySelector('#skin-studio-workflow-template-choice');
      if(choice.options.length!==6)return false;
      window.galleryMessages=[];
      const send=chrome.send.bind(chrome);
      chrome.send=(name,args)=>{window.galleryMessages.push(name);send(name,args)};
      choice.value='creator';choice.dispatchEvent(new Event('change'));
      if(source.value!==before || !document.querySelector('#skin-studio-workflow-template-description').textContent.includes('separate manual website action'))return false;
      for(const id of ['research','creator','planning','learning','operations','focus']){
        choice.value=id;choice.dispatchEvent(new Event('change'));
        document.querySelector('#skin-studio-workflow-template').click();
      }
      const result=JSON.parse(source.value);
      if(result.operational.workflows.length!==original.operational.workflows.length+6)return false;
      result.operational.workflows.splice(original.operational.workflows.length);
      return JSON.stringify(result)===JSON.stringify(original) && window.galleryMessages.length===0;
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('#skin-studio-save').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents,
      "window.galleryMessages.length>0 && window.galleryMessages.every(name=>name==='saveTahaiSkinStudioDraft')").ExtractBool());
  EXPECT_EQ(grants, prefs->GetDict(prefs::kTahaiCapabilityGrants));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const workflows=JSON.parse(document.querySelector('#skin-studio-source').value).operational.workflows;
      return workflows.length===7 && workflows.slice(1).every(workflow=>
        workflow.steps.every(step=>['instruction','checkpoint'].includes(step.kind)) &&
        (workflow.inputs||[]).every(input=>!Object.hasOwn(input,'value'))) &&
        new Set(workflows.map(workflow=>workflow.id)).size===7;
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioWorkflowOutlineTracksInspectorWithoutMutatingDraft) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const source = document.querySelector('#skin-studio-source');
    const draft = JSON.parse(source.value), workflow = draft.operational.workflows[0];
    workflow.inputs = [{id:'approved', name:'Approved', type:'boolean', required:false}];
    workflow.steps = [
      {id:'review',name:'Review',kind:'checkpoint',when:{input:'approved',equals:'true'}},
      {id:'dispatch',name:'Arrange panes',kind:'run-command',action:'layout.dual'},
      {id:'delay',name:'Wait',kind:'wait',wait:{seconds:1,timeout_seconds:5}}];
    workflow.repeats = [{id:'twice',from:'review',through:'dispatch',count:2}];
    source.value = JSON.stringify(draft); source.dispatchEvent(new Event('input'));
    document.querySelector('#skin-studio-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  const auto saved = browser()->GetProfile()->GetPrefs()->GetDict(prefs::kTahaiSkinStudioDraft).Clone();
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source = document.querySelector('#skin-studio-source'), before = source.value;
      const list = document.querySelector('#skin-studio-flow');
      const inspector = document.querySelector('#skin-studio-condition-step');
      const buttons = [...list.querySelectorAll('button')];
      if (buttons.length !== 3 || !document.querySelector('#skin-studio-flow-summary').textContent.includes('5 steps after repeat expansion')) return false;
      if (!list.textContent.includes('False: skip this step') || !list.textContent.includes('2 total iterations')) return false;
      buttons[1].click();
      if (inspector.value !== 'dispatch' || document.activeElement !== inspector) return false;
      buttons[1].focus();
      buttons[1].dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true,cancelable:true}));
      if (inspector.value !== 'delay' || document.activeElement !== buttons[2] || buttons[2].tabIndex !== 0) return false;
      inspector.value = 'review'; inspector.dispatchEvent(new Event('change'));
      if (buttons[0].getAttribute('aria-pressed') !== 'true') return false;
      return source.value === before && buttons.filter(button=>button.tabIndex===0).length===1;
    })()
  )JS").ExtractBool());
  EXPECT_EQ(saved, browser()->GetProfile()->GetPrefs()->GetDict(prefs::kTahaiSkinStudioDraft));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source=document.querySelector('#skin-studio-source');
      const stale=document.querySelector('#skin-studio-flow button');
      if(document.querySelectorAll('#skin-studio-flow button').length!==3)return false;
      source.value='{';source.dispatchEvent(new Event('input'));stale.click();
      return document.querySelectorAll('#skin-studio-flow button').length===0 && source.value==='{' &&
          document.querySelector('#skin-studio-flow-summary').textContent.includes('valid workflow');
    })()
  )JS").ExtractBool());
  EXPECT_EQ(saved, browser()->GetProfile()->GetPrefs()->GetDict(prefs::kTahaiSkinStudioDraft));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioConditionsAndSimulationStayLocal) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiSkinStudioURL, "TAHAI Skin Studio",
      "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    document.querySelector('#skin-studio-input-type').value = 'boolean';
    document.querySelector('#skin-studio-input-type').dispatchEvent(new Event('change'));
    document.querySelector('#skin-studio-input-name').value = 'Approved';
    document.querySelector('#skin-studio-input-required').checked = true;
    document.querySelector('#skin-studio-add-input').click();
    document.querySelector('#skin-studio-condition-input').value = 'input-approved';
    document.querySelector('#skin-studio-condition-input').dispatchEvent(new Event('change'));
    document.querySelector('#skin-studio-condition-value').value = 'true';
    document.querySelector('#skin-studio-condition-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')")
        .ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source = document.querySelector('#skin-studio-source');
      const before = source.value;
      document.querySelector('#skin-studio-simulate').click();
      const status = document.querySelector('#skin-studio-simulation-status');
      if (!status.textContent.includes('Waiting for required inputs')) return false;
      const input = document.querySelector('[data-simulation-input="input-approved"]');
      input.value = 'true'; input.dispatchEvent(new Event('change'));
      const complete = document.querySelector('#skin-studio-simulation-steps button');
      if (!complete) return false;
      complete.click();
      return status.textContent.includes('Simulation complete') && source.value === before;
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiSkinStudioURL, "TAHAI Skin Studio",
      "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const workflow = JSON.parse(document.querySelector('#skin-studio-source').value)
          .operational.workflows[0];
      const input = document.querySelector('[data-simulation-input="input-approved"]');
      return workflow.steps[0].when.input === 'input-approved' &&
          workflow.steps[0].when.equals === 'true' && input.value === '' &&
          !Object.hasOwn(workflow.inputs[0], 'value');
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioEditsAndBindsIndependentWorkflows) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiSkinStudioURL, "TAHAI Skin Studio",
      "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.originalWorkflow = JSON.parse(document.querySelector('#skin-studio-source').value).operational.workflows[0];
    document.querySelector('#skin-studio-workflow-new-name').value = 'Secondary review';
    document.querySelector('#skin-studio-workflow-copy').click();
    document.querySelector('#skin-studio-workflow-name').value = 'Secondary checklist';
    document.querySelector('#skin-studio-workflow-name').dispatchEvent(new Event('change'));
    document.querySelector('#skin-studio-input-type').value = 'boolean';
    document.querySelector('#skin-studio-input-type').dispatchEvent(new Event('change'));
    document.querySelector('#skin-studio-input-name').value = 'Approved secondary';
    document.querySelector('#skin-studio-add-input').click();
    document.querySelector('#skin-studio-condition-input').value = 'input-approved-secondary';
    document.querySelector('#skin-studio-condition-input').dispatchEvent(new Event('change'));
    document.querySelector('#skin-studio-condition-value').value = 'false';
    document.querySelector('#skin-studio-condition-save').click();
    document.querySelector('#skin-studio-workflow-bind').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')")
        .ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source = document.querySelector('#skin-studio-source');
      const parsed = JSON.parse(source.value), workflows = parsed.operational.workflows;
      if (workflows.length !== 2 || JSON.stringify(workflows[0]) !== JSON.stringify(window.originalWorkflow) ||
          workflows[1].name !== 'Secondary checklist' ||
          workflows[1].steps[0].when.input !== 'input-approved-secondary' ||
          workflows[1].steps[0].when.equals !== 'false' ||
          parsed.operational.modes[0].workflow !== workflows[1].id) return false;
      if (!document.querySelector('#skin-studio-workflow-remove').disabled) return false;
      document.querySelector('#skin-studio-simulate').click();
      if (!document.querySelector('#skin-studio-simulation-status').textContent.includes('branch choices')) return false;
      const input = document.querySelector('[data-simulation-input="input-approved-secondary"]');
      input.value = 'false'; input.dispatchEvent(new Event('change'));
      const staleCompletion = document.querySelector('#skin-studio-simulation-steps button');
      if (!staleCompletion) return false;
      const before = source.value;
      let writes = 0; source.addEventListener('input', () => ++writes);
      const selected = document.querySelector('#skin-studio-workflow-select');
      selected.value = workflows[0].id; selected.dispatchEvent(new Event('change'));
      staleCompletion.click();
      input.value = 'true'; input.dispatchEvent(new Event('change'));
      document.querySelector('#skin-studio-simulate').click();
      if (document.querySelector('#skin-studio-simulation-steps').textContent.includes(' — Complete')) return false;
      if (document.querySelector('#skin-studio-workflow-name').value !== workflows[0].name ||
          writes !== 0 || source.value !== before) return false;
      selected.value = workflows[1].id; selected.dispatchEvent(new Event('change'));
      if (document.querySelector('[data-simulation-input="input-approved-secondary"]').value !== '') return false;
      // Synthetic stale calls cannot mutate a now read-only draft either.
      source.readOnly = true;
      document.querySelector('#skin-studio-workflow-new-name').value = 'Forbidden copy';
      document.querySelector('#skin-studio-workflow-copy').click();
      document.querySelector('#skin-studio-workflow-remove').click();
      source.readOnly = false;
      return writes === 0 && source.value === before;
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiSkinStudioURL, "TAHAI Skin Studio",
      "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source = document.querySelector('#skin-studio-source');
      const parsed = JSON.parse(source.value), workflow = parsed.operational.workflows[1];
      const selected = document.querySelector('#skin-studio-workflow-select');
      selected.value = workflow.id; selected.dispatchEvent(new Event('change'));
      return selected.options.length === 2 && workflow.name === 'Secondary checklist' &&
          parsed.operational.modes[0].workflow === workflow.id &&
          document.querySelector('#skin-studio-workflow-name').value === workflow.name &&
          document.querySelector('[data-simulation-input="input-approved-secondary"]').value === '' &&
          !Object.hasOwn(workflow.inputs[0], 'value');
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioNamedOutputsPersistWithoutSimulatedValues) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      get('input-type').value = 'text'; get('input-type').dispatchEvent(new Event('change'));
      get('input-name').value = 'Private source'; get('input-protected').checked = true;
      get('input-required').checked = true; get('add-input').click();
      get('output-name').value = 'Private result'; get('output-input').value = 'input-private-source';
      get('output-add').click();
      const workflow = JSON.parse(get('source').value).operational.workflows[0];
      if (workflow.outputs[0].from.input !== 'input-private-source') throw new Error('Missing output binding');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), source = get('source').value;
      get('simulate').click();
      if (get('simulation-outputs').children.length) return false;
      const input = document.querySelector('[data-simulation-input=input-private-source]');
      input.value = 'password=dummy-only:@/output'; input.dispatchEvent(new Event('change'));
      if (input.value || get('simulation-outputs').children.length) return false;
      const done = get('simulation-steps').querySelector('button');
      if (!done) return false; done.click();
      return get('simulation-outputs').textContent.includes('Protected result (masked)') &&
          !get('simulation-outputs').textContent.includes('dummy-only') &&
          get('source').value === source && !source.includes('dummy-only');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source = document.querySelector('#skin-studio-source').value;
      const workflow = JSON.parse(source).operational.workflows[0];
      return workflow.outputs[0].name === 'Private result' &&
          workflow.outputs[0].from.input === 'input-private-source' &&
          document.querySelector('#skin-studio-simulation-outputs').children.length === 0 &&
          document.querySelector('[data-simulation-input=input-private-source]').value === '' &&
          !source.includes('dummy-only') && !Object.hasOwn(workflow.outputs[0], 'value');
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioWaitDeadlinePersistsAndSimulatesTerminalFailure) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"(
    document.querySelector('#skin-studio-wait-seconds').value = '3';
    document.querySelector('#skin-studio-wait-timeout').value = '5';
    document.querySelector('#skin-studio-wait-save').click();
  )"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), original = get('source').value;
      const step = JSON.parse(original).operational.workflows[0].steps[0];
      if (step.wait.seconds !== 3 || step.wait.timeout_seconds !== 5) return false;
      get('simulate').click(); get('simulation-steps').querySelector('button').click();
      const expire = [...get('simulation-steps').querySelectorAll('button')].find(button =>
          button.textContent === 'Advance to deadline and fail in simulation');
      if (!expire) return false; expire.click();
      return get('simulation-status').textContent.includes('Simulation failed: wait-timed-out') &&
          !get('simulation-steps').querySelector('button') && !get('simulation-outputs').children.length && original === get('source').value;
    })()
  )").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"(
    document.querySelector('#skin-studio-wait-timeout').value === '5' &&
    !document.querySelector('#skin-studio-source').value.includes('wait_timeout_remaining_ms') &&
    !document.querySelector('#skin-studio-simulation-status').textContent.includes('failed')
  )").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionNativeFailureShowsTerminalOutcomeAndNoResume) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "native-error-workflow"; workflow.name = "Native error workflow";
  workflow.steps = {{"action", "Action", tahai::TahaiOperationalWorkflowStepKind::kRunCommand, "mission.open"}};
  for (const char* outcome : {"rejected", "unknown"}) {
    const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
    ASSERT_TRUE(created); ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
    ASSERT_TRUE(service->BeginNativeWorkflowStep(created->id, 0));
    ASSERT_TRUE(service->FinishNativeWorkflowStep(created->id, 0, outcome));
    ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
        "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
    EXPECT_TRUE(content::EvalJs(contents, content::JsReplace(R"(
      (() => {
        const button = [...document.querySelectorAll('[data-tahai-native-run]')].find(item => item.dataset.tahaiMissionId === $1);
        const row = button?.closest('.mission-step'), error = row?.querySelector('[data-tahai-native-error]');
        return button?.disabled && error && !error.hidden && error.getAttribute('role') === 'status' &&
            error.dataset.tahaiNativeError === $2 && ($2 !== 'unknown' || error.textContent.includes('may have happened')) &&
            !row.querySelector('[data-tahai-native-refresh]').hidden &&
            ![...document.querySelectorAll('[data-tahai-workflow-state=running]')].some(item => item.dataset.tahaiMissionId === $1);
      })()
    )", created->id, outcome)).ExtractBool());
    EXPECT_EQ("failed", service->missions().back().operational_workflow->run_state);
    EXPECT_FALSE(service->SetOperationalWorkflowRunState(created->id, "running"));
  }
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioNativeFailureSimulationIsDisposable) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), source = get('source');
      const parsed = JSON.parse(source.value);
      parsed.operational.capabilities = ['mission-checklist'];
      const workflow = parsed.operational.workflows[0];
      workflow.inputs = []; workflow.variables = []; workflow.outputs = [];
      workflow.steps = [{id: 'native', name: 'Native', kind: 'run-command', action: 'mission.open'},
          {id: 'after', name: 'After', kind: 'checkpoint'}];
      source.value = JSON.stringify(parsed); source.dispatchEvent(new Event('input', {bubbles: true}));
      const original = source.value;
      for (const [label, code] of [['Simulate rejected action', 'native-rejected'], ['Simulate unknown outcome', 'native-outcome-unknown']]) {
        get('simulate').click();
        const button = [...get('simulation-steps').querySelectorAll('button')].find(item => item.textContent === label);
        if (!button || button.disabled) return false;
        button.click();
        if (!get('simulation-status').textContent.includes(code) || get('simulation-steps').querySelector('button') ||
            get('simulation-outputs').children.length || source.value !== original) return false;
        get('simulation-reset').click();
        if (get('simulation-status').textContent.includes('failed')) return false;
      }
      return true;
    })()
  )").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionWaitDeadlineFailsWithoutPageActionAndDisplaysRecordedError) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "deadline-workflow"; workflow.name = "Deadline workflow";
  workflow.steps = {{"delay", "Delay", tahai::TahaiOperationalWorkflowStepKind::kWait},
      {"after", "After", tahai::TahaiOperationalWorkflowStepKind::kRunCommand, "mission.open"}};
  workflow.steps[0].wait_seconds = 1; workflow.steps[0].wait_timeout_seconds = 2;
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created); ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-wait-control=start]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  // No page event, reload, completion request or simulated clock causes expiry.
  ASSERT_TRUE(base::test::RunUntil([&] {
    return service->missions().back().operational_workflow->run_state == "failed";
  }));
  EXPECT_EQ("timed-out", service->missions().back().steps[0].wait_state);
  EXPECT_FALSE(service->missions().back().steps[0].complete);
  EXPECT_EQ("ready", service->missions().back().steps[1].action_state);
  EXPECT_FALSE(service->BeginNativeWorkflowStep(created->id, 1));
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-wait-refresh]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_TRUE(content::EvalJs(contents, R"(
    (() => {
      const failure = document.querySelector('[data-tahai-wait-error=wait-timed-out]');
      return failure && failure.getAttribute('role') === 'status' && failure.textContent.includes('This run failed') &&
          document.querySelector('[data-tahai-wait-control]').disabled &&
          !document.querySelector('[data-tahai-workflow-state=running]');
    })()
  )").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("timed-out", service->missions().back().steps[0].wait_state);
  EXPECT_EQ("ready", service->missions().back().steps[1].action_state);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioTimedWaitDefinitionPersistsWithoutSimulationClock) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    document.querySelector('#skin-studio-wait-seconds').value = '3';
    document.querySelector('#skin-studio-wait-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), original = get('source').value;
      const step = JSON.parse(original).operational.workflows[0].steps[0];
      if (step.kind !== 'wait' || step.wait.seconds !== 3) return false;
      get('simulate').click();
      let button = get('simulation-steps').querySelector('button');
      if (!button || button.textContent !== 'Start wait in simulation') return false;
      button.click(); button = get('simulation-steps').querySelector('button');
      if (!button || button.textContent !== 'Advance time and complete in simulation') return false;
      button.click();
      return original === get('source').value && !original.includes('wait_state') && !original.includes('remaining_ms');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const step = JSON.parse(document.querySelector('#skin-studio-source').value).operational.workflows[0].steps[0];
      return step.kind === 'wait' && step.wait.seconds === 3 &&
          document.querySelector('#skin-studio-wait-seconds').value === '3';
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionWaitRequiresCurrentExplicitStartAndCompletionWithoutNextAction) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "wait-workflow"; workflow.name = "Timed wait";
  workflow.inputs = {{"approved", "Approved", tahai::TahaiOperationalWorkflowInputType::kBoolean, true, {}}};
  workflow.steps = {{"delay", "Delay", tahai::TahaiOperationalWorkflowStepKind::kWait, {}, "approved", "true"},
      {"after", "After", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint}};
  workflow.steps[0].wait_seconds = 1;
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created);
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "approved", "true"));
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, R"(
    !document.querySelector('[data-tahai-wait-control=start]').disabled &&
    !document.querySelector('[data-tahai-input-id=approved]').disabled &&
    document.querySelector('[data-tahai-mission-action=toggle-step][data-tahai-step-index="0"]').disabled
  )").ExtractBool());
  // Even a forged completion message cannot finish an unstarted wait.
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('controlTahaiWorkflowWait', [$1, 0, 'complete', document.querySelector('[data-tahai-wait-control]').dataset.tahaiRunToken])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('Wait not changed')").ExtractBool();
  }));
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "paused"));
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  // Another document changed the run: its old controls cannot arm a timer.
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-wait-control=start]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('Wait not changed')").ExtractBool();
  }));
  EXPECT_EQ("ready", service->missions().back().steps[0].wait_state);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-wait-control=start]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("waiting", service->missions().back().steps[0].wait_state);
  EXPECT_TRUE(content::EvalJs(contents, R"(
    (() => {
      const input = document.querySelector('[data-tahai-input-id=approved]');
      return input.disabled && input.value === 'true' &&
          input.getAttribute('aria-describedby').includes('-locked') &&
          document.body.textContent.includes('Branch choice locked');
    })()
  )").ExtractBool());
  EXPECT_FALSE(service->SetOperationalWorkflowInputValue(created->id, "approved", "false"));
  EXPECT_EQ("off", content::EvalJs(contents, "document.querySelector('[data-tahai-wait-countdown]').getAttribute('aria-live')"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return tahai::MissionWorkflowWaitRemaining(service->missions().back().steps[0]) == 0;
  }));
  EXPECT_FALSE(service->missions().back().steps[0].complete);
  EXPECT_FALSE(service->missions().back().steps[1].complete);
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-wait-control=complete]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("complete", service->missions().back().steps[0].wait_state);
  EXPECT_FALSE(service->missions().back().steps[1].complete);
  EXPECT_EQ("running", service->missions().back().operational_workflow->run_state);
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-wait-control]').disabled").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("complete", service->missions().back().steps[0].wait_state);
  EXPECT_FALSE(service->ControlWorkflowWait(created->id, 0, false));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioVariablesAssignmentsAndResultsPersistWithoutSimulationData) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      get('input-type').value = 'number'; get('input-type').dispatchEvent(new Event('change'));
      get('input-name').value = 'Amount'; get('input-lower').value = '2'; get('input-upper').value = '4';
      get('add-input').click();
      get('variable-name').value = 'Total'; get('variable-template').value = 'input-amount'; get('variable-add').click();
      get('assignment-target').value = 'variable-total'; get('assignment-source').value = 'input-amount'; get('assignment-save').click();
      get('output-name').value = 'Total result'; get('output-input').value = 'variable:variable-total'; get('output-add').click();
      const workflow = JSON.parse(get('source').value).operational.workflows[0];
      if (workflow.variables[0].type !== 'number' || workflow.variables[0].validation.maximum !== 4 ||
          workflow.steps[0].kind !== 'assign-variable' || workflow.outputs[0].from.variable !== 'variable-total')
        throw new Error('Missing typed variable design');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), original = get('source').value;
      const input = document.querySelector('[data-simulation-input=input-amount]');
      input.value = '3.125'; input.dispatchEvent(new Event('change'));
      const assign = get('simulation-steps').querySelector('button');
      if (!assign || assign.textContent !== 'Assign in simulation') return false;
      assign.click();
      return get('simulation-outputs').textContent.includes('3.125') && get('source').value === original &&
          !original.includes('3.125');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const source = document.querySelector('#skin-studio-source').value;
      const workflow = JSON.parse(source).operational.workflows[0];
      return workflow.variables[0].id === 'variable-total' && workflow.steps[0].assign.from.input === 'input-amount' &&
          workflow.outputs[0].from.variable === 'variable-total' && !Object.hasOwn(workflow.variables[0], 'value') &&
          !source.includes('3.125') && document.querySelector('#skin-studio-simulation-outputs').children.length === 0;
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionVariableAssignmentRequiresExplicitOrderedValidActionAndSurvivesReload) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "variable-workflow"; workflow.name = "Variable workflow";
  workflow.inputs = {{"amount", "Amount", tahai::TahaiOperationalWorkflowInputType::kNumber, true, {}}};
  workflow.variables = {{"total", "Total", tahai::TahaiOperationalWorkflowInputType::kNumber, false, {}}};
  workflow.variables[0].validation = tahai::TahaiWorkflowInputValidation{{}, {}, 2.0, 4.0};
  workflow.steps = {{"review", "Review", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint},
      {"assign-total", "Assign total", tahai::TahaiOperationalWorkflowStepKind::kAssignVariable}};
  workflow.steps[1].assignment = tahai::TahaiWorkflowAssignment{"total", "amount", false};
  workflow.outputs = {{"result", "Result", "total", true}};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created);
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "amount", "5"));
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, R"(
    document.querySelector('[data-tahai-variable-assign]').disabled &&
    document.querySelector('[data-tahai-mission-action=toggle-step][data-tahai-step-index="1"]').disabled
  )").ExtractBool());
  // A forged renderer message still cannot skip the preceding checkpoint.
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('assignTahaiWorkflowVariable', [$1, 1, document.querySelector('[data-tahai-variable-assign]').dataset.tahaiRunToken])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('Variable not changed')").ExtractBool();
  }));
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents,
        "document.querySelector('[data-tahai-mission-action=toggle-step][data-tahai-step-index=\"0\"]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  // Correct order alone is insufficient when the destination limits fail.
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('assignTahaiWorkflowVariable', [$1, 1, document.querySelector('[data-tahai-variable-assign]').dataset.tahaiRunToken])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('Variable not changed')").ExtractBool();
  }));
  EXPECT_TRUE(service->missions().back().workflow_variables[0].value.empty());
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, R"(
      const input = document.querySelector('[data-tahai-input-id=amount]');
      input.value = '3.125'; input.dispatchEvent(new Event('change', {bubbles: true}));
    )"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("Not set", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-variable=total]').textContent"));
  // An old tab cannot assign a value changed in another document, even when
  // the new value also satisfies all type/limit/order checks.
  const auto stale_token = service->missions().back().mutation_token;
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "amount", "3.5"));
  EXPECT_NE(stale_token, service->missions().back().mutation_token);
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-variable-assign]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('Variable not changed')").ExtractBool();
  }));
  EXPECT_TRUE(service->missions().back().workflow_variables[0].value.empty());
  EXPECT_FALSE(service->missions().back().steps[1].complete);
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "amount", "3.125"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  for (const char* selector : {"[data-tahai-variable-assign]", "[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("document.querySelector($1).click()", selector)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("3.125", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-output=result]').textContent"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("3.125", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-variable=total]').textContent"));
  EXPECT_TRUE(content::EvalJs(contents, R"(
    document.querySelector('[data-tahai-variable-assign]').disabled &&
    [...document.querySelectorAll('[data-tahai-evidence-preview=true]')].every(view => !view.textContent.includes('3.125'))
  )").ExtractBool());
  EXPECT_FALSE(service->AssignWorkflowVariable(created->id, 1));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioNumericConditionsPersistAndSimulateWithoutActions) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      get('input-type').value = 'number'; get('input-type').dispatchEvent(new Event('change'));
      get('input-name').value = 'Amount'; get('add-input').click();
      get('condition-input').value = 'input-amount'; get('condition-input').dispatchEvent(new Event('change'));
      get('condition-operation').value = 'at-least'; get('condition-number').value = '3.125'; get('condition-save').click();
      const when = JSON.parse(get('source').value).operational.workflows[0].steps[0].when;
      if (when.compare.op !== 'at-least' || when.compare.number !== 3.125 || when.equals)
        throw new Error('Missing numeric branch definition');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), original = get('source').value;
      get('simulate').click();
      if (!get('simulation-status').textContent.includes('Amount')) return false;
      const input = document.querySelector('[data-simulation-input=input-amount]');
      input.value = '2'; input.dispatchEvent(new Event('change'));
      if (!get('simulation-steps').textContent.includes('Skipped by condition')) return false;
      input.value = '4'; input.dispatchEvent(new Event('change'));
      const button = get('simulation-steps').querySelector('button');
      if (!button || button.disabled) return false;
      button.click();
      return get('source').value === original && get('simulation-status').textContent.includes('Simulation complete');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      return get('condition-input').value === 'input-amount' && get('condition-operation').value === 'at-least' &&
          get('condition-number').value === '3.125' && get('condition-value').disabled &&
          !get('condition-number').disabled && !get('simulation-steps').children.length;
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioVariableBranchesPersistDefinitionsAndRecordDisposableDecisions) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), doc = JSON.parse(get('source').value);
      const workflow = doc.operational.workflows[0];
      workflow.inputs = []; workflow.outputs = []; workflow.variables = [{id:'total', name:'Total', type:'number'}];
      workflow.steps = [
        {id:'first', name:'Assign first', kind:'assign-variable', assign:{variable:'total', expression:{number:2}}},
        {id:'branch', name:'Branch', kind:'checkpoint'},
        {id:'change', name:'Assign later', kind:'assign-variable', assign:{variable:'total', expression:{number:4}}},
        {id:'finish', name:'Finish', kind:'checkpoint'}];
      get('source').value = JSON.stringify(doc); get('source').dispatchEvent(new Event('input', {bubbles:true}));
      get('condition-step').value = 'branch'; get('condition-step').dispatchEvent(new Event('change'));
      get('condition-input').value = 'variable:total'; get('condition-input').dispatchEvent(new Event('change'));
      get('condition-operation').value = 'greater-than'; get('condition-number').value = '3'; get('condition-save').click();
      const when = JSON.parse(get('source').value).operational.workflows[0].steps[1].when;
      if (when.variable !== 'total' || when.input || when.compare.number !== 3) throw new Error('Missing variable branch');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool(); }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), before = get('source').value;
      const rows = () => get('simulation-steps').children;
      get('simulate').click();
      if (!rows()[1].textContent.includes('Waiting for variable assignment') || !rows()[3].querySelector('button').disabled) return false;
      rows()[0].querySelector('button').click();
      if (!rows()[1].textContent.includes('Skipped by condition')) return false;
      rows()[2].querySelector('button').click();
      if (!rows()[1].textContent.includes('Skipped by condition (recorded decision)')) return false;
      rows()[3].querySelector('button').click();
      return get('simulation-status').textContent.includes('Simulation complete') && get('source').value === before &&
          !before.includes('variable_condition_result');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      get('condition-step').value = 'branch'; get('condition-step').dispatchEvent(new Event('change'));
      if (get('condition-input').value !== 'variable:total' || get('condition-number').value !== '3' || get('simulation-steps').children.length) return false;
      get('simulate').click(); return get('simulation-steps').children[1].textContent.includes('Waiting for variable assignment');
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionVariableBranchesBlockUnassignedWorkAndKeepRecordedHistory) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "variable-branch"; workflow.name = "Variable branch";
  workflow.variables = {{"total", "Total", tahai::TahaiOperationalWorkflowInputType::kNumber, false, {}}};
  workflow.steps = {{"first", "Assign first", tahai::TahaiOperationalWorkflowStepKind::kAssignVariable},
      {"branch", "Branch", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint},
      {"change", "Assign later", tahai::TahaiOperationalWorkflowStepKind::kAssignVariable},
      {"finish", "Finish", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint}};
  tahai::TahaiWorkflowNumericExpression expression; expression.number = 2;
  workflow.steps[0].assignment = tahai::TahaiWorkflowAssignment{"total", {}, false, expression};
  expression.number = 4; workflow.steps[2].assignment = tahai::TahaiWorkflowAssignment{"total", {}, false, expression};
  workflow.steps[1].condition_input_id = "total"; workflow.steps[1].condition_from_variable = true;
  workflow.steps[1].numeric_condition = tahai::TahaiWorkflowNumericCondition{"greater-than", 3};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true); ASSERT_TRUE(created);
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-condition-status=unassigned]') !== null").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,
      "document.querySelector('[data-tahai-mission-action=toggle-step][data-tahai-step-index=\"3\"]').disabled").ExtractBool());
  EXPECT_FALSE(service->ToggleStep(created->id, 3));
  for (const int index : {0, 2}) {
    ASSERT_FALSE(content::EvalJs(contents, content::JsReplace(
        "document.querySelector('[data-tahai-variable-assign][data-tahai-step-index=\"' + $1 + '\"]').disabled", index)).ExtractBool());
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
        "document.querySelector('[data-tahai-variable-assign][data-tahai-step-index=\"' + $1 + '\"]').click()", index)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("4", service->missions().back().workflow_variables[0].value);
  EXPECT_EQ(false, service->missions().back().steps[1].variable_condition_result);
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-condition-status=skipped]').textContent.includes('recorded decision')").ExtractBool());
  EXPECT_FALSE(service->ToggleStep(created->id, 1));
  for (const char* selector : {"[data-tahai-mission-action=toggle-step][data-tahai-step-index=\"3\"]", "[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("document.querySelector($1).click()", selector)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-condition-status=skipped]').textContent.includes('recorded decision')").ExtractBool());
  EXPECT_EQ("succeeded", service->missions().back().operational_workflow->run_state);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionNumericConditionsCannotRewriteASkippedBranchAfterProgress) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "numeric-branch"; workflow.name = "Numeric branch";
  workflow.inputs = {{"amount", "Amount", tahai::TahaiOperationalWorkflowInputType::kNumber, false, {}}};
  workflow.steps = {{"branch", "Numeric branch", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint},
      {"after", "After branch", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint}};
  workflow.steps[0].condition_input_id = "amount";
  workflow.steps[0].numeric_condition = tahai::TahaiWorkflowNumericCondition{"greater-than", 3.125};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-input-id=amount]').required").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-condition-status=unanswered]') !== null").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,
      "document.querySelector('[data-tahai-mission-action=toggle-step][data-tahai-step-index=\"0\"]').disabled").ExtractBool());
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, R"JS(
      const input = document.querySelector('[data-tahai-input-id=amount]');
      input.value = '2'; input.dispatchEvent(new Event('change', {bubbles: true}));
    )JS"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  for (const char* selector : {"[data-tahai-workflow-state=running]", "[data-tahai-mission-action=toggle-step][data-tahai-step-index=\"1\"]"}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("document.querySelector($1).click()", selector)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-input-id=amount]').disabled").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents, "document.body.textContent.includes('greater than 3.125')").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-condition-status=skipped]') !== null").ExtractBool());
  const auto token = service->missions().back().mutation_token;
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('setTahaiOperationalWorkflowInput', [$1, 'amount', '4', $2])", created->id, token)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('That value was not stored')").ExtractBool();
  }));
  EXPECT_EQ(token, service->missions().back().mutation_token);
  EXPECT_EQ("2", service->missions().back().workflow_inputs[0].value);
  EXPECT_FALSE(service->missions().back().steps[0].complete); EXPECT_TRUE(service->missions().back().steps[1].complete);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-input-id=amount]').disabled").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioRepeatRangesPersistAndSimulateDistinctIterations) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get=id=>document.querySelector('#skin-studio-'+id),doc=JSON.parse(get('source').value),w=doc.operational.workflows[0];
      w.inputs=[];w.variables=[];w.outputs=[];
      w.steps=[{id:'first',name:'First',kind:'checkpoint'},{id:'last',name:'Last',kind:'checkpoint'}];
      get('source').value=JSON.stringify(doc);get('source').dispatchEvent(new Event('input',{bubbles:true}));
      get('repeat-from').value='first';get('repeat-through').value='last';get('repeat-count').value='3';get('repeat-save').click();
      const saved=JSON.parse(get('source').value).operational.workflows[0];
      if(saved.steps.length!==2 || saved.repeats[0].count!==3 || !get('repeat-summary').textContent.includes('6 expanded'))
        throw new Error('Repeat declaration not saved');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool(); }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (()=>{
      const get=id=>document.querySelector('#skin-studio-'+id),before=get('source').value;get('simulate').click();
      if(get('simulation-steps').children.length!==6)return false;
      get('simulation-steps').children[0].querySelector('button').click();
      return get('source').value===before && get('simulation-steps').children[0].textContent.includes('Complete') &&
          get('simulation-steps').children[2].textContent.includes('[2/3] First') &&
          get('simulation-steps').children[2].textContent.includes('Ready');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio","Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents,R"JS(
    (()=>{
      const get=id=>document.querySelector('#skin-studio-'+id),w=JSON.parse(get('source').value).operational.workflows[0];
      return w.steps.length===2 && w.repeats[0].count===3 && !get('simulation-steps').children.length;
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionRepeatAssignmentsStayExplicitAndRetainIndependentProgress) {
  auto* contents = browser()->GetTabStripModel()->GetActiveWebContents();
  auto* service=tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow; workflow.id="repeat-flow";workflow.name="Repeat flow";
  workflow.variables={{"total","Total",tahai::TahaiOperationalWorkflowInputType::kNumber,false,{}}};
  workflow.steps={{"seed","Initialize",tahai::TahaiOperationalWorkflowStepKind::kAssignVariable},
      {"increment","Increment",tahai::TahaiOperationalWorkflowStepKind::kAssignVariable}};
  tahai::TahaiWorkflowNumericExpression zero;zero.number=0;
  tahai::TahaiWorkflowNumericExpression variable;variable.variable_id="total";
  tahai::TahaiWorkflowNumericExpression one;one.number=1;
  tahai::TahaiWorkflowNumericExpression add;add.operation="add";add.arguments={variable,one};
  workflow.steps[0].assignment=tahai::TahaiWorkflowAssignment{"total",{},false,zero};
  workflow.steps[1].assignment=tahai::TahaiWorkflowAssignment{"total",{},false,add};
  workflow.repeats={{"rounds","increment","increment",2}};workflow.outputs={{"result","Result","total",true}};
  const auto created=service->CreateOperationalWorkflowMission(workflow,"review-skin",std::string(64,'a'),true);ASSERT_TRUE(created);
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id,"running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiMissionURL,
      "Mission Control","Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents,"document.body.textContent.includes('[2/2] Increment')").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-variable-assign][data-tahai-step-index=\"2\"]').disabled").ExtractBool());
  for(const int index : {0,1}) {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,content::JsReplace(
        "document.querySelector('[data-tahai-variable-assign][data-tahai-step-index=\"'+$1+'\"]').click()",index)));
    reload.Wait();ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("1",service->missions().back().workflow_variables[0].value);EXPECT_FALSE(service->missions().back().steps[2].complete);
  for(const char* selector : {"[data-tahai-workflow-state=paused]","[data-tahai-workflow-state=running]",
      "[data-tahai-variable-assign][data-tahai-step-index=\"2\"]","[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,content::JsReplace("document.querySelector($1).click()",selector)));
    reload.Wait();ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiMissionURL,
      "Mission Control","Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("succeeded",service->missions().back().operational_workflow->run_state);
  EXPECT_EQ("2",service->missions().back().workflow_variables[0].value);
  EXPECT_EQ("r-rounds-1-increment",service->missions().back().steps[1].workflow_step_id);
  EXPECT_EQ("r-rounds-2-increment",service->missions().back().steps[2].workflow_step_id);
  EXPECT_FALSE(service->AssignWorkflowVariable(created->id,1));EXPECT_FALSE(service->AssignWorkflowVariable(created->id,2));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioCompoundConditionsPersistAndBlockUnknownOrBranches) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), doc = JSON.parse(get('source').value);
      const w = doc.operational.workflows[0];
      w.inputs = [{id:'approved',name:'Approved',type:'boolean',required:false}];
      w.variables = [{id:'total',name:'Total',type:'number'}]; w.outputs=[];
      w.steps = [{id:'first',name:'Assign first',kind:'assign-variable',assign:{variable:'total',expression:{number:4}}},
          {id:'branch',name:'Branch',kind:'checkpoint'}];
      get('source').value=JSON.stringify(doc); get('source').dispatchEvent(new Event('input',{bubbles:true}));
      const select = (id,value) => {get(id).value=value;get(id).dispatchEvent(new Event('change'));};
      select('condition-step','branch'); select('condition-input','variable:total');
      get('condition-operation').value='greater-than'; get('condition-number').value='3'; get('condition-save').click();
      select('condition-input','approved'); get('condition-value').value='true';
      get('condition-combine').value='any'; get('condition-save').click();
      get('condition-negate').click(); get('condition-negate').click();
      const tree=JSON.parse(get('condition-expression').value);
      if(tree.not.not.any[1].input!=='approved') throw new Error('Missing compound condition');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool(); }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get=id=>document.querySelector('#skin-studio-'+id), before=get('source').value;
      const answer=document.querySelector('[data-simulation-input=approved]');
      answer.value='true'; answer.dispatchEvent(new Event('change'));
      if(!get('simulation-steps').children[1].textContent.includes('Waiting for variable assignment')) return false;
      get('simulation-steps').children[0].querySelector('button').click();
      get('simulation-steps').children[1].querySelector('button').click();
      return get('simulation-status').textContent.includes('Simulation complete') && get('source').value===before &&
          get('simulation-steps').children[1].textContent.includes('recorded decision');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get=id=>document.querySelector('#skin-studio-'+id);
      get('condition-step').value='branch'; get('condition-step').dispatchEvent(new Event('change'));
      return JSON.parse(get('condition-expression').value).not.not.any.length===2 && !get('simulation-steps').children.length;
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionCompoundChoicesStayRequiredAndRecordedAfterCheckpointReopen) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow; workflow.id="compound-flow"; workflow.name="Compound flow";
  workflow.inputs = {{"approved","Approved",tahai::TahaiOperationalWorkflowInputType::kBoolean,false,{}},
      {"scope","Scope",tahai::TahaiOperationalWorkflowInputType::kBoolean,false,{}}};
  workflow.steps = {{"branch","Branch",tahai::TahaiOperationalWorkflowStepKind::kCheckpoint}};
  tahai::TahaiWorkflowPredicate first; first.source_id="approved"; first.equals="true";
  auto second=first; second.source_id="scope";
  tahai::TahaiWorkflowPredicate group; group.operation="any"; group.arguments={first,second};
  workflow.steps[0].predicate=group;
  const auto created=service->CreateOperationalWorkflowMission(workflow,"review-skin",std::string(64,'a'),true); ASSERT_TRUE(created);
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id,"approved","true"));
  EXPECT_FALSE(service->SetOperationalWorkflowRunState(created->id,"running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiMissionURL,"Mission Control","Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-input-id=scope]').required").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-condition-status=unresolved]') !== null").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-condition-definition]').textContent.includes('any')").ExtractBool());
  {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,R"JS(
      const answer=document.querySelector('[data-tahai-input-id=scope]'); answer.value='false';
      answer.dispatchEvent(new Event('change',{bubbles:true}));
    )JS")); reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  for (const char* selector : {"[data-tahai-workflow-state=running]", "[data-tahai-mission-action=toggle-step][data-tahai-step-index=\"0\"]",
       "[data-tahai-mission-action=toggle-step][data-tahai-step-index=\"0\"]"}) {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,content::JsReplace("document.querySelector($1).click()",selector)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_FALSE(service->missions().back().steps[0].complete);
  EXPECT_EQ(true,service->missions().back().steps[0].variable_condition_result);
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-input-id=approved]').disabled").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-condition-status=taken]').textContent.includes('recorded decision')").ExtractBool());
  EXPECT_FALSE(service->SetOperationalWorkflowInputValue(created->id,"approved","false"));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioCalculationsPersistOnlyDefinitionsAndSimulateLocally) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      get('input-type').value = 'number'; get('input-type').dispatchEvent(new Event('change'));
      get('input-name').value = 'Amount'; get('input-upper').value = '4'; get('add-input').click();
      get('variable-name').value = 'Total'; get('variable-template').value = 'input-amount'; get('variable-add').click();
      document.querySelector('[data-workflow-variable-upper=variable-total]').value = '10';
      document.querySelector('[data-workflow-variable-limits=variable-total]').click();
      get('assignment-target').value = 'variable-total';
      get('calculation-operation').value = 'multiply'; get('calculation-operation').dispatchEvent(new Event('change'));
      get('calculation-left').value = 'input-amount'; get('calculation-left').dispatchEvent(new Event('change'));
      get('calculation-right').value = '$number'; get('calculation-right').dispatchEvent(new Event('change'));
      get('calculation-right-number').value = '2'; get('calculation-basic-save').click();
      get('output-name').value = 'Result'; get('output-input').value = 'variable:variable-total'; get('output-add').click();
      const workflow = JSON.parse(get('source').value).operational.workflows[0];
      if (workflow.steps[0].assign.expression.op !== 'multiply' || workflow.steps[0].assign.from ||
          workflow.variables[0].validation.maximum !== 10 || workflow.inputs[0].validation.maximum !== 4)
        throw new Error('Calculation definition not saved');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), original = get('source').value;
      const input = document.querySelector('[data-simulation-input=input-amount]');
      input.value = '3.125'; input.dispatchEvent(new Event('change'));
      get('simulation-steps').querySelector('button').click();
      if (!get('simulation-outputs').textContent.includes('6.25') || get('source').value !== original) return false;
      get('calculation-expression').value = '{"number":true}'; get('calculation-save').click();
      return get('source').value === original && !original.includes('3.125') && !original.includes('6.25');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), source = get('source').value;
      const assignment = JSON.parse(source).operational.workflows[0].steps[0].assign;
      return assignment.expression.op === 'multiply' && !assignment.from &&
          JSON.parse(get('calculation-expression').value).args[0].input === 'input-amount' &&
          get('calculation-operation').value === 'multiply' && get('calculation-left').value === 'input-amount' &&
          get('calculation-right').value === '$number' && get('calculation-right-number').value === '2' &&
          document.querySelector('[data-workflow-variable-upper=variable-total]').value === '10' &&
          get('simulation-outputs').children.length === 0 && !source.includes('6.25');
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioVariableLimitsRejectInvalidReadonlyAndStaleEdits) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      const control = key => document.querySelector('[data-workflow-variable-' + key + '=variable-total]');
      get('input-type').value = 'number'; get('input-type').dispatchEvent(new Event('change'));
      get('input-name').value = 'Amount'; get('input-upper').value = '4'; get('add-input').click();
      get('variable-name').value = 'Total'; get('variable-template').value = 'input-amount'; get('variable-add').click();
      const original = get('source').value, stale = control('limits'), low = control('lower');
      low.value = '5'; control('upper').value = '2'; stale.click();
      if (get('source').value !== original) return false;
      low.value = '1'; control('upper').value = '10'; stale.click();
      const saved = get('source').value, workflow = JSON.parse(saved).operational.workflows[0];
      if (workflow.variables[0].validation.minimum !== 1 || workflow.variables[0].validation.maximum !== 10 ||
          workflow.inputs[0].validation.maximum !== 4) return false;
      low.value = '99'; stale.dispatchEvent(new Event('click'));
      if (get('source').value !== saved || control('lower').getAttribute('aria-describedby') !== 'skin-studio-variable-limits-variable-total') return false;
      get('source').readOnly = true; get('source').dispatchEvent(new Event('input'));
      const disabled = ['lower', 'upper', 'limits'].every(key => control(key).disabled);
      control('limits').dispatchEvent(new Event('click'));
      const unchanged = get('source').value === saved;
      get('source').readOnly = false; get('source').dispatchEvent(new Event('input'));
      return disabled && unchanged;
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    document.querySelector('[data-workflow-variable-lower=variable-total]').value === '1' &&
    document.querySelector('[data-workflow-variable-upper=variable-total]').value === '10'
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioBasicCalculationsPreserveAdvancedTreesAndPrivacy) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), doc = JSON.parse(get('source').value);
      const workflow = doc.operational.workflows[0];
      workflow.inputs = [{id: 'amount', name: 'Amount', type: 'number', required: false},
          {id: 'private-number', name: 'Private number', type: 'number', required: false, protected: true}];
      workflow.variables = [{id: 'total', name: 'Total', type: 'number'}]; workflow.outputs = [];
      workflow.steps = [{id: 'calculate', name: 'Calculate', kind: 'assign-variable', assign: {variable: 'total',
          expression: {op: 'multiply', args: [{op: 'add', args: [{input: 'amount'}, {number: 1}]}, {number: 2}]}}}];
      get('source').value = JSON.stringify(doc); get('source').dispatchEvent(new Event('input', {bubbles: true}));
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), source = get('source'), original = source.value;
      if (get('calculation-operation').value || !get('calculation-basic-save').disabled ||
          !get('calculation-basic-status').textContent.includes('preserved') ||
          [...get('calculation-left').options].some(item => item.value === 'private-number')) return false;
      get('calculation-basic-save').dispatchEvent(new Event('click'));
      if (source.value !== original) return false;
      source.readOnly = true; source.dispatchEvent(new Event('input'));
      const disabled = ['operation', 'left', 'right', 'left-number', 'right-number', 'basic-save']
          .every(id => get('calculation-' + id).disabled);
      get('calculation-basic-save').dispatchEvent(new Event('click'));
      const unchanged = source.value === original;
      source.readOnly = false; source.dispatchEvent(new Event('input'));
      get('calculation-operation').value = 'value'; get('calculation-operation').dispatchEvent(new Event('change'));
      get('calculation-left').value = '$number'; get('calculation-left').dispatchEvent(new Event('change'));
      get('calculation-left-number').value = '1000000000001'; get('calculation-basic-save').click();
      return disabled && unchanged && source.value === original && get('calculation-right').disabled;
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    document.querySelector('#skin-studio-calculation-left-number').value = '3.5';
    document.querySelector('#skin-studio-calculation-basic-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      const expression = JSON.parse(get('source').value).operational.workflows[0].steps[0].assign.expression;
      return Object.keys(expression).length === 1 && expression.number === 3.5 &&
          get('calculation-operation').value === 'value' && get('calculation-left-number').value === '3.5' &&
          get('calculation-right').disabled;
    })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionCalculationsShowFailuresAndRequireFreshExplicitAssignment) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "calculation-workflow"; workflow.name = "Calculation workflow";
  workflow.inputs = {{"amount", "Amount", tahai::TahaiOperationalWorkflowInputType::kNumber, false, {}}};
  workflow.variables = {{"total", "Total", tahai::TahaiOperationalWorkflowInputType::kNumber, false, {}}};
  workflow.steps = {{"calculate", "Calculate", tahai::TahaiOperationalWorkflowStepKind::kAssignVariable}};
  tahai::TahaiWorkflowNumericExpression numerator; numerator.number = 6.25;
  tahai::TahaiWorkflowNumericExpression denominator; denominator.input_id = "amount";
  tahai::TahaiWorkflowNumericExpression expression; expression.operation = "divide"; expression.arguments = {numerator, denominator};
  workflow.steps[0].assignment = tahai::TahaiWorkflowAssignment{"total", {}, false, expression};
  workflow.outputs = {{"result", "Result", "total", true}};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created); ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  for (const auto& item : {std::pair{"", "missing-number"}, {"0", "division-by-zero"}}) {
    ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "amount", item.first));
    ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
        "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
    EXPECT_EQ(item.second, content::EvalJs(contents,
        "document.querySelector('[data-tahai-calculation-error]').dataset.tahaiCalculationError"));
    EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-variable-assign]').disabled").ExtractBool());
    const auto token = service->missions().back().mutation_token;
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
        "chrome.send('assignTahaiWorkflowVariable', [$1, 0, document.querySelector('[data-tahai-variable-assign]').dataset.tahaiRunToken])", created->id)));
    ASSERT_TRUE(base::test::RunUntil([&] {
      return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('Variable not changed')").ExtractBool();
    }));
    EXPECT_EQ(token, service->missions().back().mutation_token);
    EXPECT_TRUE(service->missions().back().workflow_variables[0].value.empty());
    EXPECT_FALSE(service->missions().back().steps[0].complete);
  }
  // Editing the source in another view invalidates this document's action token.
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "amount", "2"));
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('#mission-status').textContent = ''"));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('assignTahaiWorkflowVariable', [$1, 0, document.querySelector('[data-tahai-variable-assign]').dataset.tahaiRunToken])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('Variable not changed')").ExtractBool();
  }));
  EXPECT_TRUE(service->missions().back().workflow_variables[0].value.empty());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-calculation-error]') === null").ExtractBool());
  EXPECT_EQ("Not set", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-variable=total]').textContent"));
  for (const char* selector : {"[data-tahai-variable-assign]", "[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("document.querySelector($1).click()", selector)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("3.125", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-output=result]').textContent"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("3.125", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-variable=total]').textContent"));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-variable-assign]').disabled").ExtractBool());
  EXPECT_FALSE(service->AssignWorkflowVariable(created->id, 0));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioTextExpressionsAuthorSimulateAndRestoreOnlyDefinitions) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id);
      get('input-type').value = 'text'; get('input-type').dispatchEvent(new Event('change'));
      get('input-name').value = 'Source'; get('add-input').click();
      get('variable-template').value = 'input-source'; get('variable-name').value = 'Result'; get('variable-add').click();
      get('assignment-target').value = 'variable-result'; get('assignment-target').dispatchEvent(new Event('change'));
      get('text-operation').value = 'concat'; get('text-operation').dispatchEvent(new Event('change'));
      get('text-first').value = 'input-source'; get('text-first').dispatchEvent(new Event('change'));
      get('text-second').value = '$text'; get('text-second').dispatchEvent(new Event('change'));
      get('text-second-constant').value = ' ready'; get('text-basic-save').click();
      get('output-name').value = 'Final'; get('output-input').value = 'variable:variable-result'; get('output-add').click();
      if (JSON.parse(get('source').value).operational.workflows[0].steps[0].assign.text_expression.op !== 'concat') throw new Error('Text definition not saved');
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents, "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();
  }));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => {
      const get = id => document.querySelector('#skin-studio-' + id), original = get('source').value;
      const input = document.querySelector('[data-simulation-input=input-source]'); input.value = 'fixture'; input.dispatchEvent(new Event('change'));
      get('simulation-steps').querySelector('button').click();
      if (!get('simulation-outputs').textContent.includes('fixture ready') || get('source').value !== original) return false;
      get('text-expression').value = '{"text":true}'; get('text-save').click();
      return get('source').value === original && !original.includes('fixture');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (() => { const get = id => document.querySelector('#skin-studio-' + id);
      return get('text-operation').value === 'concat' && get('text-first').value === 'input-source' &&
          get('text-second-constant').value === ' ready' && get('simulation-outputs').children.length === 0 && !get('source').value.includes('fixture'); })()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiFailedMissionRecoveryReviewRequiresFreshGestureAndNeverResumes) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow; workflow.id = "recovery-native"; workflow.name = "Recovery native";
  workflow.steps = {{"dispatch", "Dispatch", tahai::TahaiOperationalWorkflowStepKind::kRunCommand, "address.focus"}};
  workflow.compensation_steps = {{"confirm-authority", "Confirm actual authority"},
                                 {"record-outcome", "Record actual outcome"}};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created); const auto id = created->id;
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(id, "running"));
  ASSERT_TRUE(service->BeginNativeWorkflowStep(id, 0));
  ASSERT_TRUE(service->FinishNativeWorkflowStep(id, 0, "unknown"));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  const auto old_token = service->missions().back().mutation_token;
  EXPECT_FALSE(content::EvalJs(contents, "navigator.userActivation.isActive", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('toggleTahaiRollbackStep',[$1,0,$2])", id, old_token), content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const recovery=document.querySelector('[data-tahai-mission-action=toggle-rollback]');
      return !recovery.disabled&&recovery.textContent==='Mark reviewed'&&
        document.body.textContent.includes('Confirm actual authority')&&
        document.querySelector('[data-tahai-recovery-notice]').textContent.includes('never executes rollback')&&
        document.querySelector('[data-tahai-mission-action=toggle-step]').disabled&&
        document.querySelector('[data-tahai-mission-action=toggle-validation]').disabled;
    })()
  )JS", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  EXPECT_FALSE(service->missions().back().rollback_steps[0].complete);
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-mission-action=toggle-rollback]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  const auto& run = service->missions().back();
  EXPECT_TRUE(run.rollback_steps[0].complete); EXPECT_FALSE(run.steps[0].complete);
  ASSERT_EQ(2u, run.rollback_steps.size());
  EXPECT_EQ("Confirm actual authority", run.rollback_steps[0].label);
  EXPECT_EQ("Record actual outcome", run.rollback_steps[1].label);
  EXPECT_EQ("unknown", run.steps[0].action_state); EXPECT_EQ("failed", run.operational_workflow->run_state);
  EXPECT_TRUE(run.timeline.front().detail.starts_with("Recovery review completed: "));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('toggleTahaiRollbackStep',[$1,0,$2])", id, old_token)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#mission-status').textContent.includes('Mission not changed')").ExtractBool(); }));
  EXPECT_TRUE(run.rollback_steps[0].complete);
  EXPECT_FALSE(service->BeginNativeWorkflowStep(id, 0)); EXPECT_FALSE(service->SetOperationalWorkflowRunState(id, "running"));
  ASSERT_TRUE(service->ArchiveMission(id));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-mission-action=toggle-rollback]').disabled").ExtractBool());
  EXPECT_FALSE(service->ToggleRollbackStep(id, 0));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioNestedConditionsEditSaveAndRejectStaleControls) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  const size_t missions_before = service->missions().size();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const get=id=>document.querySelector('#skin-studio-'+id);
      const source=get('source'),doc=JSON.parse(source.value),workflow=doc.operational.workflows[0];
      const originalSend=chrome.send;window.conditionMessages=[];
      chrome.send=(name,args)=>{window.conditionMessages.push(name);return originalSend(name,args)};
      workflow.inputs=[{id:'flag',name:'Flag',type:'boolean',required:false},
        {id:'amount',name:'Amount',type:'number',required:false},
        {id:'secret',name:'Secret',type:'number',required:false,protected:true}];
      workflow.variables=[];delete workflow.outputs;delete workflow.repeats;
      workflow.steps=[{id:'review',name:'Review',kind:'checkpoint',when:{all:[{input:'flag',equals:'true'},
        {not:{any:[{input:'flag',equals:'false'},{input:'amount',compare:{op:'at-least',number:2}}]}}]}},
        {id:'other',name:'Other',kind:'checkpoint',when:{input:'flag',equals:'false'}}];
      source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input',{bubbles:true}));
      const change=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new Event('change'))};
      const button=(path,action)=>Array.from(get('condition-tree').querySelectorAll('button')).find(b=>b.dataset.conditionNode===path&&b.dataset.conditionEdit===action);
      change('condition-step','review');
      const before=source.value;if(!get('condition-tree-status').textContent.startsWith('6 of 31'))return false;
      change('condition-input','amount');change('condition-operation','less-than');get('condition-number').value='7';
      const stale=button('all/1/not/any/1','replace');stale.click();
      let condition=JSON.parse(source.value).operational.workflows[0].steps[0].when;
      if(condition.all[1].not.any[1].compare.number!==7||source.value===before||
          document.activeElement!==button('all/1/not/any/1','replace'))return false;
      const edited=source.value;stale.click();if(source.value!==edited)return false;
      button('all/1/not/any/0','remove').click();
      condition=JSON.parse(source.value).operational.workflows[0].steps[0].when;
      if(condition.all[1].not.input!=='amount'||condition.all[1].not.compare.number!==7)return false;
      const detached=button('all/1','negate');change('condition-step','other');const switched=source.value;
      detached.click();if(source.value!==switched)return false;change('condition-step','review');
      const control=button('all/1','negate');source.readOnly=true;control.dispatchEvent(new Event('click'));
      if(source.value!==switched)return false;source.readOnly=false;
      const protectedSource=document.createElement('option');protectedSource.value='secret';get('condition-input').append(protectedSource);
      get('condition-input').value='secret';button('','replace').click();if(source.value!==switched)return false;
      source.dispatchEvent(new Event('input',{bubbles:true}));
      get('save').click();
      return window.conditionMessages.every(name=>name==='saveTahaiSkinStudioDraft');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool(); }));
  const auto draft = tahai::LoadTahaiSkinStudioDraft(browser()->GetProfile()->GetPrefs());
  ASSERT_EQ(tahai::TahaiSkinStudioDraftStatus::kOk, draft.status);
  auto manifest = base::JSONReader::ReadDict(draft.manifest_json, base::JSON_PARSE_RFC);
  ASSERT_TRUE(manifest);
  tahai::TahaiOperationalSkinManifest parsed;
  ASSERT_EQ(tahai::TahaiOperationalSkinManifestValidationResult::kValid,
            tahai::ValidateTahaiOperationalSkinManifest(*manifest, &parsed));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const source=document.querySelector('#skin-studio-source'),before=source.value;
      const condition=JSON.parse(before).operational.workflows[0].steps[0].when;
      const tree=document.querySelector('#skin-studio-condition-tree');
      return condition.all[1].not.compare.number===7&&condition.all[1].not.compare.op==='less-than'&&
          tree.textContent.includes('Input: Amount is less than 7')&&source.value===before;
    })()
  )JS").ExtractBool());
  EXPECT_EQ(missions_before, service->missions().size());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioSimulationTraceIsBoundedPrivateAndInert) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  const size_t missions_before = service->missions().size();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const originalSend=chrome.send;window.traceMessages=[];
      chrome.send=(name,args)=>{window.traceMessages.push(name);return originalSend(name,args)};
      const source=document.querySelector('#skin-studio-source'),doc=JSON.parse(source.value),workflow=doc.operational.workflows[0];
      workflow.inputs=[{id:'private-source',name:'Private',type:'text',protected:true,required:false}];
      workflow.variables=[{id:'private-copy',name:'Private copy',type:'text',protected:true}];
      workflow.steps=[{id:'copy--source',name:'Copy',kind:'assign-variable',assign:{variable:'private-copy',from:{input:'private-source'}}},
        {id:'delay',name:'Delay',kind:'wait',wait:{seconds:1,timeout_seconds:3}},
        {id:'dispatch',name:'Dispatch',kind:'run-command',action:'mission.open'}];
      source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input',{bubbles:true}));
      const input=document.querySelector('[data-simulation-input=private-source]');
      input.value='TRACE-PRIVATE-SENTINEL';input.dispatchEvent(new Event('change'));
      const before=source.value,trace=document.querySelector('#skin-studio-simulation-trace');
      const action=(index,label)=>Array.from(document.querySelector('#skin-studio-simulation-steps').children[index].querySelectorAll('button')).find(b=>!label||b.textContent===label);
      action(0).click();action(1).click();action(1).click();
      const failure=action(2,'Simulate unknown outcome');failure.click();
      const kinds=Array.from(trace.children,r=>r.dataset.simulationTraceKind);
      const correct=JSON.stringify(kinds)===JSON.stringify(['assignment-completed','wait-started','wait-completed','action-unknown']);
      const status=document.querySelector('#skin-studio-simulation-status').textContent;
      const privateSafe=!trace.textContent.includes('TRACE-PRIVATE-SENTINEL')&&input.value===''&&source.value===before;
      failure.click();if(trace.children.length!==4)return false;
      document.querySelector('#skin-studio-simulation-trace-clear').click();
      const cleared=trace.children.length===0&&document.querySelector('#skin-studio-simulation-status').textContent===status;
      document.querySelector('#skin-studio-simulation-reset').click();failure.click();
      return correct&&privateSafe&&cleared&&trace.children.length===0&&source.value===before;
    })()
  )JS").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    (function(){
      const source=document.querySelector('#skin-studio-source'),doc=JSON.parse(source.value),workflow=doc.operational.workflows[0];
      workflow.inputs=[];workflow.variables=[{id:'total',name:'Total',type:'number'}];
      workflow.steps=[{id:'calculate',name:'Calculate',kind:'assign-variable',assign:{variable:'total',expression:{op:'divide',args:[{number:1},{number:0}]}}}];
      source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('#skin-studio-simulate').click();
      const before=source.value,button=document.querySelector('#skin-studio-simulation-steps button'),trace=document.querySelector('#skin-studio-simulation-trace');
      for(let i=0;i<140;++i)button.click();
      const bounded=trace.children.length===128&&trace.firstElementChild.textContent.startsWith('13. ')&&trace.lastElementChild.textContent.startsWith('140. ');
      const fixed=Array.from(trace.children).every(row=>row.dataset.simulationTraceKind==='assignment-blocked');
      const explained=document.querySelector('#skin-studio-simulation-trace-status').textContent.includes('Older events were omitted');
      source.dispatchEvent(new Event('input',{bubbles:true}));button.click();
      return bounded&&fixed&&explained&&trace.children.length===0&&source.value===before&&
        window.traceMessages.every(name=>name==='saveTahaiSkinStudioDraft');
    })()
  )JS").ExtractBool());
  EXPECT_EQ(missions_before, service->missions().size());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiBooleanAssignmentsAuthorSaveAndRunWithoutAutomaticEffects) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const source=document.querySelector('#skin-studio-source'), doc=JSON.parse(source.value);
    const workflow=doc.operational.workflows[0];
    workflow.inputs=[{id:'flag',name:'Flag',type:'boolean',required:false}];
    workflow.variables=[{id:'result',name:'Result',type:'boolean'}];
    workflow.steps=[{id:'calculate',name:'Calculate',kind:'checkpoint',when:{input:'flag',equals:'true'}}];
    workflow.outputs=[{id:'final',name:'Final',from:{variable:'result'}}];
    source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input',{bubbles:true}));
    const steps=document.querySelector('#skin-studio-condition-step');steps.value='calculate';steps.dispatchEvent(new Event('change'));
    const target=document.querySelector('#skin-studio-assignment-target');target.value='result';target.dispatchEvent(new Event('change'));
    document.querySelector('#skin-studio-boolean-from-condition').click();
    document.querySelector('#skin-studio-save').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool(); }));
  const auto draft = tahai::LoadTahaiSkinStudioDraft(browser()->GetProfile()->GetPrefs());
  ASSERT_EQ(tahai::TahaiSkinStudioDraftStatus::kOk, draft.status);
  auto manifest = base::JSONReader::ReadDict(draft.manifest_json, base::JSON_PARSE_RFC);
  ASSERT_TRUE(manifest); tahai::TahaiOperationalSkinManifest parsed;
  ASSERT_EQ(tahai::TahaiOperationalSkinManifestValidationResult::kValid,
            tahai::ValidateTahaiOperationalSkinManifest(*manifest, &parsed));
  ASSERT_TRUE(parsed.workflows.front().steps.front().assignment);
  ASSERT_TRUE(parsed.workflows.front().steps.front().assignment->boolean_expression);
  EXPECT_TRUE(parsed.workflows.front().steps.front().condition_input_id.empty());
  // Reopening Studio retains definitions, never simulator values or execution.
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  EXPECT_EQ("flag", content::EvalJs(contents,
      "JSON.parse(document.querySelector('#skin-studio-source').value).operational.workflows[0].steps[0].assign.boolean_expression.input"));
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  const auto created = service->CreateOperationalWorkflowMission(parsed.workflows.front(), "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created); ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("missing-condition-value", content::EvalJs(contents, "document.querySelector('[data-tahai-calculation-error]').dataset.tahaiCalculationError"));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-variable-assign]').disabled").ExtractBool());
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "flag", "false"));
  EXPECT_TRUE(service->missions().back().workflow_variables[0].value.empty());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-variable-assign]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("false", service->missions().back().workflow_variables[0].value);
  EXPECT_TRUE(service->missions().back().steps[0].complete);
  EXPECT_FALSE(service->AssignWorkflowVariable(created->id, 0));
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "flag", "true"));
  EXPECT_EQ("false", service->missions().back().workflow_variables[0].value);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionTextExpressionsShowFixedErrorsAndRequireExplicitAssignment) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow; workflow.id = "text-work"; workflow.name = "Text work";
  workflow.inputs = {{"source", "Source", tahai::TahaiOperationalWorkflowInputType::kText, false, {}}};
  workflow.variables = {{"result", "Result", tahai::TahaiOperationalWorkflowInputType::kText, false, {}}};
  workflow.steps = {{"format", "Format", tahai::TahaiOperationalWorkflowStepKind::kAssignVariable}};
  tahai::TahaiWorkflowTextExpression input; input.input_id = "source";
  tahai::TahaiWorkflowTextExpression expression; expression.operation = "upper-ascii"; expression.arguments = {input};
  workflow.steps[0].assignment = tahai::TahaiWorkflowAssignment{"result", {}, false, {}, expression};
  workflow.outputs = {{"final", "Final", "result", true}};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true);
  ASSERT_TRUE(created); ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id, "running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("missing-text", content::EvalJs(contents, "document.querySelector('[data-tahai-calculation-error]').dataset.tahaiCalculationError"));
  EXPECT_TRUE(content::EvalJs(contents, "document.querySelector('[data-tahai-variable-assign]').disabled").ExtractBool());
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id, "source", "local fixture"));
  // A source edit invalidates the old document's assignment token.
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('assignTahaiWorkflowVariable', [$1, 0, document.querySelector('[data-tahai-variable-assign]').dataset.tahaiRunToken])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#mission-status').textContent.includes('Variable not changed')").ExtractBool(); }));
  EXPECT_TRUE(service->missions().back().workflow_variables[0].value.empty());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  for (const char* selector : {"[data-tahai-variable-assign]", "[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("document.querySelector($1).click()", selector)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("LOCAL FIXTURE", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-output=final]').textContent"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("LOCAL FIXTURE", content::EvalJs(contents, "document.querySelector('[data-tahai-workflow-variable=result]').textContent"));
  EXPECT_FALSE(service->AssignWorkflowVariable(created->id, 0));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionChecklistsRequireCurrentDocumentGestureAndFreshToken) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  const auto created = service->CreateMission("Checklist controls", "incident"); ASSERT_TRUE(created);
  const auto id = created->id; const auto token = service->missions().back().mutation_token;
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  EXPECT_FALSE(content::EvalJs(contents, "navigator.userActivation.isActive", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('toggleTahaiMissionStep', [$1, 0, $2])", id, token), content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  EXPECT_FALSE(service->missions().back().steps[0].complete);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('toggleTahaiMissionStep', [$1, 0, $2])", id, token)));
  EXPECT_FALSE(service->missions().back().steps[0].complete);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  ASSERT_TRUE(service->ToggleValidationStep(id, 1));
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-mission-action=toggle-step]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#mission-status').textContent.includes('Mission not changed')").ExtractBool(); }));
  EXPECT_FALSE(service->missions().back().steps[0].complete);
  for (const auto& action : {std::pair{"toggle-step", "toggleTahaiMissionStep"},
                            {"toggle-validation", "toggleTahaiValidationStep"}, {"toggle-rollback", "toggleTahaiRollbackStep"}}) {
    ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
        "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
    const auto current = service->missions().back().mutation_token;
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
      const button = document.querySelector('[data-tahai-mission-action=' + $1 + ']');
      button.click(); chrome.send($2, [$3, 0, $4]);
    )JS", action.first, action.second, id, current)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
    EXPECT_TRUE(service->missions().back().steps[0].complete);
    if (std::string_view(action.first) != "toggle-step") EXPECT_TRUE(service->missions().back().validation_steps[0].complete);
    if (std::string_view(action.first) == "toggle-rollback") EXPECT_TRUE(service->missions().back().rollback_steps[0].complete);
    else EXPECT_FALSE(service->missions().back().rollback_steps[0].complete);
    EXPECT_NE(current, service->missions().back().mutation_token);
  }
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionStateControlsRejectStaleAndAutomaticTransitions) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow; workflow.id = "state-work"; workflow.name = "State work";
  workflow.steps = {{"review", "Review", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint}};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'), true); ASSERT_TRUE(created);
  const auto id = created->id; const auto initial = service->missions().back().mutation_token;
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  EXPECT_FALSE(content::EvalJs(contents, "navigator.userActivation.isActive", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('setTahaiOperationalWorkflowState', [$1, 'running', $2])", id, initial), content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  EXPECT_EQ("ready", service->missions().back().operational_workflow->run_state);
  content::TestNavigationObserver reload(contents, 1);
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
    document.querySelector('[data-tahai-workflow-state=running]').click();
    chrome.send('setTahaiOperationalWorkflowState', [$1, 'cancelled', $2]);
  )JS", id, initial)));
  reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  EXPECT_EQ("running", service->missions().back().operational_workflow->run_state);
  const auto current = service->missions().back().mutation_token;
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('setTahaiOperationalWorkflowState', [$1, 'paused'])", id)));
  EXPECT_EQ(current, service->missions().back().mutation_token);
  ASSERT_TRUE(service->ToggleStep(id, 0));
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-workflow-state=paused]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "document.querySelector('#mission-status').textContent.includes('Mission not changed')").ExtractBool(); }));
  EXPECT_EQ("running", service->missions().back().operational_workflow->run_state);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  content::TestNavigationObserver complete(contents, 1);
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-workflow-state=succeeded]').click()"));
  complete.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  EXPECT_EQ("succeeded", service->missions().back().operational_workflow->run_state);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionMetadataControlsRejectStaleViewsAndDuplicateSubmissions) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  const auto created = service->CreateMission("Metadata controls", "incident"); ASSERT_TRUE(created);
  const auto archived = service->CreateMission("Archived controls", "incident"); ASSERT_TRUE(archived);
  ASSERT_TRUE(service->ArchiveMission(archived->id));
  const auto id = created->id;
  const auto current_run = [&]() -> const tahai::MissionSummary& {
    return *std::ranges::find(service->missions(), id, &tahai::MissionSummary::id);
  };
  const auto navigate = [&] { return NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."); };
  ASSERT_TRUE(navigate()); const auto stale = current_run().mutation_token;
  const auto archived_stale = service->missions().back().mutation_token;
  ASSERT_TRUE(service->AddLocalNote(id, "Changed in another view"));
  ASSERT_TRUE(service->RestoreMission(archived->id)); ASSERT_TRUE(service->ArchiveMission(archived->id));
  const auto saved = browser()->GetProfile()->GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  for (const auto& request : {std::pair{"toggleTahaiEscalation", ""}, {"addTahaiEvidenceMarker", ""},
      {"addTahaiMissionNote", "Must not be stored"}, {"setTahaiExportProfile", "internal"},
      {"archiveTahaiMission", ""}, {"duplicateTahaiMission", ""}, {"restoreTahaiMission", ""}, {"deleteTahaiMission", ""}}) {
    const bool archived_target = std::string_view(request.first) == "restoreTahaiMission" || std::string_view(request.first) == "deleteTahaiMission";
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
        "document.querySelector('#mission-status').textContent=''; chrome.send($1, [$2, $3, $4])",
        request.first, archived_target ? archived->id : id, request.second, archived_target ? archived_stale : stale)));
    ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
        "document.querySelector('#mission-status').textContent.includes('Mission not changed')").ExtractBool(); }));
    EXPECT_EQ(saved, browser()->GetProfile()->GetPrefs()->GetList(prefs::kTahaiMissions));
  }
  for (const char* action : {"add-note", "add-evidence", "toggle-escalation", "export", "archive", "restore"}) {
    ASSERT_TRUE(navigate()); content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
      (() => { const card=document.querySelector('article[data-tahai-mission-id="'+$1+'"]');
        if ($2==='export') { const select=card.querySelector('[data-tahai-export-profile]'); select.value='internal'; select.dispatchEvent(new Event('change',{bubbles:true})); }
        else { const button=card.querySelector('[data-tahai-mission-action="'+$2+'"]');
          if($2==='add-note') document.getElementById(button.dataset.tahaiNoteInput).value='Reviewed local note'; button.click(); }
      })();
    )JS", id, action)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ(2u, current_run().notes.size()); EXPECT_EQ("Reviewed local note", current_run().notes.back().text);
  EXPECT_EQ(1u, current_run().evidence.size()); EXPECT_TRUE(current_run().escalation_required);
  EXPECT_EQ("internal", current_run().export_profile); EXPECT_FALSE(current_run().archived);
  ASSERT_TRUE(navigate()); const size_t before = service->missions().size(); const auto token = current_run().mutation_token;
  content::TestNavigationObserver duplicate(contents, 1);
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
    document.querySelector('article[data-tahai-mission-id="'+$1+'"] [data-tahai-mission-action=duplicate]').click();
    chrome.send('duplicateTahaiMission', [$1, '', $2]);
  )JS", id, token)));
  duplicate.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents)); EXPECT_EQ(before + 1, service->missions().size());
  EXPECT_EQ(2u, current_run().notes.size());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionCreationAndMetadataRequireDocumentGestureAndOneSubmission) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  const auto created = service->CreateMission("Original record", "incident"); ASSERT_TRUE(created);
  const auto id = created->id, token = service->missions().back().mutation_token; const auto initial = service->missions().size();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  EXPECT_FALSE(content::EvalJs(contents, "navigator.userActivation.isActive", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
    chrome.send('createTahaiMission', ['Automatic record', 'incident']);
    chrome.send('addTahaiMissionNote', [$1, 'Automatic note', $2]);
    chrome.send('archiveTahaiMission', [$1, '', $2]);
  )JS", id, token), content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  EXPECT_EQ(initial, service->missions().size()); EXPECT_TRUE(service->missions().back().notes.empty()); EXPECT_FALSE(service->missions().back().archived);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
    chrome.send('createTahaiMission', ['Wrong document', 'incident']);
    chrome.send('addTahaiEvidenceMarker', [$1, '', $2]);
    chrome.send('duplicateTahaiMission', [$1, '', $2]);
  )JS", id, token)));
  EXPECT_EQ(initial, service->missions().size()); EXPECT_TRUE(service->missions().back().evidence.empty());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  content::TestNavigationObserver reload(contents, 1);
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const form=document.querySelector('#new-mission-form'); form.querySelector('[name=title]').value='Explicit record';
    form.querySelector('[name=type]').value='incident'; form.requestSubmit(); form.requestSubmit();
  )JS"));
  reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  ASSERT_EQ(initial + 1, service->missions().size()); EXPECT_EQ("Explicit record", service->missions().back().title);
  // A new document is not permanently locked by the previous submission.
  content::TestNavigationObserver another(contents, 1);
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const form=document.querySelector('#new-mission-form'); form.querySelector('[name=title]').value='Next explicit record'; form.requestSubmit();
  )JS"));
  another.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents)); EXPECT_EQ(initial + 2, service->missions().size());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionConsumesEachLaunchAndKeepsRequiredChoiceUnset) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  const size_t initial_count = service->missions().size();
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "research-workflow";
  workflow.name = "Review workflow";
  workflow.inputs = {{"confirmed", "Confirmed",
                      tahai::TahaiOperationalWorkflowInputType::kBoolean,
                      true, {}}};
  workflow.steps = {{"review", "Review result",
                     tahai::TahaiOperationalWorkflowStepKind::kCheckpoint,
                     {}, "confirmed", "true"}};
  for (size_t run = 0; run < 2u; ++run) {
    ASSERT_TRUE(tahai::QueueOperationalWorkflowLaunch(
        browser()->GetProfile(), workflow, "research-skin", std::string(64u, 'b')));
    ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
        contents, tahai::kTahaiMissionURL, "Mission Control",
        "Real tabs. Real WebContents. Bounded mission state."));
    ASSERT_EQ(initial_count + run + 1u, service->missions().size());
    EXPECT_FALSE(tahai::GetQueuedOperationalWorkflowLaunch(browser()->GetProfile()));
    EXPECT_EQ("", content::EvalJs(contents,
        "[...document.querySelectorAll('[data-tahai-workflow-input=true]')]"
        ".at(-1).value"));
    EXPECT_EQ("waiting-for-input",
              service->missions().back().operational_workflow->run_state);
  }
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionDateAndUrlControlsPersistWithoutNavigationOrExport) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "typed-workflow";
  workflow.name = "Typed workflow";
  workflow.inputs = {
      {"review-day", "Review day", tahai::TahaiOperationalWorkflowInputType::kDate, true, {}},
      {"reference", "Reference site", tahai::TahaiOperationalWorkflowInputType::kUrl, true, {}}};
  workflow.steps = {{"review", "Review result",
                     tahai::TahaiOperationalWorkflowStepKind::kCheckpoint, {}}};
  ASSERT_TRUE(tahai::QueueOperationalWorkflowLaunch(
      browser()->GetProfile(), workflow, "review-skin", std::string(64, 'b')));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiMissionURL, "Mission Control",
      "Real tabs. Real WebContents. Bounded mission state."));
  const auto tab_count = browser()->GetTabStripModel()->count();
  const GURL mission_url = contents->GetVisibleURL();
  EXPECT_EQ("date", content::EvalJs(contents,
      "document.querySelector('[data-tahai-input-id=review-day]').type"));
  EXPECT_EQ("url", content::EvalJs(contents,
      "document.querySelector('[data-tahai-input-id=reference]').type"));
  EXPECT_TRUE(content::EvalJs(contents,
      "document.querySelector('[data-tahai-input-id=review-day]').required && "
      "document.querySelector('[data-tahai-input-id=reference]').required").ExtractBool());
  for (const auto& [input, value] : {
           std::pair("review-day", "2032-02-29"),
           std::pair("reference", "https://example.test/local-reference?q=private-review#notes")}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"(
      const control = document.querySelector('[data-tahai-input-id=' + $1 + ']');
      control.value = $2;
      control.dispatchEvent(new Event('change', {bubbles: true}));
    )", input, value)));
    reload.Wait();
    ASSERT_TRUE(content::WaitForLoadStop(contents));
    EXPECT_EQ(value, content::EvalJs(contents, content::JsReplace(
        "document.querySelector('[data-tahai-input-id=' + $1 + ']').value", input)));
    EXPECT_EQ(mission_url, contents->GetVisibleURL());
    EXPECT_EQ(tab_count, browser()->GetTabStripModel()->count());
  }
  ASSERT_EQ(2u, service->missions().back().workflow_inputs.size());
  EXPECT_EQ("2032-02-29", service->missions().back().workflow_inputs[0].value);
  const std::string reference = "https://example.test/local-reference?q=private-review#notes";
  EXPECT_EQ(reference, service->missions().back().workflow_inputs[1].value);
  EXPECT_TRUE(content::EvalJs(contents, content::JsReplace(R"(
    (() => {
      const previews = [...document.querySelectorAll('[data-tahai-evidence-preview=true]')];
      return previews.length > 0 && previews.every(
        view => !view.textContent.includes($1) && !view.textContent.includes('2032-02-29'));
    })()
  )", reference)).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, R"(
    const control = document.querySelector('[data-tahai-input-id=reference]');
    control.value = 'https://user:pass@example.test/';
    control.dispatchEvent(new Event('change', {bubbles: true}));
  )"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#mission-status').textContent.includes('not stored')").ExtractBool();
  }));
  EXPECT_EQ(reference, service->missions().back().workflow_inputs[1].value);
  EXPECT_EQ(mission_url, contents->GetVisibleURL());
  EXPECT_EQ(tab_count, browser()->tab_strip_model()->count());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionNamedOutputsRequireSuccessStayLocalAndMaskProtectedValues) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "output-workflow";
  workflow.name = "Output workflow";
  workflow.inputs = {
      {"reference", "Reference", tahai::TahaiOperationalWorkflowInputType::kUrl, true, {}},
      {"private-input", "Private", tahai::TahaiOperationalWorkflowInputType::kText, true, {}, true}};
  workflow.steps = {{"review", "Review result", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint, {}}};
  workflow.outputs = {{"result", "Result", "reference"}, {"private-result", "Private result", "private-input"}};
  const auto created = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'));
  ASSERT_TRUE(created);
  base::test::TestFuture<bool> ready;
  service->PrepareProtectedWorkflowInputs(g_browser_process->os_crypt_async(), ready.GetCallback());
  ASSERT_TRUE(ready.Get());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  const int tabs = browser()->GetTabStripModel()->count();
  const GURL mission_url = contents->GetVisibleURL();
  const std::string reference = "https://example.test/local-result?q=private-review#notes";
  const std::string secret = "password=fixture-only:@/private-output";
  for (const auto& [id, value] : {std::pair("reference", reference), std::pair("private-input", secret)}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"(
      (() => {
        const control = document.querySelector('[data-tahai-input-id=' + $1 + ']');
        control.value = $2; control.dispatchEvent(new Event('change', {bubbles: true}));
      })();
    )", id, value)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("Available after workflow success", content::EvalJs(contents,
      "document.querySelector('[data-tahai-workflow-output=result]').textContent"));
  for (const char* selector : {"[data-tahai-workflow-state=running]",
      "[data-tahai-mission-action=toggle-step][data-tahai-step-index='0']",
      "[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("document.querySelector($1).click()", selector)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ(reference, content::EvalJs(contents,
      "document.querySelector('[data-tahai-workflow-output=result]').textContent"));
  EXPECT_EQ("Protected result retained (masked)", content::EvalJs(contents,
      "document.querySelector('[data-tahai-workflow-output=private-result]').textContent"));
  const std::string cipher = service->missions().back().workflow_inputs[1].protected_value;
  EXPECT_TRUE(content::EvalJs(contents, content::JsReplace(R"(
    !document.documentElement.outerHTML.includes($1) && !document.documentElement.outerHTML.includes($2) &&
    !document.querySelector('[data-tahai-workflow-output] a') &&
    [...document.querySelectorAll('[data-tahai-evidence-preview=true]')].every(view => !view.textContent.includes($3))
  )", secret, cipher, reference)).ExtractBool());
  EXPECT_EQ(mission_url, contents->GetVisibleURL());
  EXPECT_EQ(tabs, browser()->GetTabStripModel()->count());
  EXPECT_FALSE(service->SetOperationalWorkflowInputValue(created->id, "reference", "https://other.test/"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ(reference, content::EvalJs(contents,
      "document.querySelector('[data-tahai-workflow-output=result]').textContent"));
  for (const char* state : {"failed", "cancelled"}) {
    for (auto& input : workflow.inputs) input.required = false;
    const auto stopped = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'));
    ASSERT_TRUE(stopped);
    ASSERT_TRUE(service->SetOperationalWorkflowRunState(stopped->id, "running"));
    ASSERT_TRUE(service->SetOperationalWorkflowRunState(stopped->id, state));
    ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
        "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
    EXPECT_EQ("No result: workflow did not succeed", content::EvalJs(contents, content::JsReplace(
        "document.querySelector('[data-tahai-workflow-output=result][data-tahai-mission-id=\"' + $1 + '\"]').textContent", stopped->id)));
  }
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionInputLimitsAreExplainedAndEnforcedByNativeService) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "bounded-workflow";
  workflow.name = "Bounded workflow";
  workflow.inputs = {{"amount", "Amount", tahai::TahaiOperationalWorkflowInputType::kNumber, true, {}}};
  workflow.inputs[0].validation = tahai::TahaiWorkflowInputValidation{{}, {}, 2.0, 4.0};
  workflow.steps = {{"review", "Review result", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint, {}}};
  ASSERT_TRUE(tahai::QueueOperationalWorkflowLaunch(
      browser()->GetProfile(), workflow, "review-skin", std::string(64, 'a')));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_TRUE(content::EvalJs(contents, R"(
    (() => {
      const control = document.querySelector('[data-tahai-input-id=amount]');
      return control.min === '2' && control.max === '4' &&
          document.getElementById(control.getAttribute('aria-describedby')).textContent.includes('Inclusive numeric limits: 2 to 4');
    })()
  )").ExtractBool());
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, R"(
      (() => {
        const control = document.querySelector('[data-tahai-input-id=amount]');
        control.value = '3'; control.dispatchEvent(new Event('change', {bubbles: true}));
      })();
    )"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  const auto saved = browser()->GetProfile()->GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  ASSERT_TRUE(content::ExecJs(contents, R"(
    (() => {
      const control = document.querySelector('[data-tahai-input-id=amount]');
      control.removeAttribute('min'); control.removeAttribute('max');
      control.value = '5'; control.dispatchEvent(new Event('change', {bubbles: true}));
    })();
  )"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(contents,
        "document.querySelector('#mission-status').textContent.includes('not stored')").ExtractBool();
  }));
  EXPECT_EQ(saved, browser()->GetProfile()->GetPrefs()->GetList(prefs::kTahaiMissions));
  EXPECT_EQ("3", service->missions().back().workflow_inputs[0].value);
  tahai::MissionService restored(browser()->GetProfile());
  EXPECT_EQ(workflow.inputs[0].validation, restored.missions().back().workflow_inputs[0].validation);
  EXPECT_EQ("3", restored.missions().back().workflow_inputs[0].value);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioProtectedVariablesPersistWithoutSimulationValues) {
  auto* contents=browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiSkinStudioURL,"TAHAI Skin Studio","Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents,R"JS(
    (()=>{
      const get=id=>document.querySelector('#skin-studio-'+id),doc=JSON.parse(get('source').value),w=doc.operational.workflows[0];
      w.inputs=[{id:'secret',name:'Secret',type:'text',required:false,protected:true}];w.variables=[];w.outputs=[];w.repeats=[];
      w.steps=[{id:'copy',name:'Copy',kind:'checkpoint'}];
      get('source').value=JSON.stringify(doc);get('source').dispatchEvent(new Event('input',{bubbles:true}));
      get('variable-template').value='secret';get('variable-template').dispatchEvent(new Event('change'));
      get('variable-name').value='Private copy';get('variable-add').click();
      get('assignment-target').value='variable-private-copy';get('assignment-target').dispatchEvent(new Event('change'));
      get('assignment-source').value='secret';get('assignment-save').click();
      get('output-name').value='Private result';get('output-input').value='variable:variable-private-copy';get('output-add').click();
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&]{return content::EvalJs(contents,"document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();}));
  EXPECT_TRUE(content::EvalJs(contents,R"JS(
    (()=>{
      const get=id=>document.querySelector('#skin-studio-'+id),before=get('source').value;
      const input=document.querySelector('[data-simulation-input=secret]');input.value='password=fixture-only';input.dispatchEvent(new Event('change'));
      get('simulation-steps').querySelector('button').click();
      return input.value==='' && get('source').value===before && !before.includes('password=fixture-only') &&
          get('simulation-outputs').textContent.includes('Protected result (masked)') && !get('simulation-outputs').textContent.includes('password=fixture-only');
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiSkinStudioURL,"TAHAI Skin Studio","Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents,R"JS(
    (()=>{const get=id=>document.querySelector('#skin-studio-'+id),w=JSON.parse(get('source').value).operational.workflows[0];
      return w.variables[0].protected===true && !('value' in w.variables[0]) && !('protected_value' in w.variables[0]) && !get('simulation-steps').children.length;})()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionProtectedVariableCopiesRemainMaskedAcrossReloadAndSuccess) {
  auto* contents=browser()->tab_strip_model()->GetActiveWebContents();
  auto* service=tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;workflow.id="private-variables";workflow.name="Private variables";
  workflow.inputs={{"secret","Secret",tahai::TahaiOperationalWorkflowInputType::kText,false,{},true}};
  workflow.variables={{"private-copy","Private copy",tahai::TahaiOperationalWorkflowInputType::kText,false,{},true}};
  workflow.steps={{"copy","Copy privately",tahai::TahaiOperationalWorkflowStepKind::kAssignVariable}};
  workflow.steps[0].assignment=tahai::TahaiWorkflowAssignment{"private-copy","secret",false};
  workflow.outputs={{"result","Result","private-copy",true}};
  const auto created=service->CreateOperationalWorkflowMission(workflow,"review-skin",std::string(64,'a'),true);ASSERT_TRUE(created);
  base::test::TestFuture<bool> ready;service->PrepareProtectedWorkflowInputs(g_browser_process->os_crypt_async(),ready.GetCallback());ASSERT_TRUE(ready.Get());
  const std::string secret="password=private-variable-browser-fixture";
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id,"secret",secret));
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id,"running"));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiMissionURL,"Mission Control","Real tabs. Real WebContents. Bounded mission state."));
  for(const char* selector : {"[data-tahai-variable-assign][data-tahai-step-index=\"0\"]","[data-tahai-workflow-state=succeeded]"}) {
    content::TestNavigationObserver reload(contents,1);ASSERT_TRUE(content::ExecJs(contents,content::JsReplace("document.querySelector($1).click()",selector)));
    reload.Wait();ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  const auto& variable=service->missions().back().workflow_variables[0];ASSERT_TRUE(variable.protected_has_value);
  EXPECT_TRUE(variable.value.empty());EXPECT_FALSE(variable.protected_value.empty());
  EXPECT_FALSE(base::WriteJson(browser()->GetProfile()->GetPrefs()->GetList(prefs::kTahaiMissions))->contains(secret));
  EXPECT_TRUE(content::EvalJs(contents,content::JsReplace(R"JS(
    !document.documentElement.outerHTML.includes($1) && !document.documentElement.outerHTML.includes($2) &&
    document.querySelector('[data-tahai-workflow-variable=private-copy]').textContent.includes('masked') &&
    document.querySelector('[data-tahai-workflow-output=result]').textContent.includes('Protected')
  )JS",secret,variable.protected_value)).ExtractBool());
  tahai::MissionService restarted(browser()->GetProfile());EXPECT_FALSE(restarted.missions().back().workflow_variables[0].protected_has_value);
  base::test::TestFuture<bool> recovered;restarted.PrepareProtectedWorkflowInputs(g_browser_process->os_crypt_async(),recovered.GetCallback());ASSERT_TRUE(recovered.Get());
  EXPECT_TRUE(restarted.missions().back().workflow_variables[0].protected_has_value);
  EXPECT_FALSE(restarted.AssignWorkflowVariable(created->id,0));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionProtectedVariablesBootstrapStorageWithoutProtectedInputs) {
  auto* contents=browser()->tab_strip_model()->GetActiveWebContents();
  auto* service=tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;workflow.id="private-variable-only";workflow.name="Private variable only";
  workflow.inputs={{"ordinary","Ordinary",tahai::TahaiOperationalWorkflowInputType::kText,false,{}}};
  workflow.variables={{"private-copy","Private copy",tahai::TahaiOperationalWorkflowInputType::kText,false,{},true}};
  workflow.steps={{"copy","Copy privately",tahai::TahaiOperationalWorkflowStepKind::kAssignVariable}};
  workflow.steps[0].assignment=tahai::TahaiWorkflowAssignment{"private-copy","ordinary",false};
  const auto created=service->CreateOperationalWorkflowMission(workflow,"review-skin",std::string(64,'a'),true);ASSERT_TRUE(created);
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id,"ordinary","Public fixture"));
  ASSERT_TRUE(service->SetOperationalWorkflowRunState(created->id,"running"));
  ASSERT_FALSE(service->missions().back().workflow_variables[0].protected_storage_ready);
  // No manual provider preparation: the variable's locked marker must trigger
  // the real WebUI initialization even though every input is ordinary.
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(),GURL(tahai::kTahaiMissionURL)));
  ASSERT_TRUE(base::test::RunUntil([&]{return service->missions().back().workflow_variables[0].protected_storage_ready;}));
  ASSERT_TRUE(content::WaitForLoadStop(contents));
  ASSERT_TRUE(base::test::RunUntil([&]{return content::EvalJs(contents,
      "Boolean(document.querySelector('[data-tahai-workflow-variable=private-copy][data-tahai-protected-storage=ready]'))").ExtractBool();}));
  content::TestNavigationObserver reload(contents,1);
  ASSERT_TRUE(content::ExecJs(contents,"document.querySelector('[data-tahai-variable-assign]').click()"));reload.Wait();ASSERT_TRUE(content::WaitForLoadStop(contents));
  EXPECT_TRUE(service->missions().back().workflow_variables[0].protected_has_value);
  EXPECT_TRUE(content::EvalJs(contents,"document.querySelector('[data-tahai-workflow-variable=private-copy]').textContent.includes('masked')").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionProtectedInputIsMaskedStoredEncryptedAndExplicitlyCleared) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow;
  workflow.id = "protected-workflow";
  workflow.name = "Protected workflow";
  workflow.inputs = {{"private-input", "Private input",
      tahai::TahaiOperationalWorkflowInputType::kText, true, {}, true}};
  workflow.steps = {{"review", "Review result", tahai::TahaiOperationalWorkflowStepKind::kCheckpoint, {}}};
  const auto mission = service->CreateOperationalWorkflowMission(workflow, "review-skin", std::string(64, 'a'));
  ASSERT_TRUE(mission);
  // Exercise the platform provider, not a plaintext/fake-key fallback. Failure
  // is a failed gate, never a skip or success without encrypted storage.
  base::test::TestFuture<bool> ready;
  service->PrepareProtectedWorkflowInputs(g_browser_process->os_crypt_async(), ready.GetCallback());
  ASSERT_TRUE(ready.Get());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  EXPECT_EQ("password", content::EvalJs(contents,
      "document.querySelector('[data-tahai-workflow-input]').type"));
  EXPECT_EQ("", content::EvalJs(contents,
      "document.querySelector('[data-tahai-workflow-input]').value"));
  const std::string secret = "password=fixture-only:@/private";
  {
    content::TestNavigationObserver reload(contents, 1);
    ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"(
      (() => {
        const control = document.querySelector('[data-tahai-workflow-input]');
        control.value = $1; control.dispatchEvent(new Event('change', {bubbles: true}));
        if (control.value) throw new Error('Protected field was not cleared after sending');
      })();
    )", secret)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  const auto& input = service->missions().back().workflow_inputs[0];
  ASSERT_TRUE(tahai::HasMissionWorkflowInputValue(input));
  EXPECT_TRUE(input.value.empty());
  EXPECT_FALSE(input.protected_value.empty());
  EXPECT_FALSE(base::WriteJson(browser()->GetProfile()->GetPrefs()->GetList(prefs::kTahaiMissions))->contains(secret));
  EXPECT_TRUE(content::EvalJs(contents, content::JsReplace(R"(
    !document.documentElement.outerHTML.includes($1) &&
    !document.documentElement.outerHTML.includes($2) &&
    document.querySelector('[data-tahai-workflow-input]').value === '' &&
    document.querySelector('[data-tahai-workflow-input]').placeholder.includes('Saved and protected')
  )", secret, input.protected_value)).ExtractBool());
  tahai::MissionService restarted(browser()->GetProfile());
  EXPECT_FALSE(tahai::HasMissionWorkflowInputValue(restarted.missions().back().workflow_inputs[0]));
  base::test::TestFuture<bool> recovered;
  restarted.PrepareProtectedWorkflowInputs(g_browser_process->os_crypt_async(), recovered.GetCallback());
  ASSERT_TRUE(recovered.Get());
  EXPECT_TRUE(tahai::HasMissionWorkflowInputValue(restarted.missions().back().workflow_inputs[0]));
  content::TestNavigationObserver cleared(contents, 1);
  ASSERT_TRUE(content::ExecJs(contents, "document.querySelector('[data-tahai-protected-clear]').click()"));
  cleared.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  EXPECT_TRUE(input.protected_value.empty());
  EXPECT_FALSE(tahai::HasMissionWorkflowInputValue(input));
  EXPECT_FALSE(service->SetOperationalWorkflowRunState(mission->id, "running"));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiSkinStudioActionStatusBindingsAuthorSimulateAndRestoreDefinitions) {
  auto* contents=browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiSkinStudioURL,"TAHAI Skin Studio","Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents,R"JS(
    (()=>{const get=id=>document.querySelector('#skin-studio-'+id),source=get('source'),doc=JSON.parse(source.value),w=doc.operational.workflows[0];
      if(!doc.operational.capabilities.includes('workspace-layout'))doc.operational.capabilities.push('workspace-layout');
      w.inputs=[];w.variables=[{id:'outcome',name:'Outcome',type:'text'}];w.steps=[{id:'dispatch',name:'Dispatch',kind:'run-command',action:'layout.dual'},{id:'capture',name:'Record status',kind:'checkpoint'}];
      w.outputs=[{id:'result',name:'Status',from:{variable:'outcome'}}];w.repeats=[];source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input',{bubbles:true}));
      get('condition-step').value='capture';get('condition-step').dispatchEvent(new Event('change'));
      get('assignment-target').value='outcome';get('assignment-target').dispatchEvent(new Event('change'));
      get('assignment-source').value='action-status:dispatch';get('assignment-save').click();
    })();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&]{return content::EvalJs(contents,"document.querySelector('#skin-studio-status').textContent.includes('Validated and saved')").ExtractBool();}));
  EXPECT_TRUE(content::EvalJs(contents,R"JS(
    (()=>{const get=id=>document.querySelector('#skin-studio-'+id),before=get('source').value;
      if(JSON.parse(before).operational.workflows[0].steps[1].assign.from.action_status!=='dispatch')return false;
      get('simulate').click();get('simulation-steps').children[0].querySelector('button').click();
      get('simulation-steps').children[1].querySelector('button').click();
      return get('simulation-outputs').textContent.includes('dispatched') && before===get('source').value;
    })()
  )JS").ExtractBool());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiSkinStudioURL,"TAHAI Skin Studio","Build an operational skin without granting it power."));
  EXPECT_TRUE(content::EvalJs(contents,R"JS(
    (()=>{const get=id=>document.querySelector('#skin-studio-'+id);get('condition-step').value='capture';get('condition-step').dispatchEvent(new Event('change'));
      return get('assignment-source').value==='action-status:dispatch' && get('simulation-outputs').children.length===0 &&
        !Object.hasOwn(JSON.parse(get('source').value).operational.workflows[0].variables[0],'value');})()
  )JS").ExtractBool());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiWorkflowInputsRejectUnactivatedStaleAndRepeatedEdits) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* profile = browser()->GetProfile();
  auto* service = tahai::MissionServiceFactory::GetForProfile(profile); ASSERT_TRUE(service);
  tahai::TahaiOperationalWorkflow workflow; workflow.id="fresh-inputs"; workflow.name="Fresh input edits";
  workflow.inputs={{"public-input","Public",tahai::TahaiOperationalWorkflowInputType::kText,false,{}},
      {"private-input","Private",tahai::TahaiOperationalWorkflowInputType::kText,false,{},true}};
  workflow.steps={{"review","Review",tahai::TahaiOperationalWorkflowStepKind::kCheckpoint}};
  const auto created=service->CreateOperationalWorkflowMission(workflow,"review-skin",std::string(64,'a'),true); ASSERT_TRUE(created);
  base::test::TestFuture<bool> ready; service->PrepareProtectedWorkflowInputs(g_browser_process->os_crypt_async(),ready.GetCallback()); ASSERT_TRUE(ready.Get());
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id,"public-input","original"));
  ASSERT_TRUE(service->SetOperationalWorkflowInputValue(created->id,"private-input","password=protected-fixture"));
  const auto token=service->missions().back().mutation_token;
  const auto cipher=service->missions().back().workflow_inputs[1].protected_value; ASSERT_FALSE(cipher.empty());
  const auto original=profile->GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(),GURL(tahai::kTahaiMissionURL)));
  EXPECT_FALSE(content::EvalJs(contents,"navigator.userActivation.isActive",content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents,content::JsReplace(
      "window.rejected=0; window.tahaiMissionWorkflowInputRejected=()=>++window.rejected; chrome.send('setTahaiOperationalWorkflowInput',[$1,'public-input','automatic',$2])",created->id,token),content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  ASSERT_TRUE(base::test::RunUntil([&]{return content::EvalJs(contents,"window.rejected===1",content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool();}));
  EXPECT_EQ(original,profile->GetPrefs()->GetList(prefs::kTahaiMissions));
  ASSERT_TRUE(service->AddLocalNote(created->id,"Changed in another view"));
  const auto revised=profile->GetPrefs()->GetList(prefs::kTahaiMissions).Clone();
  ASSERT_TRUE(content::ExecJs(contents,content::JsReplace(
      "chrome.send('setTahaiOperationalWorkflowInput',[$1,'public-input','stale',$2]); chrome.send('setTahaiOperationalWorkflowInput',[$1,'private-input','',$2])",created->id,token)));
  ASSERT_TRUE(base::test::RunUntil([&]{return content::EvalJs(contents,"window.rejected===3").ExtractBool();}));
  EXPECT_EQ(revised,profile->GetPrefs()->GetList(prefs::kTahaiMissions));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents,tahai::kTahaiMissionURL,"Mission Control","Real tabs. Real WebContents. Bounded mission state."));
  {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,content::JsReplace(R"JS(
      (()=>{const input=document.querySelector('[data-tahai-workflow-input][data-tahai-input-id=public-input]');
        const token=input.closest('.mission-card').dataset.tahaiRunToken;
        input.value='fresh';input.dispatchEvent(new Event('change',{bubbles:true}));
        chrome.send('setTahaiOperationalWorkflowInput',[$1,'public-input','replay',token]);})();
    )JS",created->id)));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_EQ("fresh",service->missions().back().workflow_inputs[0].value);
  EXPECT_EQ(cipher,service->missions().back().workflow_inputs[1].protected_value);
  // A genuine activation on a background Mission is not active-pane routing.
  chrome::AddTabAt(browser(),GURL(url::kAboutBlankURL),-1,true);
  ASSERT_NE(contents, browser()->GetTabStripModel()->GetActiveWebContents());
  ASSERT_TRUE(content::ExecJs(contents,content::JsReplace(
      "chrome.send('setTahaiOperationalWorkflowInput',[$1,'private-input','',$2])",created->id,service->missions().back().mutation_token)));
  ASSERT_TRUE(base::test::RunUntil([&]{return content::EvalJs(contents,
      "document.querySelector('#mission-status').textContent.includes('That value was not stored')").ExtractBool();}));
  EXPECT_EQ(cipher,service->missions().back().workflow_inputs[1].protected_value);
  browser()->GetTabStripModel()->ActivateTabAt(
      browser()->GetTabStripModel()->GetIndexOfWebContents(contents));
  {
    content::TestNavigationObserver reload(contents,1);
    ASSERT_TRUE(content::ExecJs(contents,"document.querySelector('[data-tahai-protected-clear][data-tahai-input-id=private-input]').click()"));
    reload.Wait(); ASSERT_TRUE(content::WaitForLoadStop(contents));
  }
  EXPECT_TRUE(service->missions().back().workflow_inputs[1].protected_value.empty());
  EXPECT_TRUE(service->missions().back().workflow_inputs[1].value.empty());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiCapsuleMessagesRequireMissionGestureAndVerifiedSingleUseImport) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* profile = browser()->GetProfile();
  auto* service = tahai::MissionServiceFactory::GetForProfile(profile); ASSERT_TRUE(service);
  const auto created = service->CreateMission("Private capsule source", "incident"); ASSERT_TRUE(created);
  const auto keys = profile->GetPrefs()->GetDict(prefs::kTahaiSyncKeyring).Clone();
  ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste).WriteText(u"capsule-sentinel");
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  EXPECT_FALSE(content::EvalJs(contents, "navigator.userActivation.isActive", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
    window.capsuleResult=''; window.tahaiEncryptedMissionCapsuleUpdate=result=>window.capsuleResult=result;
    chrome.send('copyTahaiMissionHandoff', [$1]); chrome.send('copyTahaiMissionCapsule', [$1]);
    chrome.send('copyTahaiEncryptedMissionCapsule', [$1]); chrome.send('rotateTahaiEncryptedMissionCapsuleKey', []);
  )JS", created->id), content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.capsuleResult === 'failed'", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool(); }));
  EXPECT_EQ(keys, profile->GetPrefs()->GetDict(prefs::kTahaiSyncKeyring));
  EXPECT_EQ(u"capsule-sentinel", ui::clipboard_test_util::ReadText(ui::Clipboard::GetForCurrentThread(), ui::ClipboardBuffer::kCopyPaste, nullptr));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "window.capsuleResult=''; window.tahaiEncryptedMissionCapsuleUpdate=result=>window.capsuleResult=result; chrome.send('copyTahaiEncryptedMissionCapsule', [$1]); chrome.send('rotateTahaiEncryptedMissionCapsuleKey', [])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.capsuleResult === 'failed'").ExtractBool(); }));
  EXPECT_EQ(keys, profile->GetPrefs()->GetDict(prefs::kTahaiSyncKeyring));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    window.capsuleResult=''; window.tahaiEncryptedMissionCapsuleUpdate=result=>window.capsuleResult=result;
    document.querySelector('[data-tahai-mission-action=copy-encrypted-capsule]').click();
  )JS"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.capsuleResult !== ''").ExtractBool(); }));
  ASSERT_EQ("copied", content::EvalJs(contents, "window.capsuleResult"));
  const auto envelope = ui::clipboard_test_util::ReadText(ui::Clipboard::GetForCurrentThread(), ui::ClipboardBuffer::kCopyPaste, nullptr);
  ASSERT_NE(u"capsule-sentinel", envelope); ASSERT_FALSE(envelope.empty());
  EXPECT_EQ(std::u16string::npos, envelope.find(u"Private capsule source"));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "window.capsuleResult=''; chrome.send('verifyTahaiEncryptedMissionCapsule', [$1])", envelope)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.capsuleResult !== ''").ExtractBool(); }));
  ASSERT_EQ("verified_ready", content::EvalJs(contents, "window.capsuleResult"));
  // Verification is tied to this document, not the lifetime of the WebUI handler.
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  ASSERT_TRUE(content::ExecJs(contents, "chrome.send('importTahaiVerifiedMissionCapsule', [])"));
  EXPECT_EQ(1u, service->missions().size());
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "window.capsuleResult=''; window.tahaiEncryptedMissionCapsuleUpdate=result=>window.capsuleResult=result; chrome.send('verifyTahaiEncryptedMissionCapsule', [$1])", envelope)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.capsuleResult !== ''").ExtractBool(); }));
  ASSERT_EQ("verified_ready", content::EvalJs(contents, "window.capsuleResult"));
  ASSERT_TRUE(content::ExecJs(contents, "chrome.send('importTahaiVerifiedMissionCapsule', []); chrome.send('importTahaiVerifiedMissionCapsule', [])"));
  ASSERT_TRUE(base::test::RunUntil([&] { return service->missions().size() == 2u; }));
  EXPECT_EQ("imported", content::EvalJs(contents, "window.capsuleResult"));
  EXPECT_NE(created->id, service->missions().back().id);
  EXPECT_NE("Private capsule source", service->missions().back().title);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiEvidenceReviewIsCardScopedSingleUseAndRevisionBound) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile());
  ASSERT_TRUE(service);
  const auto first = service->CreateMission("First private title", "incident"); ASSERT_TRUE(first);
  const auto second = service->CreateMission("Second private title", "investigation"); ASSERT_TRUE(second);
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
      "Mission Control", "Real tabs. Real WebContents. Bounded mission state."));
  const auto clipboard = [] { return ui::clipboard_test_util::ReadText(
      ui::Clipboard::GetForCurrentThread(), ui::ClipboardBuffer::kCopyPaste, nullptr); };
  const auto sentinel = [] { ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste).WriteText(u"review-sentinel"); };
  const auto review = [&](const std::string& id) {
    EXPECT_TRUE(content::ExecJs(contents, content::JsReplace(R"JS(
      (() => { window.reviewReady = false;
      const originalReview = window.tahaiEvidencePackReviewReady;
      window.tahaiEvidencePackReviewReady = (...args) => { originalReview(...args); window.reviewReady = true; window.tahaiEvidencePackReviewReady = originalReview; };
      [...document.querySelectorAll('.mission-card')].find(card => card.dataset.tahaiMissionId === $1)
          .querySelector('[data-tahai-mission-action=copy-evidence]').click(); })();
    )JS", id)));
    EXPECT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.reviewReady === true").ExtractBool(); }));
  };
  sentinel(); review(second->id);
  EXPECT_EQ(u"review-sentinel", clipboard());
  EXPECT_TRUE(content::EvalJs(contents, content::JsReplace(R"JS(
    (() => { const cards = [...document.querySelectorAll('.mission-card')];
      const first = cards.find(card => card.dataset.tahaiMissionId === $1), second = cards.find(card => card.dataset.tahaiMissionId === $2);
      return first.querySelector('[data-tahai-mission-action=confirm-evidence]').hidden &&
        !second.querySelector('[data-tahai-mission-action=confirm-evidence]').hidden &&
        second.querySelector('details.mission-export-preview').open; })()
  )JS", first->id, second->id)).ExtractBool());
  const auto reviewed = content::EvalJs(contents, content::JsReplace(
      "[...document.querySelectorAll('.mission-card')].find(c=>c.dataset.tahaiMissionId===$1).querySelector('[data-tahai-evidence-preview=true]').textContent", second->id)).ExtractString();
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('confirmTahaiEvidencePack', [$1])", second->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return clipboard() == base::UTF8ToUTF16(reviewed); }));
  EXPECT_TRUE(content::EvalJs(contents, "[...document.querySelectorAll('[data-tahai-mission-action=confirm-evidence]')].every(c=>c.hidden)").ExtractBool());
  sentinel();
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('confirmTahaiEvidencePack', [$1])", second->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('changed or is unavailable')").ExtractBool(); }));
  EXPECT_EQ(u"review-sentinel", clipboard());
  review(first->id);
  // Even a private note omitted from the generated summary invalidates consent.
  ASSERT_TRUE(service->AddLocalNote(first->id, "Local only review change"));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('confirmTahaiEvidencePack', [$1])", first->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('changed or is unavailable')").ExtractBool(); }));
  EXPECT_EQ(u"review-sentinel", clipboard());
  review(second->id);
  // Malformed replacement review must revoke, not leave the old review usable.
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "chrome.send('copyTahaiEvidencePack', [false]); chrome.send('confirmTahaiEvidencePack', [$1])", second->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('changed or is unavailable')").ExtractBool(); }));
  EXPECT_EQ(u"review-sentinel", clipboard());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiEvidenceReviewRequiresMissionGestureAndCannotSurviveNavigation) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::MissionServiceFactory::GetForProfile(browser()->GetProfile()); ASSERT_TRUE(service);
  const auto created = service->CreateMission("Review boundary", "incident"); ASSERT_TRUE(created);
  ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste).WriteText(u"document-sentinel");
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  EXPECT_FALSE(content::EvalJs(contents, "navigator.userActivation.isActive", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "window.rejected=0; window.tahaiEvidencePackReviewRejected=()=>++window.rejected; chrome.send('copyTahaiEvidencePack', [$1]); chrome.send('confirmTahaiEvidencePack', [$1])", created->id), content::EXECUTE_SCRIPT_NO_USER_GESTURE));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.rejected === 2", content::EXECUTE_SCRIPT_NO_USER_GESTURE).ExtractBool(); }));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "window.ready=false; window.tahaiEvidencePackReviewReady=()=>window.ready=true; chrome.send('copyTahaiEvidencePack', [$1])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.ready === true").ExtractBool(); }));
  ASSERT_TRUE(ui_test_utils::NavigateToURL(browser(), GURL(tahai::kTahaiMissionURL)));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace("chrome.send('confirmTahaiEvidencePack', [$1])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "document.querySelector('#mission-status').textContent.includes('changed or is unavailable')").ExtractBool(); }));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiSkinStudioURL,
      "TAHAI Skin Studio", "Build an operational skin without granting it power."));
  ASSERT_TRUE(content::ExecJs(contents, content::JsReplace(
      "window.rejected=0; window.tahaiEvidencePackReviewRejected=()=>++window.rejected; chrome.send('copyTahaiEvidencePack', [$1]); chrome.send('confirmTahaiEvidencePack', [$1])", created->id)));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents, "window.rejected === 2").ExtractBool(); }));
  EXPECT_EQ(u"document-sentinel", ui::clipboard_test_util::ReadText(
      ui::Clipboard::GetForCurrentThread(), ui::ClipboardBuffer::kCopyPaste, nullptr));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiMissionControlLoadsThroughPublicRoute) {
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(contents);
  Profile* profile = browser()->GetProfile();
  ASSERT_TRUE(profile);
  tahai::MissionService seeded_service(profile);
  ASSERT_TRUE(seeded_service.CreateMission(
      "Sensitive <img id=mission-title-injection src=x>", "incident"));
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
          "document.querySelectorAll('[data-tahai-mission-action=add-note]'"
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
          "document.querySelectorAll('[data-tahai-evidence-preview=true]')."
          "length === 1 && "
          "document.querySelector('[data-tahai-evidence-preview=true]')."
          "textContent.includes('TAHAI Sanitized Evidence Pack') && "
          "!document.querySelector('[data-tahai-evidence-preview=true]')."
          "textContent.includes('Sensitive <img') && "
          "!document.querySelector('#mission-title-injection') && "
          "[...document.querySelectorAll('[data-tahai-mission-action=launch-"
          "recipe]')].every("
          "button => /^[-a-z0-9]+$/.test(button.dataset.tahaiRecipeId || '')))")
          .ExtractBool());
  ASSERT_TRUE(content::ExecJs(
      contents,
      "const noteButton=document.querySelector('[data-tahai-mission-action=add-note]');"
      "const noteInput=document.getElementById(noteButton.dataset.tahaiNoteInput);"
      "noteInput.value='Keep this only in the local profile.';noteButton.click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.body.textContent.includes('Keep this only in the local profile.') && "
               "!document.querySelector('[data-tahai-evidence-preview=true]').textContent."
               "includes('Keep this only in the local profile.')")
        .ExtractBool();
  }));
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
  {
    ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
        .WriteText(u"evidence-pack-sentinel");
  }
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-mission-"
                              "action=copy-evidence]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Review the sanitized Evidence Pack, then confirm copying it.";
  }));
  EXPECT_TRUE(content::EvalJs(
                  contents,
                  "!document.querySelector('[data-tahai-mission-action="
                  "confirm-evidence]').hidden && "
                  "document.querySelector('[data-tahai-evidence-preview=true]')"
                  ".textContent.includes('TAHAI Sanitized Evidence Pack')")
                  .ExtractBool());
  const std::string reviewed_evidence =
      content::EvalJs(contents,
                      "document.querySelector('[data-tahai-evidence-preview="
                      "true]').textContent")
          .ExtractString();
  EXPECT_EQ(u"evidence-pack-sentinel",
            ui::clipboard_test_util::ReadText(ui::Clipboard::GetForCurrentThread(),
                                               ui::ClipboardBuffer::kCopyPaste,
                                               nullptr));
  ASSERT_TRUE(content::ExecJs(
      contents,
      "document.querySelector('[data-tahai-mission-action=confirm-evidence]')"
      ".click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Sanitized Evidence Pack copied. It contains generated status only.";
  }));
  EXPECT_EQ(base::UTF8ToUTF16(reviewed_evidence),
            ui::clipboard_test_util::ReadText(ui::Clipboard::GetForCurrentThread(),
                                               ui::ClipboardBuffer::kCopyPaste,
                                               nullptr));

  // Cancelling a fresh review never replaces the caller's clipboard data.
  {
    ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
        .WriteText(u"cancel-sentinel");
  }
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-mission-"
                              "action=copy-evidence]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Review the sanitized Evidence Pack, then confirm copying it.";
  }));
  ASSERT_TRUE(content::ExecJs(
      contents,
      "document.querySelector('[data-tahai-mission-action=cancel-evidence]')"
      ".click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Evidence Pack copy cancelled. Nothing was copied.";
  }));
  EXPECT_EQ(u"cancel-sentinel",
            ui::clipboard_test_util::ReadText(ui::Clipboard::GetForCurrentThread(),
                                               ui::ClipboardBuffer::kCopyPaste,
                                               nullptr));

  // A checkpoint change invalidates a pending review instead of silently
  // copying stale generated evidence.
  {
    ui::ScopedClipboardWriter(ui::ClipboardBuffer::kCopyPaste)
        .WriteText(u"stale-sentinel");
  }
  ASSERT_TRUE(content::ExecJs(contents,
                              "document.querySelector('[data-tahai-mission-"
                              "action=copy-evidence]').click()"));
  ASSERT_TRUE(base::test::RunUntil([&] { return content::EvalJs(contents,
      "!document.querySelector('[data-tahai-mission-action=confirm-evidence]').hidden").ExtractBool(); }));
  auto* live_service = tahai::MissionServiceFactory::GetForProfile(profile);
  ASSERT_TRUE(live_service);
  ASSERT_TRUE(live_service->ToggleStep(live_service->missions().front().id, 0));
  ASSERT_TRUE(content::ExecJs(
      contents,
      "document.querySelector('[data-tahai-mission-action=confirm-evidence]')"
      ".click()"));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return content::EvalJs(
               contents,
               "document.querySelector('#mission-status').textContent")
               .ExtractString() ==
           "Evidence Pack changed or is unavailable. Review the refreshed text "
           "before copying.";
  }));
  EXPECT_EQ(u"stale-sentinel",
            ui::clipboard_test_util::ReadText(ui::Clipboard::GetForCurrentThread(),
                                               ui::ClipboardBuffer::kCopyPaste,
                                               nullptr));
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
                  .find("THE Operational Browser.") !=
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
  // General commands, geometry-only Studio, and the document-bound workflow bridge.
  ASSERT_EQ(3u, contents->GetWebUI()->GetHandlersForTesting()->size());
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
                       TahaiBuiltinPresetCopyKeepsIndependentCommandPlacement) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiModesURL,
                                           "Work Modes", "Save editable preset copy"));
  const auto original = *tahai::FindBuiltinNativeModePreset("builder");
  const int tab_count = browser()->tab_strip_model()->count();
  content::TestNavigationObserver copied(contents);
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('[data-tahai-builtin-mode-copy=builder]').click()"));
  copied.Wait();
  ASSERT_TRUE(copied.last_navigation_succeeded());
  ASSERT_EQ(1u, service->custom_modes().size());
  const std::string id = service->custom_modes()[0].id;
  EXPECT_NE(original.id, id);
  EXPECT_EQ(original.native_presentation, service->custom_modes()[0].native_presentation);
  EXPECT_EQ(original.command_layout, service->custom_modes()[0].command_layout);
  EXPECT_EQ("daily", controller->active_mode_id());
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  const auto before = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(before);
  ASSERT_EQ(2u, before->toolbar_secondary.size());
  EXPECT_EQ(IDC_TAHAI_WORK_MODES, before->toolbar_secondary[0].command_id);
  EXPECT_EQ(IDC_TAHAI_LOCAL_OI, before->toolbar_secondary[1].command_id);
  content::TestNavigationObserver edited(contents);
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const editor = document.querySelector('[data-tahai-native-mode-controls]');
    for (const input of editor.querySelectorAll('[name^="placement."]')) input.value = '0';
    editor.elements.namedItem('placement.toolbar_primary.mission.open').value = '2';
    editor.elements.namedItem('placement.toolbar_primary.commands.open').value = '1';
    editor.elements.namedItem('placement.toolbar_secondary.local-oi.open').value = '1';
    editor.elements.namedItem('placement.app_menu.modes.open').value = '1';
    editor.requestSubmit();
  )JS"));
  edited.Wait();
  ASSERT_TRUE(edited.last_navigation_succeeded());
  const auto after = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(after);
  ASSERT_EQ(1u, after->toolbar_secondary.size());
  EXPECT_EQ(IDC_TAHAI_LOCAL_OI, after->toolbar_secondary[0].command_id);
  ASSERT_EQ(1u, after->app_menu.size());
  EXPECT_EQ(IDC_TAHAI_WORK_MODES, after->app_menu[0].command_id);
  EXPECT_FALSE(tahai::CanExecuteWindowModeAction(browser(), before->context,
                                                IDC_TAHAI_LOCAL_OI));
  EXPECT_EQ(original, *tahai::FindBuiltinNativeModePreset("builder"));
  EXPECT_EQ(tab_count, browser()->tab_strip_model()->count());
  EXPECT_FALSE(chrome::IsTahaiMultiView(browser()));
  const auto stored = GetProfile()->GetPrefs()->GetDict(prefs::kTahaiCustomModeDefinitions).Clone();
  EXPECT_TRUE(content::EvalJs(contents, content::JsReplace(R"JS(
    new Promise(resolve => {
      window.tahaiNativeModeRejected = () => resolve(true);
      chrome.send('updateTahaiNativeCustomMode', [$1, 'Invalid placement',
        ['mission.open'], '', {toolbar_primary:['support.open'], toolbar_secondary:[], app_menu:[]}]);
    })
  )JS", id)).ExtractBool());
  EXPECT_EQ(stored, GetProfile()->GetPrefs()->GetDict(prefs::kTahaiCustomModeDefinitions));
  // Recreating the keyed model simulates reading this profile's saved records;
  // it does not stand in for the full process restart release gate.
  tahai::ModeService reloaded(GetProfile());
  ASSERT_EQ(1u, reloaded.custom_modes().size());
  EXPECT_EQ(service->custom_modes()[0], reloaded.custom_modes()[0]);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiNativeModeSkinEditsRequirePinnedWindowAndReactivation) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  BrowserWindowInterface* sibling = CreateBrowser(GetProfile());
  auto* sibling_mode = tahai::WindowModeController::GetForBrowser(sibling);
  const auto sibling_before = sibling_mode->CapturePresentation();
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(service->DuplicateBuiltinModePreset("research", "Styled research"));
  const std::string id = service->custom_modes()[0].id;
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiModesURL,
                                           "Work Modes", "Use this window's pinned skin"));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiNativeModeRejected = () => resolve(true);
      document.querySelector('[data-skin-action=capture]').click();
    })
  )JS").ExtractBool());
  EXPECT_FALSE(service->custom_modes()[0].native_presentation->skin);
  ASSERT_TRUE(controller->RestorePresentation(
      {.fixed_mode = "daily", .rail_state = "icons",
       .skin = tahai::WindowSkinReference{"terminal-green", ""}}));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return !controller->window_skin_restore_pending();
  }));
  ASSERT_TRUE(controller->window_skin_palette());
  content::TestNavigationObserver captured(contents);
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('[data-skin-action=capture]').click()"));
  captured.Wait();
  ASSERT_TRUE(captured.last_navigation_succeeded());
  EXPECT_EQ(controller->CapturePresentation().skin,
            service->custom_modes()[0].native_presentation->skin);
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  ASSERT_TRUE(base::test::RunUntil([&] {
    return !controller->window_skin_restore_pending();
  }));
  const auto before = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(before);
  ASSERT_FALSE(before->actions.empty());
  content::TestNavigationObserver cleared(contents);
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('[data-skin-action=clear]').click()"));
  cleared.Wait();
  ASSERT_TRUE(cleared.last_navigation_succeeded());
  EXPECT_FALSE(service->custom_modes()[0].native_presentation->skin);
  EXPECT_TRUE(controller->CapturePresentation().skin);
  const auto invalidated = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(invalidated);
  EXPECT_TRUE(invalidated->actions.empty());
  EXPECT_FALSE(tahai::CanExecuteWindowModeAction(browser(), before->context,
                                                IDC_TAHAI_COMMAND_CENTER));
  ASSERT_EQ(browser(), tahai::ActivateNativeCustomMode(browser(), id));
  EXPECT_FALSE(controller->CapturePresentation().skin);
  const auto restored = tahai::ResolveOperationalWindowActions(browser());
  ASSERT_TRUE(restored);
  EXPECT_FALSE(restored->actions.empty());
  EXPECT_EQ(sibling_before, sibling_mode->CapturePresentation());
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiNativeModeEditorRetainsOnlyCommittedLayout) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  const tahai::SurfaceDesign design{
      .nodes = {{.pane = 0, .role = "working"}},
      .rail_dock = "trailing", .keyboard_order = {0}};
  ASSERT_TRUE(controller->SetSurfaceDesign(design));
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiModesURL,
                                           "Work Modes", "Create an independent mode"));
  auto trial_design = design;
  trial_design.rail_dock = "leading";
  const auto trial = controller->BeginSurfacePreview(trial_design);
  ASSERT_TRUE(trial);
  EXPECT_EQ(trial_design, controller->surface_design());
  EXPECT_EQ(design, controller->CapturePresentation().surface_design);
  content::TestNavigationObserver saved(contents);
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const form = document.querySelector('#tahai-native-mode-form');
    form.elements.title.value = 'Retained desk';
    form.elements.retain_layout.checked = true;
    for (const input of form.querySelectorAll('[name=actions]')) input.checked = input.value === 'mission.open';
    form.requestSubmit();
  )JS"));
  saved.Wait();
  ASSERT_TRUE(saved.last_navigation_succeeded());
  ASSERT_EQ(1u, service->custom_modes().size());
  EXPECT_EQ(design, service->custom_modes()[0].native_presentation->surface_design);
  // Saving the definition did not promote the unkept preview to a preset.
  controller->CancelSurfacePreview(*trial);
  content::TestNavigationObserver cleared(contents);
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('[data-surface-action=clear]').click();"));
  cleared.Wait();
  ASSERT_TRUE(cleared.last_navigation_succeeded());
  EXPECT_FALSE(service->custom_modes()[0].native_presentation->surface_design);
  EXPECT_EQ(design, controller->surface_design());
  content::TestNavigationObserver attached(contents);
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('[data-surface-action=capture]').click();"));
  attached.Wait();
  ASSERT_TRUE(attached.last_navigation_succeeded());
  EXPECT_EQ(design, service->custom_modes()[0].native_presentation->surface_design);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiNativeModeEditorCreatesAndRejectsInvalidRequests) {
  auto* contents = browser()->tab_strip_model()->GetActiveWebContents();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiModesURL,
                                           "Work Modes", "Create an independent mode"));
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  ASSERT_TRUE(service);
  EXPECT_TRUE(service->custom_modes().empty());
  const int original_count = browser()->GetTabStripModel()->count();
  content::TestNavigationObserver saved(contents);
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const form = document.querySelector('#tahai-native-mode-form');
    form.elements.title.value = 'Review "quotes" <safe>';
    form.elements.base_mode.value = 'operator';
    for (const input of form.querySelectorAll('[name=actions]')) {
      input.checked = input.value === 'mission.open';
    }
    form.requestSubmit();
  )JS"));
  saved.Wait();
  ASSERT_TRUE(saved.last_navigation_succeeded());
  ASSERT_EQ(1u, service->custom_modes().size());
  EXPECT_EQ("Review \"quotes\" <safe>", service->custom_modes()[0].title);
  EXPECT_EQ("daily", service->active_mode().id);
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    document.querySelector('[data-tahai-custom-mode-title]').value === 'Review "quotes" <safe>' &&
    document.querySelector('[data-tahai-custom-mode-action=rename]').dataset.tahaiCustomModeId ===
      document.querySelector('[data-tahai-native-mode-use]').dataset.tahaiNativeModeUse &&
    !document.querySelector('safe')
  )JS").ExtractBool());
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('[data-tahai-native-mode-use]').click()"));
  auto* controller = tahai::WindowModeController::GetForBrowser(browser());
  ASSERT_TRUE(base::test::RunUntil([&] {
    return controller->active_custom_mode_id() == service->custom_modes()[0].id;
  }));
  EXPECT_EQ("operator", controller->active_mode_id());
  EXPECT_EQ(original_count, browser()->GetTabStripModel()->count());
  EXPECT_FALSE(chrome::IsTahaiMultiView(browser()));
  const auto stored = GetProfile()->GetPrefs()->GetDict(prefs::kTahaiCustomModeDefinitions).Clone();
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiNativeModeRejected = () => resolve(true);
      chrome.send('createTahaiNativeCustomMode',
        ['Unsafe', 'operator', '', ['https://example.test'], false]);
    })
  )JS").ExtractBool());
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiNativeModeRejected = () => resolve(true);
      chrome.send('createTahaiNativeCustomMode',
        ['Missing pinned skin', 'daily', '', ['mission.open'], true]);
    })
  )JS").ExtractBool());
  EXPECT_EQ(stored, GetProfile()->GetPrefs()->GetDict(prefs::kTahaiCustomModeDefinitions));
  content::TestNavigationObserver updated(contents);
  ASSERT_TRUE(content::ExecJs(contents, R"JS(
    const editor = document.querySelector('[data-tahai-native-mode-controls]');
    for (const input of editor.querySelectorAll('[name=actions]')) {
      input.checked = input.value === 'support.open';
    }
    for (const input of editor.querySelectorAll('[name^="placement."]')) input.value = '0';
    editor.elements.namedItem('placement.toolbar_primary.support.open').value = '1';
    editor.elements.namedItem('placement.app_menu.support.open').value = '1';
    editor.requestSubmit();
  )JS"));
  updated.Wait();
  ASSERT_TRUE(updated.last_navigation_succeeded());
  EXPECT_EQ(std::vector<std::string>({"support.open"}), service->custom_modes()[0].actions);
  const auto before_copy = *service->custom_modes()[0].native_presentation;
  content::TestNavigationObserver copied(contents);
  ASSERT_TRUE(content::ExecJs(contents,
      "document.querySelector('[data-tahai-custom-mode-title]').value = 'Independent copy';"
      "document.querySelector('[data-tahai-native-mode-copy]').click()"));
  copied.Wait();
  ASSERT_TRUE(copied.last_navigation_succeeded());
  ASSERT_EQ(2u, service->custom_modes().size());
  EXPECT_NE(service->custom_modes()[0].id, service->custom_modes()[1].id);
  EXPECT_EQ(before_copy, service->custom_modes()[1].native_presentation);
  EXPECT_EQ("Independent copy", service->custom_modes()[1].title);
  const auto after_copy = GetProfile()->GetPrefs()->GetDict(prefs::kTahaiCustomModeDefinitions).Clone();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(contents, tahai::kTahaiMissionURL,
                                           "Mission Control", "Mission"));
  EXPECT_TRUE(content::EvalJs(contents, R"JS(
    new Promise(resolve => {
      window.tahaiNativeModeRejected = () => resolve(true);
      chrome.send('createTahaiNativeCustomMode',
        ['Wrong surface', 'daily', '', ['mission.open'], false]);
    })
  )JS").ExtractBool());
  EXPECT_EQ(after_copy, GetProfile()->GetPrefs()->GetDict(prefs::kTahaiCustomModeDefinitions));
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiModesAreTrustedAndExplicitlySelected) {
  ChromeAutocompleteSchemeClassifier scheme_classifier(browser()->GetProfile());
  EXPECT_EQ(metrics::OmniboxInputType::URL,
            scheme_classifier.GetInputTypeForScheme(tahai::kTahaiScheme));
  content::WebContents* contents =
      browser()->tab_strip_model()->GetActiveWebContents();
  const int original_tab_count = browser()->GetTabStripModel()->count();
  ASSERT_TRUE(NavigateAndVerifyTahaiSurface(
      contents, tahai::kTahaiModesURL, "Work Modes", "Choose a work mode."));
  ASSERT_EQ(3u, contents->GetWebUI()->GetHandlersForTesting()->size());
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
            reloaded_mode_service.configuration_for_mode("creator").layout_variant_id);
  EXPECT_EQ("daily", reloaded_mode_service.active_mode().id);
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
  EXPECT_EQ(original_tab_count, browser()->GetTabStripModel()->count());
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

  ASSERT_TRUE(controller->SetOperationalRailModules({"mission", "guard"}));
  RunScheduledLayouts();
  EXPECT_EQ("mission", rail->selected_module_id());
  ASSERT_TRUE(rail->module_button_for_testing(0));
  EXPECT_TRUE(rail->module_button_for_testing(0)->GetVisible());
  ASSERT_TRUE(rail->module_button_for_testing(2));
  EXPECT_FALSE(rail->module_button_for_testing(2)->GetVisible());
  EXPECT_FALSE(controller->SetOperationalRailModules({"mission", "mission"}));
  EXPECT_FALSE(controller->SetOperationalRailModules({"untrusted-module"}));

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
        browser()->GetTabStripModel()->GetActiveWebContents();
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
  BrowserWindowInterface* browser2 = CreateBrowser(browser()->GetProfile());
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

  BrowserWindowInterface* browser3 = CreateBrowser(browser()->GetProfile());
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
                       TahaiPresentationObserverCanDestroyController) {
  class DestructiveObserver : public tahai::WindowModeController::Observer {
   public:
    base::OnceClosure on_change;
    void OnTahaiWindowModeChanged() override { std::move(on_change).Run(); }
  } observer;
  // A controller can be torn down synchronously by a native observer. Exercise
  // both notification and the subsequent theme/skin-restore continuation.
  auto controller = std::make_unique<tahai::WindowModeController>(browser());
  auto presentation = controller->CapturePresentation();
  observer.on_change = base::BindLambdaForTesting([&] {
    controller->RemoveObserver(&observer);
    controller.reset();
  });
  controller->AddObserver(&observer);
  EXPECT_FALSE(controller->RestorePresentation(presentation));
  EXPECT_FALSE(controller);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiPresentationRestorePreservesObserverReplacement) {
  class ReplacementObserver : public tahai::WindowModeController::Observer {
   public:
    base::OnceClosure on_change;
    void OnTahaiWindowModeChanged() override { std::move(on_change).Run(); }
  } observer;
  class Counter : public tahai::WindowModeController::Observer {
   public:
    base::RepeatingClosure on_change;
    void OnTahaiWindowModeChanged() override { on_change.Run(); }
  } counter;
  auto controller = std::make_unique<tahai::WindowModeController>(browser());
  auto presentation = controller->CapturePresentation();
  int changes = 0;
  counter.on_change = base::BindLambdaForTesting([&] {
    ++changes;
    EXPECT_EQ("creator", controller->active_mode_id());
  });
  observer.on_change = base::BindLambdaForTesting([&] {
    controller->RemoveObserver(&observer);
    EXPECT_TRUE(controller->SetActiveMode("creator"));
  });
  controller->AddObserver(&observer);
  controller->AddObserver(&counter);
  EXPECT_FALSE(controller->RestorePresentation(presentation));
  EXPECT_EQ("creator", controller->active_mode_id());
  EXPECT_EQ(1, changes);
  EXPECT_TRUE(base::test::RunUntil([&] { return changes == 2; }));
  controller->RemoveObserver(&counter);
}

IN_PROC_BROWSER_TEST_F(TahaiWebUIBrowserTest,
                       TahaiCustomModeResetObserverCanDestroyController) {
  auto* service = tahai::ModeServiceFactory::GetForProfile(GetProfile());
  ASSERT_TRUE(service);
  ASSERT_TRUE(service->CreateNativeCustomMode(
      "Reset lifetime", {.fixed_mode = "daily", .rail_state = "expanded"},
      {"mission.open"}, ""));
  ASSERT_FALSE(service->custom_modes().empty());
  const std::string custom_id = service->custom_modes().back().id;
  auto controller = std::make_unique<tahai::WindowModeController>(browser());
  ASSERT_TRUE(controller->SetActiveMode("daily"));
  ASSERT_TRUE(controller->SetCustomModePresentation(custom_id));
  class DestructiveObserver : public tahai::WindowModeController::Observer {
   public:
    base::OnceClosure on_change;
    void OnTahaiWindowModeChanged() override { std::move(on_change).Run(); }
  } observer;
  observer.on_change = base::BindLambdaForTesting([&] {
    controller->RemoveObserver(&observer);
    controller.reset();
  });
  controller->AddObserver(&observer);
  EXPECT_FALSE(controller->ResetActiveConfiguration());
  EXPECT_FALSE(controller);
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
  const int tabs_before = browser()->GetTabStripModel()->count();
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
  EXPECT_EQ(tabs_before, browser()->GetTabStripModel()->count());
  EXPECT_EQ(contents_before,
            browser()->GetTabStripModel()->GetActiveWebContents());
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
               ->GetTabStripModel()
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
  BrowserWindowInterface* second_browser =
      CreateBrowser(browser()->GetProfile());
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

  BrowserWindowCreateParams app_browser_params =
      BrowserWindowCreateParams::CreateForApp(
          "AppName",
          /*trusted_source=*/true, gfx::Rect(), browser()->GetProfile(),
          /*user_gesture=*/false);
  BrowserWindowInterface* app_browser =
      CreateBrowserWindow(std::move(app_browser_params));

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
  ASSERT_EQ(2, browser()->GetTabStripModel()->count());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->GetTabStripModel()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(kDropUrl,
            browser()->GetTabStripModel()->GetWebContentsAt(1)->GetURL());
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
  ASSERT_EQ(2, browser()->GetTabStripModel()->count());
  EXPECT_EQ(kDropUrl,
            browser()->GetTabStripModel()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->GetTabStripModel()->GetWebContentsAt(1)->GetURL());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_PinnedWithStartDropTarget) {
  browser()->GetTabStripModel()->SetTabPinned(0, true);

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
  ASSERT_EQ(2, browser()->GetTabStripModel()->count());
  EXPECT_EQ(kDropUrl,
            browser()->GetTabStripModel()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->GetTabStripModel()->GetWebContentsAt(1)->GetURL());
  EXPECT_TRUE(browser()->GetTabStripModel()->GetTabAtIndex(0)->IsPinned());
  EXPECT_TRUE(browser()->GetTabStripModel()->GetTabAtIndex(1)->IsPinned());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleDropTargetViewLinkDrop_GroupedWithEndDropTarget) {
  browser()->GetTabStripModel()->AddToNewGroup({0});

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
  ASSERT_EQ(2, browser()->GetTabStripModel()->count());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->GetTabStripModel()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(kDropUrl,
            browser()->GetTabStripModel()->GetWebContentsAt(1)->GetURL());
  EXPECT_TRUE(
      browser()->GetTabStripModel()->GetTabAtIndex(0)->GetGroup().has_value());
  EXPECT_TRUE(
      browser()->GetTabStripModel()->GetTabAtIndex(1)->GetGroup().has_value());
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
  ASSERT_EQ(2, browser()->GetTabStripModel()->count());
  EXPECT_EQ(GURL(content::kBlockedURL),
            browser()->GetTabStripModel()->GetWebContentsAt(0)->GetURL());
  EXPECT_EQ(GURL(url::kAboutBlankURL),
            browser()->GetTabStripModel()->GetWebContentsAt(1)->GetURL());
}

IN_PROC_BROWSER_TEST_F(MultiContentsViewBrowserTest,
                       HandleTabDrop_EndDropTarget) {
  TabStripModel* tab_strip_model = browser()->GetTabStripModel();
  ASSERT_EQ(1, tab_strip_model->count());
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  // Show the drop target on the end side.
  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::END,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);

  // Create a second browser with a tab to be dragged.
  BrowserWindowInterface* browser2 = CreateBrowser(browser()->GetProfile());
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
  TabStripModel* tab_strip_model = browser()->GetTabStripModel();
  content::WebContents* original_contents =
      tab_strip_model->GetActiveWebContents();
  ASSERT_EQ(1, tab_strip_model->count());
  EXPECT_FALSE(multi_contents_view()->IsInSplitView());

  // Show the drop target on the start side.
  drop_target_view()->Show(MultiContentsDropTargetView::DropSide::START,
                           MultiContentsDropTargetView::DropTargetState::kFull,
                           MultiContentsDropTargetView::DragType::kLink);

  // Create a second browser with a tab to be dragged.
  BrowserWindowInterface* browser2 = CreateBrowser(browser()->GetProfile());
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
    auto* tab_strip_model = browser()->GetTabStripModel();
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
    auto* tab_strip_model = browser()->GetTabStripModel();
    const int active_index = tab_strip_model->active_index();

    RunScheduledLayouts();
    chrome::NewSplitTab(browser(), split_tabs::SplitTabLayout::kSideBySide,
                        split_tabs::SplitTabCreatedSource::kToolbarButton);
    EXPECT_TRUE(content::WaitForLoadStop(
        tab_strip_model->GetWebContentsAt(active_index + 1)));
    RunScheduledLayouts();
  }

  void LoadReLayoutTestPageInActiveSplitTabs() {
    auto* tab_strip_model = browser()->GetTabStripModel();
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
  auto* tab_strip_model = browser()->GetTabStripModel();

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
  auto* tab_strip_model = browser()->GetTabStripModel();

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
  auto* tab_strip_model = browser()->GetTabStripModel();

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

  int expected_entering_resize = 1;
#if BUILDFLAG(IS_OZONE)
  // On Wayland, the 2nd resize is for xdg_toplevel.set_fullscreen, so 2 is
  // required to enter fullscreen.
  if (ui::OzonePlatform::RunningOnWaylandForTest()) {
    expected_entering_resize = 2;
  }
#endif
  EXPECT_TRUE(
      base::test::RunUntil([this, split_tab, expected_entering_resize]() {
        return GetResizeCount(split_tab) >= expected_entering_resize;
      }));

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
  auto* tab_strip_model = browser()->GetTabStripModel();

  EXPECT_TRUE(
      AddTabAtIndex(1, GURL(url::kAboutBlankURL), ui::PAGE_TRANSITION_TYPED));
  chrome::NewSplitTab(browser(), split_tabs::SplitTabLayout::kSideBySide,
                      split_tabs::SplitTabCreatedSource::kToolbarButton);
  EXPECT_TRUE(
      AddTabAtIndex(3, GURL(url::kAboutBlankURL), ui::PAGE_TRANSITION_TYPED));
  chrome::NewSplitTab(browser(), split_tabs::SplitTabLayout::kSideBySide,
                      split_tabs::SplitTabCreatedSource::kToolbarButton);

  ASSERT_EQ(5, browser()->GetTabStripModel()->count());
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
