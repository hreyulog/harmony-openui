# Building the library and independent demo

The repository contains no signing profile, certificate, model key, installed dependency, or binary package. Build outputs and caches go to a fresh directory outside the checkout.

## Toolchain

- HarmonyOS Command Line Tools 6.1.1 / API 24 SDK and DevEco JBR (Java 17).
- Python 3.10+.
- Node.js 22.18+ or 24 (host tests use Node's TypeScript stripping), pnpm 11.25.0.
- `git` on PATH, including when freezing uncommitted development sources.

The product targets API 24 and has compatibleSdkVersion API 20. A successful build is not proof of older-device runtime compatibility.

```powershell
python tools/build.py --target all --unsigned --work-dir D:/openui-build/first `
  --cli-home <command-line-tools> --java-home <JBR> `
  --node <node-executable> --pnpm <pnpm-executable>
```

`--target har` builds only the reusable library. `--target all` additionally compiles the standalone entry module. `--unsigned` is explicit because an unsigned HAP cannot be installed on a retail device.

The script freezes a source manifest, downloads the public pinned AGenUI archive with integrity verification, installs locked npm dependencies without postinstall scripts, generates the official OpenUI parser bundle, resolves OHPM dependencies, verifies their bytes, and invokes Hvigor. Receipts and logs remain in the work directory even if compilation fails. It verifies that the HAR contains LICENSE, NOTICE, and THIRD_PARTY_NOTICES.

To regenerate the parser and run host checks in a development checkout:

```powershell
pnpm install --frozen-lockfile --ignore-scripts
pnpm run build:lang
pnpm test
python -m unittest discover -s tests -p 'test_*.py'
```

The generated runtime and its `.d.ts`/provenance are ignored by Git and recreated from the lockfile. Do not edit the generated JavaScript. Catalog changes belong in `tools/lang/library.mjs`; adaptation belongs in `tools/lang/runtime-entry.mjs`.

## Independent device signing

Register the demo's exact bundle `com.hreyulog.harmonyopenui.demo` in your own Huawei developer account. Create a legitimate debug Profile for your registered device and debug certificate, following [Huawei's official instructions](https://developer.huawei.com/consumer/cn/doc/doccenter-getting-started/agc-help-debug-profile-0000002248181278). The library itself needs no signing.

Keep one DevEco-compatible signing configuration in a private JSON file outside the repository:

```json
{
  "name": "demo-debug",
  "type": "HarmonyOS",
  "material": {
    "certpath": "D:/private/debug.cer",
    "profile": "D:/private/openui-demo.p7b",
    "storeFile": "D:/private/debug.p12",
    "keyAlias": "your-alias",
    "keyPassword": "your-private-value",
    "storePassword": "your-private-value",
    "signAlg": "SHA256withECDSA"
  }
}
```

```powershell
python tools/build.py --target all --work-dir D:/openui-build/signed-01 `
  --signing-config D:/private/openui-signing.private.json `
  --cli-home <command-line-tools> --java-home <JBR>
```

The script checks the signed Profile's bundle and only injects configuration into the external build stage. It neither edits nor fabricates a Profile. The CLI logs do not intentionally print signing secrets; keep the whole private build stage local.

Install the signed demo with the official `hdc install` command, then start its `EntryAbility`. It is an independent bundle; installing it does not require replacing another application.

## Model demo

Open “模型配置与源码” and enter a complete HTTPS endpoint, model ID, API key, and protocol. The example supports OpenAI-compatible chat completions or Anthropic-compatible messages. Provider availability, access, output budgets and billing are the embedding application's responsibility. The default endpoint/model is only an editable starting value, not a bundled credential or availability guarantee.

For local device development only, the demo also reads an optional `files/model-config.json` from its app-private directory with fields `endpoint`, `model`, `apiKey`, `protocol`. This file is not created by the SDK, persisted from the UI, included in the HAP, or committed. Do not share it or collect it as public diagnostics. Remove it after testing.

The diagnostic `openui-demo-state.json` includes the generated source, action receipt, UI status and snapshot; it excludes model configuration and key. Generated model output can still contain user data, so review diagnostic files before sharing.

The demo sends complete HTTP responses to the incremental parser in chunks to exercise the parser. It does not implement provider SSE framing. A production application can feed actual streamed content directly to `OpenUiLanguageStream.append`.
