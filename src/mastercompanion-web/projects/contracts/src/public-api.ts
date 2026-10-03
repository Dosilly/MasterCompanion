import { InjectionToken, Signal, Type } from '@angular/core';

export interface RichDocument {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: RichDocument[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}
export interface MaterialSummary { id: string; title: string; group: string; folderId: string | null; }
export interface CreateMaterialRequest { id: string; title: string; folderId: string | null; }
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

export interface GameCharacter { id: string; name: string; }
export interface GameSnapshot {
  timeMinutes: number; party: GameCharacter[]; restEnds: number[];
  moduleSchemaVersion: number; moduleState: unknown;
}
export interface GameOperationSummary { requestId: string; kind: string; revision: number; }
export interface GameStateDto {
  revision: number; snapshot: GameSnapshot; moduleView: unknown; lastOperation: GameOperationSummary | null;
}
export type GameAction =
  | { kind: 'configureParty' | 'updateParty'; party: GameCharacter[] }
  | { kind: 'advanceTime'; minutes: number }
  | { kind: 'shortRest' | 'longRest' | 'undo' }
  | { kind: 'module'; command: unknown; minutes?: number };
export type GameOperationRequest = GameAction & { requestId: string; expectedRevision: number };
export interface MaterialTarget { id: string; anchor?: string; }
export interface GameToolContext {
  readonly state: Signal<GameStateDto | null>;
  readonly pending: Signal<boolean>;
  readonly canOperate: Signal<boolean>;
  execute(action: GameAction): Promise<boolean>;
  openMaterial(target: MaterialTarget): void;
}
export const CAMPAIGN_GAME = new InjectionToken<GameToolContext>('MasterCompanion campaign game');
