// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Execute the shipped control script; DOM doubles are not native gate evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL(
  '../../chrome/browser/ui/webui/tahai/tahai_ui.cc', import.meta.url), 'utf8');
const script = source.match(
  /constexpr char kLocalOiControlsJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
assert(script, 'The production Local OI control script must be selected.');
function fixture() {
  const sent = [], events = [], state = {textContent:'Enabled'};
  const control = {
    dataset:{tahaiOiSetting:'reports', tahaiOiEnabled:'false'},
    disabled:false, isConnected:true,
    parentElement:{querySelector:() => state},
    addEventListener(type, fn) { this[type] = fn; },
  };
  const rebuild = {disabled:false, isConnected:true,
    addEventListener(type, fn) { this[type] = fn; }};
  const status = {textContent:''}, window = {};
  const document = {
    querySelector:selector => selector === '#local-oi-control-status' ? status : rebuild,
    querySelectorAll:() => [control],
    dispatchEvent:event => events.push(event),
  };
  vm.runInNewContext(script, {window, document,
    CustomEvent:class {constructor(type, data) {this.type=type; this.detail=data.detail;}},
    chrome:{send:(name, args) => sent.push({name, args})}}, {timeout:1000});
  return {sent, events, state, control, rebuild, status, window};
}
let checks = 0;
function check(fn) { fn(); ++checks; }
check(() => {
  const f=fixture(); f.rebuild.click();
  assert.equal(f.rebuild.disabled, true);
  assert.equal(f.sent[0].name, 'rebuildTahaiLocalOiIndex');
  f.rebuild.click(); assert.equal(f.sent.length, 1);
  f.window.tahaiLocalOiProjectionRefreshed(false);
  assert.equal(f.rebuild.disabled, false);
  assert.match(f.status.textContent, /could not refresh/);
  assert.equal(f.events.length, 0);
  f.rebuild.click(); assert.equal(f.sent.length, 2);
});
check(() => {
  const f=fixture(); f.rebuild.click();
  f.window.tahaiLocalOiProjectionRefreshed(true);
  assert.equal(f.rebuild.disabled, false);
  assert.equal(f.events[0].detail.setting, 'mission-projection');
  assert.match(f.status.textContent, /was refreshed locally/);
});
check(() => {
  const f=fixture(); f.control.click();
  assert.equal(f.control.disabled, true);
  assert.equal(f.sent[0].name, 'setTahaiLocalOiControl');
  assert.equal(f.sent[0].args[0], 'reports');
  assert.equal(f.sent[0].args[1], false);
  f.control.click(); assert.equal(f.sent.length, 1);
  f.window.tahaiLocalOiControlUpdated('reports', false);
  assert.equal(f.control.disabled, false);
  assert.equal(f.control.dataset.tahaiOiEnabled, 'false');
  assert.equal(f.state.textContent, 'Enabled');
  assert.equal(f.events.length, 0);
  assert.match(f.status.textContent, /managed or unavailable/);
});
check(() => {
  const f=fixture(); f.control.click();
  f.window.tahaiLocalOiControlUpdated('reports', true);
  assert.equal(f.control.disabled, false);
  assert.equal(f.state.textContent, 'Disabled');
  assert.equal(f.control.dataset.tahaiOiEnabled, 'true');
  assert.equal(f.control.textContent, 'Enable');
  assert.equal(f.events[0].detail.setting, 'reports');
  f.control.click(); assert.equal(f.sent[1].args[1], true);
});
for (const name of ['control', 'rebuild']) {
  for (const property of ['disabled', 'isConnected']) check(() => {
    const f=fixture(); f[name][property] = property === 'disabled';
    f[name].click(); assert.equal(f.sent.length, 0);
  });
}
console.log(`${checks} Local OI retry/busy/disabled/stale-control checks passed; DOM doubles only.`);
