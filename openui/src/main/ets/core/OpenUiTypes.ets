// SPDX-License-Identifier: Apache-2.0
export interface OpenUiBinding { path: string; }
export type OpenUiText = string | OpenUiBinding;
export interface OpenUiFact { label: OpenUiText; value: OpenUiText; }
export interface OpenUiActionDefinition { event: OpenUiNamedAction; }
export interface OpenUiNamedAction { name: string; context: Record<string, Object>; }
export type OpenUiFieldValue = string | number | boolean;
export interface OpenUiSelectOption { label: string; value: string; description?: string; }
export interface OpenUiListItem { title: string; description?: string; meta?: string; }
export interface OpenUiComponent {
  id: string;
  component: string;
  text?: OpenUiText;
  title?: OpenUiText;
  description?: OpenUiText;
  meta?: OpenUiText;
  facts?: OpenUiFact[];
  tone?: string;
  variant?: string;
  children?: string[];
  child?: string;
  align?: string;
  justify?: string;
  styles?: Record<string, string>;
  action?: OpenUiActionDefinition;
  name?: string;
  field?: string;
  label?: string;
  value?: OpenUiFieldValue;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  inputType?: string;
  options?: OpenUiSelectOption[];
  min?: number;
  max?: number;
  step?: number;
  minDate?: string;
  maxDate?: string;
  source?: string;
  alt?: string;
  aspectRatio?: number;
  items?: OpenUiListItem[];
  height?: number;
  confirmLabel?: string;
  cancelLabel?: string;
}
export type OpenUiRenderStatus = 'pending' | 'rendered' | 'error';
/** Renderer hint only. Revisions still fence every document update. */
export type OpenUiUpdateMode = 'replace' | 'patch';
export interface OpenUiSurface {
  id: string;
  catalogId: string;
  revision: number;
  updateMode?: OpenUiUpdateMode;
  components: OpenUiComponent[];
  dataModelJson: string;
  fieldValuesJson: string;
  fieldErrorsJson: string;
  readOnly: boolean;
  selectedComponent: string;
  renderStatus: OpenUiRenderStatus;
  error: string;
}
export interface OpenUiUserAction {
  surfaceId: string;
  sourceComponentId: string;
  name: string;
  context: Record<string, Object>;
}
export interface OpenUiActionReceipt extends OpenUiUserAction {
  eventId: string;
  revision: number;
  receivedAt: number;
}
export interface OpenUiRenderEvent {
  surfaceId: string;
  revision: number;
  status: OpenUiRenderStatus;
  error: string;
}
export interface OpenUiFieldChange {
  surfaceId: string;
  sourceComponentId: string;
  field: string;
  form: string;
  value: OpenUiFieldValue;
  revision: number;
}
export interface OpenUiControllerOptions {
  onAction?: (event: OpenUiActionReceipt) => void;
  onRenderStatus?: (event: OpenUiRenderEvent) => void;
  onFieldChange?: (event: OpenUiFieldChange) => void;
  validationMessage?: (code: string, component: OpenUiComponent) => string;
}
export interface OpenUiChange {
  kind: 'create' | 'components' | 'patch' | 'data' | 'delete';
  surfaceId: string;
  catalogId?: string;
  components?: OpenUiComponent[];
  replace?: boolean;
  /** For a complete patch or components replace:true from a state-owning adapter. */
  syncFieldValues?: boolean;
  path?: string;
  valueJson?: string;
}
