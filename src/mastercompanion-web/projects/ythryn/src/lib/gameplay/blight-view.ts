import type { GameStateDto } from '@mastercompanion/contracts';

export type BlightStatus = 'healthy' | 'infected' | 'immune' | 'transformed';
export interface BlightCheck { kind: 'exposure' | 'rest' | 'recovery'; minute: number; remainingMinutes: number; pending: boolean; }
export interface BlightCharacterView {
  id: string; name: string; status: BlightStatus; dc: number; failures: number;
  nextCheck: BlightCheck | null;
}
export interface ResolveCheckCommand { kind: 'resolveCheck'; characterId: string; success: boolean; d6?: number; }
export interface CheckDieSelection { characterId: string; kind: BlightCheck['kind']; minute: number; die: number; }

export function remainingCheckMinutes(checkMinute: number, gameMinute: number): number {
  return Math.max(0, checkMinute - gameMinute);
}

// A retry can advance the projection outside the tool's execute promise.
// Keep a failed request's input only while it still describes the same check.
export function selectedCheckDie(character: BlightCharacterView, selection: CheckDieSelection | undefined): number | null {
  const check = character.nextCheck;
  return check && selection && selection.characterId === character.id && selection.kind === check.kind &&
    selection.minute === check.minute ? selection.die : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function status(value: unknown): value is BlightStatus {
  return value === 'healthy' || value === 'infected' || value === 'immune' || value === 'transformed';
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

// Validate the module-owned display projection without interpreting the persisted rules state.
export function readBlightView(state: GameStateDto): BlightCharacterView[] | null {
  const view = state.moduleView;
  const { party, timeMinutes, moduleSchemaVersion } = state.snapshot;
  if ((moduleSchemaVersion !== 1 && moduleSchemaVersion !== 2 && moduleSchemaVersion !== 3) || !record(view) || !Array.isArray(view['characters']) ||
      party.length === 0 || party.length > 20 || view['characters'].length !== party.length) return null;
  const names = new Map(party.map(character => [character.id, character.name]));
  if (names.size !== party.length) return null;
  const result: BlightCharacterView[] = [];
  for (const item of view['characters']) {
    if (!record(item) || typeof item['id'] !== 'string' || !status(item['status']) ||
        !integer(item['dc'], 0, 15) || !integer(item['failures'], 0, 3)) return null;
    const id = item['id'];
    const name = names.get(id);
    if (name === undefined) return null;
    names.delete(id);
    let nextCheck: BlightCheck | null = null;
    const rawCheck = item['nextCheck'];
    if (rawCheck !== null) {
      if (!record(rawCheck) || (rawCheck['kind'] !== 'exposure' && rawCheck['kind'] !== 'rest' && rawCheck['kind'] !== 'recovery') ||
          (moduleSchemaVersion === 1 && rawCheck['kind'] === 'recovery') ||
          !integer(rawCheck['minute'], 1, Number.MAX_SAFE_INTEGER) || typeof rawCheck['pending'] !== 'boolean' ||
          rawCheck['pending'] !== (rawCheck['minute'] <= timeMinutes)) return null;
      nextCheck = {
        kind: rawCheck['kind'], minute: rawCheck['minute'], pending: rawCheck['pending'],
        remainingMinutes: remainingCheckMinutes(rawCheck['minute'], timeMinutes),
      };
    }
    const characterStatus = item['status'];
    if ((characterStatus === 'healthy' && nextCheck?.kind !== 'exposure') ||
        (characterStatus === 'infected' && nextCheck !== null && nextCheck.kind !== 'rest' && nextCheck.kind !== 'recovery') ||
        (moduleSchemaVersion >= 2 && characterStatus === 'infected' && nextCheck === null) ||
        ((characterStatus === 'immune' || characterStatus === 'transformed') && nextCheck !== null)) return null;
    result.push({ id, name, status: characterStatus, dc: item['dc'], failures: item['failures'], nextCheck });
  }
  return result;
}

export function resolveCheckCommand(character: BlightCharacterView, success: boolean, die: number | null): ResolveCheckCommand | null {
  const check = character.nextCheck;
  if (!check?.pending || (character.status !== 'healthy' && character.status !== 'infected')) return null;
  if ((check.kind === 'rest' || check.kind === 'recovery') && success) {
    if (die === null || !integer(die, 1, 6)) return null;
    return { kind: 'resolveCheck', characterId: character.id, success, d6: die };
  }
  return { kind: 'resolveCheck', characterId: character.id, success };
}
