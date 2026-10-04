import { Type } from '@angular/core';

export interface ToolRegistration {
  id: string;
  label: string;
  loadComponent: () => Promise<Type<unknown>>;
}
