// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_MODE_CONTROLLER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_MODE_CONTROLLER_H_

#include <cstdint>
#include <optional>
#include <string>
#include <string_view>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/callback_list.h"
#include "base/memory/weak_ptr.h"
#include "base/observer_list.h"
#include "base/scoped_observation.h"
#include "base/timer/timer.h"
#include "base/unguessable_token.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"
#include "chrome/browser/ui/tahai/tahai_window_presentation.h"
#include "components/tabs/public/tab_interface.h"

class BrowserWindowInterface;

namespace tahai {

struct TahaiOperationalSkinManifest;
namespace skins {
class SkinColorSupplier;
class SkinProfileService;
}

// Owns the presentation mode for one browser window. ModeService remains the
// profile-level source of defaults and customizations; this controller keeps a
// mode switch local to its Browser so a future workspace rail, status strip,
// and toolbar can update together without changing sibling windows.
class WindowModeController : public ModeService::Observer {
 public:
  class Observer : public base::CheckedObserver {
   public:
    virtual void OnTahaiWindowModeChanged() = 0;
  };

  explicit WindowModeController(BrowserWindowInterface* browser);
  WindowModeController(const WindowModeController&) = delete;
  WindowModeController& operator=(const WindowModeController&) = delete;
  ~WindowModeController() override;

  // Returns the controller owned by |browser|'s BrowserView. Returns null for
  // non-windowed Browser instances, including off-the-record windows.
  static WindowModeController* GetForBrowser(BrowserWindowInterface* browser);
  // One mapping shared by toolbar/app-menu radio state and command dispatch.
  // Empty for commands unrelated to rail presentation.
  static std::string_view RailStateForCommandId(int command_id);

  const WorkModeDefinition& active_mode() const;
  // The title shown in window chrome. A verified custom mode can replace this
  // label for one window while its underlying fixed mode continues to select
  // bounded command groups and configuration.
  std::string_view active_mode_title() const;
  const WorkModeWorkspaceConfiguration& active_configuration() const;
  std::string_view active_mode_id() const { return active_mode_id_; }
  // Empty unless this window is presenting a saved native or operational
  // custom mode. The id remains profile-owned input and is revalidated by each
  // consumer before it influences native chrome.
  std::string_view active_custom_mode_id() const {
    return active_custom_mode_id_;
  }
  const std::vector<std::string>& operational_rail_modules() const {
    return operational_rail_modules_;
  }
  BrowserWindowInterface* browser() const { return browser_; }
  skins::SkinColorSupplier* window_skin_palette() const;
  const TahaiOperationalSkinManifest* operational_manifest() const;
  std::optional<std::string> operational_archive_sha256() const;
  std::string_view active_operational_mode_id() const {
    return active_operational_mode_id_;
  }
  // Both routes resolve only browser-owned, verified installed revisions.
  // Applying to one window never writes the profile's appearance preference.
  bool ApplyReviewedWindowSkin(std::string_view preview_token);
  bool CopyWindowSkinFrom(const WindowModeController& source);
  bool SelectOperationalMode(std::string_view mode_id);
  void ClearWindowSkin();
  WindowPresentation CapturePresentation() const;
  std::optional<std::string> SerializePresentation() const;
  // Accepts only bounded presentation data. Skin restoration is asynchronous
  // and may fail closed; a later explicit window choice supersedes it.
  bool RestorePresentation(const WindowPresentation& presentation);
  bool window_skin_restore_pending() const { return restoring_window_skin_; }
  const std::optional<SurfaceDesign>& surface_design() const { return surface_design_; }
  // Presentation only. Does not change tab membership or navigate any pane.
  bool SetSurfaceDesign(std::optional<SurfaceDesign> design);
  bool SetSurfaceDividerPercent(int node, int percent);
  // A trial changes geometry only, never membership or navigation. Session and
  // workspace capture keep the previous design until an explicit commit.
  std::optional<base::UnguessableToken> BeginSurfacePreview(SurfaceDesign design);
  bool CommitSurfacePreview(const base::UnguessableToken& token);
  bool CancelSurfacePreview(const base::UnguessableToken& token);
  bool IsSurfacePreviewCurrent(const base::UnguessableToken& token) const;
  base::WeakPtr<WindowModeController> GetWeakPtr() { return weak_factory_.GetWeakPtr(); }

  // Changes only this controller. Persisting a profile default is deliberately
  // explicit so opening or changing one window never mutates another one.
  bool SetActiveMode(std::string_view mode_id);
  // Records one already-persisted custom mode as this window's visible mode.
  // This neither changes profile defaults nor makes arbitrary strings a mode.
  bool SetCustomModePresentation(std::string_view custom_mode_id);
  // Applies an already-validated declarative rail module order to this window.
  // Empty restores the compiled mode presentation; this never persists a
  // package choice or turns a module identifier into a command.
  bool SetOperationalRailModules(std::vector<std::string> module_ids);
  bool MakeActiveModeProfileDefault();
  // Restore presentation only in this window, without changing profile
  // defaults or another window's saved rail choice.
  bool ApplyWorkspacePresentation(std::string_view mode_id,
                                  std::string_view rail_state,
                                  int rail_width);
  bool SetActiveConfigurationValue(std::string_view key,
                                   std::string_view value);
  bool ResetActiveConfiguration();

  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

  // ModeService::Observer:
  void OnTahaiActiveModeChanged() override;
  void OnTahaiModeConfigurationChanged() override;

 private:
  void NotifyModeChanged(bool preserve_surface_resize = false);
  void ReleaseWindowSkin();
  void ClearCustomModeBinding();
  void OnWindowSkinBindingsChanged();
  void RefreshRestoredModeTitles();
  void DiscardSurfacePreview();
  std::vector<tabs::TabHandle> SurfaceTabs() const;

  const raw_ptr<BrowserWindowInterface> browser_;
  const raw_ptr<ModeService> mode_service_;
  std::string active_mode_id_;
  std::string active_custom_mode_id_;
  std::string active_custom_mode_title_;
  base::WeakPtr<skins::SkinProfileService> skin_service_;
  std::optional<base::UnguessableToken> window_skin_binding_;
  std::optional<WindowSkinReference> requested_window_skin_;
  uint64_t window_restore_generation_ = 0;
  bool restoring_window_skin_ = false;
  std::string active_operational_mode_id_;
  std::string active_operational_mode_title_;
  base::CallbackListSubscription skin_binding_subscription_;
  std::vector<std::string> operational_rail_modules_;
  std::optional<SurfaceDesign> surface_design_;
  // The saved definition last observed, separate from window-local divider
  // changes. Unrelated preset edits must not reset an adjusted window layout.
  std::optional<SurfaceDesign> custom_surface_definition_;
  struct SurfacePreview {
    base::UnguessableToken token;
    std::optional<SurfaceDesign> baseline;
    std::vector<tabs::TabHandle> tabs;
  };
  std::optional<SurfacePreview> surface_preview_;
  base::OneShotTimer surface_preview_timer_;
  // Own the current window's presentation snapshot. An unrelated mode's
  // customization must not schedule a toolbar/rail layout in this window.
  WorkModeWorkspaceConfiguration active_configuration_;
  // A new window follows the profile default until its native mode chooser is
  // used. This lets settings update untouched windows without overwriting an
  // intentionally different workspace in another window.
  bool follows_profile_default_ = true;
  bool workspace_rail_override_ = false;
  bool local_configuration_ = false;
  base::ObserverList<Observer> observers_;
  bool notifying_mode_change_ = false;
  bool mode_notification_pending_ = false;
  base::ScopedObservation<ModeService, ModeService::Observer>
      mode_service_observation_{this};
  base::WeakPtrFactory<WindowModeController> weak_factory_{this};
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_MODE_CONTROLLER_H_
