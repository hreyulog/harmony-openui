// SPDX-License-Identifier: Apache-2.0
import { common } from '@kit.AbilityKit';
import fs from '@ohos.file.fs';
import router from '@ohos.router';
import { OpenUiController, OpenUiActionReceipt, OpenUiComponent, OpenUiFieldChange, OpenUiSelectOption,
  OpenUiLanguageStream, OpenUiView, OpenUiThemes, OpenUiTheme } from '@hreyulog/harmony-openui';
import { DemoModel, DemoModelConfig } from '../model/DemoModel';

const TRIP: string = 'root = Stack([heading, note, form])\n' +
  'heading = Text("准备一次出行", "heading")\n' +
  'note = Text("虚构演示 · 填写后继续，不查询或购买车票", "caption")\n' +
  'form = Form("trip", [traveler, destination, seat, date, next])\n' +
  'traveler = TextInput("traveler", "乘车人", "", "请输入姓名", true)\n' +
  'destination = Search("destination", "目的地", "上海", "城市名称", true)\n' +
  'seat = Select("seat", "席别", [{label:"二等座",value:"second"},{label:"一等座",value:"first"}], "second", true)\n' +
  'date = DatePicker("date", "出发日期", "2026-10-23", "2026-10-20", "2027-12-31", true)\n' +
  'next = Button("继续设置偏好", @Submit("trip"))';
const PREFERENCES: string = 'root = Stack([heading, form])\n' +
  'heading = Text("设置出行偏好", "heading")\n' +
  'form = Form("preferences", [note, direct, remind, position, budget, time, confirm])\n' +
  'note = TextArea("note", "行程备注", "", "例如：携带大件行李")\n' +
  'direct = Checkbox("direct", "优先直达", true)\n' +
  'remind = Toggle("remind", "需要出发提醒", true)\n' +
  'position = RadioGroup("position", "座位偏好", [{label:"靠窗",value:"window"},{label:"过道",value:"aisle"}], "window", true)\n' +
  'budget = Slider("budget", "预算上限（元）", 500, 100, 1000, 50)\n' +
  'time = TimePicker("time", "期望出发时间", "08:00", true)\n' +
  'confirm = Dialog("确认偏好", "完成演示资料", "只回传表单并展示结果，不会购买或付款。", @Submit("preferences"), "确认并查看", "再改一下")';
const BANNER: string = 'https://raw.githubusercontent.com/hreyulog/harmony-openui/be5bfd9a4310d80406c4330a4fbb1120607226c1/docs/images/harmony-openui-banner.png';

@Entry
@Component
struct Forms {
  @State theme: OpenUiTheme = OpenUiThemes.create('light');
  @State status: string = '第 1 步 · 填写出行资料';
  @State busy: boolean = false;
  @State readOnly: boolean = false;
  @State stage: number = 1;
  private filesDir: string = '';
  private epoch: number = 0;
  private actualModel: boolean = false;
  private source: string = TRIP;
  private trip: Record<string, Object> = {};
  private preferences: Record<string, Object> = {};
  private actions: OpenUiActionReceipt[] = [];
  private edits: number = 0;
  private observer: number = 0;
  private config: DemoModelConfig = { endpoint: '', model: '', apiKey: '', protocol: 'anthropic' };
  private scroller: Scroller = new Scroller();
  private controller: OpenUiController = new OpenUiController({
    onAction: (event: OpenUiActionReceipt): void => { void this.submitted(event); },
    onFieldChange: (_event: OpenUiFieldChange): void => { this.edits++; this.persist(); },
    onRenderStatus: (): void => { this.persist(); },
    validationMessage: (code: string, component: OpenUiComponent): string => {
      const label = component.label ?? '此项';
      if (code === 'required') { return '请填写或选择' + label; }
      if (code === 'date') { return label + '请选择有效日期'; }
      if (code === 'time') { return label + '请选择有效时间'; }
      if (code === 'email') { return label + '请输入有效邮箱'; }
      if (code === 'range' || code === 'step') { return label + '超出允许范围'; }
      return label + '的内容无效，请重新填写';
    }
  });
  private language: OpenUiLanguageStream = new OpenUiLanguageStream(this.controller, 'forms');
  aboutToAppear(): void {
    this.filesDir = (getContext(this) as common.UIAbilityContext).filesDir;
    if (this.observer) { this.controller.unsubscribe(this.observer); }
    this.observer = this.controller.subscribe((): void => { this.persist(); });
    try { this.config = JSON.parse(fs.readTextSync(this.filesDir + '/model-config.json')) as DemoModelConfig; } catch (_) {}
    this.reset();
  }
  aboutToDisappear(): void {
    this.epoch++; this.controller.unsubscribe(this.observer); this.observer = 0;
  }
  private persist(): void {
    if (!this.filesDir) { return; }
    try {
      const file = fs.openSync(this.filesDir + '/openui-forms-state.json', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      try {
        fs.writeSync(file.fd, JSON.stringify({ stage: this.stage, status: this.status, busy: this.busy,
          actualModel: this.actualModel, edits: this.edits, actions: this.actions, trip: this.trip,
          preferences: this.preferences, source: this.source, snapshot: JSON.parse(this.controller.exportSnapshot()) }));
      } finally { fs.closeSync(file); }
    } catch (_) {}
  }
  private show(source: string): void {
    this.language = new OpenUiLanguageStream(this.controller, 'forms');
    this.language.replace(source); this.source = source;
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0 }); this.persist();
  }
  private verifyModelProgram(source: string, result: boolean): void {
    // Business requirements belong to this demo host, not to the reusable SDK.
    const candidate = new OpenUiController();
    new OpenUiLanguageStream(candidate, 'candidate').replace(source);
    const nodes = candidate.getSurface('candidate')!.components;
    if (result) {
      if (nodes.some((node: OpenUiComponent): boolean => !!node.action || node.component === 'OpenUiForm') ||
        ['OpenUiStatus', 'OpenUiFacts', 'OpenUiList', 'OpenUiImage'].some((kind: string): boolean =>
          !nodes.some((node: OpenUiComponent): boolean => node.component === kind))) {
        throw new Error('模型结果未满足只读结果目录，请重试确认');
      }
      return;
    }
    const forms = nodes.filter((node: OpenUiComponent): boolean => node.component === 'OpenUiForm');
    if (forms.length !== 1 || forms[0].name !== 'trip') { throw new Error('模型未生成所需出行表单，请重试'); }
    for (const field of ['traveler', 'destination', 'seat', 'date']) {
      const node = nodes.find((item: OpenUiComponent): boolean => item.field === field);
      const kind = field === 'seat' ? 'OpenUiSelect' : field === 'date' ? 'OpenUiDatePicker' : 'OpenUiInput';
      if (!node || node.component !== kind || !node.required || node.disabled ||
        !Object.keys(candidate.getFormValues('candidate', 'trip')).includes(field)) {
        throw new Error('模型表单缺少必要字段：' + field + '，请重试');
      }
      if (field === 'seat' && (node.options?.length !== 2 ||
        !node.options?.some((option: OpenUiSelectOption): boolean => option.value === 'first') ||
        !node.options?.some((option: OpenUiSelectOption): boolean => option.value === 'second'))) {
        throw new Error('模型表单席别不符合演示要求，请重试');
      }
    }
    if (!nodes.some((node: OpenUiComponent): boolean => node.action?.event.name === 'submit' &&
      node.action?.event.context['form'] === 'trip')) { throw new Error('模型表单缺少提交操作，请重试'); }
  }
  private reset(): void {
    this.epoch++; this.busy = false; this.readOnly = false; this.actualModel = false;
    this.stage = 1; this.trip = {}; this.preferences = {}; this.actions = []; this.edits = 0;
    // A new run deliberately discards the previous run's edited values.
    this.controller.apply({ kind: 'delete', surfaceId: 'forms' });
    this.language = new OpenUiLanguageStream(this.controller, 'forms');
    this.status = '第 1 步 · 填写出行资料'; this.show(TRIP);
  }
  private async generate(): Promise<void> {
    if (this.busy) { return; }
    this.reset(); const generation = ++this.epoch;
    this.busy = true; this.actualModel = true; this.controller.setReadOnly('forms', true);
    this.status = '模型正在生成出行表单…'; this.persist();
    try {
      const source = await DemoModel.generate(this.config, OpenUiLanguageStream.systemPrompt(),
        '生成中文出行资料表单，全部数据仅演示，不得声称查询或买票。root用Stack。' +
        '必须包含Form("trip",...)及以下字段：TextInput traveler乘车人初始空字符串且required=true；' +
        'Search destination目的地初始上海且必填；Select seat二等座second/一等座first默认second且required=true；' +
        'DatePicker date出发日期2026-10-23、范围2026-10-20至2027-12-31且required=true。' +
        '最后Button("继续设置偏好",@Submit("trip"))。不要增加其他操作或Form，只输出OpenUI Lang。');
      if (generation !== this.epoch) { return; }
      this.verifyModelProgram(source, false); this.show(source); this.status = '模型表单已生成 · 填写后继续';
    } catch (error) { if (generation === this.epoch) { this.status = (error as Error).message; } }
    finally {
      if (generation === this.epoch) {
        this.busy = false; this.controller.setReadOnly('forms', false); this.persist();
      }
    }
  }
  private async submitted(event: OpenUiActionReceipt): Promise<void> {
    if (this.busy || event.name !== 'submit') { return; }
    const form = event.context['form'] as string;
    const fields = event.context['fields'] as Record<string, Object>;
    if (this.stage === 1 && form === 'trip') {
      this.actions.push(event); this.trip = fields; this.stage = 2;
      this.status = '第 2 步 · 原生选择与确认弹层'; this.show(PREFERENCES); return;
    }
    if (this.stage !== 2 || form !== 'preferences') { return; }
    this.actions.push(event); this.preferences = fields;
    const generation = ++this.epoch; this.busy = true; this.controller.setReadOnly('forms', true);
    this.status = this.actualModel ? '模型正在根据已提交资料生成结果…' : '正在整理演示结果…'; this.persist();
    try {
      const result = this.actualModel ? await DemoModel.generate(this.config, OpenUiLanguageStream.systemPrompt(),
        '根据以下用户实际提交的演示资料生成中文只读结果：' + JSON.stringify({ trip: this.trip, preferences: this.preferences }) +
        '。必须标注演示已完成、未查询未下单。root使用Stack；使用Status、Facts展示用户值；' +
        '用List展示两条后续建议；用Image展示项目横幅，alt为Harmony OpenUI项目横幅，aspectRatio=2.5，source=' +
        JSON.stringify(BANNER) + '。不要Form、Option、Button或Dialog，只输出OpenUI Lang。') : this.resultSource();
      if (generation !== this.epoch) { return; }
      if (this.actualModel) { this.verifyModelProgram(result, true); }
      this.show(result); this.stage = 3; this.status = '演示完成 · 已接收两次表单，未下单';
    } catch (error) {
      if (generation === this.epoch) { this.status = (error as Error).message; this.controller.setReadOnly('forms', false); }
    } finally { if (generation === this.epoch) { this.busy = false; this.persist(); } }
  }
  private resultSource(): string {
    return 'root = Stack([state, facts, list, image])\nstate = Status("演示完成 · 未下单", "success")\n' +
      'facts = Facts(' + JSON.stringify([{ label: '乘车人', value: String(this.trip['traveler']) },
        { label: '目的地', value: String(this.trip['destination']) }, { label: '出发日期', value: String(this.trip['date']) },
        { label: '席别', value: this.trip['seat'] === 'first' ? '一等座' : '二等座' },
        { label: '座位', value: this.preferences['position'] === 'aisle' ? '过道' : '靠窗' },
        { label: '期望时间', value: String(this.preferences['time']) },
        { label: '预算上限', value: String(this.preferences['budget']) + ' 元' },
        { label: '备注', value: String(this.preferences['note'] || '无') }]) + ', "收到的资料")\n' +
      'list = List([{title:"核对行程",description:"确认人员、日期和目的地",meta:"建议"},' +
      '{title:"查询实际余票",description:"接入业务工具后才可查询，当前仅为界面演示",meta:"待接入"}], "后续步骤", 180)\n' +
      'image = Image(' + JSON.stringify(BANNER) + ', "Harmony OpenUI 项目横幅", 2.5)';
  }
  build() {
    Column({ space: 0 }) {
      Row({ space: 8 }) {
        Text('原生表单 · v0.2').fontSize(21).fontWeight(FontWeight.Medium).layoutWeight(1)
        Button('返回').id('forms-back').onClick((): void => { router.back(); })
      }.width('100%').padding(20)
      Row({ space: 8 }) {
        Button('重置示例').id('forms-reset').enabled(!this.busy).fontSize(13).layoutWeight(1)
          .onClick((): void => { this.reset(); })
        Button('模型表单').id('forms-generate').enabled(!this.busy).fontSize(13).layoutWeight(1)
          .onClick((): void => { void this.generate(); })
        Button(this.readOnly ? '恢复编辑' : '只读').id('forms-readonly').enabled(!this.busy && this.stage < 3).fontSize(13)
          .onClick((): void => { this.readOnly = !this.readOnly; this.controller.setReadOnly('forms', this.readOnly); this.persist(); })
      }.width('100%').padding({ left: 20, right: 20, bottom: 10 })
      Text(this.status).id('forms-status').fontSize(13).fontColor('#596273').width('100%')
        .padding({ left: 20, right: 20, bottom: 8 })
      Scroll(this.scroller) {
        Column({ space: 12 }) {
          OpenUiView({ controller: this.controller, surfaceId: 'forms', theme: this.theme })
          Text('字段编辑不重建卡片；宿主接收校验后的表单，再更新同一个 Surface。').fontSize(12).fontColor('#596273').width('100%')
        }.width('100%').padding(20).alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).width('100%').align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor('#F4F6FA')
  }
}
