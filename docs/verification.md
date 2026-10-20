# Historical v0.1 verification — 2026-10-20

Current form/media acceptance is recorded separately in [v0.2 verification](verification-v02.md). The evidence below describes v0.1 only.

The independent demo was installed and exercised on a physical HUAWEI nova 15 Pro (API 26, portrait, 1320 × 2856). The accepted build is **final-r9**, with renderer diagnostics disabled in both source and staged compilation.

## Build and host checks

| Check | Result | Scope |
| --- | --- | --- |
| `node --test tests/*.test.cjs tests/*.test.mjs` | 52 passed | Official parser, core/state contracts, renderer boundaries with SDK mocks, demo lifecycle and model transport. |
| `python -m unittest discover -s tests -p 'test_*.py'` | 2 passed | External source snapshot and build/signing path boundaries. |
| Library `assembleHar` | Passed | Actual ArkTS/API compilation, including the bundled upstream parser. |
| Demo `assembleHap` | Passed | Actual independent native demo compilation. |
| Official `hap-sign-tool verify-app` | Exit 0 | Matching AGC-issued debug certificate and original device Profile; embedded Profile bytes matched exactly. |
| Dependencies and notices | Passed | All 32 installed AGenUI files matched the pinned public archive; all 4 packaged native libraries matched. Root and upstream notices were checked in HAR and HAP. |

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `harmony-openui-0.1.0.har` | 601589 | `7615c2ee1744a006f8d9876d0a73628ac4ad453d8eb233b0f2da0f7521f7b78a` |
| `harmony-openui-demo-0.1.0-signed.hap` | 5985401 | `e69dac845c246f48262aa8e5e051a80b5d645dfad4a95ca6f006971f3b10f329` |

Signing materials and the device-specific signed HAP are not committed. Rebuild using [building.md](building.md). The [acceptance receipt](evidence/2026-10-20/acceptance.json) records hashes of the 46 product/build input files that matched the frozen build; this write-up and screenshots were added after compilation. Byte-identical builds across different machines have not been established.

## Physical-device checks

| Scenario | Observed result |
| --- | --- |
| Cold start | Both complete Options, prices, selection indicators and Details appeared with nonzero native layout. |
| Real model generation | The demo made an HTTPS request to MiniMax-M3 using its Anthropic-compatible endpoint and rendered the returned OpenUI Lang. This was not preset playback. |
| Native tap → continuation | Tapped model-generated **方案B**. The receipt retained `surfaceId: main`, `sourceComponentId: n_planB`, `name: choose`, `context.value: b`, revision 7. A second model request produced revision 15 on `main`. |
| Read-only result | Visible Facts showed **08:00**, **08:49**, **49分钟**, **二等座**, **¥51.5**, with a demonstration/not-ordered label. The result was read-only and contained no Option or Button. |
| Details | A real tap expanded the long model-generated explanation; a second tap collapsed it and reduced layout height. |
| Themes | The same result rendered in light and dark themes. Two simultaneous cards retained different themes. |
| Equal-ID isolation | Separate controllers used identical `shared`, `root`, `n_choice` IDs. Selecting A, updating A, and selecting B produced A:1/B:1. After removing A, B remained clickable and reached B:2. |
| Resize | A's outer width switched 100% → 70% → 100%. Its Option width was **1082 → 728 → 1082 physical pixels**, and height **290 → 364 → 290** as text wrapped. B remained at 1082 px. Selection and source identity survived. |
| Native bounds | All visible semantic `JsView` bounds stayed within their own `__Common__` surface bounds for cold start, model choice/result, expanded details, equal-ID cards, narrow/restored A and removed A. |

The bounds check also rejected the earlier overflowing model layout before the host-width fix. The accepted package obtains actual host content width before mounting, fences old size reports, and uses `LayoutPolicy.fixAtIdealSize` to escape the native leaf's initial zero-height constraint. See [rendering.md](rendering.md).

Original screenshots: [choice](images/nova-20261020/model-choice.jpeg), [result](images/nova-20261020/model-result.jpeg), [dark result](images/nova-20261020/model-result-dark.jpeg), [narrow A and independent B](images/nova-20261020/isolation-narrow.jpeg).

Actual provider output: [choice program](evidence/2026-10-20/model-choice.openui), [result program](evidence/2026-10-20/model-result.openui). The [structured receipt](evidence/2026-10-20/acceptance.json) contains artifact/source/screenshot hashes and native bounds without model credentials, account details, or device identifiers.

## Boundaries

The two model requests used fictional demonstration itinerary data, not real ticket availability or a purchase. Provider HTTP responses were complete, then replayed incrementally into the parser; provider SSE was not exercised.

Device acceptance covers this phone/API and these scenarios. It does not establish all nested layout patterns, every font/rotation setting, all supported OS versions, or full upstream OpenUI/A2UI conformance. API 20 compatibility is compiled; physical-device acceptance was on API 26.

The SDK remains independent of Sofia. Upstream native source/binary correspondence and recipient relinking have not been independently verified; see [third-party-native.md](third-party-native.md).
