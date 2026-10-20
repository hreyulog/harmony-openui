// SPDX-License-Identifier: Apache-2.0
import { createLanguageSession, getSystemPrompt, getLibrarySchema, LanguageSession } from '../generated/OpenUiLangRuntime';
import { OpenUiController } from '../core/OpenUiController';
import { OpenUiCatalog } from '../core/OpenUiCatalog';
import { OpenUiComponent } from '../core/OpenUiTypes';

export interface OpenUiLanguageError { code: string; message: string; }
export interface OpenUiLanguageResult {
  components: OpenUiComponent[];
  incomplete: boolean;
  unresolved: string[];
  errors: OpenUiLanguageError[];
  complete: boolean;
}

/** Official OpenUI Lang parser → format-neutral native state. Model transport
 * and business effects are supplied by the application. */
export class OpenUiLanguageStream {
  private parser: LanguageSession = createLanguageSession();
  private lastTree: string = '';
  private controller: OpenUiController;
  readonly surfaceId: string;
  constructor(controller: OpenUiController, surfaceId: string) {
    this.controller = controller; this.surfaceId = surfaceId;
    if (!controller.getSurface(surfaceId)) { controller.apply({ kind: 'create', surfaceId }); }
  }
  static systemPrompt(): string { return getSystemPrompt(); }
  static librarySchema(): string { return getLibrarySchema(); }
  append(chunk: string, complete: boolean = false): OpenUiLanguageResult {
    const result = JSON.parse(this.parser.push(chunk, complete)) as OpenUiLanguageResult;
    if (complete && (result.errors.length > 0 || result.incomplete || result.unresolved.length > 0 || result.components.length === 0)) {
      throw new Error('OPENUI_LANG_INVALID: ' + (result.errors.map((item: OpenUiLanguageError): string => item.code).join(',') || 'incomplete'));
    }
    if (result.errors.length === 0 && result.components.length > 0) {
      // A syntactically materialized streaming node can still be missing a
      // required native prop. Keep the last valid tree until this node fills.
      try { OpenUiCatalog.validateTree(result.components); }
      catch (error) {
        if (!complete && (result.incomplete || result.unresolved.length > 0)) { return result; }
        throw error as Error;
      }
      const tree = JSON.stringify(result.components);
      if (tree !== this.lastTree) {
        this.controller.apply({ kind: 'components', surfaceId: this.surfaceId, components: result.components, replace: true });
        this.lastTree = tree;
      }
    }
    return result;
  }
  replace(source: string): OpenUiLanguageResult {
    this.parser = createLanguageSession(); this.lastTree = '';
    return this.append(source, true);
  }
}
