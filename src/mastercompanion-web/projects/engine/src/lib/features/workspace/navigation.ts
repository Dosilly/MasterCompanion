import type { CampaignFolder, MaterialSummary } from '@mastercompanion/contracts';

export interface FolderNode extends CampaignFolder {
  children: FolderNode[];
  materials: MaterialSummary[];
}

export function buildNavigation(
  folders: CampaignFolder[],
  materials: MaterialSummary[],
  unfiledTitle: string,
): FolderNode[] {
  const nodes = new Map<string, FolderNode>(
    folders.map((folder) => [folder.id, { ...folder, children: [], materials: [] }]),
  );
  const roots: FolderNode[] = [];
  for (const folder of nodes.values()) {
    const parent = folder.parentId ? nodes.get(folder.parentId) : undefined;
    if (folder.parentId && !parent) {
      throw new Error('A folder references a parent that does not exist.');
    }
    (parent?.children ?? roots).push(folder);
  }
  for (const material of materials) {
    const folder = material.folderId ? nodes.get(material.folderId) : undefined;
    if (folder) {
      folder.materials.push(material);
    } else {
      // Unfiled campaign materials remain reachable independently of module defaults.
      let unfiled = roots.find((node) => node.id === '@unfiled');
      if (!unfiled) {
        unfiled = {
          id: '@unfiled',
          title: unfiledTitle,
          parentId: null,
          children: [],
          materials: [],
        };
        roots.push(unfiled);
      }
      unfiled.materials.push(material);
    }
  }
  return roots;
}

export function folderPath(folders: readonly CampaignFolder[], folderId: string | null): string[] {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const path: string[] = [];
  while (folderId) {
    if (path.includes(folderId)) {
      throw new Error('The folder hierarchy contains a cycle.');
    }
    const folder = byId.get(folderId);
    if (!folder) {
      break;
    }
    path.unshift(folder.id);
    folderId = folder.parentId;
  }
  return path;
}
