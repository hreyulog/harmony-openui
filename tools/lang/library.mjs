// SPDX-License-Identifier: Apache-2.0
import { createLibrary, defineComponent, defineAction, action } from '@openuidev/lang-core';
import { z } from 'zod/v4';

const component = (name, description, props) => defineComponent({ name, description, props: z.object(props), component: null });
const text = component('Text', 'Readable text with host-controlled typography.', {
  content: z.string(), variant: z.enum(['heading', 'body', 'caption']).optional()
});
const option = component('Option', 'A complete selectable row. Keep description short and put one compact observed metric in meta. A click only returns an action to the host.', {
  title: z.string(), description: z.string(), meta: z.string(), action: action()
});
const facts = component('Facts', 'An aligned group of verified label/value facts.', {
  facts: z.array(z.object({ label: z.string(), value: z.string() })), title: z.string().optional()
});
const status = component('Status', 'A concise status supported by supplied facts. Visual tone does not establish business success.', {
  text: z.string(), tone: z.enum(['neutral', 'success', 'warning']).optional()
});
const details = component('Details', 'Supplementary text, locally expandable. Keep essential facts visible outside it.', { title: z.string(), text: z.string() });
const button = component('Button', 'An ordinary host action; the renderer never performs business or network operations.', {
  label: z.string(), action: action(), variant: z.enum(['primary', 'borderless']).optional()
});
const field = z.string().min(1).max(64).regex(/^[A-Za-z][A-Za-z0-9_-]*$/);
const inputProps = {
  field, label: z.string(), value: z.string().optional(), placeholder: z.string().optional(),
  required: z.boolean().optional(), disabled: z.boolean().optional()
};
const textInput = component('TextInput', 'A labelled single-line field. Use a unique field key inside a Form. Initial values are supplied facts, not guesses.', {
  ...inputProps, inputType: z.enum(['text', 'number', 'email', 'tel']).optional()
});
const textArea = component('TextArea', 'A labelled multiline field for a short user note.', inputProps);
const search = component('Search', 'A labelled local form search field. Typing never makes a network request.', inputProps);
const boolProps = { field, label: z.string(), value: z.boolean().optional(), required: z.boolean().optional(), disabled: z.boolean().optional() };
const checkbox = component('Checkbox', 'A labelled boolean checkbox. A required checkbox must be checked before Submit is accepted.', boolProps);
const toggle = component('Toggle', 'A labelled on/off value. A required toggle must be on before Submit is accepted.', boolProps);
const selectOptions = z.array(z.object({ label: z.string(), value: z.string() })).min(1).max(100);
const selectProps = { field, label: z.string(), options: selectOptions, value: z.string().optional(), required: z.boolean().optional(), disabled: z.boolean().optional() };
const select = component('Select', 'A labelled native select with distinct supplied option values.', selectProps);
const radioGroup = component('RadioGroup', 'A small visible group of mutually exclusive supplied options.', selectProps);
const slider = component('Slider', 'A labelled numeric value with a bounded range. Choose sensible min, max and step values.', {
  field, label: z.string(), value: z.number().optional(), min: z.number().optional(), max: z.number().optional(),
  step: z.number().positive().optional(), disabled: z.boolean().optional()
});
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const datePicker = component('DatePicker', 'A labelled calendar date. Values use YYYY-MM-DD; minDate and maxDate are inclusive.', {
  field, label: z.string(), value: date.optional(), minDate: date.optional(), maxDate: date.optional(),
  required: z.boolean().optional(), disabled: z.boolean().optional()
});
const timePicker = component('TimePicker', 'A labelled 24-hour time. Values use HH:mm.', {
  field, label: z.string(), value: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  required: z.boolean().optional(), disabled: z.boolean().optional()
});
const image = component('Image', 'An image from an HTTPS URL supplied by the host. Never invent, search for or construct image URLs.', {
  source: z.string().max(2048).regex(/^https:\/\//), alt: z.string().max(500), aspectRatio: z.number().min(0.25).max(4).optional()
});
const list = component('List', 'A bounded native scrolling list of supplied items. Use a viewport height between 120 and 480 vp.', {
  items: z.array(z.object({ title: z.string(), description: z.string().optional(), meta: z.string().optional() })).min(1).max(100),
  title: z.string().optional(), height: z.number().min(120).max(480).optional()
});
const dialog = component('Dialog', 'An explicit button that opens a native confirmation dialog. Only confirming returns the declared action to the host; cancellation has no action.', {
  label: z.string(), title: z.string(), text: z.string(), action: action(), confirmLabel: z.string().optional(), cancelLabel: z.string().optional()
});
const leaves = z.union([text.ref, option.ref, facts.ref, status.ref, details.ref, button.ref, textInput.ref, textArea.ref,
  search.ref, checkbox.ref, toggle.ref, select.ref, radioGroup.ref, slider.ref, datePicker.ref, timePicker.ref, image.ref, list.ref, dialog.ref]);
const row = component('Row', 'A horizontal group of small content blocks. Use Stack when narrow content should wrap vertically.', { children: z.array(leaves) });
const form = component('Form', 'A named group of labelled fields and a Button with @Submit of this form name. Keep field keys unique. Forms can appear in Stack or Card and cannot nest.', {
  name: field, children: z.array(z.union([leaves, row.ref]))
});
const card = component('Card', 'A bounded group of related information. Do not nest cards.', { children: z.array(z.union([leaves, row.ref, form.ref])) });
const stack = component('Stack', 'A vertical layout using the application spacing scale.', { children: z.array(z.union([leaves, row.ref, card.ref, form.ref])) });
const choose = defineAction({ name: 'Choose', description: 'Return the selected value to the host, without executing a business operation.', params: z.object({ value: z.string() }) });
const submit = defineAction({ name: 'Submit', description: 'Submit the containing Form name. The host reads and validates the live field values; never put a model-generated fields object in the action.', params: z.object({ form: field }) });

export const library = createLibrary({
  components: [stack, row, card, text, option, facts, status, details, button, form, textInput, textArea, search, checkbox, toggle,
    select, radioGroup, slider, datePicker, timePicker, image, list, dialog], root: 'Stack', actions: [choose, submit]
});
export const promptOptions = {
  preamble: 'Generate a native HarmonyOS interface using the supplied facts and supported OpenUI Lang components. Respond in the user language.',
  toolCalls: false, bindings: false, builtinFunctions: false,
  additionalRules: [
    'This v0.2 renderer supports a bounded native component catalog and single-step Choose, Submit, ToAssistant and OpenUrl actions. $state, queries, mutations and multi-step actions are not supported. It does not expose the whole ArkUI API.',
    'Every program starts with root = Stack([...]). Use only the registered components. Do not emit HTML, JavaScript, ArkTS, CSS or arbitrary component names.',
    'Use concise primary titles, short secondary descriptions, and compact metrics. The native host owns fonts, colors, spacing and touch size.',
    'Use only supplied or tool-observed facts. Never invent prices, availability, permissions, completed actions or confirmations.',
    'Use Option for meaningful choices, Facts for results, Status for concise state, Details for secondary explanations. Do not repeat the same information in multiple components.',
    'Use Form(name, children) for user input. Every input needs a unique field key and a visible label. Only request information needed for the current step; set required=true when needed. Keep forms concise and never prefill invented personal data.',
    'Submit must reference the containing Form name, for example Button("Continue", @Submit("trip")) inside Form("trip", [...]). Do not nest Forms. The host collects live field values and validates required fields before returning Submit; the language action only carries the form name.',
    'Only use HTTPS image URLs explicitly supplied by the host. Image( source, alt, aspectRatio ) needs useful alternative text. A List is a bounded scroll viewport, not an unbounded page.',
    'Dialog is an explicit confirmation launcher, never an automatic popup or proof of a completed business action. The host receives its action only after user confirmation.'
  ],
  examples: [
    'root = Stack([heading, a, b])\nheading = Text("选择一个方案", "heading")\na = Option("方案 A", "较早出发", "¥53", @Choose("a"))\nb = Option("方案 B", "较短用时", "¥51.5", @Choose("b"))',
    'root = Stack([status, facts, source])\nstatus = Status("查询完成 · 未下单", "success")\nfacts = Facts([{label:"方案",value:"A"},{label:"费用",value:"¥53"}], "核实结果")\nsource = Details("来源说明", "此例中的数值为演示数据。")',
    'root = Stack([trip])\ntrip = Form("trip", [name, seat, date, send])\nname = TextInput("traveler", "乘车人", "", "请输入姓名", true)\nseat = Select("seat", "席别", [{label:"二等座",value:"second"},{label:"一等座",value:"first"}], "second", true)\ndate = DatePicker("date", "出发日期", "2026-10-23", "2026-10-20", "2026-12-31", true)\nsend = Button("继续", @Submit("trip"))'
  ]
};
