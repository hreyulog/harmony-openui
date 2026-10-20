// SPDX-License-Identifier: Apache-2.0
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const path=require('node:path');
const root=path.join(__dirname,'../openui/src/main/ets/');
function fixture(){
 const read=name=>fs.readFileSync(root+name+'.ets','utf8');
 const native=read('render/OpenUiNative');
 const intrinsic=read('render/OpenUiIntrinsicLayout');
 const intrinsicMethods=intrinsic.slice(intrinsic.indexOf('  onMeasureSize('),intrinsic.indexOf('  build()'));
 const intrinsicClass='class IntrinsicFixture {widthHint:number=0;revision:number=0;kind:string="";title:string="";onMeasured:(size:SizeResult)=>void=()=>{};'+intrinsicMethods+'}';
 const view=read('render/OpenUiView');
 const methods=view.slice(view.indexOf('  aboutToAppear():'),view.indexOf('  build() {'));
 const fakeView='class ViewFixture { controller: OpenUiController = new OpenUiController(); surfaceId:string="s"; theme:OpenUiTheme=OpenUiThemes.create(); nativeInstance:number=0;visibleEpoch:number=0;errorLabel:string="";observerId:number=-1;epoch:number=0;contentWidth:number=0;outerWidth:number=0;eventSerial:number=0;lifetime:string="fixture";fingerprint:string="";mountedSurface:string="";manager:SurfaceManager|undefined;nativeSession:OpenUiNativeSession|undefined;details:Map<string,boolean>=new Map();getUIContext():UIContext {return {window:this.lifetime} as UIContext;}'+methods+'}';
 const sources=[read('core/OpenUiTypes'),read('core/OpenUiCatalog'),read('core/OpenUiController'),read('render/OpenUiTheme'),read('render/OpenUiRenderDiagnostics'),read('render/OpenUiNativeIds'),read('render/OpenUiProjection'),native.split('@Builder')[0],native.slice(native.indexOf('export class OpenUiNativeElement')),view.split('@Component')[0],fakeView,intrinsicClass];
 const text=sources.join('\n').replace(/^import[\s\S]*?;\r?\n/gm,'');
 const js=stripTypeScriptTypes(text).replace(/^export /gm,'');
 const factories=new Map(),events=[],sizes=[],managers=[],hybridViews=new Map(),timers=new Map();let serial=0,timerSerial=0;
 class NativeBase {
  constructor(surface,id,type,_ptr,_builder,instance){Object.assign(this,{surface,id,type,instance});this.earlyContext=this.getUIContext();}
  getSurfaceId(){return this.surface}getContextId(){return this.surface}getNodeId(){return this.id}getComponentType(){return this.type}getInstanceId(){return this.instance}
  getUIContext(){return undefined}toCreateArkUIView(){const context=this.getUIContext();return context?{context,type:this.type}:null;}
  updateProperties(props){this.props=props;this.onUpdateProperties(props)}updateArkUI(){}reportContentHeight(height,width){sizes.push({height,width,instance:this.instance,nodeId:this.id})}
  toDestroyArkTsView(){this.onDestroy?.();this.destroyed=true}
 }
 class Manager {
  constructor(){this.instance=++serial;this.disposed=false;this.customIds=[];managers.push(this)}getInstanceId(){return this.instance}
  getSurface(surfaceId){const instance=this.instance;return {getComponent(nodeId,type){return {triggerAction(){events.push({instance,surfaceId,nodeId,type})}}}}}
  addListener(listener){this.listener=listener}beginTextStream(){}endTextStream(){}
  destroy(){this.disposed=true;for(const id of this.customIds){hybridViews.get(id)?.toDestroyArkTsView();hybridViews.delete(id)}}
  receiveTextChunk(text){
   this.payload=text;const messages=text.split('\n').map(line=>JSON.parse(line));this.surfaceId=messages[0].createSurface.surfaceId;this.nodes=messages[1].updateComponents.components;
   for(const node of this.nodes){
    const factory=factories.get(node.component);if(!factory)continue;
    // Public 1.6 calls the factory before setting ComponentState.instanceId:
    // the callback receives 0 even though this manager has a nonzero ID.
    const element=factory(this.surfaceId,node.id,node.component,0n,0);element.updateProperties(node);
    if(element.toCreateArkUIView()){hybridViews.set(node.id,element);this.customIds.push(node.id)}
   }
   this.listener.onCreateSurface({surfaceId:this.surfaceId});
  }
  updateNative(id,patch){const element=hybridViews.get(id);if(element)element.updateProperties({...element.props,...patch})}
 }
 const api=vm.runInNewContext(js+'\n({Controller:OpenUiController,Projection:OpenUiProjection,Themes:OpenUiThemes,NativeIds:OpenUiNativeIds,NativeSession:OpenUiNativeSession,View:ViewFixture,Intrinsic:IntrinsicFixture})',{Map,Set,JSON,Date,Math,SurfaceManager:Manager,A2UIComponent:NativeBase,AGenUI:{registerComponent(name,factory){factories.set(name,factory)}},wrapBuilder:()=>({}),openUiElement:()=>{},getContext:()=>({}),setTimeout:callback=>{const id=++timerSerial;timers.set(id,callback);return id},clearTimeout:id=>timers.delete(id)});
 const flushTimers=()=>{for(const [id,callback] of Array.from(timers)){timers.delete(id);callback()}};
 return {...api,factories,events,sizes,managers,hybridViews,Manager,timers,flushTimers};
}
function mount(view,outerWidth=348){view.aboutToAppear();view.viewportChanged({width:outerWidth,height:1});}
function seed(Controller,id='s',onAction=()=>{}){
 const c=new Controller({onAction});c.apply({kind:'create',surfaceId:id});c.apply({kind:'components',surfaceId:id,components:[{id:'root',component:'Column',children:['option','facts','details']},{id:'option',component:'OpenUiOption',title:{path:'/label'},meta:{path:'/price'},action:{event:{name:'pick',context:{value:{path:'/key'}}}}},{id:'facts',component:'OpenUiFacts',facts:[{label:'Amount',value:{path:'/price'}}]},{id:'details',component:'OpenUiDetails',title:'More',text:'Source details'}]});c.apply({kind:'data',surfaceId:id,valueJson:JSON.stringify({label:'Observed choice',price:42,key:'a'})});return c;
}
test('projection resolves live data, applies accessible defaults and never mutates model state',()=>{
 const s=fixture(),c=seed(s.Controller),surface=c.getSurface('s'),before=JSON.stringify(surface);const nodes=s.Projection.components(surface,s.Themes.create());
 assert.equal(nodes.find(n=>n.id==='option').title,'Observed choice');assert.equal(nodes.find(n=>n.id==='option').meta,'42');assert.equal(nodes.find(n=>n.id==='option').action.event.context.value,'a');assert.equal(nodes.find(n=>n.id==='facts').facts[0].value,'42');assert.equal(JSON.stringify(surface),before);
 c.setReadOnly('s',true);const readonly=s.Projection.components(c.getSurface('s'),s.Themes.create());assert.equal(readonly.find(n=>n.id==='option').selectable,false);assert.equal(readonly.find(n=>n.id==='option').action,undefined);
});
test('native scopes isolate themes, read-only state and routes even when surface IDs match',()=>{
 const s=fixture(),a=new s.Manager(),b=new s.Manager(),light=s.Themes.create(),dark=s.Themes.create('dark');
 const ia=new s.NativeIds([{id:'a'}]),ib=new s.NativeIds([{id:'b'}]);
 const sa=new s.NativeSession(a,'same',light,false,'',new Map(),{},ia),sb=new s.NativeSession(b,'same',dark,true,'',new Map(),{},ib);
 const create=(id)=>s.factories.get('OpenUiOption')('same',id,'OpenUiOption',0n,0);const na=create(ia.nativeId('a')),nb=create(ib.nativeId('b'));na.updateProperties({title:'A',selectable:true});nb.updateProperties({title:'B',selectable:true});
 assert.equal(na.skin().mode,'light');assert.equal(nb.skin().mode,'dark');na.activate();nb.activate();assert.equal(s.events.length,1);assert.equal(s.events[0].nodeId,ia.nativeId('a'));assert.equal(s.events[0].instance,a.getInstanceId());
 na.activate();assert.equal(s.events.length,2,'host owns repeat policy; renderer does not lock after ordinary selection');sa.dispose();na.activate();assert.equal(s.events.length,2);sb.dispose();
});

test('custom factories correct the public SDK instance-0 callback before resolving UIContext or reporting size',()=>{
 const s=fixture(),a=new s.Manager(),b=new s.Manager(),contextA={window:'A'},contextB={window:'B'};
 const types=['OpenUiOption','OpenUiFacts','OpenUiStatus','OpenUiDetails'];
 const ia=new s.NativeIds(types.map(id=>({id}))),ib=new s.NativeIds(types.map(id=>({id})));
 const ownerA=new s.NativeSession(a,'same',s.Themes.create(),false,'',new Map(),contextA,ia,undefined,320);
 const ownerB=new s.NativeSession(b,'same',s.Themes.create('dark'),false,'',new Map(),contextB,ib,undefined,320);
 for(const type of types){
  const first=s.factories.get(type)('same',ia.nativeId(type),type,0n,0);
  const second=s.factories.get(type)('same',ib.nativeId(type),type,0n,0);
  assert.equal(first.earlyContext,contextA,'context lookup is safe even before derived owner fields initialize');
  assert.equal(second.earlyContext,contextB);
  assert.equal(first.toCreateArkUIView().context,contextA,'ComponentContent creation does not depend on global AppStorage');
  assert.equal(second.toCreateArkUIView().context,contextB,'same surface ID in a different native instance uses its own window');
  assert.equal(first.getInstanceId(),a.getInstanceId());assert.equal(second.getInstanceId(),b.getInstanceId());
  first.sizeChanged({width:320,height:64});assert.equal(s.sizes.at(-1).instance,a.getInstanceId());
 }
 ownerA.dispose();ownerB.dispose();
});
test('native details retain explicit expanded state and measurement ignores duplicate and zero reports',()=>{
 const s=fixture(),m=new s.Manager(),state=new Map();let ids=new s.NativeIds([{id:'details'}]);const owner=new s.NativeSession(m,'s',s.Themes.create(),false,'',state,{},ids,undefined,320);const create=()=>s.factories.get('OpenUiDetails')('s',ids.nativeId('details'),'OpenUiDetails',0n,0);const a=create();const initialRevision=a.renderRevision;a.updateProperties({title:'More',text:'Facts'});assert.ok(a.renderRevision>initialRevision,'native property updates provide a scalar invalidation token across the ArkUI wrapper boundary');const propertyRevision=a.renderRevision;a.toggle();assert.ok(a.renderRevision>propertyRevision,'local expansion also invalidates content measurement');assert.equal(a.isExpanded(),true);assert.equal(state.get('details'),true);
 a.sizeChanged({width:320,height:44});a.sizeChanged({width:320,height:44});a.sizeChanged({width:320,height:0});a.sizeChanged({width:320,height:100});assert.equal(s.sizes.length,2);const oldNativeId=ids.nativeId('details');owner.dispose();a.sizeChanged({width:320,height:120});assert.equal(s.sizes.length,2,'a disposed native pointer cannot receive a delayed size report');ids=new s.NativeIds([{id:'details'}]);new s.NativeSession(m,'s',s.Themes.create('dark'),true,'',state,{},ids,undefined,320);assert.notEqual(ids.nativeId('details'),oldNativeId,'manager instance reuse still gets a fresh node namespace');assert.equal(create().isExpanded(),true);const stale=s.factories.get('OpenUiDetails')('s',oldNativeId,'OpenUiDetails',0n,0);assert.equal(stale.toCreateArkUIView(),null,'a disposed node cannot borrow a newer same-surface context');
});
test('rendered status waits for positive layout and every semantic node to measure, without remounting',()=>{
 const s=fixture(),c=seed(s.Controller),view=new s.View();view.controller=c;mount(view);assert.equal(s.managers.length,1);assert.equal(c.getSurface('s').renderStatus,'pending');
 view.laidOut(view.epoch,{width:320,height:0});assert.equal(c.getSurface('s').renderStatus,'pending');view.laidOut(view.epoch,{width:320,height:130});assert.equal(c.getSurface('s').renderStatus,'pending','a visible heading cannot acknowledge missing semantic content');const ids=s.managers[0].customIds;s.hybridViews.get(ids[0]).sizeChanged({width:320,height:64});assert.equal(c.getSurface('s').renderStatus,'pending');for(const id of ids.slice(1))s.hybridViews.get(id).sizeChanged({width:320,height:80});assert.equal(c.getSurface('s').renderStatus,'rendered');assert.equal(s.managers.length,1);view.aboutToDisappear();assert.equal(s.managers[0].disposed,true);
});
test('old native callbacks and wrong-surface callbacks cannot act after an incremental revision',()=>{
 const s=fixture(),accepted=[],c=seed(s.Controller,'s',event=>accepted.push(event)),view=new s.View();view.controller=c;mount(view);const old=s.managers[0];c.apply({kind:'data',surfaceId:'s',path:'/price',valueJson:'65'});assert.equal(s.managers.length,2);assert.equal(old.disposed,true);
 const current=s.managers[1],oldId=old.nodes.find(node=>node.component==='OpenUiOption').id,currentId=current.nodes.find(node=>node.component==='OpenUiOption').id;
 const raw=(surfaceId,id)=>JSON.stringify({version:'v0.9',action:{surfaceId,sourceComponentId:id,name:'pick',context:{value:'a'}}});old.listener.onReceiveActionEvent(raw('s',oldId));assert.equal(accepted.length,0);current.listener.onReceiveActionEvent(raw('other',currentId));assert.equal(accepted.length,0);current.listener.onReceiveActionEvent(raw('s',oldId));assert.equal(accepted.length,0,'a current listener rejects an old mount ID');current.listener.onReceiveActionEvent(raw('s',currentId));assert.equal(accepted.length,1);assert.equal(accepted[0].sourceComponentId,'option');assert.equal(accepted[0].context.value,'a');view.aboutToDisappear();
});

test('the real SDK global node-ID map cannot update or destroy another same-ID surface',()=>{
 const s=fixture(),eventsA=[],eventsB=[],ca=seed(s.Controller,'same',e=>eventsA.push(e)),cb=seed(s.Controller,'same',e=>eventsB.push(e)),a=new s.View(),b=new s.View();a.controller=ca;b.controller=cb;a.surfaceId='same';b.surfaceId='same';mount(a);mount(b);
 const ma=s.managers[0],mb=s.managers[1],idA=ma.nodes.find(n=>n.component==='OpenUiOption').id,idB=mb.nodes.find(n=>n.component==='OpenUiOption').id;
 assert.notEqual(idA,idB);assert.notEqual(ma.nodes.find(n=>n.component==='OpenUiFacts').id,mb.nodes.find(n=>n.component==='OpenUiFacts').id);assert.equal(s.hybridViews.size,6);
 const first=s.hybridViews.get(idA),second=s.hybridViews.get(idB);ma.updateNative(idA,{title:'Only A updated'});assert.equal(first.heading,'Only A updated');assert.equal(second.heading,'Observed choice');
 const raw=(source,context)=>JSON.stringify({version:'v0.9',action:{surfaceId:'same',sourceComponentId:source,name:'pick',context}});
 mb.listener.onReceiveActionEvent(raw(idA,{value:'a'}));assert.equal(eventsB.length,0,'an event from the other mount cannot be reattributed');
 mb.listener.onReceiveActionEvent(raw(idB,{value:'a'}));assert.equal(eventsB.length,1);assert.equal(eventsB[0].sourceComponentId,'option');assert.deepEqual(JSON.parse(JSON.stringify(eventsB[0].context)),{value:'a'});
 a.aboutToDisappear();assert.equal(first.destroyed,true);assert.equal(second.destroyed,undefined);assert.equal(s.hybridViews.get(idB),second);assert.equal(s.hybridViews.size,3);second.activate();assert.equal(s.events.at(-1).instance,mb.getInstanceId());assert.equal(s.events.at(-1).nodeId,idB);assert.equal(eventsA.length,0);b.aboutToDisappear();assert.equal(s.hybridViews.size,0);
});

test('a semantic source root is namespaced below a noninteractive basic native root',()=>{
 const s=fixture(),accepted=[],c=new s.Controller({onAction:e=>accepted.push(e)});c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:[{id:'root',component:'OpenUiOption',title:'Root choice',action:{event:{name:'choose',context:{value:'unchanged-context'}}}}]});c.setSelected('s','root');const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],root=manager.nodes.find(n=>n.id==='root'),option=manager.nodes.find(n=>n.component==='OpenUiOption');
 assert.equal(root.component,'Column');assert.equal(root.action,undefined);assert.deepEqual(JSON.parse(JSON.stringify(root.children)),[option.id]);assert.notEqual(option.id,'root');assert.equal(s.hybridViews.get(option.id).isSelected(),true);
 manager.listener.onReceiveActionEvent(JSON.stringify({version:'v0.9',action:{surfaceId:'s',sourceComponentId:option.id,name:'choose',context:{value:'unchanged-context'}}}));assert.equal(accepted[0].sourceComponentId,'root');assert.equal(accepted[0].context.value,'unchanged-context');view.aboutToDisappear();
});

test('intrinsic layout requests finite measurement bounds and returns its child result at the available width',()=>{
 const s=fixture(),layout=new s.Intrinsic(),constraints=[],positions=[],measured=[];layout.widthHint=0;layout.onMeasured=size=>measured.push(size);
 const child={measure:constraint=>{constraints.push(constraint);return {width:constraint.maxWidth,height:168}}};
 const first=layout.onMeasureSize({},[child],{minWidth:0,maxWidth:310,minHeight:0,maxHeight:0});
 assert.equal(constraints[0].minWidth,310);assert.equal(constraints[0].maxWidth,310);assert.equal(constraints[0].minHeight,0);assert.ok(Number.isFinite(constraints[0].maxHeight)&&constraints[0].maxHeight>10000,'use a finite intrinsic measurement range across the ArkUI Length bridge');assert.equal(first.height,168);assert.equal(measured[0].height,168);
 child.measure=constraint=>({width:constraint.maxWidth,height:392});const expanded=layout.onMeasureSize({},[child],{maxWidth:220,maxHeight:0});assert.equal(expanded.width,220);assert.equal(expanded.height,392,'wrapped facts and expanded details report actual content instead of a fixed card height');
 layout.onPlaceChildren({},[{layout:position=>positions.push(position)}],{});assert.deepEqual(JSON.parse(JSON.stringify(positions)),[{x:0,y:0}]);
});

test('measurement reports are deferred and coalesced, and disposal cancels queued native work',()=>{
 const s=fixture(),c=seed(s.Controller),view=new s.View();view.controller=c;mount(view);const element=s.hybridViews.get(s.managers[0].customIds[0]);
 element.scheduleSize({width:310,height:64});element.scheduleSize({width:310,height:176});assert.equal(s.sizes.length,0,'native state is not changed within onMeasureSize');assert.equal(s.timers.size,1);s.flushTimers();assert.equal(s.sizes.length,1);assert.equal(s.sizes[0].height,176);assert.equal(s.sizes[0].instance,s.managers[0].getInstanceId());
 element.scheduleSize({width:310,height:176});s.flushTimers();assert.equal(s.sizes.length,1,'unchanged measured size remains deduplicated');element.scheduleSize({width:310,height:212});assert.equal(s.timers.size,1);view.aboutToDisappear();assert.equal(s.timers.size,0);s.flushTimers();assert.equal(s.sizes.length,1);
});

test('unreachable semantic leftovers do not prevent the visible tree from acknowledging measurement',()=>{
 const s=fixture(),c=seed(s.Controller);c.apply({kind:'components',surfaceId:'s',components:[{id:'orphan',component:'OpenUiFacts',facts:[{label:'Old',value:'Unused'}]}]});const view=new s.View();view.controller=c;mount(view);const nodes=s.managers[0].nodes;
 view.laidOut(view.epoch,{width:310,height:200});for(const node of nodes.filter(n=>n.component==='OpenUiOption'||n.component==='OpenUiDetails'||n.component==='OpenUiFacts'&&n.facts[0].label==='Amount'))s.hybridViews.get(node.id).sizeChanged({width:310,height:64});assert.equal(c.getSurface('s').renderStatus,'rendered');view.aboutToDisappear();
});

test('native rendering waits for host content width and seeds the synthetic root with that width',()=>{
 const s=fixture(),c=seed(s.Controller),view=new s.View();view.controller=c;view.aboutToAppear();assert.equal(s.managers.length,0,'the display viewport must not bootstrap a padded card');view.viewportChanged({width:0,height:0});assert.equal(s.managers.length,0);view.viewportChanged({width:337,height:100});assert.equal(s.managers.length,1);assert.equal(s.managers[0].nodes.find(n=>n.id==='root').styles.width,'618px');assert.equal(view.nativeSession.contentWidth,309);view.aboutToDisappear();
});

test('late viewport-width measurements cannot relock a narrower current card',()=>{
 const s=fixture(),c=seed(s.Controller),view=new s.View();view.controller=c;mount(view,337);const element=s.hybridViews.get(s.managers[0].customIds[0]);element.scheduleSize({width:377,height:82});s.flushTimers();assert.equal(s.sizes.length,0,'a deferred pre-bind viewport measurement is discarded, including its old height');element.scheduleSize({width:309,height:124});s.flushTimers();assert.equal(s.sizes.length,1);assert.equal(s.sizes[0].width,309);assert.equal(s.sizes[0].height,124);
 const oldManager=s.managers[0];element.scheduleSize({width:309,height:140});view.viewportChanged({width:244,height:150});assert.equal(s.managers.length,2);assert.equal(oldManager.disposed,true);assert.equal(s.managers[1].nodes.find(n=>n.id==='root').styles.width,'432px');s.flushTimers();assert.equal(s.sizes.length,1,'queued measurements from the old width epoch cannot touch the new mount');view.aboutToDisappear();
});

test('semantic measurement applies host width as an upper bound and preserves narrower nested columns',()=>{
 const s=fixture(),layout=new s.Intrinsic(),widths=[];layout.widthHint=309;const child={measure:constraint=>{widths.push(constraint.maxWidth);return {width:constraint.maxWidth,height:Math.ceil(900/constraint.maxWidth)*24}}};
 const corrected=layout.onMeasureSize({},[child],{maxWidth:377,maxHeight:0});assert.equal(corrected.width,309);assert.equal(corrected.height,72,'height is recomputed from content at the capped width');const nested=layout.onMeasureSize({},[child],{maxWidth:150,maxHeight:0});assert.equal(nested.width,150);assert.equal(nested.height,144);assert.deepEqual(widths,[309,150]);
});
