# v0.5 缺口与取舍 / Gaps and choices — 2026-10-21

2026-10-21 使用 GitHub `refs/heads/main` 实查，官方 OpenUI 仍为 `9823ec05d4b29bc78d101676dc16b44fe17f1830`，与本库固定参考版本相同。本轮主要补映射和原生契约，不以升级依赖代替实现。下面说明代码能力和待做范围，不作为真机验收回执。

The upstream main reference matched the pinned commit on the audit date. This document describes implementation scope and remaining gaps, not device acceptance.

## 本轮复用 / Reuse in this iteration

mapped profile 从 15 扩展为 **19 类模型组件**，新增 RadioItem、RadioGroup、SwitchItem、SwitchGroup；原生 IR 仍为 **22 类**。数据子项和组合容器也计入模型目录，不能把 19 理解成 19 个新原生控件。

The four mappings reuse existing Radio and Toggle controls, scalar string fields and the established boolean-record aggregate. No new native widget or separate group-state engine is introduced.

| 官方组件 / Upstream component | 精确参数顺序 / Positional signature | 本库投影 / Native projection |
| --- | --- | --- |
| RadioItem | `label, description, value` | 数据项；description 可以为空 / Data only; description may be empty |
| RadioGroup | `name, items, defaultValue?, rules?, value?` | `OpenUiRadioGroup`；保留选项说明 / Existing native Radio group, retaining descriptions |
| SwitchItem | `label?, description?, name, defaultChecked?` | 数据项；省略标签时安全回退到 name / Data only; missing labels fall back to name |
| SwitchGroup | `name, items, variant?, value?` | 共用 boolean-record 桥，叶子为 `OpenUiToggle` / Shared aggregate bridge, native Toggle leaves |

Radio 的当前值优先于默认值，包括当前空字符串；未选的 required 单选不能提交。Switch 的每次修改只替换相应具名布尔值；没有添加官方不存在的 rules 参数。支持 `clear`、`card` 两种 SwitchGroup 组合，`sunk` 明确拒绝。Radio 选项说明以原生文字显示并参与其无障碍标签；Switch 说明保留为邻接文字。

A current radio value wins over its default, including an explicitly empty value. Switch changes preserve other entries. Clear and card variants are supported; sunk is rejected. Radio descriptions participate in the control label; switch descriptions remain adjacent native text.

官方 FormControl 输入 union 包含 RadioGroup，**不包含 SwitchGroup**。本库保留这个边界：SwitchGroup 独立放在 Stack/Card；需要与表单联动时，可把其 `$record` 放入按钮的业务 context，由宿主校验和处理，不伪装成官方 FormControl 字段。

Upstream FormControl accepts RadioGroup but not SwitchGroup. Independent switch state can be included explicitly in an action context; it is not silently inserted into normalized formState.

依据：[RadioGroup](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/RadioGroup/index.tsx)、[SwitchGroup](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/SwitchGroup/schema.ts)、[FormControl](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/FormControl/schema.ts)。

## 结果列表复用官方计算 / Official computation for result lists

本轮只开放四类纯展示计算，继续调用官方 lang-core 实现，不自写表达式或筛选引擎：

```text
@Each(array, "item", inlineTemplate)
@Filter(array, "field", operator, value)
@Sort(array, "field", "asc" | "desc")
@Count(array)
```

Filter 操作为 `==`、`!=`、`>`、`<`、`>=`、`<=`、`contains`；这是字段比较签名，不是 JavaScript lambda。Sort 默认 asc。结果数据放普通声明，例如 `data = [{id:"a", title:"A"}]`；筛选字段仍可用 `$state`。模板内联，例如 `@Each(filtered, "item", Card([TextContent(item.title), Button("选择", @ToAssistant("选择", {itemId:item.id}))]))`。

Filter uses a named field and operator, not a lambda. Host-supplied data arrays belong in ordinary declarations. State declarations remain scalar literals or flat boolean records.

Each 及嵌套计算子数组只允许展示组件与业务按钮，**不能包含表单或可编辑字段**。当前循环节点身份按位置建立，没有通用的业务 key 字段身份契约。不能因此声称排序、筛选后的动态表单会保留正确编辑值，也不代表已有虚拟列表、无限加载或分页。普通固定 Stack 子节点仍可包含表单。

Repeated computed content is display/action-only. Editable keyed lists, virtualization and pagination remain separate work. Each is limited to one expansion level, including referenced data/templates. Literal arrays and UI array groups have at most 200 entries; UI arrays have depth at most 8 and 1,000 total flatten visits. The final IR remains bounded to 200 nodes. Source and AST budgets also apply. See the [official functions documentation](https://www.openui.com/docs/openui-lang/functions) and the generated support manifest.

## ArkUI 层的覆盖 / ArkUI coverage

对照 [ArkUI 官方组件目录](https://github.com/openharmony/docs/blob/master/en/application-dev/reference/apis-arkui/Readme-EN.md)，平台拥有控件并不等于本库已经暴露其全部属性、事件和生命周期。

The platform catalog is broader than this library's model-facing contract:

| ArkUI 能力 / Capability | 当前边界 / Current boundary |
| --- | --- |
| Column、Row、原生 Stack、RelativeContainer | 已复用基础行列；OpenUI `Stack` 是行列布局，不表示 ArkUI 叠放 Stack / Basic rows and columns; no general overlay or relative-layout mapping |
| List、Grid、WaterFlow、Refresh | 旧目录有有界 List；mapped 卡片列表尚无虚拟化、网格、瀑布流和刷新协议 / Bounded lists; no mapped virtualization, grid, waterfall or refresh contract |
| Navigation、NavDestination、Tabs、Swiper | 示例页面由宿主导航；未开放模型导航栈、标签页或轮播 / Host-owned navigation; no generated navigation stack, tabs or carousel |
| Image、ImageAnimator、Video、Canvas、Shape | 支持图片；视频、帧动画、画布与任意绘图尚未映射 / Images supported; other media and drawing remain unmapped |
| 系统能力 / System integration | 主题令牌和基础标签已接入；手势、动画、系统大字体和完整辅助功能仍需专门契约及真机覆盖 / Theme tokens and basic labels; broader interaction and accessibility need separate work |

ArkUI 的布局、动画与事件属于[平台基础设施](https://github.com/openharmony/docs/blob/master/en/application-dev/ui/arkui-overview.md)。本轮优先完善通用选择和数据契约，后续按真实交互场景扩映射，不把整套平台 API 直接交给模型。

The next mappings should follow actual interaction needs, with native event/state contracts, rather than exposing the entire platform API at once.

## 仍有的缺口 / Remaining gaps

| 能力 / Capability | 差异和后续工作 / Gap and next step |
| --- | --- |
| 日期 / Dates | 旧目录有 CalendarPicker，但官方 mapped DatePicker 使用 Date / DateRange；尚未定义日期对象和 ISO 值的规范化、时区与 range 契约 / Existing picker is not full upstream date/range support |
| Slider | 原生旧字段是一个 number，官方值是 `number[]`；尚未实现数组状态、提交和 reset 适配 / Scalar native state is not the upstream array contract |
| Chips、OptionCards | 官方单选/多选状态和 defaultValue 规则与 boolean record 不同；尚未映射 / Selection arrays are not checkbox records |
| 通用 Modal | 当前确认 sheet 是固定结构，不能等价替代任意 children、open 关闭写回和完整弹层生命周期 / Fixed confirmation is not generic Modal |
| ListBlock、图文列表 / Lists | 当前结果由通用 Card/Image/Text/Button 组合；尚无官方 ListBlock 完整映射、业务 keyed fields、原生虚拟化或分页 / Composed cards are not a complete virtualized list API |
| Callout | 官方 visible 绑定包含 3 秒自动消失和状态写回，不能只画一个 Status 后声称完整支持 / Rendering a status is not the timed stateful contract |
| 系统主题 / System theme | 宿主可传主题；自动跟随系统、全控件大字体和系统级无障碍验收仍不完整 / Host themes are not complete system integration |
| 恢复 / Restoration | 控制器快照不包含完整 mapped 程序、官方 store 和宿主流程；缺少统一持久化/恢复契约 / A controller snapshot alone cannot restore a mapped session |
| 流式与编辑 / Streaming and edits | mapped API 接完整程序；尚未提供 provider SSE、模型 statement patch 合并与状态保留契约 / Native reactive patches are not model-source incremental editing |
| Query / Mutation | 官方已有查询管理器，本库尚无宿主工具暴露、取消、失败回滚及权限契约 / No host tool-provider lifecycle contract yet |
| 表格、图表、富文本 / Tables, charts, rich text | 尚未完整映射；不把 AGenUI 示例、基本 Table 或 HTML 子集当成完整 OpenUI 能力 / Example components and bounded renderers are not full parity |

日期与 Slider 的差异来自[官方日期实现](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/components/DatePicker/DatePicker.tsx)和 [Slider schema](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/Slider/schema.ts)。Modal 与 Callout 分别见[官方 Modal](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/Modal/index.tsx)、[Callout](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/Callout/index.tsx)。

官方还提供单独的 [openuiChatLibrary](https://github.com/thesysdev/openui/blob/9823ec05d4b29bc78d101676dc16b44fe17f1830/packages/react-ui/src/genui-lib/openuiChatLibrary.tsx)：以固定垂直的 Card 为根，减少布局参数，并支持 sources。未来可新增独立聊天 profile；本轮不改变 mapped@1 的 Card 参数顺序或根组件，避免破坏已有程序。

Upstream's chat-specific library is a useful future profile reference. It is not automatically interchangeable with the existing Stack-root mapping profile.

## 验证与边界 / Verification boundary

主机测试应分别验证默认值、required、aggregate/reset、说明保留、计算列表的可见条目及动作归属；真机再验证点选、焦点、屏幕朗读、布局和图片加载。节点预算、主机回放或编译通过不代替物理设备证据。新验收须绑定具体构建，不能沿用 v0.4 的产物哈希。

The library remains independent of Sofia. It supplies neither live availability nor booking/payment execution. Model-generated text is not proof of a business outcome. This is a bounded native adapter, not complete ArkUI/OpenUI coverage.
