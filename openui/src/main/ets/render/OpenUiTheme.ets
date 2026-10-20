// SPDX-License-Identifier: Apache-2.0
/** All renderer dimensions are logical vp; typography follows the same scale. */
export interface OpenUiPalette {
  canvas: string; surface: string; group: string; text: string; secondary: string; divider: string;
  accent: string; accentContainer: string; positive: string; positiveContainer: string;
  caution: string; cautionContainer: string;
}
export interface OpenUiDimensions {
  headline: number; body: number; supporting: number; bodyLine: number; supportingLine: number;
  inset: number; spacing: number; radius: number; targetHeight: number;
}
export interface OpenUiTheme { mode: 'light' | 'dark'; palette: OpenUiPalette; dimensions: OpenUiDimensions; }

export class OpenUiThemes {
  static create(mode: 'light' | 'dark' = 'light'): OpenUiTheme {
    const palette: OpenUiPalette = mode === 'dark' ? {
      canvas: '#111318', surface: '#1A1D24', group: '#222630', text: '#EDF0F7', secondary: '#B4BDCC', divider: '#394252',
      accent: '#ADBDFF', accentContainer: '#283A66', positive: '#8BD9B4', positiveContainer: '#173B30',
      caution: '#F0C583', cautionContainer: '#46351E'
    } : {
      canvas: '#F5F7FB', surface: '#FFFFFF', group: '#F3F5F9', text: '#182235', secondary: '#586579', divider: '#DDE3ED',
      accent: '#3856C8', accentContainer: '#EDF1FF', positive: '#216B4D', positiveContainer: '#EAF6EF',
      caution: '#815918', cautionContainer: '#FFF4DB'
    };
    return { mode, palette, dimensions: { headline: 18, body: 16, supporting: 14, bodyLine: 24,
      supportingLine: 21, inset: 14, spacing: 12, radius: 12, targetHeight: 64 } };
  }
  static copy(theme: OpenUiTheme): OpenUiTheme { return JSON.parse(JSON.stringify(theme)) as OpenUiTheme; }
}
