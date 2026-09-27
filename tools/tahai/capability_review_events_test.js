// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Real resource listeners in a DOM double, not browser runtime acceptance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.listeners = {}; }
  get isConnected() { return this.root || Boolean(this.parent?.isConnected); }
  append(...items) { for (const item of items) { item.parent = this; this.children.push(item); } }
  replaceChildren() { for (const item of this.children) item.parent = null; this.children = []; }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  querySelectorAll(tag) { return this.children.flatMap(child => [
      ...(child.tag === tag ? [child] : []), ...child.querySelectorAll(tag)]); }
  click() { if (!this.disabled) this.listeners.click(); }
}
const list = new Element('ul'), status = new Element('p'), refresh = new Element('button');
list.root = status.root = refresh.root = true;
const nodes = {'#capability-grants': list, '#capability-status': status, '#capability-refresh': refresh};
const sent = [], context = {window: {}, document: {
  querySelector: selector => nodes[selector], createElement: tag => new Element(tag)},
  chrome: {send: (name, args) => sent.push({name, args})}};
vm.createContext(context);
const resource = fs.readFileSync(new URL('../../chrome/browser/ui/webui/tahai/tahai_capability_review_ui.h', import.meta.url), 'utf8');
vm.runInContext(resource.match(/R"TAHAI\(([\s\S]*?)\)TAHAI"/)[1], context, {timeout: 1000});
let checks = 0;
const check = fn => { fn(); ++checks; };
const grant = {provider: 'example-provider', revision: 'a'.repeat(64),
  origin: 'https://example.test/', operation: 'Read explicitly selected content'};
check(() => assert.equal(sent[0].name, 'getTahaiCapabilityGrants'));
context.window.tahaiCapabilityGrants(true, 'review-one', [grant, {...grant, revision: 'b'.repeat(64)}]);
check(() => assert.equal(list.children.length, 2));
check(() => {
  const text = list.children[0].children[0].textContent;
  for (const field of Object.values(grant)) assert(text.includes(field));
});
const [first, second] = list.querySelectorAll('button');
first.click();
check(() => {
  assert.equal(sent.at(-1).name, 'revokeTahaiCapabilityGrant');
  assert.equal(JSON.stringify(sent.at(-1).args), '["review-one",0]');
  assert(first.disabled && second.disabled);
});
check(() => {
  const count = sent.length;
  second.listeners.click(); first.listeners.click();
  assert.equal(sent.length, count, 'One review may send only one revocation');
});
context.window.tahaiCapabilityRevoked(true);
check(() => { assert.equal(list.children.length, 0); assert(status.textContent.includes('does not undo')); });
refresh.click();
check(() => assert.equal(sent.at(-1).name, 'getTahaiCapabilityGrants'));
context.window.tahaiCapabilityGrants(true, 'review-two', [grant]);
const stale = list.querySelectorAll('button')[0];
refresh.click();
check(() => {
  const count = sent.length; stale.listeners.click();
  assert.equal(sent.length, count, 'Detached review cannot revoke a current grant');
});
context.window.tahaiCapabilityGrants(false, '', [grant]);
check(() => { assert.equal(list.children.length, 0); assert(status.textContent.includes('unavailable')); });
context.window.tahaiCapabilityGrants(true, 'empty-review', []);
check(() => assert.equal(status.textContent, 'No stored capability grants.'));
context.window.tahaiCapabilityRevoked(false);
check(() => assert(status.textContent.startsWith('Nothing was revoked.')));
check(() => assert(sent.every(call => ['getTahaiCapabilityGrants', 'revokeTahaiCapabilityGrant'].includes(call.name))));
console.log(`${checks} capability-review DOM-double checks passed; no Chromium runtime tests executed.`);
