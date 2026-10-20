// SPDX-License-Identifier: Apache-2.0
import { common } from '@kit.AbilityKit';
import fs from '@ohos.file.fs';
import router from '@ohos.router';
import { OpenUiController, OpenUiActionReceipt, OpenUiLanguageStream,
  OpenUiView, OpenUiThemes, OpenUiTheme } from '@hreyulog/harmony-openui';

const sourceA: string = 'root = Stack([title, choice, details])\n' +
  'title = Text("卡片 A · 浅色", "heading")\n' +
  'choice = Option("选择 A", "独立控制器 · 同名 Surface 与节点", "A", @Choose("a"))\n' +
  'details = Details("A 的详情", "A 的局部展开状态。")';
const sourceB: string = 'root = Stack([title, choice, details])\n' +
  'title = Text("卡片 B · 深色", "heading")\n' +
  'choice = Option("选择 B", "A 更新或移除后，这里仍可操作", "B", @Choose("b"))\n' +
  'details = Details("B 的详情", "B 的局部展开状态。")';

@Entry
@Component
struct Isolation {
  @State leftVisible: boolean = true;
  @State compactLeft: boolean = false;
  @State leftCount: number = 0;
  @State rightCount: number = 0;
  @State light: OpenUiTheme = OpenUiThemes.create('light');
  @State dark: OpenUiTheme = OpenUiThemes.create('dark');
  private filesDir: string = '';
  private left: OpenUiController = new OpenUiController({
    onAction: (event: OpenUiActionReceipt): void => { this.select(event, true); },
    onRenderStatus: (): void => { this.persist(); }
  });
  private right: OpenUiController = new OpenUiController({
    onAction: (event: OpenUiActionReceipt): void => { this.select(event, false); },
    onRenderStatus: (): void => { this.persist(); }
  });
  private leftStream: OpenUiLanguageStream = new OpenUiLanguageStream(this.left, 'shared');
  private rightStream: OpenUiLanguageStream = new OpenUiLanguageStream(this.right, 'shared');
  aboutToAppear(): void {
    this.filesDir = (getContext(this) as common.UIAbilityContext).filesDir;
    this.reset();
  }
  private reset(): void {
    this.leftCount = 0; this.rightCount = 0; this.leftVisible = true; this.compactLeft = false;
    this.left.setReadOnly('shared', false); this.left.setSelected('shared', '');
    this.right.setReadOnly('shared', false); this.right.setSelected('shared', '');
    this.leftStream.replace(sourceA); this.rightStream.replace(sourceB); this.persist();
  }
  private select(event: OpenUiActionReceipt, isLeft: boolean): void {
    if (event.name !== 'choose' || event.context['value'] !== (isLeft ? 'a' : 'b')) { return; }
    if (isLeft) { this.leftCount++; } else { this.rightCount++; }
    const controller = isLeft ? this.left : this.right;
    controller.setSelected('shared', event.sourceComponentId);
    this.persist();
  }
  private updateLeft(): void {
    this.leftStream.replace(sourceA.replace('卡片 A · 浅色', '卡片 A · 已更新'));
    this.persist();
  }
  private persist(): void {
    if (!this.filesDir) { return; }
    try {
      const file = fs.openSync(this.filesDir + '/openui-isolation-state.json', fs.OpenMode.CREATE | fs.OpenMode.WRITE_ONLY | fs.OpenMode.TRUNC);
      try { fs.writeSync(file.fd, JSON.stringify({ leftVisible: this.leftVisible, compactLeft: this.compactLeft,
        leftCount: this.leftCount, rightCount: this.rightCount,
        left: JSON.parse(this.left.exportSnapshot()), right: JSON.parse(this.right.exportSnapshot()) })); }
      finally { fs.closeSync(file); }
    } catch (_) {}
  }
  build() {
    Column({ space: 0 }) {
      Row() {
        Text('多卡片隔离').fontSize(23).fontWeight(FontWeight.Medium).layoutWeight(1)
        Button('返回').id('isolation-back').onClick((): void => { router.back(); })
      }.width('100%').padding(20)
      Scroll() {
        Column({ space: 14 }) {
          Text('两个控制器都使用 shared、root、n_choice 等相同源 ID。原生实例独立，点击仍回传各自的源 ID。')
            .fontSize(13).lineHeight(20).fontColor('#596273').width('100%')
          Text('A: ' + this.leftCount.toString() + ' · B: ' + this.rightCount.toString())
            .id('isolation-counts').fontSize(17).fontWeight(FontWeight.Medium).width('100%')
          Row({ space: 8 }) {
            Button('更新 A').id('isolation-update-a').enabled(this.leftVisible).layoutWeight(1).fontSize(13)
              .onClick((): void => { this.updateLeft(); })
            Button('移除 A').id('isolation-remove-a').enabled(this.leftVisible).layoutWeight(1).fontSize(13)
              .onClick((): void => { this.leftVisible = false; this.persist(); })
            Button('重置').id('isolation-reset').layoutWeight(1).fontSize(13)
              .onClick((): void => { this.reset(); })
          }.width('100%')
          Button(this.compactLeft ? '恢复 A 宽度' : '缩窄 A').id('isolation-resize-a').enabled(this.leftVisible).fontSize(13)
            .onClick((): void => { this.compactLeft = !this.compactLeft; this.persist(); })
          if (this.leftVisible) {
            Column() {
              OpenUiView({ controller: this.left, surfaceId: 'shared', theme: this.light })
            }.width(this.compactLeft ? '70%' : '100%')
          }
          OpenUiView({ controller: this.right, surfaceId: 'shared', theme: this.dark })
        }.width('100%').padding(20).alignItems(HorizontalAlign.Start)
      }.layoutWeight(1).width('100%').align(Alignment.TopStart)
    }.width('100%').height('100%').backgroundColor('#F4F6FA')
  }
}
