# v0.3 验证 / Verification — 2026-10-20

验收包为 **build-r4**，在 HUAWEI nova 15 Pro、API 26、1320 × 2856 真机上验证。应用包名是独立的 `com.hreyulog.harmonyopenui.demo`。没有修改或集成 Sofia。

The accepted candidate is build-r4 of the independent demo. This record separates physical interaction from host replay; neither is a claim of full OpenUI or ArkUI coverage.

## 实际模型与原生交互 / Actual model and native interaction

Nova 上通过 HTTPS 请求 MiniMax-M3，实际生成 [OpenUI 程序](evidence/2026-10-20-v03/model-results.openui)。四条虚构去处资料和配图地址由示例宿主提供；模型生成布局、两个 Select、条件表达式、重置和选择 Action。SDK 没有写入这些业务筛选条件。

| 真机操作 / Physical interaction | 结果 / Observation |
| --- | --- |
| 初始全部类型、不限时长 | 4 个图文条目 |
| 公园步道 | 湖畔慢走、林间步道，共 2 条 |
| 公园步道 + 约 2 小时 | 林间步道，1 条 |
| 公园步道 + 约 1 小时 | 湖畔慢走，1 条 |
| 展馆 + 约 1 小时 | 0 条，显示“没有匹配结果，请调整筛选” |
| 展馆 + 约 2 小时 | 城市展馆，1 条 |
| 重置筛选 | 两个字段均恢复 `all`，4 条重新出现 |
| 全部类型 + 约 1 小时 | 湖畔慢走、街角书店，共 2 条 |
| 书店 + 约 1 小时 | 街角书店，1 条 |
| 依次点选四个不同条目 | 宿主分别收到 `forest-trail`、`lake-walk`、`city-museum`、`corner-books`，上下文未串条目 |
| 再次重置 | 4 条恢复；没有增加外部选择事件 |

以上过程始终只有 **1 次模型请求**。两个 Select 的 native ID 和 UI 节点 hash 在十个检查点完全一致；筛选、空结果和重置没有重建它们。四张 HTTPS 配图均在真机截图中实际出现，并非仅检查 URL 或 layout 状态。应用进程在整段验收中保持同一 PID，自己的日志中未发现已检查的崩溃标记。

Only one model request was made during the accepted run. Both native Select identities and UI node hashes remained unchanged through all ten checkpoints. Image loading was inspected visually. These observations do not establish unrestricted memory, accessibility or visual-design acceptance.

## 全组合回放 / Exhaustive host replay

对同一份 Nova 实际生成的程序，使用实际官方运行时在电脑上回放了 **12 种类型 × 时长组合**，12/12 通过。16 个可见条目的按钮回调都保留正确 `itemId`，12 次重置均恢复全部四项且不产生外部 Action。

This is model-free host replay of the actual device-generated source, not a claim that all twelve combinations were additionally operated on the phone. See [replay receipt](evidence/2026-10-20-v03/model-replay.json) and [native checkpoints](evidence/2026-10-20-v03/device-checks.json).

## 本次真机发现并修复的问题 / Device-discovered defect

较早候选的模型把派生条件声明为 `$showLake = expression`，且重复声明同一个 `$name`。上游 store 将这些非字面量初始值保存为 AST 对象，条件因此恒为真：选择展馆后仍有 4 条。当前映射 profile 复用官方 tokenizer、statement splitter 和 expression parser，明确拒绝重复声明与非字符串／数字／布尔字面量初始化；派生条件直接放入组件表达式。无效程序保留上次成功界面和绑定。

The earlier actual model program is retained as a [regression fixture](../tests/fixtures/mapped-model-derived-state.openui). No new derived-expression engine was introduced. The accepted candidate generated the inline predicates and passed the physical and replay checks above.

## 构建与产物 / Build and artifacts

| 检查 / Check | 结果 / Result |
| --- | --- |
| Node 解析、状态、渲染与示例检查 | 124 passed |
| Python 构建工具检查 | 2 passed |
| 原生 HAR 与签名 HAP | Compiled successfully |
| 官方签名校验 | Exit 0; original AGC Profile bytes and certificate matched |
| AGenUI 1.6.0 | Public archive integrity and 4 packaged native libraries verified |
| 编译输入 | 58 product/build inputs matched the accepted frozen build |

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `harmony-openui-0.3.0.har` | 1169221 | `8c91b9332b18c0f8d089cc9b22b243b049c9d24165bf53a2eb619bbc57057626` |
| `harmony-openui-demo-0.3.0-signed.hap` | 7932728 | `97fe2e207b34baf154453e985726f00c99bf4313c937f5192c74e5e21729ecdc` |

产物和签名材料保存在源码之外。文档与验收资料在构建后整理；[编译输入哈希](evidence/2026-10-20-v03/compiled-source-hashes.json)分别记录实际字节与 Git 换行归一化后的哈希，不宣称不同机器产物逐字节一致。[完整回执](evidence/2026-10-20-v03/acceptance.json)

## 截图与边界 / Screenshots and boundaries

原始真机截图：[全部结果](images/nova-v03-20261020/result-list.jpeg)、[公园与长时筛选](images/nova-v03-20261020/filtered-forest.jpeg)、[展馆](images/nova-v03-20261020/filtered-museum.jpeg)、[书店](images/nova-v03-20261020/filtered-bookstore.jpeg)、[选择回传](images/nova-v03-20261020/selection-receipt.jpeg)、[空结果](images/nova-v03-20261020/empty-result.jpeg)。图片由宿主提供 Unsplash HTTPS 地址，均为活动类型配图，不是这些虚构地点的实景。

本次验证通用映射、状态和交互；文案、排版仍是模型生成的示例级输出，不代表最终视觉设计。没有真实地点查询、预订、付款或其他业务执行。最低兼容 API 20 已编译，真机只覆盖 API 26。Query/Mutation、完整 ArkUI／OpenUI 目录、provider SSE 和映射程序的增量编辑均不在本次范围内。旧 v0.2 表单的完整真机记录保留在 [verification-v02.md](verification-v02.md)。
