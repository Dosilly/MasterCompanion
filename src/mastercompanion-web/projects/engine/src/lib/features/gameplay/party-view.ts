import { IconComponent } from '@mastercompanion/ui';
import {
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { inject, DestroyRef } from '@angular/core';
import { GameSession } from './game-session';
import { CharacterCatalog } from '../characters/character-catalog';
import { CharacterDraft } from '../characters/character-draft';
import { WorkspaceMaterials } from '../workspace/workspace-materials';
import { MaterialViewHost } from '../materials/material-view-host';
import { uiMessages } from '../../i18n/messages';

@Component({
  imports: [IconComponent, MaterialViewHost],
  selector: 'mc-party-view',
  templateUrl: './party-view.html',
  styleUrl: './party-view.scss',
})
export class PartyView {
  readonly session = input.required<GameSession>();
  readonly materialsOwner = input.required<WorkspaceMaterials>();
  readonly closing = input(false);
  readonly materialsCreated = output<void>();
  readonly text = uiMessages.characters;
  readonly gameText = uiMessages.game;
  readonly draft = new CharacterDraft();
  readonly dirty = computed(
    () =>
      this.draft.dirty() ||
      this.materialsOwner()
        .sessions()
        .some((item) => this.profileDocumentIds().has(item.material.id) && item.dirty()),
  );
  readonly state = computed(() => this.session().state());
  readonly selectedId = signal('');
  readonly section = signal<'backstory' | 'notes'>('backstory');
  readonly filter = signal<'all' | 'player' | 'npc' | 'party'>('all');
  readonly query = signal('');
  readonly validationError = signal<'invalidName' | 'partyLimit' | null>(null);
  readonly closeBlocked = signal(false);
  readonly discardRequested = signal(false);
  readonly contentLoading = signal(false);
  readonly contentError = signal(false);
  readonly catalog = signal<CharacterCatalog | null>(null);
  readonly profiles = computed(() => this.catalog()?.snapshot().characters ?? []);
  readonly selected = computed(
    () =>
      this.profiles().find((item) => item.id === this.selectedId()) ??
      this.profiles().at(0) ??
      null,
  );
  readonly visibleProfiles = computed(() => {
    const query = this.query().trim().toLocaleLowerCase();
    return this.profiles().filter(
      (item) =>
        (!query || item.name.toLocaleLowerCase().includes(query)) &&
        (this.filter() === 'all' ||
          this.filter() === item.kind ||
          (this.filter() === 'party' && item.inParty)),
    );
  });
  readonly documentId = computed(() => {
    const selected = this.selected();
    return selected
      ? this.section() === 'backstory'
        ? selected.backstoryMaterialId
        : selected.notesMaterialId
      : null;
  });
  readonly emptyNarrative = computed(() => {
    const document = this.materialsOwner()
      .sessions()
      .find((item) => item.material.id === this.documentId());
    if (!document || document.editing()) {
      return false;
    }
    document.dirty();
    document.confirmedRevision();
    return (
      document.document.content?.every(
        (node) => node.type === 'paragraph' && !node.content?.length,
      ) ?? true
    );
  });
  readonly profileDocumentIds = computed(
    () =>
      new Set(this.profiles().flatMap((item) => [item.backstoryMaterialId, item.notesMaterialId])),
  );
  readonly stale = computed(
    () => !!this.draft.value() && this.draft.revision() !== this.state()?.revision,
  );
  readonly ready = computed(
    () =>
      this.session().canOperate() &&
      !this.closing() &&
      this.catalog()?.loaded() &&
      !this.catalog()?.loading() &&
      this.catalog()?.snapshot().revision === this.state()?.revision,
  );
  readonly documentHost = viewChild.required(MaterialViewHost);
  private readonly http = inject(HttpClient);
  private contentGeneration = 0;
  private destroyed = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.catalog()?.destroy();
    });
    effect(() => {
      const game = this.session();
      const revision = game.state()?.revision;
      untracked(() => {
        if (!this.catalog()) {
          this.catalog.set(new CharacterCatalog(game.campaignId, this.http));
        }
        if (revision !== undefined) {
          void this.catalog()?.load();
        }
      });
    });
    effect(() => {
      const id = this.documentId();
      untracked(() => void this.loadDocument(id));
    });
  }

  async refresh(): Promise<void> {
    await this.session().load();
    await this.catalog()?.load();
  }

  create(): void {
    const state = this.state();
    if (state && this.ready() && !this.draft.value()) {
      this.draft.begin(state.revision);
      this.validationError.set(null);
    }
  }

  edit(): void {
    const state = this.state();
    const selected = this.selected();
    if (state && selected && this.ready() && !this.draft.value()) {
      this.draft.begin(state.revision, selected);
      this.validationError.set(null);
    }
  }

  name(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.draft.name(event.target.value);
    }
  }

  membership(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.draft.membership(event.target.checked);
    }
  }

  search(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.query.set(event.target.value);
    }
  }

  async save(event: Event): Promise<void> {
    event.preventDefault();
    if (this.stale() || !this.session().canOperate()) {
      return;
    }
    const change = this.draft.change(this.text.backstory, this.text.notes);
    this.validationError.set(change === null ? 'invalidName' : null);
    if (!change) {
      return;
    }
    const party = this.state()?.snapshot.party ?? [];
    if (change.inParty && !party.some((member) => member.id === change.id) && party.length >= 20) {
      this.validationError.set('partyLimit');
      return;
    }
    if (await this.session().execute({ kind: 'updateCharacter', character: change })) {
      this.selectedId.set(change.id);
      this.draft.finish();
      this.discardRequested.set(false);
      this.materialsCreated.emit();
      await this.catalog()?.load();
    }
  }

  async retry(): Promise<void> {
    if (await this.session().retry()) {
      await this.catalog()?.load();
      const draft = this.draft.value();
      const confirmed = this.profiles().find((item) => item.id === draft?.id);
      if (
        draft &&
        confirmed &&
        confirmed.name === draft.name.trim() &&
        confirmed.kind === draft.kind &&
        confirmed.inParty === draft.inParty
      ) {
        this.selectedId.set(draft.id);
        this.draft.finish();
        this.materialsCreated.emit();
      }
    }
  }

  cancel(): void {
    if (this.draft.dirty()) {
      this.discardRequested.set(true);
    } else {
      this.draft.finish();
    }
  }

  discard(): void {
    this.draft.finish();
    this.discardRequested.set(false);
  }

  async prepareToClose(): Promise<boolean> {
    if (this.draft.dirty() || this.session().hasRecovery() || this.session().pending()) {
      this.closeBlocked.set(true);
      return false;
    }
    do {
      for (const document of this.materialsOwner()
        .sessions()
        .filter((item) => this.profileDocumentIds().has(item.material.id))) {
        if (!(await document.prepareToClose())) {
          this.closeBlocked.set(true);
          return false;
        }
      }
    } while (
      this.materialsOwner()
        .sessions()
        .some((item) => this.profileDocumentIds().has(item.material.id) && item.dirty())
    );
    this.closeBlocked.set(false);
    return true;
  }

  async loadDocument(id = this.documentId()): Promise<void> {
    const generation = ++this.contentGeneration;
    this.contentError.set(false);
    this.contentLoading.set(!!id);
    if (!id) {
      return;
    }
    try {
      await this.materialsOwner().open(id);
    } catch {
      if (!this.destroyed && generation === this.contentGeneration) {
        this.contentError.set(true);
      }
    } finally {
      if (!this.destroyed && generation === this.contentGeneration) {
        this.contentLoading.set(false);
      }
    }
  }
}
