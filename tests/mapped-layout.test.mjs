// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest } from '../openui/src/main/ets/generated/OpenUiMappedRuntime.js';

const unpack = value => JSON.parse(value);
function nativeRuntime() {
  const sources = ['core/OpenUiTypes', 'core/OpenUiCatalog', 'core/OpenUiController', 'lang/OpenUiMappedRuntime'].map(name => {
    const source = fs.readFileSync(new URL('../openui/src/main/ets/' + name + '.ets', import.meta.url), 'utf8');
    return stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm, ''), { mode: 'transform' }).replace(/^export /gm, '');
  }).join('\n');
  const { Runtime } = vm.runInNewContext(sources + '\n({Runtime:OpenUiMappedRuntime})', {
    JSON, Map, Set, Date, Math, Object, Array, Number, createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest
  });
  return new Runtime('layout');
}
function buttonId(result, label) {
  return result.components.find(node => node.component === 'Button' && result.components.find(child => child.id === node.child)?.text === label).id;
}

test('generated mapping preserves distinct official Card and Stack argument orders and explains them', () => {
  const schema = unpack(getMappedLibrarySchema());
  assert.deepEqual(Object.keys(schema.$defs.Card.properties), ['children', 'variant', 'direction', 'gap', 'align', 'justify', 'wrap']);
  assert.deepEqual(Object.keys(schema.$defs.Stack.properties), ['children', 'direction', 'gap', 'align', 'justify', 'wrap']);
  const prompt = getMappedSystemPrompt();
  assert.ok(prompt.includes('Card([...], "card", "column", "s")'));
  assert.ok(prompt.includes('variant SECOND'));
  assert.ok(prompt.includes('Never write Card([...], "column", "s")'));
  assert.ok(prompt.includes('Prefer Card(children) and Stack(children)'));
});

test('the actual M3 Card argument error is rejected without replacing the preceding native document', () => {
  const runtime = nativeRuntime();
  runtime.replace('$kind="all"\nroot=Stack([Card([TextContent("Retained result")])])');
  const snapshot = runtime.controller.exportSnapshot(), state = runtime.stateSnapshotJson();
  for (const source of [
    'root=Stack([Card([TextContent("Wrong card")],"column","s")])',
    'root=Stack([Card([TextContent("Wrong card")],"sunk")])'
  ]) {
    // Literal type errors may be rejected by the official parser before the
    // executable mapping sees them; dynamic values use CARD_VARIANT below.
    assert.throws(() => runtime.replace(source), /OPENUI_MAPPED_(CARD_VARIANT|PARSE:type-mismatch)/);
    assert.equal(runtime.controller.exportSnapshot(), snapshot);
    assert.equal(runtime.stateSnapshotJson(), state);
  }
  assert.ok(runtime.controller.getSurface('layout').components.some(node => node.text === 'Retained result'));
});

test('correct Card arguments and optional null layout positions pass actual native catalog validation', () => {
  const runtime = nativeRuntime();
  for (const expression of [
    'Card([TextContent("Result")],"card","column","s")',
    'Card([TextContent("Result")],null,"column","s",null,null,null)',
    'Card([TextContent("Result")],null,null,null,null,null,null)',
    'Card([Stack([TextContent("Result")],null,null,null,null,null)],"clear",null,null,null,null,null)'
  ]) {
    runtime.replace('root=Stack([' + expression + '],null,null,null,null,null)');
    const surface = runtime.controller.getSurface('layout');
    const card = surface.components.find(node => node.component === 'Card');
    assert.ok(card);
    const content = surface.components.find(node => node.id === card.child);
    assert.equal(content.component, 'Column');
    if (expression.includes('"s"')) assert.equal(content.styles.gap, '16px');
    if (expression.includes('"clear"')) assert.equal(card.styles['background-color'], 'transparent');
  }
});

test('the actual model Form heading with an extra Card position cannot replace the working form', () => {
  const runtime = nativeRuntime();
  runtime.replace('root=Stack([Form("details",Buttons([Button("Continue")]),[FormControl("Name",Input("name"))])])');
  const snapshot = runtime.controller.exportSnapshot();
  assert.throws(() => runtime.replace('root=Stack([Card([TextContent("Heading")],"clear","column","xs","stretch","start","start",false)])'),
    /OPENUI_MAPPED_(WRAP_UNSUPPORTED|PARSE:)/);
  assert.equal(runtime.controller.exportSnapshot(), snapshot);
});

test('invalid non-null layout properties remain rejected instead of being shifted or repaired', () => {
  const session = createMappedSession();
  for (const expression of [
    'Card([TextContent("Result")],"card","s")',
    'Card([TextContent("Result")],"card","column","tiny")',
    'Stack([TextContent("Result")],"s")',
    'Stack([TextContent("Result")],null,null,"diagonal")'
  ]) assert.throws(() => session.replace('root=Stack([' + expression + '])'), /OPENUI_MAPPED_(LAYOUT_VALUE|PARSE:type-mismatch)/);
});

test('a dynamic invalid card variant rolls back store and preserves the current action association', () => {
  const session = createMappedSession();
  const initial = unpack(session.replace('$variant="card"\nroot=Stack([Card([TextContent("Result")],$variant),Button("bad",@Set($variant,"column")),Button("choose",@ToAssistant("Choose",{itemId:"original"}))])'));
  const before = session.stateSnapshotJson();
  assert.throws(() => session.dispatchAction(buttonId(initial, 'bad')), /OPENUI_MAPPED_CARD_VARIANT/);
  assert.equal(session.stateSnapshotJson(), before);
  const chosen = unpack(session.dispatchAction(buttonId(initial, 'choose')));
  assert.deepEqual(chosen.actions, [{ name: 'continue_conversation', context: { message: 'Choose', context: { itemId: 'original' } } }]);
});
