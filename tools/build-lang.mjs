// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { generateSystemPrompt } from '@openuidev/lang-core';
import { library, promptOptions } from './lang/library.mjs';
import { mappedLibrary, mappedPromptOptions, mappedSupport } from './lang/mapped-registry.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schemaDir = path.join(root, 'schemas'); fs.mkdirSync(schemaDir, { recursive: true });
const schema = JSON.stringify(library.toJSONSchema(), null, 2) + '\n';
fs.writeFileSync(path.join(schemaDir, 'openui-lang-v0.1.json'), schema);
const prompt = generateSystemPrompt({ library: library.toSpec(), promptOptions });
fs.writeFileSync(path.join(root, 'tools/lang/system-prompt.generated.mjs'), 'export const systemPrompt = ' + JSON.stringify(prompt) + ';\n');
const out = path.join(root, 'openui/src/main/ets/generated'); fs.mkdirSync(out, { recursive: true });
const outfile = path.join(out, 'OpenUiLangRuntime.js');
await build({ entryPoints: [path.join(root, 'tools/lang/runtime-entry.mjs')], outfile, bundle: true,
  platform: 'browser', format: 'esm', target: 'es2020', treeShaking: true, legalComments: 'eof', minify: false,
  define: { 'process.env.OPENUI_RUNTIME_TELEMETRY_ENABLED': '"0"' } });
fs.writeFileSync(path.join(out, 'OpenUiLangRuntime.d.ts'), `export interface LanguageSession { push(chunk: string, complete?: boolean): string; }
export declare function createLanguageSession(): LanguageSession;
export declare function getSystemPrompt(): string;
export declare function getLibrarySchema(): string;
`);
const data = fs.readFileSync(outfile);
fs.writeFileSync(path.join(out, 'provenance.json'), JSON.stringify({
  parser: '@openuidev/lang-core', version: '1.0.1', license: 'MIT',
  sourceRepository: 'https://github.com/thesysdev/openui',
  referenceCommit: '9823ec05d4b29bc78d101676dc16b44fe17f1830',
  runtimeSha256: crypto.createHash('sha256').update(data).digest('hex'),
  schemaSha256: crypto.createHash('sha256').update(schema).digest('hex'),
  bytes: data.length, modelProviderRequired: false
}, null, 2) + '\n');
console.log('Built upstream OpenUI Lang parser adapter (' + data.length + ' bytes).');

// Keep the v0.2 language profile stable. The official-semantics mapping is a
// separate opt-in runtime generated from one executable component registry.
const mappedSchema = JSON.stringify(mappedLibrary.toJSONSchema(), null, 2) + '\n';
fs.writeFileSync(path.join(schemaDir, 'openui-mapped-v1.json'), mappedSchema);
fs.writeFileSync(path.join(schemaDir, 'openui-mapped-support-v1.json'), JSON.stringify(mappedSupport, null, 2) + '\n');
const mappedPrompt = generateSystemPrompt({ library: mappedLibrary.toSpec(), promptOptions: mappedPromptOptions });
fs.writeFileSync(path.join(root, 'tools/lang/mapped-system-prompt.generated.mjs'), 'export const mappedSystemPrompt = ' + JSON.stringify(mappedPrompt) + ';\n');
const mappedFile = path.join(out, 'OpenUiMappedRuntime.js');
await build({ entryPoints: [path.join(root, 'tools/lang/mapped-runtime-entry.mjs')], outfile: mappedFile, bundle: true,
  platform: 'browser', format: 'esm', target: 'es2020', treeShaking: true, legalComments: 'eof', minify: false,
  define: { 'process.env.OPENUI_RUNTIME_TELEMETRY_ENABLED': '"0"' } });
fs.writeFileSync(path.join(out, 'OpenUiMappedRuntime.d.ts'), `export interface MappedSession {
  replace(source: string): string;
  setField(componentId: string, valueJson: string): string;
  dispatchAction(componentId: string): string;
  stateSnapshotJson(): string;
  currentResult(): string;
  getStats(): string;
  dispose(): void;
}
export declare function createMappedSession(): MappedSession;
export declare function getMappedSystemPrompt(): string;
export declare function getMappedLibrarySchema(): string;
export declare function getMappedSupportManifest(): string;
`);
const mappedData = fs.readFileSync(mappedFile);
fs.writeFileSync(path.join(out, 'mapped-provenance.json'), JSON.stringify({
  ...mappedSupport, parser: '@openuidev/lang-core', version: '1.0.1', license: 'MIT',
  runtimeSha256: crypto.createHash('sha256').update(mappedData).digest('hex'),
  schemaSha256: crypto.createHash('sha256').update(mappedSchema).digest('hex'), bytes: mappedData.length
}, null, 2) + '\n');
console.log('Built official OpenUI reactive mapping adapter (' + mappedData.length + ' bytes).');
