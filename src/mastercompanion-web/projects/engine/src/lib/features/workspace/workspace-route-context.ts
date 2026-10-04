/** Activation may finish after another location was requested. */
export interface WorkspaceRouteContext {
  isCurrent(): boolean;
  focusTab: boolean;
}
