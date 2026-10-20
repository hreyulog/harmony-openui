import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageSession, getSystemPrompt, getLibrarySchema } from '../openui/src/main/ets/generated/OpenUiLangRuntime.js';

const choice = 'root = Stack([title, a, b])\ntitle = Text("选择方案", "heading")\na = Option("方案 A", "较早出发", "¥53", @Choose("a"))\nb = Option("方案 B", "较短用时", "¥51.5", @Choose("b"))';
test('the official parser maps real OpenUI Lang and actions into native component data', () => {
  const result = JSON.parse(createLanguageSession().push(choice, true));
  assert.deepEqual(result.errors, []); assert.equal(result.incomplete, false);
  assert.equal(result.components[0].id, 'root');
  assert.equal(result.components.find(node => node.id === 'n_a').component, 'OpenUiOption');
  assert.deepEqual(result.components.find(node => node.id === 'n_a').action, {event:{name:'choose',context:{value:'a'}}});
  assert.ok(getSystemPrompt().includes('Option('));
  assert.ok(JSON.parse(getLibrarySchema()).$defs.Option);
});
test('arbitrary chunk boundaries converge to the same tree, including a split quoted Unicode string', () => {
  const parser = createLanguageSession(); let result;
  for (let at = 0; at < choice.length; at += 3) result = JSON.parse(parser.push(choice.slice(at, at + 3), at + 3 >= choice.length));
  assert.deepEqual(result, JSON.parse(createLanguageSession().push(choice, true)));
});
test('native result facts and supplementary details have no hidden selection action', () => {
  const result = JSON.parse(createLanguageSession().push('root = Stack([status, facts, source])\nstatus = Status("查询完成", "success")\nfacts = Facts([{label:"费用",value:"¥53"}], "结果")\nsource = Details("来源", "演示资料")', true));
  assert.deepEqual(result.errors, []);
  assert.equal(result.components.some(node => node.action), false);
  assert.equal(result.components.find(node => node.component === 'OpenUiFacts').facts[0].value, '¥53');
});
test('unsupported components, queries, reactive state and multi-step actions are explicit errors', () => {
  for (const source of [
    'root = Stack([Web("https://example.com")])',
    '$name = "private"\nroot = Stack([Text($name)])',
    'data = Query("remote", {})\nroot = Stack([Text("pending")])',
    'root = Stack([Button("Do", Action([@Choose("a"), @Choose("b")]))])'
  ]) assert.ok(JSON.parse(createLanguageSession().push(source, true)).errors.length > 0, source);
});
test('conversation and URL actions are returned as data and never executed by the parser', () => {
  const result = JSON.parse(createLanguageSession().push('root = Stack([Button("解释", @ToAssistant("解释当前结果")), Button("打开", @OpenUrl("https://example.com"))])', true));
  assert.deepEqual(result.errors, []);
  const actions = result.components.filter(node => node.action).map(node => node.action.event.name);
  assert.deepEqual(actions, ['continue_conversation','open_url']);
});
test('native synthetic children cannot collide with legal model statement names', () => {
  const result = JSON.parse(createLanguageSession().push('root = Stack([a, a_content, b, b_label])\na = Card([Text("inside")])\na_content = Text("outside")\nb = Button("Go", @Choose("a"))\nb_label = Text("extra")', true));
  assert.deepEqual(result.errors, []);
  assert.equal(new Set(result.components.map(node => node.id)).size, result.components.length);
});
