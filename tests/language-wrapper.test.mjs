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

const form = `root = Stack([form, image, list, dialog])
form = Form("trip", [name, note, query, checked, toggle, select, radio, slider, date, time, send])
name = TextInput("name", "姓名", "", "请输入姓名", true)
note = TextArea("note", "备注")
query = Search("query", "搜索")
checked = Checkbox("checked", "同意条款", false, true)
toggle = Toggle("toggle", "提醒", true)
select = Select("seat", "席别", [{label:"二等座",value:"second"},{label:"一等座",value:"first"}], "second", true)
radio = RadioGroup("period", "时段", [{label:"上午",value:"am"},{label:"下午",value:"pm"}], "am")
slider = Slider("budget", "预算", 200, 0, 1000, 10)
date = DatePicker("date", "日期", "2026-10-23", "2026-10-20", "2026-12-31", true)
time = TimePicker("time", "时间", "08:30", true)
send = Button("继续", @Submit("trip"))
image = Image("https://example.com/host-image.png", "示例图", 1.5)
list = List([{title:"A",description:"已查询信息",meta:"示例"}], "结果", 200)
dialog = Dialog("查看确认", "继续？", "仅演示", @Choose("continue"))`;

test('the actual ETS wrapper buffers incomplete fields and publishes only valid form trees with arbitrary chunks', () => {
  const {controller, stream, Catalog} = setup();
  const invalidPublications=[]; let published=0, buffered=0;
  controller.subscribe(() => {
    try { Catalog.validateTree(controller.getSurface('surface').components); }
    catch(error) { invalidPublications.push(String(error)); }
    published++;
  });
  for(let offset=0;offset<form.length;offset+=3) {
    const before=controller.exportSnapshot();
    let result;
    assert.doesNotThrow(() => { result=stream.append(form.slice(offset,offset+3),offset+3>=form.length); }, `chunk ${offset}`);
    if(!result.errors.length && result.components.length) {
      try { Catalog.validateTree(result.components); }
      catch { buffered++; assert.equal(controller.exportSnapshot(),before); }
    }
  }
  assert.equal(invalidPublications.length,0);
  assert.ok(buffered>0,'must exercise real incomplete native controls');
  assert.ok(published>0);
  assert.deepEqual(controller.getSurface('surface').components,JSON.parse(createLanguageSession().push(form,true)).components);
});

test('complete native form and media constraints reject model programs without changing the committed UI', () => {
  const {controller, stream}=setup(); stream.replace(choice);
  for(const invalid of [
    'root = Stack([Form("form", [TextInput("name", "姓名"), TextInput("name", "重复字段")])])',
    'root = Stack([Form("form", [Button("提交", @Submit("other"))])])',
    'root = Stack([Button("提交", @Submit("missing"))])',
    'root = Stack([Form("form", [Form("inner", [])])])',
    'root = Stack([Form("form", [TextInput("constructor", "无效字段")])])',
    'root = Stack([Form("form", [Select("seat", "席别", [{label:"A",value:"a"}], "b")])])',
    'root = Stack([Form("form", [Slider("budget", "预算", 150, 0, 100, 10)])])',
    'root = Stack([Form("form", [DatePicker("date", "日期", "2026-02-30")])])',
    'root = Stack([Form("form", [TimePicker("time", "时间", "25:01")])])',
    'root = Stack([Image("http://example.com/image.png", "图片")])',
    'root = Stack([Image("https://example.com/image.png", "图片", 8)])',
    'root = Stack([List([{title:"A"}], "结果", 80)])',
    'root = Stack([List([])])'
  ]) {
    const before=controller.exportSnapshot();
    assert.throws(() => stream.replace(invalid),/OPENUI_/,invalid);
    assert.equal(controller.exportSnapshot(),before,invalid);
  }
  assert.doesNotThrow(() => stream.replace(form));
});

test('real language Submit carries only the form name until the controller validates and attaches live user values', () => {
  const {Controller, Stream}=setup(), receipts=[];
  const controller=new Controller({onAction:event=>receipts.push(event)});
  new Stream(controller,'surface').replace(form);
  const surface=controller.getSurface('surface'), revision=surface.revision;
  const send=surface.components.find(node=>node.id==='n_send');
  const action={surfaceId:'surface',sourceComponentId:send.id,...send.action.event};
  assert.deepEqual(action.context,{form:'trip'});
  assert.equal(controller.dispatchAction(action,revision,'required-empty'),false);
  assert.equal(receipts.length,0);
  assert.equal(controller.setFieldValue('surface','n_name','李四',revision),true);
  assert.equal(controller.setFieldValue('surface','n_checked',true,revision),true);
  assert.equal(controller.setFieldValue('surface','n_select','first',revision),true);
  assert.equal(controller.getSurface('surface').revision,revision,'typing must preserve the mounted document revision');
  assert.equal(controller.dispatchAction({...action,context:{form:'trip',fields:{name:'model-forged'}}},revision,'forged'),false);
  assert.equal(controller.dispatchAction(action,revision,'live-submit'),true);
  assert.equal(receipts.length,1);
  assert.equal(receipts[0].context.form,'trip');
  assert.equal(receipts[0].context.fields.name,'李四');
  assert.equal(receipts[0].context.fields.checked,true);
  assert.equal(receipts[0].context.fields.seat,'first');
  assert.equal(receipts[0].context.fields.date,'2026-10-23');
  assert.equal(controller.dispatchAction(action,revision,'live-submit'),false,'native callback replay is still deduplicated');
});
