# Changelog

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
