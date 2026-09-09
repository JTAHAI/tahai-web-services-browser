// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_SERVICE_H_
#define CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_SERVICE_H_

#include <memory>
#include <string>
#include <string_view>
#include <vector>

#include "base/memory/raw_ptr.h"
#include "base/no_destructor.h"
#include "base/observer_list.h"
#include "chrome/browser/profiles/profile_keyed_service_factory.h"
#include "components/keyed_service/core/keyed_service.h"

class PrefService;
class Profile;

namespace tahai {

// Work modes change the TAHAI cockpit, not the Chromium identity boundary.
// They are deliberately fixed definitions: a renderer may request a known id,
// but it cannot introduce arbitrary configuration, URLs, scripts, or actions.
struct WorkModeDefinition {
  std::string_view id;
  std::string_view title;
  std::string_view visual_theme;
  std::string_view audience;
  std::string_view launchpad_heading;
  std::string_view preferred_layout;
  std::string_view safety_posture;
  std::string_view featured_products;
  std::string_view default_mission_type;
};

// A universal modifier is available within every primary mode. The service
// stores only the user's explicit presentation preference. The browser command
// that realizes a modifier remains separately allowlisted and browser-owned.
struct WorkModeModifier {
  std::string_view id;
  std::string_view title;
  std::string_view description;
};

// These are fixed, browser-owned mission starters. A template is intentionally
// not a URL, script, connector, provider request, or arbitrary configuration.
// It can create only a bounded local Mission Control runbook of a known type.
struct WorkModeTemplate {
  std::string_view id;
  std::string_view mode_id;
  std::string_view title;
  std::string_view description;
  std::string_view mission_type;
};

// Every mode owns a separate profile-scoped presentation preference. The
// schema is deliberately finite: choices improve the cockpit without
// accepting remote destinations, identity data, credentials, scripts, or
// arbitrary user-defined payloads.
struct WorkModeWorkspaceConfiguration {
  bool operator==(const WorkModeWorkspaceConfiguration&) const = default;

  std::string theme_id;
  std::string accent_id;
  std::string surface_id;
  std::string density_id;
  std::string header_id;
  std::string start_surface;
  std::string layout_id;
  std::string layout_variant_id;
  std::string template_id;
  int rail_width = 280;
  // Native navigation has exactly three states. Kept separate from the
  // Mission page's runbook guidance toggle below.
  std::string rail_state = "icons";
  bool show_runbook_rail = true;
  bool compact_controls = false;
};

class ModeService : public KeyedService {
 public:
  // Native browser chrome observes this service as well as WebUI. Keeping the
  // notification at the model boundary makes a mode change immediately
  // visible in every TAHAI surface without a renderer round-trip.
  class Observer : public base::CheckedObserver {
   public:
    virtual void OnTahaiActiveModeChanged() = 0;

    // Configuration is separate from mode selection: a window may retain a
    // local mode while its profile-scoped presentation preferences change.
    virtual void OnTahaiModeConfigurationChanged() {}
  };

  explicit ModeService(Profile* profile);
  ModeService(const ModeService&) = delete;
  ModeService& operator=(const ModeService&) = delete;
  ~ModeService() override;

  static const std::vector<WorkModeDefinition>& definitions();
  static const std::vector<WorkModeModifier>& modifiers();
  static const std::vector<WorkModeTemplate>& templates();
  static const WorkModeDefinition* FindDefinition(std::string_view id);
  static const WorkModeTemplate* FindTemplate(std::string_view id);

  const WorkModeDefinition& active_mode() const;
  const WorkModeWorkspaceConfiguration& active_configuration() const;
  const WorkModeWorkspaceConfiguration& configuration_for_mode(
      std::string_view mode_id) const;
  bool SetActiveMode(std::string_view id);
  bool SetModifierEnabled(std::string_view modifier, bool enabled);
  bool IsModifierEnabled(std::string_view modifier) const;
  bool SetActiveConfigurationValue(std::string_view key,
                                   std::string_view value);
  bool SetConfigurationValueForMode(std::string_view mode_id,
                                    std::string_view key,
                                    std::string_view value);
  bool ResetActiveConfiguration();
  bool ResetConfigurationForMode(std::string_view mode_id);
  bool persistence_enabled() const;

  void AddObserver(Observer* observer);
  void RemoveObserver(Observer* observer);

 private:
  struct StoredConfiguration {
    std::string mode_id;
    WorkModeWorkspaceConfiguration configuration;
  };

  static WorkModeWorkspaceConfiguration DefaultConfigurationForMode(
      std::string_view mode_id);
  StoredConfiguration* FindStoredConfiguration(std::string_view mode_id);
  const StoredConfiguration* FindStoredConfiguration(
      std::string_view mode_id) const;
  bool IsKnownModifier(std::string_view modifier) const;
  bool IsValidConfiguration(std::string_view mode_id,
                            std::string_view key,
                            std::string_view value) const;
  void LoadConfigurations();
  void SaveConfigurations();
  void SetDefaultForOffTheRecord();
  void NotifyActiveModeChanged();
  void NotifyModeConfigurationChanged();

  const raw_ptr<Profile> profile_;
  const raw_ptr<PrefService> prefs_;
  std::string active_mode_id_;
  std::vector<std::string> enabled_modifiers_;
  std::vector<StoredConfiguration> configurations_;
  base::ObserverList<Observer> observers_;
};

class ModeServiceFactory : public ProfileKeyedServiceFactory {
 public:
  static ModeService* GetForProfile(Profile* profile);
  static ModeServiceFactory* GetInstance();

  ModeServiceFactory(const ModeServiceFactory&) = delete;
  ModeServiceFactory& operator=(const ModeServiceFactory&) = delete;

 private:
  friend base::NoDestructor<ModeServiceFactory>;

  ModeServiceFactory();
  ~ModeServiceFactory() override;

  std::unique_ptr<KeyedService> BuildServiceInstanceForBrowserContext(
      content::BrowserContext* context) const override;
};

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_TAHAI_TAHAI_MODE_SERVICE_H_
