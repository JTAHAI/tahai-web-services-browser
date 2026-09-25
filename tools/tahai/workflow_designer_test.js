// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Tests the actual draft transformations and simulator without a browser UI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const header = fs.readFileSync(path.join(root,
    'chrome/browser/ui/webui/tahai/tahai_skin_studio_workflow_model.h'), 'utf8');
const blocks = [...header.matchAll(/R"TAHAI\(([\s\S]*?)\)TAHAI"/g)];
assert.equal(blocks.length, 4, 'The real model and extracted editor resources must be present');
const context = {window: {}, document: {querySelector: () => null}, Map, Set, TextEncoder, URL};
for (const [index, block] of blocks.entries()) vm.runInNewContext(block[1], context,
    {timeout: 1000, filename: `actual-workflow-resource-${index}.js`});
const {validate, parse, encode, mutate, simulate, assign, wait, expireWait, failNative, usesAssignmentSource} = context.window.tahaiWorkflowDesign;
const caps = ['mission-checklist', 'workspace-layout', 'browser-navigation', 'guard-control'];
const clone = value => JSON.parse(JSON.stringify(value));
const workflow = () => ({id: 'research-workflow', name: 'Research workflow', inputs: [
  {id: 'approved', name: 'Approved', type: 'boolean', required: false},
  {id: 'scope', name: 'Scope', type: 'selection', required: true, options: ['Personal', 'Team']},
  {id: 'question', name: 'Question', type: 'text', required: false},
  {id: 'count', name: 'Count', type: 'number', required: false}
], steps: [
  {id: 'review', name: 'Review result', kind: 'checkpoint', when: {input: 'approved', equals: 'true'}},
  {id: 'instruct', name: 'Read the instructions', kind: 'instruction'},
  {id: 'show', name: 'Show Mission', kind: 'run-command', action: 'mission.open'}
]});
const document = () => ({schema_version: 2, sentinel: {preserve: ['other', 'source']}, operational: {
  capabilities: [...caps], surfaces: [{id: 'original-surface', sentinel: 'unchanged'}],
  workflows: [workflow()], modes: [{id: 'research-mode', name: 'Research', workflow: 'research-workflow',
    surface: 'original-surface', actions: ['mission.open']}]
}});
let checks = 0;
const check = fn => { fn(); ++checks; };
check(() => {
  const w = workflow(); w.outputs = [{id: 'result', name: 'Result', from: {input: 'question'}}];
  assert(validate(w, caps));
  const d = document(); d.operational.workflows[0] = w;
  const copy = mutate(JSON.stringify(d), w.id, 'copy', 'Output copy');
  assert.deepEqual(clone(copy.parsed.operational.workflows[1].outputs), w.outputs);
  assert.deepEqual(clone(parse(encode(d)).operational.workflows[0].outputs), w.outputs);
});
for (const outputs of [null, {}, true, [null], [{}],
  [{id: 'result', name: 'Result', from: 'question'}],
  [{id: 'result', name: 'Result', from: {input: 'missing'}}],
  [{id: 'result', name: 'Result', from: {variable: 'question'}}],
  [{id: 'result', name: 'Result', from: {input: 'question', script: 'invalid'}}],
  ...['value', 'protected', 'type', 'destination', 'default'].map(key => [{id: 'result', name: 'Result', from: {input: 'question'}, [key]: 'invalid'}]),
  [{id: 'x', name: 'Result', from: {input: 'question'}}],
  [{id: 'result', name: '<unsafe>', from: {input: 'question'}}],
  Array.from({length: 13}, (_, i) => ({id: 'result-' + i, name: 'Result', from: {input: 'question'}})),
  Array.from({length: 2}, () => ({id: 'result', name: 'Result', from: {input: 'question'}}))
]) check(() => { const w = workflow(); w.outputs = outputs; assert.equal(validate(w, caps), false); });
check(() => {
  const w = workflow(); w.outputs = Array.from({length: 12}, (_, i) => ({id: 'result-' + i, name: 'Result', from: {input: 'question'}}));
  assert(validate(w, caps));
  w.inputs = w.inputs.filter(input => input.id !== 'question'); assert.equal(validate(w, caps), false);
});
for (const [type, value] of [['text', 'Local result'], ['number', '2.5'], ['boolean', 'true'],
  ['selection', 'Choice'], ['date', '2032-02-29'], ['url', 'https://example.test/private-result']]) {
  for (const protectedValue of [false, true]) check(() => {
    const input = {id: 'source-input', name: 'Source', type, required: true, protected: protectedValue};
    if (type === 'selection') input.options = ['Choice'];
    const w = {id: 'output-workflow', name: 'Output workflow', inputs: [input],
      steps: [{id: 'review', name: 'Review', kind: 'checkpoint'}],
      outputs: [{id: 'result', name: 'Result', from: {input: input.id}}]};
    assert(validate(w, []));
    assert(simulate(w, [], new Map(), new Set(['review'])).missing);
    const values = new Map([[input.id, value]]), before = JSON.stringify(w);
    assert.equal(simulate(w, [], values, new Set()).outputs.length, 0);
    const result = simulate(w, [], values, new Set(['review'])).outputs[0];
    assert.equal(result.type, type); assert.equal(result.protected, protectedValue);
    assert.equal(result.value, protectedValue ? '' : value); assert(result.hasValue);
    assert.equal(JSON.stringify(w), before);
    input.required = false;
    const unset = simulate(w, [], new Map(), new Set(['review'])).outputs[0];
    assert.equal(unset.hasValue, false); assert.equal(unset.value, '');
  });
}
for (const type of ['text', 'url', 'number', 'boolean', 'selection', 'date']) {
  const w = workflow(), input = w.inputs[2]; input.type = type;
  if (type === 'selection') input.options = ['Choice'];
  for (const rules of [null, true, [], {}, {pattern: '.*'}, {minimum: true}, {min_bytes: null},
    {min_bytes: -1}, {max_bytes: 0}, {max_bytes: 257}, {min_bytes: 1.5},
    {min_bytes: 5, max_bytes: 4}, {minimum: 2, maximum: 1}, {maximum: 1e12 + 1},
    {minimum: -1e12 - 1}, {minimum: NaN}, {minimum: Infinity}, {minimum: 0, max_bytes: 4}])
    check(() => { input.validation = rules; assert.equal(validate(w, caps), false); });
  const valid = type === 'number' ? {minimum: -.5, maximum: 3} : {min_bytes: 2, max_bytes: 4};
  input.validation = valid;
  check(() => assert.equal(validate(w, caps), ['text', 'url', 'number'].includes(type)));
}
for (const [type, rules, accepted, rejected] of [
  ['text', {min_bytes: 2, max_bytes: 4}, ['ab', 'é', 'éé', 'abcd'], ['a', 'abcde', 'ééé']],
  ['url', {min_bytes: 20, max_bytes: 30}, ['https://example.test/'], ['https://x.test/', 'https://example.test/' + 'x'.repeat(20)]],
  ['number', {minimum: -.5, maximum: 3}, ['-.5', '+0.0', '3', '003.00'], ['-.51', '3.01', 'NaN', 'inf', '1e0']]
]) for (const protectedInput of [false, true]) {
  const w = workflow(); w.inputs = [{id: 'bounded', name: 'Bounded', type, required: false, protected: protectedInput, validation: rules}];
  w.steps = [{id: 'review', name: 'Review', kind: 'checkpoint'}];
  for (const value of ['', ...accepted]) check(() => assert(!simulate(w, caps, new Map([['bounded', value]]), new Set()).error));
  for (const value of rejected) check(() => assert(simulate(w, caps, new Map([['bounded', value]]), new Set()).error));
  check(() => {
    w.inputs[0].required = true;
    assert(simulate(w, caps, new Map(), new Set()).missing.includes('Bounded'));
  });
}
check(() => {
  const original = document(); original.operational.workflows[0].inputs[2].validation = {min_bytes: 2, max_bytes: 4};
  const copied = mutate(JSON.stringify(original), 'research-workflow', 'copy', 'Copy rules');
  assert.deepEqual(clone(copied.parsed.operational.workflows[1].inputs[2].validation), {min_bytes: 2, max_bytes: 4});
});
check(() => assert.equal(validate(workflow(), caps), true));
check(() => assert(parse(JSON.stringify(document()))));
check(() => assert(parse(fs.readFileSync(path.join(root,
    'docs/tahai-skins/operational-skin-v2.example.json'), 'utf8'))));
for (const change of [
  w => { w.id = 'x'; }, w => { w.id = 'Research'; }, w => { w.id = 'a'.repeat(65); },
  w => { w.id = '-research'; }, w => { w.id = 'research-'; }, w => { w.name = ''; },
  w => { w.name = 'unsafe\nlabel'; }, w => { w.name = 'é'; }, w => { w.name = '<markup>'; },
  w => { w.steps = []; }, w => { w.steps = true; }, w => { w.inputs = null; },
  w => { w.extra = 1; }, w => { w.steps[0].url = 'https://example.test'; },
  w => { w.steps[0].action = null; }, w => { w.steps[2].action = 'unknown'; },
  w => { w.steps[2].action = 'constructor'; }, w => { delete w.steps[2].action; },
  w => { w.steps[0].when.input = 'question'; }, w => { w.steps[0].when.input = 'count'; },
  w => { w.steps[0].when.equals = 'maybe'; }, w => { w.steps[0].when.script = 'invalid'; },
  w => { w.steps[0].when = []; }, w => { w.steps[0].when = false; },
  w => { w.steps[0].when.input = 'missing'; }, w => { w.steps[1].id = w.steps[0].id; },
  w => { w.inputs.push(clone(w.inputs[0])); }, w => { w.inputs[0].required = 'false'; },
  w => { w.inputs[0].options = []; }, w => { w.inputs[0].value = 'true'; },
  w => { w.inputs[1].options = []; }, w => { w.inputs[1].options = ['Team', 'Team']; },
  w => { w.inputs[1].options = ['https://example.test']; },
  w => { w.inputs[1].options = ['contact@example.test']; },
  w => { w.inputs[1].options = ['C:\\private']; }, w => { w.inputs[1].options = [false]; },
  w => { w.inputs[1].type = 'date'; }, w => { w.steps[0].kind = 'execute'; },
  w => { for (let n = 4; n <= 12; n++) w.inputs.push({id: 'input-' + n, name: 'Input', type: 'text', required: false}); },
  w => { for (let n = 3; n <= 32; n++) w.steps.push({id: 'step-' + n, name: 'Step', kind: 'instruction'}); }
]) check(() => { const w = workflow(); change(w); assert.equal(validate(w, caps), false); });
check(() => assert.equal(validate(workflow(), ['workspace-layout']), false));
check(() => { const w = workflow(); w.inputs = []; w.steps = [{id: 'step', name: 'Step', kind: 'instruction'}];
  assert.equal(validate(w, []), true); });
for (const change of [
  d => { d.operational.workflows = []; }, d => { d.operational.workflows.push(workflow()); },
  d => { d.operational.modes[0].workflow = 'missing'; }, d => { d.operational.modes.push(clone(d.operational.modes[0])); },
  d => { d.schema_version = 1; }, d => { d.operational.modes = []; }
]) check(() => { const d = document(); change(d); assert.equal(parse(JSON.stringify(d)), null); });
for (const source of ['', '{', 'null', '[]', ' '.repeat(512 * 1024 + 1)])
  check(() => assert.equal(parse(source), null));
check(() => {
  const original = document(), text = JSON.stringify(original);
  const copy = mutate(text, 'research-workflow', 'copy', 'Second workflow');
  assert(!copy.error); assert.equal(copy.selected, 'workflow-second-workflow');
  assert.deepEqual(clone(copy.parsed.operational.workflows[0]), original.operational.workflows[0]);
  assert.deepEqual(clone(copy.parsed.operational.workflows[1].steps), original.operational.workflows[0].steps);
  copy.parsed.operational.workflows[1].steps[0].name = 'Independent label';
  assert.equal(copy.parsed.operational.workflows[0].steps[0].name, 'Review result');
  assert.deepEqual(clone(copy.parsed.sentinel), original.sentinel);
  assert.deepEqual(clone(copy.parsed.operational.surfaces), original.operational.surfaces);
  assert.deepEqual(clone(copy.parsed.operational.modes), original.operational.modes);
  assert.deepEqual(clone(copy.parsed.operational.capabilities), original.operational.capabilities);
  assert.equal(JSON.stringify(original), text);
});
check(() => {
  const d = document();
  const next = mutate(JSON.stringify(d), 'research-workflow', 'create', 'Blank');
  assert.equal(next.parsed.operational.workflows[1].steps.length, 1);
  assert.equal(next.parsed.operational.workflows[1].inputs.length, 0);
  assert.equal(next.parsed.operational.workflows[1].steps[0].kind, 'checkpoint');
  assert(parse(JSON.stringify(next.parsed)));
});
check(() => {
  let text = JSON.stringify(document()), selected = 'research-workflow';
  for (let n = 1; n < 24; n++) {
    const result = mutate(text, selected, 'copy', 'Same name');
    assert(!result.error); selected = result.selected; text = JSON.stringify(result.parsed);
    assert(parse(text));
  }
  assert.equal(parse(text).operational.workflows.length, 24);
  assert(mutate(text, selected, 'copy', 'One too many').error);
  const deleted = mutate(text, selected, 'remove');
  assert.equal(deleted.parsed.operational.workflows.length, 23);
});
check(() => {
  const original = JSON.stringify(document());
  assert(mutate(original, 'research-workflow', 'remove').error);
  const copied = mutate(original, 'research-workflow', 'copy', 'Other');
  let text = JSON.stringify(copied.parsed);
  assert(mutate(text, 'research-workflow', 'remove').error);
  const bound = mutate(text, copied.selected, 'bind', 'research-mode');
  assert.equal(bound.parsed.operational.modes[0].workflow, copied.selected);
  text = JSON.stringify(bound.parsed);
  assert(mutate(text, copied.selected, 'remove').error);
  const deleted = mutate(text, 'research-workflow', 'remove');
  assert.equal(deleted.selected, copied.selected);
  assert.equal(deleted.parsed.operational.workflows.length, 1);
  assert.equal(deleted.parsed.operational.modes[0].workflow, copied.selected);
});
for (const [selected, operation, value] of [
  ['missing', 'copy', 'Copy'], ['research-workflow', 'unknown', 'Copy'],
  ['research-workflow', 'bind', 'missing'], ['research-workflow', 'create', ''],
  ['research-workflow', 'copy', '<unsafe>'], ['research-workflow', 'copy', 'X'.repeat(129)]
]) check(() => {
  const original = JSON.stringify(document()), result = mutate(original, selected, operation, value);
  assert(result.error); assert(!result.parsed); assert.equal(original, JSON.stringify(document()));
});
check(() => assert(mutate('{', 'research-workflow', 'copy', 'Copy').error));
check(() => {
  const d = document(); d.sentinel.padding = '';
  d.sentinel.padding = 'x'.repeat(65536 - Buffer.byteLength(JSON.stringify(d, null, 2)) - 256);
  const text = JSON.stringify(d);
  assert(parse(text));
  assert(encode(d));
  assert(mutate(text, 'research-workflow', 'copy', 'Copy').error);
  assert.equal(JSON.stringify(d), text);
});
check(() => {
  const d = document(); d.sentinel.padding = 'é'.repeat(33000);
  const text = JSON.stringify(d);
  assert(text.length < 65536); assert.equal(parse(text), null); assert.equal(encode(d), null);
});
check(() => {
  const w = workflow(), values = new Map(), done = new Set();
  assert.deepEqual(clone(simulate(w, caps, values, done).missing), ['Approved', 'Scope']);
  values.set('scope', 'Team');
  assert.deepEqual(clone(simulate(w, caps, values, done).missing), ['Approved']);
  values.set('approved', 'false');
  let result = simulate(w, caps, values, done);
  assert.equal(result.steps[0].available, false); assert.equal(result.pending, 2);
  done.add('instruct'); done.add('show');
  assert.equal(simulate(w, caps, values, done).pending, 0);
  values.set('approved', 'true');
  assert.equal(simulate(w, caps, values, done).pending, 1);
  done.add('review');
  assert.equal(simulate(w, caps, values, done).pending, 0);
  values.set('approved', '');
  assert(simulate(w, caps, values, done).missing);
  assert.deepEqual(w, workflow(), 'No definition is changed by simulation');
});
for (const [input, value] of [
  ['approved', 'yes'], ['approved', true], ['scope', 'Other'], ['count', 'NaN'], ['count', '1e4'],
  ['count', '.'], ['count', '++1'], ['count', '--1'], ['count', ' 1'], ['count', '1.2.3'],
  ['question', 'x'.repeat(257)], ['question', 'line\nbreak'], ['question', 'https://example.test'],
  ['question', 'person@example.test'], ['question', 'C:\\private']
]) check(() => {
  const values = new Map([['approved', 'true'], ['scope', 'Team'], [input, value]]);
  assert(simulate(workflow(), caps, values, new Set()).error);
});
for (const value of ['0', '-3', '+4', '.5', '-.5', '5.', '000.025']) check(() => {
  const values = new Map([['approved', 'true'], ['scope', 'Team'], ['count', value]]);
  assert.equal(simulate(workflow(), caps, values, new Set()).pending, 3);
});
for (const [type, accepted, rejected] of [
  ['date', ['0001-01-01', '2000-02-29', '2024-02-29', '2026-09-25', '9999-12-31'],
    ['0000-01-01', '1900-02-29', '2100-02-29', '2026-02-29', '2026-04-31', '2026-13-01',
      '2026-00-01', '2026-01-00', '2026-9-25', '2026-09-25T00:00:00Z', ' 2026-09-25', '10000-01-01']],
  ['url', ['https://example.test/reference', 'http://localhost:8080/', 'https://[::1]/',
      'HTTPS://example.test/path?q=review#section'],
    ['example.test', '//example.test', 'https:///example.test', 'file:///private', 'javascript:alert(1)',
      'tahai://mission', 'https://user@example.test', 'https://user:pass@example.test', 'https://@example.test',
      'https://example.test:99999/', 'https://example.test/a b', 'https://example.test/\\file',
      'https://example.test/\n', 'https://example.test/?access_token=secret', 'https://example.test/?session=value']]
]) {
  const w = {id: 'typed-workflow', name: 'Typed workflow',
    inputs: [{id: 'typed-input', name: 'Typed input', type, required: true}],
    steps: [{id: 'review', name: 'Review', kind: 'checkpoint'}]};
  check(() => assert(validate(w, [])));
  check(() => assert(simulate(w, [], new Map(), new Set()).missing));
  for (const value of accepted) check(() =>
    assert.equal(simulate(w, [], new Map([['typed-input', value]]), new Set()).pending, 1, value));
  for (const value of rejected) check(() =>
    assert(simulate(w, [], new Map([['typed-input', value]]), new Set()).error, value));
  check(() => { const changed = clone(w); changed.inputs[0].value = accepted[0]; assert(!validate(changed, [])); });
  check(() => { const changed = clone(w); changed.inputs[0].options = ['Not allowed']; assert(!validate(changed, [])); });
  check(() => { const changed = clone(w); changed.steps[0].when = {input: 'typed-input', equals: accepted[0]};
    assert(!validate(changed, []), 'Date/URL inputs do not acquire branch or action authority'); });
}
check(() => assert(simulate(workflow(), [], new Map(), new Set()).error));
check(() => assert(simulate(workflow(), caps, {}, new Set()).error));
check(() => assert(simulate(workflow(), caps, new Map(), []).error));
for (const [type, value, invalid] of [
  ['text', 'password=dummy:@/value', 'bad\nvalue'], ['boolean', 'false', 'yes'],
  ['number', '-0.125', 'NaN'], ['date', '2024-02-29', '2026-02-29'],
  ['url', 'https://example.test/?access_token=dummy', 'https://user:pass@example.test'],
  ['selection', 'Team', 'Unlisted']
]) {
  const w = {id: 'protected-workflow', name: 'Protected workflow', inputs: [
    {id: 'private-input', name: 'Private input', type, required: true, protected: true}],
    steps: [{id: 'review', name: 'Review', kind: 'checkpoint'}]};
  if (type === 'selection') w.inputs[0].options = ['Personal', 'Team'];
  check(() => assert(validate(w, [])));
  check(() => assert(simulate(w, [], new Map(), new Set()).missing));
  check(() => assert.equal(simulate(w, [], new Map([['private-input', value]]), new Set()).pending, 1));
  check(() => assert(simulate(w, [], new Map([['private-input', invalid]]), new Set()).error));
  check(() => assert(simulate(w, [], new Map([['private-input', 'é'.repeat(129)]]), new Set()).error));
  for (const flag of ['true', 1, null, [], {}]) check(() => {
    const changed = clone(w); changed.inputs[0].protected = flag; assert(!validate(changed, []));
  });
  for (const field of ['value', 'default', 'protected_value']) check(() => {
    const changed = clone(w); changed.inputs[0][field] = value; assert(!validate(changed, []));
  });
  check(() => {
    const changed = clone(w); changed.steps[0].when = {input: 'private-input', equals: value};
    assert(!validate(changed, []), 'Protected values never drive branch/status side channels');
  });
}
const variableWorkflow = () => ({id: 'variable-workflow', name: 'Typed variables',
  inputs: [{id: 'amount', name: 'Amount', type: 'number', required: false}],
  variables: [{id: 'total', name: 'Total', type: 'number', validation: {minimum: 2, maximum: 4}},
    {id: 'copy', name: 'Copy', type: 'number'}], steps: [
    {id: 'review', name: 'Review', kind: 'checkpoint'},
    {id: 'assign-total', name: 'Assign total', kind: 'assign-variable', assign: {variable: 'total', from: {input: 'amount'}}},
    {id: 'assign-copy', name: 'Assign copy', kind: 'assign-variable', assign: {variable: 'copy', from: {variable: 'total'}}},
    {id: 'overwrite', name: 'Overwrite total', kind: 'assign-variable', assign: {variable: 'total', from: {input: 'amount'}}}],
  outputs: [{id: 'result', name: 'Result', from: {variable: 'copy'}}]});
check(() => {
  const w = variableWorkflow(), original = JSON.stringify(w), values = new Map([['amount', '3']]);
  assert(validate(w, []));
  let done = new Set(), variables = new Map();
  assert(assign(w, [], values, done, variables, 'assign-total').error);
  done.add('review');
  let result = assign(w, [], values, done, variables, 'assign-total');
  assert.equal(result.variables.get('total'), '3'); assert.equal(variables.size, 0);
  done = result.completed; variables = result.variables;
  assert(assign(w, [], values, done, variables, 'assign-total').error);
  values.set('amount', '4');
  result = assign(w, [], values, done, variables, 'assign-copy');
  assert.equal(result.variables.get('copy'), '3');
  done = result.completed; variables = result.variables;
  result = assign(w, [], values, done, variables, 'overwrite');
  assert.equal(result.variables.get('total'), '4'); assert.equal(result.variables.get('copy'), '3');
  const final = simulate(w, [], values, result.completed, result.variables);
  assert.equal(final.pending, 0); assert.equal(final.outputs[0].value, '3');
  assert.equal(JSON.stringify(w), original);
});
for (const value of ['1', '5', 'NaN', 'password=secret', 'é'.repeat(129)]) check(() => {
  const w = variableWorkflow(), values = new Map([['amount', value]]), done = new Set(['review']), variables = new Map();
  assert(assign(w, [], values, done, variables, 'assign-total').error);
  assert.equal(done.size, 1); assert.equal(variables.size, 0);
});
check(() => {
  const result = assign(variableWorkflow(), [], new Map(), new Set(['review']), new Map([['total', '3']]), 'assign-total');
  assert.equal(result.variables.get('total'), '', 'Explicit assignment from blank clears the destination');
});
for (const alter of [
  w => w.variables.push(w.variables[0]), w => w.variables = null,
  w => w.variables = Array.from({length: 13}, (_, i) => ({id: 'slot-' + i, name: 'Slot', type: 'text'})),
  w => w.variables[0].protected = true, w => w.variables[0].required = false,
  w => w.variables[0].value = '3', w => w.variables[0].default = '3',
  w => w.variables[0].type = 'unknown', w => w.variables[0].validation.maximum = 1,
  w => w.inputs[0].protected = true, w => w.inputs[0].type = 'text',
  w => w.steps[1].assign.from = {input: 'amount', variable: 'copy'},
  w => w.steps[1].assign.from = {input: 'missing'}, w => w.steps[1].assign.variable = 'missing',
  w => w.steps[1].assign.value = '3', w => w.steps[1].action = 'mission.open',
  w => w.steps[1].kind = 'checkpoint', w => delete w.steps[1].assign,
  w => w.outputs[0].from.variable = 'missing', w => w.outputs[0].from.input = 'amount'
]) check(() => { const w = variableWorkflow(); alter(w); assert(!validate(w, [])); });
for (const [type, value, options] of [['text', 'Local snapshot'], ['number', '3.25'], ['boolean', 'false'],
  ['date', '2024-02-29'], ['url', 'https://example.test/local'], ['selection', 'Team', ['Personal', 'Team']]]) check(() => {
  const w = variableWorkflow(); w.inputs[0].type = type;
  w.variables.forEach(variable => { variable.type = type; delete variable.validation; });
  if (options) { w.inputs[0].options = options; w.variables.forEach(variable => variable.options = options); }
  assert(validate(w, []));
  const result = assign(w, [], new Map([['amount', value]]), new Set(['review']), new Map(), 'assign-total');
  assert.equal(result.variables.get('total'), value);
});
check(() => assert(assign({}, [], new Map(), new Set(), new Map(), 'missing').error));
const waitWorkflow = () => ({id: 'wait-workflow', name: 'Delay workflow', inputs: [
  {id: 'approved', name: 'Approved', type: 'boolean', required: true}], steps: [
  {id: 'review', name: 'Review', kind: 'checkpoint'},
  {id: 'delay', name: 'Delay', kind: 'wait', wait: {seconds: 3}, when: {input: 'approved', equals: 'true'}},
  {id: 'after', name: 'After', kind: 'checkpoint'}]});
check(() => {
  const w = waitWorkflow(), source = JSON.stringify(w), values = new Map([['approved', 'true']]);
  const done = new Set(), variables = new Map(), waiting = new Set();
  assert(validate(w, [])); assert(wait(w, [], values, done, variables, waiting, 'delay', false).error);
  done.add('review'); assert(wait(w, [], values, done, variables, waiting, 'delay', true).error);
  let result = wait(w, [], values, done, variables, waiting, 'delay', false);
  assert(result.waiting.has('delay')); assert(!result.completed.has('delay')); assert.equal(waiting.size, 0);
  assert.equal(simulate(w, [], values, result.completed, variables, result.waiting).pending, 2);
  assert(wait(w, [], values, result.completed, variables, result.waiting, 'delay', false).error);
  result = wait(w, [], values, result.completed, variables, result.waiting, 'delay', true);
  assert.equal(result.waiting.size, 0); assert(result.completed.has('delay')); assert(!result.completed.has('after'));
  assert(wait(w, [], values, result.completed, variables, result.waiting, 'delay', true).error);
  assert.equal(JSON.stringify(w), source, 'Simulator never stores timer state in the package');
});
for (const seconds of [1, 86400]) check(() => { const w = waitWorkflow(); w.steps[1].wait.seconds = seconds; assert(validate(w, [])); });
for (const alter of [
  ...[0, -1, 86401, .5, '3', true, null, Infinity].map(seconds => w => w.steps[1].wait.seconds = seconds),
  w => delete w.steps[1].wait, w => w.steps[1].wait = null,
  w => w.steps[1].wait.started = 1, w => w.steps[1].wait.remaining_ms = 0,
  w => w.steps[1].kind = 'checkpoint', w => w.steps[1].action = 'mission.open',
  w => w.steps[1].assign = {variable: 'no', from: {input: 'approved'}}
]) check(() => { const w = waitWorkflow(); alter(w); assert(!validate(w, [])); });
for (const waiting of [[], new Set(['missing']), new Set(['review']), new Set(['delay', 'after'])]) check(() => {
  assert(simulate(waitWorkflow(), [], new Map([['approved', 'true']]), new Set(['review']), new Map(), waiting).error);
});
for (const values of [new Map(), new Map([['approved', 'false']])]) check(() => {
  assert(wait(waitWorkflow(), [], values, new Set(['review']), new Map(), new Set(), 'delay', false).error);
});
check(() => assert(simulate(waitWorkflow(), [], new Map([['approved', 'false']]), new Set(['review']), new Map(), new Set(['delay'])).error));
check(() => assert(simulate(waitWorkflow(), [], new Map([['approved', 'true']]), new Set(), new Map(), new Set(['delay'])).error));
for (const complete of ['', 'false', 0, null, undefined]) check(() => {
  assert(wait(waitWorkflow(), [], new Map([['approved', 'true']]), new Set(['review']), new Map(), new Set(), 'delay', complete).error);
});
for (const deadline of [4, 86400]) check(() => {
  const w = waitWorkflow(); w.steps[1].wait.timeout_seconds = deadline; assert(validate(w, []));
  const d = document(); d.operational.workflows[0] = w; d.operational.modes[0].workflow = w.id;
  assert.equal(parse(encode(d)).operational.workflows[0].steps[1].wait.timeout_seconds, deadline);
});
for (const deadline of [0, -1, 3, 2, 86401, 3.5, '4', true, null, {}, []]) check(() => {
  const w = waitWorkflow(); w.steps[1].wait.timeout_seconds = deadline; assert(!validate(w, []));
});
check(() => {
  const w = waitWorkflow(), values = new Map([['approved', 'true']]), done = new Set(['review']), variables = new Map();
  const waiting = new Set(['delay']);
  assert(expireWait(w, [], values, done, variables, waiting, 'delay').error, 'Unbounded wait has no expiry');
  w.steps[1].wait.timeout_seconds = 5; const original = JSON.stringify(w);
  assert(expireWait(w, [], values, done, variables, new Set(), 'delay').error);
  assert(expireWait(w, [], values, done, variables, waiting, 'after').error);
  assert.equal(expireWait(w, [], values, done, variables, waiting, 'delay').code, 'wait-timed-out');
  assert.equal(JSON.stringify(w), original); assert.equal(waiting.size, 1); assert(!done.has('delay')); assert(!done.has('after'));
});
for (const outcome of ['rejected', 'unknown']) check(() => {
  const w = workflow(), values = new Map([['approved', 'true'], ['scope', 'Personal']]);
  const done = new Set(['review', 'instruct']), variables = new Map(), waiting = new Set(), original = JSON.stringify(w);
  const failure = failNative(w, caps, values, done, variables, waiting, 'show', outcome);
  assert.equal(failure.code, outcome === 'rejected' ? 'native-rejected' : 'native-outcome-unknown');
  assert.equal(failure.stepId, 'show'); assert(!done.has('show')); assert.equal(JSON.stringify(w), original);
  assert(failNative(w, caps, values, new Set(), variables, waiting, 'show', outcome).error);
  assert(failNative(w, caps, values, done, variables, waiting, 'review', outcome).error);
  assert(failNative(w, caps, values, done, variables, waiting, 'missing', outcome).error);
  done.add('show'); assert(failNative(w, caps, values, done, variables, waiting, 'show', outcome).error);
});
for (const outcome of ['dispatched', 'failed', 'password=not-real', null, 0, {}]) check(() => {
  assert(failNative(workflow(), caps, new Map(), new Set(), new Map(), new Set(), 'show', outcome).error);
});
check(() => {
  const w = workflow(), values = new Map([['approved', 'false'], ['scope', 'Personal']]);
  w.steps[2].when = {input: 'approved', equals: 'true'};
  assert(failNative(w, caps, values, new Set(['instruct']), new Map(), new Set(), 'show', 'unknown').error);
  assert(failNative(w, [], values, new Set(['instruct']), new Map(), new Set(), 'show', 'unknown').error);
});
const calculationWorkflow = expression => {
  const w = variableWorkflow(); delete w.variables[0].validation;
  w.steps[1].assign = {variable: 'total', expression}; return w;
};
for (const [op, expected] of [['add', '5'], ['subtract', '1'], ['multiply', '6'], ['divide', '1.5'],
  ['min', '2'], ['max', '3'], ['abs', '3'], ['negate', '-3']]) check(() => {
  const expression = {op, args: [{input: 'amount'}, ...(['abs', 'negate'].includes(op) ? [] : [{number: 2}])]};
  const w = calculationWorkflow(expression), original = JSON.stringify(w), values = new Map([['amount', '3']]);
  assert(validate(w, []));
  const result = assign(w, [], values, new Set(['review']), new Map(), 'assign-total');
  assert.equal(result.variables.get('total'), expected); assert(result.completed.has('assign-total'));
  assert.equal(JSON.stringify(w), original); assert.equal(values.get('amount'), '3');
});
for (const [expression, values, code] of [
  [{input: 'amount'}, new Map(), 'missing-number'],
  [{op: 'divide', args: [{number: 3}, {number: 0}]}, new Map(), 'division-by-zero'],
  [{op: 'divide', args: [{number: 3}, {number: -0}]}, new Map(), 'division-by-zero'],
  [{op: 'multiply', args: [{number: 1e12}, {number: 2}]}, new Map(), 'number-out-of-range'],
  [{input: 'amount'}, new Map([['amount', '1000000000001']]), 'number-out-of-range'],
  [{number: 1e-255}, new Map(), 'result-too-long']
]) check(() => {
  const w = calculationWorkflow(expression), variables = new Map([['total', '4']]), completed = new Set(['review']);
  const result = assign(w, [], values, completed, variables, 'assign-total');
  assert(result.error.includes(code)); assert.equal(variables.get('total'), '4'); assert(!completed.has('assign-total'));
});
for (const [value, expected] of [[1e-7, '0.0000001'], [-0, '0'], [1e12, '1000000000000'], [1e-254, '0.' + '0'.repeat(253) + '1']]) check(() => {
  const result = assign(calculationWorkflow({number: value}), [], new Map(), new Set(['review']), new Map(), 'assign-total');
  assert.equal(result.variables.get('total'), expected);
});
for (const expression of [null, [], {}, {number: true}, {number: '2'}, {number: Infinity}, {number: 1e12 + 1},
  {input: 'missing'}, {variable: 'missing'}, {input: 'amount', number: 1},
  {op: 'eval', args: [{number: 2}]}, {op: 'abs', args: []}, {op: 'abs', args: [{number: 2}, {number: 3}]},
  {op: 'add', args: [{number: 1}]}, {op: 'add', args: [{number: 1}, {number: 2}], timeout: 1},
  {op: 'add', args: '1+2'}, {number: 1, value: 2},
  ...[null, ['add'], {}, 1].map(op => ({op, args: [{number: 1}, {number: 2}]}))
]) check(() => assert(!validate(calculationWorkflow(expression), [])));
check(() => {
  let expression = {number: 1};
  for (let i = 0; i < 4; ++i) expression = {op: 'add', args: [clone(expression), clone(expression)]};
  const w = calculationWorkflow(expression); assert(validate(w, []));
  assert.equal(assign(w, [], new Map(), new Set(['review']), new Map(), 'assign-total').variables.get('total'), '16');
  w.steps[1].assign.expression = {op: 'abs', args: [expression]}; assert(!validate(w, []));
});
check(() => {
  const w = calculationWorkflow({op: 'add', args: [{input: 'amount'}, {variable: 'copy'}]});
  const uses = context.window.tahaiWorkflowDesign.usesAssignmentSource;
  assert(uses(w.steps[1].assign, 'input', 'amount')); assert(uses(w.steps[1].assign, 'variable', 'copy'));
  assert(!uses(w.steps[1].assign, 'input', 'copy'));
  w.inputs[0].protected = true; assert(!validate(w, []));
  w.inputs[0].protected = false; w.variables[1].type = 'text'; assert(!validate(w, []));
  w.variables[1].type = 'number'; w.steps[1].assign.from = {input: 'amount'}; assert(!validate(w, []));
});
const numericBranch = compare => ({id: 'numeric-branch', name: 'Numeric branch',
  inputs: [{id: 'amount', name: 'Amount', type: 'number', required: false}],
  steps: [{id: 'review', name: 'Review', kind: 'checkpoint', when: {input: 'amount', compare}}]});
for (const [op, results] of [['equal', [false, true, false]], ['not-equal', [true, false, true]],
  ['less-than', [true, false, false]], ['at-most', [true, true, false]],
  ['greater-than', [false, false, true]], ['at-least', [false, true, true]]]) {
  for (const [index, value] of ['2', '3', '4'].entries()) check(() => {
    const w = numericBranch({op, number: 3}); assert(validate(w, []));
    const result = simulate(w, [], new Map([['amount', value]]), new Set());
    assert.equal(result.steps[0].available, results[index]);
    assert.equal(result.pending, results[index] ? 1 : 0);
  });
}
for (const compare of [null, [], {}, {op: 'equal', number: true}, {op: 'equal', number: '3'},
  {op: 'equal', number: Infinity}, {op: 'equal', number: NaN}, {op: 'equal', number: 1e12 + 1},
  {op: ['equal'], number: 3}, {op: {}, number: 3}, {op: 'script', number: 3},
  {op: 'equal'}, {number: 3}, {op: 'equal', number: 3, value: 4}])
  check(() => assert(!validate(numericBranch(compare), [])));
check(() => {
  const w = numericBranch({op: 'not-equal', number: 0});
  assert.deepEqual(Array.from(simulate(w, [], new Map(), new Set()).missing), ['Amount']);
  assert(simulate(w, [], new Map([['amount', 'not a number']]), new Set()).error);
  assert.equal(simulate(w, [], new Map([['amount', '-0']]), new Set()).steps[0].available, false);
  assert.equal(simulate(w, [], new Map([['amount', '+.5']]), new Set()).steps[0].available, true);
  assert.equal(simulate(w, [], new Map([['amount', '9'.repeat(256)]]), new Set()).steps[0].available, true);
  w.inputs[0].protected = true; assert(!validate(w, []));
  w.inputs[0].protected = false; w.inputs[0].type = 'text'; assert(!validate(w, []));
  w.inputs[0].type = 'number'; w.steps[0].when.equals = '3'; assert(!validate(w, []));
  delete w.steps[0].when.equals; w.steps[0].when.input = 'missing'; assert(!validate(w, []));
});
const variableBranch = () => ({id: 'variable-branch', name: 'Variable branch',
  inputs: [{id: 'amount', name: 'Amount', type: 'number', required: false}],
  variables: [{id: 'amount', name: 'Saved amount', type: 'number'}],
  steps: [
    {id: 'initial', name: 'Assign first', kind: 'assign-variable', assign: {variable: 'amount', expression: {number: 2}}},
    {id: 'branch', name: 'Review branch', kind: 'checkpoint', when: {variable: 'amount', compare: {op: 'greater-than', number: 3}}},
    {id: 'change', name: 'Assign later', kind: 'assign-variable', assign: {variable: 'amount', expression: {number: 4}}},
    {id: 'later', name: 'Later branch', kind: 'checkpoint', when: {variable: 'amount', compare: {op: 'greater-than', number: 3}}}
  ]});
const advance = context.window.tahaiWorkflowDesign.advance;
check(() => {
  const w = variableBranch(), original = JSON.stringify(w), values = new Map(), done = new Set(), vars = new Map();
  assert(validate(w, []));
  let result = simulate(w, [], values, done, vars);
  assert.equal(result.pending, 4); assert.equal(result.steps[1].resolved, false);
  assert.equal(result.steps[1].available, false); assert.equal(result.outputs.length, 0);
  assert(advance(w, [], values, done, vars, new Set(), 'later').error);
  assert(assign(w, [], values, done, vars, 'change').error);
  const first = assign(w, [], values, done, vars, 'initial');
  assert.equal(first.variables.get('amount'), '2'); assert.equal(first.decisions.size, 0);
  result = simulate(w, [], values, first.completed, first.variables);
  assert(result.steps[1].resolved); assert(!result.steps[1].available);
  const changed = assign(w, [], values, first.completed, first.variables, 'change', first.decisions);
  assert.equal(changed.variables.get('amount'), '4'); assert.equal(changed.decisions.get('branch'), false);
  assert(!changed.decisions.has('later'));
  result = simulate(w, [], values, changed.completed, changed.variables, new Set(), changed.decisions);
  assert(!result.steps[1].available); assert(result.steps[1].recorded); assert(result.steps[3].available);
  assert(simulate(w, [], values, changed.completed, changed.variables).error, 'Lost decisions cannot become a new branch');
  const finished = advance(w, [], values, changed.completed, changed.variables, new Set(), 'later', changed.decisions);
  assert.equal(finished.decisions.get('later'), true);
  assert.equal(simulate(w, [], values, finished.completed, changed.variables, new Set(), finished.decisions).pending, 0);
  assert.equal(JSON.stringify(w), original); assert.equal(done.size, 0); assert.equal(vars.size, 0);
});
for (const type of ['boolean', 'selection', 'number']) check(() => {
  const w = variableBranch(); w.variables[0].type = type; w.steps = [w.steps[1]];
  if (type === 'selection') w.variables[0].options = ['Yes', 'No'];
  w.steps[0].when = type === 'number' ? {variable: 'amount', compare: {op: 'equal', number: 0}} :
      {variable: 'amount', equals: type === 'boolean' ? 'true' : 'Yes'};
  assert(validate(w, []));
  for (const value of ['', undefined]) {
    const result = simulate(w, [], new Map([['amount', '99']]), new Set(), value ? new Map([['amount', value]]) : new Map());
    assert.equal(result.pending, 1); assert(!result.steps[0].resolved);
  }
  const value = type === 'number' ? '-0' : type === 'boolean' ? 'true' : 'Yes';
  assert(simulate(w, [], new Map(), new Set(), new Map([['amount', value]])).steps[0].available);
});
for (const when of [null, {}, {variable: []}, {variable: true, equals: 'true'},
  {variable: 'missing', equals: 'true'}, {input: 'amount', variable: 'amount', equals: 'true'},
  {variable: 'amount', equals: 'true'}, {variable: 'amount', compare: {op: 'equal', number: 3}, value: true}])
  check(() => { const w = variableBranch(); w.steps[1].when = when; assert(!validate(w, [])); });
for (const decisions of [[], new Map([['branch', 'false']]), new Map([['initial', true]]), new Map([['missing', false]])])
  check(() => assert(simulate(variableBranch(), [], new Map(), new Set(), new Map(), new Set(), decisions).error));
for (const kind of ['checkpoint', 'wait', 'run-command']) check(() => {
  const w = variableBranch(); w.steps[2] = {id: 'change', name: 'Later work', kind}; w.steps.pop();
  if (kind === 'wait') w.steps[2].wait = {seconds: 1};
  if (kind === 'run-command') w.steps[2].action = 'mission.open';
  const done = new Set(['initial']), vars = new Map([['amount', '2']]), values = new Map();
  const result = kind === 'wait' ? wait(w, caps, values, done, vars, new Set(), 'change', false) :
      advance(w, caps, values, done, vars, new Set(), 'change');
  assert.equal(result.decisions.get('branch'), false); vars.set('amount', '4');
  assert(!simulate(w, caps, values, result.completed, vars, result.waiting || new Set(), result.decisions).steps[1].available);
  if (kind === 'run-command') assert.equal(failNative(w, caps, values, done, new Map([['amount', '2']]), new Set(), 'change', 'unknown').decisions.get('branch'), false);
});
const compoundWorkflow = when => ({id: 'compound-flow', name: 'Compound flow', inputs: [
  {id:'approved', name:'Approved', type:'boolean', required:false},
  {id:'scope', name:'Scope', type:'selection', required:false, options:['Team','Personal']},
  {id:'secret', name:'Secret', type:'number', required:false, protected:true}],
  variables: [{id:'total', name:'Total', type:'number'}], steps: [
    {id:'assign', name:'Assign total', kind:'assign-variable', assign:{variable:'total', expression:{number:4}}},
    {id:'branch', name:'Branch', kind:'checkpoint', when},
    {id:'finish', name:'Finish', kind:'checkpoint'}]});
const leafA = {input:'approved', equals:'true'}, leafB = {input:'scope', equals:'Team'};
for (const op of ['all', 'any']) for (const a of ['true','false']) for (const b of ['Team','Personal']) check(() => {
  const w = compoundWorkflow({[op]:[leafA, {not:leafB}]}), values = new Map([['approved',a], ['scope',b]]);
  assert(validate(w, []));
  const expected = op === 'all' ? a === 'true' && b !== 'Team' : a === 'true' || b !== 'Team';
  const result = simulate(w, [], values, new Set()); assert.equal(result.steps[1].available, expected);
  if (expected) {
    const advanced = advance(w, [], values, new Set(), new Map(), new Set(), 'branch');
    assert.equal(advanced.decisions.get('branch'), true);
    values.set('approved','false'); values.set('scope','Team');
    assert(simulate(w, [], values, advanced.completed, new Map(), new Set(), advanced.decisions).steps[1].available);
  }
});
for (const op of ['all','any','not']) check(() => {
  const other = {variable:'total', compare:{op:'greater-than',number:3}};
  const predicate = op === 'not' ? {not:other} : {[op]:[leafA,other]};
  const w = compoundWorkflow(predicate), values = new Map([['approved','true']]);
  let result = simulate(w, [], values, new Set());
  assert.equal(result.steps[1].resolved,false); assert.equal(result.pending,3);
  assert(advance(w, [], values, new Set(), new Map(), new Set(), 'finish').error);
  const assigned = assign(w, [], values, new Set(), new Map(), 'assign');
  result = simulate(w, [], values, assigned.completed, assigned.variables);
  assert(result.steps[1].resolved); assert.equal(result.steps[1].available, op !== 'not');
  assert.equal(JSON.stringify(w.steps[1].when), JSON.stringify(predicate));
});
for (const when of [{all:[]}, {any:[leafA]}, {all:Array(9).fill(leafA)}, {not:[leafA]}, {not:null},
  {all:[leafA,leafB],extra:1}, {any:[leafA,{input:'secret',compare:{op:'equal',number:0}}]},
  {all:[leafA,{input:'missing',equals:'true'}]}, {all:[leafA,leafB],input:'approved'},
  {all:[leafA,{input:'scope',equals:'missing'}]}, {all:'true'}, {not:{not:{}}}])
  check(() => assert(!validate(compoundWorkflow(when), [])));
check(() => {
  let tree = leafA;
  for (let i=0;i<4;++i) tree = {all:[clone(tree),clone(tree)]};
  const w = compoundWorkflow(tree); assert(validate(w, []));
  assert.equal(simulate(w, [], new Map([['approved','true']]), new Set()).steps[1].available,true);
  assert(!validate(compoundWorkflow({not:tree}), []));
  const over = {all:[...Array(4).fill({all:Array(7).fill(leafA)})]};
  assert(!validate(compoundWorkflow(over), []));
  assert(context.window.tahaiWorkflowDesign.usesConditionSource(tree, 'input','approved'));
  assert(!context.window.tahaiWorkflowDesign.usesConditionSource(tree, 'variable','approved'));
});
check(() => {
  const w = compoundWorkflow({any:[leafA,leafB]});
  assert.deepEqual(Array.from(simulate(w, [], new Map([['approved','true']]), new Set()).missing), ['Scope']);
  assert(context.window.tahaiWorkflowDesign.usesConditionSource(w.steps[1].when, 'input','scope'));
  const vars = compoundWorkflow({not:{variable:'total',compare:{op:'equal',number:3}}});
  assert(context.window.tahaiWorkflowDesign.usesConditionSource(vars.steps[1].when, 'variable','total'));
});
const repeatWorkflow = () => ({id:'repeat-flow',name:'Repeat flow',variables:[{id:'total',name:'Total',type:'number'}],steps:[
  {id:'seed',name:'Initialize',kind:'assign-variable',assign:{variable:'total',expression:{number:0}}},
  {id:'increment',name:'Increment',kind:'assign-variable',assign:{variable:'total',expression:{op:'add',args:[{variable:'total'},{number:1}]}}},
  {id:'review',name:'Review',kind:'checkpoint',when:{variable:'total',compare:{op:'greater-than',number:1}}}
],repeats:[{id:'rounds',from:'increment',through:'review',count:3}],outputs:[{id:'result',name:'Result',from:{variable:'total'}}]});
check(() => {
  const w=repeatWorkflow(), {expand,advance}=context.window.tahaiWorkflowDesign;
  assert(validate(w,[])); const original=JSON.stringify(w), steps=expand(w);
  assert.equal(steps.length,7); assert.equal(steps[3].id,'r-rounds-2-increment'); assert.equal(steps[6].name,'[3/3] Review');
  let done=new Set(), variables=new Map(), decisions=new Map();
  for (const stepId of ['seed','r-rounds-1-increment','r-rounds-2-increment']) {
    const next=assign(w,[],new Map(),done,variables,stepId,decisions); assert(!next.error);
    done=next.completed; variables=next.variables; decisions=next.decisions;
  }
  assert.equal(variables.get('total'),'2'); assert.equal(decisions.get('r-rounds-1-review'),false);
  assert(assign(w,[],new Map(),done,variables,'r-rounds-3-increment',decisions).error);
  let next=advance(w,[],new Map(),done,variables,new Set(),'r-rounds-2-review',decisions);
  done=next.completed; decisions=next.decisions;
  next=assign(w,[],new Map(),done,variables,'r-rounds-3-increment',decisions);
  done=next.completed; variables=next.variables; decisions=next.decisions;
  next=advance(w,[],new Map(),done,variables,new Set(),'r-rounds-3-review',decisions);
  const result=simulate(w,[],new Map(),next.completed,variables,new Set(),next.decisions);
  assert.equal(result.pending,0); assert.equal(result.outputs[0].value,'3');
  assert.equal(next.decisions.get('r-rounds-1-review'),false);
  assert.equal(JSON.stringify(w),original); assert.equal(expand({...w,repeats:[]})[1].id,'increment');
  assert(simulate(w,[],new Map(),new Set(['increment'])).error);
});
for (const repeats of [null,{},true,[null],[{}],
  ...[0,1,9,-1,2.5,true,'2',null].map(count=>[{id:'rounds',from:'increment',through:'review',count}]),
  [{id:'rounds',from:'missing',through:'review',count:2}], [{id:'rounds',from:'review',through:'increment',count:2}],
  [{id:'rounds',from:'increment',through:'review',count:2,while:true}],
  [{id:'rounds',from:'increment',through:'review',count:2},{id:'again',from:'review',through:'review',count:2}],
  [{id:'rounds',from:'increment',through:'increment',count:2},{id:'rounds',from:'review',through:'review',count:2}],
  [{id:'x',from:'increment',through:'review',count:2}],
  Array.from({length:9},(_,i)=>({id:'round-'+i,from:'review',through:'review',count:2}))
]) check(()=>{const w=repeatWorkflow();w.repeats=repeats;assert(!validate(w,[]));assert.equal(context.window.tahaiWorkflowDesign.expand(w),null);});
check(()=>{
  const w=repeatWorkflow();w.steps.push({id:'r-rounds-1-review',name:'Collision',kind:'checkpoint'});assert(!validate(w,[]));
});
for (const change of [w=>w.steps[2].name='A'.repeat(123),w=>w.repeats[0].id='a'.repeat(64)]) check(()=>{
  const w=repeatWorkflow();change(w);assert(!validate(w,[]));
});
check(()=>{
  const w={id:'quota',name:'Quota',steps:Array.from({length:4},(_,i)=>({id:'step-'+i,name:'Step',kind:'checkpoint'})),
    repeats:[{id:'rounds',from:'step-0',through:'step-3',count:8}]};
  assert(validate(w,[]));assert.equal(context.window.tahaiWorkflowDesign.expand(w).length,32);
  w.steps.push({id:'extra',name:'Extra',kind:'checkpoint'});assert(!validate(w,[]));
});
check(()=>{
  const w=repeatWorkflow();w.repeats=[{id:'later',from:'review',through:'review',count:2},{id:'earlier',from:'increment',through:'increment',count:2}];
  assert(validate(w,[]));const expanded=context.window.tahaiWorkflowDesign.expand(w);
  assert.equal(expanded[1].id,'r-earlier-1-increment');assert.equal(expanded[3].id,'r-later-1-review');
});
check(()=>{
  const w={id:'repeat-wait',name:'Repeat wait',steps:[{id:'delay',name:'Delay',kind:'wait',wait:{seconds:1,timeout_seconds:3}}],
    repeats:[{id:'rounds',from:'delay',through:'delay',count:2}]};
  let done=new Set(), waiting=new Set();
  for(const stepId of ['r-rounds-1-delay','r-rounds-2-delay']) {
    const started=wait(w,[],new Map(),done,new Map(),waiting,stepId,false);assert(!started.error);
    const finished=wait(w,[],new Map(),done,new Map(),started.waiting,stepId,true);assert(!finished.error);
    done=finished.completed;waiting=finished.waiting;
  }
  assert.equal(simulate(w,[],new Map(),done).pending,0);
});
const privateVariables = () => ({id:'private-variables',name:'Private variables',inputs:[
  {id:'secret',name:'Secret',type:'text',required:false,protected:true}],variables:[
  {id:'first',name:'First',type:'text',protected:true},{id:'second',name:'Second',type:'text',protected:true}],steps:[
  {id:'copy-one',name:'Copy one',kind:'assign-variable',assign:{variable:'first',from:{input:'secret'}}},
  {id:'copy-two',name:'Copy two',kind:'assign-variable',assign:{variable:'second',from:{variable:'first'}}}],
  outputs:[{id:'result',name:'Result',from:{variable:'second'}}]});
for(const [type,value] of [['text','password=fixture:@/'],['number','-.25'],['boolean','false'],['selection','Team'],['date','2024-02-29'],['url','https://example.test/?access_token=fixture']])check(()=>{
  const w=privateVariables();for(const field of [...w.inputs,...w.variables]){field.type=type;if(type==='selection')field.options=['Team','Personal'];}
  assert(validate(w,[]));const before=JSON.stringify(w),values=new Map([['secret',value]]);
  let assigned=assign(w,[],values,new Set(),new Map(),'copy-one');assert(!assigned.error);
  assigned=assign(w,[],values,assigned.completed,assigned.variables,'copy-two');assert(!assigned.error);
  const output=simulate(w,[],values,assigned.completed,assigned.variables).outputs[0];
  assert.equal(output.protected,true);assert.equal(output.hasValue,true);assert.equal(output.value,'');assert.equal(JSON.stringify(w),before);
});
for(const mutate of [w=>w.variables[0].protected=false,w=>w.variables[1].protected=false,
    ...['value','protected_value','protected_has_value','protected_storage_ready','default'].map(key=>w=>w.variables[0][key]='fixture'),
    ...['true',null,1,{},[]].map(flag=>w=>w.variables[0].protected=flag)])check(()=>{const w=privateVariables();mutate(w);assert(!validate(w,[]));});
check(()=>{
  const w=privateVariables();w.inputs[0].protected=false;assert(validate(w,[]));
  w.variables[0].validation={max_bytes:3};const result=assign(w,[],new Map([['secret','excess']]),new Set(),new Map(),'copy-one');
  assert(result.error);assert(!result.variables);assert(!result.completed);
});
check(()=>{
  const w=privateVariables();for(const field of [...w.inputs,...w.variables])field.type='number';
  w.steps[0].assign={variable:'first',expression:{number:1}};assert(!validate(w,[]));
  w.steps[0].assign={variable:'first',from:{input:'secret'}};
  w.steps[0].when={variable:'first',compare:{op:'equal',number:1}};assert(!validate(w,[]));
  w.steps[0].when={not:{variable:'first',compare:{op:'equal',number:1}}};assert(!validate(w,[]));
});
const textWorkflow = expression => ({id:'text-work',name:'Text work',inputs:[{id:'source',name:'Source',type:'text',required:false}],
  variables:[{id:'result',name:'Result',type:'text'}],steps:[{id:'format',name:'Format',kind:'assign-variable',assign:{variable:'result',text_expression:expression}}],
  outputs:[{id:'final',name:'Final',from:{variable:'result'}}]});
for (const [expression, expected] of [
  [{text:''},''],[{text:'é😀'},'é😀'],[{input:'source'},' Aa é😀 '],
  [{op:'concat',args:[{text:'prefix '},{input:'source'}]},'prefix  Aa é😀 '],
  [{op:'trim-space',args:[{input:'source'}]},'Aa é😀'],
  [{op:'upper-ascii',args:[{input:'source'}]},' AA é😀 '],
  [{op:'lower-ascii',args:[{input:'source'}]},' aa é😀 '],
  [{op:'replace',args:[{text:'aaa'},{text:'aa'},{text:'x'}]},'xa'],
  [{op:'replace',args:[{text:'a.a'},{text:'.'},{text:'$&'}]},'a$&a'],
  [{op:'replace',args:[{text:'a'},{text:'a'},{text:'aaa'}]},'aaa'],
  [{op:'trim-space',args:[{text:'\u00a0keep\u00a0'}]},'\u00a0keep\u00a0'],
]) check(() => {
  const w=textWorkflow(expression),before=JSON.stringify(w);assert(validate(w,[]));
  const result=assign(w,[],new Map([['source',' Aa é😀 ']]),new Set(),new Map(),'format');assert(!result.error,result.error);
  assert.equal(result.variables.get('result'),expected);assert.equal(simulate(w,[],new Map([['source',' Aa é😀 ']]),result.completed,result.variables).outputs[0].value,expected);
  assert.equal(JSON.stringify(w),before);
});
for (const [expression, code] of [
  [{input:'source'},'missing-text'],
  [{op:'replace',args:[{text:'abc'},{text:''},{text:'x'}]},'empty-search'],
  [{op:'concat',args:[{text:'é'.repeat(128)},{text:'x'}]},'result-too-long'],
  [{op:'replace',args:[{text:'a'.repeat(256)},{text:'a'},{text:'xx'}]},'result-too-long'],
  [{op:'trim-space',args:[{op:'concat',args:[{text:' '.repeat(256)},{text:' '}]}]},'result-too-long']
]) check(()=>{
  const w=textWorkflow(expression),variables=new Map([['result','prior']]),completed=new Set(),decisions=new Map();
  const result=assign(w,[],new Map(),completed,variables,'format',decisions);assert(result.error.includes(code));
  assert.equal(variables.get('result'),'prior');assert.equal(completed.size,0);assert.equal(decisions.size,0);assert(!result.variables);
});
for(const expression of [null,[],{}, {text:1},{text:true},{text:'\n'},{text:'\0'},{text:'\x7f'},
  {text:'\ud800'},{text:'\uffff'},{text:'\u{1fffe}'},{text:'é'.repeat(129)},{input:'missing'},{text:'a',input:'source'},
  {op:'eval',args:[]},{op:'concat',args:[{text:'a'}]}, {op:'trim-space',args:[{text:'x'},{text:'y'}]},
  {op:'replace',args:[{text:'x'},{text:'y'}]},{op:[],args:[]},{op:'concat',args:[{text:'a'},{text:'b'}],script:'no'},
  {number:1}
])check(()=>assert(!validate(textWorkflow(expression),[])));
check(()=>{
  let tree={text:'x'};for(let i=0;i<4;++i)tree={op:'concat',args:[clone(tree),clone(tree)]};
  assert(validate(textWorkflow(tree),[]));assert(!validate(textWorkflow({op:'trim-space',args:[tree]}),[]));
});
for(const mutate of [w=>w.inputs[0].protected=true,w=>w.inputs[0].type='number',w=>w.variables[0].protected=true,
  w=>w.variables[0].type='number',w=>w.steps[0].assign.from={input:'source'},w=>w.steps[0].assign.expression={number:1}
])check(()=>{const w=textWorkflow({input:'source'});mutate(w);assert(!validate(w,[]));});
check(()=>{
  const w=textWorkflow({variable:'result'});assert(validate(w,[]));assert(usesAssignmentSource(w.steps[0].assign,'variable','result'));
  assert(usesAssignmentSource(textWorkflow({op:'concat',args:[{input:'source'},{text:'x'}]}).steps[0].assign,'input','source'));
  w.variables[0].validation={max_bytes:3};const result=assign(w,[],new Map(),new Set(),new Map([['result','long']]),'format');assert(result.error);
});
check(()=>{
  const w=textWorkflow({op:'concat',args:[{text:'password'},{text:'=fixture'}]});assert(validate(w,[]));
  const result=assign(w,[],new Map(),new Set(),new Map(),'format');assert(result.error);assert(!result.variables);
});
const actionStatusWorkflow = () => ({id:'action-results',name:'Action results',variables:[{id:'outcome',name:'Outcome',type:'selection',options:['dispatched','rejected','unknown']}],steps:[
  {id:'dispatch',name:'Dispatch',kind:'run-command',action:'layout.dual'},
  {id:'capture',name:'Record status',kind:'assign-variable',assign:{variable:'outcome',from:{action_status:'dispatch'}}} ]});
check(()=>{const w=actionStatusWorkflow();assert(validate(w,caps));assert(usesAssignmentSource(w.steps[1].assign,'action_status','dispatch'));
  assert(assign(w,caps,new Map(),new Set(),new Map(),'capture').error);
  const result=assign(w,caps,new Map(),new Set(['dispatch']),new Map(),'capture');assert.equal(result.variables.get('outcome'),'dispatched');});
for(const mutate of [w=>w.steps[1].assign.from.action_status='capture',w=>w.steps[1].assign.from.action_status='missing',
  w=>{w.steps[0].kind='checkpoint';delete w.steps[0].action;},w=>w.steps.reverse(),w=>w.variables[0].protected=true,
  w=>{w.variables[0].type='number';delete w.variables[0].options;},w=>w.steps[1].assign.from.input='dispatch',
  w=>w.steps[1].assign.expression={number:1},w=>w.steps[1].assign.text_expression={text:'x'}])check(()=>{const w=actionStatusWorkflow();mutate(w);assert(!validate(w,caps));});
check(()=>{const w=actionStatusWorkflow();w.repeats=[{id:'rounds',from:'dispatch',through:'capture',count:2}];const original=JSON.stringify(w);
  assert(validate(w,caps));const steps=context.window.tahaiWorkflowDesign.expand(w);
  assert.equal(steps[1].assign.from.action_status,'r-rounds-1-dispatch');assert.equal(steps[3].assign.from.action_status,'r-rounds-2-dispatch');
  assert.equal(JSON.stringify(w),original);const completed=new Set(['r-rounds-1-dispatch','r-rounds-1-capture']);
  assert(assign(w,caps,new Map(),completed,new Map([['outcome','dispatched']]),'r-rounds-2-capture').error);
  completed.add('r-rounds-2-dispatch');assert.equal(assign(w,caps,new Map(),completed,new Map(),'r-rounds-2-capture').variables.get('outcome'),'dispatched');
  w.steps.push({id:'final',name:'Final status',kind:'assign-variable',assign:{variable:'outcome',from:{action_status:'dispatch'}}});
  assert.equal(context.window.tahaiWorkflowDesign.expand(w).at(-1).assign.from.action_status,'r-rounds-2-dispatch');});
check(()=>{const w=actionStatusWorkflow();w.variables[0]={id:'outcome',name:'Outcome',type:'text',validation:{max_bytes:3}};assert(validate(w,caps));
  const values=new Map([['outcome','old']]);assert(assign(w,caps,new Map(),new Set(['dispatch']),values,'capture').error);assert.equal(values.get('outcome'),'old');});
console.log(`${checks} actual workflow model/validation/simulation checks passed; no browser or native action executed.`);
