# 通用原生映射 / Native mapping profile

v0.3 增加可选的 `harmony-openui/mapped@1` profile。它复用官方 OpenUI Lang 运行时，将一组明确支持的组件语义映射为鸿蒙原生组件。业务数据、模型请求和业务执行由接入应用提供；示例中的筛选逻辑不写进 SDK。

v0.3 adds the opt-in `harmony-openui/mapped@1` profile. It reuses the official OpenUI Lang runtime and maps a bounded component vocabulary to native HarmonyOS UI. The embedding app supplies data, model transport and business execution. The SDK contains no example-specific filtering rules.

v0.4 在同一 profile 上增补文本输入、多选记录和具名表单。原有九类组件及表单外动作的回调格式保持兼容；这是组件目录的增量扩展。

v0.4 extends the same profile with text inputs, checkbox records and named forms. The original nine mappings and action payloads outside a Form remain compatible.

v0.5 增加 RadioGroup、SwitchGroup 及其数据项，并正式开放四个有界的官方结果列表计算函数。现有签名和原生 IR 不变。

v0.5 adds radio/switch mappings and bounded official result-list computation. Existing signatures and the native IR remain compatible.

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

- **官方运行时 / Official runtime.** `createStreamingParser` 解析程序；`createStore` 保存 `$state`；`evaluateRoot`、`evaluate` 求值条件与动作表达式；`resolveStateField` 将输入、单选及多选聚合值连接到官方 store。映射层没有另写表达式解析器或筛选引擎。此版本的公开 mapped API 一次接收完整程序，不暴露逐 token 渲染。
- **一个映射入口 / One mapping entry point.** [mapped-registry.mjs](../tools/lang/mapped-registry.mjs) 集中定义组件签名、原生投影和能力说明。[构建脚本](../tools/build-lang.mjs) 从该模块生成 [schema](../schemas/openui-mapped-v1.json)、模型提示词、[支持清单](../schemas/openui-mapped-support-v1.json) 和可打包运行时。扩展映射时应同时维护这里的签名与投影。
- **复用原生能力 / Native reuse.** Column、Row、Card、Text、Button 和 Image 使用固定版本 AGenUI 的现有实现。输入、单选、复选和表单继续复用 v0.2 已有的 ArkUI 控件桥接及受控值同步。无 React 或 WebView 运行时依赖。
- **宿主边界 / Host boundary.** `@Set`、`@Reset` 更新本地 store；`@ToAssistant`、`@OpenUrl` 返回意图给宿主。库本身不会请求模型、访问业务接口、打开链接或完成订单。生成界面中的文字不是业务执行凭据。

The parser, state store, expression evaluation and field bindings above are upstream implementations. The registry supplies native projection and generated model-facing artifacts. AGenUI supplies existing native primitives; established ArkUI adapters supply controlled fields. Local actions need no model request. External actions remain host-owned.

参考的官方 UI 签名固定在 [OpenUI commit `9823ec0`](https://github.com/thesysdev/openui/tree/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib)。这不代表已实现官方全部组件或视觉像素一致。

The reference UI signatures are pinned to that commit. This profile does not claim complete upstream component support or pixel parity.

## 当前十九类映射 / Nineteen supported mappings

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
| `FormControl` | `Column` + 字段 + 可选说明文字 | 标签、受支持输入、提示 / Label, a supported field and optional hint |
| `Input` | 既有 `OpenUiInput` → ArkUI `TextInput` | 单行文本、受控值；仅 `type="text"` / Controlled single-line text only |
| `TextArea` | 既有 `OpenUiInput` → ArkUI `TextArea` | 多行文本、受控值；当前固定三行布局 / Controlled text; bounded three-row layout |
| `CheckBoxItem` | 选项数据 / Choice data | 标签、说明、具名布尔默认值 / Label, description and named boolean default |
| `CheckBoxGroup` | `Column` + 既有 `OpenUiCheckbox` + `Text` | 多选记录、组级 required / Boolean record and group-level required validation |
| `Buttons` | AGenUI `Row` / `Column` | 显式动作按钮组合 / Explicit action-button composition |
| `Form` | 既有 `OpenUiForm` | 具名字段范围、提交时实时取值 / Named field scope and live action-time values |
| `RadioItem` | 选项数据 / Option data | 标签、说明、稳定 value / Label, description and stable value |
| `RadioGroup` | 既有 `OpenUiRadioGroup` → ArkUI `Radio` | 字符串绑定、默认值、required；保留说明 / String binding, defaults, required and descriptions |
| `SwitchItem` | 选项数据 / Option data | 具名开关及默认值 / Named toggle and boolean default |
| `SwitchGroup` | `Column` / `Card` + 既有 `OpenUiToggle` | 独立布尔记录；`clear`、`card` / Independent boolean record; clear/card variants |

这是模型组件目录的十九类映射，不是十九种全新控件；仍复用 22 类原生 IR。图片、文字、按钮组成的结果卡片不需要专门的业务卡组件。字体、颜色、尺寸、按钮视觉变体和破坏性操作色彩最终由原生主题决定。

These are nineteen model-facing mappings reusing the 22-kind native IR, not nineteen new widgets. Result cards compose ordinary primitives. The native theme owns final typography, colors, geometry, button styling and destructive tones.

## 两个 profile 的签名不同 / Separate language profiles

| | v0.2 原目录 / Existing catalog | 当前映射目录 / Mapped profile |
| --- | --- | --- |
| 入口 / API | `OpenUiLanguageStream` | `OpenUiMappedRuntime` |
| 文本 / Text | `Text(content, variant?)` | `TextContent(text, size?)` |
| 图片 / Image | `Image(source, alt, aspectRatio?)` | `Image(alt, src?)` |
| 单选 / Select | `Select(field, label, options, value?, required?, disabled?)` | `Select(name, items, placeholder?, rules?, value?, size?)` |
| 选项 / Options | `[{label, value}]` | `[SelectItem(value, label)]` |
| 状态 / State | 宿主控制 / Host-controlled | 官方 `$state`、条件表达式、Set、Reset |
| 表单 / Form | `Form(name, children)`，自定义 `@Submit(name)` | `Form(name, Buttons(...), fields)`，官方 `@ToAssistant(...)` |

旧目录继续保留，不自动改写旧程序。应使用对应 API 生成的 `systemPrompt()` 与 schema；不能把同名组件当成相同签名混用。mapped profile 的 `src` 在上游签名中可省略，但本原生映射要求提供有效 HTTPS URL。

The existing catalog remains available. Generate prompts and schemas through the chosen API and keep its programs separate. Identically named components may have incompatible positional arguments. Although upstream marks `Image.src` optional, this native mapping requires a valid HTTPS source.

## 文本、多选与表单 / Text, checkbox records and forms

下列参数顺序来自固定版本的官方目录；括号内的 `?` 表示可省略。能力范围由本原生 profile 进一步限制。

These positional signatures follow the pinned upstream catalog; `?` means optional. The native profile intentionally supports a bounded subset of property values.

```text
Input(name, placeholder?, type?, rules?, value?)
TextArea(name, placeholder?, rows?, rules?, value?)
CheckBoxItem(label, description, name, defaultChecked?)
CheckBoxGroup(name, items, rules?, value?)
Buttons(buttons, direction?)
Form(name, buttons, fields = [])
FormControl(label, input, hint?)
```

- `Input.type` 仅支持 `"text"`；不将密码输入退化为明文。`TextArea.rows` 可省略或为 `3`，对应已有原生布局，并不承诺 Web 文本框的像素行高。Only text input is supported; password is not silently rendered as plain text. TextArea accepts omitted rows or `3`, using the established native geometry.
- `rules` 仅支持 `{required:true|false}`。`FormControl.input` 可为 `Input`、`TextArea`、`Select`、`CheckBoxGroup` 或 `RadioGroup`，不含 `SwitchGroup`。Only required validation is supported. SwitchGroup remains outside the upstream FormControl union.
- `CheckBoxGroup` 的拼写包含大写 `B`。`CheckBoxItem` 的 `description` 是官方必填参数，不需要说明时传 `""`。`Buttons.direction` 默认 `"row"`，手机上的长标题可显式选 `"column"`。Use the exact component names and positional arguments; descriptions may be empty. Buttons default to a row.

签名依据：[Input](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/Input/schema.ts)、[TextArea](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/TextArea/schema.ts)、[CheckBoxGroup](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/CheckBoxGroup/schema.ts)、[Form](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/Form/schema.ts)、[Buttons](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/Buttons/schema.ts)。

```openui
$name = ""
$preferences = {quiet:false,accessible:false}
root = Stack([details])
details = Form("preferences", Buttons([Button("继续", @ToAssistant("提交偏好", {intent:"preferences"}))], "column"), [nameField, noteField, choices])
nameField = FormControl("称呼", Input("name", "请输入称呼", "text", {required:true}, $name))
noteField = FormControl("备注", TextArea("notes", "可选备注", 3))
choices = FormControl("偏好", CheckBoxGroup("choices", [CheckBoxItem("安静", "减少噪声", "quiet"), CheckBoxItem("无障碍", "便于通行", "accessible")], {required:true}, $preferences))
```

`$preferences` 是扁平的布尔记录，不能写成 `string[]` 或独立一个布尔值。用户勾选一个选项时，适配层读取当前聚合值，只替换对应的 item name，再通过官方 `resolveStateField` 写回整个记录。原生控件仍接收独立布尔值，内部生成的字段名不进入宿主的业务字段。没有 `value` 绑定的字段保存在其 Form 的本地范围内；有 `$state` 绑定的字段由官方 store 保存。

`$preferences` is a flat boolean record, not a string array or a single boolean. A checkbox edit replaces one named entry in the aggregate and writes the record through the official state-field implementation. Native controls still receive scalar booleans. Generated native field names do not leak into the logical form payload. Unbound fields use local form scope; reactive fields use the official store.

具名 Form 中，主按钮的 `@ToAssistant` 先检查当前可见字段的 required 规则；空文本或空单选不通过，多选组至少勾选一项即可。不会要求每个复选项都为 true。未通过时只显示字段错误，不向宿主发送外部动作。次要或三级按钮可用于无需 required 校验的取消、导航动作；`@Set`、`@Reset` 继续是本地状态动作。Form 不能嵌套，字段名在同一范围内必须唯一。原生 profile 没有新增 `@Submit`。

Inside a named Form, a primary ToAssistant button checks required fields before delivering the external action. Required text and select values must be nonempty; a required checkbox group needs at least one selection. Validation failure displays field errors without sending the external action. Secondary or tertiary actions can support cancellation and navigation without required validation. Set and Reset remain local. Forms cannot nest, and field names must be unique within their scope. This profile does not introduce Submit.

提交值在动作发生时从当前状态读取，字段值不能由模型预先写进 `@ToAssistant` 的 context 来代替。适配层返回一致的原生宿主格式：

The adapter reads live values at action time. Model-supplied context is not a substitute for submitted field values. The native host receives a normalized payload:

```json
{
  "name": "continue_conversation",
  "context": {
    "message": "提交偏好",
    "context": {"intent": "preferences"},
    "formName": "preferences",
    "formState": {
      "preferences": {
        "name": "Lin",
        "notes": "可选备注",
        "choices": {"quiet": true, "accessible": false}
      }
    }
  }
}
```

这个一致格式是本原生适配器的公开契约。官方 React hook 的本地字段可能存为 `{value, componentType}`，具名 Form 存在时取其对象；直接绑定 `$state` 的字段走独立路径，也可能使返回值成为整个 store 的快照。本库不把这些 React 内部包装照搬给宿主，而是为同一 Form 的绑定及非绑定字段返回统一的原始值，并保持模型提供的第二 context 参数独立。表单外的 v0.3 动作格式不变。参考官方 [state-field](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/lang-core/src/runtime/state-field.ts)、[action/form payload hook](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-lang/src/hooks/useOpenUIState.ts)、[Button 校验](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/Button/index.tsx)。

This normalized shape is the native adapter contract. Upstream React may wrap local fields as `{value, componentType}` and returns either named form data or a store snapshot; reactive bindings follow another storage path. The adapter presents consistent raw logical values for bound and unbound fields in the same Form, while preserving the model's optional second context argument separately. The v0.3 action shape outside a Form is unchanged. It does not claim byte-for-byte compatibility with React's internal event representation.

## 单选与独立开关 / Radios and independent switches

```text
RadioItem(label, description, value)
RadioGroup(name, items, defaultValue?, rules?, value?)
SwitchItem(label?, description?, name, defaultChecked?)
SwitchGroup(name, items, variant?, value?)
```

RadioGroup 复用原有原生单选控件。当前值优先于 defaultValue，当前空字符串也不会被默认值替换；required 时必须选择一个有效 option。description 可为空，非空说明保留到原生 options，显示在对应选项下，并与组标签、选项标签一起形成无障碍文本。

A current radio value wins over defaultValue, including an explicitly empty string. Required radio input must select a valid option. Descriptions remain visible and participate in the native control's accessibility text.

SwitchGroup 共用 CheckBoxGroup 的官方 record 绑定和现有开关叶子，不另造聚合状态引擎；修改一项不会清掉其它项。官方没有 rules 参数，FormControl 也不接收 SwitchGroup。省略或留空 item label 时，本原生 profile 回退到稳定 name；建议模型提供用户语言的标签。说明保留为邻接文字。variant 支持 clear、card；sunk 明确拒绝。

SwitchGroup reuses the checkbox record bridge with native Toggle leaves. It has no rules argument and is not a FormControl input. Missing item labels fall back to names; descriptions remain adjacent text. Clear and card are supported; sunk is rejected.

```openui
$seat = "aisle"
$extras = {camera:false,water:false}
root = Stack([extras, plan])
extras = SwitchGroup("extras", [SwitchItem("相机", "拍摄照片", "camera"), SwitchItem("饮水", "出行携带", "water")], "clear", $extras)
plan = Form("plan", Buttons([Button("继续", @ToAssistant("提交计划", {preferences:$extras}))], "column"), [FormControl("座位", RadioGroup("seat", [RadioItem("靠窗", "便于看风景", "window"), RadioItem("过道", "便于出入", "aisle")], "window", {required:true}, $seat))])
```

这里 live `formState.plan.seat` 是当前单选值，`receipt.context.context.preferences` 是按钮显式携带的独立开关记录；宿主可与当前运行时状态核对。不会把 SwitchGroup 冒充成 Form 内字段。签名依据：[RadioGroup](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/RadioGroup/index.tsx)、[SwitchGroup](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/SwitchGroup/schema.ts)。

The radio is part of normalized formState. Independent switch preferences remain explicit business context; the host can compare them with current runtime state.

## 有界结果计算 / Bounded result computation

| 官方函数 / Official function | 语义 / Semantics |
| --- | --- |
| `@Each(array, "item", inlineTemplate)` | 逐项生成展示组件和业务按钮 / Render display components and intent buttons |
| `@Filter(array, "field", operator, value)` | 按字段比较；operator 为 `==`、`!=`、`>`、`<`、`>=`、`<=`、`contains` / Named-field filtering, not a lambda |
| `@Sort(array, "field", direction?)` | 小写 `asc` / `desc`，默认 asc / Lowercase direction, ascending by default |
| `@Count(array)` | 数组长度 / Array length |

这些计算复用官方 lang-core，仍不请求模型。数据数组使用普通声明，`$state` 继续只声明 scalar 或扁平 boolean record。Each 模板必须内联，不能把组件模板写进 `$state`。例如：

These computations reuse upstream lang-core. Data arrays belong in ordinary declarations, while state defaults remain scalars or flat boolean records. Each templates are inline.

```openui
$kind = "park"
root = Stack([TextContent("找到 " + @Count(filtered) + " 项"), @Count(filtered) == 0 ? TextContent("暂无匹配结果") : null, @Each(sorted, "item", Card([CardHeader(item.title), Button("选择", @ToAssistant("选择条目", {itemId:item.id}))]))])
data = [{id:"a",title:"城市公园",kind:"park",rank:2},{id:"b",title:"展馆",kind:"museum",rank:1}]
filtered = @Filter(data, "kind", "==", $kind)
sorted = @Sort(filtered, "rank", "asc")
```

Each 及嵌套计算子数组内禁止 Form 和所有可编辑字段，因为尚无按业务 key 保留字段身份的重复表单契约。普通固定 Stack 子节点仍可包含表单。只支持单层 Each（包括引用展开）；literal array 和 UI array group 每组最多 200 项，UI array 深度最多 8、flatten 总访问最多 1,000，最终原生 IR 仍最多 200 节点。也受 source/AST/depth 等预算限制。这不是虚拟化、无限结果或分页 API。

Each and nested computed child arrays are display/action-only. Editable repeated fields are rejected. One Each expansion level, bounded arrays and the existing IR budget prevent unbounded trees; this is not list virtualization or pagination. See [official functions](https://www.openui.com/docs/openui-lang/functions) and [remaining gaps](gaps-v05.md).

过滤或排序后，同一位置可能代表另一条业务记录。因此原生按钮的 `mapped_action` 不仅带 slot 的 actionId，还关联当前完整动作定义的规范化 JSON（含表单范围和校验标记，上限 64 KiB）。控制器核对整份上下文，拒绝旧原生事件借用新条目的业务参数；宿主收到的外部意图格式不变。

Positional slots can change business identity. Native actions therefore bind the complete canonical evaluated plan, form scope and validation flag, rather than trusting the slot ID alone. Old raw payloads fail the current-context check; public host intents keep their existing shape.

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

- 状态初始值支持字符串、数字、布尔字面量，以及多选使用的扁平布尔记录，每个 `$name` 只能声明一次。派生条件直接写入组件表达式；不接受派生初始化、嵌套对象、数组或任意对象状态。Initial state accepts scalar literals and flat boolean records, declared once. Put derived conditions directly in component expressions; nested objects, arrays and derived initializers are unsupported.
- 支持有界 Each/Filter/Sort/Count 与条件子节点；不支持 Query/Mutation、其它计算函数、任意远程请求或宿主代码执行。Bounded result computations are available; remote execution and arbitrary code are not.
- 不支持 HTML、Markdown、富文本、表格、图表、Tabs、导航或完整 ArkUI 控件目录。No HTML, Markdown, rich text, tables, charts, tabs, navigation or full ArkUI catalog.
- 不支持自动换行布局、`Card` / `SwitchGroup` 的 `sunk` 变体、高级或异步表单规则、多选数组、Each 下的动态编辑字段。No wrapping, sunk variants, advanced/async form rules, array-valued selections or repeated editable fields.
- mapped profile 支持文本、多行文本、单选、多选记录和独立开关记录；v0.2 的其他表单能力继续由旧 profile 提供，不会自动全部进入 mapped 目录。Other established controls remain in the existing profile unless explicitly mapped.
- 新程序接收、状态更新和回调都有节点、深度、字符串及选项数量边界；具体能力以生成的支持清单和校验实现为准。Programs and updates have bounded nodes, depth, strings and options; consult the generated manifest and validation.
- 本文说明代码契约，不作为真机通过证明；验收证据单独记录。This document describes the implementation contract, not physical-device acceptance; device evidence is recorded separately.
