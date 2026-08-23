import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="placeholder-card">
      <mat-card-header>
        <mat-card-title>Login</mat-card-title>
      </mat-card-header>
      <mat-card-content>
        <p>The login form will be implemented in the authentication phase.</p>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .placeholder-card { max-width: 400px; margin: 48px auto; }
  `]
})
export class LoginComponent {}
