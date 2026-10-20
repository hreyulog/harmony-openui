// SPDX-License-Identifier: Apache-2.0
import { createStreamingParser, createStore, evaluate, evaluateRoot, resolveStateField, tokenize, split, parseExpression } from '@openuidev/lang-core';
import { mappedLibrary, mappedRegistry, mappedSupport } from './mapped-registry.mjs';
import { mappedSystemPrompt } from './mapped-system-prompt.generated.mjs';

const schema = mappedLibrary.toJSONSchema();
const mappings = new Map(mappedRegistry.map(entry => [entry.name, entry]));
const identifier = value => typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(value) &&
  !['__proto__', 'constructor', 'prototype'].includes(value);
const booleanRecord = value => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length <= 64 && Object.keys(value).every(key => identifier(key) && typeof value[key] === 'boolean');
function stableKey(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) { hash = Math.imul(hash ^ value.charCodeAt(index), 16777619); }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
function validateStateDeclarations(source, candidate) {
  const seen = new Set();
  // Reuse upstream tokenization and statement/expression parsing. In lang-core
  // 1.0.1 a derived declaration can materialize as an AST object, not a computed
  // value. This bounded profile only declares scalar defaults; expressions
  // belong directly in component props and conditional child slots.
  for (const statement of split(tokenize(source))) {
    if (!statement.id.startsWith('$')) continue;
    if (seen.has(statement.id)) throw Error('OPENUI_MAPPED_STATE_DUPLICATE:' + statement.id);
    seen.add(statement.id);
    const ast = parseExpression(statement.tokens);
    const value = candidate.stateDeclarations[statement.id];
    const scalar = ['Str', 'Num', 'Bool'].includes(ast.k) && ['string', 'number', 'boolean'].includes(typeof value) &&
      (typeof value !== 'number' || Number.isFinite(value));
    const record = ast.k === 'Obj' && ast.entries.length <= 64 && new Set(ast.entries.map(([key]) => key)).size === ast.entries.length &&
      ast.entries.every(([key, item]) => identifier(key) && item.k === 'Bool') && booleanRecord(value);
    if (!scalar && !record) throw Error('OPENUI_MAPPED_STATE_INITIALIZER:' + statement.id);
  }
}
export function getMappedSystemPrompt() { return mappedSystemPrompt; }
export function getMappedLibrarySchema() { return JSON.stringify(schema); }
export function getMappedSupportManifest() { return JSON.stringify(mappedSupport); }

/** Official parser/store/evaluator with a native component projection. This
 * session performs no I/O and never invokes a model or a host business tool. */
export function createMappedSession() {
  let store = createStore(), parsed = null, disposed = false;
  let currentActions = new Map(), currentFields = new Map(), currentLogicalFields = new Map(), current = null;
  let validatedForms = new Set();
  const stats = { replacements: 0, evaluations: 0, stateUpdates: 0, internalActions: 0, externalActions: 0 };
  const ensure = () => { if (disposed) throw Error('OPENUI_MAPPED_DISPOSED'); };
  const context = () => ({ getState: name => store.get(name), resolveRef: name => { throw Error('OPENUI_MAPPED_UNRESOLVED_REFERENCE:' + name); },
    reportError: message => { throw Error('OPENUI_MAPPED_EVALUATION:' + message); } });
  const stateName = name => typeof name === 'string' && /^\$[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) &&
    !['$__proto__', '$constructor', '$prototype'].includes(name) && Object.prototype.hasOwnProperty.call(parsed.stateDeclarations, name);
  const restore = snapshot => { store.dispose(); store = createStore(); store.initialize(parsed?.stateDeclarations || {}, snapshot); };

  function project() {
    stats.evaluations++;
    const errors = [], bindings = [], components = [], ids = new Set(), actions = new Map(), fields = new Map(), logicalFields = new Map(), forms = new Set();
    const root = evaluateRoot(parsed, { ctx: context(), library: mappedLibrary, store, errors });
    if (errors.length || !root) throw Error('OPENUI_MAPPED_EVALUATION:' + errors.map(item => item.message).join(','));
    const add = node => {
      if (components.length >= 200 || ids.has(node.id)) throw Error('OPENUI_MAPPED_TREE_LIMIT_OR_DUPLICATE');
      ids.add(node.id); components.push(node); return node.id;
    };
    function logicalField(formName, name, metadata) {
      if (!identifier(name)) throw Error('OPENUI_MAPPED_FIELD_NAME');
      const key = JSON.stringify([formName, name]);
      if (logicalFields.has(key)) throw Error('OPENUI_MAPPED_DUPLICATE_FIELD');
      logicalFields.set(key, { ...metadata, name, formName });
    }
    function stateField(name, bindingValue, formName) {
      const key = formName ? formName + ':' + name : name;
      const field = resolveStateField(name, bindingValue, store, context(), () => store.get('field:' + key),
        (_, value) => store.set('field:' + key, value));
      if (field.isReactive && !stateName(bindingValue.target)) throw Error('OPENUI_MAPPED_UNDECLARED_BINDING');
      return field;
    }
    function visit(element, path, label = '', isRoot = false, formName = '') {
      if (element == null) return undefined;
      if (element.type !== 'element' || path.split('_').length > 24) throw Error('OPENUI_MAPPED_TREE_VALUE');
      const entry = mappings.get(element.typeName);
      if (!entry?.map) throw Error('OPENUI_MAPPED_COMPONENT:' + element.typeName);
      // Paths retain null slots in conditional children. Statement IDs win when
      // upstream retains them; synthetic IDs are always in a separate namespace.
      const id = isRoot ? 'root' : 'n_' + (element.statementId || path).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 68);
      const ctx = {
        label, add, formName,
        children: children => {
          if (!Array.isArray(children)) throw Error('OPENUI_MAPPED_CHILDREN');
          return children.map((child, index) => visit(child, path + '_' + index, '', false, formName)).filter(Boolean);
        },
        visit: (child, suffix, childLabel = '', childForm = formName) => visit(child, path + '_' + suffix, childLabel, false, childForm),
        registerForm: name => {
          if (!identifier(name) || formName || forms.has(name)) throw Error('OPENUI_MAPPED_FORM_NAME_OR_NESTING');
          forms.add(name);
        },
        action: (componentId, value, caption, options = {}) => {
          const plan = value || { steps: [{ type: 'continue_conversation', message: caption }] };
          if (!Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > 16 ||
            plan.steps.some(step => !['set', 'reset', 'continue_conversation', 'open_url'].includes(step.type))) throw Error('OPENUI_MAPPED_ACTION_UNSUPPORTED');
          actions.set(componentId, { plan, formName, validate: (options.variant ?? 'primary') === 'primary' &&
            plan.steps.some(step => step.type === 'continue_conversation') });
          return { event: { name: 'mapped_action', context: { actionId: componentId } } };
        },
        field: (componentId, name, bindingValue, config) => {
          const opts = Array.isArray(config) ? { kind: 'select', options: config } : config;
          if (!opts || !['text', 'select'].includes(opts.kind) || (opts.required !== undefined && typeof opts.required !== 'boolean')) throw Error('OPENUI_MAPPED_FIELD_CONFIG');
          const options = opts.options;
          if (opts.kind === 'select' && (!Array.isArray(options) || options.length < 1 || options.length > 100 || new Set(options.map(option => option.value)).size !== options.length ||
            options.some(option => typeof option.value !== 'string' || !option.value.trim() || option.value.length > 500 ||
              typeof option.label !== 'string' || !option.label || option.label.length > 500))) throw Error('OPENUI_MAPPED_OPTIONS');
          const field = stateField(name, bindingValue, formName);
          const value = field.value ?? '';
          if (typeof value !== 'string' || value.length > 8192 || (opts.kind === 'select' && value !== '' && !options.some(option => option.value === value))) throw Error('OPENUI_MAPPED_FIELD_VALUE');
          fields.set(componentId, { field, kind: opts.kind, options });
          logicalField(formName, name, { kind: opts.kind, value, required: opts.required === true, componentId });
          bindings.push({ componentId, name, target: field.isReactive ? bindingValue.target : '', value, ...(formName ? { formName } : {}) });
          return value;
        },
        checkboxGroup: (componentId, name, bindingValue, items, options = {}) => {
          if (!Array.isArray(items) || items.length < 1 || items.length > 64 || (options.required !== undefined && typeof options.required !== 'boolean')) throw Error('OPENUI_MAPPED_GROUP_ITEMS');
          items = items.map(item => item?.typeName === 'CheckBoxItem' ? item.props : item);
          const names = new Set();
          for (const item of items) {
            if (!item || !identifier(item.name) || names.has(item.name) ||
              typeof item.label !== 'string' || !item.label || item.label.length > 500 ||
              typeof item.description !== 'string' || item.description.length > 8192 ||
              (item.defaultChecked !== undefined && typeof item.defaultChecked !== 'boolean')) throw Error('OPENUI_MAPPED_GROUP_ITEM');
            names.add(item.name);
          }
          const field = stateField(name, bindingValue, formName);
          if (field.value !== undefined && !booleanRecord(field.value)) throw Error('OPENUI_MAPPED_GROUP_VALUE');
          const values = {};
          const leaves = items.map(item => {
            const p = item, id = componentId.slice(0, 56) + '_item_' + stableKey(p.name);
            const value = field.value?.[p.name] ?? p.defaultChecked ?? false;
            values[p.name] = value;
            fields.set(id, { field, kind: 'boolean', itemName: p.name, items });
            bindings.push({ componentId: id, name, itemName: p.name, target: field.isReactive ? bindingValue.target : '', value,
              ...(formName ? { formName } : {}) });
            return { id, field: '_group_' + stableKey(componentId + '|' + p.name), label: p.label, description: p.description, value };
          });
          logicalField(formName, name, { kind: 'group', value: values, required: options.required === true, componentId: leaves[0].id });
          return { values, items: leaves };
        }
      };
      return add(entry.map(id, element.props, ctx));
    }
    visit(root, 'root', '', true);
    // Composition can add a native container (Card -> Card + Column), so the
    // native depth budget must be checked after projection, not just on DSL paths.
    const lookup = new Map(components.map(component => [component.id, component]));
    function depth(id, edges) {
      if (edges > 25) throw Error('OPENUI_MAPPED_NATIVE_DEPTH');
      const node = lookup.get(id); if (!node) throw Error('OPENUI_MAPPED_NATIVE_REFERENCE');
      for (const child of node.children || (node.child ? [node.child] : [])) depth(child, edges + 1);
    }
    depth('root', 0);
    // Root first is a convenient deterministic IR convention, not a renderer requirement.
    components.sort((a, b) => a.id === 'root' ? -1 : b.id === 'root' ? 1 : 0);
    currentActions = actions; currentFields = fields; currentLogicalFields = logicalFields;
    const validationErrors = {};
    for (const field of logicalFields.values()) {
      if (!validatedForms.has(field.formName) || !field.required) continue;
      if (field.kind === 'group' ? !Object.values(field.value).some(Boolean) : !field.value.trim())
        validationErrors[field.componentId] = field.kind === 'group' ? 'group_required' : 'required';
    }
    current = { components, bindings, state: store.getSnapshot(), validationErrors, errors: [], incomplete: false, unresolved: [], complete: true };
    return current;
  }
  function formPayload(name) {
    const fields = {};
    for (const field of currentLogicalFields.values()) if (field.formName === name) fields[field.name] = field.value;
    return { formName: name, formState: { [name]: fields } };
  }
  function result(actions = []) { return JSON.stringify({ ...current, actions, stats: { ...stats } }); }
  return {
    replace(source) {
      ensure();
      if (typeof source !== 'string' || source.length > 262144) throw Error('OPENUI_MAPPED_SOURCE_LIMIT');
      const candidate = createStreamingParser(schema, 'Stack').push(source, true);
      const errors = candidate.meta.errors.filter(error => error.severity !== 'warning');
      if (candidate.queryStatements.length || candidate.mutationStatements.length) throw Error('OPENUI_MAPPED_REMOTE_UNSUPPORTED');
      if (errors.length || candidate.meta.incomplete || candidate.meta.unresolved.length || (!candidate.root && !candidate.rootExpression))
        throw Error('OPENUI_MAPPED_PARSE:' + (errors.map(error => error.code).join(',') || 'incomplete'));
      validateStateDeclarations(source, candidate);
      if (Object.keys(candidate.stateDeclarations).length > 64 || JSON.stringify(candidate.stateDeclarations).length > 65536) throw Error('OPENUI_MAPPED_STATE_LIMIT');
      const previous = { parsed, store, currentActions, currentFields, currentLogicalFields, current, validatedForms };
      parsed = candidate; store = createStore(); store.initialize(parsed.stateDeclarations, {}); validatedForms = new Set();
      try { project(); stats.replacements++; previous.store.dispose(); return result(); }
      catch (error) { store.dispose(); ({ parsed, store, currentActions, currentFields, currentLogicalFields, current, validatedForms } = previous); throw error; }
    },
    setField(componentId, valueJson) {
      ensure(); if (!parsed) throw Error('OPENUI_MAPPED_NO_PROGRAM');
      const binding = currentFields.get(componentId); const value = JSON.parse(valueJson);
      if (!binding || (binding.kind === 'boolean' ? typeof value !== 'boolean' : typeof value !== 'string' || value.length > 8192 ||
        (binding.kind === 'select' && !binding.options.some(option => option.value === value)))) throw Error('OPENUI_MAPPED_FIELD_VALUE');
      const before = store.getSnapshot();
      try {
        if (binding.kind === 'boolean') {
          const aggregate = {};
          for (const item of binding.items) aggregate[item.name] = binding.field.value?.[item.name] ?? item.defaultChecked ?? false;
          binding.field.setValue({ ...aggregate, [binding.itemName]: value });
        } else binding.field.setValue(value);
        project(); stats.stateUpdates++; return result();
      }
      catch (error) { restore(before); project(); throw error; }
    },
    dispatchAction(componentId) {
      ensure(); if (!parsed) throw Error('OPENUI_MAPPED_NO_PROGRAM');
      const action = currentActions.get(componentId); if (!action) throw Error('OPENUI_MAPPED_ACTION_UNKNOWN');
      const { plan, formName } = action;
      if (action.validate && formName) {
        validatedForms.add(formName); project();
        if (Object.keys(current.validationErrors).some(id => [...currentLogicalFields.values()].some(field => field.formName === formName && field.componentId === id))) return result();
      }
      const before = store.getSnapshot(), previousValidation = new Set(validatedForms); const outgoing = [];
      try {
        for (const step of plan.steps) {
          if (step.type === 'set') {
            if (!stateName(step.target) || !step.valueAST) throw Error('OPENUI_MAPPED_SET_TARGET');
            store.set(step.target, evaluate(step.valueAST, context()));
          } else if (step.type === 'reset') {
            for (const target of step.targets) {
              if (!stateName(target)) throw Error('OPENUI_MAPPED_RESET_TARGET');
              store.set(target, parsed.stateDeclarations[target] ?? null, { pristine: true });
            }
            validatedForms.clear();
          } else if (step.type === 'continue_conversation') {
            if (typeof step.message !== 'string') throw Error('OPENUI_MAPPED_ACTION_MESSAGE');
            project();
            outgoing.push({ name: 'continue_conversation', context: { message: step.message, ...(step.context === undefined ? {} : { context: step.context }),
              ...(formName ? formPayload(formName) : {}) } });
          } else if (step.type === 'open_url') {
            if (typeof step.url !== 'string' || !/^https:\/\//.test(step.url)) throw Error('OPENUI_MAPPED_ACTION_URL');
            project(); outgoing.push({ name: 'open_url', context: { url: step.url, ...(formName ? formPayload(formName) : {}) } });
          }
        }
        project();
        stats.internalActions += plan.steps.filter(step => ['set', 'reset'].includes(step.type)).length;
        stats.externalActions += outgoing.length;
        return result(outgoing);
      } catch (error) { validatedForms = previousValidation; restore(before); project(); throw error; }
    },
    stateSnapshotJson() { ensure(); return JSON.stringify(store.getSnapshot()); },
    currentResult() { ensure(); if (!parsed) throw Error('OPENUI_MAPPED_NO_PROGRAM'); return result(); },
    getStats() { return JSON.stringify(stats); },
    dispose() { if (!disposed) { disposed = true; store.dispose(); currentActions.clear(); currentFields.clear(); currentLogicalFields.clear(); validatedForms.clear(); parsed = null; current = null; } }
  };
}
