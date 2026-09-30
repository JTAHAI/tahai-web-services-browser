// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0
// Executes shipped Studio code with DOM/event doubles, not native persistence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync(new URL('../../chrome/browser/ui/webui/tahai/tahai_skin_studio_editor.h',import.meta.url),'utf8').match(/R"TAHAI\(([\s\S]*?)\)TAHAI"/)[1];
class Element {
  constructor(tag='button'){this.tag=tag;this.value='';this.listeners=new Map();this.children=[];this.isConnected=true;this.properties=new Map();
    this.style={setProperty:(k,v)=>this.properties.set(k,v),removeProperty:k=>{this.properties.delete(k);delete this.style[k]}}}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,[]);this.listeners.get(type).push(fn)}
  dispatchEvent(event){for(const fn of this.listeners.get(event.type)||[])fn(event)}
  append(...nodes){this.children.push(...nodes)}
  after(node){this.afterNode=node}
  setAttribute(name,value){this[name]=value}
  replaceChildren(){const disconnect=node=>{node.isConnected=false;for(const child of node.children)disconnect(child)};this.children.forEach(disconnect);this.children=[]}
  closest(){return ['input','textarea','select'].includes(this.tag)||this.isContentEditable?this:null}
}
const dark={shell_background:'#07050e',toolbar_background:'#090612',toolbar_foreground:'#f6f8ff',tab_background:'#171026',tab_foreground:'#f6f8ff',rail_background:'#100a1b',rail_foreground:'#d9e0f2',accent:'#c4a5ff',panel_background:'#100a1b',panel_foreground:'#f6f8ff'};
function setup(){
  const source=new Element('textarea'),status=new Element('p'),save=new Element(),copy=new Element(),palette=new Element('select'),tokens=new Element('div'),preview=new Element('article'),document=new Element('document');
  const nodes={source,status,save,copy,palette,tokens,preview},sent=[],timers=new Map(),copies=[];
  source.value=JSON.stringify({appearance:{dark_tokens:dark,light_tokens:{...dark}}});palette.value='dark_tokens';
  document.querySelector=s=>nodes[s.replace('#skin-studio-','')];document.createElement=tag=>new Element(tag);
  const window={setTimeout:fn=>{timers.set(1,fn);return 1},clearTimeout:id=>timers.delete(id)};
  vm.runInNewContext(script,{window,document,TextEncoder,Event,chrome:{send:(name,args)=>sent.push({name,args})},navigator:{clipboard:{writeText:text=>new Promise((resolve,reject)=>copies.push({text,resolve,reject}))}}},{timeout:1000});
  const input=token=>tokens.children.find(label=>label.children[0].textContent.startsWith(token.replaceAll('_',' ')))?.children[1];
  const edit=text=>{source.value=text;source.dispatchEvent({type:'input'})};
  const key=(target=source,options={})=>{const event={type:'keydown',key:'s',ctrlKey:true,target,preventDefault(){this.defaultPrevented=true},...options};document.dispatchEvent(event);return event};
  return {...nodes,sent,copies,edit,key,input,paletteStatus:preview.afterNode};
}
let checks=0;const check=async fn=>{await fn();++checks};
await check(()=>{const h=setup();assert.equal(h.tokens.children.length,10);assert.match(h.paletteStatus.textContent,/All four/);h.input('accent').value='#a378f2';h.input('accent').dispatchEvent({type:'input'});assert.equal(JSON.parse(h.source.value).appearance.dark_tokens.accent,'#a378f2')});
await check(()=>{const h=setup(),stale=h.input('accent');h.edit('{');assert.equal(h.tokens.children.length,0);assert.equal(h.preview.properties.size,0);assert.equal(h.preview.style.background,undefined);stale.value='#ffffff';stale.dispatchEvent({type:'input'});assert.equal(h.source.value,'{');assert.match(h.paletteStatus.textContent,/unavailable/)});
for(const name of ['light_tokens','__proto__','constructor'])await check(()=>{const h=setup(),stale=h.input('accent');h.palette.value=name;h.palette.dispatchEvent({type:'change'});const before=h.source.value;stale.value='#ffffff';stale.dispatchEvent({type:'input'});assert.equal(h.source.value,before);if(name!=='light_tokens')assert.equal(h.tokens.children.length,0)});
for(const property of ['readOnly','disabled'])await check(()=>{const h=setup(),stale=h.input('accent'),before=h.source.value;h.source[property]=true;stale.value='#ffffff';stale.dispatchEvent({type:'input'});h.save.dispatchEvent({type:'click'});assert.equal(h.source.value,before);assert.equal(h.sent.length,0)});
await check(()=>{const h=setup(),stale=h.input('accent');h.source.value=JSON.stringify({appearance:{dark_tokens:{...dark,accent:'#ffffff'}}});stale.value='#111111';stale.dispatchEvent({type:'input'});assert.equal(JSON.parse(h.source.value).appearance.dark_tokens.accent,'#ffffff')});
for(const malformed of [[],{...dark,extra:'#ffffff'},{...dark,accent:'red'},{...dark,tab_foreground:null}])await check(()=>{const h=setup();h.edit(JSON.stringify({appearance:{dark_tokens:malformed}}));assert.equal(h.tokens.children.length,0);assert.equal(h.preview.properties.size,0)});
await check(()=>{const h=setup();h.edit(JSON.stringify({appearance:{dark_tokens:{...dark,toolbar_foreground:dark.toolbar_background}}}));assert.match(h.paletteStatus.textContent,/toolbar 1\.00:1/);assert(!h.paletteStatus.textContent.includes('All four'))});
for(const oversized of ['x'.repeat(65537),'é'.repeat(32769)])await check(()=>{const h=setup();h.edit(oversized);h.save.dispatchEvent({type:'click'});h.copy.dispatchEvent({type:'click'});assert.equal(h.sent.length,0);assert.equal(h.copies.length,0);assert.match(h.status.textContent,/size limit/)});
await check(()=>{const h=setup();assert(h.key().defaultPrevented);assert.equal(h.sent.length,1);assert.equal(h.sent[0].name,'saveTahaiSkinStudioDraft')});
for(const options of [{altKey:true},{shiftKey:true},{isComposing:true},{defaultPrevented:true},{ctrlKey:false},{key:'x'}])await check(()=>{const h=setup();h.key(h.source,options);assert.equal(h.sent.length,0)});
for(const tag of ['input','textarea','select'])await check(()=>{const h=setup();assert(!h.key(new Element(tag)).defaultPrevented);assert.equal(h.sent.length,0)});
await check(async()=>{const h=setup();h.copy.dispatchEvent({type:'click'});h.edit('changed');const before=h.status.textContent;h.copies[0].resolve();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.status.textContent,before)});
await check(async()=>{const h=setup();h.copy.dispatchEvent({type:'click'});h.copy.dispatchEvent({type:'click'});h.copies[1].resolve();await new Promise(resolve=>setImmediate(resolve));const before=h.status.textContent;h.copies[0].reject();await new Promise(resolve=>setImmediate(resolve));assert.equal(h.status.textContent,before);assert.match(before,/Source copied/)});
console.log(`${checks} Studio palette/contrast/stale-event/shortcut/clipboard checks passed in DOM doubles; no native save or browser executed.`);
