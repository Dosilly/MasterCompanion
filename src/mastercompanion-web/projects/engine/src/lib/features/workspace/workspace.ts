import {
  AfterRenderRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CAMPAIGN_MODULES, MaterialDto, WorkspaceDto } from '@mastercompanion/contracts';
import { WorkspaceTab } from './workspace-tab';
import { WorkspaceMaterials } from './workspace-materials';
import { MaterialView } from '../materials/material-view';
import { MaterialCreation } from '../materials/material-creation';
import { MaterialCreationDialog } from '../materials/material-creation-dialog';
import { MaterialSearch } from '../materials/material-search';
import { MaterialSearchView } from '../materials/material-search-view';
import { MapView } from '../maps/map-view';
import { buildNavigation, folderPath } from './navigation';
import { ThemePreference } from './theme-preference';
import { WorkspaceRouting } from './workspace-routing';
import type { WorkspaceRouteTarget } from './workspace-route-target';
import type { WorkspaceRouteContext } from './workspace-route-context';
import type { WorkspaceRouteResult } from './workspace-route-state';
import { GameSession } from '../gameplay/game-session';
import { GameView } from '../gameplay/game-view';
import { PartyView } from '../gameplay/party-view';
import { UiMessages, uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-workspace',
  imports: [
    WorkspaceTab,
    NgTemplateOutlet,
    MaterialView,
    MaterialCreationDialog,
    MaterialSearchView,
    MapView,
    GameView,
    PartyView,
  ],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss',
})
export class Workspace {
  private readonly http = inject(HttpClient);
  private readonly modules = inject(CAMPAIGN_MODULES);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  readonly theme = inject(ThemePreference);
  readonly ui = uiMessages;
  private readonly materials = new WorkspaceMaterials(this.http);
  readonly workspace = this.materials.workspace;
  readonly sessions = this.materials.sessions;
  readonly active = signal('');
  readonly routing = new WorkspaceRouting(inject(Router), (target, context) =>
    this.applyRoute(target, context),
  );
  readonly materialSearch = signal<MaterialSearch | null>(null);
  readonly loadError = signal<keyof UiMessages['workspace']['errors'] | null>(null);
  readonly materialLoadState = this.materials.loadState;
  readonly refreshing = signal(false);
  private loadRequest?: Promise<void>;
  readonly opening = computed(() => this.routing.state().kind === 'pending');
  private readonly openMaps = signal<readonly string[]>([]);
  private readonly mountedMaps = signal<readonly string[]>([]);
  readonly maps = computed(() =>
    this.openMaps().flatMap((id) => this.workspace()?.maps.filter((map) => map.id === id) ?? []),
  );
  readonly mapViews = computed(() =>
    this.mountedMaps().flatMap((id) => this.workspace()?.maps.filter((map) => map.id === id) ?? []),
  );
  private lastMapId: string | undefined;
  readonly routeError = computed(() => {
    const state = this.routing.state();
    return state.kind === 'error' ? state : null;
  });
  readonly gameOpen = signal(false);
  readonly gameMounted = signal(false);
  readonly partyOpen = signal(false);
  readonly partyMounted = signal(false);
  readonly partyView = viewChild(PartyView);
  readonly game = signal<GameSession | null>(null);
  readonly creation = signal<MaterialCreation | null>(null);
  private readonly creationDialog = viewChild(MaterialCreationDialog);
  readonly campaignModule = computed(() =>
    this.modules.find((module) => module.id === this.workspace()?.moduleId),
  );
  readonly gameTime = computed(() => {
    const minutes = this.game()?.state()?.snapshot.timeMinutes ?? 0;
    return `${Math.floor(minutes / 60)} ${this.ui.game.hour} ${minutes % 60} ${this.ui.game.minute}`;
  });
  readonly closing = signal(new Set<string>());
  readonly expanded = signal(new Set<string>());
  private readonly navigation = viewChild<ElementRef<HTMLElement>>('navigation');
  private readonly tabStrip = viewChild<ElementRef<HTMLElement>>('tabStrip');
  readonly views = viewChildren(MaterialView);
  readonly folders = computed(() =>
    buildNavigation(
      this.workspace()?.folders ?? [],
      this.workspace()?.materials ?? [],
      this.ui.workspace.unfiledMaterials,
    ),
  );
  private navigationRender?: AfterRenderRef;
  private finishNavigationRender?: (found: boolean) => void;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.navigationRender?.destroy();
      this.finishNavigationRender?.(false);
      this.routing.destroy();
      this.materials.destroy();
      this.game()?.destroy();
      this.creation()?.destroy();
      this.materialSearch()?.destroy();
    });
    effect(() => {
      for (const session of this.sessions()) {
        session.confirmedRevision();
      }
      untracked(() => this.materialSearch()?.refresh());
    });
    void this.load();
  }
  load(): Promise<void> {
    if (this.loadRequest) {
      return this.loadRequest;
    }
    this.refreshing.set(true);
    this.loadRequest = this.loadWorkspace().finally(() => {
      this.refreshing.set(false);
      this.loadRequest = undefined;
    });
    return this.loadRequest;
  }

  private async loadWorkspace(): Promise<void> {
    this.loadError.set(null);
    try {
      const workspace = await firstValueFrom(
        this.http.get<WorkspaceDto>('/api/workspace').pipe(takeUntilDestroyed(this.destroyRef)),
      );
      if (!this.modules.some((module) => module.id === workspace.moduleId)) {
        throw new Error('No frontend implementation is registered for the campaign module.');
      }
      await this.materials.initialize(workspace);
      if (this.destroyRef.destroyed) {
        return;
      }
      if (!this.materialSearch()) {
        this.materialSearch.set(new MaterialSearch(workspace.campaignId, this.http));
      } else {
        this.materialSearch()?.refresh();
      }
      if (this.game()?.campaignId !== workspace.campaignId) {
        this.game()?.destroy();
        let storage: Storage | null = null;
        try {
          storage = window.sessionStorage;
        } catch {
          /* A blocked store is reported when an operation is attempted. */
        }
        const game = new GameSession(workspace.campaignId, this.http, storage);
        this.game.set(game);
        void game.load();
      }
      if (this.creation()?.campaignId !== workspace.campaignId) {
        this.creation()?.destroy();
        let storage: Storage | null = null;
        try {
          storage = window.sessionStorage;
        } catch {
          /* Creation reports inaccessible recovery storage before sending. */
        }
        this.creation.set(new MaterialCreation(workspace.campaignId, this.http, storage));
      }
      await this.routing.initialize(this.workspace() ?? workspace);
    } catch {
      if (!this.destroyRef.destroyed && this.materialLoadState() !== 'error') {
        this.loadError.set('campaignLoadFailed');
      }
    }
  }
  async open(id: string, anchor?: string) {
    return this.routing.navigate({ kind: 'material', materialId: id, anchor });
  }

  async openSearchResult(id: string): Promise<void> {
    const search = this.materialSearch();
    const state = search?.state();
    if (state?.kind !== 'ready' || !state.results.some((result) => result.id === id)) {
      return;
    }
    const query = search?.query();
    if ((await this.open(id)) && this.materialSearch() === search && search?.query() === query) {
      search?.updateQuery('');
      this.navigationRender = afterNextRender(
        () => {
          const state = this.routing.state();
          if (
            state.kind === 'ready' &&
            state.target.kind === 'material' &&
            state.target.materialId === id
          ) {
            this.revealNavigationSelection(true);
          }
        },
        { injector: this.injector },
      );
    }
  }

  private async applyRoute(
    target: WorkspaceRouteTarget,
    context: WorkspaceRouteContext,
  ): Promise<WorkspaceRouteResult> {
    if (target.kind === 'material') {
      const searchState = this.materialSearch()?.state();
      const knownMaterial = this.workspace()?.materials.some(
        (material) => material.id === target.materialId,
      );
      const campaignSearchMatch =
        searchState?.kind === 'ready' &&
        searchState.results.some((material) => material.id === target.materialId);
      if (!knownMaterial && !campaignSearchMatch) {
        return { kind: 'error', code: 'materialNotFound' };
      }
      try {
        await this.materials.open(target.materialId);
      } catch (error) {
        return {
          kind: 'error',
          code:
            error instanceof HttpErrorResponse && error.status === 404
              ? 'materialNotFound'
              : 'materialLoadFailed',
        };
      }
      if (!context.isCurrent()) {
        return { kind: 'ready' };
      }
      const workspace = this.workspace();
      if (workspace) {
        this.routing.updateWorkspace(workspace);
      }
      const found = await this.display(target.materialId, target.anchor, context);
      return found ? { kind: 'ready' } : { kind: 'error', code: 'sectionNotFound' };
    }
    if (!context.isCurrent()) {
      return { kind: 'ready' };
    }
    switch (target.kind) {
      case 'map':
        this.lastMapId = target.mapId;
        this.openMaps.update((ids) => (ids.includes(target.mapId) ? ids : [...ids, target.mapId]));
        this.mountedMaps.update((ids) =>
          ids.includes(target.mapId) ? ids : [...ids, target.mapId],
        );
        await this.display(`@map:${target.mapId}`, undefined, context);
        break;
      case 'game':
        this.gameMounted.set(true);
        this.gameOpen.set(true);
        await this.display('@game', undefined, context);
        break;
      case 'party':
        this.partyMounted.set(true);
        this.partyOpen.set(true);
        await this.display('@party', undefined, context);
        break;
      case 'empty':
        await this.display('', undefined, context);
        break;
    }
    return { kind: 'ready' };
  }

  openMaterialWithoutSection(): void {
    const target = this.routeError()?.target;
    if (target?.kind === 'material') {
      void this.routing.navigate(
        { kind: 'material', materialId: target.materialId },
        { replace: true },
      );
    }
  }

  openCreation(event: Event) {
    const folderId =
      this.workspace()?.materials.find((material) => material.id === this.active())?.folderId ??
      null;
    this.creationDialog()?.open(event, folderId);
  }
  acceptCreatedMaterial(material: MaterialDto): void {
    this.materials.acceptCreatedMaterial(material);
    this.materialSearch()?.updateQuery('');
    const workspace = this.workspace();
    if (workspace) {
      this.routing.updateWorkspace(workspace);
    }
    void this.open(material.id);
  }

  openMap() {
    const id = this.lastMapId ?? this.workspace()?.maps[0]?.id;
    if (id) {
      void this.routing.navigate({ kind: 'map', mapId: id });
    }
  }
  openGame() {
    void this.routing.navigate({ kind: 'game' });
  }
  openParty() {
    void this.routing.navigate({ kind: 'party' });
  }

  activate(id: string, anchor?: string, focusTab = false) {
    return this.routing.navigate(this.targetForTab(id, anchor), { focusTab });
  }

  private targetForTab(id: string, anchor?: string): WorkspaceRouteTarget {
    if (id.startsWith('@map:')) {
      return { kind: 'map', mapId: id.slice('@map:'.length) };
    }
    if (id === '@game') {
      return { kind: 'game' };
    }
    if (id === '@party') {
      return { kind: 'party' };
    }
    return id ? { kind: 'material', materialId: id, anchor } : { kind: 'empty' };
  }

  private display(
    id: string,
    anchor: string | undefined,
    context: WorkspaceRouteContext,
  ): Promise<boolean> {
    this.active.set(id);
    const material = this.workspace()?.materials.find((material) => material.id === id);
    if (material) {
      this.expanded.update(
        (current) =>
          new Set([
            ...current,
            ...folderPath(this.workspace()?.folders ?? [], material.folderId),
            ...(material.folderId ? [] : ['@unfiled']),
          ]),
      );
    }
    this.navigationRender?.destroy();
    this.finishNavigationRender?.(false);
    const rendered = new Promise<boolean>((resolve) => {
      this.finishNavigationRender = resolve;
    });
    this.navigationRender = afterNextRender(
      () => {
        if (!context.isCurrent()) {
          this.finishNavigationRender?.(false);
          this.finishNavigationRender = undefined;
          return;
        }
        this.revealNavigationSelection(!context.focusTab);
        const strip = this.tabStrip()?.nativeElement;
        const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
        if (strip && tab) {
          if (context.focusTab) {
            tab.focus({ preventScroll: true });
          }
          const tabBounds = tab.getBoundingClientRect();
          const stripBounds = strip.getBoundingClientRect();
          strip.scrollTo({
            left:
              strip.scrollLeft +
              tabBounds.left -
              stripBounds.left -
              (strip.clientWidth - tabBounds.width) / 2,
          });
        }
        const found = anchor
          ? (this.views()
              .find((view) => view.session().material.id === id)
              ?.scrollToAnchor(anchor) ?? false)
          : true;
        this.finishNavigationRender?.(found);
        this.finishNavigationRender = undefined;
      },
      { injector: this.injector },
    );
    return rendered;
  }

  private revealNavigationSelection(focus: boolean): void {
    const nav = this.navigation()?.nativeElement;
    const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !selected) {
      return;
    }
    if (focus) {
      selected.focus({ preventScroll: true });
    }
    const itemBounds = selected.getBoundingClientRect();
    const navBounds = nav.getBoundingClientRect();
    nav.scrollTo({
      top:
        nav.scrollTop + itemBounds.top - navBounds.top - (nav.clientHeight - itemBounds.height) / 2,
    });
  }

  toggleFolder(id: string, event: Event) {
    if (!(event.target instanceof HTMLDetailsElement)) {
      return;
    }
    const open = event.target.open;
    this.expanded.update((current) => {
      const next = new Set(current);
      if (open) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  tabKey(event: KeyboardEvent) {
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') {
      return;
    }
    const tabs = Array.from(
      this.tabStrip()?.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]') ?? [],
    );
    const index = tabs.indexOf(event.target);
    if (index < 0) {
      return;
    }
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (index + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        next = (index + tabs.length - 1) % tabs.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    const id = tabs[next]?.getAttribute('data-tab-id');
    if (id) {
      event.preventDefault();
      this.activate(id, undefined, true);
    }
  }

  async close(id: string) {
    if (this.closing().has(id)) {
      return;
    }
    const session = this.sessions().find((tab) => tab.material.id === id);
    if (session) {
      this.closing.update((current) => new Set([...current, id]));
      const saved = await session.prepareToClose();
      this.closing.update((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
      if (!saved || session.dirty()) {
        return;
      }
    }
    const tabIds = [
      ...(this.partyOpen() ? ['@party'] : []),
      ...(this.gameOpen() ? ['@game'] : []),
      ...this.openMaps().map((mapId) => `@map:${mapId}`),
      ...this.sessions().map((tab) => tab.material.id),
    ];
    const index = tabIds.indexOf(id);
    if (index < 0) {
      return;
    }
    if (id.startsWith('@map:')) {
      this.openMaps.update((ids) => ids.filter((mapId) => `@map:${mapId}` !== id));
    } else if (id === '@game') {
      this.gameOpen.set(false);
    } else if (id === '@party') {
      this.partyOpen.set(false);
    } else {
      this.materials.removeConfirmedSession(id);
    }
    if (this.active() === id) {
      await this.routing.navigate(this.targetForTab(tabIds[index + 1] ?? tabIds[index - 1] ?? ''), {
        replace: true,
      });
    }
  }
  @HostListener('window:beforeunload', ['$event'])
  protectPendingChanges(event: BeforeUnloadEvent) {
    if (
      this.sessions().some((tab) => tab.dirty()) ||
      this.partyView()?.dirty() ||
      (!this.creation()?.hasRecovery() && this.creation()?.title().trim())
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
