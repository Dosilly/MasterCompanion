import type { RichDocument } from './rich-document';
import type { MaterialSummary } from './material-summary';

export interface MaterialDto extends MaterialSummary {
  document: RichDocument;
  documentSchemaVersion: number;
  revision: number;
}
