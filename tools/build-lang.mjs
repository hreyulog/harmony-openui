// SPDX-License-Identifier: Apache-2.0
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { generateSystemPrompt } from '@openuidev/lang-core';
import { library, promptOptions } from './lang/library.mjs';

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
