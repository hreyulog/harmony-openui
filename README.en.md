# Harmony OpenUI

![Harmony OpenUI — Generative UI for HarmonyOS](docs/images/harmony-openui-banner.png)

[简体中文](README.md) | English

**OpenUI Lang → native HarmonyOS ArkUI interfaces.**

An independent community adapter that reuses the official OpenUI parser, renders model-generated component declarations with precompiled ArkUI components, and returns user actions to the host application. Built for choices, data entry, multistep forms, and result panels in chat. No WebView or on-device compilation of generated ArkTS is required.

This is not an official OpenUI or Huawei SDK. v0.6 gives the general mapping runtime a consistent native visual hierarchy, reusing the official OpenUI state / expression engine and existing native controls. It remains a bounded adaptation, not a complete OpenUI or ArkUI implementation.

**v0.6: a consistent native visual hierarchy.** Headings, body text, captions, cards and three button priorities now receive explicit native styling. Equal-width filter columns, grouped preferences, highlighted submitted values and collapsed demo tools replace the earlier test-console presentation. The mapped catalog remains at 19 entries; no domain-specific widget was added. [Visual rules](docs/visual-design.md)

Nova completed **actual model list → local filters and sorting → Chinese editing and choices → model-generated read-only result**. The final flow used four real provider requests, including one bounded result correction. Local interactions made no model request. All 196 Node checks and two Python checks passed; the actual list also passed 24 host-replayed combinations. [v0.6 verification](docs/verification-v06.md) · [Original screenshot comparison](docs/visual-review-v06.html) · [Actual programs and receipt](docs/evidence/2026-10-21-v06/acceptance.json)

| Image results and secondary action | Grouped native form | Primary and text actions | Model-generated read-only result |
| --- | --- | --- | --- |
| <img src="docs/images/nova-v06-20261021/result-cards.jpeg" width="210" alt="Separate image cards and centered secondary buttons"> | <img src="docs/images/nova-v06-20261021/preference-form.jpeg" width="210" alt="Chinese input and native preference controls"> | <img src="docs/images/nova-v06-20261021/form-actions.jpeg" width="210" alt="Primary save button and transparent reset action"> | <img src="docs/images/nova-v06-20261021/model-result.jpeg" width="210" alt="Submitted facts with distinct labels and values"> |

<details>
<summary>v0.5 historical native evidence: data lists and choice controls</summary>

**v0.5: data-driven image results, native radio choices and preference switches.** The mapped catalog contains **19 declarations**, reusing the same 22 native IR kinds. Official `Each / Filter / Sort / Count` handle result lists; the model need not handwrite a predicate for every card. [Mapping architecture](docs/mapping.md) · [OpenUI / ArkUI gap comparison](docs/gaps-v05.md)

Nova completed **real model-generated results → local filtering, sorting and selection → native radio/switch preferences → model-generated read-only result**. The accepted candidate used three provider requests without repair requests; local interaction needed none. Its actual list passed all 24 filter/order combinations in host replay, and the final result preserved the submitted transit mode and mixed switch states. 186 Node and 2 Python checks passed. [v0.5 verification](docs/verification-v05.md) · [Actual programs and receipt](docs/evidence/2026-10-21-v05/acceptance.json)

| Reordered image results | Native choices and descriptions | Required validation | Accurate model-generated result |
| --- | --- | --- | --- |
| <img src="docs/images/nova-v05-20261021/reverse-results.jpeg" width="210" alt="Forest and bookstore after reverse sorting"> | <img src="docs/images/nova-v05-20261021/choice-form.jpeg" width="210" alt="Independent switches and selected transit radio"> | <img src="docs/images/nova-v05-20261021/form-required.jpeg" width="210" alt="Localized required errors for name and radio choice"> | <img src="docs/images/nova-v05-20261021/model-result.jpeg" width="210" alt="Read-only result preserving all submitted values"> |

</details>

<details>
<summary>v0.4 historical device evidence: inputs, checkbox records and live forms</summary>

**v0.4: model-generated image results → local filtering and selection → native form → model-generated result.** The generic mapped catalog now contains 15 components, adding text inputs, checkbox records and named forms while reusing existing native controls and the official state / expression engine. [Mapping architecture](docs/mapping.md)

The complete flow ran on Nova with real MiniMax requests, checking typing focus, aggregate checkbox state, localized required errors, reset and live submitted values. The same generated sources passed all twelve filter combinations and nine form/result replay cases. Five provider requests included two bounded corrections; filtering, typing and reset required no model requests. [v0.4 verification](docs/verification-v04.md) · [Actual programs and receipt](docs/evidence/2026-10-20-v04/acceptance.json)

| Filtered image result | Required validation | Native editing and multi-selection | Model-generated result |
| --- | --- | --- | --- |
| <img src="docs/images/nova-v04-20261020/filtered-forest.jpeg" width="210" alt="Locally filtered forest activity"> | <img src="docs/images/nova-v04-20261020/form-required.jpeg" width="210" alt="Localized required errors after blank submission"> | <img src="docs/images/nova-v04-20261020/form-filled.jpeg" width="210" alt="Live name, notes and both selected items"> | <img src="docs/images/nova-v04-20261020/model-result.jpeg" width="210" alt="Read-only model result retaining submitted values"> |

</details>

<details>
<summary>v0.3 historical device evidence: image filtering, reset and selection</summary>

**v0.3: model-generated image result cards with native combined filters, reset and selection.** `OpenUiMappedRuntime` maps a subset of upstream components to existing AGenUI / ArkUI controls. Official `$state`, bindings and conditional expressions run locally without another model request. The v0.2 forms API remains available. [Mapping architecture and example](docs/mapping.md)

v0.3 completed **actual MiniMax generation → combined category/duration filters → empty state → reset → correct callbacks for all four items** on Nova. The accepted run used one model request and retained both native Select identities. The same program also passed all twelve host-replayed filter combinations. [v0.3 verification](docs/verification-v03.md) · [Actual model program and receipt](docs/evidence/2026-10-20-v03/acceptance.json)

| Local filters and image | Museum result | Empty state | Host selection receipt |
| --- | --- | --- | --- |
| <img src="docs/images/nova-v03-20261020/filtered-forest.jpeg" width="210" alt="Filtered native forest result"> | <img src="docs/images/nova-v03-20261020/filtered-museum.jpeg" width="210" alt="Museum category and duration filter"> | <img src="docs/images/nova-v03-20261020/empty-result.jpeg" width="210" alt="Empty result state"> | <img src="docs/images/nova-v03-20261020/selection-receipt.jpeg" width="210" alt="Correct bookstore intent received by host"> |

</details>

<details>
<summary>Historical v0.2 device evidence: forms, choices and confirmation</summary>

v0.2 completed **model-generated form → native editing and validation → confirmation sheet → model-generated result** on a physical Nova phone. Reopening chosen dates, repeated time changes, cancel-without-submit, and native image loading were checked. Travel is an acceptance fixture; the SDK contains no ticket-booking business logic. [v0.2 verification](docs/verification-v02.md) · [Actual model output and build receipt](docs/evidence/2026-10-20-v02/acceptance.json)

| Model form | Native controls | User confirmation | Model result and image |
| --- | --- | --- | --- |
| <img src="docs/images/nova-v02-20261020/model-form.jpeg" width="210" alt="Model-generated native trip form"> | <img src="docs/images/nova-v02-20261020/preferences.jpeg" width="210" alt="Native input and selection controls"> | <img src="docs/images/nova-v02-20261020/confirmation.jpeg" width="210" alt="User-triggered native confirmation sheet"> | <img src="docs/images/nova-v02-20261020/result-image.jpeg" width="210" alt="Model result with native list and loaded image"> |

</details>

<details>
<summary>Historical v0.1 device evidence: choices, themes and card isolation</summary>

The v0.1 standalone demo completed **real MiniMax generation → native option tap → model-generated result on the same surface** on a physical Nova phone. Light/dark themes, expandable details, equal-ID card isolation, and resizing were also exercised. These historical screenshots use fictional data; Sofia integration is not included.

| Model-generated choices | Result after selection | Dark result | Narrow card and independent theme |
| --- | --- | --- | --- |
| <img src="docs/images/nova-20261020/model-choice.jpeg" width="210" alt="Two options generated by the model on Nova"> | <img src="docs/images/nova-20261020/model-result.jpeg" width="210" alt="Model-generated result after tapping option B"> | <img src="docs/images/nova-20261020/model-result-dark.jpeg" width="210" alt="The same result in the dark theme"> | <img src="docs/images/nova-20261020/isolation-narrow.jpeg" width="210" alt="Card A reflows at a narrower width while card B keeps its independent theme"> |

[Device verification and artifact hashes](docs/verification.md) · [Actual model output and acceptance receipt](docs/evidence/2026-10-20/acceptance.json)

</details>

## How it fits together

```mermaid
flowchart LR
  App[Host application / agent] -->|Catalog and observed facts| Model[Any model]
  Model -->|OpenUI Lang / text chunks| Parser[Official lang-core parser]
  Parser --> Adapter[Harmony adapter and validation]
  Adapter --> State[Surface state]
  State --> Native[AGenUI + native ArkUI components]
  Native -->|User action and current revision| App
  App -->|Next-step data or result| Model
```

Harmony OpenUI adds a native adaptation layer around the official parser. It does not embed the upstream web renderer or reproduce its full component catalog.

| Layer | Implementation |
| --- | --- |
| Language parsing | The actual `@openuidev/lang-core@1.0.1` parser, bundled from the pinned dependency. |
| Component contract | A bounded catalog, with schema and model prompt generated from the same definitions. |
| State and actions | A platform-neutral component representation, surface controller, revisions, live form values and validation, selection, read-only state, snapshots, and validated action receipts. |
| HarmonyOS rendering | The public `@agenui/agenui@1.6.0` native backend and precompiled ArkUI builders for composite components. The adapter handles native sizing, themes, mount isolation, and action routing. |
| Application behavior | Model transport, data retrieval, tools, permissions, history, persistence, and business effects belong to the host. |

The model supplies declarations and content, rather than executable ArkTS. An action such as choosing an option returns data to the host; the host decides what happens next.

## What v0.5 adds

- Four upstream-signature radio/switch mappings reuse existing controls and state adapters.
- Four official data computations support bounded result lists; old button events remain associated with their original action plan after sorting.
- Radio descriptions remain visible and contribute to basic accessibility labels. SwitchGroup remains independent of FormControl.
- The host supplies normalized display facts for model result layout and retains a real wrong-mode response as a regression fixture.

## Retained v0.4 form support

- Six additional mappings: `Input`, `TextArea`, `CheckBoxItem`, `CheckBoxGroup`, `Buttons`, `Form`; 15 entries in total.
- Existing native text editors and checkboxes, with boolean-record group state held by the official store.
- Required-field / any-choice group validation and current `formName` / `formState` payloads, rather than model-guessed answers.
- Remaining errors persist through editing; Reset clears validation state; new programs start with new defaults.
- Structural work triggered inside native input callbacks is coalesced until the callback returns.
- An independent filtered list → plan editor → result flow, with host-owned model requests and supplied facts.

These v0.3 capabilities remain available:

## Retained mapping features

- One central mapping registry supplies schema, prompt, support manifest and native projection.
- A bounded upstream-signature subset: `Stack`, `Card`, `CardHeader`, `TextContent`, `Image`, `Button`, `Select`, `SelectItem`, `FormControl`.
- Official local store, expressions and bindings; local `@Set` / `@Reset`; business context preserved in `@ToAssistant`.
- Reactive structural patches retain the native manager and surviving node identities. Removed nodes receive new identities on reappearance.
- A standalone filtered image-list demo. Sofia remains separate and unchanged.

The existing `OpenUiLanguageStream` API retains these features:

## Retained v0.2 features

- The official parser, generated component schema, and model system prompt.
- Incremental parsing, retention of the last valid interface, and complete-program replacement. Incomplete native properties do not interrupt incoming text chunks.
- `Stack`, `Row`, `Card`, `Text`, `Button`, `Option`, `Facts`, `Status`, and `Details`.
- New `Form`, `TextInput`, `TextArea`, `Search`, `Checkbox`, `Toggle`, `Select`, `RadioGroup`, `Slider`, `DatePicker`, `TimePicker`, `Image`, `List`, and `Dialog`: 23 model-facing components in total, not a complete ArkUI mapping.
- Live field values stored separately from model-authored declarations. Editing does not increment the document revision or remount the whole card. The controller validates `@Submit` and attaches the current user values.
- Independent surfaces and themes, selected/read-only state, snapshots, layout-status receipts, stale-callback rejection, and event deduplication.
- A standalone demo for choices followed by results, and for trip details → preferences → results. A real model can generate the first form and final result; the middle preferences page is a host-supplied example.
- An optional A2UI v0.9 / v0.9.1 NDJSON subset adapter sharing the same state and rendering layers.

The SDK contains no model network client. Selecting a component does not automatically place an order, make a payment, or operate another app.

## Quick start

Build the HAR and add it as a local dependency to your HarmonyOS project, retaining its public OHPM dependencies. This repository does not currently document an npm or OHPM registry release of Harmony OpenUI. The compile target is HarmonyOS API 24, with a minimum compatible API of 20. Public exports are in [`openui/Index.ets`](openui/Index.ets).

After building, run this in the host module directory:

```powershell
ohpm install D:/openui-build/har-01/artifacts/harmony-openui-0.4.0.har
```

Import the local package as `@hreyulog/harmony-openui`. The parser is bundled in the HAR; the host does not need a separate npm parser or model SDK.

```ts
import { OpenUiController, OpenUiActionReceipt, OpenUiLanguageStream,
  OpenUiView } from '@hreyulog/harmony-openui';

@Component
struct GeneratedPanel {
  private controller: OpenUiController = new OpenUiController({
    onAction: (event: OpenUiActionReceipt): void => {
      // The host decides whether to select, disable, run a tool,
      // or request another model-generated interface.
      console.info(event.name + ': ' + JSON.stringify(event.context));
    }
  });
  private stream: OpenUiLanguageStream =
    new OpenUiLanguageStream(this.controller, 'answer');

  aboutToAppear(): void {
    this.stream.replace('root = Stack([Text("Choose the next step", "heading"), ' +
      'Option("Option A", "Example description", "Available", @Choose("a"))])');
  }

  build() {
    OpenUiView({ controller: this.controller, surfaceId: 'answer' })
  }
}
```

Provide `OpenUiLanguageStream.systemPrompt()` as the model's system instruction, together with facts obtained by the host. For streaming content, call `append(chunk)` on the same stream in order, then `append('', true)` when the response ends. Use a new stream or `replace(source)` for a new complete response.

`@Choose("a")` produces `name: 'choose', context: { value: 'a' }`. `@ToAssistant` and `@OpenUrl` also return action data only; the host implements their effects. See the [schema](schemas/openui-lang-v0.1.json) and [catalog definitions](tools/lang/library.mjs) for the supported syntax.

The host explicitly calls `controller.setSelected(surfaceId, componentId)` and `controller.setReadOnly(surfaceId, true)` when appropriate. To continue, it runs a tool or requests another model response, then supplies the new interface to the stream. `onAction` itself only returns an event.

## Forms and continuation

The same catalog lets a model declare inputs without generating executable ArkTS or assembling the user's answers inside an action:

```text
root = Stack([trip])
trip = Form("trip", [name, seat, date, send])
name = TextInput("traveler", "Traveler", "", "Enter a name", true)
seat = Select("seat", "Seat class", [{label:"Second class",value:"second"},{label:"First class",value:"first"}], "second", true)
date = DatePicker("date", "Departure date", "2026-10-23", "2026-10-20", "2026-12-31", true)
send = Button("Continue", @Submit("trip"))
```

The declaration for `@Submit("trip")` contains only `{ form: 'trip' }`. After the user enters valid data, the host receives `name: 'submit', context: { form: 'trip', fields: { traveler: '…', seat: 'second', date: '…' } }`. These values come from current controller state. Model-authored or native-callback field payloads are rejected; read-only, disabled, revision, and deduplication checks remain in effect. The host is responsible for trustworthy defaults; format validation does not establish factual accuracy. The host decides whether to render the next form, call a business tool, or request a result.

Use `onFieldChange` for edit notifications, `getFormValues(surfaceId, formName)` to read values, `validateForm` to show validation errors, and `setFieldValue` for host-driven edits. Supply `validationMessage(code, component)` for localized errors. Forms cannot nest, field keys are unique within each form, and disabled controls are omitted from submission. Dates use `YYYY-MM-DD` within `0001-01-01`–`5000-12-31`; times use 24-hour `HH:mm`.

`Image` accepts a host-supplied HTTPS URL and alternative text, loaded by a native image component. `List` has a bounded 120–480 vp scroll viewport. `Dialog` opens a native confirmation sheet after a user tap; cancellation returns no action. See the [state contract](docs/protocol.md) and [architecture](docs/architecture.md).

## Build and test

Requirements: Python 3.10+, Node.js 22.18+ or 24, pnpm 11.25.0, Git, and Huawei's official HarmonyOS Command Line Tools 6.1.1 / API 24 SDK with DevEco JBR (Java 17). Windows PowerShell example:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:lang
pnpm test
python -m unittest discover -s tests -p 'test_*.py'

# Use a fresh output directory outside the source checkout.
python tools/build.py --target har --work-dir D:/openui-build/har-01 `
  --cli-home <HarmonyOS-command-line-tools> --java-home <JBR>

# Compile the standalone demo; an unsigned HAP cannot be installed.
python tools/build.py --target all --unsigned --work-dir D:/openui-build/demo-01 `
  --cli-home <HarmonyOS-command-line-tools> --java-home <JBR>
```

The build script freezes sources into the external directory, installs locked dependencies, generates the parser, and compiles the selected targets. It records logs, dependency checks, and artifact hashes. The public AGenUI 1.6.0 archive and its installed files are checked for integrity. Use a new `--work-dir` for each build; `--node` and `--pnpm` can specify executable paths.

To install the demo on a retail device, register its exact bundle, `com.hreyulog.harmonyopenui.demo`, and create a legitimate device debug Profile in AGC. Build with `--signing-config <private-JSON-outside-the-checkout>`. Signing materials must stay private; the script rejects a Profile with the wrong bundle. See [building.md](docs/building.md) for signing and model configuration.

## Demo and verification

The v0.6 mapped demo connects image filtering and sorting to a plan editor. The model generates the list, editing card, and final result separately. Filters and inputs update locally; submission carries current named-form values and independent switch state in separate business context. Before displaying a generated list, the demo host checks all twenty-four filter/sort combinations. It converts submitted values into explicit display facts for the result model. An invalid program may receive one model repair request; the host never rewrites generated source. The SDK contains neither these fixture facts nor model transport.

The demo uses explicitly fictional itinerary data to test interaction; it is not a live ticket search. It supports OpenAI-compatible and Anthropic-compatible HTTPS model requests. Keys entered through its configuration screen remain in memory. An optional developer configuration file must remain in the app-private directory, outside the package and repository.

The current demo receives complete model HTTP responses and then feeds them to the parser in chunks. It does not implement provider SSE framing. The SDK can accept text chunks from a real network stream. After a choice, the host requests the result and updates the same surface.

The new native forms example has three stages: `trip → preferences → result`. With “Model form”, a real model generates the initial trip form. After submission, the host supplies a fixed preferences form; confirming its native sheet sends both sets of submitted values to the model for a read-only result, list, and project banner. “Reset example” uses local demonstration data throughout. Model output, submitted values, and actual image loading need separate checks. This flow does not search, reserve, or purchase tickets.

The v0.2 candidate accepted on 2026-10-20 passed **91 Node tests and 2 Python tests**, HAR/signed-HAP compilation, and the documented native flow on a **HUAWEI nova 15 Pro, API 26**. Host tests do not replace native visual and interaction checks. API 20 is the declared compatible minimum, including `LayoutPolicy.fixAtIdealSize`; physical acceptance covers API 26, not every supported OS version.

See the [v0.2 verification record](docs/verification-v02.md) for exact scope, submitted values, screenshots, and artifact hashes.

## Current limitations

- The new mapping API supports `$state`, conditions and local Set / Reset. Query / Mutation, charts, video, navigation, arbitrary drawing and the complete upstream / ArkUI catalogs remain outside scope. Business workflows remain host-owned.
- Mapping-driven local structural changes use native patches. New programs, theme / width changes and incompatible component identities still remount safely. The legacy stream retains complete-structure replacement. The mapped API currently accepts complete programs, not streaming program edits.
- Images need host-supplied HTTPS URLs and a working network/permission environment. The library does not search for images or guarantee remote availability. Lists have bounded data and viewports, without remote pagination or infinite loading.
- The A2UI adapter implements a limited subset, not full protocol conformance.
- The SDK and demo are independent of Sofia; integration has not been implemented.

Documentation: [v0.5 device verification](docs/verification-v05.md) · [Gap comparison](docs/gaps-v05.md) · [Mapping layer](docs/mapping.md) · [Architecture](docs/architecture.md) · [Protocol and state](docs/protocol.md) · [Rendering and themes](docs/rendering.md) · [Build](docs/building.md) · [Verification](docs/verification.md)

Upstream references: [OpenUI architecture](https://www.openui.com/docs/openui-lang/architecture) · [Defining components](https://www.openui.com/docs/openui-lang/defining-components) · [ArkUI](https://developer.huawei.com/consumer/cn/arkui/) · [AGenUI](https://github.com/AGenUI/AGenUI)

## License

The adapter, state layer, rendering integration, demo, and tools are Apache-2.0. The official OpenUI parser and Zod retain MIT licensing. AGenUI's main library is Apache-2.0; its native dependencies retain LGPL-2.1, MIT, and other applicable licenses. See [LICENSE](LICENSE), [NOTICE](NOTICE), [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES), and [native dependency notes](docs/third-party-native.md).
