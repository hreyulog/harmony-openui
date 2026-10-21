# Native state and input adapters

The public direction is **OpenUI Lang → the upstream OpenUI parser → native intermediate representation → ArkUI**. The controller does not implement a competing OpenUI language parser. A2UI NDJSON is a separate compatibility adapter, not the SDK's only input language.

All files in `core/` are new SDK code. The controller does not depend on a phone agent, a model provider, a chat product, an approval service, or an application database.

## State contract

`OpenUiController.apply(change)` accepts five intermediate operations:

| kind | fields | behavior |
| --- | --- | --- |
| `create` | `surfaceId`, optional `catalogId` | Creates an empty surface. The supported catalog is `urn:harmony-openui:catalog:0.1`. |
| `components` | `surfaceId`, `components`, optional `replace`, optional `syncFieldValues` | Upserts definitions by component ID. `replace: true` atomically replaces the complete component set; language adapters should use it for complete parsed programs. `syncFieldValues` is allowed only with `replace: true`. |
| `patch` | `surfaceId`, complete `components`, optional `syncFieldValues` | Atomically replaces the complete IR after local state evaluation. Requires a `root` and all child references to exist. Publishes an incremental-render hint when retained identities are compatible. |
| `data` | `surfaceId`, `valueJson`, optional `path` | Replaces the root data model or upserts a JSON Pointer path. `valueJson` is serialized JSON, including quotes for a string. |
| `delete` | `surfaceId` | Removes a surface. Old action and render callbacks no longer match a live revision. |

Updates are validated before replacing state. Forward references are permitted for streaming `components` updates; known cycles, duplicated IDs and multiple parents are rejected. A missing child can arrive in a later update. A `patch` is a complete replacement, never an upsert or a partial diff, and cannot leave missing references. Only the `root`-reachable tree is interactive. Unknown component types do not silently become native support.

`getSurface(id)` and `surfaces()` return detached snapshots. `subscribe`/`unsubscribe` notify the embedding application. Revisions increase across structural/data updates, including patches, host selection changes, deletion/recreation and snapshot restoration. A live renderer session advances its document revision only while applying a validated patch. Callbacks from a retired native ID or an earlier mount cannot acquire the revision of a replacement owner.

`surface.updateMode` is a renderer hint, not permission to bypass validation. A patch requests `patch` mode when retained component kinds and field identities remain compatible. Reusing an ID with a different component kind, field key/form/input variant/input type, or changing an existing `OpenUiDialog` definition requests `replace` instead. Theme and host-width changes can also require a renderer replacement. Other controller document operations and snapshot restoration use `replace` mode.

## Native catalog

`schemas/native-ir.schema.json` documents the native representation. v0.3 exposes 22 native kinds. The existing v0.2 language profile still has 23 model-facing components, mapped to its original 21 kinds:

- Basic `Column`, `Row`, `Card`, `Text`, `Button`.
- Native `OpenUiOption`, `OpenUiFacts`, `OpenUiStatus`, `OpenUiDetails`.
- `OpenUiForm`, `OpenUiInput` (text / textarea / search variants), `OpenUiCheckbox`, `OpenUiToggle`, `OpenUiSelect`, `OpenUiRadioGroup`, `OpenUiSlider`, `OpenUiDatePicker`, `OpenUiTimePicker`.
- `OpenUiImage`, `OpenUiList`, `OpenUiDialog`.

The additional basic `Image` kind has `source`, `alt`, and optional `aspectRatio` properties and maps directly to AGenUI's native Image. It is separate from the retained `OpenUiImage` custom ArkUI control. Both use the same validated HTTPS URL and aspect-ratio limits.

The catalog identifier and legacy generated language-schema filename retain `0.1` for compatibility with existing surfaces and build consumers; the SDK package is v0.5.0. This does not make an older renderer capable of drawing newly added components. The opt-in mapped language profile has its own schema and support manifest.

Text properties accept a literal string or `{ "path": "/some/data" }`. Fact groups carry label/value records. Semantic component layout belongs to the native renderer and its injected theme. The input cannot inject host-only selection/read-only state or arbitrary component factories.

This list is not a claim of complete OpenUI or A2UI compatibility. The core accepts evaluated IR; it does not evaluate language expressions or execute queries, mutations or arbitrary component code. The mapped adapter delegates its supported local state and expressions to official `lang-core`, as described below. Each adapter rejects unsupported constructs explicitly. The A2UI adapter supports the specified component subset, root/path data upserts and lifecycle operations; omitted-value data deletion is not supported. An application can replace the complete data model to remove a field.

The AGenUI backend must register these native component names before sending definitions. The public renderer's catalog ID does not itself load a remote library or authorize a component.

## Legacy model-facing forms and media

The existing 23-component profile, used through `OpenUiLanguageStream`, uses the following positional signatures. `?` marks an optional argument; supplied optional arguments must keep this order. These signatures remain compatible with v0.2. The official parser reads these declarations and the native catalog performs authoritative property and graph validation. Do not mix them with the mapped profile's component signatures.

| Component | Arguments |
| --- | --- |
| `Form` | `name, children` |
| `TextInput` | `field, label, value?, placeholder?, required?, disabled?, inputType?` |
| `TextArea`, `Search` | `field, label, value?, placeholder?, required?, disabled?` |
| `Checkbox`, `Toggle` | `field, label, value?, required?, disabled?` |
| `Select`, `RadioGroup` | `field, label, options, value?, required?, disabled?` |
| `Slider` | `field, label, value?, min?, max?, step?, disabled?` |
| `DatePicker` | `field, label, value?, minDate?, maxDate?, required?, disabled?` |
| `TimePicker` | `field, label, value?, required?, disabled?` |
| `Image` | `source, alt, aspectRatio?` |
| `List` | `items, title?, height?` |
| `Dialog` | `label, title, text, action, confirmLabel?, cancelLabel?` |

Input variants map to `OpenUiInput` with `variant: 'text' | 'textarea' | 'search'`; other legacy types map to the corresponding `OpenUi`-prefixed name. `Form` retains its children as source component IDs; the renderer namespaces them separately for native use. The language adapter omits undefined optional properties rather than inventing values.

Forms appear in `Stack` or `Card`, cannot nest, and must have unique names. Field keys are unique within their containing form. Form and field identifiers are limited to 64 characters; prototype-related reserved names are rejected. Controls must descend from a form to take part in its submission. `@Submit("trip")` must originate inside that same named form. A direct IR document may use stable field IDs independently from these field keys.

Values are strings for text/select/date/time, booleans for checkbox/toggle, and finite numbers for sliders. Unspecified values default to `''`, `false`, or a slider's `min` (default `0`). Select/radio options contain `{label, value}`, have distinct values, and contain 1–100 entries. A default nonempty selection must be one of those values. TextInput's `inputType` is `text`, `number`, `email`, or `tel`. Number/email inputs receive validation; `tel` is an input type, not phone-number verification.

Validation checks shape and allowed values, not whether model-provided initial data is factually correct. The host must supply trustworthy defaults and decide which information requires user review.

Dates are real calendar dates in `YYYY-MM-DD`, within `0001-01-01`–`5000-12-31`, matching the native CalendarPicker range. Inclusive `minDate`/`maxDate` must form a valid range. Times use 24-hour `HH:mm`. Sliders require finite `min < max` and `0.01 <= step <= max - min`; values must lie on that step. Empty required fields can be declared so a user can fill them, but cannot be submitted. A required checkbox or toggle must be true.

Images use host-supplied HTTPS URLs (maximum 2048 characters), alternative text (maximum 500), and an optional aspect ratio from `0.25` to `4`. Lists contain 1–100 `{title, description?, meta?}` items, with a viewport height from 120 to 480 vp. These bounds do not guarantee a remote image is reachable. Image loading is a native platform operation; there is no model-side image search, arbitrary HTML, or executable media source.

`Dialog` is a user-tapped confirmation launcher rendered as a native confirmation sheet. Only the explicit confirm button forwards its declared action; cancel, close, or dismiss does not. Its action is subject to the same controller checks as a normal button. A confirmation sheet can carry `@Submit` inside the matching form; it does not itself authorize payment or perform business effects.

## Official component mapping profile

`OpenUiMappedRuntime` is a separate opt-in adapter. One registry, `tools/lang/mapped-registry.mjs`, owns the bounded component signatures and their native projection. It generates `schemas/openui-mapped-v1.json`, the model prompt, and `schemas/openui-mapped-support-v1.json`. The manifest pins the upstream reference and lists supported capabilities and limitations.

This profile contains 19 declarations: `Stack`, `Card`, `CardHeader`, `TextContent`, `Image`, `Button`, `Select`, `SelectItem`, `FormControl`, `Input`, `TextArea`, `CheckBoxItem`, `CheckBoxGroup`, `Buttons`, `Form`, `RadioItem`, `RadioGroup`, `SwitchItem`, and `SwitchGroup`. They reuse the existing 22-kind IR and native controls. A result card or form composes generic components; no travel, shopping or other domain-specific executor is included.

Some names overlap with the legacy profile but have different upstream positional signatures:

| Mapped profile | Signature/example |
| --- | --- |
| `Image` | `Image(alt, src?)`; this native profile requires a supplied HTTPS `src`. |
| `SelectItem` | `SelectItem(value, label)`. |
| `Select` | `Select(name, items, placeholder?, rules?, value?, size?)`; reactive `value` can bind a declared `$state`. |
| `Input` | `Input(name, placeholder?, type?, rules?, value?)`; `type` is omitted or `"text"`. |
| `TextArea` | `TextArea(name, placeholder?, rows?, rules?, value?)`; `rows` is omitted or `3`. |
| `CheckBoxItem` | `CheckBoxItem(label, description, name, defaultChecked?)`; data only, with an empty description allowed. |
| `CheckBoxGroup` | `CheckBoxGroup(name, items, rules?, value?)`; its value is a record of named booleans. |
| `RadioItem` | `RadioItem(label, description, value)`; descriptions may be empty and are preserved natively. |
| `RadioGroup` | `RadioGroup(name, items, defaultValue?, rules?, value?)`; a current value, even an empty string, wins over its default. |
| `SwitchItem` | `SwitchItem(label?, description?, name, defaultChecked?)`; omitted labels fall back to stable names. |
| `SwitchGroup` | `SwitchGroup(name, items, variant?, value?)`; no rules parameter, boolean record value, clear/card variants only. |
| `Buttons` | `Buttons(buttons, direction?)`; row by default, or an explicit column. |
| `Form` | `Form(name, buttons, fields = [])`; buttons is a `Buttons` declaration, fields are `FormControl` declarations. |
| `FormControl` | `FormControl(label, input, hint?)`; accepts mapped Input, TextArea, Select, CheckBoxGroup or RadioGroup. SwitchGroup remains independent. |

The official `createStore`, `evaluateRoot`, expression evaluator and `resolveStateField` own local state and field bindings. Inputs and selections update that store; conditional expressions produce the next complete native tree. State defaults may be scalar literals or a flat record of boolean choices. CheckBoxGroup edits merge one item into the aggregate record before setting its official field; the native IR still uses scalar checkbox leaves. Nested object/array state and derived initializers are unsupported. `@Set` and `@Reset` execute locally through the official action plan and do not request a model response. `@ToAssistant(message, context?)` and `@OpenUrl(url)` return intents to the host; the runtime does not open a URL or execute a business operation. The optional second `ToAssistant` argument is retained as `receipt.context.context`.

Bounded official computations are `@Each(array,"item",inlineTemplate)`, `@Filter(array,"field",operator,value)`, `@Sort(array,"field",direction?)` and `@Count(array)`. Data arrays use ordinary declarations, not state defaults. Each and nested computed child arrays allow display components and business buttons only; fields/forms are rejected because there is no keyed editable-list contract. Each expansion is single-level, arrays and flattening are bounded, and the complete result still obeys the native 200-node limit. These computations do not execute model requests or host tools. See [mapping.md](mapping.md) for exact operators and budgets.

Mapped fields support only `{required: boolean}` rules. Before a primary ToAssistant action inside a named Form, current required text/select fields must be nonempty and a required checkbox group must have at least one checked item. Failure projects field errors and sends no external action. Secondary/tertiary actions do not perform that required check. A Form cannot nest, and field names must be unique within its scope. This profile uses official ToAssistant actions rather than the legacy profile's custom Submit action.

An action inside a Form includes live logical values, read at the action step, as `receipt.context.formName` and `receipt.context.formState = { [formName]: { [fieldName]: rawValue } }`. A checkbox group contributes one boolean record, never generated native field names. This normalized native payload includes bound and unbound fields consistently; it intentionally does not copy the React hook's internal `{value, componentType}` wrappers or alternate store-snapshot shape. Model-supplied action context remains separate. Actions outside a Form retain their v0.3 shape. See [mapping.md](mapping.md) for complete examples and upstream references.

Native buttons carry a checked `mapped_action` context with `actionId` and `plan`: the latter is the canonical JSON of the complete current evaluated plan, form name and validation flag, bounded to 64 KiB. The controller checks the whole context before the runtime resolves that plan. This prevents an old raw native event from borrowing a new item's business context after Each filtering or sorting reuses a positional slot. Local state steps are consumed inside the adapter; only external intents reach the host's `onAction`, whose public shape is unchanged. Source replacement validates a candidate session before discarding the old program. Invalid derived state rolls back instead of leaving a new store paired with the old tree.

Mapped runtime `replace(source)` accepts a complete program and uses controller `components` replacement with `replace: true, syncFieldValues: true`. Subsequent local state evaluation uses `patch` with `syncFieldValues: true`. This makes evaluated field defaults authoritative instead of inheriting old native overrides, without emitting another `onFieldChange` loop. Controller reconciliation recalculates existing native validation errors against the authoritative values; an unresolved invalid field is not silently made valid by synchronization. After each mapped result, the ETS adapter atomically replaces its inline messages from that result's `validationErrors`, including an empty map when they have cleared. It is an explicit adapter-owned state mode, not a change to legacy defaults. Query/Mutation, Markdown, wrapping and arbitrary code execution remain unsupported in this bounded profile.

## Live field state

Model declarations and edited values are separate. Each surface carries `fieldValuesJson` and `fieldErrorsJson`, keyed by source component ID; `getFormValues(surfaceId, formName)` returns enabled fields keyed by their declared `field`. Edits notify subscribers without increasing document revision, so they can synchronize native properties without destroying keyboard focus or remounting the document.

- `setFieldValue(surfaceId, componentId, value, expectedRevision?)` rejects obsolete, read-only, disabled, unreachable, and wrong-type edits. A syntactically editable but invalid value can be retained with an inline error.
- `onFieldChange` reports the accepted edit, containing form, source ID, value, and document revision. It does not make a model request.
- `validateForm(surfaceId, name)` validates current enabled values and publishes errors. `getFormValues` reads values without treating them as validated permission.
- `replaceFieldErrors(surfaceId, errors, expectedRevision)` atomically replaces the inline message map for an adapter-owned evaluation. It requires the current revision and accepts at most 200 entries, each naming a reachable, enabled field with a nonblank message of at most 500 characters. Any invalid entry rejects the whole replacement. An empty map clears messages. It changes neither values nor document revision and publishes only when the message map changes.
- `validationMessage(code, component)` customizes errors. Stable codes include `required`, `type`, `email`, `number`, `date`, `time`, `option`, `range`, and `step`; default messages are English.

Structural replacement reconciles compatible field identities and drops removed fields. Changing the field kind/key/form or input variant prevents an unrelated control from inheriting the old value. A patch preserves compatible edits by default; `syncFieldValues: true` on a patch or complete components replacement explicitly requests evaluated defaults instead. The flag is rejected on partial component upserts and other operation kinds. Reset a legacy run by deleting/recreating its surface when values must be discarded deliberately. Document changes still increase revision; compatible patches can retain the native surface, while edits alone do not remount it.

## Actions and host decisions

`dispatchAction(action, expectedRevision, eventId)` is the format-neutral action entry point. `acceptAction(raw, expectedRevision, eventId)` accepts a native A2UI action envelope. Both require:

1. A currently existing surface and matching current renderer-session revision.
2. A source component reachable from the current root.
3. An action name and resolved context matching that component's definition.
4. An embedding-application event ID that has not been accepted for the same surface.

Deduplication survives state updates and snapshot restoration. A new event ID can invoke the same button again. Accepting an event does **not** make the surface read-only, select an option, execute a business operation, or grant permission. Applications use `setReadOnly` and `setSelected` explicitly and implement their own `onAction` handler. A failed application handler does not cause the SDK to replay the same event automatically.

Action receipts contain host `receivedAt`. The SDK does not interpret a native renderer timestamp as trusted authorization, elapsed time or expiry.

`Submit` is a special validated receipt, not an exception to the static-context checks. The model action definition and native callback contain exactly `context: {form: 'trip'}`. After checking the source, current revision, and all enabled fields, the controller adds `fields: {...currentValues}` to the host receipt. A model or native callback supplying its own `fields` object cannot override that state. Failed validation emits no accepted action, and the host can show errors and allow another attempt. Disabled fields are omitted. Business authorization and the next step remain host decisions.

## Rendering lifecycle

Creation and updates leave `renderStatus: pending`. The renderer calls `reportRenderStatus(surfaceId, mountedRevision, status, message?)` with `rendered` only after the actual native surface has usable content/layout. Errors are reported as `error`. A queued document is not already rendered. Reports from stale or deleted native instances are ignored.

Local UI behavior, such as expanding Details, remains in the renderer. It need not call an LLM or become a new business transaction.

## Host-owned persistence

`exportSnapshot()` returns a versioned JSON snapshot; `restoreSnapshot(text)` validates it atomically. The SDK does not choose a filesystem, an account, cloud synchronization or a retention policy. Applications store the returned bytes under their own namespace and controls.

Restoration preserves application read-only/selection decisions and event deduplication, but renews render revisions, forces `replace` mode, and returns rendering to `pending`. A restored snapshot is not proof that a native view is visible or that a business operation succeeded. Controller snapshots do not by themselves restore a mapped adapter's parsed program or official store; those have a separate owner.

v0.2 snapshots also preserve live field values and errors under the existing snapshot format. A v0.1 snapshot without field maps is imported with empty maps. Restoration validates maps against current component definitions; orphan keys, wrong value types, and incompatible defaults are not accepted as trusted state.

## Optional A2UI framing

`receiveA2ui(chunk)` accepts arbitrarily split NDJSON. `flushA2ui()` processes a final line without a trailing newline. Each line must have version `v0.9` or `v0.9.1` and exactly one supported lifecycle operation. The adapter shares the same controlled catalog and state model as every other adapter.

A malformed completed line raises an error after removing that line from the input buffer; already accepted previous messages remain committed. Later buffered lines can be resumed with another receive/flush call. Stream input is bounded. Transport authentication, replay cursors and remote synchronization belong to the embedding application.
