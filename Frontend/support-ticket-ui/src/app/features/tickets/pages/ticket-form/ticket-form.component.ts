import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ApiErrorResponse } from '../../../../core/models/api-response.model';
import { TicketPriority } from '../../../../core/models/enums';
import { TicketService } from '../../../../core/services/ticket.service';

@Component({
  selector: 'app-ticket-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <mat-card class="form-card">
      <mat-card-header class="form-header">
        <span class="header-icon"><mat-icon>{{ ticketId() ? 'edit_note' : 'add_circle' }}</mat-icon></span>
        <mat-card-title>{{ ticketId() ? 'Edit Ticket' : 'New Ticket' }}</mat-card-title>
      </mat-card-header>

      <mat-card-content>
        @if (loading()) {
          <mat-progress-spinner diameter="32" mode="indeterminate" class="loading-spinner" />
        } @else {
          <form [formGroup]="form" (ngSubmit)="submit()" class="ticket-form">
            <mat-form-field appearance="outline">
              <mat-label>Title</mat-label>
              <input matInput formControlName="title" maxlength="200" required />
              @if (form.controls.title.invalid && form.controls.title.touched) {
                <mat-error>Title is required (max 200 characters).</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Description</mat-label>
              <textarea matInput formControlName="description" rows="6" required></textarea>
              @if (form.controls.description.invalid && form.controls.description.touched) {
                <mat-error>Description is required.</mat-error>
              }
            </mat-form-field>

            @if (!ticketId()) {
              <mat-form-field appearance="outline">
                <mat-label>Priority</mat-label>
                <mat-select formControlName="priority" required>
                  @for (value of priorityOptions; track value) {
                    <mat-option [value]="value">{{ value }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            @if (errorMessage()) {
              <p class="error-message">{{ errorMessage() }}</p>
            }

            <div class="actions">
              <button mat-button type="button" (click)="cancel()">Cancel</button>
              <button mat-flat-button color="primary" type="submit" [disabled]="isSubmitting()">
                @if (isSubmitting()) {
                  <mat-progress-spinner diameter="20" mode="indeterminate" />
                } @else {
                  {{ ticketId() ? 'Save Changes' : 'Create Ticket' }}
                }
              </button>
            </div>
          </form>
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .form-card { max-width: 640px; margin: 24px auto; }
    .form-header { display: flex; align-items: center; gap: 12px; }
    .header-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 12px;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--mat-sys-primary) 12%, transparent);
      color: var(--mat-sys-primary);
    }
    .ticket-form { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
    .error-message { color: var(--mat-sys-error); margin: 0 0 8px; font-size: 0.875rem; }
    .loading-spinner { margin: 32px auto; }
  `]
})
export class TicketFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly priorityOptions = Object.values(TicketPriority);
  protected readonly ticketId = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: ['', [Validators.required]],
    priority: [TicketPriority.Medium, [Validators.required]]
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.ticketId.set(id);
    this.loading.set(true);
    this.ticketService.getTicket(id).subscribe({
      next: (ticket) => {
        this.form.patchValue({ title: ticket.title, description: ticket.description });
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { title, description, priority } = this.form.getRawValue();
    const id = this.ticketId();

    const request$ = id
      ? this.ticketService.updateTicket(id, { title, description })
      : this.ticketService.createTicket({ title, description, priority });

    const wasEdit = !!id;
    request$.subscribe({
      next: (ticket) => {
        this.snackBar.open(wasEdit ? 'Ticket updated.' : 'Ticket created.', 'Dismiss', { duration: 3000 });
        void this.router.navigate(['/tickets', ticket.id]);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        const body = error.error as ApiErrorResponse | undefined;
        this.errorMessage.set(body?.message ?? 'Could not save the ticket. Please try again.');
      }
    });
  }

  protected cancel(): void {
    const id = this.ticketId();
    void this.router.navigate(id ? ['/tickets', id] : ['/tickets']);
  }
}
