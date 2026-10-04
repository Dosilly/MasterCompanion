export type FolderOperation =
  | { kind: 'rename'; folderId: string; title: string }
  | { kind: 'move'; folderId: string; parentId: string | null; beforeId: string | null };
