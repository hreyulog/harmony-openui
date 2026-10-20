// SPDX-License-Identifier: Apache-2.0
import { OpenUiComponent, OpenUiFieldValue, OpenUiSurface } from '../core/OpenUiTypes';
export interface OpenUiControlState { value: OpenUiFieldValue; revision: number; }

/** Renderer helpers keep edited field state separate from the document revision. */
export class OpenUiControlModel {
  static readonly names: string[] = ['OpenUiInput', 'OpenUiCheckbox', 'OpenUiToggle', 'OpenUiSelect',
    'OpenUiRadioGroup', 'OpenUiSlider', 'OpenUiDatePicker', 'OpenUiTimePicker', 'OpenUiImage', 'OpenUiList', 'OpenUiDialog'];
  static isField(kind: string): boolean { return OpenUiControlModel.names.includes(kind) && !['OpenUiImage', 'OpenUiList', 'OpenUiDialog'].includes(kind); }
  static value(node: OpenUiComponent, values: Record<string, OpenUiFieldValue>): OpenUiFieldValue {
    if (Object.keys(values).includes(node.id)) { return values[node.id]; }
    if (node.value !== undefined) { return node.value; }
    if (node.component === 'OpenUiCheckbox' || node.component === 'OpenUiToggle') { return false; }
    return node.component === 'OpenUiSlider' ? node.min ?? 0 : '';
  }
  static values(surface: OpenUiSurface): Record<string, OpenUiFieldValue> { return JSON.parse(surface.fieldValuesJson ?? '{}') as Record<string, OpenUiFieldValue>; }
  static errors(surface: OpenUiSurface): Record<string, string> { return JSON.parse(surface.fieldErrorsJson ?? '{}') as Record<string, string>; }
  static error(code: string): string {
    switch (code) {
      case 'required': return '此项为必填项 / Required';
      case 'email': return '请输入有效邮箱 / Enter a valid email';
      case 'number': return '请输入数字 / Enter a number';
      case 'date': return '请选择有效日期 / Choose a valid date';
      case 'time': return '请选择有效时间 / Choose a valid time';
      case 'option': return '请选择有效选项 / Choose an option';
      case 'range': return '超出允许范围 / Outside allowed range';
      case 'step': return '请按指定步长选择 / Choose an allowed step';
      // Controllers may supply application-localized validationMessage text.
      // Preserve that message rather than replacing it with renderer wording.
      default: return code;
    }
  }
  static date(value: string, fallback: Date): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { return fallback; }
    const date = new Date(2000, 0, 1, 12);
    date.setFullYear(Number(value.substring(0, 4)), Number(value.substring(5, 7)) - 1, Number(value.substring(8, 10)));
    return date;
  }
  static dateText(value: Date): string {
    return value.getFullYear().toString().padStart(4, '0') + '-' + (value.getMonth() + 1).toString().padStart(2, '0') + '-' + value.getDate().toString().padStart(2, '0');
  }
  static time(value: string): Date {
    const date = new Date(2000, 0, 1, 0, 0);
    if (/^\d{2}:\d{2}$/.test(value)) { date.setHours(Number(value.substring(0, 2)), Number(value.substring(3, 5))); }
    return date;
  }
}
