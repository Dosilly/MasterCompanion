import type { ToolRegistration } from './tool-registration';

export interface CampaignModuleFrontend {
  id: string;
  name: string;
  version: string;
  tools: readonly ToolRegistration[];
}
