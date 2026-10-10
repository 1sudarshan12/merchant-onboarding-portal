import { Routes } from '@angular/router';
import { authChildGuard, authGuard, guestGuard, permissionGuard } from './core/auth/auth.guard';
import type { ApplicationWizard } from './features/application-wizard/application-wizard';

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
        path: 'applications/new',
        title: 'New application | Merchant Portal',
        canActivate: [permissionGuard('application:create')],
        canDeactivate: [(component: ApplicationWizard) => component.canLeave()],
        loadComponent: () =>
          import('./features/application-wizard/application-wizard').then(
            (m) => m.ApplicationWizard,
          ),
      },
      {
        path: 'applications/:id/edit',
        title: 'Edit draft | Merchant Portal',
        canActivate: [permissionGuard('application:edit')],
        canDeactivate: [(component: ApplicationWizard) => component.canLeave()],
        loadComponent: () =>
          import('./features/application-wizard/application-wizard').then(
            (m) => m.ApplicationWizard,
          ),
      },
      {
        path: 'applications/:id',
        title: 'Application detail | Merchant Portal',
        loadComponent: () =>
          import('./features/application-detail/application-detail').then(
            (m) => m.ApplicationDetailPage,
          ),
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
