export type WorkspaceRouteTarget =
  | { kind: 'material'; materialId: string; anchor?: string }
  | { kind: 'map'; mapId: string }
  | { kind: 'game' }
  | { kind: 'party' }
  | { kind: 'empty' };
