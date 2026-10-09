import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'overview' },
  {
    path: 'overview',
    title: 'Workspace overview | Merchant Portal',
    loadComponent: () => import('./features/workspace/workspace').then((m) => m.Workspace),
  },
];
