// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Actual shipped search/detail scripts with deterministic DOM/message doubles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL(
  '../../chrome/browser/ui/webui/tahai/tahai_ui.cc', import.meta.url), 'utf8');
const scripts = ['kLocalOiJs', 'kLocalOiGraphExplorerJs'].map(name => {
  const body = source.match(new RegExp(`constexpr char ${name}\\[\\] = R"TAHAI\\(([\\s\\S]*?)\\)TAHAI";`))?.[1];
  assert(body, `Select actual shipped ${name}.`); return body;
});
function fixture() {
  const sent = [], timers = new Map(); let timerId = 0;
  let document;
  class Node {
    constructor(tag = 'div') {
      Object.assign(this, {tag, value: '', dataset: {}, attributes: {}, handlers: {},
        children: [], disabled: false, isConnected: true, className: '', text: ''});
    }
    addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
    fire(type, fields = {}) {
      const event = {type, target: this, defaultPrevented: false,
        preventDefault() { this.defaultPrevented = true; }, ...fields};
      for (const fn of this.handlers[type] || []) fn(event);
      return event;
    }
    setAttribute(name, value) { this.attributes[name] = value; }
    getAttribute(name) { return this.attributes[name] ?? null; }
    append(...nodes) { for (const node of nodes) { node.isConnected = true; this.children.push(node); } }
    replaceChildren(...nodes) {
      const disconnect = node => { node.isConnected = false; for (const child of node.children) disconnect(child); };
      for (const node of this.children) disconnect(node);
      this.children = []; this.text = ''; this.append(...nodes);
    }
    set textContent(value) { this.replaceChildren(); this.text = String(value); }
    get textContent() { return this.text + this.children.map(node => node.textContent).join(''); }
    querySelectorAll(selector) {
      const result = [];
      for (const child of this.children) {
        if (child.className.split(' ').includes(selector.slice(1))) result.push(child);
        result.push(...child.querySelectorAll(selector));
      }
      return result;
    }
    focus() { document.activeElement = this; }
  }
  const ids = Object.fromEntries([
    'local-oi-search-form', 'local-oi-search', 'local-oi-search-kind',
    'local-oi-search-mission', 'local-oi-search-severity', 'local-oi-search-state',
    'local-oi-search-age', 'local-oi-search-status', 'local-oi-search-results',
    'local-oi-graph-form', 'local-oi-graph-entity', 'local-oi-graph-type',
    'local-oi-graph-depth', 'local-oi-graph-status', 'local-oi-graph-results',
    'local-oi-entity-detail',
  ].map(id => [id, new Node()]));
  document = new Node(); document.activeElement = null;
  document.querySelector = selector => ids[selector.slice(1)] || null;
  document.querySelectorAll = () => [];
  document.createElement = tag => new Node(tag);
  document.dispatchEvent = event => document.fire(event.type, event);
  const window = {};
  const context = {window, document,
    setTimeout: fn => { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    chrome: {send: (name, args) => sent.push({name, args})}};
  for (const script of scripts) vm.runInNewContext(script, context, {timeout: 1000});
  const get = id => ids[`local-oi-${id}`];
  const submit = (query = 'release') => { get('search').value = query; get('search-form').fire('submit'); return sent.at(-1); };
  const results = (request, items) => window.tahaiLocalOiSearchResults(request.args[0], request.args[2], items);
  const explore = (id = 'entity-1') => { get('graph-entity').value = id; get('graph-form').fire('submit'); return sent.at(-1); };
  const flush = () => { const callbacks = [...timers.values()]; timers.clear(); for (const fn of callbacks) fn(); };
  return {get, sent, window, document, timers, submit, results, explore, flush};
}
const entity = (id = 'entity-1') => ({entity_id: id, kind: 'mission', title: 'Release', detail: 'Saved metadata'});
const edge = {source_id: 'entity-1', target_id: 'entity-2', source_label: 'Source', target_label: 'Target', relationship: 'mission_uses', depth: 1, basis: 'Saved relationship'};
let checks = 0;
const check = fn => { fn(); ++checks; };
check(() => {
  const f = fixture(), request = f.submit(); f.results(request, [entity()]);
  const button = f.get('search-results').children[0]; assert.equal(button.tag, 'button');
  button.fire('click'); assert.equal(f.sent.at(-1).name, 'getTahaiLocalOiEntityDetail');
  assert.equal(f.sent.at(-1).args[0], 'entity-1');
  assert.equal(f.document.activeElement, f.get('entity-detail'));
  f.window.tahaiLocalOiEntityDetail(f.sent.at(-1).args[1], {id: 'entity-1', kind: 'mission', label: 'Release', direct_relationship_count: 2});
  assert.match(f.get('entity-detail').textContent, /2 direct persisted/);
});
check(() => {
  const f = fixture(); f.results(f.submit(), [{kind: 'finding', title: 'Review'}, {kind: 'memory', title: 'Recorded'}]);
  assert(f.get('search-results').children.every(node => node.tag === 'div'));
});
check(() => {
  const f = fixture(); f.results(f.submit(), [null, false, entity()]);
  assert.equal(f.get('search-results').children.length, 1);
  assert.match(f.get('search-status').textContent, /1 local record match/);
});
check(() => {
  const f = fixture(); f.results(f.submit(), [{...entity(), title: '<img src=x onerror=evil()>'}]);
  const title = f.get('search-results').children[0].children[0];
  assert.equal(title.children.length, 0); assert.match(title.textContent, /<img/);
});
check(() => {
  const f = fixture(), request = f.submit(); f.results(request, [entity()]); f.results(request, []);
  assert.equal(f.get('search-results').children[0].tag, 'button');
});
check(() => {
  const f = fixture(), request = f.submit();
  f.window.tahaiLocalOiSearchResults('different', request.args[2], [entity()]);
  assert.equal(f.get('search-results').children.length, 0);
  f.results(request, [entity()]); assert.equal(f.get('search-results').children.length, 1);
});
check(() => {
  const f = fixture(), request = f.submit(); f.get('search').value = 'changed'; f.get('search').fire('input');
  f.results(request, [entity()]); assert.equal(f.get('search-results').children.length, 0);
  assert.equal(f.timers.size, 1); f.flush(); assert.equal(f.sent.at(-1).args[0], 'changed');
});
check(() => {
  const f = fixture(), request = f.submit(); f.get('search').value = ''; f.get('search').fire('input');
  f.results(request, [entity()]); assert.equal(f.get('search-results').children.length, 0);
  assert.equal(f.timers.size, 0); assert.equal(f.sent.length, 1);
});
check(() => {
  const f = fixture(); f.get('search').value = 'release'; f.get('search').fire('input');
  f.get('search-kind').value = 'mission'; f.get('search-kind').fire('change'); f.flush();
  assert.equal(f.sent.length, 1); assert.equal(f.sent[0].args[1].kind, 'mission');
});
check(() => {
  const f = fixture(), request = f.submit(); f.document.fire('tahai-local-oi-updated');
  f.results(request, [entity()]); assert.equal(f.get('search-results').children.length, 0);
  assert.match(f.get('search-status').textContent, /policy changed/);
});
check(() => {
  const f = fixture(); f.results(f.submit(), [entity(), entity('entity-2')]);
  const [first, last] = f.get('search-results').children; first.focus();
  assert(f.get('search-results').fire('keydown', {key: 'End'}).defaultPrevented);
  assert.equal(f.document.activeElement, last);
  f.get('search-results').fire('keydown', {key: 'ArrowDown'}); assert.equal(f.document.activeElement, first);
  f.get('search-results').fire('keydown', {key: 'End', ctrlKey: true}); assert.equal(f.document.activeElement, first);
});
check(() => {
  const f = fixture(), request = f.explore(); f.get('graph-entity').fire('change');
  f.window.tahaiLocalOiRelationshipResults(request.args[3], [edge]);
  assert.equal(f.get('graph-results').children.length, 0);
});
check(() => {
  const f = fixture(), request = f.explore(); f.explore('');
  f.window.tahaiLocalOiRelationshipResults(request.args[3], [edge]);
  assert.equal(f.get('graph-results').children.length, 0);
  assert.match(f.get('graph-status').textContent, /Choose a persisted/);
});
check(() => {
  const f = fixture(), old = f.explore(), current = f.explore('entity-2');
  f.window.tahaiLocalOiRelationshipResults(old.args[3], [edge]); assert.equal(f.get('graph-results').children.length, 0);
  f.window.tahaiLocalOiRelationshipResults(current.args[3], [edge]); assert.equal(f.get('graph-results').children.length, 1);
});
check(() => {
  const f = fixture(); f.results(f.submit(), [entity(), entity('entity-2')]);
  const [first, second] = f.get('search-results').children;
  first.fire('click'); const old = f.sent.at(-1); second.fire('click'); const current = f.sent.at(-1);
  f.window.tahaiLocalOiEntityDetail(old.args[1], {id: 'entity-1', label: 'Stale'});
  assert.doesNotMatch(f.get('entity-detail').textContent, /Stale/);
  f.window.tahaiLocalOiEntityDetail(current.args[1], {id: 'entity-2', label: 'Current'});
  assert.match(f.get('entity-detail').textContent, /Current/);
});
check(() => {
  const f = fixture(); f.results(f.submit(), [entity()]); f.get('search-results').children[0].fire('click');
  f.window.tahaiLocalOiEntityDetail(f.sent.at(-1).args[1], {});
  assert.match(f.get('entity-detail').textContent, /no longer available/);
});
check(() => {
  const f = fixture(); f.results(f.submit(), [entity()]); f.get('search-results').children[0].fire('click');
  f.window.tahaiLocalOiEntityDetail(f.sent.at(-1).args[1], {id: 'other', label: 'Wrong'});
  assert.doesNotMatch(f.get('entity-detail').textContent, /Wrong/);
});
check(() => {
  const f = fixture(); f.results(f.submit(), [entity()]); const stale = f.get('search-results').children[0];
  f.submit('other'); const count = f.sent.length; stale.fire('click'); assert.equal(f.sent.length, count);
});
for (const event of ['selection', 'policy']) check(() => {
  const f = fixture(); f.results(f.submit(), [entity()]); f.get('search-results').children[0].fire('click');
  const pending = f.sent.at(-1);
  if (event === 'selection') f.get('graph-depth').fire('change');
  else f.document.fire('tahai-local-oi-updated');
  f.window.tahaiLocalOiEntityDetail(pending.args[1], {id: 'entity-1', label: 'Stale'});
  assert.doesNotMatch(f.get('entity-detail').textContent, /Stale/);
  assert.equal(f.get('entity-detail').getAttribute('aria-busy'), 'false');
});
check(() => {
  const f = fixture(), request = f.explore(); f.window.tahaiLocalOiRelationshipResults(request.args[3], [edge]);
  f.window.tahaiLocalOiRelationshipResults(request.args[3], []);
  assert.equal(f.get('graph-results').children[0].className, 'oi-edge');
});
check(() => {
  const f = fixture(), request = f.explore(); f.window.tahaiLocalOiRelationshipResults(request.args[3], [edge]);
  const old = f.get('graph-results').children[0].children[0]; f.explore('entity-2');
  const count = f.sent.length; old.fire('click'); assert.equal(f.sent.length, count);
});
check(() => {
  const f = fixture(), request = f.submit(); assert.equal(f.get('search-results').getAttribute('aria-busy'), 'true');
  f.results(request, []); assert.equal(f.get('search-results').getAttribute('aria-busy'), 'false');
  const graph = f.explore(); assert.equal(f.get('graph-results').getAttribute('aria-busy'), 'true');
  f.window.tahaiLocalOiRelationshipResults(graph.args[3], []);
  assert.equal(f.get('graph-results').getAttribute('aria-busy'), 'false');
});
assert.equal(checks, 23);
console.log(`${checks} shipped Local OI navigation/debounce/invalidation/detail checks passed; DOM doubles only.`);
