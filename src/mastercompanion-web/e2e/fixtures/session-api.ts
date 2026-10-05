import type { Route } from '@playwright/test';
import type {
  MaterialDto,
  SessionOperation,
  SessionOperationRequest,
  SessionRecord,
  SessionSnapshot,
} from '@mastercompanion/contracts';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decode(value: unknown): SessionOperationRequest {
  if (
    !object(value) ||
    typeof value['requestId'] !== 'string' ||
    typeof value['expectedRevision'] !== 'number' ||
    !object(value['operation'])
  ) {
    throw new Error('Expected a session operation request.');
  }
  const raw = value['operation'];
  const sessionId = raw['sessionId'];
  if (typeof sessionId !== 'string') {
    throw new Error('Expected a session identity.');
  }
  let operation: SessionOperation;
  const kind = raw['kind'];
  if (
    kind === 'create' &&
    typeof raw['title'] === 'string' &&
    typeof raw['preparationTitle'] === 'string' &&
    typeof raw['notesTitle'] === 'string'
  ) {
    operation = {
      kind,
      sessionId,
      title: raw['title'],
      preparationTitle: raw['preparationTitle'],
      notesTitle: raw['notesTitle'],
    };
  } else if (
    kind === 'update' &&
    typeof raw['title'] === 'string' &&
    typeof raw['summary'] === 'string' &&
    typeof raw['followUp'] === 'string'
  ) {
    operation = {
      kind,
      sessionId,
      title: raw['title'],
      summary: raw['summary'],
      followUp: raw['followUp'],
    };
  } else if (kind === 'start' || kind === 'complete' || kind === 'delete') {
    operation = { kind, sessionId };
  } else if ((kind === 'pin' || kind === 'unpin') && typeof raw['materialId'] === 'string') {
    operation = { kind, sessionId, materialId: raw['materialId'] };
  } else {
    throw new Error('Unexpected session fixture operation.');
  }
  return { requestId: value['requestId'], expectedRevision: value['expectedRevision'], operation };
}

/** A browser-only API fixture; real domain and persistence evidence lives in HTTP tests. */
export class SessionApi {
  snapshot: SessionSnapshot = { revision: 0, sessions: [] };
  readonly requests: SessionOperationRequest[] = [];
  mode: 'success' | 'conflict' | 'lostResponse' | 'hold' = 'success';
  loadFails = false;
  private readonly receipts = new Map<
    string,
    { request: SessionOperationRequest; response: SessionSnapshot }
  >();
  private readonly gate = Promise.withResolvers<void>();

  constructor(
    private readonly addDocument: (document: MaterialDto) => void,
    private readonly failure: (url: string, status: number) => void,
    private readonly lost: (url: string) => void,
  ) {}

  release(): void {
    this.gate.resolve();
  }

  async handle(route: Route): Promise<void> {
    const request = route.request();
    if (request.method() === 'GET') {
      if (this.loadFails) {
        this.failure(request.url(), 503);
        await route.fulfill({ status: 503, json: { code: 'fixture_unavailable' } });
      } else {
        await route.fulfill({ json: this.snapshot });
      }
      return;
    }
    const body = decode(request.postDataJSON());
    this.requests.push(body);
    if (this.mode === 'hold') {
      await this.gate.promise;
    }
    const receipt = this.receipts.get(body.requestId);
    if (receipt) {
      if (JSON.stringify(receipt.request) !== JSON.stringify(body)) {
        throw new Error('Session retry changed its identity payload.');
      }
      await route.fulfill({ json: receipt.response });
      return;
    }
    if (this.mode === 'conflict' || body.expectedRevision !== this.snapshot.revision) {
      this.failure(request.url(), 409);
      await route.fulfill({ status: 409, json: { code: 'session_revision_conflict' } });
      return;
    }
    const operation = body.operation;
    let records = [...this.snapshot.sessions];
    if (operation.kind === 'create') {
      const session: SessionRecord = {
        id: operation.sessionId,
        title: operation.title,
        status: 'planned',
        preparationMaterialId: `session-${operation.sessionId}-prep`,
        notesMaterialId: `session-${operation.sessionId}-notes`,
        summary: '',
        followUp: '',
        pinnedMaterialIds: [],
      };
      records.push(session);
      const documents: readonly (readonly [string, string])[] = [
        [session.preparationMaterialId, operation.preparationTitle],
        [session.notesMaterialId, operation.notesTitle],
      ];
      for (const [id, title] of documents) {
        this.addDocument({
          id,
          title,
          group: '',
          folderId: null,
          revision: 1,
          documentSchemaVersion: 1,
          document: { type: 'doc', content: [{ type: 'paragraph' }] },
        });
      }
    } else if (operation.kind === 'delete') {
      records = records.filter((record) => record.id !== operation.sessionId);
    } else {
      records = records.map((record) => {
        if (record.id !== operation.sessionId) {
          return record;
        }
        switch (operation.kind) {
          case 'update':
            return {
              ...record,
              title: operation.title.trim(),
              summary: operation.summary,
              followUp: operation.followUp,
            };
          case 'start':
            return { ...record, status: 'active' };
          case 'complete':
            return { ...record, status: 'completed' };
          case 'pin':
            return {
              ...record,
              pinnedMaterialIds: [...record.pinnedMaterialIds, operation.materialId],
            };
          case 'unpin':
            return {
              ...record,
              pinnedMaterialIds: record.pinnedMaterialIds.filter(
                (id) => id !== operation.materialId,
              ),
            };
          case 'delete':
            throw new Error('Deletion must remove the fixture record before field updates.');
        }
      });
    }
    this.snapshot = { revision: this.snapshot.revision + 1, sessions: records };
    this.receipts.set(body.requestId, { request: body, response: structuredClone(this.snapshot) });
    if (this.mode === 'lostResponse') {
      this.mode = 'success';
      this.lost(request.url());
      await route.abort('failed');
    } else {
      await route.fulfill({ json: this.snapshot });
    }
  }
}
