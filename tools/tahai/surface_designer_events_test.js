// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Actual shipped listeners in DOM/timer doubles; not native layout evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script = fs.readFileSync(new URL('../../chrome/browser/ui/webui/tahai/tahai_surface_designer.h',import.meta.url),'utf8').match(/R"TAHAI\(([\s\S]*?)\)TAHAI"/)[1];
const fixture = JSON.parse(fs.readFileSync(new URL('../../docs/tahai-skins/operational-skin-v2.example.json',import.meta.url),'utf8'));
class Element {
  constructor(tag){this.tagName=tag;this.children=[];this.parentElement=null;this.listeners=new Map();this.dataset={};this.style={};this._text='';this._value=undefined;this.disabled=false;this.readOnly=false;}
  get isConnected(){return this.tagName==='body'||Boolean(this.parentElement?.isConnected)}
  get options(){return this.children.filter(c=>c.tagName==='option')}
  get value(){return this.tagName==='select' ? this._value===undefined ? this.options[0]?.value||'' : this.options.some(c=>c.value===this._value)?this._value:'' : this._value||''}
  set value(value){this._value=String(value)}
  get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}
  set textContent(value){this.replaceChildren();this._text=String(value)}
  remove(){if(this.parentElement){this.parentElement.children.splice(this.parentElement.children.indexOf(this),1);this.parentElement=null}}
  append(...items){for(const item of items){item.remove();this.children.push(item);item.parentElement=this}}
  replaceChildren(...items){for(const item of this.children)item.parentElement=null;this.children=[];this._text='';if(this.tagName==='select')this._value=undefined;this.append(...items)}
  find(fn){if(fn(this))return this;for(const child of this.children){const result=child.find(fn);if(result)return result}return null}
  querySelector(selector){assert(selector.startsWith('#'));return this.find(node=>node.id===selector.slice(1))}
  contains(node){return Boolean(node&&this.find(item=>item===node))}
  closest(selector){assert.equal(selector,'.mode-config-group');for(let node=this;node;node=node.parentElement)if(node.className==='mode-config-group')return node;return null}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn)}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event)}
  click(){if(!this.disabled)this.dispatchEvent(new Event('click'))}
  focus(){this.focused=true}
  setAttribute(name,value){this[name]=String(value)}
  set innerHTML(html){
    this.replaceChildren();const stack=[this],voids=new Set(['input','br']);
    for(const token of html.match(/<[^>]*>|[^<]+/g)||[]){
      if(token.startsWith('</')){stack.pop();continue}
      if(!token.startsWith('<')){stack.at(-1)._text+=token;continue}
      const tag=token.match(/^<([a-z0-9-]+)/)[1],child=new Element(tag);
      for(const match of token.matchAll(/([a-z-]+)="([^"]*)"/g))if(match[1]!=='style')child[match[1]]=match[2];
      if(/\sdisabled(?:\s|>)/.test(token))child.disabled=true;
      stack.at(-1).append(child);if(!voids.has(tag))stack.push(child);
    }
    assert.equal(stack.length,1);
  }
}
const design=()=>({version:1,rail_dock:'leading',gap:8,narrow_width:640,short_height:360,keyboard_order:[0,1],
  nodes:[{kind:'columns',first:1,second:2,percent:50},{kind:'pane',pane:0,role:'working'},{kind:'pane',pane:1,role:'reference'}]});
function setup(){
  const body=new Element('body'),source=new Element('textarea'),group=new Element('section'),anchor=new Element('select');
  group.className='mode-config-group';source.id='skin-studio-source';anchor.id='skin-studio-layout';group.append(anchor);body.append(source,group);
  const doc=structuredClone(fixture);doc.operational.surfaces=[{...doc.operational.surfaces[0],id:'first-surface',layout:'dual',design:design()},
    {...doc.operational.surfaces[0],id:'second-surface',layout:'dual',design:design()}];
  source.value=JSON.stringify(doc);
  const messages=[],timers=new Map(),events=new Map();let timer=0,now=10000;
  const window={clearInterval:id=>timers.delete(id),setInterval:fn=>{timers.set(++timer,fn);return timer},addEventListener:(type,fn)=>events.set(type,fn)};
  const document={querySelector:id=>body.querySelector(id),createElement:tag=>new Element(tag),getElementById:id=>body.querySelector('#'+id)};
  vm.runInNewContext(script,{window,document,Event,TextEncoder,Date:{now:()=>now},chrome:{send:(name,args)=>messages.push({name,args:JSON.parse(JSON.stringify(args))})}},{timeout:1000});
  const get=id=>document.getElementById('surface-'+id),change=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new Event('change'))};
  const parsed=()=>JSON.parse(source.value),edit=doc=>{source.value=JSON.stringify(doc);source.dispatchEvent(new Event('input'))};
  const reply=(result,id)=>window.tahaiSurfacePreviewResult(result,id);
  const trial=()=>{get('try').click();return messages.at(-1).args[1]};
  return {source,get,change,parsed,edit,messages,reply,trial,timers,events,advance:ms=>{now+=ms;for(const fn of [...timers.values()])fn()}};
}
let checks=0;const check=fn=>{fn();++checks};
check(()=>{const h=setup();h.change('node-0-percent','35');assert.equal(h.parsed().operational.surfaces[0].design.nodes[0].percent,35);assert.equal(h.messages.length,0)});
check(()=>{const h=setup(),stale=h.get('node-0-percent');h.change('choice','second-surface');const before=h.source.value;stale.value='20';stale.dispatchEvent(new Event('change'));assert.equal(h.source.value,before);h.change('node-0-percent','65');assert.equal(h.parsed().operational.surfaces[1].design.nodes[0].percent,65);assert.equal(h.parsed().operational.surfaces[0].design.nodes[0].percent,50)});
for(const control of ['node-0-kind','node-0-percent','node-0-swap','order-0-1'])check(()=>{
  const h=setup(),stale=h.get(control);h.change('template','one');h.get('template-use').click();const before=h.source.value;
  stale.value='30';stale.dispatchEvent(new Event(control.endsWith('swap')||control.startsWith('order')?'click':'change'));assert.equal(h.source.value,before);
});
check(()=>{const h=setup(),stale=h.get('node-0-swap');h.source.value+=' ';const before=h.source.value;stale.click();assert.equal(h.source.value,before);h.source.dispatchEvent(new Event('input'));stale.click();assert.equal(h.source.value,before)});
check(()=>{const h=setup();h.get('order-0-1').click();assert.deepEqual(h.parsed().operational.surfaces[0].design.keyboard_order,[1,0]);const before=h.source.value;h.get('order-0-1').dispatchEvent(new Event('click'));assert.equal(h.source.value,before)});
for(const property of ['readOnly','disabled'])check(()=>{
  const h=setup(),before=h.source.value;h.source[property]=true;h.get('node-0-swap').dispatchEvent(new Event('click'));h.get('try').dispatchEvent(new Event('click'));h.get('window-reset').dispatchEvent(new Event('click'));assert.equal(h.source.value,before);assert.equal(h.messages.length,0);
});
check(()=>{const h=setup(),doc=h.parsed();doc.operational.surfaces[1].id='first-surface';h.edit(doc);assert(h.get('try').disabled);assert(h.get('template-use').disabled);assert.equal(h.get('outline').children.length,0)});
check(()=>{const h=setup();h.source.value='{';h.source.dispatchEvent(new Event('input'));assert(h.get('try').disabled);h.get('try').dispatchEvent(new Event('click'));assert.equal(h.messages.length,0)});
check(()=>{const h=setup(),doc=h.parsed();doc.padding='x'.repeat(65000);h.edit(doc);assert(h.get('try').disabled);h.get('template-use').dispatchEvent(new Event('click'));assert.equal(h.source.value,JSON.stringify(doc))});
check(()=>{const h=setup(),doc=h.parsed();doc.padding='\u20ac'.repeat(25000);h.edit(doc);assert(h.source.value.length<65536);assert(h.get('try').disabled);h.get('try').dispatchEvent(new Event('click'));assert.equal(h.messages.length,0)});
check(()=>{const h=setup(),doc=h.parsed();const bytes=JSON.stringify(doc).length;doc.padding='x'.repeat(65000-bytes);h.edit(doc);assert(!h.get('try').disabled);const before=h.source.value;h.get('node-0-swap').click();assert.equal(h.source.value,before);assert(h.get('canvas-status').textContent.includes('source limit'))});
check(()=>{const h=setup(),id=h.trial();assert.equal(id,1);assert(h.get('keep').disabled);h.reply('previewing',id);assert(!h.get('keep').disabled);h.get('keep').click();assert.deepEqual(h.messages.at(-1),{name:'keepTahaiSurface',args:[id]});h.reply('previewing',id);assert(h.get('keep').disabled);h.reply('kept',id);assert(h.get('live-status').textContent.includes('saved'));h.reply('previewing',id);assert(h.get('keep').disabled)});
check(()=>{const h=setup(),id=h.trial();h.change('gap','12');assert.deepEqual(h.messages.at(-1),{name:'revertTahaiSurface',args:[id]});h.reply('previewing',id);assert(h.get('keep').disabled);assert.equal(h.timers.size,0);h.reply('reverted',id);assert(h.get('live-status').textContent.includes('restored'))});
check(()=>{const h=setup(),old=h.trial(),id=h.trial();assert.equal(id,2);assert.deepEqual(h.messages.at(-2),{name:'revertTahaiSurface',args:[old]});h.reply('previewing',old);assert(h.get('keep').disabled);h.reply('previewing',id);assert(!h.get('keep').disabled);h.reply('reverted',old);assert(!h.get('keep').disabled);h.advance(1000);assert.deepEqual(h.messages.at(-1),{name:'getTahaiSurfacePreviewState',args:[id]})});
check(()=>{const h=setup(),id=h.trial();h.reply('previewing',id);h.change('choice','second-surface');assert(h.get('keep').disabled);assert.deepEqual(h.messages.at(-1),{name:'revertTahaiSurface',args:[id]});h.reply('previewing',id);assert(h.get('keep').disabled)});
check(()=>{const h=setup(),id=h.trial();h.source.value+=' ';h.reply('previewing',id);assert(h.get('keep').disabled);assert.deepEqual(h.messages.at(-1),{name:'revertTahaiSurface',args:[id]})});
check(()=>{const h=setup(),id=h.trial();h.reply('previewing',id);h.source.readOnly=true;h.get('keep').click();assert.deepEqual(h.messages.at(-1),{name:'revertTahaiSurface',args:[id]});assert(!h.messages.some(m=>m.name==='keepTahaiSurface'))});
check(()=>{const h=setup(),id=h.trial();h.reply('previewing',id);h.get('revert').click();assert(h.get('keep').disabled);h.reply('reverted',id);assert.equal(h.timers.size,0)});
check(()=>{const h=setup(),id=h.trial();h.reply('previewing',id);h.advance(33000);assert.deepEqual(h.messages.at(-1),{name:'revertTahaiSurface',args:[id]});assert(h.get('keep').disabled);assert(h.get('live-status').textContent.includes('expired'))});
check(()=>{const h=setup(),id=h.trial();h.events.get('pagehide')();assert.deepEqual(h.messages.at(-1),{name:'revertTahaiSurface',args:[id]});h.reply('previewing',id);assert(h.get('keep').disabled)});
check(()=>{const h=setup(),id=h.trial();h.get('window-reset').click();assert.deepEqual(h.messages.at(-1),{name:'resetTahaiSurface',args:[2]});h.reply('previewing',id);assert(h.get('keep').disabled);h.reply('reset',2);assert(h.get('live-status').textContent.includes('reset'));h.reply('reverted',id);assert(h.get('live-status').textContent.includes('reset'))});
for(const id of [undefined,0,-1,'1',1.5,2147483648])check(()=>{const h=setup();h.trial();h.reply('previewing',id);assert(h.get('keep').disabled);assert.equal(h.timers.size,0)});
check(()=>{const h=setup(),id=h.trial();h.reply('__proto__',id);assert(h.get('keep').disabled);h.reply('rejected',id);const before=h.get('live-status').textContent;h.reply('previewing',id);assert(h.get('keep').disabled);assert.equal(h.get('live-status').textContent,before)});
console.log(`${checks} surface-editor source/preview checks passed in DOM/timer doubles; no browser or native layout executed.`);
