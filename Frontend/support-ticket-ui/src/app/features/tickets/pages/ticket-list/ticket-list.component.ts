import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <mat-card-header>
        <mat-card-title>Tickets</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>The paginated, filterable ticket table will be implemented in the ticket management phase.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .placeholder-card { margin: 24px; }
  `]
})
export class TicketListComponent {}
