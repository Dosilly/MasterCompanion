export interface SessionRecord {
  readonly id: string;
  readonly title: string;
  readonly status: 'planned' | 'active' | 'completed';
  readonly preparationMaterialId: string;
  readonly notesMaterialId: string;
  readonly summary: string;
  readonly followUp: string;
  readonly pinnedMaterialIds: readonly string[];
}
