// SPDX-License-Identifier: Apache-2.0
import { OpenUiComponent, OpenUiFieldValue, OpenUiText } from './OpenUiTypes';

/** Explicit native capability set; not a claim of full ArkUI or A2UI conformance. */
export class OpenUiCatalog {
  static readonly id: string = 'urn:harmony-openui:catalog:0.1';
  static readonly componentNames: string[] = ['Column', 'Row', 'Card', 'Text', 'Button',
    'OpenUiOption', 'OpenUiFacts', 'OpenUiStatus', 'OpenUiDetails', 'OpenUiForm', 'OpenUiInput',
    'OpenUiCheckbox', 'OpenUiToggle', 'OpenUiSelect', 'OpenUiRadioGroup', 'OpenUiSlider',
    'OpenUiDatePicker', 'OpenUiTimePicker', 'OpenUiImage', 'OpenUiList', 'OpenUiDialog', 'Image'];

  static identifier(value: string | undefined): boolean {
    return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_.-]{0,63}$/.test(value) &&
      !['__proto__', 'prototype', 'constructor'].includes(value);
  }
  static isField(component: OpenUiComponent): boolean {
    return ['OpenUiInput', 'OpenUiCheckbox', 'OpenUiToggle', 'OpenUiSelect', 'OpenUiRadioGroup',
      'OpenUiSlider', 'OpenUiDatePicker', 'OpenUiTimePicker'].includes(component.component);
  }
  static defaultFieldValue(component: OpenUiComponent): OpenUiFieldValue {
    if (component.value !== undefined) { return component.value; }
    if (['OpenUiCheckbox', 'OpenUiToggle'].includes(component.component)) { return false; }
    if (component.component === 'OpenUiSlider') { return component.min ?? 0; }
    return '';
  }
  static fieldValueType(component: OpenUiComponent, value: OpenUiFieldValue): boolean {
    if (['OpenUiCheckbox', 'OpenUiToggle'].includes(component.component)) { return typeof value === 'boolean'; }
    if (component.component === 'OpenUiSlider') { return typeof value === 'number' && Number.isFinite(value); }
    return typeof value === 'string' && value.length <= 8192;
  }
  private static date(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { return false; }
    const year = Number(value.substring(0, 4)); const month = Number(value.substring(5, 7));
    const day = Number(value.substring(8, 10));
    const days: number[] = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return year > 0 && year <= 5000 && month > 0 && month <= 12 && day > 0 && day <= days[month - 1];
  }
  /** Stable, locale-neutral inline validation codes. Empty means valid. */
  static fieldError(component: OpenUiComponent, value: OpenUiFieldValue): string {
    if (!OpenUiCatalog.fieldValueType(component, value)) { return 'type'; }
    if (component.required === true && (value === false || (typeof value === 'string' && !value.trim()))) { return 'required'; }
    if (typeof value === 'string') {
      // Only the canonical empty value means "not selected". Whitespace is
      // still invalid for date/time/option values and typed numeric inputs.
      if (value === '') { return ''; }
      if (component.component === 'OpenUiInput') {
        if (component.inputType === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) { return 'email'; }
        if (component.inputType === 'number' && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) || !Number.isFinite(Number(value)))) { return 'number'; }
      }
      if (['OpenUiSelect', 'OpenUiRadioGroup'].includes(component.component) &&
        !(component.options ?? []).some((option): boolean => option.value === value)) { return 'option'; }
      if (component.component === 'OpenUiDatePicker') {
        if (!OpenUiCatalog.date(value)) { return 'date'; }
        if ((component.minDate !== undefined && value < component.minDate) || (component.maxDate !== undefined && value > component.maxDate)) { return 'range'; }
      }
      if (component.component === 'OpenUiTimePicker' && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) { return 'time'; }
    }
    if (component.component === 'OpenUiSlider' && typeof value === 'number') {
      const min = component.min ?? 0; const max = component.max ?? 100; const step = component.step ?? 1;
      if (value < min || value > max) { return 'range'; }
      const units = (value - min) / step;
      if (Math.abs(units - Math.round(units)) > 0.000001) { return 'step'; }
    }
    return '';
  }

  static text(value: OpenUiText | undefined): boolean {
    if (typeof value === 'string') { return value.length <= 8192; }
    return value !== undefined && value !== null && typeof value.path === 'string' &&
      Object.keys(value).length === 1 && (value.path === '' || value.path.startsWith('/'));
  }

  static validate(component: OpenUiComponent): void {
    if (!component || typeof component.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(component.id) ||
      ['__proto__', 'prototype', 'constructor'].includes(component.id) ||
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
      case 'OpenUiForm':
        keys.push('name', 'children');
        if (!OpenUiCatalog.identifier(component.name) || !Array.isArray(component.children) || component.children.length > 200 ||
          component.children.some((id: string): boolean => typeof id !== 'string')) { throw new Error('OPENUI_FORM'); }
        break;
      case 'OpenUiInput':
        keys.push('field', 'label', 'value', 'placeholder', 'required', 'disabled', 'inputType', 'variant');
        if ((component.placeholder !== undefined && (typeof component.placeholder !== 'string' || component.placeholder.length > 500)) ||
          (component.inputType !== undefined && !['text', 'number', 'email', 'tel'].includes(component.inputType)) ||
          (component.variant !== undefined && !['text', 'textarea', 'search'].includes(component.variant))) { throw new Error('OPENUI_INPUT'); }
        break;
      case 'OpenUiCheckbox': case 'OpenUiToggle': case 'OpenUiTimePicker':
        keys.push('field', 'label', 'value', 'required', 'disabled');
        break;
      case 'OpenUiSelect': case 'OpenUiRadioGroup': {
        keys.push('field', 'label', 'value', 'options', 'required', 'disabled');
        if (!Array.isArray(component.options) || component.options.length < 1 || component.options.length > 100) { throw new Error('OPENUI_OPTIONS'); }
        const values: Set<string> = new Set<string>();
        for (const option of component.options) {
          if (!option || Object.keys(option).some((key: string): boolean => !['label', 'value'].includes(key)) ||
            typeof option.label !== 'string' || !option.label || option.label.length > 500 ||
            typeof option.value !== 'string' || !option.value.trim() || option.value.length > 500 || values.has(option.value)) { throw new Error('OPENUI_OPTIONS'); }
          values.add(option.value);
        }
        break;
      }
      case 'OpenUiSlider':
        keys.push('field', 'label', 'value', 'min', 'max', 'step', 'disabled');
        if ([component.min, component.max, component.step].some((value: number | undefined): boolean => value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) ||
          (component.min ?? 0) >= (component.max ?? 100) || (component.step ?? 1) < 0.01 ||
          (component.step ?? 1) > (component.max ?? 100) - (component.min ?? 0)) { throw new Error('OPENUI_RANGE'); }
        break;
      case 'OpenUiDatePicker':
        keys.push('field', 'label', 'value', 'minDate', 'maxDate', 'required', 'disabled');
        if ((component.minDate !== undefined && (typeof component.minDate !== 'string' || !OpenUiCatalog.date(component.minDate))) ||
          (component.maxDate !== undefined && (typeof component.maxDate !== 'string' || !OpenUiCatalog.date(component.maxDate))) ||
          (component.minDate !== undefined && component.maxDate !== undefined && component.minDate > component.maxDate)) { throw new Error('OPENUI_DATE_RANGE'); }
        break;
      case 'OpenUiImage': case 'Image':
        keys.push('source', 'alt', 'aspectRatio');
        if (typeof component.source !== 'string' || component.source.length > 2048 || !/^https:\/\/[A-Za-z0-9][^\s<>]*$/.test(component.source) ||
          typeof component.alt !== 'string' || component.alt.length > 500 ||
          (component.aspectRatio !== undefined && (typeof component.aspectRatio !== 'number' || !Number.isFinite(component.aspectRatio) || component.aspectRatio < 0.25 || component.aspectRatio > 4))) { throw new Error('OPENUI_IMAGE'); }
        break;
      case 'OpenUiList':
        keys.push('title', 'items', 'height');
        if ((component.title !== undefined && (typeof component.title !== 'string' || component.title.length > 500)) ||
          !Array.isArray(component.items) || component.items.length < 1 || component.items.length > 100 ||
          (component.height !== undefined && (typeof component.height !== 'number' || !Number.isFinite(component.height) || component.height < 120 || component.height > 480))) { throw new Error('OPENUI_LIST'); }
        for (const item of component.items) {
          if (!item || Object.keys(item).some((key: string): boolean => !['title', 'description', 'meta'].includes(key)) ||
            typeof item.title !== 'string' || !item.title || item.title.length > 500 ||
            (item.description !== undefined && (typeof item.description !== 'string' || item.description.length > 2000)) ||
            (item.meta !== undefined && (typeof item.meta !== 'string' || item.meta.length > 500))) { throw new Error('OPENUI_LIST'); }
        }
        break;
      case 'OpenUiDialog':
        keys.push('label', 'title', 'text', 'confirmLabel', 'cancelLabel', 'action');
        if (typeof component.label !== 'string' || !component.label || component.label.length > 500 ||
          !OpenUiCatalog.text(component.title) || !OpenUiCatalog.text(component.text) || !component.action ||
          (component.confirmLabel !== undefined && (typeof component.confirmLabel !== 'string' || !component.confirmLabel || component.confirmLabel.length > 100)) ||
          (component.cancelLabel !== undefined && (typeof component.cancelLabel !== 'string' || !component.cancelLabel || component.cancelLabel.length > 100))) { throw new Error('OPENUI_DIALOG'); }
        break;
    }
    if (OpenUiCatalog.isField(component)) {
      if (!OpenUiCatalog.identifier(component.field) || typeof component.label !== 'string' || !component.label || component.label.length > 500 ||
        (component.required !== undefined && typeof component.required !== 'boolean') || (component.disabled !== undefined && typeof component.disabled !== 'boolean') ||
        !OpenUiCatalog.fieldValueType(component, OpenUiCatalog.defaultFieldValue(component))) { throw new Error('OPENUI_FIELD'); }
      // A blank required field is valid document data; it is rejected when the user submits.
      const error = OpenUiCatalog.fieldError(component, OpenUiCatalog.defaultFieldValue(component));
      if (error && error !== 'required') { throw new Error('OPENUI_FIELD_VALUE'); }
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
      if (event.name === 'submit' && (Object.keys(event.context).length !== 1 || !OpenUiCatalog.identifier(event.context['form'] as string))) { throw new Error('OPENUI_SUBMIT'); }
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
    const forms: Set<string> = new Set<string>();
    for (const node of components) {
      if (node.component === 'OpenUiForm') {
        if (forms.has(node.name!)) { throw new Error('OPENUI_DUPLICATE_FORM'); } forms.add(node.name!);
      }
    }
    const parents: Map<string, string> = new Map<string, string>();
    for (const node of components) { for (const id of node.children ?? (node.child ? [node.child] : [])) { parents.set(id, node.id); } }
    const fields: Set<string> = new Set<string>();
    for (const node of components) {
      let parent = parents.get(node.id); let form = '';
      while (parent) {
        const ancestor = lookup.get(parent); if (!ancestor) { break; }
        if (ancestor.component === 'OpenUiForm') {
          if (form || node.component === 'OpenUiForm') { throw new Error('OPENUI_NESTED_FORM'); }
          form = ancestor.name!;
        }
        parent = parents.get(parent);
      }
      if (OpenUiCatalog.isField(node) && form) {
        const key = JSON.stringify([form, node.field]);
        if (fields.has(key)) { throw new Error('OPENUI_DUPLICATE_FIELD'); } fields.add(key);
      }
      if (node.action?.event.name === 'submit' && (!form || node.action.event.context['form'] !== form)) { throw new Error('OPENUI_SUBMIT_FORM'); }
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
