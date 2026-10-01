// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Runs the shipped transfer resource with DOM/File doubles; not native WebUI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sourceCode = fs.readFileSync(new URL('../../chrome/browser/ui/webui/tahai/tahai_ui.cc', import.meta.url), 'utf8');
const script = sourceCode.match(/kSkinStudioImportExportJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI"/)[1];
class Element {
  constructor() { this.listeners = new Map(); this.value = ''; this.textContent = ''; }
  addEventListener(name, callback) { this.listeners.set(name, callback); }
  dispatchEvent(event) { return this.listeners.get(event.type)?.(event); }
}
function deferredFile(size = 1) {
  let resolve, reject, reads = 0;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return {size, text() { ++reads; return promise; }, resolve, reject, reads: () => reads};
}
function setup() {
  const source = new Element(), status = new Element(), download = new Element(), imported = new Element();
  source.value = 'retained';
  const nodes = {source, status, download, import: imported}, links = [], blobs = [], revoked = [], timers = [];
  const faults = {};
  const document = {
    querySelector(selector) { return nodes[selector.replace('#skin-studio-', '')]; },
    createElement() {
      const link = {click() { if (faults.click) throw Error('private-failure'); this.clicked = true; },
        remove() { this.removed = true; }};
      links.push(link); return link;
    },
    body: {append(link) { link.appended = true; }},
  };
  const URL = {createObjectURL(blob) { blobs.push(blob); return `blob:test-${blobs.length}`; },
    revokeObjectURL(url) { revoked.push(url); }};
  vm.runInNewContext(script, {document, URL, Blob, TextEncoder, Event,
    window: {setTimeout(callback) { timers.push(callback); }}}, {timeout: 1000});
  let edits = 0;
  const edit = value => { source.value = value; source.dispatchEvent(new Event('input')); };
  // Preserve the resource's revision listener while counting imported edits.
  const original = source.listeners.get('input');
  source.listeners.set('input', () => { original(); ++edits; });
  return {source, status, download, imported, links, blobs, revoked, faults,
    edit, edits: () => edits, export: () => download.dispatchEvent(new Event('click')),
    import(file) { imported.files = file ? [file] : []; return imported.dispatchEvent(new Event('change')); },
    flush() { for (const callback of timers.splice(0)) callback(); }};
}
let checks = 0;
async function check(callback) { await callback(); ++checks; }

await check(async () => {
  const h = setup(), file = deferredFile(2), read = h.import(file);
  file.resolve('{}'); await read;
  assert.equal(h.source.value, '{}'); assert.equal(h.edits(), 1);
  assert.match(h.status.textContent, /being validated/);
});
for (const field of ['readOnly', 'disabled']) await check(async () => {
  const h = setup(), file = deferredFile(); h.source[field] = true;
  await h.import(file); assert.equal(file.reads(), 0); assert.equal(h.source.value, 'retained');
});
await check(async () => {
  const h = setup(), file = deferredFile(65537); await h.import(file);
  assert.equal(file.reads(), 0); assert.equal(h.source.value, 'retained');
});
for (const value of ['x'.repeat(65537), '\ufffd'.repeat(21846), '😀'.repeat(16385)]) await check(async () => {
  const h = setup(), file = deferredFile(65536), read = h.import(file);
  file.resolve(value); await read;
  assert.equal(h.source.value, 'retained'); assert.equal(h.edits(), 0);
  assert.match(h.status.textContent, /decoded source exceeds/);
});
await check(async () => {
  const h = setup(), file = deferredFile(65536), read = h.import(file), value = '😀'.repeat(16384);
  file.resolve(value); await read; assert.equal(h.source.value, value); assert.equal(h.edits(), 1);
});
for (const outcome of ['resolve', 'reject']) await check(async () => {
  const h = setup(), old = deferredFile(), recent = deferredFile();
  const oldRead = h.import(old), recentRead = h.import(recent);
  recent.resolve('recent'); await recentRead;
  const message = h.status.textContent;
  old[outcome]('stale'); await oldRead;
  assert.equal(h.source.value, 'recent'); assert.equal(h.status.textContent, message);
});
for (const outcome of ['resolve', 'reject']) await check(async () => {
  const h = setup(), file = deferredFile(), read = h.import(file);
  h.edit('new'); h.edit('retained'); h.status.textContent = 'newer edit status';
  file[outcome]('stale'); await read;
  assert.equal(h.source.value, 'retained'); assert.equal(h.edits(), 2);
  if (outcome === 'reject') assert.equal(h.status.textContent, 'newer edit status');
});
await check(async () => {
  const h = setup(), file = deferredFile(), read = h.import(file);
  await h.import(null); file.resolve('stale'); await read;
  assert.equal(h.source.value, 'retained'); assert.equal(h.edits(), 0);
});
await check(async () => {
  const h = setup(), file = deferredFile(), read = h.import(file);
  file.reject(Error('private file path')); await read;
  assert.equal(h.source.value, 'retained'); assert.match(h.status.textContent, /could not be read/);
  assert(!h.status.textContent.includes('private'));
});
for (const value of ['x'.repeat(65537), '😀'.repeat(16385)]) await check(() => {
  const h = setup(); h.source.value = value; h.export();
  assert.equal(h.blobs.length, 0); assert.equal(h.source.value, value);
  assert.match(h.status.textContent, /download size limit/);
});
await check(async () => {
  const h = setup(); h.source.value = '😀'.repeat(16384); h.export();
  assert.equal(h.blobs.length, 1); assert.equal(h.blobs[0].size, 65536);
  assert.equal(await h.blobs[0].text(), h.source.value);
  assert(h.links[0].clicked && h.links[0].removed); assert.equal(h.revoked.length, 0);
  h.flush(); assert.deepEqual(h.revoked, ['blob:test-1']);
});
await check(() => {
  const h = setup(); h.faults.click = true; h.export();
  assert.equal(h.source.value, 'retained'); assert(h.links[0].removed);
  assert.deepEqual(h.revoked, ['blob:test-1']); assert.match(h.status.textContent, /could not be started/);
  assert(!h.status.textContent.includes('private'));
});
await check(() => {
  const h = setup(); h.download.disabled = true; h.export(); assert.equal(h.blobs.length, 0);
});
assert.equal(checks, 19);
console.log(`${checks} shipped Studio import/export checks passed in DOM/File doubles; no native browser executed.`);
