export interface OpenTabItem {
  readonly id: string;
  readonly title: string;
  readonly context: string;
  readonly dirty: boolean;
  readonly closing: boolean;
}
