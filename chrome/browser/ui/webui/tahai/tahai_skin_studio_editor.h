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
let timer=0, request=0, pending=null;
const editable=()=>!source.readOnly&&!source.disabled;
const draft=()=>{try{const value=JSON.parse(source.value);return value&&typeof value==='object'?value:null}catch{return null}};
const submit=()=>{
  window.clearTimeout(timer);
  if(!editable())return;
  // Do not recycle IDs within a document or accept a response for an edit
  // that happened after submission (even if Undo restored identical text).
  if(request===2147483647){status.textContent='Reload Studio before saving again.';return}
  pending={id:++request,text:source.value};
  status.textContent='Validating the local operational-skin source…';
  chrome.send('saveTahaiSkinStudioDraft',[pending.text,pending.id]);
};
const queueSave=()=>{
  pending=null;
  window.clearTimeout(timer);
  if(!editable())return;
  status.textContent='Source changed; validation and local save are pending.';
  timer=window.setTimeout(submit,700);
};
const renderPalette=()=>{if(!tokens)return;tokens.replaceChildren();const value=draft(),name=palette?.value||'dark_tokens',values=value?.appearance?.[name];if(!values||typeof values!=='object'){status.textContent='Source JSON must contain a complete appearance palette before it can be previewed.';return}for(const token of tokenNames){const color=String(values[token]||'');if(!/^#[0-9a-f]{6}$/i.test(color))continue;const label=document.createElement('label'),caption=document.createElement('span'),input=document.createElement('input');caption.textContent=`${token.replaceAll('_',' ')} · ${color.toLowerCase()}`;input.type='color';input.value=color;input.disabled=source.readOnly||source.disabled;input.addEventListener('input',()=>{const next=draft();if(source.readOnly||source.disabled||!next?.appearance?.[name])return;next.appearance[name][token]=input.value.toLowerCase();source.value=JSON.stringify(next,null,2);source.dispatchEvent(new Event('input',{bubbles:true}))});label.append(caption,input);tokens.append(label);if(preview)preview.style.setProperty(`--studio-${token}`,color)}if(preview){preview.style.background=`linear-gradient(145deg,var(--studio-toolbar_background),var(--studio-panel_background))`;preview.style.color='var(--studio-panel_foreground)'}};
source.addEventListener('input',()=>{renderPalette();queueSave()});
palette?.addEventListener('change',renderPalette);
save?.addEventListener('click',submit);
copy?.addEventListener('click',async()=>{
  try{await navigator.clipboard.writeText(source.value);status.textContent='Source copied to the clipboard. No package was created.'}
  catch{status.textContent='The browser could not copy this source.'}
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
