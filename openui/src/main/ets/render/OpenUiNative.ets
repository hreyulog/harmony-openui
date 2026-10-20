// SPDX-License-Identifier: Apache-2.0
// Uses the public AGenUI A2UIComponent extension contract and native Surface action API.
import { AGenUI, A2UIComponent, A2UIComponentProps, CustomView, SurfaceManager } from '@agenui/agenui';
import { UIContext } from '@kit.ArkUI';
import { OpenUiTheme, OpenUiThemes } from './OpenUiTheme';
import { OpenUiNativeIds } from './OpenUiNativeIds';
import { OpenUiIntrinsicLayout, OpenUiFactValue } from './OpenUiIntrinsicLayout';
import { OpenUiRenderDiagnostics } from './OpenUiRenderDiagnostics';
import { OpenUiControlModel, OpenUiControlState } from './OpenUiControlModel';
import { OpenUiControlsLayout } from './OpenUiControlsLayout';
import { OpenUiComponent, OpenUiFieldValue, OpenUiSurface, OpenUiSelectOption, OpenUiListItem } from '../core/OpenUiTypes';


/** Per-mount state, isolated by both engine instance and surface identity. */
export class OpenUiNativeSession {
  private static installed: boolean = false;
  private static mounted: Map<string, OpenUiNativeSession> = new Map<string, OpenUiNativeSession>();
  private static nodeOwners: Map<string, OpenUiNativeSession> = new Map<string, OpenUiNativeSession>();
  readonly manager: SurfaceManager;
  readonly surfaceId: string;
  readonly theme: OpenUiTheme;
  readonly readOnly: boolean;
  readonly selectedId: string;
  readonly expanded: Map<string, boolean>;
  readonly uiContext: UIContext | undefined;
  readonly ids: OpenUiNativeIds;
  readonly contentWidth: number;
  private expected: Set<string>;
  private measured: Set<string> = new Set<string>();
  private onMeasured: (() => void) | undefined;
  private elements: Map<string, OpenUiNativeElement> = new Map<string, OpenUiNativeElement>();
  private fieldValues: Record<string, OpenUiFieldValue> = {};
  private fieldErrors: Record<string, string> = {};
  private onField: ((id: string, value: OpenUiFieldValue) => boolean) | undefined;
  active: boolean = true;
  constructor(manager: SurfaceManager, surfaceId: string, theme: OpenUiTheme, readOnly: boolean,
    selectedId: string, expanded: Map<string, boolean>, uiContext: UIContext | undefined, ids: OpenUiNativeIds, onMeasured?: () => void, contentWidth: number = 0,
    onField?: (id: string, value: OpenUiFieldValue) => boolean, initialSurface?: OpenUiSurface) {
    this.manager = manager; this.surfaceId = surfaceId; this.theme = OpenUiThemes.copy(theme);
    this.readOnly = readOnly; this.selectedId = selectedId; this.expanded = expanded;
    this.uiContext = uiContext;
    this.ids = ids;
    this.contentWidth = contentWidth;
    this.onField = onField;
    if (initialSurface) { this.fieldValues = OpenUiControlModel.values(initialSurface); this.fieldErrors = OpenUiControlModel.errors(initialSurface); }
    this.expected = new Set<string>(ids.semanticIds()); this.onMeasured = onMeasured;
    if (!OpenUiNativeSession.installed) {
      for (const name of ['OpenUiOption', 'OpenUiFacts', 'OpenUiStatus', 'OpenUiDetails'].concat(OpenUiControlModel.names)) {
        AGenUI.registerComponent(name, (sid: string, id: string, type: string, pointer: bigint, instance: number): A2UIComponent => {
          // The public 1.6 native package can pass instance 0 before binding.
          // Our globally unique node ID identifies the actual owning manager.
          const owner = OpenUiNativeSession.forNode(id);
          return new OpenUiNativeElement(sid, id, type, pointer, owner?.manager.getInstanceId() ?? instance);
        });
      }
      OpenUiNativeSession.installed = true;
    }
    OpenUiNativeSession.mounted.set(this.key(), this);
    for (const id of this.ids.nativeIds()) { OpenUiNativeSession.nodeOwners.set(id, this); }
  }
  private key(): string { return this.manager.getInstanceId().toString() + ':' + this.surfaceId; }
  static forNode(id: string): OpenUiNativeSession | undefined { return OpenUiNativeSession.nodeOwners.get(id); }
  current(): boolean { return this.active && OpenUiNativeSession.mounted.get(this.key()) === this; }
  contentMeasured(id: string): void {
    if (!this.current() || !this.expected.has(id) || this.measured.has(id)) { return; }
    this.measured.add(id); this.onMeasured?.();
  }
  allMeasured(): boolean { return this.measured.size === this.expected.size; }
  attach(element: OpenUiNativeElement): void { this.elements.set(element.getNodeId(), element); }
  syncFields(surface: OpenUiSurface): void {
    if (!this.current()) { return; }
    this.fieldValues = OpenUiControlModel.values(surface); this.fieldErrors = OpenUiControlModel.errors(surface);
    for (const element of this.elements.values()) { element.syncField(); }
  }
  value(node: OpenUiComponent): OpenUiFieldValue { return OpenUiControlModel.value(node, this.fieldValues); }
  error(id: string): string { return OpenUiControlModel.error(Object.keys(this.fieldErrors).includes(id) ? this.fieldErrors[id] : ''); }
  edit(id: string, value: OpenUiFieldValue): boolean {
    const source = this.ids.sourceId(id);
    return this.current() && !this.readOnly && source !== undefined && this.onField !== undefined && this.onField(source, value);
  }
  dispatch(id: string, kind: string = 'OpenUiOption'): void {
    if (!this.current() || this.readOnly || this.ids.sourceId(id) === undefined) { return; }
    this.manager.getSurface(this.surfaceId)?.getComponent(id, kind).triggerAction();
  }
  dispose(): void {
    this.active = false;
    for (const element of this.elements.values()) { element.deactivate(); }
    this.elements.clear();
    if (OpenUiNativeSession.mounted.get(this.key()) === this) { OpenUiNativeSession.mounted.delete(this.key()); }
    for (const id of this.ids.nativeIds()) {
      if (OpenUiNativeSession.nodeOwners.get(id) === this) { OpenUiNativeSession.nodeOwners.delete(id); }
    }
  }
}

@Builder
function openUiElement(view: CustomView): void {
  if (OpenUiControlModel.names.includes((view as OpenUiNativeElement).getComponentType())) {
    OpenUiControlsLayout({ widthHint: (view as OpenUiNativeElement).widthLimit(), revision: (view as OpenUiNativeElement).renderRevision,
      kind: (view as OpenUiNativeElement).getComponentType(), nodeId: (view as OpenUiNativeElement).getNodeId(),
      label: (view as OpenUiNativeElement).controlLabel, title: (view as OpenUiNativeElement).heading, text: (view as OpenUiNativeElement).content,
      placeholder: (view as OpenUiNativeElement).placeholder, variant: (view as OpenUiNativeElement).controlVariant, inputKind: (view as OpenUiNativeElement).inputKind,
      stringValue: (view as OpenUiNativeElement).stringValue, numberValue: (view as OpenUiNativeElement).numberValue, boolValue: (view as OpenUiNativeElement).boolValue,
      controlState: (view as OpenUiNativeElement).controlState(),
      required: (view as OpenUiNativeElement).required, disabled: !(view as OpenUiNativeElement).canEdit(), fieldError: (view as OpenUiNativeElement).fieldError,
      options: (view as OpenUiNativeElement).options, minimum: (view as OpenUiNativeElement).minimum, maximum: (view as OpenUiNativeElement).maximum, step: (view as OpenUiNativeElement).step,
      minDate: (view as OpenUiNativeElement).minDate, maxDate: (view as OpenUiNativeElement).maxDate,
      source: (view as OpenUiNativeElement).source, alt: (view as OpenUiNativeElement).alt, aspect: (view as OpenUiNativeElement).aspect,
      items: (view as OpenUiNativeElement).items, viewportHeight: (view as OpenUiNativeElement).viewportHeight,
      confirmLabel: (view as OpenUiNativeElement).confirmLabel, cancelLabel: (view as OpenUiNativeElement).cancelLabel, theme: (view as OpenUiNativeElement).skin(),
      onString: (value: string): void => { (view as OpenUiNativeElement).edit(value); },
      onNumber: (value: number): void => { (view as OpenUiNativeElement).edit(value); },
      onBoolean: (value: boolean): void => { (view as OpenUiNativeElement).edit(value); },
      onAction: (): void => { (view as OpenUiNativeElement).activate(); },
      canOpen: (): boolean => { return (view as OpenUiNativeElement).canAct() && (view as OpenUiNativeElement).canEdit(); },
      onModalReady: (close: () => void): void => { (view as OpenUiNativeElement).setModalCloser(close); },
      onMeasured: (size: SizeResult): void => { (view as OpenUiNativeElement).scheduleSize(size); } })
  } else {
  OpenUiIntrinsicLayout({ widthHint: (view as OpenUiNativeElement).widthLimit(), revision: (view as OpenUiNativeElement).renderRevision,
    kind: (view as OpenUiNativeElement).getComponentType(), title: (view as OpenUiNativeElement).heading,
    description: (view as OpenUiNativeElement).supporting, meta: (view as OpenUiNativeElement).metric,
    text: (view as OpenUiNativeElement).content, tone: (view as OpenUiNativeElement).tone,
    values: (view as OpenUiNativeElement).values, theme: (view as OpenUiNativeElement).skin(),
    selected: (view as OpenUiNativeElement).isSelected(), selectable: (view as OpenUiNativeElement).canAct(), expanded: (view as OpenUiNativeElement).isExpanded(),
    onAction: (): void => { (view as OpenUiNativeElement).activate(); },
    onToggle: (): void => { (view as OpenUiNativeElement).toggle(); },
    onMeasured: (size: SizeResult): void => { (view as OpenUiNativeElement).scheduleSize(size); } })
  }
}

export class OpenUiNativeElement extends A2UIComponent {
  renderRevision: number = 0;
  heading: string = ''; supporting: string = ''; metric: string = ''; content: string = ''; tone: string = 'neutral';
  values: OpenUiFactValue[] = [];
  controlLabel: string = ''; placeholder: string = ''; controlVariant: string = ''; inputKind: string = 'text';
  stringValue: string = ''; numberValue: number = 0; boolValue: boolean = false; required: boolean = false; fieldError: string = '';
  options: OpenUiSelectOption[] = []; minimum: number = 0; maximum: number = 100; step: number = 1;
  minDate: string = ''; maxDate: string = ''; source: string = ''; alt: string = ''; aspect: number = 1.7777778;
  items: OpenUiListItem[] = []; viewportHeight: number = 240; confirmLabel: string = '确认 / Confirm'; cancelLabel: string = '取消 / Cancel';
  private disabled: boolean = false;
  private definition: OpenUiComponent | undefined;
  private modalCloser: (() => void) | undefined;
  private nativeEditDepth: number = 0;
  private updateTimer: number = -1;
  private interactive: boolean = false;
  private owner: OpenUiNativeSession | undefined;
  private fallbackTheme: OpenUiTheme = OpenUiThemes.create();
  private lastWidth: number = -1;
  private lastHeight: number = -1;
  private pendingSize: SizeResult | undefined;
  private sizeTimer: number = -1;
  constructor(surface: string, id: string, type: string, pointer: bigint, instance: number = 0) {
    super(surface, id, type, pointer, wrapBuilder<[CustomView]>(openUiElement), instance);
    this.owner = OpenUiNativeSession.forNode(id);
    this.owner?.attach(this);
  }
  // AGenUI 1.6 creates hybrid ComponentContent while parsing, before its
  // Container.onDidBuild initializes the SDK's global AppStorage context.
  // Resolve the view's own context through its unique base node identity;
  // this also remains valid if the base constructor calls this virtual method.
  getUIContext(): UIContext | undefined {
    return OpenUiNativeSession.forNode(this.getNodeId())?.uiContext;
  }
  private plain(properties: A2UIComponentProps, key: string): string {
    const value = properties[key]; return typeof value === 'string' ? value : '';
  }
  protected onUpdateProperties(properties: A2UIComponentProps): void {
    this.heading = this.plain(properties, 'title'); this.supporting = this.plain(properties, 'description');
    this.metric = this.plain(properties, 'meta'); this.content = this.plain(properties, 'text');
    this.tone = this.plain(properties, 'tone'); this.interactive = properties['selectable'] === true;
    const rows = properties['facts'] as OpenUiFactValue[] | undefined;
    this.values = Array.isArray(rows) ? rows.map((row: OpenUiFactValue): OpenUiFactValue => ({ label: row.label, value: row.value })) : [];
    if (OpenUiControlModel.names.includes(this.getComponentType())) {
      const sourceId = this.owner?.ids.sourceId(this.getNodeId()) ?? this.getNodeId();
      this.definition = { id: sourceId, component: this.getComponentType(), value: properties['value'] as OpenUiFieldValue | undefined,
        min: properties['min'] as number | undefined };
      this.controlLabel = this.plain(properties, 'label'); this.placeholder = this.plain(properties, 'placeholder');
      this.controlVariant = this.plain(properties, 'variant'); this.inputKind = this.plain(properties, 'inputType');
      this.required = properties['required'] === true; this.disabled = properties['disabled'] === true;
      this.options = (properties['options'] as OpenUiSelectOption[] | undefined) ?? [];
      this.minimum = (properties['min'] as number | undefined) ?? 0; this.maximum = (properties['max'] as number | undefined) ?? 100;
      this.step = (properties['step'] as number | undefined) ?? 1;
      this.minDate = this.plain(properties, 'minDate'); this.maxDate = this.plain(properties, 'maxDate');
      this.source = this.plain(properties, 'source'); this.alt = this.plain(properties, 'alt');
      this.aspect = (properties['aspectRatio'] as number | undefined) ?? 1.7777778;
      this.items = (properties['items'] as OpenUiListItem[] | undefined) ?? [];
      this.viewportHeight = (properties['height'] as number | undefined) ?? 240;
      this.confirmLabel = this.plain(properties, 'confirmLabel') || '确认 / Confirm'; this.cancelLabel = this.plain(properties, 'cancelLabel') || '取消 / Cancel';
      this.interactive = properties['action'] !== undefined;
      this.syncField(false);
    }
    this.renderRevision++;
    OpenUiRenderDiagnostics.log('props node=' + this.getNodeId() + ' type=' + this.getComponentType() + ' keys=' + Object.keys(properties).join(',') +
      ' titleLen=' + this.heading.length.toString() + ' textLen=' + this.content.length.toString() + ' revision=' + this.renderRevision.toString());
  }
  skin(): OpenUiTheme { return this.owner?.theme ?? this.fallbackTheme; }
  widthLimit(): number { return this.owner?.contentWidth ?? 0; }
  isSelected(): boolean { return this.owner !== undefined && this.owner.selectedId === this.owner.ids.sourceId(this.getNodeId()); }
  canAct(): boolean { return this.interactive && this.owner !== undefined && this.owner.current() && !this.owner.readOnly; }
  activate(): void { if (this.canAct() && !this.disabled) { this.owner?.dispatch(this.getNodeId(), this.getComponentType()); } }
  canEdit(): boolean { return !this.disabled && this.owner !== undefined && this.owner.current() && !this.owner.readOnly; }
  controlState(): string {
    const kind = this.getComponentType();
    const value: OpenUiFieldValue = kind === 'OpenUiSlider' ? this.numberValue :
      kind === 'OpenUiCheckbox' || kind === 'OpenUiToggle' ? this.boolValue : this.stringValue;
    const state: OpenUiControlState = { value, revision: this.renderRevision };
    return JSON.stringify(state);
  }
  edit(value: OpenUiFieldValue): void {
    if (!this.canEdit() || !OpenUiControlModel.isField(this.getComponentType())) { return; }
    // The native control has already displayed this value. Remember it before
    // publishing to the controller so the synchronous echo cannot reset an
    // active TextInput cursor or TimePicker wheel inside its onChange stack.
    this.nativeEditDepth++;
    const wasBlank = this.stringValue === '';
    const changed = this.storeFieldValue(value);
    try {
      if (!this.owner?.edit(this.getNodeId(), value)) { this.syncField(); }
      else if (changed && (this.getComponentType() === 'OpenUiSlider' ||
        (wasBlank && ['OpenUiDatePicker', 'OpenUiTimePicker'].includes(this.getComponentType())))) {
        // Only auxiliary UI needs a refresh: the slider number, or removal of
        // a blank picker's hint. Its stable selected Date is never echoed.
        this.redraw();
      }
    }
    finally { this.nativeEditDepth--; }
  }
  private storeFieldValue(value: OpenUiFieldValue): boolean {
    const stringValue = typeof value === 'string' ? value : ''; const numberValue = typeof value === 'number' ? value : 0; const boolValue = value === true;
    if (this.stringValue === stringValue && this.numberValue === numberValue && this.boolValue === boolValue) { return false; }
    this.stringValue = stringValue; this.numberValue = numberValue; this.boolValue = boolValue;
    this.renderRevision++; return true;
  }
  private redraw(): void {
    if (!this.owner?.current()) { return; }
    if (this.nativeEditDepth > 0) {
      if (this.updateTimer >= 0) { return; }
      this.updateTimer = setTimeout((): void => {
        this.updateTimer = -1;
        if (this.owner?.current()) { this.updateArkUI(); }
      }, 0);
      return;
    }
    if (this.updateTimer >= 0) { clearTimeout(this.updateTimer); this.updateTimer = -1; }
    this.updateArkUI();
  }
  syncField(update: boolean = true): void {
    if (!this.owner?.current() || !this.definition || !OpenUiControlModel.isField(this.getComponentType())) { return; }
    const value = this.owner.value(this.definition); const error = this.owner.error(this.definition.id);
    const changed = this.storeFieldValue(value);
    if (!changed && this.fieldError === error) { return; }
    this.fieldError = error; this.renderRevision++;
    if (update) { this.redraw(); }
  }
  setModalCloser(close: () => void): void { if (this.owner?.current()) { this.modalCloser = close; } else { close(); } }
  closeModal(): void { this.modalCloser?.(); this.modalCloser = undefined; }
  deactivate(): void {
    this.closeModal();
    if (this.updateTimer >= 0) { clearTimeout(this.updateTimer); this.updateTimer = -1; }
  }
  isExpanded(): boolean {
    const source = this.owner?.ids.sourceId(this.getNodeId());
    return source !== undefined && this.owner?.expanded.get(source) === true;
  }
  toggle(): void {
    const source = this.owner?.ids.sourceId(this.getNodeId());
    if (!this.owner?.current() || source === undefined) { return; }
    this.owner.expanded.set(source, !this.isExpanded()); this.renderRevision++; this.updateArkUI();
  }
  scheduleSize(size: SizeResult): void {
    OpenUiRenderDiagnostics.log('schedule node=' + this.getNodeId() + ' current=' + String(this.owner?.current()) + ' width=' + size.width.toString() + ' height=' + size.height.toString());
    if (!this.owner?.current() || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) { return; }
    this.pendingSize = size;
    if (this.sizeTimer >= 0) { return; }
    // Do not mutate native/Yoga state from ArkUI's measurement callback.
    this.sizeTimer = setTimeout((): void => {
      this.sizeTimer = -1; const latest = this.pendingSize; this.pendingSize = undefined;
      if (latest) { this.sizeChanged(latest); }
    }, 0);
  }
  onDestroy(): void {
    this.deactivate();
    if (this.sizeTimer >= 0) { clearTimeout(this.sizeTimer); this.sizeTimer = -1; }
    this.pendingSize = undefined;
  }
  sizeChanged(size: SizeOptions): void {
    if (!this.owner?.current()) { return; }
    const width = size.width as number; const height = size.height as number;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      this.owner.contentWidth <= 0 || width > this.owner.contentWidth + 0.5 ||
      (width === this.lastWidth && height === this.lastHeight)) { return; }
    this.lastWidth = width; this.lastHeight = height; this.reportContentHeight(height, width); this.owner.contentMeasured(this.getNodeId());
  }
}
