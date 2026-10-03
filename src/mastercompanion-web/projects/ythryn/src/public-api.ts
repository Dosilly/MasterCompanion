import { CampaignModuleFrontend } from '@mastercompanion/contracts';
import { uiMessages } from './lib/i18n/messages';

export const ythrynModule: CampaignModuleFrontend = {
  id: 'ythryn', name: 'Ythryn', version: '0.1.0', tools: [{
    id: 'ythrynTools', label: uiMessages.expedition.title,
    loadComponent: () => import('./lib/gameplay/ythryn-tools').then(module => module.YthrynTools),
  }],
};
