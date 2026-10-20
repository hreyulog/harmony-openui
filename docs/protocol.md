# Native state and input adapters

The public direction is **OpenUI Lang → the upstream OpenUI parser → native intermediate representation → ArkUI**. The controller does not implement a competing OpenUI language parser. A2UI NDJSON is a separate compatibility adapter, not the SDK's only input language.

All files in `core/` are new SDK code. The controller does not depend on a phone agent, a model provider, a chat product, an approval service, or an application database.

## State contract

`OpenUiController.apply(change)` accepts four intermediate operations:

| kind | fields | behavior |
| --- | --- | --- |
| `create` | `surfaceId`, optional `catalogId` | Creates an empty surface. The supported catalog is `urn:harmony-openui:catalog:0.1`. |
| `components` | `surfaceId`, `components`, optional `replace` | Upserts definitions by component ID. `replace: true` atomically replaces the complete component set; language adapters should use it for complete parsed programs. |
| `data` | `surfaceId`, `valueJson`, optional `path` | Replaces the root data model or upserts a JSON Pointer path. `valueJson` is serialized JSON, including quotes for a string. |
| `delete` | `surfaceId` | Removes a surface. Old action and render callbacks no longer match a live revision. |

Updates are validated before replacing state. Forward references are permitted during streaming; known cycles, duplicated IDs and multiple parents are rejected. A missing child can arrive in a later update. Only the `root`-reachable tree is interactive. Unknown component types do not silently become native support.

`getSurface(id)` and `surfaces()` return detached snapshots. `subscribe`/`unsubscribe` notify the embedding application. Revisions increase across structural/data updates, host selection changes, deletion/recreation and snapshot restoration. A renderer must capture the revision it actually mounted rather than look up a new revision inside an old callback.

## Native catalog

`schemas/native-ir.schema.json` documents the native representation. v0.2 exposes 21 native kinds for 23 model-facing components:

- Basic `Column`, `Row`, `Card`, `Text`, `Button`.
- Native `OpenUiOption`, `OpenUiFacts`, `OpenUiStatus`, `OpenUiDetails`.
- `OpenUiForm`, `OpenUiInput` (text / textarea / search variants), `OpenUiCheckbox`, `OpenUiToggle`, `OpenUiSelect`, `OpenUiRadioGroup`, `OpenUiSlider`, `OpenUiDatePicker`, `OpenUiTimePicker`.
- `OpenUiImage`, `OpenUiList`, `OpenUiDialog`.

The catalog identifier and generated language-schema filename retain `0.1` for compatibility with existing surfaces and build consumers; the SDK package is v0.2.0. This does not make a v0.1 renderer capable of drawing newly added components.

Text properties accept a literal string or `{ "path": "/some/data" }`. Fact groups carry label/value records. Semantic component layout belongs to the native renderer and its injected theme. The input cannot inject host-only selection/read-only state or arbitrary component factories.

This list is not a claim of complete OpenUI or A2UI compatibility. Expressions, queries, mutations and arbitrary executable component code are outside this core. The upstream language adapter must reject unsupported constructs explicitly rather than invent their results. The A2UI adapter supports the specified component subset, root/path data upserts and lifecycle operations; omitted-value data deletion is not supported. An application can replace the complete data model to remove a field.

The AGenUI backend must register these native component names before sending definitions. The public renderer's catalog ID does not itself load a remote library or authorize a component.

## Model-facing forms and media

The model catalog uses the following positional signatures. `?` marks an optional argument; supplied optional arguments must keep this order. The official parser reads these declarations and the native catalog performs authoritative property and graph validation.

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

Input variants map to `OpenUiInput` with `variant: 'text' | 'textarea' | 'search'`; other new types map to the corresponding `OpenUi`-prefixed name. `Form` retains its children as native IDs. The language adapter omits undefined optional properties rather than inventing values.

Forms appear in `Stack` or `Card`, cannot nest, and must have unique names. Field keys are unique within their containing form. Form and field identifiers are limited to 64 characters; prototype-related reserved names are rejected. Controls must descend from a form to take part in its submission. `@Submit("trip")` must originate inside that same named form. A direct IR document may use stable field IDs independently from these field keys.

Values are strings for text/select/date/time, booleans for checkbox/toggle, and finite numbers for sliders. Unspecified values default to `''`, `false`, or a slider's `min` (default `0`). Select/radio options contain `{label, value}`, have distinct values, and contain 1–100 entries. A default nonempty selection must be one of those values. TextInput's `inputType` is `text`, `number`, `email`, or `tel`. Number/email inputs receive validation; `tel` is an input type, not phone-number verification.

Validation checks shape and allowed values, not whether model-provided initial data is factually correct. The host must supply trustworthy defaults and decide which information requires user review.

Dates are real calendar dates in `YYYY-MM-DD`, within `0001-01-01`–`5000-12-31`, matching the native CalendarPicker range. Inclusive `minDate`/`maxDate` must form a valid range. Times use 24-hour `HH:mm`. Sliders require finite `min < max` and `0.01 <= step <= max - min`; values must lie on that step. Empty required fields can be declared so a user can fill them, but cannot be submitted. A required checkbox or toggle must be true.

Images use host-supplied HTTPS URLs (maximum 2048 characters), alternative text (maximum 500), and an optional aspect ratio from `0.25` to `4`. Lists contain 1–100 `{title, description?, meta?}` items, with a viewport height from 120 to 480 vp. These bounds do not guarantee a remote image is reachable. Image loading is a native platform operation; there is no model-side image search, arbitrary HTML, or executable media source.

`Dialog` is a user-tapped confirmation launcher rendered as a native confirmation sheet. Only the explicit confirm button forwards its declared action; cancel, close, or dismiss does not. Its action is subject to the same controller checks as a normal button. A confirmation sheet can carry `@Submit` inside the matching form; it does not itself authorize payment or perform business effects.

## Live field state

Model declarations and edited values are separate. Each surface carries `fieldValuesJson` and `fieldErrorsJson`, keyed by source component ID; `getFormValues(surfaceId, formName)` returns enabled fields keyed by their declared `field`. Edits notify subscribers without increasing document revision, so they can synchronize native properties without destroying keyboard focus or remounting the document.

- `setFieldValue(surfaceId, componentId, value, expectedRevision?)` rejects obsolete, read-only, disabled, unreachable, and wrong-type edits. A syntactically editable but invalid value can be retained with an inline error.
- `onFieldChange` reports the accepted edit, containing form, source ID, value, and document revision. It does not make a model request.
- `validateForm(surfaceId, name)` validates current enabled values and publishes errors. `getFormValues` reads values without treating them as validated permission.
- `validationMessage(code, component)` customizes errors. Stable codes include `required`, `type`, `email`, `number`, `date`, `time`, `option`, `range`, and `step`; default messages are English.

Structural replacement reconciles compatible field identities and drops removed fields. Changing the field kind/key/form or input variant prevents an unrelated control from inheriting the old value. Reset a run by deleting/recreating its surface when values must be discarded deliberately. Structural changes still increase revision and remount; edits alone do not.

## Actions and host decisions

`dispatchAction(action, expectedRevision, eventId)` is the format-neutral action entry point. `acceptAction(raw, expectedRevision, eventId)` accepts a native A2UI action envelope. Both require:

1. A currently existing surface and matching mounted revision.
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

Restoration preserves application read-only/selection decisions and event deduplication, but renews render revisions and returns rendering to `pending`. A restored snapshot is not proof that a native view is visible or that a business operation succeeded.

v0.2 snapshots also preserve live field values and errors under the existing snapshot format. A v0.1 snapshot without field maps is imported with empty maps. Restoration validates maps against current component definitions; orphan keys, wrong value types, and incompatible defaults are not accepted as trusted state.

## Optional A2UI framing

`receiveA2ui(chunk)` accepts arbitrarily split NDJSON. `flushA2ui()` processes a final line without a trailing newline. Each line must have version `v0.9` or `v0.9.1` and exactly one supported lifecycle operation. The adapter shares the same controlled catalog and state model as every other adapter.

A malformed completed line raises an error after removing that line from the input buffer; already accepted previous messages remain committed. Later buffered lines can be resumed with another receive/flush call. Stream input is bounded. Transport authentication, replay cursors and remote synchronization belong to the embedding application.
