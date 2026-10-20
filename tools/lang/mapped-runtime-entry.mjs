// SPDX-License-Identifier: Apache-2.0
import { createStreamingParser, createStore, evaluate, evaluateRoot, resolveStateField, tokenize, split, parseExpression } from '@openuidev/lang-core';
import { mappedLibrary, mappedRegistry, mappedSupport } from './mapped-registry.mjs';
import { mappedSystemPrompt } from './mapped-system-prompt.generated.mjs';

const schema = mappedLibrary.toJSONSchema();
const mappings = new Map(mappedRegistry.map(entry => [entry.name, entry]));
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
    if (!['Str', 'Num', 'Bool'].includes(ast.k) || !['string', 'number', 'boolean'].includes(typeof value) ||
      (typeof value === 'number' && !Number.isFinite(value))) throw Error('OPENUI_MAPPED_STATE_INITIALIZER:' + statement.id);
  }
}
export function getMappedSystemPrompt() { return mappedSystemPrompt; }
export function getMappedLibrarySchema() { return JSON.stringify(schema); }
export function getMappedSupportManifest() { return JSON.stringify(mappedSupport); }

/** Official parser/store/evaluator with a native component projection. This
 * session performs no I/O and never invokes a model or a host business tool. */
export function createMappedSession() {
  let store = createStore(), parsed = null, disposed = false;
  let currentActions = new Map(), currentFields = new Map(), current = null;
  const stats = { replacements: 0, evaluations: 0, stateUpdates: 0, internalActions: 0, externalActions: 0 };
  const ensure = () => { if (disposed) throw Error('OPENUI_MAPPED_DISPOSED'); };
  const context = () => ({ getState: name => store.get(name), resolveRef: name => { throw Error('OPENUI_MAPPED_UNRESOLVED_REFERENCE:' + name); },
    reportError: message => { throw Error('OPENUI_MAPPED_EVALUATION:' + message); } });
  const stateName = name => typeof name === 'string' && /^\$[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) &&
    !['$__proto__', '$constructor', '$prototype'].includes(name) && Object.prototype.hasOwnProperty.call(parsed.stateDeclarations, name);
  const restore = snapshot => { store.dispose(); store = createStore(); store.initialize(parsed?.stateDeclarations || {}, snapshot); };

  function project() {
    stats.evaluations++;
    const errors = [], bindings = [], components = [], ids = new Set(), actions = new Map(), fields = new Map();
    const root = evaluateRoot(parsed, { ctx: context(), library: mappedLibrary, store, errors });
    if (errors.length || !root) throw Error('OPENUI_MAPPED_EVALUATION:' + errors.map(item => item.message).join(','));
    const add = node => {
      if (components.length >= 200 || ids.has(node.id)) throw Error('OPENUI_MAPPED_TREE_LIMIT_OR_DUPLICATE');
      ids.add(node.id); components.push(node); return node.id;
    };
    function visit(element, path, label = '', isRoot = false) {
      if (element == null) return undefined;
      if (element.type !== 'element' || path.split('_').length > 24) throw Error('OPENUI_MAPPED_TREE_VALUE');
      const entry = mappings.get(element.typeName);
      if (!entry?.map) throw Error('OPENUI_MAPPED_COMPONENT:' + element.typeName);
      // Paths retain null slots in conditional children. Statement IDs win when
      // upstream retains them; synthetic IDs are always in a separate namespace.
      const id = isRoot ? 'root' : 'n_' + (element.statementId || path).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 68);
      const ctx = {
        label, add,
        children: children => {
          if (!Array.isArray(children)) throw Error('OPENUI_MAPPED_CHILDREN');
          return children.map((child, index) => visit(child, path + '_' + index)).filter(Boolean);
        },
        visit: (child, suffix, childLabel = '') => visit(child, path + '_' + suffix, childLabel),
        action: (componentId, value, caption) => {
          const plan = value || { steps: [{ type: 'continue_conversation', message: caption }] };
          if (!Array.isArray(plan.steps) || plan.steps.length < 1 || plan.steps.length > 16 ||
            plan.steps.some(step => !['set', 'reset', 'continue_conversation', 'open_url'].includes(step.type))) throw Error('OPENUI_MAPPED_ACTION_UNSUPPORTED');
          actions.set(componentId, plan);
          return { event: { name: 'mapped_action', context: { actionId: componentId } } };
        },
        field: (componentId, name, bindingValue, options) => {
          if (!Array.isArray(options) || options.length < 1 || options.length > 100 || new Set(options.map(option => option.value)).size !== options.length ||
            options.some(option => typeof option.value !== 'string' || !option.value.trim() || option.value.length > 500 ||
              typeof option.label !== 'string' || !option.label || option.label.length > 500)) throw Error('OPENUI_MAPPED_OPTIONS');
          const field = resolveStateField(name, bindingValue, store, context(), key => store.get('field:' + key),
            (key, value) => store.set('field:' + key, value));
          if (field.isReactive && !stateName(bindingValue.target)) throw Error('OPENUI_MAPPED_UNDECLARED_BINDING');
          const value = field.value ?? '';
          if (typeof value !== 'string' || (value !== '' && !options.some(option => option.value === value))) throw Error('OPENUI_MAPPED_FIELD_VALUE');
          fields.set(componentId, { field, options });
          bindings.push({ componentId, name, target: field.isReactive ? bindingValue.target : '', value });
          return value;
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
    currentActions = actions; currentFields = fields;
    current = { components, bindings, state: store.getSnapshot(), errors: [], incomplete: false, unresolved: [], complete: true };
    return current;
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
      const previous = { parsed, store, currentActions, currentFields, current };
      parsed = candidate; store = createStore(); store.initialize(parsed.stateDeclarations, {});
      try { project(); stats.replacements++; previous.store.dispose(); return result(); }
      catch (error) { store.dispose(); ({ parsed, store, currentActions, currentFields, current } = previous); throw error; }
    },
    setField(componentId, valueJson) {
      ensure(); if (!parsed) throw Error('OPENUI_MAPPED_NO_PROGRAM');
      const binding = currentFields.get(componentId); const value = JSON.parse(valueJson);
      if (!binding || typeof value !== 'string' || !binding.options.some(option => option.value === value)) throw Error('OPENUI_MAPPED_FIELD_VALUE');
      const before = store.getSnapshot();
      try { binding.field.setValue(value); project(); stats.stateUpdates++; return result(); }
      catch (error) { restore(before); project(); throw error; }
    },
    dispatchAction(componentId) {
      ensure(); if (!parsed) throw Error('OPENUI_MAPPED_NO_PROGRAM');
      const plan = currentActions.get(componentId); if (!plan) throw Error('OPENUI_MAPPED_ACTION_UNKNOWN');
      const before = store.getSnapshot(); const outgoing = [];
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
          } else if (step.type === 'continue_conversation') {
            if (typeof step.message !== 'string') throw Error('OPENUI_MAPPED_ACTION_MESSAGE');
            outgoing.push({ name: 'continue_conversation', context: { message: step.message, ...(step.context === undefined ? {} : { context: step.context }) } });
          } else if (step.type === 'open_url') {
            if (typeof step.url !== 'string' || !/^https:\/\//.test(step.url)) throw Error('OPENUI_MAPPED_ACTION_URL');
            outgoing.push({ name: 'open_url', context: { url: step.url } });
          }
        }
        project();
        stats.internalActions += plan.steps.filter(step => ['set', 'reset'].includes(step.type)).length;
        stats.externalActions += outgoing.length;
        return result(outgoing);
      } catch (error) { restore(before); project(); throw error; }
    },
    stateSnapshotJson() { ensure(); return JSON.stringify(store.getSnapshot()); },
    currentResult() { ensure(); if (!parsed) throw Error('OPENUI_MAPPED_NO_PROGRAM'); return result(); },
    getStats() { return JSON.stringify(stats); },
    dispose() { if (!disposed) { disposed = true; store.dispose(); currentActions.clear(); currentFields.clear(); parsed = null; current = null; } }
  };
}
