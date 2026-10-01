// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Execute the shipped listener. DOM doubles are not native browser evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL(
  '../../chrome/browser/ui/webui/tahai/tahai_ui.cc', import.meta.url), 'utf8');
const script = source.match(/constexpr char kModesJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
assert(script, 'Select the actual shipped Work Modes controller.');
const customScript = source.match(/constexpr char kCustomModesJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
const nativeSource = fs.readFileSync(new URL(
  '../../chrome/browser/ui/webui/tahai/tahai_native_mode_editor.h', import.meta.url), 'utf8');
const nativeScripts = ['kNativeModePlacementModelJs', 'kNativeModeEditorJs'].map(name => {
  const body = nativeSource.match(new RegExp(`char ${name}\\[\\] = R"TAHAI\\(([\\s\\S]*?)\\)TAHAI";`))?.[1];
  assert(body); return body;
});
assert(customScript);
assert.match(source,
  /html = base::StrCat\(\{kModesJs, kCustomModesJs,\s*kNativeModePlacementModelJs, kNativeModeEditorJs\}\)/,
  'Production must initialize the shared request owner before either mode editor.');
function fixture({fail = false} = {}) {
  const sent = [], navigations = [], nodes = [];
  class Node {
    constructor(dataset = {}, checkbox = false) {
      Object.assign(this, {dataset, checkbox, disabled: false, checked: false,
        isConnected: true, attributes: {}, handlers: {}, children: [], textContent: ''});
      nodes.push(this);
    }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    fire(type, fields = {}) {
      const event = {target: this, preventDefault() {}, ...fields};
      for (const handler of this.handlers[type] || []) handler(event);
    }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    hasAttribute(key) { return key in this.attributes; }
    matches() { return this.checkbox; }
    append(node) { this.children.push(node); }
    closest(selector) { return selector === 'dialog' ? dialog : this.card || null; }
    querySelector() { return this.title || null; }
  }
  const status = new Node(), mode = new Node({tahaiMode: 'research'});
  const modifier = new Node({tahaiModifier: 'focus'}, true);
  const config = new Node({tahaiModeConfig: 'density', tahaiValue: 'compact'});
  const checkbox = new Node({tahaiModeConfig: 'show_runbook_rail'}, true);
  const template = new Node({tahaiTemplate: 'research-brief'});
  const reset = new Node({tahaiModeReset: ''});
  const controls = [mode, modifier, config, checkbox, template, reset];
  const customForm = new Node(), nativeForm = new Node(), nativeEditor = new Node({tahaiNativeModeControls: 'native-1'});
  customForm.entries = [['title', 'Operator'], ['operational_mode_id', 'review'], ['workspace_id', 'workspace-1']];
  nativeForm.entries = [['title', 'Independent'], ['base_mode', 'research'], ['workspace_id', ''], ['actions', 'address.focus'], ['retain_skin', 'on']];
  nativeEditor.entries = [['actions', 'address.focus'], ['workspace_id', ''], ['placement.toolbar_primary.address.focus', '1']];
  const card = new Node(), title = new Node(); title.value = 'Named mode'; card.title = title; nativeEditor.card = card;
  const use = new Node({tahaiNativeModeUse: 'native-1'});
  const copy = new Node({tahaiNativeModeCopy: 'native-1'}); copy.card = card;
  const builtin = new Node({tahaiBuiltinModeCopy: 'research'});
  const surface = new Node({tahaiModeSurface: 'native-1', surfaceAction: 'clear'});
  const skin = new Node({tahaiModeSkin: 'native-1', skinAction: 'capture'});
  const rename = new Node({tahaiCustomModeAction: 'rename', tahaiCustomModeId: 'custom-1'}); rename.card = card;
  const remove = new Node({tahaiCustomModeAction: 'delete', tahaiCustomModeId: 'custom-1'}); remove.card = card;
  const editors = [...controls, use, copy, builtin, surface, skin, rename, remove, title];
  const opener = new Node({tahaiOpenDialog: 'mode-customize'}), closer = new Node();
  const dialog = new Node(); dialog.open = false; dialog.opens = 0;
  dialog.showModal = () => { assert.equal(dialog.open, false); dialog.open = true; ++dialog.opens; };
  dialog.close = () => { dialog.open = false; };
  const window = {confirm: () => true}, document = {
    querySelector: selector => selector === '#mode-status' ? status :
      selector === '#tahai-custom-mode-form' ? customForm :
      selector === '#tahai-native-mode-form' ? nativeForm : null,
    querySelectorAll: selector => selector === 'button,input,select,textarea' ? editors :
      selector.includes(',') ? controls :
      selector === '.mode-dialog' ? [dialog] :
      selector === '[data-tahai-open-dialog]' ? [opener] :
      selector === '[data-tahai-close-dialog]' ? [closer] :
      selector === '[data-tahai-custom-mode-action]' ? [rename, remove] :
      selector === '[data-tahai-native-mode-controls]' ? [nativeEditor] :
      selector === '[data-tahai-native-mode-use]' ? [use] :
      selector === '[data-tahai-native-mode-copy]' ? [copy] :
      selector === '[data-tahai-builtin-mode-copy]' ? [builtin] :
      selector === '[data-tahai-mode-surface]' ? [surface] :
      selector === '[data-tahai-mode-skin]' ? [skin] : [],
    getElementById: id => id === 'mode-customize' ? dialog : null,
    createElement: () => new Node(),
  };
  const context = {window, document,
    FormData: class {
      constructor(form) { this.values = form.entries; }
      get(key) { return this.values.find(item => item[0] === key)?.[1] ?? null; }
      getAll(key) { return this.values.filter(item => item[0] === key).map(item => item[1]); }
      has(key) { return this.values.some(item => item[0] === key); }
      entries() { return this.values.values(); }
    },
    location: {replace: value => navigations.push(value)},
    chrome: {send(name, args) { if (fail) throw new Error('transport'); sent.push({name, args}); }}};
  for (const body of [script, customScript, ...nativeScripts])
    vm.runInNewContext(body, context, {timeout: 1000});
  return {window, sent, navigations, controls, status, mode, modifier, config,
    checkbox, template, reset, opener, closer, dialog, customForm, nativeForm,
    nativeEditor, use, copy, builtin, surface, skin, rename, remove, title};
}
let checks = 0;
const check = fn => { fn(); ++checks; };
for (const [control, event, name, payload] of [
  ['mode', 'click', 'setTahaiWorkMode', ['research']],
  ['modifier', 'change', 'setTahaiWorkModeModifier', ['focus', true]],
  ['config', 'click', 'setTahaiWorkModeConfiguration', ['density', 'compact']],
  ['checkbox', 'change', 'setTahaiWorkModeConfiguration', ['show_runbook_rail', 'true']],
  ['template', 'click', 'createTahaiWorkModeTemplateMission', ['research-brief']],
  ['reset', 'click', 'resetTahaiWorkModeConfiguration', []],
]) check(() => {
  const f = fixture(); f[control].checked = true; f[control].fire(event);
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].name, name);
  assert.deepEqual(Array.from(f.sent[0].args), [...payload, 1]);
  assert(f.controls.every(item => item.disabled));
  f[control].fire(event); f.mode.fire('click'); assert.equal(f.sent.length, 1);
  f.window.tahaiWorkModeUpdated(1);
  assert.deepEqual(f.navigations, ['tahai://modes/']);
  f.window.tahaiWorkModeUpdated(1); assert.equal(f.navigations.length, 1);
});
for (const control of ['modifier', 'checkbox']) check(() => {
  const f = fixture(); f[control].checked = true; f[control].fire('change');
  f.window.tahaiWorkModeRejected(1);
  assert.equal(f[control].checked, false);
  assert(f.controls.every(item => !item.disabled));
  assert.match(f.status.textContent, /previous setting is restored/);
  f[control].checked = true; f[control].fire('change');
  assert.equal(f.sent[1].args.at(-1), 2);
  f.window.tahaiWorkModeRejected(1); f.window.tahaiWorkModeUpdated(1);
  assert.equal(f[control].disabled, true); assert.equal(f.navigations.length, 0);
  f.window.tahaiWorkModeUpdated(2); assert.equal(f.navigations.length, 1);
});
for (const state of ['disabled', 'disconnected', 'aria-disabled']) check(() => {
  const f = fixture();
  if (state === 'disabled') f.mode.disabled = true;
  if (state === 'disconnected') f.mode.isConnected = false;
  if (state === 'aria-disabled') f.mode.setAttribute('aria-disabled', 'true');
  f.mode.fire('click'); assert.equal(f.sent.length, 0);
});
check(() => {
  const f = fixture(); f.template.disabled = true; f.config.fire('click');
  f.window.tahaiWorkModeRejected(1);
  assert.equal(f.template.disabled, true); assert.equal(f.config.disabled, false);
});
check(() => {
  const f = fixture({fail: true}); f.modifier.checked = true; f.modifier.fire('change');
  assert.equal(f.modifier.checked, false); assert.equal(f.modifier.disabled, false);
  assert.match(f.status.textContent, /could not be saved/);
});
check(() => {
  const f = fixture(); f.opener.fire('click'); f.opener.fire('click');
  assert.equal(f.dialog.opens, 1); f.config.fire('click');
  assert.equal(f.dialog.children[0].textContent, f.status.textContent);
  assert.equal(f.dialog.children[0].getAttribute('role'), 'status');
  f.window.tahaiWorkModeRejected(1);
  assert.equal(f.dialog.children[0].textContent, f.status.textContent);
  f.closer.fire('click'); assert.equal(f.dialog.open, false);
});
check(() => {
  const f = fixture(); f.window.tahaiWorkModeUpdated(0); f.window.tahaiWorkModeRejected(1);
  assert.equal(f.navigations.length, 0); assert.equal(f.status.textContent, '');
});
check(() => {
  const f = fixture(); f.opener.fire('click');
  f.dialog.fire('click', {target: f.config}); assert.equal(f.dialog.open, true);
  f.dialog.fire('click'); assert.equal(f.dialog.open, false);
});
for (const [control, event, name, callback] of [
  ['customForm', 'submit', 'createTahaiCustomMode', 'tahaiCustomModeCreated'],
  ['nativeForm', 'submit', 'createTahaiNativeCustomMode', 'tahaiNativeModeCreated'],
  ['nativeEditor', 'submit', 'updateTahaiNativeCustomMode', 'tahaiNativeModeUpdated'],
  ['copy', 'click', 'duplicateTahaiCustomMode', 'tahaiNativeModeCreated'],
  ['builtin', 'click', 'duplicateTahaiBuiltinModePreset', 'tahaiNativeModeCreated'],
  ['surface', 'click', 'setTahaiNativeModeSurface', 'tahaiNativeModeUpdated'],
  ['skin', 'click', 'setTahaiNativeModeSkin', 'tahaiNativeModeUpdated'],
  ['rename', 'click', 'updateTahaiCustomMode', 'tahaiCustomModeUpdated'],
  ['remove', 'click', 'updateTahaiCustomMode', 'tahaiCustomModeUpdated'],
]) check(() => {
  const f = fixture(); f[control].fire(event);
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].name, name);
  assert.equal(f.sent[0].args.at(-1), 1); assert.equal(f.title.disabled, true);
  f[control].fire(event); f.mode.fire('click'); assert.equal(f.sent.length, 1);
  f.window[callback](0); assert.equal(f.navigations.length, 0);
  f.window[callback](1); assert.equal(f.navigations.length, 1);
});
check(() => {
  const f = fixture(); f.use.fire('click'); assert.equal(f.sent[0].name, 'activateTahaiNativeCustomMode');
  f.window.tahaiNativeModeActivated(1);
  assert.equal(f.navigations.length, 0); assert.equal(f.title.disabled, false);
  assert.match(f.status.textContent, /Mode opened/);
  f.nativeForm.fire('submit'); f.window.tahaiNativeModeActivated(1);
  assert.equal(f.title.disabled, true); assert.equal(f.navigations.length, 0);
  f.window.tahaiNativeModeCreated(2); assert.equal(f.navigations.length, 1);
});
for (const [control, callback] of [['nativeForm', 'tahaiNativeModeRejected'], ['customForm', 'tahaiCustomModeRejected']]) check(() => {
  const f = fixture(); f[control].fire('submit'); f.window[callback](1);
  assert.equal(f.title.value, 'Named mode'); assert.equal(f.title.disabled, false);
  assert.match(f.status.textContent, /edits are retained/);
  f[control].fire('submit'); assert.equal(f.sent[1].args.at(-1), 2);
  f.window[callback](1); assert.equal(f.title.disabled, true);
});
check(() => {
  const f = fixture(); f.window.confirm = () => false; f.remove.fire('click');
  assert.equal(f.sent.length, 0);
});
check(() => {
  const f = fixture(); f.nativeForm.fire('submit'); const args = f.sent[0].args;
  assert.equal(args.length, 7); assert.equal(args[4], true); assert.equal(args[5], false);
});
assert.equal(checks, 30);
console.log(`${checks} shipped Work Modes acknowledgment/modal/rollback/duplicate checks passed; DOM doubles only.`);
