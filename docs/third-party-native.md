# Native third-party distribution

Harmony OpenUI's original adapter, controller, renderer integration and demo are Apache-2.0. This does not relicense the parser or native dependencies. This community project is independent of the OpenUI, AGenUI and Huawei teams.

## Pinned upstream reference

The OHPM dependency is `@agenui/agenui` **1.6.0**, resolved from the public registry. The inspected published HAR has SHA-256 `e2269e998a69871be5251a610d890aea141bb14c00f78a8649a3335c3943c75a`:

[Public HAR](https://ohpm.openharmony.cn/ohpm/@agenui/agenui/-/agenui-1.6.0.har)

The source reference is the upstream [AGenUI-1.6.0 tag](https://github.com/AGenUI/AGenUI/tree/AGenUI-1.6.0), commit [`0a448291965198b3943707249b6630f49a7cc849`](https://github.com/AGenUI/AGenUI/tree/0a448291965198b3943707249b6630f49a7cc849). This pins the inspected source; it is not a claim that this project has reproduced the registry binary from that commit. The downstream distributor must establish the correspondence between the exact shipped binary and its corresponding source, including upstream build changes and dependencies.

The following files are copied verbatim from that Git commit, without line-ending conversion:

| Local file | Upstream source | SHA-256 |
| --- | --- | --- |
| [NOTICE](../third_party/agenui/NOTICE) | [Root NOTICE](https://raw.githubusercontent.com/AGenUI/AGenUI/0a448291965198b3943707249b6630f49a7cc849/NOTICE) | `134d0c82eea9361d2c292abcddadac1aebfd9b93c427a13fbf3636c4773bbf74` |
| [COPYING.LGPL-2.1](../third_party/agenui/COPYING.LGPL-2.1) | [ik/COPYING.txt](https://raw.githubusercontent.com/AGenUI/AGenUI/0a448291965198b3943707249b6630f49a7cc849/platforms/harmony/agenui/src/main/cpp/a2ui/third_party/ik/COPYING.txt) | `5bbcbb737e60fe9deba08ecbd00920cfcc3403ba2e534c64fdeea49d6bb87509` |

The same commit's `sax/COPYING.txt` is byte-identical to `ik/COPYING.txt`. The upstream NOTICE retains its original older `engine/src/...` references. The current source locations are listed below. It also covers other platforms; preserving that complete notice does not mean every listed dependency is shipped in this HarmonyOS artifact.

## What the native dependency contains

The inspected public package contains `liba2ui-capi.so`, `libiksemel.so`, `libyoga.so` and `libc++_shared.so` for `arm64-v8a`.

| Component | Source / integration in the pinned source | License fact |
| --- | --- | --- |
| AGenUI engine | [Harmony native CMakeLists](https://github.com/AGenUI/AGenUI/blob/0a448291965198b3943707249b6630f49a7cc849/platforms/harmony/agenui/src/main/cpp/CMakeLists.txt) plus `core/` | AGenUI's own code is Apache-2.0; third-party source retains its licenses. |
| iksemel | [`a2ui/third_party/ik/`](https://github.com/AGenUI/AGenUI/tree/0a448291965198b3943707249b6630f49a7cc849/platforms/harmony/agenui/src/main/cpp/a2ui/third_party/ik), including `include/`, `src/` and `config.h`; upstream identifies meduketto/iksemel commit `03c0e84` | LGPL-2.1; copyright 2000-2007 Gurer Ozen. CMake builds a separate shared `libiksemel.so`. |
| Modified sax parser | [`a2ui/third_party/sax/`](https://github.com/AGenUI/AGenUI/tree/0a448291965198b3943707249b6630f49a7cc849/platforms/harmony/agenui/src/main/cpp/a2ui/third_party/sax), including `sax.c`, `sax.h` and the modification notices | LGPL-2.1, derived from iksemel; Gurer Ozen and AGenUI Contributors. CMake compiles `sax.c` directly into `liba2ui-capi.so`. Replacing only `libiksemel.so` does not replace this code. |
| Yoga | [facebook/yoga v2.0.0](https://github.com/facebook/yoga/tree/v2.0.0); CMake prefers the bundled prebuilt when present, otherwise system/local source or FetchContent | MIT; copyright Meta Platforms, Inc. and affiliates. Retain the exact source distribution's license text with binary redistribution. |
| nlohmann/json | Included by the upstream engine; identified in its complete NOTICE | MIT; copyright 2013-2022 Niels Lohmann. Retain the corresponding license text and source header notices. |
| C++ shared runtime | `libc++_shared.so` is observed in the public HAR | Its exact toolchain provenance and applicable runtime notices must be verified against the shipped binary. Do not infer its license solely from AGenUI's package metadata. |

The package-level `license: Apache-2.0` field describes the AGenUI package and is not a complete inventory of bundled native licenses. The observed registry package supplies a LICENSE but not the complete upstream NOTICE; this repository therefore carries that notice separately.

## Source and rebuild route

Use a clean checkout, preserving the pinned source and all third-party files:

```sh
git clone https://github.com/AGenUI/AGenUI.git
cd AGenUI
git checkout --detach 0a448291965198b3943707249b6630f49a7cc849
git submodule update --init --recursive
./scripts/harmony/build.sh --mode release --no-package
```

This is the upstream build entry point, not a rebuild or relink procedure validated by Harmony OpenUI. Follow the pinned [build script](https://github.com/AGenUI/AGenUI/blob/0a448291965198b3943707249b6630f49a7cc849/scripts/harmony/build.sh) and [Harmony build documentation](https://github.com/AGenUI/AGenUI/blob/0a448291965198b3943707249b6630f49a7cc849/scripts/harmony/README.md) for the matching DevEco/Command Line Tools and project initialization. Upstream documents end-to-end verification on macOS; this project has not independently verified that route or a Windows equivalent.

For a modified iksemel, build its vendored source for the target ABI, or use the upstream `AGENUI_USE_SYSTEM_IKSEMEL=ON` CMake option and supply a compatible library through the toolchain's library search path. Record the exact compiler, SDK, headers, flags and exported ABI. For a modified sax, rebuild the containing `a2ui-capi` target from the corresponding full source; a separate iksemel replacement alone is insufficient. Yoga has the upstream `AGENUI_USE_SYSTEM_YOGA` and `AGENUI_YOGA_SOURCE_DIR` options; inspect the prebuilt-selection logic before relying on them.

To exercise a rebuilt dependency in a host application, package the rebuilt HAR with all required compatible native libraries and types, reference that local HAR instead of the registry package, resolve OHPM dependencies again, then rebuild and sign the host with the recipient's own credentials. This is a proposed test route, not a claim that an installed signed application permits arbitrary in-place library replacement.

## Before distributing a native binary

The downstream distributor must verify the applicable license terms and a working recipient modification/relink route for the actual artifact. At minimum:

- Retain `LICENSE`, `NOTICE`, `THIRD_PARTY_NOTICES`, this guide and the complete `third_party/agenui/` notices in the distributed archive or another accompanying form that recipients can access. Keep all relevant native dependency license texts and copyright notices, including MIT and the actual C++ runtime notices.
- Provide the complete corresponding source and build material required by the selected LGPL distribution route, including the modified sax source, modifications, dependency/toolchain information and any required object/relink material. A GitHub link by itself is not asserted to satisfy every source-distribution or offer requirement.
- Confirm that recipients can modify the relevant library code, rebuild/relink, and use the result with the host as required by the applicable license route. Test ABI compatibility, packaging, signing and runtime behavior; do not rely only on the `.so` extension or successful compilation.
- Preserve the exact binary hashes, source commit/patches, dependency sources/licenses and build/relink instructions for each released version. Resolve the `libc++_shared.so` provenance and the registry-binary/source mapping before representing this inventory as complete.

No native source rebuild, binary reproducibility match or recipient relink test has been performed as part of this documentation change. The successful Harmony OpenUI HAR build uses the separately resolved public AGenUI package and demonstrates a different boundary.
