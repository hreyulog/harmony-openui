// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest } from '../openui/src/main/ets/generated/OpenUiMappedRuntime.js';

const unpack = source => JSON.parse(source);
const radioItems = '[RadioItem("Window","See outside","window"),RadioItem("Aisle","Easy access","aisle")]';
const field = (result, name, itemName) => result.bindings.find(binding => binding.name === name && (itemName === undefined || binding.itemName === itemName));
const button = (result, label) => result.components.find(node => node.component === 'Button' && result.components.some(child => child.id === node.child && child.text === label)).id;
const nativeRadio = result => result.components.find(node => node.component === 'OpenUiRadioGroup');
function setup(options = {}) {
  const sources = ['core/OpenUiTypes', 'core/OpenUiCatalog', 'core/OpenUiController', 'lang/OpenUiMappedRuntime'].map(name => {
    const source = fs.readFileSync(new URL('../openui/src/main/ets/' + name + '.ets', import.meta.url), 'utf8');
    return stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm, ''), { mode: 'transform' }).replace(/^export /gm, '');
  }).join('\n');
  const Runtime = vm.runInNewContext(sources + '\nOpenUiMappedRuntime', {
    JSON, Map, Set, Date, Math, Object, Array, Number, createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest
  });
  return new Runtime('choices', options);
}
function dispatch(runtime, label) {
  const surface = runtime.controller.getSurface('choices'), id = button(surface, label);
  const node = surface.components.find(item => item.id === id);
  return runtime.controller.dispatchAction({ surfaceId: 'choices', sourceComponentId: id, ...node.action.event }, surface.revision, label + '-' + surface.revision);
}

test('new choice groups retain upstream positional order, form unions and bounded prompt semantics', () => {
  const schema = unpack(getMappedLibrarySchema()), support = unpack(getMappedSupportManifest());
  assert.equal(support.components.length, 19);
  for (const [name, keys] of [
    ['RadioItem', ['label', 'description', 'value']],
    ['RadioGroup', ['name', 'items', 'defaultValue', 'rules', 'value']],
    ['SwitchItem', ['label', 'description', 'name', 'defaultChecked']],
    ['SwitchGroup', ['name', 'items', 'variant', 'value']]
  ]) assert.deepEqual(Object.keys(schema.$defs[name].properties), keys);
  const union = JSON.stringify(schema.$defs.FormControl.properties.input);
  assert.ok(union.includes('#/$defs/RadioGroup'));
  assert.ok(!union.includes('#/$defs/SwitchGroup'), 'upstream SwitchGroup is an independent component, not a FormControl field');
  const prompt = getMappedSystemPrompt();
  assert.ok(prompt.includes('It has NO rules argument'));
  assert.ok(prompt.includes('@Filter(array, "field", operator, value)'));
  assert.ok(prompt.includes('Every @Each template and nested computed child array is display/action-only'));
  assert.ok(support.capabilities.includes('radio-binding'));
  assert.ok(support.capabilities.includes('switch-record-binding'));
});

test('unbound radio default is visible and submits live values without losing descriptions', () => {
  const session = createMappedSession();
  let result = unpack(session.replace('root=Stack([Form("trip",Buttons([Button("Submit",@ToAssistant("submit"))]),[FormControl("Seat",RadioGroup("seat",' + radioItems + ',"aisle",{required:true}))])])'));
  assert.equal(nativeRadio(result).value, 'aisle');
  assert.deepEqual(nativeRadio(result).options.map(option => option.description), ['See outside', 'Easy access']);
  result = unpack(session.dispatchAction(button(result, 'Submit')));
  assert.deepEqual(result.validationErrors, {});
  assert.equal(result.actions[0].context.formState.trip.seat, 'aisle');
  result = unpack(session.setField(field(result, 'seat').componentId, '"window"'));
  result = unpack(session.dispatchAction(button(result, 'Submit')));
  assert.equal(result.actions[0].context.formState.trip.seat, 'window', 'an edit wins over the declared default');
});

test('a bound empty radio remains blank despite a default and gates required submission until a real choice', () => {
  const session = createMappedSession();
  let result = unpack(session.replace('$seat=""\nroot=Stack([Form("trip",Buttons([Button("Submit",@ToAssistant("submit")),Button("Reset",@Reset($seat))]),[FormControl("Seat",RadioGroup("seat",' + radioItems + ',"aisle",{required:true},$seat))])])'));
  const id = field(result, 'seat').componentId;
  assert.equal(nativeRadio(result).value, '');
  result = unpack(session.dispatchAction(button(result, 'Submit')));
  assert.deepEqual(result.actions, []); assert.equal(result.validationErrors[id], 'required');
  result = unpack(session.setField(id, '"window"'));
  assert.deepEqual(result.validationErrors, {});
  result = unpack(session.dispatchAction(button(result, 'Submit')));
  assert.equal(result.actions[0].context.formState.trip.seat, 'window');
  result = unpack(session.dispatchAction(button(result, 'Reset')));
  assert.equal(result.state.$seat, ''); assert.equal(nativeRadio(result).value, '');
  assert.deepEqual(result.actions, []);
});

test('radio option ambiguity, invalid defaults and invalid edits leave preceding state usable', () => {
  const session = createMappedSession();
  const original = unpack(session.replace('$seat="window"\nroot=Stack([RadioGroup("seat",' + radioItems + ',"aisle",null,$seat)])'));
  const state = session.stateSnapshotJson(), components = original.components;
  for (const source of [
    'root=Stack([RadioGroup("seat",[RadioItem("A","","same"),RadioItem("B","","same")])])',
    'root=Stack([RadioGroup("seat",' + radioItems + ',"missing")])',
    'root=Stack([RadioGroup("seat",[SelectItem("a","A")])])',
    'root=Stack([RadioGroup("seat",[RadioItem("A",' + JSON.stringify('x'.repeat(8193)) + ',"a")])])'
  ]) {
    assert.throws(() => session.replace(source), /OPENUI_MAPPED_/);
    assert.equal(session.stateSnapshotJson(), state);
    assert.deepEqual(unpack(session.currentResult()).components, components);
  }
  assert.throws(() => session.setField(field(original, 'seat').componentId, '"missing"'), /FIELD_VALUE/);
  assert.equal(session.stateSnapshotJson(), state);
});

test('switch defaults and optional labels reuse scalar toggle leaves without creating required rules', () => {
  const session = createMappedSession();
  let result = unpack(session.replace('root=Stack([SwitchGroup("preferences",[SwitchItem(null,null,"quiet",true),SwitchItem("","Step-free access","accessible")],"card")])'));
  const toggles = result.components.filter(node => node.component === 'OpenUiToggle');
  assert.deepEqual(toggles.map(node => ({label:node.label,value:node.value})), [{label:'quiet',value:true},{label:'accessible',value:false}]);
  assert.ok(toggles.every(node => node.required === undefined));
  assert.equal(result.components.filter(node => node.component === 'Card').length, 1);
  assert.ok(result.components.some(node => node.text === 'Step-free access'));
  result = unpack(session.setField(field(result, 'preferences', 'accessible').componentId, 'true'));
  assert.deepEqual(result.state['field:preferences'], {quiet:true,accessible:true});
});

test('switch aggregate edits, reset and context preserve independent named entries', () => {
  const session = createMappedSession();
  let result = unpack(session.replace('$extras={camera:false,water:false}\nroot=Stack([SwitchGroup("extras",[SwitchItem("Camera","Take pictures","camera"),SwitchItem("Water","Stay hydrated","water")],"clear",$extras),Button("Reset",@Reset($extras)),Button("Read",@ToAssistant("read",{preferences:$extras}))])'));
  const camera = field(result, 'extras', 'camera').componentId, water = field(result, 'extras', 'water').componentId;
  result = unpack(session.setField(camera, 'true')); result = unpack(session.setField(water, 'true')); result = unpack(session.setField(camera, 'false'));
  assert.deepEqual(result.state.$extras, {camera:false,water:true});
  assert.throws(() => session.setField(camera, '"true"'), /FIELD_VALUE/);
  result = unpack(session.dispatchAction(button(result, 'Read')));
  assert.deepEqual(result.actions[0].context.context.preferences, {camera:false,water:true});
  assert.equal(result.actions[0].context.formState, undefined, 'independent switches are not silently inserted into a Form');
  result = unpack(session.dispatchAction(button(result, 'Reset')));
  assert.deepEqual(result.state.$extras, {camera:false,water:false}); assert.deepEqual(result.actions, []);
  assert.equal(field(result, 'extras', 'camera').componentId, camera);
  assert.equal(field(result, 'extras', 'water').componentId, water);
});

test('invalid switch variants, duplicate names and invalid items cannot replace a working group', () => {
  const session = createMappedSession();
  const initial = unpack(session.replace('root=Stack([SwitchGroup("extras",[SwitchItem("Camera","","camera")])])'));
  const before = session.currentResult();
  for (const source of [
    'root=Stack([SwitchGroup("extras",[SwitchItem("Camera","","camera")],"sunk")])',
    'root=Stack([SwitchGroup("extras",[SwitchItem("Camera","","same"),SwitchItem("Water","","same")])])',
    'root=Stack([SwitchGroup("extras",[CheckBoxItem("Camera","","camera")])])',
    'root=Stack([SwitchGroup("extras",[SwitchItem("Camera","","constructor")])])'
  ]) {
    assert.throws(() => session.replace(source), /OPENUI_MAPPED_/);
    assert.deepEqual(unpack(session.currentResult()).components, unpack(before).components);
  }
  assert.equal(initial.components.filter(node => node.component === 'OpenUiToggle').length, 1);
  let result = unpack(session.replace('$variant="clear"\nroot=Stack([SwitchGroup("extras",[SwitchItem("Camera","","camera")],$variant),Button("Bad",@Set($variant,"sunk"))])'));
  assert.throws(() => session.dispatchAction(button(result, 'Bad')), /SWITCH_VARIANT/);
  assert.equal(unpack(session.stateSnapshotJson()).$variant, 'clear');
});

test('real ETS controller validates radio descriptions and submits the current selected option', () => {
  const actions = [];
  const runtime = setup({onAction:event => actions.push(event)});
  const result = runtime.replace('root=Stack([Form("trip",Buttons([Button("Submit",@ToAssistant("submit"))]),[FormControl("Seat",RadioGroup("seat",' + radioItems + ',null,{required:true}))])])');
  const id = field(result, 'seat').componentId;
  assert.equal(dispatch(runtime, 'Submit'), true); assert.equal(actions.length, 0);
  assert.equal(runtime.controller.setFieldValue('choices', id, 'aisle', runtime.controller.getSurface('choices').revision), true);
  assert.equal(dispatch(runtime, 'Submit'), true); assert.equal(actions.length, 1);
  assert.equal(actions[0].context.formState.trip.seat, 'aisle');
  assert.equal(runtime.controller.getSurface('choices').components.find(node => node.id === id).options[1].description, 'Easy access');
});

test('existing checkbox aggregates and Select null placeholders remain compatible alongside new switches', () => {
  const session = createMappedSession();
  let result = unpack(session.replace('$kind="all"\n$prefs={quiet:false}\nroot=Stack([Select("kind",[SelectItem("all","All"),SelectItem("park","Park")],null,null,$kind),CheckBoxGroup("prefs",[CheckBoxItem("Quiet","","quiet")],null,$prefs),SwitchGroup("extras",[SwitchItem("Camera","","camera")])])'));
  const checkbox = field(result, 'prefs', 'quiet').componentId;
  result = unpack(session.setField(checkbox, 'true'));
  assert.deepEqual(result.state.$prefs, {quiet:true}); assert.equal(result.state.$kind, 'all');
  assert.equal(result.components.find(node => node.id === checkbox).component, 'OpenUiCheckbox');
  result = unpack(session.setField(field(result, 'kind').componentId, '"park"'));
  assert.equal(result.state.$kind, 'park'); assert.deepEqual(result.state.$prefs, {quiet:true});
});
