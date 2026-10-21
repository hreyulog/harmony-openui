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
      canvas: '#101318', surface: '#1B2028', group: '#252C36', text: '#EEF2F8', secondary: '#AAB4C4', divider: '#353F4D',
      accent: '#4169E1', accentContainer: '#253457', positive: '#8BD9B4', positiveContainer: '#173B30',
      caution: '#F0C583', cautionContainer: '#46351E'
    } : {
      canvas: '#F6F7F9', surface: '#FFFFFF', group: '#F1F3F6', text: '#172033', secondary: '#667085', divider: '#E5E9F0',
      accent: '#315EE9', accentContainer: '#EDF2FF', positive: '#237452', positiveContainer: '#EAF6EF',
      caution: '#815918', cautionContainer: '#FFF4DB'
    };
    // The host owns page margins; a view is no longer an extra padded card.
    // Retain the public token names so existing host themes remain compatible.
    return { mode, palette, dimensions: { headline: 22, body: 16, supporting: 13, bodyLine: 24,
      supportingLine: 20, inset: 0, spacing: 12, radius: 16, targetHeight: 48 } };
  }
  static copy(theme: OpenUiTheme): OpenUiTheme { return JSON.parse(JSON.stringify(theme)) as OpenUiTheme; }
}
