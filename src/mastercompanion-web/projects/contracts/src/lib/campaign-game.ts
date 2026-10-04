import { InjectionToken } from '@angular/core';
import type { GameToolContext } from './game-tool-context';

export const CAMPAIGN_GAME = new InjectionToken<GameToolContext>('MasterCompanion campaign game');
