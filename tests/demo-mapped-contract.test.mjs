// SPDX-License-Identifier: Apache-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest } from '../openui/src/main/ets/generated/OpenUiMappedRuntime.js';

const read = name => fs.readFileSync(new URL(name, import.meta.url), 'utf8');
const validSource = read('../docs/evidence/2026-10-20-v03/model-results.openui');

function validator() {
  const page = read('../demo/src/main/ets/pages/Mapped.ets');
  const start = page.indexOf('  private validate(source: string): void {');
  const end = page.indexOf('  private async generate()', start);
  assert.ok(start >= 0 && end > start, 'execute the actual demo validation method');
  const presetStart = page.indexOf('  private preset(): string {'), presetEnd = page.indexOf('  private preview(): void {', presetStart);
  const sources = ['core/OpenUiTypes', 'core/OpenUiCatalog', 'core/OpenUiController', 'lang/OpenUiMappedRuntime']
    .map(name => read('../openui/src/main/ets/' + name + '.ets'));
  sources.push(read('../demo/src/main/ets/model/DemoPlaces.ets'), page.slice(page.indexOf('const FILTERS:'), page.indexOf('\n@Entry')),
    'class DemoMapped {\n' + page.slice(presetStart, presetEnd) + page.slice(start, end) + '\n}');
  const code = sources.map(source => stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm, ''), {mode:'transform'})
    .replace(/^export /gm, '')).join('\n');
  const Page = vm.runInNewContext(code + '\nDemoMapped', {JSON, Map, Set, Date, Math, Object, Array, Number,
    createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest});
  return new Page();
}

test('actual demo validator rejects the real Nova model source that shows the empty-result message with four results', () => {
  // Only the fictional model-generated program is committed. No device state,
  // account, request metadata, credentials or captured runtime data is included.
  const source = read('./fixtures/mapped-model-unconditional-empty.openui');
  assert.throws(() => validator().validate(source), /UI_EMPTY_STATE: all\/all/);
});

test('actual demo validator accepts the recorded v0.3 model source across all supplied filter combinations', () => {
  assert.doesNotThrow(() => validator().validate(validSource));
});

test('actual demo validator rejects incorrect filtering in a variant of the recorded model program', () => {
  const before = '($duration == "all" || $duration == "short") ? lakeWalkCard';
  const after = '($duration == "all" || $duration == "long") ? lakeWalkCard';
  assert.ok(validSource.includes(before), 'mutate the real first-card filter, keeping its supplied image and business identity');
  const wrongFilter = validSource.replace(before, after);
  assert.throws(() => validator().validate(wrongFilter), /UI_FILTER_RESULTS: all\/short/);
});

test('the actual data-driven demo preset passes all filter, count and sort combinations through the real runtime', () => {
  const page = validator();
  assert.doesNotThrow(() => page.validate(page.preset()));
  assert.throws(() => page.validate(page.preset().replace('@Sort(timed, "rank", $sortOrder)', '@Sort(timed, "rank", "asc")')), /UI_SORT_RESULTS/);
  assert.throws(() => page.validate(page.preset().replace('"找到 " + @Count(ordered)', '"找到 " + 4')), /UI_RESULT_COUNT/);
});
