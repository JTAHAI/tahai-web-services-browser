// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_HISTORY_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_HISTORY_H_

namespace tahai {

// Source history only: never retain form/simulation values or intercept their
// native editing shortcuts. Restoring source uses normal validation/autosave.
inline constexpr char kSkinStudioHistoryJs[] = R"TAHAI(
(() => {
  'use strict';
  const source = document.querySelector('#skin-studio-source');
  const status = document.querySelector('#skin-studio-status');
  const undo = document.querySelector('#skin-studio-undo');
  const redo = document.querySelector('#skin-studio-redo');
  if (!source || !status || !undo || !redo) return;
  const maximumEntryBytes = 65536, maximumHistoryBytes = 2 * 1024 * 1024;
  const entry = text => {
    if (text.length > maximumEntryBytes) return null;
    const bytes = new TextEncoder().encode(text).length;
    return bytes <= maximumEntryBytes ? {text, bytes} : null;
  };
  const history = [entry(source.value) || {text: '', bytes: 0}];
  let position = 0, replaying = false;
  const writable = () => !source.readOnly && !source.disabled;
  const unrecorded = () => source.value !== history[position].text;
  const update = () => {
    undo.disabled = !writable() || (!unrecorded() && position === 0);
    redo.disabled = !writable() || unrecorded() || position + 1 >= history.length;
  };
  const record = () => {
    if (replaying || !writable() || !unrecorded()) { update(); return; }
    history.splice(position + 1);
    const next = entry(source.value);
    if (!next) {
      update();
      status.textContent = 'This edit exceeds the draft history byte limit. Undo can restore the last retained edit; the oversized edit is not retained for Redo.';
      return;
    }
    history.push(next);
    let bytes = history.reduce((sum, item) => sum + item.bytes, 0);
    while (history.length > 50 || bytes > maximumHistoryBytes) bytes -= history.shift().bytes;
    position = history.length - 1; update();
  };
  const restore = next => {
    if (!writable() || next < 0 || next >= history.length) return;
    position = next; replaying = true; source.value = history[position].text;
    try { source.dispatchEvent(new Event('input', {bubbles: true})); }
    finally { replaying = false; update(); }
    status.textContent = 'Draft edit restored locally and is being validated before saving.';
  };
  const undoDraft = () => restore(unrecorded() ? position : position - 1);
  const redoDraft = () => { if (!unrecorded()) restore(position + 1); };
  source.addEventListener('input', record);
  undo.addEventListener('click', undoDraft);
  redo.addEventListener('click', redoDraft);
  document.addEventListener('keydown', event => {
    if (!writable() || event.defaultPrevented || event.isComposing || event.altKey ||
        !(event.ctrlKey || event.metaKey)) return;
    // Other text fields (including protected simulation inputs) own their
    // editing history. Do not replace the whole draft when the user edits one.
    const target = event.composedPath?.()[0] || event.target;
    if (target !== source && (target?.isContentEditable ||
        target?.closest?.('input, textarea, select, [contenteditable]'))) return;
    const key = event.key.toLowerCase();
    if (key === 'z') {
      event.preventDefault(); if (event.shiftKey) redoDraft(); else undoDraft();
    } else if (key === 'y') { event.preventDefault(); redoDraft(); }
  });
  update();
})();
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_HISTORY_H_
