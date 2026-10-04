import { InjectionToken } from '@angular/core';
import type { CampaignModuleFrontend } from './campaign-module-frontend';

export const CAMPAIGN_MODULES = new InjectionToken<readonly CampaignModuleFrontend[]>(
  'MasterCompanion campaign modules',
);
