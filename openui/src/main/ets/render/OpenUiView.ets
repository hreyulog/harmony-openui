// SPDX-License-Identifier: Apache-2.0
import { common } from '@kit.AbilityKit';
import { AGenUIContainer, ISurfaceManagerListener, Surface, SurfaceManager } from '@agenui/agenui';
import { OpenUiController } from '../core/OpenUiController';
import { OpenUiNativeSession } from './OpenUiNative';
import { OpenUiNativeIds } from './OpenUiNativeIds';
import { OpenUiProjection } from './OpenUiProjection';
import { OpenUiTheme, OpenUiThemes } from './OpenUiTheme';
import { OpenUiFieldValue } from '../core/OpenUiTypes';

interface ActionHeader { action?: ActionIdentity; }
interface ActionIdentity { surfaceId?: string; sourceComponentId?: string; }

class OpenUiSurfaceListener implements ISurfaceManagerListener {
  private created: (surface: Surface) => void;
  private action: (event: string) => void;
  private failed: (code: number) => void;
  constructor(created: (surface: Surface) => void, action: (event: string) => void, failed: (code: number) => void) {
    this.created = created; this.action = action; this.failed = failed;
  }
  onCreateSurface(surface: Surface): void { this.created(surface); }
  onReceiveActionEvent(event: string): void { this.action(event); }
  onError(_surface: Surface | null, code: number, _message: string): void { this.failed(code); }
}

/** Render one surface. The controller remains owned by the embedding application. */
@Component
export struct OpenUiView {
  controller: OpenUiController = new OpenUiController();
  @Prop @Watch('configurationChanged') surfaceId: string = '';
  @Prop @Watch('configurationChanged') theme: OpenUiTheme = OpenUiThemes.create();
  @State private nativeInstance: number = 0;
  @State private visibleEpoch: number = 0;
  @State private errorLabel: string = '';
  private observerId: number = -1;
  private epoch: number = 0;
  private contentWidth: number = 0;
  private outerWidth: number = 0;
  private laidOutEpoch: number = 0;
  private eventSerial: number = 0;
  private lifetime: string = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  private fingerprint: string = '';
  private mountedSurface: string = '';
  private manager: SurfaceManager | undefined;
  private nativeSession: OpenUiNativeSession | undefined;
  private details: Map<string, boolean> = new Map<string, boolean>();

  aboutToAppear(): void {
    if (this.observerId < 0) { this.observerId = this.controller.subscribe((): void => { this.refresh(); }); }
    this.refresh();
  }
  aboutToDisappear(): void {
    this.controller.unsubscribe(this.observerId); this.observerId = -1;
    this.contentWidth = 0; this.outerWidth = 0;
    this.fingerprint = ''; this.release();
  }
  private configurationChanged(): void {
    if (this.observerId >= 0) { this.viewportChanged({ width: this.outerWidth, height: 0 }); this.refresh(); }
  }
  private viewportChanged(size: SizeOptions): void {
    const outer = size.width as number;
    if (!Number.isFinite(outer) || outer <= 0) { return; }
    this.outerWidth = outer;
    const width = Math.max(0, outer - 2 * this.theme.dimensions.inset);
    if (width <= 0 || Math.abs(width - this.contentWidth) <= 0.5) { return; }
    this.contentWidth = width;
    if (this.observerId >= 0) { this.refresh(); }
  }
  private release(): void {
    this.epoch++; this.visibleEpoch = 0; this.laidOutEpoch = 0;
    this.nativeSession?.dispose(); this.nativeSession = undefined;
    this.manager?.destroy(); this.manager = undefined;
  }
  private refresh(): void {
    const surface = this.controller.getSurface(this.surfaceId);
    // Render-status notifications are deliberately excluded, preventing a
    // layout -> status -> re-mount -> layout notification cycle.
    const signature = JSON.stringify([surface?.revision, surface?.components, surface?.dataModelJson,
      surface?.readOnly, surface?.selectedComponent, this.surfaceId, this.theme, this.contentWidth]);
    // Field edits/errors share a document revision. Updating the current native
    // elements preserves keyboard focus, selection and internal scroll state.
    if (signature === this.fingerprint) { if (surface) { this.nativeSession?.syncFields(surface); } return; }
    if (surface && OpenUiProjection.ready(surface) && this.manager && this.nativeSession?.canPatch(surface, this.theme, this.contentWidth)) {
      // The mapped runtime has validated a complete atomic replacement. Keep
      // stable native identities and the container's scroll/focus lifetime.
      this.fingerprint = signature; this.errorLabel = '';
      try {
        const epoch = this.epoch;
        const update = this.nativeSession.patch(surface);
        this.controller.reportRenderStatus(surface.id, surface.revision, 'pending');
        // A host status callback may synchronously replace the document/view.
        if (this.epoch !== epoch || this.nativeSession?.documentRevision !== surface.revision) { return; }
        if (update) { this.manager.beginTextStream(); this.manager.receiveTextChunk(update); this.manager.endTextStream(); }
        this.reportMeasured(this.epoch);
      } catch (_) {
        this.errorLabel = 'This view is unavailable.';
        this.controller.reportRenderStatus(surface.id, surface.revision, 'error', 'Native renderer update failed');
      }
      return;
    }
    this.fingerprint = signature; this.release(); this.errorLabel = '';
    if (this.mountedSurface !== this.surfaceId) { this.details.clear(); this.mountedSurface = this.surfaceId; }
    if (!surface || !OpenUiProjection.ready(surface) || this.contentWidth <= 0) { return; }
    const epoch = this.epoch; const revision = surface.revision; const id = surface.id;
    try {
      const manager = new SurfaceManager(getContext(this) as common.UIAbilityContext); this.manager = manager;
      const ids = new OpenUiNativeIds(surface.components);
      this.nativeInstance = manager.getInstanceId();
      this.nativeSession = new OpenUiNativeSession(manager, id, this.theme, surface.readOnly, surface.selectedComponent, this.details, this.getUIContext(), ids,
        (): void => { this.reportMeasured(epoch); }, this.contentWidth,
        (logicalId: string, value: OpenUiFieldValue): boolean => {
          return this.epoch === epoch && this.nativeSession !== undefined &&
            this.controller.setFieldValue(id, logicalId, value, this.nativeSession.documentRevision);
        }, surface);
      manager.addListener(new OpenUiSurfaceListener((created: Surface): void => {
        if (this.epoch === epoch && created.surfaceId === id) { this.visibleEpoch = epoch; }
      }, (raw: string): void => {
        if (this.epoch !== epoch) { return; }
        let projected: string;
        try {
          const event = JSON.parse(raw) as ActionHeader;
          if (event.action?.surfaceId !== id) { return; }
          const source = ids.sourceId(event.action.sourceComponentId ?? '');
          if (source === undefined) { return; }
          event.action.sourceComponentId = source;
          projected = JSON.stringify(event);
        } catch (_) { return; }
        const eventId = this.lifetime + ':' + epoch.toString() + ':' + (++this.eventSerial).toString();
        const currentRevision = this.nativeSession?.documentRevision;
        if (currentRevision !== undefined) { this.controller.acceptAction(projected, currentRevision, eventId); }
      }, (code: number): void => {
        if (this.epoch !== epoch) { return; }
        this.errorLabel = 'This view is unavailable.';
        this.controller.reportRenderStatus(id, this.nativeSession?.documentRevision ?? revision, 'error', 'Native renderer error ' + code.toString());
      }));
      this.controller.reportRenderStatus(id, revision, 'pending');
      if (this.epoch !== epoch || this.nativeSession?.documentRevision !== revision) { return; }
      manager.beginTextStream(); manager.receiveTextChunk(OpenUiProjection.messages(surface, this.theme, ids, this.contentWidth)); manager.endTextStream();
    } catch (_) {
      this.errorLabel = 'This view is unavailable.';
      this.controller.reportRenderStatus(id, revision, 'error', 'Native renderer initialization failed');
    }
  }
  private laidOut(epoch: number, size: SizeOptions): void {
    if (epoch !== this.epoch || this.errorLabel) { return; }
    const width = size.width as number; const height = size.height as number;
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      this.laidOutEpoch = epoch; this.reportMeasured(epoch);
    }
  }
  private reportMeasured(epoch: number): void {
    if (epoch !== this.epoch || this.laidOutEpoch !== epoch || this.errorLabel || !this.nativeSession?.allMeasured()) { return; }
    const surface = this.controller.getSurface(this.surfaceId);
    if (surface) { this.controller.reportRenderStatus(surface.id, surface.revision, 'rendered'); }
  }
  build() {
    Column() {
      if (this.errorLabel) {
        Text(this.errorLabel).fontSize(this.theme.dimensions.body).lineHeight(this.theme.dimensions.bodyLine)
          .fontColor(this.theme.palette.secondary).width('100%')
      } else if (this.visibleEpoch > 0) {
        ForEach([this.visibleEpoch], (epoch: number) => {
          AGenUIContainer({ surfaceId: this.surfaceId, instanceId: this.nativeInstance }).width('100%')
            .onSizeChange((_before: SizeOptions, after: SizeOptions): void => { this.laidOut(epoch, after); })
        }, (epoch: number): string => epoch.toString())
      } else {
        Text('Loading view…').fontSize(this.theme.dimensions.supporting).fontColor(this.theme.palette.secondary)
      }
    }.width('100%').padding(this.theme.dimensions.inset).backgroundColor(this.theme.palette.surface)
      .borderRadius(this.theme.dimensions.radius)
      .onSizeChange((_before: SizeOptions, after: SizeOptions): void => { this.viewportChanged(after); })
  }
}
