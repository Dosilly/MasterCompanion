/** A match in the current persisted campaign material, with a plain-text excerpt. */
export interface MaterialSearchResult {
  id: string;
  title: string;
  folderId: string | null;
  snippet: string;
}
