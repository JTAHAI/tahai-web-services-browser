// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Runs real Studio listeners against a minimal DOM test double. This checks
// event wiring, not Chromium rendering/accessibility or native persistence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
class Element {
  constructor(tag, connected = false) {
    this.tagName = tag; this.children = []; this.parentElement = null;
    this.listeners = new Map(); this.dataset = {}; this._text = ''; this._value = undefined;
    this.disabled = false; this.readOnly = false; this.checked = false; this.connected = connected;
    this.style = {setProperty: () => {}};
  }
  get isConnected() { return this.connected || Boolean(this.parentElement?.isConnected); }
  get options() { return this.children.filter(child => child.tagName === 'option'); }
  get value() {
    if (this.tagName === 'select') return this._value === undefined ? this.options[0]?.value || '' :
        this.options.some(option => option.value === this._value) ? this._value : '';
    return this._value || '';
  }
  set value(value) { this._value = String(value); }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set textContent(value) { this.replaceChildren(); this._text = String(value); }
  append(...items) { for (const item of items) { item.remove(); this.children.push(item); item.parentElement = this; } }
  remove() {
    if (this.parentElement) {
      this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
      this.parentElement = null;
    }
  }
  replaceChildren(...items) {
    for (const child of this.children) child.parentElement = null;
    this.children = []; this._text = ''; if (this.tagName === 'select') this._value = undefined;
    this.append(...items);
  }
  before(item) { this.parentElement.insertBefore(item, this); }
  insertBefore(item, reference) {
    item.remove(); this.children.splice(this.children.indexOf(reference), 0, item); item.parentElement = this;
  }
  insertAdjacentElement(position, item) {
    assert.equal(position, 'afterend');
    item.remove(); const parent = this.parentElement;
    parent.children.splice(parent.children.indexOf(this) + 1, 0, item); item.parentElement = parent;
  }
  find(predicate) {
    if (predicate(this)) return this;
    for (const child of this.children) { const result = child.find(predicate); if (result) return result; }
    return null;
  }
  querySelector(selector) { assert(selector.startsWith('#')); return this.find(node => node.id === selector.slice(1)); }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatchEvent(event) {
    this.pending = (this.listeners.get(event.type) || []).map(listener => listener(event));
    return true;
  }
  click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
  focus() { this.focused = true; }
  setAttribute(name, value) { this[name] = String(value); }
  set innerHTML(html) {
    this.replaceChildren();
    const stack = [this], voidTags = new Set(['input', 'br']);
    for (const token of html.match(/<[^>]*>|[^<]+/g) || []) {
      if (token.startsWith('</')) { stack.pop(); continue; }
      if (!token.startsWith('<')) { stack.at(-1)._text += token; continue; }
      const tag = token.match(/^<([a-z0-9-]+)/)[1], child = new Element(tag);
      for (const match of token.matchAll(/([a-z-]+)="([^"]*)"/g)) child[match[1]] = match[2];
      stack.at(-1).append(child); if (!voidTags.has(tag)) stack.push(child);
    }
    assert.equal(stack.length, 1, 'Test fixture HTML must be balanced');
  }
}
const body = new Element('body', true), document = {body,
  querySelector: selector => body.querySelector(selector), createElement: tag => new Element(tag)};
const add = (tag, id, value = '') => {
  const node = new Element(tag); node.id = 'skin-studio-' + id; node.value = value; body.append(node); return node;
};
const source = add('textarea', 'source'), status = add('p', 'status');
const fixture = JSON.parse(read('docs/tahai-skins/operational-skin-v2.example.json'));
fixture.operational.workflows = [{id: 'workflow-one', name: 'First workflow', inputs: [
  {id: 'approved', name: 'Approved', type: 'boolean', required: false}], steps: [
  {id: 'review', name: 'Review result', kind: 'checkpoint', when: {input: 'approved', equals: 'true'}}]}];
for (const mode of fixture.operational.modes) mode.workflow = 'workflow-one';
source.value = JSON.stringify(fixture);
const title = add('input', 'workflow-name'), label = new Element('label');
title.before(label); label.append(title);
const kind = add('select', 'step-kind');
for (const value of ['instruction', 'checkpoint']) { const option = new Element('option'); option.value = value; kind.append(option); }
kind.value = 'checkpoint';
add('input', 'step-name'); add('button', 'add-step'); add('ol', 'workflow-steps');
const context = {window: {}, document, Map, Set, Event, TextEncoder, URL};
vm.createContext(context);
const resource = read('chrome/browser/ui/webui/tahai/tahai_skin_studio_workflow_model.h');
const blocks = [...resource.matchAll(/R"TAHAI\(([\s\S]*?)\)TAHAI"/g)];
// Match the actual skin-studio.js concatenation order, including bootstrap.
for (const index of [0, 1, 3, 2]) vm.runInContext(blocks[index][1], context, {timeout: 1000});
const tools = read('chrome/browser/ui/webui/tahai/tahai_skin_studio_workflow_tools.h').match(/R"TAHAI\(([\s\S]*?)\)TAHAI"/)[1];
vm.runInContext(tools, context, {timeout: 1000});
const get = id => document.querySelector('#skin-studio-' + id);
const change = (id, value) => { get(id).value = value; get(id).dispatchEvent(new Event('change')); };
const click = id => get(id).click();
const parsed = () => JSON.parse(source.value), selected = () => context.window.tahaiStudioWorkflows.current().workflow;
let checks = 0;
const check = fn => { fn(); ++checks; };
check(() => {
  assert.equal(get('workflow-select').value, 'workflow-one');
  assert.equal(get('workflow-name').value, 'First workflow');
  assert(get('workflow-remove').disabled);
});
check(() => {
  get('workflow-new-name').value = 'Secondary'; click('workflow-copy');
  assert.equal(parsed().operational.workflows.length, 2);
  assert.equal(get('workflow-select').value, 'workflow-secondary');
  assert.equal(get('workflow-name').value, 'Secondary');
  assert.equal(parsed().operational.modes[0].workflow, 'workflow-one');
});
check(() => {
  change('workflow-name', 'Independent title');
  assert.equal(selected().name, 'Independent title');
  assert.equal(parsed().operational.workflows[0].name, 'First workflow');
  const input = get('workflow-steps').find(node => node.dataset.workflowStep === 'review');
  input.value = 'Independent label'; input.dispatchEvent(new Event('change'));
  assert.equal(selected().steps[0].name, 'Independent label');
  assert.equal(parsed().operational.workflows[0].steps[0].name, 'Review result');
});
check(() => {
  const before = source.value; change('workflow-name', '<invalid>');
  assert.equal(source.value, before); assert.equal(get('workflow-name').value, 'Independent title');
  assert(status.textContent.includes('No source was changed'));
});
check(() => {
  click('workflow-bind'); assert.equal(parsed().operational.modes[0].workflow, 'workflow-secondary');
  assert(get('workflow-remove').disabled); assert(get('workflow-bind').disabled);
});
check(() => {
  const before = source.value; click('simulate');
  assert(get('simulation-status').textContent.includes('branch choices'));
  const input = get('simulation-inputs').find(node => node.dataset.simulationInput === 'approved');
  input.value = 'true'; input.dispatchEvent(new Event('change'));
  const completion = get('simulation-steps').find(node => node.tagName === 'button');
  assert(completion); completion.click();
  assert(get('simulation-status').textContent.includes('Simulation complete'));
  assert.equal(source.value, before);
});
check(() => {
  const stale = get('workflow-steps').find(node => node.dataset.workflowStep === 'review');
  const before = source.value; change('workflow-select', 'workflow-one');
  assert.equal(get('workflow-name').value, 'First workflow'); assert.equal(source.value, before);
  stale.value = 'Wrong workflow'; stale.dispatchEvent(new Event('change'));
  assert.equal(source.value, before);
  assert.equal(get('simulation-inputs').find(node => node.dataset.simulationInput === 'approved').value, '');
});
check(() => {
  const input = get('simulation-inputs').find(node => node.dataset.simulationInput === 'approved');
  input.value = 'true'; input.dispatchEvent(new Event('change'));
  const staleCompletion = get('simulation-steps').find(node => node.tagName === 'button');
  change('workflow-select', 'workflow-secondary');
  staleCompletion.click(); input.value = 'false'; input.dispatchEvent(new Event('change'));
  click('simulate'); assert(get('simulation-status').textContent.includes('branch choices'));
});
check(() => {
  change('input-type', 'selection'); get('input-name').value = 'Scope'; get('input-options').value = 'Team, Personal';
  click('add-input'); assert.equal(selected().inputs.length, 2);
  assert.equal(parsed().operational.workflows[0].inputs.length, 1);
  change('condition-input', 'input-scope'); change('condition-value', 'Team'); click('condition-save');
  assert.equal(selected().steps[0].when.input, 'input-scope');
  const row = get('workflow-inputs').children[1], before = source.value;
  row.find(node => node.tagName === 'button').click(); assert.equal(source.value, before);
  assert(status.textContent.includes('conditions that use this input'));
});
check(() => {
  click('condition-clear'); get('workflow-inputs').children[1].find(node => node.tagName === 'button').click();
  assert.equal(selected().inputs.length, 1); assert(!selected().steps[0].when);
});
for (const [type, name, value] of [['date', 'Review day', '2028-02-29'], ['url', 'Reference site', 'https://example.test/reference']]) {
  check(() => {
    change('input-type', type); get('input-name').value = name; get('input-required').checked = true;
    click('add-input'); assert.equal(selected().inputs.at(-1).type, type);
    const id = selected().inputs.at(-1).id;
    const control = get('simulation-inputs').find(node => node.dataset.simulationInput === id);
    assert.equal(control.type, type);
    if (type === 'date') { assert.equal(control.min, '0001-01-01'); assert.equal(control.max, '9999-12-31'); }
    const before = source.value;
    control.value = value; control.dispatchEvent(new Event('change'));
    assert.equal(source.value, before, 'Simulator values never enter the package source');
    get('workflow-inputs').children.at(-1).find(node => node.tagName === 'button' && node.textContent === 'Remove').click();
    assert.equal(selected().inputs.length, 1);
  });
}
change('input-type', 'selection');
check(() => {
  const before = source.value; get('input-name').value = 'Duplicate options'; get('input-options').value = 'Team, Team';
  click('add-input'); assert.equal(source.value, before);
  get('step-name').value = '<invalid>'; click('add-step'); assert.equal(source.value, before);
});
check(() => {
  const before = source.value; source.readOnly = true;
  change('workflow-name', 'Forbidden'); get('workflow-new-name').value = 'Forbidden';
  for (const id of ['workflow-create', 'workflow-copy', 'workflow-bind', 'workflow-remove', 'add-input', 'add-step']) click(id);
  assert.equal(source.value, before); source.readOnly = false; source.dispatchEvent(new Event('input'));
});
check(() => {
  get('workflow-new-name').value = 'New blank'; click('workflow-create');
  assert.equal(selected().inputs.length, 0); assert.equal(selected().steps.length, 1);
  assert.equal(parsed().operational.modes[0].workflow, 'workflow-secondary');
  click('workflow-remove'); assert.equal(parsed().operational.workflows.length, 2);
});
check(() => {
  const before = source.value; source.value = '{'; source.dispatchEvent(new Event('input'));
  assert(get('workflow-copy').disabled); assert(get('add-step').disabled); assert(get('simulate').disabled);
  source.value = before; source.dispatchEvent(new Event('input')); assert(!get('workflow-copy').disabled);
});
check(() => {
  // Exercise the native quota through actual add listeners without ever
  // replacing the valid source with a 33-step workflow.
  while (selected().steps.length < 32) { get('step-name').value = 'Another step'; click('add-step'); }
  assert(get('add-step').disabled); const before = source.value;
  click('add-step'); assert.equal(source.value, before);
});

// Actual asynchronous import listener: no filesystem, clipboard or native
// endpoint is connected to this DOM double.
const imported = add('input', 'import');
const ui = read('chrome/browser/ui/webui/tahai/tahai_ui.cc');
const importScript = ui.match(/constexpr char kSkinStudioImportExportJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)[1];
vm.runInContext(importScript, context, {timeout: 1000});
const beginImport = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  imported.files = [{size: 16, text: () => promise}]; imported.dispatchEvent(new Event('change'));
  return {resolve, reject, pending: Promise.all(imported.pending)};
};
const beforeImport = source.value;
let pending = beginImport();
source.value = beforeImport + ' '; source.dispatchEvent(new Event('input'));
pending.resolve('new file'); await pending.pending;
check(() => { assert.equal(source.value, beforeImport + ' '); assert(status.textContent.includes('Nothing was replaced')); });
pending = beginImport(); source.readOnly = true; pending.resolve('managed overwrite'); await pending.pending;
check(() => assert.equal(source.value, beforeImport + ' ')); source.readOnly = false;
const oldImport = beginImport(), currentImport = beginImport();
oldImport.resolve('stale file'); await oldImport.pending;
check(() => assert.equal(source.value, beforeImport + ' '));
currentImport.resolve(beforeImport); await currentImport.pending;
check(() => assert.equal(source.value, beforeImport));
pending = beginImport(); pending.reject(new Error('read failed')); await pending.pending;
check(() => { assert.equal(source.value, beforeImport); assert(status.textContent.includes('could not be read')); });
const oldFailure = beginImport(), winningImport = beginImport();
winningImport.resolve(beforeImport); await winningImport.pending;
const winningStatus = status.textContent;
oldFailure.reject(new Error('stale failure')); await oldFailure.pending;
check(() => assert.equal(status.textContent, winningStatus));

const palette = add('select', 'palette'), dark = new Element('option'); dark.value = 'dark_tokens'; palette.append(dark);
add('div', 'tokens'); add('article', 'preview');
// Scheduled native autosave is deliberately disconnected in this test double.
context.window.clearTimeout = () => {}; context.window.setTimeout = () => 1;
const paletteScript = ui.match(/constexpr char kSkinStudioJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)[1];
vm.runInContext(paletteScript, context, {timeout: 1000});
check(() => {
  const simInput = get('simulation-inputs').find(node => node.dataset.simulationInput === 'approved');
  simInput.value = 'true'; simInput.dispatchEvent(new Event('change'));
  let changes = 0; source.addEventListener('input', () => ++changes);
  const color = get('tokens').find(node => node.tagName === 'input');
  assert(color); color.value = '#123456'; color.dispatchEvent(new Event('input'));
  assert.equal(changes, 1, 'Palette edits must reach source history and all other draft listeners');
  assert.equal(parsed().appearance.dark_tokens.shell_background, '#123456');
  assert.equal(get('simulation-inputs').find(node => node.dataset.simulationInput === 'approved').value, '');
});
check(() => {
  source.value = JSON.stringify(fixture); source.dispatchEvent(new Event('input'));
  const capabilities = JSON.stringify(parsed().operational.capabilities);
  change('step-kind', 'run-command');
  get('step-action').value = 'mission.open'; get('step-name').value = 'Open mission'; click('add-step');
  assert.equal(selected().steps.at(-1).kind, 'run-command');
  assert.equal(selected().steps.at(-1).action, 'mission.open');
  assert.equal(JSON.stringify(parsed().operational.capabilities), capabilities);
});
check(() => {
  const step = selected().steps.at(-1);
  const control = get('workflow-steps').find(node => node.dataset.workflowAction === step.id);
  control.value = 'layout.dual'; control.dispatchEvent(new Event('change'));
  assert.equal(selected().steps.at(-1).action, 'layout.dual');
  const before = source.value;
  const current = get('workflow-steps').find(node => node.dataset.workflowAction === step.id);
  current.value = 'arbitrary.command'; current.dispatchEvent(new Event('change'));
  assert.equal(source.value, before);
});
check(() => {
  const before = source.value;
  get('step-action').value = 'arbitrary.command'; get('step-name').value = 'Not allowed'; click('add-step');
  assert.equal(source.value, before);
});
check(() => {
  const control = get('workflow-steps').find(node => node.dataset.workflowAction === selected().steps.at(-1).id);
  get('workflow-new-name').value = 'Native copy'; click('workflow-copy');
  const before = source.value;
  control.value = 'mission.open'; control.dispatchEvent(new Event('change'));
  assert.equal(source.value, before, 'Detached action controls cannot edit the newly selected workflow');
});
check(() => {
  const parsedSource = parsed();
  for (const workflow of parsedSource.operational.workflows) {
    workflow.steps = workflow.steps.filter(step => step.kind !== 'run-command');
  }
  parsedSource.operational.capabilities = [];
  source.value = JSON.stringify(parsedSource); source.dispatchEvent(new Event('input'));
  const before = source.value;
  assert(get('step-action').disabled); assert(get('add-step').disabled);
  get('step-action').value = 'mission.open'; click('add-step');
  assert.equal(source.value, before, 'Authoring never adds capability declarations automatically');
});
check(() => {
  change('input-type', 'text'); get('input-name').value = 'Private entry';
  get('input-protected').checked = true; get('input-required').checked = true;
  click('add-input');
  assert.equal(selected().inputs.at(-1).protected, true);
  assert(get('workflow-inputs').textContent.includes('protected'));
  assert.equal(get('input-protected').checked, false);
  const control = get('simulation-inputs').find(node => node.dataset.simulationInput === 'input-private-entry');
  assert.equal(control.type, 'password'); assert.equal(control.autocomplete, 'new-password');
  const before = source.value;
  control.value = 'password=dummy:@/secret'; control.dispatchEvent(new Event('change'));
  assert.equal(control.value, '');
  assert.equal(source.value, before); assert(!source.value.includes('dummy:@/secret'));
  click('simulation-reset'); click('simulate');
  assert(get('simulation-status').textContent.includes('Private entry'));
});
check(() => {
  change('input-type', 'boolean'); get('input-name').value = 'Private flag';
  get('input-protected').checked = true; click('add-input');
  assert(!get('condition-input').options.some(option => option.value === 'input-private-flag'));
  assert.equal(get('simulation-inputs').find(node => node.dataset.simulationInput === 'input-private-flag').type, 'password');
});
check(() => {
  change('input-type', 'number'); get('input-name').value = 'Bounded amount';
  get('input-lower').value = '-0.5'; get('input-upper').value = '3'; click('add-input');
  assert.deepEqual(JSON.parse(JSON.stringify(selected().inputs.at(-1).validation)), {minimum: -.5, maximum: 3});
  assert.equal(get('input-lower').value, ''); assert.equal(get('input-upper').value, '');
});
check(() => {
  get('input-name').value = 'Invalid range'; get('input-lower').value = '4'; get('input-upper').value = '3';
  const before = source.value; click('add-input'); assert.equal(source.value, before);
  assert(status.textContent.includes('validation limits'));
  get('input-lower').value = 'nonsense'; click('add-input'); assert.equal(source.value, before);
  change('input-type', 'text'); assert.equal(get('input-lower').value, '');
  get('input-name').value = 'Bounded text'; get('input-lower').value = '2'; get('input-upper').value = '4';
  click('add-input'); assert.deepEqual(JSON.parse(JSON.stringify(selected().inputs.at(-1).validation)), {min_bytes: 2, max_bytes: 4});
});
const limitControl = key => get('workflow-inputs').find(node => node.dataset.workflowLimit === 'input-bounded-text:' + key);
const limitSave = () => get('workflow-inputs').find(node => node.dataset.workflowLimits === 'input-bounded-text');
check(() => {
  const before = source.value; limitControl('max_bytes').value = '1'; limitSave().click();
  assert.equal(source.value, before);
  limitControl('max_bytes').value = '8'; limitSave().click();
  assert.deepEqual(JSON.parse(JSON.stringify(selected().inputs.at(-1).validation)), {min_bytes: 2, max_bytes: 8});
});
check(() => {
  const stale = limitSave(); limitControl('min_bytes').value = ''; limitControl('max_bytes').value = ''; stale.click();
  assert(!Object.hasOwn(selected().inputs.at(-1), 'validation'));
  const before = source.value; stale.click(); assert.equal(source.value, before);
});
check(() => {
  const stale = limitSave(); get('workflow-new-name').value = 'Rule copy'; click('workflow-copy');
  const before = source.value; stale.click(); assert.equal(source.value, before);
  source.readOnly = true; source.dispatchEvent(new Event('input'));
  assert(get('input-lower').disabled); assert(limitSave().disabled);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
});
check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  current.inputs = [{id: 'source-input', name: 'Source', type: 'text', required: true},
    {id: 'private-input', name: 'Private', type: 'text', required: false, protected: true}];
  current.steps = [{id: 'review', name: 'Review', kind: 'checkpoint'}];
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input'));
  get('output-name').value = 'Final result'; get('output-input').value = 'source-input'; click('output-add');
  assert.equal(selected().outputs[0].from.input, 'source-input');
  assert.equal(selected().outputs[0].id, 'output-final-result');
  assert.equal(get('output-name').value, '');
  const before = source.value;
  get('workflow-inputs').children[0].find(node => node.textContent === 'Remove' && node.tagName === 'button').click();
  assert.equal(source.value, before); assert(status.textContent.includes('named outputs'));
});
const outputControl = (key, id = 'output-final-result') => get('outputs').find(node => node.dataset[key] === id);
check(() => {
  const before = source.value, name = outputControl('workflowOutputName'); name.value = '<invalid>';
  name.dispatchEvent(new Event('change')); assert.equal(source.value, before); assert.equal(name.value, 'Final result');
  name.value = 'Reviewed result'; name.dispatchEvent(new Event('change'));
  assert.equal(selected().outputs[0].name, 'Reviewed result');
  const stale = outputControl('workflowOutputName'), from = outputControl('workflowOutputInput');
  from.value = 'private-input'; from.dispatchEvent(new Event('change'));
  assert.equal(selected().outputs[0].from.input, 'private-input');
  const after = source.value; stale.value = 'Stale edit'; stale.dispatchEvent(new Event('change'));
  assert.equal(source.value, after);
});
check(() => {
  const before = source.value;
  get('output-name').value = '<unsafe>'; click('output-add'); assert.equal(source.value, before);
  get('output-name').value = 'Ordinary result'; get('output-input').value = 'source-input'; click('output-add');
  const projection = get('simulation-outputs');
  click('simulate'); assert.equal(projection.children.length, 0);
  const ordinary = get('simulation-inputs').find(node => node.dataset.simulationInput === 'source-input');
  const secret = get('simulation-inputs').find(node => node.dataset.simulationInput === 'private-input');
  ordinary.value = 'Local result'; ordinary.dispatchEvent(new Event('change'));
  secret.value = 'password=dummy-only:@/'; secret.dispatchEvent(new Event('change'));
  const design = source.value;
  assert.equal(secret.value, ''); assert.equal(projection.children.length, 0);
  get('simulation-steps').find(node => node.tagName === 'button').click();
  assert.equal(projection.children.length, 2); assert(projection.textContent.includes('Local result'));
  assert(projection.textContent.includes('Protected result (masked)')); assert(!projection.textContent.includes('dummy-only'));
  assert.equal(source.value, design); assert(!source.value.includes('Local result'));
  ordinary.value = 'Changed'; ordinary.dispatchEvent(new Event('change'));
  assert.equal(projection.children.length, 0, 'Changing a value invalidates simulated completion and results');
  click('simulation-reset'); assert.equal(projection.children.length, 0);
});
check(() => {
  const stale = outputControl('workflowOutputRemove');
  get('workflow-new-name').value = 'Output copy'; click('workflow-copy');
  const before = source.value; stale.click(); assert.equal(source.value, before);
  source.readOnly = true; source.dispatchEvent(new Event('input'));
  assert(get('output-add').disabled); assert(outputControl('workflowOutputRemove').disabled);
  outputControl('workflowOutputRemove').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
  outputControl('workflowOutputRemove').click(); assert.equal(selected().outputs.length, 1);
});
check(() => {
  while (selected().outputs.length < 12) {
    get('output-name').value = 'Same name'; get('output-input').value = 'source-input'; click('output-add');
  }
  const before = source.value; assert(get('output-add').disabled); click('output-add'); assert.equal(source.value, before);
  assert.equal(new Set(selected().outputs.map(output => output.id)).size, 12);
  get('workflow-new-name').value = 'Blank outputs'; click('workflow-create');
  assert(get('output-add').disabled); assert.equal(get('outputs').children.length, 0);
  assert.equal(get('simulation-outputs').children.length, 0);
});
check(() => {
  get('input-name').value = 'Amount'; change('input-type', 'number'); click('add-input');
  get('variable-name').value = 'Total'; get('variable-template').value = 'input-amount'; click('variable-add');
  assert.equal(selected().variables[0].id, 'variable-total');
  assert.equal(selected().variables[0].type, 'number'); assert(!('value' in selected().variables[0]));
  get('assignment-target').value = 'variable-total'; get('assignment-source').value = 'input-amount'; click('assignment-save');
  assert.equal(selected().steps[0].kind, 'assign-variable');
  assert.deepEqual(JSON.parse(JSON.stringify(selected().steps[0].assign)), {variable: 'variable-total', from: {input: 'input-amount'}});
  get('output-name').value = 'Total result'; get('output-input').value = 'variable:variable-total'; click('output-add');
  assert.equal(selected().outputs[0].from.variable, 'variable-total');
});
const variableControl = key => get('variables').find(node => node.dataset[key] === 'variable-total');
check(() => {
  const before = source.value;
  variableControl('workflowVariableRemove').click(); assert.equal(source.value, before);
  assert(status.textContent.includes('assignments and outputs'));
  get('workflow-inputs').children[0].find(node => node.tagName === 'button' && node.textContent === 'Remove').click();
  assert.equal(source.value, before); assert(status.textContent.includes('assignments'));
});
check(() => {
  const name = variableControl('workflowVariableName'); name.value = 'Reviewed total'; name.dispatchEvent(new Event('change'));
  assert.equal(selected().variables[0].name, 'Reviewed total');
  const control = get('simulation-inputs').find(node => node.dataset.simulationInput === 'input-amount');
  control.value = '3.25'; control.dispatchEvent(new Event('change'));
  const before = source.value;
  const button = get('simulation-steps').find(node => node.tagName === 'button');
  assert.equal(button.textContent, 'Assign in simulation'); button.click();
  assert(get('simulation-outputs').textContent.includes('3.25')); assert.equal(source.value, before);
  click('simulation-reset'); assert.equal(get('simulation-outputs').children.length, 0);
});
check(() => {
  const stale = variableControl('workflowVariableName');
  get('workflow-new-name').value = 'Variable copy'; click('workflow-copy');
  const before = source.value; stale.value = 'Stale'; stale.dispatchEvent(new Event('change')); assert.equal(source.value, before);
  source.readOnly = true; source.dispatchEvent(new Event('input'));
  assert(get('variable-add').disabled); assert(get('assignment-save').disabled);
  get('assignment-save').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
  click('assignment-clear'); assert.equal(selected().steps[0].kind, 'checkpoint'); assert(!selected().steps[0].assign);
  get('outputs').find(node => node.dataset.workflowOutputRemove).click();
  variableControl('workflowVariableRemove').click(); assert.equal(selected().variables.length, 0);
});
check(() => {
  change('input-type', 'text'); get('input-name').value = 'Secret'; get('input-protected').checked = true; click('add-input');
  assert(get('variable-template').options.some(option => option.value === 'input-secret'));
  change('variable-template','input-secret'); assert(get('variable-protected').checked); assert(get('variable-protected').disabled);
  get('variable-name').value = 'Protected copy'; get('variable-protected').checked=false; click('variable-add');
  assert.equal(selected().variables[0].protected,true);
  get('variables').find(node=>node.dataset.workflowVariableRemove==='variable-protected-copy').click();
  assert.equal(selected().variables.length,0);
  change('variable-template','input-secret'); get('variable-protected').checked=false;
});
check(() => {
  get('wait-seconds').value = '3'; click('wait-save');
  assert.equal(selected().steps[0].kind, 'wait'); assert.equal(selected().steps[0].wait.seconds, 3);
  assert(!selected().steps[0].assign);
  const before = source.value;
  click('simulate'); let button = get('simulation-steps').find(node => node.tagName === 'button');
  assert.equal(button.textContent, 'Start wait in simulation'); button.click();
  button = get('simulation-steps').find(node => node.tagName === 'button');
  assert.equal(button.textContent, 'Advance time and complete in simulation'); button.click();
  assert.equal(source.value, before); assert(!source.value.includes('remaining_ms'));
  click('simulation-reset'); click('simulate');
  assert.equal(get('simulation-steps').find(node => node.tagName === 'button').textContent, 'Start wait in simulation');
});
for (const seconds of ['0', '-1', '86401', '1.5', 'NaN', '', '1e3']) check(() => {
  const before = source.value; get('wait-seconds').value = seconds; click('wait-save'); assert.equal(source.value, before);
});
check(() => {
  source.readOnly = true; source.dispatchEvent(new Event('input'));
  assert(get('wait-save').disabled); assert(get('wait-clear').disabled);
  const before = source.value; get('wait-save').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input')); click('wait-clear');
  assert.equal(selected().steps[0].kind, 'checkpoint'); assert(!selected().steps[0].wait);
});
check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  current.inputs = []; current.variables = []; current.outputs = [];
  doc.operational.capabilities = ['mission-checklist'];
  current.steps = [{id: 'delay', name: 'Delay', kind: 'wait', wait: {seconds: 1}},
    {id: 'native', name: 'Native', kind: 'run-command', action: 'mission.open'}];
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input')); click('simulate');
  const button = index => get('simulation-steps').children[index].find(node => node.tagName === 'button');
  assert(button(1).disabled); button(1).dispatchEvent(new Event('click'));
  assert(!get('simulation-status').textContent.includes('Simulation complete'));
  const staleStart = button(0); staleStart.click();
  assert(button(1).disabled); assert.equal(button(0).textContent, 'Advance time and complete in simulation');
  staleStart.click(); assert.equal(button(0).textContent, 'Advance time and complete in simulation');
  button(0).click(); assert(!button(1).disabled);
  button(1).click(); assert(get('simulation-status').textContent.includes('Simulation complete'));
});
check(() => {
  get('wait-seconds').value = '3'; get('wait-timeout').value = '5'; click('wait-save');
  assert.equal(selected().steps[0].wait.timeout_seconds, 5);
  const original = source.value; click('simulate');
  get('simulation-steps').children[0].find(node => node.tagName === 'button').click();
  const expire = get('simulation-steps').children[0].find(node => node.textContent === 'Advance to deadline and fail in simulation');
  assert(expire); expire.click();
  assert(get('simulation-status').textContent.includes('Simulation failed: wait-timed-out'));
  assert.equal(get('simulation-steps').find(node => node.tagName === 'button'), null);
  assert.equal(get('simulation-outputs').children.length, 0); assert.equal(source.value, original);
  click('simulation-reset'); click('simulate');
  assert(!get('simulation-status').textContent.includes('failed'));
  const before = get('simulation-status').textContent; expire.click(); assert.equal(get('simulation-status').textContent, before);
});
for (const deadline of ['0', '-1', '3', '2', '86401', '4.5', '1e3', 'NaN']) check(() => {
  const before = source.value; get('wait-timeout').value = deadline; click('wait-save'); assert.equal(source.value, before);
});
check(() => {
  source.readOnly = true; source.dispatchEvent(new Event('input')); assert(get('wait-timeout').disabled);
  const before = source.value; get('wait-save').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
  get('wait-timeout').value = ''; click('wait-save'); assert(!('timeout_seconds' in selected().steps[0].wait));
});
for (const [label, code] of [['Simulate rejected action', 'native-rejected'], ['Simulate unknown outcome', 'native-outcome-unknown']]) check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  current.steps = [{id: 'review', name: 'Review', kind: 'checkpoint'},
    {id: 'native', name: 'Native', kind: 'run-command', action: 'mission.open'},
    {id: 'after', name: 'After', kind: 'checkpoint'}];
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input')); click('simulate');
  const failure = () => get('simulation-steps').find(node => node.tagName === 'button' && node.textContent === label);
  assert(failure().disabled); failure().click(); assert(!get('simulation-status').textContent.includes('failed'));
  get('simulation-steps').children[0].find(node => node.tagName === 'button').click();
  const stale = failure(), original = source.value; assert(!stale.disabled); stale.click();
  assert(get('simulation-status').textContent.includes('Simulation failed: ' + code));
  if (code === 'native-outcome-unknown') assert(get('simulation-status').textContent.includes('may have happened'));
  assert.equal(get('simulation-steps').find(node => node.tagName === 'button'), null);
  assert.equal(get('simulation-outputs').children.length, 0); assert.equal(source.value, original);
  click('simulation-reset'); click('simulate'); const before = get('simulation-status').textContent;
  stale.click(); assert.equal(get('simulation-status').textContent, before);
});
check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  doc.operational.capabilities = [];
  current.inputs = [{id: 'amount', name: 'Amount', type: 'number', required: false}];
  current.variables = [{id: 'total', name: 'Total', type: 'number'}, {id: 'factor', name: 'Factor', type: 'number'}];
  current.outputs = [{id: 'result', name: 'Result', from: {variable: 'total'}}];
  current.steps = [{id: 'calculate', name: 'Calculate', kind: 'checkpoint'}];
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input'));
  get('assignment-target').value = 'total';
  get('calculation-expression').value = JSON.stringify({op: 'multiply', args: [{input: 'amount'}, {number: 2}]});
  click('calculation-save');
  assert.equal(selected().steps[0].kind, 'assign-variable');
  assert.equal(selected().steps[0].assign.expression.op, 'multiply');
  assert(!('from' in selected().steps[0].assign));
  assert.equal(JSON.parse(get('calculation-expression').value).args[0].input, 'amount');
  const before = source.value;
  get('workflow-inputs').children[0].find(node => node.tagName === 'button' && node.textContent === 'Remove').click();
  assert.equal(source.value, before); assert(status.textContent.includes('assignments'));
});
for (const expression of ['{', '{"number":true}', '{"input":"missing"}', '{"op":"eval","args":[]}']) check(() => {
  const before = source.value; get('calculation-expression').value = expression; click('calculation-save');
  assert.equal(source.value, before);
});
check(() => {
  click('simulate'); const before = source.value;
  const input = get('simulation-inputs').find(node => node.dataset.simulationInput === 'amount');
  input.value = '3.125'; input.dispatchEvent(new Event('change'));
  get('simulation-steps').find(node => node.tagName === 'button').click();
  assert(get('simulation-outputs').textContent.includes('6.25'));
  assert.equal(source.value, before); assert(!source.value.includes('6.25'));
  click('simulation-reset'); assert.equal(get('simulation-outputs').children.length, 0);
});
check(() => {
  get('calculation-expression').value = JSON.stringify({op: 'add', args: [{input: 'amount'}, {variable: 'factor'}]});
  click('calculation-save'); const before = source.value;
  get('variables').find(node => node.dataset.workflowVariableRemove === 'factor').click();
  assert.equal(source.value, before); assert(status.textContent.includes('assignments and outputs'));
  source.readOnly = true; source.dispatchEvent(new Event('input'));
  assert(get('calculation-save').disabled); assert(get('calculation-expression').disabled);
  get('calculation-expression').value = '{"number":99}'; get('calculation-save').dispatchEvent(new Event('click'));
  assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
  assert.equal(JSON.parse(get('calculation-expression').value).args[1].variable, 'factor');
  get('assignment-source').value = 'amount'; click('assignment-save');
  assert.equal(selected().steps[0].assign.from.input, 'amount'); assert(!selected().steps[0].assign.expression);
});
check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  current.inputs.push({id: 'secret-number', name: 'Secret number', type: 'number', required: false, protected: true});
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input'));
  assert(get('calculation-left').options.some(option => option.value === 'amount'));
  assert(get('calculation-left').options.some(option => option.value === 'variable:factor'));
  assert(!get('calculation-left').options.some(option => option.value === 'secret-number'));
  assert.equal(get('calculation-operation').value, 'add');
});
for (const op of ['value', 'add', 'subtract', 'multiply', 'divide', 'min', 'max', 'abs', 'negate']) check(() => {
  change('calculation-operation', op); change('calculation-left', 'amount'); change('calculation-right', '$number');
  get('calculation-right-number').value = '2';
  const unary = ['value', 'abs', 'negate'].includes(op);
  assert.equal(get('calculation-right').disabled, unary); assert(get('calculation-left-number').disabled);
  if (unary) get('calculation-right-number').value = 'not used';
  click('calculation-basic-save');
  const expression = selected().steps[0].assign.expression;
  if (op === 'value') assert.equal(expression.input, 'amount');
  else {
    assert.equal(expression.op, op); assert.equal(expression.args[0].input, 'amount');
    assert.equal(expression.args.length, unary ? 1 : 2);
    if (!unary) assert.equal(expression.args[1].number, 2);
  }
  assert.equal(get('calculation-operation').value, op); assert.equal(get('calculation-left').value, 'amount');
});
for (const [text, expected] of [['0', 0], ['-2.5', -2.5], ['.25', .25], ['1e3', 1000], ['1e-7', 1e-7], ['1000000000000', 1e12]]) check(() => {
  change('calculation-operation', 'value'); change('calculation-left', '$number');
  get('calculation-left-number').value = text; click('calculation-basic-save');
  assert.equal(selected().steps[0].assign.expression.number, expected);
  assert(!get('calculation-left-number').disabled); assert(get('calculation-right-number').disabled);
});
for (const text of ['', 'NaN', 'Infinity', '0x10', ' 1 ', '1000000000001', '-1000000000001', '1e999', '1;alert(1)', '1'.repeat(257)]) check(() => {
  const before = source.value; get('calculation-left-number').value = text; click('calculation-basic-save');
  assert.equal(source.value, before); assert(status.textContent.includes('No source was changed'));
});
check(() => {
  const expression = {op: 'multiply', args: [{op: 'add', args: [{input: 'amount'}, {number: 1}]}, {number: 2}]};
  get('calculation-expression').value = JSON.stringify(expression); click('calculation-save');
  const before = source.value; assert(get('calculation-basic-save').disabled);
  assert.equal(get('calculation-operation').value, ''); assert(get('calculation-basic-status').textContent.includes('preserved'));
  get('calculation-basic-save').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  change('calculation-operation', 'value'); assert.equal(source.value, before);
  change('calculation-left', 'variable:factor'); click('calculation-basic-save');
  assert.equal(selected().steps[0].assign.expression.variable, 'factor');
  assert.equal(get('calculation-left').value, 'variable:factor'); assert.equal(get('calculation-operation').value, 'value');
});
check(() => {
  source.readOnly = true; source.dispatchEvent(new Event('input')); const before = source.value;
  for (const id of ['operation', 'left', 'right', 'left-number', 'right-number', 'basic-save']) assert(get('calculation-' + id).disabled);
  get('calculation-basic-save').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
  change('calculation-left', 'secret-number'); get('calculation-basic-save').dispatchEvent(new Event('click'));
  assert.equal(source.value, before);
});
check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  doc.operational.capabilities = ['mission-checklist'];
  current.steps = [{id: 'native', name: 'Native', kind: 'run-command', action: 'mission.open'}];
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input')); const before = source.value;
  assert(get('calculation-basic-save').disabled); get('calculation-basic-save').dispatchEvent(new Event('click'));
  assert.equal(source.value, before);
});
for (const op of ['equal', 'not-equal', 'less-than', 'at-most', 'greater-than', 'at-least']) check(() => {
  change('condition-input', 'amount'); get('condition-operation').value = op; get('condition-number').value = '3.125';
  assert(get('condition-value').disabled); assert(!get('condition-number').disabled);
  assert(!get('condition-input').options.some(option => option.value === 'secret-number'));
  click('condition-save');
  assert.equal(selected().steps[0].when.input, 'amount'); assert.equal(selected().steps[0].when.compare.op, op);
  assert.equal(selected().steps[0].when.compare.number, 3.125); assert(!('equals' in selected().steps[0].when));
  assert.equal(get('condition-number').value, '3.125'); assert.equal(get('condition-operation').value, op);
});
for (const value of ['', 'NaN', 'Infinity', '1000000000001', '0x10', ' 1 ', '1;alert(1)', '1'.repeat(257)]) check(() => {
  const before = source.value; get('condition-number').value = value; click('condition-save');
  assert.equal(source.value, before); assert(status.textContent.includes('No source was changed'));
});
check(() => {
  source.dispatchEvent(new Event('input')); const before = source.value;
  get('workflow-inputs').children[0].find(node => node.tagName === 'button' && node.textContent === 'Remove').click();
  assert.equal(source.value, before); assert(status.textContent.includes('conditions'));
  source.readOnly = true; source.dispatchEvent(new Event('input'));
  assert(get('condition-save').disabled); assert(get('condition-number').disabled); assert(get('condition-operation').disabled);
  get('condition-save').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input')); click('condition-clear');
  assert(!selected().steps[0].when);
});
const variableLimitControl = (id, key) => get('variables').find(node => node.dataset[key] === id);
check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  current.inputs[0].validation = {maximum: 4};
  current.variables.push({id: 'label', name: 'Label', type: 'text'}, {id: 'link', name: 'Link', type: 'url'},
      {id: 'flag', name: 'Flag', type: 'boolean'});
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input'));
  assert(variableLimitControl('total', 'workflowVariableLower'));
  assert.equal(variableLimitControl('flag', 'workflowVariableLimits'), null);
  assert.equal(variableLimitControl('total', 'workflowVariableLower')['aria-describedby'], 'skin-studio-variable-limits-total');
});
for (const [low, high, expected] of [['-3.5', '9.25', {minimum: -3.5, maximum: 9.25}],
  ['', '1e12', {maximum: 1e12}], ['.001', '', {minimum: .001}], ['', '', undefined]]) check(() => {
  variableLimitControl('total', 'workflowVariableLower').value = low;
  variableLimitControl('total', 'workflowVariableUpper').value = high;
  variableLimitControl('total', 'workflowVariableLimits').click();
  assert.equal(JSON.stringify(selected().variables.find(item => item.id === 'total').validation), JSON.stringify(expected));
  assert.equal(selected().inputs[0].validation.maximum, 4, 'Variable limits cannot rewrite source input limits');
});
for (const [low, high] of [['4', '2'], ['NaN', ''], ['', 'Infinity'], ['0x10', ''], [' 1 ', ''],
  ['', '1000000000001'], ['1e999', ''], ['1'.repeat(33), '']]) check(() => {
  const before = source.value;
  variableLimitControl('total', 'workflowVariableLower').value = low;
  variableLimitControl('total', 'workflowVariableUpper').value = high;
  variableLimitControl('total', 'workflowVariableLimits').click(); assert.equal(source.value, before);
  assert(status.textContent.includes('No source was changed'));
});
for (const id of ['label', 'link']) check(() => {
  const set = (low, high) => {
    variableLimitControl(id, 'workflowVariableLower').value = low;
    variableLimitControl(id, 'workflowVariableUpper').value = high; variableLimitControl(id, 'workflowVariableLimits').click();
  };
  set('1', '4'); const before = source.value;
  assert.equal(selected().variables.find(item => item.id === id).validation.min_bytes, 1);
  assert.equal(selected().variables.find(item => item.id === id).validation.max_bytes, 4);
  for (const [low, high] of [['-1', '4'], ['1.5', '4'], ['1', '257'], ['0', '0'], ['5', '4']]) {
    set(low, high); assert.equal(source.value, before);
  }
  set('', ''); assert(!selected().variables.find(item => item.id === id).validation);
});
check(() => {
  const oldApply = variableLimitControl('total', 'workflowVariableLimits'), oldLow = variableLimitControl('total', 'workflowVariableLower');
  get('workflow-new-name').value = 'Variable limits copy'; click('workflow-copy');
  const before = source.value; oldLow.value = '99'; oldApply.dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = true; source.dispatchEvent(new Event('input'));
  for (const key of ['workflowVariableLower', 'workflowVariableUpper', 'workflowVariableLimits']) assert(variableLimitControl('total', key).disabled);
  variableLimitControl('total', 'workflowVariableLimits').dispatchEvent(new Event('click')); assert.equal(source.value, before);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
});
check(() => {
  const doc = parsed(), current = doc.operational.workflows.find(item => item.id === selected().id);
  current.inputs = [{id: 'secret', name: 'Secret', type: 'number', required: false, protected: true}];
  current.outputs = [];
  current.variables = [{id: 'total', name: 'Total', type: 'number'}, {id: 'flag', name: 'Flag', type: 'boolean'},
      {id: 'choice', name: 'Choice', type: 'selection', options: ['Yes', 'No']}];
  current.steps = [
    {id: 'first', name: 'Assign first', kind: 'assign-variable', assign: {variable: 'total', expression: {number: 2}}},
    {id: 'branch', name: 'Branch', kind: 'checkpoint'},
    {id: 'change', name: 'Assign later', kind: 'assign-variable', assign: {variable: 'total', expression: {number: 4}}},
    {id: 'finish', name: 'Finish', kind: 'checkpoint'}];
  source.value = JSON.stringify(doc); source.dispatchEvent(new Event('input'));
  change('condition-step', 'branch'); change('condition-input', 'variable:total');
  get('condition-operation').value = 'greater-than'; get('condition-number').value = '3'; click('condition-save');
  assert.equal(selected().steps[1].when.variable, 'total'); assert(!('input' in selected().steps[1].when));
  assert.equal(get('condition-input').value, 'variable:total'); assert(!get('condition-input').options.some(option => option.value === 'secret'));
  const original = source.value;
  get('variables').find(node => node.dataset.workflowVariableRemove === 'total').click();
  assert.equal(source.value, original); assert(status.textContent.includes('conditions'));
  click('simulate'); assert(get('simulation-steps').children[1].textContent.includes('Waiting for variable assignment'));
  assert(get('simulation-steps').children[3].find(node => node.tagName === 'button').disabled);
  get('simulation-steps').children[0].find(node => node.tagName === 'button').click();
  assert(get('simulation-steps').children[1].textContent.includes('Skipped by condition'));
  get('simulation-steps').children[2].find(node => node.tagName === 'button').click();
  assert(get('simulation-steps').children[1].textContent.includes('Skipped by condition (recorded decision)'));
  get('simulation-steps').children[3].find(node => node.tagName === 'button').click();
  assert(get('simulation-status').textContent.includes('Simulation complete')); assert.equal(source.value, original);
  source.dispatchEvent(new Event('input')); click('simulate');
  assert(get('simulation-steps').children[1].textContent.includes('Waiting for variable assignment'));
});
for (const [id, expected] of [['flag', 'true'], ['choice', 'Yes']]) check(() => {
  change('condition-step', 'branch'); change('condition-input', 'variable:' + id);
  assert(get('condition-number').disabled); assert(!get('condition-value').disabled);
  get('condition-value').value = expected; click('condition-save');
  assert.equal(selected().steps[1].when.variable, id); assert.equal(selected().steps[1].when.equals, expected);
  const original = source.value; source.readOnly = true; source.dispatchEvent(new Event('input'));
  get('condition-save').dispatchEvent(new Event('click')); assert.equal(source.value, original);
  source.readOnly = false; source.dispatchEvent(new Event('input'));
});
check(() => {
  change('condition-step','branch'); change('condition-input','variable:total');
  get('condition-operation').value = 'greater-than'; get('condition-number').value = '3'; click('condition-save');
  change('condition-input','variable:flag'); get('condition-value').value = 'true';
  get('condition-combine').value = 'all'; click('condition-save');
  assert.equal(selected().steps[1].when.all[1].variable,'flag');
  const tree = JSON.stringify(selected().steps[1].when); click('condition-negate');
  assert.equal(JSON.stringify(selected().steps[1].when.not),tree);
  assert.equal(JSON.stringify(JSON.parse(get('condition-expression').value)), JSON.stringify(selected().steps[1].when));
  const before = source.value;
  get('variables').find(node => node.dataset.workflowVariableRemove === 'flag').click();
  assert.equal(source.value,before); assert(status.textContent.includes('conditions'));
  change('condition-input','variable:choice'); get('condition-value').value='No';
  get('condition-combine').value='any'; click('condition-save');
  assert.equal(selected().steps[1].when.any[1].equals,'No');
});
for (const text of ['{', 'null', '[]', '{"any":[]}', '{"not":{"input":"secret","compare":{"op":"equal","number":0}}}',
  '{"all":[{"variable":"flag","equals":"true"}]}', JSON.stringify({not:{not:{not:{not:{not:{variable:'flag',equals:'true'}}}}}}), ' '.repeat(8193)]) check(() => {
  const before = source.value; get('condition-expression').value=text; click('condition-expression-save');
  assert.equal(source.value,before); assert(status.textContent.includes('No source was changed'));
});
check(() => {
  const expression = {any:[{variable:'flag',equals:'true'},{not:{variable:'choice',equals:'Yes'}}]};
  get('condition-expression').value=JSON.stringify(expression); click('condition-expression-save');
  assert.equal(JSON.stringify(selected().steps[1].when),JSON.stringify(expression));
  const before = source.value; source.readOnly=true; source.dispatchEvent(new Event('input'));
  for (const id of ['condition-expression','condition-expression-save','condition-negate','condition-combine']) assert(get(id).disabled);
  get('condition-negate').dispatchEvent(new Event('click')); get('condition-expression-save').dispatchEvent(new Event('click'));
  assert.equal(source.value,before); source.readOnly=false; source.dispatchEvent(new Event('input'));
  assert.equal(JSON.stringify(JSON.parse(get('condition-expression').value)),JSON.stringify(expression));
  click('condition-clear'); assert(!selected().steps[1].when);
});
check(()=>{
  const doc=parsed();doc.operational.workflows[0]={id:'repeat-flow',name:'Repeat flow',steps:[
    {id:'first',name:'First',kind:'checkpoint'},{id:'last',name:'Last',kind:'checkpoint'}]};
  for(const mode of doc.operational.modes)mode.workflow='repeat-flow';
  source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input'));change('workflow-select','repeat-flow');
  get('repeat-from').value='first';get('repeat-through').value='last';get('repeat-count').value='3';click('repeat-save');
  assert.equal(selected().repeats[0].count,3);assert.equal(get('repeat-choice').value,'repeat-1');
  assert(get('repeat-summary').textContent.includes('6 expanded'));click('simulate');
  assert.equal(get('simulation-steps').children.length,6);assert(get('simulation-steps').children[4].textContent.includes('[3/3] First'));
  const before=source.value;get('simulation-steps').children[0].find(node=>node.tagName==='button').click();
  assert.equal(source.value,before);assert(get('simulation-steps').children[0].textContent.includes('Complete'));
  source.dispatchEvent(new Event('input'));click('simulate');assert(get('simulation-steps').children[0].textContent.includes('Ready'));
});
for(const count of ['1','9','2.5','2e0',''])check(()=>{
  const before=source.value;get('repeat-count').value=count;click('repeat-save');assert.equal(source.value,before);assert(status.textContent.includes('Repeat rejected'));
});
check(()=>{
  change('repeat-choice','');get('repeat-from').value='last';get('repeat-through').value='last';get('repeat-count').value='2';
  const before=source.value;click('repeat-save');assert.equal(source.value,before);assert(status.textContent.includes('Repeat rejected'));
  change('repeat-choice','repeat-1');get('repeat-count').value='4';click('repeat-save');assert.equal(selected().repeats.length,1);
  assert.equal(selected().repeats[0].count,4);assert(get('repeat-summary').textContent.includes('8 expanded'));
});
check(()=>{
  const before=source.value;source.readOnly=true;source.dispatchEvent(new Event('input'));
  for(const id of ['repeat-save','repeat-remove','repeat-from','repeat-count'])assert(get(id).disabled);
  get('repeat-save').dispatchEvent(new Event('click'));get('repeat-remove').dispatchEvent(new Event('click'));assert.equal(source.value,before);
  source.readOnly=false;source.dispatchEvent(new Event('input'));change('repeat-choice','repeat-1');click('repeat-remove');
  assert.equal(selected().repeats.length,0);assert(get('repeat-summary').textContent.includes('2 expanded'));
});
check(()=>{
  const doc=parsed();const w=doc.operational.workflows[0];w.repeats=[];w.variables=[];w.outputs=[];
  w.inputs=[{id:'secret',name:'Secret',type:'number',required:false,protected:true},{id:'ordinary',name:'Ordinary',type:'number',required:false}];
  w.steps=[{id:'copy',name:'Copy',kind:'checkpoint'}];source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input'));
  change('variable-template','secret');get('variable-name').value='Private total';click('variable-add');
  assert.equal(selected().variables[0].protected,true);change('assignment-target','variable-private-total');
  assert(get('assignment-source').options.some(item=>item.value==='secret'));get('assignment-source').value='secret';click('assignment-save');
  assert(get('calculation-save').disabled);assert(get('calculation-expression').disabled);
  assert(!get('condition-input').options.some(item=>item.value==='variable:variable-private-total'));
  get('output-name').value='Private result';get('output-input').value='variable:variable-private-total';click('output-add');
  const before=source.value;const input=get('simulation-inputs').find(node=>node.dataset.simulationInput==='secret');
  input.value='2.5';input.dispatchEvent(new Event('change'));assert.equal(input.value,'');
  get('simulation-steps').find(node=>node.tagName==='button').click();
  assert(get('simulation-outputs').textContent.includes('Protected result (masked)'));assert(!get('simulation-outputs').textContent.includes('2.5'));
  assert.equal(source.value,before);source.readOnly=true;source.dispatchEvent(new Event('input'));assert(get('variable-protected').disabled);
  source.readOnly=false;source.dispatchEvent(new Event('input'));change('variable-template','ordinary');
  get('variable-name').value='Public total';get('variable-protected').checked=false;click('variable-add');
  change('assignment-target','variable-public-total');assert(!get('assignment-source').options.some(item=>item.value==='secret'));
  assert(!get('assignment-source').options.some(item=>item.value==='variable:variable-private-total'));
});
check(()=>{
  const doc=parsed(),w=doc.operational.workflows[0];w.inputs=[{id:'source',name:'Source',type:'text',required:false},{id:'secret',name:'Secret',type:'text',required:false,protected:true}];
  w.variables=[{id:'result',name:'Result',type:'text'}];w.steps=[{id:'format',name:'Format',kind:'checkpoint'}];w.outputs=[{id:'final',name:'Final',from:{variable:'result'}}];w.repeats=[];
  source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input'));change('assignment-target','result');
  assert(!get('text-save').disabled);assert(!get('text-first').options.some(item=>item.value==='secret'));assert(get('calculation-save').disabled);
});
for(const [op,expected] of [['concat','Ab!'],['trim-space','Ab'],['upper-ascii','AB'],['lower-ascii','ab'],['replace','Zb'],['value','Ab']])check(()=>{
  change('text-operation',op);change('text-first','$text');get('text-first-constant').value='Ab';
  change('text-second','$text');get('text-second-constant').value=op==='replace'?'A':'!';
  change('text-third','$text');get('text-third-constant').value='Z';click('text-basic-save');
  assert.equal(selected().steps[0].assign.text_expression.op,op==='value'?undefined:op);
  assert.equal(get('text-third').disabled,op!=='replace');
  const before=source.value;click('simulate');get('simulation-steps').find(node=>node.tagName==='button').click();
  assert(get('simulation-outputs').textContent.includes(expected));assert.equal(source.value,before);
});
for(const invalid of ['{','{"text":true}','{"input":"secret"}','{"text":"'+ 'é'.repeat(129)+'"}','{"op":"eval","args":[]}'])check(()=>{
  const before=source.value;get('text-expression').value=invalid;click('text-save');assert.equal(source.value,before);
});
check(()=>{
  const tree={op:'upper-ascii',args:[{op:'concat',args:[{input:'source'},{text:'!'}]}]};
  get('text-expression').value=JSON.stringify(tree);click('text-save');
  assert.equal(JSON.stringify(selected().steps[0].assign.text_expression),JSON.stringify(tree));assert(get('text-basic-status').textContent.includes('nested'));
  const before=source.value;source.readOnly=true;source.dispatchEvent(new Event('input'));
  for(const id of ['text-save','text-expression','text-operation','text-basic-save'])assert(get(id).disabled);
  get('text-basic-save').dispatchEvent(new Event('click'));get('text-save').dispatchEvent(new Event('click'));assert.equal(source.value,before);
  source.readOnly=false;source.dispatchEvent(new Event('input'));assert.equal(JSON.stringify(JSON.parse(get('text-expression').value)),JSON.stringify(tree));
});
check(()=>{
  const doc=parsed(),w=doc.operational.workflows[0];w.inputs=[];w.variables=[{id:'outcome',name:'Outcome',type:'text'}];
  w.steps=[{id:'dispatch',name:'Dispatch',kind:'run-command',action:'layout.dual'},{id:'capture',name:'Record status',kind:'checkpoint'}];
  w.outputs=[{id:'result',name:'Status',from:{variable:'outcome'}}];w.repeats=[];
  if(!doc.operational.capabilities.includes('workspace-layout'))doc.operational.capabilities.push('workspace-layout');
  source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input'));change('condition-step','capture');change('assignment-target','outcome');
  assert(get('assignment-source').options.some(item=>item.value==='action-status:dispatch'));
  change('assignment-source','action-status:dispatch');click('assignment-save');
  assert.equal(selected().steps[1].assign.from.action_status,'dispatch');
});
check(()=>{
  const before=source.value;click('simulate');
  get('simulation-steps').children[0].find(node=>node.tagName==='button').click();
  get('simulation-steps').children[1].find(node=>node.tagName==='button').click();
  assert(get('simulation-outputs').textContent.includes('dispatched'));assert.equal(source.value,before);
});
check(()=>{
  const before=source.value;get('workflow-steps').children[0].find(node=>node.tagName==='button' && node.textContent==='Remove').click();
  assert.equal(source.value,before);assert(get('status').textContent.includes('rebind'));
});
check(()=>{
  change('condition-step','dispatch');assert(!get('assignment-source').options.some(item=>item.value==='action-status:dispatch'));
  change('condition-step','capture');assert.equal(get('assignment-source').value,'action-status:dispatch');
});
console.log(`${checks} actual Studio event-listener checks passed in a DOM test double; no browser, desktop, native messages or clipboard used.`);
