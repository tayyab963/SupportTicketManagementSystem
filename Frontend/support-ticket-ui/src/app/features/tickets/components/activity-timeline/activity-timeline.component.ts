import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivityItem, activityIcon, describeActivity } from '../../../../core/models/ticket.model';
import { TicketService } from '../../../../core/services/ticket.service';

/** Read-only, chronological activity log for a ticket. Reusable: only needs a ticketId. */
@Component({
  selector: 'app-activity-timeline',
  standalone: true,
  imports: [DatePipe, MatIconModule, MatProgressSpinnerModule],
  template: `
    <section class="timeline-section">
      <h3>Activity Timeline</h3>
      @if (loading()) {
        <mat-progress-spinner diameter="24" mode="indeterminate" />
      } @else if (loadError()) {
        <p class="error-message">{{ loadError() }}</p>
      } @else if (activities().length === 0) {
        <p class="empty-state">No activity recorded yet.</p>
      } @else {
        <ol class="timeline-list">
          @for (activity of activities(); track activity.id) {
            <li>
              <mat-icon class="timeline-icon">{{ activityIcon(activity.activityType) }}</mat-icon>
              <div class="timeline-body">
                <p class="timeline-description">{{ describeActivity(activity) }}</p>
                <span class="timeline-meta">{{ activity.userName }} &middot; {{ activity.createdAt | date: 'medium' }}</span>
              </div>
            </li>
          }
        </ol>
      }
    </section>
  `,
  styles: [`
    .timeline-section h3 { margin: 0 0 8px; font-size: 0.95rem; }
    .timeline-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 14px; }
    .timeline-list li { display: flex; gap: 10px; align-items: flex-start; }
    .timeline-icon { opacity: 0.7; flex-shrink: 0; }
    .timeline-body { display: flex; flex-direction: column; }
    .timeline-description { margin: 0; font-size: 0.9rem; }
    .timeline-meta { font-size: 0.75rem; opacity: 0.6; }
    .error-message { color: var(--mat-sys-error); font-size: 0.875rem; }
    .empty-state { opacity: 0.7; }
  `]
})
export class ActivityTimelineComponent implements OnInit, OnChanges {
  private readonly ticketService = inject(TicketService);

  @Input({ required: true }) ticketId!: string;

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly activities = signal<ActivityItem[]>([]);

  protected readonly activityIcon = activityIcon;
  protected readonly describeActivity = describeActivity;

  ngOnInit(): void {
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ticketId'] && !changes['ticketId'].firstChange) {
      this.load();
    }
  }

  /** Called by the parent after any mutation that appends to the timeline (comment, time entry, status/priority/assignment change). */
  reload(): void {
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.ticketService.getTimeline(this.ticketId).subscribe({
      next: (activities) => {
        this.activities.set(activities);
        this.loading.set(false);
      },
      error: (_error: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set('Could not load the activity timeline.');
      }
    });
  }
}
