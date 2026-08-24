import { Routes } from '@angular/router';
import { roleGuard } from '../../core/guards/role.guard';
import { UserRole } from '../../core/models/enums';

export const TICKETS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/ticket-list/ticket-list.component').then((m) => m.TicketListComponent)
  },
  {
    path: 'create',
    canActivate: [roleGuard],
    data: { roles: [UserRole.Customer] },
    loadComponent: () =>
      import('./pages/ticket-form/ticket-form.component').then((m) => m.TicketFormComponent)
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/ticket-form/ticket-form.component').then((m) => m.TicketFormComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/ticket-detail/ticket-detail.component').then((m) => m.TicketDetailComponent)
  }
];
