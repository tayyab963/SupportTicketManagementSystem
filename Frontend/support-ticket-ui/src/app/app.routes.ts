import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'tickets',
    loadChildren: () => import('./features/tickets/tickets.routes').then((m) => m.TICKETS_ROUTES)
  },
  {
    path: 'users',
    loadComponent: () =>
      import('./features/users/pages/user-list/user-list.component').then((m) => m.UserListComponent)
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/pages/profile/profile.component').then((m) => m.ProfileComponent)
  },
  { path: '**', redirectTo: 'dashboard' }
];
