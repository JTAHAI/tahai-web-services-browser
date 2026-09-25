// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Pure placement-model checks; not browser rendering or release acceptance.
'use strict';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const source = fs.readFileSync(path.join(import.meta.dirname,
    '../../chrome/browser/ui/webui/tahai/tahai_native_mode_editor.h'), 'utf8');
const match = source.match(/kNativeModePlacementModelJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/);
assert.ok(match, 'shipping placement model must be present');
const context = vm.createContext({window: {}});
vm.runInContext(match[1], context);
const read = (entries, actions = ['mission.open', 'layout.dual']) =>
  JSON.parse(JSON.stringify(context.window.tahaiNativeModePlacement.read(
    {entries: () => entries[Symbol.iterator]()}, actions)));
let checks = 0;
function check(name, fn) {
  fn(); checks++; process.stdout.write(`PASS ${name}\n`);
}
check('explicitly empty groups stay empty', () => assert.deepEqual(read([]),
  {toolbar_primary: [], toolbar_secondary: [], app_menu: []}));
check('positions order controls instead of catalog order', () => assert.deepEqual(read([
  ['placement.toolbar_primary.mission.open', '9'],
  ['placement.toolbar_primary.layout.dual', '1'],
]), {toolbar_primary: ['layout.dual', 'mission.open'], toolbar_secondary: [], app_menu: []}));
check('groups use independent positions', () => assert.deepEqual(read([
  ['placement.toolbar_primary.mission.open', '1'],
  ['placement.toolbar_secondary.mission.open', '1'],
  ['placement.app_menu.layout.dual', '17'],
]), {toolbar_primary: ['mission.open'], toolbar_secondary: ['mission.open'], app_menu: ['layout.dual']}));
check('zero hides an unchecked control', () => assert.deepEqual(read([
  ['placement.toolbar_primary.support.open', '0'], ['title', 'A local mode'],
]), {toolbar_primary: [], toolbar_secondary: [], app_menu: []}));
for (const value of ['-1', '18', '100', '1.5', 'NaN', '', '01', ' 1', '1 ', '1e1', 'Infinity', 1]) {
  check(`reject noncanonical/out-of-range position ${JSON.stringify(value)}`, () => assert.throws(
    () => read([['placement.toolbar_primary.mission.open', value]])));
}
check('reject duplicate positions atomically', () => assert.throws(() => read([
  ['placement.toolbar_primary.mission.open', '1'],
  ['placement.toolbar_primary.layout.dual', '1'],
])));
check('reject duplicate form fields', () => assert.throws(() => read([
  ['placement.toolbar_primary.mission.open', '1'],
  ['placement.toolbar_primary.mission.open', '2'],
])));
check('reject undeclared controls', () => assert.throws(() => read([
  ['placement.app_menu.support.open', '1'],
])));
for (const key of ['placement.unknown.mission.open', 'placement.app_menu.__proto__',
                    'placement.app_menu.https://example.test', 'placement.app_menu.mission.open.extra']) {
  check(`reject malformed field ${key}`, () => assert.throws(() => read([[key, '1']])));
}
for (const actions of [[], ['mission.open', 'mission.open'], null,
    Array.from({length: 18}, (_, n) => `test${n}.open`)]) {
  check(`reject invalid action selection ${JSON.stringify(actions)}`, () => assert.throws(() => read([], actions)));
}
check('does not mutate form entries or selected actions', () => {
  const entries = Object.freeze([
    Object.freeze(['placement.app_menu.mission.open', '1']),
  ]);
  const actions = Object.freeze(['mission.open']);
  assert.deepEqual(read(entries, actions).app_menu, ['mission.open']);
  assert.deepEqual(actions, ['mission.open']);
});
check('model public API is immutable', () => assert.ok(Object.isFrozen(context.window.tahaiNativeModePlacement)));
// Compile the actual companion event script too, without pretending a DOM is
// available. The WebUI browser regression exercises the copy/edit handlers.
check('shipping event script parses', () => {
  const events = source.match(/kNativeModeEditorJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/);
  assert.ok(events);
  new vm.Script(events[1]);
});
process.stdout.write(`${checks} native-mode placement model checks passed; no browser runtime claimed.\n`);
