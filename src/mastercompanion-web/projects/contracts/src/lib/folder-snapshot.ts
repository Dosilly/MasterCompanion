import type { CampaignFolder } from './campaign-folder';

export interface FolderSnapshot {
  revision: number;
  folders: CampaignFolder[];
}
