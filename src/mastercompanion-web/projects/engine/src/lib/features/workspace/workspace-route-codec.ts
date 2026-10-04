import {
  DefaultUrlSerializer,
  PRIMARY_OUTLET,
  UrlSegment,
  UrlSegmentGroup,
  UrlTree,
} from '@angular/router';
import type { WorkspaceDto } from '@mastercompanion/contracts';
import type { WorkspaceRouteError } from './workspace-route-state';
import type { WorkspaceRouteTarget } from './workspace-route-target';

type DecodedRoute =
  | { kind: 'default' }
  | { kind: 'target'; target: WorkspaceRouteTarget }
  | { kind: 'error'; code: WorkspaceRouteError };

const serializer = new DefaultUrlSerializer();
const safeIdentifier = /^[^\u0000-\u0020\u007f/\\?#]{1,80}$/u;
const safeAnchor = /^[^\u0000-\u0020\u007f/\\?#]{1,300}$/;

export function decodeWorkspaceRoute(url: string, workspace: WorkspaceDto): DecodedRoute {
  let tree: UrlTree;
  try {
    tree = serializer.parse(url);
  } catch {
    return { kind: 'error', code: 'invalidRoute' };
  }
  const primary = tree.root.children[PRIMARY_OUTLET];
  if (
    Object.keys(tree.queryParams).length ||
    Object.keys(tree.root.children).some((outlet) => outlet !== PRIMARY_OUTLET) ||
    (primary && Object.keys(primary.children).length) ||
    primary?.segments.some((segment) => Object.keys(segment.parameters).length)
  ) {
    return { kind: 'error', code: 'invalidRoute' };
  }
  const segments = primary?.segments.map((segment) => segment.path) ?? [];
  if (!segments.length && tree.fragment === null) {
    return { kind: 'default' };
  }
  const [area, id] = segments;
  if (segments.length === 2 && area === 'materials' && id && safeIdentifier.test(id)) {
    if (tree.fragment !== null && !safeAnchor.test(tree.fragment)) {
      return { kind: 'error', code: 'invalidRoute' };
    }
    return {
      kind: 'target',
      target: {
        kind: 'material',
        materialId: id,
        ...(tree.fragment === null ? {} : { anchor: tree.fragment }),
      },
    };
  }
  if (tree.fragment !== null) {
    return { kind: 'error', code: 'invalidRoute' };
  }
  if (segments.length === 2 && area === 'maps' && id && safeIdentifier.test(id)) {
    return workspace.maps.some((map) => map.id === id)
      ? { kind: 'target', target: { kind: 'map', mapId: id } }
      : { kind: 'error', code: 'mapNotFound' };
  }
  if (segments.length === 1) {
    switch (area) {
      case 'game':
        return { kind: 'target', target: { kind: 'game' } };
      case 'party':
        return { kind: 'target', target: { kind: 'party' } };
      case 'workspace':
        return { kind: 'target', target: { kind: 'empty' } };
    }
  }
  return { kind: 'error', code: 'invalidRoute' };
}

export function workspaceRouteUrl(target: WorkspaceRouteTarget): string {
  let paths: string[];
  switch (target.kind) {
    case 'material':
      paths = ['materials', target.materialId];
      break;
    case 'map':
      paths = ['maps', target.mapId];
      break;
    case 'empty':
      paths = ['workspace'];
      break;
    default:
      paths = [target.kind];
  }
  const primary = new UrlSegmentGroup(
    paths.map((path) => new UrlSegment(path, {})),
    {},
  );
  return serializer.serialize(
    new UrlTree(
      new UrlSegmentGroup([], { [PRIMARY_OUTLET]: primary }),
      {},
      target.kind === 'material' ? (target.anchor ?? null) : null,
    ),
  );
}
