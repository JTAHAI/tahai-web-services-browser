// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_TOOLS_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_TOOLS_H_

namespace tahai {

// Kept separate from the general Mission WebUI. These controls edit only the
// validated source draft. Simulation values and results live in this document
// and are never sent to the browser, a connector, or a package export.
inline constexpr char kSkinStudioWorkflowToolsJs[] = R"TAHAI(
(() => {
  'use strict';
  const source = document.querySelector('#skin-studio-source');
  const status = document.querySelector('#skin-studio-status');
  const anchor = document.querySelector('#skin-studio-workflow-steps');
  if (!source || !status || !anchor) return;
  const section = document.createElement('section');
  section.className = 'mode-config-group';
  section.innerHTML = `<h3>Conditions and step order</h3>
    <p class="muted">Choose when a step is available using an ordinary yes/no, selection or numeric input or variable. Input choices must be answered before starting. An unassigned variable blocks its branch and later work; add an earlier assignment. Variable decisions are recorded when you advance through them and do not change with later assignments or restart. This never starts an action automatically.</p>
    <div class="grid">
      <label>Step <select id="skin-studio-condition-step" class="button"></select></label>
      <label>Input or variable <select id="skin-studio-condition-input" class="button"></select></label>
      <label>Equals <select id="skin-studio-condition-value" class="button"></select></label>
      <label>Numeric comparison <select id="skin-studio-condition-operation" class="button">
        <option value="equal">Equal to</option><option value="not-equal">Not equal to</option>
        <option value="less-than">Less than</option><option value="at-most">At most</option>
        <option value="greater-than">Greater than</option><option value="at-least">At least</option>
      </select></label>
      <label>Numeric threshold <input id="skin-studio-condition-number" type="number" min="-1000000000000" max="1000000000000" step="any"></label>
      <label>Use this check <select id="skin-studio-condition-combine" class="button"><option value="replace">Replace condition</option><option value="all">AND with existing condition</option><option value="any">OR with existing condition</option></select></label>
    </div>
    <div class="actions">
      <button type="button" class="button" id="skin-studio-condition-save">Set condition</button>
      <button type="button" class="button" id="skin-studio-condition-clear">Remove condition</button>
      <button type="button" class="button" id="skin-studio-condition-negate">NOT current condition</button>
      <button type="button" class="button" id="skin-studio-step-up">Move step up</button>
      <button type="button" class="button" id="skin-studio-step-down">Move step down</button>
    </div>
    <label>Compound condition JSON <textarea id="skin-studio-condition-expression" rows="6" maxlength="8192" spellcheck="false" aria-describedby="skin-studio-condition-help"></textarea></label>
    <p id="skin-studio-condition-help" class="muted">Combine ordinary input/variable comparisons with all or any arrays of 2–8 checks, or not with one check. At most 31 nodes and 5 levels. Every source must be answered/assigned; missing values cannot be bypassed with OR/NOT. Recorded decisions never change after progress. The simple controls replace this tree only when Set condition is explicitly chosen.</p>
    <button type="button" class="button" id="skin-studio-condition-expression-save">Set compound condition</button>
    <h3>Bounded repeat</h3>
    <p class="muted" id="skin-studio-repeat-help">Repeat an inclusive sequence 2–8 times, with at most 32 expanded steps. Ranges cannot overlap or nest. Each iteration has its own progress, branch decisions, wait and action record. Local variables carry forward. Actions remain explicit; a repeat never starts an action automatically. Repeated labels must fit 122 characters and expanded IDs 64 characters.</p>
    <div class="grid">
      <label>Repeat range <select id="skin-studio-repeat-choice" class="button"></select></label>
      <label>First step <select id="skin-studio-repeat-from" class="button"></select></label>
      <label>Last step (included) <select id="skin-studio-repeat-through" class="button"></select></label>
      <label>Total iterations <input id="skin-studio-repeat-count" type="number" min="2" max="8" step="1" value="2" aria-describedby="skin-studio-repeat-help"></label>
    </div>
    <div class="actions"><button type="button" class="button" id="skin-studio-repeat-save">Save repeat range</button>
      <button type="button" class="button" id="skin-studio-repeat-remove">Remove repeat range</button></div>
    <p class="muted" id="skin-studio-repeat-summary"></p>
    <h3>Timed wait</h3>
    <p class="muted">Configure the selected step as a local delay, 1–86400 whole seconds. Start and completion are explicit. Pause stops its clock; restart retains only saved progress and never automatically resumes. No website is observed or action dispatched.</p>
    <div class="grid"><label>Wait seconds <input id="skin-studio-wait-seconds" type="number" min="1" max="86400" step="1" value="1"></label>
      <label>Completion deadline in active seconds (optional) <input id="skin-studio-wait-timeout" type="number" min="2" max="86400" step="1"></label>
      <button type="button" class="button" id="skin-studio-wait-save">Set timed wait</button>
      <button type="button" class="button" id="skin-studio-wait-clear">Change wait to checkpoint</button></div>
    <p class="muted">A deadline must exceed the wait and be at most 86400 seconds. It starts with the wait and pauses with it. Missing it fails this step and run without another action. Blank means no deadline.</p>
    <h3>Typed local variables</h3>
    <p class="muted">Create an empty variable using an input or variable's type, options, privacy and limits. Protected values can only be copied into protected variables; they are encrypted locally and remain masked. They cannot enter conditions or calculations. Values change only on explicit assignment; an empty source clears the destination. Target limits are securely checked before storing.</p>
    <div class="grid">
      <label>Variable name <input id="skin-studio-variable-name" maxlength="128" autocomplete="off"></label>
      <label>Copy type, privacy and limits from <select id="skin-studio-variable-template" class="button"></select></label>
      <label><input id="skin-studio-variable-protected" type="checkbox">Protect this new variable (always on for a protected source)</label>
      <button type="button" class="button" id="skin-studio-variable-add">Add empty variable</button>
    </div>
    <ul id="skin-studio-variables" class="list"></ul>
    <p class="muted">Use the selected step above. Instructions and checkpoints can become assignments. Native actions must remain separate steps.</p>
    <div class="grid">
      <label>Destination variable <select id="skin-studio-assignment-target" class="button"></select></label>
      <label>Typed source <select id="skin-studio-assignment-source" class="button"></select></label>
      <button type="button" class="button" id="skin-studio-assignment-save">Set assignment step</button>
      <button type="button" class="button" id="skin-studio-assignment-clear">Change assignment to checkpoint</button>
    </div>
    <h3>Local calculation</h3>
    <p class="muted">Choose a numeric destination above, an operation, and ordinary numeric sources or constants. Results change only when this step is explicitly run.</p>
    <div class="grid">
      <label>Operation <select id="skin-studio-calculation-operation" class="button">
        <option value="">Choose an operation</option><option value="value">Use one value</option>
        <option value="add">Add</option><option value="subtract">Subtract</option>
        <option value="multiply">Multiply</option><option value="divide">Divide</option>
        <option value="min">Smaller value</option><option value="max">Larger value</option>
        <option value="abs">Absolute value</option><option value="negate">Reverse sign</option>
      </select></label>
      <label>First source <select id="skin-studio-calculation-left" class="button"></select></label>
      <label>First constant <input id="skin-studio-calculation-left-number" type="number" step="any" min="-1000000000000" max="1000000000000" aria-describedby="skin-studio-calculation-basic-help"></label>
      <label>Second source <select id="skin-studio-calculation-right" class="button"></select></label>
      <label>Second constant <input id="skin-studio-calculation-right-number" type="number" step="any" min="-1000000000000" max="1000000000000" aria-describedby="skin-studio-calculation-basic-help"></label>
    </div>
    <p id="skin-studio-calculation-basic-help" class="muted">Constants must be finite numbers within ±1,000,000,000,000. One-value and sign operations do not use the second source. Protected values are never offered.</p>
    <p id="skin-studio-calculation-basic-status" role="status" aria-live="polite"></p>
    <button type="button" class="button" id="skin-studio-calculation-basic-save">Set basic calculation</button>
    <label>Advanced bounded expression (JSON tree) <textarea id="skin-studio-calculation-expression" rows="5" maxlength="8192" spellcheck="false" aria-describedby="skin-studio-calculation-help"></textarea></label>
    <p id="skin-studio-calculation-help" class="muted">Choose a numeric destination above. Use number constants or ordinary numeric input/variable IDs with add, subtract, multiply, divide, min, max, abs or negate. Up to 31 nodes and 5 levels. No scripts or protected inputs. Blank references, zero divisors, non-finite/out-of-range results or destination limits prevent assignment without changing the previous value.</p>
    <button type="button" class="button" id="skin-studio-calculation-save">Set calculation step</button>
    <h3>Local text expression</h3>
    <p id="skin-studio-text-help" class="muted">Choose an ordinary text destination. Join two values, trim ordinary spaces, change ASCII letter case, or replace literal matches (not regular expressions). References must have values; an explicit empty constant can clear a result. Each intermediate result is limited to 256 UTF-8 bytes. No protected values, code, web access or implicit type conversion. Constants become part of the shared design: do not enter secrets.</p>
    <label>Text operation <select id="skin-studio-text-operation" class="button">
      <option value="">Choose an operation</option><option value="value">Use one value</option><option value="concat">Join</option>
      <option value="trim-space">Trim spaces</option><option value="lower-ascii">Lowercase ASCII</option>
      <option value="upper-ascii">Uppercase ASCII</option><option value="replace">Replace literal matches</option>
    </select></label>
    <div class="grid">
      <label>First text source <select id="skin-studio-text-first" class="button"></select></label>
      <label>First constant <input id="skin-studio-text-first-constant" maxlength="256" autocomplete="off" aria-describedby="skin-studio-text-help"></label>
      <label>Second source (text or search) <select id="skin-studio-text-second" class="button"></select></label>
      <label>Second constant <input id="skin-studio-text-second-constant" maxlength="256" autocomplete="off" aria-describedby="skin-studio-text-help"></label>
      <label>Replacement source <select id="skin-studio-text-third" class="button"></select></label>
      <label>Replacement constant <input id="skin-studio-text-third-constant" maxlength="256" autocomplete="off" aria-describedby="skin-studio-text-help"></label>
    </div>
    <p id="skin-studio-text-basic-status" role="status" aria-live="polite"></p>
    <button type="button" class="button" id="skin-studio-text-basic-save">Set basic text expression</button>
    <label>Advanced text expression (JSON tree) <textarea id="skin-studio-text-expression" rows="5" maxlength="8192" spellcheck="false" aria-describedby="skin-studio-text-help"></textarea></label>
    <button type="button" class="button" id="skin-studio-text-save">Set text expression step</button>
    <h3>Yes/no calculation</h3>
    <p id="skin-studio-boolean-help" class="muted">Choose an ordinary boolean destination above. Reuse the bounded condition language: all, any, not, ordinary yes/no or selection comparisons, and numeric comparisons. Every referenced value must be present, even in a branch that would otherwise short-circuit. Missing values leave the previous variable and progress unchanged. Protected values and external effects are excluded.</p>
    <label>Boolean expression (JSON tree) <textarea id="skin-studio-boolean-expression" rows="5" maxlength="8192" spellcheck="false" aria-describedby="skin-studio-boolean-help"></textarea></label>
    <button type="button" class="button" id="skin-studio-boolean-save">Set yes/no calculation step</button>
    <button type="button" class="button" id="skin-studio-boolean-from-condition">Turn this step's condition into a yes/no calculation</button>
    <p class="muted">The second button moves the condition made with the condition controls into the calculation, removing that step's availability condition so both true and false can be assigned. It does not run the workflow.</p>
    <h3>Named local outputs</h3>
    <p class="muted">Bind a named result to an input or variable in this run. Results appear only after success, remain local, and inherit the source's type and privacy. Protected values stay masked. No website or service receives a result.</p>
    <div class="grid">
      <label>Result name <input id="skin-studio-output-name" maxlength="128" autocomplete="off"></label>
      <label>Source input <select id="skin-studio-output-input" class="button"></select></label>
      <button type="button" class="button" id="skin-studio-output-add">Add named output</button>
    </div>
    <ul id="skin-studio-outputs" class="list"></ul>
    <h3>Manual recovery checklist</h3>
    <p class="muted">Add up to eight explicit human reviews for a failed or cancelled Mission. They are shown only after every pending action and wait settles. Checking a review never sends, deletes, publishes, navigates, repeats an action, rolls a website back, or changes a failed run into success.</p>
    <div class="grid">
      <label>Recovery review <input id="skin-studio-compensation-name" maxlength="128" autocomplete="off"></label>
      <button type="button" class="button" id="skin-studio-compensation-add">Add recovery review</button>
    </div>
    <ul id="skin-studio-compensation-steps" class="list" aria-label="Manual recovery reviews"></ul>
    <h3>Try the workflow</h3>
    <p class="muted">Try input values and step completion here. Actions are simulated. Values are cleared when the draft changes or this page closes.</p>
    <div id="skin-studio-simulation-inputs" class="grid"></div>
    <button type="button" class="button" id="skin-studio-simulate">Run simulation</button>
    <button type="button" class="button" id="skin-studio-simulation-reset">Reset simulation</button>
    <p id="skin-studio-simulation-status" role="status" aria-live="polite"></p>
    <ol id="skin-studio-simulation-steps" class="list"></ol>
    <ul id="skin-studio-simulation-outputs" class="list" aria-label="Simulated local outputs"></ul>
    <h3>Simulation trace</h3>
    <p class="muted">Local rehearsal only, not evidence of a real browser action. Records step IDs and fixed event types, never input values, variable values, page content or credentials. The latest 128 events stay in memory only. Changing source, workflow or input values, resetting, or closing Studio clears the trace.</p>
    <button type="button" class="button" id="skin-studio-simulation-trace-clear">Clear trace only</button>
    <p id="skin-studio-simulation-trace-status" role="status" aria-live="polite"></p>
    <ol id="skin-studio-simulation-trace" class="list" aria-label="Simulated step event sequence"></ol>`;
  anchor.insertAdjacentElement('afterend', section);
  const get = id => section.querySelector('#skin-studio-' + id);
  const stepChoice = get('condition-step'), inputChoice = get('condition-input');
  const valueChoice = get('condition-value'), simInputs = get('simulation-inputs');
  const simSteps = get('simulation-steps'), simStatus = get('simulation-status');
  const outputName = get('output-name'), outputInput = get('output-input'), outputList = get('outputs');
  const compensationName = get('compensation-name'), compensationList = get('compensation-steps');
  const simOutputs = get('simulation-outputs');
  const traceList = get('simulation-trace'), traceStatus = get('simulation-trace-status');
  const traceKinds = Object.freeze({
    'branch-recorded':'Branch decision recorded in simulation',
    'checkpoint-completed':'Checkpoint completed in simulation',
    'assignment-completed':'Variable assigned in simulation (value omitted)',
    'assignment-blocked':'Assignment blocked; no simulated value or progress changed',
    'wait-started':'Wait started in simulation',
    'wait-completed':'Simulated time advanced and wait completed',
    'wait-blocked':'Wait transition blocked',
    'wait-timed-out':'Simulated deadline reached; run failed',
    'action-dispatched':'Native action substituted in simulation; no real action ran',
    'action-rejected':'Simulated native rejection; run failed',
    'action-unknown':'Simulated uncertain outcome; run failed, never replay automatically',
    'transition-blocked':'Simulated transition blocked'
  });
  const trace = [];
  let traceSequence = 0;
  const renderTrace = () => {
    traceList.replaceChildren();
    for (const entry of trace) {
      const row = document.createElement('li');
      row.dataset.simulationTraceKind = entry.kind;
      row.dataset.simulationTraceStep = entry.stepId;
      row.textContent = entry.sequence + '. ' + entry.stepId + ' — ' + traceKinds[entry.kind];
      traceList.append(row);
    }
    traceStatus.textContent = trace.length ? trace.length + ' simulated events shown.' +
        (traceSequence > trace.length ? ' Older events were omitted by the 128-event limit.' : '') :
        'No simulated step events recorded.';
  };
  const recordTrace = (stepId, kind) => {
    if (!Object.hasOwn(traceKinds, kind) || typeof stepId !== 'string' || stepId.length < 3 || stepId.length > 64 ||
        !/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(stepId)) return;
    traceSequence = Math.min(traceSequence + 1, Number.MAX_SAFE_INTEGER);
    trace.push({sequence:traceSequence,stepId,kind});
    if (trace.length > 128) trace.shift();
    renderTrace();
  };
  const clearTrace = () => { trace.length = 0; traceSequence = 0; renderTrace(); };
  get('simulation-trace-clear').addEventListener('click', clearTrace);
  const simValues = new Map(), completed = new Set();
  const simVariables = new Map();
  const simDecisions = new Map();
  const rememberDecisions = result => {
    if (result.decisions) {
      for (const [id] of result.decisions) if (!simDecisions.has(id)) recordTrace(id, 'branch-recorded');
      simDecisions.clear(); for (const [id, value] of result.decisions) simDecisions.set(id, value);
    }
  };
  const simWaiting = new Set();
  let simFailure = null;
  let simulationEpoch = 0;
  const writable = () => !source.readOnly && !source.disabled;
  const state = () => window.tahaiStudioWorkflows?.current() || null;
  const options = (select, entries, selected) => {
    select.replaceChildren();
    for (const [value, label] of entries) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    }
    if (entries.some(([value]) => value === selected)) select.value = selected;
  };
  const choices = input => input?.protected ? [] : input?.type === 'boolean' ? ['true', 'false'] :
      input?.type === 'selection' && Array.isArray(input.options) ? input.options : [];
  const binding = value => value.startsWith('action-status:') ? {action_status:value.slice(14)} : value.startsWith('variable:') ? {variable: value.slice(9)} : {input: value};
  const bindingKey = from => from?.action_status ? 'action-status:' + from.action_status : from?.variable ? 'variable:' + from.variable : from?.input || '';
  const sources = workflow => [
    ...(workflow?.inputs || []).map(item => ({key: item.id, definition: item})),
    ...(workflow?.variables || []).map(item => ({key: 'variable:' + item.id, definition: item}))];
  const basicArity = Object.freeze({value: 1, add: 2, subtract: 2, multiply: 2, divide: 2, min: 2, max: 2, abs: 1, negate: 1});
  const refreshCalculationControls = () => {
    const enabled = !get('calculation-expression').disabled, op = get('calculation-operation').value;
    get('calculation-operation').disabled = !enabled;
    get('calculation-basic-save').disabled = !enabled || !Object.hasOwn(basicArity, op);
    for (const side of ['left', 'right']) {
      const active = enabled && Object.hasOwn(basicArity, op) && (side === 'left' || basicArity[op] === 2);
      get('calculation-' + side).disabled = !active;
      get('calculation-' + side + '-number').disabled = !active || get('calculation-' + side).value !== '$number';
    }
  };
  const refreshBasicCalculation = (current, expression) => {
    const leaf = node => node && !node.op && (Object.hasOwn(node, 'number') || node.input || node.variable);
    const simple = leaf(expression) || expression?.args?.every(leaf);
    const operands = leaf(expression) ? [expression] : simple ? expression.args : [];
    get('calculation-operation').value = expression ? simple ? expression.op || 'value' : '' : 'add';
    const entries = [['$number', 'Number constant'], ...sources(current?.workflow)
        .filter(item => item.definition.type === 'number' && !item.definition.protected)
        .map(item => [item.key, (item.key.startsWith('variable:') ? 'Variable: ' : 'Input: ') + item.definition.name])];
    for (const [index, side] of ['left', 'right'].entries()) {
      const operand = operands[index];
      options(get('calculation-' + side), entries, bindingKey(operand) || '$number');
      get('calculation-' + side + '-number').value = operand && Object.hasOwn(operand, 'number') ? String(operand.number) : '0';
    }
    get('calculation-basic-status').textContent = expression && !simple ?
        'This nested expression is preserved in the advanced editor. Choosing an operation and setting a basic calculation replaces that tree.' : '';
    refreshCalculationControls();
  };
  const textArity = Object.freeze({value: 1, concat: 2, 'trim-space': 1, 'lower-ascii': 1, 'upper-ascii': 1, replace: 3});
  const refreshTextControls = () => {
    const enabled = !get('text-expression').disabled, op = get('text-operation').value;
    get('text-operation').disabled = !enabled;
    get('text-basic-save').disabled = !enabled || !Object.hasOwn(textArity, op);
    for (const [index, side] of ['first', 'second', 'third'].entries()) {
      const active = enabled && index < (textArity[op] || 0);
      get('text-' + side).disabled = !active;
      get('text-' + side + '-constant').disabled = !active || get('text-' + side).value !== '$text';
    }
  };
  const refreshTextExpression = (current, expression) => {
    const leaf = node => node && !node.op;
    const simple = leaf(expression) || expression?.args?.every(leaf);
    const operands = leaf(expression) ? [expression] : simple ? expression.args : [];
    get('text-operation').value = expression ? simple ? expression.op || 'value' : '' : 'concat';
    const entries = [['$text', 'Text constant'], ...sources(current?.workflow)
        .filter(item => item.definition.type === 'text' && !item.definition.protected)
        .map(item => [item.key, (item.key.startsWith('variable:') ? 'Variable: ' : 'Input: ') + item.definition.name])];
    for (const [index, side] of ['first', 'second', 'third'].entries()) {
      options(get('text-' + side), entries, bindingKey(operands[index]) || '$text');
      get('text-' + side + '-constant').value = operands[index]?.text ?? '';
    }
    get('text-basic-status').textContent = expression && !simple ? 'This nested expression is preserved below. Setting a basic expression replaces it.' : '';
    refreshTextControls();
  };
  const refreshAssignment = current => {
    const step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    const targetControl = get('assignment-target'), sourceControl = get('assignment-source');
    options(targetControl, (current?.workflow.variables || []).map(item => [item.id, item.name + ' · ' + item.type + (item.protected ? ' (protected)' : '')]),
        step?.assign?.variable || targetControl.value);
    const target = current?.workflow.variables?.find(item => item.id === targetControl.value);
    const actionSources = target && !target.protected && ['text','selection'].includes(target.type) && step ?
        current.workflow.steps.slice(0,current.workflow.steps.indexOf(step)).filter(item=>item.kind==='run-command')
          .map(item=>['action-status:'+item.id,'Action dispatch status: '+item.name]) : [];
    options(sourceControl, [...sources(current?.workflow).filter(item => (!item.definition.protected || target?.protected) && item.definition.type === target?.type)
        .map(item => [item.key, (item.key.startsWith('variable:') ? 'Variable: ' : 'Input: ') + item.definition.name]), ...actionSources],
        bindingKey(step?.assign?.from) || sourceControl.value);
    const enabled = writable() && step && step.kind !== 'run-command';
    targetControl.disabled = sourceControl.disabled = !enabled;
    get('assignment-save').disabled = !enabled || !target || !sourceControl.options.length;
    get('assignment-clear').disabled = !enabled || step.kind !== 'assign-variable';
    get('calculation-expression').disabled = get('calculation-save').disabled = !enabled || target?.type !== 'number' || Boolean(target?.protected);
    get('calculation-expression').value = JSON.stringify(step?.assign?.expression ||
        {op: 'add', args: [{number: 0}, {number: 0}]}, null, 2);
    refreshBasicCalculation(current, step?.assign?.expression);
    get('text-expression').disabled = get('text-save').disabled = !enabled || target?.type !== 'text' || Boolean(target?.protected);
    get('text-expression').value = JSON.stringify(step?.assign?.text_expression || {op: 'concat', args: [{text: ''}, {text: ''}]}, null, 2);
    refreshTextExpression(current, step?.assign?.text_expression);
    get('boolean-expression').disabled = get('boolean-save').disabled = !enabled || target?.type !== 'boolean' || Boolean(target?.protected);
    get('boolean-from-condition').disabled = get('boolean-save').disabled || !step?.when;
    get('boolean-expression').value = JSON.stringify(step?.assign?.boolean_expression || step?.when || {}, null, 2);
  };
  const refreshVariables = current => {
    const enabled = writable() && Boolean(current), items = sources(current?.workflow);
    options(get('variable-template'), items.map(item => [item.key, item.definition.name + ' · ' + item.definition.type + (item.definition.protected ? ' (protected)' : '')]), get('variable-template').value);
    get('variable-name').disabled = get('variable-template').disabled = !enabled;
    get('variable-protected').disabled = !enabled || Boolean(items.find(item => item.key === get('variable-template').value)?.definition.protected);
    if (get('variable-protected').disabled) get('variable-protected').checked = enabled;
    get('variable-add').disabled = !enabled || !items.length || (current.workflow.variables?.length || 0) >= 12;
    const list = get('variables'); list.replaceChildren();
    for (const variable of current?.workflow.variables || []) {
      const row = document.createElement('li'), label = document.createElement('label');
      const name = document.createElement('input'), remove = document.createElement('button');
      label.textContent = variable.type + (variable.protected ? ' protected' : '') + ' · Variable name '; name.value = variable.name;
      name.maxLength = 128; name.autocomplete = 'off'; name.dataset.workflowVariableName = variable.id;
      remove.type = 'button'; remove.className = 'chip'; remove.textContent = 'Remove variable';
      remove.dataset.workflowVariableRemove = variable.id; name.disabled = remove.disabled = !enabled;
      const workflowId = current.workflow.id;
      const next = control => {
        const value = state();
        return writable() && control.isConnected && value?.workflow.id === workflowId ? value : null;
      };
      name.addEventListener('change', () => {
        const value = next(name), item = value?.workflow.variables.find(item => item.id === variable.id);
        if (!item) return;
        item.name = name.value.trim(); if (!save(value)) name.value = variable.name;
      });
      remove.addEventListener('click', () => {
        const value = next(remove); if (!value) return;
        if (value.workflow.steps.some(step => window.tahaiWorkflowDesign.usesConditionSource(step.when, 'variable', variable.id) || step.assign?.variable === variable.id ||
                window.tahaiWorkflowDesign.usesAssignmentSource(step.assign, 'variable', variable.id)) ||
            value.workflow.outputs?.some(output => output.from.variable === variable.id)) {
          status.textContent = 'Remove or rebind conditions, assignments and outputs using this variable before deleting it.'; return;
        }
        value.workflow.variables = value.workflow.variables.filter(item => item.id !== variable.id); save(value);
      });
      label.append(name); row.append(label, remove);
      if (['number', 'text', 'url'].includes(variable.type)) {
        const keys = variable.type === 'number' ? ['minimum', 'maximum'] : ['min_bytes', 'max_bytes'];
        const low = document.createElement('input'), high = document.createElement('input');
        const lowLabel = document.createElement('label'), highLabel = document.createElement('label');
        const apply = document.createElement('button'), help = document.createElement('p');
        lowLabel.textContent = variable.name + (variable.type === 'number' ? ' · Minimum (optional) ' : ' · Minimum UTF-8 bytes (optional) ');
        highLabel.textContent = variable.name + (variable.type === 'number' ? ' · Maximum (optional) ' : ' · Maximum UTF-8 bytes (optional) ');
        low.value = variable.validation?.[keys[0]] ?? ''; high.value = variable.validation?.[keys[1]] ?? '';
        low.dataset.workflowVariableLower = high.dataset.workflowVariableUpper = variable.id;
        low.type = high.type = 'text'; low.maxLength = high.maxLength = 32; low.autocomplete = high.autocomplete = 'off';
        apply.type = 'button'; apply.className = 'chip'; apply.textContent = 'Set variable limits';
        apply.dataset.workflowVariableLimits = variable.id;
        low.disabled = high.disabled = apply.disabled = !enabled;
        help.className = 'muted';
        help.id = 'skin-studio-variable-limits-' + variable.id;
        low.setAttribute('aria-describedby', help.id); high.setAttribute('aria-describedby', help.id);
        apply.setAttribute('aria-label', 'Set limits for ' + variable.name);
        help.textContent = (variable.type === 'number' ? 'Inclusive finite bounds within ±1,000,000,000,000. ' :
            'Whole byte counts: minimum 0–256, maximum 1–256. Non-ASCII characters may use multiple bytes. ') +
            'Minimum cannot exceed maximum. Blank clears that bound. This edits the draft, not existing runs or saved values.';
        apply.addEventListener('click', () => {
          const value = next(apply), item = value?.workflow.variables.find(item => item.id === variable.id);
          if (!item || item.type !== variable.type) return;
          const limits = {};
          for (const [index, text] of [low.value, high.value].entries()) {
            if (text === '') continue;
            if (text.length > 32 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)) {
              status.textContent = 'Enter valid numeric limits or leave them blank. No source was changed.'; return;
            }
            limits[keys[index]] = Number(text);
          }
          if (Object.keys(limits).length) item.validation = limits; else delete item.validation;
          save(value);
        });
        lowLabel.append(low); highLabel.append(high); row.append(lowLabel, highLabel, apply, help);
      }
      list.append(row);
    }
    refreshAssignment(current);
  };
  const refreshCondition = () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    const inputs = sources(current?.workflow).filter(item => !item.definition.protected && ['boolean', 'selection', 'number'].includes(item.definition.type));
    options(inputChoice, inputs.map(item => [item.key, (item.key.startsWith('variable:') ? 'Variable: ' : 'Input: ') + item.definition.name]), bindingKey(step?.when) || inputChoice.value);
    refreshValues(step?.when);
    const enabled = writable() && Boolean(step);
    get('condition-expression').value = step?.when ? JSON.stringify(step.when, null, 2) : '';
    get('condition-expression').disabled = get('condition-expression-save').disabled = !enabled;
    get('condition-combine').disabled = !enabled; get('condition-combine').value = 'replace';
    get('condition-negate').disabled = !enabled || !step.when;
    get('condition-clear').disabled = !enabled || !step.when;
    const index = current?.workflow.steps.indexOf(step) ?? -1;
    get('step-up').disabled = !enabled || index < 1;
    get('step-down').disabled = !enabled || index + 1 >= current.workflow.steps.length;
    refreshAssignment(current);
    get('wait-timeout').disabled = get('wait-seconds').disabled = get('wait-save').disabled = !enabled || step.kind === 'run-command';
    get('wait-clear').disabled = !enabled || step.kind !== 'wait';
    get('wait-seconds').value = step?.wait?.seconds ?? 1;
    get('wait-timeout').value = step?.wait?.timeout_seconds ?? '';
  };
  const refreshValues = condition => {
    const current = state(), input = sources(current?.workflow).find(item => item.key === inputChoice.value)?.definition;
    options(valueChoice, choices(input).map(value => [value, value]), condition?.equals);
    const enabled = writable() && Boolean(current) && Boolean(input) && !input.protected;
    const numeric = input?.type === 'number';
    get('condition-save').disabled = !enabled || (!numeric && !valueChoice.options.length);
    inputChoice.disabled = !enabled;
    valueChoice.disabled = !enabled || numeric;
    get('condition-operation').disabled = get('condition-number').disabled = !enabled || !numeric;
    get('condition-operation').value = condition?.compare?.op || 'equal';
    get('condition-number').value = condition?.compare?.number ?? '';
  };
  const save = current => {
    const encoded = window.tahaiWorkflowDesign.encode(current.parsed);
    if (!writable() || !encoded) {
      status.textContent = 'This edit is invalid or exceeds the Studio source limit. No source was changed.';
      return false;
    }
    source.value = encoded;
    source.dispatchEvent(new Event('input', {bubbles: true}));
    status.textContent = 'Workflow edit is being validated before saving.';
    return true;
  };
  const refreshRepeat = () => {
    const current = state(), selected = get('repeat-choice').value;
    const repeats = current?.workflow.repeats || [], enabled = writable() && Boolean(current);
    options(get('repeat-choice'), [['', 'New repeat range'], ...repeats.map(item =>
      [item.id, item.id + ' · ' + item.count + ' iterations · ' + item.from + ' through ' + item.through])], selected);
    const repeat = repeats.find(item => item.id === get('repeat-choice').value);
    const steps = (current?.workflow.steps || []).map(step => [step.id, step.name]);
    options(get('repeat-from'), steps, repeat?.from);
    options(get('repeat-through'), steps, repeat?.through);
    get('repeat-count').value = repeat?.count ?? 2;
    for (const control of ['choice', 'from', 'through', 'count']) get('repeat-' + control).disabled = !enabled;
    get('repeat-save').disabled = !enabled || !repeat && repeats.length >= 8;
    get('repeat-remove').disabled = !enabled || !repeat;
    const expanded = current && window.tahaiWorkflowDesign.expand(current.workflow);
    get('repeat-summary').textContent = expanded ? `${current.workflow.steps.length} authored steps; ${expanded.length} expanded steps. Remove a range before deleting its first or last step.` : 'Enter a valid workflow first.';
  };
  get('repeat-choice').addEventListener('change', refreshRepeat);
  get('repeat-save').addEventListener('click', () => {
    const current = state(); if (!current || !writable()) return;
    const selected = get('repeat-choice').value, repeats = current.workflow.repeats || [];
    const existing = repeats.find(item => item.id === selected);
    if (selected && !existing || !existing && repeats.length >= 8) return;
    let id = selected || 'repeat-1', suffix = 2;
    while (!selected && repeats.some(item => item.id === id)) id = 'repeat-' + suffix++;
    const count = get('repeat-count').value;
    const repeat = {id, from: get('repeat-from').value, through: get('repeat-through').value,
      count: /^[2-8]$/.test(count) ? Number(count) : 0};
    current.workflow.repeats = existing ? repeats.map(item => item.id === id ? repeat : item) : [...repeats, repeat];
    if (!window.tahaiWorkflowDesign.validate(current.workflow, current.parsed.operational.capabilities)) {
      status.textContent = 'Repeat rejected: choose ordered, nonoverlapping steps, 2–8 iterations, at most 32 expanded steps, and bounded unique labels/IDs. No source was changed.';
      return;
    }
    if (save(current)) { get('repeat-choice').value = id; refreshRepeat(); }
  });
  get('repeat-remove').addEventListener('click', () => {
    const current = state(), selected = get('repeat-choice').value;
    if (!current || !writable() || !current.workflow.repeats?.some(item => item.id === selected)) return;
    current.workflow.repeats = current.workflow.repeats.filter(item => item.id !== selected);
    save(current);
  });
  get('variable-add').addEventListener('click', () => {
    const current = state(), name = get('variable-name').value.trim();
    const template = sources(current?.workflow).find(item => item.key === get('variable-template').value)?.definition;
    const variables = current?.workflow.variables || [];
    if (!current || !writable() || !template || variables.length >= 12) return;
    const base = 'variable-' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48).replace(/-+$/g, '') || 'new');
    let id = base, suffix = 2;
    while (variables.some(item => item.id === id) && suffix < 100) id = base + '-' + suffix++;
    const variable = {id, name, type: template.type};
    if (template.protected || get('variable-protected').checked) variable.protected = true;
    if (template.options) variable.options = [...template.options];
    if (template.validation) variable.validation = {...template.validation};
    variables.push(variable); current.workflow.variables = variables;
    if (save(current)) get('variable-name').value = '';
  });
  get('variable-template').addEventListener('change', () => {
    get('variable-protected').checked = Boolean(sources(state()?.workflow).find(item => item.key === get('variable-template').value)?.definition.protected);
    refreshVariables(state());
  });
  get('assignment-target').addEventListener('change', () => {
    // Preserve a newly chosen target rather than reselecting the old binding.
    const current = state(); if (!current) return;
    const step = current.workflow.steps.find(item => item.id === stepChoice.value);
    if (step) delete step.assign;
    refreshAssignment(current);
  });
  for (const operation of ['save', 'clear']) get('wait-' + operation).addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    if (!current || !writable() || !step || step.kind === 'run-command') return;
    if (operation === 'clear') {
      if (step.kind !== 'wait') return;
      step.kind = 'checkpoint'; delete step.wait;
    } else {
      const text = get('wait-seconds').value;
      if (!/^\d+$/.test(text) || !Number.isInteger(Number(text)) || Number(text) < 1 || Number(text) > 86400) {
        status.textContent = 'Use 1–86400 whole seconds. No source was changed.'; return;
      }
      step.kind = 'wait'; step.wait = {seconds: Number(text)}; delete step.assign;
      const timeout = get('wait-timeout').value;
      if (timeout && (!/^\d+$/.test(timeout) || !Number.isInteger(Number(timeout)) ||
          Number(timeout) <= Number(text) || Number(timeout) > 86400)) {
        status.textContent = 'Deadline must exceed the wait and be at most 86400 whole seconds. No source was changed.'; return;
      }
      if (timeout) step.wait.timeout_seconds = Number(timeout);
    }
    save(current);
  });
  for (const operation of ['save', 'clear']) get('assignment-' + operation).addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    if (!current || !writable() || !step || step.kind === 'run-command') return;
    if (operation === 'clear') {
      if (step.kind !== 'assign-variable') return;
      step.kind = 'checkpoint'; delete step.assign;
    } else {
      step.kind = 'assign-variable';
      delete step.wait;
      step.assign = {variable: get('assignment-target').value, from: binding(get('assignment-source').value)};
    }
    save(current);
  });
  get('output-add').addEventListener('click', () => {
    const current = state(), name = outputName.value.trim();
    if (!current || !writable() || !sources(current.workflow).some(item => item.key === outputInput.value)) return;
    const outputs = current.workflow.outputs || [];
    if (outputs.length >= 12) return;
    const base = 'output-' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/g, '') || 'new');
    let id = base, suffix = 2;
    while (outputs.some(output => output.id === id) && suffix < 100) id = base + '-' + suffix++;
    if (outputs.some(output => output.id === id)) return;
    outputs.push({id, name, from: binding(outputInput.value)});
    current.workflow.outputs = outputs;
    if (save(current)) outputName.value = '';
  });
  get('compensation-add').addEventListener('click', () => {
    const current = state(), name = compensationName.value.trim();
    if (!current || !writable() || !name) return;
    const items = current.workflow.compensation_steps || [];
    if (items.length >= 8) return;
    const base = 'recovery-' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/g, '') || 'review');
    let id = base, suffix = 2;
    while (items.some(item => item.id === id) && suffix < 100) id = base + '-' + suffix++;
    if (items.some(item => item.id === id)) return;
    items.push({id, name});
    current.workflow.compensation_steps = items;
    if (save(current)) compensationName.value = '';
  });
  for (const operation of ['save', 'from-condition']) get('boolean-' + operation).addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    if (!current || !writable() || !step || step.kind === 'run-command') return;
    let expression;
    if (operation === 'from-condition') {
      if (!step.when) { status.textContent = 'Set a step condition first. No source was changed.'; return; }
      expression = step.when; delete step.when;
    } else {
      const text = get('boolean-expression').value;
      if (new TextEncoder().encode(text).length > 8192) { status.textContent = 'The expression exceeds the editor limit. No source was changed.'; return; }
      try { expression = JSON.parse(text); } catch { status.textContent = 'Enter a valid boolean expression JSON tree. No source was changed.'; return; }
    }
    step.kind = 'assign-variable'; delete step.wait;
    step.assign = {variable: get('assignment-target').value, boolean_expression: expression};
    save(current);
  });
  get('text-save').addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    const text = get('text-expression').value;
    if (!current || !writable() || !step || step.kind === 'run-command') return;
    if (new TextEncoder().encode(text).length > 8192) { status.textContent = 'The expression exceeds the editor limit. No source was changed.'; return; }
    let expression;
    try { expression = JSON.parse(text); } catch { status.textContent = 'Enter a valid text expression JSON tree. No source was changed.'; return; }
    step.kind = 'assign-variable'; delete step.wait;
    step.assign = {variable: get('assignment-target').value, text_expression: expression};
    save(current);
  });
  for (const name of ['operation', 'first', 'second', 'third']) get('text-' + name).addEventListener('change', refreshTextControls);
  get('text-basic-save').addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value), op = get('text-operation').value;
    if (!current || !writable() || !step || step.kind === 'run-command' || !Object.hasOwn(textArity, op)) return;
    const args = [];
    for (const side of ['first', 'second', 'third'].slice(0, textArity[op])) {
      const key = get('text-' + side).value;
      if (key === '$text') args.push({text: get('text-' + side + '-constant').value});
      else {
        if (!sources(current.workflow).some(item => item.key === key && item.definition.type === 'text' && !item.definition.protected)) {
          status.textContent = 'Choose an ordinary text source. No source was changed.'; return;
        }
        args.push(binding(key));
      }
    }
    step.kind = 'assign-variable'; delete step.wait;
    step.assign = {variable: get('assignment-target').value, text_expression: op === 'value' ? args[0] : {op, args}};
    save(current);
  });
  get('calculation-save').addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    const text = get('calculation-expression').value;
    if (!current || !writable() || !step || step.kind === 'run-command') return;
    if (new TextEncoder().encode(text).length > 8192) { status.textContent = 'The expression exceeds the editor limit. No source was changed.'; return; }
    let expression;
    try { expression = JSON.parse(text); } catch { status.textContent = 'Enter a valid expression JSON tree. No source was changed.'; return; }
    step.kind = 'assign-variable'; delete step.wait;
    step.assign = {variable: get('assignment-target').value, expression};
    save(current);
  });
  for (const name of ['operation', 'left', 'right'])
    get('calculation-' + name).addEventListener('change', refreshCalculationControls);
  get('calculation-basic-save').addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    const op = get('calculation-operation').value;
    if (!current || !writable() || !step || step.kind === 'run-command' || !Object.hasOwn(basicArity, op)) return;
    const operands = [];
    for (const side of ['left', 'right'].slice(0, basicArity[op])) {
      const key = get('calculation-' + side).value;
      if (key === '$number') {
        const text = get('calculation-' + side + '-number').value;
        if (text.length > 256 || !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
            !Number.isFinite(Number(text)) || Math.abs(Number(text)) > 1e12) {
          status.textContent = 'Enter a finite numeric constant within ±1,000,000,000,000. No source was changed.'; return;
        }
        operands.push({number: Number(text)});
      } else {
        if (!sources(current.workflow).some(item => item.key === key && item.definition.type === 'number' && !item.definition.protected)) {
          status.textContent = 'Choose an ordinary numeric source. No source was changed.'; return;
        }
        operands.push(binding(key));
      }
    }
    step.kind = 'assign-variable'; delete step.wait;
    step.assign = {variable: get('assignment-target').value, expression: op === 'value' ? operands[0] : {op, args: operands}};
    save(current);
  });
  const refreshOutputs = current => {
    const enabled = writable() && Boolean(current), inputs = sources(current?.workflow);
    const entries = inputs.map(({key, definition: input}) => [key, (key.startsWith('variable:') ? 'Variable: ' : 'Input: ') + input.name + ' · ' + input.type + (input.protected ? ' · protected' : '')]);
    options(outputInput, entries, outputInput.value);
    outputName.disabled = outputInput.disabled = !enabled || !inputs.length;
    get('output-add').disabled = !enabled || !inputs.length || (current.workflow.outputs?.length || 0) >= 12;
    outputList.replaceChildren();
    for (const output of current?.workflow.outputs || []) {
      const row = document.createElement('li'), nameLabel = document.createElement('label');
      const name = document.createElement('input'), fromLabel = document.createElement('label');
      const from = document.createElement('select'), remove = document.createElement('button');
      nameLabel.textContent = 'Result name '; name.type = 'text'; name.maxLength = 128; name.autocomplete = 'off';
      name.value = output.name; name.dataset.workflowOutputName = output.id; nameLabel.append(name);
      fromLabel.textContent = 'Source (inherits type and privacy) '; from.className = 'button';
      from.dataset.workflowOutputInput = output.id; options(from, entries, bindingKey(output.from)); fromLabel.append(from);
      remove.type = 'button'; remove.className = 'chip'; remove.textContent = 'Remove output';
      remove.dataset.workflowOutputRemove = output.id;
      name.disabled = from.disabled = remove.disabled = !enabled;
      const workflowId = current.workflow.id;
      const mutate = (control, operation) => {
        const next = state();
        if (!next || !writable() || next.workflow.id !== workflowId || !control.isConnected) return;
        const index = next.workflow.outputs?.findIndex(candidate => candidate.id === output.id) ?? -1;
        if (index < 0) return;
        operation(next.workflow.outputs, index);
        if (!save(next)) { name.value = output.name; from.value = bindingKey(output.from); }
      };
      name.addEventListener('change', () => mutate(name, (items, index) => { items[index].name = name.value.trim(); }));
      from.addEventListener('change', () => mutate(from, (items, index) => { items[index].from = binding(from.value); }));
      remove.addEventListener('click', () => mutate(remove, (items, index) => { items.splice(index, 1); }));
      row.append(nameLabel, fromLabel, remove); outputList.append(row);
    }
  };
  const refreshCompensation = current => {
    const enabled = writable() && Boolean(current);
    const items = current?.workflow.compensation_steps || [];
    compensationName.disabled = !enabled;
    get('compensation-add').disabled = !enabled || items.length >= 8;
    compensationList.replaceChildren();
    for (const item of items) {
      const row = document.createElement('li'), label = document.createElement('label');
      const name = document.createElement('input'), remove = document.createElement('button');
      label.textContent = 'Manual review '; name.type = 'text'; name.maxLength = 128; name.autocomplete = 'off';
      name.value = item.name; name.dataset.workflowCompensationName = item.id; label.append(name);
      remove.type = 'button'; remove.className = 'chip'; remove.textContent = 'Remove recovery review';
      remove.dataset.workflowCompensationRemove = item.id;
      name.disabled = remove.disabled = !enabled;
      const workflowId = current.workflow.id;
      const mutate = (control, operation) => {
        const next = state();
        if (!next || !writable() || next.workflow.id !== workflowId || !control.isConnected) return;
        const index = next.workflow.compensation_steps?.findIndex(candidate => candidate.id === item.id) ?? -1;
        if (index < 0) return;
        operation(next.workflow.compensation_steps, index, next.workflow);
        if (!save(next)) name.value = item.name;
      };
      name.addEventListener('change', () => mutate(name, (steps, index) => { steps[index].name = name.value.trim(); }));
      remove.addEventListener('click', () => mutate(remove, (steps, index, workflow) => {
        steps.splice(index, 1);
        if (!steps.length) delete workflow.compensation_steps;
      }));
      row.append(label, remove); compensationList.append(row);
    }
  };
  get('condition-expression-save').addEventListener('click', () => {
    const current = state(), text = get('condition-expression').value;
    const step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    if (!step || !writable()) return;
    try {
      if (text.length > 8192) throw new Error();
      const expression = JSON.parse(text);
      if (!expression || typeof expression !== 'object' || Array.isArray(expression) ||
          !['all', 'any', 'not'].some(key => Object.hasOwn(expression, key))) throw new Error();
      step.when = expression;
      if (save(current)) return;
    } catch {}
    status.textContent = 'Enter a bounded compound condition using declared ordinary sources. No source was changed.';
  });
  get('condition-save').addEventListener('click', () => {
    const current = state();
    if (!current || !writable()) return;
    const step = current.workflow.steps.find(item => item.id === stepChoice.value);
    const input = sources(current.workflow).find(item => item.key === inputChoice.value)?.definition;
    if (!step || !input || input.protected) return;
    const previous = step.when, combine = get('condition-combine').value;
    if (!['replace', 'all', 'any'].includes(combine) || combine !== 'replace' && !previous) {
      status.textContent = 'Set a first condition before combining checks. No source was changed.'; return;
    }
    if (input.type === 'number') {
      const text = get('condition-number').value, op = get('condition-operation').value;
      if (text.length > 256 || !/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text) ||
          !Number.isFinite(Number(text)) || Math.abs(Number(text)) > 1e12) {
        status.textContent = 'Enter a finite numeric threshold within ±1,000,000,000,000. No source was changed.'; return;
      }
      step.when = {...binding(inputChoice.value), compare: {op, number: Number(text)}};
    } else {
      if (!choices(input).includes(valueChoice.value)) return;
      step.when = {...binding(inputChoice.value), equals: valueChoice.value};
    }
    if (combine !== 'replace') step.when = {[combine]: [previous, step.when]};
    save(current);
  });
  get('condition-negate').addEventListener('click', () => {
    const current = state(), step = current?.workflow.steps.find(item => item.id === stepChoice.value);
    if (!step?.when || !writable()) return;
    step.when = {not: step.when}; save(current);
  });
  get('condition-clear').addEventListener('click', () => {
    const current = state();
    if (!current || !writable()) return;
    const step = current.workflow.steps.find(item => item.id === stepChoice.value);
    if (!step) return;
    delete step.when;
    save(current);
  });
  for (const [id, delta] of [['step-up', -1], ['step-down', 1]]) {
    get(id).addEventListener('click', () => {
      const current = state();
      if (!current || !writable()) return;
      const items = current.workflow.steps, index = items.findIndex(item => item.id === stepChoice.value);
      if (index < 0 || index + delta < 0 || index + delta >= items.length) return;
      [items[index], items[index + delta]] = [items[index + delta], items[index]];
      save(current);
      stepChoice.focus();
    });
  }
  const simulate = () => {
    const current = state();
    simSteps.replaceChildren(); simOutputs.replaceChildren();
    if (!current) { simStatus.textContent = 'Enter a valid workflow first.'; return; }
    const result = window.tahaiWorkflowDesign.simulate(current.workflow,
        current.parsed.operational.capabilities, simValues, completed, simVariables, simWaiting, simDecisions);
    if (result.error) { simStatus.textContent = result.error; return; }
    if (result.missing) {
      simStatus.textContent = 'Waiting for required inputs or branch choices: ' + result.missing.join(', ');
      return;
    }
    const epoch = simulationEpoch, sourceSnapshot = source.value, workflowId = current.workflow.id;
    for (const step of result.steps) {
      const available = step.available;
      const row = document.createElement('li'), label = document.createElement('span');
      const done = step.complete;
      label.textContent = step.name + ' — ' + (simFailure?.stepId === step.id ? 'Failed: ' + simFailure.code : !step.resolved ? 'Waiting for variable assignment' : !available ? 'Skipped by condition' : done ? 'Complete' :
          step.kind === 'run-command' ? 'Simulated action: ' + step.action :
          step.kind === 'wait' ? 'Simulated wait: ' + step.waitSeconds + ' seconds' : 'Ready') + (step.recorded ? ' (recorded decision)' : '');
      row.append(label);
      if (available && !done && !simFailure) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'chip'; button.textContent = step.kind === 'assign-variable' ? 'Assign in simulation' :
            step.kind === 'wait' ? step.waiting ? 'Advance time and complete in simulation' : 'Start wait in simulation' : 'Complete in simulation';
        button.disabled = result.steps.slice(0, result.steps.indexOf(step)).some(previous => !previous.resolved ||
            ['wait', 'assign-variable', 'run-command'].includes(step.kind) && previous.available && !previous.complete);
        button.addEventListener('click', () => {
          if (!button.isConnected || button.disabled || epoch !== simulationEpoch ||
              sourceSnapshot !== source.value || state()?.workflow.id !== workflowId) return;
          if (step.kind === 'wait') {
            const waited = window.tahaiWorkflowDesign.wait(current.workflow, current.parsed.operational.capabilities,
                simValues, completed, simVariables, simWaiting, step.id, step.waiting, simDecisions);
            if (waited.error) { recordTrace(step.id, 'wait-blocked'); simStatus.textContent = waited.error; return; }
            simWaiting.clear(); for (const id of waited.waiting) simWaiting.add(id);
            completed.clear(); for (const id of waited.completed) completed.add(id);
            rememberDecisions(waited);
            recordTrace(step.id, step.waiting ? 'wait-completed' : 'wait-started');
            simulate(); return;
          }
          if (step.kind === 'assign-variable') {
            const assigned = window.tahaiWorkflowDesign.assign(current.workflow, current.parsed.operational.capabilities,
                simValues, completed, simVariables, step.id, simDecisions);
            if (assigned.error) { recordTrace(step.id, 'assignment-blocked'); simStatus.textContent = assigned.error; return; }
            simVariables.clear(); for (const [id, value] of assigned.variables) simVariables.set(id, value);
            rememberDecisions(assigned);
            recordTrace(step.id, 'assignment-completed');
          } else {
            const advanced = window.tahaiWorkflowDesign.advance(current.workflow, current.parsed.operational.capabilities,
                simValues, completed, simVariables, simWaiting, step.id, simDecisions);
            if (advanced.error) { recordTrace(step.id, 'transition-blocked'); simStatus.textContent = advanced.error; return; }
            rememberDecisions(advanced);
            recordTrace(step.id, step.kind === 'run-command' ? 'action-dispatched' : 'checkpoint-completed');
          }
          completed.add(step.id); simulate();
        });
        row.append(button);
        if (step.kind === 'run-command') for (const outcome of ['rejected', 'unknown']) {
          const fail = document.createElement('button');
          fail.type = 'button'; fail.className = 'chip'; fail.disabled = button.disabled;
          fail.textContent = outcome === 'rejected' ? 'Simulate rejected action' : 'Simulate unknown outcome';
          fail.addEventListener('click', () => {
            if (!fail.isConnected || fail.disabled || simFailure || epoch !== simulationEpoch ||
                sourceSnapshot !== source.value || state()?.workflow.id !== workflowId) return;
            const failed = window.tahaiWorkflowDesign.failNative(current.workflow, current.parsed.operational.capabilities,
                simValues, completed, simVariables, simWaiting, step.id, outcome, simDecisions);
            if (failed.error) { simStatus.textContent = failed.error; return; }
            rememberDecisions(failed);
            recordTrace(step.id, outcome === 'rejected' ? 'action-rejected' : 'action-unknown');
            simFailure = failed; simulate();
          });
          row.append(fail);
        }
        if (step.waiting && step.waitTimeoutSeconds) {
          const expire = document.createElement('button');
          expire.type = 'button'; expire.className = 'chip'; expire.textContent = 'Advance to deadline and fail in simulation';
          expire.addEventListener('click', () => {
            if (!expire.isConnected || simFailure || epoch !== simulationEpoch || sourceSnapshot !== source.value ||
                state()?.workflow.id !== workflowId) return;
            const failed = window.tahaiWorkflowDesign.expireWait(current.workflow, current.parsed.operational.capabilities,
                simValues, completed, simVariables, simWaiting, step.id, simDecisions);
            if (failed.error) { simStatus.textContent = failed.error; return; }
            recordTrace(step.id, 'wait-timed-out'); simFailure = failed; simulate();
          });
          row.append(expire);
        }
      }
      simSteps.append(row);
    }
    simStatus.textContent = simFailure ? 'Simulation failed: ' + simFailure.code + '. ' +
        (simFailure.code === 'native-outcome-unknown' ? 'In a real run, the action may have happened; inspect the actual result before starting again. ' : '') +
        'No next action ran. Reset to try a fresh run.' :
        result.pending ? `${result.pending} simulated steps remaining.` : 'Simulation complete. No action was executed.';
    for (const output of simFailure ? [] : result.outputs) {
      const row = document.createElement('li'); row.dataset.simulationOutput = output.id;
      row.textContent = output.name + ' · ' + output.type + ' — ' +
          (output.protected ? output.hasValue ? 'Protected result (masked)' : 'Protected result not set' :
           output.hasValue ? output.value : 'Not set');
      simOutputs.append(row);
    }
  };
  const refresh = () => {
    ++simulationEpoch;
    const current = state(), selected = stepChoice.value;
    options(stepChoice, (current?.workflow.steps || []).map(step => [step.id, step.name]), selected);
    stepChoice.disabled = !writable() || !current;
    refreshCondition();
    refreshOutputs(current);
    refreshCompensation(current);
    refreshVariables(current);
    refreshRepeat();
    simValues.clear(); simVariables.clear(); simDecisions.clear(); simWaiting.clear(); simFailure = null; completed.clear(); simInputs.replaceChildren(); simSteps.replaceChildren(); simOutputs.replaceChildren();
    clearTrace();
    simStatus.textContent = 'Ready to simulate.';
    get('simulate').disabled = !current;
    const sourceSnapshot = source.value, workflowId = current?.workflow.id;
    for (const input of current?.workflow.inputs || []) {
      const label = document.createElement('label');
      label.textContent = input.name + (input.required ? ' (required)' : '') +
          (input.protected ? ' (protected ' + input.type + '; dummy values only, not saved)' : '');
      const values = choices(input), control = document.createElement(values.length ? 'select' : 'input');
      if (values.length) options(control, [['', 'Choose a value'], ...values.map(value => [value, value])]);
      else {
        control.type = input.protected ? 'password' : ['number', 'date', 'url'].includes(input.type) ? input.type : 'text';
        control.maxLength = 256;
        if (input.type === 'number') control.step = 'any';
        if (input.type === 'date') { control.min = '0001-01-01'; control.max = '9999-12-31'; }
      }
      control.autocomplete = input.protected ? 'new-password' : 'off'; control.dataset.simulationInput = input.id;
      control.addEventListener('change', () => {
        if (!control.isConnected || source.value !== sourceSnapshot || state()?.workflow.id !== workflowId) return;
        ++simulationEpoch;
        simValues.set(input.id, control.value);
        if (input.protected) control.value = '';
        completed.clear(); simVariables.clear(); simDecisions.clear(); simWaiting.clear(); simFailure = null; clearTrace(); simulate();
      });
      label.append(control); simInputs.append(label);
    }
  };
  stepChoice.addEventListener('change', refreshCondition);
  inputChoice.addEventListener('change', () => refreshValues());
  get('simulate').addEventListener('click', simulate);
  get('simulation-reset').addEventListener('click', refresh);
  source.addEventListener('input', refresh);
  source.addEventListener('tahai-workflow-selection', () => { outputName.value = ''; compensationName.value = ''; refresh(); });
  refresh();
})();
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_TOOLS_H_
