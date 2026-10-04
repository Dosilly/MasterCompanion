import { Signal } from '@angular/core';
import type { GameStateDto } from './game-state-dto';
import type { GameAction } from './game-action';
import type { MaterialTarget } from './material-target';

export interface GameToolContext {
  readonly state: Signal<GameStateDto | null>;
  readonly pending: Signal<boolean>;
  readonly canOperate: Signal<boolean>;
  execute(action: GameAction): Promise<boolean>;
  openMaterial(target: MaterialTarget): void;
}
