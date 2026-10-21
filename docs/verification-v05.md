# v0.5 验证 / Verification — 2026-10-21

验收候选为 **build-r3**，在 HUAWEI nova 15 Pro、API 26、1320 × 2856 真机运行独立应用 `com.hreyulog.harmonyopenui.demo`，完成实际模型列表 → 筛选、排序、选择 → 原生计划表单与独立开关 → 模型只读结果。未集成 Sofia。

The accepted candidate is build-r3 of the independent demo, physically exercised on Nova/API 26. Host replay, compilation and actual native interaction are recorded separately.

本轮为同一 mapped profile 增加四类 Radio/Switch 映射，共 **19 类模型组件、22 类原生 IR**；结果计算复用官方 Each、Filter、Sort、Count。目录和原生状态边界见 [mapping.md](mapping.md) 与 [gaps-v05.md](gaps-v05.md)。

## 实际模型与真机 / Actual model and native interaction

最终 r3 使用 MiniMax-M3 实际生成[列表](evidence/2026-10-21-v05/model-list.openui)、[表单](evidence/2026-10-21-v05/model-form.openui)和[结果](evidence/2026-10-21-v05/model-result.openui)，每阶段 1 次，共 **3 次供应商请求，0 次修复请求**。筛选、排序、输入、多选和 Reset 均在本地执行，不请求模型。此前失败 r2 的 4 次请求单独归档，不能算作最终成功请求。

The accepted r3 run used three real provider requests without a repair. An earlier rejected r2 run used four requests, including one unsuccessful result-repair request. The seven recorded requests are distinguished in [model-attempts.json](evidence/2026-10-21-v05/model-attempts.json).

| 真机操作 / Physical interaction | 观察 / Observation |
| --- | --- |
| 4 条列表正序、反序 / Ascending and descending results | 图片卡片顺序随 Sort 改变；5 个顶部可见检查点的三个 Select native ID/hash 保持 / Correct order; stable Select identities in five visible checkpoints |
| 反序选择首条 / Select the first reversed result | 正确回传 `forest-trail`，没有借用正序首条的业务参数 / Correct selected business identity |
| 展馆 + 短时、Reset、公园 + 长时 / Empty, reset and forest filter | 分别为 0、4、1 条；空状态和 Count 正确 / Correct visible counts and empty state |
| 空表单提交 / Blank required submission | 2 个错误，无外部动作 / Two inline errors, no external action |
| 连续输入 `W` → `Wa` → `Walk` | 同一 native TextInput ID/hash 持续 focused，剩余 mode 错误保留 / Stable input identity/focus and remaining error |
| 两个 Switch 均选中，再取消 remind | accessible 保持 true / Independent aggregate entry is preserved |
| Radio 依次选择 walk、transit / Change radio choice | 字符串值准确变化；选项说明保留 / Exact value changes, descriptions retained |
| Reset 后重新填写 / Reset and refill | 恢复全部默认值、清除错误；最后填写 Walk、BringWater、transit / Defaults restore, final live values retained |
| 提交并显示结果 / Submit and show result | 仅一次表单业务回调；准确显示公共交通和两项偏好，结果只读且无动作节点 / Accurate read-only result |

最终运行共 **2 个外部业务回调**：选择 1 个、表单提交 1 个。保存 **20 个原生检查点、5 张已目视截图**。同一进程 PID `24458` 保持到结束；自身日志的 5 类故障标记未命中，5 个原生叶节点边界均在所属容器内。这些检查不等于覆盖全部崩溃类型或完整屏幕朗读验收。

The run produced two external callbacks, twenty native checkpoints and five visually reviewed screenshots. One process remained active, no checked fault markers appeared, and all five inspected native leaves stayed inside their containers.

两张滚动到图片区的检查点中，Select 不在可见 UITree 内，记录为 `not-visible-in-capture`，不据此声称检查过原生 hash。控制器的三个逻辑 Select ID 与值在全部 7 个列表检查点另外核对；这和原生可见节点证据分开。

The two scrolled image captures contain no visible Select nodes. Their native hashes are not inferred; logical controller IDs/values are checked separately across all seven list captures.

表单的实时字段与表单外 SwitchGroup 的显式业务 context 分开。最终 `continue_conversation` receipt 的 `context` 为：

The live form and independent switch context remain separate:

```json
{
  "message": "提交计划",
  "context": {
    "intent": "save-plan",
    "itemId": "forest-trail",
    "preferences": {"remind": true, "accessible": false}
  },
  "formName": "plan",
  "formState": {
    "plan": {"planName": "Walk", "mode": "transit", "notes": "BringWater"}
  }
}
```

SwitchGroup 没有被塞进官方不支持的 FormControl union，宿主核对开关 context 与当前运行时记录一致。详见 [device-checks.json](evidence/2026-10-21-v05/device-checks.json)。This is a UI intent receipt, not evidence that an external plan was saved or a booking was made.

## 真实失败与修复 / Actual failure and correction

较早 r2 的原生输入与提交链路已通，但模型最终结果把已提交的 `transit` 写成步行；初次和一次修复均未通过宿主事实校验。应用保留可编辑 Form，没有把错误结果展示为成功。真实输出保留为[错误方式回归样本](../tests/fixtures/mapped-model-wrong-mode.openui)，此前 4 个模型候选单独归档。

In r2, both result candidates misstated the travel mode. The host rejected them and kept the working form. This failure is retained, rather than being described as native completion.

r3 在示例宿主中先把提交值转换为明确的中文 displayFields，再让模型排版，并逐项校验名称、备注、去处、公共交通和偏好说明。没有自动改写模型源码，也没有把这套旅行事实规则加入 SDK。SDK 的通用回归另外检查 Each 重排后旧原生 payload 不能借用新条目的完整动作计划。

The demo host supplies explicit display facts and validates the generated result. Those domain checks stay outside the SDK; generic stale-action association remains a library concern.

## 同源回放 / Actual-source replay

同一份实际模型列表通过 **24/24 筛选 × 排序组合、32 个可见条目动作、24 次空状态检查、24 次 Count 检查、24 次 Reset**，旧位置 payload 检查通过；表单和结果 **9/9 cases** 通过，只产生 1 个有效表单外部动作。

See [list replay](evidence/2026-10-21-v05/list-replay.json) and [planner replay](evidence/2026-10-21-v05/planner-replay.json). This is model-free replay through the actual official runtime and ETS wrapper, not a claim that every combination was also touched on the phone.

## 构建与产物 / Build and artifacts

| 检查 / Check | 结果 / Result |
| --- | --- |
| Node 回归 / Node checks | 186 passed |
| Python 构建工具 / Python build tools | 2 passed |
| HAR 与签名 HAP / HAR and signed HAP | build-r3 compiled successfully |
| 官方签名校验 / Official signature verification | Exit 0; original AGC Profile and signing leaf matched |
| AGenUI 原生库 / AGenUI native libraries | 4 packaged libraries verified |
| 冻结编译输入 / Frozen compiled inputs | 62 public product/build inputs matched |

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `harmony-openui-0.5.0.har` | 1195749 | `29086a0c2f5400151535fb978ec495c9d36d3274def77fae10cd908d844ba6fc` |
| `harmony-openui-demo-0.5.0-signed.hap` | 8084214 | `baa40dfabc296795a6c01f0db435150ef5a5ce78945f94fc22cc7fa941fa4b8c` |

[完整回执](evidence/2026-10-21-v05/acceptance.json)与[源码哈希](evidence/2026-10-21-v05/compiled-source-hashes.json)绑定最终候选。哈希从公共源码字节匹配冻结清单，再计算 Git 换行归一化值，不读取注入私密签名的 staged build-profile。产物、密钥、签名配置和完整设备状态留在仓库外。

Public evidence is sanitized. Post-build documentation is not compiled-source evidence, and v0.4 artifact hashes are not reused for this candidate.

## 截图与范围 / Screenshots and scope

原始真机截图：[反序结果](images/nova-v05-20261021/reverse-results.jpeg)、[空结果](images/nova-v05-20261021/empty-result.jpeg)、[单选与开关表单](images/nova-v05-20261021/choice-form.jpeg)、[必填错误](images/nova-v05-20261021/form-required.jpeg)、[模型结果](images/nova-v05-20261021/model-result.jpeg)。

资料为宿主提供的虚构 facts，配图不是地点实景，无真实搜索、预订、付款或其它业务执行。实机只覆盖这一台 Nova/API 26。日期 range、Slider 数组、任意 Modal、虚拟列表、完整系统主题和 mapped 会话恢复仍未完成；Each 下可编辑字段不支持。原生标签/布局检查不代表完成全场景无障碍验收。模型文案和布局仍为原型质量。

This independent adapter has bounded OpenUI/ArkUI coverage and is not integrated into Sofia. The recorded checks establish neither broad device compatibility nor a business outcome.
