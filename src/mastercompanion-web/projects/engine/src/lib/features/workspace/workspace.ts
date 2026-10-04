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
import { HttpClient } from '@angular/common/http';
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
  readonly active = signal('@map');
  readonly materialSearch = signal<MaterialSearch | null>(null);
  readonly loadError = signal<keyof UiMessages['workspace']['errors'] | null>(null);
  readonly opening = signal(false);
  readonly mapOpen = signal(true);
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

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.navigationRender?.destroy();
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
  async load() {
    this.loadError.set(null);
    try {
      const workspace = await firstValueFrom(this.http.get<WorkspaceDto>('/api/workspace'));
      if (!this.modules.some((module) => module.id === workspace.moduleId)) {
        throw new Error('No frontend implementation is registered for the campaign module.');
      }
      this.materials.initialize(workspace);
      this.materialSearch()?.destroy();
      this.materialSearch.set(new MaterialSearch(workspace.campaignId, this.http));
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
      // Begin in the reader. The map remains available in the same main area.
      if (!this.sessions().length && workspace.materials.length) {
        await this.open(workspace.startMaterialId);
      }
    } catch {
      this.loadError.set('campaignLoadFailed');
    }
  }
  async open(id: string, anchor?: string) {
    if (!this.workspace()?.materials.some((material) => material.id === id)) {
      this.loadError.set('materialNotFound');
      return;
    }
    await this.loadAndActivateMaterial(id, anchor);
  }

  async openSearchResult(id: string): Promise<void> {
    const search = this.materialSearch();
    const state = search?.state();
    if (state?.kind !== 'ready' || !state.results.some((result) => result.id === id)) {
      return;
    }
    const query = search?.query();
    if (
      (await this.loadAndActivateMaterial(id)) &&
      this.materialSearch() === search &&
      search?.query() === query
    ) {
      search?.updateQuery('');
    }
  }

  private async loadAndActivateMaterial(id: string, anchor?: string): Promise<boolean> {
    this.opening.set(true);
    this.loadError.set(null);
    try {
      await this.materials.open(id);
      this.activate(id, anchor);
      return true;
    } catch {
      this.loadError.set('materialLoadFailed');
      return false;
    } finally {
      this.opening.set(false);
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
    this.activate(material.id);
  }

  openMap() {
    this.mapOpen.set(true);
    this.activate('@map');
  }
  openGame() {
    this.gameMounted.set(true);
    this.gameOpen.set(true);
    this.activate('@game');
  }
  openParty() {
    this.partyMounted.set(true);
    this.partyOpen.set(true);
    this.activate('@party');
  }

  activate(id: string, anchor?: string, focusTab = false) {
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
    this.navigationRender = afterNextRender(
      () => {
        const nav = this.navigation()?.nativeElement;
        const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
        if (nav && selected) {
          if (!focusTab) {
            selected.focus({ preventScroll: true });
          }
          const itemBounds = selected.getBoundingClientRect();
          const navBounds = nav.getBoundingClientRect();
          nav.scrollTo({
            top:
              nav.scrollTop +
              itemBounds.top -
              navBounds.top -
              (nav.clientHeight - itemBounds.height) / 2,
          });
        }
        const strip = this.tabStrip()?.nativeElement;
        const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
        if (strip && tab) {
          if (focusTab) {
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
        if (anchor) {
          this.views()
            .find((view) => view.session().material.id === id)
            ?.scrollToAnchor(anchor);
        }
      },
      { injector: this.injector },
    );
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
        this.activate(id);
        return;
      }
    }
    const tabIds = [
      ...(this.partyOpen() ? ['@party'] : []),
      ...(this.gameOpen() ? ['@game'] : []),
      ...(this.mapOpen() ? ['@map'] : []),
      ...this.sessions().map((tab) => tab.material.id),
    ];
    const index = tabIds.indexOf(id);
    if (index < 0) {
      return;
    }
    if (id === '@map') {
      this.mapOpen.set(false);
    } else if (id === '@game') {
      this.gameOpen.set(false);
    } else if (id === '@party') {
      this.partyOpen.set(false);
    } else {
      this.materials.removeConfirmedSession(id);
    }
    if (this.active() === id) {
      this.activate(tabIds[index + 1] ?? tabIds[index - 1] ?? '');
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
