# v0.2 verification — 2026-10-20

The accepted candidate is **build-r5**, installed on a physical HUAWEI nova 15 Pro, API 26, at 1320 × 2856. It is the independent `com.hreyulog.harmonyopenui.demo` application. No Sofia code, market package, backend, or business service was changed.

This validates a reusable native component/runtime implementation. The trip workflow is a demo host: field names, business requirements, transitions, model transport, and result prompts are outside the SDK.

## Build and host checks

| Check | Result |
| --- | --- |
| Actual official-parser, controller, renderer-boundary and demo tests | 91 passed |
| Python build-tool boundary tests | 2 passed |
| Native library `assembleHar` | Passed |
| Independent demo `assembleHap` | Passed |
| Official `hap-sign-tool verify-app` | Exit 0; original AGC Profile bytes and issued certificate matched |
| Public AGenUI dependency verification | 32 installed files and 4 packaged native libraries matched the pinned archive |
| Notices | Checked in HAR and HAP |
| Product inputs | All 54 product/build source files matched the frozen accepted build |

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `harmony-openui-0.2.0.har` | 669978 | `8c48d9eb00338c6cc9d06fa21e415bb7291354ecb54d9a96802ebb93d8ddec37` |
| `harmony-openui-demo-0.2.0-signed.hap` | 6278301 | `e0c313795cd53d5d61437344c3af53b25abbc3f01ef446c313ac2b8df0244d94` |

Private signing credentials and device-specific binaries are outside the repository. Documentation and sanitized evidence were added after compilation; product inputs are independently hashed in the [acceptance receipt](evidence/2026-10-20-v02/acceptance.json). This is not a cross-machine byte-reproducibility claim.

Input hashes describe the actual frozen build bytes. Where Git normalizes CRLF to LF, the receipt also records `gitNormalizedSha256`; all staged product files were checked against the corresponding build input.

## Physical-device acceptance

| Scenario | Observed result |
| --- | --- |
| Real model form | MiniMax-M3 returned OpenUI Lang over the Anthropic-compatible HTTPS endpoint; the official parser and native renderer displayed its form. This was not preset playback. |
| Required input | Submitting an empty traveler field showed the host's Chinese error and dispatched no action. |
| Keyboard editing | Three separate edits produced `L` → `Li` → `Lin` at revision 10, with the keyboard remaining open and the same native editor. The keyboard screenshot remains private because the system keyboard displayed unrelated clipboard suggestions. |
| Search | Cleared the initial destination, observed the required error, then entered `Beijing`; the submitted value was exactly `Beijing`. |
| Native Select and date | Changed second to first class, selected `2026-10-24`, reopened the calendar, and observed the chosen date retained. |
| Read-only | Input, Search, Select and CalendarPicker were disabled. Returning to edit mode retained the entered values. |
| First Submit | Exactly one `trip` event contained `Lin`, `Beijing`, `first`, and `2026-10-24`. The host replaced the surface with its preferences form. |
| Native controls | Entered `DemoNote`, unchecked direct service, disabled reminders, selected aisle, and moved the slider to 800. Both the visible slider number and state were 800. |
| Repeated time changes | Selected 09 → 01 → 10 → 02 → 11 → 03. The final time was `11:03`, at the same document revision 13, without losing the process or field state. |
| User-triggered confirmation | Tapping the launcher opened a native sheet. Cancel preserved one accepted action; reopening and confirming produced exactly the second `preferences` Submit, with current values. |
| Real model continuation | A second HTTPS model request used both submitted forms. The same `forms` surface displayed a read-only Status/Facts/List/Image result at revision 15. |
| Media and list | Native list items were visible, and the HTTPS project banner actually loaded and appeared in the screenshot. |
| Native bounds | Visible custom leaves stayed inside their own host bounds in the form, preferences, and scrolled result captures. |
| Accepted process | Alive after the flow; its captured log contained no `DfxSignalHandler`, `SIGSEGV`, or `JSERROR` lines. |

An earlier candidate (r3) suffered a confirmed main-thread SIG11 after a TimePicker change. The native callback synchronously echoed controller state back through the renderer. The fix avoids that echo, retains stable selected Date objects, defers auxiliary redraws, and uses atomic controlled-state updates for genuine host corrections. Both r4 and the accepted r5 repeated the original sequence and further hour/minute changes successfully. Faultlogger access was unavailable, so this record does not claim a C++ stack diagnosis or identify a specific platform UAF function.

## Evidence

- [Model form](evidence/2026-10-20-v02/model-form.openui) and [model result](evidence/2026-10-20-v02/model-result.openui): actual provider programs.
- [Submitted fields and action receipts](evidence/2026-10-20-v02/submitted-fields.json): authored fictional fixtures only.
- [Structured acceptance and hashes](evidence/2026-10-20-v02/acceptance.json).
- Original screenshots: [form](images/nova-v02-20261020/model-form.jpeg), [required error](images/nova-v02-20261020/required-error.jpeg), [preferences](images/nova-v02-20261020/preferences.jpeg), [confirmation](images/nova-v02-20261020/confirmation.jpeg), [result](images/nova-v02-20261020/model-result.jpeg), [loaded image](images/nova-v02-20261020/result-image.jpeg).

## Boundaries

The first form and final result were model-generated. The intermediate preferences form and workflow are host-supplied; the SDK does not know travel field names or make business requests. No availability query, order, purchase, or payment occurred. The renderer displays model-provided text, including raw enum strings when the model chooses them; business label mapping belongs to the host/model contract.

Provider responses were complete, then parsed locally; provider SSE was not exercised. Host tests use SDK mocks where appropriate and cannot replace these device observations. API 20 compatibility compiled, but physical acceptance covers this API 26 phone and these scenarios, not every OS, layout, font setting, or ArkUI/OpenUI capability. See the [architecture](architecture.md) and [rendering scope](rendering.md).

The original v0.1 evidence is retained separately in [verification.md](verification.md).
