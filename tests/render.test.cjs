// SPDX-License-Identifier: Apache-2.0
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {stripTypeScriptTypes}=require('node:module');
const path=require('node:path');
const root=path.join(__dirname,'../openui/src/main/ets/');
function fixture(){
 const read=name=>fs.readFileSync(root+name+'.ets','utf8');
 const native=read('render/OpenUiNative');
 const view=read('render/OpenUiView');
 const methods=view.slice(view.indexOf('  aboutToAppear():'),view.indexOf('  build() {'));
 const fakeView='class ViewFixture { controller: OpenUiController = new OpenUiController(); surfaceId:string="s"; theme:OpenUiTheme=OpenUiThemes.create(); nativeInstance:number=0;visibleEpoch:number=0;errorLabel:string="";observerId:number=-1;epoch:number=0;eventSerial:number=0;lifetime:string="fixture";fingerprint:string="";mountedSurface:string="";manager:SurfaceManager|undefined;nativeSession:OpenUiNativeSession|undefined;details:Map<string,boolean>=new Map();'+methods+'}';
 const sources=[read('core/OpenUiTypes'),read('core/OpenUiCatalog'),read('core/OpenUiController'),read('render/OpenUiTheme'),read('render/OpenUiProjection'),native.split('@Builder')[0],native.slice(native.indexOf('export class OpenUiNativeElement')),view.split('@Component')[0],fakeView];
 const text=sources.join('\n').replace(/^import[\s\S]*?;\r?\n/gm,'');
 const js=stripTypeScriptTypes(text).replace(/^export /gm,'');
 const factories=new Map(),events=[],sizes=[],managers=[];let serial=0;
 class NativeBase {
  constructor(surface,id,type,_ptr,_builder,instance){Object.assign(this,{surface,id,type,instance});}
  getSurfaceId(){return this.surface}getNodeId(){return this.id}getComponentType(){return this.type}getInstanceId(){return this.instance}
  updateProperties(props){this.onUpdateProperties(props)}updateArkUI(){}reportContentHeight(height,width){sizes.push({height,width})}
 }
 class Manager {
  constructor(){this.instance=++serial;this.disposed=false;managers.push(this)}getInstanceId(){return this.instance}
  getSurface(surfaceId){const instance=this.instance;return {getComponent(nodeId,type){return {triggerAction(){events.push({instance,surfaceId,nodeId,type})}}}}}
  addListener(listener){this.listener=listener}beginTextStream(){}endTextStream(){}destroy(){this.disposed=true}
  receiveTextChunk(text){this.payload=text;const id=JSON.parse(text.split('\n')[0]).createSurface.surfaceId;this.listener.onCreateSurface({surfaceId:id});}
 }
 const api=vm.runInNewContext(js+'\n({Controller:OpenUiController,Projection:OpenUiProjection,Themes:OpenUiThemes,NativeSession:OpenUiNativeSession,View:ViewFixture})',{Map,Set,JSON,Date,Math,SurfaceManager:Manager,A2UIComponent:NativeBase,AGenUI:{registerComponent(name,factory){factories.set(name,factory)}},wrapBuilder:()=>({}),openUiElement:()=>{},getContext:()=>({})});
 return {...api,factories,events,sizes,managers,Manager};
}
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
 const sa=new s.NativeSession(a,'same',light,false,'',new Map()),sb=new s.NativeSession(b,'same',dark,true,'',new Map());
 const create=(m,id)=>s.factories.get('OpenUiOption')('same',id,'OpenUiOption',0n,m.getInstanceId());const na=create(a,'a'),nb=create(b,'b');na.updateProperties({title:'A',selectable:true});nb.updateProperties({title:'B',selectable:true});
 assert.equal(na.skin().mode,'light');assert.equal(nb.skin().mode,'dark');na.activate();nb.activate();assert.equal(s.events.length,1);assert.equal(s.events[0].nodeId,'a');assert.equal(s.events[0].instance,a.getInstanceId());
 na.activate();assert.equal(s.events.length,2,'host owns repeat policy; renderer does not lock after ordinary selection');sa.dispose();na.activate();assert.equal(s.events.length,2);sb.dispose();
});
test('native details retain explicit expanded state and measurement ignores duplicate and zero reports',()=>{
 const s=fixture(),m=new s.Manager(),state=new Map(),owner=new s.NativeSession(m,'s',s.Themes.create(),false,'',state);const create=()=>s.factories.get('OpenUiDetails')('s','details','OpenUiDetails',0n,m.getInstanceId());const a=create();a.updateProperties({title:'More',text:'Facts'});a.toggle();assert.equal(a.isExpanded(),true);
 a.sizeChanged({width:320,height:44});a.sizeChanged({width:320,height:44});a.sizeChanged({width:320,height:0});a.sizeChanged({width:320,height:100});assert.equal(s.sizes.length,2);owner.dispose();new s.NativeSession(m,'s',s.Themes.create('dark'),true,'',state);assert.equal(create().isExpanded(),true);
});
test('rendered status waits for positive native layout and status notifications do not remount',()=>{
 const s=fixture(),c=seed(s.Controller),view=new s.View();view.controller=c;view.aboutToAppear();assert.equal(s.managers.length,1);assert.equal(c.getSurface('s').renderStatus,'pending');
 view.laidOut(view.epoch,{width:320,height:0});assert.equal(c.getSurface('s').renderStatus,'pending');view.laidOut(view.epoch,{width:320,height:130});assert.equal(c.getSurface('s').renderStatus,'rendered');assert.equal(s.managers.length,1);view.aboutToDisappear();assert.equal(s.managers[0].disposed,true);
});
test('old native callbacks and wrong-surface callbacks cannot act after an incremental revision',()=>{
 const s=fixture(),accepted=[],c=seed(s.Controller,'s',event=>accepted.push(event)),view=new s.View();view.controller=c;view.aboutToAppear();const old=s.managers[0];c.apply({kind:'data',surfaceId:'s',path:'/price',valueJson:'65'});assert.equal(s.managers.length,2);assert.equal(old.disposed,true);
 const raw=surfaceId=>JSON.stringify({version:'v0.9',action:{surfaceId,sourceComponentId:'option',name:'pick',context:{value:'a'}}});old.listener.onReceiveActionEvent(raw('s'));assert.equal(accepted.length,0);s.managers[1].listener.onReceiveActionEvent(raw('other'));assert.equal(accepted.length,0);s.managers[1].listener.onReceiveActionEvent(raw('s'));assert.equal(accepted.length,1);view.aboutToDisappear();
});
