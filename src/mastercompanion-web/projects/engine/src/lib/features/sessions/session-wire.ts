import type {
  SessionOperation,
  SessionOperationRequest,
  SessionRecord,
  SessionSnapshot,
} from '@mastercompanion/contracts';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function keys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  return Object.keys(value).length === expected.length && expected.every((key) => key in value);
}

export function sessionId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value) &&
    value !== '00000000-0000-0000-0000-000000000000'
  );
}

function title(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.trim().length <= 300 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function text(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= 20_000 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

function materialId(value: unknown): value is string {
  return typeof value === 'string' && /^[^\s\u0000-\u001f\u007f/\\?#]{1,80}$/u.test(value);
}

export function isSessionOperation(value: unknown): value is SessionOperation {
  if (!record(value) || !sessionId(value['sessionId'])) {
    return false;
  }
  switch (value['kind']) {
    case 'create':
      return (
        keys(value, ['kind', 'sessionId', 'title', 'preparationTitle', 'notesTitle']) &&
        title(value['title']) &&
        title(value['preparationTitle']) &&
        title(value['notesTitle'])
      );
    case 'update':
      return (
        keys(value, ['kind', 'sessionId', 'title', 'summary', 'followUp']) &&
        title(value['title']) &&
        text(value['summary']) &&
        text(value['followUp'])
      );
    case 'start':
    case 'complete':
    case 'delete':
      return keys(value, ['kind', 'sessionId']);
    case 'pin':
    case 'unpin':
      return keys(value, ['kind', 'sessionId', 'materialId']) && materialId(value['materialId']);
    default:
      return false;
  }
}

export function isSessionRequest(value: unknown): value is SessionOperationRequest {
  return (
    record(value) &&
    keys(value, ['requestId', 'expectedRevision', 'operation']) &&
    sessionId(value['requestId']) &&
    Number.isSafeInteger(value['expectedRevision']) &&
    Number(value['expectedRevision']) >= 0 &&
    Number(value['expectedRevision']) < Number.MAX_SAFE_INTEGER &&
    isSessionOperation(value['operation'])
  );
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (
    !record(value) ||
    !keys(value, [
      'id',
      'title',
      'status',
      'preparationMaterialId',
      'notesMaterialId',
      'summary',
      'followUp',
      'pinnedMaterialIds',
    ]) ||
    !sessionId(value['id'])
  ) {
    return false;
  }
  return (
    title(value['title']) &&
    typeof value['status'] === 'string' &&
    ['planned', 'active', 'completed'].includes(value['status']) &&
    value['preparationMaterialId'] === `session-${value['id']}-prep` &&
    value['notesMaterialId'] === `session-${value['id']}-notes` &&
    text(value['summary']) &&
    text(value['followUp']) &&
    Array.isArray(value['pinnedMaterialIds']) &&
    value['pinnedMaterialIds'].length <= 200 &&
    value['pinnedMaterialIds'].every(materialId) &&
    new Set(value['pinnedMaterialIds']).size === value['pinnedMaterialIds'].length
  );
}

export function isSessionSnapshot(value: unknown): value is SessionSnapshot {
  return (
    record(value) &&
    keys(value, ['revision', 'sessions']) &&
    Number.isSafeInteger(value['revision']) &&
    Number(value['revision']) >= 0 &&
    Array.isArray(value['sessions']) &&
    value['sessions'].length <= 1000 &&
    value['sessions'].every(isSessionRecord) &&
    new Set(value['sessions'].map((item) => item.id)).size === value['sessions'].length &&
    value['sessions'].filter((item) => item.status === 'active').length <= 1
  );
}

export function confirmsSessionOperation(
  snapshot: SessionSnapshot,
  operation: SessionOperation,
): boolean {
  const session = snapshot.sessions.find((item) => item.id === operation.sessionId);
  if (operation.kind === 'delete') {
    return session === undefined;
  }
  if (!session) {
    return false;
  }
  switch (operation.kind) {
    case 'create':
      return (
        session.title === operation.title.trim() &&
        session.status === 'planned' &&
        session.summary === '' &&
        session.followUp === '' &&
        session.pinnedMaterialIds.length === 0
      );
    case 'update':
      return (
        session.title === operation.title.trim() &&
        session.summary === operation.summary &&
        session.followUp === operation.followUp
      );
    case 'start':
      return session.status === 'active';
    case 'complete':
      return session.status === 'completed';
    case 'pin':
      return session.pinnedMaterialIds.includes(operation.materialId);
    case 'unpin':
      return !session.pinnedMaterialIds.includes(operation.materialId);
  }
}
