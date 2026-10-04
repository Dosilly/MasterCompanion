import type { GameAction, GameStateDto } from '@mastercompanion/contracts';

export const forceUnits = {
  avarice: ['cultFanatics', 'gargoyles', 'ravens', 'mountainGoats'],
  auril: ['frostGiantSkeletons', 'snowGolems', 'winterWolves', 'coldlightWalkers'],
} as const;
export type ForceUnit = (typeof forceUnits)[keyof typeof forceUnits][number];
export interface RivalForcesView {
  readonly cultFanatics: number;
  readonly gargoyles: number;
  readonly ravens: number;
  readonly mountainGoats: number;
  readonly frostGiantSkeletons: number;
  readonly snowGolems: number;
  readonly winterWolves: number;
  readonly coldlightWalkers: number;
  readonly convertedCultists: number;
}
export const initialForces: Readonly<Record<ForceUnit, number>> = {
  cultFanatics: 20,
  gargoyles: 2,
  ravens: 1,
  mountainGoats: 10,
  frostGiantSkeletons: 3,
  snowGolems: 6,
  winterWolves: 6,
  coldlightWalkers: 0,
};
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function count(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}
export function readRivalForcesView(state: GameStateDto): RivalForcesView | null {
  if (state.snapshot.moduleSchemaVersion !== 4 || !record(state.moduleView)) {
    return null;
  }
  const forces = state.moduleView['forces'];
  if (
    !record(forces) ||
    !count(forces['convertedCultists'], 20) ||
    !count(forces['cultFanatics'], 20 - forces['convertedCultists']) ||
    !count(forces['gargoyles'], 2) ||
    !count(forces['ravens'], 1) ||
    !count(forces['mountainGoats'], 10) ||
    !count(forces['frostGiantSkeletons'], 3) ||
    !count(forces['snowGolems'], 6) ||
    !count(forces['winterWolves'], 6) ||
    !count(forces['coldlightWalkers'], forces['convertedCultists'])
  ) {
    return null;
  }
  const expedition = state.moduleView['expedition'];
  if (!record(expedition) || !record(expedition['auril'])) {
    return null;
  }
  const arrival = expedition['auril']['arrivedAt'];
  if (
    arrival === null
      ? forces['convertedCultists'] !== 0
      : !count(arrival, state.snapshot.timeMinutes) || forces['cultFanatics'] !== 0
  ) {
    return null;
  }
  return {
    cultFanatics: forces['cultFanatics'],
    gargoyles: forces['gargoyles'],
    ravens: forces['ravens'],
    mountainGoats: forces['mountainGoats'],
    frostGiantSkeletons: forces['frostGiantSkeletons'],
    snowGolems: forces['snowGolems'],
    winterWolves: forces['winterWolves'],
    coldlightWalkers: forces['coldlightWalkers'],
    convertedCultists: forces['convertedCultists'],
  };
}
export function forceDeaths(view: RivalForcesView, unit: ForceUnit): number {
  const total = unit === 'coldlightWalkers' ? view.convertedCultists : initialForces[unit];
  return total - view[unit] - (unit === 'cultFanatics' ? view.convertedCultists : 0);
}
export function forceLossAction(
  view: RivalForcesView,
  unit: ForceUnit,
  losses: number,
): GameAction | null {
  return count(losses, view[unit]) && losses > 0
    ? { kind: 'module', command: { kind: 'recordForceLoss', unit, count: losses } }
    : null;
}
