// SPDX-License-Identifier: Apache-2.0
import { common } from '@kit.AbilityKit';
import fs from '@ohos.file.fs';
import router from '@ohos.router';
import { OpenUiMappedRuntime, OpenUiMappedBinding, OpenUiMappedStats, OpenUiActionReceipt,
  OpenUiComponent, OpenUiFact, OpenUiSelectOption, OpenUiFieldChange, OpenUiView, OpenUiThemes, OpenUiTheme } from '@hreyulog/harmony-openui';
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
  @State showTools: boolean = false;
  @State hasError: boolean = false;
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
    onError: (message: string): void => { this.hasError = true; this.status = '交互失败：' + message; this.persist(); },
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
        fs.writeSync(file.fd, JSON.stringify({ status: this.status, stage: this.stage, busy: this.busy, theme: this.theme.mode,
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
    return '$planName = ""\n$notes = ""\n$mode = ""\n$preferences = {remind:false,accessible:false}\n' +
      'root = Stack([heading, Card([TextContent("出行偏好", "large-heavy"), switches], "card", "column", "s"), Card([plan])], "column", "l")\n' +
      'heading = CardHeader(' + JSON.stringify(this.place.title) + ', "把周末安排成你喜欢的样子 · 虚构演示")\n' +
      'switches = SwitchGroup("preferences", [SwitchItem("出发提醒", "只记录偏好，不创建提醒", "remind"), ' +
      'SwitchItem("无障碍路线", "优先考虑通行便利", "accessible")], "clear", $preferences)\n' +
      'plan = Form("plan", Buttons([Button("保存计划", @ToAssistant("提交计划", {intent:"save-plan",itemId:' +
      JSON.stringify(this.place.id) + ',preferences:$preferences})), Button("重置资料", @Reset($planName,$notes,$mode,$preferences), "tertiary")], "column"), ' +
      '[FormControl("计划名称", Input("planName", "给计划起个名字", "text", {required:true}, $planName)), ' +
      'FormControl("出行方式", RadioGroup("mode", [RadioItem("步行", "适合附近慢慢逛", "walk"), ' +
      'RadioItem("公共交通", "结合地铁或公交出行", "transit")], null, {required:true}, $mode)), ' +
      'FormControl("备注", TextArea("notes", "可选备注", 3, null, $notes))])';
  }
  private preview(): void {
    if (this.busy) { return; }
    this.epoch++; this.stage = 1; this.actualModel = false; this.hasError = false; this.actions = []; this.edits = []; this.submitted = {};
    this.runtime.controller.setReadOnly('planner', false); this.show(this.preset());
    this.status = '补充计划 · 本地预览'; this.persist();
  }
  private validateEditor(source: string): void {
    const candidate = new OpenUiMappedRuntime('check');
    try {
      const result = candidate.replace(source); const nodes = result.components;
      const form = nodes.filter((node: OpenUiComponent): boolean => node.component === 'OpenUiForm');
      if (form.length !== 1 || form[0].name !== 'plan' ||
        !['planName', 'notes', 'mode'].every((name: string): boolean => result.bindings.some((binding: OpenUiMappedBinding): boolean =>
          binding.name === name && binding.target === '$' + name && binding.formName === 'plan' && binding.value === '')) ||
        !['remind', 'accessible'].every((item: string): boolean => result.bindings.some((binding: OpenUiMappedBinding): boolean =>
          binding.name === 'preferences' && binding.target === '$preferences' && binding.itemName === item && binding.value === false && !binding.formName)) ||
        !nodes.some((node: OpenUiComponent): boolean => node.component === 'OpenUiInput' && node.field === 'planName' && node.required === true) ||
        !nodes.some((node: OpenUiComponent): boolean => node.component === 'OpenUiRadioGroup' && node.field === 'mode' && node.required === true &&
          node.options?.length === 2 && node.options.every((option: OpenUiSelectOption): boolean => ['walk', 'transit'].includes(option.value) && !!option.description)) ||
        nodes.filter((node: OpenUiComponent): boolean => node.component === 'OpenUiToggle').length !== 2) {
        throw new Error('UI_PREFERENCES: 请生成独立SwitchGroup和含Input/RadioGroup/TextArea的具名表单，保留绑定与选项说明');
      }
    } finally { candidate.dispose(); }
  }
  private async generate(): Promise<void> {
    if (this.busy) { return; }
    const generation = ++this.epoch; this.busy = true; this.hasError = false; this.stage = 1; this.actions = []; this.edits = []; this.submitted = {};
    this.runtime.controller.setReadOnly('planner', true); this.status = '模型正在生成计划编辑卡片…'; this.candidates = []; this.persist();
    try {
      const source = await DemoModel.generateValidated(this.config, OpenUiMappedRuntime.systemPrompt(),
        '为已选中的虚构周末去处生成中文偏好卡片：' + JSON.stringify(this.place) +
        '。只记录偏好，不创建提醒、不执行预订。只声明四个状态 $planName=""、$notes=""、$mode=""、$preferences={remind:false,accessible:false}。' +
        '视觉采用分组卡片：root=Stack([CardHeader(去处标题,一句简短演示说明),偏好卡,表单卡],"column","l")。' +
        '偏好卡=Card([TextContent("出行偏好","large-heavy"),switches],"card","column","s")，表单卡=Card([plan])。' +
        'switches=SwitchGroup("preferences",[SwitchItem("出发提醒","只记录偏好，不创建提醒","remind"),' +
        'SwitchItem("无障碍路线","优先考虑通行便利","accessible")],"clear",$preferences)。SwitchGroup放Form外，不套FormControl。' +
        'plan=Form("plan",buttons,fields)。fields包含计划名称Input("planName","给计划起个名字","text",{required:true},$planName)，' +
        '出行方式RadioGroup("mode",[RadioItem("步行","适合附近慢慢逛","walk"),RadioItem("公共交通","结合地铁或公交出行","transit")],' +
        'null,{required:true},$mode)，备注TextArea("notes","可选备注",3,null,$notes)，各自套FormControl中文标签。' +
        'buttons=Buttons([Button("保存计划",@ToAssistant("提交计划",{intent:"save-plan",itemId:' + JSON.stringify(this.place.id) +
        ',preferences:$preferences})),Button("重置资料",@Reset($planName,$notes,$mode,$preferences),"tertiary")],"column")。' +
        '外部开关通过实时绑定context.preferences回传，表单字段通过宿主formState回传，禁止猜答案。所有可见文字自然中文，' +
        '保留RadioItem说明，不需要图片。主操作仅保存计划，重置用tertiary。只输出OpenUI Lang，避免重复标题和多余嵌套。',
        (candidate: string): void => { this.validateEditor(candidate); }, {
          onAttempt: (): void => { this.modelRequests++; this.persist(); },
          onCandidate: (candidate: string): void => { this.lastModelSource = candidate; this.candidates.push(candidate); this.persist(); },
          isCurrent: (): boolean => generation === this.epoch
        });
      if (generation !== this.epoch) { return; }
      this.show(source); this.actualModel = true; this.showTools = false;
      this.status = '模型卡片已生成 · 填写后保存计划';
    } catch (error) { if (generation === this.epoch) { this.hasError = true; this.status = (error as Error).message; } }
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
    if (!['walk', 'transit'].includes(String(values['mode']))) {
      this.status = '请选择有效的出行方式'; this.persist(); return;
    }
    const preferences = intent['preferences'] as Record<string, Object>;
    const state = JSON.parse(this.runtime.stateSnapshotJson()) as Record<string, Object>;
    const live = state['$preferences'] as Record<string, Object>;
    if (!preferences || Object.keys(preferences).length !== 2 ||
      typeof preferences['remind'] !== 'boolean' || typeof preferences['accessible'] !== 'boolean' ||
      preferences['remind'] !== live?.['remind'] || preferences['accessible'] !== live?.['accessible']) {
      this.status = '宿主拒绝与当前开关状态不一致的偏好'; this.persist(); return;
    }
    const submitted: Record<string, Object> = {};
    submitted['planName'] = values['planName']; submitted['notes'] = values['notes'];
    submitted['mode'] = values['mode']; submitted['preferences'] = preferences;
    this.actions.push(event); this.submitted = submitted;
    const generation = ++this.epoch; this.busy = true; this.hasError = false; this.runtime.controller.setReadOnly('planner', true);
    this.status = this.actualModel ? '模型正在根据实际提交的资料整理结果…' : '正在整理结果…'; this.persist();
    try {
      let source = this.resultSource();
      if (this.actualModel) {
        source = await DemoModel.generateValidated(this.config, OpenUiMappedRuntime.systemPrompt(),
          '把宿主已核准的中文displayFields逐项排成紧凑只读结果：' +
          JSON.stringify({ place: this.place, displayFields: this.displayFields() }) +
          '。displayFields的label和value是唯一结果事实，不得省略或翻译。每项用Stack([TextContent(label+"：","small"),TextContent(value,"large-heavy")],"column","xs")，标签和值保持相邻。' +
          '尤其不能从去处介绍猜测出行方式。标题为“计划已收到”，注明仅演示、未预订、未创建提醒。' +
          '视觉：root用有间距的Stack；CardHeader直接放root，不另包Card，副标题简短。Image和信息分组放进Card。' +
          '每个row最多两个直接子项，六个事实禁止放同一row。四个短事实分别两项一row，去处和长备注各自独占一行。' +
          '使用CardHeader/TextContent/Image/Stack/Card，禁止Form、输入或Button及任何Action。' +
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
    } catch (error) { if (generation === this.epoch) { this.hasError = true; this.status = (error as Error).message; } }
    finally {
      if (generation === this.epoch) { this.busy = false; this.runtime.controller.setReadOnly('planner', this.stage === 2); this.persist(); }
    }
  }
  private validateResult(source: string): void {
    const candidate = new OpenUiMappedRuntime('result-check');
    try {
      const result = candidate.replace(source);
      if (result.components.some((node: OpenUiComponent): boolean => node.component === 'Row' && (node.children?.length ?? 0) > 2)) {
        throw new Error('UI_RESULT_LAYOUT: 手机结果每行最多两项；去处和备注各自独占一行，禁止把六个事实挤在同一行');
      }
      const text = result.components.filter((node: OpenUiComponent): boolean => node.component === 'Text')
        .map((node: OpenUiComponent): string => typeof node.text === 'string' ? node.text : '').join('\n');
      const normalized = text.replace(/\s/g, '').replace(/:/g, '：');
      for (const fact of this.displayFields()) {
        const expected = (String(fact.label) + '：' + String(fact.value)).replace(/\s/g, '');
        if (!normalized.includes(expected)) {
          throw new Error('UI_RESULT_FIELDS: ' + String(fact.label) + '必须逐字显示“' + String(fact.value) + '”');
        }
      }
      if (result.components.some((node: OpenUiComponent): boolean => !!node.action || !!node.field || node.component === 'OpenUiForm') ||
        !result.components.some((node: OpenUiComponent): boolean => node.component === 'Image' && node.source === this.place.image)) {
        throw new Error('UI_RESULT_FIELDS: 只读图文结果必须准确包含已提交的名称、备注、去处、出行方式和两项偏好');
      }
    } finally { candidate.dispose(); }
  }
  private displayFields(): OpenUiFact[] {
    const preferences = this.submitted['preferences'] as Record<string, Object>;
    const mode = this.submitted['mode'] === 'transit' ? '公共交通' : '步行';
    return [{ label: '计划名称', value: String(this.submitted['planName']) },
      { label: '备注', value: String(this.submitted['notes'] || '无备注') }, { label: '去处', value: this.place.title },
      { label: '出行方式', value: mode }, { label: '出发提醒', value: preferences['remind'] ? '已选' : '未选' },
      { label: '无障碍路线', value: preferences['accessible'] ? '已选' : '未选' }];
  }
  private resultSource(): string {
    const fields = this.displayFields().map((fact: OpenUiFact): string => 'Stack([TextContent(' +
      JSON.stringify(String(fact.label) + '：') + ',"small"),TextContent(' + JSON.stringify(String(fact.value)) +
      ',"large-heavy")],"column","xs")');
    return 'root = Stack([CardHeader("计划已收到", "虚构演示 · 未预订，未创建提醒"), Card([Image("活动类型配图，非场馆实景",' +
      JSON.stringify(this.place.image) + '), Stack([' + fields[0] + ',' + fields[3] + '],"row","m"), Stack([' +
      fields[4] + ',' + fields[5] + '],"row","m"), ' + fields[2] + ',' + fields[1] + '],"card","column","l")],"column","l")';
  }
  build() {
    Column({ space: 0 }) {
      Row({ space: 8 }) {
        Button('‹', { type: ButtonType.Normal }).id('planner-back').width(32).height(36)
          .fontSize(26).fontColor(this.theme.palette.text).backgroundColor(Color.Transparent)
          .onClick((): void => { router.back(); })
        Text(this.stage === 2 ? '你的周末计划' : '完善计划').fontSize(14).fontWeight(FontWeight.Medium)
          .fontColor(this.theme.palette.secondary).layoutWeight(1)
        Button(this.showTools ? '收起' : '工具', { type: ButtonType.Normal }).id('planner-tools')
          .height(36).fontSize(13).fontColor(this.theme.palette.secondary).backgroundColor(Color.Transparent)
          .onClick((): void => { this.showTools = !this.showTools; })
      }.width('100%').padding({ left: 8, right: 16, top: 8, bottom: 8 })
      if (this.showTools) {
        Row({ space: 12 }) {
          Button('本地预览', { type: ButtonType.Normal }).id('planner-preview').enabled(!this.busy)
            .height(40).borderRadius(10).fontSize(13).fontColor('#2563EB').backgroundColor('#EAF0FC').layoutWeight(1)
            .onClick((): void => { this.preview(); })
          Button('模型生成', { type: ButtonType.Normal }).id('planner-generate').enabled(!this.busy)
            .height(40).borderRadius(10).fontSize(13).fontColor(Color.White).backgroundColor('#2563EB').layoutWeight(1)
            .onClick((): void => { void this.generate(); })
        }.width('100%').padding({ left: 16, right: 16, bottom: 8 })
        Button(this.theme.mode === 'light' ? '切换深色外观' : '切换浅色外观', { type: ButtonType.Normal })
          .id('planner-theme').height(36).fontSize(12).fontColor(this.theme.palette.secondary).backgroundColor(Color.Transparent)
          .onClick((): void => { this.theme = OpenUiThemes.create(this.theme.mode === 'light' ? 'dark' : 'light'); this.persist(); })
      }
      if (this.busy || this.showTools || this.hasError) {
        Text(this.status).id('planner-status').fontSize(12).fontColor(this.theme.palette.secondary).width('100%')
          .padding({ left: 16, right: 16, bottom: 10 })
      }
      Scroll(this.scroller) {
        Column() { OpenUiView({ controller: this.runtime.controller, surfaceId: 'planner', theme: this.theme }) }
          .width('100%').padding({ left: 16, right: 16, top: 8, bottom: 24 }).alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).width('100%').align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor(this.theme.palette.canvas)
  }
}
