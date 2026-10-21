# Visual design / 视觉设计

Version 0.6 gives the existing mapped components a consistent native visual hierarchy. The model chooses semantic structure and action priority; the host translates those choices into theme tokens and supported AGenUI/ArkUI properties. This document describes the implementation, not a device acceptance report.

0.6 为已有映射组件统一原生视觉层级。模型选择内容结构与操作优先级，宿主将这些语义转换为主题和底层实际支持的属性。本文说明实现，不代表真机验收结论；独立示例没有接入 Sofia。

## Roles / 语义角色

| Role / 角色 | Default native presentation / 默认原生表现 |
| --- | --- |
| Page heading / 页面标题 | A direct `CardHeader` can introduce a page without another enclosing Card. Its title uses the heading role; its subtitle uses the quieter caption role. / 页面标题可直接使用 `CardHeader`，不必再套卡片；标题和副标题分别使用标题与辅助文字层级。 |
| Text / 文字 | `h1`/`h2`/`h3`: 28/22/19 vp; body: 16 vp; caption: 13 vp. Headings use weight 600; body uses 400. Caption color comes from the secondary token. / 标题、正文、说明有独立字号、字重和颜色。 |
| Primary / 主要操作 | Solid accent, white centered label, weight 600. / 强调色实底，白色居中文字，字重 600。 |
| Secondary / 次要操作 | Group surface, divider border, normal text color and centered label. / 浅分组底色、细边框、正文色居中文字。 |
| Tertiary / 低强调操作 | Transparent background and accent-colored centered label; mapped to native borderless. / 透明底、强调色居中文字，投影到原生 borderless。 |
| Card / 内容卡片 | Theme surface, 16 vp padding, 16 vp corner radius and a subtle divider border. `clear` removes the fill, inset and border. / 普通卡片有表面、内边距和细边框；`clear` 用于无需额外包裹的内容。 |
| Image / 图片 | Full parent width, cover fit, default 16:9 aspect ratio and 12 vp rounded corners. The supplied URL and accessible description are preserved. / 默认满宽、裁剪填充、16:9 比例、12 vp 圆角，保留来源和无障碍说明。 |

The default button target height is 48 vp, with 12 vp corner radius and 14 vp horizontal padding. Theme dimensions remain configurable. AGenUI basic-component dimensions use two A2UI px per logical vp; custom ArkUI controls use vp directly. The basic Card/secondary-button border is `1px` in that A2UI coordinate system, not a 1 vp border.

按钮默认高度为 48 vp，圆角为 12 vp，水平内边距为 14 vp。主题尺寸仍可配置。基础 AGenUI 组件使用 2 A2UI px = 1 vp 的坐标转换，自定义 ArkUI 控件直接使用 vp，不能混用这两种单位。

## Layout and controls / 布局与控件

The default `OpenUiView` inset is now zero: the host owns page margins, while Card owns its own content inset. This avoids an extra padded card around every generated view. Existing host themes can still set a view inset explicitly. Ordinary Row children without an authored width receive equal, shrinking tracks, so a full-width label or native control cannot claim the entire row. This is bounded Row behavior, not an automatic responsive grid.

`OpenUiView` 默认不再自带外围内边距：宿主管页面边距，Card 管卡片内部留白。旧宿主仍可明确设置 view inset。未指定宽度的普通 Row 子项会均分可收缩空间，避免某个满宽文字或控件独占整行；这不等于通用响应式网格。

Text inputs and Select use a 48 vp native field, a group background and a rounded outline. TextArea remains 108 vp high. Field labels precede their values. Radio options display the supplied description beneath the label; the selected option also changes background and border. Switch labels appear before the switch, while Checkbox labels follow the checkbox. Validation messages remain visible below the associated control. Radio accessibility text combines group label, option label and description; Switch descriptions remain separate visible text.

输入框和 Select 统一原生高度、底色与圆角描边；多行输入框保持 108 vp。Radio 以标签、说明和选中态区分选项。Switch 标签在开关前，Checkbox 标签在勾选框后。错误提示仍跟随对应字段。Radio 的无障碍文字包含组名、选项与说明，Switch 的说明是独立可见文字。

The light and dark palettes explicitly provide canvas, surface, group, text, secondary, divider and accent roles. These are host-selected themes; this release does not add automatic system-theme following, a complete dynamic-color system or a full accessibility audit.

明暗主题分别提供画布、卡片、分组、文字、辅助文字、分隔线和强调色。当前由宿主选择主题，本次没有增加自动跟随系统主题、完整动态配色或全量无障碍验收。

## Real rendering, not CSS promises / 以实际渲染能力为准

The pinned AGenUI Button recognizes primary and borderless, so the adapter explicitly projects secondary/tertiary fills, borders and child-label styles before lowering to those supported native variants. Text alignment is applied to the label itself. Card chrome is also explicit: the underlying Card does not supply a white background by its name alone.

锁定版本的 AGenUI Button 原生只识别 primary 和 borderless。因此适配层先明确写入主次按钮的背景、边框和标签样式，再使用底层支持的 variant；不能只传一个 `secondary` 名称就声称原生已实现。文字居中设置在标签本身，Card 外观也由投影层明确提供。

The public IR style allowlist remains bounded. Border width/color and the Row flex-track properties used by the adapter are controlled native projection details, not newly exposed model-authored CSS. This work does not claim support for arbitrary shadows, elevation, gradients, fonts or ArkUI modifiers. Author-supplied supported styles still override the corresponding theme defaults.

公开 IR 的样式白名单保持有限。适配层使用的边宽、边色和 Row 伸缩属性属于受控原生投影，不是向模型开放新的任意 CSS。本次不宣称任意阴影、elevation、渐变、字体或 ArkUI modifier 都可用。宿主明确提供的已有受支持样式仍优先于对应默认主题值。

The demo generation prompt favors one concise page heading, one compact filter group, ordinary image-result Cards and a low-emphasis Reset. It avoids duplicate headings and unnecessary Card nesting. This instruction is demo composition guidance, not a parser restriction or a rewrite of returned model programs. Local selection, input and Reset retain the existing state/action contracts; final results retain the existing read-only boundary.

示例生成提示词要求简洁页面标题、紧凑筛选区、普通图文结果卡和低强调重置按钮，避免重复标题与不必要的嵌套卡片。这属于示例排版指导，不是解析器限制，也不会重写模型返回的程序。本次视觉调整沿用已有状态、操作和只读结果边界，没有新增业务执行能力或扩展完整组件目录。

Implementation / 实现：[theme](../openui/src/main/ets/render/OpenUiTheme.ets), [projection](../openui/src/main/ets/render/OpenUiProjection.ets), [native controls](../openui/src/main/ets/render/OpenUiControlsLayout.ets), [mapped registry](../tools/lang/mapped-registry.mjs). See [rendering](rendering.md) for lifecycle, sizing and update boundaries.
