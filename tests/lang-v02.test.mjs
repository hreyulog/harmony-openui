// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageSession, getSystemPrompt, getLibrarySchema } from '../openui/src/main/ets/generated/OpenUiLangRuntime.js';

const fields = `root = Stack([card])
card = Card([form])
form = Form("trip", [name, note, search, checked, toggle, seat, radio, slider, date, time, send])
name = TextInput("traveler", "乘车人", "张三", "请输入姓名", true, false, "text")
note = TextArea("note", "备注", "靠窗", "可选备注", false, false)
search = Search("search", "车站搜索", "上海", "输入车站", false, true)
checked = Checkbox("directOnly", "只看直达", true, false, false)
toggle = Toggle("reminder", "到站提醒", false, false, false)
seat = Select("seat", "席别", [{label:"二等座",value:"second"},{label:"一等座",value:"first"}], "second", true, false)
radio = RadioGroup("period", "时段", [{label:"上午",value:"am"},{label:"下午",value:"pm"}], "am", true, false)
slider = Slider("budget", "预算", 200, 0, 1000, 10, false)
date = DatePicker("date", "出发日期", "2026-10-23", "2026-10-20", "2026-12-31", true, false)
time = TimePicker("time", "出发时间", "08:30", true, false)
send = Button("继续", @Submit("trip"))`;

const parse = source => JSON.parse(createLanguageSession().push(source, true));
const named = (result, name) => result.components.find(node => node.id === 'n_' + name);

test('official parser maps every native form-control family with positional arguments in catalog order', () => {
  const result = parse(fields);
  assert.deepEqual(result.errors, []);
  assert.equal(result.incomplete, false);
  assert.deepEqual(named(result, 'form'), {
    id:'n_form', component:'OpenUiForm', name:'trip',
    children:['name','note','search','checked','toggle','seat','radio','slider','date','time','send'].map(id => 'n_' + id)
  });
  assert.deepEqual(named(result, 'name'), {id:'n_name',component:'OpenUiInput',variant:'text',field:'traveler',label:'乘车人',
    value:'张三',placeholder:'请输入姓名',required:true,disabled:false,inputType:'text'});
  assert.equal(named(result, 'note').variant, 'textarea');
  assert.equal(named(result, 'search').variant, 'search');
  assert.equal(named(result, 'search').disabled, true);
  assert.equal(named(result, 'checked').component, 'OpenUiCheckbox');
  assert.equal(named(result, 'checked').value, true);
  assert.equal(named(result, 'toggle').component, 'OpenUiToggle');
  assert.equal(named(result, 'toggle').value, false);
  assert.deepEqual(named(result, 'seat').options, [{label:'二等座',value:'second'},{label:'一等座',value:'first'}]);
  assert.equal(named(result, 'radio').component, 'OpenUiRadioGroup');
  assert.deepEqual(named(result, 'slider'), {id:'n_slider',component:'OpenUiSlider',field:'budget',label:'预算',value:200,
    disabled:false,min:0,max:1000,step:10});
  assert.equal(named(result, 'date').minDate, '2026-10-20');
  assert.equal(named(result, 'date').maxDate, '2026-12-31');
  assert.equal(named(result, 'time').value, '08:30');
  assert.deepEqual(named(result, 'send').action, {event:{name:'submit',context:{form:'trip'}}});
  assert.equal(Object.hasOwn(named(result, 'send').action.event.context, 'fields'), false,
    'live user values belong to the controller, never a model-authored action payload');
});

test('image, bounded list and explicit confirmation launcher preserve native data and action', () => {
  const result = parse(`root = Stack([image, list, dialog])
image = Image("https://example.com/supplied-by-host.png", "海边风景", 1.5)
list = List([{title:"G100",description:"08:00–10:00",meta:"二等座"},{title:"G200"}], "已查询车次", 240)
dialog = Dialog("查看确认", "确认继续？", "此操作仍由应用处理。", @Choose("continue"), "继续", "返回")`);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(named(result,'image'), {id:'n_image',component:'OpenUiImage',source:'https://example.com/supplied-by-host.png',alt:'海边风景',aspectRatio:1.5});
  assert.deepEqual(named(result,'list'), {id:'n_list',component:'OpenUiList',items:[{title:'G100',description:'08:00–10:00',meta:'二等座'},{title:'G200'}],title:'已查询车次',height:240});
  assert.deepEqual(named(result,'dialog'), {id:'n_dialog',component:'OpenUiDialog',label:'查看确认',title:'确认继续？',text:'此操作仍由应用处理。',
    confirmLabel:'继续',cancelLabel:'返回',action:{event:{name:'choose',context:{value:'continue'}}}});
});

test('omitted optional values remain omitted, leaving authoritative defaults to the native controller', () => {
  const result = parse(`root = Stack([form, image, list, dialog])
form = Form("form", [TextInput("name", "姓名"), TextArea("note", "备注"), Search("query", "搜索"), Checkbox("yes", "同意"), Toggle("on", "开关"), Select("choice", "选择", [{label:"A",value:"a"}]), RadioGroup("radio", "单选", [{label:"A",value:"a"}]), Slider("number", "数值"), DatePicker("date", "日期"), TimePicker("time", "时间"), Button("提交", @Submit("form"))])
image = Image("https://example.com/image.png", "图片")
list = List([{title:"Item"}])
dialog = Dialog("打开", "提示", "说明", @Choose("ok"))`);
  assert.deepEqual(result.errors, []);
  for (const node of result.components.filter(node => node.field)) {
    for (const prop of ['value','required','disabled','placeholder','min','max','step','minDate','maxDate']) {
      assert.equal(Object.hasOwn(node, prop), false, `${node.field}.${prop}`);
    }
  }
  assert.equal(Object.hasOwn(named(result,'image'), 'aspectRatio'), false);
  assert.equal(Object.hasOwn(named(result,'list'), 'height'), false);
  assert.equal(Object.hasOwn(named(result,'dialog'), 'confirmLabel'), false);
});

test('new native families converge through arbitrary official-parser chunk boundaries', () => {
  const expected = parse(fields);
  for (const stride of [1, 7, 31]) {
    const session = createLanguageSession(); let result;
    for (let offset=0; offset<fields.length; offset+=stride) {
      assert.doesNotThrow(() => { result=JSON.parse(session.push(fields.slice(offset,offset+stride),offset+stride>=fields.length)); });
    }
    assert.deepEqual(result, expected);
  }
});

test('generated schema and system prompt expose the bounded catalog and form-submit contract', () => {
  const schema=JSON.parse(getLibrarySchema()), prompt=getSystemPrompt();
  for (const name of ['Form','TextInput','TextArea','Search','Checkbox','Toggle','Select','RadioGroup','Slider','DatePicker','TimePicker','Image','List','Dialog']) {
    assert.ok(schema.$defs[name], name);
    assert.ok(prompt.includes(name), name);
  }
  assert.ok(schema.actions.Submit);
  assert.match(prompt,/containing Form/);
  assert.match(prompt,/URLs explicitly supplied by the host/);
  assert.match(prompt,/whole ArkUI API/);
  assert.match(prompt,/live field values/);
});
