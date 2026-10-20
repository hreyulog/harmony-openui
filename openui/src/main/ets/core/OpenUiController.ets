// SPDX-License-Identifier: Apache-2.0
import { OpenUiCatalog } from './OpenUiCatalog';
import { OpenUiActionReceipt, OpenUiChange, OpenUiComponent, OpenUiControllerOptions, OpenUiFieldChange, OpenUiFieldValue,
  OpenUiRenderEvent, OpenUiRenderStatus, OpenUiSurface, OpenUiUserAction } from './OpenUiTypes';

interface NativeActionEnvelope { action: OpenUiUserAction; }
interface A2uiCreate { surfaceId: string; catalogId?: string; }
interface A2uiComponents { surfaceId: string; components: OpenUiComponent[]; }
interface A2uiData { surfaceId: string; path?: string; value?: Object; }
interface A2uiEnvelope {
  version: string;
  createSurface?: A2uiCreate;
  updateComponents?: A2uiComponents;
  updateDataModel?: A2uiData;
  deleteSurface?: A2uiCreate;
}
interface SavedController { format: string; sequence: number; surfaces: OpenUiSurface[]; events: string[]; }

/** Format-neutral state owner. Input-language adapters call apply(); rendering is external. */
export class OpenUiController {
  private state: Map<string, OpenUiSurface> = new Map<string, OpenUiSurface>();
  private observers: Map<number, () => void> = new Map<number, () => void>();
  private seenEvents: Set<string> = new Set<string>();
  private serial: number = 0;
  private observerSerial: number = 0;
  private pendingA2ui: string = '';
  private options: OpenUiControllerOptions;
  constructor(options: OpenUiControllerOptions = {}) { this.options = options; }

  subscribe(listener: () => void): number { const id = ++this.observerSerial; this.observers.set(id, listener); return id; }
  unsubscribe(id: number): void { this.observers.delete(id); }
  getSurface(id: string): OpenUiSurface | undefined {
    const value = this.state.get(id); return value ? JSON.parse(JSON.stringify(value)) as OpenUiSurface : undefined;
  }
  surfaces(): OpenUiSurface[] { return Array.from(this.state.keys()).map((id: string): OpenUiSurface => this.getSurface(id)!); }
  private publish(): void { for (const listener of this.observers.values()) { try { listener(); } catch (_) {} } }
  private current(id: string): OpenUiSurface {
    const value = this.state.get(id); if (!value) { throw new Error('OPENUI_SURFACE_MISSING'); } return value;
  }
  private changed(surface: OpenUiSurface): void {
    surface.revision = ++this.serial; surface.renderStatus = 'pending'; surface.error = ''; this.publish();
  }

  apply(change: OpenUiChange): void {
    if (!change || typeof change.surfaceId !== 'string' || !change.surfaceId || change.surfaceId.length > 160) { throw new Error('OPENUI_SURFACE_ID'); }
    const id = change.surfaceId;
    if (change.kind === 'create') {
      if (this.state.has(id)) { throw new Error('OPENUI_SURFACE_EXISTS'); }
      const catalog = change.catalogId ?? OpenUiCatalog.id;
      if (catalog !== OpenUiCatalog.id) { throw new Error('OPENUI_CATALOG'); }
      const surface: OpenUiSurface = { id, catalogId: catalog, revision: ++this.serial,
        components: [], dataModelJson: '{}', fieldValuesJson: '{}', fieldErrorsJson: '{}', readOnly: false, selectedComponent: '', renderStatus: 'pending', error: '' };
      this.state.set(id, surface); this.publish(); return;
    }
    const surface = this.current(id);
    if (change.kind === 'delete') { this.state.delete(id); ++this.serial; this.publish(); return; }
    if (change.kind === 'components') {
      if (!Array.isArray(change.components)) { throw new Error('OPENUI_COMPONENTS'); }
      const batch: OpenUiComponent[] = JSON.parse(JSON.stringify(change.components));
      const incoming: Set<string> = new Set<string>();
      const merged: Map<string, OpenUiComponent> = new Map<string, OpenUiComponent>();
      if (change.replace !== true) { for (const item of surface.components) { merged.set(item.id, item); } }
      for (const item of batch) {
        OpenUiCatalog.validate(item); if (incoming.has(item.id)) { throw new Error('OPENUI_DUPLICATE_ID'); }
        incoming.add(item.id); merged.set(item.id, item);
      }
      const candidate = Array.from(merged.values()); OpenUiCatalog.validateTree(candidate);
      this.reconcileFields(surface, candidate); surface.components = candidate;
      if (!merged.has(surface.selectedComponent)) { surface.selectedComponent = ''; }
      this.changed(surface); return;
    }
    if (change.kind === 'data') {
      if (typeof change.valueJson !== 'string') { throw new Error('OPENUI_DATA_VALUE_REQUIRED'); }
      const value: Object = JSON.parse(change.valueJson);
      const path = change.path ?? '';
      if (path === '' || path === '/') { surface.dataModelJson = JSON.stringify(value); }
      else {
        const keys = OpenUiController.pointer(path);
        const root: Record<string, Object> = JSON.parse(surface.dataModelJson);
        if (!root || typeof root !== 'object') { throw new Error('OPENUI_DATA_CONTAINER'); }
        let parent = root;
        for (let index = 0; index < keys.length - 1; index++) {
          const child = parent[keys[index]];
          if (child === undefined) { const empty: Record<string, Object> = {}; parent[keys[index]] = empty; }
          else if (!child || typeof child !== 'object') { throw new Error('OPENUI_DATA_CONTAINER'); }
          parent = parent[keys[index]] as Record<string, Object>;
        }
        parent[keys[keys.length - 1]] = value; surface.dataModelJson = JSON.stringify(root);
      }
      this.changed(surface); return;
    }
    throw new Error('OPENUI_CHANGE_KIND');
  }

  setReadOnly(id: string, value: boolean): void {
    const surface = this.current(id); if (surface.readOnly === value) { return; }
    surface.readOnly = value; this.changed(surface);
  }
  setSelected(id: string, componentId: string): void {
    const surface = this.current(id);
    if (componentId && !surface.components.some((node: OpenUiComponent): boolean => node.id === componentId)) { throw new Error('OPENUI_SELECTION_COMPONENT'); }
    if (surface.selectedComponent === componentId) { return; }
    surface.selectedComponent = componentId; this.changed(surface);
  }

  /** Edits are separate from document revisions, so typing does not remount native controls. */
  setFieldValue(id: string, componentId: string, value: OpenUiFieldValue, expectedRevision?: number): boolean {
    const surface = this.state.get(id);
    if (!surface || surface.readOnly || (expectedRevision !== undefined && surface.revision !== expectedRevision)) { return false; }
    const node = surface.components.find((item: OpenUiComponent): boolean => item.id === componentId);
    if (!node || !OpenUiCatalog.isField(node) || node.disabled || !OpenUiController.reachable(surface.components, componentId) ||
      !OpenUiCatalog.fieldValueType(node, value)) { return false; }
    const values: Record<string, OpenUiFieldValue> = JSON.parse(surface.fieldValuesJson);
    let errors: Record<string, string> = JSON.parse(surface.fieldErrorsJson);
    const previous = OpenUiController.fieldValue(values, node);
    const error = this.fieldMessage(node, value);
    const previousError = Object.keys(errors).includes(componentId) ? errors[componentId] : '';
    if (previous === value && previousError === error) { return true; }
    values[componentId] = value;
    errors = OpenUiController.updateError(errors, componentId, error);
    surface.fieldValuesJson = JSON.stringify(values); surface.fieldErrorsJson = JSON.stringify(errors);
    const event: OpenUiFieldChange = { surfaceId: id, sourceComponentId: componentId, field: node.field!,
      form: OpenUiController.formName(surface.components, componentId), value, revision: surface.revision };
    this.publish(); try { this.options.onFieldChange?.(event); } catch (_) {} return true;
  }

  /** Disabled controls are omitted, matching native form semantics. */
  getFormValues(id: string, name: string): Record<string, Object> {
    const surface = this.state.get(id); const result: Record<string, Object> = {};
    if (!surface || !OpenUiController.hasForm(surface.components, name)) { return result; }
    const values: Record<string, OpenUiFieldValue> = JSON.parse(surface.fieldValuesJson);
    for (const node of surface.components) {
      if (OpenUiCatalog.isField(node) && !node.disabled && OpenUiController.reachable(surface.components, node.id) &&
        OpenUiController.formName(surface.components, node.id) === name) { result[node.field!] = OpenUiController.fieldValue(values, node); }
    }
    return result;
  }

  validateForm(id: string, name: string): boolean {
    const surface = this.state.get(id);
    if (!surface || !OpenUiController.hasForm(surface.components, name)) { return false; }
    const values: Record<string, OpenUiFieldValue> = JSON.parse(surface.fieldValuesJson);
    let errors: Record<string, string> = JSON.parse(surface.fieldErrorsJson); let valid = true;
    for (const node of surface.components) {
      if (!OpenUiCatalog.isField(node) || !OpenUiController.reachable(surface.components, node.id) || OpenUiController.formName(surface.components, node.id) !== name) { continue; }
      const error = node.disabled ? '' : this.fieldMessage(node, OpenUiController.fieldValue(values, node));
      errors = OpenUiController.updateError(errors, node.id, error); if (error) { valid = false; }
    }
    const next = JSON.stringify(errors);
    if (next !== surface.fieldErrorsJson) { surface.fieldErrorsJson = next; this.publish(); }
    return valid;
  }

  private fieldMessage(node: OpenUiComponent, value: OpenUiFieldValue): string {
    const code = OpenUiCatalog.fieldError(node, value); if (!code) { return ''; }
    try { const message = this.options.validationMessage?.(code, node); if (typeof message === 'string' && message.trim()) { return message.slice(0, 500); } } catch (_) {}
    switch (code) {
      case 'required': return 'This field is required.';
      case 'type': return 'Invalid value type.';
      case 'email': return 'Enter a valid email address.';
      case 'number': return 'Enter a finite number.';
      case 'date': return 'Enter a valid date (YYYY-MM-DD).';
      case 'time': return 'Enter a valid time (HH:mm).';
      case 'option': return 'Choose an available option.';
      case 'range': return 'Value is outside the allowed range.';
      case 'step': return 'Value does not match the allowed step.';
      default: return 'Invalid value.';
    }
  }
  private static updateError(errors: Record<string, string>, key: string, message: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const id of Object.keys(errors)) { if (id !== key) { result[id] = errors[id]; } }
    if (message) { result[key] = message; } return result;
  }

  private reconcileFields(surface: OpenUiSurface, candidate: OpenUiComponent[]): void {
    const oldValues: Record<string, OpenUiFieldValue> = JSON.parse(surface.fieldValuesJson);
    const oldErrors: Record<string, string> = JSON.parse(surface.fieldErrorsJson);
    const values: Record<string, OpenUiFieldValue> = {}; const errors: Record<string, string> = {};
    for (const node of candidate) {
      if (!OpenUiCatalog.isField(node)) { continue; }
      const previous = surface.components.find((item: OpenUiComponent): boolean => item.id === node.id);
      if (!previous || OpenUiController.fieldIdentity(surface.components, previous) !== OpenUiController.fieldIdentity(candidate, node)) { continue; }
      if (Object.keys(oldValues).includes(node.id) && OpenUiCatalog.fieldValueType(node, oldValues[node.id])) { values[node.id] = oldValues[node.id]; }
      if (!node.disabled && (Object.keys(oldErrors).includes(node.id) || Object.keys(values).includes(node.id))) {
        const error = this.fieldMessage(node, OpenUiController.fieldValue(values, node)); if (error) { errors[node.id] = error; }
      }
    }
    surface.fieldValuesJson = JSON.stringify(values); surface.fieldErrorsJson = JSON.stringify(errors);
  }

  private static fieldIdentity(nodes: OpenUiComponent[], node: OpenUiComponent): string {
    return JSON.stringify([node.component, node.field, OpenUiController.formName(nodes, node.id), node.variant ?? 'text', node.inputType ?? 'text']);
  }
  private static fieldValue(values: Record<string, OpenUiFieldValue>, node: OpenUiComponent): OpenUiFieldValue {
    return Object.keys(values).includes(node.id) ? values[node.id] : OpenUiCatalog.defaultFieldValue(node);
  }
  private static formName(nodes: OpenUiComponent[], componentId: string): string {
    let current = componentId; const seen: Set<string> = new Set<string>();
    while (!seen.has(current)) {
      seen.add(current);
      const parent = nodes.find((item: OpenUiComponent): boolean => (item.children ?? (item.child ? [item.child] : [])).includes(current));
      if (!parent) { break; } if (parent.component === 'OpenUiForm') { return parent.name!; } current = parent.id;
    }
    return '';
  }
  private static hasForm(nodes: OpenUiComponent[], name: string): boolean {
    return nodes.some((node: OpenUiComponent): boolean => node.component === 'OpenUiForm' && node.name === name && OpenUiController.reachable(nodes, node.id));
  }

  /** eventId is supplied by the host transport; no business action runs here. */
  dispatchAction(action: OpenUiUserAction, expectedRevision: number, eventId: string): boolean {
    if (!action || typeof eventId !== 'string' || !eventId || eventId.length > 160) { return false; }
    const surface = this.state.get(action.surfaceId);
    if (!surface || surface.readOnly || surface.revision !== expectedRevision) { return false; }
    const node = surface.components.find((component: OpenUiComponent): boolean => component.id === action.sourceComponentId);
    if (!OpenUiController.reachable(surface.components, action.sourceComponentId)) { return false; }
    const definition = node?.action?.event;
    if (!definition || definition.name !== action.name) { return false; }
    try {
      const expected = OpenUiController.resolve(definition.context, JSON.parse(surface.dataModelJson));
      if (OpenUiController.canonical(expected) !== OpenUiController.canonical(action.context)) { return false; }
    } catch (_) { return false; }
    const key = JSON.stringify([surface.id, eventId]);
    if (this.seenEvents.has(key)) { return false; }
    let context: Record<string, Object> = JSON.parse(JSON.stringify(action.context));
    if (definition.name === 'submit') {
      const form = definition.context['form'] as string;
      if (OpenUiController.formName(surface.components, node!.id) !== form || !this.validateForm(surface.id, form)) { return false; }
      if (this.state.get(surface.id) !== surface || surface.revision !== expectedRevision || surface.readOnly) { return false; }
      context = {}; context['form'] = form; context['fields'] = this.getFormValues(surface.id, form);
    }
    this.seenEvents.add(key);
    const receipt: OpenUiActionReceipt = { eventId, revision: surface.revision, receivedAt: Date.now(),
      surfaceId: surface.id, sourceComponentId: action.sourceComponentId, name: action.name,
      context };
    try { this.options.onAction?.(receipt); } catch (_) {}
    return true;
  }
  acceptAction(raw: string, expectedRevision: number, eventId: string): boolean {
    try { const event = JSON.parse(raw) as NativeActionEnvelope; return this.dispatchAction(event.action, expectedRevision, eventId); }
    catch (_) { return false; }
  }

  reportRenderStatus(id: string, revision: number, status: OpenUiRenderStatus, message: string = ''): void {
    const surface = this.state.get(id);
    if (!surface || surface.revision !== revision || !['pending', 'rendered', 'error'].includes(status)) { return; }
    const error = status === 'error' ? message.slice(0, 1000) : '';
    if (surface.renderStatus === status && surface.error === error) { return; }
    surface.renderStatus = status; surface.error = error;
    const event: OpenUiRenderEvent = { surfaceId: id, revision, status, error };
    try { this.options.onRenderStatus?.(event); } catch (_) {} this.publish();
  }

  exportSnapshot(): string {
    const snapshot: SavedController = { format: 'harmony-openui/snapshot@1', sequence: this.serial,
      surfaces: this.surfaces(), events: Array.from(this.seenEvents) };
    return JSON.stringify(snapshot);
  }
  restoreSnapshot(text: string): void {
    const snapshot = JSON.parse(text) as SavedController;
    if (snapshot.format !== 'harmony-openui/snapshot@1' || !Array.isArray(snapshot.surfaces) ||
      !Number.isInteger(snapshot.sequence) || !Array.isArray(snapshot.events) || snapshot.events.some((key: string): boolean => typeof key !== 'string')) { throw new Error('OPENUI_SNAPSHOT'); }
    const next: Map<string, OpenUiSurface> = new Map<string, OpenUiSurface>();
    let serial = Math.max(this.serial, snapshot.sequence);
    for (const original of snapshot.surfaces) {
      if (!original || typeof original.id !== 'string' || !original.id || next.has(original.id) || original.catalogId !== OpenUiCatalog.id ||
        !Number.isInteger(original.revision) || typeof original.readOnly !== 'boolean' || typeof original.selectedComponent !== 'string') { throw new Error('OPENUI_SNAPSHOT'); }
      OpenUiCatalog.validateTree(original.components); JSON.parse(original.dataModelJson); serial = Math.max(serial, original.revision);
      const surface: OpenUiSurface = JSON.parse(JSON.stringify(original));
      // v0.1 snapshots did not contain field maps. Imported maps never introduce orphan keys or object values.
      surface.fieldValuesJson = surface.fieldValuesJson ?? '{}'; surface.fieldErrorsJson = surface.fieldErrorsJson ?? '{}';
      const values: Record<string, OpenUiFieldValue> = OpenUiController.savedFieldMap(surface.fieldValuesJson) as Record<string, OpenUiFieldValue>;
      const errors: Record<string, string> = OpenUiController.savedFieldMap(surface.fieldErrorsJson) as Record<string, string>;
      for (const key of Object.keys(values)) {
        const node = surface.components.find((item: OpenUiComponent): boolean => item.id === key);
        if (!node || !OpenUiCatalog.isField(node) || !OpenUiCatalog.fieldValueType(node, values[key])) { throw new Error('OPENUI_SNAPSHOT_FIELD'); }
      }
      for (const key of Object.keys(errors)) {
        const node = surface.components.find((item: OpenUiComponent): boolean => item.id === key);
        if (!node || !OpenUiCatalog.isField(node) || typeof errors[key] !== 'string' || errors[key].length > 500) { throw new Error('OPENUI_SNAPSHOT_FIELD'); }
      }
      surface.renderStatus = 'pending'; surface.error = ''; next.set(surface.id, surface);
    }
    // Renew render revisions so callbacks from before restore cannot act on imported surfaces.
    for (const surface of next.values()) { surface.revision = ++serial; }
    this.state = next; this.serial = serial; this.seenEvents = new Set<string>(snapshot.events); this.pendingA2ui = ''; this.publish();
  }

  /** Optional A2UI v0.9 adapter. Other languages use apply() and their upstream parser. */
  receiveA2ui(chunk: string): void {
    if (typeof chunk !== 'string' || this.pendingA2ui.length + chunk.length > 1048576) { throw new Error('OPENUI_STREAM_LIMIT'); }
    this.pendingA2ui += chunk;
    let boundary = this.pendingA2ui.indexOf('\n');
    while (boundary >= 0) {
      const line = this.pendingA2ui.substring(0, boundary).trim(); this.pendingA2ui = this.pendingA2ui.substring(boundary + 1);
      if (line) { this.a2uiLine(line); } boundary = this.pendingA2ui.indexOf('\n');
    }
  }
  flushA2ui(): void { const line = this.pendingA2ui.trim(); this.pendingA2ui = ''; if (line) { this.a2uiLine(line); } }
  private a2uiLine(line: string): void {
    const envelope = JSON.parse(line) as A2uiEnvelope;
    if (!envelope || !['v0.9', 'v0.9.1'].includes(envelope.version) ||
      [envelope.createSurface, envelope.updateComponents, envelope.updateDataModel, envelope.deleteSurface].filter((value: Object | undefined): boolean => value !== undefined).length !== 1) { throw new Error('OPENUI_A2UI_ENVELOPE'); }
    if (envelope.createSurface) { this.apply({ kind: 'create', surfaceId: envelope.createSurface.surfaceId, catalogId: envelope.createSurface.catalogId }); }
    else if (envelope.updateComponents) { this.apply({ kind: 'components', surfaceId: envelope.updateComponents.surfaceId, components: envelope.updateComponents.components }); }
    else if (envelope.updateDataModel) { this.apply({ kind: 'data', surfaceId: envelope.updateDataModel.surfaceId, path: envelope.updateDataModel.path, valueJson: JSON.stringify(envelope.updateDataModel.value) }); }
    else if (envelope.deleteSurface) { this.apply({ kind: 'delete', surfaceId: envelope.deleteSurface.surfaceId }); }
  }

  private static pointer(path: string): string[] {
    if (!path.startsWith('/') || /~(?![01])/.test(path)) { throw new Error('OPENUI_DATA_PATH'); }
    const parts = path.substring(1).split('/').map((key: string): string => key.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (parts.some((key: string): boolean => ['__proto__', 'prototype', 'constructor'].includes(key))) { throw new Error('OPENUI_DATA_PATH'); }
    return parts;
  }
  private static savedFieldMap(text: string): Record<string, Object> {
    if (typeof text !== 'string') { throw new Error('OPENUI_SNAPSHOT_FIELD'); }
    const result: Record<string, Object> = JSON.parse(text);
    if (!result || typeof result !== 'object' || Array.isArray(result) || Object.keys(result).some((key: string): boolean =>
      ['__proto__', 'prototype', 'constructor'].includes(key))) { throw new Error('OPENUI_SNAPSHOT_FIELD'); }
    return result;
  }
  private static reachable(nodes: OpenUiComponent[], id: string): boolean {
    const pending: string[] = ['root']; const seen: Set<string> = new Set<string>();
    while (pending.length > 0) {
      const current = pending.pop()!; if (seen.has(current)) { continue; } seen.add(current);
      const node = nodes.find((item: OpenUiComponent): boolean => item.id === current); if (!node) { continue; }
      if (current === id) { return true; }
      for (const child of node.children ?? (node.child ? [node.child] : [])) { pending.push(child); }
    }
    return false;
  }
  private static resolve(value: Object, data: Object): Object {
    if (!value || typeof value !== 'object') { return value; }
    if (Array.isArray(value)) { return value.map((item: Object): Object => OpenUiController.resolve(item, data)); }
    const record = value as Record<string, Object>;
    if (Object.keys(record).length === 1 && typeof record['path'] === 'string') {
      const path = record['path'] as string;
      if (path === '') { return data; }
      let result = data as Record<string, Object>;
      for (const part of OpenUiController.pointer(path)) { if (!result || typeof result !== 'object') { return null!; } result = result[part] as Record<string, Object>; }
      return result ?? null!;
    }
    const resolved: Record<string, Object> = {};
    for (const key of Object.keys(record)) { resolved[key] = OpenUiController.resolve(record[key], data); }
    return resolved;
  }
  private static canonical(value: Object): string {
    if (value === undefined) { return 'null'; }
    if (!value || typeof value !== 'object') { return JSON.stringify(value); }
    if (Array.isArray(value)) { return '[' + value.map((item: Object): string => OpenUiController.canonical(item)).join(',') + ']'; }
    const record = value as Record<string, Object>;
    return '{' + Object.keys(record).sort().map((key: string): string => JSON.stringify(key) + ':' + OpenUiController.canonical(record[key])).join(',') + '}';
  }
}
