import type { CampaignFolder, MaterialSummary } from '@mastercompanion/contracts';

export interface FolderNode extends CampaignFolder {
  children: FolderNode[];
  materials: MaterialSummary[];
}

export function buildNavigation(
  folders: CampaignFolder[],
  materials: MaterialSummary[],
  query: string,
  unfiledTitle: string,
  locale = 'en',
): FolderNode[] {
  const nodes = new Map(
    folders.map((folder) => [folder.id, { ...folder, children: [], materials: [] } as FolderNode]),
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
  const search = query.trim().toLocaleLowerCase(locale);
  const filter = (node: FolderNode): FolderNode => ({
    ...node,
    materials: node.materials.filter(
      (material) => !search || material.title.toLocaleLowerCase(locale).includes(search),
    ),
    children: node.children
      .map(filter)
      .filter((node) => !search || node.materials.length || node.children.length),
  });
  return roots
    .map(filter)
    .filter((node) => !search || node.materials.length || node.children.length);
}

export function folderPath(folders: CampaignFolder[], folderId: string | null): string[] {
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
