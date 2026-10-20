// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createLanguageSession,getSystemPrompt,getLibrarySchema} from '../openui/src/main/ets/generated/OpenUiLangRuntime.js';

function setup(){
 const read=name=>fs.readFileSync(fileURLToPath(new URL(name,import.meta.url)),'utf8');
 const parts=['OpenUiTypes','OpenUiCatalog','OpenUiController'].map(name=>read(`../openui/src/main/ets/core/${name}.ets`));
 parts.push(read('../openui/src/main/ets/lang/OpenUiLanguage.ets'));
 const forms=read('../demo/src/main/ets/pages/Forms.ets');
 const constants=forms.slice(forms.indexOf('const TRIP:'),forms.indexOf('\n@Entry'));
 const start=forms.indexOf('struct Forms {'),end=forms.indexOf('\n  build() {',start);
 assert.ok(start>=0&&end>start,'execute the actual Forms page methods and actual presets');
 parts.push(constants,forms.slice(start,end).replace('struct Forms {','class DemoForms {').replace(/@State /g,'')+'\n}');
 const code=parts.map(part=>stripTypeScriptTypes(part.replace(/^import[\s\S]*?;\r?\n/gm,''),{mode:'transform'}).replace(/^export /gm,'')).join('\n');
 const requests=[],evidence=[];
 const files={OpenMode:{CREATE:1,WRITE_ONLY:2,TRUNC:4},readTextSync:()=>{throw new Error('no credentials in host fixture');},
  openSync:()=>({fd:1}),writeSync:(_fd,text)=>evidence.push(JSON.parse(text)),closeSync:()=>{}};
 class Scroller{scrollTo(){}}
 const {Page,tripProgram}=vm.runInNewContext(code+'\n({Page:DemoForms,tripProgram:TRIP})',{JSON,Map,Set,Date,Math,Object,Array,Number,String,Scroller,
  createLanguageSession,getSystemPrompt,getLibrarySchema,fs:files,getContext:()=>({filesDir:'/host-fixture'}),
  OpenUiThemes:{create:mode=>({mode})},DemoModel:{generate:(...args)=>new Promise((resolve,reject)=>requests.push({args,resolve,reject}))}});
 const page=new Page();page.aboutToAppear();
 return {page,requests,evidence,tripProgram};
}
const surface=page=>page.controller.getSurface('forms');
function field(page,name){const node=surface(page).components.find(node=>node.field===name);assert.ok(node,`actual parsed field ${name}`);return node;}
function edit(page,name,value){assert.equal(page.controller.setFieldValue('forms',field(page,name).id,value,surface(page).revision),true);}
function submit(page,eventId){const state=surface(page),node=state.components.find(node=>node.action?.event.name==='submit');assert.ok(node);
 return page.controller.dispatchAction({surfaceId:'forms',sourceComponentId:node.id,name:'submit',context:{...node.action.event.context}},state.revision,eventId);}
function finishTrip(page){edit(page,'traveler','张三');edit(page,'destination','杭州');edit(page,'seat','first');edit(page,'date','2026-10-24');assert.equal(submit(page,'trip'),true);}

test('actual trip preset blocks blank required input, then validated Submit advances to the actual preferences form',()=>{
 const {page,requests}=setup();assert.equal(page.stage,1);assert.equal(surface(page).components.filter(node=>node.component==='OpenUiForm').length,1);
 assert.equal(submit(page,'blank'),false);assert.equal(page.actions.length,0);
 const error=JSON.parse(surface(page).fieldErrorsJson)[field(page,'traveler').id];assert.match(error,/乘车人/);
 const revision=surface(page).revision;finishTrip(page);
 assert.equal(page.stage,2);assert.equal(page.actions.length,1);assert.equal(page.actions[0].revision,revision);
 assert.deepEqual(JSON.parse(JSON.stringify(page.trip)),{traveler:'张三',destination:'杭州',seat:'first',date:'2026-10-24'});
 assert.equal(page.controller.getFormValues('forms','preferences').position,'window');
 assert.ok(surface(page).components.some(node=>node.component==='OpenUiDialog'&&node.action.event.context.form==='preferences'));
 assert.equal(requests.length,0,'preset flow never makes an unexpected model request');
});

test('actual preferences Dialog Submit generates a parseable read-only result preserving edited values and escaping text',()=>{
 const {page,requests,evidence}=setup();finishTrip(page);
 edit(page,'note','行李："大箱子"\n请保留换行');edit(page,'direct',false);edit(page,'remind',false);
 edit(page,'position','aisle');edit(page,'budget',700);edit(page,'time','09:30');
 assert.equal(submit(page,'preferences'),true);assert.equal(page.stage,3);assert.equal(page.busy,false);assert.equal(page.actions.length,2);
 assert.equal(page.preferences.position,'aisle');assert.equal(page.preferences.budget,700);assert.equal(page.preferences.remind,false);
 const state=surface(page);assert.equal(state.readOnly,true);assert.equal(state.components.some(node=>node.action),false);
 const facts=state.components.find(node=>node.component==='OpenUiFacts').facts;
 assert.ok(facts.some(fact=>fact.value==='张三'));assert.ok(facts.some(fact=>fact.value==='杭州'));
 assert.ok(facts.some(fact=>fact.value==='一等座'));assert.ok(facts.some(fact=>fact.value==='过道'));
 assert.ok(facts.some(fact=>fact.value==='09:30'));assert.ok(facts.some(fact=>fact.value==='700 元'));
 assert.ok(facts.some(fact=>fact.value==='行李："大箱子"\n请保留换行'));
 assert.equal(state.components.find(node=>node.component==='OpenUiList').items.length,2);
 assert.match(state.components.find(node=>node.component==='OpenUiImage').source,/^https:\/\/raw\.githubusercontent\.com\//);
 assert.equal(requests.length,0);assert.equal(evidence.at(-1).stage,3);assert.equal(evidence.at(-1).actions.length,2);
});

test('reset or page departure invalidates an old model form completion without replacing the current preset',async()=>{
 for(const leave of [false,true]){
  const {page,requests}=setup();const pending=page.generate();assert.equal(page.busy,true);assert.equal(requests.length,1);
  if(leave){page.aboutToDisappear();page.aboutToAppear();}else page.reset();
  const before=page.controller.exportSnapshot(),status=page.status;
  requests[0].resolve('root = Text("旧的模型表单")');await pending;
  assert.equal(page.controller.exportSnapshot(),before);assert.equal(page.status,status);assert.equal(page.stage,1);assert.equal(page.busy,false);
  assert.equal(surface(page).readOnly,false);assert.ok(surface(page).components.some(node=>node.field==='traveler'));
 }
});

test('valid Lang that violates the model form contract preserves the preset and allows a fresh generation retry',async()=>{
 for(const response of [()=> 'root = Text("合法语言但没有表单")',
  source=>source.replace('"请输入姓名", true','"请输入姓名", false'),
  source=>source.replace('"destination", "目的地"','"missing", "目的地"')]){
  const {page,requests,tripProgram}=setup();const pending=page.generate();const preset=JSON.stringify(surface(page).components);
  requests[0].resolve(response(tripProgram));await pending;
  assert.equal(page.stage,1);assert.equal(page.busy,false);assert.equal(surface(page).readOnly,false);
  assert.equal(JSON.stringify(surface(page).components),preset);assert.match(page.status,/模型.*(?:表单|字段)/);
  const retry=page.generate();requests[1].resolve(tripProgram);await retry;
  assert.equal(page.busy,false);assert.match(page.status,/模型表单已生成/);finishTrip(page);assert.equal(page.stage,2);
 }
});

test('invalid model results preserve editable preferences and a second confirmation can succeed',async()=>{
 const drain=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 for(const invalid of ['root = Unknown("无法解析")','root = Text("缺少结果组件")']){
  const {page,requests,tripProgram,evidence}=setup();const generation=page.generate();requests[0].resolve(tripProgram);await generation;
  finishTrip(page);edit(page,'note','失败后仍保留');edit(page,'budget',800);
  const preferences=JSON.stringify(surface(page).components),values=surface(page).fieldValuesJson;
  assert.equal(submit(page,'first-confirm'),true);assert.equal(page.busy,true);assert.equal(surface(page).readOnly,true);
  requests[1].resolve(invalid);await drain();
  assert.equal(page.stage,2);assert.equal(page.busy,false);assert.equal(surface(page).readOnly,false);
  assert.equal(JSON.stringify(surface(page).components),preferences);assert.equal(surface(page).fieldValuesJson,values);
  assert.equal(page.controller.getFormValues('forms','preferences').note,'失败后仍保留');
  assert.equal(submit(page,'retry-confirm'),true);requests[2].resolve(page.resultSource());await drain();
  assert.equal(page.stage,3);assert.equal(page.busy,false);assert.equal(surface(page).readOnly,true);
  assert.equal(evidence.at(-1).stage,3);assert.equal(page.preferences.budget,800);
 }
});
