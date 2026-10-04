import type { GameAction, GameStateDto, MaterialTarget } from '@mastercompanion/contracts';

export type Faction = 'avarice' | 'auril';
export type EncounterKind = 'hourly' | 'building' | 'avaricePatrol';
export type EncounterOutcome = keyof typeof encounterMaterials;
export interface EncounterCheck {
  id: number;
  kind: EncounterKind;
  minute: number;
}
export interface ArrivalView {
  deadline: number | null;
  arrivedAt: number | null;
  enabled: boolean;
  remainingMinutes: number | null;
  pending: boolean;
}
export interface EncounterResult {
  check: EncounterCheck;
  roll: number;
  outcome: EncounterOutcome;
}
export interface EncounterBand {
  min: number;
  max: number;
  outcome: EncounterOutcome;
}
export interface EncounterRollSelection {
  check: EncounterCheck;
  value: string;
}
export interface ExpeditionView {
  aurilEnabled: boolean;
  explorationMinutes: number;
  nextHourlyIn: number;
  pending: EncounterCheck[];
  lastResult: EncounterResult | null;
  pendingTable: EncounterBand[] | null;
  avarice: ArrivalView;
  auril: ArrivalView;
}

export const encounterMaterials = {
  none: null,
  tombTapper: 's619222f1e8e6',
  livingHands: 's451a6a504213',
  cultFanatics: 's081fb4cf10b7',
  spittingMimics: 's6af80aeb87dc',
  coldlightWalkers: 's2508e2268801',
  gargoyles: 's30e2879a9397',
  frostGiantPatrol: 's6e9e4e5fed93',
  galvanPatrol: 's0e7de9eb0856',
  hypnosPatrol: 's5e478719965f',
  nothics: 's1370f6b8b1cf',
  iriolarthas: 'sa821572a2366',
  avaricePatrol: 's48a5bf192725',
} satisfies Record<string, string | null>;
export const expeditionMaterials: Record<'rules' | 'table' | Faction, MaterialTarget> = {
  rules: { id: 'sb02bd36e8ce2' },
  table: { id: 'sc5b87ae42023' },
  avarice: { id: 's48a5bf192725', anchor: 's4ac46b8e085b' },
  auril: { id: 's3c8d64e2e21c' },
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
function check(value: unknown, minute: number): value is EncounterCheck {
  return (
    record(value) &&
    integer(value['id'], 1, 52_560_000) &&
    integer(value['minute'], 1, minute) &&
    (value['kind'] === 'hourly' ||
      value['kind'] === 'building' ||
      value['kind'] === 'avaricePatrol')
  );
}
function arrival(value: unknown, minute: number): value is ArrivalView {
  if (
    !record(value) ||
    typeof value['enabled'] !== 'boolean' ||
    typeof value['pending'] !== 'boolean'
  ) {
    return false;
  }
  const deadline = value['deadline'],
    arrived = value['arrivedAt'];
  if (
    (deadline !== null && !integer(deadline, 0, 52_560_000)) ||
    (arrived !== null && !integer(arrived, 0, minute)) ||
    (!value['enabled'] && arrived !== null)
  ) {
    return false;
  }
  return (
    value['remainingMinutes'] === (deadline === null ? null : Math.max(0, deadline - minute)) &&
    value['pending'] ===
      (value['enabled'] && arrived === null && deadline !== null && minute >= deadline)
  );
}
function readOutcome(value: unknown): EncounterOutcome | undefined {
  return Object.keys(encounterMaterials).find((key): key is EncounterOutcome => key === value);
}
function readTable(value: unknown): EncounterBand[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 9) {
    return null;
  }
  const bands: EncounterBand[] = [];
  let next = 1;
  for (const raw of value) {
    if (!record(raw) || raw['min'] !== next || !integer(raw['max'], next, 100)) {
      return null;
    }
    const outcome = readOutcome(raw['outcome']);
    if (!outcome) {
      return null;
    }
    bands.push({ min: next, max: raw['max'], outcome });
    next = raw['max'] + 1;
  }
  return next === 101 ? bands : null;
}
export function readExpeditionView(state: GameStateDto): ExpeditionView | null {
  const minute = state.snapshot.timeMinutes;
  if (state.snapshot.moduleSchemaVersion !== 4 || !record(state.moduleView)) {
    return null;
  }
  const view = state.moduleView['expedition'];
  if (
    !record(view) ||
    typeof view['aurilEnabled'] !== 'boolean' ||
    !integer(view['explorationMinutes'], 0, minute) ||
    view['nextHourlyIn'] !== 60 - (view['explorationMinutes'] % 60) ||
    !Array.isArray(view['pending']) ||
    view['pending'].length > 240 ||
    !arrival(view['avarice'], minute) ||
    !arrival(view['auril'], minute)
  ) {
    return null;
  }
  const avarice = view['avarice'],
    auril = view['auril'];
  if (
    !avarice.enabled ||
    avarice.deadline !== (state.snapshot.restEnds[0] ?? null) ||
    auril.deadline !== 1440 ||
    auril.enabled !== view['aurilEnabled']
  ) {
    return null;
  }
  const pending: EncounterCheck[] = [];
  for (const item of view['pending']) {
    const previous = pending[pending.length - 1];
    if (
      !check(item, minute) ||
      (previous && (item.id <= previous.id || item.minute < previous.minute))
    ) {
      return null;
    }
    pending.push(item);
  }
  const pendingTable = readTable(view['pendingTable']);
  if (pending.length > 0 ? pendingTable === null : view['pendingTable'] !== null) {
    return null;
  }
  let lastResult: EncounterResult | null = null;
  const raw = view['lastResult'];
  if (raw !== null) {
    if (
      !record(raw) ||
      !check(raw['check'], minute) ||
      !integer(raw['roll'], 1, 100) ||
      typeof raw['outcome'] !== 'string' ||
      !Object.hasOwn(encounterMaterials, raw['outcome']) ||
      (pending[0] && raw['check'].id >= pending[0].id)
    ) {
      return null;
    }
    // Narrow through the defined outcomes; never cast untrusted response data.
    const outcome = readOutcome(raw['outcome']);
    if (!outcome) {
      return null;
    }
    lastResult = { check: raw['check'], roll: raw['roll'], outcome };
  }
  return {
    aurilEnabled: view['aurilEnabled'],
    explorationMinutes: view['explorationMinutes'],
    nextHourlyIn: view['nextHourlyIn'],
    pending,
    pendingTable,
    lastResult,
    avarice,
    auril,
  };
}
export function selectedEncounterRoll(
  view: ExpeditionView,
  selection: EncounterRollSelection | null,
): string {
  const check = view.pending[0];
  return check &&
    selection &&
    check.id === selection.check.id &&
    check.minute === selection.check.minute &&
    check.kind === selection.check.kind
    ? selection.value
    : '';
}
export function encounterPreview(
  view: ExpeditionView,
  selection: EncounterRollSelection | null,
): EncounterOutcome | null {
  const roll = Number(selectedEncounterRoll(view, selection));
  return integer(roll, 1, 100)
    ? (view.pendingTable?.find((band) => roll >= band.min && roll <= band.max)?.outcome ?? null)
    : null;
}
export function explorationAction(minutes: number): GameAction | null {
  return integer(minutes, 1, 1440)
    ? { kind: 'module', minutes, command: { kind: 'explore' } }
    : null;
}
export function buildingAction(unnumbered: boolean, newBuilding: boolean): GameAction {
  return {
    kind: 'module',
    minutes: 30,
    command: { kind: 'searchBuilding', unnumbered, newBuilding },
  };
}
export function encounterAction(view: ExpeditionView, id: number, roll: number): GameAction | null {
  return view.pending[0]?.id === id && integer(roll, 1, 100)
    ? { kind: 'module', command: { kind: 'resolveEncounter', checkId: id, roll } }
    : null;
}
