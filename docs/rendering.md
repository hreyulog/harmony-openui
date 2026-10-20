# Native rendering

Harmony OpenUI is an independent community adaptation. It is not a product of, or an officially endorsed HarmonyOS port from, the OpenUI team. It reuses the official OpenUI Lang parser and AGenUI's public native extension API under their respective licenses.

## Ownership and input

The embedding application owns the controller or `OpenUiMappedRuntime`, model transport, storage and all business effects. OpenUI Lang is translated into format-neutral surface data by the selected language adapter. The renderer reads that state; A2UI input is an optional compatibility route. No generated ArkTS, arbitrary executable UI source, phone control, agent loop or cloud service is included.

```ts
@Component
struct ResultPanel {
  private controller: OpenUiController = new OpenUiController();
  @State private theme: OpenUiTheme = OpenUiThemes.create('dark');
  build() {
    OpenUiView({ controller: this.controller, surfaceId: 'results', theme: this.theme })
  }
}
```

Populate `results` through the controller or an input adapter before expecting content.

Pass a stable controller for the view's lifetime. Replace the `theme` value to apply changed tokens. Each native mount takes a detached theme copy; changing one surface cannot change another surface's colors or metrics.

## Components and actions

The capability set is deliberately bounded: basic `Column`, `Row`, `Card`, `Text`, `Button`, `Image`, native card composites, and the retained v0.2 form/media/confirmation kinds described below. The legacy language profile retains its 23 model-facing components and 21 IR kinds; v0.3 adds basic `Image` as the 22nd native kind. The separate mapped profile has nine upstream-style declarations and reuses this same renderer. This is not a claim of complete ArkUI, A2UI, or input-language conformance.

The four composite types are registered with AGenUI as real `A2UIComponent` factories, using precompiled ArkUI builders. Options make the complete row tappable. Facts align labels with values. Status has neutral, positive and caution colors. Details expands locally without sending a business action.

Actions travel through the native surface API to the controller. The legacy adapter forwards accepted actions to its host callback. The mapped runtime consumes local `@Set`/`@Reset` plans and forwards only external intents such as `@ToAssistant` and `@OpenUrl`. The renderer performs no business operation named in a callback. Selecting a row does not approve a purchase, payment, message or any other application effect. The host decides whether to call `setSelected` or `setReadOnly`; the library does not automatically lock the whole surface after an ordinary selection.

## Mapped components and local state

`OpenUiMappedRuntime` reuses official OpenUI `lang-core` parsing, store, expression evaluation and field binding. The registry projects `Stack`, `Card`, `CardHeader`, `TextContent`, `Image`, `Button`, `Select`, `SelectItem` and `FormControl` into ordinary native primitives and the existing Select control. A filtered image-result list is a composition of these components, rather than a special business widget. The map also generates the model-facing schema, prompt and support manifest.

Mapped signatures are opt-in and remain separate from the existing 23-component profile. In particular, mapped `Image(alt, src)` becomes basic native IR `Image`; legacy `Image(source, alt, aspectRatio?)` remains `OpenUiImage`. The mapped `Select` takes `SelectItem(value, label)` children and can bind its value to declared `$state`; it does not use the legacy `Select(field, label, options, ...)` signature.

The new basic Image is projected directly to AGenUI's native Image with `url`, cover fit, accessibility label and Yoga aspect-ratio styling. It does not create the custom `OpenUiImage` ArkUI builder. The latter is retained for existing programs and keeps its original loading and fallback presentation. Image geometry and exact native theme styling remain host/mapping choices.

Select changes and `@Set`/`@Reset` update the official store and reevaluate conditional children locally, without another model request. `@ToAssistant` retains its message and optional business context in a host intent; `@OpenUrl` also remains a host intent. Query/Mutation and arbitrary host execution are not provided. See [protocol.md](protocol.md) for the profile boundary and native event checks.

## Native forms, images, lists and confirmation

The retained legacy form/media/confirmation IR kinds use precompiled native ArkUI components, not screenshot substitutes, generated JavaScript, HTML, or a WebView. The model names in this table refer to the legacy profile:

| Model component | Native rendering |
| --- | --- |
| `Form` | A named group of children with controller-owned field state. |
| `TextInput`, `TextArea`, `Search` | ArkUI `TextInput`, `TextArea`, and `Search`, with a visible label and inline validation error. |
| `Checkbox`, `Toggle` | Native boolean controls. |
| `Select`, `RadioGroup` | ArkUI `Select` and a group of native `Radio` controls, preserving the model's distinct value keys. |
| `Slider` | Native `Slider` with validated min, max and step. |
| `DatePicker` | Compact native `CalendarPicker`; the model name does not imply the wheel-style ArkUI DatePicker. |
| `TimePicker` | Native 24-hour `TimePicker`. |
| `Image` | The `OpenUiImage` builder, containing native `Image`, loading an HTTPS source with alternative text and a bounded aspect ratio. |
| `List` | Native `List` / `ListItem` inside a bounded viewport. |
| `Dialog` | A launcher opening a native `bindSheet` confirmation panel after a user tap. |

Dates are restricted to the native CalendarPicker's `0001-01-01`–`5000-12-31` range. A supplied initial date and range must validate before mounting. The native display and submitted controller value must describe the same chosen date; a visual picker default is not permission to invent a submitted value. Time values use `HH:mm`.

Image URLs must be supplied by the embedding host; the model prompt does not authorize inventing resource URLs. Rendering may make a native network fetch for that image. Network permissions, remote availability, and any application-specific resource allowlist remain host responsibilities. Image availability is separate from model-generation or layout acceptance. Lists have finite item counts and viewports, without remote pagination or infinite-loading behavior.

The confirmation panel is local UI state. It does not open automatically when model output arrives. Cancel, close, or dismiss returns no action. Confirm forwards the declared action through the original source/revision checks, so an outdated or read-only form cannot submit via an old panel. For `@Submit`, the controller validates and attaches live values before notifying the host.

## Updates and isolation

Ordinary component replacement, data-model updates, theme/host-width changes, and host read-only/selection changes rebuild that surface's native instance. An explicit compatible `patch` normally retains its SurfaceManager, native container and unchanged native nodes, subject to the cumulative identity budget below. It still advances the controller document revision. The live session advances to that validated revision; callback routing additionally requires its active mount and currently reachable native ID. Read-only state is enforced both in projected controls and by the controller.

A patch supplies a complete validated IR, not raw native deltas. The renderer compares projected node definitions and sends only changed nodes and parent-child lists to AGenUI. Compatible retained logical IDs keep their native IDs. Losing or regaining root reachability retires an ID even if an orphan definition remains in the IR; a returning result gets a fresh native interaction identity. Retired nodes lose action/edit/modal ownership and queued measurement work, so a delayed callback cannot regain permission after filtering it back in.

The controller requests replacement when a retained ID changes its native kind or field identity, or an existing confirmation definition changes. This closes any old confirmation sheet before the new action can be confirmed. Width/theme changes and absence of a compatible active manager also use replacement. The incremental path does not bypass source, context, event-ID or revision checks.

AGenUI removes and destroys filtered-out native view subtrees, but source-model metadata may remain until the manager is destroyed. To bound long-lived filter churn without changing the pinned native SDK, `OpenUiNativeIds` counts every identity allocation, including retired IDs. At 1,024 cumulative allocations, the next update replaces the manager and starts a fresh namespace; ordinary incremental rendering then resumes. One atomic patch can cross the threshold, with its size still bounded by the 200-node IR limit. This collection retains controller field values and mapped-runtime state, while deliberately ending native focus and scroll lifetimes. Incremental updates therefore do not promise that one manager lives forever.

Field edits and validation errors are excluded from the structural mount fingerprint. They update the existing native elements through the active session; typing does not rebuild the surface, reset keyboard focus, or require a model round trip. The mapped adapter uses `syncFieldValues: true` for its patches so evaluated official-store values replace old native overrides, including after Reset. That synchronization does not emit a second native-field change. Legacy edited values remain separate controller state, not mutations of source component declarations.

Native edits record the already displayed value before notifying the controller. The resulting state notification does not synchronously echo the same value into an active native callback. Auxiliary text/error refreshes are deferred and coalesced, and disposed owners cancel queued work. Atomic control-state properties distinguish a genuine host correction from a native echo, even when the host restores the initial value. Date/time controls retain stable selected `Date` objects during native wheel changes; only genuine external changes replace those objects. The Nova tests exercise the TimePicker sequence that crashed an earlier candidate, without claiming a C++ stack diagnosis.

The renderer waits for its own outer Column to measure, subtracts its theme insets, and uses that inner content width when creating the native surface. The synthetic native root is sized explicitly in A2UI units from this host measurement; the display viewport is not used as a card-width default. A host width change remounts only that view. Deferred measurements from an old mount or wider than the current host are rejected, preventing an early full-screen measurement from fixing Yoga at a stale width after the actual container shrinks. Each semantic component measures at the smaller of its native constraint and the host upper bound, so nested Row columns can remain narrower. Content height is measured again at that width rather than carried over from a wider layout.

The public AGenUI 1.6 hybrid registry is globally keyed by node ID, and its factory can receive instance `0` before the actual manager ID is assigned. Each renderer mount therefore translates every source node ID into a fresh native namespace allocated by a static monotonic sequence. The factory resolves the owning session through that unique native node ID, supplies its actual manager ID to the SDK base class and uses its injected UIContext. It does not depend on a previous container initializing global AppStorage. Equal logical IDs in different surfaces, mounts or reused manager IDs remain distinct in the native registry. Teardown removes only entries owned by that mount.

Native action source IDs are translated back through the current mount's exact map before the controller validates the original component, action name, context and revision. The action context itself is not rewritten. An unknown, other-mount or expired native ID is rejected. Selection and Details expansion use original source IDs, preserving host state across native remounts.

Details expansion is retained by component ID across revisions within the mounted surface. Use stable component IDs for continuous content. The incremental path is opt-in for complete local-state evaluations; it does not make arbitrary partial token streams into fine-grained native updates. Legacy streaming programs still use their existing replacement path and can benefit from application-side update coalescing.

JSON Pointer text and action-context bindings are resolved against the current surface data without mutating source components. Missing component references remain pending until the referenced nodes arrive. The native adapter always adds a noninteractive basic `root` Column around the namespaced source root, or around unparented source nodes when no logical `root` exists. A semantic source component named `root` is also namespaced; it is not shared across surfaces.

## Size and theme units

Native composite builders use logical vp directly. AGenUI's HarmonyOS basic renderer uses two A2UI units for one vp, so renderer-provided default basic text dimensions are converted to twice the vp value. Explicit styles on basic A2UI nodes retain their authored A2UI units for compatibility. Semantic components use host theme tokens rather than model-provided CSS.

The module requires API 20, matching its use of `LayoutPolicy.fixAtIdealSize`. Internal renderer diagnostics are disabled by default; private diagnostic staging can enable numeric size, field-length and lifecycle logs without including text content or model credentials.

Public AGenUI 1.6 initially gives unmeasured custom leaves zero height. Merely supplying a larger `maxHeight` to `Measurable.measure` does not relax an inherited zero-height parent constraint. The direct content Column therefore uses ArkUI's API 20 `LayoutPolicy.fixAtIdealSize`, the documented policy allowing content in custom layout to exceed that parent constraint. A precompiled ArkUI component measures the actual child at the available width, passing a finite vertical measurement range of 1,000,000 vp, then places it at the origin. That range is not a fixed returned height. Measured sizes are coalesced and reported to native after the measurement callback; Facts content, text wrapping and Details expansion can change height naturally.

The SDK builder passes primitive strings/flags and pure Facts/theme data into one reactive ArkUI component. That component owns both semantic content and intrinsic measurement; it does not render the content through a nested `BuilderParam` closure or rebuild an outer SDK `BuilderNode` from inside a child `ForEach`. Property updates and local expansion are projected into the component's `@Prop` values, with a revision token available for diagnostics.

Content size reports ignore zero, invalid and unchanged dimensions, as well as callbacks after the owning mount or native node is retired. Queued reports are cancelled during native teardown or node retirement. A changed semantic node invalidates its measurement so unchanged geometry can still acknowledge the new content; unrelated measured leaves remain acknowledged. Render-status notifications are excluded from the mount fingerprint to prevent layout/status/remount feedback loops.

`rendered` is reported only after the native container has a positive measured size and every reachable semantic component has supplied a positive content measurement. A visible basic heading alone cannot acknowledge missing custom content. This is a layout observation, not proof that a user has read the content or that a subsequent business effect occurred. Native errors are reported through `onRenderStatus` without exposing raw source documents in the default error label.

## Verification boundary

`tests/render.test.cjs` runs executable contract tests with mocked SDK boundaries. It includes the public SDK's factory-instance-0 behavior and a global hybrid node-ID map to check context/measurement routing, equal-ID surface updates and teardown, semantic roots, action reverse projection and stale-callback rejection. It also checks direct Image projection, retained-manager patches, field identity, reachability retirement, data projection, themes, read-only actions, state retention, measurement deduplication and status gating. `tests/mapped-runtime.test.mjs` separately exercises the official store/evaluator and the real ETS wrapper. These are host tests: they do not establish that AGenUI draws correctly on HarmonyOS.

A successful HAR build additionally establishes ArkTS/API compatibility. Actual colors, touch targets, text wrapping, scrolling, accessibility and first visible native content require device screenshots/layout receipts and interaction checks. Those checks must be reported separately; no static mock or host test is a substitute for native rendering evidence.

Retained v0.1/v0.2 screenshots establish only their recorded flows. Mapped model output, filtering, direct image loading, current-selection actions and node reappearance need separate device receipts. See [verification.md](verification.md) for the currently accepted scope.
