// SPDX-License-Identifier: Apache-2.0
import { OpenUiTheme, OpenUiThemes } from './OpenUiTheme';
import { OpenUiRenderDiagnostics } from './OpenUiRenderDiagnostics';
export interface OpenUiFactValue { label: string; value: string; }

/** Reactive native semantic content and its actual intrinsic ArkUI measurement. */
@Component
export struct OpenUiIntrinsicLayout {
  @Prop widthHint: number = 0;
  @Prop revision: number = 0;
  @Prop kind: string = '';
  @Prop title: string = '';
  @Prop description: string = '';
  @Prop meta: string = '';
  @Prop text: string = '';
  @Prop tone: string = 'neutral';
  @Prop selected: boolean = false;
  @Prop selectable: boolean = false;
  @Prop expanded: boolean = false;
  @Prop values: OpenUiFactValue[] = [];
  @Prop theme: OpenUiTheme = OpenUiThemes.create();
  onAction: () => void = (): void => {};
  onToggle: () => void = (): void => {};
  onMeasured: (size: SizeResult) => void = (_size: SizeResult): void => {};
  onMeasureSize(_self: GeometryInfo, children: Array<Measurable>, constraint: ConstraintSizeOptions): SizeResult {
    const available = constraint.maxWidth;
    OpenUiRenderDiagnostics.log('measure kind=' + this.kind + ' revision=' + this.revision.toString() + ' titleLen=' + this.title.length.toString() +
      ' children=' + children.length.toString() + ' maxWidth=' + String(available) + ' maxHeight=' + String(constraint.maxHeight) + ' hint=' + this.widthHint.toString());
    const constrained = typeof available === 'number' && Number.isFinite(available) && available > 0 ? available : this.widthHint;
    const width = this.widthHint > 0 ? Math.min(constrained, this.widthHint) : constrained;
    if (!children.length || !Number.isFinite(width) || width <= 0) { return { width: 0, height: 0 }; }
    // The C++ hybrid parent initially has height 0. Preserve its actual width,
    // but let ArkUI measure the complete Facts/Details/text content vertically.
    // Passing larger maxHeight alone cannot raise the inherited native bound.
    // The direct child's fixAtIdealSize policy below enables ArkUI's custom
    // layout escape from that bound; the returned height is still measured.
    const heightLimit = 1000000;
    const childConstraint: ConstraintSizeOptions = { minWidth: width, maxWidth: width, minHeight: 0, maxHeight: heightLimit };
    OpenUiRenderDiagnostics.log('measureRange maxHeight=' + heightLimit.toString());
    const measured = children[0].measure(childConstraint);
    const result: SizeResult = { width: measured.width, height: measured.height };
    OpenUiRenderDiagnostics.log('measured kind=' + this.kind + ' width=' + result.width.toString() + ' height=' + result.height.toString());
    this.onMeasured(result);
    return result;
  }
  onPlaceChildren(_self: GeometryInfo, children: Array<Layoutable>, _constraint: ConstraintSizeOptions): void {
    for (const child of children) { child.layout({ x: 0, y: 0 }); }
  }
  private statusInk(): string {
    return this.tone === 'success' ? this.theme.palette.positive : this.tone === 'warning' ? this.theme.palette.caution : this.theme.palette.secondary;
  }
  private statusFill(): string {
    return this.tone === 'success' ? this.theme.palette.positiveContainer : this.tone === 'warning' ? this.theme.palette.cautionContainer : this.theme.palette.group;
  }
  build() {
  Column() {
    if (this.kind === 'OpenUiOption') {
      Row({ space: 12 }) {
        Column({ space: 6 }) {
          Text(this.title).fontSize(this.theme.dimensions.headline)
            .fontWeight(FontWeight.Medium).lineHeight(26).fontColor(this.theme.palette.text)
            .width('100%').wordBreak(WordBreak.BREAK_WORD)
          if (this.description) {
            Text(this.description).fontSize(this.theme.dimensions.supporting)
              .lineHeight(this.theme.dimensions.supportingLine)
              .fontColor(this.theme.palette.secondary).width('100%').wordBreak(WordBreak.BREAK_WORD)
          }
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        if (this.meta) {
          Text(this.meta).fontSize(this.theme.dimensions.headline)
            .fontWeight(FontWeight.Medium).lineHeight(26).fontColor(this.theme.palette.text)
            .constraintSize({ maxWidth: '38%' }).wordBreak(WordBreak.BREAK_WORD)
        }
        if (this.selectable || this.selected) {
          Text(this.selected ? '✓' : '○').fontSize(20)
            .fontColor(this.theme.palette.accent)
        }
      }.width('100%').padding(this.theme.dimensions.inset)
        .constraintSize({ minHeight: this.theme.dimensions.targetHeight })
        .borderRadius(this.theme.dimensions.radius)
        .backgroundColor(this.selected ? this.theme.palette.accentContainer : this.theme.palette.surface)
        .border({ width: 1, color: this.selected ? this.theme.palette.accent : this.theme.palette.divider })
        .accessibilityText(this.title + '，' + this.description + '，' + this.meta)
        .onClick((): void => { this.onAction(); })
    } else if (this.kind === 'OpenUiFacts') {
      Column({ space: this.theme.dimensions.spacing }) {
        if (this.title) {
          Text(this.title).fontSize(this.theme.dimensions.body)
            .fontWeight(FontWeight.Medium).lineHeight(this.theme.dimensions.bodyLine)
            .fontColor(this.theme.palette.text).width('100%')
        }
        ForEach(this.values, (fact: OpenUiFactValue) => {
          Row({ space: 12 }) {
            Text(fact.label).width('28%').fontSize(this.theme.dimensions.supporting)
              .lineHeight(this.theme.dimensions.bodyLine)
              .fontColor(this.theme.palette.secondary).wordBreak(WordBreak.BREAK_WORD)
            Text(fact.value).layoutWeight(1).fontSize(this.theme.dimensions.body)
              .lineHeight(this.theme.dimensions.bodyLine)
              .fontColor(this.theme.palette.text).wordBreak(WordBreak.BREAK_WORD)
          }.width('100%').alignItems(VerticalAlign.Top)
        }, (fact: OpenUiFactValue, index: number): string => index.toString() + ':' + fact.label + ':' + fact.value)
      }.width('100%').alignItems(HorizontalAlign.Start).padding(this.theme.dimensions.inset)
        .backgroundColor(this.theme.palette.group).borderRadius(this.theme.dimensions.radius)
    } else if (this.kind === 'OpenUiStatus') {
      Row({ space: 8 }) {
        Text('•').fontSize(18).fontColor(this.statusInk())
        Text(this.text).layoutWeight(1).fontSize(this.theme.dimensions.supporting)
          .lineHeight(this.theme.dimensions.supportingLine)
          .fontColor(this.statusInk()).wordBreak(WordBreak.BREAK_WORD)
      }.width('100%').padding(12).backgroundColor(this.statusFill())
        .borderRadius(this.theme.dimensions.radius)
    } else if (this.kind === 'OpenUiDetails') {
      Column({ space: 8 }) {
        Row({ space: 12 }) {
          Text(this.title).layoutWeight(1).fontSize(this.theme.dimensions.supporting)
            .lineHeight(this.theme.dimensions.supportingLine)
            .fontColor(this.theme.palette.secondary)
          Text(this.expanded ? '−' : '+').fontSize(20)
            .fontColor(this.theme.palette.accent)
        }.width('100%').constraintSize({ minHeight: 44 }).onClick((): void => { this.onToggle(); })
        if (this.expanded) {
          Text(this.text).width('100%').fontSize(this.theme.dimensions.supporting)
            .lineHeight(this.theme.dimensions.supportingLine)
            .fontColor(this.theme.palette.secondary).wordBreak(WordBreak.BREAK_WORD)
        }
      }.width('100%').alignItems(HorizontalAlign.Start)
    }
  }.width('100%').constraintSize({ maxWidth: this.widthHint > 0 ? this.widthHint : undefined }).height(LayoutPolicy.fixAtIdealSize)
  }
}
