import type { GameCharacter, GameStateDto, MaterialDto, RichDocument, WorkspaceDto } from '@mastercompanion/contracts';

export const campaignId = 'd914d551-7391-45c0-8e29-58a33841c830';
export const readerId = 'ui-reader';
export const linkedId = 'ui-linked';
export const readerTitle = 'Reading fixture';
export const linkedTitle = 'Linked fixture';

const paragraph = (text: string): RichDocument => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const cell = (type: 'tableHeader' | 'tableCell', text: string): RichDocument => ({ type, content: [paragraph(text)] });

export function campaignFixture(): { workspace: WorkspaceDto; materials: [MaterialDto, MaterialDto]; game: GameStateDto } {
  const materials: [MaterialDto, MaterialDto] = [
    {
      id: readerId, title: readerTitle, group: 'Fixture chapter', folderId: 'ui-child', revision: 7, documentSchemaVersion: 1,
      document: {
        type: 'doc', content: [
          paragraph('A long campaign note used to verify comfortable reading, rich content and preserved position.'),
          { type: 'paragraph', content: [{ type: 'text', text: 'Open linked material', marks: [{ type: 'link', attrs: { href: `#material/${linkedId}` } }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Reference table' }] },
          { type: 'table', content: [
            { type: 'tableRow', content: [cell('tableHeader', 'Location'), cell('tableHeader', 'Description')] },
            { type: 'tableRow', content: [cell('tableCell', 'Observatory'), cell('tableCell', 'An inscription and a sealed stone door.')] },
          ] },
          { type: 'details', content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Hidden context' }] },
            { type: 'detailsContent', content: [paragraph('Private context remains available without changing the stored note.')] },
          ] },
          { type: 'blockquote', content: [paragraph('A quotation must remain readable in both themes.')] },
          ...Array.from({ length: 16 }, (_, index) => paragraph(`Passage ${index + 1}. The expedition follows the old road past silent towers. This stable text gives the reader enough content to exercise scrolling, tab changes and editing without touching a real campaign.`)),
        ],
      },
    },
    { id: linkedId, title: linkedTitle, group: 'Fixture chapter', folderId: 'ui-child', revision: 3, documentSchemaVersion: 1,
      document: { type: 'doc', content: [paragraph('Linked content opens in a separate tab.')] } },
  ];
  const party: [GameCharacter, GameCharacter] = [
    { id: 'f3791c96-b09d-4f80-a911-6874aebd2d11', name: 'Arin' },
    { id: '41f8bec2-6c1b-4cf5-89de-cd0d58a1cf1a', name: 'Mira' },
  ];
  return {
    workspace: {
      campaignId, title: 'UI test campaign', moduleId: 'ythryn', moduleVersion: '0.1.0', startMaterialId: readerId,
      materials: materials.map(({ id, title, group, folderId }) => ({ id, title, group, folderId })),
      folders: [{ id: 'ui-root', title: 'Fixture chapter', parentId: null }, { id: 'ui-child', title: 'Nested materials', parentId: 'ui-root' }],
      maps: [],
    },
    materials,
    game: {
      revision: 12,
      snapshot: { timeMinutes: 1500, party, restEnds: [480], moduleSchemaVersion: 3, moduleState: {} },
      lastOperation: { requestId: '87c77760-d642-44f2-bf27-e14b99a8f75b', kind: 'longRest', revision: 12 },
      moduleView: {
        characters: [
          { id: party[0].id, status: 'healthy', dc: 15, failures: 0, nextCheck: { kind: 'exposure', minute: 720, pending: true } },
          { id: party[1].id, status: 'infected', dc: 15, failures: 1, nextCheck: { kind: 'recovery', minute: 1200, pending: true } },
        ],
        expedition: {
          aurilEnabled: true, explorationMinutes: 90, nextHourlyIn: 30,
          pending: [{ id: 1, kind: 'hourly', minute: 60 }, { id: 2, kind: 'building', minute: 90 }], lastResult: null,
          avarice: { deadline: 480, arrivedAt: null, enabled: true, remainingMinutes: 0, pending: true },
          auril: { deadline: 1440, arrivedAt: null, enabled: true, remainingMinutes: 0, pending: true },
        },
      },
    },
  };
}
