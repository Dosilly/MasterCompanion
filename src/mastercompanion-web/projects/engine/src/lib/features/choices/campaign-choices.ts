import type { CampaignFolder, MaterialSummary } from '@mastercompanion/contracts';
import type { ChoiceOption } from '@mastercompanion/ui';
import { folderPath } from '../workspace/navigation';

export function folderChoices(folders: readonly CampaignFolder[]): readonly ChoiceOption[] {
  const names = new Map(folders.map((folder) => [folder.id, folder.title]));
  return distinguishChoices(
    folders.map((folder) => ({
      id: folder.id,
      label: folder.title,
      detail: folderPath(folders, folder.id)
        .map((id) => names.get(id))
        .join(' / '),
    })),
  );
}

export function materialChoices(
  materials: readonly MaterialSummary[],
  folders: readonly CampaignFolder[],
  unfiledLabel: string,
): readonly ChoiceOption[] {
  const paths = new Map(folderChoices(folders).map((folder) => [folder.id, folder.detail]));
  return distinguishChoices(
    materials.map((material) => ({
      id: material.id,
      label: material.title,
      detail: material.folderId ? (paths.get(material.folderId) ?? material.group) : unfiledLabel,
    })),
  );
}

// Paths identify duplicate titles; same-path duplicates additionally show their stable identity.
function distinguishChoices(options: readonly ChoiceOption[]): readonly ChoiceOption[] {
  const counts = new Map<string, number>();
  for (const option of options) {
    const key = `${option.label}\u0000${option.detail ?? ''}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return options.map((option) =>
    (counts.get(`${option.label}\u0000${option.detail ?? ''}`) ?? 0) > 1
      ? { ...option, detail: `${option.detail ?? ''} · ${option.id}` }
      : option,
  );
}
