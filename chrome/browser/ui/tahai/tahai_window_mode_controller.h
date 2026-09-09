// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_MODE_CONTROLLER_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_MODE_CONTROLLER_H_

#include <string>
#include <string_view>

#include "base/memory/raw_ptr.h"
#include "base/observer_list.h"
#include "base/scoped_observation.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"

class Browser;

namespace tahai {

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

  explicit WindowModeController(Browser* browser);
  WindowModeController(const WindowModeController&) = delete;
  WindowModeController& operator=(const WindowModeController&) = delete;
  ~WindowModeController() override;

  // Returns the controller owned by |browser|'s BrowserView. Returns null for
  // non-windowed Browser instances, including off-the-record windows.
  static WindowModeController* GetForBrowser(Browser* browser);
  // One mapping shared by toolbar/app-menu radio state and command dispatch.
  // Empty for commands unrelated to rail presentation.
  static std::string_view RailStateForCommandId(int command_id);

  const WorkModeDefinition& active_mode() const;
  const WorkModeWorkspaceConfiguration& active_configuration() const;
  std::string_view active_mode_id() const { return active_mode_id_; }
  Browser* browser() const { return browser_; }

  // Changes only this controller. Persisting a profile default is deliberately
  // explicit so opening or changing one window never mutates another one.
  bool SetActiveMode(std::string_view mode_id);
  bool MakeActiveModeProfileDefault();
  // Restore presentation only in this window, without changing profile
  // defaults or another window's saved rail choice.
  bool ApplyWorkspacePresentation(std::string_view mode_id,
                                  std::string_view rail_state,
                                  int rail_width);
  bool SetActiveConfigurationValue(std::string_view key,
                                   std::string_view value);

  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

  // ModeService::Observer:
  void OnTahaiActiveModeChanged() override;
  void OnTahaiModeConfigurationChanged() override;

 private:
  void NotifyModeChanged();

  const raw_ptr<Browser> browser_;
  const raw_ptr<ModeService> mode_service_;
  std::string active_mode_id_;
  // Own the current window's presentation snapshot. An unrelated mode's
  // customization must not schedule a toolbar/rail layout in this window.
  WorkModeWorkspaceConfiguration active_configuration_;
  // A new window follows the profile default until its native mode chooser is
  // used. This lets settings update untouched windows without overwriting an
  // intentionally different workspace in another window.
  bool follows_profile_default_ = true;
  bool workspace_rail_override_ = false;
  base::ObserverList<Observer> observers_;
  base::ScopedObservation<ModeService, ModeService::Observer>
      mode_service_observation_{this};
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_WINDOW_MODE_CONTROLLER_H_
