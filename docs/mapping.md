# 通用原生映射 / Native mapping profile

v0.3 增加可选的 `harmony-openui/mapped@1` profile。它复用官方 OpenUI Lang 运行时，将一组明确支持的组件语义映射为鸿蒙原生组件。业务数据、模型请求和业务执行由接入应用提供；示例中的筛选逻辑不写进 SDK。

v0.3 adds the opt-in `harmony-openui/mapped@1` profile. It reuses the official OpenUI Lang runtime and maps a bounded component vocabulary to native HarmonyOS UI. The embedding app supplies data, model transport and business execution. The SDK contains no example-specific filtering rules.

## 数据如何到达界面 / Data flow

```text
OpenUI Lang program
    ↓ @openuidev/lang-core 1.0.1
official parser → store → evaluateRoot / evaluate / resolveStateField
    ↓ tools/lang/mapped-registry.mjs
validated native component IR
    ↓ OpenUiController → OpenUiView
AGenUI 1.6 built-ins + existing ArkUI form controls
```

- **官方运行时 / Official runtime.** `createStreamingParser` 解析程序；`createStore` 保存 `$state`；`evaluateRoot`、`evaluate` 求值条件与动作表达式；`resolveStateField` 将 Select 值连接到官方 store。映射层没有另写表达式解析器或筛选引擎。此版本的公开 mapped API 一次接收完整程序，不暴露逐 token 渲染。
- **一个映射入口 / One mapping entry point.** [mapped-registry.mjs](../tools/lang/mapped-registry.mjs) 集中定义组件签名、原生投影和能力说明。[构建脚本](../tools/build-lang.mjs) 从该模块生成 [schema](../schemas/openui-mapped-v1.json)、模型提示词、[支持清单](../schemas/openui-mapped-support-v1.json) 和可打包运行时。扩展映射时应同时维护这里的签名与投影。
- **复用原生能力 / Native reuse.** Column、Row、Card、Text、Button 和 Image 使用固定版本 AGenUI 的现有实现。Select 继续复用 v0.2 已有的 ArkUI 控件桥接及受控值同步。无 React 或 WebView 运行时依赖。
- **宿主边界 / Host boundary.** `@Set`、`@Reset` 更新本地 store；`@ToAssistant`、`@OpenUrl` 返回意图给宿主。库本身不会请求模型、访问业务接口、打开链接或完成订单。生成界面中的文字不是业务执行凭据。

The parser, state store, expression evaluation and field bindings above are upstream implementations. The registry supplies native projection and generated model-facing artifacts. AGenUI supplies existing native primitives; the established ArkUI Select adapter supplies controlled input. Local actions need no model request. External actions remain host-owned.

参考的官方 UI 签名固定在 [OpenUI commit `9823ec0`](https://github.com/thesysdev/openui/tree/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib)。这不代表已实现官方全部组件或视觉像素一致。

The reference UI signatures are pinned to that commit. This profile does not claim complete upstream component support or pixel parity.

## 当前九类映射 / Nine supported mappings

| OpenUI 组件 / Component | 原生投影 / Native projection | 范围 / Scope |
| --- | --- | --- |
| `Stack` | AGenUI `Column` / `Row` | 方向、间距、对齐；`wrap=false` / Direction, gap, alignment; no wrapping |
| `Card` | AGenUI `Card` + `Column` / `Row` | 普通组件组合，支持 `card`、`clear` / Composed content; `card` and `clear` variants |
| `CardHeader` | AGenUI `Column` + `Text` | 标题、副标题 / Title and subtitle |
| `TextContent` | AGenUI `Text` | 纯文本及受限字号 / Plain text and bounded size variants |
| `Image` | AGenUI `Image` | 宿主提供的 HTTPS 图片、替代文字；当前固定 2.5 比例 / Supplied HTTPS image and alt text; fixed 2.5 aspect ratio |
| `Button` | AGenUI `Button` + `Text` | 本地状态动作或宿主意图回调 / Local state actions or host intent callbacks |
| `Select` | 既有 `OpenUiSelect` → ArkUI `Select` | 单选、`$state` 绑定、required 规则 / Single selection, state binding and required rule |
| `SelectItem` | 选项数据 / Option data | `value`、`label`，不创建独立原生视图 / No separate native view |
| `FormControl` | `Column` + Select + 可选说明文字 | 标签、单选输入、提示 / Label, select and optional hint |

这是模型组件目录的九类映射，不是九种全新控件。图片、文字、按钮组成的结果卡片不需要专门的业务卡组件。字体、颜色、尺寸、按钮视觉变体和破坏性操作色彩最终由原生主题决定。

These are nine model-facing mappings, not nine newly implemented native widgets. Result cards compose ordinary primitives. The native theme owns final typography, colors, geometry, button styling and destructive tones.

## 两个 profile 的签名不同 / Separate language profiles

| | v0.2 原目录 / Existing catalog | v0.3 映射目录 / Mapped profile |
| --- | --- | --- |
| 入口 / API | `OpenUiLanguageStream` | `OpenUiMappedRuntime` |
| 文本 / Text | `Text(content, variant?)` | `TextContent(text, size?)` |
| 图片 / Image | `Image(source, alt, aspectRatio?)` | `Image(alt, src?)` |
| 单选 / Select | `Select(field, label, options, value?, required?, disabled?)` | `Select(name, items, placeholder?, rules?, value?, size?)` |
| 选项 / Options | `[{label, value}]` | `[SelectItem(value, label)]` |
| 状态 / State | 宿主控制 / Host-controlled | 官方 `$state`、条件表达式、Set、Reset |

旧目录继续保留，不自动改写旧程序。应使用对应 API 生成的 `systemPrompt()` 与 schema；不能把同名组件当成相同签名混用。mapped profile 的 `src` 在上游签名中可省略，但本原生映射要求提供有效 HTTPS URL。

The existing catalog remains available. Generate prompts and schemas through the chosen API and keep its programs separate. Identically named components may have incompatible positional arguments. Although upstream marks `Image.src` optional, this native mapping requires a valid HTTPS source.

## 可运行示例 / Runnable example

以下程序使用项目自己的公开图片和明确的演示内容。Select 与 Reset 只修改本地状态；选择按钮将资源 ID 和当前筛选值交给宿主。

This program uses the project's public image and explicit demo content. Selecting or resetting a filter updates local state. Choosing a card returns its resource ID and current filter to the host.

```openui
$kind = "all"
root = Stack([heading, filter, reset, $kind == "all" || $kind == "guide" ? guide : null, $kind == "all" || $kind == "demo" ? demo : null])
heading = CardHeader("Harmony OpenUI 资源", "用于验证本地筛选的演示资料")
filter = FormControl("资源类型", Select("kind", [SelectItem("all", "全部"), SelectItem("guide", "接入指南"), SelectItem("demo", "示例工程")], "选择类型", null, $kind))
reset = Button("重置", @Reset($kind), "tertiary")
guide = Card([Image("Harmony OpenUI 项目标识", "https://raw.githubusercontent.com/hreyulog/harmony-openui/be5bfd9a4310d80406c4330a4fbb1120607226c1/docs/images/harmony-openui-banner.png"), CardHeader("接入指南", "文档资源"), TextContent("了解原生映射与宿主回调。"), Button("选择指南", @ToAssistant("查看接入指南", {resourceId:"guide", filter:$kind}))])
demo = Card([CardHeader("独立示例工程", "示例资源"), TextContent("在独立应用中验证生成、选择与回调。"), Button("选择示例", @ToAssistant("查看示例工程", {resourceId:"demo", filter:$kind}))])
```

```typescript
const runtime = new OpenUiMappedRuntime('resources', {
  onAction: (event: OpenUiActionReceipt): void => {
    // 接入应用读取意图，并决定是否继续模型会话。
    // The host decides how to continue the conversation.
    console.info(JSON.stringify(event));
  }
});
runtime.replace(source);
// ArkUI build: OpenUiView({ controller: runtime.controller, surfaceId: 'resources' })
// 页面/会话结束时 / On teardown: runtime.dispose()
```

例如选择「接入指南」后，`continue_conversation` 回调的业务参数位于：

For example, after filtering to the guide and choosing it, the callback contains:

```json
{
  "name": "continue_conversation",
  "context": {
    "message": "查看接入指南",
    "context": { "resourceId": "guide", "filter": "guide" }
  }
}
```

## 更新与生命周期 / Updates and lifetime

完整新程序通过 `replace(source)` 提交：解析、求值和校验成功后切换，失败保留上次成功的程序与状态。局部筛选先由官方 store 求值，再用原子 `patch` 提交完整 IR；常规兼容更新只发送发生变化的 `updateComponents`，不创建新 Surface，达到下述生命周期预算时除外。

A replacement program commits after successful parsing, evaluation and validation. Invalid replacements retain the preceding program and state. Reactive changes re-evaluate through the official store and atomically patch the native IR. Compatible incremental updates send only changed native components without creating another Surface, subject to the lifetime budget below.

仍可见且身份不变的组件保留 native ID、manager 和容器生命周期。输入值经受控值通道同步；移除或隐藏的节点失去交互权限，重新出现时获得新 native ID。事件按当前 revision、可达节点及声明上下文校验。主题、宽度、字段身份等不兼容变更仍走完整替换。`dispose()` 结束状态和界面生命周期。

Retained, compatible nodes keep native identity and the manager/container lifetime during incremental updates. Controlled values synchronize separately. Removed or hidden nodes lose interaction authority and receive new identities when they return. Events are checked against the current revision, reachable nodes and declared context. Incompatible changes, including theme, width or field identity changes, still replace the view. Call `dispose()` when the session ends.

AGenUI 会销毁被移除的原生视图，但源模型元数据可能仍随 manager 保留。因此，当前 manager 累计分配达到 1,024 个 native ID 后，下次更新安全重建 manager，回收历史元数据，再恢复正常增量更新。一个原子 patch 可以跨过该阈值；单次 IR 本身仍受 200 节点限制。回收保留官方 store 和控制器字段值，但会结束当前原生焦点、滚动等局部生命周期。

AGenUI destroys removed native views, but may retain source-model metadata for the manager lifetime. Once a manager has cumulatively allocated 1,024 native identities, the next update safely replaces it to collect historical metadata. Normal incremental updates then resume. One atomic patch can cross this threshold; each IR still has a 200-node bound. Recycling preserves the official store and controller field values, but ends native focus/scroll lifetimes.

这减少了重建引起的焦点和滚动状态丢失；不会保证删掉当前焦点节点后仍保留焦点，也不承诺数据缩短后保持原滚动坐标。测量完成状态不是图片网络加载成功或首帧显示确认。

This avoids unnecessary focus and scroll resets. It does not preserve focus on a removed node or promise an unchanged scroll offset after content shrinks. Measured layout is not proof that an image loaded or that a frame was displayed.

## 明确边界 / Explicit limitations

- 状态初始值仅支持字符串、数字或布尔字面量，每个 `$name` 只能声明一次。派生条件直接写入组件表达式；重复声明、表达式或对象初始化会明确拒绝。Initial state accepts string, number or boolean literals, declared once. Put derived conditions directly in component expressions.
- 不支持 Query/Mutation、Each/Filter、任意远程请求、宿主代码执行；当前筛选通过条件子节点表达。No Query/Mutation, Each/Filter, remote execution or arbitrary code; use conditional children.
- 不支持 HTML、Markdown、富文本、表格、图表、Tabs、导航或完整 ArkUI 控件目录。No HTML, Markdown, rich text, tables, charts, tabs, navigation or full ArkUI catalog.
- 不支持自动换行布局、`Card` 的 `sunk` 变体、高级或异步表单规则、多选数组。No wrapping, sunk cards, advanced/async form rules or array-valued selections.
- 新 profile 暂只映射 Select 输入；v0.2 的其他表单能力继续由旧 profile 提供，不会自动全部进入 mapped 目录。Other established form controls remain available through the existing profile.
- 新程序接收、状态更新和回调都有节点、深度、字符串及选项数量边界；具体能力以生成的支持清单和校验实现为准。Programs and updates have bounded nodes, depth, strings and options; consult the generated manifest and validation.
- 本文说明代码契约，不作为真机通过证明；验收证据单独记录。This document describes the implementation contract, not physical-device acceptance; device evidence is recorded separately.
