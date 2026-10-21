// SPDX-License-Identifier: Apache-2.0
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(options={}){
 const dir=path.join(__dirname,'../openui/src/main/ets/core');
 const code=['OpenUiTypes','OpenUiCatalog','OpenUiController'].map(name=>stripTypeScriptTypes(
  fs.readFileSync(path.join(dir,name+'.ets'),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),{mode:'transform'}).replace(/^export /gm,'')).join('\n');
 const {Controller,Catalog}=vm.runInNewContext(code+'\n({Controller:OpenUiController,Catalog:OpenUiCatalog})',{JSON,Map,Set,Date,Math,Object,Array,Number});
 return {c:new Controller(options),Catalog};
}
function fields(){return [
 {id:'name',component:'OpenUiInput',field:'name',label:'Name',required:true},
 {id:'email',component:'OpenUiInput',field:'email',label:'Email',inputType:'email'},
 {id:'terms',component:'OpenUiCheckbox',field:'terms',label:'Accept',required:true},
 {id:'notify',component:'OpenUiToggle',field:'notify',label:'Notify'},
 {id:'seat',component:'OpenUiSelect',field:'seat',label:'Seat',options:[{label:'Window',value:'window'},{label:'Aisle',value:'aisle'}]},
 {id:'class',component:'OpenUiRadioGroup',field:'class',label:'Class',options:[{label:'Second',value:'second'}],value:'second'},
 {id:'price',component:'OpenUiSlider',field:'price',label:'Price',min:10,max:50,step:5},
 {id:'date',component:'OpenUiDatePicker',field:'date',label:'Date',minDate:'2026-01-01',maxDate:'2028-12-31'},
 {id:'time',component:'OpenUiTimePicker',field:'time',label:'Time'},
 {id:'disabled',component:'OpenUiInput',field:'ignored',label:'Disabled',required:true,disabled:true}
 ];}
function formNodes(controls=fields(),name='trip'){
 return [{id:'root',component:'Column',children:['form']},{id:'form',component:'OpenUiForm',name,children:[...controls.map(x=>x.id),'submit']},
  ...controls,{id:'submit',component:'Button',child:'submit_label',action:{event:{name:'submit',context:{form:name}}}},
  {id:'submit_label',component:'Text',text:'Submit'}];
}
function install(c,nodes=formNodes(),id='s'){c.apply({kind:'create',surfaceId:id});c.apply({kind:'components',surfaceId:id,components:nodes});}
const submit=(context={form:'trip'},surfaceId='s')=>({surfaceId,sourceComponentId:'submit',name:'submit',context});
const maps=c=>({values:JSON.parse(c.getSurface('s').fieldValuesJson),errors:JSON.parse(c.getSurface('s').fieldErrorsJson)});

test('form defaults cover every native field type while disabled controls are omitted',()=>{
 const {c}=setup();install(c);
 assert.deepEqual(plain(c.getFormValues('s','trip')),{name:'',email:'',terms:false,notify:false,seat:'',class:'second',price:10,date:'',time:''});
 assert.deepEqual(maps(c),{values:{},errors:{}});assert.deepEqual(plain(c.getFormValues('s','missing')),{});
 assert.equal(c.validateForm('s','missing'),false);
});

test('typing publishes field state and a logical receipt without changing the document revision or invoking an action',()=>{
 const changes=[],actions=[];const {c}=setup({onFieldChange:e=>changes.push(e),onAction:e=>actions.push(e)});install(c);
 let published=0;c.subscribe(()=>published++);const revision=c.getSurface('s').revision;
 assert.equal(c.setFieldValue('s','name','Ada',revision),true);
 assert.equal(c.getSurface('s').revision,revision);assert.equal(published,1);assert.equal(actions.length,0);
 assert.deepEqual(plain(changes[0]),{surfaceId:'s',sourceComponentId:'name',field:'name',form:'trip',value:'Ada',revision});
 assert.equal(c.setFieldValue('s','name','Ada',revision),true);assert.equal(published,1);
 const external=c.getFormValues('s','trip');external.name='mutated';assert.equal(c.getFormValues('s','trip').name,'Ada');
});

test('submit validates current fields and emits controller-owned values, never fields supplied by the native action',()=>{
 const received=[];const {c}=setup({onAction:e=>received.push(e)});install(c);const revision=c.getSurface('s').revision;
 assert.equal(c.dispatchAction(submit(),revision,'retryable-submit'),false);assert.equal(received.length,0);
 assert.match(maps(c).errors.name,/required/);assert.match(maps(c).errors.terms,/required/);
 c.setFieldValue('s','name','Ada');c.setFieldValue('s','terms',true);c.setFieldValue('s','seat','aisle');
 assert.equal(c.dispatchAction(submit({form:'trip',fields:{name:'Forged',terms:true}}),revision,'forged'),false);
 assert.equal(c.dispatchAction(submit(),revision,'retryable-submit'),true);
 assert.equal(received.length,1);assert.equal(received[0].context.form,'trip');
 assert.equal(received[0].context.fields.name,'Ada');assert.equal(received[0].context.fields.seat,'aisle');
 assert.equal(received[0].context.fields.ignored,undefined);assert.equal(received[0].revision,revision);
 assert.equal(c.dispatchAction(submit(),revision,'retryable-submit'),false);
 assert.equal(c.getSurface('s').readOnly,false);
});

test('invalid editable text retains correction state with localized errors and cannot be submitted',()=>{
 const codes=[];const {c}=setup({validationMessage:(code,node)=>{codes.push(code);return `${node.label}:${code}`;}});install(c);
 c.setFieldValue('s','name','  ');c.setFieldValue('s','terms',true);c.setFieldValue('s','email','bad@');
 c.setFieldValue('s','date','2027-02-29');c.setFieldValue('s','time','24:01');
 assert.equal(c.validateForm('s','trip'),false);assert.equal(maps(c).values.date,'2027-02-29');
 assert.equal(maps(c).errors.name,'Name:required');assert.equal(maps(c).errors.email,'Email:email');
 assert.equal(maps(c).errors.date,'Date:date');assert.equal(maps(c).errors.time,'Time:time');
 c.setFieldValue('s','name','Ada');c.setFieldValue('s','email','ada@example.com');
 c.setFieldValue('s','date','2028-02-29');c.setFieldValue('s','time','23:59');
 assert.deepEqual(maps(c).errors,{});assert.equal(c.validateForm('s','trip'),true);assert.ok(codes.includes('date'));
});

test('option membership, finite numbers, slider range/step and calendar bounds are independently validated',()=>{
 const {c,Catalog}=setup();const controls=fields();controls.push({id:'number',component:'OpenUiInput',field:'number',label:'Number',inputType:'number'});install(c,formNodes(controls));
 assert.equal(c.setFieldValue('s','price',Infinity),false);assert.equal(c.setFieldValue('s','price',NaN),false);
 assert.equal(c.setFieldValue('s','terms','true'),false);assert.equal(c.setFieldValue('s','name',9),false);
 c.setFieldValue('s','seat','unlisted');assert.match(maps(c).errors.seat,/available option/);
 c.setFieldValue('s','price',11);assert.match(maps(c).errors.price,/step/);
 c.setFieldValue('s','price',55);assert.match(maps(c).errors.price,/range/);
 c.setFieldValue('s','date','2029-01-01');assert.match(maps(c).errors.date,/range/);
 c.setFieldValue('s','number','1e999');assert.match(maps(c).errors.number,/finite/);
 assert.equal(Catalog.fieldError(controls[6],15),'');
 assert.equal(Catalog.fieldError(controls[7],'2026-04-31'),'date');
 assert.equal(Catalog.fieldError(controls[7],'0000-01-01'),'date');
  assert.equal(Catalog.fieldError(controls[7],'5001-01-01'),'date');
 c.setFieldValue('s','seat','window');c.setFieldValue('s','price',25);c.setFieldValue('s','date','2028-01-01');c.setFieldValue('s','number','1.25e2');
 assert.deepEqual(maps(c).errors,{});
});

test('choice descriptions retain native option metadata while invalid descriptions cannot replace a working form',()=>{
 const {c,Catalog}=setup();
 const controls=[{id:'choice',component:'OpenUiRadioGroup',field:'choice',label:'出行方式',options:[
  {label:'安静步道',value:'quiet',description:'避开拥挤的道路，适合慢步行走。'},
  {label:'城市展馆',value:'museum'}
 ]}];
 install(c,formNodes(controls));const before=c.exportSnapshot();
 assert.equal(c.getSurface('s').components.find(n=>n.id==='choice').options[0].description,'避开拥挤的道路，适合慢步行走。');
 assert.equal(c.setFieldValue('s','choice','quiet'),true);assert.equal(c.getFormValues('s','trip').choice,'quiet','description never replaces the stable business value');
 for(const component of ['OpenUiRadioGroup','OpenUiSelect']){
  const node={...controls[0],component};
  for(const description of ['', '说'.repeat(8192)])assert.doesNotThrow(()=>Catalog.validate({...node,options:[{label:'Title',value:'key',description}]}));
  for(const description of [true,27,{},[],null,'说'.repeat(8193)]){
   const candidate=formNodes([{...node,options:[{label:'Title',value:'key',description}]}]);const saved=c.exportSnapshot();
   assert.throws(()=>c.apply({kind:'components',surfaceId:'s',replace:true,components:candidate}),/OPTIONS/);
   assert.equal(c.exportSnapshot(),saved,'rejected metadata is atomic');
  }
 }
 const restored=JSON.parse(before).surfaces[0].components.find(n=>n.id==='choice');
 assert.doesNotThrow(()=>Catalog.validate({...restored,options:[{label:'Legacy choice',value:'legacy'}]}));
 const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/native-ir.schema.json'),'utf8'));
 for(const component of ['OpenUiRadioGroup','OpenUiSelect']){
  const item=schema.items.oneOf.find(branch=>branch.properties.component.const===component).properties.options.items;
  assert.deepEqual(item.properties.description,{type:'string',maxLength:8192});assert.equal(item.required.includes('description'),false);assert.equal(item.additionalProperties,false);
 }
});

test('optional structured fields accept canonical empty values but reject whitespace defaults and submissions',()=>{
 const {c,Catalog}=setup();install(c);c.setFieldValue('s','name','Ada');c.setFieldValue('s','terms',true);
 for(const id of ['seat','date','time']){
  const node=fields().find(node=>node.id===id);
  assert.equal(Catalog.fieldError(node,''),'');assert.ok(Catalog.fieldError(node,'   '));
  assert.throws(()=>Catalog.validate({...node,value:'   '}),/FIELD_VALUE/);
  assert.equal(c.setFieldValue('s',id,'   '),true,'invalid editable state remains available for correction');
  assert.equal(c.validateForm('s','trip'),false);assert.ok(maps(c).errors[id]);
  assert.equal(c.dispatchAction(submit(),c.getSurface('s').revision,`invalid-${id}`),false);
  c.setFieldValue('s',id,'');assert.equal(c.validateForm('s','trip'),true);
 }
});

test('valid Object-prototype-like component IDs use only own field overrides',()=>{
 const {c}=setup();install(c,formNodes([{id:'toString',component:'OpenUiInput',field:'toString',label:'Value',value:'default'}]));
 let updates=0;c.subscribe(()=>updates++);assert.equal(c.setFieldValue('s','toString','default'),true);assert.equal(updates,0);
 assert.equal(c.getFormValues('s','trip').toString,'default');assert.equal(c.setFieldValue('s','toString','edited'),true);
 assert.equal(c.getFormValues('s','trip').toString,'edited');
});

test('field overrides survive remounts and snapshots but reset for changed identity or removal',()=>{
 const {c}=setup();const nodes=formNodes();install(c,nodes);c.setFieldValue('s','name','Ada');
 const updated=plain(nodes);updated.find(x=>x.id==='name').label='Full name';updated.find(x=>x.id==='name').value='New default';
 c.apply({kind:'components',surfaceId:'s',components:updated,replace:true});assert.equal(c.getFormValues('s','trip').name,'Ada');
 const {c:restored}=setup();restored.restoreSnapshot(c.exportSnapshot());assert.equal(restored.getFormValues('s','trip').name,'Ada');
 for(const change of [{field:'other'},{variant:'textarea'},{inputType:'tel'},{component:'OpenUiTimePicker',value:''}]){
  const before=plain(nodes);c.apply({kind:'components',surfaceId:'s',components:before,replace:true});c.setFieldValue('s','name','Ada');
  const next=plain(before);Object.assign(next.find(x=>x.id==='name'),change);
  c.apply({kind:'components',surfaceId:'s',components:next,replace:true});assert.equal(maps(c).values.name,undefined);
 }
 const removed=formNodes(fields().filter(x=>x.id!=='name'));c.apply({kind:'components',surfaceId:'s',components:removed,replace:true});
 assert.equal(maps(c).values.name,undefined);assert.equal(maps(c).errors.name,undefined);
});

test('form names isolate same-named fields, and surfaces/controllers do not share edits',()=>{
 const {c}=setup();const nodes=[{id:'root',component:'Column',children:['first','second']},
  {id:'first',component:'OpenUiForm',name:'a',children:['a_name']},{id:'second',component:'OpenUiForm',name:'b',children:['b_name']},
  {id:'a_name',component:'OpenUiInput',field:'name',label:'A'},{id:'b_name',component:'OpenUiInput',field:'name',label:'B'}];
 install(c,nodes);install(c,nodes,'other');const {c:second}=setup();install(second,nodes);
 c.setFieldValue('s','a_name','one');c.setFieldValue('s','b_name','two');
 assert.equal(c.getFormValues('s','a').name,'one');assert.equal(c.getFormValues('s','b').name,'two');
 assert.equal(c.getFormValues('other','a').name,'');assert.equal(second.getFormValues('s','a').name,'');
 const moved=plain(nodes);moved[1].children=['b_name'];moved[2].children=['a_name'];
 c.apply({kind:'components',surfaceId:'s',components:moved,replace:true});assert.deepEqual(maps(c).values,{});
});

test('stale, readonly, disabled and unreachable native edits cannot mutate field state',()=>{
 const {c}=setup();install(c);let revision=c.getSurface('s').revision;
 assert.equal(c.setFieldValue('s','disabled','no',revision),false);assert.equal(c.setFieldValue('s','unknown','no',revision),false);
 c.setReadOnly('s',true);assert.equal(c.setFieldValue('s','name','no',c.getSurface('s').revision),false);
 c.setReadOnly('s',false);assert.equal(c.setFieldValue('s','name','no',revision),false);
 c.apply({kind:'components',surfaceId:'s',components:[{id:'root',component:'Column',children:[]}]});
 assert.equal(c.setFieldValue('s','name','no'),false);assert.deepEqual(maps(c).values,{});
 const {c:standalone}=setup({onFieldChange:e=>assert.equal(e.form,'')});
 install(standalone,[{id:'root',component:'OpenUiInput',field:'query',label:'Query'}]);assert.equal(standalone.setFieldValue('s','root','train'),true);
});

test('invalid form graphs and malformed controls fail atomically without touching accepted edits',()=>{
 const {c,Catalog}=setup();install(c);c.setFieldValue('s','name','Ada');const saved=c.exportSnapshot();
 const duplicate=formNodes();duplicate.find(x=>x.id==='email').field='name';
 assert.throws(()=>c.apply({kind:'components',surfaceId:'s',components:duplicate,replace:true}),/DUPLICATE_FIELD/);
 const nested=formNodes();nested.find(x=>x.id==='form').children.push('nested');nested.push({id:'nested',component:'OpenUiForm',name:'inner',children:[]});
 assert.throws(()=>c.apply({kind:'components',surfaceId:'s',components:nested,replace:true}),/NESTED_FORM/);
 const outside=formNodes();outside.find(x=>x.id==='root').children.push('submit');outside.find(x=>x.id==='form').children=fields().map(x=>x.id);
 assert.throws(()=>c.apply({kind:'components',surfaceId:'s',components:outside,replace:true}),/SUBMIT_FORM/);
 for(const node of [
  {id:'x',component:'OpenUiInput',field:'__proto__',label:'Bad'},
  {id:'x',component:'OpenUiForm',name:'constructor',children:[]},
  {id:'x',component:'OpenUiSelect',field:'x',label:'Bad',options:[]},
  {id:'x',component:'OpenUiSelect',field:'x',label:'Bad',options:[{label:'A',value:'a'},{label:'B',value:'a'}]},
  {id:'x',component:'OpenUiDatePicker',field:'x',label:'Bad',value:'2026-02-29'},
  {id:'x',component:'OpenUiTimePicker',field:'x',label:'Bad',value:'7:00'},
  {id:'x',component:'OpenUiSlider',field:'x',label:'Bad',min:100,max:1},
  {id:'x',component:'OpenUiSlider',field:'x',label:'Bad',min:5,max:5,value:5},
  {id:'x',component:'OpenUiSlider',field:'x',label:'Bad',step:0.001},
  {id:'x',component:'OpenUiSlider',field:'x',label:'Bad',min:5,max:10,step:6},
  {id:'x',component:'OpenUiSlider',field:'x',label:'Bad',step:0},
  {id:'x',component:'OpenUiSlider',field:'x',label:'Bad',max:Infinity},
  {id:'x',component:'Button',child:'label',action:{event:{name:'submit',context:{form:'trip',fields:{}}}}}
 ]) assert.throws(()=>Catalog.validate(node),/OPENUI_/);
 for(const node of [
  {id:'x',component:'OpenUiSlider',field:'x',label:'Valid',min:5,max:10,step:5,value:10},
  {id:'x',component:'OpenUiSlider',field:'x',label:'Valid',min:0,max:1,step:0.01,value:0.5}
 ]) assert.doesNotThrow(()=>Catalog.validate(node));
 assert.equal(c.exportSnapshot(),saved);
});

test('legacy snapshots backfill empty form maps; corrupt field maps and stale imports are rejected atomically',()=>{
 const {c}=setup();install(c);c.setFieldValue('s','name','Ada');const saved=JSON.parse(c.exportSnapshot());
 const {c:restored}=setup();restored.restoreSnapshot(JSON.stringify(saved));const before=restored.exportSnapshot();
 const corrupt=plain(saved);corrupt.surfaces[0].fieldValuesJson=JSON.stringify({name:{injected:true}});
 assert.throws(()=>restored.restoreSnapshot(JSON.stringify(corrupt)),/SNAPSHOT_FIELD/);assert.equal(restored.exportSnapshot(),before);
 corrupt.surfaces[0].fieldValuesJson=JSON.stringify({missing:'bad'});assert.throws(()=>restored.restoreSnapshot(JSON.stringify(corrupt)),/SNAPSHOT_FIELD/);
 corrupt.surfaces[0].fieldValuesJson='[]';assert.throws(()=>restored.restoreSnapshot(JSON.stringify(corrupt)),/SNAPSHOT_FIELD/);
 delete saved.surfaces[0].fieldValuesJson;delete saved.surfaces[0].fieldErrorsJson;
 const oldRevision=saved.surfaces[0].revision;restored.restoreSnapshot(JSON.stringify(saved));
 assert.deepEqual(maps(restored),{values:{},errors:{}});assert.equal(restored.setFieldValue('s','name','stale',oldRevision),false);
});

test('an observer changing the document while validation publishes cannot dispatch an obsolete submit',()=>{
 const actions=[];const {c}=setup({onAction:e=>actions.push(e)});install(c);const revision=c.getSurface('s').revision;
 c.validateForm('s','trip');c.setFieldValue('s','name','Ada');c.setFieldValue('s','terms',true);
 // A persisted prior error is cleared during validation, invoking a host observer.
 const saved=JSON.parse(c.exportSnapshot());saved.surfaces[0].fieldErrorsJson=JSON.stringify({name:'old error'});c.restoreSnapshot(JSON.stringify(saved));
 const current=c.getSurface('s').revision;let changed=false;
 c.subscribe(()=>{if(!changed){changed=true;c.apply({kind:'data',surfaceId:'s',valueJson:'{}'});}});
 assert.equal(c.dispatchAction(submit(),current,'outdated'),false);assert.equal(actions.length,0);assert.ok(c.getSurface('s').revision>revision);
});

test('image/list/dialog bounds and published schema describe the same controlled capability set',()=>{
 const {Catalog}=setup();const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/native-ir.schema.json'),'utf8'));
 assert.deepEqual(schema.items.oneOf.map(x=>x.properties.component.const),Array.from(Catalog.componentNames));
 for(const valid of [
  {id:'i',component:'OpenUiImage',source:'https://example.com/image.png',alt:'Cover',aspectRatio:.25},
  {id:'l',component:'OpenUiList',height:480,items:[{title:'Train',description:'49 min',meta:'¥51'}]},
  {id:'d',component:'OpenUiDialog',label:'Review',title:'Confirm?',text:'Details',action:{event:{name:'choose',context:{value:'yes'}}}}
 ]) assert.doesNotThrow(()=>Catalog.validate(valid));
 for(const invalid of [
  {id:'i',component:'OpenUiImage',source:'http://example.com/x',alt:'Cover'},
  {id:'i',component:'OpenUiImage',source:'https://example.com/x',alt:'Cover',aspectRatio:5},
  {id:'l',component:'OpenUiList',items:[]},
  {id:'l',component:'OpenUiList',height:100,items:[{title:'Train'}]},
  {id:'d',component:'OpenUiDialog',label:'Review',title:'Confirm?',text:'Details',action:{event:{name:'choose',context:{}}},html:'unsafe'}
 ]) assert.throws(()=>Catalog.validate(invalid),/OPENUI_/);
 for(const branch of schema.items.oneOf){assert.equal(branch.additionalProperties,false);}
});
