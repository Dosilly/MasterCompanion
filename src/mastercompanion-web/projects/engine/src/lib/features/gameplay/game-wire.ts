import type { GameCharacter, GameOperationRequest, GameStateDto } from '@mastercompanion/contracts';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(value: unknown, minimum = 0): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum;
}
function identifier(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) &&
    value !== '00000000-0000-0000-0000-000000000000'
  );
}
function character(value: unknown): value is GameCharacter {
  return (
    record(value) &&
    identifier(value['id']) &&
    typeof value['name'] === 'string' &&
    value['name'].length > 0 &&
    value['name'].length <= 100 &&
    value['name'].trim() === value['name'] &&
    !/[\u0000-\u001f\u007f]/.test(value['name'])
  );
}
function jsonValue(value: unknown, depth = 0): boolean {
  if (depth > 16) {
    return false;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every((item) => jsonValue(item, depth + 1));
  }
  return record(value) && Object.values(value).every((item) => jsonValue(item, depth + 1));
}
export function isGameState(value: unknown): value is GameStateDto {
  if (!record(value) || !integer(value['revision']) || !record(value['snapshot'])) {
    return false;
  }
  const snapshot = value['snapshot'];
  if (
    !integer(snapshot['timeMinutes']) ||
    snapshot['timeMinutes'] > 52_560_000 ||
    !integer(snapshot['moduleSchemaVersion'], 1) ||
    !jsonValue(snapshot['moduleState']) ||
    !jsonValue(value['moduleView']) ||
    !Array.isArray(snapshot['party']) ||
    snapshot['party'].length > 20 ||
    !snapshot['party'].every(character) ||
    new Set(snapshot['party'].map((member) => member.id.toLowerCase())).size !==
      snapshot['party'].length ||
    !Array.isArray(snapshot['restEnds']) ||
    snapshot['restEnds'].length > 10_000
  ) {
    return false;
  }
  let previous = 0;
  for (const minute of snapshot['restEnds']) {
    if (!integer(minute, 1) || minute <= previous || minute > snapshot['timeMinutes']) {
      return false;
    }
    previous = minute;
  }
  const last = value['lastOperation'];
  return (
    last === null ||
    (record(last) &&
      identifier(last['requestId']) &&
      integer(last['revision'], 1) &&
      last['revision'] <= value['revision'] &&
      typeof last['kind'] === 'string' &&
      ['configureParty', 'updateParty', 'advanceTime', 'shortRest', 'longRest', 'module'].includes(
        last['kind'],
      ))
  );
}
export function isGameRequest(value: unknown): value is GameOperationRequest {
  if (!record(value) || !identifier(value['requestId']) || !integer(value['expectedRevision'])) {
    return false;
  }
  const keys = Object.keys(value);
  const only = (...fields: string[]) =>
    keys.length === fields.length && fields.every((field) => keys.includes(field));
  switch (value['kind']) {
    case 'configureParty':
    case 'updateParty':
      return (
        only('kind', 'requestId', 'expectedRevision', 'party') &&
        Array.isArray(value['party']) &&
        (value['kind'] === 'updateParty' || value['party'].length > 0) &&
        value['party'].length <= 20 &&
        value['party'].every(character) &&
        new Set(value['party'].map((member) => member.id.toLowerCase())).size ===
          value['party'].length
      );
    case 'advanceTime':
      return (
        only('kind', 'requestId', 'expectedRevision', 'minutes') &&
        integer(value['minutes'], 1) &&
        value['minutes'] <= 525_600
      );
    case 'shortRest':
    case 'longRest':
    case 'undo':
      return only('kind', 'requestId', 'expectedRevision');
    case 'module':
      return (
        record(value['command']) &&
        (only('kind', 'requestId', 'expectedRevision', 'command') ||
          (only('kind', 'requestId', 'expectedRevision', 'command', 'minutes') &&
            integer(value['minutes'], 1) &&
            value['minutes'] <= 525_600))
      );
    default:
      return false;
  }
}
