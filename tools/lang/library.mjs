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
const leaves = z.union([text.ref, option.ref, facts.ref, status.ref, details.ref, button.ref]);
const row = component('Row', 'A horizontal group of small content blocks. Use Stack when narrow content should wrap vertically.', { children: z.array(leaves) });
const card = component('Card', 'A bounded group of related information. Do not nest cards.', { children: z.array(z.union([leaves, row.ref])) });
const stack = component('Stack', 'A vertical layout using the application spacing scale.', { children: z.array(z.union([leaves, row.ref, card.ref])) });
const choose = defineAction({ name: 'Choose', description: 'Return the selected value to the host, without executing a business operation.', params: z.object({ value: z.string() }) });

export const library = createLibrary({
  components: [stack, row, card, text, option, facts, status, details, button], root: 'Stack', actions: [choose]
});
export const promptOptions = {
  preamble: 'Generate a native HarmonyOS interface using the supplied facts and supported OpenUI Lang components. Respond in the user language.',
  toolCalls: false, bindings: false, builtinFunctions: false,
  additionalRules: [
    'This renderer supports static component trees and single-step Choose, ToAssistant and OpenUrl actions. Queries, mutations, reactive state and multi-step actions are not supported in v0.1.',
    'Every program starts with root = Stack([...]). Use only the registered components. Do not emit HTML, JavaScript, ArkTS, CSS or arbitrary component names.',
    'Use concise primary titles, short secondary descriptions, and compact metrics. The native host owns fonts, colors, spacing and touch size.',
    'Use only supplied or tool-observed facts. Never invent prices, availability, permissions, completed actions or confirmations.',
    'Use Option for meaningful choices, Facts for results, Status for concise state, Details for secondary explanations. Do not repeat the same information in multiple components.'
  ],
  examples: [
    'root = Stack([heading, a, b])\nheading = Text("选择一个方案", "heading")\na = Option("方案 A", "较早出发", "¥53", @Choose("a"))\nb = Option("方案 B", "较短用时", "¥51.5", @Choose("b"))',
    'root = Stack([status, facts, source])\nstatus = Status("查询完成 · 未下单", "success")\nfacts = Facts([{label:"方案",value:"A"},{label:"费用",value:"¥53"}], "核实结果")\nsource = Details("来源说明", "此例中的数值为演示数据。")'
  ]
};
