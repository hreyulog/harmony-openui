# v0.6 视觉验证 / Visual verification — 2026-10-21

最终候选 **build-r3**，独立应用 `com.hreyulog.harmonyopenui.demo`，HUAWEI nova 15 Pro / API 26 / 1320 × 2856。仍未集成 Sofia。

This acceptance separates the actual native flow, host replay and source-bound build evidence.

## 实际模型与交互 / Actual model and interaction

MiniMax-M3 通过应用实际生成[列表](evidence/2026-10-21-v06/model-list.openui)、[表单](evidence/2026-10-21-v06/model-form.openui)、[结果](evidence/2026-10-21-v06/model-result.openui)。最终共 **4 次请求，含 1 次结果修正**；本地筛选、排序、明暗切换、中文输入、选择和 Reset 不请求模型。没有手工改写返回的模型程序。

The final flow used four provider requests, including one bounded result correction. Exact candidates are retained, including the rejected candidate. The first result placed two labels in one row and their two values in another; this violated the host's adjacent label/value pairing contract and triggered `UI_RESULT_FIELDS`, rather than the row-count guard.

| 真机检查 / Native check | 观察 / Observed |
| --- | --- |
| 筛选、空结果、重置、反向排序 | 4 → 0 → 4 条，反序首项为林间步道；仅一次选择回调，`itemId=forest-trail` |
| 同一程序明暗切换 | 字体、表面和控件主题变化；筛选与排序值保留；这是宿主切换，不是系统自动跟随 |
| 空表单提交 | 两个必填错误，无业务回调 |
| 独立开关与 Reset | 修改一项保留另一项；Reset 恢复默认状态并清除错误提示 |
| 连续中文输入 | `周末` → `周末慢游`；同一个原生 TextInput 的 ID、hash 和焦点保持 |
| 当前值提交 | 计划名“周末慢游”、备注“带水和雨伞”、公共交通、提醒 true、无障碍 false |
| 只读模型结果 | 六项宿主事实准确，标签与值区分，无输入、按钮或业务动作 |

保存 **16 个最终原生检查点、6 张目视复核截图**。从列表到结果保持 PID 55063；自身当前可用日志未命中所查 5 类故障标记；5 个受检原生叶节点横向边界均在容器内。检查范围不代表覆盖所有崩溃类型、系统主题、字号或完整无障碍验收。

Sixteen final native checkpoints and six reviewed original screenshots cover this one phone and the recorded interactions. Host replay additionally checks all 24 filter/sort combinations and nine form/result cases; those are not 24 physical-device runs.

## 视觉与真实失败 / Visual changes and actual failures

[视觉规则](visual-design.md)明确文字、按钮、卡片、行列与控件的通用原生投影。示例宿主收起开发工具，并向模型说明手机排版要求。目录仍为 19 类模型声明、22 类 IR，没有新增业务卡片。

早期 r1 的模型为列表添加了重复标题，使首屏过长；r2 的结果事实正确，但把六项信息塞进一个 Row，文字挤成竖条。该实际输出保留为[回归样本](../tests/fixtures/mapped-model-overcrowded-result.openui)。r3 增加示例宿主的“每行最多两项”结果校验及明确提示，模型需要在现有组件中重新排版；库本身没有硬编码旅行字段或这一条业务验收规则。前两轮保留为仓库外诊断，不作为最终通过记录。

The rejected six-column result is a real recorded output. The demo's layout validator and fact validator remain host concerns; generic native typography, button roles, cards and row tracks belong to the library.

## 构建 / Build

196 项 Node、2 项 Python 检查通过。HAR 与签名 HAP 已编译，官方签名校验 exit 0、原始 AGC Profile 和签名叶证书匹配，4 个打包原生库通过校验。62 个公共产品/构建输入与冻结源码一致；文档和测试不属于编译输入。密钥、完整设备状态、签名材料和二进制包留在仓库外。

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `harmony-openui-0.6.0.har` | 1201111 | `ec2630e0bdc55c1c2e323423c054bb1960a29ab4e000eec3df689829e222603c` |
| `harmony-openui-demo-0.6.0-signed.hap` | 8125876 | `054ff3000209f1f90a6803242a85a9ef99ccb63f65d00298e6f2cd2c5f0b868b` |

[完整回执](evidence/2026-10-21-v06/acceptance.json) · [源码哈希](evidence/2026-10-21-v06/compiled-source-hashes.json) · [模型候选](evidence/2026-10-21-v06/model-attempts.json) · [列表回放](evidence/2026-10-21-v06/list-replay.json) · [表单回放](evidence/2026-10-21-v06/planner-replay.json) · [原始截图对比](visual-review-v06.html)

## 范围 / Scope

资料为虚构活动，图片为类型配图；没有真实搜索、预订或付款。深色 Select 箭头仍沿用系统默认颜色，其对比度和弹出菜单主题需要继续完善；没有宣称完整系统无障碍或全部 ArkUI/OpenUI 覆盖。长标题、窄屏与更多内容类型仍需扩大样例。这里交付通用视觉基线与实际模型流程，模型排版仍需宿主校验。

This independent native adapter remains a bounded prototype. The screenshots show actual model output, not guaranteed output for arbitrary prompts or business completion.
