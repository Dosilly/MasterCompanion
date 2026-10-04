import type { WorkspaceRouteTarget } from './workspace-route-target';

export type WorkspaceRouteError =
  | 'invalidRoute'
  | 'mapNotFound'
  | 'materialNotFound'
  | 'materialLoadFailed'
  | 'sectionNotFound'
  | 'navigationFailed';

export type WorkspaceRouteResult = { kind: 'ready' } | { kind: 'error'; code: WorkspaceRouteError };

export type WorkspaceRouteState =
  | { kind: 'waiting' }
  | { kind: 'pending'; target: WorkspaceRouteTarget }
  | { kind: 'ready'; target: WorkspaceRouteTarget }
  | { kind: 'error'; code: WorkspaceRouteError; target: WorkspaceRouteTarget | null };
