# Changelog

## 0.2.0 — 2026-10-20

Extend the bounded native catalog from choice/result cards to forms and richer results. Device acceptance of the new flow is recorded separately from the retained v0.1 evidence.

- Add 14 model-facing components: Form, TextInput, TextArea, Search, Checkbox, Toggle, Select, RadioGroup, Slider, DatePicker, TimePicker, Image, List, and Dialog. There are 23 model components / 21 native IR kinds, not full ArkUI support.
- Extend the official parser catalog, schema, generated prompt, and adapter while retaining existing syntax and the compatibility schema filename/catalog identifier.
- Add controller-owned live field values, required/type/range validation, localized validation-message hooks, and snapshots compatible with earlier empty field maps.
- Add `@Submit(form)` with exact static context. Validate the current containing form and attach live enabled fields to the host receipt; reject callback-supplied answer objects.
- Synchronize field edits and errors without changing document revision or remounting the native surface. Preserve stale-callback and read-only enforcement.
- Avoid native value echoes inside active picker callbacks, keep selected Date objects stable, and apply atomic controlled-state updates for host corrections. Defer auxiliary redraws and cancel pending work on teardown.
- Render actual native input/select/radio/slider/time controls, compact CalendarPicker dates, HTTPS images, bounded lists, and user-tapped confirmation sheets.
- Add an independent trip → preferences → result demo. A real model can generate the first form and final result; the intermediate preferences page is host-supplied, and all travel data remains fictional.
- Add official-parser family/chunk tests, invalid-program retention, actual ETS form-state/Submit integration, and native rendering contracts. Consult the verification record for build/device results rather than inferring them from host tests.
- Update Chinese/English documentation with form signatures, state ownership, native mappings, architecture, and remaining limits. Sofia integration remains separate.

## 0.1.0 — 2026-10-20

Initial independent HarmonyOS adapter for OpenUI Lang.

- Bundle the upstream OpenUI Lang 1.0.1 parser with a native component catalog and generated model prompt.
- Translate incremental text into validated native state; preserve the last valid tree while required fields are incomplete.
- Render native layouts, options, facts, status, and expandable details with injectable themes.
- Isolate surfaces/revisions, validate action context, deduplicate events, and leave business decisions to the host.
- Add state snapshots and an optional bounded A2UI NDJSON adapter.
- Provide an independent demo for generated choices and a same-surface result after selection.
- Provide external-stage, pinned-dependency HAR/HAP builds, license packaging, and host contract tests.
- Bind native hybrid factories to the correct instance/UIContext through per-mount node namespaces, preserving logical action IDs across equal-ID surfaces.
- Render semantic content through reactive ArkUI properties and API 20 intrinsic layout; wait for host width and discard obsolete size reports to prevent blank or overflowing cards.
- Add a standalone equal-ID/resize demo and physical Nova verification of real model generation, selection, read-only continuation, themes and Details.

The first version does not implement the complete OpenUI language/catalog, reactive state, queries, mutations, forms, charts, or a fine-grained native renderer. It has not been integrated into Sofia.
