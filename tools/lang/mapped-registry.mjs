// SPDX-License-Identifier: Apache-2.0
// Component signatures are a bounded subset of upstream react-ui at the pinned
// reference below. Only lang-core and Zod execute here; there is no React runtime.
import { createLibrary, defineComponent, action, markReactive } from '@openuidev/lang-core';
import { z } from 'zod/v4';

export const mappedReference = {
  repository: 'https://github.com/thesysdev/openui',
  commit: '9823ec05d4b29bc78d101676dc16b44fe17f1830',
  profile: 'harmony-openui/mapped@1'
};
const define = (name, description, props) => defineComponent({ name, description, props: z.object(props), component: null });
const flex = {
  direction: z.enum(['row', 'column']).optional(),
  gap: z.enum(['none', 'xs', 's', 'm', 'l', 'xl', '2xl']).optional(),
  align: z.enum(['start', 'center', 'end', 'stretch', 'baseline']).optional(),
  justify: z.enum(['start', 'center', 'end', 'between', 'around', 'evenly']).optional(),
  wrap: z.boolean().optional()
};
const binding = z.string().optional(); markReactive(binding);
const rules = z.object({ required: z.boolean().optional() }).optional();
const aggregateBinding = z.record(z.string(), z.boolean()).optional(); markReactive(aggregateBinding);
const input = define('Input', 'A native field: text uses the keyboard; date and time use native pickers (YYYY-MM-DD and HH:MM). A chosen time is a preference, never proof of availability. Bind value to a declared $state or leave it local to its named Form.', {
  name: z.string(), placeholder: z.string().optional(), type: z.enum(['text', 'date', 'time']).optional(), rules, value: binding
});
const textArea = define('TextArea', 'A native multiline text field. This bounded profile uses three native rows. Bind value to a declared $state or leave it local to its named Form.', {
  name: z.string(), placeholder: z.string().optional(), rows: z.literal(3).optional(), rules, value: binding
});
const checkBoxItem = define('CheckBoxItem', 'One named boolean choice. description is required by the upstream signature; use an empty string when unnecessary.', {
  label: z.string(), description: z.string(), name: z.string(), defaultChecked: z.boolean().optional()
});
const checkBoxGroup = define('CheckBoxGroup', 'A set of independent choices stored as a record of item name to boolean. A required group needs at least one checked item. The official spelling has a capital B.', {
  name: z.string(), items: z.array(checkBoxItem.ref), rules, value: aggregateBinding
});
const selectItem = define('SelectItem', 'A supplied select option; value is its stable business key.', { value: z.string(), label: z.string() });
const select = define('Select', 'A native select. Bind value to a declared $state variable to update the UI locally. Use FormControl to label it.', {
  name: z.string(), items: z.array(selectItem.ref), placeholder: z.string().optional(),
  rules, value: binding,
  size: z.enum(['small', 'medium', 'large']).optional()
});
const radioItem = define('RadioItem', 'One radio choice. description is required by the upstream signature; use an empty string if unnecessary. value is the stable business key.', {
  label: z.string(), description: z.string(), value: z.string()
});
const radioGroup = define('RadioGroup', 'A native radio group with optional defaultValue and reactive value binding. A supplied current value wins over the default. Use FormControl for a visible group label.', {
  name: z.string(), items: z.array(radioItem.ref), defaultValue: z.string().optional(), rules, value: binding
});
const switchItem = define('SwitchItem', 'One named switch. Supply a human-readable label when possible; an omitted or empty label falls back to its stable name in this native profile.', {
  label: z.string().optional(), description: z.string().optional(), name: z.string(), defaultChecked: z.boolean().optional()
});
const switchGroup = define('SwitchGroup', 'Independent switches stored as a boolean record, using the same aggregate semantics as CheckBoxGroup. There is no rules argument. Only clear and card variants are supported natively.', {
  name: z.string(), items: z.array(switchItem.ref), variant: z.enum(['clear', 'card', 'sunk']).optional(), value: aggregateBinding
});
const formControl = define('FormControl', 'A visible label, supported input and optional hint.', {
  label: z.string(), input: z.union([input.ref, textArea.ref, select.ref, checkBoxGroup.ref, radioGroup.ref]), hint: z.string().optional()
});
const button = define('Button', 'An action button. Primary is the main filled action, secondary is a quieter alternative, and tertiary is a low-emphasis text action. Set and Reset update local state; ToAssistant and OpenUrl return intent to the host. A primary ToAssistant inside a Form validates the live values before returning formState.', {
  label: z.string(), action: action().optional(), variant: z.enum(['primary', 'secondary', 'tertiary']).optional(),
  type: z.enum(['normal', 'destructive']).optional(), size: z.enum(['extra-small', 'small', 'medium', 'large']).optional()
});
const buttons = define('Buttons', 'A reusable group of action buttons. Official default direction is row; use column for long mobile captions.', {
  buttons: z.array(button.ref), direction: z.enum(['row', 'column']).optional()
});
const form = define('Form', 'A named form with explicit buttons and labelled fields. Form(name, Buttons([...]), fields). Do not nest forms or invent a Submit action; use @ToAssistant and the host receives the validated live formState.', {
  name: z.string(), buttons: buttons.ref, fields: z.array(formControl.ref).default([])
});
const definitions = [
  define('Stack', 'An ordinary row or column of children. This native profile supports wrap=false only.', { children: z.array(z.any()), ...flex }),
  define('Card', 'A native card composed from ordinary image, text and button children. No domain-specific business logic.', {
    children: z.array(z.any()), variant: z.enum(['card', 'clear']).optional(), ...flex
  }),
  define('CardHeader', 'A section or card heading with an optional short supporting subtitle. Native typography keeps the title visually distinct from the caption.', { title: z.string().optional(), subtitle: z.string().optional() }),
  define('TextContent', 'Plain native text. Use small for supporting metadata, default for body content, and large-heavy for a short important value. The host theme owns typography. Markdown is not supported in this profile.', {
    text: z.string(), size: z.enum(['small', 'default', 'large', 'small-heavy', 'large-heavy']).optional()
  }),
  define('Image', 'A native photograph with host-controlled mobile geometry. Use only an exact supplied HTTPS URL and meaningful alternative text.', { alt: z.string(), src: z.string().optional() }),
  button, select, selectItem, formControl, input, textArea, checkBoxGroup, checkBoxItem, buttons, form,
  radioItem, radioGroup, switchItem, switchGroup
];

const gapPx = { none: '0px', xs: '8px', s: '16px', m: '24px', l: '32px', xl: '40px', '2xl': '48px' };
function layout(p) {
  if (p.wrap) throw Error('OPENUI_MAPPED_WRAP_UNSUPPORTED');
  if ((p.gap != null && !Object.prototype.hasOwnProperty.call(gapPx, p.gap)) ||
    (p.direction != null && !['row', 'column'].includes(p.direction)) ||
    (p.align != null && !['start', 'center', 'end', 'stretch', 'baseline'].includes(p.align)) ||
    (p.justify != null && !['start', 'center', 'end', 'between', 'around', 'evenly'].includes(p.justify))) throw Error('OPENUI_MAPPED_LAYOUT_VALUE');
  return { component: p.direction === 'row' ? 'Row' : 'Column',
    ...(p.align ? { align: p.align } : {}), ...(p.justify ? { justify: p.justify } : {}),
    ...(p.gap ? { styles: { gap: gapPx[p.gap] } } : {}) };
}
function text(id, content, variant = 'body', styles) {
  if (typeof content !== 'string' || content.length > 8192) throw Error('OPENUI_MAPPED_TEXT_LIMIT');
  return { id, component: 'Text', text: content, variant, ...(styles ? { styles } : {}) };
}
function container(id, p, context) { return { id, ...layout(p), children: context.children(p.children) }; }
function fieldName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(value) || ['__proto__', 'constructor', 'prototype'].includes(value)) throw Error('OPENUI_MAPPED_FIELD_NAME');
  return value;
}
function requiredRule(value) {
  if (value == null) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => key !== 'required') ||
    (value.required !== undefined && typeof value.required !== 'boolean')) throw Error('OPENUI_MAPPED_FIELD_RULE');
  return value.required;
}
function fieldLabel(name, placeholder, context) {
  const label = context.label || placeholder || name;
  if (typeof label !== 'string' || !label || label.length > 500) throw Error('OPENUI_MAPPED_FIELD_LABEL');
  return label;
}
function inputMap(id, p, c, multiline) {
  const name = fieldName(p.name), required = requiredRule(p.rules);
  if (multiline ? p.rows != null && p.rows !== 3 : p.type != null && !['text', 'date', 'time'].includes(p.type)) throw Error('OPENUI_MAPPED_INPUT_VARIANT');
  if (p.placeholder != null && (typeof p.placeholder !== 'string' || p.placeholder.length > 500)) throw Error('OPENUI_MAPPED_INPUT_PLACEHOLDER');
  if (!multiline && (p.type === 'date' || p.type === 'time')) {
    return { id, component: p.type === 'date' ? 'OpenUiDatePicker' : 'OpenUiTimePicker',
      field: name, label: fieldLabel(name, p.placeholder, c),
      value: c.field(id, name, p.value, { kind: p.type, required }),
      ...(required === undefined ? {} : { required }) };
  }
  return { id, component: 'OpenUiInput', field: name, label: fieldLabel(name, p.placeholder, c),
    variant: multiline ? 'textarea' : 'text', inputType: 'text', value: c.field(id, name, p.value, { kind: 'text', required }),
    ...(p.placeholder == null ? {} : { placeholder: p.placeholder }), ...(required === undefined ? {} : { required }) };
}
function groupChildren(id, group, label, required, c, leafKind) {
  const children = [];
  if (label) { const key = 's_' + id + '_label'; c.add(text(key, label + (required ? ' *' : ''), 'body')); children.push(key); }
  for (const item of group.items) {
    c.add({ id: item.id, component: leafKind, field: item.field, label: item.label, value: item.value }); children.push(item.id);
    if (item.description) { const key = 's_' + item.id + '_hint'; c.add(text(key, item.description, 'caption')); children.push(key); }
  }
  return children;
}

// One registry owns catalog metadata AND executable projection. A new mapping
// is added here, then its schema, prompt and support manifest are regenerated.
export const mappedRegistry = [
  { name: 'Stack', native: ['Column', 'Row'], source: 'Stack/schema.ts', map: container },
  { name: 'Card', native: ['Card', 'Column', 'Row'], source: 'Card/schema.ts', map(id, p, c) {
    if (p.variant != null && !['card', 'clear'].includes(p.variant)) throw Error('OPENUI_MAPPED_CARD_VARIANT');
    const child = 's_' + id + '_content'; c.add(container(child, p, c));
    return { id, component: 'Card', child, ...(p.variant === 'clear' ? { styles: { 'background-color': 'transparent' } } : {}) };
  } },
  { name: 'CardHeader', native: ['Column', 'Text'], source: 'CardHeader/schema.ts', map(id, p, c) {
    const children = [];
    if (p.title) { const key = 's_' + id + '_title'; c.add(text(key, p.title, 'h2')); children.push(key); }
    if (p.subtitle) { const key = 's_' + id + '_subtitle'; c.add(text(key, p.subtitle, 'caption')); children.push(key); }
    return { id, component: 'Column', children, styles: { gap: '8px' } };
  } },
  { name: 'TextContent', native: ['Text'], source: 'TextContent/schema.ts', map(id, p) {
    const large = p.size?.startsWith('large'); const small = p.size?.startsWith('small');
    const styles = p.size?.endsWith('heavy') ? { 'font-weight': '600' } : undefined;
    return text(id, p.text, large ? 'h3' : small ? 'caption' : 'body', styles);
  } },
  { name: 'Image', native: ['Image'], source: 'Image/schema.ts', map(id, p) {
    if (typeof p.src !== 'string' || !/^https:\/\/[A-Za-z0-9][^\s<>]*$/.test(p.src) || p.src.length > 2048) throw Error('OPENUI_MAPPED_IMAGE_SOURCE');
    if (typeof p.alt !== 'string' || p.alt.length > 500) throw Error('OPENUI_MAPPED_IMAGE_ALT');
    return { id, component: 'Image', source: p.src, alt: p.alt };
  } },
  { name: 'Button', native: ['Button', 'Text'], source: 'Button/schema.ts', map(id, p, c) {
    if (p.variant != null && !['primary', 'secondary', 'tertiary'].includes(p.variant)) throw Error('OPENUI_MAPPED_BUTTON_VARIANT');
    const child = 's_' + id + '_label'; c.add(text(child, p.label));
    return { id, component: 'Button', child, variant: p.variant === 'tertiary' ? 'borderless' : p.variant ?? 'primary', action: c.action(id, p.action, p.label, { variant: p.variant ?? 'primary' }) };
  } },
  { name: 'Select', native: ['OpenUiSelect'], source: 'Select/schema.ts', map(id, p, c) {
    const name = fieldName(p.name), required = requiredRule(p.rules);
    const options = p.items.map(item => {
      if (item?.typeName !== 'SelectItem') throw Error('OPENUI_MAPPED_SELECT_ITEM');
      return { label: item.props.label, value: item.props.value };
    });
    const value = c.field(id, name, p.value, { kind: 'select', options, required });
    return { id, component: 'OpenUiSelect', field: name, label: fieldLabel(name, p.placeholder, c),
      value, options, ...(required === undefined ? {} : { required }) };
  } },
  { name: 'RadioItem', native: [], source: 'RadioGroup/schema.ts', dataOnly: true },
  { name: 'RadioGroup', native: ['OpenUiRadioGroup'], source: 'RadioGroup/index.tsx', map(id, p, c) {
    const name = fieldName(p.name), required = requiredRule(p.rules);
    if (!Array.isArray(p.items) || p.items.length < 1 || p.items.length > 100 || p.items.some(item => item?.typeName !== 'RadioItem')) throw Error('OPENUI_MAPPED_RADIO_ITEMS');
    if (p.defaultValue != null && typeof p.defaultValue !== 'string') throw Error('OPENUI_MAPPED_RADIO_DEFAULT');
    const options = p.items.map(item => {
      const option = item.props;
      if (typeof option.description !== 'string' || option.description.length > 8192) throw Error('OPENUI_MAPPED_RADIO_DESCRIPTION');
      return { label: option.label, value: option.value, description: option.description };
    });
    const value = c.field(id, name, p.value, { kind: 'select', options, required, defaultValue: p.defaultValue });
    return { id, component: 'OpenUiRadioGroup', field: name, label: fieldLabel(name, '', c), value, options,
      ...(required === undefined ? {} : { required }) };
  } },
  { name: 'Input', native: ['OpenUiInput', 'OpenUiDatePicker', 'OpenUiTimePicker'], source: 'Input/schema.ts', map(id, p, c) { return inputMap(id, p, c, false); } },
  { name: 'TextArea', native: ['OpenUiInput'], source: 'TextArea/schema.ts', map(id, p, c) { return inputMap(id, p, c, true); } },
  { name: 'CheckBoxItem', native: [], source: 'CheckBoxGroup/schema.ts', dataOnly: true },
  { name: 'CheckBoxGroup', native: ['Column', 'Text', 'OpenUiCheckbox'], source: 'CheckBoxGroup/schema.ts', map(id, p, c) {
    const name = fieldName(p.name), required = requiredRule(p.rules), label = fieldLabel(name, '', c);
    if (!Array.isArray(p.items) || p.items.length < 1 || p.items.length > 30 || p.items.some(item => item?.typeName !== 'CheckBoxItem')) throw Error('OPENUI_MAPPED_CHECKBOX_ITEMS');
    const group = c.checkboxGroup(id, name, p.value, p.items.map(item => ({ ...item.props, name: fieldName(item.props.name) })), { required });
    return { id, component: 'Column', children: groupChildren(id, group, label, required, c, 'OpenUiCheckbox'), styles: { gap: '8px' } };
  } },
  { name: 'SwitchItem', native: [], source: 'SwitchGroup/schema.ts', dataOnly: true },
  { name: 'SwitchGroup', native: ['Column', 'Text', 'Card', 'OpenUiToggle'], source: 'SwitchGroup/schema.ts', map(id, p, c) {
    const name = fieldName(p.name);
    if (p.variant != null && !['clear', 'card'].includes(p.variant)) throw Error('OPENUI_MAPPED_SWITCH_VARIANT');
    if (!Array.isArray(p.items) || p.items.length < 1 || p.items.length > 30 || p.items.some(item => item?.typeName !== 'SwitchItem')) throw Error('OPENUI_MAPPED_SWITCH_ITEMS');
    const items = p.items.map(item => {
      const option = item.props, itemName = fieldName(option.name);
      return { name: itemName, label: option.label || itemName, description: option.description ?? '',
        ...(option.defaultChecked == null ? {} : { defaultChecked: option.defaultChecked }) };
    });
    const group = c.checkboxGroup(id, name, p.value, items);
    const children = groupChildren(id, group, c.label, false, c, 'OpenUiToggle');
    if (p.variant === 'card') { const child = 's_' + id + '_content'; c.add({ id: child, component: 'Column', children, styles: { gap: '8px' } }); return { id, component: 'Card', child }; }
    return { id, component: 'Column', children, styles: { gap: '8px' } };
  } },
  { name: 'Buttons', native: ['Column', 'Row'], source: 'Buttons/schema.ts', map(id, p, c) {
    if (!Array.isArray(p.buttons) || p.buttons.length < 1 || p.buttons.length > 10 || p.buttons.some(item => item?.typeName !== 'Button') ||
      (p.direction != null && !['row', 'column'].includes(p.direction))) throw Error('OPENUI_MAPPED_FORM_BUTTONS');
    return { id, component: p.direction === 'column' ? 'Column' : 'Row', children: c.children(p.buttons), styles: { gap: '16px' } };
  } },
  { name: 'Form', native: ['OpenUiForm'], source: 'Form/schema.ts', map(id, p, c) {
    const name = fieldName(p.name); c.registerForm(name);
    if (p.buttons?.typeName !== 'Buttons' || !Array.isArray(p.fields) || p.fields.length > 30 || p.fields.some(item => item?.typeName !== 'FormControl')) throw Error('OPENUI_MAPPED_FORM_FIELDS');
    const children = p.fields.map((child, index) => c.visit(child, 'field_' + index, '', name)).filter(Boolean);
    children.push(c.visit(p.buttons, 'buttons', '', name));
    return { id, component: 'OpenUiForm', name, children };
  } },
  { name: 'SelectItem', native: [], source: 'Select/schema.ts', dataOnly: true },
  { name: 'FormControl', native: ['Column', 'Text', 'OpenUiSelect', 'OpenUiInput', 'OpenUiDatePicker', 'OpenUiTimePicker', 'OpenUiCheckbox', 'OpenUiRadioGroup'], source: 'FormControl/schema.ts', map(id, p, c) {
    if (typeof p.label !== 'string' || !p.label || p.label.length > 500) throw Error('OPENUI_MAPPED_FIELD_LABEL');
    const child = c.visit(p.input, 'input', p.label); const children = child ? [child] : [];
    if (p.hint) { const key = 's_' + id + '_hint'; c.add(text(key, p.hint, 'caption')); children.push(key); }
    return { id, component: 'Column', children, styles: { gap: '8px' } };
  } }
];
export const mappedLibrary = createLibrary({ components: definitions, root: 'Stack' });
export const mappedSupport = { ...mappedReference, components: mappedRegistry.map(({ name, native, source, dataOnly }) => ({
  name, native, source: 'packages/react-ui/src/genui-lib/' + source, ...(dataOnly ? { dataOnly: true } : {})
})), capabilities: ['$state', 'conditional-expression', 'select-binding', 'input-binding', 'checkbox-record-binding', 'radio-binding', 'switch-record-binding', 'form-live-state', 'form-required-validation', '@Each-display-only', '@Filter', '@Sort', '@Count', '@Set', '@Reset', '@ToAssistant-context', '@OpenUrl'],
limitations: ['Bounded official component signatures, not full react-ui or ArkUI parity.', 'No Query/Mutation, HTML, Markdown, wrapping, custom code or network execution.',
  'State declarations are unique literal defaults. Checkbox groups bind a record of declared item names to boolean values. Derived state declarations are not supported; put expressions inline.',
  'Input supports text, date and time; dates and times use native pickers and strictly formatted values. TextArea supports the native three-row geometry only. Form validation supports required only; no blur rules or advanced validation.',
  'Each and nested computed child arrays are display/action-only: fields and forms are rejected because keyed editable lists are not implemented.',
  'Only Each, Filter, Sort and Count computation functions are supported. Data arrays use ordinary declarations, not $state.',
  'Computed-list bounds: 200 entries per literal array; one Each expansion level; nested UI arrays depth 8 and 1000 total flatten visits; 200 native IR nodes. Programs remain subject to AST/source/depth budgets.',
  'Card and SwitchGroup variant sunk and advanced form rules are not in this profile.', 'The host theme owns image geometry, typography, control sizes and destructive tone. Primary, secondary and tertiary button emphasis is retained.'] };
export const mappedPromptOptions = {
  preamble: 'Generate a native HarmonyOS interface using the bounded official OpenUI component mapping profile. Use the user language.',
  toolCalls: false, bindings: true, builtinFunctions: false,
  additionalRules: [
    'This is a separate mapped profile, not the legacy Harmony v0.2 component signatures. Emit only OpenUI Lang source, no fences or commentary.',
    'Start with root = Stack([...]). Declare local filters as $name = "default". Use Select(name, items, placeholder, null, $name) inside FormControl(label, input).',
    'Declare each $state variable exactly once, initialized only to a string, number, boolean, or a flat record of named boolean choices. Never write $derived = expression, never redeclare a $state variable, and never assign $state outside @Set/@Reset. Put all derived conditions inline in the component props or conditional children, for example ($kind == "all" || $kind == "park") && ($duration == "all" || $duration == "short") ? namedCard : null.',
    'SelectItem uses the official order SelectItem(value, label). Image uses the official order Image(alt, src).',
    'Card and Stack have different positional arguments. Card(children, variant, direction, gap, align, justify, wrap) has variant SECOND; Stack(children, direction, gap, align, justify, wrap) has direction SECOND. For a vertical card with small spacing write Card([...], "card", "column", "s"). Never write Card([...], "column", "s"). Use "card" or "clear" for Card.variant; omitted optional positions may use null.',
    'Prefer Card(children) and Stack(children) with the native default layout. Supply optional positional arguments only when necessary; do not emit every default position. Card takes at most seven arguments total, and Stack at most six. Do not add an extra alignment or justification argument.',
    'Build a clear visual hierarchy with the existing components: Card groups related content, CardHeader provides one short title and supporting subtitle, TextContent small is a caption or field label, default is body content, and large-heavy highlights one important value. Keep labels immediately before their values. Avoid repeating the same heading or explanation, and avoid Card inside Card when one grouping is enough.',
    'Use one primary action for the main next step in a card or section, secondary for a quieter alternative, and tertiary for reset or other low-emphasis actions. Native themes retain these three priorities; do not imitate buttons with text decorations.',
    'Image is a normal full-width photograph with a native host aspect ratio. Supply the exact image URL and a useful description; do not invent image dimensions, inline styles, CSS, emoji badges or decorative placeholders. Use ordinary Card and Stack composition so the host can provide consistent spacing and typography.',
    'For reusable forms use Form(name, Buttons([Button("继续", @ToAssistant("提交资料", {intent:"supplied intent"}))], "column"), [FormControl(label, input), ...]). The host returns live formState; do not put guessed field values into action.context and do not use @Submit.',
    'Input(name, placeholder, type, rules, value) and TextArea(name, placeholder, 3, rules, value) reuse native controls. Input type is text, date or time. Use date/time pickers instead of keyboard entry for dates/times. For supplied available slots use Select with their exact values. Unknown dates/times stay empty until the owner chooses; never mistake a picker default for consent or availability. Only three-row TextArea is supported. Use rules={required:true} only where necessary; no other rule keys are supported.',
    'CheckBoxGroup has the exact official spelling and signature CheckBoxGroup(name, [CheckBoxItem(label, description, name, defaultChecked), ...], rules, value). Its value is a record such as {quiet:false,accessible:false}, not an array or one boolean. Declare a record $preferences for reactive group state or omit value for local Form state. A required group needs any one item checked, not all items.',
    'RadioGroup uses RadioGroup(name, [RadioItem(label, description, value), ...], defaultValue, rules, value). The optional defaultValue is a supplied option key; a current value wins over that default. Use a declared string $state for reactive value. Preserve each supplied option description; use an empty description only when no text was supplied.',
    'SwitchGroup uses SwitchGroup(name, [SwitchItem(label, description, name, defaultChecked), ...], variant, value). It has NO rules argument. Bind a flat boolean record exactly like CheckBoxGroup. Prefer visible labels in the user language; omitted labels fall back to item names. Only clear and card variants are supported, never sunk.',
    'Give every Form and field a unique safe identifier; forms cannot nest. Primary ToAssistant buttons validate required fields before returning live formState. Secondary or tertiary actions are available for non-validating navigation or cancellation.',
    'For short fixed lists, conditional children remain supported: $kind == "all" || $kind == "park" ? namedCard : null. For computed lists, only @Each(array, "item", inlineTemplate), @Filter(array, "field", operator, value), @Sort(array, "field", "asc" or "desc"), and @Count(array) are supported. Filter operators are ==, !=, >, <, >=, <=, contains. Do not use Query or Mutation, or other computation functions.',
    'Store supplied result records in ordinary declarations such as data = [{id:"supplied-id",title:"supplied title"}]. Derive ordinary filtered/sorted declarations with @Filter and @Sort. Never put arrays or component templates in $state. Use @Each(filtered, "item", Card([TextContent(item.title), Button("选择", @ToAssistant("选择", {itemId:item.id}))])) with the component template inline; do not declare the template separately.',
    'Every @Each template and nested computed child array is display/action-only. Never put Form, FormControl, Input, TextArea, Select, RadioGroup, CheckBoxGroup or SwitchGroup inside one. Editable repeated lists have no stable business-key field identity contract. Ordinary fixed Stack children may still contain forms.',
    'Keep result data bounded to at most 200 records per literal array and the final native tree within 200 nodes. Use only one @Each expansion level: never nest @Each, including through referenced data or templates. UI arrays may nest at most 8 levels, with at most 200 entries per group and 1000 total flatten visits. Sort direction must be lowercase "asc" or "desc".',
    'Use only supplied result facts and exact supplied HTTPS image URLs. Never invent price, availability, bookings, URLs or business outcomes.',
    'Build results from ordinary Card, Image, CardHeader, TextContent and Button components, not business-specific components. Use only as many cards as supplied facts require.',
    'Use @Reset($kind) or @Set($kind, "value") for internal state changes. These execute locally without another model request. Use @ToAssistant("message", {itemId:"supplied id"}) to pass intent and business context to the host.',
    'Keep mobile rows short; default to a column. wrap must be false. The host controls exact typography, colors and dimensions. Only required validation rules are supported here.'
  ],
  examples: ['$kind = "all"\nroot = Stack([heading, filter, reset, $kind == "all" || $kind == "park" ? result : null])\nheading = CardHeader("发现周末去处", "示例数据")\nfilter = FormControl("类型", Select("kind", [SelectItem("all", "全部"), SelectItem("park", "公园")], "选择类型", null, $kind))\nreset = Button("重置", @Reset($kind), "tertiary")\nresult = Card([CardHeader("城市公园", "开放空间"), TextContent("适合散步"), Button("选择", @ToAssistant("选择城市公园", {itemId:"park-1"}))])',
    '$name = ""\n$preferences = {quiet:false,accessible:false}\nroot = Stack([trip])\ntrip = Form("trip", Buttons([Button("继续", @ToAssistant("提交出行偏好", {intent:"trip-preferences"}))], "column"), [FormControl("称呼", Input("name", "请输入称呼", "text", {required:true}, $name)), FormControl("备注", TextArea("notes", "可选备注", 3)), FormControl("偏好", CheckBoxGroup("preferences", [CheckBoxItem("安静", "", "quiet"), CheckBoxItem("无障碍", "", "accessible")], {required:true}, $preferences))])']
};
