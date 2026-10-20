# v0.4 验证 / Verification — 2026-10-20

验收候选为 **build-r5**，在 HUAWEI nova 15 Pro、API 26、1320 × 2856 真机运行独立应用 `com.hreyulog.harmonyopenui.demo`，跑通真实模型列表 → 原生计划表单 → 模型只读结果。未集成 Sofia。

The accepted candidate is build-r5 of the independent demo. Actual model generation and native interaction completed the results → plan form → read-only result flow on Nova/API 26.

v0.4 在同一 `harmony-openui/mapped@1` profile 增加 Input、TextArea、CheckBoxItem、CheckBoxGroup、Buttons、Form，共 15 类模型组件，复用已有 22 类原生 IR 和 ArkUI 桥接。没有新增业务专用控件。The six additional mappings reuse existing native controls; the demo host owns model transport and business-specific checks.

## 实际模型与原生交互 / Actual model and native interaction

MiniMax-M3 在 Nova 上通过 HTTPS 实际生成[列表](evidence/2026-10-20-v04/model-list.openui)、[表单](evidence/2026-10-20-v04/model-form.openui)和[只读结果](evidence/2026-10-20-v04/model-result.openui)。供应商请求共 **5 次**：列表 2 次、表单 1 次、结果 2 次，包括 **2 次有界修复**。筛选、连续输入、多选和 Reset 不请求模型。

All three screens came from actual model responses. Five provider requests include two validation repairs; local interaction needs no model round trip. Invalid candidates remain recorded rather than being presented as successful generations.

| 真机操作 / Physical interaction | 观察 / Observation |
| --- | --- |
| 筛选、空结果、Reset / Filter, empty state, reset | 空结果提示随匹配状态变化；重置恢复列表 / Empty text follows matching state; reset restores results |
| 选择林间步道 / Choose forest trail | 回传 `forest-trail`，进入生成的计划表单 / Correct item enters the generated form |
| 空必填提交 / Blank required submission | 无外部动作；显示字段及多选组错误 / No external action; inline errors appear |
| 连续输入 `W` → `Wa` → `Walk` | 同一 `openui_m9_4`、hash `849:678`，持续 focused；未解决的组错误保留 / Stable field identity and focus; unrelated group error remains |
| camera、water 均选中，再取消 camera | water 保持 true / Other aggregate choice is preserved |
| Reset 后重新填写 / Reset, then refill | 值和错误清空；填入 Walk、BringWater，camera/water 均为 true / Defaults restore; live values are refilled |
| 提交并生成结果 / Submit and generate result | 仅 1 次表单业务回调；结果 `readOnly=true`，没有动作节点 / One form callback; read-only result has no action nodes |

整个流程外部业务回调共 **2 次**：选择 1 次、有效表单提交 1 次。共保存 **16 个真机检查点、5 张已目视截图**。林间步道图片加载已确认。应用始终为 PID `27517`，检查自身日志的 5 类故障标记未命中；4 个原生叶节点的边界检查均在所属容器内。这些检查不等同于覆盖全部崩溃类型或无障碍行为。

The accepted flow produced two external callbacks, sixteen native checkpoints and five visually reviewed screenshots. The process retained one PID, no checked fault markers appeared, and all four inspected native leaves stayed within their containers. These are bounded observations.

表单回调携带以下实时值；模型提供的业务 context 与用户字段分开，未泄露内部生成的复选字段名：

The normalized form callback contains live logical values, separately from model-supplied business context:

```json
{
  "message": "提交计划",
  "context": {"intent": "save-plan", "itemId": "forest-trail"},
  "formName": "plan",
  "formState": {
    "plan": {
      "planName": "Walk",
      "notes": "BringWater",
      "gear": {"camera": true, "water": true}
    }
  }
}
```

这些字段位于 `continue_conversation` receipt 的 `context` 中。原生检查点和回调记录见 [device-checks.json](evidence/2026-10-20-v04/device-checks.json)。The object above is the receipt's context, not a claim that a plan was saved to an external service.

## 回放与修复 / Replay and fixes

使用同一份实际生成源码、实际官方运行时，在电脑上完成 **12/12 筛选组合、16 个条目动作、12 次空状态检查、12 次 Reset**；表单与结果 **9/9 cases** 通过，仅产生 1 次有效表单外部动作。见[列表回放](evidence/2026-10-20-v04/list-replay.json)与[表单回放](evidence/2026-10-20-v04/planner-replay.json)。这是不请求模型的源码回放，不代表全部组合又在手机上操作一遍。

Host replay validates the actual model source and callback semantics. It does not replace native focus, touch, image-loading or display evidence.

本轮实测发现并修复：列表曾常驻空结果文案，示例宿主现对全部 12 组合校验；模型曾将组件写成 `$state` 初始值，现被字面量限制拒绝并返回修复请求。每个生成阶段最多初次请求加一次修复，不自动挪参数或改写模型源码。这些业务验收规则属于示例宿主。SDK 另外修复原生 onChange 栈内刷新重入，以及宿主重入时精确 revision 的回调关联，并有对应回归检查。

The demo host rejects incorrect empty-state behavior and invalid state declarations, with at most one model repair per generation stage. SDK fixes cover deferred native-edit updates and exact revision association across reentrant host callbacks. No domain-specific filtering engine was added to the SDK.

## 构建与产物 / Build and artifacts

| 检查 / Check | 结果 / Result |
| --- | --- |
| Node 回归 / Node checks | 157 passed |
| Python 构建工具 / Python build tools | 2 passed |
| HAR 与签名 HAP / HAR and signed HAP | Compiled successfully |
| 官方签名校验 / Official signature verification | Exit 0; original AGC Profile and signing leaf matched |
| AGenUI 原生库 / AGenUI native libraries | 4 packaged libraries verified |
| 冻结编译输入 / Frozen compiled inputs | 62 public product/build inputs matched |

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `harmony-openui-0.4.0.har` | 1187643 | `772226c361d7b74f63ad4d72b382675699eb3d039d229481c0c5d37b99e2fccc` |
| `harmony-openui-demo-0.4.0-signed.hap` | 8036021 | `dbf6d07cfb4e33fd96e5280ce27a6d9150da815d84d4acdbf25ff622c07912f0` |

[完整回执](evidence/2026-10-20-v04/acceptance.json)记录请求、交互和产物；[编译输入](evidence/2026-10-20-v04/compiled-source-hashes.json)以公共源码字节匹配冻结清单，再计算 Git 换行归一化哈希，不读取注入私密签名的 staged build-profile。产物、签名材料和私密设备状态不放入仓库。

Public evidence is sanitized. Source hashes come from public bytes matched to the frozen manifest; post-build documentation is not compiled-source evidence. No private signing configuration, model key or full device-state dump is published.

## 截图与范围 / Screenshots and scope

原始真机截图：[林间步道](images/nova-v04-20261020/filtered-forest.jpeg)、[空结果](images/nova-v04-20261020/empty-result.jpeg)、[必填错误](images/nova-v04-20261020/form-required.jpeg)、[填写完成](images/nova-v04-20261020/form-filled.jpeg)、[模型只读结果](images/nova-v04-20261020/model-result.jpeg)。

演示 facts 是宿主提供的虚构资料，配图不代表真实地点，没有真实搜索、预订、付款或其它业务执行。API 20 编译与 API 26 真机分别记录；实机只覆盖这一台 Nova。有限目录仅支持文本 Input、既有三行 TextArea 和 required 规则，没有完整 ArkUI/OpenUI 覆盖、Query/Mutation、任意代码执行或 Sofia 集成。文案与布局仍是模型原型输出。

Facts are fictional fixtures, not live availability. Physical coverage is one Nova/API 26 device. The bounded catalog and prototype visuals do not establish full platform parity, production visual acceptance or a completed business operation.
