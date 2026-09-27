// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_OUTLINE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_OUTLINE_H_

namespace tahai {

inline constexpr char kSkinStudioWorkflowOutlineCss[] = R"TAHAI(
.studio-flow{list-style:none;padding:0;display:grid;gap:0;max-width:70rem}
.studio-flow>li{min-width:0;border-inline-start:2px solid currentColor;padding:0 0 1rem 1rem}
.studio-flow-card{border:1px solid currentColor;border-radius:.75rem;padding:1rem;overflow-wrap:anywhere}
.studio-flow-card[data-selected="true"]{outline:2px solid var(--accent,currentColor);outline-offset:2px}
.studio-flow-card button{white-space:normal;text-align:start;max-width:100%}
.studio-flow-detail{margin:.5rem 0;white-space:pre-wrap}
.studio-flow-branch{border-inline-start:2px dashed currentColor;padding-inline-start:.75rem}
.studio-flow-next{margin:.5rem 0 0}
@media(max-width:500px){.studio-flow>li{padding-inline-start:.5rem}.studio-flow-card{padding:.5rem}}
@media(forced-colors:active){.studio-flow-card[data-selected="true"]{outline-color:Highlight}}
)TAHAI";

// An outline of the admitted ordered workflow, not an arbitrary executable
// graph. Selection only changes the existing inspector, never source/run state.
inline constexpr char kSkinStudioWorkflowOutlineJs[] = R"TAHAI(
(() => {
  'use strict';
  const source = document.querySelector('#skin-studio-source');
  const inspector = document.querySelector('#skin-studio-condition-step');
  const anchor = document.querySelector('#skin-studio-workflow-steps');
  if (!source || !inspector || !anchor) return;
  const section = document.createElement('section');
  section.className = 'mode-config-group';
  section.innerHTML = `<h3>Workflow outline</h3>
    <p id="skin-studio-flow-help" class="muted">Follow the authored order. Conditions skip only their own step; unresolved values block progress. Repeats have fixed iteration counts. Every action remains explicit. This diagram does not run or edit the workflow. Use Up/Down, Home/End to inspect steps and Enter to focus the step inspector.</p>
    <p id="skin-studio-flow-summary" role="status" aria-live="polite"></p>
    <ol id="skin-studio-flow" class="studio-flow" aria-label="Authored workflow steps" aria-describedby="skin-studio-flow-help"></ol>`;
  anchor.insertAdjacentElement('afterend', section);
  const list = section.querySelector('#skin-studio-flow');
  const summary = section.querySelector('#skin-studio-flow-summary');
  let cards = [];
  const current = () => window.tahaiStudioWorkflows?.current();
  const operators = {equal: 'equals', 'not-equal': 'does not equal', 'less-than': 'is less than',
    'at-most': 'is at most', 'greater-than': 'is greater than', 'at-least': 'is at least'};
  const conditionText = (node, workflow) => {
    if (node.all) return '(' + node.all.map(item => conditionText(item, workflow)).join(' AND ') + ')';
    if (node.any) return '(' + node.any.map(item => conditionText(item, workflow)).join(' OR ') + ')';
    if (node.not) return 'NOT (' + conditionText(node.not, workflow) + ')';
    const definition = (node.variable ? workflow.variables : workflow.inputs)?.find(item => item.id === (node.variable || node.input));
    const name = (node.variable ? 'Variable ' : 'Input ') + (definition?.name || node.variable || node.input);
    return name + (node.compare ? ' ' + operators[node.compare.op] + ' ' + node.compare.number : ' equals ' + JSON.stringify(node.equals));
  };
  const highlight = () => {
    for (const {button, card} of cards) {
      const selected = button.dataset.flowStep === inspector.value;
      button.tabIndex = selected ? 0 : -1;
      button.setAttribute('aria-pressed', String(selected));
      card.dataset.selected = String(selected);
    }
  };
  const render = () => {
    const focusedId = document.activeElement?.dataset?.flowStep;
    const state = current(), workflow = state?.workflow;
    const expanded = workflow && window.tahaiWorkflowDesign.expand(workflow);
    cards = []; list.replaceChildren();
    if (!workflow || !expanded) { summary.textContent = 'A valid workflow is required to show its outline.'; return; }
    summary.textContent = `${workflow.name}: ${workflow.steps.length} authored steps; ${expanded.length} steps after repeat expansion. No run started.`;
    const snapshot = source.value, workflowId = workflow.id;
    for (const [index, step] of workflow.steps.entries()) {
      const row = document.createElement('li'), card = document.createElement('article');
      const button = document.createElement('button');
      card.className = 'studio-flow-card'; button.type = 'button'; button.className = 'button';
      button.dataset.flowStep = step.id; button.textContent = `${index + 1}. ${step.name}`;
      button.setAttribute('aria-controls', 'skin-studio-condition-step');
      const detail = (text, branch = false) => {
        const p = document.createElement('p'); p.className = 'studio-flow-detail' + (branch ? ' studio-flow-branch' : '');
        p.textContent = text; card.append(p);
      };
      card.append(button);
      detail(step.kind === 'run-command' ? `Explicit native action: ${step.action}. Never started by this outline.` :
          step.kind === 'wait' ? `Explicit timed wait: ${step.wait.seconds} seconds` +
              (step.wait.timeout_seconds ? `; deadline ${step.wait.timeout_seconds} active seconds.` : '; no deadline.') :
          step.kind === 'assign-variable' ? `Explicit assignment to variable: ${step.assign.variable}.` :
          step.kind === 'instruction' ? 'Instruction with explicit completion.' : 'Checkpoint with explicit completion.');
      if (step.when) detail(`Condition: ${conditionText(step.when, workflow)}\nTrue: make this step available. False: skip this step. Missing value: stop here until resolved.`, true);
      for (const repeat of workflow.repeats || []) {
        const first = workflow.steps.findIndex(item => item.id === repeat.from);
        const last = workflow.steps.findIndex(item => item.id === repeat.through);
        if (index < first || index > last) continue;
        detail(`Repeat ${repeat.id}: ${repeat.count} total iterations of steps ${first + 1}–${last + 1}.` +
            (index === last ? ' Return to the first step in this range until the final iteration; then continue.' : ''), true);
      }
      const next = document.createElement('p'); next.className = 'studio-flow-next';
      next.textContent = index + 1 < workflow.steps.length ? '↓ Continue in order after completion or a resolved skip.' : 'End of ordered steps; run success still requires explicit confirmation.';
      const select = focusInspector => {
        if (!button.isConnected || source.value !== snapshot || current()?.workflow.id !== workflowId) return false;
        inspector.value = step.id; inspector.dispatchEvent(new Event('change')); highlight();
        if (focusInspector && !inspector.disabled) inspector.focus();
        return true;
      };
      button.addEventListener('click', () => select(true));
      button.addEventListener('keydown', event => {
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 :
            event.key === 'ArrowUp' ? Math.max(0, index - 1) : event.key === 'ArrowDown' ? Math.min(cards.length - 1, index + 1) : -1;
        if (target < 0 || !button.isConnected || source.value !== snapshot || current()?.workflow.id !== workflowId) return;
        event.preventDefault();
        if (cards[target].select(false)) cards[target].button.focus();
      });
      cards.push({button, card, select}); row.append(card, next); list.append(row);
    }
    highlight();
    if (focusedId) (cards.find(item => item.button.dataset.flowStep === focusedId) || cards.find(item => item.button.tabIndex === 0))?.button.focus();
  };
  inspector.addEventListener('change', highlight);
  source.addEventListener('input', render);
  source.addEventListener('tahai-workflow-selection', render);
  render();
})();
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_OUTLINE_H_
