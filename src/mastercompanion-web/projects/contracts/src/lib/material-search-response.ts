import type { MaterialSearchResult } from './material-search-result';

/** At most 50 material matches; hasMore reports additional matches beyond this limit. */
export interface MaterialSearchResponse {
  results: MaterialSearchResult[];
  hasMore: boolean;
}
