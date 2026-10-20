// SPDX-License-Identifier: Apache-2.0
// Uses the public AGenUI A2UIComponent extension contract and native Surface action API.
import { AGenUI, A2UIComponent, A2UIComponentProps, CustomView, SurfaceManager } from '@agenui/agenui';
import { OpenUiTheme, OpenUiThemes } from './OpenUiTheme';

interface FactValue { label: string; value: string; }

/** Per-mount state, isolated by both engine instance and surface identity. */
export class OpenUiNativeSession {
  private static installed: boolean = false;
  private static mounted: Map<string, OpenUiNativeSession> = new Map<string, OpenUiNativeSession>();
  readonly manager: SurfaceManager;
  readonly surfaceId: string;
  readonly theme: OpenUiTheme;
  readonly readOnly: boolean;
  readonly selectedId: string;
  readonly expanded: Map<string, boolean>;
  active: boolean = true;
  constructor(manager: SurfaceManager, surfaceId: string, theme: OpenUiTheme, readOnly: boolean,
    selectedId: string, expanded: Map<string, boolean>) {
    this.manager = manager; this.surfaceId = surfaceId; this.theme = OpenUiThemes.copy(theme);
    this.readOnly = readOnly; this.selectedId = selectedId; this.expanded = expanded;
    if (!OpenUiNativeSession.installed) {
      for (const name of ['OpenUiOption', 'OpenUiFacts', 'OpenUiStatus', 'OpenUiDetails']) {
        AGenUI.registerComponent(name, (sid: string, id: string, type: string, pointer: bigint, instance: number): A2UIComponent =>
          new OpenUiNativeElement(sid, id, type, pointer, instance));
      }
      OpenUiNativeSession.installed = true;
    }
    OpenUiNativeSession.mounted.set(this.key(), this);
  }
  private key(): string { return this.manager.getInstanceId().toString() + ':' + this.surfaceId; }
  static find(instance: number, surface: string): OpenUiNativeSession | undefined {
    return OpenUiNativeSession.mounted.get(instance.toString() + ':' + surface);
  }
  current(): boolean { return this.active && OpenUiNativeSession.mounted.get(this.key()) === this; }
  dispatch(id: string): void {
    if (!this.current() || this.readOnly) { return; }
    this.manager.getSurface(this.surfaceId)?.getComponent(id, 'OpenUiOption').triggerAction();
  }
  dispose(): void {
    this.active = false;
    if (OpenUiNativeSession.mounted.get(this.key()) === this) { OpenUiNativeSession.mounted.delete(this.key()); }
  }
}

@Builder
function openUiElement(view: CustomView): void {
  Column() {
    if ((view as OpenUiNativeElement).getComponentType() === 'OpenUiOption') {
      Row({ space: 12 }) {
        Column({ space: 6 }) {
          Text((view as OpenUiNativeElement).heading).fontSize((view as OpenUiNativeElement).skin().dimensions.headline)
            .fontWeight(FontWeight.Medium).lineHeight(26).fontColor((view as OpenUiNativeElement).skin().palette.text)
            .width('100%').wordBreak(WordBreak.BREAK_WORD)
          if ((view as OpenUiNativeElement).supporting) {
            Text((view as OpenUiNativeElement).supporting).fontSize((view as OpenUiNativeElement).skin().dimensions.supporting)
              .lineHeight((view as OpenUiNativeElement).skin().dimensions.supportingLine)
              .fontColor((view as OpenUiNativeElement).skin().palette.secondary).width('100%').wordBreak(WordBreak.BREAK_WORD)
          }
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        if ((view as OpenUiNativeElement).metric) {
          Text((view as OpenUiNativeElement).metric).fontSize((view as OpenUiNativeElement).skin().dimensions.headline)
            .fontWeight(FontWeight.Medium).lineHeight(26).fontColor((view as OpenUiNativeElement).skin().palette.text)
            .constraintSize({ maxWidth: '38%' }).wordBreak(WordBreak.BREAK_WORD)
        }
        if ((view as OpenUiNativeElement).canAct() || (view as OpenUiNativeElement).isSelected()) {
          Text((view as OpenUiNativeElement).isSelected() ? '✓' : '○').fontSize(20)
            .fontColor((view as OpenUiNativeElement).skin().palette.accent)
        }
      }.width('100%').padding((view as OpenUiNativeElement).skin().dimensions.inset)
        .constraintSize({ minHeight: (view as OpenUiNativeElement).skin().dimensions.targetHeight })
        .borderRadius((view as OpenUiNativeElement).skin().dimensions.radius)
        .backgroundColor((view as OpenUiNativeElement).isSelected() ? (view as OpenUiNativeElement).skin().palette.accentContainer : (view as OpenUiNativeElement).skin().palette.surface)
        .border({ width: 1, color: (view as OpenUiNativeElement).isSelected() ? (view as OpenUiNativeElement).skin().palette.accent : (view as OpenUiNativeElement).skin().palette.divider })
        .accessibilityText((view as OpenUiNativeElement).heading + '，' + (view as OpenUiNativeElement).supporting + '，' + (view as OpenUiNativeElement).metric)
        .onClick((): void => { (view as OpenUiNativeElement).activate(); })
    } else if ((view as OpenUiNativeElement).getComponentType() === 'OpenUiFacts') {
      Column({ space: (view as OpenUiNativeElement).skin().dimensions.spacing }) {
        if ((view as OpenUiNativeElement).heading) {
          Text((view as OpenUiNativeElement).heading).fontSize((view as OpenUiNativeElement).skin().dimensions.body)
            .fontWeight(FontWeight.Medium).lineHeight((view as OpenUiNativeElement).skin().dimensions.bodyLine)
            .fontColor((view as OpenUiNativeElement).skin().palette.text).width('100%')
        }
        ForEach((view as OpenUiNativeElement).values, (fact: FactValue) => {
          Row({ space: 12 }) {
            Text(fact.label).width('28%').fontSize((view as OpenUiNativeElement).skin().dimensions.supporting)
              .lineHeight((view as OpenUiNativeElement).skin().dimensions.bodyLine)
              .fontColor((view as OpenUiNativeElement).skin().palette.secondary).wordBreak(WordBreak.BREAK_WORD)
            Text(fact.value).layoutWeight(1).fontSize((view as OpenUiNativeElement).skin().dimensions.body)
              .lineHeight((view as OpenUiNativeElement).skin().dimensions.bodyLine)
              .fontColor((view as OpenUiNativeElement).skin().palette.text).wordBreak(WordBreak.BREAK_WORD)
          }.width('100%').alignItems(VerticalAlign.Top)
        }, (fact: FactValue, index: number): string => index.toString() + ':' + fact.label)
      }.width('100%').alignItems(HorizontalAlign.Start).padding((view as OpenUiNativeElement).skin().dimensions.inset)
        .backgroundColor((view as OpenUiNativeElement).skin().palette.group).borderRadius((view as OpenUiNativeElement).skin().dimensions.radius)
    } else if ((view as OpenUiNativeElement).getComponentType() === 'OpenUiStatus') {
      Row({ space: 8 }) {
        Text('•').fontSize(18).fontColor((view as OpenUiNativeElement).statusInk())
        Text((view as OpenUiNativeElement).content).layoutWeight(1).fontSize((view as OpenUiNativeElement).skin().dimensions.supporting)
          .lineHeight((view as OpenUiNativeElement).skin().dimensions.supportingLine)
          .fontColor((view as OpenUiNativeElement).statusInk()).wordBreak(WordBreak.BREAK_WORD)
      }.width('100%').padding(12).backgroundColor((view as OpenUiNativeElement).statusFill())
        .borderRadius((view as OpenUiNativeElement).skin().dimensions.radius)
    } else if ((view as OpenUiNativeElement).getComponentType() === 'OpenUiDetails') {
      Column({ space: 8 }) {
        Row({ space: 12 }) {
          Text((view as OpenUiNativeElement).heading).layoutWeight(1).fontSize((view as OpenUiNativeElement).skin().dimensions.supporting)
            .lineHeight((view as OpenUiNativeElement).skin().dimensions.supportingLine)
            .fontColor((view as OpenUiNativeElement).skin().palette.secondary)
          Text((view as OpenUiNativeElement).isExpanded() ? '−' : '+').fontSize(20)
            .fontColor((view as OpenUiNativeElement).skin().palette.accent)
        }.width('100%').constraintSize({ minHeight: 44 }).onClick((): void => { (view as OpenUiNativeElement).toggle(); })
        if ((view as OpenUiNativeElement).isExpanded()) {
          Text((view as OpenUiNativeElement).content).width('100%').fontSize((view as OpenUiNativeElement).skin().dimensions.supporting)
            .lineHeight((view as OpenUiNativeElement).skin().dimensions.supportingLine)
            .fontColor((view as OpenUiNativeElement).skin().palette.secondary).wordBreak(WordBreak.BREAK_WORD)
        }
      }.width('100%').alignItems(HorizontalAlign.Start)
    }
  }.width(view.getProperty().getViewWidth() > 0 ? view.getProperty().getViewWidth() : '100%').height(undefined)
    .onSizeChange((_before: SizeOptions, after: SizeOptions): void => { (view as OpenUiNativeElement).sizeChanged(after); })
}

export class OpenUiNativeElement extends A2UIComponent {
  heading: string = ''; supporting: string = ''; metric: string = ''; content: string = ''; tone: string = 'neutral';
  values: FactValue[] = [];
  private interactive: boolean = false;
  private owner: OpenUiNativeSession | undefined;
  private fallbackTheme: OpenUiTheme = OpenUiThemes.create();
  private lastWidth: number = -1;
  private lastHeight: number = -1;
  constructor(surface: string, id: string, type: string, pointer: bigint, instance: number = 0) {
    super(surface, id, type, pointer, wrapBuilder<[CustomView]>(openUiElement), instance);
    this.owner = OpenUiNativeSession.find(instance, surface);
  }
  private plain(properties: A2UIComponentProps, key: string): string {
    const value = properties[key]; return typeof value === 'string' ? value : '';
  }
  protected onUpdateProperties(properties: A2UIComponentProps): void {
    this.heading = this.plain(properties, 'title'); this.supporting = this.plain(properties, 'description');
    this.metric = this.plain(properties, 'meta'); this.content = this.plain(properties, 'text');
    this.tone = this.plain(properties, 'tone'); this.interactive = properties['selectable'] === true;
    const rows = properties['facts'] as FactValue[] | undefined;
    this.values = Array.isArray(rows) ? rows.map((row: FactValue): FactValue => ({ label: row.label, value: row.value })) : [];
  }
  skin(): OpenUiTheme { return this.owner?.theme ?? this.fallbackTheme; }
  isSelected(): boolean { return this.owner?.selectedId === this.getNodeId(); }
  canAct(): boolean { return this.interactive && this.owner !== undefined && this.owner.current() && !this.owner.readOnly; }
  activate(): void { if (this.canAct()) { this.owner?.dispatch(this.getNodeId()); } }
  isExpanded(): boolean { return this.owner?.expanded.get(this.getNodeId()) === true; }
  toggle(): void {
    if (!this.owner?.current()) { return; }
    this.owner.expanded.set(this.getNodeId(), !this.isExpanded()); this.updateArkUI();
  }
  statusInk(): string {
    const palette = this.skin().palette;
    return this.tone === 'success' ? palette.positive : this.tone === 'warning' ? palette.caution : palette.secondary;
  }
  statusFill(): string {
    const palette = this.skin().palette;
    return this.tone === 'success' ? palette.positiveContainer : this.tone === 'warning' ? palette.cautionContainer : palette.group;
  }
  sizeChanged(size: SizeOptions): void {
    const width = size.width as number; const height = size.height as number;
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ||
      (width === this.lastWidth && height === this.lastHeight)) { return; }
    this.lastWidth = width; this.lastHeight = height; this.reportContentHeight(height, width);
  }
}
