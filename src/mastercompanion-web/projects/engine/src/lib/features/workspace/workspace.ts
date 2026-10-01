import { AfterRenderRef, Component, DestroyRef, ElementRef, HostListener, Injector, afterNextRender, computed, inject, signal, viewChild, viewChildren } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { CAMPAIGN_MODULES, MaterialDto, WorkspaceDto } from '@mastercompanion/contracts';
import { MaterialSession } from '../materials/material-session';
import { MaterialView } from '../materials/material-view';
import { MapView } from '../maps/map-view';
import { buildNavigation, folderPath } from './navigation';
import { ThemePreference } from './theme-preference';
import { GameSession } from '../gameplay/game-session';
import { GameView } from '../gameplay/game-view';
import { UiMessages, uiLocale, uiMessages } from '../../i18n/messages';

@Component({
  selector: 'mc-workspace', imports: [NgTemplateOutlet, MaterialView, MapView, GameView],
  template: `
    <header class="app-header"><div><strong>MasterCompanion</strong><span class="campaign-name"> / {{ workspace()?.title }}</span></div>
      <div class="header-actions">
        @if (game(); as session) { <button (click)="openGame()" [attr.aria-pressed]="active() === '@game'">{{ ui.game.title }}{{ session.state() ? ' · ' + gameTime() : '' }}</button> }
        @if (workspace()?.maps?.length) { <button (click)="openMap()" [attr.aria-pressed]="active() === '@map'">{{ ui.workspace.map }}</button> }
        <button (click)="theme.toggle()" [attr.aria-pressed]="theme.dark()" [attr.aria-label]="ui.workspace.darkMode">{{ theme.dark() ? '☀ ' + ui.workspace.lightMode : '☾ ' + ui.workspace.darkMode }}</button>
      </div>
    </header>
    @if (loadError(); as error) { <div class="load-error" role="alert">{{ ui.workspace.errors[error] }} <button (click)="load()">{{ ui.workspace.retry }}</button></div> }
    @if (workspace(); as data) {
      <div class="workspace-shell">
        <nav #navigation class="material-nav" [attr.aria-label]="ui.workspace.navigationLabel">
          <label for="material-search">{{ ui.workspace.materials }}</label>
          <input id="material-search" type="search" [placeholder]="ui.workspace.searchPlaceholder" [value]="search()" (input)="updateSearch($event)">
          <ng-container *ngTemplateOutlet="folderTree; context: { $implicit: folders() }" />
          <ng-template #folderTree let-nodes>
            @for (folder of nodes; track folder.id) {
              <details class="nav-folder" [attr.data-folder-id]="folder.id" [open]="!!search() || expanded().has(folder.id)" (toggle)="toggleFolder(folder.id, $event)">
                <summary>{{ folder.title }}</summary>
                <div class="folder-contents">
                  @for (material of folder.materials; track material.id) {
                    <button [attr.data-material-id]="material.id" [class.selected]="active() === material.id"
                      [attr.aria-current]="active() === material.id ? 'page' : null" (click)="open(material.id)">{{ material.title }}</button>
                  }
                  <ng-container *ngTemplateOutlet="folderTree; context: { $implicit: folder.children }" />
                </div>
              </details>
            }
          </ng-template>
          @if (!folders().length) { <p class="nav-empty">{{ ui.workspace.noSearchResults }}</p> }
        </nav>
        <main class="workspace-main">
          <div #tabStrip class="material-tabs" role="tablist" [attr.aria-label]="ui.workspace.tabsLabel" (keydown)="tabKey($event)">
            @if (gameOpen()) {
              <div class="material-tab" [class.is-active]="active() === '@game'" (mousedown)="preventMiddleScroll($event)" (auxclick)="middleClose('@game', $event)">
                <button role="tab" id="tab-game" aria-controls="panel-game" data-tab-id="@game" [attr.tabindex]="active() === '@game' ? 0 : -1" [attr.aria-selected]="active() === '@game'" (click)="openGame()">{{ ui.game.title }}</button>
                <button class="tab-close" [attr.aria-label]="ui.workspace.closeTab + ' ' + ui.game.title" (click)="close('@game')">×</button>
              </div>
            }
            @if (data.maps.length && mapOpen()) {
              <div class="material-tab" [class.is-active]="active() === '@map'" (mousedown)="preventMiddleScroll($event)" (auxclick)="middleClose('@map', $event)">
                <button role="tab" id="tab-map" aria-controls="panel-map" data-tab-id="@map" [attr.tabindex]="active() === '@map' ? 0 : -1" [attr.aria-selected]="active() === '@map'" (click)="openMap()">{{ ui.workspace.map }}</button>
                <button class="tab-close" [attr.aria-label]="ui.workspace.closeTab + ' ' + ui.workspace.map" [title]="ui.workspace.closeTabHint" (click)="close('@map')">×</button>
              </div>
            }
            @for (tab of sessions(); track tab.material.id) {
              <div class="material-tab" [class.is-active]="active() === tab.material.id" (mousedown)="preventMiddleScroll($event)" (auxclick)="middleClose(tab.material.id, $event)">
                <button role="tab" [id]="'tab-' + tab.material.id" [attr.aria-controls]="'panel-' + tab.material.id" [attr.data-tab-id]="tab.material.id" [attr.tabindex]="active() === tab.material.id ? 0 : -1" [attr.aria-selected]="active() === tab.material.id" (click)="activate(tab.material.id)">
                  {{ tab.material.title }}{{ tab.dirty() ? ' •' : '' }}
                </button>
                <button class="tab-close" [attr.aria-label]="ui.workspace.closeTab + ' ' + tab.material.title" [title]="ui.workspace.closeTabHint"
                  [disabled]="closing().has(tab.material.id)" (click)="close(tab.material.id)">{{ closing().has(tab.material.id) ? '…' : '×' }}</button>
              </div>
            }
          </div>
          @if (opening()) { <div class="opening-state" role="status">{{ ui.workspace.loadingMaterial }}</div> }
          @if (!active()) { <p class="empty-workspace">{{ data.maps.length ? ui.workspace.emptyWithMap : ui.workspace.emptyMaterials }}</p> }
          @if (data.maps[0]; as map) {
            <mc-map-view id="panel-map" role="tabpanel" aria-labelledby="tab-map" [hidden]="active() !== '@map'" [map]="map" (openMaterial)="open($event)" />
          }
          @if (gameMounted()) { @if (game(); as session) { @if (campaignModule(); as module) { <mc-game-view id="panel-game" role="tabpanel" aria-labelledby="tab-game" [hidden]="active() !== '@game'" [session]="session" [module]="module" /> } } }
          @for (tab of sessions(); track tab.material.id) {
            <mc-material-view [id]="'panel-' + tab.material.id" role="tabpanel" [attr.aria-labelledby]="'tab-' + tab.material.id" [hidden]="active() !== tab.material.id" [session]="tab" [materials]="data.materials" (openMaterial)="open($event.id, $event.anchor)" />
          }
        </main>
      </div>
    } @else if (!loadError()) { <p class="opening-state">{{ ui.workspace.loadingCampaign }}</p> }
  `,
})
export class Workspace {
  private readonly http = inject(HttpClient);
  private readonly modules = inject(CAMPAIGN_MODULES);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  readonly theme = inject(ThemePreference);
  readonly ui = uiMessages;
  readonly workspace = signal<WorkspaceDto | null>(null);
  readonly sessions = signal<MaterialSession[]>([]);
  readonly active = signal('@map');
  readonly search = signal('');
  readonly loadError = signal<keyof UiMessages['workspace']['errors'] | null>(null);
  readonly opening = signal(false);
  readonly mapOpen = signal(true);
  readonly gameOpen = signal(false);
  readonly gameMounted = signal(false);
  readonly game = signal<GameSession | null>(null);
  readonly campaignModule = computed(() => this.modules.find(module => module.id === this.workspace()?.moduleId));
  readonly gameTime = computed(() => {
    const minutes = this.game()?.state()?.snapshot.timeMinutes ?? 0;
    return `${Math.floor(minutes / 60)} ${this.ui.game.hour} ${minutes % 60} ${this.ui.game.minute}`;
  });
  readonly closing = signal(new Set<string>());
  readonly expanded = signal(new Set<string>());
  private readonly navigation = viewChild<ElementRef<HTMLElement>>('navigation');
  private readonly tabStrip = viewChild<ElementRef<HTMLElement>>('tabStrip');
  readonly views = viewChildren(MaterialView);
  readonly folders = computed(() => buildNavigation(this.workspace()?.folders ?? [], this.workspace()?.materials ?? [], this.search(),
    this.ui.workspace.unfiledMaterials, uiLocale));
  private readonly loadingMaterials = new Map<string, Promise<MaterialSession>>();
  private navigationRender?: AfterRenderRef;

  constructor() {
    this.destroyRef.onDestroy(() => { this.navigationRender?.destroy(); this.game()?.destroy(); });
    void this.load();
  }
  async load() {
    this.loadError.set(null);
    try {
      const workspace = await firstValueFrom(this.http.get<WorkspaceDto>('/api/workspace'));
      if (!this.modules.some(module => module.id === workspace.moduleId)) throw new Error('No frontend implementation is registered for the campaign module.');
      this.workspace.set(workspace);
      if (this.game()?.campaignId !== workspace.campaignId) {
        this.game()?.destroy();
        let storage: Storage | null = null;
        try { storage = window.sessionStorage; } catch { /* A blocked store is reported when an operation is attempted. */ }
        const game = new GameSession(workspace.campaignId, this.http, storage);
        this.game.set(game);
        void game.load();
      }
      // Begin in the reader. The map remains available in the same main area.
      if (!this.sessions().length && workspace.materials.length) await this.open(workspace.startMaterialId);
    } catch { this.loadError.set('campaignLoadFailed'); }
  }
  async open(id: string, anchor?: string) {
    if (!this.workspace()?.materials.some(material => material.id === id)) {
      this.loadError.set('materialNotFound'); return;
    }
    this.opening.set(true);
    try {
      if (!this.sessions().some(tab => tab.material.id === id)) {
        let pending = this.loadingMaterials.get(id);
        if (!pending) {
          pending = firstValueFrom(this.http.get<MaterialDto>(`/api/materials/${id}`)).then(material => {
            const session = new MaterialSession(material, this.http);
            this.sessions.update(tabs => [...tabs, session]);
            return session;
          }).finally(() => this.loadingMaterials.delete(id));
          this.loadingMaterials.set(id, pending);
        }
        await pending;
      }
      this.activate(id, anchor);
    } catch { this.loadError.set('materialLoadFailed'); }
    finally { this.opening.set(false); }
  }

  openMap() { this.mapOpen.set(true); this.activate('@map'); }
  openGame() { this.gameMounted.set(true); this.gameOpen.set(true); this.activate('@game'); }

  activate(id: string, anchor?: string, focusTab = false) {
    this.active.set(id);
    const material = this.workspace()?.materials.find(material => material.id === id);
    if (material) {
      if (!material.title.toLocaleLowerCase(uiLocale).includes(this.search().trim().toLocaleLowerCase(uiLocale))) this.search.set('');
      this.expanded.update(current => new Set([...current, ...folderPath(this.workspace()?.folders ?? [], material.folderId),
        ...(material.folderId ? [] : ['@unfiled'])]));
    }
    this.navigationRender?.destroy();
    this.navigationRender = afterNextRender(() => {
      const nav = this.navigation()?.nativeElement;
      const selected = nav?.querySelector<HTMLElement>('[aria-current="page"]');
      if (nav && selected) {
        if (!focusTab) selected.focus({ preventScroll: true });
        const itemBounds = selected.getBoundingClientRect();
        const navBounds = nav.getBoundingClientRect();
        nav.scrollTo({ top: nav.scrollTop + itemBounds.top - navBounds.top - (nav.clientHeight - itemBounds.height) / 2 });
      }
      const strip = this.tabStrip()?.nativeElement;
      const tab = strip?.querySelector<HTMLElement>('[aria-selected="true"]');
      if (strip && tab) {
        if (focusTab) tab.focus({ preventScroll: true });
        const tabBounds = tab.getBoundingClientRect();
        const stripBounds = strip.getBoundingClientRect();
        strip.scrollTo({ left: strip.scrollLeft + tabBounds.left - stripBounds.left - (strip.clientWidth - tabBounds.width) / 2 });
      }
      if (anchor) this.views().find(view => view.session().material.id === id)?.scrollToAnchor(anchor);
    }, { injector: this.injector });
  }

  toggleFolder(id: string, event: Event) {
    if (this.search() || !(event.target instanceof HTMLDetailsElement)) return;
    const open = event.target.open;
    this.expanded.update(current => { const next = new Set(current); if (open) next.add(id); else next.delete(id); return next; });
  }

  updateSearch(event: Event) { if (event.target instanceof HTMLInputElement) this.search.set(event.target.value); }

  tabKey(event: KeyboardEvent) {
    if (!(event.target instanceof HTMLElement) || event.target.getAttribute('role') !== 'tab') return;
    const tabs = Array.from(this.tabStrip()?.nativeElement.querySelectorAll<HTMLElement>('[role="tab"]') ?? []);
    const index = tabs.indexOf(event.target);
    if (index < 0) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight': next = (index + 1) % tabs.length; break;
      case 'ArrowLeft': next = (index + tabs.length - 1) % tabs.length; break;
      case 'Home': next = 0; break;
      case 'End': next = tabs.length - 1; break;
      default: return;
    }
    const id = tabs[next]?.getAttribute('data-tab-id');
    if (id) { event.preventDefault(); this.activate(id, undefined, true); }
  }

  preventMiddleScroll(event: MouseEvent) { if (event.button === 1) event.preventDefault(); }
  middleClose(id: string, event: MouseEvent) { if (event.button === 1) { event.preventDefault(); void this.close(id); } }

  async close(id: string) {
    if (this.closing().has(id)) return;
    const session = this.sessions().find(tab => tab.material.id === id);
    if (session) {
      this.closing.update(current => new Set([...current, id]));
      const saved = await session.prepareToClose();
      this.closing.update(current => { const next = new Set(current); next.delete(id); return next; });
      if (!saved || session.dirty()) { this.activate(id); return; }
    }
    const tabIds = [...(this.gameOpen() ? ['@game'] : []), ...(this.mapOpen() ? ['@map'] : []), ...this.sessions().map(tab => tab.material.id)];
    const index = tabIds.indexOf(id);
    if (index < 0) return;
    if (id === '@map') this.mapOpen.set(false);
    else if (id === '@game') this.gameOpen.set(false);
    else this.sessions.update(tabs => tabs.filter(tab => tab.material.id !== id));
    if (this.active() === id) this.activate(tabIds[index + 1] ?? tabIds[index - 1] ?? '');
  }
  @HostListener('window:beforeunload', ['$event'])
  protectPendingChanges(event: BeforeUnloadEvent) {
    if (this.sessions().some(tab => tab.dirty())) { event.preventDefault(); event.returnValue = ''; }
  }
}
