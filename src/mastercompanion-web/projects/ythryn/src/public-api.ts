import { CampaignModuleFrontend } from '@mastercompanion/contracts';
import { uiMessages } from './lib/i18n/messages';

export const ythrynModule: CampaignModuleFrontend = {
  id: 'ythryn', name: 'Ythryn', version: '0.1.0', tools: [{
    id: 'arcaneBlight', label: uiMessages.toolTitle,
    loadComponent: () => import('./lib/gameplay/blight-tool').then(module => module.BlightTool),
  }],
};
