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
    <div class="login-page">
      <section class="hero-panel">
        <div class="hero-glow hero-glow-a"></div>
        <div class="hero-glow hero-glow-b"></div>
        <div class="hero-content">
          <span class="hero-mark"><mat-icon>support_agent</mat-icon></span>
          <h1>Support Ticket Management</h1>
          <p>Track, triage and resolve customer issues in one place — built for support teams that move fast.</p>
          <ul class="hero-points">
            <li><mat-icon>bolt</mat-icon><span>Real-time ticket activity &amp; timelines</span></li>
            <li><mat-icon>groups</mat-icon><span>Smart agent workload visibility</span></li>
            <li><mat-icon>insights</mat-icon><span>At-a-glance performance dashboards</span></li>
          </ul>
        </div>
      </section>

      <section class="form-panel">
        <mat-card class="login-card">
          <mat-card-content>
            <div class="login-card-header">
              <span class="login-avatar"><mat-icon>lock</mat-icon></span>
              <h2>Sign in</h2>
              <p class="subtitle">Welcome back — enter your details to continue.</p>
            </div>

            <form [formGroup]="form" (ngSubmit)="submit()" class="login-form">
              <mat-form-field appearance="outline">
                <mat-label>Email</mat-label>
                <input matInput type="email" formControlName="email" autocomplete="username" required />
                <mat-icon matSuffix>mail</mat-icon>
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
                <p class="error-message">
                  <mat-icon>error</mat-icon>
                  {{ errorMessage() }}
                </p>
              }

              <button mat-flat-button color="primary" type="submit" class="submit-button" [disabled]="isSubmitting()">
                @if (isSubmitting()) {
                  <mat-progress-spinner diameter="20" mode="indeterminate" />
                } @else {
                  Sign in
                }
              </button>
            </form>

            <p class="dev-hint">
              Development accounts (see README): admin&#64;example.com, agent1&#64;example.com, customer1&#64;example.com, ...
            </p>
          </mat-card-content>
        </mat-card>
      </section>
    </div>
  `,
  styles: [`
    .login-page {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr);
      min-height: calc(100vh - 64px);
      margin: -20px;
    }

    .hero-panel {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 48px;
      background: linear-gradient(160deg, var(--mat-sys-primary, #6247aa) 0%, #4a2f8f 55%, #2c1a5e 100%);
      color: #fff;
    }

    .hero-glow {
      position: absolute;
      border-radius: 50%;
      filter: blur(60px);
      opacity: 0.55;
      pointer-events: none;
    }
    .hero-glow-a { width: 360px; height: 360px; background: var(--mat-sys-tertiary, #e0568f); top: -80px; right: -80px; }
    .hero-glow-b { width: 300px; height: 300px; background: #7c3aed; bottom: -100px; left: -60px; }

    .hero-content {
      position: relative;
      max-width: 420px;
    }

    .hero-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 56px;
      height: 56px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.15);
      margin-bottom: 24px;
    }
    .hero-mark mat-icon { font-size: 28px; width: 28px; height: 28px; }

    .hero-content h1 {
      font-size: 2.1rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      margin: 0 0 12px;
      line-height: 1.2;
    }

    .hero-content > p {
      opacity: 0.85;
      line-height: 1.5;
      margin: 0 0 28px;
    }

    .hero-points {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .hero-points li {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 0.9rem;
      opacity: 0.92;
    }
    .hero-points mat-icon {
      flex-shrink: 0;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 6px;
      box-sizing: content-box;
      width: 18px;
      height: 18px;
      font-size: 18px;
    }

    .form-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
    }

    .login-card {
      width: 100%;
      max-width: 400px;
      border: none !important;
      box-shadow: none !important;
    }

    .login-card-header {
      text-align: center;
      margin-bottom: 20px;
    }

    .login-avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 14px;
      background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
      color: var(--mat-sys-primary);
      margin-bottom: 12px;
    }

    .login-card-header h2 {
      margin: 0 0 4px;
      font-size: 1.4rem;
      font-weight: 700;
    }

    .login-card-header .subtitle {
      margin: 0;
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
    }

    .login-form { display: flex; flex-direction: column; gap: 4px; }
    .submit-button { height: 44px; margin-top: 8px; font-weight: 600; }
    .error-message {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--mat-sys-error);
      margin: 0 0 8px;
      font-size: 0.875rem;
    }
    .error-message mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .dev-hint { margin: 20px 0 0; font-size: 0.75rem; opacity: 0.6; text-align: center; }

    @media (max-width: 900px) {
      .login-page { grid-template-columns: 1fr; }
      .hero-panel { display: none; }
    }
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
