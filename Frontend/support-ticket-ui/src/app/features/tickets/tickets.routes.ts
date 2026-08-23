import { Routes } from '@angular/router';

export const TICKETS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/ticket-list/ticket-list.component').then((m) => m.TicketListComponent)
  },
  {
    path: 'create',
    loadComponent: () =>
      import('./pages/ticket-form/ticket-form.component').then((m) => m.TicketFormComponent)
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/ticket-detail/ticket-detail.component').then((m) => m.TicketDetailComponent)
  }
];
