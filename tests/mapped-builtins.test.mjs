// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes,createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
// Exercise the executable adapter against the actual official package before
// build:lang. Other runtime tests also cover the generated distribution bundle.
import {createMappedSession,getMappedSystemPrompt,getMappedLibrarySchema,getMappedSupportManifest} from '../tools/lang/mapped-runtime-entry.mjs';

const read=value=>JSON.parse(value);
const text=result=>result.components.filter(node=>node.component==='Text').map(node=>node.text);
const data='items=[{id:"a",title:"Lake",kind:"park",rank:12},{id:"b",title:"Museum",kind:"museum",rank:"2"},{id:"c",title:"Trail",kind:"park",rank:3}]';
const program=`$kind="all"
$order="asc"
${data}
filtered=$kind=="all"?items:@Filter(items,"kind","==",$kind)
ordered=@Sort(filtered,"rank",$order)
rows=@Each(ordered,"item",Card([TextContent(item.title),Button("Pick "+item.title,@ToAssistant("Pick "+item.title,{itemId:item.id,rank:item.rank,kind:$kind,order:$order}))]))
root=Stack([Select("kind",[SelectItem("all","All"),SelectItem("park","Park"),SelectItem("museum","Museum")],"Kind",null,$kind),Select("order",[SelectItem("asc","Ascending"),SelectItem("desc","Descending")],"Order",null,$order),TextContent("Count "+@Count(filtered)),rows,TextContent("Original "+items[0].id)])`;
const binding=(result,name)=>result.bindings.find(field=>field.name===name).componentId;
const button=(result,caption)=>result.components.find(node=>node.component==='Button'&&result.components.some(child=>child.id===node.child&&child.text===caption));
const pickOrder=result=>result.components.filter(node=>node.component==='Button').map(node=>result.components.find(child=>child.id===node.child).text);
function wrapper(options={}){
  const code=['core/OpenUiTypes','core/OpenUiCatalog','core/OpenUiController','lang/OpenUiMappedRuntime'].map(name=>stripTypeScriptTypes(
    fs.readFileSync(new URL('../openui/src/main/ets/'+name+'.ets',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),{mode:'transform'}).replace(/^export /gm,'')).join('\n');
  const Runtime=vm.runInNewContext(code+'\nOpenUiMappedRuntime',{JSON,Map,Set,Date,Math,Object,Array,Number,
    createMappedSession,getMappedSystemPrompt,getMappedLibrarySchema,getMappedSupportManifest});
  return new Runtime('builtins',options);
}
function renderHarness(){
  // Reuse the existing host-native test fixture rather than inventing another
  // event bridge. It loads the real View, native ID mapping and projection.
  const source=fs.readFileSync(new URL('./render.test.cjs',import.meta.url),'utf8');
  const end=source.indexOf("\ntest('projection resolves live data");assert.ok(end>0);
  return vm.runInNewContext(source.slice(0,end)+'\n({fixture,mount})',{
    require:createRequire(new URL('./render.test.cjs',import.meta.url)),__dirname:fileURLToPath(new URL('.',import.meta.url))});
}

test('official Each arrays project directly and inside mixed ordinary Stack children',()=>{
  for(const body of ['Stack(@Each(items,"item",TextContent(item.title)))',
    'Stack([TextContent("Header"),@Each(items,item,TextContent(item.title)),TextContent("Footer")])']){
    const session=createMappedSession(),result=read(session.replace(data+'\nroot='+body));
    assert.deepEqual(text(result),body.includes('Header')?['Header','Lake','Museum','Trail','Footer']:['Lake','Museum','Trail']);
    assert.equal(new Set(result.components.map(node=>node.id)).size,result.components.length);
  }
});

test('official Filter, Sort and Count combine with local state without replacing the program or mutating the data',()=>{
  const session=createMappedSession();let result=read(session.replace(program));
  assert.deepEqual(pickOrder(result),['Pick Museum','Pick Trail','Pick Lake']);
  assert.ok(text(result).includes('Count 3'));assert.ok(text(result).includes('Original a'));
  result=read(session.setField(binding(result,'kind'),'"park"'));
  assert.deepEqual(pickOrder(result),['Pick Trail','Pick Lake']);assert.ok(text(result).includes('Count 2'));
  result=read(session.setField(binding(result,'order'),'"desc"'));
  assert.deepEqual(pickOrder(result),['Pick Lake','Pick Trail']);assert.ok(text(result).includes('Original a'));
  assert.equal(result.stats.replacements,1);assert.equal(result.stats.stateUpdates,2);
  const chosen=read(session.dispatchAction(button(result,'Pick Trail').id));
  assert.deepEqual(chosen.actions,[{name:'continue_conversation',context:{message:'Pick Trail',context:{itemId:'c',rank:3,kind:'park',order:'desc'}}}]);
});

test('pinned official collection signatures retain dot paths, operators, numeric strings and default ascending order',()=>{
  const cases=[
    ['@Filter(items,"kind","==","park")',['Lake','Trail']],
    ['@Filter(items,"kind","!=","park")',['Museum']],
    ['@Filter(items,"rank",">",3)',['Lake']],
    ['@Filter(items,"rank",">=",3)',['Lake','Trail']],
    ['@Filter(items,"rank","<",3)',['Museum']],
    ['@Filter(items,"rank","<=",3)',['Museum','Trail']],
    ['@Filter(items,"title","contains","um")',['Museum']],
    ['@Sort(items,"rank")',['Museum','Trail','Lake']],
    ['@Sort(items,"rank","desc")',['Lake','Trail','Museum']],
    ['@Sort(items,"title","asc")',['Lake','Museum','Trail']]
  ];
  for(const [expression,expected]of cases){
    const result=read(createMappedSession().replace(data+'\nroot=Stack(@Each('+expression+',"item",TextContent(item.title)))'));
    assert.deepEqual(text(result),expected,expression);
  }
  const dotted=read(createMappedSession().replace('items=[{id:"a",meta:{minutes:30}},{id:"b",meta:{minutes:10}}]\nroot=Stack(@Each(@Sort(@Filter(items,"meta.minutes",">",5),"meta.minutes","desc"),"item",TextContent(item.id)))'));
  assert.deepEqual(text(dotted),['a','b']);
  const empty=read(createMappedSession().replace(data+'\nfiltered=@Filter(items,"kind","==","none")\nroot=Stack([TextContent("Count "+@Count(filtered)),@Each(filtered,"item",TextContent(item.title)),@Count(filtered)==0?TextContent("Empty"):null])'));
  assert.deepEqual(text(empty),['Count 0','Empty']);
});

test('real ETS wrapper rejects stale events after filter and sort while current buttons carry their own item context',()=>{
  const actions=[],errors=[],runtime=wrapper({onAction:event=>actions.push(event),onError:error=>errors.push(error)});
  const initial=runtime.replace(program),before=runtime.controller.getSurface('builtins'),oldButton=button(before,'Pick Museum');
  const oldEvent={surfaceId:'builtins',sourceComponentId:oldButton.id,...oldButton.action.event};
  assert.equal(runtime.controller.setFieldValue('builtins',binding(initial,'kind'),'park',before.revision),true);
  let current=runtime.controller.getSurface('builtins');
  assert.equal(runtime.controller.setFieldValue('builtins',binding(initial,'order'),'desc',current.revision),true);
  current=runtime.controller.getSurface('builtins');assert.equal(current.updateMode,'patch');
  assert.equal(runtime.controller.dispatchAction(oldEvent,before.revision,'old-row'),false);
  assert.equal(runtime.controller.dispatchAction(oldEvent,current.revision,'old-context-new-revision'),false,
    'a retained positional slot must not lend its latest business plan to an old payload');
  assert.equal(actions.length,0);
  for(const [caption,itemId]of [['Pick Lake','a'],['Pick Trail','c']]){
    current=runtime.controller.getSurface('builtins');const node=button(current,caption);
    assert.equal(runtime.controller.dispatchAction({surfaceId:'builtins',sourceComponentId:node.id,...node.action.event},current.revision,'current-'+itemId),true);
    assert.equal(actions.at(-1).context.context.itemId,itemId);assert.equal(actions.at(-1).context.context.order,'desc');
  }
  assert.deepEqual(errors,[]);assert.equal(runtime.getStats().replacements,1);
  runtime.dispose();
});

test('the actual View raw-event path preserves plan context and rejects an old reordered item even at its current revision',()=>{
  const actions=[],runtime=wrapper({onAction:event=>actions.push(event)}),initial=runtime.replace(program);
  const harness=renderHarness(),native=harness.fixture(),view=new native.View();
  view.controller=runtime.controller;view.surfaceId='builtins';harness.mount(view);
  const manager=native.managers[0],oldSurface=runtime.controller.getSurface('builtins'),old=button(oldSurface,'Pick Museum');
  const nativeId=view.nativeSession.ids.nativeId(old.id),prior=manager.nodes.find(node=>node.id===nativeId);
  const raw=node=>JSON.stringify({version:'v0.9',action:{surfaceId:'builtins',sourceComponentId:node.id,...node.action.event}});
  const stale=raw(prior);assert.ok(prior.action.event.context.plan.includes('"itemId":"b"'));
  assert.equal(runtime.controller.setFieldValue('builtins',binding(initial,'order'),'desc',oldSurface.revision),true);
  const currentSurface=runtime.controller.getSurface('builtins'),current=button(currentSurface,'Pick Lake');
  assert.equal(view.nativeSession.ids.nativeId(current.id),nativeId,'the same native slot now displays another business item');
  manager.listener.onReceiveActionEvent(stale);
  assert.equal(actions.length,0,'the real listener retains old raw context while using the current native revision');
  const updated=manager.nodes.find(node=>node.id===nativeId);assert.ok(updated.action.event.context.plan.includes('"itemId":"a"'));
  manager.listener.onReceiveActionEvent(raw(updated));
  assert.equal(actions.length,1);assert.equal(actions[0].context.context.itemId,'a');
  view.aboutToDisappear();runtime.dispose();
});

test('repeated fields and forms are explicitly unsupported even through references or data arrays',()=>{
  const invalid=[
    data+'\nroot=Stack(@Each(items,"item",Input(item.id)))',
    data+'\nroot=Stack([@Each(items,"item",Card([Input(item.id)]))])',
    data+'\nfield=Input("name")\nroot=Stack(@Each(items,"item",field))',
    'fields=[Input("name")]\nroot=Stack(@Each(fields,"field",field))',
    data+'\nroot=Stack(@Each(items,"item",Form(item.id,Buttons([Button("Go")]),[])))',
    data+'\nroot=Stack(@Each(items,"item",CheckBoxGroup(item.id,[CheckBoxItem("Check","","checked")])))',
    'root=Stack([[Input("name")]])'
  ];
  for(const source of invalid)assert.throws(()=>createMappedSession().replace(source),/REPEATED_FIELD_UNSUPPORTED/);
  const ordinary=read(createMappedSession().replace('root=Stack([Form("form",Buttons([Button("Go",@ToAssistant("Go"))]),[FormControl("Name",Input("name"))])])'));
  assert.ok(ordinary.components.some(node=>node.component==='OpenUiInput'),'an ordinary Stack children array still supports forms');
});

test('bounded collection support rejects nested Each and excessive arrays before committing a new program',()=>{
  const session=createMappedSession();session.replace(program);const prior=session.stateSnapshotJson();
  const invalid=[
    [data+'\nroot=Stack(@Each(items,"item",Stack(@Each(items,"other",TextContent(other.title)))))',/NESTED_EACH_UNSUPPORTED/],
    [data+'\ninner=@Each(items,"other",TextContent(other.title))\nroot=Stack(@Each(items,"item",Stack(inner)))',/NESTED_EACH_UNSUPPORTED/],
    ['items=['+Array.from({length:201},(_,i)=>i).join(',')+']\nroot=Stack([TextContent("Too many data items")])',/ARRAY_LIMIT/],
    ['root=Stack(['.repeat(1)+'['.repeat(9)+'TextContent("deep")'+']'.repeat(9)+'])',/ARRAY_DEPTH/],
    ['root=Stack(['+Array.from({length:200},()=> '[[],[],[],[],[],[]]').join(',')+'])',/ARRAY_BUDGET/],
    ['items=['+Array.from({length:200},(_,i)=>i).join(',')+']\nroot=Stack(@Each(items,"item",TextContent(""+item)))',/TREE_LIMIT_OR_DUPLICATE/]
  ];
  for(const [source,error]of invalid){assert.throws(()=>session.replace(source),error);assert.equal(session.stateSnapshotJson(),prior);}
  const accepted=read(createMappedSession().replace('items=['+Array.from({length:199},(_,i)=>i).join(',')+']\nroot=Stack(@Each(items,"item",TextContent(""+item)))'));
  assert.equal(accepted.components.length,200);
  const aliases=['a0=TextContent("leaf")'];
  for(let index=1;index<=22;index++)aliases.push('a'+index+'=Card([a'+(index-1)+',a'+(index-1)+'])');
  assert.throws(()=>session.replace(aliases.join('\n')+'\nroot=Stack(@Each([1],"item",a22))'),/AST_BUDGET/,
    'reference-expanded template inspection has a shared visit budget before official evaluation');
});

test('only the four declared pure builtins and exact upstream argument counts are accepted',()=>{
  for(const expression of ['@First(items)','@Abs(2)','@Each(items,"item")','@Count(items,42)','@Filter(items,"kind","==","park",true)','@Sort(items)']){
    assert.throws(()=>createMappedSession().replace(data+'\nvalue='+expression+'\nroot=Stack([TextContent("ok")])'),/CALL_UNSUPPORTED|BUILTIN_ARGUMENTS/);
  }
  for(const source of ['q=Query("remote",{})\nroot=Stack([TextContent("x")])','m=Mutation("remote",{})\nroot=Stack([TextContent("x")])'])
    assert.throws(()=>createMappedSession().replace(source),/REMOTE_UNSUPPORTED/);
});

test('Set cannot promote a scalar state into array loop data while boolean records remain supported',()=>{
  const session=createMappedSession();let result=read(session.replace('$value="ok"\nroot=Stack([TextContent($value),Button("bad",@Set($value,[1,2]))])'));
  assert.throws(()=>session.dispatchAction(button(result,'bad').id),/STATE_VALUE/);
  assert.deepEqual(JSON.parse(session.stateSnapshotJson()),{$value:'ok'});
  result=read(session.replace('$prefs={camera:false,water:false}\nroot=Stack([Button("good",@Set($prefs,{camera:true,water:false})),TextContent($prefs.camera?"yes":"no")])'));
  result=read(session.dispatchAction(button(result,'good').id));assert.deepEqual(result.state.$prefs,{camera:true,water:false});assert.ok(text(result).includes('yes'));
});

test('exact native action associations are bounded without replacing authority with a hash',()=>{
  const session=createMappedSession();session.replace(program);const prior=session.stateSnapshotJson();
  assert.throws(()=>session.replace('root=Stack([Button("Go",@ToAssistant('+JSON.stringify('x'.repeat(65537))+'))])'),/ACTION_CONTEXT_LIMIT/);
  assert.equal(session.stateSnapshotJson(),prior);
  const current=read(session.currentResult()),event=button(current,'Pick Lake').action.event;
  const association=JSON.parse(event.context.plan);
  assert.equal(association.plan.steps[0].context.itemId,'a');assert.equal(event.context.actionId,button(current,'Pick Lake').id);
});
