// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_EDITOR_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_EDITOR_H_

namespace tahai {
inline constexpr char kSkinStudioJs[] = R"TAHAI(
(()=>{'use strict';
const source=document.querySelector('#skin-studio-source'),
  status=document.querySelector('#skin-studio-status'),
  save=document.querySelector('#skin-studio-save'),
  copy=document.querySelector('#skin-studio-copy'),
  palette=document.querySelector('#skin-studio-palette'),
  tokens=document.querySelector('#skin-studio-tokens'),
  preview=document.querySelector('#skin-studio-preview');
if(!source||!status)return;
const tokenNames=['shell_background','toolbar_background','toolbar_foreground','tab_background','tab_foreground','rail_background','rail_foreground','accent','panel_background','panel_foreground'];
let timer=0, request=0, pending=null, paletteEpoch=0, copyEpoch=0;
const editable=()=>!source.readOnly&&!source.disabled;
const bounded=text=>text.length<=65536&&new TextEncoder().encode(text).length<=65536;
const draft=()=>{try{if(!bounded(source.value))return null;const value=JSON.parse(source.value);return value&&typeof value==='object'&&!Array.isArray(value)?value:null}catch{return null}};
const submit=()=>{
  window.clearTimeout(timer);
  if(!editable())return;
  if(!bounded(source.value)){pending=null;status.textContent='The source exceeds the Studio size limit. The prior draft was kept.';return}
  // Do not recycle IDs within a document or accept a response for an edit
  // that happened after submission (even if Undo restored identical text).
  if(request===2147483647){status.textContent='Reload Studio before saving again.';return}
  pending={id:++request,text:source.value};
  status.textContent='Validating the local operational-skin source…';
  chrome.send('saveTahaiSkinStudioDraft',[pending.text,pending.id]);
};
const queueSave=()=>{
  pending=null;
  ++copyEpoch;
  window.clearTimeout(timer);
  if(!editable())return;
  status.textContent='Source changed; validation and local save are pending.';
  timer=window.setTimeout(submit,700);
};
const palettes=['dark_tokens','light_tokens','high_contrast_tokens'];
const colorValid=color=>typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color);
const paletteValid=values=>values&&typeof values==='object'&&!Array.isArray(values)&&
    Object.keys(values).length===tokenNames.length&&tokenNames.every(token=>Object.hasOwn(values,token)&&colorValid(values[token]));
const luminance=color=>{
  const channels=[1,3,5].map(index=>parseInt(color.slice(index,index+2),16)/255)
    .map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4);
  return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
};
let paletteStatus=null;
if(preview&&tokens){paletteStatus=document.createElement('p');paletteStatus.className='muted';
  paletteStatus.id='skin-studio-palette-status';paletteStatus.setAttribute('role','status');
  paletteStatus.setAttribute('aria-live','polite');preview.after(paletteStatus)}
const renderPalette=()=>{
  const epoch=++paletteEpoch;
  if(!tokens)return;
  tokens.replaceChildren();
  if(preview){for(const token of tokenNames)preview.style.removeProperty(`--studio-${token}`);
    preview.style.removeProperty('background');preview.style.removeProperty('color')}
  const value=draft(),name=palette?.value||'dark_tokens',values=palettes.includes(name)?value?.appearance?.[name]:null;
  if(!paletteValid(values)){
    if(paletteStatus)paletteStatus.textContent='Preview unavailable: choose a complete palette with ten valid color tokens. The prior draft is not changed.';
    return;
  }
  const snapshot=source.value;
  for(const token of tokenNames){
    const color=values[token],label=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');
    caption.textContent=`${token.replaceAll('_',' ')} · ${color.toLowerCase()}`;
    input.type='color';input.value=color;input.disabled=!editable();
    input.addEventListener('input',()=>{
      // Detached controls, palette switches, and programmatic source changes
      // cannot apply an old color edit to a different declaration.
      if(!editable()||!input.isConnected||epoch!==paletteEpoch||source.value!==snapshot||
          (palette?.value||'dark_tokens')!==name||!colorValid(input.value))return;
      const next=draft();if(!paletteValid(next?.appearance?.[name]))return;
      next.appearance[name][token]=input.value.toLowerCase();
      const text=JSON.stringify(next,null,2);
      if(!bounded(text)){status.textContent='The formatted edit exceeds the Studio size limit. No source was changed.';return}
      source.value=text;source.dispatchEvent(new Event('input',{bubbles:true}));
    });
    label.append(caption,input);tokens.append(label);
    if(preview)preview.style.setProperty(`--studio-${token}`,color);
  }
  if(preview){preview.style.background='linear-gradient(145deg,var(--studio-toolbar_background),var(--studio-panel_background))';preview.style.color='var(--studio-panel_foreground)'}
  if(paletteStatus){
    const pairs=['toolbar','tab','rail','panel'].map(part=>{
      const a=luminance(values[part+'_background']),b=luminance(values[part+'_foreground']);
      return {part,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
    const failed=pairs.filter(pair=>pair.ratio<4.5);
    paletteStatus.textContent=failed.length?'Text contrast below 4.5:1: '+failed.map(pair=>pair.part+' '+pair.ratio.toFixed(2)+':1').join(', ')+'. Adjust these colors before native validation.':
      'All four text pairs meet 4.5:1 contrast. Native validation and package review are still required.';
  }
};
source.addEventListener('input',()=>{renderPalette();queueSave()});
palette?.addEventListener('change',renderPalette);
save?.addEventListener('click',submit);
document.addEventListener('keydown',event=>{
  if(!editable()||event.defaultPrevented||event.isComposing||event.altKey||event.shiftKey||
      !(event.ctrlKey||event.metaKey)||event.key.toLowerCase()!=='s')return;
  const target=event.composedPath?.()[0]||event.target;
  if(target!==source&&(target?.isContentEditable||target?.closest?.('input, textarea, select, [contenteditable]')))return;
  event.preventDefault();submit();
});
copy?.addEventListener('click',async()=>{
  const snapshot=source.value,epoch=++copyEpoch;
  if(!bounded(snapshot)){status.textContent='The source exceeds the Studio copy size limit.';return}
  try{await navigator.clipboard.writeText(snapshot);if(epoch===copyEpoch&&source.value===snapshot)status.textContent='Source copied to the clipboard. No package was created.'}
  catch{if(epoch===copyEpoch&&source.value===snapshot)status.textContent='The browser could not copy this source.'}
});
const messages={
  saved:'Validated and saved only as a profile-local source draft.',
  managed:'This Studio draft is managed and cannot be changed here.',
  unavailable:'This profile cannot retain a Studio draft.',
  'too-large':'The source or its formatted saved representation exceeds the Studio size limit. The prior draft was kept.',
  'invalid-json':'The source is not valid JSON. The prior draft was kept.',
  'invalid-manifest':'The source is not a valid v2 operational-skin declaration. The prior draft was kept.'
};
const diagnostics={
  'root-object':'The source must be one JSON object.',
  'unknown-field':'Remove unsupported declaration fields.',
  schema:'Check schema version and package metadata.',
  appearance:'Check appearance palettes, settings, package metadata, and assets.',
  capabilities:'Check the declared operational capabilities.',
  surface:'Check surface declarations and their component or layout references.',
  workflow:'Check workflow declarations, inputs, steps, and references.',
  mode:'Check mode declarations and their surface, workflow, and action references.'
};
window.tahaiSkinStudioDraftSaved=(result,detail,id)=>{
  if(!pending||id!==pending.id||source.value!==pending.text||!editable())return;
  pending=null;
  let message=Object.hasOwn(messages,result)?messages[result]:'The Studio draft was not saved.';
  if(result==='invalid-json'&&detail?.category==='syntax'&&
      Number.isInteger(detail.line)&&detail.line>0&&detail.line<=65536&&
      Number.isInteger(detail.column)&&detail.column>0&&detail.column<=65536){
    message+=' Check line '+detail.line+', column '+detail.column+'.';
  }else if(result==='invalid-manifest'&&detail&&Object.hasOwn(diagnostics,detail.category)){
    message+=' '+diagnostics[detail.category];
  }
  // Native supplies only fixed categories/positions; never render parser text
  // or source as HTML, including when a message is malformed.
  status.textContent=message;
};
renderPalette();
})();
)TAHAI";
}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_EDITOR_H_
