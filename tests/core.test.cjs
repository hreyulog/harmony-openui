// SPDX-License-Identifier: Apache-2.0
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
function setup(options={}){
 const dir=path.join(__dirname,'../openui/src/main/ets/core');
 const code=['OpenUiTypes','OpenUiCatalog','OpenUiController'].map(name=>stripTypeScriptTypes(
  fs.readFileSync(path.join(dir,name+'.ets'),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),{mode:'transform'}).replace(/^export /gm,'')).join('\n');
 const {Controller,Catalog}=vm.runInNewContext(code+'\n({Controller:OpenUiController,Catalog:OpenUiCatalog})',{JSON,Map,Set,Date,Math,Object,Array,Number});
 return {controller:new Controller(options),Catalog};
}
function components(name='item'){
 return [{id:'root',component:'Column',children:[name,'facts']},
  {id:name,component:'OpenUiOption',title:'Plan A',meta:'€20',action:{event:{name:'choose',context:{value:'plan-a'}}}},
  {id:'facts',component:'OpenUiFacts',facts:[{label:'Duration',value:'20 min'}]}];
}
function install(c,id='surface',nodes=components()){
 c.apply({kind:'create',surfaceId:id});c.apply({kind:'components',surfaceId:id,components:nodes});
}
const action=(surfaceId='surface',componentId='item',context={value:'plan-a'})=>({surfaceId,sourceComponentId:componentId,name:'choose',context});

test('neutral IR supports complete replacement and incremental component arrival without mutating caller state',()=>{
 const {controller:c}=setup();c.apply({kind:'create',surfaceId:'surface'});
 const partial=[{id:'root',component:'Column',children:['later']}];c.apply({kind:'components',surfaceId:'surface',components:partial});
 assert.equal(c.getSurface('surface').components.length,1);assert.equal(c.getSurface('surface').renderStatus,'pending');
 c.apply({kind:'components',surfaceId:'surface',components:[{id:'later',component:'Text',text:'Arrived'}]});
 partial[0].children.push('outside');assert.deepEqual(c.getSurface('surface').components[0].children,['later']);
 const external=c.getSurface('surface');external.components[0].children.push('mutated');assert.equal(c.getSurface('surface').components[0].children.length,1);
 c.setSelected('surface','later');c.apply({kind:'components',surfaceId:'surface',replace:true,components:[{id:'root',component:'Text',text:'New program'}]});
 assert.equal(c.getSurface('surface').components.length,1);assert.equal(c.getSurface('surface').selectedComponent,'');
 c.apply({kind:'delete',surfaceId:'surface'});assert.equal(c.getSurface('surface'),undefined);
});

test('invalid graphs and unknown native capabilities fail atomically',()=>{
 const {controller:c}=setup();install(c);const before=c.exportSnapshot();
 assert.throws(()=>c.apply({kind:'components',surfaceId:'surface',components:[{id:'root',component:'Column',children:['root']}]}),/CYCLE/);
 assert.equal(c.exportSnapshot(),before);
 assert.throws(()=>c.apply({kind:'components',surfaceId:'surface',components:[{id:'danger',component:'Web',text:'execute'}]}),/COMPONENT/);
 assert.throws(()=>c.apply({kind:'create',surfaceId:'other',catalogId:'unavailable-catalog'}),/CATALOG/);
 assert.throws(()=>c.apply({kind:'components',surfaceId:'surface',components:[{id:'x',component:'Text',text:'one'},{id:'x',component:'Text',text:'two'}]}),/DUPLICATE/);
 assert.equal(c.exportSnapshot(),before);
});

test('host event IDs are idempotent while a new button event remains usable and no business state locks itself',()=>{
 const received=[];const {controller:c}=setup({onAction:event=>received.push(event)});install(c);
 const revision=c.getSurface('surface').revision;
 assert.equal(c.dispatchAction(action(),revision,'event-one'),true);
 assert.equal(c.dispatchAction(action(),revision,'event-one'),false);
 assert.equal(c.dispatchAction(action(),revision,'event-two'),true);
 assert.equal(received.length,2);assert.equal(c.getSurface('surface').readOnly,false);assert.equal(c.getSurface('surface').selectedComponent,'');
 assert.ok(received[0].receivedAt>0);assert.equal(received[0].revision,revision);
});

test('events must match the current surface, root-reachable component, action and resolved context',()=>{
 const received=[];const {controller:c}=setup({onAction:event=>received.push(event)});install(c);install(c,'second');
 let revision=c.getSurface('surface').revision;
 assert.equal(c.dispatchAction(action('surface','unknown'),revision,'bad-node'),false);
 assert.equal(c.dispatchAction({...action(),name:'pay'},revision,'bad-name'),false);
 assert.equal(c.dispatchAction(action('surface','item',{value:'changed'}),revision,'bad-value'),false);
 assert.equal(c.dispatchAction(action('second'),revision,'bad-surface'),false);
 c.apply({kind:'components',surfaceId:'surface',components:[{id:'root',component:'Column',children:['facts']}]});revision=c.getSurface('surface').revision;
 assert.equal(c.dispatchAction(action(),revision,'orphaned-node'),false);
 assert.equal(received.length,0);
});

test('host read-only and selection settings are explicit and invalidate old renderer revisions',()=>{
 const {controller:c}=setup();install(c);const old=c.getSurface('surface').revision;
 c.setReadOnly('surface',true);let revision=c.getSurface('surface').revision;
 assert.ok(revision>old);assert.equal(c.dispatchAction(action(),revision,'readonly'),false);
 c.setReadOnly('surface',false);c.setSelected('surface','item');revision=c.getSurface('surface').revision;
 assert.equal(c.dispatchAction(action(),old,'stale'),false);assert.equal(c.dispatchAction(action(),revision,'fresh'),true);
 assert.equal(c.getSurface('surface').selectedComponent,'item');
 c.apply({kind:'delete',surfaceId:'surface'});install(c);assert.equal(c.dispatchAction(action(),revision,'old-incarnation'),false);
});

test('data updates and action bindings use JSON pointers without accepting prototype paths',()=>{
 const received=[];const {controller:c}=setup({onAction:event=>received.push(event)});
 const nodes=components();nodes[1].action.event.context={selection:{path:'/choice'},metadata:{label:'A'}};install(c,'surface',nodes);
 c.apply({kind:'data',surfaceId:'surface',valueJson:JSON.stringify({choice:'first'})});
 c.apply({kind:'data',surfaceId:'surface',path:'/choice',valueJson:JSON.stringify('second')});
 const revision=c.getSurface('surface').revision;
 assert.equal(c.dispatchAction(action('surface','item',{metadata:{label:'A'},selection:'second'}),revision,'resolved'),true);
 assert.equal(received[0].context.selection,'second');assert.equal(JSON.parse(c.getSurface('surface').dataModelJson).choice,'second');
 const before=c.exportSnapshot();assert.throws(()=>c.apply({kind:'data',surfaceId:'surface',path:'/__proto__/polluted',valueJson:'true'}),/PATH/);
 assert.equal(c.exportSnapshot(),before);assert.equal({}.polluted,undefined);
});

test('rendered is a real renderer acknowledgement and stale acknowledgements cannot overwrite the new surface',()=>{
 const events=[];const {controller:c}=setup({onRenderStatus:event=>events.push(event)});install(c);
 let revision=c.getSurface('surface').revision;assert.equal(events.length,0);assert.equal(c.getSurface('surface').renderStatus,'pending');
 c.reportRenderStatus('surface',revision,'rendered');assert.equal(c.getSurface('surface').renderStatus,'rendered');
 c.apply({kind:'components',surfaceId:'surface',components:[{id:'facts',component:'OpenUiFacts',facts:[]}]});
 c.reportRenderStatus('surface',revision,'error','old manager');assert.equal(c.getSurface('surface').renderStatus,'pending');
 revision=c.getSurface('surface').revision;c.reportRenderStatus('surface',revision,'error','native failure');
 assert.equal(c.getSurface('surface').error,'native failure');assert.deepEqual(events.map(event=>event.status),['rendered','error']);
});

test('snapshots are host-owned, atomic on invalid import, and renew render revisions without losing state',()=>{
 const {controller:c}=setup();install(c);c.setSelected('surface','item');c.setReadOnly('surface',true);
 const saved=c.exportSnapshot();const {controller:restored}=setup();restored.restoreSnapshot(saved);
 const surface=restored.getSurface('surface');assert.equal(surface.selectedComponent,'item');assert.equal(surface.readOnly,true);
 assert.equal(surface.renderStatus,'pending');assert.ok(surface.revision>c.getSurface('surface').revision);
 const before=restored.exportSnapshot(),broken=JSON.parse(saved);broken.surfaces[0].components[0].component='Unknown';
 assert.throws(()=>restored.restoreSnapshot(JSON.stringify(broken)),/COMPONENT/);assert.equal(restored.exportSnapshot(),before);
});

test('A2UI is an optional framed adapter with chunk boundaries, data updates and explicit flush',()=>{
 const {controller:c,Catalog}=setup();const lines=[
  {version:'v0.9',createSurface:{surfaceId:'stream',catalogId:Catalog.id}},
  {version:'v0.9',updateComponents:{surfaceId:'stream',components:[{id:'root',component:'Text',text:{path:'/greeting'}}]}},
  {version:'v0.9',updateDataModel:{surfaceId:'stream',value:{greeting:'你好'}}}].map(JSON.stringify).join('\r\n');
 c.receiveA2ui(lines.slice(0,17));assert.equal(c.surfaces().length,0);
 c.receiveA2ui(lines.slice(17,95));c.receiveA2ui(lines.slice(95));c.flushA2ui();
 assert.equal(c.getSurface('stream').components[0].text.path,'/greeting');assert.equal(JSON.parse(c.getSurface('stream').dataModelJson).greeting,'你好');
 c.receiveA2ui(JSON.stringify({version:'v0.9',deleteSurface:{surfaceId:'stream'}})+'\n');assert.equal(c.surfaces().length,0);
 assert.throws(()=>c.receiveA2ui('{broken}\n'),SyntaxError);
 assert.throws(()=>c.receiveA2ui(JSON.stringify({version:'v99',createSurface:{surfaceId:'bad'}})+'\n'),/ENVELOPE/);
});

test('snapshot event deduplication survives state updates and imports; native timestamps are not trust inputs',()=>{
 const {controller:c}=setup();install(c);let revision=c.getSurface('surface').revision;
 assert.equal(c.acceptAction(JSON.stringify({version:'v0.9',action:action(),timestamp:'1900-01-01'}),revision,'stable-event-id'),true);
 c.apply({kind:'data',surfaceId:'surface',valueJson:'{}'});revision=c.getSurface('surface').revision;
 assert.equal(c.dispatchAction(action(),revision,'stable-event-id'),false);
 const {controller:next}=setup();next.restoreSnapshot(c.exportSnapshot());
 assert.equal(next.dispatchAction(action(),next.getSurface('surface').revision,'stable-event-id'),false);
 assert.equal(next.dispatchAction(action(),next.getSurface('surface').revision,'new-event-id'),true);
});

test('the published native IR schema declares exactly the controlled renderer capability set',()=>{
 const {Catalog}=setup();const schema=JSON.parse(fs.readFileSync(path.join(__dirname,'../schemas/native-ir.schema.json'),'utf8'));
 const kinds=schema.items.oneOf.map(branch=>branch.properties.component.const);
 assert.deepEqual(kinds,Array.from(Catalog.componentNames));
 for(const branch of schema.items.oneOf){assert.equal(branch.additionalProperties,false);assert.equal(branch.properties.selectable,undefined);assert.equal(branch.properties.selected,undefined);}
 assert.throws(()=>Catalog.validate({id:'option',component:'OpenUiOption',title:'A',selectable:true,action:{event:{name:'choose',context:{value:'A'}}}}),/PROPERTY/);
});

test('malformed context bindings reject an event without throwing or executing a host handler',()=>{
 let events=0;const {controller:c}=setup({onAction(){events++;}});const nodes=components();
 nodes[1].action.event.context={value:{path:'/constructor'}};install(c,'surface',nodes);
 assert.equal(c.dispatchAction(action(),c.getSurface('surface').revision,'bad-binding'),false);assert.equal(events,0);
});
