import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-ticket-form',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <mat-card-header>
        <mat-card-title>Create Ticket</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>The ticket creation form will be implemented in the ticket management phase.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .placeholder-card { max-width: 600px; margin: 24px auto; }
  `]
})
export class TicketFormComponent {}
