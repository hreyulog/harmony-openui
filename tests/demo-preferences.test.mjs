// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest } from '../openui/src/main/ets/generated/OpenUiMappedRuntime.js';

const plain = value => JSON.parse(JSON.stringify(value));
function setup(placeId = 'city-museum') {
  const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
  const parts = ['core/OpenUiTypes', 'core/OpenUiCatalog', 'core/OpenUiController', 'lang/OpenUiMappedRuntime']
    .map(name => read('../openui/src/main/ets/' + name + '.ets'));
  const source = read('../demo/src/main/ets/pages/Planner.ets');
  const start = source.indexOf('struct Planner {'), end = source.indexOf('\n  build() {', start);
  assert.ok(start >= 0 && end > start, 'execute the actual Planner page and its actual presets');
  parts.push(read('../demo/src/main/ets/model/DemoPlaces.ets'),
    source.slice(start, end).replace('struct Planner {', 'class DemoPlanner {').replace(/@State /g, '') + '\n}');
  const code = parts.map(part => stripTypeScriptTypes(part.replace(/^import[\s\S]*?;\r?\n/gm, ''), {mode:'transform'})
    .replace(/^export /gm, '')).join('\n');
  const requests = [], evidence = [];
  const files = { OpenMode:{CREATE:1,WRITE_ONLY:2,TRUNC:4},
    readTextSync:() => { throw Error('host fixture has no model credentials'); },
    openSync:() => ({fd:1}), writeSync:(_fd, text) => evidence.push(JSON.parse(text)), closeSync:() => {} };
  class Scroller { scrollTo() {} }
  const Page = vm.runInNewContext(code + '\nDemoPlanner', { JSON, Map, Set, Date, Math, Object, Array, Number, String, Scroller,
    createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest,
    fs:files, router:{getParams:() => ({placeId})}, getContext:() => ({filesDir:'/host-fixture'}),
    OpenUiThemes:{create:mode => ({mode})}, DemoModel:{generateValidated:(config, system, prompt, validate, hooks) => {
      hooks?.onAttempt?.();
      return new Promise((resolve, reject) => requests.push({config, system, prompt, hooks,
        resolve:source => { try { hooks?.onCandidate?.(source); validate(source); resolve(source); } catch (error) { reject(error); } }, reject}));
    }} });
  const page = new Page(); page.aboutToAppear();
  return {page, requests, evidence};
}
const surface = page => page.runtime.controller.getSurface('planner');
function edit(page, name, value, itemName) {
  const binding = page.bindings.find(binding => binding.name === name && (itemName === undefined || binding.itemName === itemName));
  assert.ok(binding, 'actual binding for ' + name + (itemName === undefined ? '' : ':' + itemName));
  assert.equal(page.runtime.controller.setFieldValue('planner', binding.componentId, value, surface(page).revision), true);
}
function click(page, caption, eventId) {
  const current = surface(page), node = current.components.find(node => node.component === 'Button' &&
    current.components.some(child => child.id === node.child && child.text === caption));
  assert.ok(node, 'actual generated button ' + caption);
  return page.runtime.controller.dispatchAction({surfaceId:'planner',sourceComponentId:node.id,...node.action.event}, current.revision, eventId);
}
function fillRequired(page) { edit(page, 'planName', '周末慢游'); edit(page, 'mode', 'transit'); }

test('actual Planner preset validates two required fields, preserves independent switches and completes a read-only local result', () => {
  const {page, requests, evidence} = setup();
  assert.equal(page.place.id, 'city-museum'); assert.doesNotThrow(() => page.validateEditor(page.preset()));
  assert.equal(surface(page).components.filter(node => node.component === 'OpenUiToggle').length, 2);
  assert.equal(click(page, '保存计划', 'blank'), true); assert.equal(page.actions.length, 0);
  assert.equal(Object.keys(JSON.parse(surface(page).fieldErrorsJson)).length, 2);
  edit(page, 'planName', '周末慢游');
  assert.equal(Object.keys(JSON.parse(surface(page).fieldErrorsJson)).length, 1, 'the unselected RadioGroup remains required');
  edit(page, 'mode', 'transit'); assert.deepEqual(JSON.parse(surface(page).fieldErrorsJson), {});
  edit(page, 'notes', '带上“大包”\n保留换行');
  edit(page, 'preferences', true, 'remind'); edit(page, 'preferences', true, 'accessible'); edit(page, 'preferences', false, 'remind');
  assert.deepEqual(JSON.parse(page.runtime.stateSnapshotJson()).$preferences, {remind:false,accessible:true});
  assert.equal(click(page, '保存计划', 'filled'), true);
  assert.equal(page.stage, 2); assert.equal(page.busy, false); assert.equal(page.actions.length, 1);
  assert.deepEqual(plain(page.submitted), {planName:'周末慢游',notes:'带上“大包”\n保留换行',mode:'transit',preferences:{remind:false,accessible:true}});
  const receipt = plain(page.actions[0]);
  assert.deepEqual(receipt.context.formState.plan, {planName:'周末慢游',mode:'transit',notes:'带上“大包”\n保留换行'});
  assert.deepEqual(receipt.context.context.preferences, {remind:false,accessible:true});
  assert.equal(receipt.context.formState.plan.preferences, undefined, 'independent switches do not become implicit form fields');
  const result = surface(page), text = result.components.filter(node => node.component === 'Text').map(node => node.text).join('\n');
  assert.equal(result.readOnly, true); assert.equal(result.components.some(node => node.action || node.field), false);
  for (const expected of ['周末慢游','带上“大包”\n保留换行','公共交通','出发提醒：未选','无障碍路线：已选','未创建提醒']) assert.ok(text.includes(expected), expected);
  assert.ok(result.components.some(node => node.component === 'Image' && node.source === page.place.image));
  assert.equal(requests.length, 0, 'the actual local preset never invokes a model');
  assert.equal(evidence.at(-1).stage, 2);
});

test('actual Planner Reset restores text, radio and each switch without returning an external action', () => {
  const {page, requests} = setup(); fillRequired(page); edit(page, 'notes', 'Temporary');
  edit(page, 'preferences', true, 'remind'); edit(page, 'preferences', true, 'accessible');
  assert.equal(click(page, '重置资料', 'reset'), true);
  assert.deepEqual(JSON.parse(page.runtime.stateSnapshotJson()), {$planName:'',$notes:'',$mode:'',$preferences:{remind:false,accessible:false}});
  assert.deepEqual(JSON.parse(surface(page).fieldErrorsJson), {}); assert.equal(page.actions.length, 0); assert.equal(page.stage, 1);
  assert.equal(click(page, '保存计划', 'blank-after-reset'), true);
  assert.equal(Object.keys(JSON.parse(surface(page).fieldErrorsJson)).length, 2); assert.equal(page.actions.length, 0);
  assert.equal(requests.length, 0);
});

test('actual Planner host rejects action preferences that disagree with current switch state', async () => {
  const {page, requests} = setup(); fillRequired(page); edit(page, 'preferences', true, 'remind');
  const before = page.runtime.stateSnapshotJson();
  await page.accept({eventId:'host-contract',surfaceId:'planner',sourceComponentId:'host-contract',revision:surface(page).revision,receivedAt:1,
    name:'continue_conversation',context:{message:'提交计划',formName:'plan',
      formState:{plan:page.runtime.controller.getFormValues('planner','plan')},
      context:{intent:'save-plan',itemId:page.place.id,preferences:{remind:false,accessible:false}}}});
  assert.match(page.status, /当前开关状态不一致/); assert.equal(page.stage, 1); assert.equal(page.busy, false);
  assert.equal(page.actions.length, 0); assert.equal(page.runtime.stateSnapshotJson(), before); assert.equal(surface(page).readOnly, false);
  assert.equal(requests.length, 0);
});

test('actual Planner result validator rejects inverted switch states even when all labels and supplied facts remain present', () => {
  const {page} = setup(); fillRequired(page); edit(page, 'preferences', true, 'remind');
  assert.equal(click(page, '保存计划', 'review-result'), true);
  const correct = page.resultSource(); assert.doesNotThrow(() => page.validateResult(correct));
  const inverted = correct.replace('出发提醒：已选', '出发提醒：未选').replace('无障碍路线：未选', '无障碍路线：已选');
  assert.notEqual(inverted, correct, 'mutate only the host-known boolean outcomes, retaining labels and facts');
  assert.throws(() => page.validateResult(inverted), /UI_RESULT_/);
});

test('actual Planner rejects the recorded Nova result that translated a submitted transit choice into walking', () => {
  const {page} = setup('forest-trail');
  edit(page, 'planName', 'Walk'); edit(page, 'notes', 'BringWater'); edit(page, 'mode', 'transit'); edit(page, 'preferences', true, 'remind');
  assert.equal(click(page, '保存计划', 'fixture-host-values'), true);
  const source = fs.readFileSync(new URL('./fixtures/mapped-model-wrong-mode.openui', import.meta.url), 'utf8');
  assert.throws(() => page.validateResult(source), /出行方式.*公共交通/);
  const corrected = source.replace('出行方式：步行', '出行方式：公共交通');
  assert.notEqual(corrected, source); assert.doesNotThrow(() => page.validateResult(corrected), 'all remaining recorded facts agree with the actual submitted host values');
});

test('actual Planner gives the model exact Chinese display facts rather than delegating enum and boolean translation', async () => {
  const {page, requests} = setup('forest-trail');
  edit(page, 'planName', 'Walk'); edit(page, 'notes', 'BringWater'); edit(page, 'mode', 'transit'); edit(page, 'preferences', true, 'remind');
  page.actualModel = true; assert.equal(click(page, '保存计划', 'model-display-facts'), true);
  const facts = plain(page.displayFields());
  assert.deepEqual(facts, [{label:'计划名称',value:'Walk'},{label:'备注',value:'BringWater'},
    {label:'去处',value:'林间步道'},{label:'出行方式',value:'公共交通'},
    {label:'出发提醒',value:'已选'},{label:'无障碍路线',value:'未选'}]);
  assert.equal(requests.length, 1); assert.equal(page.busy, true);
  assert.ok(requests[0].prompt.includes(JSON.stringify({place:page.place,displayFields:facts})), 'the real model request receives the exact host-normalized facts');
  assert.equal(requests[0].prompt.includes('"mode":"transit"'), false);
  const result = page.resultSource(); assert.doesNotThrow(() => page.validateResult(result));
  requests[0].resolve(result); for (let turn = 0; turn < 20; turn++) await Promise.resolve();
  assert.equal(page.stage, 2); assert.equal(page.busy, false); assert.equal(surface(page).readOnly, true);
});

test('leaving the actual Planner while a model response is pending cannot recreate its disposed surface', async () => {
  const {page, requests} = setup(); const preset = page.preset(); const pending = page.generate();
  assert.equal(requests.length, 1); assert.equal(page.busy, true);
  page.aboutToDisappear(); const retired = page.runtime.controller.exportSnapshot();
  requests[0].resolve(preset); await pending;
  assert.equal(page.runtime.controller.exportSnapshot(), retired); assert.equal(surface(page), undefined); assert.equal(page.actions.length, 0);
});
