// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Runs Mission Control's actual input listeners with a DOM/message test double.
// This is not a Chromium, OSCrypt, accessibility, or native persistence test.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'chrome/browser/ui/webui/tahai/tahai_ui.cc'), 'utf8');
const script = source.match(/constexpr char kMissionWorkflowInputJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
assert(script, 'Must test the actual shipped input listener');
const inputRunId = '00000000-0000-4000-8000-000000000001';
const inputRunToken = '00000000-0000-4000-8000-000000000002';
const page = (locked = false) => {
  const events = new Map(), sent = [], status = {textContent: ''};
  const card = {isConnected: true, dataset: {tahaiMissionId: inputRunId, tahaiRunToken: inputRunToken}};
  const context = {window: {}, TextEncoder, document: {
    querySelector(selector) {
      if (selector === '#mission-status') return status;
      assert.equal(selector, '[data-tahai-protected-storage="locked"]');
      return locked ? {} : null;
    },
    addEventListener(type, callback) { events.set(type, callback); }
  }, chrome: {send: (name, args) => sent.push({name, args: Array.from(args)})}};
  vm.runInNewContext(script, context, {timeout: 1000});
  const control = (selector, value = '', overrides = {}) => ({
    disabled: false, isConnected: true, value,
    dataset: {tahaiMissionId: inputRunId, tahaiInputId: 'private-input', tahaiProtected: 'true', ...overrides},
    closest: function(query) { return query === selector ? this : query === '.mission-card' ? card : null; }
  });
  return {sent, status, card, window: context.window, control,
    dispatch: (type, target) => events.get(type)({target})};
};
let checks = 0;
const check = callback => { callback(); ++checks; };
check(() => assert.equal(page().sent.length, 0));
check(() => {
  const p = page(true), retry = p.control('[data-tahai-protected-retry]');
  assert.deepEqual(p.sent, [{name: 'prepareTahaiProtectedWorkflowInputs', args: []}]);
  p.dispatch('click', retry); assert.equal(p.sent.length, 1);
  p.window.tahaiProtectedWorkflowInputsUnavailable();
  assert(p.status.textContent.includes('Saved encrypted values were kept'));
  p.dispatch('click', retry); assert.equal(p.sent.length, 2);
  p.dispatch('click', retry); assert.equal(p.sent.length, 2);
});
check(() => {
  const p = page(), input = p.control('[data-tahai-workflow-input]', 'password=dummy:@/secret');
  p.dispatch('change', input);
  assert.equal(input.value, '', 'The renderer must not retain entered protected values after sending');
  assert.deepEqual(p.sent, [{name: 'setTahaiOperationalWorkflowInput', args: [inputRunId, 'private-input', 'password=dummy:@/secret', inputRunToken]}]);
  assert(!p.status.textContent.includes('dummy'));
  p.window.tahaiMissionWorkflowInputRejected();
  assert(p.status.textContent.includes('not stored')); assert(!p.status.textContent.includes('dummy'));
});
for (const value of ['', 'x'.repeat(257), 'é'.repeat(129)]) check(() => {
  const p = page(), input = p.control('[data-tahai-workflow-input]', value);
  p.dispatch('change', input); assert.equal(input.value, ''); assert.equal(p.sent.length, 0);
  if (value) assert(p.status.textContent.includes('not stored'));
});
check(() => {
  const p = page(), input = p.control('[data-tahai-workflow-input]', 'é'.repeat(128));
  p.dispatch('change', input); assert.equal(p.sent.length, 1); assert.equal(input.value, '');
});
for (const missing of ['tahaiMissionId', 'tahaiInputId']) check(() => {
  const p = page(), input = p.control('[data-tahai-workflow-input]', 'dummy', {[missing]: ''});
  p.dispatch('change', input); assert.equal(p.sent.length, 0); assert.equal(input.value, '');
});
check(() => {
  const p = page(), input = p.control('[data-tahai-workflow-input]', 'Ordinary value', {tahaiProtected: 'false'});
  p.dispatch('change', input); assert.equal(p.sent.length, 1); assert.equal(input.value, 'Ordinary value');
  input.value = ''; p.dispatch('change', input); assert.equal(p.sent[1].args[2], '');
});
for (const [type, selector] of [['change', '[data-tahai-workflow-input]'],
  ['click', '[data-tahai-protected-clear]'], ['click', '[data-tahai-protected-retry]']]) check(() => {
  const p = page(), input = p.control(selector, 'dummy'); input.disabled = true;
  p.dispatch(type, input); assert.equal(p.sent.length, 0);
});
check(() => {
  const p = page(), clear = p.control('[data-tahai-protected-clear]');
  p.dispatch('click', clear);
  assert.deepEqual(p.sent, [{name: 'setTahaiOperationalWorkflowInput', args: [inputRunId, 'private-input', '', inputRunToken]}]);
});
for (const [type, selector] of [['change', '[data-tahai-workflow-input]'], ['click', '[data-tahai-protected-clear]']]) {
  for (const mutate of [(p,c)=>c.isConnected=false, (p,c)=>p.card.isConnected=false,
      (p,c)=>p.card.dataset.tahaiMissionId='another', (p,c)=>p.card.dataset.tahaiRunToken='bad']) check(()=>{
    const p=page(), control=p.control(selector, 'private fixture'); mutate(p,control);
    p.dispatch(type,control); assert.equal(p.sent.length,0); if(type==='change') assert.equal(control.value,'');
  });
}
const assignmentScript = source.match(/constexpr char kMissionWorkflowStateJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
assert(assignmentScript);
const assignmentPage = (controlSelector = '[data-tahai-variable-assign]', clocks = []) => {
  const callbacks = [], sent = [], status = {textContent: ''};
  let now = 0, tick = null, reloads = 0;
  const context = {window: {location: {reload: () => ++reloads}}, performance: {now: () => now}, setInterval: callback => { tick = callback; }, document: {
    querySelector: selector => { assert.equal(selector, '#mission-status'); return status; },
    querySelectorAll: selector => { assert.equal(selector, '[data-tahai-wait-countdown]'); return clocks; },
    addEventListener: (type, callback) => { assert.equal(type, 'click'); callbacks.push(callback); }
  }, chrome: {send: (name, args) => sent.push({name, args: Array.from(args)})}};
  vm.runInNewContext(assignmentScript, context, {timeout: 1000});
  return {sent, status, context, reloads: () => reloads, advance: elapsed => { now += elapsed; tick?.(); }, click: overrides => {
    let stopped = false;
    const control = {disabled: false, isConnected: true, dataset: {tahaiMissionId: '00000000-0000-4000-8000-000000000001', tahaiStepIndex: '1', tahaiRunToken: '00000000-0000-4000-8000-000000000002'}, ...overrides};
    const target = {closest: selector => selector === controlSelector ? control : null};
    for (const callback of callbacks) { if (!stopped) callback({target, stopImmediatePropagation: () => { stopped = true; }}); }
  }};
};
check(() => {
  const p = assignmentPage(); p.click({});
  assert.deepEqual(p.sent, [{name: 'assignTahaiWorkflowVariable', args: ['00000000-0000-4000-8000-000000000001', 1, '00000000-0000-4000-8000-000000000002']}]);
  p.context.window.tahaiWorkflowAssignmentRejected(); assert(p.status.textContent.includes('Variable not changed'));
});
for (const index of ['-1', '32', 'NaN', '0.5', 'Infinity']) check(() => {
  const p = assignmentPage(); p.click({dataset: {tahaiMissionId: '00000000-0000-4000-8000-000000000001', tahaiStepIndex: index, tahaiRunToken: '00000000-0000-4000-8000-000000000002'}});
  assert.equal(p.sent.length, 0);
});
check(() => { const p = assignmentPage(); p.click({disabled: true}); assert.equal(p.sent.length, 0); });
check(() => { const p = assignmentPage(); p.click({dataset: {tahaiMissionId: 'bad', tahaiStepIndex: '1'}}); assert.equal(p.sent.length, 0); });
for (const token of ['', 'bad', 'x'.repeat(37)]) check(() => {
  const p = assignmentPage(); p.click({dataset: {tahaiMissionId: '00000000-0000-4000-8000-000000000001', tahaiStepIndex: '1', tahaiRunToken: token}});
  assert.equal(p.sent.length, 0);
});
const waitData = (operation = 'start') => ({tahaiMissionId: '00000000-0000-4000-8000-000000000001', tahaiStepIndex: '1',
  tahaiRunToken: '00000000-0000-4000-8000-000000000002', tahaiWaitControl: operation});
for (const operation of ['start', 'complete']) check(() => {
  const p = assignmentPage('[data-tahai-wait-control]'); p.click({dataset: waitData(operation)});
  assert.deepEqual(p.sent, [{name: 'controlTahaiWorkflowWait', args: [waitData().tahaiMissionId, 1, operation, waitData().tahaiRunToken]}]);
  p.context.window.tahaiWorkflowWaitRejected(); assert(p.status.textContent.includes('Wait not changed'));
});
for (const overrides of [{disabled: true, dataset: waitData()},
  ...['', 'pause', 'next', 'auto'].map(operation => ({dataset: waitData(operation)})),
  ...['-1', '32', 'NaN', '.5', '', '1e0', '01'].map(index => ({dataset: {...waitData(), tahaiStepIndex: index}})),
  ...['tahaiMissionId', 'tahaiRunToken'].map(key => ({dataset: {...waitData(), [key]: 'bad'}}))]) check(() => {
  const p = assignmentPage('[data-tahai-wait-control]'); p.click(overrides); assert.equal(p.sent.length, 0);
});
check(() => {
  const clock = {dataset: {tahaiWaitCountdown: '2500'}, textContent: '', isConnected: true};
  const p = assignmentPage('[data-tahai-wait-control]', [clock]);
  assert(clock.textContent.includes('3')); p.advance(1000); assert(clock.textContent.includes('2'));
  p.advance(2000); assert(clock.textContent.includes('Confirm completion'));
  assert.equal(p.sent.length, 0, 'Elapsed renderer time never sends a native completion message');
});
check(() => {
  const clock = {dataset: {tahaiWaitCountdown: '1000', tahaiWaitTimeout: '3000'}, textContent: '', isConnected: true};
  const p = assignmentPage('[data-tahai-wait-refresh]', [clock]);
  assert(clock.textContent.includes('Completion deadline: 3')); p.advance(1000);
  assert(clock.textContent.includes('Confirm completion')); assert(clock.textContent.includes('Completion deadline: 2'));
  p.advance(2000); assert(clock.textContent.includes('Refresh run status'));
  assert.equal(p.reloads(), 0); assert.equal(p.sent.length, 0, 'A display estimate never changes native state');
  p.click({disabled: true}); assert.equal(p.reloads(), 0);
  p.click({}); assert.equal(p.reloads(), 1); assert.equal(p.sent.length, 0);
});
for (const timeout of ['bad', '-1', '86400001']) check(() => {
  const clock = {dataset: {tahaiWaitCountdown: '1000', tahaiWaitTimeout: timeout}, textContent: '', isConnected: true};
  const p = assignmentPage('[data-tahai-wait-refresh]', [clock]);
  assert(!clock.textContent.includes('Completion deadline')); p.advance(100000000);
  assert.equal(p.sent.length, 0); assert.equal(p.reloads(), 0);
});
const nativeScript = source.match(/constexpr char kMissionNativeWorkflowJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
assert(nativeScript);
const nativePage = () => {
  const status = {textContent: ''}, sent = []; let click = null, reloads = 0;
  const rows = ['first', 'second'].map(id => {
    const label = {textContent: ''}, error = {hidden: true, textContent: '', dataset: {}}, refresh = {hidden: true};
    const checkpoint = {disabled: true, dataset: {tahaiRunToken: inputRunToken}};
    const card = {isConnected: true, dataset: {tahaiMissionId: id, tahaiRunToken: inputRunToken}, querySelectorAll: () => [checkpoint]};
    const row = {querySelector: selector => ({'[data-tahai-native-status]': label,
      '[data-tahai-native-error]': error, '[data-tahai-native-refresh]': refresh,
      '[data-tahai-mission-action="toggle-step"]': checkpoint})[selector]};
    const button = {disabled: false, isConnected: true, dataset: {tahaiMissionId: id, tahaiStepIndex: '0'},
      closest: selector => selector === '.mission-step' ? row : selector === '.mission-card' ? card : null};
    return {button, label, error, refresh, checkpoint, card};
  });
  const context = {window: {location: {reload: () => ++reloads}}, document: {
    querySelector: selector => { assert.equal(selector, '#mission-status'); return status; },
    querySelectorAll: selector => { assert.equal(selector, '[data-tahai-native-run]'); return rows.map(row => row.button); },
    addEventListener: (type, callback) => { assert.equal(type, 'click'); click = callback; }
  }, chrome: {send: (name, args) => sent.push({name, args: Array.from(args)})}};
  vm.runInNewContext(nativeScript, context, {timeout: 1000});
  return {rows, status, sent, result: context.window.tahaiNativeWorkflowResult, reloads: () => reloads,
    run: (trusted=true) => click({isTrusted:trusted,target:{closest:selector=>selector==='[data-tahai-native-run]'?rows[0].button:null}}),
    refresh: () => click({target: {closest: selector => selector === '[data-tahai-native-refresh]' ? rows[0].refresh : null}})};
};
for (const outcome of ['rejected', 'unknown']) check(() => {
  const p = nativePage(); p.result('first', 0, outcome, inputRunToken);
  assert(!p.rows[0].error.hidden); assert.equal(p.rows[0].error.dataset.tahaiNativeError, outcome);
  assert(!p.rows[0].refresh.hidden); assert(p.rows[0].button.disabled); assert(p.rows[0].checkpoint.disabled);
  assert(p.rows[1].error.hidden); assert(!p.rows[1].button.disabled);
  assert(p.rows[0].error.textContent.includes(outcome === 'unknown' ? 'uncertain' : 'not dispatched'));
  assert.equal(p.reloads(), 0); assert.equal(p.sent.length, 0);
  p.refresh(); assert.equal(p.reloads(), 1); assert.equal(p.sent.length, 0);
});
for (const outcome of ['pending', 'dispatched', 'unavailable']) check(() => {
  const p = nativePage(); p.result('first', 0, outcome, inputRunToken);
  assert(p.rows[0].error.hidden); assert.equal(p.rows[0].refresh.hidden, outcome !== 'pending');
  assert(p.rows[0].checkpoint.disabled);
  assert.equal(p.reloads(), outcome === 'dispatched' ? 1 : 0); assert.equal(p.sent.length, 0);
});
for (const [index, outcome] of [[0, 'password=not-real'], [0.5, 'unknown'], ['0', 'rejected']]) check(() => {
  const p = nativePage(); p.result('first', index, outcome);
  assert.equal(p.status.textContent, ''); assert(p.rows[0].error.hidden);
});
check(()=>{const p=nativePage();p.result('missing',0,'dispatched');assert.equal(p.reloads(),0);});
check(()=>{const p=nativePage();p.result('first',0,'dispatched');assert.equal(p.reloads(),1);
  assert.equal(p.rows[0].card.dataset.tahaiRunToken,inputRunToken);assert(p.rows[0].checkpoint.disabled);});
for(const [allowed,mutate] of [[true,()=>{}],[false,p=>p.rows[0].button.isConnected=false],[false,p=>p.rows[0].card.isConnected=false],
    [false,p=>p.rows[0].card.dataset.tahaiRunToken=''],[false,p=>p.rows[0].card.dataset.tahaiMissionId='wrong'],
    [false,p=>p.rows[0].button.dataset.tahaiStepIndex='01']])check(()=>{
  const p=nativePage();p.rows[0].button.dataset.tahaiMissionId=p.rows[0].card.dataset.tahaiMissionId=inputRunId;mutate(p);p.run();
  assert.equal(p.sent.length,allowed?1:0);
  if(allowed)assert.deepEqual(p.sent,[{name:'runTahaiNativeWorkflowStep',args:[inputRunId,0,inputRunToken]}]);
});
check(()=>{const p=nativePage();p.rows[0].button.dataset.tahaiMissionId=p.rows[0].card.dataset.tahaiMissionId=inputRunId;p.run(false);assert.equal(p.sent.length,0);});
const checklistScript = source.match(/constexpr char kMissionChecklistJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
assert(checklistScript);
const checklistPage = () => {
  const sent=[],status={textContent:''};let callback;
  const context={window:{},document:{querySelector:()=>status,addEventListener:(_type,fn)=>{callback=fn;}},chrome:{send:(name,args)=>sent.push({name,args:Array.from(args)})}};
  vm.runInNewContext(checklistScript,context,{timeout:1000});
  return {sent,status,context,click:(action,overrides={})=>{
    let stopped=false;const control={isConnected:true,disabled:false,dataset:{...waitData(),tahaiMissionAction:action},...overrides};
    callback({target:{closest:()=>control},stopImmediatePropagation:()=>{stopped=true;}});return stopped;
  }};
};
for(const [action,message] of [['toggle-step','toggleTahaiMissionStep'],['toggle-validation','toggleTahaiValidationStep'],['toggle-rollback','toggleTahaiRollbackStep']])check(()=>{
  const p=checklistPage();assert(p.click(action));assert.deepEqual(p.sent,[{name:message,args:[waitData().tahaiMissionId,1,waitData().tahaiRunToken]}]);
  p.context.window.tahaiMissionControlRejected();assert(p.status.textContent.includes('Reload'));assert.equal(p.sent.length,1);
});
for(const overrides of [{disabled:true},{isConnected:false},
    ...['','01','-1','32','1e0','NaN','0.5'].map(index=>({dataset:{...waitData(),tahaiMissionAction:'toggle-step',tahaiStepIndex:index}})),
    ...['tahaiMissionId','tahaiRunToken'].map(key=>({dataset:{...waitData(),tahaiMissionAction:'toggle-validation',[key]:'bad'}}))])check(()=>{
  const p=checklistPage();assert(p.click('toggle-step',overrides));assert.equal(p.sent.length,0);
});
check(()=>{const p=checklistPage();assert(!p.click('delete'));assert.equal(p.sent.length,0);});
for(const state of ['running','paused','succeeded','failed','cancelled'])check(()=>{
  const p=assignmentPage('[data-tahai-workflow-state]');p.click({dataset:{...waitData(),tahaiWorkflowState:state}});
  assert.deepEqual(p.sent,[{name:'setTahaiOperationalWorkflowState',args:[waitData().tahaiMissionId,state,waitData().tahaiRunToken]}]);
});
for(const overrides of [{disabled:true},{isConnected:false},
    ...['','ready','auto','__proto__'].map(state=>({dataset:{...waitData(),tahaiWorkflowState:state}})),
    ...['tahaiMissionId','tahaiRunToken'].map(key=>({dataset:{...waitData(),tahaiWorkflowState:'running',[key]:'bad'}}))])check(()=>{
  const p=assignmentPage('[data-tahai-workflow-state]');p.click({dataset:{...waitData(),tahaiWorkflowState:'running'},...overrides});assert.equal(p.sent.length,0);
});
const metadataScript=source.match(/constexpr char kMissionMetadataJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];assert(metadataScript);
const metadataPage=(action='archive')=>{
  const callbacks=new Map(),sent=[],status={textContent:''};let confirmed=true,confirmations=0;
  const input={isConnected:true,value:'local note'},card={isConnected:true,dataset:{tahaiMissionId:waitData().tahaiMissionId,tahaiRunToken:waitData().tahaiRunToken},contains:item=>item===input};
  const control={isConnected:true,disabled:false,value:'internal',dataset:{tahaiMissionId:waitData().tahaiMissionId,tahaiMissionAction:action,tahaiNoteInput:'note'},closest:()=>card};
  const context={TextEncoder,window:{confirm:()=>{++confirmations;return confirmed;}},document:{querySelector:()=>status,getElementById:id=>id==='note'?input:null,
    addEventListener:(type,callback)=>callbacks.set(type,callback)},chrome:{send:(name,args)=>sent.push({name,args:Array.from(args)})}};
  vm.runInNewContext(metadataScript,context,{timeout:1000});
  return{sent,status,input,card,control,confirmations:()=>confirmations,confirm:value=>{confirmed=value;},dispatch:(type='click')=>{
    let stopped=false;callbacks.get(type)({target:{closest:()=>control},stopImmediatePropagation:()=>{stopped=true;}});return stopped;
  }};
};
for(const [action,name] of [['toggle-escalation','toggleTahaiEscalation'],['add-evidence','addTahaiEvidenceMarker'],['add-note','addTahaiMissionNote'],
  ['archive','archiveTahaiMission'],['restore','restoreTahaiMission'],['duplicate','duplicateTahaiMission'],['delete','deleteTahaiMission']])check(()=>{
  const p=metadataPage(action);assert(p.dispatch());assert.deepEqual(p.sent,[{name,args:[waitData().tahaiMissionId,action==='add-note'?'local note':'',waitData().tahaiRunToken]}]);
  assert.equal(p.confirmations(),action==='delete'?1:0);assert(!p.status.textContent.includes('local note'));
});
for(const mutate of [p=>p.control.disabled=true,p=>p.control.isConnected=false,p=>p.card.isConnected=false,
  p=>p.card.dataset.tahaiMissionId='different',p=>p.control.dataset.tahaiMissionId='bad',p=>p.card.dataset.tahaiRunToken='',p=>p.card.dataset.tahaiRunToken='bad'])check(()=>{
  const p=metadataPage();mutate(p);assert(p.dispatch());assert.equal(p.sent.length,0);
});
check(()=>{const p=metadataPage('delete');p.confirm(false);assert(p.dispatch());assert.equal(p.confirmations(),1);assert.equal(p.sent.length,0);});
for(const mutate of [p=>p.input.value='',p=>p.input.value='é'.repeat(257),p=>p.input.isConnected=false,p=>p.card.contains=()=>false,p=>p.control.dataset.tahaiNoteInput='missing'])check(()=>{
  const p=metadataPage('add-note');mutate(p);assert(p.dispatch());assert.equal(p.sent.length,0);
});
check(()=>{const p=metadataPage('add-note');p.input.value='é'.repeat(256);p.dispatch();assert.equal(p.sent.length,1);});
for(const value of ['sanitized-handoff','internal','incident-packet','change-record','itdocs-sync','psa-ticket-note'])check(()=>{
  const p=metadataPage();p.control.value=value;assert(p.dispatch('change'));assert.deepEqual(p.sent,[{name:'setTahaiExportProfile',args:[waitData().tahaiMissionId,value,waitData().tahaiRunToken]}]);
});
for(const value of ['','automatic','__proto__'])check(()=>{const p=metadataPage();p.control.value=value;p.dispatch('change');assert.equal(p.sent.length,0);});
check(()=>{const p=metadataPage('copy-evidence');assert(!p.dispatch());assert.equal(p.sent.length,0);});
// Also parse the actual remaining legacy script: removal of old metadata
// dispatch must not break unrelated export/recipe listener registration.
check(()=>{const legacy=source.match(/constexpr char kMissionJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];assert(legacy);
  vm.runInNewContext(legacy,{window:{},document:{querySelector:()=>null,addEventListener:()=>{}}},{timeout:1000});});
const evidenceScript = source.match(/constexpr char kMissionEvidenceJs\[\] = R"TAHAI\(([\s\S]*?)\)TAHAI";/)?.[1];
assert(evidenceScript);
const evidencePage = () => {
  const sent = [], status = {textContent: ''}; let click;
  const cards = [1, 2].map(index => {
    const id = `00000000-0000-4000-8000-00000000000${index}`, details = {open: false};
    const card = {isConnected: true, dataset: {tahaiMissionId: id}};
    const preview = {textContent: 'initial', hidden: false, closest: selector => selector === 'details' ? details : null};
    const controls = Object.fromEntries(['copy-evidence', 'confirm-evidence', 'cancel-evidence'].map(action => [action,
      {isConnected: true, disabled: false, hidden: action !== 'copy-evidence', dataset: {tahaiMissionAction: action, tahaiMissionId: id},
       closest: selector => selector === '.mission-card' ? card : null}]));
    card.querySelector = selector => selector === '[data-tahai-evidence-preview=true]' ? preview : controls[selector.match(/action=([^\]]+)/)?.[1]];
    return Object.assign(card, {id, details, preview, controls});
  });
  const context = {window: {}, document: {querySelector: () => status, querySelectorAll: () => cards,
    addEventListener: (type, callback) => { assert.equal(type, 'click'); click = callback; }},
    chrome: {send: (name, args) => sent.push({name, args: Array.from(args)})}};
  vm.runInNewContext(evidenceScript, context, {timeout: 1000});
  return {cards, sent, status, window: context.window, click: (index, action) => {
    let stopped = false; click({target: {closest: () => cards[index].controls[action]}, stopImmediatePropagation: () => {stopped = true;}}); return stopped;
  }};
};
check(() => {
  const p = evidencePage(); p.click(1, 'copy-evidence');
  assert.deepEqual(p.sent, [{name: 'copyTahaiEvidencePack', args: [p.cards[1].id]}]);
  p.window.tahaiEvidencePackReviewReady(p.cards[1].id, '<b>literal reviewed text</b>');
  assert.equal(p.cards[0].preview.textContent, 'initial'); assert(p.cards[0].controls['confirm-evidence'].hidden);
  assert.equal(p.cards[1].preview.textContent, '<b>literal reviewed text</b>'); assert(p.cards[1].details.open);
  p.click(1, 'confirm-evidence'); p.click(1, 'confirm-evidence');
  assert.deepEqual(p.sent[1], {name: 'confirmTahaiEvidencePack', args: [p.cards[1].id]}); assert.equal(p.sent.length, 2);
});
check(() => {
  const p = evidencePage(); p.window.tahaiEvidencePackReviewReady(p.cards[0].id, 'first');
  p.window.tahaiEvidencePackReviewReady(p.cards[1].id, 'second'); assert(p.cards[0].controls['confirm-evidence'].hidden);
  p.click(0, 'confirm-evidence'); assert.equal(p.sent.length, 0); p.click(1, 'cancel-evidence');
  assert.deepEqual(p.sent, [{name: 'cancelTahaiEvidencePack', args: []}]);
});
for (const callback of ['tahaiEvidencePackCopied', 'tahaiEvidencePackReviewCancelled', 'tahaiEvidencePackReviewRejected']) check(() => {
  const p = evidencePage(); p.window.tahaiEvidencePackReviewReady(p.cards[1].id, 'review'); p.window[callback]();
  assert(p.cards.every(card => card.controls['confirm-evidence'].hidden && card.controls['cancel-evidence'].hidden));
  p.click(1, 'confirm-evidence'); assert.equal(p.sent.length, 0);
});
for (const mutate of [p => p.cards[1].isConnected = false, p => p.cards[1].controls['copy-evidence'].isConnected = false,
    p => p.cards[1].controls['copy-evidence'].disabled = true, p => p.cards[1].controls['copy-evidence'].hidden = true,
    p => p.cards[1].controls['copy-evidence'].dataset.tahaiMissionId = p.cards[0].id]) check(() => {
  const p = evidencePage(); mutate(p); assert(p.click(1, 'copy-evidence')); assert.equal(p.sent.length, 0);
});
for (const [id, text] of [['missing', 'text'], ['00000000-0000-4000-8000-000000000002', null]]) check(() => {
  const p = evidencePage(); p.window.tahaiEvidencePackReviewReady(p.cards[0].id, 'old'); p.window.tahaiEvidencePackReviewReady(id, text);
  assert(p.cards.every(card => card.controls['confirm-evidence'].hidden));
});
console.log(`${checks} actual Mission input/assignment/wait/native/checklist/state/metadata/evidence event-listener checks passed with DOM/messages doubled; no browser or native encryption executed.`);
