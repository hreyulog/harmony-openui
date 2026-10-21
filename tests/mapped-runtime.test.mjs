// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest } from '../openui/src/main/ets/generated/OpenUiMappedRuntime.js';
import { createLanguageSession } from '../openui/src/main/ets/generated/OpenUiLangRuntime.js';

const program = `$kind = "all"
root = Stack([heading, filter, reset, showPark, $kind == "all" || $kind == "park" ? park : null, $kind == "all" || $kind == "museum" ? museum : null])
heading = CardHeader("周末去处", "由宿主提供的演示资料")
filter = FormControl("类型", Select("kind", [SelectItem("all", "全部"), SelectItem("park", "公园"), SelectItem("museum", "博物馆")], "选择类型", null, $kind))
reset = Button("重置", @Reset($kind), "tertiary")
showPark = Button("只看公园", @Set($kind, "park"), "secondary")
park = Card([Image("公园图片", "https://example.com/park.png"), CardHeader("公园 A", "户外"), TextContent("步行约 20 分钟"), Button("选择公园", @ToAssistant("选择公园 A", {itemId:"park-a", filter:$kind}))])
museum = Card([Image("博物馆图片", "https://example.com/museum.png"), CardHeader("博物馆 B", "室内"), TextContent("建议预留 2 小时"), Button("选择博物馆", @ToAssistant("选择博物馆 B", {itemId:"museum-b"}))])`;
const unpack = encoded => JSON.parse(encoded);
const selectId = result => result.bindings[0].componentId;
const labelId = (result, caption) => result.components.find(node => node.component === 'Button' && result.components.find(child => child.id === node.child)?.text === caption).id;
const cards = result => result.components.filter(node => node.component === 'Card').length;
function setupWrapper(options = {}) {
  const sources = ['core/OpenUiTypes', 'core/OpenUiCatalog', 'core/OpenUiController', 'lang/OpenUiMappedRuntime'].map(name => {
    const source = fs.readFileSync(fileURLToPath(new URL('../openui/src/main/ets/' + name + '.ets', import.meta.url)), 'utf8');
    return stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm, ''), { mode: 'transform' }).replace(/^export /gm, '');
  }).join('\n');
  const { Runtime } = vm.runInNewContext(sources + '\n({Runtime:OpenUiMappedRuntime})', { JSON, Map, Set, Date, Math, Object, Array, Number,
    createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest });
  return new Runtime('mapped', options);
}
function dispatch(runtime, caption, eventId = 'event-' + caption) {
  const surface = runtime.controller.getSurface('mapped');
  const id = labelId(surface, caption); const node = surface.components.find(node => node.id === id);
  return runtime.controller.dispatchAction({ surfaceId: 'mapped', sourceComponentId: id, ...node.action.event }, surface.revision, eventId);
}

test('one mapping registry generates official parameter order, prompt and support manifest', () => {
  const schema = JSON.parse(getMappedLibrarySchema()); const support = JSON.parse(getMappedSupportManifest());
  assert.deepEqual(Object.keys(schema.$defs.SelectItem.properties), ['value', 'label']);
  assert.deepEqual(Object.keys(schema.$defs.Image.properties), ['alt', 'src']);
  assert.equal(support.components.length, 19);
  assert.ok(getMappedSystemPrompt().includes('$binding<string>'));
  assert.ok(getMappedSystemPrompt().includes('only @Each(array'));
  assert.ok(getMappedSystemPrompt().includes('Do not use Query or Mutation'));
  assert.ok(support.capabilities.includes('@Each-display-only'));
  assert.ok(support.capabilities.includes('select-binding'));
});
test('the actual official store and expression engine filter native image cards without another program', () => {
  const session = createMappedSession(); const initial = unpack(session.replace(program));
  assert.equal(cards(initial), 2); assert.equal(initial.components.filter(node => node.component === 'Image').length, 2);
  const filtered = unpack(session.setField(selectId(initial), '"museum"'));
  assert.equal(cards(filtered), 1); assert.equal(filtered.components.some(node => node.text === '公园 A'), false);
  assert.equal(filtered.components.some(node => node.text === '博物馆 B'), true);
  assert.deepEqual(filtered.state, { $kind: 'museum' });
  assert.equal(selectId(initial), selectId(filtered));
  assert.equal(filtered.stats.replacements, 1); assert.equal(filtered.stats.stateUpdates, 1);
  const restored = unpack(session.dispatchAction(labelId(filtered, '重置')));
  assert.equal(cards(restored), 2); assert.equal(restored.bindings[0].value, 'all');
  assert.deepEqual(restored.actions, []); assert.equal(restored.stats.internalActions, 1);
});
test('Set runs locally, Reset restores declared defaults, and ToAssistant retains business context', () => {
  const session = createMappedSession(); const initial = unpack(session.replace(program));
  const parked = unpack(session.dispatchAction(labelId(initial, '只看公园')));
  assert.equal(cards(parked), 1); assert.deepEqual(parked.actions, []);
  const chosen = unpack(session.dispatchAction(labelId(parked, '选择公园')));
  assert.deepEqual(chosen.actions, [{ name: 'continue_conversation', context: { message: '选择公园 A', context: { itemId: 'park-a', filter: 'park' } } }]);
  assert.equal(chosen.stats.externalActions, 1); assert.equal(chosen.stats.replacements, 1);
  assert.throws(() => session.dispatchAction('removed-component'), /ACTION_UNKNOWN/);
});
test('multi-step state expressions use the official evaluator and preserve session isolation', () => {
  const a = createMappedSession(), b = createMappedSession();
  const source = '$count = 0\nroot=Stack([TextContent("" + $count), Button("加两次",Action([@Set($count,$count+1),@Set($count,$count+1)]))])';
  const initial = unpack(a.replace(source)); b.replace(source);
  const changed = unpack(a.dispatchAction(labelId(initial, '加两次')));
  assert.equal(changed.state.$count, 2); assert.equal(changed.components.some(node => node.text === '2'), true);
  assert.deepEqual(JSON.parse(b.stateSnapshotJson()), { $count: 0 });
  a.dispose(); assert.throws(() => a.stateSnapshotJson(), /DISPOSED/); assert.equal(JSON.parse(b.stateSnapshotJson()).$count, 0);
});
test('invalid fields, unsupported remote execution and malformed programs keep the last successful session', () => {
  const session = createMappedSession(); const before = unpack(session.replace(program));
  assert.throws(() => session.setField(selectId(before), '"unknown"'), /FIELD_VALUE/);
  assert.throws(() => session.replace('data=Query("remote",{})\nroot=Stack([TextContent("x")])'), /REMOTE_UNSUPPORTED/);
  assert.throws(() => session.replace('root=Stack([Web("https://example.com")])'), /MAPPED_/);
  assert.throws(() => session.replace('root=Stack([Image("bad", "http://example.com/bad.png")])'), /IMAGE_SOURCE/);
  assert.deepEqual(JSON.parse(session.stateSnapshotJson()), { $kind: 'all' });
  const selected = unpack(session.dispatchAction(labelId(before, '只看公园')));
  assert.equal(cards(selected), 1);
});
test('real ETS wrapper commits reactive patches, syncs select values, and hides internal actions from the host', () => {
  const receipts = [], errors = [], changes = [];
  const runtime = setupWrapper({ onAction: event => receipts.push(event), onError: error => errors.push(error), onStateUpdate: json => changes.push(json) });
  const initial = runtime.replace(program); const original = runtime.controller.getSurface('mapped');
  assert.equal(runtime.controller.setFieldValue('mapped', selectId(initial), 'park', original.revision), true);
  const filtered = runtime.controller.getSurface('mapped');
  assert.equal(filtered.updateMode, 'patch'); assert.equal(cards(filtered), 1); assert.equal(filtered.revision > original.revision, true);
  assert.equal(receipts.length, 0); assert.equal(dispatch(runtime, '选择公园'), true);
  assert.equal(receipts[0].context.context.itemId, 'park-a'); assert.equal(receipts[0].name, 'continue_conversation');
  assert.equal(dispatch(runtime, '重置'), true);
  const reset = runtime.controller.getSurface('mapped');
  assert.equal(cards(reset), 2); assert.equal(reset.components.find(node => node.component === 'OpenUiSelect').value, 'all');
  assert.equal(reset.fieldValuesJson, '{}', 'official state wins over the old native override after Reset');
  assert.equal(receipts.length, 1); assert.deepEqual(errors, []); assert.ok(changes.length >= 4);
  assert.equal(runtime.getStats().replacements, 1);
});
test('ETS wrapper retains state/tree on invalid replacement and fences readonly/stale/disposed callbacks', () => {
  const runtime = setupWrapper(); const initial = runtime.replace(program); const original = runtime.controller.getSurface('mapped');
  runtime.controller.setFieldValue('mapped', selectId(initial), 'museum', original.revision);
  const before = runtime.controller.exportSnapshot();
  assert.throws(() => runtime.replace('root=Stack([Image("bad", "http://example.com/a")])'), /MAPPED_/);
  assert.equal(runtime.controller.exportSnapshot(), before); assert.equal(JSON.parse(runtime.stateSnapshotJson()).$kind, 'museum');
  assert.equal(runtime.controller.setFieldValue('mapped', selectId(initial), 'park', original.revision), false);
  runtime.controller.setReadOnly('mapped', true); assert.equal(dispatch(runtime, '重置'), false);
  runtime.dispose(); assert.equal(runtime.controller.getSurface('mapped'), undefined); assert.throws(() => runtime.replace(program), /DISPOSED/);
});
test('legacy v0.2 ToAssistant preserves its previously dropped second context argument', () => {
  for (const context of ['{orderId:42}', '"receipt-42"']) {
    const result = unpack(createLanguageSession().push('root=Stack([Button("继续",@ToAssistant("查看订单",' + context + '))])', true));
    assert.deepEqual(result.errors, []);
    const event = result.components.find(node => node.action).action.event;
    assert.deepEqual(event.context, { message: '查看订单', context: context.startsWith('{') ? { orderId: 42 } : 'receipt-42' });
  }
});
test('oversized derived native text rolls back official state and retains the preceding action association', () => {
  const session = createMappedSession();
  const source = '$text="small"\nroot=Stack([TextContent($text),Button("grow",@Set($text,$text+$text)),Button("choose",@ToAssistant("ok",{id:"prior"}))])';
  let result = unpack(session.replace(source));
  for (let count = 0; count < 10; ++count) result = unpack(session.dispatchAction(labelId(result, 'grow')));
  const before = session.stateSnapshotJson();
  assert.throws(() => session.dispatchAction(labelId(result, 'grow')), /TEXT_LIMIT/);
  assert.equal(session.stateSnapshotJson(), before);
  assert.deepEqual(unpack(session.dispatchAction(labelId(result, 'choose'))).actions[0].context.context, { id: 'prior' });
  assert.throws(() => session.replace('root=Stack([TextContent(' + JSON.stringify('x'.repeat(8193)) + ')])'), /TEXT_LIMIT/);
  assert.equal(session.stateSnapshotJson(), before);
});
test('two independent native bindings combine predicates and reset together with the official Reset step', () => {
  const session = createMappedSession();
  const source = `$kind="all"
$duration="all"
root=Stack([kind,duration,reset,($kind=="all" || $kind=="park") && ($duration=="all" || $duration=="short") ? a : null,($kind=="all" || $kind=="museum") && ($duration=="all" || $duration=="long") ? b : null])
kind=Select("kind",[SelectItem("all","全部"),SelectItem("park","公园"),SelectItem("museum","博物馆")],"类型",null,$kind)
duration=Select("duration",[SelectItem("all","全部"),SelectItem("short","短"),SelectItem("long","长")],"时长",null,$duration)
reset=Button("reset",@Reset($kind,$duration))
a=Card([TextContent("A")])
b=Card([TextContent("B")])`;
  let result = unpack(session.replace(source));
  const kind = result.bindings.find(binding => binding.name === 'kind').componentId;
  const duration = result.bindings.find(binding => binding.name === 'duration').componentId;
  result = unpack(session.setField(kind, '"park"'));
  result = unpack(session.setField(duration, '"long"'));
  assert.equal(cards(result), 0);
  result = unpack(session.dispatchAction(labelId(result, 'reset')));
  assert.equal(cards(result), 2); assert.deepEqual(result.state, { $kind: 'all', $duration: 'all' });
  assert.equal(result.stats.replacements, 1); assert.equal(result.stats.stateUpdates, 2);
});
test('host observer failures cannot dispose a committed runtime or block later native interactions', () => {
  let actions = 0;
  const runtime = setupWrapper({ onStateUpdate() { throw Error('observer failed'); }, onError() { throw Error('error observer failed'); }, onAction() { actions++; } });
  const initial = runtime.replace(program);
  assert.equal(runtime.controller.setFieldValue('mapped', selectId(initial), 'park', runtime.controller.getSurface('mapped').revision), true);
  assert.equal(JSON.parse(runtime.stateSnapshotJson()).$kind, 'park');
  assert.equal(dispatch(runtime, '选择公园'), true); assert.equal(actions, 1);
  assert.equal(dispatch(runtime, '重置'), true); assert.equal(JSON.parse(runtime.stateSnapshotJson()).$kind, 'all');
});
test('dynamic layout or required-rule type mismatches roll back before native commit', () => {
  for (const source of [
    '$gap="m"\nroot=Stack([Button("bad",@Set($gap,"invalid"))],"column",$gap)',
    '$required=true\nroot=Stack([Select("kind",[SelectItem("all","All")],"Kind",{required:$required},"all"),Button("bad",@Set($required,"invalid"))])'
  ]) {
    const session = createMappedSession(); const result = unpack(session.replace(source)); const before = session.stateSnapshotJson();
    assert.throws(() => session.dispatchAction(labelId(result, 'bad')), /MAPPED_/);
    assert.equal(session.stateSnapshotJson(), before);
  }
});
test('failed field-derived evaluation restores both the official store and the native select value', () => {
  const errors = [];
  const runtime = setupWrapper({ onError: message => errors.push(message) });
  const source = '$kind="all"\nroot=Stack([Select("kind",[SelectItem("all","All"),SelectItem("bad","Bad")],"Kind",null,$kind),TextContent($kind=="all"?"ok":' + JSON.stringify('x'.repeat(8193)) + ')])';
  const initial = runtime.replace(source);
  const id = selectId(initial); const revision = runtime.controller.getSurface('mapped').revision;
  assert.equal(runtime.controller.setFieldValue('mapped', id, 'bad', revision), true);
  assert.equal(JSON.parse(runtime.stateSnapshotJson()).$kind, 'all');
  const surface = runtime.controller.getSurface('mapped');
  assert.equal(surface.fieldValuesJson, '{}'); assert.equal(surface.components.find(node => node.id === id).value, 'all');
  assert.equal(surface.components.some(node => node.text === 'ok'), true); assert.match(errors[0], /TEXT_LIMIT/);
});
test('conditional deeply composed cards respect the native depth budget and keep the previous program on failure', () => {
  const nested = 'Card(['.repeat(14) + 'TextContent("deep")' + '])'.repeat(14);
  const source = '$show=false\nroot=Stack([Button("show",@Set($show,true)),$show?' + nested + ':null])';
  const session = createMappedSession(); const initial = unpack(session.replace(source));
  assert.throws(() => session.dispatchAction(labelId(initial, 'show')), /NATIVE_DEPTH/);
  assert.deepEqual(JSON.parse(session.stateSnapshotJson()), { $show: false });
  assert.equal(unpack(session.currentResult()).components.some(node => node.text === 'deep'), false);
});
test('all projected component/property boundary cases agree with the shipped native catalog', () => {
  const nativeSources = ['OpenUiTypes', 'OpenUiCatalog'].map(name => stripTypeScriptTypes(
    fs.readFileSync(fileURLToPath(new URL('../openui/src/main/ets/core/' + name + '.ets', import.meta.url)), 'utf8')
      .replace(/^import[\s\S]*?;\r?\n/gm, ''), { mode: 'transform' }).replace(/^export /gm, '')).join('\n');
  const Catalog = vm.runInNewContext(nativeSources + '\nOpenUiCatalog', { JSON, Map, Set, Object, Array, Number, Math });
  const stringValues = ['', 'ok', 'x'.repeat(500), 'x'.repeat(501), 'x'.repeat(8192), 'x'.repeat(8193), null, true, 42];
  const cases = [
    ['"ok"', 'TextContent($v)', stringValues],
    ['"ok"', 'CardHeader($v,"subtitle")', stringValues],
    ['"ok"', 'FormControl($v,Select("kind",[SelectItem("a","A")],"Kind",null,"a"))', stringValues],
    ['"kind"', 'Select($v,[SelectItem("a","A")],"Kind",null,"a")', ['x'.repeat(64), 'x'.repeat(65), '__proto__', 'constructor', null, 42, true]],
    ['"ok"', 'Select("kind",[SelectItem("a",$v)],"Kind",null,"a")', stringValues],
    ['"https://example.com/a.png"', 'Image("alt",$v)', ['https://example.com/a', 'http://example.com/a', 'https://example.com/' + 'x'.repeat(2028), 'https://example.com/' + 'x'.repeat(2029), null, 42]],
    ['"ok"', 'Image($v,"https://example.com/a.png")', stringValues],
    ['"ok"', 'Button($v,@ToAssistant("choose",{id:"item"}))', stringValues],
    ['true', 'Select("kind",[SelectItem("a","A")],"Kind",{required:$v},"a")', [true, false, null, 'invalid', 42]],
    ['"m"', 'Stack([TextContent("inside")],"column",$v)', ['none', 'xs', 's', 'm', 'l', 'xl', '2xl', 'invalid', null, 42, true]],
    ['"column"', 'Stack([TextContent("inside")],$v)', ['row', 'column', 'invalid', null, 42, true]],
    ['"start"', 'Stack([TextContent("inside")],"column","m",$v)', ['start', 'center', 'end', 'stretch', 'baseline', 'invalid', null, 42]],
    ['"start"', 'Stack([TextContent("inside")],"column","m","start",$v)', ['start', 'center', 'end', 'between', 'around', 'evenly', 'invalid', null, 42]],
    ['"default"', 'TextContent("inside",$v)', ['small', 'default', 'large', 'small-heavy', 'large-heavy', 'invalid', null, 42]]
  ];
  let checked = 0;
  for (const [initial, component, values] of cases) {
    for (const value of values) {
      const source = '$v=' + initial + '\nroot=Stack([' + component + ',Button("change",@Set($v,' + JSON.stringify(value) + '))])';
      const session = createMappedSession();
      const first = unpack(session.replace(source)); Catalog.validateTree(first.components);
      const before = session.stateSnapshotJson();
      let changed;
      try { changed = unpack(session.dispatchAction(labelId(first, 'change'))); }
      catch { assert.equal(session.stateSnapshotJson(), before); changed = unpack(session.currentResult()); }
      assert.doesNotThrow(() => Catalog.validateTree(changed.components), component + ' -> ' + JSON.stringify(value).slice(0, 80));
      checked++;
    }
  }
  assert.ok(checked >= 100);
});
test('the real Nova model derived-state program is rejected while the preceding working UI and bindings remain usable', () => {
  const source = fs.readFileSync(new URL('./fixtures/mapped-model-derived-state.openui', import.meta.url), 'utf8');
  const session = createMappedSession(); const initial = unpack(session.replace(program));
  assert.throws(() => session.replace(source), /STATE_INITIALIZER|STATE_DUPLICATE/);
  assert.deepEqual(JSON.parse(session.stateSnapshotJson()), { $kind: 'all' });
  const filtered = unpack(session.setField(selectId(initial), '"museum"'));
  assert.equal(cards(filtered), 1); assert.equal(filtered.components.some(node => node.text === '博物馆 B'), true);

  const runtime = setupWrapper(); const nativeInitial = runtime.replace(program);
  const before = runtime.controller.exportSnapshot();
  assert.throws(() => runtime.replace(source), /STATE_INITIALIZER|STATE_DUPLICATE/);
  assert.equal(runtime.controller.exportSnapshot(), before);
  assert.equal(runtime.controller.setFieldValue('mapped', selectId(nativeInitial), 'park', runtime.controller.getSurface('mapped').revision), true);
  assert.equal(cards(runtime.controller.getSurface('mapped')), 1);
  assert.equal(JSON.parse(runtime.stateSnapshotJson()).$kind, 'park');
});
test('state declarations accept usable scalar literals and reject duplicates or expression/object defaults through the official parser', () => {
  for (const value of ['"all"', '42', '-1', 'true', 'false', '("all")']) {
    const session = createMappedSession();
    assert.doesNotThrow(() => session.replace('$value=' + value + '\nroot=Stack([TextContent("ok")])'));
  }
  for (const value of ['1+2', '$other=="all"', '[1]', '{kind:"all"}', 'null']) {
    const session = createMappedSession();
    assert.throws(() => session.replace('$other="all"\n$value=' + value + '\nroot=Stack([TextContent("ok")])'), /STATE_INITIALIZER/);
  }
  const session = createMappedSession();
  assert.throws(() => session.replace('$kind="all"\n$kind="park"\nroot=Stack([TextContent("ok")])'), /STATE_DUPLICATE/);
  assert.doesNotThrow(() => session.replace('$kind="all"\nroot=Stack([TextContent("a string can contain $kind = expression without declaring it")])'));
  assert.ok(getMappedSystemPrompt().includes('Declare each $state variable exactly once'));
});
