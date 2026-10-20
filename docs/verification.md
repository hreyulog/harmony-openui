# Verification snapshot — 2026-10-20

Implementation: [`9464f4a`](https://github.com/hreyulog/harmony-openui/commit/9464f4a0980694b57eb4ce96b20682837fbf23c2).

| Check | Result | What it establishes |
| --- | --- | --- |
| `node --test tests/*.test.cjs tests/*.test.mjs` | 43 passed | Actual upstream parser and stripped ETS core/wrapper, mocked native boundaries, actual demo lifecycle/model transport methods. |
| `python -m unittest discover -s tests -p 'test_*.py'` | 2 passed | Source-snapshot filtering and external build/signing path boundaries. |
| `assembleHar` | Passed | ArkTS/API compilation of the library, including the bundled upstream parser. |
| `assembleHap` (unsigned demo) | Passed | ArkTS/API compilation of the independent demo. This package is not installable as a signed device build. |
| Dependency and notice checks | Passed | All 32 installed AGenUI package files matched the pinned public archive; all four demo native libraries matched that package. Three root notice files and two upstream native notice files were verified in both artifacts. |

Artifacts from the final unsigned compilation:

| Artifact | Bytes | SHA-256 |
| --- | --- | --- |
| `harmony-openui-0.1.0.har` | 586574 | `0c10e375da3d6dc4a33120c13433a05854455ed7eda9c7ef73cecd2291c3d1f4` |
| `harmony-openui-demo-0.1.0-unsigned.hap` | 5793830 | `7f93e19931908c43e4367c03321e13d5b3991253abdfc8e9aa3d4bdef2f36848` |

No dependency or signing material is committed. Rebuild using [building.md](building.md); build receipts preserve the exact source file hashes, dependency identities and compiler logs. Byte-identical compilation across machines has not been established.

## Pending native acceptance

This snapshot does **not** establish a successful independent-demo device installation, native visual/touch acceptance, or a device model-generated choice-to-result flow. Those need a legitimate matching debug signing configuration, installation, visible layout evidence, a real tap, and a same-surface result. Host mocks and an unsigned HAP do not substitute for these checks.

The SDK has not been integrated into Sofia. Upstream native dependency source/binary correspondence and recipient relinking have not been independently verified; see [third-party-native.md](third-party-native.md).
