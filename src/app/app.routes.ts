import { Routes } from '@angular/router';
import { authChildGuard, authGuard, guestGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    title: 'Sign in | Merchant Portal',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    canActivateChild: [authChildGuard],
    loadComponent: () => import('./layout/workspace-shell').then((m) => m.WorkspaceShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      {
        path: 'overview',
        title: 'Workspace overview | Merchant Portal',
        loadComponent: () => import('./features/workspace/workspace').then((m) => m.Workspace),
      },
      {
        path: 'applications',
        title: 'Applications | Merchant Portal',
        loadComponent: () =>
          import('./features/applications/applications').then((m) => m.Applications),
      },
    ],
  },
  { path: '**', redirectTo: 'overview' },
];
