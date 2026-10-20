// SPDX-License-Identifier: Apache-2.0
// The parser and action evaluator below are the upstream implementation, not a new DSL parser.
import { createStreamingParser, evaluate } from '@openuidev/lang-core';
import schema from '../../schemas/openui-lang-v0.1.json' with { type: 'json' };
import { systemPrompt } from './system-prompt.generated.mjs';

export function getSystemPrompt() { return systemPrompt; }
export function getLibrarySchema() { return JSON.stringify(schema); }

function actionDefinition(value) {
  const plan = value?.k ? evaluate(value, {
    getState() { throw Error('OPENUI_LANG_REACTIVE_UNSUPPORTED'); },
    resolveRef() { throw Error('OPENUI_LANG_REFERENCE_UNSUPPORTED'); }, actions: schema.actions
  }) : value;
  if (!plan || !Array.isArray(plan.steps) || plan.steps.length !== 1) throw Error('OPENUI_LANG_ACTION_UNSUPPORTED');
  const step = plan.steps[0];
  if (step.type === 'custom_action' && step.name === 'Choose' && typeof step.params?.value === 'string') {
    return { event: { name: 'choose', context: { value: step.params.value } } };
  }
  if (step.type === 'custom_action' && step.name === 'Submit' && typeof step.params?.form === 'string') {
    return { event: { name: 'submit', context: { form: step.params.form } } };
  }
  if (step.type === 'continue_conversation' && typeof step.message === 'string') {
    return { event: { name: 'continue_conversation', context: { message: step.message,
      ...(step.context === undefined ? {} : { context: step.context }) } } };
  }
  if (step.type === 'open_url' && typeof step.url === 'string') {
    return { event: { name: 'open_url', context: { url: step.url } } };
  }
  throw Error('OPENUI_LANG_ACTION_UNSUPPORTED');
}

function translate(root) {
  const output = [], used = new Set();
  const add = node => {
    if (output.length >= 200) throw Error('OPENUI_LANG_TREE_LIMIT');
    if (used.has(node.id)) throw Error('OPENUI_LANG_REUSED_COMPONENT');
    used.add(node.id); output.push(node); return node;
  };
  function visit(element, path, rootNode = false) {
    if (!element || element.type !== 'element') return undefined;
    if (output.length >= 200 || path.split('_').length > 24) throw Error('OPENUI_LANG_TREE_LIMIT');
    const id = rootNode ? 'root' : 'n_' + (element.statementId || path).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 68);
    const p = element.props, node = add({ id, component: '' });
    const children = () => (p.children || []).map((child, index) => visit(child, path + '_' + index)).filter(Boolean);
    const props = names => { for (const name of names) { if (p[name] !== undefined) node[name] = p[name]; } };
    switch (element.typeName) {
      case 'Stack': case 'Row': node.component = element.typeName === 'Stack' ? 'Column' : 'Row'; node.children = children(); break;
      case 'Card': {
        node.component = 'Card'; node.child = 's_' + id + '_content';
        const descendants = children();
        add({ id: node.child, component: 'Column', children: descendants }); break;
      }
      case 'Text': node.component = 'Text'; node.text = p.content; node.variant = p.variant === 'heading' ? 'h2' : (p.variant || 'body'); break;
      case 'Option':
        node.component = 'OpenUiOption'; node.title = p.title; node.description = p.description; node.meta = p.meta;
        node.action = actionDefinition(p.action); break;
      case 'Facts': node.component = 'OpenUiFacts'; node.facts = p.facts; if (p.title !== undefined) node.title = p.title; break;
      case 'Status': node.component = 'OpenUiStatus'; node.text = p.text; if (p.tone !== undefined) node.tone = p.tone; break;
      case 'Details': node.component = 'OpenUiDetails'; node.title = p.title; node.text = p.text; break;
      case 'Button':
        node.component = 'Button'; node.child = 's_' + id + '_label'; node.action = actionDefinition(p.action);
        if (p.variant !== undefined) node.variant = p.variant;
        add({ id: node.child, component: 'Text', text: p.label, variant: 'body' }); break;
      case 'Form': node.component = 'OpenUiForm'; props(['name']); node.children = children(); break;
      case 'TextInput': case 'TextArea': case 'Search':
        node.component = 'OpenUiInput'; node.variant = { TextInput: 'text', TextArea: 'textarea', Search: 'search' }[element.typeName];
        props(['field', 'label', 'value', 'placeholder', 'required', 'disabled', 'inputType']); break;
      case 'Checkbox': case 'Toggle': case 'Select': case 'RadioGroup': case 'Slider': case 'DatePicker': case 'TimePicker':
        node.component = 'OpenUi' + element.typeName;
        props(['field', 'label', 'options', 'value', 'required', 'disabled', 'min', 'max', 'step', 'minDate', 'maxDate']); break;
      case 'Image': node.component = 'OpenUiImage'; props(['source', 'alt', 'aspectRatio']); break;
      case 'List': node.component = 'OpenUiList'; props(['items', 'title', 'height']); break;
      case 'Dialog':
        node.component = 'OpenUiDialog'; props(['label', 'title', 'text', 'confirmLabel', 'cancelLabel']);
        node.action = actionDefinition(p.action); break;
      default: throw Error('OPENUI_LANG_COMPONENT_UNSUPPORTED');
    }
    return id;
  }
  visit(root, 'root', true);
  return output;
}

export function createLanguageSession() {
  const parser = createStreamingParser(schema, 'Stack');
  return {
    push(chunk, complete = false) {
      const result = parser.push(chunk, complete);
      const errors = result.meta.errors.filter(error => error.severity !== 'warning');
      const dynamic = result.rootExpression || Object.keys(result.stateDeclarations || {}).length || result.queryStatements.length || result.mutationStatements.length;
      if (dynamic) errors.push({ code: 'OPENUI_LANG_DYNAMIC_UNSUPPORTED', message: 'Reactive state, queries and mutations are not supported by the native adapter.' });
      let components = [];
      try { if (result.root && !errors.length) components = translate(result.root); }
      catch (error) { errors.push({ code: String(error.message), message: String(error.message) }); }
      return JSON.stringify({ components, incomplete: result.meta.incomplete, unresolved: result.meta.unresolved,
        errors: errors.map(error => ({ code: error.code, message: error.message })), complete });
    }
  };
}
