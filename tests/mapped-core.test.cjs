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
function nodes(value='all',show=true){return [
 {id:'root',component:'Column',children:['filter',...(show?['card']:[]),'reset']},
 {id:'filter',component:'OpenUiSelect',field:'category',label:'Category',value,
  options:[{label:'All',value:'all'},{label:'Direct',value:'direct'}]},
 ...(show?[
  {id:'card',component:'Card',child:'body'},
  {id:'body',component:'Column',children:['cover','title','pick']},
  {id:'cover',component:'Image',source:'https://example.com/cover.jpg',alt:'Train',aspectRatio:2},
  {id:'title',component:'Text',text:'Result'},
  {id:'pick',component:'Button',child:'pick_label',action:{event:{name:'mapped_action',context:{actionId:'pick'}}}},
  {id:'pick_label',component:'Text',text:'Choose'}
 ]:[]),
 {id:'reset',component:'Button',child:'reset_label',action:{event:{name:'mapped_action',context:{actionId:'reset'}}}},
 {id:'reset_label',component:'Text',text:'Reset'}
 ];}
function install(c){c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:nodes(),replace:true});}
const action=(source='pick',context={actionId:source})=>({surfaceId:'s',sourceComponentId:source,name:'mapped_action',context});

test('complete patch is an atomic replacement and fences old actions while preserving stable semantic IDs',()=>{
 const actions=[];const {c}=setup({onAction:e=>actions.push(e)});install(c);const old=c.getSurface('s').revision;
 c.apply({kind:'patch',surfaceId:'s',components:nodes('direct',false)});
 const next=c.getSurface('s');assert.ok(next.revision>old);assert.equal(next.updateMode,'patch');
 assert.equal(next.components.some(n=>n.id==='card'),false);assert.equal(next.components.some(n=>n.id==='cover'),false);
 assert.equal(c.dispatchAction(action(),old,'old-owner'),false);assert.equal(c.dispatchAction(action(),next.revision,'removed'),false);
 assert.equal(c.dispatchAction(action('reset',{actionId:'pick'}),next.revision,'tampered'),false);
 assert.equal(c.dispatchAction(action('reset'),next.revision,'current'),true);assert.equal(actions.length,1);
 c.apply({kind:'patch',surfaceId:'s',components:nodes('direct')});
 assert.equal(c.getSurface('s').components.find(n=>n.id==='card').id,'card');
 assert.equal(c.dispatchAction(action(),c.getSurface('s').revision,'restored-card'),true);
});

test('partial graph, duplicate IDs and invalid images cannot replace an accepted mapped result',()=>{
 const {c}=setup();install(c);c.setFieldValue('s','filter','direct');const saved=c.exportSnapshot();
 for(const [candidate,error] of [
  [[{id:'root',component:'Column',children:['missing']}],/PATCH_REFERENCE/],
  [[{id:'orphan',component:'Text',text:'No root'}],/PATCH_ROOT/],
  [[...nodes(),{id:'title',component:'Text',text:'Duplicate'}],/DUPLICATE_ID/],
  [nodes().map(n=>n.id==='cover'?{...n,source:'file:///private.jpg'}:n),/IMAGE/]
 ]){assert.throws(()=>c.apply({kind:'patch',surfaceId:'s',components:candidate,syncFieldValues:true}),error);assert.equal(c.exportSnapshot(),saved);}
 assert.throws(()=>c.apply({kind:'components',surfaceId:'s',components:nodes(),syncFieldValues:true}),/PATCH_FIELD_SYNC/);
 assert.throws(()=>c.apply({kind:'patch',surfaceId:'s',components:nodes(),syncFieldValues:'true'}),/PATCH_FIELD_SYNC/);
 assert.equal(c.exportSnapshot(),saved);
});

test('state-owning adapter can authoritatively reset native fields without native change feedback',()=>{
 const changes=[];const {c}=setup({onFieldChange:e=>changes.push(e)});install(c);c.setFieldValue('s','filter','direct');
 assert.equal(JSON.parse(c.getSurface('s').fieldValuesJson).filter,'direct');assert.equal(changes.length,1);
 c.apply({kind:'patch',surfaceId:'s',components:nodes('all')});
 assert.equal(JSON.parse(c.getSurface('s').fieldValuesJson).filter,'direct','default patches preserve native edits');
 c.apply({kind:'patch',surfaceId:'s',components:nodes('all'),syncFieldValues:true});
 const reset=c.getSurface('s');assert.equal(reset.components.find(n=>n.id==='filter').value,'all');
 assert.deepEqual(JSON.parse(reset.fieldValuesJson),{});assert.deepEqual(JSON.parse(reset.fieldErrorsJson),{});
 assert.equal(changes.length,1,'state-to-native synchronization never calls onFieldChange');
});

test('reusing an ID for a different native kind or field identity requests safe replacement',()=>{
 for(const mutate of [
  n=>{n.find(x=>x.id==='title').component='OpenUiStatus';},
  n=>{n.find(x=>x.id==='filter').field='another';},
  n=>{const f=n.find(x=>x.id==='filter');f.component='OpenUiInput';delete f.options;},
  n=>{n.find(x=>x.id==='root').children=['form','card','reset'];n.push({id:'form',component:'OpenUiForm',name:'filters',children:['filter']});}
 ]){
  const {c}=setup();install(c);const candidate=nodes();mutate(candidate);
  c.apply({kind:'patch',surfaceId:'s',components:candidate});assert.equal(c.getSurface('s').updateMode,'replace');
 }
 const {c}=setup();install(c);const candidate=nodes();candidate.find(n=>n.id==='filter').label='Filter';candidate.find(n=>n.id==='title').text='Updated';
 c.apply({kind:'patch',surfaceId:'s',components:candidate});assert.equal(c.getSurface('s').updateMode,'patch');
});

test('removed fields drop native overrides and re-added controls take their current mapped defaults',()=>{
 const {c}=setup();install(c);c.setFieldValue('s','filter','direct');
 const removed=nodes().filter(n=>n.id!=='filter');removed[0].children=removed[0].children.filter(id=>id!=='filter');
 c.apply({kind:'patch',surfaceId:'s',components:removed});assert.deepEqual(JSON.parse(c.getSurface('s').fieldValuesJson),{});
 c.apply({kind:'patch',surfaceId:'s',components:nodes('all')});assert.deepEqual(JSON.parse(c.getSurface('s').fieldValuesJson),{});
 assert.equal(c.getSurface('s').components.find(n=>n.id==='filter').value,'all');
});

test('changing a confirmation definition requests teardown while unrelated mapped updates preserve its owner',()=>{
 const original=[{id:'root',component:'Column',children:['info','confirm']},{id:'info',component:'Text',text:'Status'},
  {id:'confirm',component:'OpenUiDialog',label:'Review',title:'Confirm A?',text:'Item A',confirmLabel:'Confirm',cancelLabel:'Cancel',
   action:{event:{name:'choose',context:{item:'a'}}}}];
 for(const change of [
  {label:'Review B'},{title:'Confirm B?'},{text:'Item B'},{confirmLabel:'Approve'},{cancelLabel:'Go back'},
  {action:{event:{name:'choose',context:{item:'b'}}}}
 ]){
  const {c}=setup();c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:original});
  const candidate=plain(original);Object.assign(candidate.find(n=>n.id==='confirm'),change);
  c.apply({kind:'patch',surfaceId:'s',components:candidate});assert.equal(c.getSurface('s').updateMode,'replace');
 }
 const {c}=setup();c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:original});
 const candidate=plain(original);candidate.find(n=>n.id==='info').text='New status';
 c.apply({kind:'patch',surfaceId:'s',components:candidate});assert.equal(c.getSurface('s').updateMode,'patch');
});

test('non-patch document transitions and imported snapshots never inherit the incremental-render hint',()=>{
 const {c}=setup();install(c);c.apply({kind:'patch',surfaceId:'s',components:nodes()});
 const patched=c.exportSnapshot();assert.equal(c.getSurface('s').updateMode,'patch');
 c.setReadOnly('s',true);assert.equal(c.getSurface('s').updateMode,'replace');
 c.setReadOnly('s',false);c.apply({kind:'patch',surfaceId:'s',components:nodes()});
 c.apply({kind:'data',surfaceId:'s',valueJson:'{}'});assert.equal(c.getSurface('s').updateMode,'replace');
 c.apply({kind:'patch',surfaceId:'s',components:nodes()});c.setSelected('s','card');assert.equal(c.getSurface('s').updateMode,'replace');
 c.restoreSnapshot(patched);assert.equal(c.getSurface('s').updateMode,'replace');
 assert.ok(c.getSurface('s').revision>JSON.parse(patched).surfaces[0].revision);
});

test('direct Image native IR reuses the existing HTTPS and geometry limits without widening the legacy image',()=>{
 const {Catalog}=setup();const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/native-ir.schema.json'),'utf8'));
 assert.deepEqual(schema.items.oneOf.map(x=>x.properties.component.const),Array.from(Catalog.componentNames));
 for(const component of ['Image','OpenUiImage']){
  assert.doesNotThrow(()=>Catalog.validate({id:'image',component,source:'https://example.com/x',alt:'Result',aspectRatio:4}));
  for(const source of ['http://example.com/x','javascript:run()','file:///x'])assert.throws(()=>Catalog.validate({id:'image',component,source,alt:'Result'}),/IMAGE/);
 }
 const basic=schema.items.oneOf.find(x=>x.properties.component.const==='Image');assert.equal(basic.additionalProperties,false);
 assert.deepEqual(plain(basic.required),['id','component','source','alt']);
});
