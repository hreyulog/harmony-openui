// SPDX-License-Identifier: Apache-2.0
import { OpenUiComponent } from '../core/OpenUiTypes';

/** AGenUI 1.6's hybrid view registry is global and keyed only by node ID. */
export class OpenUiNativeIds {
  private static sequence: number = 0;
  private forward: Map<string, string> = new Map<string, string>();
  private reverse: Map<string, string> = new Map<string, string>();
  private semantic: Set<string> = new Set<string>();
  private kinds: Map<string, string> = new Map<string, string>();
  private reachable: Set<string> = new Set<string>();
  private prefix: string = '';
  private serial: number = 0;
  constructor(components: OpenUiComponent[]) {
    this.prefix = 'openui_m' + (++OpenUiNativeIds.sequence).toString(36) + '_';
    this.sync(components);
  }
  /** Stable native identities for retained nodes. Removed identities never revive. */
  sync(components: OpenUiComponent[]): void {
    const previousReachable = this.reachable;
    this.reachable = new Set<string>(); this.semantic.clear();
    const lookup: Map<string, OpenUiComponent> = new Map<string, OpenUiComponent>();
    const referenced: Set<string> = new Set<string>();
    for (const component of components) {
      lookup.set(component.id, component);
      for (const id of component.children ?? (component.child ? [component.child] : [])) { referenced.add(id); }
    }
    const pending = lookup.has('root') ? ['root'] : components.filter((component: OpenUiComponent): boolean => !referenced.has(component.id))
      .map((component: OpenUiComponent): string => component.id);
    const visited: Set<string> = new Set<string>();
    while (pending.length) {
      const source = pending.pop()!;
      if (visited.has(source)) { continue; }
      visited.add(source);
      const component = lookup.get(source);
      if (!component) { continue; }
      this.reachable.add(source);
      for (const child of component.children ?? (component.child ? [component.child] : [])) { pending.push(child); }
    }
    for (const source of Array.from(this.forward.keys())) {
      if (!lookup.has(source) || this.kinds.get(source) !== lookup.get(source)!.component ||
        previousReachable.has(source) !== this.reachable.has(source)) {
        // Losing reachability retires callbacks even if the caller retains an
        // orphan definition. Reappearance is a new native interaction lifetime.
        this.reverse.delete(this.forward.get(source)!); this.forward.delete(source); this.kinds.delete(source);
      }
    }
    for (const component of components) {
      if (!this.forward.has(component.id)) {
        const native = this.prefix + (this.serial++).toString(36);
        this.forward.set(component.id, native); this.reverse.set(native, component.id);
      }
      this.kinds.set(component.id, component.component);
      if (this.reachable.has(component.id) && component.component?.startsWith('OpenUi') && component.component !== 'OpenUiForm') {
        this.semantic.add(this.nativeId(component.id));
      }
    }
  }
  nativeId(source: string): string {
    const native = this.forward.get(source);
    if (!native) { throw new Error('OPENUI_NATIVE_ID'); }
    return native;
  }
  sourceId(native: string): string | undefined {
    const source = this.reverse.get(native);
    return source !== undefined && this.reachable.has(source) ? source : undefined;
  }
  nativeIds(): string[] { return Array.from(this.reverse.keys()); }
  semanticIds(): string[] { return Array.from(this.semantic); }
  /** Includes retired identities: the native SDK may retain their model metadata. */
  allocatedCount(): number { return this.serial; }
}
