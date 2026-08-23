import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <mat-card-header>
        <mat-card-title>Ticket Details</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Ticket details, timeline, comments and time tracking will be implemented in later phases.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .placeholder-card { margin: 24px; }
  `]
})
export class TicketDetailComponent {}
