import { IconComponent } from '@mastercompanion/ui';
import {
  AfterRenderRef,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  Injector,
  afterNextRender,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  CAMPAIGN_MODULES,
  CampaignFolder,
  MaterialDto,
  WorkspaceDto,
} from '@mastercompanion/contracts';
import { NavigationLayout } from './navigation-layout';
import { OpenTabs } from './open-tabs';
import type { OpenTabItem } from './open-tab-item';
import { WorkspaceTab } from './workspace-tab';
import { WorkspaceMaterials } from './workspace-materials';
import { MaterialViewHost } from '../materials/material-view-host';
import { MaterialViewRegistry } from '../materials/material-view-registry';
import { MaterialDeletion } from '../materials/material-deletion';
import { MaterialDeletionDialog } from '../materials/material-deletion-dialog';
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
import { FolderManagement } from '../folders/folder-management';
import { FolderManagementDialog } from '../folders/folder-management-dialog';
import { FolderDrag } from '../folders/folder-drag';
import { MaterialDrag } from '../folders/material-drag';
import { MaterialOrderDialog } from '../folders/material-order-dialog';
import { MaterialMoveDialog } from '../folders/material-move-dialog';
import { WorkspaceContextMenuComponent } from '../context-menu/workspace-context-menu';
import type { WorkspaceContextMenuAction } from '../context-menu/workspace-context-menu-action';
import { WorkspaceContextMenuState } from '../context-menu/workspace-context-menu-state';
import { MeetingRecords } from '../sessions/meeting-records';
import { SessionDrafts } from '../sessions/session-drafts';
import { SessionView } from '../sessions/session-view';

@Component({
  selector: 'mc-workspace',
  imports: [
    IconComponent,
    WorkspaceTab,
    OpenTabs,
    NgTemplateOutlet,
    MaterialViewHost,
    MaterialCreationDialog,
    MaterialDeletionDialog,
    MaterialSearchView,
    MapView,
    GameView,
    PartyView,
    FolderManagementDialog,
    MaterialOrderDialog,
    MaterialMoveDialog,
    WorkspaceContextMenuComponent,
    SessionView,
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
  private readonly materialTabIds = signal<ReadonlySet<string>>(new Set());
  readonly materialTabs = computed(() =>
    this.sessions().filter((session) => this.materialTabIds().has(session.material.id)),
  );
  private readonly standaloneMaterialHost = viewChild(MaterialViewHost);
  private readonly materialViews = new MaterialViewRegistry(
    (request) => {
      void this.open(request.id, request.anchor);
    },
    (id, event) => this.openDeletion(id, event),
  );
  readonly meetingContentLoading = signal(false);
  readonly meetingContentError = signal(false);
  private contentRequest = 0;
  private readonly meetingDocumentIds = signal<ReadonlySet<string>>(new Set());
  readonly meetingCloseFailure = signal<string | null>(null);
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
  readonly meetingsOpen = signal(false);
  readonly meetingsMounted = signal(false);
  readonly meetings = signal<MeetingRecords | null>(null);
  readonly meetingsSelection = signal('');
  readonly meetingDrafts = new SessionDrafts();
  private readonly meetingView = viewChild(SessionView);
  readonly meetingDocument = computed(() => {
    for (const record of this.meetings()?.snapshot().sessions ?? []) {
      if (record.preparationMaterialId === this.active()) {
        return { id: record.id, title: record.title, role: this.ui.meetings.preparation };
      }
      if (record.notesMaterialId === this.active()) {
        return { id: record.id, title: record.title, role: this.ui.meetings.notes };
      }
    }
    return null;
  });
  readonly partyView = viewChild(PartyView);
  readonly game = signal<GameSession | null>(null);
  readonly deletion = signal<MaterialDeletion | null>(null);
  private readonly deletionDialog = viewChild(MaterialDeletionDialog);
  readonly creation = signal<MaterialCreation | null>(null);
  readonly folderManagement = signal<FolderManagement | null>(null);
  readonly folderDrag = new FolderDrag();
  readonly materialDrag = new MaterialDrag();
  private readonly materialOrderDialog = viewChild(MaterialOrderDialog);
  private readonly materialMoveDialog = viewChild(MaterialMoveDialog);
  private readonly folderDialog = viewChild(FolderManagementDialog);
  readonly menus = new WorkspaceContextMenuState(
    () => this.folderManagement()?.locked() ?? true,
    (id) => this.closing().has(id),
    (id) => this.deletion()?.lockedFor(id) ?? false,
  );
  private readonly creationDialog = viewChild(MaterialCreationDialog);
  readonly campaignModule = computed(() =>
    this.modules.find((module) => module.id === this.workspace()?.moduleId),
  );
  readonly gameTime = computed(() => {
    const minutes = this.game()?.state()?.snapshot.timeMinutes ?? 0;
    return `${Math.floor(minutes / 60)} ${this.ui.game.hour} ${minutes % 60} ${this.ui.game.minute}`;
  });
  readonly navigationLayout = new NavigationLayout();
  readonly openTabItems = computed<readonly OpenTabItem[]>(() => [
    ...(this.meetingsOpen()
      ? [
          {
            id: '@sessions',
            title: this.ui.meetings.title,
            context: '',
            dirty: this.meetingDirty(),
            closing: this.closing().has('@sessions'),
          },
        ]
      : []),
    ...(this.partyOpen()
      ? [
          {
            id: '@party',
            title: this.ui.game.partyTitle,
            context: '',
            dirty: this.partyView()?.dirty() ?? false,
            closing: false,
          },
        ]
      : []),
    ...(this.gameOpen()
      ? [{ id: '@game', title: this.ui.game.title, context: '', dirty: false, closing: false }]
      : []),
    ...this.maps().map((map) => ({
      id: '@map:' + map.id,
      title: map.title,
      context: '',
      dirty: false,
      closing: false,
    })),
    ...this.materialTabs().map((tab) => ({
      id: tab.material.id,
      title: tab.material.title,
      context:
        folderPath(this.workspace()?.folders ?? [], tab.material.folderId)
          .map((id) => this.workspace()?.folders.find((folder) => folder.id === id)?.title ?? '')
          .join(' / ') || this.ui.workspace.unfiledMaterials,
      dirty: tab.dirty(),
      closing: this.closing().has(tab.material.id),
    })),
  ]);
  readonly activeTab = computed(() =>
    this.openTabItems().find((item) => item.id === this.active()),
  );
  readonly closing = signal(new Set<string>());
  readonly expanded = signal(new Set<string>());
  private readonly searchView = viewChild(MaterialSearchView);
  private readonly navigation = viewChild<ElementRef<HTMLElement>>('navigation');
  private readonly tabStrip = viewChild<ElementRef<HTMLElement>>('tabStrip');
  readonly meetingDirty = computed(
    () =>
      this.meetingDrafts.dirty() ||
      this.meetingView()?.hasRenameDraft() ||
      this.sessions().some(
        (session) => this.meetingDocumentIds().has(session.material.id) && session.dirty(),
      ),
  );
  readonly folders = computed(() =>
    buildNavigation(
      this.workspace()?.folders ?? [],
      this.workspace()?.materials ?? [],
      this.ui.workspace.unfiledMaterials,
    ),
  );
  private navigationRender?: AfterRenderRef;
  private folderNavigationRender?: AfterRenderRef;
  private finishNavigationRender?: (found: boolean) => void;

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.navigationRender?.destroy();
      this.folderNavigationRender?.destroy();
      this.finishNavigationRender?.(false);
      this.routing.destroy();
      this.materialViews.destroy();
      this.materials.destroy();
      this.game()?.destroy();
      this.creation()?.destroy();
      this.deletion()?.destroy();
      this.folderManagement()?.destroy();
      this.materialSearch()?.destroy();
      this.meetings()?.destroy();
    });
    effect(() => {
      for (const session of this.sessions()) {
        session.confirmedRevision();
      }
      untracked(() => this.materialSearch()?.refresh());
    });
    effect(() => {
      const records = this.meetings()?.snapshot().sessions ?? [];
      untracked(() => this.meetingDrafts.acceptConfirmed(records));
    });
    effect(() => {
      const id = this.meetingView()?.documentId();
      if (id) {
        untracked(() => {
          void this.loadMeetingDocument(id);
        });
      } else {
        untracked(() => {
          this.contentRequest++;
          this.meetingContentLoading.set(false);
          this.meetingContentError.set(false);
        });
      }
    });
    afterRenderEffect(() => {
      const standalone = this.standaloneMaterialHost()?.container;
      const embedded = this.meetingView()?.documentHost().container;
      const sessions = this.sessions();
      const activeId = this.active();
      const embeddedId =
        activeId === '@sessions' ? (this.meetingView()?.documentId() ?? null) : null;
      const workspace = this.workspace();
      const deletionLockedIds = new Set(
        sessions
          .filter((session) => this.deletion()?.lockedFor(session.material.id))
          .map((session) => session.material.id),
      );
      if (standalone && workspace) {
        untracked(() =>
          this.materialViews.synchronize(
            sessions,
            standalone,
            embedded,
            activeId,
            embeddedId,
            workspace.materials,
            workspace.folders,
            deletionLockedIds,
          ),
        );
      }
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
      if (!this.deletion()) {
        this.deletion.set(new MaterialDeletion(workspace.campaignId, this.http));
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
      if (this.meetings()?.campaignId !== workspace.campaignId) {
        this.meetings()?.destroy();
        let storage: Storage | null = null;
        try {
          storage = window.sessionStorage;
        } catch {
          /* Session writes report inaccessible recovery storage before sending. */
        }
        const meetings = new MeetingRecords(workspace.campaignId, this.http, storage);
        this.meetings.set(meetings);
        void meetings.refresh();
      } else if (this.meetings()?.loaded()) {
        void this.meetings()?.refresh();
      }
      if (this.folderManagement()?.campaignId !== workspace.campaignId) {
        this.folderManagement()?.destroy();
        let storage: Storage | null = null;
        try {
          storage = window.sessionStorage;
        } catch {
          /* Folder operations report inaccessible recovery storage before sending. */
        }
        this.folderManagement.set(
          new FolderManagement(workspace.campaignId, this.http, storage, (snapshot) => {
            const previous = this.workspace()?.folders ?? [];
            const moved =
              previous.length !== snapshot.folders.length ||
              snapshot.folders.some(
                (folder, index) =>
                  folder.id !== previous[index]?.id ||
                  folder.parentId !== previous[index]?.parentId,
              );
            this.materials.acceptFolders(snapshot);
            const material = this.workspace()?.materials.find((item) => item.id === this.active());
            if (material) {
              this.expanded.update(
                (current) =>
                  new Set([...current, ...folderPath(snapshot.folders, material.folderId)]),
              );
              if (moved) {
                this.folderNavigationRender?.destroy();
                this.folderNavigationRender = afterNextRender(
                  () => this.revealNavigationSelection(false),
                  { injector: this.injector },
                );
              }
            }
          }),
        );
      }
      this.folderManagement()?.accept({
        revision: workspace.foldersRevision,
        folders: workspace.folders,
        materialOrder: workspace.materials.map(({ id, folderId }) => ({ id, folderId })),
      });
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
      const recoverableDraft = this.sessions().some(
        (session) => session.material.id === target.materialId && session.dirty(),
      );
      if (!knownMaterial && !campaignSearchMatch && !recoverableDraft) {
        return { kind: 'error', code: 'materialNotFound' };
      }
      try {
        await this.materials.open(target.materialId);
        this.materialTabIds.update((ids) => new Set([...ids, target.materialId]));
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
      case 'sessions':
        this.meetingsMounted.set(true);
        this.meetingsOpen.set(true);
        if (!this.meetings()?.loaded()) {
          await this.meetings()?.refresh();
        }
        if (!context.isCurrent()) {
          return { kind: 'ready' };
        }
        this.meetingsSelection.set(target.sessionId ?? '');
        await this.display('@sessions', undefined, context);
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

  async contextAction(action: WorkspaceContextMenuAction): Promise<void> {
    const target = this.menus.takeTarget();
    if (!target) {
      return;
    }
    const folder = this.workspace()?.folders.find((item) => item.id === target.id);
    switch (action) {
      case 'delete-material':
        this.openDeletion(target.id, target.trigger);
        break;
      case 'new-note':
        this.creationDialog()?.open(target.trigger, folder?.id ?? null, true);
        break;
      case 'rename':
      case 'move':
        if (folder) {
          this.folderDialog()?.open(action, folder, target.trigger);
        }
        break;
      case 'reorder': {
        const material = this.workspace()?.materials.find((item) => item.id === target.id);
        if (material) {
          this.materialOrderDialog()?.open(material, target.trigger);
        }
        break;
      }
      case 'move-material': {
        const material = this.workspace()?.materials.find((item) => item.id === target.id);
        if (material) {
          this.materialMoveDialog()?.open(material, target.trigger);
        }
        break;
      }
      case 'reveal':
        this.materialSearch()?.updateQuery('');
        await this.open(target.id);
        break;
      case 'copy-link':
        await this.menus.copyMaterialLink(target.id);
        break;
      case 'close':
        await this.close(target.id);
        break;
      case 'close-others':
        await this.closeOtherTabs(target.id);
        break;
    }
  }

  openDeletion(id: string, event: Event | HTMLElement): void {
    const trigger = event instanceof HTMLElement ? event : event.currentTarget;
    if (
      !(trigger instanceof HTMLElement) ||
      !this.deletion() ||
      this.closing().has(id) ||
      this.deletion()?.lockedFor(id)
    ) {
      return;
    }
    this.deletionDialog()?.open(trigger);
    void this.deletion()?.inspect(
      id,
      this.sessions().find((session) => session.material.id === id) ?? null,
    );
  }

  async acceptDeletedMaterial(id: string): Promise<void> {
    const tabs = this.openTabItems().map((tab) => tab.id);
    const index = tabs.indexOf(id);
    this.materials.acceptDeletion(id);
    this.materialTabIds.update((ids) => {
      const remaining = new Set(ids);
      remaining.delete(id);
      return remaining;
    });
    const workspace = this.workspace();
    if (workspace) {
      this.routing.updateWorkspace(workspace);
    }
    this.materialSearch()?.refresh();
    void this.folderManagement()?.refresh();
    void this.meetings()?.refresh();
    if (this.active() === id) {
      await this.routing.navigate(this.targetForTab(tabs[index + 1] ?? tabs[index - 1] ?? ''), {
        replace: true,
      });
    }
  }

  private async closeOtherTabs(keepId: string): Promise<void> {
    const ids = [
      ...(this.meetingsOpen() ? ['@sessions'] : []),
      ...(this.partyOpen() ? ['@party'] : []),
      ...(this.gameOpen() ? ['@game'] : []),
      ...this.maps().map((map) => `@map:${map.id}`),
      ...this.materialTabs().map((session) => session.material.id),
    ];
    for (const id of ids) {
      if (id !== keepId) {
        await this.close(id);
      }
    }
  }

  dropFolder(event: DragEvent, folder: CampaignFolder | null): void {
    this.overFolder(event, folder);
    if (this.materialDrag.dragging()) {
      this.commitMaterialDrop(event);
      return;
    }
    const operation = this.folderDrag.drop(event);
    if (operation) {
      void this.folderManagement()?.execute(operation);
    }
  }
  overFolder(event: DragEvent, folder: CampaignFolder | null): void {
    const management = this.folderManagement();
    if (!management || management.locked()) {
      return;
    }
    if (this.materialDrag.dragging()) {
      this.materialDrag.overFolder(
        event,
        management.snapshot(),
        folder?.id === '@unfiled' ? null : (folder?.id ?? null),
      );
    } else if (folder?.id !== '@unfiled') {
      this.folderDrag.over(event, management.snapshot().folders, folder);
    }
  }

  overMaterial(event: DragEvent, id: string): void {
    const management = this.folderManagement();
    if (management && !management.locked()) {
      this.materialDrag.over(event, management.snapshot(), id);
    }
  }
  dropMaterial(event: DragEvent, id: string): void {
    this.overMaterial(event, id);
    this.commitMaterialDrop(event);
  }

  private commitMaterialDrop(event: DragEvent): void {
    const operation = this.materialDrag.drop(event);
    if (operation) {
      void this.folderManagement()
        ?.execute(operation)
        .then((confirmed) => {
          if (confirmed && operation.kind === 'moveMaterial') {
            this.revealMovedMaterial(operation.materialId);
          }
        });
    }
  }

  revealMovedMaterial(id: string): void {
    const material = this.workspace()?.materials.find((item) => item.id === id);
    if (!material) {
      return;
    }
    this.expanded.update(
      (current) =>
        new Set([
          ...current,
          ...folderPath(this.workspace()?.folders ?? [], material.folderId),
          ...(material.folderId ? [] : ['@unfiled']),
        ]),
    );
    this.folderNavigationRender?.destroy();
    this.folderNavigationRender = afterNextRender(
      () => {
        const selected = Array.from(
          this.navigation()?.nativeElement.querySelectorAll<HTMLElement>('[data-material-id]') ??
            [],
        ).find((item) => item.dataset['materialId'] === id);
        selected?.scrollIntoView({ block: 'nearest' });
        selected?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }
  acceptCreatedMaterial(material: MaterialDto): void {
    this.materials.acceptCreatedMaterial(material);
    void this.folderManagement()?.refresh();
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
  openMeetings(sessionId?: string): void {
    void this.routing.navigate({ kind: 'sessions', ...(sessionId ? { sessionId } : {}) });
  }
  async loadMeetingDocument(id = this.meetingView()?.documentId()): Promise<void> {
    if (!id) {
      return;
    }
    this.meetingDocumentIds.update((ids) => new Set([...ids, id]));
    const request = ++this.contentRequest;
    this.meetingContentLoading.set(true);
    this.meetingContentError.set(false);
    try {
      await this.materials.open(id);
    } catch {
      if (request === this.contentRequest && !this.destroyRef.destroyed) {
        this.meetingContentError.set(true);
      }
    } finally {
      if (request === this.contentRequest && !this.destroyRef.destroyed) {
        this.meetingContentLoading.set(false);
      }
    }
  }

  async openMeetingMaterial(id: string): Promise<void> {
    if (!this.workspace()?.materials.some((item) => item.id === id)) {
      await this.load();
    }
    await this.open(id);
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
    if (id === '@sessions') {
      return {
        kind: 'sessions',
        ...(this.meetingsSelection() ? { sessionId: this.meetingsSelection() } : {}),
      };
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
          ? (this.materialViews.find(id)?.scrollToAnchor(anchor) ?? false)
          : true;
        this.finishNavigationRender?.(found);
        this.finishNavigationRender = undefined;
      },
      { injector: this.injector },
    );
    return rendered;
  }

  private revealNavigationSelection(focus: boolean): void {
    if (this.navigationLayout.collapsed()) {
      return;
    }
    if (this.materialSearch()?.state().kind !== 'idle') {
      this.searchView()?.revealSelected(focus);
      return;
    }
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
    if (id === '@sessions' && !(await this.prepareMeetingsToClose())) {
      return;
    }
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
      ...(this.meetingsOpen() ? ['@sessions'] : []),
      ...(this.partyOpen() ? ['@party'] : []),
      ...(this.gameOpen() ? ['@game'] : []),
      ...this.openMaps().map((mapId) => `@map:${mapId}`),
      ...this.materialTabs().map((tab) => tab.material.id),
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
    } else if (id === '@sessions') {
      this.meetingsOpen.set(false);
    } else {
      this.materialTabIds.update((ids) => {
        const remaining = new Set(ids);
        remaining.delete(id);
        return remaining;
      });
      const sessionDocument = this.meetings()
        ?.snapshot()
        .sessions.some(
          (record) => record.preparationMaterialId === id || record.notesMaterialId === id,
        );
      if (!sessionDocument) {
        this.materials.removeConfirmedSession(id);
      }
    }
    if (this.active() === id) {
      await this.routing.navigate(this.targetForTab(tabIds[index + 1] ?? tabIds[index - 1] ?? ''), {
        replace: true,
      });
    }
  }
  private async prepareMeetingsToClose(): Promise<boolean> {
    this.closing.update((ids) => new Set([...ids, '@sessions']));
    this.meetingCloseFailure.set(null);
    try {
      do {
        const meetings = this.meetings();
        if (
          !meetings ||
          meetings.request() ||
          meetings.pending() ||
          !(await this.meetingView()?.prepareToClose())
        ) {
          return false;
        }
        for (const document of this.sessions().filter((item) =>
          this.meetingDocumentIds().has(item.material.id),
        )) {
          if (!(await document.prepareToClose())) {
            this.meetingCloseFailure.set(document.material.id);
            return false;
          }
        }
      } while (
        this.meetingDrafts.dirty() ||
        this.sessions().some(
          (item) => this.meetingDocumentIds().has(item.material.id) && item.dirty(),
        )
      );
      return true;
    } finally {
      this.closing.update((ids) => {
        const remaining = new Set(ids);
        remaining.delete('@sessions');
        return remaining;
      });
    }
  }

  @HostListener('window:beforeunload', ['$event'])
  protectPendingChanges(event: BeforeUnloadEvent) {
    if (
      this.deletion()?.pending() ||
      this.deletion()?.retryAvailable() ||
      this.sessions().some((tab) => tab.dirty()) ||
      this.partyView()?.dirty() ||
      this.meetingDrafts.dirty() ||
      this.meetingView()?.hasRenameDraft() ||
      (!this.meetings()?.request() && this.meetingView()?.hasCreationDraft()) ||
      (!this.creation()?.hasRecovery() && this.creation()?.title().trim())
    ) {
      event.preventDefault();
      event.returnValue = '';
    }
  }
}
