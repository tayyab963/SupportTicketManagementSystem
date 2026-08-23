import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiErrorResponse } from '../../../../core/models/api-response.model';
import { AuthService } from '../../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <mat-card class="login-card">
      <mat-card-header>
        <mat-card-title>Sign in</mat-card-title>
        <mat-card-subtitle>Support Ticket Management System</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input matInput type="email" formControlName="email" autocomplete="username" required />
            @if (form.controls.email.invalid && form.controls.email.touched) {
              <mat-error>A valid email is required.</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input
              matInput
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="current-password"
              required
            />
            <button
              mat-icon-button
              matSuffix
              type="button"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              (click)="showPassword.set(!showPassword())"
            >
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (form.controls.password.invalid && form.controls.password.touched) {
              <mat-error>Password is required.</mat-error>
            }
          </mat-form-field>

          @if (errorMessage()) {
            <p class="error-message">{{ errorMessage() }}</p>
          }

          <button mat-flat-button color="primary" type="submit" class="submit-button" [disabled]="isSubmitting()">
            @if (isSubmitting()) {
              <mat-progress-spinner diameter="20" mode="indeterminate" />
            } @else {
              Sign in
            }
          </button>
        </form>
      </mat-card-content>

      <mat-card-footer class="dev-hint">
        <p>Development accounts (see README): admin&#64;example.com, agent1&#64;example.com, customer1&#64;example.com, ...</p>
      </mat-card-footer>
    </mat-card>
  `,
  styles: [`
    .login-card { max-width: 400px; margin: 48px auto; }
    .login-form { display: flex; flex-direction: column; gap: 4px; }
    .submit-button { height: 40px; margin-top: 8px; }
    .error-message { color: var(--mat-sys-error); margin: 0 0 8px; font-size: 0.875rem; }
    .dev-hint { padding: 0 16px 16px; font-size: 0.75rem; opacity: 0.6; }
  `]
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        void this.router.navigateByUrl(returnUrl);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        const body = error.error as ApiErrorResponse | undefined;
        this.errorMessage.set(body?.message ?? 'Login failed. Please try again.');
      }
    });
  }
}
