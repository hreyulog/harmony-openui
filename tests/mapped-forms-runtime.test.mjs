// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest } from '../openui/src/main/ets/generated/OpenUiMappedRuntime.js';

const unpack = source => JSON.parse(source);
const form = `$name = ""
$notes = ""
$preferences = {quiet:false,accessible:false}
root = Stack([trip])
trip = Form("trip", Buttons([Button("继续", @ToAssistant("提交偏好", {intent:"preferences", name:"model must not replace user input"})), Button("取消", @ToAssistant("取消", {intent:"cancel"}), "secondary"), Button("重置", @Reset($name,$notes,$preferences), "tertiary")], "column"), [FormControl("称呼", Input("name", "请输入称呼", "text", {required:true}, $name)), FormControl("备注", TextArea("notes", "可选备注", 3, null, $notes)), FormControl("偏好", CheckBoxGroup("preferences", [CheckBoxItem("安静", "减少噪声", "quiet"), CheckBoxItem("无障碍", "方便通行", "accessible")], {required:true}, $preferences))])`;
const button = (result, caption) => result.components.find(node => node.component === 'Button' && result.components.some(child => child.id === node.child && child.text === caption)).id;
const binding = (result, name, itemName) => result.bindings.find(item => item.name === name && (itemName === undefined || item.itemName === itemName));
function setup(options = {}) {
  const sources = ['core/OpenUiTypes', 'core/OpenUiCatalog', 'core/OpenUiController', 'lang/OpenUiMappedRuntime'].map(name => stripTypeScriptTypes(
    fs.readFileSync(fileURLToPath(new URL('../openui/src/main/ets/' + name + '.ets', import.meta.url)), 'utf8')
      .replace(/^import[\s\S]*?;\r?\n/gm, ''), { mode: 'transform' }).replace(/^export /gm, '')).join('\n');
  const Runtime = vm.runInNewContext(sources + '\nOpenUiMappedRuntime', { JSON, Map, Set, Date, Math, Object, Array, Number,
    createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest });
  return new Runtime('forms', options);
}
function dispatch(runtime, caption, eventId = caption + '-' + runtime.controller.getSurface('forms').revision) {
  const surface = runtime.controller.getSurface('forms'), id = button(surface, caption), node = surface.components.find(item => item.id === id);
  return runtime.controller.dispatchAction({ surfaceId: 'forms', sourceComponentId: id, ...node.action.event }, surface.revision, eventId);
}
function edit(runtime, result, name, value, itemName) {
  return runtime.controller.setFieldValue('forms', binding(result, name, itemName).componentId, value, runtime.controller.getSurface('forms').revision);
}

test('mapped profile preserves the selected official form parameter order and bounded capabilities', () => {
  const schema = JSON.parse(getMappedLibrarySchema()), support = JSON.parse(getMappedSupportManifest());
  assert.deepEqual(Object.keys(schema.$defs.Input.properties), ['name','placeholder','type','rules','value']);
  assert.deepEqual(Object.keys(schema.$defs.TextArea.properties), ['name','placeholder','rows','rules','value']);
  assert.deepEqual(Object.keys(schema.$defs.CheckBoxItem.properties), ['label','description','name','defaultChecked']);
  assert.deepEqual(Object.keys(schema.$defs.CheckBoxGroup.properties), ['name','items','rules','value']);
  assert.deepEqual(Object.keys(schema.$defs.Form.properties), ['name','buttons','fields']);
  assert.ok(support.capabilities.includes('checkbox-record-binding'));
  assert.ok(getMappedSystemPrompt().includes('do not use @Submit'));
});

test('official state supports only literal bounded boolean records in addition to the existing scalars', () => {
  for (const value of ['{}', '{quiet:false,accessible:true}']) {
    const session = createMappedSession(); assert.doesNotThrow(() => session.replace('$prefs=' + value + '\nroot=Stack([TextContent("ok")])'));
  }
  for (const value of ['{quiet:1}', '{quiet:"yes"}', '{quiet:{nested:true}}', '{quiet:false,quiet:true}', '{constructor:false}', '{"__proto__":false}',
    '{quiet:1==1}', '{' + Array.from({length:65}, (_,index) => 'item' + index + ':false').join(',') + '}']) {
    const session = createMappedSession(); session.replace(form); const before = session.stateSnapshotJson();
    assert.throws(() => session.replace('$prefs=' + value + '\nroot=Stack([TextContent("ok")])'), /STATE_INITIALIZER/);
    assert.equal(session.stateSnapshotJson(), before);
  }
});

test('checkbox leaves update one official boolean aggregate atomically and retain stable identities on reset', () => {
  const session = createMappedSession(); let result = unpack(session.replace(form));
  const quiet = binding(result, 'preferences', 'quiet').componentId, accessible = binding(result, 'preferences', 'accessible').componentId;
  result = unpack(session.setField(quiet, 'true'));
  assert.deepEqual(result.state.$preferences, {quiet:true,accessible:false});
  result = unpack(session.setField(accessible, 'true'));
  assert.deepEqual(result.state.$preferences, {quiet:true,accessible:true});
  result = unpack(session.setField(quiet, 'false'));
  assert.deepEqual(result.state.$preferences, {quiet:false,accessible:true});
  assert.throws(() => session.setField(quiet, '"true"'), /FIELD_VALUE/);
  result = unpack(session.dispatchAction(button(result, '重置')));
  assert.deepEqual(result.state.$preferences, {quiet:false,accessible:false});
  assert.equal(binding(result, 'preferences', 'quiet').componentId, quiet);
  assert.equal(binding(result, 'preferences', 'accessible').componentId, accessible);
  assert.equal(result.components.filter(node => node.component === 'OpenUiCheckbox').every(node => node.required === undefined), true);
});

test('a required group needs one checked item and live form submission retains context separately from user values', () => {
  const session = createMappedSession(); let result = unpack(session.replace(form));
  result = unpack(session.dispatchAction(button(result, '继续')));
  assert.deepEqual(result.actions, []); assert.equal(Object.keys(result.validationErrors).length, 2);
  assert.equal(result.validationErrors[binding(result, 'name').componentId], 'required');
  assert.equal(result.validationErrors[binding(result, 'preferences', 'quiet').componentId], 'group_required');
  result = unpack(session.setField(binding(result, 'name').componentId, '"Lin"'));
  assert.equal(Object.keys(result.validationErrors).length, 1, 'editing one field keeps the other required error');
  result = unpack(session.setField(binding(result, 'preferences', 'accessible').componentId, 'true'));
  assert.deepEqual(result.validationErrors, {});
  result = unpack(session.setField(binding(result, 'notes').componentId, '"Local note"'));
  result = unpack(session.dispatchAction(button(result, '继续')));
  assert.deepEqual(result.actions, [{name:'continue_conversation',context:{message:'提交偏好',context:{intent:'preferences',name:'model must not replace user input'},
    formName:'trip',formState:{trip:{name:'Lin',notes:'Local note',preferences:{quiet:false,accessible:true}}}}}]);
  assert.equal(result.stats.externalActions, 1);
});

test('secondary actions bypass new validation while reset explicitly clears previously exposed errors', () => {
  const session = createMappedSession(); let result = unpack(session.replace(form));
  result = unpack(session.dispatchAction(button(result, '取消')));
  assert.equal(result.actions.length, 1); assert.deepEqual(result.validationErrors, {});
  result = unpack(session.dispatchAction(button(result, '继续'))); assert.equal(Object.keys(result.validationErrors).length, 2);
  result = unpack(session.dispatchAction(button(result, '取消'))); assert.equal(result.actions.length, 1); assert.equal(Object.keys(result.validationErrors).length, 2);
  result = unpack(session.dispatchAction(button(result, '重置'))); assert.deepEqual(result.validationErrors, {});
  assert.deepEqual(result.actions, []);
});

test('same-named unbound fields and checkbox groups belong to their own named form', () => {
  const source = `root=Stack([a,b])
a=Form("first",Buttons([Button("First",@ToAssistant("first"))]),[FormControl("Name",Input("name")),FormControl("Options",CheckBoxGroup("options",[CheckBoxItem("A","","a",true),CheckBoxItem("B","","b")]))])
b=Form("second",Buttons([Button("Second",@ToAssistant("second"))]),[FormControl("Name",Input("name")),FormControl("Options",CheckBoxGroup("options",[CheckBoxItem("A","","a"),CheckBoxItem("B","","b",true)]))])`;
  const session = createMappedSession(); let result = unpack(session.replace(source));
  const firstName = result.bindings.find(field => field.name === 'name' && field.formName === 'first').componentId;
  const secondOption = result.bindings.find(field => field.name === 'options' && field.itemName === 'a' && field.formName === 'second').componentId;
  result = unpack(session.setField(firstName, '"First only"'));
  result = unpack(session.setField(secondOption, 'true'));
  let outgoing = unpack(session.dispatchAction(button(result, 'First'))).actions[0].context;
  assert.deepEqual(outgoing.formState, {first:{name:'First only',options:{a:true,b:false}}});
  outgoing = unpack(session.dispatchAction(button(result, 'Second'))).actions[0].context;
  assert.deepEqual(outgoing.formState, {second:{name:'',options:{a:true,b:true}}});
});

test('form graph and aggregate item ambiguity are rejected without replacing the preceding program', () => {
  const session = createMappedSession(); session.replace(form); const before = session.stateSnapshotJson();
  for (const source of [
    'root=Stack([Form("x",Buttons([Button("Go")]),[FormControl("A",Input("a")),FormControl("A",Input("a"))])])',
    'root=Stack([Form("x",Buttons([Button("Go")]),[]),Form("x",Buttons([Button("Go")]),[])])',
    'root=Stack([CheckBoxGroup("g",[CheckBoxItem("A","","a"),CheckBoxItem("B","","a")])])',
    'root=Stack([CheckBoxGroup("g",[CheckBoxItem("A","","constructor")])])',
    '$prefs=true\nroot=Stack([CheckBoxGroup("g",[CheckBoxItem("A","","a")],null,$prefs)])',
    'root=Stack([Input("name","Email","email")])',
    'root=Stack([TextArea("notes","Notes",8)])'
  ]) { assert.throws(() => session.replace(source), /MAPPED_/); assert.equal(session.stateSnapshotJson(), before); }
});

test('sequential Set steps are visible in the submitted live form while a failed plan rolls back the whole record', () => {
  const source = `$name="Lin"
$prefs={quiet:false,accessible:false}
root=Stack([Form("trip",Buttons([Button("Apply",Action([@Set($name,"Updated"),@Set($prefs,{quiet:true,accessible:false}),@ToAssistant("updated")])),Button("Bad",Action([@Set($prefs,{quiet:true,accessible:true}),@Set($prefs,"bad"),@ToAssistant("never")]))]),[FormControl("Name",Input("name","","text",{required:true},$name)),FormControl("Choices",CheckBoxGroup("preferences",[CheckBoxItem("Quiet","","quiet"),CheckBoxItem("Access","","accessible")],null,$prefs))])])`;
  const session = createMappedSession(); let result = unpack(session.replace(source));
  result = unpack(session.dispatchAction(button(result, 'Apply')));
  assert.deepEqual(result.actions[0].context.formState, {trip:{name:'Updated',preferences:{quiet:true,accessible:false}}});
  const before = session.stateSnapshotJson();
  assert.throws(() => session.dispatchAction(button(result, 'Bad')), /GROUP_VALUE/);
  assert.equal(session.stateSnapshotJson(), before); assert.equal(unpack(session.currentResult()).stats.externalActions, 1);
});

test('ETS wrapper shows localized group errors, keeps remaining errors during edits and submits only current native values', () => {
  const receipts = [], errors = [];
  const runtime = setup({onAction:event => receipts.push(event),onError:message => errors.push(message),
    validationMessage:code => code === 'group_required' ? 'Pick one preference' : 'Required name'});
  const result = runtime.replace(form);
  assert.equal(dispatch(runtime, '继续'), true); assert.equal(receipts.length, 0);
  let surface = runtime.controller.getSurface('forms');
  assert.deepEqual(Object.values(JSON.parse(surface.fieldErrorsJson)).sort(), ['Pick one preference','Required name']);
  assert.equal(edit(runtime, result, 'name', 'Nova user'), true);
  assert.deepEqual(Object.values(JSON.parse(runtime.controller.getSurface('forms').fieldErrorsJson)), ['Pick one preference']);
  assert.equal(edit(runtime, result, 'preferences', true, 'accessible'), true);
  assert.deepEqual(JSON.parse(runtime.controller.getSurface('forms').fieldErrorsJson), {});
  assert.equal(edit(runtime, result, 'notes', 'Filled on phone'), true);
  assert.equal(dispatch(runtime, '继续'), true); assert.equal(receipts.length, 1);
  assert.deepEqual(receipts[0].context.formState.trip, {name:'Nova user',notes:'Filled on phone',preferences:{quiet:false,accessible:true}});
  assert.equal(dispatch(runtime, '重置'), true);
  surface = runtime.controller.getSurface('forms'); assert.deepEqual(JSON.parse(surface.fieldErrorsJson), {});
  assert.equal(surface.components.find(node => node.id === binding(result, 'name').componentId).value, '');
  assert.deepEqual(errors, []);
});

test('mapped replacement resets old native overrides and failed replacement preserves accepted input', () => {
  const runtime = setup(); const result = runtime.replace(form);
  assert.equal(edit(runtime, result, 'name', 'Old input'), true);
  const replacement = form.replace('$name = ""', '$name = "New default"');
  runtime.replace(replacement);
  const surface = runtime.controller.getSurface('forms');
  assert.equal(surface.components.find(node => node.id === binding(result, 'name').componentId).value, 'New default');
  assert.deepEqual(JSON.parse(surface.fieldValuesJson), {});
  const before = runtime.controller.exportSnapshot();
  assert.throws(() => runtime.replace(replacement.replace('$preferences = {quiet:false,accessible:false}', '$preferences = {quiet:"bad"}')), /STATE_INITIALIZER/);
  assert.equal(runtime.controller.exportSnapshot(), before); assert.equal(JSON.parse(runtime.stateSnapshotJson()).$name, 'New default');
});

test('a host replacing or disposing the runtime after the first action prevents the old second action', () => {
  const source = 'root=Stack([Button("Two",Action([@ToAssistant("first"),@ToAssistant("second")]))])';
  for (const transition of ['replace','dispose','revision']) {
    const receipts = []; let runtime;
    runtime = setup({onAction:event => {
      receipts.push(event.context.message);
      if (receipts.length !== 1) return;
      if (transition === 'replace') runtime.replace('root=Stack([TextContent("fresh program")])');
      else if (transition === 'dispose') runtime.dispose();
      else runtime.controller.setReadOnly('forms', true);
    }});
    runtime.replace(source); assert.equal(dispatch(runtime, 'Two'), true);
    assert.deepEqual(receipts, ['first'], transition + ' must fence the old action batch');
    if (transition === 'replace') assert.equal(runtime.controller.getSurface('forms').components.some(node => node.text === 'fresh program'), true);
    if (transition === 'dispose') assert.equal(runtime.controller.getSurface('forms'), undefined);
  }
});

test('a host transition from onStateUpdate prevents any action from the result that triggered it', () => {
  const source = 'root=Stack([Button("Two",Action([@ToAssistant("first"),@ToAssistant("second")]))])';
  for (const transition of ['replace','dispose']) {
    const receipts = []; let runtime, armed = false;
    runtime = setup({onAction:event => receipts.push(event), onStateUpdate:() => {
      if (!armed) return; armed = false;
      if (transition === 'replace') runtime.replace('root=Stack([TextContent("fresh program")])');
      else runtime.dispose();
    }});
    runtime.replace(source); armed = true; assert.equal(dispatch(runtime, 'Two'), true);
    assert.deepEqual(receipts, [], transition + ' from state callback must fence the old result');
    if (transition === 'replace') assert.equal(runtime.controller.getSurface('forms').components.some(node => node.text === 'fresh program'), true);
    else assert.equal(runtime.controller.getSurface('forms'), undefined);
  }
});

test('a synchronous controller observer cannot lend its newer revision to an older action result', () => {
  for (const transition of ['readonly','data','components']) {
    const receipts = [], runtime = setup({onAction:event => receipts.push(event)});
    runtime.replace('root=Stack([Button("Go",@ToAssistant("old action"))])');
    // Controller revisions share one sequence across surfaces; the active
    // surface's previous revision plus one is not its next commit revision.
    runtime.controller.apply({kind:'create',surfaceId:'another-surface'});
    let armed = true;
    runtime.controller.subscribe(() => {
      if (!armed) return; armed = false;
      if (transition === 'readonly') runtime.controller.setReadOnly('forms', true);
      else if (transition === 'data') runtime.controller.apply({kind:'data',surfaceId:'forms',valueJson:'{"newer":true}'});
      else runtime.controller.apply({kind:'components',surfaceId:'forms',replace:true,
        components:[{id:'root',component:'Text',text:'Observer replacement'}]});
    });
    assert.equal(dispatch(runtime, 'Go'), true);
    assert.deepEqual(receipts, [], transition + ' from a publish observer must fence the previous action result');
  }
});

test('a field edit published before program replacement cannot mutate the newly installed session', () => {
  const changes = [], runtime = setup({onFieldChange:event => changes.push(event)});
  const source = '$name="old"\nroot=Stack([Input("name","Name","text",null,$name)])';
  const result = runtime.replace(source), original = runtime.controller.getSurface('forms');
  let armed = true;
  runtime.controller.subscribe(() => {
    if (!armed) return; armed = false;
    runtime.replace(source.replace('$name="old"', '$name="fresh program"'));
  });
  assert.equal(runtime.controller.setFieldValue('forms', binding(result, 'name').componentId, 'stale old edit', original.revision), true);
  assert.equal(JSON.parse(runtime.stateSnapshotJson()).$name, 'fresh program');
  assert.equal(runtime.controller.getSurface('forms').components.find(node => node.component === 'OpenUiInput').value, 'fresh program');
  assert.deepEqual(changes, [], 'the retired program must not forward its old field event');
});
