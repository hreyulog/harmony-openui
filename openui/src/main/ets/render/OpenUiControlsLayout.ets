// SPDX-License-Identifier: Apache-2.0
import { OpenUiFieldValue, OpenUiListItem, OpenUiSelectOption } from '../core/OpenUiTypes';
import { OpenUiControlModel, OpenUiControlState } from './OpenUiControlModel';
import { OpenUiTheme, OpenUiThemes } from './OpenUiTheme';

/** Precompiled ArkUI controls; the model supplies data, never ArkTS or builders. */
@Component
export struct OpenUiControlsLayout {
  @Prop widthHint: number = 0;
  @Prop revision: number = 0;
  @Prop kind: string = '';
  @Prop nodeId: string = '';
  @Prop label: string = '';
  @Prop title: string = '';
  @Prop text: string = '';
  @Prop placeholder: string = '';
  @Prop variant: string = '';
  @Prop inputKind: string = 'text';
  @Prop stringValue: string = '';
  @Prop @Watch('receivedControl') controlState: string = '';
  @Prop numberValue: number = 0;
  @Prop boolValue: boolean = false;
  @Prop required: boolean = false;
  @Prop disabled: boolean = false;
  @Prop fieldError: string = '';
  @Prop options: OpenUiSelectOption[] = [];
  @Prop minimum: number = 0;
  @Prop maximum: number = 100;
  @Prop step: number = 1;
  @Prop minDate: string = '';
  @Prop maxDate: string = '';
  @Prop source: string = '';
  @Prop alt: string = '';
  @Prop aspect: number = 1.7777778;
  @Prop items: OpenUiListItem[] = [];
  @Prop viewportHeight: number = 240;
  @Prop confirmLabel: string = '确认 / Confirm';
  @Prop cancelLabel: string = '取消 / Cancel';
  @Prop theme: OpenUiTheme = OpenUiThemes.create();
  @State private dialogVisible: boolean = false;
  @State private failedSource: string = '';
  @State private selectedDate: Date = new Date();
  @State private selectedTime: Date = new Date(2000, 0, 1);
  @State private liveStringValue: string = '';
  @State private liveNumberValue: number = 0;
  @State private liveBoolValue: boolean = false;
  private nativeValue: OpenUiFieldValue = '';
  onString: (value: string) => void = (_value: string): void => {};
  onNumber: (value: number) => void = (_value: number): void => {};
  onBoolean: (value: boolean) => void = (_value: boolean): void => {};
  onAction: () => void = (): void => {};
  canOpen: () => boolean = (): boolean => false;
  onModalReady: (close: () => void) => void = (_close: () => void): void => {};
  onMeasured: (size: SizeResult) => void = (_size: SizeResult): void => {};
  aboutToAppear(): void {
    const value: OpenUiFieldValue = this.kind === 'OpenUiSlider' ? this.numberValue :
      this.kind === 'OpenUiCheckbox' || this.kind === 'OpenUiToggle' ? this.boolValue : this.stringValue;
    this.storeVisibleValue(value);
    this.selectedDate = OpenUiControlModel.date(this.stringValue, new Date());
    this.selectedTime = OpenUiControlModel.time(this.stringValue);
    this.onModalReady((): void => { this.dialogVisible = false; });
  }
  aboutToDisappear(): void { this.dialogVisible = false; }
  private receivedControl(): void {
    if (!this.controlState) { return; }
    const state = JSON.parse(this.controlState) as OpenUiControlState;
    if (state.value === this.nativeValue) { return; }
    // One atomic prop prevents Watch ordering from applying an old value when
    // revision and value change together, and handles a host rollback to the
    // previous prop string after the native wheel has moved independently.
    this.storeVisibleValue(state.value);
    if (this.kind === 'OpenUiDatePicker') { this.selectedDate = OpenUiControlModel.date(this.liveStringValue, new Date()); }
    if (this.kind === 'OpenUiTimePicker') { this.selectedTime = OpenUiControlModel.time(this.liveStringValue); }
  }
  private storeVisibleValue(value: OpenUiFieldValue): void {
    this.nativeValue = value;
    this.liveStringValue = typeof value === 'string' ? value : '';
    this.liveNumberValue = typeof value === 'number' ? value : 0;
    this.liveBoolValue = value === true;
  }
  private changedString(value: string): void { this.storeVisibleValue(value); this.onString(value); }
  private changedNumber(value: number): void { this.storeVisibleValue(value); this.onNumber(value); }
  private changedBoolean(value: boolean): void { this.storeVisibleValue(value); this.onBoolean(value); }
  private changedDate(value: Date): void {
    this.changedString(OpenUiControlModel.dateText(value));
  }
  private changedTime(value: TimePickerResult): void {
    const previous = OpenUiControlModel.time(this.liveStringValue);
    this.changedString((value.hour ?? previous.getHours()).toString().padStart(2, '0') + ':' +
      (value.minute ?? previous.getMinutes()).toString().padStart(2, '0'));
  }
  onMeasureSize(_self: GeometryInfo, children: Array<Measurable>, constraint: ConstraintSizeOptions): SizeResult {
    const available = constraint.maxWidth;
    const constrained = typeof available === 'number' && Number.isFinite(available) && available > 0 ? available : this.widthHint;
    const width = this.widthHint > 0 ? Math.min(constrained, this.widthHint) : constrained;
    if (!children.length || !Number.isFinite(width) || width <= 0) { return { width: 0, height: 0 }; }
    const measured = children[0].measure({ minWidth: width, maxWidth: width, minHeight: 0, maxHeight: 1000000 });
    const size: SizeResult = { width: measured.width, height: measured.height };
    this.onMeasured(size); return size;
  }
  onPlaceChildren(_self: GeometryInfo, children: Array<Layoutable>, _constraint: ConstraintSizeOptions): void {
    for (const child of children) { child.layout({ x: 0, y: 0 }); }
  }
  private inputType(): InputType {
    return this.inputKind === 'number' ? InputType.Number : this.inputKind === 'email' ? InputType.Email : this.inputKind === 'tel' ? InputType.PhoneNumber : InputType.Normal;
  }
  private selectedIndex(): number { return this.options.findIndex((option: OpenUiSelectOption): boolean => option.value === this.liveStringValue); }
  private selectedLabel(): string { return this.options.find((option: OpenUiSelectOption): boolean => option.value === this.liveStringValue)?.label ?? this.placeholder; }
  private radioAccessibilityText(option: OpenUiSelectOption): string {
    return this.label + '，' + option.label + (option.description ? '，' + option.description : '');
  }
  private selectRadio(value: string): void {
    if (this.disabled || this.liveStringValue === value ||
      !this.options.some((option: OpenUiSelectOption): boolean => option.value === value)) { return; }
    // Both the row click and the native Radio change may describe one tap.
    // Update the local controlled value before forwarding the existing edit.
    this.changedString(value);
  }
  @Builder
  private heading() {
    if (this.label) {
      Text(this.label + (this.required ? ' *' : '')).fontSize(this.theme.dimensions.supporting + 1).fontWeight(FontWeight.Medium)
        .fontColor(this.theme.palette.text).width('100%').wordBreak(WordBreak.BREAK_WORD)
    }
  }
  @Builder
  private confirmation() {
    Column({ space: 16 }) {
      Text(this.title).fontSize(this.theme.dimensions.headline).fontWeight(FontWeight.Medium).fontColor(this.theme.palette.text).width('100%')
      Text(this.text).fontSize(this.theme.dimensions.body).fontColor(this.theme.palette.secondary).width('100%').wordBreak(WordBreak.BREAK_WORD)
      Row({ space: 12 }) {
        Button(this.cancelLabel).layoutWeight(1).height(48).fontColor(this.theme.palette.text).backgroundColor(this.theme.palette.group)
          .onClick((): void => { this.dialogVisible = false; })
        Button(this.confirmLabel).layoutWeight(1).height(48).enabled(!this.disabled)
          .fontColor('#FFFFFF').backgroundColor(this.theme.palette.accent)
          .onClick((): void => { this.dialogVisible = false; if (!this.disabled) { this.onAction(); } })
      }.width('100%')
    }.width('100%').padding(24).backgroundColor(this.theme.palette.surface)
  }
  build() {
    Column({ space: 6 }) {
      if (this.kind === 'OpenUiInput') {
        this.heading()
        if (this.variant === 'textarea') {
          TextArea({ text: this.liveStringValue, placeholder: this.placeholder }).id(this.nodeId).width('100%').height(108)
            .fontSize(this.theme.dimensions.body).fontColor(this.theme.palette.text).backgroundColor(this.theme.palette.group)
            .borderRadius(12).padding(12).border({ width: 1, color: this.theme.palette.divider })
            .accessibilityText(this.label)
            .enabled(!this.disabled).onChange((value: string): void => { this.changedString(value); })
        } else if (this.variant === 'search') {
          Search({ value: this.liveStringValue, placeholder: this.placeholder }).id(this.nodeId).width('100%').height(48)
            .fontColor(this.theme.palette.text).backgroundColor(this.theme.palette.group).enabled(!this.disabled)
            .borderRadius(12).border({ width: 1, color: this.theme.palette.divider })
            .accessibilityText(this.label)
            .onChange((value: string): void => { this.changedString(value); })
        } else {
          TextInput({ text: this.liveStringValue, placeholder: this.placeholder }).id(this.nodeId).width('100%').height(48)
            .type(this.inputType()).fontSize(this.theme.dimensions.body).fontColor(this.theme.palette.text)
            .borderRadius(12).padding({ left: 14, right: 14 }).border({ width: 1, color: this.theme.palette.divider })
            .accessibilityText(this.label)
            .backgroundColor(this.theme.palette.group).enabled(!this.disabled).onChange((value: string): void => { this.changedString(value); })
        }
      } else if (this.kind === 'OpenUiCheckbox' || this.kind === 'OpenUiToggle') {
        Row({ space: 12 }) {
          if (this.kind === 'OpenUiToggle') {
            Text(this.label + (this.required ? ' *' : '')).layoutWeight(1).fontSize(this.theme.dimensions.body)
              .fontColor(this.theme.palette.text).wordBreak(WordBreak.BREAK_WORD)
          }
          if (this.kind === 'OpenUiCheckbox') {
            Checkbox({ name: this.nodeId }).id(this.nodeId).select(this.liveBoolValue).enabled(!this.disabled)
              .accessibilityText(this.label)
              .selectedColor(this.theme.palette.accent).onChange((value: boolean): void => { this.changedBoolean(value); })
          } else {
            Toggle({ type: ToggleType.Switch, isOn: this.liveBoolValue }).id(this.nodeId).enabled(!this.disabled)
              .accessibilityText(this.label)
              .selectedColor(this.theme.palette.accent).onChange((value: boolean): void => { this.changedBoolean(value); })
          }
          if (this.kind === 'OpenUiCheckbox') {
            Text(this.label + (this.required ? ' *' : '')).layoutWeight(1).fontSize(this.theme.dimensions.body)
              .fontColor(this.theme.palette.text).wordBreak(WordBreak.BREAK_WORD)
          }
        }.width('100%').constraintSize({ minHeight: 48 })
      } else if (this.kind === 'OpenUiSelect') {
        this.heading()
        Select(this.options.map((option: OpenUiSelectOption): SelectOption => ({ value: option.label })))
          .id(this.nodeId).width('100%').height(48).selected(this.selectedIndex()).value(this.selectedLabel())
          .fontColor(this.theme.palette.text).backgroundColor(this.theme.palette.group).enabled(!this.disabled)
          .borderRadius(12).border({ width: 1, color: this.theme.palette.divider })
          .accessibilityText(this.label)
          .onSelect((index: number): void => { if (index >= 0 && index < this.options.length) { this.changedString(this.options[index].value); } })
      } else if (this.kind === 'OpenUiRadioGroup') {
        this.heading()
        ForEach(this.options, (option: OpenUiSelectOption) => {
          Row({ space: 8 }) {
            Radio({ value: option.value, group: this.nodeId }).id(this.nodeId + '-' + option.value)
              .checked(this.liveStringValue === option.value).enabled(!this.disabled)
              .accessibilityText(this.radioAccessibilityText(option))
              .onChange((checked: boolean): void => { if (checked) { this.selectRadio(option.value); } })
            Column({ space: 4 }) {
              Text(option.label).width('100%').fontSize(this.theme.dimensions.body).fontColor(this.theme.palette.text)
                .wordBreak(WordBreak.BREAK_WORD)
              if (option.description) {
                Text(option.description).width('100%').fontSize(this.theme.dimensions.supporting)
                  .lineHeight(this.theme.dimensions.supportingLine).fontColor(this.theme.palette.secondary)
                  .wordBreak(WordBreak.BREAK_WORD)
              }
            }.layoutWeight(1).alignItems(HorizontalAlign.Start)
          }.width('100%').alignItems(VerticalAlign.Top).padding(12).constraintSize({ minHeight: 48 })
            .backgroundColor(this.liveStringValue === option.value ? this.theme.palette.accentContainer : this.theme.palette.group)
            .borderRadius(12).border({ width: 1, color: this.liveStringValue === option.value ? this.theme.palette.accent : this.theme.palette.divider })
            .enabled(!this.disabled).onClick((): void => { this.selectRadio(option.value); })
        }, (option: OpenUiSelectOption): string => option.value)
      } else if (this.kind === 'OpenUiSlider') {
        this.heading()
        Text(this.liveNumberValue.toString()).fontColor(this.theme.palette.secondary).fontSize(this.theme.dimensions.supporting)
        Slider({ value: this.liveNumberValue, min: this.minimum, max: this.maximum, step: this.step })
          .id(this.nodeId).width('100%').height(48).enabled(!this.disabled)
          .onChange((value: number): void => { this.changedNumber(value); })
      } else if (this.kind === 'OpenUiDatePicker') {
        this.heading()
        if (!this.liveStringValue) { Text('请选择日期 / Choose a date').fontSize(this.theme.dimensions.supporting).fontColor(this.theme.palette.secondary) }
        CalendarPicker({ selected: this.selectedDate,
          start: OpenUiControlModel.date(this.minDate || '0001-01-01', new Date()), end: OpenUiControlModel.date(this.maxDate || '5000-12-31', new Date()) })
          .id(this.nodeId).width('100%').height(48).enabled(!this.disabled)
          .textStyle({ color: this.theme.palette.text, font: { size: this.theme.dimensions.body } })
          .onChange((value: Date): void => { this.changedDate(value); })
      } else if (this.kind === 'OpenUiTimePicker') {
        this.heading()
        if (!this.liveStringValue) { Text('请选择时间 / Choose a time').fontSize(this.theme.dimensions.supporting).fontColor(this.theme.palette.secondary) }
        TimePicker({ selected: this.selectedTime }).id(this.nodeId).width('100%').height(180)
          .useMilitaryTime(true).enabled(!this.disabled).selectedTextStyle({ color: this.theme.palette.text, font: { size: 18 } })
          .onChange((value: TimePickerResult): void => { this.changedTime(value); })
      } else if (this.kind === 'OpenUiImage') {
        Stack() {
          if (this.failedSource !== this.source) {
            Image(this.source).width('100%').height('100%').objectFit(ImageFit.Cover).accessibilityText(this.alt)
              .onError((): void => { this.failedSource = this.source; })
          } else {
            Text(this.alt).padding(16).fontSize(this.theme.dimensions.supporting).fontColor(this.theme.palette.secondary)
          }
        }.width('100%').aspectRatio(this.aspect).backgroundColor(this.theme.palette.group)
          .borderRadius(this.theme.dimensions.radius).clip(true).accessibilityText(this.alt)
      } else if (this.kind === 'OpenUiList') {
        if (this.title) { Text(this.title).fontSize(this.theme.dimensions.body).fontWeight(FontWeight.Medium).fontColor(this.theme.palette.text).width('100%') }
        List({ space: 8 }) {
          ForEach(this.items, (item: OpenUiListItem) => {
            ListItem() {
              Row({ space: 12 }) {
                Column({ space: 4 }) {
                  Text(item.title).fontSize(this.theme.dimensions.body).fontColor(this.theme.palette.text).width('100%')
                  if (item.description) { Text(item.description).fontSize(this.theme.dimensions.supporting).fontColor(this.theme.palette.secondary).width('100%') }
                }.layoutWeight(1).alignItems(HorizontalAlign.Start)
                if (item.meta) { Text(item.meta).constraintSize({ maxWidth: '35%' }).fontColor(this.theme.palette.secondary).fontSize(this.theme.dimensions.supporting) }
              }.width('100%').padding(12).backgroundColor(this.theme.palette.group).borderRadius(this.theme.dimensions.radius)
            }
          }, (_item: OpenUiListItem, index: number): string => index.toString())
        }.id(this.nodeId).width('100%').height(this.viewportHeight).scrollBar(BarState.Auto)
      } else if (this.kind === 'OpenUiDialog') {
        Button(this.label).id(this.nodeId).width('100%').height(48).enabled(!this.disabled)
          .fontColor(this.theme.palette.accent).backgroundColor(this.theme.palette.accentContainer)
          .onClick((): void => { if (!this.disabled && this.canOpen()) { this.dialogVisible = true; } })
          .bindSheet($$this.dialogVisible, this.confirmation(), { height: SheetSize.FIT_CONTENT, showClose: true,
            onDisappear: (): void => { this.dialogVisible = false; } })
      }
      if (this.fieldError) {
        Text(this.fieldError).fontSize(this.theme.dimensions.supporting).fontColor(this.theme.palette.caution).width('100%').accessibilityText(this.fieldError)
      }
    }.width('100%').alignItems(HorizontalAlign.Start)
      .constraintSize({ maxWidth: this.widthHint > 0 ? this.widthHint : undefined }).height(LayoutPolicy.fixAtIdealSize)
  }
}
