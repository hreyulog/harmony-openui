// SPDX-License-Identifier: Apache-2.0
import { common } from '@kit.AbilityKit';
import fs from '@ohos.file.fs';
import router from '@ohos.router';
import { OpenUiMappedRuntime, OpenUiMappedBinding, OpenUiMappedStats, OpenUiActionReceipt,
  OpenUiComponent, OpenUiFieldChange, OpenUiView, OpenUiThemes, OpenUiTheme } from '@hreyulog/harmony-openui';
import { DemoModel, DemoModelConfig } from '../model/DemoModel';
import { Place, PLACES } from '../model/DemoPlaces';

interface PlannerParameters { placeId?: string; }

@Entry
@Component
struct Planner {
  @State theme: OpenUiTheme = OpenUiThemes.create('light');
  @State busy: boolean = false;
  @State status: string = '补充计划 · 本地预览';
  @State stage: number = 1;
  private place: Place = PLACES[0];
  private filesDir: string = '';
  private epoch: number = 0;
  private actualModel: boolean = false;
  private modelRequests: number = 0;
  private source: string = '';
  private lastModelSource: string = '';
  private candidates: string[] = [];
  private bindings: OpenUiMappedBinding[] = [];
  private edits: OpenUiFieldChange[] = [];
  private actions: OpenUiActionReceipt[] = [];
  private submitted: Record<string, Object> = {};
  private observer: number = 0;
  private config: DemoModelConfig = { endpoint: '', model: '', apiKey: '', protocol: 'anthropic' };
  private scroller: Scroller = new Scroller();
  private runtime: OpenUiMappedRuntime = new OpenUiMappedRuntime('planner', {
    onAction: (event: OpenUiActionReceipt): void => { void this.accept(event); },
    onFieldChange: (event: OpenUiFieldChange): void => { this.edits.push(event); this.persist(); },
    onRenderStatus: (): void => { this.persist(); },
    onError: (message: string): void => { this.status = '交互失败：' + message; this.persist(); },
    validationMessage: (code: string, component: OpenUiComponent): string => {
      if (code === 'group_required') { return '请至少选择一件准备物品'; }
      if (code === 'required') { return '请填写' + (component.label ?? '此项'); }
      return '请检查' + (component.label ?? '此项');
    }
  });
  aboutToAppear(): void {
    this.filesDir = (getContext(this) as common.UIAbilityContext).filesDir;
    const parameters = router.getParams() as PlannerParameters;
    this.place = PLACES.find((item: Place): boolean => item.id === parameters?.placeId) ?? PLACES[0];
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
      const file = fs.openSync(this.filesDir + '/openui-planner-state.json', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      try {
        const stats: OpenUiMappedStats = this.runtime.getStats();
        fs.writeSync(file.fd, JSON.stringify({ status: this.status, stage: this.stage, busy: this.busy,
          actualModel: this.actualModel, modelRequests: this.modelRequests, place: this.place, source: this.source,
          lastModelSource: this.lastModelSource, candidates: this.candidates, bindings: this.bindings, edits: this.edits, actions: this.actions,
          submitted: this.submitted, state: JSON.parse(this.runtime.stateSnapshotJson()), stats,
          snapshot: JSON.parse(this.runtime.controller.exportSnapshot()) }));
      } finally { fs.closeSync(file); }
    } catch (_) {}
  }
  private show(source: string): void {
    const result = this.runtime.replace(source); this.source = source; this.bindings = result.bindings;
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0 }); this.persist();
  }
  private preset(): string {
    return '$planName = ""\n$notes = ""\n$gear = {camera:false,water:false}\n' +
      'root = Stack([heading, place, plan], "column", "s")\n' +
      'heading = CardHeader("完善周末计划", "虚构资料 · 填写后查看整理结果")\n' +
      'place = TextContent(' + JSON.stringify(this.place.title + ' · ' + this.place.detail) + ', "small")\n' +
      'plan = Form("plan", Buttons([Button("保存计划", @ToAssistant("提交计划", {intent:"save-plan",itemId:' +
      JSON.stringify(this.place.id) + '})), Button("重置资料", @Reset($planName,$notes,$gear), "tertiary")], "column"), ' +
      '[FormControl("计划名称", Input("planName", "给计划起个名字", "text", {required:true}, $planName)), ' +
      'FormControl("备注", TextArea("notes", "可选备注", 3, null, $notes)), ' +
      'FormControl("准备物品", CheckBoxGroup("gear", [CheckBoxItem("带相机", "", "camera"), ' +
      'CheckBoxItem("带水", "", "water")], {required:true}, $gear))])';
  }
  private preview(): void {
    if (this.busy) { return; }
    this.epoch++; this.stage = 1; this.actualModel = false; this.actions = []; this.edits = []; this.submitted = {};
    this.runtime.controller.setReadOnly('planner', false); this.show(this.preset());
    this.status = '补充计划 · 本地预览'; this.persist();
  }
  private validateEditor(source: string): void {
    const candidate = new OpenUiMappedRuntime('check');
    try {
      const result = candidate.replace(source); const nodes = result.components;
      const form = nodes.filter((node: OpenUiComponent): boolean => node.component === 'OpenUiForm');
      if (form.length !== 1 || form[0].name !== 'plan' ||
        !result.bindings.some((binding: OpenUiMappedBinding): boolean => binding.name === 'planName' && binding.target === '$planName' && binding.formName === 'plan') ||
        !result.bindings.some((binding: OpenUiMappedBinding): boolean => binding.name === 'notes' && binding.target === '$notes' && binding.formName === 'plan') ||
        !['camera', 'water'].every((item: string): boolean => result.bindings.some((binding: OpenUiMappedBinding): boolean =>
          binding.name === 'gear' && binding.target === '$gear' && binding.itemName === item && binding.value === false)) ||
        !nodes.some((node: OpenUiComponent): boolean => node.component === 'OpenUiInput' && node.field === 'planName' && node.required === true)) {
        throw new Error('模型没有生成所需的计划资料和多选项，请重试');
      }
    } finally { candidate.dispose(); }
  }
  private async generate(): Promise<void> {
    if (this.busy) { return; }
    const generation = ++this.epoch; this.busy = true; this.stage = 1; this.actions = []; this.edits = []; this.submitted = {};
    this.runtime.controller.setReadOnly('planner', true); this.status = '模型正在生成计划编辑卡片…'; this.candidates = []; this.persist();
    try {
      const source = await DemoModel.generateValidated(this.config, OpenUiMappedRuntime.systemPrompt(),
        '为已选中的虚构周末去处生成中文资料卡片：' + JSON.stringify(this.place) +
        '。只生成资料编辑，不执行预订。顶端简短显示去处名称和一句演示说明，不需要图片。' +
        '严格只声明三个状态：$planName=""，$notes=""，$gear={camera:false,water:false}。' +
        'Form名plan，fields包含三个FormControl：计划名称用Input("planName","给计划起个名字","text",{required:true},$planName)；' +
        '备注用TextArea("notes","可选备注",3,null,$notes)；准备物品用CheckBoxGroup("gear",' +
        '[CheckBoxItem("带相机","","camera"),CheckBoxItem("带水","","water")],{required:true},$gear)，要求至少选择一项。' +
        'Form的buttons参数必须是Buttons([Button("保存计划",@ToAssistant("提交计划",{intent:"save-plan",itemId:' +
        JSON.stringify(this.place.id) + '})),Button("重置资料",@Reset($planName,$notes,$gear),"tertiary")],"column")。' +
        '所有输入都使用绑定，禁止把答案拼进Action。可见文字只用自然中文，不显示变量名或内部代码，不重复解释。' +
        '使用紧凑列布局，root=Stack，标题用CardHeader，不需要Card容器。Form签名为Form(name,buttons,fields)。只输出OpenUI Lang。',
        (candidate: string): void => { this.validateEditor(candidate); }, {
          onAttempt: (): void => { this.modelRequests++; this.persist(); },
          onCandidate: (candidate: string): void => { this.lastModelSource = candidate; this.candidates.push(candidate); this.persist(); },
          isCurrent: (): boolean => generation === this.epoch
        });
      if (generation !== this.epoch) { return; }
      this.show(source); this.actualModel = true;
      this.status = '模型卡片已生成 · 填写后保存计划';
    } catch (error) { if (generation === this.epoch) { this.status = (error as Error).message; } }
    finally {
      if (generation === this.epoch) { this.busy = false; this.runtime.controller.setReadOnly('planner', false); this.persist(); }
    }
  }
  private async accept(event: OpenUiActionReceipt): Promise<void> {
    if (this.busy || this.stage !== 1 || event.name !== 'continue_conversation') { return; }
    const intent = event.context['context'] as Record<string, Object>;
    const forms = event.context['formState'] as Record<string, Object>;
    const values = forms?.['plan'] as Record<string, Object>;
    if (event.context['formName'] !== 'plan' || intent?.['intent'] !== 'save-plan' || intent?.['itemId'] !== this.place.id ||
      typeof values?.['planName'] !== 'string' || !(values['planName'] as string).trim() || typeof values['notes'] !== 'string') {
      this.status = '宿主没有收到完整的当前表单，请检查资料'; this.persist(); return;
    }
    const gear = values['gear'] as Record<string, Object>;
    if (typeof gear?.['camera'] !== 'boolean' || typeof gear['water'] !== 'boolean' || (!gear['camera'] && !gear['water'])) {
      this.status = '请至少选择一件准备物品'; this.persist(); return;
    }
    this.actions.push(event); this.submitted = values;
    const generation = ++this.epoch; this.busy = true; this.runtime.controller.setReadOnly('planner', true);
    this.status = this.actualModel ? '模型正在根据实际提交的资料整理结果…' : '正在整理结果…'; this.persist();
    try {
      let source = this.resultSource();
      if (this.actualModel) {
        source = await DemoModel.generateValidated(this.config, OpenUiMappedRuntime.systemPrompt(),
          '根据宿主实际收到的资料生成紧凑中文只读结果：' + JSON.stringify({ place: this.place, fields: values }) +
          '。标题为“计划已收到”，注明仅演示、未预订。准确显示计划名称、备注、去处，gear.camera/water分别转中文带相机/带水，' +
          '只列选择为true的准备物品。使用CardHeader/TextContent/Image/Stack/Card，禁止Form、输入或Button及任何Action。' +
          'Image(alt,src)必须使用提供的place.image，配图非场馆实景。简洁不重复，不显示变量名或内部ID。只输出OpenUI Lang。',
          (candidate: string): void => { this.validateResult(candidate); }, {
            onAttempt: (): void => { this.modelRequests++; this.persist(); },
            onCandidate: (candidate: string): void => { this.lastModelSource = candidate; this.candidates.push(candidate); this.persist(); },
            isCurrent: (): boolean => generation === this.epoch
          });
      }
      if (generation !== this.epoch) { return; }
      this.validateResult(source);
      this.show(source); this.stage = 2; this.status = '计划已收到 · 未查询或预订';
    } catch (error) { if (generation === this.epoch) { this.status = (error as Error).message; } }
    finally {
      if (generation === this.epoch) { this.busy = false; this.runtime.controller.setReadOnly('planner', this.stage === 2); this.persist(); }
    }
  }
  private validateResult(source: string): void {
    const candidate = new OpenUiMappedRuntime('result-check');
    try {
      const result = candidate.replace(source);
      if (result.components.some((node: OpenUiComponent): boolean => !!node.action || node.component === 'OpenUiForm') ||
        !result.components.some((node: OpenUiComponent): boolean => node.component === 'Image' && node.source === this.place.image)) {
        throw new Error('模型结果未满足只读图文要求，请重试保存');
      }
    } finally { candidate.dispose(); }
  }
  private resultSource(): string {
    const gear = this.submitted['gear'] as Record<string, Object>;
    const preparation = [gear?.['camera'] ? '带相机' : '', gear?.['water'] ? '带水' : ''].filter((value: string): boolean => !!value).join('、');
    return 'root = Stack([CardHeader("计划已收到", "虚构演示 · 未预订"), Image("活动类型配图，非场馆实景",' +
      JSON.stringify(this.place.image) + '), CardHeader(' + JSON.stringify(String(this.submitted['planName'])) + ',' +
      JSON.stringify(this.place.title) + '), TextContent(' + JSON.stringify(String(this.submitted['notes'] || '无备注')) +
      '), TextContent(' + JSON.stringify('准备：' + preparation) + ')])';
  }
  build() {
    Column({ space: 0 }) {
      Row({ space: 8 }) {
        Text('完善计划 · v0.4').fontSize(21).fontWeight(FontWeight.Medium).layoutWeight(1)
        Button('返回').id('planner-back').onClick((): void => { router.back(); })
      }.width('100%').padding(20)
      Row({ space: 8 }) {
        Button('本地预览').id('planner-preview').enabled(!this.busy).fontSize(13).layoutWeight(1)
          .onClick((): void => { this.preview(); })
        Button('模型生成').id('planner-generate').enabled(!this.busy).fontSize(13).layoutWeight(1)
          .onClick((): void => { void this.generate(); })
      }.width('100%').padding({ left: 20, right: 20, bottom: 8 })
      Text(this.status).id('planner-status').fontSize(13).fontColor('#596273').width('100%')
        .padding({ left: 20, right: 20, bottom: 8 })
      Scroll(this.scroller) {
        Column() { OpenUiView({ controller: this.runtime.controller, surfaceId: 'planner', theme: this.theme }) }
          .width('100%').padding(20).alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).width('100%').align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor('#F4F6FA')
  }
}
