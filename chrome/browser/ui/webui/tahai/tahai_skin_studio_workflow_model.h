// Copyright 2026 TAHAI Web Services
// SPDX-License-Identifier: Apache-2.0

#ifndef CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_MODEL_H_
#define CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_MODEL_H_

namespace tahai {

// Draft-only selection and transformations. This resource has no native
// messages, network, storage, command dispatch, or access to live run values.
// Native package validation is still required before any draft is saved.
inline constexpr char kSkinStudioWorkflowModelJs[] = R"TAHAI(
(() => {
  'use strict';
  const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const fields = (value, allowed) => record(value) && Object.keys(value).every(key => allowed.includes(key));
  const id = value => typeof value === 'string' && value.length >= 3 && value.length <= 64 &&
      /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/.test(value);
  const label = value => typeof value === 'string' && value.length >= 1 && value.length <= 128 &&
      /^[\x20-\x7e]+$/.test(value) && !/["\\<>]/.test(value);
  const option = value => label(value) && !/[:@]/.test(value);
  const actions = Object.freeze({
    'address.focus': 'browser-navigation', 'tabs.find': 'workspace-layout',
    'workspaces.open': 'workspace-layout', 'mission.open': 'mission-checklist',
    'guard.open': 'guard-control', 'layout.one': 'workspace-layout',
    'layout.dual': 'workspace-layout', 'layout.tri': 'workspace-layout',
    'layout.quad': 'workspace-layout', 'layout.focus': 'workspace-layout'
  });
  const valueChoices = input => input?.type === 'boolean' ? ['true', 'false'] :
      input?.type === 'selection' && Array.isArray(input.options) ? input.options : [];
  const choices = input => input?.protected ? [] : valueChoices(input);
  const validRules = input => {
    if (!own(input, 'validation')) return true;
    const r = input.validation, length = ['text', 'url'].includes(input.type);
    const keys = length ? ['min_bytes', 'max_bytes'] : input.type === 'number' ? ['minimum', 'maximum'] : [];
    if (!fields(r, keys) || !Object.keys(r).length) return false;
    if (length) return Object.values(r).every(Number.isInteger) &&
        (r.min_bytes ?? 0) >= 0 && (r.max_bytes ?? 256) >= 1 &&
        (r.max_bytes ?? 256) <= 256 && (r.min_bytes ?? 0) <= (r.max_bytes ?? 256);
    return Object.values(r).every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 1e12) &&
        (r.minimum ?? -1e12) <= (r.maximum ?? 1e12);
  };
  const matchesRules = (input, value) => {
    if (!validRules(input)) return false;
    const r = input.validation;
    if (!r || !value) return true;
    if (input.type === 'number') return Number.isFinite(Number(value)) &&
        (!own(r, 'minimum') || Number(value) >= r.minimum) &&
        (!own(r, 'maximum') || Number(value) <= r.maximum);
    const bytes = new TextEncoder().encode(value).length;
    return bytes >= (r.min_bytes ?? 0) && bytes <= (r.max_bytes ?? 256);
  };
  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split('-').map(Number);
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return year >= 1 && month >= 1 && month <= 12 && day >= 1 &&
        day <= days[month - 1] + (month === 2 && leap ? 1 : 0);
  };
  const validUrl = value => {
    if (!/^[\x21-\x7e]+$/.test(value) || value.includes('\\')) return false;
    const authority = value.match(/^https?:\/\/([^/?#]+)/i)?.[1];
    if (!authority || authority.includes('@')) return false;
    try {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password;
    } catch { return false; }
  };
  const calculationArity = Object.freeze({add: 2, subtract: 2, multiply: 2, divide: 2, min: 2, max: 2, abs: 1, negate: 1});
  const numericComparisons = Object.freeze({equal: (a, b) => a === b, 'not-equal': (a, b) => a !== b,
    'less-than': (a, b) => a < b, 'at-most': (a, b) => a <= b, 'greater-than': (a, b) => a > b, 'at-least': (a, b) => a >= b});
  const validComparison = compare => fields(compare, ['op', 'number']) && Object.keys(compare).length === 2 &&
      typeof compare.op === 'string' && own(numericComparisons, compare.op) &&
      typeof compare.number === 'number' && Number.isFinite(compare.number) && Math.abs(compare.number) <= 1e12;
  const compound = node => record(node) && ['all', 'any', 'not'].some(key => own(node, key));
  const recordsCondition = node => Boolean(node?.variable || compound(node));
  const validCondition = (condition, inputs, variables) => {
    let count = 0;
    const visit = (node, depth) => {
      if (depth > 5 || ++count > 31 || !record(node)) return false;
      if (compound(node)) {
        const op = Object.keys(node)[0];
        if (Object.keys(node).length !== 1 || !['all', 'any', 'not'].includes(op)) return false;
        if (op === 'not') return visit(node.not, depth + 1);
        return Array.isArray(node[op]) && node[op].length >= 2 && node[op].length <= 8 && node[op].every(child => visit(child, depth + 1));
      }
      if (!fields(node, ['input', 'variable', 'equals', 'compare']) || Object.keys(node).length !== 2 ||
          own(node, 'input') === own(node, 'variable')) return false;
      const key = own(node, 'variable') ? 'variable' : 'input', origins = key === 'variable' ? variables : inputs;
      const input = origins.find(item => item.id === node[key]);
      if (!id(node[key]) || !input || input.protected) return false;
      return own(node, 'compare') ? input.type === 'number' && validComparison(node.compare) :
          option(node.equals) && choices(input).includes(node.equals);
    };
    return visit(condition, 1);
  };
  const usesConditionSource = (condition, kind, sourceId) => {
    let count = 0;
    const visit = (node, depth = 1) => {
      if (!record(node) || depth > 5 || ++count > 31) return false;
      if (node[kind] === sourceId) return true;
      return own(node, 'not') ? visit(node.not, depth + 1) :
          [...(Array.isArray(node.all) ? node.all : []), ...(Array.isArray(node.any) ? node.any : [])].some(child => visit(child, depth + 1));
    };
    return visit(condition);
  };
  const evaluateCondition = (node, values, variables) => {
    if (!node) return true;
    if (compound(node)) {
      const op = Object.keys(node)[0], results = (op === 'not' ? [node.not] : node[op]).map(child => evaluateCondition(child, values, variables));
      if (results.includes(null)) return null;
      return op === 'not' ? !results[0] : op === 'all' ? results.every(Boolean) : results.some(Boolean);
    }
    const value = (node.variable ? variables : values).get(node.variable || node.input);
    if (!value) return null;
    return node.compare ? numericComparisons[node.compare.op](Number(value), node.compare.number) : value === node.equals;
  };
  const validExpression = (expression, inputs, variables) => {
    let count = 0;
    const visit = (node, depth) => {
      if (depth > 5 || ++count > 31 || !record(node)) return false;
      if (Object.keys(node).length === 1) {
        if (own(node, 'number')) return typeof node.number === 'number' && Number.isFinite(node.number) && Math.abs(node.number) <= 1e12;
        const variable = own(node, 'variable'), source = variable ? variables : inputs, key = variable ? 'variable' : 'input';
        const item = source.find(item => item.id === node[key]);
        return fields(node, [key]) && id(node[key]) && item?.type === 'number' && !item.protected;
      }
      return fields(node, ['op', 'args']) && typeof node.op === 'string' && own(calculationArity, node.op) && Array.isArray(node.args) &&
          node.args.length === calculationArity[node.op] && node.args.every(item => visit(item, depth + 1));
    };
    return visit(expression, 1);
  };
  const textArity = Object.freeze({concat: 2, 'trim-space': 1, 'lower-ascii': 1, 'upper-ascii': 1, replace: 3});
  const expressionText = value => typeof value === 'string' && new TextEncoder().encode(value).length <= 256 &&
      !/[\x00-\x1f\x7f]/.test(value) && !/[\ud800-\udfff\ufdd0-\ufdef]/u.test(value) &&
      [...value].every(c => (c.codePointAt(0) & 0xffff) < 0xfffe);
  const validTextExpression = (expression, inputs, variables) => {
    let count = 0;
    const visit = (node, depth) => {
      if (depth > 5 || ++count > 31 || !record(node)) return false;
      if (Object.keys(node).length === 1) {
        if (own(node, 'text')) return expressionText(node.text);
        const key = own(node, 'variable') ? 'variable' : 'input';
        const item = (key === 'variable' ? variables : inputs).find(item => item.id === node[key]);
        return fields(node, [key]) && id(node[key]) && item?.type === 'text' && !item.protected;
      }
      return fields(node, ['op', 'args']) && typeof node.op === 'string' && own(textArity, node.op) &&
          Array.isArray(node.args) && node.args.length === textArity[node.op] && node.args.every(item => visit(item, depth + 1));
    };
    return visit(expression, 1);
  };
  const usesAssignmentSource = (assignment, kind, sourceId) => {
    if (assignment?.from?.[kind] === sourceId) return true;
    const visit = (node, depth = 1) => record(node) && depth <= 5 &&
        (node[kind] === sourceId || Array.isArray(node.args) && node.args.some(item => visit(item, depth + 1)));
    return visit(assignment?.expression) || visit(assignment?.text_expression) || usesConditionSource(assignment?.boolean_expression, kind, sourceId);
  };
  const expand = workflow => {
    if (!record(workflow) || !Array.isArray(workflow.steps) || !workflow.steps.length || workflow.steps.length > 32) return null;
    const repeats = own(workflow, 'repeats') ? workflow.repeats : [];
    if (!Array.isArray(repeats) || repeats.length > 8) return null;
    const authored = new Set(), claimed = new Set(), repeatIds = new Set(), ranges = new Map();
    for (const step of workflow.steps) {
      if (!record(step) || !id(step.id) || !label(step.name) || authored.has(step.id)) return null;
      authored.add(step.id);
    }
    let size = workflow.steps.length;
    for (const repeat of repeats) {
      if (!fields(repeat, ['id', 'from', 'through', 'count']) || Object.keys(repeat).length !== 4 ||
          !id(repeat.id) || !id(repeat.from) || !id(repeat.through) || repeatIds.has(repeat.id) ||
          !Number.isInteger(repeat.count) || repeat.count < 2 || repeat.count > 8) return null;
      repeatIds.add(repeat.id);
      const first = workflow.steps.findIndex(step => step.id === repeat.from), last = workflow.steps.findIndex(step => step.id === repeat.through);
      if (first < 0 || last < first) return null;
      size += (last - first + 1) * (repeat.count - 1);
      if (size > 32) return null;
      for (let i = first; i <= last; ++i) { if (claimed.has(i)) return null; claimed.add(i); }
      ranges.set(first, {last, repeat});
    }
    const steps = [], expandedIds = new Set(), preceding = new Map();
    const append = (step, authoredId) => {
      if (step.assign?.from?.action_status) {
        const source = preceding.get(step.assign.from.action_status); if (!source) return false;
        step.assign = {...step.assign, from: {action_status: source}};
      }
      preceding.set(authoredId, step.id); steps.push(step); return true;
    };
    for (let i = 0; i < workflow.steps.length;) {
      const range = ranges.get(i);
      if (!range) { if (!append({...workflow.steps[i]}, workflow.steps[i].id)) return null; ++i; continue; }
      for (let iteration = 1; iteration <= range.repeat.count; ++iteration) for (let j = i; j <= range.last; ++j) {
        const step = {...workflow.steps[j], id: `r-${range.repeat.id}-${iteration}-${workflow.steps[j].id}`,
          name: `[${iteration}/${range.repeat.count}] ${workflow.steps[j].name}`};
        if (!id(step.id) || !label(step.name) || authored.has(step.id) || expandedIds.has(step.id)) return null;
        expandedIds.add(step.id); if (!append(step, workflow.steps[j].id)) return null;
      }
      i = range.last + 1;
    }
    return steps;
  };
  const validate = (workflow, capabilities) => {
    if (!fields(workflow, ['id', 'name', 'inputs', 'steps', 'outputs', 'variables', 'repeats', 'compensation_steps']) || !id(workflow.id) || !label(workflow.name) ||
        !Array.isArray(capabilities) || !Array.isArray(workflow.steps) || !workflow.steps.length ||
        workflow.steps.length > 32 || (own(workflow, 'inputs') && !Array.isArray(workflow.inputs))) return false;
    const inputs = workflow.inputs || [];
    const variables = own(workflow, 'variables') ? workflow.variables : [];
    if (!Array.isArray(variables) || variables.length > 12 ||
        new Set(variables.map(variable => variable?.id)).size !== variables.length ||
        !variables.every(variable => fields(variable, ['id', 'name', 'type', 'options', 'validation', 'protected']))) return false;
    if (inputs.length > 12 || new Set(inputs.map(input => input?.id)).size !== inputs.length) return false;
    for (const input of [...inputs, ...variables.map(variable => ({...variable, required: false}))]) {
      if (!fields(input, ['id', 'name', 'type', 'required', 'options', 'protected', 'validation']) || !id(input.id) || !label(input.name) ||
          (own(input, 'protected') && typeof input.protected !== 'boolean') ||
          !validRules(input) ||
          !['text', 'number', 'boolean', 'selection', 'date', 'url'].includes(input.type) || typeof input.required !== 'boolean') return false;
      if (input.type === 'selection') {
        if (!Array.isArray(input.options) || !input.options.length || input.options.length > 12 ||
            !input.options.every(option) || new Set(input.options).size !== input.options.length) return false;
      } else if (own(input, 'options')) return false;
    }
    const outputs = own(workflow, 'outputs') ? workflow.outputs : [];
    if (!Array.isArray(outputs) || outputs.length > 12 || new Set(outputs.map(output => output?.id)).size !== outputs.length ||
        !outputs.every(output => fields(output, ['id', 'name', 'from']) && id(output.id) && label(output.name) &&
            fields(output.from, ['input', 'variable']) && Object.keys(output.from).length === 1 &&
            (own(output.from, 'variable') ? variables : inputs).some(input =>
                id(output.from.variable ?? output.from.input) && input.id === (output.from.variable ?? output.from.input)))) return false;
    // Recovery items are intentionally just bounded human review labels. They
    // do not identify an action, site, provider, wait, value, or compensation
    // command, and are never available to the simulation executor.
    const compensation = own(workflow, 'compensation_steps') ? workflow.compensation_steps : [];
    if (!Array.isArray(compensation) || (own(workflow, 'compensation_steps') &&
        (!compensation.length || compensation.length > 8)) ||
        new Set(compensation.map(item => item?.id)).size !== compensation.length ||
        !compensation.every(item => fields(item, ['id', 'name']) && Object.keys(item).length === 2 &&
            id(item.id) && label(item.name))) return false;
    if (!expand(workflow)) return false;
    return workflow.steps.every((step, stepIndex) => {
      if (!fields(step, ['id', 'name', 'kind', 'action', 'when', 'assign', 'wait']) || !id(step.id) || !label(step.name) ||
          !['instruction', 'checkpoint', 'run-command', 'assign-variable', 'wait'].includes(step.kind)) return false;
      if (step.kind === 'run-command') {
        if (typeof step.action !== 'string' || !own(actions, step.action) ||
            !capabilities.includes(actions[step.action])) return false;
      } else if (own(step, 'action')) return false;
      if (step.kind === 'assign-variable') {
        const assign = step.assign;
        if (!fields(assign, ['variable', 'from', 'expression', 'text_expression', 'boolean_expression']) || !id(assign.variable) || Object.keys(assign).length !== 2) return false;
        const target = variables.find(variable => variable.id === assign.variable);
        if (own(assign, 'boolean_expression')) {
          if (target?.type !== 'boolean' || target.protected || !record(assign.boolean_expression) ||
              !validCondition(assign.boolean_expression, inputs, variables)) return false;
        } else if (own(assign, 'text_expression')) {
          if (target?.type !== 'text' || target.protected || !validTextExpression(assign.text_expression, inputs, variables)) return false;
        } else if (own(assign, 'expression')) {
          if (target?.type !== 'number' || target.protected || !validExpression(assign.expression, inputs, variables)) return false;
        } else {
          if (!fields(assign.from, ['input', 'variable', 'action_status']) || Object.keys(assign.from).length !== 1) return false;
          if (own(assign.from, 'action_status')) {
            if (!id(assign.from.action_status) || !target || target.protected || !['text','selection'].includes(target.type) ||
                !workflow.steps.slice(0,stepIndex).some(item=>item.id===assign.from.action_status && item.kind==='run-command')) return false;
          } else {
            const sourceId = assign.from.variable ?? assign.from.input;
            const origin = (own(assign.from, 'variable') ? variables : inputs).find(item => item.id === sourceId);
            if (!id(sourceId) || !target || !origin || origin.protected && !target.protected || target.type !== origin.type) return false;
          }
        }
      } else if (own(step, 'assign')) return false;
      if (step.kind === 'wait') {
        if (!fields(step.wait, ['seconds', 'timeout_seconds']) || !Number.isInteger(step.wait.seconds) ||
            step.wait.seconds < 1 || step.wait.seconds > 86400) return false;
        if (own(step.wait, 'timeout_seconds') && (!Number.isInteger(step.wait.timeout_seconds) ||
            step.wait.timeout_seconds <= step.wait.seconds || step.wait.timeout_seconds > 86400)) return false;
      } else if (own(step, 'wait')) return false;
      if (!own(step, 'when')) return true;
      return validCondition(step.when, inputs, variables);
    });
  };
  const parse = text => {
    try {
      if (typeof text !== 'string' || text.length > 65536 || new TextEncoder().encode(text).length > 65536) return null;
      const parsed = JSON.parse(text), operational = parsed?.operational;
      if (parsed?.schema_version !== 2 || !record(operational) || !Array.isArray(operational.workflows) ||
          !operational.workflows.length || operational.workflows.length > 24 ||
          !operational.workflows.every(workflow => validate(workflow, operational.capabilities)) ||
          new Set(operational.workflows.map(workflow => workflow.id)).size !== operational.workflows.length ||
          !Array.isArray(operational.modes) || !operational.modes.length || operational.modes.length > 12 ||
          !operational.modes.every(mode => record(mode) && id(mode.id) && label(mode.name) &&
              operational.workflows.some(workflow => workflow.id === mode.workflow)) ||
          new Set(operational.modes.map(mode => mode.id)).size !== operational.modes.length) return null;
      return parsed;
    } catch { return null; }
  };
  const encode = parsed => {
    const text = JSON.stringify(parsed, null, 2);
    return parse(text) ? text : null;
  };
  // Local starter definitions only. No entered values, sites, permissions,
  // provider configuration, external effects or live run state are copied.
  const workflowTemplates = [
    {id: 'research', name: 'Research desk', description: 'Frame a question, manually review sources and prepare a brief. No page content is captured.',
      inputs: [{id: 'question', name: 'Research question', type: 'text', required: true}],
      steps: [{id: 'scope', name: 'Review the research question', kind: 'checkpoint'},
        {id: 'sources', name: 'Manually review chosen sources in browser tabs', kind: 'instruction'},
        {id: 'compare', name: 'Compare findings and note uncertainty', kind: 'checkpoint'},
        {id: 'brief', name: 'Review your brief before exporting it separately', kind: 'checkpoint'}],
      outputs: [{id: 'question-result', name: 'Research question', from: {input: 'question'}}]},
    {id: 'creator', name: 'Creator studio', description: 'Develop a brief and review creative work. Publishing remains a separate manual website action, not an adapter invocation.',
      inputs: [{id: 'brief', name: 'Creative brief', type: 'text', required: true},
        {id: 'publish', name: 'Plan a separate manual publishing review', type: 'boolean', required: true}],
      steps: [{id: 'assets', name: 'Gather references and check usage rights', kind: 'instruction'},
        {id: 'create', name: 'Create your work in your chosen editor', kind: 'checkpoint'},
        {id: 'review', name: 'Review quality and privacy before sharing', kind: 'checkpoint'},
        {id: 'publish-review', name: 'Review publication separately on your chosen site', kind: 'instruction', when: {input: 'publish', equals: 'true'}}],
      outputs: [{id: 'brief-result', name: 'Creative brief', from: {input: 'brief'}}]},
    {id: 'planning', name: 'Personal planning', description: 'Collect priorities and record a plan using a local checklist. No calendar or account access.',
      inputs: [{id: 'priority', name: 'Main priority', type: 'text', required: true},
        {id: 'horizon', name: 'Planning horizon', type: 'selection', required: true, options: ['Today', 'This week']}],
      steps: [{id: 'collect', name: 'Collect priorities without entering secrets', kind: 'checkpoint'},
        {id: 'compare', name: 'Manually compare commitments and available time', kind: 'instruction'},
        {id: 'plan', name: 'Record your plan in your chosen tool', kind: 'checkpoint'},
        {id: 'follow-up', name: 'Record a follow-up outside this checklist', kind: 'checkpoint'}],
      outputs: [{id: 'priority-result', name: 'Priority', from: {input: 'priority'}}]},
    {id: 'learning', name: 'Learning space', description: 'Choose a lesson, practice and review progress. The workflow does not read a course account or grade your work.',
      inputs: [{id: 'lesson', name: 'Lesson topic', type: 'text', required: true},
        {id: 'extra-practice', name: 'Include extra practice', type: 'boolean', required: true}],
      steps: [{id: 'choose', name: 'Choose a lesson and learning objective', kind: 'checkpoint'},
        {id: 'practice', name: 'Complete exercises on your chosen learning site', kind: 'instruction'},
        {id: 'extra', name: 'Complete an additional practice exercise', kind: 'instruction', when: {input: 'extra-practice', equals: 'true'}},
        {id: 'review', name: 'Review what you learned and record the next topic', kind: 'checkpoint'}],
      outputs: [{id: 'lesson-result', name: 'Lesson topic', from: {input: 'lesson'}}]},
    {id: 'operations', name: 'Operations console', description: 'Review scope, inspect manually, validate and prepare a handoff. No diagnostics, remote writes or credential access are started.',
      inputs: [{id: 'scope', name: 'Work scope without secrets', type: 'text', required: true}],
      steps: [{id: 'scope-review', name: 'Confirm scope and independent authorization', kind: 'checkpoint'},
        {id: 'inspect', name: 'Manually inspect the chosen system and documentation', kind: 'instruction'},
        {id: 'validate', name: 'Validate the outcome and review recovery options', kind: 'checkpoint'},
        {id: 'handoff', name: 'Prepare and redact a handoff for separate review', kind: 'checkpoint'}],
      outputs: [{id: 'scope-result', name: 'Reviewed scope', from: {input: 'scope'}}]},
    {id: 'focus', name: 'Blank focus checklist', description: 'One local checkpoint to customize. This starter does not change layout, accessibility settings or browser controls.',
      inputs: [], steps: [{id: 'focus', name: 'Choose one task and review its completion', kind: 'checkpoint'}]}
  ];
  const templates = () => JSON.parse(JSON.stringify(workflowTemplates));
  const uniqueId = (name, items) => {
    const stem = 'workflow-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 44).replace(/-+$/g, '');
    const base = stem.endsWith('-') ? stem + 'new' : stem;
    const ids = new Set(items.map(item => item.id));
    if (!ids.has(base)) return base;
    for (let suffix = 2; suffix <= 25; ++suffix) if (!ids.has(base + '-' + suffix)) return base + '-' + suffix;
    return null;
  };
  // Failure returns no modified document. A stale selection never edits the
  // first workflow as a fallback; changing the selection is a separate action.
  const mutate = (text, selectedId, operation, value) => {
    const parsed = parse(text);
    if (!parsed) return {error: 'Fix the workflow source before editing its definitions.'};
    const workflows = parsed.operational.workflows, workflow = workflows.find(item => item.id === selectedId);
    if (!workflow) return {error: 'Select an existing workflow first.'};
    let selected = selectedId;
    if (operation === 'template') {
      const template = workflowTemplates.find(item => item.id === value);
      if (!template) return {error: 'Choose an available local workflow starter.'};
      if (workflows.length >= 24) return {error: 'A package supports up to 24 workflows.'};
      selected = uniqueId(template.name, workflows);
      if (!selected) return {error: 'Choose a more distinct workflow name.'};
      const next = JSON.parse(JSON.stringify(template));
      delete next.description; next.id = selected; workflows.push(next);
    } else if (operation === 'create' || operation === 'copy') {
      if (!label(value)) return {error: 'Use a name of 1–128 printable characters, without quotes, backslashes or angle brackets.'};
      if (workflows.length >= 24) return {error: 'A package supports up to 24 workflows.'};
      selected = uniqueId(value, workflows);
      if (!selected) return {error: 'Choose a more distinct workflow name.'};
      const next = operation === 'copy' ? JSON.parse(JSON.stringify(workflow)) :
          {inputs: [], steps: [{id: 'review', name: 'Review the result', kind: 'checkpoint'}]};
      next.id = selected; next.name = value;
      workflows.push(next);
    } else if (operation === 'remove') {
      if (workflows.length === 1) return {error: 'Keep at least one workflow in the package.'};
      if (parsed.operational.modes.some(mode => mode.workflow === selectedId))
        return {error: 'Assign another workflow to every mode using this one before removing it.'};
      const index = workflows.indexOf(workflow);
      workflows.splice(index, 1);
      selected = workflows[Math.min(index, workflows.length - 1)].id;
    } else if (operation === 'bind') {
      const mode = parsed.operational.modes.find(item => item.id === value);
      if (!mode) return {error: 'Select an existing mode first.'};
      mode.workflow = selectedId;
    } else return {error: 'Unknown workflow edit.'};
    if (!encode(parsed)) return {error: 'This edit exceeds the Studio source limit. No source was changed.'};
    return {parsed, selected};
  };
  // A blank input referenced by a condition is unresolved, not false. The
  // local simulator must not announce success by skipping an unanswered branch.
  const validValue = (input, value) => typeof value === 'string' &&
      new TextEncoder().encode(value).length <= 256 && !/[\x00-\x1f\x7f]/.test(value) && matchesRules(input, value) &&
      (input.protected || !/authorization:|bearer |basic |set-cookie:|cookie:|access_token|refresh_token|api_key|client_secret|password=|session=|oauth/i.test(value)) &&
      (!value || (input.type === 'number' ? /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) :
        input.type === 'date' ? validDate(value) : input.type === 'url' ? validUrl(value) :
        valueChoices(input).length ? valueChoices(input).includes(value) : input.protected || !/[:@\\]|\/\//.test(value)));
  const simulate = (workflow, capabilities, values, completed, variables = new Map(), waiting = new Set(), decisions = new Map()) => {
    if (!validate(workflow, capabilities) || !(values instanceof Map) || !(completed instanceof Set))
      return {error: 'Enter a valid workflow first.'};
    workflow = {...workflow, steps: expand(workflow), repeats: []};
    if ([...completed].some(id => !workflow.steps.some(step => step.id === id))) return {error: 'Invalid completed step identity.'};
    const missing = [], invalid = [];
    for (const input of workflow.inputs || []) {
      const value = values.has(input.id) ? values.get(input.id) : '';
      if (!validValue(input, value)) {
        invalid.push(input.name); continue;
      }
      if (!value && (input.required || workflow.steps.some(step => usesConditionSource(step.when, 'input', input.id)))) missing.push(input.name);
    }
    if (invalid.length) return {error: 'Check the type, validation limits and allowed value for: ' + invalid.join(', ')};
    if (missing.length) return {missing};
    if (!(variables instanceof Map) || [...variables].some(([id, value]) => {
      const definition = workflow.variables?.find(item => item.id === id);
      return !definition || !validValue(definition, value);
    })) return {error: 'Invalid local variable state.'};
    if (!(waiting instanceof Set) || waiting.size > 1 || [...waiting].some(id =>
        completed.has(id) || !workflow.steps.some(step => step.id === id && step.kind === 'wait')))
      return {error: 'Invalid simulated wait state.'};
    if (!(decisions instanceof Map) || [...decisions].some(([id, result]) => typeof result !== 'boolean' ||
        !workflow.steps.some(step => step.id === id && recordsCondition(step.when)))) return {error: 'Invalid recorded branch state.'};
    const steps = workflow.steps.map(step => {
      const recorded = decisions.has(step.id), decision = recorded ? decisions.get(step.id) : evaluateCondition(step.when, values, variables);
      const resolved = decision !== null;
      return {id: step.id, name: step.name, kind: step.kind, action: step.action, resolved, recorded,
      waitSeconds: step.wait?.seconds, waitTimeoutSeconds: step.wait?.timeout_seconds, waiting: waiting.has(step.id),
      available: resolved && decision,
      complete: completed.has(step.id)};
    });
    if (steps.some((step, index) => (step.complete || step.waiting) &&
        workflow.steps.slice(0, index + 1).some(item => recordsCondition(item.when) && !decisions.has(item.id))) ||
        steps.some(step => (step.complete || step.waiting) && step.recorded && !step.available))
      return {error: 'Missing or contradictory recorded branch state.'};
    if (steps.some((step, index) => step.waiting && (!step.available ||
        steps.slice(0, index).some(previous => previous.available && !previous.complete))))
      return {error: 'Invalid simulated wait order or branch.'};
    const pending = steps.filter(step => !step.resolved || step.available && !step.complete).length;
    const outputs = pending ? [] : (workflow.outputs || []).map(output => {
      const input = (output.from.variable ? workflow.variables : workflow.inputs).find(
          input => input.id === (output.from.variable || output.from.input));
      const value = (output.from.variable ? variables : values).get(input.id) || '';
      return {id: output.id, name: output.name, type: input.type, protected: Boolean(input.protected),
        hasValue: Boolean(value), value: input.protected ? '' : value};
    });
    return {steps, pending, outputs};
  };
  const calculate = (expression, values, variables) => {
    if (!expression.op) {
      const text = own(expression, 'number') ? null : (expression.variable ? variables : values).get(expression.variable || expression.input);
      if (!own(expression, 'number') && !text) return {error: 'missing-number'};
      const value = own(expression, 'number') ? expression.number : Number(text);
      return Number.isFinite(value) && Math.abs(value) <= 1e12 ? {value} : {error: 'number-out-of-range'};
    }
    const first = calculate(expression.args[0], values, variables);
    if (first.error) return first;
    const second = expression.args.length === 2 ? calculate(expression.args[1], values, variables) : null;
    if (second?.error) return second;
    const a = first.value, b = second?.value;
    if (expression.op === 'divide' && b === 0) return {error: 'division-by-zero'};
    const value = expression.op === 'add' ? a + b : expression.op === 'subtract' ? a - b :
        expression.op === 'multiply' ? a * b : expression.op === 'divide' ? a / b :
        expression.op === 'min' ? Math.min(a, b) : expression.op === 'max' ? Math.max(a, b) :
        expression.op === 'abs' ? Math.abs(a) : -a;
    return Number.isFinite(value) && Math.abs(value) <= 1e12 ? {value} : {error: 'number-out-of-range'};
  };
  const calculateText = (expression, values, variables) => {
    if (!expression.op) {
      const value = own(expression, 'text') ? expression.text : (expression.variable ? variables : values).get(expression.variable || expression.input);
      if (value === undefined || !own(expression, 'text') && !value) return {error: 'missing-text'};
      return expressionText(value) ? {value} : {error: 'invalid-text'};
    }
    const args = [];
    for (const child of expression.args) {
      const result = calculateText(child, values, variables);
      if (result.error) return result;
      args.push(result.value);
    }
    let value = args[0];
    if (expression.op === 'concat') value += args[1];
    else if (expression.op === 'trim-space') value = value.replace(/^ +| +$/g, '');
    else if (expression.op === 'lower-ascii') value = value.replace(/[A-Z]/g, c => c.toLowerCase());
    else if (expression.op === 'upper-ascii') value = value.replace(/[a-z]/g, c => c.toUpperCase());
    else if (expression.op === 'replace') {
      if (!args[1]) return {error: 'empty-search'};
      value = ''; let offset = 0;
      for (;;) {
        const found = args[0].indexOf(args[1], offset), end = found < 0 ? args[0].length : found;
        value += args[0].slice(offset, end);
        if (new TextEncoder().encode(value).length > 256) return {error: 'result-too-long'};
        if (found < 0) break;
        value += args[2];
        if (new TextEncoder().encode(value).length > 256) return {error: 'result-too-long'};
        offset = found + args[1].length;
      }
    }
    return new TextEncoder().encode(value).length <= 256 ? {value} : {error: 'result-too-long'};
  };
  const calculationText = value => {
    const raw = String(value), match = raw.match(/^(-?)(\d+)(?:\.(\d+))?e([+-]?\d+)$/i);
    if (!match) return raw;
    const [, sign, whole, fraction = '', exp] = match, exponent = Number(exp);
    if (exponent < -254 || exponent > 12) return null;
    const digits = whole + fraction, position = whole.length + exponent;
    const result = sign + (position <= 0 ? '0.' + '0'.repeat(-position) + digits :
        position >= digits.length ? digits + '0'.repeat(position - digits.length) :
        digits.slice(0, position) + '.' + digits.slice(position));
    return result.length <= 256 ? result : null;
  };
  const freezeDecisions = (workflow, steps, index, decisions) => {
    const next = new Map(decisions);
    const expanded = expand(workflow);
    for (let i = 0; i <= index; ++i) if (recordsCondition(expanded[i].when)) next.set(steps[i].id, steps[i].available);
    return next;
  };
  const assign = (workflow, capabilities, values, completed, variables, stepId, decisions = new Map()) => {
    const result = simulate(workflow, capabilities, values, completed, variables, new Set(), decisions);
    if (!result.steps) return {error: result.error || 'Answer required inputs first.'};
    const expanded = expand(workflow), index = expanded.findIndex(step => step.id === stepId);
    if (!result.steps || index < 0 || !result.steps[index].available || completed.has(stepId) ||
        result.steps.slice(0, index).some(step => !step.resolved || step.available && !step.complete)) return {error: 'Complete preceding applicable steps first.'};
    const step = expanded[index];
    if (step.kind !== 'assign-variable') return {error: 'This is not an assignment step.'};
    const target = workflow.variables.find(item => item.id === step.assign.variable);
    const from = step.assign.from;
    let value;
    if (step.assign.boolean_expression) {
      const decision = evaluateCondition(step.assign.boolean_expression, values, variables);
      if (decision === null) return {error: 'Calculation unavailable: missing-condition-value'};
      value = decision ? 'true' : 'false';
    } else if (step.assign.text_expression) {
      const calculation = calculateText(step.assign.text_expression, values, variables);
      if (calculation.error) return {error: 'Calculation unavailable: ' + calculation.error};
      value = calculation.value;
    } else if (step.assign.expression) {
      const calculation = calculate(step.assign.expression, values, variables);
      if (calculation.error) return {error: 'Calculation unavailable: ' + calculation.error};
      value = calculationText(calculation.value);
      if (value === null) return {error: 'Calculation unavailable: result-too-long'};
    } else if (from.action_status) {
      if (!completed.has(from.action_status)) return {error: 'The source action has no completed simulated dispatch.'};
      value = 'dispatched';
    } else value = (from.variable ? variables : values).get(from.variable || from.input) || '';
    if (!validValue(target, value)) return {error: 'Source value does not satisfy the variable type or limits.'};
    const nextVariables = new Map(variables), nextCompleted = new Set(completed);
    nextVariables.set(target.id, value); nextCompleted.add(stepId);
    return {variables: nextVariables, completed: nextCompleted, decisions: freezeDecisions(workflow, result.steps, index, decisions)};
  };
  const advance = (workflow, capabilities, values, completed, variables, waiting, stepId, decisions = new Map()) => {
    const result = simulate(workflow, capabilities, values, completed, variables, waiting, decisions);
    const index = result.steps?.findIndex(step => step.id === stepId) ?? -1, step = result.steps?.[index];
    if (!step || !step.available || step.complete || ['assign-variable', 'wait'].includes(step.kind) ||
        result.steps.slice(0, index).some(previous => !previous.resolved ||
          step.kind === 'run-command' && previous.available && !previous.complete)) return {error: 'Resolve preceding branches and applicable steps first.'};
    return {completed: new Set([...completed, stepId]), decisions: freezeDecisions(workflow, result.steps, index, decisions)};
  };
  const wait = (workflow, capabilities, values, completed, variables, waiting, stepId, complete, decisions = new Map()) => {
    if (typeof complete !== 'boolean') return {error: 'Choose start or completion explicitly.'};
    const result = simulate(workflow, capabilities, values, completed, variables, waiting, decisions);
    if (!result.steps) return {error: result.error || 'Answer required inputs first.'};
    const index = result.steps.findIndex(step => step.id === stepId), step = result.steps[index];
    if (!step || step.kind !== 'wait' || !step.available || step.complete ||
        result.steps.slice(0, index).some(item => !item.resolved || item.available && !item.complete) ||
        (complete ? !waiting.has(stepId) : waiting.size !== 0)) return {error: 'Start this wait after preceding steps, then advance simulated time.'};
    const nextWaiting = new Set(waiting), nextCompleted = new Set(completed);
    if (complete) { nextWaiting.delete(stepId); nextCompleted.add(stepId); }
    else nextWaiting.add(stepId);
    return {waiting: nextWaiting, completed: nextCompleted, decisions: freezeDecisions(workflow, result.steps, index, decisions)};
  };
  const allowedActions = capabilities => Object.keys(actions).filter(action =>
      Array.isArray(capabilities) && capabilities.includes(actions[action]));
  const expireWait = (workflow, capabilities, values, completed, variables, waiting, stepId, decisions = new Map()) => {
    const result = simulate(workflow, capabilities, values, completed, variables, waiting, decisions);
    const step = result.steps?.find(item => item.id === stepId);
    if (!step || !step.waiting || !step.waitTimeoutSeconds) return {error: 'Start a wait with a deadline before simulating its expiry.'};
    return {code: 'wait-timed-out', stepId};
  };
  const failNative = (workflow, capabilities, values, completed, variables, waiting, stepId, outcome, decisions = new Map()) => {
    if (outcome !== 'rejected' && outcome !== 'unknown') return {error: 'Choose a closed native failure outcome.'};
    const result = simulate(workflow, capabilities, values, completed, variables, waiting, decisions);
    const index = result.steps?.findIndex(item => item.id === stepId) ?? -1, step = result.steps?.[index];
    if (!step || step.kind !== 'run-command' || !step.available || step.complete ||
        result.steps.slice(0, index).some(item => !item.resolved || item.available && !item.complete))
      return {error: 'Choose an available native action after preceding steps.'};
    return {code: outcome === 'rejected' ? 'native-rejected' : 'native-outcome-unknown', stepId,
      decisions: freezeDecisions(workflow, result.steps, index, decisions)};
  };
  window.tahaiWorkflowDesign = Object.freeze({validate, parse, encode, mutate, templates, expand, simulate, assign, advance, wait, expireWait, failNative, allowedActions, usesAssignmentSource, usesConditionSource});

  const source = document.querySelector('#skin-studio-source');
  const status = document.querySelector('#skin-studio-status');
  const title = document.querySelector('#skin-studio-workflow-name');
  if (!source || !status || !title) return;
  const section = document.createElement('section');
  section.className = 'mode-config-group';
  section.innerHTML = `<h3>Package workflows</h3>
    <p class="muted">Edit each workflow independently. Choosing one here does not change a mode or start a run.</p>
    <div class="grid"><label>Workflow <select id="skin-studio-workflow-select" class="button"></select></label>
    <label>New or copy name <input id="skin-studio-workflow-new-name" maxlength="128" autocomplete="off"></label></div>
    <div class="actions"><button type="button" class="button" id="skin-studio-workflow-create">New workflow</button>
    <button type="button" class="button" id="skin-studio-workflow-copy">Copy selected workflow</button>
    <button type="button" class="button" id="skin-studio-workflow-remove">Remove unused workflow</button></div>
    <div class="grid"><label>Mode <select id="skin-studio-workflow-mode" class="button"></select></label>
    <button type="button" class="button" id="skin-studio-workflow-bind">Use selected workflow for this mode</button></div>
    <p id="skin-studio-workflow-binding" class="muted"></p>
    <h3>Local workflow starters</h3>
    <p class="muted">Preview a starter, then add an independent editable workflow. Existing definitions, mode bindings, surfaces and permissions stay unchanged. These are local manual-work checklists, not complete surface templates or connected service integrations.</p>
    <label>Starter <select id="skin-studio-workflow-template-choice" class="button"></select></label>
    <p id="skin-studio-workflow-template-description" class="muted"></p>
    <ol id="skin-studio-workflow-template-preview" class="list" aria-label="Starter step preview"></ol>
    <button type="button" class="button" id="skin-studio-workflow-template">Add starter as new workflow</button>`;
  title.parentElement.before(section);
  const get = id => section.querySelector('#skin-studio-workflow-' + id);
  const selection = get('select'), modeChoice = get('mode'), newName = get('new-name');
  const templateChoice = get('template-choice');
  const refreshTemplate = () => {
    const template = workflowTemplates.find(item => item.id === templateChoice.value);
    get('template-description').textContent = template?.description || 'Choose a local workflow starter.';
    get('template-preview').replaceChildren();
    for (const step of template?.steps || []) {
      const row = document.createElement('li');
      row.textContent = step.name + (step.when ? ' (conditional; answer the declared input first)' : '');
      get('template-preview').append(row);
    }
  };
  for (const template of workflowTemplates) {
    const option = document.createElement('option'); option.value = template.id; option.textContent = template.name;
    templateChoice.append(option);
  }
  templateChoice.addEventListener('change', refreshTemplate);
  refreshTemplate();
  let selectedId = '';
  const writable = () => !source.readOnly && !source.disabled;
  const current = () => {
    const parsed = parse(source.value), workflow = parsed?.operational.workflows.find(item => item.id === selectedId);
    return workflow ? {parsed, workflow} : null;
  };
  window.tahaiStudioWorkflows = Object.freeze({current});
  const options = (control, entries, selected) => {
    control.replaceChildren();
    for (const [value, text] of entries) {
      const option = document.createElement('option'); option.value = value; option.textContent = text; control.append(option);
    }
    if (entries.some(([value]) => value === selected)) control.value = selected;
  };
  const refreshBinding = () => {
    const state = current(), mode = state?.parsed.operational.modes.find(item => item.id === modeChoice.value);
    const assigned = state?.parsed.operational.workflows.find(item => item.id === mode?.workflow);
    get('binding').textContent = mode ? mode.name + ' currently uses ' + assigned.name + '.' : 'No valid workflow selected.';
    get('bind').disabled = !writable() || !mode || mode.workflow === selectedId;
  };
  const refresh = () => {
    const parsed = parse(source.value), workflows = parsed?.operational.workflows || [];
    if (!workflows.some(workflow => workflow.id === selectedId)) selectedId = workflows[0]?.id || '';
    options(selection, workflows.map(workflow => [workflow.id, workflow.name]), selectedId);
    options(modeChoice, (parsed?.operational.modes || []).map(mode => [mode.id, mode.name]), modeChoice.value);
    selection.disabled = !parsed;
    modeChoice.disabled = newName.disabled = !parsed || !writable();
    get('create').disabled = get('copy').disabled = !parsed || !writable() || workflows.length >= 24;
    get('template').disabled = !parsed || !writable() || workflows.length >= 24;
    get('remove').disabled = !parsed || !writable() || workflows.length <= 1 ||
        parsed.operational.modes.some(mode => mode.workflow === selectedId);
    refreshBinding();
  };
  selection.addEventListener('change', () => {
    const parsed = parse(source.value);
    if (!parsed?.operational.workflows.some(workflow => workflow.id === selection.value)) { refresh(); return; }
    selectedId = selection.value;
    refresh();
    source.dispatchEvent(new Event('tahai-workflow-selection'));
    status.textContent = 'Workflow selected for editing. No draft change or run was started.';
  });
  modeChoice.addEventListener('change', refreshBinding);
  for (const operation of ['create', 'copy', 'remove', 'bind', 'template']) get(operation).addEventListener('click', () => {
    if (!writable()) return;
    const result = mutate(source.value, selectedId, operation,
        operation === 'bind' ? modeChoice.value : operation === 'template' ? templateChoice.value : newName.value.trim());
    if (result.error) { status.textContent = result.error; return; }
    selectedId = result.selected; source.value = JSON.stringify(result.parsed, null, 2); newName.value = '';
    source.dispatchEvent(new Event('input', {bubbles: true}));
    status.textContent = 'Workflow edit is being validated before saving.';
  });
  source.addEventListener('input', refresh);
  refresh();
})();
)TAHAI";

// Accessible list editing stays in the same canonical source as the canvas.
// Native action declarations are limited to already declared capabilities.
// Authoring never executes a command or silently adds a capability/grant.
inline constexpr char kSkinStudioWorkflowEditorJs[] = R"TAHAI(
(() => {
  'use strict';
  const get = id => document.querySelector('#skin-studio-' + id);
  const source = get('source'), status = get('status'), title = get('workflow-name');
  const kind = get('step-kind'), name = get('step-name'), add = get('add-step'), list = get('workflow-steps');
  if (!source || !status || !title || !kind || !name || !add || !list) return;
  const actionLabel = document.createElement('label'), action = document.createElement('select');
  actionLabel.textContent = 'Native action (declaration only) ';
  action.id = 'skin-studio-step-action'; action.className = 'button';
  actionLabel.append(action); add.before(actionLabel);
  const nativeKind = document.createElement('option');
  nativeKind.value = 'run-command'; nativeKind.textContent = 'Reviewed native action'; kind.append(nativeKind);
  const state = () => window.tahaiStudioWorkflows?.current() || null;
  const writable = () => !source.readOnly && !source.disabled;
  const populate = (select, capabilities, selected) => {
    select.replaceChildren();
    for (const value of window.tahaiWorkflowDesign.allowedActions(capabilities)) {
      const option = document.createElement('option'); option.value = value;
      option.textContent = value; select.append(option);
    }
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
  };
  const save = current => {
    const encoded = window.tahaiWorkflowDesign.encode(current.parsed);
    if (!writable() || !encoded) {
      status.textContent = 'Use valid, bounded workflow labels, keep at least one step and stay within the source size limit. No source was changed.';
      return false;
    }
    source.value = encoded;
    source.dispatchEvent(new Event('input', {bubbles: true}));
    status.textContent = 'Workflow edit is being validated before saving.';
    return true;
  };
  const refresh = () => {
    const current = state(), enabled = Boolean(current) && writable();
    title.disabled = kind.disabled = name.disabled = !enabled;
    const selectedAction = action.value;
    populate(action, current?.parsed.operational.capabilities, selectedAction);
    actionLabel.hidden = kind.value !== 'run-command';
    action.disabled = !enabled || kind.value !== 'run-command' || !action.options.length;
    add.disabled = !enabled || current.workflow.steps.length >= 32 ||
        (kind.value === 'run-command' && !action.options.length);
    list.replaceChildren(); title.value = current?.workflow.name || '';
    for (const step of current?.workflow.steps || []) {
      const row = document.createElement('li'), label = document.createElement('label');
      const editor = document.createElement('input'), remove = document.createElement('button');
      const workflowId = current.workflow.id, stepId = step.id;
      label.textContent = step.kind + (step.action ? ' · ' + step.action : '') + ' · Step label ';
      editor.type = 'text'; editor.maxLength = 128; editor.autocomplete = 'off';
      editor.value = step.name; editor.disabled = !enabled; editor.dataset.workflowStep = step.id;
      editor.addEventListener('change', () => {
        const next = state();
        if (!next || !writable() || next.workflow.id !== workflowId || !editor.isConnected) return;
        const item = next.workflow.steps.find(candidate => candidate.id === stepId);
        if (!item) return;
        item.name = editor.value.trim();
        if (!save(next)) editor.value = step.name;
      });
      remove.type = 'button'; remove.className = 'chip'; remove.textContent = 'Remove';
      remove.disabled = !enabled || current.workflow.steps.length === 1;
      remove.addEventListener('click', () => {
        const next = state();
        if (!next || !writable() || next.workflow.id !== workflowId || !remove.isConnected) return;
        const index = next.workflow.steps.findIndex(candidate => candidate.id === stepId);
        if (index < 0 || next.workflow.steps.length <= 1) return;
        if (next.workflow.steps.some(item=>item.assign?.from?.action_status===stepId)) {
          status.textContent='Remove or rebind this action status before deleting its source step.'; return;
        }
        next.workflow.steps.splice(index, 1); save(next);
      });
      label.append(editor); row.append(label);
      if (step.kind === 'run-command') {
        const controlLabel = document.createElement('label'), control = document.createElement('select');
        controlLabel.textContent = 'Native action '; control.className = 'button';
        control.dataset.workflowAction = step.id;
        populate(control, current.parsed.operational.capabilities, step.action);
        control.disabled = !enabled; controlLabel.append(control); row.append(controlLabel);
        control.addEventListener('change', () => {
          const next = state();
          if (!next || !writable() || next.workflow.id !== workflowId || !control.isConnected) return;
          const item = next.workflow.steps.find(candidate => candidate.id === stepId);
          if (!item || item.kind !== 'run-command') return;
          item.action = control.value; if (!save(next)) control.value = step.action;
        });
      }
      row.append(remove); list.append(row);
    }
  };
  title.addEventListener('change', () => {
    const current = state();
    if (!current || !writable()) return;
    current.workflow.name = title.value.trim();
    if (!save(current)) title.value = state()?.workflow.name || '';
  });
  add.addEventListener('click', () => {
    const current = state(), label = name.value.trim();
    if (!current || !writable() || current.workflow.steps.length >= 32 ||
        !['instruction', 'checkpoint', 'run-command'].includes(kind.value)) return;
    if (kind.value === 'run-command' && !window.tahaiWorkflowDesign.allowedActions(
        current.parsed.operational.capabilities).includes(action.value)) return;
    const base = 'step-' + (label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 52).replace(/-+$/g, '') || 'new');
    let id = base, suffix = 2;
    const ids = new Set(current.workflow.steps.map(step => step.id));
    while (ids.has(id) && suffix < 100) id = base.slice(0, 60) + '-' + suffix++;
    if (ids.has(id)) return;
    const step = {id, name: label, kind: kind.value};
    if (kind.value === 'run-command') step.action = action.value;
    current.workflow.steps.push(step);
    if (save(current)) name.value = '';
  });
  source.addEventListener('input', refresh);
  kind.addEventListener('change', refresh);
  source.addEventListener('tahai-workflow-selection', () => { name.value = ''; refresh(); });
  refresh();
})();
)TAHAI";

// Local input definitions are shared design, never a person's private values.
inline constexpr char kSkinStudioWorkflowInputEditorJs[] = R"TAHAI(
(() => {
  'use strict';
  const get = id => document.querySelector('#skin-studio-' + id);
  const source = get('source'), status = get('status'), name = get('input-name');
  const type = get('input-type'), required = get('input-required'), options = get('input-options');
  const protectedInput = get('input-protected');
  const lower = get('input-lower'), upper = get('input-upper');
  const add = get('add-input'), list = get('workflow-inputs');
  if (!source || !status || !name || !type || !required || !options || !protectedInput || !lower || !upper || !add || !list) return;
  const writable = () => !source.readOnly && !source.disabled;
  const state = () => window.tahaiStudioWorkflows?.current() || null;
  const save = current => {
    const encoded = window.tahaiWorkflowDesign.encode(current.parsed);
    if (!writable() || !encoded) {
      status.textContent = 'Check the input name, type, validation limits, distinct allowed options and source size limit. No source was changed.';
      return false;
    }
    source.value = encoded;
    source.dispatchEvent(new Event('input', {bubbles: true}));
    status.textContent = 'Workflow input edit is being validated before saving.';
    return true;
  };
  const supportsLimits = type => ['text', 'url', 'number'].includes(type);
  const limitKeys = type => type === 'number' ? ['minimum', 'maximum'] : ['min_bytes', 'max_bytes'];
  const setLimits = (input, low, high) => {
    delete input.validation;
    if (!supportsLimits(input.type)) return;
    const keys = limitKeys(input.type), values = [low.value, high.value];
    const rules = {};
    values.forEach((value, index) => {
      // Never silently repair a malformed limit into zero or an absent rule.
      if (value !== '') rules[keys[index]] = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) ? Number(value) : NaN;
    });
    if (Object.keys(rules).length) input.validation = rules;
  };
  const refresh = () => {
    const current = state(), enabled = Boolean(current) && writable();
    name.disabled = type.disabled = required.disabled = protectedInput.disabled = !enabled;
    options.disabled = !enabled || type.value !== 'selection';
    lower.disabled = upper.disabled = !enabled || !supportsLimits(type.value);
    get('input-limit-help').textContent = type.value === 'number' ?
        'Optional inclusive numeric limits, between -1000000000000 and 1000000000000.' :
        'Optional UTF-8 byte limits for text/URL: minimum 0-256, maximum 1-256. Blank clears a limit; non-ASCII characters use multiple bytes.';
    add.disabled = !enabled || (current.workflow.inputs?.length || 0) >= 12;
    list.replaceChildren();
    for (const input of current?.workflow.inputs || []) {
      const row = document.createElement('li'), label = document.createElement('span'), remove = document.createElement('button');
      label.textContent = input.name + ' · ' + input.type + (input.required ? ' · required' : '') +
          (input.protected ? ' · protected' : '') +
          (input.options ? ' · ' + input.options.length + ' options' : '');
      row.append(label);
      if (supportsLimits(input.type)) {
        const controls = limitKeys(input.type).map(key => {
          const holder = document.createElement('label'), control = document.createElement('input');
          holder.textContent = (key.includes('bytes') ? 'UTF-8 bytes · ' : 'Number · ') + key + ' ';
          control.type = 'text'; control.inputMode = 'decimal'; control.maxLength = 32;
          control.autocomplete = 'off'; control.value = input.validation?.[key] ?? '';
          control.disabled = !enabled; control.dataset.workflowLimit = input.id + ':' + key;
          holder.append(control); row.append(holder); return control;
        });
        const apply = document.createElement('button');
        apply.type = 'button'; apply.className = 'chip'; apply.textContent = 'Save limits';
        apply.disabled = !enabled; apply.dataset.workflowLimits = input.id;
        const selectedWorkflow = current.workflow.id;
        apply.addEventListener('click', () => {
          const next = state();
          if (!next || !writable() || next.workflow.id !== selectedWorkflow || !apply.isConnected) return;
          const item = next.workflow.inputs.find(candidate => candidate.id === input.id);
          if (!item) return;
          setLimits(item, ...controls); save(next);
        });
        row.append(apply);
      }
      remove.type = 'button'; remove.className = 'chip'; remove.textContent = 'Remove'; remove.disabled = !enabled;
      const workflowId = current.workflow.id, inputId = input.id;
      remove.addEventListener('click', () => {
        const next = state();
        if (!next || !writable() || next.workflow.id !== workflowId || !remove.isConnected) return;
        if (next.workflow.steps.some(step => window.tahaiWorkflowDesign.usesConditionSource(step.when, 'input', inputId))) {
          status.textContent = 'Remove or change conditions that use this input before deleting it.';
          return;
        }
        if (next.workflow.steps.some(step => window.tahaiWorkflowDesign.usesAssignmentSource(step.assign, 'input', inputId))) {
          status.textContent = 'Remove or rebind assignments using this input before deleting it.';
          return;
        }
        if (next.workflow.outputs?.some(output => output.from.input === inputId)) {
          status.textContent = 'Remove or rebind named outputs using this input before deleting it.';
          return;
        }
        const index = next.workflow.inputs?.findIndex(candidate => candidate.id === inputId) ?? -1;
        if (index < 0) return;
        next.workflow.inputs.splice(index, 1); save(next);
      });
      row.append(remove); list.append(row);
    }
  };
  type.addEventListener('change', () => { lower.value = upper.value = ''; refresh(); });
  add.addEventListener('click', () => {
    const current = state(), label = name.value.trim(), inputs = current?.workflow.inputs || [];
    if (!current || !writable() || inputs.length >= 12 ||
        !['text', 'number', 'boolean', 'selection', 'date', 'url'].includes(type.value)) return;
    const base = 'input-' + (label.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '').slice(0, 52).replace(/-+$/g, '') || 'new');
    let id = base, suffix = 2;
    const ids = new Set(inputs.map(input => input.id));
    while (ids.has(id) && suffix < 100) id = base.slice(0, 60) + '-' + suffix++;
    if (ids.has(id)) return;
    const input = {id, name: label, type: type.value, required: required.checked};
    setLimits(input, lower, upper);
    if (protectedInput.checked) input.protected = true;
    if (type.value === 'selection') input.options = options.value.split(',').map(value => value.trim());
    inputs.push(input); current.workflow.inputs = inputs;
    if (save(current)) { name.value = ''; options.value = ''; lower.value = upper.value = ''; required.checked = protectedInput.checked = false; }
  });
  source.addEventListener('input', refresh);
  source.addEventListener('tahai-workflow-selection', () => {
    name.value = ''; options.value = ''; lower.value = upper.value = ''; required.checked = protectedInput.checked = false; refresh();
  });
  refresh();
})();
)TAHAI";

inline constexpr char kSkinStudioWorkflowInputBootstrapJs[] = R"TAHAI(
(() => {
  'use strict';
  const steps = document.querySelector('#skin-studio-workflow-steps');
  if (!steps || document.querySelector('#skin-studio-add-input')) return;
  const section = document.createElement('section');
  section.className = 'mode-config-group';
  section.innerHTML = `<h3>Local workflow inputs</h3>
    <p class="muted">Inputs stay in the profile-local Mission run and never enter skin exports, Evidence Packs, handoffs, or capsules.
    Private values require the Protected option: masked entry and OS-encrypted storage in a regular profile.
    Protected inputs cannot drive branches. A URL is only a stored reference, not a request to contact it.</p>
    <div class="grid"><label>Input type <select id="skin-studio-input-type" class="button">
      <option value="text">Text</option><option value="number">Number</option>
      <option value="boolean">Yes / no</option><option value="selection">Selection</option>
      <option value="date">Calendar date</option><option value="url">Website URL reference</option>
    </select></label><label>Input name <input id="skin-studio-input-name" maxlength="128" autocomplete="off"></label>
    <label>Selection options (comma-separated) <input id="skin-studio-input-options" maxlength="1024" autocomplete="off"></label>
    <label><input id="skin-studio-input-required" type="checkbox"> Required before start</label>
    <label><input id="skin-studio-input-protected" type="checkbox"> Protected value (OS-encrypted, never exported)</label>
    <label>Minimum (optional) <input id="skin-studio-input-lower" maxlength="32" autocomplete="off" aria-describedby="skin-studio-input-limit-help"></label>
    <label>Maximum (optional) <input id="skin-studio-input-upper" maxlength="32" autocomplete="off" aria-describedby="skin-studio-input-limit-help"></label>
    <p id="skin-studio-input-limit-help" class="muted"></p>
    <button id="skin-studio-add-input" class="button" type="button">Add input</button></div>
    <ul id="skin-studio-workflow-inputs" class="list"></ul>`;
  steps.insertAdjacentElement('afterend', section);
})();
)TAHAI";

}  // namespace tahai

#endif  // CHROME_BROWSER_UI_WEBUI_TAHAI_TAHAI_SKIN_STUDIO_WORKFLOW_MODEL_H_
