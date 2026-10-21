// SPDX-License-Identifier: Apache-2.0
import { OpenUiComponent, OpenUiFact, OpenUiSurface, OpenUiText } from '../core/OpenUiTypes';
import { OpenUiTheme } from './OpenUiTheme';
import { OpenUiNativeIds } from './OpenUiNativeIds';

interface RenderNode extends OpenUiComponent {
  selectable?: boolean; selected?: boolean; url?: string; fit?: string;
  accessibility?: NativeAccessibility;
}
interface NativeAccessibility { label: string; }
interface NativeCreate { version: string; createSurface: NativeSurface; }
interface NativeSurface { surfaceId: string; catalogId: string; }
interface NativeUpdate { version: string; updateComponents: NativeComponents; }
interface NativeComponents { surfaceId: string; components: RenderNode[]; }

/** AGenUI is one rendering adapter, not the SDK input language or state owner. */
export class OpenUiProjection {
  static ready(surface: OpenUiSurface): boolean {
    if (!surface.components.length) { return false; }
    const ids = new Set<string>(surface.components.map((node: OpenUiComponent): string => node.id));
    return surface.components.every((node: OpenUiComponent): boolean =>
      (node.children ?? (node.child ? [node.child] : [])).every((id: string): boolean => ids.has(id)));
  }
  private static pointer(path: string, data: Object): Object | undefined {
    if (path === '') { return data; }
    if (!path.startsWith('/') || /~(?![01])/.test(path)) { return undefined; }
    let current: Object | undefined = data;
    for (const raw of path.substring(1).split('/')) {
      const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
      if (['__proto__', 'constructor', 'prototype'].includes(key) || !current || typeof current !== 'object') { return undefined; }
      const record = current as Record<string, Object>;
      if (!Object.keys(record).includes(key)) { return undefined; }
      current = record[key];
    }
    return current;
  }
  static text(value: OpenUiText | undefined, data: Object): string {
    if (typeof value === 'string') { return value; }
    if (!value) { return ''; }
    const resolved = OpenUiProjection.pointer(value.path, data);
    return typeof resolved === 'string' || typeof resolved === 'number' || typeof resolved === 'boolean' ? String(resolved) : '';
  }
  private static resolve(value: Object, data: Object): Object {
    if (!value || typeof value !== 'object') { return value; }
    if (Array.isArray(value)) { return value.map((entry: Object): Object => OpenUiProjection.resolve(entry, data)); }
    const record = value as Record<string, Object>;
    if (Object.keys(record).length === 1 && typeof record['path'] === 'string') {
      return OpenUiProjection.pointer(record['path'] as string, data) ?? null!;
    }
    const output: Record<string, Object> = {};
    for (const key of Object.keys(record)) { output[key] = OpenUiProjection.resolve(record[key], data); }
    return output;
  }
  static components(surface: OpenUiSurface, theme: OpenUiTheme): RenderNode[] {
    const nodes = JSON.parse(JSON.stringify(surface.components)) as RenderNode[];
    const data: Object = JSON.parse(surface.dataModelJson);
    const output: RenderNode[] = [];
    const authoredWidths: Set<string> = new Set<string>();
    const buttonLabels: Map<string, string> = new Map<string, string>();
    for (const node of nodes) {
      if (node.styles?.['width']) { authoredWidths.add(node.id); }
      if (!surface.readOnly && node.component === 'Button' && node.child) { buttonLabels.set(node.child, node.variant ?? 'primary'); }
    }
    for (const node of nodes) {
      if (node.text !== undefined) { node.text = OpenUiProjection.text(node.text, data); }
      if (node.title !== undefined) { node.title = OpenUiProjection.text(node.title, data); }
      if (node.description !== undefined) { node.description = OpenUiProjection.text(node.description, data); }
      if (node.meta !== undefined) { node.meta = OpenUiProjection.text(node.meta, data); }
      if (node.facts) {
        node.facts = node.facts.map((fact: OpenUiFact): OpenUiFact => ({
          label: OpenUiProjection.text(fact.label, data), value: OpenUiProjection.text(fact.value, data)
        }));
      }
      if (node.action) { node.action.event.context = OpenUiProjection.resolve(node.action.event.context, data) as Record<string, Object>; }
      if (node.component === 'OpenUiForm') { node.component = 'Column'; node.name = undefined; }
      if (node.component === 'Image') {
        // OpenUI's generic image maps directly to the pinned renderer's Image.
        // Yoga's aspect-ratio uses the actual parent width, including Card inset.
        node.url = node.source; node.fit = 'cover';
        node.accessibility = { label: node.alt ?? '' };
        const imageStyles: Record<string, string> = {};
        imageStyles['width'] = '100%'; imageStyles['aspect-ratio'] = (node.aspectRatio ?? 1.7777778).toString();
        imageStyles['border-radius'] = (Math.max(8, theme.dimensions.radius - 4) * 2).toString() + 'px';
        node.styles = imageStyles;
        node.source = undefined; node.alt = undefined; node.aspectRatio = undefined;
      }
      if (node.component === 'OpenUiDialog' && surface.readOnly) { node.action = undefined; node.disabled = true; }
      if (node.component === 'Button' && surface.readOnly) {
        output.push({ id: node.id, component: 'Column', children: [node.child!] }); continue;
      }
      if (node.component === 'OpenUiOption') {
        node.selectable = !surface.readOnly && node.action !== undefined;
        node.selected = node.id === surface.selectedComponent;
        if (surface.readOnly) { node.action = undefined; }
      }
      if (!node.component.startsWith('OpenUi')) {
        if (!node.styles) { node.styles = {}; }
        const styles = node.styles;
        if (node.component === 'Text') {
          const variant = node.variant ?? 'body';
          const heading = ['h1', 'h2', 'h3'].includes(variant), caption = variant === 'caption';
          const size = heading ? theme.dimensions.headline + (variant === 'h1' ? 6 : variant === 'h3' ? -3 : 0) :
            caption ? theme.dimensions.supporting : theme.dimensions.body;
          const line = heading ? size + 8 : caption ? theme.dimensions.supportingLine : theme.dimensions.bodyLine;
          const button = buttonLabels.get(node.id);
          const borderless = button === 'borderless' || button === 'tertiary';
          if (!styles['font-size']) { styles['font-size'] = (size * 2).toString() + 'px'; }
          if (!styles['line-height']) { styles['line-height'] = (line * 2).toString() + 'px'; }
          if (!styles['font-weight']) { styles['font-weight'] = heading || button !== undefined ? '600' : '400'; }
          if (!styles['color']) { styles['color'] = button !== undefined ? (borderless ? theme.palette.accent : button === 'secondary' ? theme.palette.text : '#FFFFFF') :
            caption ? theme.palette.secondary : theme.palette.text; }
          if (button !== undefined && !styles['text-align']) { styles['text-align'] = 'center'; }
          if (!styles['width']) { styles['width'] = '100%'; }
          styles['line-clamp'] = '0';
        }
        if ((node.component === 'Column' || node.component === 'Row') && !styles['gap']) { styles['gap'] = (theme.dimensions.spacing * 2).toString() + 'px'; }
        if (node.component === 'Card') {
          const clear = styles['background-color'] === 'transparent' || styles['background-color'] === '#00000000';
          if (!styles['background-color']) { styles['background-color'] = theme.palette.surface; }
          if (!styles['padding']) { styles['padding'] = clear ? '0px' : '32px'; }
          if (!styles['border-radius']) { styles['border-radius'] = (theme.dimensions.radius * 2).toString() + 'px'; }
          if (!styles['border-width']) { styles['border-width'] = clear ? '0px' : '1px'; }
          if (!styles['border-color']) { styles['border-color'] = theme.palette.divider; }
        }
        if (node.component === 'Button') {
          const secondary = node.variant === 'secondary';
          const borderless = node.variant === 'borderless' || node.variant === 'tertiary';
          if (!styles['height']) { styles['height'] = (Math.max(44, theme.dimensions.targetHeight) * 2).toString() + 'px'; }
          if (!styles['padding']) { styles['padding'] = '0px 28px'; }
          if (!styles['background-color']) { styles['background-color'] = borderless ? 'transparent' : secondary ? theme.palette.group : theme.palette.accent; }
          if (!styles['border-radius']) { styles['border-radius'] = (Math.min(12, theme.dimensions.radius) * 2).toString() + 'px'; }
          if (!styles['border-width']) { styles['border-width'] = secondary ? '1px' : '0px'; }
          if (!styles['border-color']) { styles['border-color'] = theme.palette.divider; }
          // The pinned native renderer understands primary and borderless.
          // Secondary/tertiary styling is explicit and needs no native fork.
          node.variant = secondary || borderless ? 'borderless' : 'primary';
        }
      }
      output.push(node);
    }
    const byId: Map<string, RenderNode> = new Map<string, RenderNode>();
    for (const node of output) { byId.set(node.id, node); }
    for (const row of output) {
      if (row.component !== 'Row') { continue; }
      for (const id of row.children ?? []) {
        const child = byId.get(id); if (!child || authoredWidths.has(id)) { continue; }
        if (!child.styles) { child.styles = {}; }
        // Keep ordinary Row children in equal, shrinking tracks. A 100% text
        // or hybrid control must not claim the entire parent inside a column.
        child.styles['width'] = '0px'; child.styles['min-width'] = '0px';
        child.styles['flex-grow'] = '1'; child.styles['flex-shrink'] = '1'; child.styles['flex-basis'] = '0px';
      }
    }
    return output;
  }
  static nativeComponents(surface: OpenUiSurface, theme: OpenUiTheme, ids: OpenUiNativeIds, contentWidth: number): RenderNode[] {
    const nodes = OpenUiProjection.components(surface, theme);
    const referenced: Set<string> = new Set<string>();
    for (const node of nodes) { for (const child of node.children ?? (node.child ? [node.child] : [])) { referenced.add(child); } }
    const top = nodes.some((node: RenderNode): boolean => node.id === 'root') ? ['root'] :
      nodes.filter((node: RenderNode): boolean => !referenced.has(node.id)).map((node: RenderNode): string => node.id);
    for (const node of nodes) {
      node.id = ids.nativeId(node.id);
      if (node.child) { node.child = ids.nativeId(node.child); }
      if (node.children) { node.children = node.children.map((child: string): string => ids.nativeId(child)); }
    }
    // The native adapter requires root. Keep it basic and namespace the entire
    // source tree, including a custom source component whose own ID is root.
    const rootStyles: Record<string, string> = {};
    rootStyles['width'] = (contentWidth * 2).toString() + 'px'; rootStyles['gap'] = (theme.dimensions.spacing * 2).toString() + 'px';
    const root: RenderNode = { id: 'root', component: 'Column', children: top.map((id: string): string => ids.nativeId(id)), styles: rootStyles };
    nodes.unshift(root);
    return nodes;
  }
  static update(surfaceId: string, nodes: RenderNode[]): string {
    const update: NativeUpdate = { version: 'v0.9', updateComponents: { surfaceId, components: nodes } };
    return JSON.stringify(update);
  }
  static messages(surface: OpenUiSurface, theme: OpenUiTheme, ids: OpenUiNativeIds, contentWidth: number): string {
    const nodes = OpenUiProjection.nativeComponents(surface, theme, ids, contentWidth);
    const create: NativeCreate = { version: 'v0.9', createSurface: { surfaceId: surface.id, catalogId: surface.catalogId } };
    return JSON.stringify(create) + '\n' + OpenUiProjection.update(surface.id, nodes);
  }
}
