// SPDX-License-Identifier: Apache-2.0
export interface OpenUiBinding { path: string; }
export type OpenUiText = string | OpenUiBinding;
export interface OpenUiFact { label: OpenUiText; value: OpenUiText; }
export interface OpenUiActionDefinition { event: OpenUiNamedAction; }
export interface OpenUiNamedAction { name: string; context: Record<string, Object>; }
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
}
export type OpenUiRenderStatus = 'pending' | 'rendered' | 'error';
export interface OpenUiSurface {
  id: string;
  catalogId: string;
  revision: number;
  components: OpenUiComponent[];
  dataModelJson: string;
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
export interface OpenUiControllerOptions {
  onAction?: (event: OpenUiActionReceipt) => void;
  onRenderStatus?: (event: OpenUiRenderEvent) => void;
}
export interface OpenUiChange {
  kind: 'create' | 'components' | 'data' | 'delete';
  surfaceId: string;
  catalogId?: string;
  components?: OpenUiComponent[];
  replace?: boolean;
  path?: string;
  valueJson?: string;
}
