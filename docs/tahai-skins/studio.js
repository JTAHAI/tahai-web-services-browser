// Copyright 2026 TAHAI Web Services. SPDX-License-Identifier: Apache-2.0
'use strict';
const manifest = structuredClone(window.tahaiStarter.manifest);
const byId = id => document.getElementById(id);
const paletteNames = ['light_tokens', 'dark_tokens', 'high_contrast_tokens'];
const reserved = new Set(['stock','tahai-neon','tahai-sentinel','terminal-green','bare-metal','glass-command','classic-amp-inspired','midnight-operations','high-contrast-operator']);
const labels = {shell_background:'Window frame',toolbar_background:'Toolbar background',toolbar_foreground:'Toolbar text',tab_background:'Tab background',tab_foreground:'Tab text',rail_background:'Rail background',rail_foreground:'Rail text',accent:'Accent',panel_background:'Panel background',panel_foreground:'Panel text'};
function luminance(hex) {
  return [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255)
    .map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4)
    .reduce((sum,x,i) => sum+x*[.2126,.7152,.0722][i],0);
}
function contrastErrors() {
  const errors = [];
  for (const name of paletteNames) for (const surface of ['toolbar','tab','rail','panel']) {
    const palette = manifest.appearance[name];
    const values = ['background','foreground'].map(role => luminance(palette[`${surface}_${role}`])).sort((a,b)=>a-b);
    const ratio = (values[1]+.05)/(values[0]+.05);
    if (ratio < 4.5) errors.push(`${name.replace('_tokens','').replaceAll('_',' ')} ${surface}: ${ratio.toFixed(2)}:1`);
  }
  return errors;
}
function updatePreview() {
  const palette = manifest.appearance[byId('palette').value];
  for (const [token, value] of Object.entries(palette)) byId('preview').style.setProperty(`--${token}`,value);
  const errors = contrastErrors();
  byId('contrast').textContent = errors.length ? `Increase text contrast to at least 4.5:1. ${errors.join('; ')}` : 'All three palettes meet 4.5:1 text contrast.';
  byId('download').disabled = !!errors.length;
}
function showPalette() {
  const palette = manifest.appearance[byId('palette').value];
  byId('tokens').replaceChildren();
  for (const [token,value] of Object.entries(palette)) {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    caption.textContent = `${labels[token]} · ${value}`;
    const input = document.createElement('input');
    input.type = 'color'; input.value = value;
    input.addEventListener('input', () => {
      palette[token] = input.value.toLowerCase();
      caption.textContent = `${labels[token]} · ${palette[token]}`;
      updatePreview();
    });
    label.append(caption,input); byId('tokens').append(label);
  }
  updatePreview();
}
const encoder = new TextEncoder();
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1)?0xedb88320:0);
  }
  return (crc^0xffffffff)>>>0;
}
function header(size) {
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer);
  return {bytes, short:(offset,value)=>view.setUint16(offset,value,true), long:(offset,value)=>view.setUint32(offset,value,true)};
}
// Fixed names, stored files only, no directory entries, extras, comments or
// platform attributes. Chromium's sandbox independently checks the download.
function archive(entries) {
  const local=[], central=[]; let offset=0, centralSize=0;
  for (const [path,bytes] of entries) {
    const name=encoder.encode(path), crc=crc32(bytes), h=header(30), c=header(46);
    h.long(0,0x04034b50); h.short(4,20); h.short(12,23585);
    h.long(14,crc); h.long(18,bytes.length); h.long(22,bytes.length); h.short(26,name.length);
    c.long(0,0x02014b50); c.short(4,20); c.short(6,20); c.short(14,23585);
    c.long(16,crc); c.long(20,bytes.length); c.long(24,bytes.length); c.short(28,name.length); c.long(42,offset);
    local.push(h.bytes,name,bytes); central.push(c.bytes,name);
    offset += h.bytes.length+name.length+bytes.length; centralSize += c.bytes.length+name.length;
  }
  const end=header(22); end.long(0,0x06054b50); end.short(8,entries.length); end.short(10,entries.length);
  end.long(12,centralSize); end.long(16,offset);
  return new Blob([...local,...central,end.bytes],{type:'application/octet-stream'});
}
byId('palette').addEventListener('change',showPalette);
byId('studio').addEventListener('submit',async event => {
  event.preventDefault();
  if (!byId('studio').reportValidity() || contrastErrors().length) return;
  const button=byId('download'); button.disabled=true;
  try {
    manifest.id=byId('identity-value').value;
    if (reserved.has(manifest.id)) throw new Error('Choose your own unique ID; this ID belongs to an included browser palette.');
    for (const field of ['name','creator','license']) {
      const value=byId(field).value.trim();
      if (!value || value.length>128 || /[^\x20-\x7e]|[\\"<>]/.test(value)) throw new Error(`${field}: use plain text without quotes, backslashes or markup.`);
      manifest[field]=value;
    }
    manifest.appearance.density=byId('density').value;
    manifest.appearance.reduced_motion=byId('motion').checked;
    const preview=Uint8Array.from(atob(window.tahaiStarter.png),c=>c.charCodeAt(0));
    const hash=await crypto.subtle.digest('SHA-256',preview);
    manifest.assets[0].sha256=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
    const blob=archive([['manifest.json',encoder.encode(JSON.stringify(manifest,null,2)+'\n')],['assets/preview.png',preview]]);
    const url=URL.createObjectURL(blob), link=document.createElement('a');
    link.href=url; link.download=`${manifest.id}.tahaiskin`; document.body.append(link); link.click(); link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    byId('status').textContent='Skin created. Review the download in TAHAI Skin packages, try it, then install and apply it.';
  } catch(error) { byId('status').textContent=error.message; }
  finally { updatePreview(); }
});
showPalette();
