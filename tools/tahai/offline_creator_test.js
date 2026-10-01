// Copyright 2026 TAHAI Web Services. SPDX-License-Identifier: Apache-2.0
// Executes the shipped offline creator with DOM/hash timing doubles, not TAHAI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto, createHash} from 'node:crypto';

const root = new URL('../../docs/tahai-skins/', import.meta.url);
const script = fs.readFileSync(new URL('studio.js', root), 'utf8');
const manifest = JSON.parse(fs.readFileSync(new URL('starter-skin/manifest.json', root), 'utf8'));
const png = fs.readFileSync(new URL('starter-skin/assets/preview.png', root));
class Element {
  constructor() {
    this.listeners = new Map(); this.children = []; this.value = ''; this.disabled = false;
    this.style = {setProperty() {}};
  }
  addEventListener(event, callback) { this.listeners.set(event, callback); }
  fire(type) { return this.listeners.get(type)?.({preventDefault() {}}); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  remove() { this.removed = true; }
  reportValidity() { return this.valid !== false; }
}
function setup() {
  const ids = ['palette', 'preview', 'contrast', 'download', 'tokens', 'studio',
    'identity-value', 'name', 'creator', 'license', 'density', 'motion', 'status'];
  const nodes = Object.fromEntries(ids.map(id => [id, new Element()]));
  for (const [id, value] of Object.entries({palette: 'light_tokens',
    'identity-value': 'first-skin', name: 'First skin', creator: 'Test creator',
    license: 'Apache-2.0', density: 'comfortable'})) nodes[id].value = value;
  nodes.motion.checked = true;
  const hashes = [], blobs = [], links = [], revoked = [], timers = [];
  const faults = {};
  const document = {getElementById: id => nodes[id], body: new Element(),
    createElement(tag) {
      const element = new Element();
      if (tag === 'a') {
        if (faults.createLink) throw Error('Download link unavailable');
        links.push(element);
        element.click = () => { if (faults.click) throw Error('Download unavailable'); element.clicked = true; };
      }
      return element;
    }};
  const crypto = {subtle: {digest(algorithm, bytes) {
    let resolve, reject;
    const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
    hashes.push({reject, async finish() {resolve(await webcrypto.subtle.digest(algorithm, bytes));}});
    return promise;
  }}};
  vm.runInNewContext(script, {document, crypto, structuredClone, TextEncoder, Blob,
    window: {tahaiStarter: {manifest, png: png.toString('base64')}},
    atob: text => Buffer.from(text, 'base64').toString('binary'),
    URL: {createObjectURL(blob) {blobs.push(blob); return `blob:fixture-${blobs.length}`;},
      revokeObjectURL(url) {revoked.push(url);}},
    setTimeout(callback) {timers.push(callback);}}, {timeout: 1000});
  return {nodes, hashes, blobs, links, revoked, timers, faults,
    submit: () => nodes.studio.fire('submit'),
    color(token, value) {
      const index = Object.keys(manifest.appearance[nodes.palette.value]).indexOf(token);
      assert.ok(index >= 0);
      const input = nodes.tokens.children[index].children[1];
      input.value = value; input.fire('input');
    }};
}
async function unpack(blob) {
  const bytes = Buffer.from(await blob.arrayBuffer()), entries = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 8), 0); // Stored entries only.
    const size = bytes.readUInt32LE(offset + 18), nameSize = bytes.readUInt16LE(offset + 26);
    assert.equal(bytes.readUInt16LE(offset + 28), 0);
    const name = bytes.toString('utf8', offset + 30, offset + 30 + nameSize);
    const start = offset + 30 + nameSize;
    assert.ok(!entries.has(name)); entries.set(name, bytes.subarray(start, start + size));
    offset = start + size;
  }
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50);
  assert.deepEqual([...entries.keys()], ['manifest.json', 'assets/preview.png']);
  const result = JSON.parse(entries.get('manifest.json').toString('utf8'));
  assert.deepEqual(entries.get('assets/preview.png'), png);
  assert.equal(result.assets[0].sha256, createHash('sha256').update(png).digest('hex'));
  return result;
}
let checks = 0;
async function check(test) {await test(); ++checks;}
await check(async () => {
  const h = setup(), initial = structuredClone(manifest.appearance), first = h.submit();
  assert.equal(h.hashes.length, 1); assert.ok(h.nodes.download.disabled);
  h.nodes.name.value = 'Later skin'; h.nodes['identity-value'].value = 'later-skin';
  h.color('accent', '#123456');
  assert.ok(h.nodes.download.disabled);
  await h.submit(); assert.equal(h.hashes.length, 1);
  await h.hashes[0].finish(); await first;
  const exported = await unpack(h.blobs[0]);
  assert.equal(exported.id, 'first-skin'); assert.equal(exported.name, 'First skin');
  assert.equal(exported.appearance.light_tokens.accent, initial.light_tokens.accent);
  assert.equal(h.links[0].download, 'first-skin.tahaiskin'); assert.ok(h.links[0].removed);
  assert.equal(h.revoked.length, 0); h.timers[0](); assert.equal(h.revoked.length, 1);
  const second = h.submit(); await h.hashes[1].finish(); await second;
  const next = await unpack(h.blobs[1]);
  assert.equal(next.id, 'later-skin'); assert.equal(next.appearance.light_tokens.accent, '#123456');
});
await check(async () => {
  const h = setup(), pending = h.submit();
  h.color('toolbar_foreground', manifest.appearance.light_tokens.toolbar_background);
  assert.ok(h.nodes.download.disabled);
  await h.hashes[0].finish(); await pending;
  const result = await unpack(h.blobs[0]);
  assert.equal(result.appearance.light_tokens.toolbar_foreground, manifest.appearance.light_tokens.toolbar_foreground);
  assert.ok(h.nodes.download.disabled); await h.submit(); assert.equal(h.hashes.length, 1);
});
await check(async () => {
  const h = setup(), pending = h.submit(); h.hashes[0].reject(Error('Hash unavailable')); await pending;
  assert.equal(h.blobs.length, 0); assert.equal(h.nodes.download.disabled, false);
  assert.match(h.nodes.status.textContent, /Hash unavailable/);
  const next = h.submit(); await h.hashes[1].finish(); await next; assert.equal(h.blobs.length, 1);
});
await check(async () => {
  const h = setup(); h.faults.click = true; const pending = h.submit();
  await h.hashes[0].finish(); await pending;
  assert.ok(h.links[0].removed); assert.equal(h.revoked.length, 1); assert.equal(h.timers.length, 0);
  assert.equal(h.nodes.download.disabled, false);
});
await check(async () => {
  const h = setup(); h.nodes.studio.valid = false; await h.submit(); assert.equal(h.hashes.length, 0);
});
await check(async () => {
  const h = setup(); h.faults.createLink = true; const pending = h.submit();
  await h.hashes[0].finish(); await pending;
  assert.equal(h.links.length, 0); assert.equal(h.revoked.length, 1);
  assert.equal(h.nodes.download.disabled, false);
});
for (const id of ['stock', 'ab', '-skin', 'skin-', 'Skin', 'x'.repeat(65), 'skin/path']) await check(async () => {
  const h = setup(); h.nodes['identity-value'].value = id; await h.submit();
  assert.equal(h.hashes.length, 0); assert.equal(h.blobs.length, 0);
  assert.match(h.nodes.status.textContent, /unique/); assert.equal(h.nodes.download.disabled, false);
});
await check(async () => {
  const h = setup(); h.nodes.density.value = 'malformed'; await h.submit();
  assert.equal(h.hashes.length, 0); assert.match(h.nodes.status.textContent, /density/);
});
for (const name of ['', '<script>', 'x'.repeat(129)]) await check(async () => {
  const h = setup(); h.nodes.name.value = name; await h.submit(); assert.equal(h.hashes.length, 0);
});
assert.equal(checks, 17);
console.log(`PASS ${checks} offline creator export checks (no native runtime claim)`);
