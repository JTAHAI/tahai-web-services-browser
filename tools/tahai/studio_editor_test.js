// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Shipped editor JavaScript, deterministic DOM/timer doubles, not browser tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../../chrome/browser/ui/webui/tahai/tahai_skin_studio_editor.h',import.meta.url),'utf8').match(/R"TAHAI\(([\s\S]*?)\)TAHAI"/)[1];
class Element {
  constructor(){this.listeners=new Map();this.value='';this.textContent='';}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  dispatchEvent(event){this.listeners.get(event.type)?.(event);}
  click(){this.dispatchEvent({type:'click'});}
}
function setup(){
  const source=new Element(),status=new Element(),save=new Element();source.value='original';
  const nodes={source,status,save},timers=new Map(),sent=[];let next=0;
  const window={setTimeout(fn){timers.set(++next,fn);return next},clearTimeout(id){timers.delete(id)}};
  vm.runInNewContext(script,{window,TextEncoder,document:{addEventListener(){},querySelector:s=>nodes[s.replace('#skin-studio-','')]},
    chrome:{send:(name,args)=>sent.push({name,args:Array.from(args)})}},{timeout:1000});
  const edit=text=>{source.value=text;source.dispatchEvent({type:'input'})};
  const flush=()=>{const pending=[...timers.values()];timers.clear();for(const fn of pending)fn()};
  const reply=(result='saved',detail={},id=sent.at(-1)?.args[1])=>window.tahaiSkinStudioDraftSaved(result,detail,id);
  return {source,status,save,edit,flush,reply,sent,timers,deliver:window.tahaiSkinStudioDraftSaved};
}
let checks=0;const check=fn=>{fn();++checks};
check(()=>{const h=setup();h.edit('a');h.edit('b');assert.equal(h.timers.size,1);h.flush();assert.deepEqual(h.sent,[{name:'saveTahaiSkinStudioDraft',args:['b',1]}]);h.reply();assert.match(h.status.textContent,/Validated and saved/)});
check(()=>{const h=setup();h.edit('a');h.save.click();h.flush();assert.equal(h.sent.length,1);h.reply();assert.match(h.status.textContent,/Validated and saved/)});
check(()=>{const h=setup();h.save.click();h.edit('new');const before=h.status.textContent;h.reply();assert.equal(h.status.textContent,before);h.flush();h.reply();assert.match(h.status.textContent,/Validated and saved/)});
check(()=>{const h=setup();h.save.click();h.edit('different');h.edit('original');const before=h.status.textContent;h.reply();assert.equal(h.status.textContent,before)});
check(()=>{const h=setup();h.save.click();h.source.value='programmatic';const before=h.status.textContent;h.reply();assert.equal(h.status.textContent,before)});
check(()=>{const h=setup();h.save.click();h.save.click();const before=h.status.textContent;h.reply('saved',{},1);assert.equal(h.status.textContent,before);h.reply('invalid-json',{category:'syntax',line:2,column:5},2);assert.match(h.status.textContent,/line 2, column 5/);h.reply('saved',{},2);assert.match(h.status.textContent,/line 2, column 5/)});
for(const property of ['readOnly','disabled'])check(()=>{const h=setup();h.save.click();h.source[property]=true;h.edit('blocked');h.save.click();h.flush();assert.equal(h.sent.length,1);const before=h.status.textContent;h.reply();assert.equal(h.status.textContent,before)});
for(const id of [undefined,0,-1,1.5,'1',2147483648])check(()=>{const h=setup();h.save.click();const before=h.status.textContent;
  h.deliver('saved',{},id);assert.equal(h.status.textContent,before)});
for(const category of ['root-object','unknown-field','schema','appearance','capabilities','surface','workflow','mode'])check(()=>{const h=setup();h.save.click();h.reply('invalid-manifest',{category,message:'private-sentinel'});assert.match(h.status.textContent,/prior draft was kept/);assert(!h.status.textContent.includes('private-sentinel'));assert(h.status.textContent.length>105)});
for(const detail of [{category:'syntax',line:0,column:1},{category:'syntax',line:2,column:0},{category:'syntax',line:65537,column:1},{category:'syntax',line:1,column:65537},{category:'syntax',line:'2',column:3},{category:'syntax',line:1.5,column:3},{category:'<img src=x>',line:1,column:1}])check(()=>{const h=setup();h.save.click();h.reply('invalid-json',detail);assert(!h.status.textContent.includes('Check line'));assert(!h.status.textContent.includes('<img'))});
for(const category of ['__proto__','constructor','<img src=x>'])check(()=>{const h=setup();h.save.click();h.reply('invalid-manifest',{category});assert.equal(h.status.textContent,'The source is not a valid v2 operational-skin declaration. The prior draft was kept.')});
for(const result of ['__proto__','constructor','<img src=x>'])check(()=>{const h=setup();h.save.click();h.reply(result);assert.equal(h.status.textContent,'The Studio draft was not saved.')});
console.log(`${checks} Studio editor response/diagnostic checks passed in DOM/timer doubles; no native save or browser executed.`);
