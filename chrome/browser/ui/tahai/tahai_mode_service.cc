// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_mode_service.h"

#include <algorithm>
#include <array>
#include <memory>
#include <optional>
#include <utility>

#include "base/check.h"
#include "base/no_destructor.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"

namespace tahai {
namespace {

constexpr std::array<WorkModeDefinition, 6> kDefinitions = {{
    {"daily", "Daily Driver", "Quiet Current",
     "Everyday personal and professional browsing",
     "Browse naturally. Keep the browser clean.", "1-up or lightweight 2-up",
     "Calm browsing; no operator chrome unless opened", "TAHAI Browser",
     "documentation"},
    {"creator", "Creator Studio", "Neon Studio",
     "Design, publish, and content work",
     "Create with references, assets, and previews in reach.",
     "Reference + canvas; Publish Quad",
     "Explicit captures and publishing checklists; never silent publishing",
     "TAHAI Web Services", "documentation"},
    {"builder", "Builder Mode", "Blueprint",
     "Development, release, and technical work",
     "Build with environments and evidence in view.",
     "Repository + docs; Release Quad",
     "Environment cues; no unrestricted shell or remote execution",
     "TAHAI IT Docs · TAHAI Operational Intelligence", "development"},
    {"operator", "Operator Mode", "Signal Grid",
     "Mission Control for technical operations",
     "Run missions with a deterministic, safe workspace.",
     "1-up, Dual, Tri, Quad, Focus",
     "Production awareness, redaction, and explicit authorized actions",
     "TAHAI PSA · TAHAI IT Docs · TAHAI Operational Intelligence", "incident"},
    {"research", "Research Desk", "Field Notes",
     "Sources, PDFs, notes, and comparison",
     "Turn sources into a traceable body of work.",
     "Source + notes; Research Quad",
     "Explicit captures only; no silent page-body collection",
     "TAHAI Operational Intelligence · TAHAI IT Docs", "audit"},
    {"support", "Support Desk", "Service Link",
     "Customer and internal technical support",
     "Resolve with context, validation, and a safe handoff.",
     "Ticket + portal; Support Quad",
     "Visible customer scope; no direct PSA or provider writeback",
     "TAHAI PSA · TAHAI IT Docs · TAHAI Operational Intelligence", "support"},
}};

constexpr std::array<WorkModeModifier, 3> kModifiers = {{
    {"focus", "Focus",
     "Preserve the current workspace while emphasizing one pane."},
    {"watch", "Watch / NOC",
     "A monitoring-oriented presentation for Builder or Operator work."},
    {"presentation", "Presentation",
     "A deliberate, sanitized sharing presentation."},
}};

constexpr std::array<WorkModeTemplate, 12> kTemplates = {{
    {"daily-review", "daily", "Daily review",
     "A bounded plan for routine browsing and follow-up.", "documentation"},
    {"daily-research", "daily", "Quick research",
     "A compact, source-led investigation runbook.", "investigation"},
    {"creative-brief", "creator", "Creative brief",
     "TAHAI Web Services design and content brief with validation.",
     "documentation"},
    {"publish-checklist", "creator", "Publish checklist",
     "A deliberate publishing change checklist with rollback.", "change"},
    {"build-plan", "builder", "Build plan",
     "Development checkpoints with TAHAI IT Docs and Operational Intelligence "
     "lanes.",
     "development"},
    {"release-checklist", "builder", "Release checklist",
     "A bounded deployment checklist with validation and rollback.",
     "deployment"},
    {"incident-bridge", "operator", "Incident bridge",
     "An incident runbook with PSA, IT Docs, and Operational Intelligence "
     "context.",
     "incident"},
    {"change-window", "operator", "Change window",
     "A controlled technical change runbook with an explicit restore path.",
     "change"},
    {"source-review", "research", "Source review",
     "An auditable source-comparison runbook using Operational Intelligence "
     "lanes.",
     "audit"},
    {"research-synthesis", "research", "Research synthesis",
     "A traceable research documentation runbook.", "documentation"},
    {"support-case", "support", "Support case",
     "A customer-safe support runbook with PSA and IT Docs handoff lanes.",
     "support"},
    {"escalation-handoff", "support", "Escalation handoff",
     "A bounded escalation runbook with Operational Intelligence context.",
     "incident"},
}};

constexpr std::array<std::string_view, 2> kThemeIds = {"dark", "light"};
constexpr std::array<std::string_view, 6> kAccentIds = {
    "mode", "slate", "azure", "teal", "violet", "amber"};
constexpr std::array<std::string_view, 4> kSurfaceIds = {"mode", "quiet",
                                                         "grid", "paper"};
constexpr std::array<std::string_view, 3> kDensityIds = {"comfortable",
                                                         "compact", "spacious"};
constexpr std::array<std::string_view, 3> kHeaderIds = {"standard", "compact",
                                                        "minimal"};
constexpr std::array<std::string_view, 4> kStartSurfaceIds = {
    "launchpad", "mission", "commands", "modes"};
constexpr std::array<std::string_view, 4> kLayoutIds = {"one", "dual", "tri",
                                                        "quad"};
constexpr std::array<std::string_view, 6> kLayoutVariantIds = {
    "one", "dual-side", "dual-stack", "tri-two-over-one", "tri-one-over-two",
    "quad"};
constexpr int kMinimumWorkspaceRailWidth = 220;
constexpr int kMaximumWorkspaceRailWidth = 480;

const WorkModeDefinition& DailyDefinition() {
  return kDefinitions.front();
}

}  // namespace

ModeService::ModeService(Profile* profile)
    : profile_(profile), prefs_(profile->GetPrefs()) {
  CHECK(profile_);
  CHECK(prefs_);
  if (profile_->IsOffTheRecord()) {
    SetDefaultForOffTheRecord();
    return;
  }

  const WorkModeDefinition* definition =
      FindDefinition(prefs_->GetString(prefs::kTahaiActiveWorkMode));
  active_mode_id_ = definition ? std::string(definition->id)
                               : std::string(DailyDefinition().id);
  if (!definition) {
    prefs_->SetString(prefs::kTahaiActiveWorkMode, active_mode_id_);
  }
  const base::DictValue& preferences =
      prefs_->GetDict(prefs::kTahaiWorkModePreferences);
  for (const WorkModeModifier& modifier : kModifiers) {
    if (preferences.FindBool(modifier.id).value_or(false)) {
      enabled_modifiers_.push_back(std::string(modifier.id));
    }
  }
  LoadConfigurations();
}

ModeService::~ModeService() = default;

const std::vector<WorkModeDefinition>& ModeService::definitions() {
  static const base::NoDestructor<std::vector<WorkModeDefinition>> definitions(
      kDefinitions.begin(), kDefinitions.end());
  return *definitions;
}

const std::vector<WorkModeModifier>& ModeService::modifiers() {
  static const base::NoDestructor<std::vector<WorkModeModifier>> modifiers(
      kModifiers.begin(), kModifiers.end());
  return *modifiers;
}

const std::vector<WorkModeTemplate>& ModeService::templates() {
  static const base::NoDestructor<std::vector<WorkModeTemplate>> templates(
      kTemplates.begin(), kTemplates.end());
  return *templates;
}

const WorkModeDefinition* ModeService::FindDefinition(std::string_view id) {
  const auto it = std::find_if(kDefinitions.begin(), kDefinitions.end(),
                               [id](const WorkModeDefinition& definition) {
                                 return definition.id == id;
                               });
  return it == kDefinitions.end() ? nullptr : &*it;
}

const WorkModeTemplate* ModeService::FindTemplate(std::string_view id) {
  const auto it = std::find_if(
      kTemplates.begin(), kTemplates.end(),
      [id](const WorkModeTemplate& candidate) { return candidate.id == id; });
  return it == kTemplates.end() ? nullptr : &*it;
}

const WorkModeDefinition& ModeService::active_mode() const {
  return *FindDefinition(active_mode_id_);
}

const WorkModeWorkspaceConfiguration& ModeService::active_configuration()
    const {
  return configuration_for_mode(active_mode_id_);
}

const WorkModeWorkspaceConfiguration& ModeService::configuration_for_mode(
    std::string_view mode_id) const {
  const StoredConfiguration* configuration = FindStoredConfiguration(mode_id);
  CHECK(configuration);
  return configuration->configuration;
}

bool ModeService::SetActiveMode(std::string_view id) {
  const WorkModeDefinition* definition = FindDefinition(id);
  if (!definition) {
    return false;
  }
  if (active_mode_id_ == definition->id) {
    return true;
  }
  active_mode_id_ = std::string(definition->id);
  if (persistence_enabled()) {
    prefs_->SetString(prefs::kTahaiActiveWorkMode, active_mode_id_);
  }
  NotifyActiveModeChanged();
  return true;
}

void ModeService::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void ModeService::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void ModeService::NotifyActiveModeChanged() {
  for (Observer& observer : observers_) {
    observer.OnTahaiActiveModeChanged();
  }
}

void ModeService::NotifyModeConfigurationChanged() {
  for (Observer& observer : observers_) {
    observer.OnTahaiModeConfigurationChanged();
  }
}

bool ModeService::SetModifierEnabled(std::string_view modifier, bool enabled) {
  if (!IsKnownModifier(modifier)) {
    return false;
  }
  const auto found =
      std::find(enabled_modifiers_.begin(), enabled_modifiers_.end(), modifier);
  if (enabled && found == enabled_modifiers_.end()) {
    enabled_modifiers_.push_back(std::string(modifier));
  } else if (!enabled && found != enabled_modifiers_.end()) {
    enabled_modifiers_.erase(found);
  }
  if (persistence_enabled()) {
    ScopedDictPrefUpdate update(prefs_, prefs::kTahaiWorkModePreferences);
    update->Set(modifier, enabled);
  }
  return true;
}

bool ModeService::SetActiveConfigurationValue(std::string_view key,
                                              std::string_view value) {
  return SetConfigurationValueForMode(active_mode_id_, key, value);
}

bool ModeService::SetConfigurationValueForMode(std::string_view mode_id,
                                               std::string_view key,
                                               std::string_view value) {
  if (!IsValidConfiguration(mode_id, key, value)) {
    return false;
  }
  StoredConfiguration* configuration = FindStoredConfiguration(mode_id);
  CHECK(configuration);
  const WorkModeWorkspaceConfiguration previous = configuration->configuration;
  if (key == "theme") {
    configuration->configuration.theme_id = value;
  } else if (key == "accent") {
    configuration->configuration.accent_id = value;
  } else if (key == "surface") {
    configuration->configuration.surface_id = value;
  } else if (key == "density") {
    configuration->configuration.density_id = value;
    configuration->configuration.compact_controls = value == "compact";
  } else if (key == "header") {
    configuration->configuration.header_id = value;
  } else if (key == "start_surface") {
    configuration->configuration.start_surface = value;
  } else if (key == "layout") {
    configuration->configuration.layout_id = value;
    configuration->configuration.layout_variant_id =
        value == "one"    ? "one"
        : value == "dual" ? "dual-side"
        : value == "tri"  ? "tri-two-over-one"
                          : "quad";
  } else if (key == "layout_variant") {
    configuration->configuration.layout_variant_id = value;
    configuration->configuration.layout_id =
        value == "one"                                                  ? "one"
        : base::StartsWith(value, "dual", base::CompareCase::SENSITIVE) ? "dual"
        : base::StartsWith(value, "tri", base::CompareCase::SENSITIVE)  ? "tri"
                                                                       : "quad";
  } else if (key == "template") {
    configuration->configuration.template_id = value;
  } else if (key == "rail_width") {
    int rail_width = 0;
    if (!base::StringToInt(value, &rail_width)) {
      return false;
    }
    configuration->configuration.rail_width = rail_width;
  } else if (key == "rail_state") {
    configuration->configuration.rail_state = value;
  } else if (key == "show_runbook_rail") {
    configuration->configuration.show_runbook_rail = value == "true";
  } else if (key == "compact_controls") {
    configuration->configuration.compact_controls = value == "true";
    configuration->configuration.density_id =
        configuration->configuration.compact_controls ? "compact"
                                                      : "comfortable";
  } else {
    return false;
  }
  if (previous != configuration->configuration) {
    SaveConfigurations();
    NotifyModeConfigurationChanged();
  }
  return true;
}

bool ModeService::ResetActiveConfiguration() {
  return ResetConfigurationForMode(active_mode_id_);
}

bool ModeService::ResetConfigurationForMode(std::string_view mode_id) {
  if (!FindDefinition(mode_id)) {
    return false;
  }
  StoredConfiguration* configuration = FindStoredConfiguration(mode_id);
  CHECK(configuration);
  WorkModeWorkspaceConfiguration defaults =
      DefaultConfigurationForMode(mode_id);
  if (configuration->configuration == defaults) {
    return true;
  }
  configuration->configuration = std::move(defaults);
  SaveConfigurations();
  NotifyModeConfigurationChanged();
  return true;
}

bool ModeService::IsModifierEnabled(std::string_view modifier) const {
  return std::find(enabled_modifiers_.begin(), enabled_modifiers_.end(),
                   modifier) != enabled_modifiers_.end();
}

bool ModeService::persistence_enabled() const {
  return !profile_->IsOffTheRecord();
}

WorkModeWorkspaceConfiguration ModeService::DefaultConfigurationForMode(
    std::string_view mode_id) {
  const WorkModeDefinition* definition = FindDefinition(mode_id);
  CHECK(definition);
  WorkModeWorkspaceConfiguration configuration;
  configuration.theme_id =
      mode_id == "research" || mode_id == "support" ? "light" : "dark";
  configuration.accent_id = "mode";
  configuration.surface_id = mode_id == "builder" || mode_id == "operator"
                                 ? "grid"
                             : mode_id == "research" ? "paper"
                                                     : "quiet";
  configuration.density_id = mode_id == "operator" ? "compact" : "comfortable";
  configuration.header_id = mode_id == "builder" ? "compact" : "standard";
  configuration.start_surface = mode_id == "daily" ? "launchpad" : "mission";
  configuration.layout_id =
      mode_id == "daily"      ? "one"
      : mode_id == "research" ? "dual"
      : mode_id == "creator" || mode_id == "builder" || mode_id == "support"
          ? "tri"
          : "quad";
  configuration.template_id =
      std::string(mode_id) + (mode_id == "daily"      ? "-review"
                              : mode_id == "creator"  ? "-brief"
                              : mode_id == "builder"  ? "-plan"
                              : mode_id == "operator" ? "-bridge"
                              : mode_id == "research" ? "-review"
                                                      : "-case");
  // The template names above are semantic rather than arbitrary. Map the
  // few modes whose external template ids use a more descriptive prefix.
  if (mode_id == "creator") {
    configuration.template_id = "creative-brief";
  }
  if (mode_id == "builder") {
    configuration.template_id = "build-plan";
  }
  if (mode_id == "operator") {
    configuration.template_id = "incident-bridge";
  }
  if (mode_id == "research") {
    configuration.template_id = "source-review";
  }
  if (mode_id == "support") {
    configuration.template_id = "support-case";
  }
  configuration.layout_variant_id = mode_id == "creator" || mode_id == "support"
                                        ? "tri-one-over-two"
                                    : mode_id == "builder"  ? "tri-two-over-one"
                                    : mode_id == "operator" ? "quad"
                                    : mode_id == "research" ? "dual-side"
                                                            : "one";
  configuration.rail_width = 280;
  configuration.show_runbook_rail = mode_id != "daily";
  configuration.rail_state = mode_id == "daily" ? "icons" : "expanded";
  configuration.compact_controls = configuration.density_id == "compact";
  return configuration;
}

ModeService::StoredConfiguration* ModeService::FindStoredConfiguration(
    std::string_view mode_id) {
  const auto it = std::find_if(configurations_.begin(), configurations_.end(),
                               [mode_id](const StoredConfiguration& candidate) {
                                 return candidate.mode_id == mode_id;
                               });
  return it == configurations_.end() ? nullptr : &*it;
}

const ModeService::StoredConfiguration* ModeService::FindStoredConfiguration(
    std::string_view mode_id) const {
  const auto it = std::find_if(configurations_.begin(), configurations_.end(),
                               [mode_id](const StoredConfiguration& candidate) {
                                 return candidate.mode_id == mode_id;
                               });
  return it == configurations_.end() ? nullptr : &*it;
}

bool ModeService::IsValidConfiguration(std::string_view mode_id,
                                       std::string_view key,
                                       std::string_view value) const {
  if (!FindDefinition(mode_id)) {
    return false;
  }
  const auto contains = [value](const auto& candidates) {
    return std::find(candidates.begin(), candidates.end(), value) !=
           candidates.end();
  };
  if (key == "theme") {
    return contains(kThemeIds);
  }
  if (key == "accent") {
    return contains(kAccentIds);
  }
  if (key == "surface") {
    return contains(kSurfaceIds);
  }
  if (key == "density") {
    return contains(kDensityIds);
  }
  if (key == "header") {
    return contains(kHeaderIds);
  }
  if (key == "start_surface") {
    return contains(kStartSurfaceIds);
  }
  if (key == "layout") {
    return contains(kLayoutIds);
  }
  if (key == "layout_variant") {
    return contains(kLayoutVariantIds);
  }
  if (key == "template") {
    const WorkModeTemplate* template_definition = FindTemplate(value);
    return template_definition && template_definition->mode_id == mode_id;
  }
  if (key == "rail_state") {
    return value == "icons" || value == "expanded" || value == "hidden";
  }
  if (key == "rail_width") {
    int rail_width = 0;
    return base::StringToInt(value, &rail_width) &&
           rail_width >= kMinimumWorkspaceRailWidth &&
           rail_width <= kMaximumWorkspaceRailWidth;
  }
  return (key == "show_runbook_rail" || key == "compact_controls") &&
         (value == "true" || value == "false");
}

void ModeService::LoadConfigurations() {
  configurations_.clear();
  const base::DictValue& preferences =
      prefs_->GetDict(prefs::kTahaiWorkModePreferences);
  const base::DictValue* saved_configurations =
      preferences.FindDict("configurations");
  for (const WorkModeDefinition& definition : kDefinitions) {
    StoredConfiguration stored{std::string(definition.id),
                               DefaultConfigurationForMode(definition.id)};
    const base::DictValue* saved =
        saved_configurations ? saved_configurations->FindDict(definition.id)
                             : nullptr;
    if (saved) {
      const auto load_string = [&](std::string_view key, std::string* target) {
        if (const std::string* value = saved->FindString(key);
            value && IsValidConfiguration(definition.id, key, *value)) {
          *target = *value;
        }
      };
      load_string("theme", &stored.configuration.theme_id);
      load_string("accent", &stored.configuration.accent_id);
      load_string("surface", &stored.configuration.surface_id);
      load_string("density", &stored.configuration.density_id);
      load_string("header", &stored.configuration.header_id);
      load_string("start_surface", &stored.configuration.start_surface);
      load_string("layout", &stored.configuration.layout_id);
      load_string("layout_variant", &stored.configuration.layout_variant_id);
      load_string("template", &stored.configuration.template_id);
      if (const std::optional<int> rail_width = saved->FindInt("rail_width");
          rail_width &&
          IsValidConfiguration(definition.id, "rail_width",
                               base::NumberToString(*rail_width))) {
        stored.configuration.rail_width = *rail_width;
      }
      if (const std::optional<bool> runbook =
              saved->FindBool("show_runbook_rail")) {
        stored.configuration.show_runbook_rail = *runbook;
        // Migrate the old coupled boolean without inventing a hidden state.
        stored.configuration.rail_state = *runbook ? "expanded" : "icons";
      }
      load_string("rail_state", &stored.configuration.rail_state);
      if (const std::optional<bool> compact =
              saved->FindBool("compact_controls")) {
        stored.configuration.compact_controls = *compact;
      }
      if (!saved->FindString("density")) {
        stored.configuration.density_id =
            stored.configuration.compact_controls ? "compact" : "comfortable";
      }
      if (!saved->FindString("layout_variant")) {
        const std::string_view layout = stored.configuration.layout_id;
        stored.configuration.layout_variant_id = layout == "dual" ? "dual-side"
                                                 : layout == "tri"
                                                     ? "tri-two-over-one"
                                                 : layout == "quad" ? "quad"
                                                                    : "one";
      } else {
        // Earlier builds allowed the broad layout id and detailed variant to
        // disagree (notably Creator and Support). The variant is the more
        // precise saved intent, so migrate the broad value to match it.
        const std::string_view variant = stored.configuration.layout_variant_id;
        stored.configuration.layout_id =
            variant == "one" ? "one"
            : base::StartsWith(variant, "dual", base::CompareCase::SENSITIVE)
                ? "dual"
            : base::StartsWith(variant, "tri", base::CompareCase::SENSITIVE)
                ? "tri"
                : "quad";
      }
    }
    configurations_.push_back(std::move(stored));
  }
}

void ModeService::SaveConfigurations() {
  if (!persistence_enabled()) {
    return;
  }
  ScopedDictPrefUpdate update(prefs_, prefs::kTahaiWorkModePreferences);
  base::DictValue saved_configurations;
  for (const StoredConfiguration& stored : configurations_) {
    base::DictValue value;
    value.Set("theme", stored.configuration.theme_id);
    value.Set("accent", stored.configuration.accent_id);
    value.Set("surface", stored.configuration.surface_id);
    value.Set("density", stored.configuration.density_id);
    value.Set("header", stored.configuration.header_id);
    value.Set("start_surface", stored.configuration.start_surface);
    value.Set("layout", stored.configuration.layout_id);
    value.Set("layout_variant", stored.configuration.layout_variant_id);
    value.Set("template", stored.configuration.template_id);
    value.Set("rail_width", stored.configuration.rail_width);
    value.Set("rail_state", stored.configuration.rail_state);
    value.Set("show_runbook_rail", stored.configuration.show_runbook_rail);
    value.Set("compact_controls", stored.configuration.compact_controls);
    saved_configurations.Set(stored.mode_id, std::move(value));
  }
  update->Set("configurations", std::move(saved_configurations));
}

bool ModeService::IsKnownModifier(std::string_view modifier) const {
  return std::any_of(kModifiers.begin(), kModifiers.end(),
                     [modifier](const WorkModeModifier& candidate) {
                       return candidate.id == modifier;
                     });
}

void ModeService::SetDefaultForOffTheRecord() {
  active_mode_id_ = DailyDefinition().id;
  enabled_modifiers_.clear();
  configurations_.clear();
  for (const WorkModeDefinition& definition : kDefinitions) {
    configurations_.push_back({std::string(definition.id),
                               DefaultConfigurationForMode(definition.id)});
  }
}

ModeService* ModeServiceFactory::GetForProfile(Profile* profile) {
  return static_cast<ModeService*>(
      GetInstance()->GetServiceForBrowserContext(profile, /*create=*/true));
}

ModeServiceFactory* ModeServiceFactory::GetInstance() {
  static base::NoDestructor<ModeServiceFactory> instance;
  return instance.get();
}

ModeServiceFactory::ModeServiceFactory()
    : ProfileKeyedServiceFactory(
          "tahai::ModeService",
          ProfileSelections::Builder()
              .WithRegular(ProfileSelection::kOwnInstance)
              .WithGuest(ProfileSelection::kOwnInstance)
              .Build()) {}

ModeServiceFactory::~ModeServiceFactory() = default;

std::unique_ptr<KeyedService>
ModeServiceFactory::BuildServiceInstanceForBrowserContext(
    content::BrowserContext* context) const {
  return std::make_unique<ModeService>(static_cast<Profile*>(context));
}

}  // namespace tahai
