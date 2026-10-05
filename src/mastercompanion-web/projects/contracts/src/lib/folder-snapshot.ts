import type { CampaignFolder } from './campaign-folder';

export interface FolderSnapshot {
  revision: number;
  folders: CampaignFolder[];
  materialOrder: { id: string; folderId: string | null }[];
}
