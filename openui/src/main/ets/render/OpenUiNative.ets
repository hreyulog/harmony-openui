// SPDX-License-Identifier: Apache-2.0
// Uses the public AGenUI A2UIComponent extension contract and native Surface action API.
import { AGenUI, A2UIComponent, A2UIComponentProps, CustomView, SurfaceManager } from '@agenui/agenui';
import { UIContext } from '@kit.ArkUI';
import { OpenUiTheme, OpenUiThemes } from './OpenUiTheme';
import { OpenUiNativeIds } from './OpenUiNativeIds';
import { OpenUiIntrinsicLayout, OpenUiFactValue } from './OpenUiIntrinsicLayout';
import { OpenUiRenderDiagnostics } from './OpenUiRenderDiagnostics';


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
  active: boolean = true;
  constructor(manager: SurfaceManager, surfaceId: string, theme: OpenUiTheme, readOnly: boolean,
    selectedId: string, expanded: Map<string, boolean>, uiContext: UIContext | undefined, ids: OpenUiNativeIds, onMeasured?: () => void, contentWidth: number = 0) {
    this.manager = manager; this.surfaceId = surfaceId; this.theme = OpenUiThemes.copy(theme);
    this.readOnly = readOnly; this.selectedId = selectedId; this.expanded = expanded;
    this.uiContext = uiContext;
    this.ids = ids;
    this.contentWidth = contentWidth;
    this.expected = new Set<string>(ids.semanticIds()); this.onMeasured = onMeasured;
    if (!OpenUiNativeSession.installed) {
      for (const name of ['OpenUiOption', 'OpenUiFacts', 'OpenUiStatus', 'OpenUiDetails']) {
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
  dispatch(id: string): void {
    if (!this.current() || this.readOnly || this.ids.sourceId(id) === undefined) { return; }
    this.manager.getSurface(this.surfaceId)?.getComponent(id, 'OpenUiOption').triggerAction();
  }
  dispose(): void {
    this.active = false;
    if (OpenUiNativeSession.mounted.get(this.key()) === this) { OpenUiNativeSession.mounted.delete(this.key()); }
    for (const id of this.ids.nativeIds()) {
      if (OpenUiNativeSession.nodeOwners.get(id) === this) { OpenUiNativeSession.nodeOwners.delete(id); }
    }
  }
}

@Builder
function openUiElement(view: CustomView): void {
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

export class OpenUiNativeElement extends A2UIComponent {
  renderRevision: number = 0;
  heading: string = ''; supporting: string = ''; metric: string = ''; content: string = ''; tone: string = 'neutral';
  values: OpenUiFactValue[] = [];
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
    this.renderRevision++;
    OpenUiRenderDiagnostics.log('props node=' + this.getNodeId() + ' type=' + this.getComponentType() + ' keys=' + Object.keys(properties).join(',') +
      ' titleLen=' + this.heading.length.toString() + ' textLen=' + this.content.length.toString() + ' revision=' + this.renderRevision.toString());
  }
  skin(): OpenUiTheme { return this.owner?.theme ?? this.fallbackTheme; }
  widthLimit(): number { return this.owner?.contentWidth ?? 0; }
  isSelected(): boolean { return this.owner !== undefined && this.owner.selectedId === this.owner.ids.sourceId(this.getNodeId()); }
  canAct(): boolean { return this.interactive && this.owner !== undefined && this.owner.current() && !this.owner.readOnly; }
  activate(): void { if (this.canAct()) { this.owner?.dispatch(this.getNodeId()); } }
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
