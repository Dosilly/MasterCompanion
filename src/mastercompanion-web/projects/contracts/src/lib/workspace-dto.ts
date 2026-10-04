import type { MaterialSummary } from './material-summary';
import type { CampaignFolder } from './campaign-folder';
import type { CampaignMap } from './campaign-map';

export interface WorkspaceDto {
  campaignId: string;
  title: string;
  moduleId: string;
  moduleVersion: string;
  startMaterialId: string;
  materials: MaterialSummary[];
  folders: CampaignFolder[];
  foldersRevision: number;
  maps: CampaignMap[];
}
