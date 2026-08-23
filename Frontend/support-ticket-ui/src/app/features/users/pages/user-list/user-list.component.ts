import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <mat-card-header>
        <mat-card-title>User Management</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Admin user management will be implemented in the user management phase.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .placeholder-card { margin: 24px; }
  `]
})
export class UserListComponent {}
