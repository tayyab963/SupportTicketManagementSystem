import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <mat-card-header>
        <mat-card-title>My Profile</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>Profile details will be implemented in a later phase.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .placeholder-card { max-width: 500px; margin: 24px auto; }
  `]
})
export class ProfileComponent {}
