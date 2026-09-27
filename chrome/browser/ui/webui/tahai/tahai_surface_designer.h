// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SURFACE_DESIGNER_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SURFACE_DESIGNER_H_

namespace tahai {

inline constexpr char kSurfaceDesignerJs[] = R"TAHAI(
(() => {
  'use strict';
  const integer = (n, low, high) => Number.isInteger(n) && n >= low && n <= high;
  const fields = (v, keys) => v && typeof v === 'object' && !Array.isArray(v) &&
      Object.keys(v).length === keys.length && keys.every(key => Object.hasOwn(v, key));
  const roles = ['working', 'reference', 'tasks', 'preview', 'notes'];
  const validate = d => {
    if (!fields(d, ['version', 'nodes', 'rail_dock', 'gap', 'narrow_width', 'short_height', 'keyboard_order']) ||
        d.version !== 1 || !['leading', 'trailing'].includes(d.rail_dock) ||
        !integer(d.gap, 4, 24) || !integer(d.narrow_width, 320, 1600) ||
        !integer(d.short_height, 200, 900) || !Array.isArray(d.nodes) ||
        !integer(d.nodes.length, 1, 7) || !Array.isArray(d.keyboard_order) ||
        !integer(d.keyboard_order.length, 1, 4)) return false;
    const seen = new Set(), panes = new Set();
    const visit = (index, depth) => {
      if (!integer(index, 0, d.nodes.length - 1) || depth > 4 || seen.has(index)) return false;
      seen.add(index);
      const n = d.nodes[index];
      if (n?.kind === 'pane') {
        if (!fields(n, ['kind', 'pane', 'role']) || !integer(n.pane, 0, 3) ||
            !roles.includes(n.role) || panes.has(n.pane)) return false;
        panes.add(n.pane);
        return true;
      }
      return fields(n, ['kind', 'first', 'second', 'percent']) &&
          ['rows', 'columns'].includes(n.kind) && integer(n.percent, 10, 90) &&
          visit(n.first, depth + 1) && visit(n.second, depth + 1);
    };
    return visit(0, 1) && seen.size === d.nodes.length && panes.size === d.keyboard_order.length &&
        new Set(d.keyboard_order).size === panes.size &&
        d.keyboard_order.every(pane => integer(pane, 0, panes.size - 1) && panes.has(pane));
  };
  const geometry = (d, width, height, active) => {
    if (!validate(d) || !integer(width, 0, 100000) || !integer(height, 0, 100000) ||
        !integer(active, 0, d.keyboard_order.length - 1)) return null;
    const minimums = [];
    const measure = index => {
      const n = d.nodes[index];
      if (n.kind === 'pane') return minimums[index] = [96, 64];
      const a = measure(n.first), b = measure(n.second);
      return minimums[index] = n.kind === 'rows' ? [Math.max(a[0], b[0]), a[1] + b[1] + d.gap] :
          [a[0] + b[0] + d.gap, Math.max(a[1], b[1])];
    };
    measure(0);
    const compact = width < Math.max(d.narrow_width, minimums[0][0]) ||
        height < Math.max(d.short_height, minimums[0][1]);
    const panes = [], dividers = [];
    if (compact) {
      if (width && height) panes.push({pane: active, x: 0, y: 0, width, height});
    } else {
      const place = (index, x, y, w, h) => {
        const n = d.nodes[index];
        if (n.kind === 'pane') { panes.push({pane: n.pane, x, y, width: w, height: h}); return; }
        const rows = n.kind === 'rows', axis = rows ? 1 : 0, total = (rows ? h : w) - d.gap;
        const first = Math.max(minimums[n.first][axis],
            Math.min(total - minimums[n.second][axis], Math.floor(total * n.percent / 100)));
        dividers.push({node: index, x: rows ? x : x + first, y: rows ? y + first : y,
                       width: rows ? w : d.gap, height: rows ? d.gap : h});
        place(n.first, x, y, rows ? w : first, rows ? first : h);
        place(n.second, rows ? x : x + first + d.gap, rows ? y + first + d.gap : y,
              rows ? w : total - first, rows ? total - first : h);
      };
      place(0, 0, 0, width, height);
    }
    return {compact, panes, dividers};
  };
  // Pure functions also exercised by the offline regression runner. These do
  // not send messages to the browser; native admission remains authoritative.
  window.tahaiSurfaceDesign = Object.freeze({validate, geometry});
  const source = document.querySelector('#skin-studio-source');
  const anchor = document.querySelector('#skin-studio-layout');
  if (!source || !anchor) return;
  const section = document.createElement('section');
  section.className = 'mode-config-group';
  section.innerHTML = `<h3>Surface canvas</h3>
    <p class="muted">Arrange existing native panes. Roles label panes; they do not read or replace their pages. Content preview sizes are in device-independent pixels.</p>
    <div class="grid">
      <label>Surface <select id="surface-choice"></select></label>
      <label>Template <select id="surface-template"><option value="one">Accessible focus</option><option value="dual">Reference and work</option><option value="tri">Reference, work and tasks</option><option value="quad">Four-pane desk</option></select></label>
      <button class="button" type="button" id="surface-template-use">Use layout template</button>
      <button class="button" type="button" id="surface-tree-reset">Reset draft tree</button>
    </div>
    <div class="grid">
      <label>Rail dock <select id="surface-dock"><option value="leading">Leading edge</option><option value="trailing">Trailing edge</option></select></label>
      <label>Pane gap <input id="surface-gap" type="number" min="4" max="24" step="1"></label>
      <label>Narrow breakpoint <input id="surface-narrow" type="number" min="320" max="1600" step="1"></label>
      <label>Short breakpoint <input id="surface-short" type="number" min="200" max="900" step="1"></label>
      <label>Preview width <input id="surface-width" type="number" min="200" max="3840" value="1280" step="1"></label>
      <label>Preview height <input id="surface-height" type="number" min="150" max="2160" value="720" step="1"></label>
      <label>Active pane <select id="surface-active"></select></label>
    </div>
    <p id="surface-canvas-status" role="status" aria-live="polite"></p>
    <div id="surface-canvas" aria-label="Native pane layout preview" style="position:relative;min-height:120px;border:2px solid currentColor;overflow:hidden"></div>
    <h4>Outline and properties</h4><ol id="surface-outline" class="list"></ol>
    <h4>Keyboard pane order</h4><ol id="surface-order" class="list"></ol>
    <h4>Try in this window</h4><p class="muted">First open the same number of panes using the browser layout controls. A 30-second trial changes only geometry. It does not navigate, run actions, install a skin or grant permissions. Keep explicitly to save the layout; leaving Studio reverts an unkept trial.</p>
    <div class="actions">
      <button class="button" type="button" id="surface-try">Try for 30 seconds</button>
      <button class="button" type="button" id="surface-keep" disabled>Keep window layout</button>
      <button class="button" type="button" id="surface-revert" disabled>Revert trial</button>
      <button class="button" type="button" id="surface-window-reset">Reset window layout</button>
    </div><p id="surface-live-status" role="status" aria-live="polite"></p>`;
  anchor.closest('.mode-config-group').append(section);
  const get = id => section.querySelector('#surface-' + id);
  const writable = () => !source.readOnly && !source.disabled;
  const choose = (select, entries, selected) => {
    select.replaceChildren();
    for (const [value, name] of entries) {
      const option = document.createElement('option'); option.value = String(value); option.textContent = name;
      select.append(option);
    }
    if (entries.some(([value]) => String(value) === String(selected))) select.value = String(selected);
  };
  const state = () => {
    try {
      if (source.value.length > 65536 || new TextEncoder().encode(source.value).length > 65536) return null;
      const parsed = JSON.parse(source.value), surfaces = parsed?.operational?.surfaces;
      if (parsed?.schema_version !== 2 || !Array.isArray(surfaces) || !integer(surfaces.length, 1, 12) ||
          !surfaces.every(s => s && typeof s.id === 'string' && /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(s.id) && ['one', 'dual', 'tri', 'quad'].includes(s.layout)) ||
          new Set(surfaces.map(s=>s.id)).size !== surfaces.length) return null;
      const surface = surfaces.find(s => s.id === get('choice').value) || surfaces[0];
      return {parsed, surfaces, surface};
    } catch { return null; }
  };
  const validDesign = surface => surface && validate(surface.design) &&
      surface.design.keyboard_order.length === ['one', 'dual', 'tri', 'quad'].indexOf(surface.layout) + 1;
  let live = false, poll = 0, trialStarted = 0, serial = 0, activeRequest = 0, expected = null;
  let trialSource = '', trialSurface = '';
  const cancel = () => {
    window.clearInterval(poll); poll = 0;
    if (activeRequest) {
      expected = {id:activeRequest, kind:'cancel'};
      chrome.send('revertTahaiSurface', [activeRequest]);
    }
    activeRequest = 0;
    live = false; get('keep').disabled = get('revert').disabled = true;
  };
  const save = current => {
    const text = JSON.stringify(current.parsed, null, 2);
    if (!writable() || text.length > 65536 || new TextEncoder().encode(text).length > 65536) {
      get('canvas-status').textContent = 'This edit exceeds the Studio source limit. No source was changed.';
      return false;
    }
    cancel();
    source.value = text;
    source.dispatchEvent(new Event('input', {bubbles: true}));
    return true;
  };
  const edit = mutation => {
    const current = state();
    if (!writable() || !validDesign(current?.surface)) return;
    mutation(current.surface.design);
    if (!validate(current.surface.design)) { render(); return; }
    save(current);
  };
  const renderCanvas = () => {
    const current = state(), canvas = get('canvas'); canvas.replaceChildren();
    const width = Number(get('width').value), height = Number(get('height').value);
    if (!validDesign(current?.surface) || !integer(width, 200, 3840) || !integer(height, 150, 2160)) {
      get('canvas-status').textContent = 'Choose a template or enter a valid layout tree and preview size.';
      return;
    }
    const d = current.surface.design, result = geometry(d, width, height, Number(get('active').value));
    if (!result) return;
    canvas.style.aspectRatio = `${width} / ${height}`;
    for (const bounds of result.panes) {
      const pane = document.createElement('div');
      const node = d.nodes.find(n => n.kind === 'pane' && n.pane === bounds.pane);
      pane.textContent = `Pane ${bounds.pane + 1}: ${node.role}`;
      Object.assign(pane.style, {position: 'absolute', boxSizing: 'border-box', overflow: 'hidden',
          border: '1px solid currentColor', padding: '8px', left: `${bounds.x / width * 100}%`,
          top: `${bounds.y / height * 100}%`, width: `${bounds.width / width * 100}%`, height: `${bounds.height / height * 100}%`});
      canvas.append(pane);
    }
    get('canvas-status').textContent = `${width} × ${height}; rail at ${d.rail_dock} edge. ` +
        (result.compact ? 'Compact: only the active pane is shown; all tabs are retained.' : `${result.panes.length} visible native panes.`);
  };
  const render = () => {
    const focusedId = section.contains(document.activeElement) ? document.activeElement.id : '';
    const current = state();
    const snapshot = source.value, surfaceId = current?.surface.id;
    const editFrom = (control, mutation) => {
      if (!control.isConnected || control.disabled || source.value !== snapshot ||
          state()?.surface.id !== surfaceId) return;
      edit(mutation);
    };
    choose(get('choice'), (current?.surfaces || []).map(s => [s.id, s.id]), current?.surface.id);
    const valid = validDesign(current?.surface), d = valid ? current.surface.design : null;
    for (const [id, key] of [['dock', 'rail_dock'], ['gap', 'gap'], ['narrow', 'narrow_width'], ['short', 'short_height']]) {
      get(id).disabled = !writable() || !valid;
      get(id).value = d?.[key] ?? '';
    }
    get('template-use').disabled = !writable() || !current;
    get('tree-reset').disabled = !writable() || !current?.surface.design;
    get('try').disabled = !writable() || !valid;
    get('window-reset').disabled = !writable();
    choose(get('active'), (d?.keyboard_order || []).map(n => [n, `Pane ${n + 1}`]), get('active').value);
    get('outline').replaceChildren(); get('order').replaceChildren();
    for (const [index, node] of (d?.nodes || []).entries()) {
      const row = document.createElement('li'), name = document.createElement('span');
      name.textContent = node.kind === 'pane' ? `Node ${index}: pane ${node.pane + 1}` :
          `Node ${index}: split children ${node.first} / ${node.second}`;
      row.append(name);
      const choice = document.createElement('select');
      choice.id = `surface-node-${index}-kind`;
      choice.setAttribute('aria-label', `Node ${index} ${node.kind === 'pane' ? 'role' : 'direction'}`);
      choose(choice, (node.kind === 'pane' ? roles : ['rows', 'columns']).map(v => [v, v]),
             node.kind === 'pane' ? node.role : node.kind);
      choice.disabled = !writable();
      choice.addEventListener('change', () => editFrom(choice, design => {
        design.nodes[index][node.kind === 'pane' ? 'role' : 'kind'] = choice.value;
      }));
      row.append(choice);
      if (node.kind !== 'pane') {
        const ratio = document.createElement('input');
        ratio.id = `surface-node-${index}-percent`;
        ratio.type = 'number'; ratio.min = '10'; ratio.max = '90'; ratio.step = '1'; ratio.value = node.percent;
        ratio.setAttribute('aria-label', `Node ${index} first child percent`); ratio.disabled = !writable();
        ratio.addEventListener('change', () => editFrom(ratio, design => { design.nodes[index].percent = Number(ratio.value); }));
        const swap = document.createElement('button'); swap.type = 'button'; swap.className = 'chip';
        swap.id = `surface-node-${index}-swap`;
        swap.textContent = 'Swap children'; swap.disabled = !writable();
        swap.addEventListener('click', () => editFrom(swap, design => {
          const n = design.nodes[index]; [n.first, n.second] = [n.second, n.first];
        }));
        row.append(ratio, swap);
      }
      get('outline').append(row);
    }
    for (const [index, pane] of (d?.keyboard_order || []).entries()) {
      const row = document.createElement('li'); row.textContent = `Pane ${pane + 1} `;
      for (const [label, delta] of [['Earlier', -1], ['Later', 1]]) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'chip';
        button.id = `surface-order-${pane}-${delta}`;
        button.textContent = label; button.setAttribute('aria-label', `Move pane ${pane + 1} ${label.toLowerCase()}`);
        button.disabled = !writable() || index + delta < 0 || index + delta >= d.keyboard_order.length;
        button.addEventListener('click', () => {
          editFrom(button, design => { const o = design.keyboard_order; [o[index], o[index + delta]] = [o[index + delta], o[index]]; });
          get('choice').focus();
        });
        row.append(button);
      }
      get('order').append(row);
    }
    renderCanvas();
    if (focusedId) document.getElementById(focusedId)?.focus({preventScroll: true});
  };
  get('template-use').addEventListener('click', () => {
    const current = state(); if (!current || !writable()) return;
    const layout = get('template').value, count = ['one', 'dual', 'tri', 'quad'].indexOf(layout) + 1;
    if (!count) return;
    const nodes = [], order = Array.from({length: count}, (_, i) => i);
    const build = (panes, depth) => {
      const index = nodes.length; nodes.push(null);
      if (panes.length === 1) nodes[index] = {kind: 'pane', pane: panes[0], role: roles[panes[0]]};
      else {
        const half = Math.floor(panes.length / 2), first = build(panes.slice(0, half), depth + 1), second = build(panes.slice(half), depth + 1);
        nodes[index] = {kind: depth % 2 ? 'rows' : 'columns', first, second, percent: 50};
      }
      return index;
    };
    build(order, 0);
    current.surface.layout = layout;
    current.surface.design = {version: 1, nodes, rail_dock: 'leading', gap: 8, narrow_width: 640, short_height: 360, keyboard_order: order};
    save(current);
  });
  get('tree-reset').addEventListener('click', () => {
    const current = state(); if (!current || !writable()) return;
    delete current.surface.design; save(current);
  });
  for (const [id, key] of [['dock', 'rail_dock'], ['gap', 'gap'], ['narrow', 'narrow_width'], ['short', 'short_height']]) {
    get(id).addEventListener('change', () => edit(d => { d[key] = id === 'dock' ? get(id).value : Number(get(id).value); }));
  }
  for (const id of ['width', 'height', 'active']) get(id).addEventListener('change', renderCanvas);
  get('choice').addEventListener('change', () => { cancel(); render(); });
  const requestId = () => {
    if (serial === 2147483647) { get('live-status').textContent = 'Reload Studio before another layout request.'; return 0; }
    return ++serial;
  };
  get('try').addEventListener('click', () => {
    const current = state(); if (!writable() || !validDesign(current?.surface)) return;
    cancel(); const id = requestId(); if (!id) return;
    activeRequest = id; expected = {id,kind:'preview'}; trialSource = source.value; trialSurface = current.surface.id;
    trialStarted = Date.now();
    chrome.send('previewTahaiSurface', [current.surface.design, id]);
  });
  get('keep').addEventListener('click', () => {
    if (!live || !activeRequest || !writable() || source.value !== trialSource || state()?.surface.id !== trialSurface) { cancel(); return; }
    expected = {id:activeRequest,kind:'keep'}; get('keep').disabled = true;
    chrome.send('keepTahaiSurface', [activeRequest]);
  });
  get('revert').addEventListener('click', () => { cancel(); });
  get('window-reset').addEventListener('click', () => {
    if (!writable()) return; cancel(); const id = requestId(); if (!id) return;
    expected = {id,kind:'reset'}; chrome.send('resetTahaiSurface', [id]);
  });
  window.tahaiSurfacePreviewResult = (result, id) => {
    if (!integer(id, 1, 2147483647) || id !== expected?.id) return;
    const allowed = {preview:['previewing','pane-count','rejected','expired'], keep:['kept','expired'],
      cancel:['reverted','expired'], reset:['reset','rejected']};
    if (!allowed[expected.kind].includes(result)) return;
    if (result === 'previewing' && (!writable() || source.value !== trialSource || state()?.surface.id !== trialSurface)) { cancel(); return; }
    const messages = {previewing: 'Trying this layout. Keep it within 30 seconds or it will revert.',
        kept: 'Window layout saved. No tabs, sites or permissions were changed.',
        reverted: 'Trial reverted. The previous layout is restored.', reset: 'Window layout reset; tabs are retained.',
        expired: 'No active trial. It expired, was superseded, or its tab set changed.',
        'pane-count': 'Open the matching number of native panes first. No tabs were created or changed.',
        rejected: 'The layout request was rejected. Select Studio and use its controls again.'};
    live = result === 'previewing';
    if (!live) { activeRequest = 0; expected = null; }
    get('keep').disabled = get('revert').disabled = !live;
    get('live-status').textContent = messages[result] || 'The layout was not changed.';
    if (!live) { window.clearInterval(poll); poll = 0; }
    else if (!poll) poll = window.setInterval(() => {
      if (Date.now() - trialStarted > 32000) { cancel(); get('live-status').textContent = messages.expired; }
      else if (live && expected?.kind === 'preview') chrome.send('getTahaiSurfacePreviewState', [activeRequest]);
    }, 1000);
  };
  source.addEventListener('input', () => { cancel(); render(); });
  window.addEventListener('pagehide', cancel);
  render();
})();
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SURFACE_DESIGNER_H_
