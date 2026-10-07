import { signal } from '@angular/core';
import { NavigationEnd, NavigationStart, type Router } from '@angular/router';
import type { WorkspaceDto } from '@mastercompanion/contracts';
import { decodeWorkspaceRoute, workspaceRouteUrl } from './workspace-route-codec';
import type { WorkspaceRouteResult, WorkspaceRouteState } from './workspace-route-state';
import type { WorkspaceRouteTarget } from './workspace-route-target';
import type { WorkspaceRouteContext } from './workspace-route-context';

type ApplyRoute = (
  target: WorkspaceRouteTarget,
  context: WorkspaceRouteContext,
) => WorkspaceRouteResult | Promise<WorkspaceRouteResult>;

/** Coordinates URL intent; the workspace retains ownership of sessions and mounted views. */
export class WorkspaceRouting {
  private readonly stateValue = signal<WorkspaceRouteState>({ kind: 'waiting' });
  readonly state = this.stateValue.asReadonly();
  private workspace: WorkspaceDto | null = null;
  private generation = 0;
  private destroyed = false;
  private latestUrl: string;
  private application: Promise<boolean> = Promise.resolve(false);
  private requestedFocus: { url: string; focusTab: boolean } | null = null;
  private readonly subscription;

  constructor(
    private readonly router: Pick<Router, 'url' | 'events' | 'navigateByUrl'>,
    private readonly apply: ApplyRoute,
  ) {
    this.latestUrl = router.url;
    this.subscription = router.events.subscribe((event) => {
      if (event instanceof NavigationStart) {
        this.generation++;
      }
      if (event instanceof NavigationEnd) {
        this.latestUrl = event.urlAfterRedirects;
        if (this.workspace) {
          const focusTab =
            this.requestedFocus?.url === this.latestUrl && this.requestedFocus.focusTab;
          this.application = this.applyUrl(this.latestUrl, Boolean(focusTab));
        }
      }
    });
  }

  initialize(workspace: WorkspaceDto): Promise<boolean> {
    this.workspace = workspace;
    this.application = this.applyUrl(this.latestUrl, false);
    return this.application;
  }

  updateWorkspace(workspace: WorkspaceDto): void {
    this.workspace = workspace;
  }

  async navigate(
    target: WorkspaceRouteTarget,
    options: { replace?: boolean; focusTab?: boolean } = {},
  ): Promise<boolean> {
    if (this.destroyed || !this.workspace) {
      return false;
    }
    const url = workspaceRouteUrl(target);
    if (this.router.url === url) {
      this.application = this.applyUrl(url, options.focusTab ?? false);
      return this.application;
    }
    // Cancel activation of an older read as soon as a newer user intent exists.
    this.generation++;
    const request = { url, focusTab: options.focusTab ?? false };
    this.requestedFocus = request;
    try {
      const navigated = await this.router.navigateByUrl(url, {
        replaceUrl: options.replace ?? false,
      });
      if (!navigated || this.destroyed || this.router.url !== url) {
        return false;
      }
      return await this.application;
    } catch {
      if (!this.destroyed && this.requestedFocus === request) {
        this.stateValue.set({ kind: 'error', code: 'navigationFailed', target });
      }
      return false;
    } finally {
      if (this.requestedFocus === request) {
        this.requestedFocus = null;
      }
    }
  }

  retry(): Promise<boolean> {
    const state = this.state();
    return state.kind === 'error' && state.target
      ? this.navigate(state.target)
      : this.applyUrl(this.latestUrl, false);
  }

  destroy(): void {
    this.destroyed = true;
    this.generation++;
    this.subscription.unsubscribe();
  }

  private async applyUrl(url: string, focusTab: boolean): Promise<boolean> {
    const workspace = this.workspace;
    if (this.destroyed || !workspace) {
      return false;
    }
    const generation = ++this.generation;
    const isCurrent = () => !this.destroyed && generation === this.generation;
    const decoded = decodeWorkspaceRoute(url, workspace);
    if (decoded.kind === 'default') {
      const target: WorkspaceRouteTarget = workspace.materials.length
        ? {
            kind: 'material',
            materialId:
              workspace.materials.find((material) => material.id === workspace.startMaterialId)
                ?.id ?? workspace.materials[0].id,
          }
        : { kind: 'empty' };
      return this.navigate(target, { replace: true });
    }
    if (decoded.kind === 'error') {
      this.stateValue.set({ kind: 'error', code: decoded.code, target: null });
      return false;
    }
    const target = decoded.target;
    this.stateValue.set({ kind: 'pending', target });
    try {
      const result = await this.apply(target, { isCurrent, focusTab });
      if (!isCurrent()) {
        return false;
      }
      this.stateValue.set(
        result.kind === 'ready'
          ? { kind: 'ready', target }
          : { kind: 'error', code: result.code, target },
      );
      return result.kind === 'ready';
    } catch {
      if (isCurrent()) {
        this.stateValue.set({ kind: 'error', code: 'navigationFailed', target });
      }
      return false;
    }
  }
}
