// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Executes the shipped history resource with event doubles, not browser UI.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script = fs.readFileSync(new URL('../../chrome/browser/ui/webui/tahai/tahai_skin_studio_history.h', import.meta.url), 'utf8').match(/R"TAHAI\(([\s\S]*?)\)TAHAI"/)[1];
class Target {
  constructor(tag='button') { this.tag=tag; this.value=''; this.listeners=new Map(); }
  addEventListener(type, fn) { if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn); }
  dispatchEvent(event) { for(const fn of this.listeners.get(event.type)||[])fn(event); }
  closest() { return ['input','textarea','select'].includes(this.tag)||this.editableParent?this:null; }
  click() { if(!this.disabled)this.dispatchEvent({type:'click'}); }
}
const setup = (initial='original') => {
  const source=new Target('textarea'), status=new Target('p'), undo=new Target(), redo=new Target(), document=new Target('document');
  source.value=initial;
  const nodes={'source':source,'status':status,'undo':undo,'redo':redo};
  document.querySelector=selector=>nodes[selector.replace('#skin-studio-','')];
  vm.runInNewContext(script,{document,Event,TextEncoder},{timeout:1000});
  let inputEvents=0;source.addEventListener('input',()=>++inputEvents);
  const edit=text=>{source.value=text;source.dispatchEvent({type:'input'});};
  const key=(target=source,options={})=>{
    const event={type:'keydown',key:'z',ctrlKey:true,target,defaultPrevented:false,
      preventDefault(){this.defaultPrevented=true},...options};
    document.dispatchEvent(event);return event;
  };
  return {source,status,undo,redo,edit,key,inputEvents:()=>inputEvents};
};
let checks=0;
const check=fn=>{fn();++checks;};
check(()=>{
  const h=setup();assert(h.undo.disabled&&h.redo.disabled);
  h.edit('first');h.edit('second');h.undo.click();assert.equal(h.source.value,'first');
  h.redo.click();assert.equal(h.source.value,'second');assert.equal(h.inputEvents(),4);
  h.undo.click();h.edit('replacement');assert(h.redo.disabled);
  h.undo.click();assert.equal(h.source.value,'first');
});
for(const tag of ['input','textarea','select','contenteditable','nested-editable'])for(const shortcut of [
  {key:'z'},{key:'Z',shiftKey:true},{key:'y'},{key:'z',ctrlKey:false,metaKey:true}])check(()=>{
  const h=setup();h.edit('changed');const target=new Target(tag);
  target.value='simulation-private-sentinel';target.isContentEditable=tag==='contenteditable';target.editableParent=tag==='nested-editable';
  const event=h.key(target,shortcut);assert(!event.defaultPrevented);assert.equal(h.source.value,'changed');
  assert.equal(target.value,'simulation-private-sentinel');assert.equal(h.inputEvents(),1);
});
check(()=>{
  const h=setup();h.edit('changed');
  assert(!h.key(new Target(),{composedPath:()=>[new Target('input')]}).defaultPrevented);
  assert.equal(h.source.value,'changed');
});
for(const option of [{defaultPrevented:true},{isComposing:true},{altKey:true},{ctrlKey:false},{key:'x'}])check(()=>{
  const h=setup();h.edit('changed');h.key(h.source,option);assert.equal(h.source.value,'changed');
});
check(()=>{
  const h=setup();h.edit('changed');assert(h.key().defaultPrevented);assert.equal(h.source.value,'original');
  assert(h.key(h.source,{shiftKey:true}).defaultPrevented);assert.equal(h.source.value,'changed');
  h.key(new Target());assert.equal(h.source.value,'original');
  h.key(h.source,{key:'y'});assert.equal(h.source.value,'changed');
});
check(()=>{
  const h=setup();for(let i=0;i<60;++i)h.edit('edit-'+i);
  let count=0;while(!h.undo.disabled){h.undo.click();++count;assert(count<=50);}
  assert.equal(count,49);assert.equal(h.source.value,'edit-10');
});
check(()=>{
  const h=setup('');for(let i=0;i<48;++i)h.edit('x'.repeat(50000)+String(i).padStart(2,'0'));
  let count=0;while(!h.undo.disabled){h.undo.click();++count;assert(count<=41);}
  assert.equal(count,40);assert(h.source.value.endsWith('07'));
});
for(const oversized of ['x'.repeat(65537),'é'.repeat(32769)])check(()=>{
  const h=setup();h.edit('first');h.edit('second');h.undo.click();h.edit(oversized);
  assert(h.status.textContent.includes('not retained for Redo'));assert(!h.undo.disabled&&h.redo.disabled);
  h.undo.click();assert.equal(h.source.value,'first');assert(h.redo.disabled);
  h.undo.click();assert.equal(h.source.value,'original');
});
check(()=>{
  const h=setup();h.edit('{');h.undo.click();assert.equal(h.source.value,'original');
  h.redo.click();assert.equal(h.source.value,'{');
});
for(const property of ['readOnly','disabled'])check(()=>{
  const h=setup();h.edit('changed');h.source[property]=true;h.source.dispatchEvent({type:'input'});
  assert(h.undo.disabled&&h.redo.disabled);h.undo.dispatchEvent({type:'click'});h.key();
  assert.equal(h.source.value,'changed');h.source[property]=false;h.source.dispatchEvent({type:'input'});
  h.undo.click();assert.equal(h.source.value,'original');
});
console.log(`${checks} actual Studio history event/budget checks passed in a DOM double; no browser or native persistence executed.`);
