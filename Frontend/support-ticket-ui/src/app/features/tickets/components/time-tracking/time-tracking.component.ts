import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiErrorResponse } from '../../../../core/models/api-response.model';
import { TimeEntrySummary, formatDuration } from '../../../../core/models/ticket.model';
import { TicketService } from '../../../../core/services/ticket.service';

/**
 * Staff-only time tracking panel: lists a ticket's time entries with a server-computed
 * (SUM(DurationMinutes)) running total, and — when `canLogTime` is true — a log-time form. Not
 * shown to customers at all; the backend rejects GET/POST for that role regardless.
 */
@Component({
  selector: 'app-time-tracking',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  template: `
    <section class="time-tracking-section">
      <h3><mat-icon>schedule</mat-icon>Time Tracking</h3>

      @if (loading()) {
        <mat-progress-spinner diameter="24" mode="indeterminate" />
      } @else if (loadError()) {
        <p class="error-message">{{ loadError() }}</p>
      } @else if (summary(); as summary) {
        <p class="total-time">
          <mat-icon>timer</mat-icon>
          Total Time: <strong>{{ formatDuration(summary.totalDurationMinutes) }}</strong>
        </p>

        @if (summary.entries.length === 0) {
          <p class="empty-state">No time logged yet.</p>
        } @else {
          <table class="simple-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Agent</th>
                <th>Duration</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of summary.entries; track entry.id) {
                <tr>
                  <td>{{ entry.workDate | date: 'mediumDate' }}</td>
                  <td>{{ entry.userName }}</td>
                  <td>{{ formatDuration(entry.durationMinutes) }}</td>
                  <td>{{ entry.description }}</td>
                </tr>
              }
            </tbody>
          </table>
        }
      }

      @if (canLogTime) {
        <form [formGroup]="timeEntryForm" (ngSubmit)="submit()" class="time-entry-form">
          <mat-form-field appearance="outline">
            <mat-label>Work date</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="workDate" [max]="today" />
            <mat-datepicker-toggle matSuffix [for]="picker" />
            <mat-datepicker #picker />
          </mat-form-field>
          <mat-form-field appearance="outline" class="minutes-field">
            <mat-label>Minutes</mat-label>
            <input matInput type="number" min="1" formControlName="durationMinutes" />
          </mat-form-field>
          <mat-form-field appearance="outline" class="description-field">
            <mat-label>Description</mat-label>
            <input matInput formControlName="description" />
          </mat-form-field>
          @if (actionError()) {
            <p class="error-message">{{ actionError() }}</p>
          }
          <button mat-stroked-button type="submit" [disabled]="timeEntryForm.invalid || submitting()">
            Log Time
          </button>
        </form>
      }
    </section>
  `,
  styles: [`
    .time-tracking-section h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 14px; font-size: 0.95rem; font-weight: 600; }
    .time-tracking-section h3 mat-icon { font-size: 18px; width: 18px; height: 18px; opacity: 0.7; }
    .total-time {
      display: flex;
      align-items: center;
      gap: 8px;
      width: fit-content;
      margin: 0 0 14px;
      padding: 6px 14px;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mat-sys-primary) 10%, transparent);
      color: var(--mat-sys-primary);
      font-size: 0.85rem;
    }
    .total-time mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .simple-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; border-radius: 12px; overflow: hidden; }
    .simple-table th { text-align: left; padding: 8px 10px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.03em; color: var(--mat-sys-on-surface-variant); background: var(--mat-sys-surface-container-low); }
    .simple-table td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.875rem; }
    .time-entry-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
    .minutes-field { max-width: 120px; }
    .description-field { flex: 1 1 200px; }
    .error-message { color: var(--mat-sys-error); font-size: 0.875rem; width: 100%; }
    .empty-state { opacity: 0.7; }
  `]
})
export class TimeTrackingComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly snackBar = inject(MatSnackBar);

  @Input({ required: true }) ticketId!: string;
  @Input() canLogTime = false;
  @Output() readonly timeEntryAdded = new EventEmitter<void>();

  protected readonly today = new Date();
  protected readonly formatDuration = formatDuration;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly summary = signal<TimeEntrySummary | null>(null);
  protected readonly submitting = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly timeEntryForm = this.fb.nonNullable.group({
    workDate: [new Date(), [Validators.required]],
    durationMinutes: [30, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketId'] && !changes['ticketId'].firstChange) {
      this.load();
    }
  }

  reload(): void {
    this.load();
  }

  protected submit(): void {
    if (this.timeEntryForm.invalid) {
      return;
    }

    this.submitting.set(true);
    this.actionError.set(null);
    const { workDate, durationMinutes, description } = this.timeEntryForm.getRawValue();
    this.ticketService.addTimeEntry(this.ticketId, { workDate: toIsoDate(workDate), durationMinutes, description }).subscribe({
      next: () => {
        this.timeEntryForm.reset({ workDate: new Date(), durationMinutes: 30, description: '' });
        this.submitting.set(false);
        this.load();
        this.timeEntryAdded.emit();
        this.snackBar.open('Time entry logged.', 'Dismiss', { duration: 3000 });
      },
      error: (error: HttpErrorResponse) => {
        this.submitting.set(false);
        const body = error.error as ApiErrorResponse | undefined;
        this.actionError.set(body?.message ?? 'That time entry could not be logged. Please try again.');
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.ticketService.getTimeEntries(this.ticketId).subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load time entries.');
      }
    });
  }
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
