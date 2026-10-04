export interface RichDocument {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: RichDocument[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}
