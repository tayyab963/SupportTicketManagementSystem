import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { UserRole } from './core/models/enums';

export const routes: Routes = [
  // 'tickets' (not 'dashboard') is the universal landing page — Customer, SupportAgent and Admin can
  // all use it, whereas the dashboard below is Admin-only and would otherwise bounce every other role.
  { path: '', pathMatch: 'full', redirectTo: 'tickets' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'dashboard',
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.Admin] },
    loadComponent: () =>
      import('./features/dashboard/pages/dashboard/dashboard.component').then((m) => m.DashboardComponent)
  },
  {
    path: 'tickets',
    canActivate: [authGuard],
    loadChildren: () => import('./features/tickets/tickets.routes').then((m) => m.TICKETS_ROUTES)
  },
  {
    path: 'users',
    canActivate: [authGuard, roleGuard],
    data: { roles: [UserRole.Admin] },
    loadComponent: () =>
      import('./features/users/pages/user-list/user-list.component').then((m) => m.UserListComponent)
  },
  {
    path: 'profile',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/profile/pages/profile/profile.component').then((m) => m.ProfileComponent)
  },
  { path: '**', redirectTo: 'tickets' }
];
