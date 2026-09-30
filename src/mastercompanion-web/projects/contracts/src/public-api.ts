import { InjectionToken, Type } from '@angular/core';

export interface RichDocument {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: RichDocument[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}
export interface MaterialSummary { id: string; title: string; group: string; folderId: string | null; }
export interface CampaignFolder { id: string; title: string; parentId: string | null; }
export interface MaterialDto extends MaterialSummary {
  document: RichDocument; documentSchemaVersion: number; revision: number;
}
export interface MapMarker { code: string; x: number; y: number; materialId: string; title: string; }
export interface CampaignMap {
  id: string; title: string; assetId: string; width: number; height: number; markers: MapMarker[];
}
export interface WorkspaceDto {
  campaignId: string; title: string; moduleId: string; moduleVersion: string;
  startMaterialId: string;
  materials: MaterialSummary[]; folders: CampaignFolder[]; maps: CampaignMap[];
}
export interface ToolRegistration {
  id: string; label: string; loadComponent: () => Promise<Type<unknown>>;
}
export interface CampaignModuleFrontend {
  id: string; name: string; version: string; tools: readonly ToolRegistration[];
}
export const CAMPAIGN_MODULES = new InjectionToken<readonly CampaignModuleFrontend[]>('MasterCompanion campaign modules');
