import type { Route } from '@playwright/test';
import type {
  CharacterChange,
  CharacterProfile,
  GameStateDto,
  MaterialDto,
} from '@mastercompanion/contracts';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Browser transport fixture; API tests verify actual membership and persistence rules. */
export class CharacterApi {
  readonly profiles: CharacterProfile[] = [];
  readonly requests: CharacterChange[] = [];
  private readonly receipts = new Map<string, GameStateDto>();

  constructor(
    private readonly game: GameStateDto,
    private readonly create: (materials: MaterialDto[]) => void,
  ) {
    for (const member of game.snapshot.party) {
      this.add({
        ...member,
        kind: 'player',
        inParty: true,
        backstoryTitle: `${member.name} backstory`,
        notesTitle: `${member.name} notes`,
      });
    }
  }

  private add(change: CharacterChange): void {
    const backstoryMaterialId = `profile-${change.id}-backstory`;
    const notesMaterialId = `profile-${change.id}-notes`;
    this.profiles.push({
      id: change.id,
      name: change.name,
      kind: change.kind,
      inParty: change.inParty,
      backstoryMaterialId,
      notesMaterialId,
    });
    this.create([
      {
        id: backstoryMaterialId,
        title: change.backstoryTitle,
        group: '',
        folderId: null,
        documentSchemaVersion: 1,
        revision: 1,
        document: { type: 'doc', content: [{ type: 'paragraph' }] },
      },
      {
        id: notesMaterialId,
        title: change.notesTitle,
        group: '',
        folderId: null,
        documentSchemaVersion: 1,
        revision: 1,
        document: { type: 'doc', content: [{ type: 'paragraph' }] },
      },
    ]);
  }

  async read(route: Route): Promise<void> {
    const characters = this.profiles.map((profile) => ({
      ...profile,
      inParty: this.game.snapshot.party.some((member) => member.id === profile.id),
    }));
    await route.fulfill({ json: { revision: this.game.revision, characters } });
  }

  async change(route: Route): Promise<void> {
    const body: unknown = route.request().postDataJSON();
    if (
      !object(body) ||
      body['kind'] !== 'updateCharacter' ||
      typeof body['requestId'] !== 'string' ||
      !object(body['character'])
    ) {
      throw new Error('Unexpected character fixture request.');
    }
    const raw = body['character'];
    if (
      typeof raw['id'] !== 'string' ||
      typeof raw['name'] !== 'string' ||
      (raw['kind'] !== 'player' && raw['kind'] !== 'npc') ||
      typeof raw['inParty'] !== 'boolean' ||
      typeof raw['backstoryTitle'] !== 'string' ||
      typeof raw['notesTitle'] !== 'string'
    ) {
      throw new Error('Invalid character fixture metadata.');
    }
    const change: CharacterChange = {
      id: raw['id'],
      name: raw['name'],
      kind: raw['kind'],
      inParty: raw['inParty'],
      backstoryTitle: raw['backstoryTitle'],
      notesTitle: raw['notesTitle'],
    };
    const receipt = this.receipts.get(body['requestId']);
    if (receipt) {
      await route.fulfill({ json: receipt });
      return;
    }
    this.requests.push(change);
    const existing = this.profiles.find((profile) => profile.id === change.id);
    if (existing) {
      const index = this.profiles.indexOf(existing);
      this.profiles[index] = {
        ...existing,
        name: change.name,
        kind: change.kind,
        inParty: change.inParty,
      };
    } else {
      this.add(change);
    }
    this.game.snapshot.party = this.game.snapshot.party.filter((member) => member.id !== change.id);
    if (change.inParty) {
      this.game.snapshot.party.push({ id: change.id, name: change.name });
    }
    const view = this.game.moduleView;
    if (object(view) && Array.isArray(view['characters'])) {
      const existingStates = view['characters'];
      view['characters'] = this.game.snapshot.party.map(
        (member) =>
          existingStates.find((item: unknown) => object(item) && item['id'] === member.id) ?? {
            id: member.id,
            status: 'healthy',
            dc: 15,
            failures: 0,
            nextCheck: { kind: 'exposure', minute: 2220, pending: false },
          },
      );
    }
    this.game.revision++;
    this.game.lastOperation = {
      requestId: body['requestId'],
      revision: this.game.revision,
      kind: 'updateCharacter',
    };
    const result = structuredClone(this.game);
    this.receipts.set(body['requestId'], result);
    await route.fulfill({ json: result });
  }
}
