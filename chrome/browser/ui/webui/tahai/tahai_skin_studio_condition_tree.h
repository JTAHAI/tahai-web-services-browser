// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_CONDITION_TREE_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_CONDITION_TREE_H_

namespace tahai {

// Edits only admitted draft predicates. No run data, native messages or new
// expression semantics. Every edit passes the bounded workflow/source validator;
// native manifest validation remains authoritative for profile draft saves.
inline constexpr char kSkinStudioConditionTreeJs[] = R"TAHAI(
(() => {
  'use strict';
  const get = id => document.querySelector('#skin-studio-' + id);
  const source = get('source'), stepChoice = get('condition-step'), anchor = get('condition-expression-save');
  if (!source || !stepChoice || !anchor) return;
  const section = document.createElement('section');
  section.className = 'mode-config-group';
  section.innerHTML = `<h3>Visual condition tree</h3>
    <p id="skin-studio-condition-tree-help" class="muted">Edit individual checks or groups without JSON. Choose a comparison in the Input or variable controls above, then replace a check, add it to a group, or combine it with a selected node. AND requires every check; OR requires at least one; NOT reverses a check. All referenced values must still be present. Removing one of two group members keeps its sibling. Edits affect the draft only, never a running Mission.</p>
    <p id="skin-studio-condition-tree-status" role="status" aria-live="polite"></p>
    <ol id="skin-studio-condition-tree" class="list" aria-label="Condition checks and groups" aria-describedby="skin-studio-condition-tree-help"></ol>`;
  anchor.insertAdjacentElement('afterend', section);
  const list = get('condition-tree'), status = get('condition-tree-status');
  const current = () => window.tahaiStudioWorkflows?.current();
  const writable = () => !source.readOnly && !source.disabled;
  let controls = [];
  const comparisons = {equal:'equals', 'not-equal':'does not equal', 'less-than':'is less than',
    'at-most':'is at most', 'greater-than':'is greater than', 'at-least':'is at least'};
  const at = (root, path) => path.reduce((node, part) => node?.[part], root);
  const selectedCheck = workflow => {
    const key = get('condition-input').value, isVariable = key.startsWith('variable:');
    const id = isVariable ? key.slice(9) : key;
    const definition = (isVariable ? workflow.variables : workflow.inputs)?.find(item => item.id === id);
    if (!definition || definition.protected) return null;
    const binding = isVariable ? {variable:id} : {input:id};
    if (definition.type === 'number') {
      const text = get('condition-number').value, op = get('condition-operation').value;
      if (text.length > 256 || !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
          !Number.isFinite(Number(text)) || Math.abs(Number(text)) > 1e12 || !Object.hasOwn(comparisons, op)) return null;
      return {...binding, compare:{op, number:Number(text)}};
    }
    const values = definition.type === 'boolean' ? ['true','false'] : definition.type === 'selection' ? definition.options : [];
    const value = get('condition-value').value;
    return values.includes(value) ? {...binding, equals:value} : null;
  };
  const label = (node, workflow) => {
    if (node.all) return 'AND — every check';
    if (node.any) return 'OR — at least one check';
    if (node.not) return 'NOT — reverse this check';
    const definition = (node.variable ? workflow.variables : workflow.inputs)?.find(item => item.id === (node.variable || node.input));
    return (node.variable ? 'Variable: ' : 'Input: ') + definition.name +
        (node.compare ? ' ' + comparisons[node.compare.op] + ' ' + node.compare.number : ' equals ' + node.equals);
  };
  const render = () => {
    controls = [];
    list.replaceChildren();
    const state = current(), step = state?.workflow.steps.find(item => item.id === stepChoice.value);
    if (!step) { status.textContent = 'Choose a step in a valid workflow.'; return; }
    if (!step.when) { status.textContent = 'This step has no condition. Use Set condition above to add its first check.'; return; }
    const snapshot = source.value, workflowId = state.workflow.id, stepId = step.id;
    let nodes = 0;
    const draw = (node, path, parentList) => {
      ++nodes;
      const row = document.createElement('li'), group = document.createElement('fieldset'), legend = document.createElement('legend');
      const position = path.length ? path.map(part => Number.isInteger(part) ? part + 1 : part.toUpperCase()).join(' / ') : 'root';
      legend.textContent = label(node, state.workflow);
      group.append(legend); row.append(group); parentList.append(row);
      const buttons = document.createElement('div'); buttons.className = 'actions'; group.append(buttons);
      const key = path.join('/');
      const button = (action, title, operation, enabled = true) => {
        const control = document.createElement('button');
        control.type = 'button'; control.className = 'chip'; control.textContent = title;
        control.dataset.conditionNode = key; control.dataset.conditionEdit = action;
        control.setAttribute('aria-label', title + ': ' + legend.textContent + ' (' + position + ')');
        control.disabled = !writable() || !enabled;
        control.addEventListener('click', () => {
          const next = current(), selected = next?.workflow.steps.find(item => item.id === stepId);
          if (control.disabled || !control.isConnected || !writable() || source.value !== snapshot ||
              next?.workflow.id !== workflowId || stepChoice.value !== stepId || !selected?.when) return;
          const target = at(selected.when, path);
          if (!target) return;
          const replace = (replacement, destination = path) => {
            if (!destination.length) selected.when = replacement;
            else at(selected.when, destination.slice(0,-1))[destination.at(-1)] = replacement;
          };
          if (!operation({next, selected, target, replace})) {
            status.textContent = 'Choose a valid ordinary comparison above. No source was changed.'; return;
          }
          const encoded = window.tahaiWorkflowDesign.encode(next.parsed);
          if (!encoded) {
            status.textContent = 'This edit exceeds the condition or source limits. No source was changed.'; return;
          }
          source.value = encoded; source.dispatchEvent(new Event('input', {bubbles:true}));
          status.textContent = 'Condition edit applied to the draft; no workflow action ran.';
          // Source listeners rebuild the tree. Restore a predictable keyboard
          // position without retaining a detached control or injecting focus.
          (controls.find(item => item.dataset.conditionNode === key && item.dataset.conditionEdit === action) ||
              controls.find(item => item.dataset.conditionNode === key) || controls[0])?.focus();
        });
        buttons.append(control); controls.push(control);
      };
      button('replace', 'Replace with comparison above', ({next, replace}) => {
        const check = selectedCheck(next.workflow); if (!check) return false; replace(check); return true;
      });
      for (const [kind, title] of [['all','AND'],['any','OR']]) {
        button('wrap-' + kind, 'Combine with comparison using ' + title, ({next, target, replace}) => {
          const check = selectedCheck(next.workflow); if (!check) return false; replace({[kind]:[target,check]}); return true;
        });
      }
      button('negate', node.not ? 'Remove NOT' : 'Wrap in NOT', ({target, replace}) => {
        replace(target.not || {not:target}); return true;
      });
      const kind = node.all ? 'all' : node.any ? 'any' : null;
      if (kind) {
        button('switch', 'Change group to ' + (kind === 'all' ? 'OR' : 'AND'), ({target, replace}) => {
          replace({[kind === 'all' ? 'any' : 'all']:target[kind]}); return true;
        });
        button('append', 'Add comparison to group', ({next, target}) => {
          const check = selectedCheck(next.workflow); if (!check) return false; target[kind].push(check); return true;
        }, node[kind].length < 8);
      }
      const sibling = Number.isInteger(path.at(-1)), parentPath = path.slice(0,-2);
      if (sibling) {
        const index = path.at(-1), siblings = at(step.when, path.slice(0,-1));
        for (const [action, title, delta] of [['up','Move check up',-1],['down','Move check down',1]]) {
          button(action, title, ({selected}) => {
            const items = at(selected.when, path.slice(0,-1));
            [items[index], items[index+delta]] = [items[index+delta], items[index]]; return true;
          }, index+delta >= 0 && index+delta < siblings.length);
        }
        button('remove', 'Remove from group', ({selected, replace}) => {
          const items = at(selected.when, path.slice(0,-1)); items.splice(index,1);
          if (items.length === 1) replace(items[0], parentPath); return true;
        });
      } else if (!path.length) {
        button('remove', 'Remove entire condition', ({selected}) => { delete selected.when; return true; });
      }
      if (kind || node.not) {
        const children = document.createElement('ol'); children.className = 'list'; group.append(children);
        if (node.not) draw(node.not, [...path,'not'], children);
        else node[kind].forEach((child,index) => draw(child, [...path,kind,index], children));
      }
    };
    draw(step.when, [], list);
    status.textContent = nodes + ' of 31 condition nodes. Maximum depth 5; at most 8 checks per AND/OR group.' +
        (writable() ? '' : ' This draft is read-only.');
  };
  source.addEventListener('input', render);
  source.addEventListener('tahai-workflow-selection', render);
  stepChoice.addEventListener('change', render);
  render();
})();
)TAHAI";

inline constexpr char kSkinStudioConditionTreeCss[] = R"TAHAI(
#skin-studio-condition-tree{padding-inline-start:0;list-style:none}
#skin-studio-condition-tree ol{padding-inline-start:1rem}
#skin-studio-condition-tree li{min-width:0}
#skin-studio-condition-tree fieldset{min-inline-size:0;margin:.5rem 0;padding:.75rem;border:1px solid currentColor;border-radius:.5rem;overflow-wrap:anywhere}
#skin-studio-condition-tree legend{max-width:100%;white-space:normal}
#skin-studio-condition-tree button{max-width:100%;white-space:normal;text-align:start}
@media(max-width:500px){#skin-studio-condition-tree fieldset{padding:.35rem}#skin-studio-condition-tree ol{padding-inline-start:.5rem}}
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_CONDITION_TREE_H_
