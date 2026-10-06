import type { Routes } from '@angular/router';
import { Workspace } from '@mastercompanion/engine';

// One parent owns mounted sessions; componentless children only select a location.
export const appRoutes: Routes = [
  {
    path: '',
    component: Workspace,
    children: [
      { path: '', pathMatch: 'full', children: [] },
      { path: 'materials/:materialId', children: [] },
      { path: 'maps/:mapId', children: [] },
      { path: 'game', children: [] },
      { path: 'party', children: [] },
      { path: 'sessions', children: [] },
      { path: 'sessions/:sessionId', children: [] },
      { path: 'workspace', children: [] },
      { path: '**', children: [] },
    ],
  },
];
