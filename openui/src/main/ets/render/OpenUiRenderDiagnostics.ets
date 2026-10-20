// SPDX-License-Identifier: Apache-2.0
/** Disabled in distributed builds. Diagnostic staging may enable numeric-only logs. */
export class OpenUiRenderDiagnostics {
  static enabled: boolean = false;
  static log(message: string): void { if (OpenUiRenderDiagnostics.enabled) { console.info('[OpenUiRender] ' + message); } }
}
