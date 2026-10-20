// SPDX-License-Identifier: Apache-2.0
import { common } from '@kit.AbilityKit';
import fs from '@ohos.file.fs';
import router from '@ohos.router';
import { OpenUiMappedRuntime, OpenUiMappedStats, OpenUiMappedBinding, OpenUiActionReceipt, OpenUiComponent,
  OpenUiFieldChange, OpenUiView, OpenUiThemes, OpenUiTheme } from '@hreyulog/harmony-openui';
import { DemoModel, DemoModelConfig } from '../model/DemoModel';
import { Place, PLACES } from '../model/DemoPlaces';

interface PlannerParameters { placeId: string; }

const FILTERS: string = 'kind = FormControl("去处类型", Select("kind", [SelectItem("all", "全部类型"), ' +
  'SelectItem("park", "公园步道"), SelectItem("museum", "展馆"), SelectItem("bookstore", "书店")], "选择类型", null, $kind))\n' +
  'duration = FormControl("可用时间", Select("duration", [SelectItem("all", "不限时长"), ' +
  'SelectItem("short", "约 1 小时"), SelectItem("long", "约 2 小时")], "选择时长", null, $duration))\n' +
  'reset = Button("重置筛选", @Reset($kind, $duration), "tertiary")\n';

@Entry
@Component
struct Mapped {
  @State theme: OpenUiTheme = OpenUiThemes.create('light');
  @State busy: boolean = false;
  @State status: string = '本地预览 · 点击“模型生成”运行实际模型';
  @State receipt: string = '';
  private filesDir: string = '';
  private epoch: number = 0;
  private source: string = '';
  private lastModelSource: string = '';
  private candidates: string[] = [];
  private selectedPlaceId: string = '';
  private actualModel: boolean = false;
  private requests: number = 0;
  private edits: number = 0;
  private observer: number = 0;
  private actions: OpenUiActionReceipt[] = [];
  private config: DemoModelConfig = { endpoint: '', model: '', apiKey: '', protocol: 'anthropic' };
  private scroller: Scroller = new Scroller();
  private runtime: OpenUiMappedRuntime = new OpenUiMappedRuntime('mapped', {
    onAction: (event: OpenUiActionReceipt): void => { this.selected(event); },
    onFieldChange: (_event: OpenUiFieldChange): void => { this.edits++; this.persist(); },
    onError: (message: string): void => { this.status = '本地交互失败：' + message; this.persist(); },
    onRenderStatus: (): void => { this.persist(); }
  });

  aboutToAppear(): void {
    this.filesDir = (getContext(this) as common.UIAbilityContext).filesDir;
    try { this.config = JSON.parse(fs.readTextSync(this.filesDir + '/model-config.json')) as DemoModelConfig; } catch (_) {}
    this.observer = this.runtime.controller.subscribe((): void => { this.persist(); });
    this.preview();
  }
  aboutToDisappear(): void {
    this.epoch++; this.runtime.controller.unsubscribe(this.observer); this.observer = 0; this.runtime.dispose();
  }
  private persist(): void {
    if (!this.filesDir) { return; }
    try {
      const file = fs.openSync(this.filesDir + '/openui-mapped-state.json', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      try {
        const stats: OpenUiMappedStats = this.runtime.getStats();
        fs.writeSync(file.fd, JSON.stringify({ status: this.status, busy: this.busy, actualModel: this.actualModel,
          modelRequests: this.requests, candidates: this.candidates, edits: this.edits, actions: this.actions, source: this.source, lastModelSource: this.lastModelSource,
          state: JSON.parse(this.runtime.stateSnapshotJson()), stats,
          snapshot: JSON.parse(this.runtime.controller.exportSnapshot()) }));
      } finally { fs.closeSync(file); }
    } catch (_) {}
  }
  private preset(): string {
    const declarations: string[] = [];
    const slots: string[] = [];
    for (let index = 0; index < PLACES.length; index++) {
      const place = PLACES[index]; const id = 'place' + index;
      slots.push('($kind == "all" || $kind == "' + place.kind + '") && ($duration == "all" || $duration == "' + place.duration + '") ? ' + id + ' : null');
      declarations.push(id + ' = Card([Image(' + JSON.stringify(place.title + '活动类型配图') + ', ' + JSON.stringify(place.image) + '), ' +
        'CardHeader(' + JSON.stringify(place.title) + ', ' + JSON.stringify(place.detail) + '), ' +
        'Button(' + JSON.stringify('选择' + place.title) + ', @ToAssistant(' + JSON.stringify('选择' + place.title) +
        ', {itemId:' + JSON.stringify(place.id) + '}))])');
    }
    return '$kind = "all"\n$duration = "all"\nroot = Stack([heading, note, kind, duration, reset, ' + slots.join(', ') + '])\n' +
      'heading = CardHeader("周末去哪里", "按兴趣和可用时间挑选")\n' +
      'note = TextContent("虚构演示资料 · 图片为活动类型配图，非场馆实景", "small")\n' + FILTERS + declarations.join('\n');
  }
  private preview(): void {
    if (this.busy) { return; }
    this.epoch++; this.actualModel = false; this.actions = []; this.receipt = ''; this.selectedPlaceId = ''; this.edits = 0;
    this.source = this.preset(); this.runtime.replace(this.source);
    this.status = '本地预览 · 点击“模型生成”运行实际模型'; this.persist();
  }
  private validate(source: string): void {
    const candidate = new OpenUiMappedRuntime('check');
    try {
      const parsed = candidate.replace(source);
      const nodes = candidate.controller.getSurface('check')!.components;
      if (Object.keys(parsed.state).length !== 2 ||
        !['kind', 'duration'].every((name: string): boolean => parsed.bindings.some((binding: OpenUiMappedBinding): boolean =>
          binding.name === name && binding.target === '$' + name && binding.value === 'all')) ||
        nodes.filter((node: OpenUiComponent): boolean => node.component === 'Card').length < PLACES.length ||
        nodes.filter((node: OpenUiComponent): boolean => node.component === 'Image').length !== PLACES.length ||
        !['kind', 'duration'].every((name: string): boolean => nodes.some((node: OpenUiComponent): boolean =>
          node.component === 'OpenUiSelect' && node.field === name && node.value === 'all')) ||
        nodes.some((node: OpenUiComponent): boolean => node.component === 'Image' &&
          !PLACES.some((place: Place): boolean => place.image === node.source))) {
        throw new Error('模型没有按提供的资料生成四张图文卡片和两项筛选，请重试');
      }
      // This finite fixture belongs to the demo host. Validate generated filter
      // behavior against supplied facts before presenting a model program.
      for (const kind of ['all', 'park', 'museum', 'bookstore']) {
        for (const duration of ['all', 'short', 'long']) {
          for (const name of ['kind', 'duration']) {
            const surface = candidate.controller.getSurface('check')!;
            const field = surface.components.find((node: OpenUiComponent): boolean => node.component === 'OpenUiSelect' && node.field === name);
            if (!field || !candidate.controller.setFieldValue('check', field.id, name === 'kind' ? kind : duration, surface.revision)) {
              throw new Error('UI_FILTER_OPTIONS: 必须保留完整类型与时长筛选');
            }
          }
          const current = candidate.controller.getSurface('check')!.components;
          const expected = PLACES.filter((place: Place): boolean => (kind === 'all' || place.kind === kind) &&
            (duration === 'all' || place.duration === duration)).map((place: Place): string => place.image);
          const visible = current.filter((node: OpenUiComponent): boolean => node.component === 'Image');
          const emptyVisible = current.some((node: OpenUiComponent): boolean => node.component === 'Text' &&
            typeof node.text === 'string' && node.text.includes('没有匹配结果'));
          if (visible.length !== expected.length || new Set(visible.map((node: OpenUiComponent): string => node.source!)).size !== visible.length ||
            visible.some((node: OpenUiComponent): boolean => !expected.includes(node.source!))) {
            throw new Error('UI_FILTER_RESULTS: ' + kind + '/' + duration + ' 必须按宿主资料同时满足两项条件');
          }
          if (emptyVisible !== (expected.length === 0)) {
            throw new Error('UI_EMPTY_STATE: ' + kind + '/' + duration + ' 的空结果文案只能在零匹配时显示');
          }
        }
      }
    } finally { candidate.dispose(); }
  }
  private async generate(): Promise<void> {
    if (this.busy) { return; }
    const generation = ++this.epoch; this.busy = true; this.receipt = ''; this.actions = []; this.edits = 0;
    this.runtime.controller.setReadOnly('mapped', true);
    this.status = '模型正在生成原生图文列表和筛选逻辑…'; this.candidates = []; this.persist();
    try {
      const source = await DemoModel.generateValidated(this.config, OpenUiMappedRuntime.systemPrompt(),
        '为手机生成中文“周末去哪里”图文结果列表。以下是宿主提供的全部虚构演示资料：' + JSON.stringify(PLACES) +
        '。必须注明虚构演示、图片为活动类型配图非场馆实景。不得补充实时价格、地址或营业信息。' +
        '只允许声明两个字符串状态 $kind="all" 和 $duration="all"，每个仅声明一次。禁止声明$show等派生状态变量，' +
        '禁止用表达式初始化$变量；把完整筛选布尔表达式直接写在root的每个三元条件中。' +
        '两个Select绑定状态并分别用name kind和duration；' +
        'kind选项all全部类型、park公园步道、museum展馆、bookstore书店；duration选项all不限时长、short约1小时、long约2小时。' +
        '两项筛选的条件要同时满足，all不限制该条件。初始展示全部四条，每条只用普通Card/Image/CardHeader/TextContent/Button组合，' +
        '图片src必须逐字使用对应image字段；每条按钮使用@ToAssistant("选择对应标题", {itemId:"对应id"})。' +
        '提供Button("重置筛选", @Reset($kind, $duration), "tertiary")，无需模型再次请求即可本地重置。' +
        '所有卡片用命名声明，在root Stack中用保留固定槽位的三元条件隐藏或显示；没有匹配项时显示“没有匹配结果，请调整筛选”。' +
        '使用列布局，简洁适合手机。说明只用一行中文；不要额外提示，禁止在可见文案显示all/kind/duration等内部代码。只输出OpenUI Lang。',
        (candidate: string): void => { this.validate(candidate); }, {
          onAttempt: (): void => { this.requests++; this.persist(); },
          onCandidate: (candidate: string): void => { this.lastModelSource = candidate; this.candidates.push(candidate); this.persist(); },
          isCurrent: (): boolean => generation === this.epoch
        });
      if (generation !== this.epoch) { return; }
      this.source = source; this.runtime.replace(source); this.actualModel = true;
      this.status = '模型已生成 · 筛选与重置在手机本地执行';
      this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
    } catch (error) {
      if (generation === this.epoch) { this.status = (error as Error).message; }
    } finally {
      if (generation === this.epoch) { this.busy = false; this.runtime.controller.setReadOnly('mapped', false); this.persist(); }
    }
  }
  private selected(event: OpenUiActionReceipt): void {
    if (this.busy || event.name !== 'continue_conversation') { return; }
    const context = event.context['context'] as Record<string, Object>;
    const place = PLACES.find((item: Place): boolean => item.id === context?.['itemId']);
    if (!place) { this.status = '宿主拒绝未知的结果标识'; this.persist(); return; }
    this.selectedPlaceId = place.id; this.actions.push(event); this.receipt = '宿主收到：' + place.title + '（' + place.id + '）';
    this.status = '选择已回传 · 可继续筛选；当前未调用预订或付款工具'; this.persist();
  }
  build() {
    Column({ space: 0 }) {
      Row({ space: 8 }) {
        Text('图文筛选 · v0.4').fontSize(21).fontWeight(FontWeight.Medium).layoutWeight(1)
        Button('返回').id('mapped-back').onClick((): void => { router.back(); })
      }.width('100%').padding(20)
      Row({ space: 8 }) {
        Button('本地预览').id('mapped-preview').enabled(!this.busy).fontSize(13).layoutWeight(1)
          .onClick((): void => { this.preview(); })
        Button('模型生成').id('mapped-generate').enabled(!this.busy).fontSize(13).layoutWeight(1)
          .onClick((): void => { void this.generate(); })
      }.width('100%').padding({ left: 20, right: 20, bottom: 8 })
      Text(this.status).id('mapped-status').fontSize(13).fontColor('#596273').width('100%')
        .padding({ left: 20, right: 20, bottom: 8 })
      if (this.receipt) {
        Text(this.receipt).id('mapped-receipt').fontSize(14).fontColor('#1559C7').width('100%')
          .padding({ left: 20, right: 20, bottom: 8 })
        Button('完善这个计划').id('mapped-plan').fontSize(14)
          .onClick((): void => {
            const parameters: PlannerParameters = { placeId: this.selectedPlaceId };
            void router.pushUrl({ url: 'pages/Planner', params: parameters });
          })
      }
      Scroll(this.scroller) {
        Column() {
          OpenUiView({ controller: this.runtime.controller, surfaceId: 'mapped', theme: this.theme })
        }.width('100%').padding(20).alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).width('100%').align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor('#F4F6FA')
  }
}
