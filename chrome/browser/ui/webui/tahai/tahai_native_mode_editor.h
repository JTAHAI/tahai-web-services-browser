// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_NATIVE_MODE_EDITOR_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_NATIVE_MODE_EDITOR_H_

#include <algorithm>
#include <string>
#include <string_view>

#include "base/strings/escape.h"
#include "base/strings/strcat.h"
#include "base/strings/utf_string_conversions.h"
#include "chrome/browser/ui/tahai/tahai_mode_command_model.h"
#include "chrome/browser/ui/tahai/tahai_mode_service.h"

namespace tahai {

inline std::string NativeModePlacementEditorHtml(const TahaiCustomModeDefinition& definition) {
  const NativeModeCommandLayout layout = definition.command_layout.value_or(
      NativeModeCommandLayout{definition.actions, {}, definition.actions});
  std::string html = "<details><summary>Place and order controls</summary>"
      "<p class=boundary>Use 0 to hide a control from a menu, or 1–17 for its position. "
      "Positions must be unique within each menu. Only checked native controls can be placed. "
      "Finder and the workspace rail retain all checked controls. Guard and Skin recovery "
      "remain available independently.</p>";
  const auto add_group = [&](std::string_view key, std::string_view title,
                              const std::vector<std::string>& group) {
    html += base::StrCat({"<fieldset><legend>", title, "</legend>"});
    for (const auto& action : GetNativeModeActionCatalog()) {
      const auto found = std::ranges::find(group, action.id);
      const size_t position = found == group.end() ? 0u :
          static_cast<size_t>(found - group.begin()) + 1u;
      html += base::StrCat({"<label class=mission-step><span>",
          base::EscapeForHTML(base::UTF16ToUTF8(action.label)),
          "</span><input type=number min=0 max=17 step=1 required name=\"placement.",
          key, ".", action.id, "\" value=\"", std::to_string(position), "\"></label>"});
    }
    html += "</fieldset>";
  };
  add_group("toolbar_primary", "Primary toolbar", layout.toolbar_primary);
  add_group("toolbar_secondary", "Secondary toolbar", layout.toolbar_secondary);
  add_group("app_menu", "App menu", layout.app_menu);
  return html + "</details>";
}

inline std::string NativeModeControlsEditorHtml(
    const TahaiCustomModeDefinition& definition,
    std::string_view workspace_options) {
  std::string actions;
  for (const auto& action : GetNativeModeActionCatalog()) {
    actions += base::StrCat({"<label class=mission-step><span>",
        base::EscapeForHTML(base::UTF16ToUTF8(action.label)),
        "</span><input type=checkbox name=actions value=\"", action.id, "\"",
        std::ranges::find(definition.actions, action.id) != definition.actions.end()
            ? " checked" : "", "></label>"});
  }
  return base::StrCat({
      "<details><summary>Edit native controls and saved workspace</summary>"
      "<form data-tahai-native-mode-controls=\"", base::EscapeForHTML(definition.id),
      "\"><label><span>Saved workspace</span><select name=workspace_id>",
      workspace_options,
      "</select></label><fieldset><legend>Native controls</legend>", actions,
      "</fieldset>", NativeModePlacementEditorHtml(definition),
      "<p class=boundary>Save keeps this mode's appearance and pinned skin. "
      "Existing open menus must be reopened after a change. No controls run when saved.</p>"
      "<button type=submit class=chip>Save controls</button></form>"
      "<p class=boundary>Apply a reviewed skin to this window before attaching it. "
      "Only its exact verified revision is saved. After changing a saved skin, "
      "choose Use mode again in each window to review and restore that binding.</p>"
      "<button type=button class=chip data-tahai-mode-skin=\"", base::EscapeForHTML(definition.id),
      "\" data-skin-action=capture>Use this window's pinned skin</button>"
      "<button type=button class=chip data-tahai-mode-skin=\"", base::EscapeForHTML(definition.id),
      "\" data-skin-action=clear>Remove saved skin</button>"
      "<p class=boundary>Attach only a kept window layout. Native tab contents are not included; "
      "choose a saved workspace separately to restore sites.</p>"
      "<button type=button class=chip data-tahai-mode-surface=\"", base::EscapeForHTML(definition.id),
      "\" data-surface-action=capture>Use this window's kept layout</button>"
      "<button type=button class=chip data-tahai-mode-surface=\"", base::EscapeForHTML(definition.id),
      "\" data-surface-action=clear>Remove saved layout</button></details>"});
}

inline std::string NativeModeEditorHtml(std::string_view active_mode,
                                        std::string_view workspace_options) {
  std::string modes;
  for (const auto& mode : ModeService::definitions()) {
    modes += base::StrCat({"<option value=\"", mode.id, "\"",
                          mode.id == active_mode ? " selected" : "", ">",
                          base::EscapeForHTML(mode.title), "</option>"});
  }
  std::string actions;
  const auto defaults = GetModeCommandGroup(active_mode).toolbar_primary;
  for (const auto& action : GetNativeModeActionCatalog()) {
    const bool selected = std::ranges::any_of(defaults, [&](const auto& item) {
      return item.command_id == action.command_id;
    });
    actions += base::StrCat(
        {"<label class=mission-step><span>",
         base::EscapeForHTML(base::UTF16ToUTF8(action.label)),
         "</span><input type=checkbox name=actions value=\"", action.id,
         "\"", selected ? " checked" : "", "></label>"});
  }
  return base::StrCat(
      {R"TAHAI(<form id=tahai-native-mode-form class=mode-custom-create>
<h3>Create an independent mode</h3>
<p class=muted>Copy a built-in mode and choose its native controls. No skin package is required.</p>
<label><span>Name</span><input name=title maxlength=80 required></label>
<label><span>Base mode</span><select name=base_mode>)TAHAI",
       modes,
       R"TAHAI(</select></label><label><span>Saved workspace</span><select name=workspace_id>)TAHAI",
       workspace_options,
       R"TAHAI(</select></label><fieldset><legend>Controls (choose at least one)</legend>)TAHAI",
       actions,
       R"TAHAI(</fieldset><label class=mission-step><span>Retain this window's pinned skin</span><input type=checkbox name=retain_skin></label>
<label class=mission-step><span>Retain this window's kept layout</span><input type=checkbox name=retain_layout></label>
<p class=boundary>To retain a skin, first choose Apply to this window in Skin packages. A preview or profile default is not a pinned skin. To retain a layout, keep it in Studio first. Saved skins are reverified on every restore. Controls run only when clicked; creating or restoring a mode never runs them.</p>
<button class="button primary" type=submit>Save independent mode</button></form>)TAHAI"});
}

inline constexpr char kNativeModeEditorJs[] = R"TAHAI(
(() => {
  'use strict';
  const status = document.querySelector('#mode-status');
  const requests = window.tahaiModeRequests;
  if (!status || !requests) return;
  const form = document.querySelector('#tahai-native-mode-form');
  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    if (requests.busy()) return;
    const data = new FormData(form);
    const title = String(data.get('title') || '').trim();
    const actions = data.getAll('actions').map(String);
    if (!title || title.length > 80 || !actions.length) {
      status.textContent = 'Enter a name and choose at least one native control.';
      return;
    }
    requests.send(form, 'createTahaiNativeCustomMode', [title,
      String(data.get('base_mode') || ''),
      String(data.get('workspace_id') || ''), actions, data.has('retain_skin'), data.has('retain_layout')],
      'Saving independent mode…');
  });
  for (const button of document.querySelectorAll('[data-tahai-native-mode-use]')) {
    button.addEventListener('click', () => {
      requests.send(button, 'activateTahaiNativeCustomMode',
        [String(button.dataset.tahaiNativeModeUse || '')], 'Opening independent mode…');
    });
  }
  for (const editor of document.querySelectorAll('[data-tahai-native-mode-controls]')) {
    editor.addEventListener('submit', event => {
      event.preventDefault();
      if (requests.busy()) return;
      const title = String(editor.closest('[data-tahai-custom-mode-card]')
        ?.querySelector('[data-tahai-custom-mode-title]')?.value || '').trim();
      const data = new FormData(editor);
      const actions = data.getAll('actions').map(String);
      if (!title || !actions.length) {
        status.textContent = 'Enter a name and choose at least one native control.';
        return;
      }
      let layout;
      try {
        layout = window.tahaiNativeModePlacement.read(data, actions);
      } catch {
        status.textContent = 'Use unique positions from 1–17 for checked controls, or 0 to hide them. Uncheck a control only after setting all of its positions to 0.';
        return;
      }
      requests.send(editor, 'updateTahaiNativeCustomMode', [
        String(editor.dataset.tahaiNativeModeControls || ''), title, actions,
        String(data.get('workspace_id') || ''), layout], 'Saving mode controls…');
    });
  }
  for (const button of document.querySelectorAll('[data-tahai-native-mode-copy]')) {
    button.addEventListener('click', () => {
      const title = String(button.closest('[data-tahai-custom-mode-card]')
        ?.querySelector('[data-tahai-custom-mode-title]')?.value || '').trim();
      if (!title) return;
      requests.send(button, 'duplicateTahaiCustomMode', [
        String(button.dataset.tahaiNativeModeCopy || ''), title], 'Copying independent mode…');
    });
  }
  for (const button of document.querySelectorAll('[data-tahai-builtin-mode-copy]')) {
    button.addEventListener('click', () => {
      requests.send(button, 'duplicateTahaiBuiltinModePreset',
        [button.dataset.tahaiBuiltinModeCopy], 'Copying the built-in preset…');
    });
  }
  for (const button of document.querySelectorAll('[data-tahai-mode-surface]')) {
    button.addEventListener('click', () => requests.send(button, 'setTahaiNativeModeSurface', [
      button.dataset.tahaiModeSurface, button.dataset.surfaceAction], 'Saving retained mode layout…'));
  }
  for (const button of document.querySelectorAll('[data-tahai-mode-skin]')) {
    button.addEventListener('click', () => requests.send(button, 'setTahaiNativeModeSkin', [
      button.dataset.tahaiModeSkin, button.dataset.skinAction], 'Saving retained mode skin…'));
  }
  window.tahaiNativeModeUpdated = request => requests.complete(request);
  window.tahaiNativeModeCreated = request => requests.complete(request);
  window.tahaiNativeModeActivated = request => requests.complete(request,
      'Mode opened. A retained skin is being reverified; the window title shows any unavailable skin. No mode controls were run.', false);
  window.tahaiNativeModeRejected = request => requests.reject(request,
      'Mode request rejected. Your edits are retained. Choose a valid name, native controls and an existing workspace. To retain a skin, apply it to this window first. To retain a layout, keep it in Studio first. Managed or damaged saved settings cannot be overwritten.');
})();
)TAHAI";

inline constexpr char kNativeModePlacementModelJs[] = R"TAHAI(
(() => {
  'use strict';
  const groups = Object.freeze(['toolbar_primary', 'toolbar_secondary', 'app_menu']);
  window.tahaiNativeModePlacement = Object.freeze({read(data, actions) {
    if (!Array.isArray(actions) || !actions.length || actions.length > 17 ||
        new Set(actions).size !== actions.length) throw new Error('actions');
    const ordered = Object.fromEntries(groups.map(group => [group, []]));
    const fields = new Set();
    for (const [key, value] of data.entries()) {
      if (!key.startsWith('placement.')) continue;
      const match = /^placement\.(toolbar_primary|toolbar_secondary|app_menu)\.([a-z-]+\.[a-z-]+)$/.exec(key);
      if (!match || fields.has(key) || typeof value !== 'string' || !/^(0|[1-9][0-9]?)$/.test(value))
        throw new Error('position');
      fields.add(key);
      const position = Number(value), [, group, id] = match;
      if (position > 17 || (position && (!actions.includes(id) ||
          ordered[group].some(item => item.position === position)))) throw new Error('position');
      if (position) ordered[group].push({id, position});
    }
    return Object.fromEntries(groups.map(group => [group,
      ordered[group].sort((a, b) => a.position - b.position).map(item => item.id)]));
  }});
})();
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_NATIVE_MODE_EDITOR_H_
