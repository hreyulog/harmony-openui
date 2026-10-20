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

`schemas/native-ir.schema.json` documents the native representation. v0.1 exposes the following bounded capability set:

- Basic `Column`, `Row`, `Card`, `Text`, `Button`.
- Native `OpenUiOption`, `OpenUiFacts`, `OpenUiStatus`, `OpenUiDetails`.

Text properties accept a literal string or `{ "path": "/some/data" }`. Fact groups carry label/value records. Semantic component layout belongs to the native renderer and its injected theme. The input cannot inject host-only selection/read-only state or arbitrary component factories.

This list is not a claim of complete OpenUI or A2UI compatibility. Expressions, queries, mutations and arbitrary executable component code are outside this v0.1 core. The upstream language adapter must reject unsupported constructs explicitly rather than invent their results. The A2UI adapter supports the specified component subset, root/path data upserts and lifecycle operations; omitted-value data deletion is not supported. An application can replace the complete data model to remove a field.

The AGenUI backend must register these native component names before sending definitions. The public renderer's catalog ID does not itself load a remote library or authorize a component.

## Actions and host decisions

`dispatchAction(action, expectedRevision, eventId)` is the format-neutral action entry point. `acceptAction(raw, expectedRevision, eventId)` accepts a native A2UI action envelope. Both require:

1. A currently existing surface and matching mounted revision.
2. A source component reachable from the current root.
3. An action name and resolved context matching that component's definition.
4. An embedding-application event ID that has not been accepted for the same surface.

Deduplication survives state updates and snapshot restoration. A new event ID can invoke the same button again. Accepting an event does **not** make the surface read-only, select an option, execute a business operation, or grant permission. Applications use `setReadOnly` and `setSelected` explicitly and implement their own `onAction` handler. A failed application handler does not cause the SDK to replay the same event automatically.

Action receipts contain host `receivedAt`. The SDK does not interpret a native renderer timestamp as trusted authorization, elapsed time or expiry.

## Rendering lifecycle

Creation and updates leave `renderStatus: pending`. The renderer calls `reportRenderStatus(surfaceId, mountedRevision, status, message?)` with `rendered` only after the actual native surface has usable content/layout. Errors are reported as `error`. A queued document is not already rendered. Reports from stale or deleted native instances are ignored.

Local UI behavior, such as expanding Details, remains in the renderer. It need not call an LLM or become a new business transaction.

## Host-owned persistence

`exportSnapshot()` returns a versioned JSON snapshot; `restoreSnapshot(text)` validates it atomically. The SDK does not choose a filesystem, an account, cloud synchronization or a retention policy. Applications store the returned bytes under their own namespace and controls.

Restoration preserves application read-only/selection decisions and event deduplication, but renews render revisions and returns rendering to `pending`. A restored snapshot is not proof that a native view is visible or that a business operation succeeded.

## Optional A2UI framing

`receiveA2ui(chunk)` accepts arbitrarily split NDJSON. `flushA2ui()` processes a final line without a trailing newline. Each line must have version `v0.9` or `v0.9.1` and exactly one supported lifecycle operation. The adapter shares the same controlled catalog and state model as every other adapter.

A malformed completed line raises an error after removing that line from the input buffer; already accepted previous messages remain committed. Later buffered lines can be resumed with another receive/flush call. Stream input is bounded. Transport authentication, replay cursors and remote synchronization belong to the embedding application.
