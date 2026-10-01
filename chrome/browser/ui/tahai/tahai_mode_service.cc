// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#include "chrome/browser/ui/tahai/tahai_mode_service.h"

#include <algorithm>
#include <array>
#include <memory>
#include <optional>
#include <utility>

#include "base/check.h"
#include "base/functional/bind.h"
#include "base/no_destructor.h"
#include "base/strings/strcat.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/task/single_thread_task_runner.h"
#include "base/uuid.h"
#include "base/values.h"
#include "chrome/browser/profiles/profile.h"
#include "chrome/common/pref_names.h"
#include "components/prefs/pref_service.h"

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

base::DictValue SerializeCustomModes(
    const std::vector<TahaiCustomModeDefinition>& custom_modes) {
  base::DictValue definitions;
  base::ListValue modes;
  for (const TahaiCustomModeDefinition& custom_mode : custom_modes) {
    modes.Append(SerializeTahaiCustomModeDefinition(custom_mode));
  }
  definitions.Set("modes", std::move(modes));
  return definitions;
}

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
  if (!persistence_enabled()) {
    SetDefaultForOffTheRecord();
    return;
  }

  const WorkModeDefinition* definition =
      FindDefinition(prefs_->GetString(prefs::kTahaiActiveWorkMode));
  active_mode_id_ = definition ? std::string(definition->id)
                               : std::string(DailyDefinition().id);
  const base::DictValue& preferences =
      prefs_->GetDict(prefs::kTahaiWorkModePreferences);
  for (const WorkModeModifier& modifier : kModifiers) {
    if (preferences.FindBool(modifier.id).value_or(false)) {
      enabled_modifiers_.push_back(std::string(modifier.id));
    }
  }
  LoadConfigurations();
  LoadCustomModes();
  custom_mode_pref_registrar_.Init(prefs_);
  custom_mode_pref_registrar_.Add(
      prefs::kTahaiActiveWorkMode,
      base::BindRepeating(&ModeService::OnActiveModePreferenceChanged,
                          base::Unretained(this)));
  custom_mode_pref_registrar_.Add(
      prefs::kTahaiWorkModePreferences,
      base::BindRepeating(&ModeService::OnWorkspacePreferenceChanged,
                          base::Unretained(this)));
  custom_mode_pref_registrar_.Add(
      prefs::kTahaiCustomModeDefinitions,
      base::BindRepeating(&ModeService::OnCustomModePreferenceChanged,
                          base::Unretained(this)));
}

ModeService::~ModeService() = default;

void ModeService::Shutdown() {
  shutdown_ = true;
  custom_mode_pref_registrar_.RemoveAll();
  weak_factory_.InvalidateWeakPtrs();
}

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

const std::vector<TahaiCustomModeDefinition>& ModeService::custom_modes()
    const {
  return custom_modes_;
}

bool ModeService::CreateCustomMode(std::string title,
                                   std::string operational_mode_id,
                                   std::string workspace_id,
                                   std::optional<WindowSkinReference> skin) {
  auto next = ReadCustomModesForWrite();
  if (!next || next->size() >= 24u) {
    return false;
  }
  next->push_back(
      {base::StrCat(
           {"custom-", base::Uuid::GenerateRandomV4().AsLowercaseString()}),
       std::move(title),
       std::move(operational_mode_id),
       std::move(workspace_id),
       std::nullopt,
       {},
       std::move(skin)});
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::CreateNativeCustomMode(std::string title,
                                         WindowPresentation presentation,
                                         std::vector<std::string> actions,
                                         std::string workspace_id) {
  auto next = ReadCustomModesForWrite();
  if (!next || next->size() >= 24u) {
    return false;
  }
  if (!FindDefinition(presentation.fixed_mode)) {
    return false;
  }
  if (presentation.configuration.empty()) {
    auto configuration = configuration_for_mode(presentation.fixed_mode);
    configuration.rail_state = presentation.rail_state;
    configuration.rail_width = presentation.rail_width;
    presentation.configuration = EncodeConfiguration(configuration);
  }
  next->push_back(
      {.id = base::StrCat(
           {"custom-", base::Uuid::GenerateRandomV4().AsLowercaseString()}),
       .title = std::move(title),
       .workspace_id = std::move(workspace_id),
       .native_presentation = std::move(presentation),
       .actions = std::move(actions)});
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::RenameCustomMode(std::string_view id, std::string title) {
  auto next = ReadCustomModesForWrite();
  if (!next) {
    return false;
  }
  const auto found =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (found == next->end()) {
    return false;
  }
  found->title = std::move(title);
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::RemoveCustomMode(std::string_view id) {
  auto next = ReadCustomModesForWrite();
  if (!next) {
    return false;
  }
  const auto found =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (found == next->end()) {
    return false;
  }
  next->erase(found);
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::SetCustomModes(base::DictValue definitions) {
  std::vector<TahaiCustomModeDefinition> validated;
  if (!ReadCustomModesForWrite() ||
      ValidateTahaiCustomModeDefinitions(definitions, &validated) !=
          TahaiCustomModeValidationResult::kValid) {
    return false;
  }
  if (custom_modes_ == validated) {
    return true;
  }
  auto weak = weak_factory_.GetWeakPtr();
  prefs_->SetDict(prefs::kTahaiCustomModeDefinitions, std::move(definitions));
  return weak && custom_modes_ == validated;
}

bool ModeService::DuplicateCustomMode(std::string_view id, std::string title) {
  auto next = ReadCustomModesForWrite();
  if (!next || next->size() >= 24u) {
    return false;
  }
  const auto mode =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (mode == next->end()) {
    return false;
  }
  auto copy = *mode;
  copy.id = base::StrCat(
      {"custom-", base::Uuid::GenerateRandomV4().AsLowercaseString()});
  copy.title = std::move(title);
  next->push_back(std::move(copy));
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::UpdateNativeCustomMode(
    std::string_view id,
    std::string title,
    std::vector<std::string> actions,
    std::string workspace_id,
    std::optional<NativeModeCommandLayout> layout) {
  auto next = ReadCustomModesForWrite();
  if (!next) {
    return false;
  }
  const auto mode =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (mode == next->end() || !mode->native_presentation) {
    return false;
  }
  mode->title = std::move(title);
  mode->actions = std::move(actions);
  mode->workspace_id = std::move(workspace_id);
  if (layout) {
    mode->command_layout = std::move(layout);
  } else if (mode->command_layout) {
    // An older editor can remove an action, but cannot leave a stale command
    // placement behind. Preserve the remaining order and never add controls.
    for (auto* group : {&mode->command_layout->toolbar_primary,
                        &mode->command_layout->toolbar_secondary,
                        &mode->command_layout->app_menu}) {
      std::erase_if(*group, [&](const auto& action) {
        return std::ranges::find(mode->actions, action) == mode->actions.end();
      });
    }
  }
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::DuplicateBuiltinModePreset(std::string_view id,
                                             std::string title) {
  const auto* preset = FindBuiltinNativeModePreset(id);
  auto next = ReadCustomModesForWrite();
  if (!preset || !next || next->size() >= 24u) {
    return false;
  }
  auto copy = *preset;
  copy.id = base::StrCat(
      {"custom-", base::Uuid::GenerateRandomV4().AsLowercaseString()});
  copy.title = std::move(title);
  next->push_back(std::move(copy));
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::SetNativeCustomModeConfiguration(std::string_view id,
                                                   std::string_view key,
                                                   std::string_view value) {
  auto next = ReadCustomModesForWrite();
  if (!next) {
    return false;
  }
  const auto mode =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (mode == next->end() || !mode->native_presentation) {
    return false;
  }
  auto& presentation = *mode->native_presentation;
  auto configuration =
      DecodeConfiguration(presentation.fixed_mode, presentation.configuration);
  if (!configuration || !ApplyConfigurationValue(presentation.fixed_mode, key,
                                                 value, &*configuration)) {
    return false;
  }
  presentation.configuration = EncodeConfiguration(*configuration);
  presentation.rail_state = configuration->rail_state;
  presentation.rail_width = configuration->rail_width;
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::SetNativeCustomModeSurface(
    std::string_view id,
    std::optional<SurfaceDesign> design) {
  if (design && !ValidateSurfaceDesign(*design)) {
    return false;
  }
  auto next = ReadCustomModesForWrite();
  if (!next) {
    return false;
  }
  const auto mode =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (mode == next->end() || !mode->native_presentation) {
    return false;
  }
  mode->native_presentation->surface_design = std::move(design);
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::ResetNativeCustomModeConfiguration(std::string_view id) {
  auto next = ReadCustomModesForWrite();
  if (!next) {
    return false;
  }
  const auto mode =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (mode == next->end() || !mode->native_presentation) {
    return false;
  }
  auto& presentation = *mode->native_presentation;
  auto defaults = DefaultConfigurationForMode(presentation.fixed_mode);
  presentation.configuration = EncodeConfiguration(defaults);
  presentation.rail_state = defaults.rail_state;
  presentation.rail_width = defaults.rail_width;
  return SetCustomModes(SerializeCustomModes(*next));
}

bool ModeService::SetNativeCustomModeSkin(
    std::string_view id,
    std::optional<WindowSkinReference> skin) {
  auto next = ReadCustomModesForWrite();
  if (!next) {
    return false;
  }
  const auto mode =
      std::ranges::find(*next, id, &TahaiCustomModeDefinition::id);
  if (mode == next->end() || !mode->native_presentation) {
    return false;
  }
  mode->native_presentation->skin = std::move(skin);
  return SetCustomModes(SerializeCustomModes(*next));
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
  if (shutdown_ || !definition) {
    return false;
  }
  if (persistence_enabled()) {
    const auto* value =
        prefs_->GetRawUserPrefValue(prefs::kTahaiActiveWorkMode);
    if (prefs_->IsManagedPreference(prefs::kTahaiActiveWorkMode) ||
        (value && !value->is_string())) {
      return false;
    }
  }
  if (active_mode_id_ == definition->id &&
      (!persistence_enabled() ||
       prefs_->GetString(prefs::kTahaiActiveWorkMode) == definition->id)) {
    return true;
  }
  auto weak = weak_factory_.GetWeakPtr();
  if (persistence_enabled()) {
    prefs_->SetString(prefs::kTahaiActiveWorkMode, std::string(definition->id));
  } else {
    active_mode_id_ = definition->id;
    NotifyActiveModeChanged();
  }
  return weak && active_mode_id_ == definition->id;
}

void ModeService::AddObserver(Observer* observer) {
  observers_.AddObserver(observer);
}

void ModeService::RemoveObserver(Observer* observer) {
  observers_.RemoveObserver(observer);
}

void ModeService::NotifyActiveModeChanged() {
  active_notification_pending_ = true;
  DispatchNotifications();
}

void ModeService::NotifyModeConfigurationChanged() {
  configuration_notification_pending_ = true;
  DispatchNotifications();
}

void ModeService::DispatchNotifications() {
  if (shutdown_) {
    return;
  }
  if (notifying_) {
    // Observers may change another preference. Coalesce a later pass instead
    // of recursively iterating ObserverList or dropping that update.
    if (!notification_task_pending_) {
      notification_task_pending_ = true;
      base::SingleThreadTaskRunner::GetCurrentDefault()->PostTask(
          FROM_HERE, base::BindOnce(
                         [](base::WeakPtr<ModeService> service) {
                           if (service) {
                             service->notification_task_pending_ = false;
                             service->DispatchNotifications();
                           }
                         },
                         weak_factory_.GetWeakPtr()));
    }
    return;
  }
  const bool active = std::exchange(active_notification_pending_, false);
  const bool configuration =
      std::exchange(configuration_notification_pending_, false);
  notifying_ = true;
  auto weak = weak_factory_.GetWeakPtr();
  if (active) {
    for (Observer& observer : observers_) {
      observer.OnTahaiActiveModeChanged();
      if (!weak) {
        return;
      }
    }
  }
  if (configuration) {
    for (Observer& observer : observers_) {
      observer.OnTahaiModeConfigurationChanged();
      if (!weak) {
        return;
      }
    }
  }
  notifying_ = false;
}

bool ModeService::SetModifierEnabled(std::string_view modifier, bool enabled) {
  if (shutdown_ || !IsKnownModifier(modifier) ||
      (persistence_enabled() && !CanWriteWorkspacePreferences())) {
    return false;
  }
  if (IsModifierEnabled(modifier) == enabled) {
    return true;
  }
  // Copy caller-owned views before synchronous pref observers can invalidate
  // the window/model from which they originated.
  const std::string modifier_id(modifier);
  auto weak = weak_factory_.GetWeakPtr();
  if (persistence_enabled()) {
    auto next = prefs_->GetDict(prefs::kTahaiWorkModePreferences).Clone();
    next.Set(modifier_id, enabled);
    prefs_->SetDict(prefs::kTahaiWorkModePreferences, std::move(next));
    return weak && IsModifierEnabled(modifier_id) == enabled;
  }
  const auto found =
      std::find(enabled_modifiers_.begin(), enabled_modifiers_.end(), modifier);
  if (enabled && found == enabled_modifiers_.end()) {
    enabled_modifiers_.push_back(std::string(modifier));
  } else if (!enabled && found != enabled_modifiers_.end()) {
    enabled_modifiers_.erase(found);
  }
  NotifyModeConfigurationChanged();
  return weak && IsModifierEnabled(modifier_id) == enabled;
}

bool ModeService::SetActiveConfigurationValue(std::string_view key,
                                              std::string_view value) {
  return SetConfigurationValueForMode(active_mode_id_, key, value);
}

bool ModeService::SetConfigurationValueForMode(std::string_view mode_id,
                                               std::string_view key,
                                               std::string_view value) {
  StoredConfiguration* stored = FindStoredConfiguration(mode_id);
  if (shutdown_ || !stored ||
      (persistence_enabled() && !CanWriteWorkspacePreferences())) {
    return false;
  }
  auto next = stored->configuration;
  if (!ApplyConfigurationValue(mode_id, key, value, &next)) {
    return false;
  }
  if (next != stored->configuration) {
    if (persistence_enabled()) {
      return SaveConfiguration(mode_id, next);
    }
    const std::string id(mode_id);
    auto weak = weak_factory_.GetWeakPtr();
    stored->configuration = next;
    NotifyModeConfigurationChanged();
    return weak && configuration_for_mode(id) == next;
  }
  return true;
}

bool ModeService::ApplyConfigurationValue(
    std::string_view mode_id,
    std::string_view key,
    std::string_view value,
    WorkModeWorkspaceConfiguration* result) {
  if (!result || !IsValidConfiguration(mode_id, key, value)) {
    return false;
  }
  // Reuse the same finite setter for profile templates and independent modes.
  StoredConfiguration temporary{std::string(mode_id), *result};
  StoredConfiguration* configuration = &temporary;
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
  *result = std::move(temporary.configuration);
  return true;
}

std::map<std::string, std::string> ModeService::EncodeConfiguration(
    const WorkModeWorkspaceConfiguration& configuration) {
  return {
      {"theme", configuration.theme_id},
      {"accent", configuration.accent_id},
      {"surface", configuration.surface_id},
      {"density", configuration.density_id},
      {"header", configuration.header_id},
      {"start_surface", configuration.start_surface},
      {"layout", configuration.layout_id},
      {"layout_variant", configuration.layout_variant_id},
      {"template", configuration.template_id},
      {"rail_width", base::NumberToString(configuration.rail_width)},
      {"rail_state", configuration.rail_state},
      {"show_runbook_rail", configuration.show_runbook_rail ? "true" : "false"},
      {"compact_controls", configuration.compact_controls ? "true" : "false"}};
}

std::optional<WorkModeWorkspaceConfiguration> ModeService::DecodeConfiguration(
    std::string_view mode,
    const std::map<std::string, std::string>& values) {
  if (!FindDefinition(mode) || values.size() != 13u) {
    return std::nullopt;
  }
  // A complete snapshot supplies every field. Do not seed it from presets:
  // preset definitions themselves must pass this decoder during validation.
  WorkModeWorkspaceConfiguration decoded;
  for (const auto& [key, value] : values) {
    if (!ApplyConfigurationValue(mode, key, value, &decoded)) {
      return std::nullopt;
    }
  }
  // Coupled fields (layout/variant, density/compact) must agree. Unknown,
  // missing, noncanonical or contradictory values fail the entire snapshot.
  return EncodeConfiguration(decoded) == values
             ? std::make_optional(std::move(decoded))
             : std::nullopt;
}

bool ModeService::ResetActiveConfiguration() {
  return ResetConfigurationForMode(active_mode_id_);
}

bool ModeService::ResetConfigurationForMode(std::string_view mode_id) {
  if (shutdown_ || !FindDefinition(mode_id) ||
      (persistence_enabled() && !CanWriteWorkspacePreferences())) {
    return false;
  }
  StoredConfiguration* configuration = FindStoredConfiguration(mode_id);
  CHECK(configuration);
  WorkModeWorkspaceConfiguration defaults =
      DefaultConfigurationForMode(mode_id);
  if (configuration->configuration == defaults) {
    return true;
  }
  if (persistence_enabled()) {
    return SaveConfiguration(mode_id, defaults);
  }
  const std::string id(mode_id);
  auto weak = weak_factory_.GetWeakPtr();
  configuration->configuration = defaults;
  NotifyModeConfigurationChanged();
  return weak && configuration_for_mode(id) == defaults;
}

bool ModeService::IsModifierEnabled(std::string_view modifier) const {
  return std::find(enabled_modifiers_.begin(), enabled_modifiers_.end(),
                   modifier) != enabled_modifiers_.end();
}

bool ModeService::persistence_enabled() const {
  return profile_->IsRegularProfile() && !profile_->IsOffTheRecord() &&
         !profile_->IsGuestSession() && !profile_->IsSystemProfile();
}

WorkModeWorkspaceConfiguration ModeService::DefaultConfigurationForMode(
    std::string_view mode_id) {
  const auto* preset = FindBuiltinNativeModePreset(mode_id);
  CHECK(preset);
  auto decoded =
      DecodeConfiguration(mode_id, preset->native_presentation->configuration);
  CHECK(decoded);
  return *decoded;
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
                                       std::string_view value) {
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
      const auto* density = saved->FindString("density");
      if (!density ||
          !IsValidConfiguration(definition.id, "density", *density)) {
        stored.configuration.density_id =
            stored.configuration.compact_controls ? "compact" : "comfortable";
      } else {
        stored.configuration.compact_controls = *density == "compact";
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

bool ModeService::CanWriteWorkspacePreferences() const {
  if (shutdown_ || !persistence_enabled() ||
      prefs_->IsManagedPreference(prefs::kTahaiWorkModePreferences)) {
    return false;
  }
  const auto* user =
      prefs_->GetRawUserPrefValue(prefs::kTahaiWorkModePreferences);
  if (user && !user->is_dict()) {
    return false;
  }
  const auto& preferences = prefs_->GetDict(prefs::kTahaiWorkModePreferences);
  for (const auto& modifier : kModifiers) {
    const auto* value = preferences.Find(modifier.id);
    if (value && !value->is_bool()) {
      return false;
    }
  }
  const auto* configurations = preferences.Find("configurations");
  if (!configurations) {
    return true;
  }
  if (!configurations->is_dict()) {
    return false;
  }
  for (const auto& definition : kDefinitions) {
    const auto* saved = configurations->GetDict().Find(definition.id);
    if (!saved) {
      continue;
    }
    if (!saved->is_dict()) {
      return false;
    }
    for (const auto& [key, ignored] :
         EncodeConfiguration(DefaultConfigurationForMode(definition.id))) {
      const auto* value = saved->GetDict().Find(key);
      if (!value) {
        continue;  // Legacy partial preferences remain editable.
      }
      std::string encoded;
      if (key == "rail_width" && value->is_int()) {
        encoded = base::NumberToString(value->GetInt());
      } else if ((key == "compact_controls" || key == "show_runbook_rail") &&
                 value->is_bool()) {
        encoded = value->GetBool() ? "true" : "false";
      } else if (key != "rail_width" && key != "compact_controls" &&
                 key != "show_runbook_rail" && value->is_string()) {
        encoded = value->GetString();
      } else {
        return false;
      }
      if (!IsValidConfiguration(definition.id, key, encoded)) {
        return false;
      }
    }
  }
  return true;
}

bool ModeService::SaveConfiguration(
    std::string_view mode_id,
    const WorkModeWorkspaceConfiguration& configuration) {
  if (!CanWriteWorkspacePreferences()) {
    return false;
  }
  const std::string id(mode_id);
  const auto expected = configuration;
  auto preferences = prefs_->GetDict(prefs::kTahaiWorkModePreferences).Clone();
  auto* configurations = preferences.EnsureDict("configurations");
  auto* value = configurations->EnsureDict(id);
  // Update this mode only. Preserve unknown fields/modes and preferences
  // written by another browser-owned surface or a newer version.
  for (const auto& [key, encoded] : EncodeConfiguration(configuration)) {
    if (key == "rail_width") {
      value->Set(key, configuration.rail_width);
    } else if (key == "compact_controls") {
      value->Set(key, configuration.compact_controls);
    } else if (key == "show_runbook_rail") {
      value->Set(key, configuration.show_runbook_rail);
    } else {
      value->Set(key, encoded);
    }
  }
  auto weak = weak_factory_.GetWeakPtr();
  prefs_->SetDict(prefs::kTahaiWorkModePreferences, std::move(preferences));
  return weak && configuration_for_mode(id) == expected;
}

void ModeService::LoadCustomModes() {
  custom_modes_.clear();
  if (!persistence_enabled()) {
    return;
  }
  // Invalid data is ignored rather than repaired in-place: a malformed pref
  // must not destroy a user's last persisted value or become an executable
  // fallback. The UI can surface recovery after a validated write path exists.
  ValidateTahaiCustomModeDefinitions(
      prefs_->GetDict(prefs::kTahaiCustomModeDefinitions), &custom_modes_);
}

std::optional<std::vector<TahaiCustomModeDefinition>>
ModeService::ReadCustomModesForWrite() const {
  if (shutdown_ || !persistence_enabled() ||
      prefs_->IsManagedPreference(prefs::kTahaiCustomModeDefinitions)) {
    return std::nullopt;
  }
  const auto* user_value =
      prefs_->GetRawUserPrefValue(prefs::kTahaiCustomModeDefinitions);
  if (user_value && !user_value->is_dict()) {
    return std::nullopt;
  }
  const auto& value = prefs_->GetDict(prefs::kTahaiCustomModeDefinitions);
  std::vector<TahaiCustomModeDefinition> result;
  if (!value.empty() && ValidateTahaiCustomModeDefinitions(value, &result) !=
                            TahaiCustomModeValidationResult::kValid) {
    return std::nullopt;
  }
  return result;
}

void ModeService::OnCustomModePreferenceChanged() {
  auto previous = custom_modes_;
  LoadCustomModes();
  if (previous != custom_modes_) {
    NotifyModeConfigurationChanged();
  }
}

void ModeService::OnActiveModePreferenceChanged() {
  const auto* definition =
      FindDefinition(prefs_->GetString(prefs::kTahaiActiveWorkMode));
  const std::string next(definition ? definition->id : DailyDefinition().id);
  if (active_mode_id_ != next) {
    active_mode_id_ = next;
    NotifyActiveModeChanged();
  }
}

void ModeService::OnWorkspacePreferenceChanged() {
  auto previous_configurations = configurations_;
  auto previous_modifiers = enabled_modifiers_;
  enabled_modifiers_.clear();
  const auto& preferences = prefs_->GetDict(prefs::kTahaiWorkModePreferences);
  for (const auto& modifier : kModifiers) {
    if (preferences.FindBool(modifier.id).value_or(false)) {
      enabled_modifiers_.emplace_back(modifier.id);
    }
  }
  LoadConfigurations();
  if (previous_configurations != configurations_ ||
      previous_modifiers != enabled_modifiers_) {
    NotifyModeConfigurationChanged();
  }
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
  custom_modes_.clear();
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
