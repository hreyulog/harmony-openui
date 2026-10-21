// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {stripTypeScriptTypes} from 'node:module';
import {createMappedSession,getMappedSystemPrompt,getMappedLibrarySchema} from '../openui/src/main/ets/generated/OpenUiMappedRuntime.js';

const unpack=value=>JSON.parse(value);
const label=(result,node)=>result.components.find(child=>child.id===node.child)?.text;
function projection(){
  const code=['core/OpenUiTypes','render/OpenUiTheme','render/OpenUiNativeIds','render/OpenUiProjection'].map(name=>stripTypeScriptTypes(
    fs.readFileSync(new URL('../openui/src/main/ets/'+name+'.ets',import.meta.url),'utf8').replace(/^import[\s\S]*?;\r?\n/gm,''),{mode:'transform'}).replace(/^export /gm,'')).join('\n');
  return vm.runInNewContext(code+'\n({Projection:OpenUiProjection,Themes:OpenUiThemes})',{JSON,Map,Set,Date,Math,Object,Array,Number});
}

test('mapped buttons preserve visual priorities without changing the official signature or external intent',()=>{
  const session=createMappedSession();const result=unpack(session.replace('root=Stack([Button("Default",@ToAssistant("default")),Button("Main",@ToAssistant("main"),"primary"),Button("Alternative",@ToAssistant("alternative"),"secondary"),Button("Quiet",@ToAssistant("quiet"),"tertiary")])'));
  assert.deepEqual(result.components.filter(node=>node.component==='Button').map(node=>[label(result,node),node.variant]),
    [['Default','primary'],['Main','primary'],['Alternative','secondary'],['Quiet','borderless']]);
  for(const node of result.components.filter(node=>node.component==='Button')){
    const event=unpack(session.dispatchAction(node.id)).actions[0];
    assert.equal(event.name,'continue_conversation');assert.ok(['default','main','alternative','quiet'].includes(event.context.message));
    assert.equal(event.context.formName,undefined);
  }
  const schema=unpack(getMappedLibrarySchema());
  assert.deepEqual(Object.keys(schema.$defs.Button.properties),['label','action','variant','type','size']);
});

test('headers, captions, body text and emphasis use semantic typography rather than fixed font pixels',()=>{
  const result=unpack(createMappedSession().replace('root=Stack([CardHeader("Heading","Supporting subtitle"),TextContent("Caption","small"),TextContent("Body","default"),TextContent("Value","large-heavy"),TextContent("Label","small-heavy")])'));
  const nodes=Object.fromEntries(result.components.filter(node=>node.component==='Text').map(node=>[node.text,node]));
  assert.equal(nodes.Heading.variant,'h2');assert.equal(nodes['Supporting subtitle'].variant,'caption');
  assert.equal(nodes.Caption.variant,'caption');assert.equal(nodes.Body.variant,'body');assert.equal(nodes.Value.variant,'h3');
  assert.equal(nodes.Value.styles['font-weight'],'600');assert.equal(nodes.Label.styles['font-weight'],'600');
  for(const node of Object.values(nodes))assert.equal(node.styles?.['font-size'],undefined,'the native theme owns font sizing');
  const heading=result.components.find(node=>node.component==='Column'&&node.children.includes(nodes.Heading.id));
  assert.deepEqual(heading.children,[nodes.Heading.id,nodes['Supporting subtitle'].id]);
  assert.equal(heading.styles.gap,'8px','supporting caption remains adjacent to its title');
});

test('ordinary card/image mapping delegates geometry while the actual native projection supplies an explicit 16:9 image size',()=>{
  const source='root=Stack([Card([Image("Cover","https://example.com/cover.jpg"),CardHeader("Title","Description"),Button("Choose",@ToAssistant("choose",{itemId:"example"}))]),Card([TextContent("Unboxed")],"clear")])';
  const result=unpack(createMappedSession().replace(source)),image=result.components.find(node=>node.component==='Image');
  assert.equal(image.aspectRatio,undefined,'the mapping does not force a panorama ratio');
  assert.equal(image.source,'https://example.com/cover.jpg');assert.equal(image.alt,'Cover');
  const cards=result.components.filter(node=>node.component==='Card');assert.equal(cards[0].styles,undefined);
  assert.equal(cards[1].styles['background-color'],'transparent');
  const{Projection,Themes}=projection();const nodes=Projection.components({components:result.components,dataModelJson:'{}',readOnly:false,selectedComponent:''},Themes.create());
  const rendered=nodes.find(node=>node.id===image.id);assert.equal(rendered.styles.width,'100%');
  assert.ok(Number.isFinite(Number(rendered.styles['aspect-ratio']))&&Number(rendered.styles['aspect-ratio'])>0);
  assert.ok(Math.abs(Number(rendered.styles['aspect-ratio'])-16/9)<0.000001,'native rendering has an explicit positive image ratio');
  assert.equal(rendered.accessibility.label,'Cover');
});

test('invalid dynamic button emphasis fails atomically rather than becoming an unrelated primary action',()=>{
  const session=createMappedSession();const initial=unpack(session.replace('$variant="secondary"\nroot=Stack([Button("Choose",@ToAssistant("choose",{itemId:"original"}),$variant),Button("Invalid",@Set($variant,"neon"))])'));
  const invalid=initial.components.find(node=>node.component==='Button'&&label(initial,node)==='Invalid'),before=session.stateSnapshotJson();
  assert.throws(()=>session.dispatchAction(invalid.id),/BUTTON_VARIANT/);assert.equal(session.stateSnapshotJson(),before);
  const current=unpack(session.currentResult()),choose=current.components.find(node=>node.component==='Button'&&label(current,node)==='Choose');
  assert.equal(choose.variant,'secondary');assert.equal(unpack(session.dispatchAction(choose.id)).actions[0].context.context.itemId,'original');
});

test('the model prompt teaches existing visual composition without adding arbitrary style parameters',()=>{
  const prompt=getMappedSystemPrompt(),schema=unpack(getMappedLibrarySchema());
  assert.ok(prompt.includes('one primary action'));assert.ok(prompt.includes('Keep labels immediately before their values'));
  assert.ok(prompt.includes('do not invent image dimensions, inline styles, CSS'));
  assert.deepEqual(Object.keys(schema.$defs.CardHeader.properties),['title','subtitle']);
  assert.deepEqual(Object.keys(schema.$defs.Image.properties),['alt','src']);
  assert.equal(schema.$defs.TextContent.properties.styles,undefined);
});
