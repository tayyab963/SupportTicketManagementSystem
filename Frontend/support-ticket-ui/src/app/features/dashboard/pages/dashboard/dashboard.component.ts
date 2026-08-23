import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <mat-card-header>
        <mat-card-title>Dashboard</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Ticket summary cards and charts will be implemented in the dashboard phase.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .placeholder-card { margin: 24px; }
  `]
})
export class DashboardComponent {}
