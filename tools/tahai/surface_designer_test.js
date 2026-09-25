// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Exercises the actual Studio geometry/validation code without a browser UI.
'use strict';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const header = fs.readFileSync(path.join(root,
    'chrome/browser/ui/webui/tahai/tahai_surface_designer.h'), 'utf8');
const blocks = [...header.matchAll(/R"TAHAI\(([\s\S]*?)\)TAHAI"/g)];
assert.equal(blocks.length, 1, 'Must exercise the real designer resource');
const context = {window: {}, document: {querySelector: () => null}};
vm.runInNewContext(blocks[0][1], context, {timeout: 1000});
const {validate, geometry} = context.window.tahaiSurfaceDesign;
const design = () => ({version: 1, rail_dock: 'trailing', gap: 12,
  narrow_width: 640, short_height: 360, keyboard_order: [1, 2, 0], nodes: [
    {kind: 'columns', first: 1, second: 2, percent: 30},
    {kind: 'pane', pane: 0, role: 'reference'},
    {kind: 'rows', first: 3, second: 4, percent: 65},
    {kind: 'pane', pane: 1, role: 'working'},
    {kind: 'pane', pane: 2, role: 'tasks'}]});
let checks = 0;
const check = fn => { fn(); ++checks; };
check(() => assert.equal(validate(design()), true));
for (const mutate of [
  d => { d.version = true; }, d => { d.nodes[0].first = 0; },
  d => { d.nodes[0].second = 1; }, d => { d.nodes[0].percent = 0.5; },
  d => { d.nodes[0].first = 99; }, d => { d.nodes[4].pane = 1; },
  d => { d.nodes.push({kind: 'pane', pane: 3, role: 'notes'}); },
  d => { d.keyboard_order = [0, 0, 1]; }, d => { d.keyboard_order = [true, 2, 0]; },
  d => { d.nodes[0].script = 'invalid'; }, d => { d.gap = Infinity; },
  d => { d.rail_dock = 'outside'; }, d => { d.short_height = 1000; },
  d => { d.nodes[1].role = 'javascript:alert(1)'; }
]) check(() => { const d = design(); mutate(d); assert.equal(validate(d), false); });
for (const percent of [10, 30, 50, 90]) {
  for (const [width, height] of [[640, 360], [900, 700], [3840, 2160]]) check(() => {
    const d = design(); d.nodes[0].percent = percent;
    const result = geometry(d, width, height, 1);
    assert.equal(result.compact, false);
    assert.equal(result.panes.length, 3); assert.equal(result.dividers.length, 2);
    const rectangles = [...result.panes, ...result.dividers];
    assert.equal(rectangles.reduce((sum, b) => sum + b.width * b.height, 0), width * height);
    for (const pane of result.panes) { assert(pane.width >= 96); assert(pane.height >= 64); }
    for (const [i, a] of rectangles.entries()) {
      assert(a.x >= 0 && a.y >= 0 && a.x + a.width <= width && a.y + a.height <= height);
      for (const b of rectangles.slice(i + 1)) {
        assert(!(a.x < b.x + b.width && b.x < a.x + a.width &&
                 a.y < b.y + b.height && b.y < a.y + a.height));
      }
    }
  });
}
for (const active of [0, 1, 2]) check(() => {
  const result = geometry(design(), 300, 900, active);
  assert.equal(result.compact, true); assert.equal(result.panes.length, 1);
  assert.equal(result.panes[0].pane, active); assert.equal(result.dividers.length, 0);
});
check(() => assert.equal(geometry(design(), 0, 0, 1).panes.length, 0));
check(() => assert.equal(geometry(design(), -1, 800, 1), null));
check(() => assert.equal(geometry(design(), 100001, 800, 1), null));
check(() => assert.equal(geometry(design(), 800, 800, 3), null));

// Deterministic generated trees exercise asymmetric topology, nested minimum
// sizes, every pane count, and compact recovery. These are the real Studio
// functions, not a second implementation of the compositor.
let seed = 1520033;
const random = limit => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return Math.floor(seed / 4294967296 * limit);
};
const counts = new Set(); let compactCases = 0;
for (let iteration = 0; iteration < 10000; ++iteration) check(() => {
  const count = 1 + random(4), nodes = [];
  counts.add(count);
  let pane = 0;
  const tree = leaves => {
    const index = nodes.length; nodes.push(null);
    if (leaves === 1) {
      nodes[index] = {kind: 'pane', pane: pane++, role: 'working'};
    } else {
      const firstLeaves = 1 + random(leaves - 1);
      const kind = random(2) ? 'rows' : 'columns', percent = 10 + random(81);
      nodes[index] = {kind, first: tree(firstLeaves), second: tree(leaves - firstLeaves), percent};
    }
    return index;
  };
  tree(count);
  const order = Array.from({length: count}, (_, i) => i);
  for (let i = count - 1; i > 0; --i) {
    const j = random(i + 1); [order[i], order[j]] = [order[j], order[i]];
  }
  const d = {version: 1, nodes, rail_dock: random(2) ? 'leading' : 'trailing',
    gap: 4 + random(21), narrow_width: 320 + random(1281),
    short_height: 200 + random(701), keyboard_order: order};
  assert.equal(validate(d), true, `Generated valid tree ${iteration}`);
  const width = random(iteration % 4 ? 3200 : 100001);
  const height = random(iteration % 4 ? 2048 : 100001), active = random(count);
  const result = geometry(d, width, height, active);
  assert(result);
  if (result.compact) {
    ++compactCases;
    assert.equal(result.dividers.length, 0);
    assert.equal(result.panes.length, width && height ? 1 : 0);
    if (result.panes.length) {
      assert.equal(result.panes[0].pane, active);
      assert.equal(result.panes[0].width, width);
      assert.equal(result.panes[0].height, height);
    }
  } else {
    assert.equal(result.panes.length, count);
    assert.equal(result.dividers.length, count - 1);
    for (const p of result.panes) { assert(p.width >= 96); assert(p.height >= 64); }
  }
  const rectangles = [...result.panes, ...result.dividers];
  assert.equal(rectangles.reduce((area, r) => area + r.width * r.height, 0), width * height);
  for (const [i, a] of rectangles.entries()) {
    for (const value of [a.x, a.y, a.width, a.height]) assert(Number.isInteger(value));
    assert(a.x >= 0 && a.y >= 0 && a.width >= 0 && a.height >= 0);
    assert(a.x + a.width <= width && a.y + a.height <= height);
    for (const b of rectangles.slice(i + 1)) {
      assert(!(a.x < b.x + b.width && b.x < a.x + a.width &&
               a.y < b.y + b.height && b.y < a.y + a.height));
    }
  }
});
assert.deepEqual([...counts].sort(), [1, 2, 3, 4]);
assert(compactCases > 100 && compactCases < 9900);
console.log(`${checks} Studio geometry/validation checks passed. No browser or desktop was used.`);
