// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createLanguageSession, getSystemPrompt, getLibrarySchema } from '../openui/src/main/ets/generated/OpenUiLangRuntime.js';

// Compile the shipped ETS controller and language wrapper, while injecting the
// actual generated upstream parser runtime rather than a parser stub.
function setup() {
  const sources = [
    '../openui/src/main/ets/core/OpenUiTypes.ets',
    '../openui/src/main/ets/core/OpenUiCatalog.ets',
    '../openui/src/main/ets/core/OpenUiController.ets',
    '../openui/src/main/ets/lang/OpenUiLanguage.ets'
  ].map(name => {
    const source = fs.readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
    return stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm, ''), {mode:'transform'})
      .replace(/^export /gm, '');
  }).join('\n');
  const types = vm.runInNewContext(sources + '\n({Controller:OpenUiController, Stream:OpenUiLanguageStream, Catalog:OpenUiCatalog})',
    {JSON, Map, Set, Date, Math, Object, Array, Number, createLanguageSession, getSystemPrompt, getLibrarySchema});
  const controller = new types.Controller();
  return {...types, controller, stream:new types.Stream(controller, 'surface')};
}

const choice = 'root = Stack([title, option])\ntitle = Text("选择方案", "heading")\noption = Option("方案 A", "较早到达", "¥53", @Choose("a"))';
const result = 'root = Stack([status, facts, source])\nstatus = Status("查询完成", "success")\nfacts = Facts([{label:"费用",value:"¥53"},{label:"历时",value:"2 小时"}], "结果")\nsource = Details("来源", "演示资料")';

test('the actual ETS wrapper accepts three-character Facts and Status chunks and publishes only valid native trees', () => {
  for (const source of [
    'root = Stack([Facts([{label:"费用",value:"¥53"}], "结果")])',
    result
  ]) {
    const {controller, stream, Catalog} = setup();
    let published = 0;
    const invalidPublications = [];
    controller.subscribe(() => {
      try { Catalog.validateTree(controller.getSurface('surface').components); }
      catch (error) { invalidPublications.push(String(error)); }
      published++;
    });
    for (let offset = 0; offset < source.length; offset += 3) {
      assert.doesNotThrow(() => stream.append(source.slice(offset, offset + 3), offset + 3 >= source.length),
        `chunk at ${offset}: ${source.slice(offset, offset + 3)}`);
    }
    const surface = controller.getSurface('surface');
    const expected = JSON.parse(createLanguageSession().push(source, true));
    assert.deepEqual(surface.components, expected.components);
    assert.ok(published > 0);
    assert.deepEqual(invalidPublications, []);
    assert.equal(surface.components.some(node => node.action), false);
    assert.equal(surface.components.find(node => node.component === 'OpenUiFacts').facts[0].value, '¥53');
  }
});

test('an incomplete native node keeps the last valid tree instead of escaping a partial required-property error', () => {
  const {controller, stream, Stream, Catalog} = setup();
  stream.replace(choice);
  const next = new Stream(controller, 'surface');
  const source = 'root = Stack([Facts([{label:"费用",value:"¥53"}], "结果")])';
  let sawBufferedNativeNode = false;
  for (let offset = 0; offset < source.length; offset += 3) {
    const before = controller.exportSnapshot();
    const parsed = next.append(source.slice(offset, offset + 3), offset + 3 >= source.length);
    try { Catalog.validateTree(parsed.components); }
    catch {
      sawBufferedNativeNode = true;
      assert.equal(controller.exportSnapshot(), before);
    }
  }
  assert.equal(sawBufferedNativeNode, true, 'fixture must exercise an actually incomplete native Facts node');
  assert.ok(controller.getSurface('surface').components.some(node => node.component === 'OpenUiFacts'));
});

test('complete invalid programs preserve the previously committed tree and its revision', () => {
  const {controller, stream} = setup();
  stream.replace(choice);
  for (const invalid of [
    'root = Stack([Web("https://example.com")])',
    'root = Stack([Status("完成", "unknown-tone")])',
    'root = Stack([Facts([{label:"费用"}], "结果")])',
    'root = Stack([Text("没有结束'
  ]) {
    const before = controller.exportSnapshot();
    assert.throws(() => stream.replace(invalid), /OPENUI_/);
    assert.equal(controller.exportSnapshot(), before);
  }
  assert.doesNotThrow(() => stream.replace(result));
  assert.ok(controller.getSurface('surface').components.some(node => node.component === 'OpenUiStatus'));
});

test('replace swaps the complete program, drops obsolete nodes and selection, and rejects callbacks from the old tree', () => {
  const {controller, stream} = setup();
  stream.replace(choice);
  const previous = controller.getSurface('surface');
  const oldOption = previous.components.find(node => node.component === 'OpenUiOption');
  controller.setSelected('surface', oldOption.id);
  const oldRevision = controller.getSurface('surface').revision;
  stream.replace(result);
  const surface = controller.getSurface('surface');
  assert.equal(surface.components.some(node => node.id === oldOption.id), false);
  assert.equal(surface.selectedComponent, '');
  assert.equal(surface.components.some(node => node.component === 'OpenUiOption'), false);
  assert.deepEqual(surface.components, JSON.parse(createLanguageSession().push(result, true)).components);
  const stale = {surfaceId:'surface', sourceComponentId:oldOption.id, ...oldOption.action.event};
  assert.equal(controller.dispatchAction(stale, oldRevision, 'old-native-callback'), false);
  assert.equal(controller.dispatchAction(stale, surface.revision, 'removed-component-callback'), false);
});
