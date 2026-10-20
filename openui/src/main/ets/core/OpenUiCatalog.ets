// SPDX-License-Identifier: Apache-2.0
import { OpenUiComponent, OpenUiText } from './OpenUiTypes';

/** Explicit v0.1 native capability set; not a claim of full A2UI conformance. */
export class OpenUiCatalog {
  static readonly id: string = 'urn:harmony-openui:catalog:0.1';
  static readonly componentNames: string[] = ['Column', 'Row', 'Card', 'Text', 'Button',
    'OpenUiOption', 'OpenUiFacts', 'OpenUiStatus', 'OpenUiDetails'];

  static text(value: OpenUiText | undefined): boolean {
    if (typeof value === 'string') { return value.length <= 8192; }
    return value !== undefined && value !== null && typeof value.path === 'string' &&
      Object.keys(value).length === 1 && (value.path === '' || value.path.startsWith('/'));
  }

  static validate(component: OpenUiComponent): void {
    if (!component || typeof component.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(component.id) ||
      !OpenUiCatalog.componentNames.includes(component.component)) { throw new Error('OPENUI_COMPONENT'); }
    let keys: string[] = ['id', 'component'];
    switch (component.component) {
      case 'Column': case 'Row':
        keys.push('children', 'align', 'justify', 'styles');
        if (!Array.isArray(component.children) || component.children.length > 200 ||
          component.children.some((id: string): boolean => typeof id !== 'string')) { throw new Error('OPENUI_CHILDREN'); }
        break;
      case 'Card':
        keys.push('child', 'styles');
        if (typeof component.child !== 'string') { throw new Error('OPENUI_CHILD'); }
        break;
      case 'Text':
        keys.push('text', 'variant', 'styles');
        if (!OpenUiCatalog.text(component.text)) { throw new Error('OPENUI_TEXT'); }
        break;
      case 'Button':
        keys.push('child', 'variant', 'styles', 'action');
        if (typeof component.child !== 'string' || !component.action) { throw new Error('OPENUI_BUTTON'); }
        break;
      case 'OpenUiOption':
        keys.push('title', 'description', 'meta', 'action');
        if (!OpenUiCatalog.text(component.title) || !component.action ||
          (component.description !== undefined && !OpenUiCatalog.text(component.description)) ||
          (component.meta !== undefined && !OpenUiCatalog.text(component.meta))) { throw new Error('OPENUI_OPTION'); }
        break;
      case 'OpenUiFacts':
        keys.push('title', 'facts');
        if ((component.title !== undefined && !OpenUiCatalog.text(component.title)) || !Array.isArray(component.facts) || component.facts.length > 80) { throw new Error('OPENUI_FACTS'); }
        for (const fact of component.facts) {
          if (!fact || Object.keys(fact).some((key: string): boolean => key !== 'label' && key !== 'value') ||
            !OpenUiCatalog.text(fact.label) || !OpenUiCatalog.text(fact.value)) { throw new Error('OPENUI_FACTS'); }
        }
        break;
      case 'OpenUiStatus':
        keys.push('text', 'tone');
        if (!OpenUiCatalog.text(component.text) || (component.tone !== undefined &&
          !['neutral', 'success', 'warning'].includes(component.tone))) { throw new Error('OPENUI_STATUS'); }
        break;
      case 'OpenUiDetails':
        keys.push('title', 'text');
        if (!OpenUiCatalog.text(component.title) || !OpenUiCatalog.text(component.text)) { throw new Error('OPENUI_DETAILS'); }
        break;
    }
    if (Object.keys(component).some((key: string): boolean => !keys.includes(key))) { throw new Error('OPENUI_PROPERTY'); }
    if (component.styles !== undefined && (!component.styles || typeof component.styles !== 'object' ||
      Array.isArray(component.styles) || Object.keys(component.styles).some((key: string): boolean =>
        !['width', 'height', 'padding', 'margin', 'gap', 'color', 'background-color', 'border-radius', 'font-size', 'font-weight', 'line-height', 'text-align'].includes(key) ||
        typeof component.styles![key] !== 'string' || /url\s*\(|expression|javascript/i.test(component.styles![key])))) { throw new Error('OPENUI_STYLE'); }
    if (component.action) {
      const event = component.action.event;
      if (Object.keys(component.action).length !== 1 || !event || Object.keys(event).some((key: string): boolean => key !== 'name' && key !== 'context') ||
        typeof event.name !== 'string' || !/^[a-zA-Z][\w.-]{0,79}$/.test(event.name) || !event.context ||
        typeof event.context !== 'object' || Array.isArray(event.context)) { throw new Error('OPENUI_ACTION'); }
    }
  }

  /** Missing references are legal while streaming; cycles and reused children are not. */
  static validateTree(components: OpenUiComponent[]): void {
    if (!Array.isArray(components) || components.length > 200) { throw new Error('OPENUI_COMPONENT_COUNT'); }
    const lookup: Map<string, OpenUiComponent> = new Map<string, OpenUiComponent>();
    for (const item of components) { OpenUiCatalog.validate(item); if (lookup.has(item.id)) { throw new Error('OPENUI_DUPLICATE_ID'); } lookup.set(item.id, item); }
    const owners: Set<string> = new Set<string>();
    for (const item of components) {
      for (const child of item.children ?? (item.child ? [item.child] : [])) {
        if (owners.has(child)) { throw new Error('OPENUI_MULTIPLE_PARENTS'); } owners.add(child);
        const route: Set<string> = new Set<string>();
        OpenUiCatalog.walk(child, lookup, route, 0, item.id);
      }
    }
  }
  private static walk(id: string, nodes: Map<string, OpenUiComponent>, route: Set<string>, depth: number, origin: string): void {
    if (id === origin || route.has(id) || depth > 24) { throw new Error('OPENUI_CYCLE'); }
    const node = nodes.get(id); if (!node) { return; }
    route.add(id);
    for (const child of node.children ?? (node.child ? [node.child] : [])) { OpenUiCatalog.walk(child, nodes, route, depth + 1, origin); }
    route.delete(id);
  }
}
