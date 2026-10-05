import type { CampaignFolder, FolderOperation, FolderSnapshot } from '@mastercompanion/contracts';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validFolderId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 80 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value)
  );
}

export function validFolderTitle(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= 300 &&
    value.trim() === value &&
    !/[\u0000-\u001f\u007f-\u009f]/.test(value)
  );
}

export function isFolderOperation(value: unknown): value is FolderOperation {
  if (!record(value)) {
    return false;
  }
  if (value['kind'] === 'reorderMaterial') {
    return (
      Object.keys(value).length === 4 &&
      validFolderId(value['materialId']) &&
      (value['folderId'] === null || validFolderId(value['folderId'])) &&
      (value['beforeId'] === null || validFolderId(value['beforeId']))
    );
  }
  if (!validFolderId(value['folderId'])) {
    return false;
  }
  if (value['kind'] === 'rename') {
    return Object.keys(value).length === 3 && validFolderTitle(value['title']);
  }
  return (
    value['kind'] === 'move' &&
    Object.keys(value).length === 4 &&
    (value['parentId'] === null || validFolderId(value['parentId'])) &&
    (value['beforeId'] === null || validFolderId(value['beforeId']))
  );
}

export function canMoveFolder(
  folders: readonly CampaignFolder[],
  folderId: string,
  parentId: string | null,
  beforeId: string | null = null,
): boolean {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  if (!byId.has(folderId) || (parentId !== null && !byId.has(parentId))) {
    return false;
  }
  if (beforeId !== null && (beforeId === folderId || byId.get(beforeId)?.parentId !== parentId)) {
    return false;
  }
  const visited = new Set<string>();
  while (parentId !== null) {
    if (parentId === folderId || visited.has(parentId)) {
      return false;
    }
    visited.add(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return true;
}

export function isFolderSnapshot(value: unknown): value is FolderSnapshot {
  if (
    !record(value) ||
    !Number.isSafeInteger(value['revision']) ||
    Number(value['revision']) < 0 ||
    !Array.isArray(value['materialOrder']) ||
    !Array.isArray(value['folders']) ||
    value['folders'].length > 10_000
  ) {
    return false;
  }
  const folders: CampaignFolder[] = [];
  const ids = new Set<string>();
  for (const item of value['folders']) {
    if (
      !record(item) ||
      !validFolderId(item['id']) ||
      ids.has(item['id']) ||
      !validFolderTitle(item['title']) ||
      !(item['parentId'] === null || validFolderId(item['parentId']))
    ) {
      return false;
    }
    ids.add(item['id']);
    folders.push({ id: item['id'], title: item['title'], parentId: item['parentId'] });
  }
  const materialIds = new Set<string>();
  for (const item of value['materialOrder']) {
    if (
      !record(item) ||
      !validFolderId(item['id']) ||
      materialIds.has(item['id']) ||
      !(item['folderId'] === null || (validFolderId(item['folderId']) && ids.has(item['folderId'])))
    ) {
      return false;
    }
    materialIds.add(item['id']);
  }
  return folders.every((folder) => canMoveFolder(folders, folder.id, folder.parentId));
}

export function confirmsFolderOperation(
  snapshot: FolderSnapshot,
  operation: FolderOperation,
): boolean {
  if (operation.kind === 'reorderMaterial') {
    const siblings = snapshot.materialOrder.filter((item) => item.folderId === operation.folderId);
    const index = siblings.findIndex((item) => item.id === operation.materialId);
    return index >= 0 && (siblings[index + 1]?.id ?? null) === operation.beforeId;
  }
  const folder = snapshot.folders.find((item) => item.id === operation.folderId);
  if (!folder) {
    return false;
  }
  if (operation.kind === 'rename') {
    return folder.title === operation.title;
  }
  if (folder.parentId !== operation.parentId) {
    return false;
  }
  const siblings = snapshot.folders.filter((item) => item.parentId === operation.parentId);
  const next = siblings[siblings.findIndex((item) => item.id === operation.folderId) + 1];
  return (next?.id ?? null) === operation.beforeId;
}

export function canReorderMaterial(
  snapshot: FolderSnapshot,
  materialId: string,
  folderId: string | null,
  beforeId: string | null,
): boolean {
  const material = snapshot.materialOrder.find((item) => item.id === materialId);
  return (
    material !== undefined &&
    material.folderId === folderId &&
    (beforeId === null ||
      (beforeId !== materialId &&
        snapshot.materialOrder.some((item) => item.id === beforeId && item.folderId === folderId)))
  );
}
