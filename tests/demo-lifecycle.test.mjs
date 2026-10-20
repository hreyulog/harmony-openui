// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createLanguageSession, getSystemPrompt, getLibrarySchema } from '../openui/src/main/ets/generated/OpenUiLangRuntime.js';

function setup() {
  const read = name => fs.readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');
  const core = ['OpenUiTypes', 'OpenUiCatalog', 'OpenUiController'].map(name =>
    read(`../openui/src/main/ets/core/${name}.ets`));
  core.push(read('../openui/src/main/ets/lang/OpenUiLanguage.ets'));
  const index = read('../demo/src/main/ets/pages/Index.ets');
  const constants = index.slice(index.indexOf('const CHOICE:'), index.indexOf('\n@Entry'));
  const classStart = index.indexOf('struct Index {');
  const buildStart = index.indexOf('\n  build() {', classStart);
  assert.ok(classStart >= 0 && buildStart > classStart, 'extract actual Index lifecycle methods');
  const fieldsAndMethods = index.slice(classStart, buildStart).replace('struct Index {', 'class DemoPage {').replace(/@State /g, '');
  // The manual parser action is an inline ArkUI callback. Execute its source
  // body verbatim as a method; no duplicate implementation is maintained here.
  const callbackMarker = "Button('解析输入源码').enabled(!this.busy).onClick((): void => {";
  const callbackAt = index.indexOf(callbackMarker);
  const callbackEnd = index.indexOf('\n            })', callbackAt);
  assert.ok(callbackAt >= 0 && callbackEnd > callbackAt, 'extract actual manual parser callback');
  const manualParse = index.slice(callbackAt + callbackMarker.length, callbackEnd);
  const source = [...core, constants, fieldsAndMethods + '\nmanualParse():void {' + manualParse + '\n}\n}']
    .map(part => stripTypeScriptTypes(part.replace(/^import[\s\S]*?;\r?\n/gm, ''), {mode:'transform'}).replace(/^export /gm, ''))
    .join('\n');

  const requests = [], timers = [], evidence = [];
  const DemoModel = {generate: (...args) => new Promise((resolve, reject) => requests.push({args, resolve, reject}))};
  const files = {
    OpenMode:{CREATE:1, WRITE_ONLY:2, TRUNC:4},
    readTextSync:() => { throw new Error('no private configuration in host fixture'); },
    openSync:() => ({fd:1}), writeSync:(_fd, text) => evidence.push(JSON.parse(text)), closeSync:() => {}
  };
  const Page = vm.runInNewContext(source + '\nDemoPage', {
    JSON, Map, Set, Date, Math, Object, Array, Number, createLanguageSession, getSystemPrompt, getLibrarySchema,
    DemoModel, fs:files, getContext:() => ({filesDir:'/host-fixture'}),
    OpenUiThemes:{create:mode => ({mode})},
    setTimeout:callback => { timers.push(callback); return timers.length; }
  });
  const page = new Page(); page.aboutToAppear();
  async function drain() {
    // Fixed host microtask/timer pumping avoids wall-clock sleeps and preserves
    // the actual awaited incremental replay in showSource().
    for (let count = 0; count < 100; count++) {
      await Promise.resolve();
      if (timers.length) timers.shift()();
    }
    assert.equal(timers.length, 0, 'all scheduled demo replay timers have completed');
  }
  return {page, requests, timers, evidence, drain};
}

for (const completion of ['success', 'failure']) {
  test(`leaving/reopening ignores an old HTTP ${completion} without releasing a newer page's busy button gate`, async () => {
    const {page, requests, evidence, drain} = setup();
    const oldRequest = page.generate();
    assert.equal(page.busy, true); assert.equal(requests.length, 1);
    page.aboutToDisappear(); page.aboutToAppear();
    assert.equal(page.busy, false);
    const freshRequest = page.generate();
    assert.equal(requests.length, 2);
    const stateBeforeOldCompletion = page.controller.exportSnapshot();
    const statusBeforeOldCompletion = page.status;
    const sourceBeforeOldCompletion = page.source;
    const evidenceBeforeOldCompletion = evidence.length;
    if (completion === 'success') requests[0].resolve('root = Stack([Text("旧页面结果")])');
    else requests[0].reject(new Error('old transport failure'));
    await oldRequest; await drain();
    assert.equal(page.busy, true, 'the still-running new request keeps its buttons disabled');
    assert.equal(page.status, statusBeforeOldCompletion);
    assert.equal(page.source, sourceBeforeOldCompletion);
    assert.equal(page.controller.exportSnapshot(), stateBeforeOldCompletion);
    assert.equal(evidence.length, evidenceBeforeOldCompletion, 'stale completion cannot persist a misleading new-page result');
    requests[1].resolve('root = Stack([Text("新页面结果")])');
    await drain(); await freshRequest;
    assert.equal(page.busy, false);
    assert.equal(page.controller.getSurface('main').readOnly, false);
    assert.ok(page.controller.getSurface('main').components.some(node => node.text === '新页面结果'));
    assert.equal(page.controller.getSurface('main').components.some(node => node.text === '旧页面结果'), false);
  });
}

test('leaving during incremental replay stops pending chunks from modifying the reopened surface', async () => {
  const {page, requests, timers, drain} = setup();
  const request = page.generate();
  requests[0].resolve('root = Stack([Text("旧请求的长结果")])\nunused = Text("这个程序只属于旧页面")');
  // Yield only until the first awaited replay timer exists, then leave while
  // showSource() is suspended rather than finishing the replay first.
  for (let count = 0; count < 10 && !timers.length; count++) await Promise.resolve();
  assert.ok(timers.length > 0);
  page.aboutToDisappear(); page.aboutToAppear();
  const reopened = page.controller.exportSnapshot();
  const status = page.status;
  await drain(); await request;
  assert.equal(page.controller.exportSnapshot(), reopened);
  assert.equal(page.status, status);
  assert.equal(page.busy, false);
});

test('after completing a selection, the actual manual parser callback unlocks a new program for further selection', async () => {
  const {page, requests, drain} = setup();
  const originalOption = page.controller.getSurface('main').components.find(node => node.component === 'OpenUiOption');
  const selected = page.selected({surfaceId:'main', sourceComponentId:originalOption.id,
    name:'choose', context:{value:'a'}, eventId:'selection-one', revision:1, receivedAt:Date.now()});
  await drain(); await selected;
  let surface = page.controller.getSurface('main');
  assert.equal(page.busy, false);
  assert.equal(surface.readOnly, true);
  assert.equal(surface.components.some(node => node.component === 'OpenUiOption'), false);
  assert.ok(surface.components.some(node => node.component === 'OpenUiFacts'));

  page.source = 'root = Stack([newOption])\nnewOption = Option("新的比较", "手动解析", "演示", @Choose("b"))';
  page.manualParse();
  surface = page.controller.getSurface('main');
  assert.equal(page.useModel, false);
  assert.equal(surface.readOnly, false);
  assert.equal(surface.selectedComponent, '');
  assert.equal(page.status, '已解析输入源码');
  const newOption = surface.components.find(node => node.component === 'OpenUiOption');
  assert.equal(newOption.title, '新的比较');
  assert.equal(page.controller.dispatchAction({surfaceId:'main', sourceComponentId:newOption.id,
    name:'choose', context:{value:'b'}}, surface.revision, 'selection-two'), true);
  await drain();
  assert.equal(page.busy, false);
  assert.equal(requests.length, 0, 'manual/local mode does not unexpectedly send an HTTP request');
  assert.ok(page.controller.getSurface('main').components.some(node => node.component === 'OpenUiFacts' &&
    node.facts.some(fact => fact.value === 'B · 08:00 → 08:49')));
});
