# Changelog

## 0.6.0 — 2026-10-21

- Give headings, body text and captions distinct native typography; preserve mapped button priorities through explicit native backgrounds, borders and centered labels.
- Define shared card surfaces, geometry and form styling; remove the View-level padded white shell and give ordinary Row children equal shrinking tracks unless a width is authored.
- Keep the existing theme interface and add collapsed demo tools with host-controlled light/dark appearance.
- Generate grouped native forms and readable submitted-fact layouts through the actual model. The demo host rejects overcrowded result rows and retains the actual six-column failure as a regression fixture; no new business widget or model-source rewriting is introduced.
- Verify the final build on Nova, with original screenshots, exact model candidates and separate source replay. Sofia remains separate.

## 0.5.0 — 2026-10-21

- Add upstream-signature RadioItem, RadioGroup, SwitchItem and SwitchGroup mappings: 19 model-facing declarations, reusing the same 22 native IR kinds.
- Reuse the official Each, Filter, Sort and Count functions for bounded display/action lists. Support computed child arrays while rejecting editable loop subtrees and retaining source, depth and node budgets.
- Retain radio option descriptions in IR, public schema, native layout and basic accessibility labels. Input, select, checkbox and toggle controls expose their visible labels to accessibility.
- Reuse the existing activity demo for local filtering, counting and sorting, followed by radio and independent switch preferences and a model-generated read-only result.
- Normalize submitted enum/boolean outcomes into host-owned display facts before asking the model for result layout; retain a real wrong-mode model output as a regression fixture.
- Document the remaining gaps against the pinned/current upstream and ArkUI, including date/range and slider value contracts, Modal, virtual lists, system themes and mapped-session restoration. Sofia remains separate.

## 0.4.0 — 2026-10-20

Extend the opt-in native mapping profile to reusable text input, checkbox groups and forms, while retaining the established language profile and native controls.

- Map upstream `Input`, `TextArea`, `CheckBoxItem`, `CheckBoxGroup`, `Buttons` and `Form`; the mapped catalog now has 15 entries.
- Keep group state as a named boolean record in the official store and project it to existing scalar native checkboxes. Required groups need at least one selected item.
- Validate required fields before primary conversation actions and attach a normalized, current `formName` / `formState` payload. Preserve external action context.
- Preserve remaining validation messages while editing, expose revision-fenced adapter error replacement, and reset native overrides on a new mapped program.
- Defer structural renderer work until native input callbacks return, coalesce updates, and cancel retired-owner work.
- Fence reentrant action batches and retired field edits to their exact program and commit revision. `controller.apply()` returns its own commit revision even if a synchronous observer changes the document again.
- Add an independent activity-plan editor and model-generated result flow after the filtered list. Reuse the existing demo facts and keep Sofia separate.
- Validate the demo list against its finite supplied facts, including all twelve filter combinations and empty states, and allow one bounded model correction. This validation and transport remain demo-host responsibilities.
- Input is text-only, TextArea uses the existing three-row native geometry, and validation remains required-only. This does not claim the full upstream form catalog.

## 0.3.0 — 2026-10-20

- Add the opt-in official-semantics mapping runtime, reusing `lang-core` parsing, store, evaluation and field bindings.
- Generate schema, prompt and support manifest from a centralized mapping registry; initially expose nine mappings.
- Add local state, conditional result filtering, Set / Reset and context-preserving ToAssistant callbacks.
- Patch compatible native structures in place; retire removed node identities and periodically recycle managers after bounded identity churn.
- Verify an actual model-generated image list and combined filters on Nova; retain actual source, screenshots and separate all-combination host replay.

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
