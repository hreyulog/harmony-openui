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
 const controls=read('render/OpenUiControlsLayout');
 const pickerMethods=controls.slice(controls.indexOf('  aboutToAppear():'),controls.indexOf('  onMeasureSize('));
 const accessibilityMethods=controls.slice(controls.indexOf('  private radioAccessibilityText('),controls.indexOf('  @Builder',controls.indexOf('  private radioAccessibilityText(')));
 const controlsClass='class ControlsFixture {kind:string="";label:string="";stringValue:string="";numberValue:number=0;boolValue:boolean=false;controlState:string="";nativeValue:OpenUiFieldValue="";liveStringValue:string="";liveNumberValue:number=0;liveBoolValue:boolean=false;selectedDate:Date=new Date();selectedTime:Date=new Date(2000,0,1);dialogVisible:boolean=false;onModalReady:(close:()=>void)=>void=()=>{};onString:(value:string)=>void=()=>{};onNumber:(value:number)=>void=()=>{};onBoolean:(value:boolean)=>void=()=>{};'+pickerMethods+accessibilityMethods+'}';
 const view=read('render/OpenUiView');
 const methods=view.slice(view.indexOf('  aboutToAppear():'),view.indexOf('  build() {'));
 const fakeView='class ViewFixture { controller: OpenUiController = new OpenUiController(); surfaceId:string="s"; theme:OpenUiTheme=OpenUiThemes.create(); nativeInstance:number=0;visibleEpoch:number=0;errorLabel:string="";observerId:number=-1;epoch:number=0;contentWidth:number=0;outerWidth:number=0;eventSerial:number=0;refreshTimer:number=-1;lifetime:string="fixture";fingerprint:string="";mountedSurface:string="";manager:SurfaceManager|undefined;nativeSession:OpenUiNativeSession|undefined;details:Map<string,boolean>=new Map();getUIContext():UIContext {return {window:this.lifetime} as UIContext;}'+methods+'}';
 const sources=[read('core/OpenUiTypes'),read('core/OpenUiCatalog'),read('core/OpenUiController'),read('render/OpenUiControlModel'),read('render/OpenUiTheme'),read('render/OpenUiRenderDiagnostics'),read('render/OpenUiNativeIds'),read('render/OpenUiProjection'),native.split('@Builder')[0],native.slice(native.indexOf('export class OpenUiNativeElement')),view.split('@Component')[0],fakeView,intrinsicClass,controlsClass];
 const text=sources.join('\n').replace(/^import[\s\S]*?;\r?\n/gm,'');
 const js=stripTypeScriptTypes(text).replace(/^export /gm,'');
 const factories=new Map(),events=[],sizes=[],managers=[],hybridViews=new Map(),timers=new Map();let serial=0,timerSerial=0;
 class NativeBase {
  constructor(surface,id,type,_ptr,_builder,instance){Object.assign(this,{surface,id,type,instance});this.earlyContext=this.getUIContext();}
  getSurfaceId(){return this.surface}getContextId(){return this.surface}getNodeId(){return this.id}getComponentType(){return this.type}getInstanceId(){return this.instance}
  getUIContext(){return undefined}toCreateArkUIView(){const context=this.getUIContext();return context?{context,type:this.type}:null;}
  updateProperties(props){this.props=props;this.onUpdateProperties(props)}updateArkUI(){this.updates=(this.updates??0)+1}reportContentHeight(height,width){sizes.push({height,width,instance:this.instance,nodeId:this.id})}
  toDestroyArkTsView(){this.onDestroy?.();this.destroyed=true}
 }
 class Manager {
  constructor(){this.instance=++serial;this.disposed=false;this.customIds=[];managers.push(this)}getInstanceId(){return this.instance}
  getSurface(surfaceId){const instance=this.instance;return {getComponent(nodeId,type){return {triggerAction(){events.push({instance,surfaceId,nodeId,type})}}}}}
  addListener(listener){this.listener=listener}beginTextStream(){}endTextStream(){}
  destroy(){this.disposed=true;for(const id of this.customIds){hybridViews.get(id)?.toDestroyArkTsView();hybridViews.delete(id)}}
  receiveTextChunk(text){
   this.payload=text;const messages=text.split('\n').map(line=>JSON.parse(line));
   this.patches??=[];this.nodes??=[];
   for(const message of messages){
    if(message.createSurface){this.surfaceId=message.createSurface.surfaceId;this.listener.onCreateSurface({surfaceId:this.surfaceId});continue}
    if(!message.updateComponents)continue;
    this.patches.push(message.updateComponents.components);
    for(const node of message.updateComponents.components){
    const prior=this.nodes.findIndex(n=>n.id===node.id);if(prior>=0)this.nodes[prior]=node;else this.nodes.push(node);
    const factory=factories.get(node.component);if(!factory)continue;
    // Public 1.6 calls the factory before setting ComponentState.instanceId:
    // the callback receives 0 even though this manager has a nonzero ID.
    const existing=hybridViews.get(node.id);if(existing){existing.updateProperties(node);continue}
    const element=factory(this.surfaceId,node.id,node.component,0n,0);element.updateProperties(node);
    if(element.toCreateArkUIView()){hybridViews.set(node.id,element);this.customIds.push(node.id)}
    }
   }
  }
  updateNative(id,patch){const element=hybridViews.get(id);if(element)element.updateProperties({...element.props,...patch})}
 }
 const api=vm.runInNewContext(js+'\n({Controller:OpenUiController,Projection:OpenUiProjection,Themes:OpenUiThemes,NativeIds:OpenUiNativeIds,NativeSession:OpenUiNativeSession,View:ViewFixture,Intrinsic:IntrinsicFixture,Controls:ControlsFixture})',{Map,Set,JSON,Date,Math,SurfaceManager:Manager,A2UIComponent:NativeBase,AGenUI:{registerComponent(name,factory){factories.set(name,factory)}},wrapBuilder:()=>({}),openUiElement:()=>{},getContext:()=>({}),setTimeout:callback=>{const id=++timerSerial;timers.set(id,callback);return id},clearTimeout:id=>timers.delete(id)});
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

test('native controls hydrate edited values and errors without recreating the native manager or control',()=>{
 const s=fixture(),m=new s.Manager(),ids=new s.NativeIds([{id:'email',component:'OpenUiInput'}]);
 const surface={fieldValuesJson:JSON.stringify({email:'first@example.com'}),fieldErrorsJson:'{}'};
 const edits=[],owner=new s.NativeSession(m,'s',s.Themes.create(),false,'',new Map(),{},ids,undefined,320,(id,value)=>{edits.push({id,value});return true},surface);
 const native=s.factories.get('OpenUiInput')('s',ids.nativeId('email'),'OpenUiInput',0n,0);
 native.updateProperties({label:'Email',value:'model-default@example.com',field:'email',inputType:'email',required:true});
 assert.equal(native.stringValue,'first@example.com','sparse local edits win over model defaults on initial hydration');
 const initialRevision=native.renderRevision;owner.syncFields(surface);assert.equal(native.updates,undefined,'same-value propagation does not reset the native editor selection');
 owner.syncFields({...surface,fieldValuesJson:JSON.stringify({email:'not-an-email'}),fieldErrorsJson:JSON.stringify({email:'email'})});
 assert.equal(native.stringValue,'not-an-email');assert.match(native.fieldError,/邮箱/);assert.equal(native.updates,1);assert.ok(native.renderRevision>initialRevision);
 native.edit('valid@example.com');assert.deepEqual(JSON.parse(JSON.stringify(edits)),[{id:'email',value:'valid@example.com'}]);assert.equal(s.managers.length,1);assert.equal(native.getInstanceId(),m.getInstanceId());
 owner.dispose();native.edit('stale@example.com');assert.equal(edits.length,1,'detached native keyboard callbacks are inert');
});

test('radio captions reach the native element unchanged and caption-only patches preserve business selection and identity',()=>{
 const s=fixture(),c=new s.Controller();const nodes=description=>[
  {id:'root',component:'Column',children:['radio']},
  {id:'radio',component:'OpenUiRadioGroup',field:'mode',label:'游览方式',value:'walk',options:[
   {label:'步行游览',value:'walk',description},{label:'公共交通',value:'transit'}
  ]}
 ];
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:nodes('沿着公园步道行走，适合慢慢欣赏风景。')});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],id=view.nativeSession.ids.nativeId('radio'),native=s.hybridViews.get(id);
 assert.equal(native.options[0].description,'沿着公园步道行走，适合慢慢欣赏风景。');assert.equal(native.options[1].description,undefined);
 native.edit('transit');assert.equal(JSON.parse(c.getSurface('s').fieldValuesJson).radio,'transit');
 c.apply({kind:'patch',surfaceId:'s',components:nodes('更新后的较长说明需要自动换行，依然保持原来的业务标识。')});
 assert.equal(s.managers.length,1);assert.equal(s.hybridViews.get(id),native);assert.equal(native.stringValue,'transit');
 assert.equal(native.options[0].description,'更新后的较长说明需要自动换行，依然保持原来的业务标识。');
 const labels=new s.Controls();labels.label=native.controlLabel;
 assert.equal(labels.radioAccessibilityText(native.options[0]),'游览方式，步行游览，更新后的较长说明需要自动换行，依然保持原来的业务标识。');
 assert.equal(labels.radioAccessibilityText(native.options[1]),'游览方式，公共交通');
 labels.label='更新的可见标题';assert.equal(labels.radioAccessibilityText(native.options[1]),'更新的可见标题，公共交通','accessibility uses visible labels instead of namespaced node IDs');
 view.aboutToDisappear();
});

test('all control factories keep real instance identity and disabled or read-only controls cannot write',()=>{
 const s=fixture(),m=new s.Manager(),types=['OpenUiInput','OpenUiCheckbox','OpenUiToggle','OpenUiSelect','OpenUiRadioGroup','OpenUiSlider','OpenUiDatePicker','OpenUiTimePicker','OpenUiImage','OpenUiList','OpenUiDialog'];
 const ids=new s.NativeIds(types.map(id=>({id,component:id}))),edits=[];
 const owner=new s.NativeSession(m,'s',s.Themes.create(),false,'',new Map(),{window:'controls'},ids,undefined,320,(id,value)=>{edits.push({id,value});return true});
 for(const type of types){const native=s.factories.get(type)('s',ids.nativeId(type),type,0n,0);native.updateProperties({label:type,disabled:true,value:type==='OpenUiCheckbox'?true:undefined});assert.equal(native.getInstanceId(),m.getInstanceId());assert.equal(native.earlyContext.window,'controls');native.edit('blocked');assert.equal(native.canEdit(),false)}
 assert.equal(edits.length,0);owner.dispose();
 const ids2=new s.NativeIds([{id:'slider',component:'OpenUiSlider'}]),readonly=new s.NativeSession(m,'s',s.Themes.create(),true,'',new Map(),{},ids2,undefined,320,()=>{edits.push('wrong');return true});
 const slider=s.factories.get('OpenUiSlider')('s',ids2.nativeId('slider'),'OpenUiSlider',0n,0);slider.updateProperties({min:5,max:10,step:1});assert.equal(slider.numberValue,5);slider.edit(7);assert.equal(edits.length,0);assert.equal(slider.canEdit(),false);readonly.dispose();
});

test('dialog confirmations use original native action identity and teardown closes the owned sheet',()=>{
 const s=fixture(),m=new s.Manager(),ids=new s.NativeIds([{id:'confirm',component:'OpenUiDialog'}]);
 const owner=new s.NativeSession(m,'s',s.Themes.create(),false,'',new Map(),{},ids),native=s.factories.get('OpenUiDialog')('s',ids.nativeId('confirm'),'OpenUiDialog',0n,0);
 native.updateProperties({label:'Review',title:'Confirm',text:'Original data',action:{event:{name:'Confirm',context:{ticket:'A'}}}});
 let closed=0;native.setModalCloser(()=>closed++);assert.equal(s.events.length,0,'model generation cannot automatically confirm or invoke the host');native.activate();
 assert.equal(s.events.length,1);assert.equal(s.events[0].type,'OpenUiDialog');assert.equal(s.events[0].nodeId,ids.nativeId('confirm'));assert.equal(native.props.action.event.context.ticket,'A');
 owner.dispose();assert.equal(closed,1);native.activate();assert.equal(s.events.length,1,'a retained sheet callback cannot confirm after replacement');native.setModalCloser(()=>closed++);assert.equal(closed,2,'a late sheet registration is immediately dismissed');native.onDestroy();assert.equal(closed,2);
});

test('native form containers do not wait for a nonexistent semantic custom view',()=>{
 const s=fixture(),surface={id:'form-surface',catalogId:'test',revision:1,readOnly:false,selectedComponent:'',dataModelJson:'{}',fieldValuesJson:'{}',fieldErrorsJson:'{}',components:[{id:'root',component:'OpenUiForm',name:'booking',children:['name']},{id:'name',component:'OpenUiInput',field:'name',label:'Name'}]};
 const ids=new s.NativeIds(surface.components);assert.deepEqual(JSON.parse(JSON.stringify(ids.semanticIds())),[ids.nativeId('name')]);
 const nodes=s.Projection.components(surface,s.Themes.create());assert.equal(nodes[0].component,'Column');assert.equal(nodes[0].name,undefined);assert.equal(surface.components[0].component,'OpenUiForm');
});

test('typing and validation update the mounted View at one revision, with stale edits rejected after replacement',()=>{
 const s=fixture(),edits=[],c=new s.Controller({onFieldChange:event=>edits.push(event),validationMessage:()=> '请填写联系人'});
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:[
  {id:'root',component:'OpenUiForm',name:'booking',children:['name']},
  {id:'name',component:'OpenUiInput',field:'contact',label:'联系人',required:true}
 ]});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],id=manager.nodes.find(node=>node.component==='OpenUiInput').id,element=s.hybridViews.get(id),revision=c.getSurface('s').revision;
 assert.equal(c.validateForm('s','booking'),false);assert.equal(element.fieldError,'请填写联系人','the host localized validation text is displayed verbatim');assert.equal(s.managers.length,1,'validation must not recreate the control or blur the keyboard');
 for(const value of ['L','Li','Lin'])element.edit(value);
 assert.equal(element.stringValue,'Lin');assert.equal(element.fieldError,'');assert.equal(c.getSurface('s').revision,revision);assert.equal(c.getFormValues('s','booking').contact,'Lin');assert.equal(s.managers.length,1);assert.equal(edits.length,3);assert.equal(edits[2].sourceComponentId,'name');
 const updates=element.updates;element.edit('Lin');assert.equal(element.updates,updates,'a native same-value echo does not rewrite the editor');
 c.apply({kind:'components',surfaceId:'s',components:[{id:'name',component:'OpenUiInput',field:'contact',label:'New label',required:true}]});assert.equal(s.managers.length,2);assert.equal(manager.disposed,true);element.edit('stale');assert.equal(c.getFormValues('s','booking').contact,'Lin');
 view.aboutToDisappear();
});

test('sparse native field maps never inherit Object prototype names as values or errors',()=>{
 const s=fixture(),m=new s.Manager(),ids=new s.NativeIds([{id:'toString',component:'OpenUiInput'}]);
 const owner=new s.NativeSession(m,'s',s.Themes.create(),false,'',new Map(),{},ids,undefined,320,undefined,{fieldValuesJson:'{}',fieldErrorsJson:'{}'});
 const native=s.factories.get('OpenUiInput')('s',ids.nativeId('toString'),'OpenUiInput',0n,0);native.updateProperties({label:'Safe value',value:'Default'});
 assert.equal(native.stringValue,'Default');assert.equal(native.fieldError,'');owner.syncFields({fieldValuesJson:JSON.stringify({toString:'Edited'}),fieldErrorsJson:JSON.stringify({toString:'Host message'})});assert.equal(native.stringValue,'Edited');assert.equal(native.fieldError,'Host message');owner.dispose();
});

test('native picker edits publish immediately without echoing selected values into the active event stack',()=>{
 const s=fixture(),c=new s.Controller();c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:[
  {id:'root',component:'OpenUiForm',name:'trip',children:['time']},{id:'time',component:'OpenUiTimePicker',field:'time',label:'Departure',value:'08:00'}]});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],id=manager.nodes.find(node=>node.component==='OpenUiTimePicker').id,native=s.hybridViews.get(id);
 let inNativeCallback=true,redraws=0;native.updateArkUI=()=>{assert.equal(inNativeCallback,false,'reentering the active native TimePicker callback can invalidate its wheel nodes');redraws++};
 native.edit('09:00');native.edit('09:01');assert.equal(c.getFormValues('s','trip').time,'09:01','submitting in this turn reads the latest value');assert.equal(native.stringValue,'09:01');assert.equal(redraws,0);assert.equal(s.timers.size,0,'ordinary native value echoes require no redraw at all');
 inNativeCallback=false;c.setFieldValue('s','time','10:30');assert.equal(redraws,1,'a real host change still updates the controlled picker');assert.equal(s.managers.length,1);view.aboutToDisappear();
});

test('validation or host correction during a native edit is deferred, coalesced, and canceled on disposal',()=>{
 const s=fixture();let c; c=new s.Controller({onFieldChange:event=>{if(event.value==='09:01'){c.setFieldValue('s','time','10:30');c.setFieldValue('s','time','11:45')}}});
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:[
  {id:'root',component:'OpenUiForm',name:'trip',children:['time']},{id:'time',component:'OpenUiTimePicker',field:'time',label:'Departure',value:'08:00'}]});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],id=manager.nodes.find(node=>node.component==='OpenUiTimePicker').id,native=s.hybridViews.get(id);
 let active=true,redraws=0;native.updateArkUI=()=>{assert.equal(active,false);redraws++};native.edit('09:01');assert.equal(c.getFormValues('s','trip').time,'11:45');assert.equal(native.stringValue,'11:45');assert.equal(redraws,0);assert.equal(s.timers.size,1);
 active=false;s.flushTimers();assert.equal(redraws,1,'only the final correction is rendered after native callback return');
 active=true;native.edit('09:01');assert.equal(s.timers.size,1);view.aboutToDisappear();assert.equal(s.timers.size,0);active=false;s.flushTimers();assert.equal(redraws,1,'queued correction cannot touch a freed native pointer');
});

test('picker adapters retain stable Date objects for native echoes and apply genuine external changes',()=>{
 const s=fixture(),time=new s.Controls();time.kind='OpenUiTimePicker';time.stringValue='08:00';time.aboutToAppear();const initial=time.selectedTime,values=[];
 let revision=0;time.onString=value=>{values.push(value);time.stringValue=value;time.controlState=JSON.stringify({value,revision:++revision});time.receivedControl()};
 time.changedTime({hour:9,minute:0});time.changedTime({minute:1});assert.deepEqual(values,['09:00','09:01']);assert.equal(time.selectedTime,initial,'native echo must not reset selected/new Date while a wheel animates');
 time.stringValue='10:30';time.controlState=JSON.stringify({value:'10:30',revision:++revision});time.receivedControl();assert.notEqual(time.selectedTime,initial);assert.equal(time.selectedTime.getHours(),10);assert.equal(time.selectedTime.getMinutes(),30);
 const date=new s.Controls();date.kind='OpenUiDatePicker';date.stringValue='2026-10-23';date.aboutToAppear();const original=date.selectedDate;
 date.onString=value=>{date.stringValue=value;date.controlState=JSON.stringify({value,revision:++revision});date.receivedControl()};date.changedDate(new Date(2026,9,24,12));assert.equal(date.stringValue,'2026-10-24');assert.equal(date.selectedDate,original);
 date.stringValue='2026-11-01';date.controlState=JSON.stringify({value:'2026-11-01',revision:++revision});date.receivedControl();assert.notEqual(date.selectedDate,original);assert.equal(date.selectedDate.getMonth(),10);assert.equal(date.selectedDate.getDate(),1);
});

test('native slider labels and blank picker hints refresh after the callback without remounting',()=>{
 const s=fixture(),c=new s.Controller();c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:[
  {id:'root',component:'OpenUiForm',name:'trip',children:['budget','time']},{id:'budget',component:'OpenUiSlider',field:'budget',label:'Budget',value:500,min:100,max:1000,step:50},
  {id:'time',component:'OpenUiTimePicker',field:'time',label:'Time'}]});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],find=kind=>s.hybridViews.get(manager.nodes.find(node=>node.component===kind).id),slider=find('OpenUiSlider'),time=find('OpenUiTimePicker');
 let active=true;slider.updateArkUI=()=>{assert.equal(active,false);slider.drawnNumber=slider.numberValue};time.updateArkUI=()=>{assert.equal(active,false);time.drawnText=time.stringValue};
 slider.edit(550);slider.edit(600);time.edit('09:00');assert.equal(c.getFormValues('s','trip').budget,600);assert.equal(c.getFormValues('s','trip').time,'09:00');assert.equal(slider.drawnNumber,undefined);assert.equal(time.drawnText,undefined);
 active=false;s.flushTimers();assert.equal(slider.drawnNumber,600);assert.equal(time.drawnText,'09:00');assert.equal(s.managers.length,1);view.aboutToDisappear();
});

test('atomic picker state applies a host rollback even when its value matches the previous rendered prop',()=>{
 const s=fixture(),time=new s.Controls();time.kind='OpenUiTimePicker';time.stringValue='08:00';time.aboutToAppear();const original=time.selectedTime;
 time.onString=()=>{};time.changedTime({hour:9,minute:1});assert.equal(time.stringValue,'08:00','no native echo redraw has occurred yet');assert.equal(time.nativeValue,'09:01');
 time.controlState=JSON.stringify({value:'08:00',revision:12});time.receivedControl();assert.notEqual(time.selectedTime,original,'a real host rollback needs a new selected Date even though the old prop text is unchanged');assert.equal(time.selectedTime.getHours(),8);assert.equal(time.selectedTime.getMinutes(),0);assert.equal(time.nativeValue,'08:00');
 const rolledBack=time.selectedTime;time.controlState=JSON.stringify({value:'08:00',revision:13});time.receivedControl();assert.equal(time.selectedTime,rolledBack,'unrelated revisions with the same current native value do not reset an active picker');
});

test('atomic controlled state rolls back strings, booleans and slider numbers to their original rendered values',()=>{
 const s=fixture();for(const [kind,initial,edited,key,change] of [
  ['OpenUiInput','Initial','Edited','liveStringValue','changedString'],['OpenUiSelect','first','second','liveStringValue','changedString'],
  ['OpenUiCheckbox',false,true,'liveBoolValue','changedBoolean'],['OpenUiToggle',true,false,'liveBoolValue','changedBoolean'],
  ['OpenUiSlider',500,800,'liveNumberValue','changedNumber']]){
  const control=new s.Controls();control.kind=kind;control.stringValue=typeof initial==='string'?initial:'';control.numberValue=typeof initial==='number'?initial:0;control.boolValue=initial===true;control.aboutToAppear();
  control[change](edited);assert.equal(control[key],edited,'the native selection is tracked locally without a Surface remount');
  control.controlState=JSON.stringify({value:initial,revision:22});control.receivedControl();assert.equal(control[key],initial,kind+' rollback must be visible even if the old parent prop value never changed');assert.equal(control.nativeValue,initial);
 }
});

test('generic mapped Image uses the pinned native Image and Yoga aspect ratio without a hybrid image widget',()=>{
 const s=fixture(),surface={id:'s',catalogId:'test',revision:1,readOnly:false,selectedComponent:'',dataModelJson:'{}',fieldValuesJson:'{}',fieldErrorsJson:'{}',components:[
  {id:'root',component:'Column',children:['cover']},{id:'cover',component:'Image',source:'https://example.com/cover.png',alt:'A cover',aspectRatio:2}
 ]};
 const ids=new s.NativeIds(surface.components),node=s.Projection.nativeComponents(surface,s.Themes.create(),ids,310).find(n=>n.component==='Image');
 assert.equal(node.url,'https://example.com/cover.png');assert.equal(node.source,undefined);assert.equal(node.fit,'cover');assert.equal(node.styles.width,'100%');assert.equal(node.styles['aspect-ratio'],'2');assert.equal(node.accessibility.label,'A cover');assert.deepEqual(Array.from(ids.semanticIds()),[]);
});

test('mapped filter patches retain the manager, field identity and current-revision action routing',()=>{
 const s=fixture(),actions=[],options=[{label:'All',value:'all'},{label:'Train',value:'train'}];let c;
 const nodes=value=>[
  {id:'root',component:'Column',children:['filter','count','result']},
  {id:'filter',component:'OpenUiSelect',field:'mode',label:'Filter',options,value},
  {id:'count',component:'Text',text:value==='all'?'2 results':'1 result'},
  {id:'result',component:'Button',child:'label',action:{event:{name:'choose',context:{productId:'train-42'}}}},
  {id:'label',component:'Text',text:'View train'}
 ];
 c=new s.Controller({onAction:e=>actions.push(e),onFieldChange:e=>c.apply({kind:'patch',surfaceId:'s',components:nodes(e.value),syncFieldValues:true})});
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:nodes('all')});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],initialRevision=c.getSurface('s').revision,epoch=view.epoch;
 const filter=manager.nodes.find(n=>n.component==='OpenUiSelect'),native=s.hybridViews.get(filter.id);native.focusMarker={cursor:7};
 native.edit('train');assert.equal(c.getSurface('s').revision,initialRevision+1);s.flushTimers();assert.equal(s.managers.length,1);assert.equal(view.epoch,epoch);assert.equal(view.nativeSession.ids.nativeId('filter'),filter.id);assert.equal(s.hybridViews.get(filter.id),native);assert.equal(native.focusMarker.cursor,7);assert.equal(native.stringValue,'train');
 assert.deepEqual(Array.from(manager.patches.at(-1),n=>n.component),['Text'],'only result count changes; native Select does not reenter its active onChange stack');
 const button=view.nativeSession.ids.nativeId('result');manager.listener.onReceiveActionEvent(JSON.stringify({version:'v0.9',action:{surfaceId:'s',sourceComponentId:button,name:'choose',context:{productId:'train-42'}}}));
 assert.equal(actions.length,1);assert.equal(actions[0].revision,c.getSurface('s').revision);assert.equal(actions[0].sourceComponentId,'result');assert.equal(actions[0].context.productId,'train-42');
 native.edit('all');s.flushTimers();assert.equal(s.managers.length,1);assert.equal(native.stringValue,'all');assert.equal(c.getSurface('s').components.find(n=>n.id==='count').text,'2 results');view.aboutToDisappear();
});

test('mapped typing coalesces dynamic control props after native onChange without replacing the editor',()=>{
 const s=fixture();let c;
 const nodes=(value,label)=>[
  {id:'root',component:'Column',children:['name','summary']},
  {id:'name',component:'OpenUiInput',field:'name',label,placeholder:label,value},
  {id:'summary',component:'Text',text:value||'Empty'}
 ];
 c=new s.Controller({onFieldChange:e=>{
  c.apply({kind:'patch',surfaceId:'s',components:nodes(e.value,'Intermediate'),syncFieldValues:true});
  c.apply({kind:'patch',surfaceId:'s',components:nodes(e.value,'Final label'),syncFieldValues:true});
 }});
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:nodes('','Initial')});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],id=view.nativeSession.ids.nativeId('name'),native=s.hybridViews.get(id),epoch=view.epoch;
 native.focusMarker={selectionStart:2,keyboard:'open'};
 let active=false;const receive=manager.receiveTextChunk.bind(manager);
 manager.receiveTextChunk=text=>{assert.equal(active,false,'native parser cannot reenter an active control callback');receive(text)};
 for(const value of ['L','Li','Lin']){
  const before=manager.patches.length;active=true;native.edit(value);
  assert.equal(manager.patches.length,before,'even dynamic placeholder changes wait until callback return');
  assert.equal(c.getSurface('s').components.find(n=>n.id==='name').value,value,'controller state is already authoritative');
  assert.equal(native.stringValue,value);assert.equal(s.timers.size,1,'multiple mapped evaluations share one refresh');
  active=false;s.flushTimers();
  assert.equal(s.managers.length,1);assert.equal(view.epoch,epoch);assert.equal(s.hybridViews.get(id),native);
  assert.equal(native.controlLabel,'Final label');assert.equal(native.placeholder,'Final label');
  assert.deepEqual(native.focusMarker,{selectionStart:2,keyboard:'open'});
  assert.equal(view.nativeSession.documentRevision,c.getSurface('s').revision);
 }
 assert.equal(native.stringValue,'Lin');view.aboutToDisappear();
});

test('a host replacement requested from native onChange waits before destroying that callback owner',()=>{
 const s=fixture();let c;
 c=new s.Controller({onFieldChange:e=>{if(typeof e.value==='string')c.apply({kind:'components',surfaceId:'s',replace:true,components:[
  {id:'root',component:'Column',children:['field']},{id:'field',component:'OpenUiCheckbox',field:'checked',label:'New control',value:false}
 ]})}});
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:[
  {id:'root',component:'Column',children:['field']},{id:'field',component:'OpenUiInput',field:'name',label:'Name'}
 ]});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],old=s.hybridViews.get(view.nativeSession.ids.nativeId('field'));
 let active=true;const destroy=manager.destroy.bind(manager);manager.destroy=()=>{assert.equal(active,false);destroy()};
 old.edit('Replace');assert.equal(manager.disposed,false);assert.equal(s.managers.length,1);assert.equal(s.timers.size,1);
 active=false;s.flushTimers();assert.equal(manager.disposed,true);assert.equal(s.managers.length,2);
 const replacement=s.hybridViews.get(view.nativeSession.ids.nativeId('field'));assert.equal(replacement.getComponentType(),'OpenUiCheckbox');
 old.edit('stale');assert.equal(c.getSurface('s').fieldValuesJson,'{}');replacement.edit(true);
 assert.equal(JSON.parse(c.getSurface('s').fieldValuesJson).field,true);view.aboutToDisappear();
});

test('disposing a view cancels a deferred native-edit refresh and fences an already queued callback',()=>{
 const s=fixture();let c;
 c=new s.Controller({onFieldChange:e=>c.apply({kind:'patch',surfaceId:'s',syncFieldValues:true,components:[
  {id:'root',component:'Column',children:['field']},{id:'field',component:'OpenUiInput',field:'name',label:'Updated',value:e.value}
 ]})});
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'components',surfaceId:'s',components:[
  {id:'root',component:'Column',children:['field']},{id:'field',component:'OpenUiInput',field:'name',label:'Name'}
 ]});
 const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],native=s.hybridViews.get(view.nativeSession.ids.nativeId('field'));
 native.edit('Lin');assert.equal(s.timers.size,1);const queued=Array.from(s.timers.values())[0],patches=manager.patches.length;
 view.aboutToDisappear();assert.equal(s.timers.size,0);assert.equal(manager.disposed,true);
 queued();s.flushTimers();assert.equal(s.managers.length,1);assert.equal(manager.patches.length,patches);assert.equal(view.nativeSession,undefined);
});

test('filtered-out nodes lose callbacks and queued measurements, and returning nodes get fresh native identities',()=>{
 const s=fixture(),c=new s.Controller(),base=[{id:'root',component:'Column',children:['item']},{id:'item',component:'OpenUiOption',title:'Old item',action:{event:{name:'pick',context:{id:'old'}}}}];
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:base});const view=new s.View();view.controller=c;mount(view);
 const manager=s.managers[0],oldId=view.nativeSession.ids.nativeId('item'),old=s.hybridViews.get(oldId);let closed=0;old.setModalCloser(()=>closed++);old.scheduleSize({width:310,height:100});assert.equal(s.timers.size,1);
 c.apply({kind:'patch',surfaceId:'s',components:[{id:'root',component:'Column',children:[]}]});assert.equal(s.managers.length,1);assert.equal(view.nativeSession.ids.sourceId(oldId),undefined);assert.equal(s.timers.size,0);assert.equal(closed,1);
 old.activate();old.scheduleSize({width:310,height:180});old.sizeChanged({width:310,height:180});s.flushTimers();assert.equal(s.events.length,0);assert.equal(s.sizes.length,0,'an old native pointer cannot receive a late layout report');
 c.apply({kind:'patch',surfaceId:'s',components:base.map(n=>({...n,title:n.id==='item'?'New item':undefined}))});const nextId=view.nativeSession.ids.nativeId('item'),next=s.hybridViews.get(nextId);
 assert.notEqual(nextId,oldId);assert.equal(next.heading,'New item');next.activate();assert.equal(s.events.length,1);assert.equal(s.events[0].nodeId,nextId);assert.equal(manager.disposed,false);view.aboutToDisappear();
});

test('same-ID native property patches reset omitted optional values and preserve unrelated measured leaves',()=>{
 const s=fixture(),c=new s.Controller(),nodes=text=>[{id:'root',component:'Column',children:['details','keep']},{id:'details',component:'OpenUiOption',title:'Details',...(text?{description:text}: {}),action:{event:{name:'pick',context:{id:'one'}}}},{id:'keep',component:'OpenUiStatus',text:'Stable'}];
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:nodes('Old body')});const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],detailId=view.nativeSession.ids.nativeId('details'),keepId=view.nativeSession.ids.nativeId('keep'),detail=s.hybridViews.get(detailId),keep=s.hybridViews.get(keepId);
 detail.sizeChanged({width:310,height:100});keep.sizeChanged({width:310,height:60});view.laidOut(view.epoch,{width:310,height:200});assert.equal(c.getSurface('s').renderStatus,'rendered');
 c.apply({kind:'patch',surfaceId:'s',components:nodes('')});assert.equal(s.managers.length,1);assert.equal(detail.supporting,'');assert.equal(s.hybridViews.get(keepId),keep);assert.equal(c.getSurface('s').renderStatus,'pending');assert.equal(manager.patches.at(-1).length,1);
 detail.sizeChanged({width:310,height:100});assert.equal(c.getSurface('s').renderStatus,'rendered','same-size changed content still acknowledges its new measurement');view.aboutToDisappear();
});

test('a patch rejects prior business context while retaining the same native button identity',()=>{
 const s=fixture(),actions=[],c=new s.Controller({onAction:e=>actions.push(e)}),nodes=id=>[{id:'root',component:'Button',child:'label',action:{event:{name:'choose',context:{id}}}},{id:'label',component:'Text',text:'Choose'}];
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:nodes('a')});const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],id=view.nativeSession.ids.nativeId('root');
 c.apply({kind:'patch',surfaceId:'s',components:nodes('b')});assert.equal(s.managers.length,1);assert.equal(view.nativeSession.ids.nativeId('root'),id);
 const emit=value=>manager.listener.onReceiveActionEvent(JSON.stringify({version:'v0.9',action:{surfaceId:'s',sourceComponentId:id,name:'choose',context:{id:value}}}));emit('a');assert.equal(actions.length,0);emit('b');assert.equal(actions.length,1);assert.equal(actions[0].context.id,'b');view.aboutToDisappear();
});

test('mapped patches preserve namespace isolation and fall back to replace after a field kind change',()=>{
 const s=fixture(),a=new s.Controller(),b=new s.Controller(),nodes=kind=>[{id:'root',component:'Column',children:['field']},{id:'field',component:kind,field:'value',label:'Value'}];
 for(const c of [a,b]){c.apply({kind:'create',surfaceId:'same'});c.apply({kind:'patch',surfaceId:'same',components:nodes('OpenUiInput')})}
 const va=new s.View(),vb=new s.View();va.controller=a;vb.controller=b;va.surfaceId=vb.surfaceId='same';mount(va);mount(vb);const originalA=va.nativeSession.ids.nativeId('field'),originalB=vb.nativeSession.ids.nativeId('field'),mb=s.managers[1],fieldB=s.hybridViews.get(originalB);
 a.apply({kind:'patch',surfaceId:'same',components:nodes('OpenUiSelect').map(n=>n.id==='field'?{...n,options:[{label:'One',value:'one'}]}:n)});
 assert.equal(s.managers.length,3);assert.equal(s.managers[0].disposed,true);assert.equal(mb.disposed,false);assert.equal(s.hybridViews.get(originalB),fieldB);assert.notEqual(va.nativeSession.ids.nativeId('field'),originalA);fieldB.edit('Still active');assert.equal(b.getSurface('same').fieldValuesJson,JSON.stringify({field:'Still active'}));va.aboutToDisappear();vb.aboutToDisappear();
});

test('retained but unreachable definitions cannot reactivate their former native callbacks',()=>{
 const s=fixture(),c=new s.Controller(),field={id:'field',component:'OpenUiInput',field:'name',label:'Name'},nodes=visible=>[{id:'root',component:'Column',children:visible?['field']:[]},field];
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:nodes(true)});const view=new s.View();view.controller=c;mount(view);const oldId=view.nativeSession.ids.nativeId('field'),old=s.hybridViews.get(oldId);
 c.apply({kind:'patch',surfaceId:'s',components:nodes(false)});const orphanId=view.nativeSession.ids.nativeId('field');assert.notEqual(orphanId,oldId);assert.equal(old.canEdit(),false);assert.equal(view.nativeSession.ids.sourceId(orphanId),undefined);old.edit('hidden');assert.equal(c.getSurface('s').fieldValuesJson,'{}');
 c.apply({kind:'patch',surfaceId:'s',components:nodes(true)});const currentId=view.nativeSession.ids.nativeId('field');assert.notEqual(currentId,orphanId);assert.notEqual(currentId,oldId);assert.equal(old.canEdit(),false);const current=s.hybridViews.get(currentId);current.edit('Current');assert.equal(c.getSurface('s').fieldValuesJson,JSON.stringify({field:'Current'}));view.aboutToDisappear();
});

test('long-lived mapped surfaces recycle the manager after bounded identity churn without resetting controller state',()=>{
 const s=fixture(),c=new s.Controller(),nodes=visible=>[
  {id:'root',component:'Column',children:visible?['field','item']:['field']},
  {id:'field',component:'OpenUiInput',field:'name',label:'Name'},
  ...(visible?[{id:'item',component:'Text',text:'Conditional result'}]:[])
 ];
 c.apply({kind:'create',surfaceId:'s'});c.apply({kind:'patch',surfaceId:'s',components:nodes(true)});const view=new s.View();view.controller=c;mount(view);const manager=s.managers[0],ids=view.nativeSession.ids;
 assert.equal(ids.allocatedCount(),3);c.setFieldValue('s','field','Retained');
 c.apply({kind:'patch',surfaceId:'s',components:nodes(false)});assert.equal(ids.allocatedCount(),3,'retirement does not reset the cumulative allocation counter');
 c.apply({kind:'patch',surfaceId:'s',components:nodes(true)});assert.equal(ids.allocatedCount(),4);assert.equal(s.managers.length,1);
 // Simulate the cumulative counter near the fixed production limit instead
 // of spending 1,020 equivalent native allocation cycles in a unit test.
 ids.serial=1023;c.apply({kind:'patch',surfaceId:'s',components:nodes(false)});assert.equal(s.managers.length,1);
 c.apply({kind:'patch',surfaceId:'s',components:nodes(true)});assert.equal(ids.allocatedCount(),1024);assert.equal(s.managers.length,1,'the patch reaching the budget completes on its current manager');
 c.apply({kind:'patch',surfaceId:'s',components:nodes(false)});assert.equal(s.managers.length,2);assert.equal(manager.disposed,true);assert.equal(view.nativeSession.ids.allocatedCount(),2,'fresh manager starts from the current bounded tree');
 assert.equal(c.getSurface('s').fieldValuesJson,JSON.stringify({field:'Retained'}));const field=s.hybridViews.get(view.nativeSession.ids.nativeId('field'));assert.equal(field.stringValue,'Retained');
 c.apply({kind:'patch',surfaceId:'s',components:nodes(true)});assert.equal(s.managers.length,2,'normal subsequent filtering resumes incremental updates');view.aboutToDisappear();
});
