# Native rendering

Harmony OpenUI is an independent community adaptation. It is not a product of, or an officially endorsed HarmonyOS port from, the OpenUI team. It reuses the official OpenUI Lang parser and AGenUI's public native extension API under their respective licenses.

## Ownership and input

The embedding application owns `OpenUiController`, model transport, storage and all business effects. OpenUI Lang is translated into format-neutral surface data by the language adapter. The renderer reads that state; A2UI input is an optional compatibility route. No generated ArkTS, arbitrary executable UI source, phone control, agent loop or cloud service is included.

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

The initial capability set is deliberately bounded: basic `Column`, `Row`, `Card`, `Text`, `Button`, plus native `OpenUiOption`, `OpenUiFacts`, `OpenUiStatus` and `OpenUiDetails`. This is not a claim of complete A2UI component or input-language conformance.

The four composite types are registered with AGenUI as real `A2UIComponent` factories, using precompiled ArkUI builders. Options make the complete row tappable. Facts align labels with values. Status has neutral, positive and caution colors. Details expands locally without sending a business action.

Actions travel through the native surface API to the controller's `onAction` callback. The renderer performs no action named in that callback. In particular, selecting a row does not approve a purchase, payment, message or any other application effect. The host decides whether to call `setSelected` or `setReadOnly`; the library does not automatically lock the whole surface after an ordinary selection.

## Updates and isolation

Surface revisions rebuild that surface's native instance. Listeners capture their original revision and mount generation so delayed callbacks from an old instance cannot act on a replacement document. A separate native scope is keyed by engine instance and surface identity. Read-only state is enforced both in projected controls and by the controller.

Details expansion is retained by component ID across revisions within the mounted surface. Use stable component IDs for continuous content. This implementation applies updated snapshots; it does not yet provide a fine-grained native diff renderer. High-frequency token streams can therefore benefit from application-side update coalescing.

JSON Pointer text and action-context bindings are resolved against the current surface data without mutating source components. Missing component references remain pending until the referenced nodes arrive. An implicit layout root is added only by the rendering adapter when the format-neutral input has no `root` node.

## Size and theme units

Native composite builders use logical vp directly. AGenUI's HarmonyOS basic renderer uses two A2UI units for one vp, so renderer-provided default basic text dimensions are converted to twice the vp value. Explicit styles on basic A2UI nodes retain their authored A2UI units for compatibility. Semantic components use host theme tokens rather than model-provided CSS.

Content size reports ignore zero, invalid and unchanged dimensions. Expanded details report their changed height. Render-status notifications are excluded from the mount fingerprint to prevent layout/status/remount feedback loops.

`rendered` is reported only after the native container has a positive measured size. It is a layout observation, not proof that a user has read the content or that a subsequent business effect occurred. Native errors are reported through `onRenderStatus` without exposing raw source documents in the default error label.

## Verification boundary

`tests/render.test.cjs` runs executable contract tests with mocked SDK boundaries. It checks data projection, theme and surface isolation, read-only actions, state retention, measurement deduplication, status gating and stale-callback rejection. These are host tests: they do not establish that AGenUI draws correctly on HarmonyOS.

A successful HAR build additionally establishes ArkTS/API compatibility. Actual colors, touch targets, text wrapping, scrolling, accessibility and first visible native content require device screenshots/layout receipts and interaction checks. Those checks must be reported separately; no static mock or host test is a substitute for native rendering evidence.
