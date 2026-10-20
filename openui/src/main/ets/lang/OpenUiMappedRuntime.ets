// SPDX-License-Identifier: Apache-2.0
import { createMappedSession, getMappedSystemPrompt, getMappedLibrarySchema, getMappedSupportManifest, MappedSession } from '../generated/OpenUiMappedRuntime';
import { OpenUiController } from '../core/OpenUiController';
import { OpenUiCatalog } from '../core/OpenUiCatalog';
import { OpenUiComponent, OpenUiControllerOptions, OpenUiFieldChange, OpenUiFieldValue, OpenUiActionReceipt, OpenUiNamedAction } from '../core/OpenUiTypes';

export interface OpenUiMappedBinding {
  componentId: string;
  name: string;
  target: string;
  value: OpenUiFieldValue;
  formName?: string;
  itemName?: string;
}
export interface OpenUiMappedStats {
  replacements: number;
  evaluations: number;
  stateUpdates: number;
  internalActions: number;
  externalActions: number;
}
export interface OpenUiMappedResult {
  components: OpenUiComponent[];
  bindings: OpenUiMappedBinding[];
  state: Record<string, Object>;
  actions: OpenUiNamedAction[];
  stats: OpenUiMappedStats;
  errors: Object[];
  incomplete: boolean;
  unresolved: string[];
  complete: boolean;
  validationErrors: Record<string, string>;
}
export interface OpenUiMappedOptions extends OpenUiControllerOptions {
  onStateUpdate?: (stateJson: string) => void;
  onError?: (message: string) => void;
}

/** Opt-in official OpenUI component semantics. lang-core owns $state, expression
 * evaluation and bindings; the controller owns native revisions and event checks.
 * A host still owns model transport and every external business effect. */
export class OpenUiMappedRuntime {
  readonly controller: OpenUiController;
  readonly surfaceId: string;
  private session: MappedSession = createMappedSession();
  private disposed: boolean = false;
  private generation: number = 0;
  private options: OpenUiMappedOptions;

  constructor(surfaceId: string, options: OpenUiMappedOptions = {}) {
    this.surfaceId = surfaceId; this.options = options;
    this.controller = new OpenUiController({
      onRenderStatus: options.onRenderStatus,
      validationMessage: options.validationMessage,
      onFieldChange: (event: OpenUiFieldChange): void => this.fieldChanged(event),
      onAction: (event: OpenUiActionReceipt): void => this.actionReceived(event)
    });
    this.controller.apply({ kind: 'create', surfaceId });
  }
  static systemPrompt(): string { return getMappedSystemPrompt(); }
  static librarySchema(): string { return getMappedLibrarySchema(); }
  static supportManifest(): string { return getMappedSupportManifest(); }
  private ensure(): void { if (this.disposed) { throw new Error('OPENUI_MAPPED_DISPOSED'); } }
  private current(generation: number, revision?: number): boolean {
    return !this.disposed && generation === this.generation &&
      (revision === undefined || this.controller.getSurface(this.surfaceId)?.revision === revision);
  }
  private reportError(message: string): void { try { this.options.onError?.(message); } catch (_) {} }
  private stateUpdated(): void {
    try { this.options.onStateUpdate?.(this.stateSnapshotJson()); } catch (error) { this.reportError(String(error)); }
  }
  private parse(encoded: string): OpenUiMappedResult {
    const result = JSON.parse(encoded) as OpenUiMappedResult;
    OpenUiCatalog.validateTree(result.components);
    return result;
  }
  private patch(result: OpenUiMappedResult, generation: number): number {
    const revision = this.controller.apply({ kind: 'patch', surfaceId: this.surfaceId, components: result.components, syncFieldValues: true });
    if (!this.current(generation, revision)) { return revision; }
    this.validationErrors(result);
    if (this.current(generation, revision)) { this.stateUpdated(); }
    return revision;
  }
  private validationErrors(result: OpenUiMappedResult): void {
    const surface = this.controller.getSurface(this.surfaceId); if (!surface) { return; }
    const errors: Record<string, string> = {};
    const validationErrors: Record<string, string> = result.validationErrors ?? errors;
    for (const id of Object.keys(validationErrors)) {
      const node = surface.components.find((component: OpenUiComponent): boolean => component.id === id);
      if (!node) { continue; }
      const code = validationErrors[id];
      let message = code === 'group_required' ? '请至少选择一项 / Select at least one option' : '此项为必填项 / Required';
      try {
        const localized = this.options.validationMessage?.(code, node);
        if (typeof localized === 'string' && localized.trim()) { message = localized.slice(0, 500); }
      } catch (_) {}
      errors[id] = message;
    }
    this.controller.replaceFieldErrors(this.surfaceId, errors, surface.revision);
  }
  replace(source: string): OpenUiMappedResult {
    this.ensure();
    // Invalid programs retain both the last native tree and its official store.
    const candidate = createMappedSession();
    const generation = this.generation;
    let result: OpenUiMappedResult;
    try {
      result = this.parse(candidate.replace(source));
      this.controller.apply({ kind: 'components', surfaceId: this.surfaceId, components: result.components, replace: true, syncFieldValues: true });
    } catch (error) { candidate.dispose(); throw error as Error; }
    // A synchronous controller observer may have replaced or disposed this
    // runtime while the accepted document was being published.
    if (!this.current(generation)) { candidate.dispose(); return result; }
    this.session.dispose(); this.session = candidate;
    ++this.generation;
    this.validationErrors(result);
    this.stateUpdated();
    return result;
  }
  private fieldChanged(event: OpenUiFieldChange): void {
    const surface = this.controller.getSurface(this.surfaceId);
    if (this.disposed || event.surfaceId !== this.surfaceId || !surface || surface.readOnly || surface.revision !== event.revision) { return; }
    const generation = this.generation;
    try {
      const revision = this.patch(this.parse(this.session.setField(event.sourceComponentId, JSON.stringify(event.value))), generation);
      if (this.current(generation, revision)) { this.options.onFieldChange?.(event); }
    } catch (error) {
      // The native controller accepts an input before calling this adapter. If
      // evaluating its consequences fails, restore that visible input as well
      // as the official store (the JS transaction already rolled itself back).
      if (!this.current(generation)) { return; }
      try { this.patch(this.parse(this.session.currentResult()), generation); } catch (_) {}
      this.reportError(String(error));
    }
  }
  private actionReceived(event: OpenUiActionReceipt): void {
    if (this.disposed || event.surfaceId !== this.surfaceId || event.name !== 'mapped_action') { return; }
    const generation = this.generation;
    try {
      const result = this.parse(this.session.dispatchAction(event.sourceComponentId));
      const revision = this.patch(result, generation);
      for (let index = 0; index < result.actions.length; ++index) {
        // Host callbacks may synchronously advance the conversation or destroy
        // this surface. Remaining actions belong only to this exact program.
        if (!this.current(generation, revision)) { break; }
        const action = result.actions[index];
        try {
          this.options.onAction?.({ surfaceId: event.surfaceId, sourceComponentId: event.sourceComponentId,
            eventId: event.eventId + ':' + index.toString(), revision: event.revision, receivedAt: event.receivedAt,
            name: action.name, context: action.context });
        } catch (error) { this.reportError(String(error)); }
      }
    } catch (error) { this.reportError(String(error)); }
  }
  stateSnapshotJson(): string { this.ensure(); return this.session.stateSnapshotJson(); }
  getStats(): OpenUiMappedStats { this.ensure(); return JSON.parse(this.session.getStats()) as OpenUiMappedStats; }
  dispose(): void {
    if (this.disposed) { return; }
    this.disposed = true; ++this.generation; this.session.dispose();
    this.controller.apply({ kind: 'delete', surfaceId: this.surfaceId });
  }
}
