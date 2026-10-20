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
const selectItem = define('SelectItem', 'A supplied select option; value is its stable business key.', { value: z.string(), label: z.string() });
const select = define('Select', 'A native select. Bind value to a declared $state variable to update the UI locally. Use FormControl to label it.', {
  name: z.string(), items: z.array(selectItem.ref), placeholder: z.string().optional(),
  rules: z.object({ required: z.boolean().optional() }).optional(), value: binding,
  size: z.enum(['small', 'medium', 'large']).optional()
});
const definitions = [
  define('Stack', 'An ordinary row or column of children. This native profile supports wrap=false only.', { children: z.array(z.any()), ...flex }),
  define('Card', 'A native card composed from ordinary image, text and button children. No domain-specific business logic.', {
    children: z.array(z.any()), variant: z.enum(['card', 'clear']).optional(), ...flex
  }),
  define('CardHeader', 'A card title and optional short subtitle.', { title: z.string().optional(), subtitle: z.string().optional() }),
  define('TextContent', 'Plain native text. Markdown is not supported in this profile.', {
    text: z.string(), size: z.enum(['small', 'default', 'large', 'small-heavy', 'large-heavy']).optional()
  }),
  define('Image', 'A native image. Use only an exact supplied HTTPS URL and meaningful alternative text.', { alt: z.string(), src: z.string().optional() }),
  define('Button', 'An action button. Set and Reset update local state; ToAssistant and OpenUrl return intent to the host.', {
    label: z.string(), action: action().optional(), variant: z.enum(['primary', 'secondary', 'tertiary']).optional(),
    type: z.enum(['normal', 'destructive']).optional(), size: z.enum(['extra-small', 'small', 'medium', 'large']).optional()
  }), select, selectItem,
  define('FormControl', 'A visible label, supported input and optional hint.', { label: z.string(), input: select.ref, hint: z.string().optional() })
];

const gapPx = { none: '0px', xs: '8px', s: '16px', m: '24px', l: '32px', xl: '40px', '2xl': '48px' };
function layout(p) {
  if (p.wrap) throw Error('OPENUI_MAPPED_WRAP_UNSUPPORTED');
  if ((p.gap !== undefined && !Object.prototype.hasOwnProperty.call(gapPx, p.gap)) ||
    (p.direction !== undefined && !['row', 'column'].includes(p.direction)) ||
    (p.align !== undefined && !['start', 'center', 'end', 'stretch', 'baseline'].includes(p.align)) ||
    (p.justify !== undefined && !['start', 'center', 'end', 'between', 'around', 'evenly'].includes(p.justify))) throw Error('OPENUI_MAPPED_LAYOUT_VALUE');
  return { component: p.direction === 'row' ? 'Row' : 'Column',
    ...(p.align ? { align: p.align } : {}), ...(p.justify ? { justify: p.justify } : {}),
    ...(p.gap ? { styles: { gap: gapPx[p.gap] } } : {}) };
}
function text(id, content, variant = 'body', styles) {
  if (typeof content !== 'string' || content.length > 8192) throw Error('OPENUI_MAPPED_TEXT_LIMIT');
  return { id, component: 'Text', text: content, variant, ...(styles ? { styles } : {}) };
}
function container(id, p, context) { return { id, ...layout(p), children: context.children(p.children) }; }

// One registry owns catalog metadata AND executable projection. A new mapping
// is added here, then its schema, prompt and support manifest are regenerated.
export const mappedRegistry = [
  { name: 'Stack', native: ['Column', 'Row'], source: 'Stack/schema.ts', map: container },
  { name: 'Card', native: ['Card', 'Column', 'Row'], source: 'Card/schema.ts', map(id, p, c) {
    const child = 's_' + id + '_content'; c.add(container(child, p, c));
    return { id, component: 'Card', child, ...(p.variant === 'clear' ? { styles: { 'background-color': 'transparent' } } : {}) };
  } },
  { name: 'CardHeader', native: ['Column', 'Text'], source: 'CardHeader/schema.ts', map(id, p, c) {
    const children = [];
    if (p.title) { const key = 's_' + id + '_title'; c.add(text(key, p.title, 'h2')); children.push(key); }
    if (p.subtitle) { const key = 's_' + id + '_subtitle'; c.add(text(key, p.subtitle, 'caption')); children.push(key); }
    return { id, component: 'Column', children };
  } },
  { name: 'TextContent', native: ['Text'], source: 'TextContent/schema.ts', map(id, p) {
    const large = p.size?.startsWith('large'); const small = p.size?.startsWith('small');
    const styles = p.size ? { 'font-size': large ? '40px' : small ? '26px' : '32px', ...(p.size.endsWith('heavy') ? { 'font-weight': '600' } : {}) } : undefined;
    return text(id, p.text, large ? 'h3' : small ? 'caption' : 'body', styles);
  } },
  { name: 'Image', native: ['Image'], source: 'Image/schema.ts', map(id, p) {
    if (typeof p.src !== 'string' || !/^https:\/\/[A-Za-z0-9][^\s<>]*$/.test(p.src) || p.src.length > 2048) throw Error('OPENUI_MAPPED_IMAGE_SOURCE');
    if (typeof p.alt !== 'string' || p.alt.length > 500) throw Error('OPENUI_MAPPED_IMAGE_ALT');
    return { id, component: 'Image', source: p.src, alt: p.alt, aspectRatio: 2.5 };
  } },
  { name: 'Button', native: ['Button', 'Text'], source: 'Button/schema.ts', map(id, p, c) {
    const child = 's_' + id + '_label'; c.add(text(child, p.label));
    return { id, component: 'Button', child, variant: p.variant === 'tertiary' ? 'borderless' : 'primary', action: c.action(id, p.action, p.label) };
  } },
  { name: 'Select', native: ['OpenUiSelect'], source: 'Select/schema.ts', map(id, p, c) {
    if (typeof p.name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(p.name) || ['__proto__','constructor','prototype'].includes(p.name)) throw Error('OPENUI_MAPPED_FIELD_NAME');
    if (p.rules?.required !== undefined && typeof p.rules.required !== 'boolean') throw Error('OPENUI_MAPPED_FIELD_RULE');
    const options = p.items.map(item => {
      if (item?.typeName !== 'SelectItem') throw Error('OPENUI_MAPPED_SELECT_ITEM');
      return { label: item.props.label, value: item.props.value };
    });
    const value = c.field(id, p.name, p.value, options);
    const label = c.label || p.placeholder || p.name;
    if (typeof label !== 'string' || !label || label.length > 500) throw Error('OPENUI_MAPPED_FIELD_LABEL');
    return { id, component: 'OpenUiSelect', field: p.name, label,
      value, options, ...(p.rules?.required === undefined ? {} : { required: p.rules.required }) };
  } },
  { name: 'SelectItem', native: [], source: 'Select/schema.ts', dataOnly: true },
  { name: 'FormControl', native: ['Column', 'Text', 'OpenUiSelect'], source: 'FormControl/schema.ts', map(id, p, c) {
    const child = c.visit(p.input, 'input', p.label); const children = child ? [child] : [];
    if (p.hint) { const key = 's_' + id + '_hint'; c.add(text(key, p.hint, 'caption')); children.push(key); }
    return { id, component: 'Column', children };
  } }
];
export const mappedLibrary = createLibrary({ components: definitions, root: 'Stack' });
export const mappedSupport = { ...mappedReference, components: mappedRegistry.map(({ name, native, source, dataOnly }) => ({
  name, native, source: 'packages/react-ui/src/genui-lib/' + source, ...(dataOnly ? { dataOnly: true } : {})
})), capabilities: ['$state', 'conditional-expression', 'select-binding', '@Set', '@Reset', '@ToAssistant-context', '@OpenUrl'],
limitations: ['Bounded official component signatures, not full react-ui or ArkUI parity.', 'No Query/Mutation, HTML, Markdown, wrapping, custom code or network execution.',
  'State declarations are unique string/number/boolean literal defaults. Derived state declarations are not supported; put expressions inline.',
  'Card variant sunk and advanced form rules are not in this profile.', 'Image geometry, control sizes, button variants and destructive tone follow the native host theme.'] };
export const mappedPromptOptions = {
  preamble: 'Generate a native HarmonyOS interface using the bounded official OpenUI component mapping profile. Use the user language.',
  toolCalls: false, bindings: true, builtinFunctions: false,
  additionalRules: [
    'This is a separate mapped profile, not the legacy Harmony v0.2 component signatures. Emit only OpenUI Lang source, no fences or commentary.',
    'Start with root = Stack([...]). Declare local filters as $name = "default". Use Select(name, items, placeholder, null, $name) inside FormControl(label, input).',
    'Declare each $state variable exactly once, initialized only to a string, number or boolean literal. Never write $derived = expression, never redeclare a $state variable, and never assign $state outside @Set/@Reset. Put all derived conditions inline in the component props or conditional children, for example ($kind == "all" || $kind == "park") && ($duration == "all" || $duration == "short") ? namedCard : null.',
    'SelectItem uses the official order SelectItem(value, label). Image uses the official order Image(alt, src).',
    'For local filtering, place conditional children directly in Stack: $kind == "all" || $kind == "park" ? namedCard : null. Keep fixed child slots and named reusable declarations. Do not use Each, Filter, Query or Mutation.',
    'Use only supplied result facts and exact supplied HTTPS image URLs. Never invent price, availability, bookings, URLs or business outcomes.',
    'Build results from ordinary Card, Image, CardHeader, TextContent and Button components, not business-specific components. Use only as many cards as supplied facts require.',
    'Use @Reset($kind) or @Set($kind, "value") for internal state changes. These execute locally without another model request. Use @ToAssistant("message", {itemId:"supplied id"}) to pass intent and business context to the host.',
    'Keep mobile rows short; default to a column. wrap must be false. The host controls exact typography, colors and dimensions. Only required validation rules are supported here.'
  ],
  examples: ['$kind = "all"\nroot = Stack([heading, filter, reset, $kind == "all" || $kind == "park" ? result : null])\nheading = CardHeader("发现周末去处", "示例数据")\nfilter = FormControl("类型", Select("kind", [SelectItem("all", "全部"), SelectItem("park", "公园")], "选择类型", null, $kind))\nreset = Button("重置", @Reset($kind), "tertiary")\nresult = Card([CardHeader("城市公园", "开放空间"), TextContent("适合散步"), Button("选择", @ToAssistant("选择城市公园", {itemId:"park-1"}))])']
};
