// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { fileURLToPath } from 'node:url';

const source = fs.readFileSync(fileURLToPath(new URL('../demo/src/main/ets/model/DemoModel.ets', import.meta.url)), 'utf8');
const executable = stripTypeScriptTypes(source.replace(/^import[^\n]*\r?\n/gm, ''), {mode:'transform'})
  .replace(/^export /gm, '');
// A deliberately fictional sentinel verifies header placement and error
// boundaries. No environment, saved configuration or real credential is read.
const testKey = 'OPENUI_TEST_KEY_SENTINEL';
const ui = 'root = Stack([Text("模型生成的界面")])';

function setup({responseCode = 200, reply = {}, result, transportError} = {}) {
  const state = {created:0, destroyed:0, requests:[]};
  const http = {
    RequestMethod:{POST:'POST'}, HttpDataType:{STRING:'STRING'},
    createHttp() {
      state.created++;
      return {
        async request(endpoint, options) {
          state.requests.push({endpoint, options});
          if (transportError) throw transportError;
          return {responseCode, result:result === undefined ? JSON.stringify(reply) : result};
        },
        destroy() { state.destroyed++; }
      };
    }
  };
  const model = vm.runInNewContext(executable + '\nDemoModel', {http});
  const config = protocol => ({endpoint:'https://model.example.test/messages', model:'demo-model', apiKey:testKey, protocol});
  return {state, generate:protocol => model.generate(config(protocol), 'SYSTEM CATALOG', 'USER FACTS')};
}

test('Anthropic returns only text blocks, keeping thinking and signatures out of the UI', async () => {
  const {state, generate} = setup({reply:{stop_reason:'end_turn', content:[
    {type:'thinking', thinking:'PRIVATE_REASONING_SENTINEL', text:'NOT_A_TEXT_BLOCK'},
    {type:'text', text:ui},
    {type:'redacted_thinking', data:'PRIVATE_SIGNATURE_SENTINEL'},
    {type:'text', text:'// displayed text'}
  ]}});
  assert.equal(await generate('anthropic'), ui + '\n// displayed text');
  assert.equal(state.created, 1); assert.equal(state.destroyed, 1);
  const {options} = state.requests[0];
  assert.equal(options.header['x-api-key'], testKey);
  assert.equal(options.header['anthropic-version'], '2023-06-01');
  assert.equal(options.header.Authorization, undefined);
  const body = JSON.parse(options.extraData);
  assert.equal(body.system, 'SYSTEM CATALOG');
  assert.deepEqual(body.messages, [{role:'user', content:'USER FACTS'}]);
  assert.equal(body.stream, false, 'the demo uses complete HTTP responses rather than claiming provider streaming');
  assert.equal(body.max_tokens, 4096);
  assert.equal(options.extraData.includes(testKey), false, 'the key belongs in the header, not the model prompt');
});

test('OpenAI returns message.content only, excluding separated reasoning fields', async () => {
  const {state, generate} = setup({reply:{choices:[{finish_reason:'stop', message:{
    role:'assistant', content:ui, reasoning:'PRIVATE_REASONING_SENTINEL',
    reasoning_content:'PRIVATE_REASONING_CONTENT_SENTINEL'
  }}]}});
  assert.equal(await generate('openai'), ui);
  assert.equal(state.destroyed, 1);
  const {options} = state.requests[0];
  assert.equal(options.header.Authorization, 'Bearer ' + testKey);
  assert.equal(options.header['x-api-key'], undefined);
  const body = JSON.parse(options.extraData);
  assert.deepEqual(body.messages, [{role:'system',content:'SYSTEM CATALOG'}, {role:'user',content:'USER FACTS'}]);
  assert.equal(options.extraData.includes(testKey), false);
});

for (const [protocol, reply] of [
  ['anthropic', {stop_reason:'max_tokens', content:[{type:'text',text:ui}]}],
  ['openai', {choices:[{finish_reason:'length',message:{content:ui}}]}]
]) {
  test(`${protocol} refuses a truncated response even when its partial text looks usable and destroys the request`, async () => {
    const {state, generate} = setup({reply});
    await assert.rejects(generate(protocol), error => /模型输出被截断/.test(error.message));
    assert.equal(state.created, 1); assert.equal(state.destroyed, 1);
  });
}

for (const [label, protocol, response] of [
  ['empty HTTP body', 'openai', {result:''}],
  ['missing choices', 'openai', {reply:{}}],
  ['empty content', 'openai', {reply:{choices:[{finish_reason:'stop',message:{content:'  '}}]}}],
  ['reasoning without content', 'openai', {reply:{choices:[{finish_reason:'stop',message:{reasoning_content:'PRIVATE_ONLY'}}]}}],
  ['thinking without text', 'anthropic', {reply:{stop_reason:'end_turn',content:[{type:'thinking',thinking:'PRIVATE_ONLY'}]}}]
]) {
  test(`${label} rejects instead of returning a false successful UI`, async () => {
    const {state, generate} = setup(response);
    let returned = false;
    await assert.rejects(async () => { await generate(protocol); returned = true; });
    assert.equal(returned, false);
    assert.equal(state.created, 1); assert.equal(state.destroyed, 1);
  });
}

test('thinking embedded in the returned text is rejected rather than rendered', async () => {
  const {state, generate} = setup({reply:{choices:[{finish_reason:'stop',message:{content:'<think>PRIVATE_ONLY</think>\n' + ui}}]}});
  await assert.rejects(generate('openai'), error => /接口将推理放入正文/.test(error.message) && !error.message.includes('PRIVATE_ONLY'));
  assert.equal(state.destroyed, 1);
});

test('HTTP failure does not expose the header key or an echoed provider error body', async () => {
  const {state, generate} = setup({responseCode:401, result:JSON.stringify({
    error:'provider body must not be surfaced', echoedAuthorization:'Bearer ' + testKey
  })});
  await assert.rejects(generate('openai'), error => {
    assert.equal(error.message, '模型请求失败（HTTP 401）');
    assert.equal(error.message.includes(testKey), false);
    assert.equal(error.message.includes('Authorization'), false);
    assert.equal(error.message.includes('provider body'), false);
    return true;
  });
  assert.equal(state.requests[0].options.header.Authorization, 'Bearer ' + testKey);
  assert.equal(state.destroyed, 1);
});

test('transport failure and oversized output both destroy their HTTP request', async () => {
  const transport = setup({transportError:new Error('network unavailable')});
  await assert.rejects(transport.generate('openai'), /network unavailable/);
  assert.equal(transport.state.destroyed, 1);
  const oversized = setup({reply:{choices:[{finish_reason:'stop',message:{content:'x'.repeat(100001)}}]}});
  await assert.rejects(oversized.generate('openai'), error => /超过示例大小上限/.test(error.message));
  assert.equal(oversized.state.destroyed, 1);
});
