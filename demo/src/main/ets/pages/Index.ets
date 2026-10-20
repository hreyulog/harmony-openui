// SPDX-License-Identifier: Apache-2.0
import { common } from '@kit.AbilityKit';
import fs from '@ohos.file.fs';
import router from '@ohos.router';
import { OpenUiController, OpenUiActionReceipt, OpenUiRenderEvent, OpenUiLanguageStream,
  OpenUiView, OpenUiThemes, OpenUiTheme } from '@hreyulog/harmony-openui';
import { DemoModel, DemoModelConfig } from '../model/DemoModel';

const CHOICE: string = 'root = Stack([heading, a, b, source])\n' +
  'heading = Text("选一班继续比较", "heading")\n' +
  'a = Option("07:48 → 08:43", "方案 A · 55 分钟 · 二等座", "¥53", @Choose("a"))\n' +
  'b = Option("08:00 → 08:49", "方案 B · 49 分钟 · 二等座", "¥51.5", @Choose("b"))\n' +
  'source = Details("数据说明", "这是用于检验界面和交互的虚构演示资料，非实时票价或余票。点击只回传选择，不会查询或提交订单。")';
const FACTS: string = '演示资料：方案A为07:48到08:43、55分钟、二等座、¥53；方案B为08:00到08:49、49分钟、二等座、¥51.5。所有数据仅为演示，不能称为实时查询或实际订票。';

@Entry
@Component
struct Index {
  @State theme: OpenUiTheme = OpenUiThemes.create('light');
  @State status: string = '原生组件 · OpenUI 官方解析器';
  @State busy: boolean = false;
  @State showConfig: boolean = false;
  @State endpoint: string = 'https://api.minimax.io/anthropic/v1/messages';
  @State model: string = 'MiniMax-M3';
  @State apiKey: string = '';
  @State protocol: string = 'anthropic';
  @State source: string = CHOICE;
  @State lastAction: string = '';
  @State useModel: boolean = false;
  private filesDir: string = '';
  private generation: number = 0;
  private controller: OpenUiController = new OpenUiController({
    onAction: (event: OpenUiActionReceipt): void => { void this.selected(event); },
    onRenderStatus: (_event: OpenUiRenderEvent): void => { this.persistEvidence(); }
  });
  private language: OpenUiLanguageStream = new OpenUiLanguageStream(this.controller, 'main');
  aboutToAppear(): void {
    this.generation++; this.busy = false; this.useModel = false; this.lastAction = '';
    this.source = CHOICE; this.status = '原生组件 · OpenUI 官方解析器';
    this.filesDir = (getContext(this) as common.UIAbilityContext).filesDir;
    // Optional developer-owned private configuration is kept in app-private
    // storage, never in the source tree or distributed sample artifact.
    try {
      const config = JSON.parse(fs.readTextSync(this.filesDir + '/model-config.json')) as DemoModelConfig;
      this.endpoint = config.endpoint; this.model = config.model; this.apiKey = config.apiKey; this.protocol = config.protocol;
    } catch (_) {}
    this.controller.setReadOnly('main', false); this.controller.setSelected('main', '');
    this.language = new OpenUiLanguageStream(this.controller, 'main');
    this.language.replace(CHOICE); this.persistEvidence();
  }
  aboutToDisappear(): void { this.generation++; }
  private persistEvidence(): void {
    if (!this.filesDir) { return; }
    try {
      const file = fs.openSync(this.filesDir + '/openui-demo-state.json', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      try { fs.writeSync(file.fd, JSON.stringify({ source: this.source, action: this.lastAction,
        theme: this.theme.mode, status: this.status, busy: this.busy, actualModel: this.useModel,
        snapshot: JSON.parse(this.controller.exportSnapshot()) })); } finally { fs.closeSync(file); }
    } catch (_) {}
  }
  private config(): DemoModelConfig { return { endpoint: this.endpoint.trim(), model: this.model.trim(), apiKey: this.apiKey.trim(), protocol: this.protocol }; }
  private async showSource(source: string, epoch: number): Promise<boolean> {
    if (epoch !== this.generation) { return false; }
    this.language = new OpenUiLanguageStream(this.controller, 'main'); this.source = source;
    // Demonstrate the SDK's incremental input independently of provider HTTP
    // framing. Model requests in this sample use complete responses.
    for (let at = 0; at < source.length; at += 48) {
      if (epoch !== this.generation) { return false; }
      this.language.append(source.substring(at, at + 48), at + 48 >= source.length);
      await new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 18); });
    }
    if (epoch !== this.generation) { return false; }
    this.persistEvidence(); return true;
  }
  private async preset(): Promise<void> {
    if (this.busy) { return; }
    const epoch = ++this.generation;
    this.busy = true; this.useModel = false; this.lastAction = ''; this.status = '正在分块回放示例…';
    this.controller.setReadOnly('main', true); this.controller.setSelected('main', '');
    try {
      if (!await this.showSource(CHOICE, epoch)) { return; }
      this.controller.setReadOnly('main', false); this.status = '本地示例 · 点选后由宿主继续';
    } catch (_) { if (epoch === this.generation) { this.status = '示例格式错误'; } }
    finally { if (epoch === this.generation) { this.busy = false; this.persistEvidence(); } }
  }
  private async generate(): Promise<void> {
    if (this.busy) { return; }
    const epoch = ++this.generation;
    this.busy = true; this.useModel = true; this.lastAction = ''; this.status = '模型正在生成 OpenUI Lang…';
    this.controller.setReadOnly('main', true);
    this.persistEvidence();
    try {
      const text = await DemoModel.generate(this.config(), OpenUiLanguageStream.systemPrompt(),
        FACTS + '请生成简洁的两方案原生选择界面，使用两个Option和@Choose("a")/@Choose("b")，明确标注演示资料。');
      if (epoch !== this.generation) { return; }
      this.controller.setSelected('main', '');
      if (!await this.showSource(text, epoch)) { return; }
      this.controller.setReadOnly('main', false);
      this.status = '模型生成完成 · 点选后继续生成结果';
    } catch (error) { if (epoch === this.generation) { this.status = (error as Error).message; this.controller.setReadOnly('main', false); } }
    finally { if (epoch === this.generation) { this.busy = false; this.persistEvidence(); } }
  }
  private async selected(event: OpenUiActionReceipt): Promise<void> {
    if (this.busy) { return; }
    this.lastAction = JSON.stringify(event); this.persistEvidence();
    if (event.name !== 'choose') { this.status = '已回传宿主操作：' + event.name; return; }
    const value = event.context['value'] as string;
    if (!['a', 'b'].includes(value)) { this.status = '宿主未识别这个选项'; return; }
    const epoch = ++this.generation;
    this.busy = true; this.controller.setSelected('main', event.sourceComponentId); this.controller.setReadOnly('main', true);
    this.status = this.useModel ? '已收到选择，模型正在生成结果…' : '已收到选择，宿主正在更新同一界面…';
    this.persistEvidence();
    try {
      const result = this.useModel ? await DemoModel.generate(this.config(), OpenUiLanguageStream.systemPrompt(),
        FACTS + '用户选择了方案' + (value === 'a' ? 'A' : 'B') + '。请生成只读结果界面，用Status/Facts/Details呈现所选方案，明确这是演示结果、未下单；不要再加入Option或Button。') :
        'root = Stack([state, facts, note])\nstate = Status("演示完成 · 未下单", "success")\nfacts = Facts(' +
        JSON.stringify([{ label: '所选方案', value: value === 'a' ? 'A · 07:48 → 08:43' : 'B · 08:00 → 08:49' },
          { label: '二等座示例费用', value: value === 'a' ? '¥53' : '¥51.5' }]) +
        ', "所选方案")\nnote = Details("数据与操作说明", "虚构演示资料，未执行查询、下单或付款。")';
      if (!await this.showSource(result, epoch)) { return; }
      this.status = this.useModel ? '模型结果已呈现 · 同一 Surface' : '示例结果已呈现 · 同一 Surface';
    } catch (error) { if (epoch === this.generation) { this.status = (error as Error).message; } }
    finally { if (epoch === this.generation) { this.busy = false; this.persistEvidence(); } }
  }
  build() {
    Column({ space: 0 }) {
      Row() {
        Column({ space: 3 }) {
          Text('Harmony OpenUI').fontSize(23).fontWeight(FontWeight.Medium).fontColor(this.theme.palette.text)
          Text('OpenUI Lang → ArkUI 原生组件').fontSize(13).fontColor(this.theme.palette.secondary)
        }.layoutWeight(1).alignItems(HorizontalAlign.Start)
        Button(this.theme.mode === 'light' ? '深色' : '浅色').id('demo-theme').fontSize(13)
          .backgroundColor(this.theme.palette.accentContainer).fontColor(this.theme.palette.accent)
          .onClick((): void => { this.theme = OpenUiThemes.create(this.theme.mode === 'light' ? 'dark' : 'light'); this.persistEvidence(); })
      }.padding({ left: 20, right: 20, top: 20, bottom: 14 }).width('100%')
      Scroll() {
        Column({ space: 16 }) {
          Text(this.status).id('demo-status').fontSize(14).lineHeight(21).fontColor(this.theme.palette.secondary).width('100%')
          Row({ space: 10 }) {
            Button('流式示例').id('demo-preset').layoutWeight(1).fontSize(14).height(42).enabled(!this.busy)
              .backgroundColor(this.theme.palette.accentContainer).fontColor(this.theme.palette.accent).onClick((): void => { void this.preset(); })
            Button('模型生成').id('demo-generate').layoutWeight(1).fontSize(14).height(42).enabled(!this.busy)
              .backgroundColor(this.theme.palette.accent).fontColor(this.theme.mode === 'light' ? '#FFFFFF' : '#142044')
              .onClick((): void => { void this.generate(); })
          }.width('100%')
          Button('映射式图文筛选 · v0.3').id('demo-mapped').enabled(!this.busy).fontSize(14)
            .backgroundColor(this.theme.palette.accentContainer).fontColor(this.theme.palette.accent)
            .onClick((): void => { void router.pushUrl({ url: 'pages/Mapped' }); })
          OpenUiView({ controller: this.controller, surfaceId: 'main', theme: this.theme })
          Text('示例中的行程与价格仅用于验证界面，不代表实时服务。').fontSize(12).lineHeight(18)
            .fontColor(this.theme.palette.secondary).width('100%')
          Button('原生表单与多步骤').id('demo-forms').enabled(!this.busy).fontSize(13)
            .backgroundColor(this.theme.palette.accentContainer).fontColor(this.theme.palette.accent)
            .onClick((): void => { void router.pushUrl({ url: 'pages/Forms' }); })
          Button('多卡片隔离').id('demo-isolation').enabled(!this.busy).fontSize(13)
            .backgroundColor(this.theme.palette.accentContainer).fontColor(this.theme.palette.accent)
            .onClick((): void => { void router.pushUrl({ url: 'pages/Isolation' }); })
          Button(this.showConfig ? '收起模型配置' : '模型配置与源码').id('demo-config').fontSize(13)
            .backgroundColor(this.theme.palette.accentContainer).fontColor(this.theme.palette.accent)
            .onClick((): void => { this.showConfig = !this.showConfig; })
          if (this.showConfig) {
            TextInput({ text: this.endpoint, placeholder: '完整 HTTPS messages / chat/completions 地址' }).fontSize(14)
              .onChange((value: string): void => { this.endpoint = value; })
            TextInput({ text: this.model, placeholder: '模型 ID' }).fontSize(14).onChange((value: string): void => { this.model = value; })
            TextInput({ text: this.apiKey, placeholder: 'API Key（仅内存，不保存）' }).type(InputType.Password).fontSize(14)
              .onChange((value: string): void => { this.apiKey = value; })
            Button('协议：' + this.protocol).fontSize(13).onClick((): void => { this.protocol = this.protocol === 'openai' ? 'anthropic' : 'openai'; })
            TextArea({ text: this.source }).fontSize(12).height(160).onChange((value: string): void => { this.source = value; })
            Button('解析输入源码').enabled(!this.busy).onClick((): void => {
              try {
                this.language.replace(this.source); this.generation++; this.useModel = false;
                this.controller.setSelected('main', ''); this.controller.setReadOnly('main', false);
                this.status = '已解析输入源码'; this.persistEvidence();
              } catch (error) { this.status = (error as Error).message; }
            })
          }
        }.width('100%').padding(20).alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).width('100%').align(Alignment.TopStart).scrollBar(BarState.Auto)
    }.width('100%').height('100%').backgroundColor(this.theme.palette.canvas)
  }
}
