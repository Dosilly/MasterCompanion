import type { MapMarker } from './map-marker';

export interface CampaignMap {
  id: string;
  title: string;
  assetId: string;
  width: number;
  height: number;
  markers: MapMarker[];
}
