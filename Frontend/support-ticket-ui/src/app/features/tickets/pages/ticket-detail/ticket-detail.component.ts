import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiErrorResponse } from '../../../../core/models/api-response.model';
import { TicketPriority, TicketStatus, UserRole } from '../../../../core/models/enums';
import { getValidNextStatuses, TicketDetail } from '../../../../core/models/ticket.model';
import { UserSummary } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { TicketService } from '../../../../core/services/ticket.service';
import { UserService } from '../../../../core/services/user.service';

const UNASSIGNED = '__unassigned__';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    @if (loading()) {
      <mat-progress-spinner diameter="32" mode="indeterminate" class="loading-spinner" />
    } @else if (loadError()) {
      <mat-card class="detail-card">
        <mat-card-content>
          <p class="error-message">{{ loadError() }}</p>
          <a mat-button routerLink="/tickets">Back to tickets</a>
        </mat-card-content>
      </mat-card>
    } @else if (ticket(); as ticket) {
      <mat-card class="detail-card">
        <mat-card-header class="detail-header">
          <mat-card-title>{{ ticket.ticketNumber }} — {{ ticket.title }}</mat-card-title>
          <div class="header-badges">
            <span class="badge status-{{ ticket.status.toLowerCase() }}">{{ ticket.status }}</span>
            <span class="badge priority-{{ ticket.priority.toLowerCase() }}">{{ ticket.priority }}</span>
          </div>
        </mat-card-header>

        <mat-card-content>
          <section class="summary-grid">
            <div><span class="label">Customer</span><span>{{ ticket.customerName }}</span></div>
            <div><span class="label">Assigned agent</span><span>{{ ticket.assignedAgentName ?? 'Unassigned' }}</span></div>
            <div><span class="label">Created</span><span>{{ ticket.createdAt | date: 'medium' }}</span></div>
            <div><span class="label">Updated</span><span>{{ ticket.updatedAt | date: 'medium' }}</span></div>
            @if (ticket.resolvedAt) {
              <div><span class="label">Resolved</span><span>{{ ticket.resolvedAt | date: 'medium' }}</span></div>
            }
            @if (ticket.closedAt) {
              <div><span class="label">Closed</span><span>{{ ticket.closedAt | date: 'medium' }}</span></div>
            }
          </section>

          <p class="description">{{ ticket.description }}</p>

          <div class="edit-action">
            <a
              mat-stroked-button
              [routerLink]="canEdit() ? [ticket.id, 'edit'] : null"
              [disabled]="!canEdit()"
              [matTooltip]="canEdit() ? '' : 'You do not have permission to edit this ticket.'"
            >
              <mat-icon>edit</mat-icon>
              Edit
            </a>
          </div>

          <mat-divider />

          <section class="actions-grid">
            <div class="action-block">
              <h3>Status</h3>
              <div class="inline-control">
                <mat-form-field appearance="outline">
                  <mat-label>Next status</mat-label>
                  <mat-select
                    [value]="pendingStatus()"
                    (selectionChange)="pendingStatus.set($event.value)"
                    [disabled]="statusOptions().length === 0"
                  >
                    @for (option of statusOptions(); track option) {
                      <mat-option [value]="option">{{ option }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button
                  mat-flat-button
                  color="primary"
                  [disabled]="!pendingStatus() || statusOptions().length === 0 || statusSubmitting()"
                  [matTooltip]="statusOptions().length === 0 ? 'No status change is available to you for this ticket.' : ''"
                  (click)="submitStatus()"
                >
                  Update
                </button>
              </div>
            </div>

            <div class="action-block">
              <h3>Priority</h3>
              <div class="inline-control">
                <mat-form-field appearance="outline">
                  <mat-label>Priority</mat-label>
                  <mat-select
                    [value]="pendingPriority()"
                    (selectionChange)="pendingPriority.set($event.value)"
                    [disabled]="!canChangePriority()"
                  >
                    @for (value of priorityOptions; track value) {
                      <mat-option [value]="value">{{ value }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button
                  mat-flat-button
                  color="primary"
                  [disabled]="!canChangePriority() || pendingPriority() === ticket.priority || prioritySubmitting()"
                  [matTooltip]="canChangePriority() ? '' : 'Only an admin can change ticket priority.'"
                  (click)="submitPriority()"
                >
                  Update
                </button>
              </div>
            </div>

            <div class="action-block">
              <h3>Assignment</h3>
              <div class="inline-control">
                <mat-form-field appearance="outline">
                  <mat-label>Agent</mat-label>
                  <mat-select
                    [value]="pendingAgentId()"
                    (selectionChange)="pendingAgentId.set($event.value)"
                    [disabled]="!canAssign()"
                  >
                    <mat-option [value]="unassignedValue">Unassigned</mat-option>
                    @for (agent of agents(); track agent.id) {
                      <mat-option [value]="agent.id">{{ agent.firstName }} {{ agent.lastName }}</mat-option>
                    }
                    @if (ticket.assignedAgentId && !isAgentInRoster(ticket.assignedAgentId)) {
                      <!-- The agent roster is only fetched for Admins (see ngOnInit) — for any other
                           viewer, synthesize an option for the ticket's current agent so this
                           disabled, read-only select still displays a name instead of blank. -->
                      <mat-option [value]="ticket.assignedAgentId">{{ ticket.assignedAgentName }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <button
                  mat-flat-button
                  color="primary"
                  [disabled]="!canAssign() || !assignmentChanged() || assignSubmitting()"
                  [matTooltip]="canAssign() ? '' : 'Only an admin can reassign a ticket.'"
                  (click)="submitAssignment()"
                >
                  Update
                </button>
              </div>
            </div>
          </section>

          @if (actionError()) {
            <p class="error-message">{{ actionError() }}</p>
          }

          <mat-divider />

          @if (ticket.timeEntries) {
            <section>
              <h3>Time Entries</h3>
              @if (ticket.timeEntries.length === 0) {
                <p class="empty-state">No time logged yet.</p>
              } @else {
                <table class="simple-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Agent</th>
                      <th>Minutes</th>
                      <th>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (entry of ticket.timeEntries; track entry.id) {
                      <tr>
                        <td>{{ entry.workDate | date: 'mediumDate' }}</td>
                        <td>{{ entry.userName }}</td>
                        <td>{{ entry.durationMinutes }}</td>
                        <td>{{ entry.description }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              }

              <form [formGroup]="timeEntryForm" (ngSubmit)="submitTimeEntry()" class="time-entry-form">
                <mat-form-field appearance="outline">
                  <mat-label>Work date</mat-label>
                  <input matInput [matDatepicker]="picker" formControlName="workDate" [max]="today" />
                  <mat-datepicker-toggle matSuffix [for]="picker" [disabled]="!canLogTime()" />
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
                <button
                  mat-stroked-button
                  type="submit"
                  [disabled]="!canLogTime() || timeEntryForm.invalid || timeEntrySubmitting()"
                  [matTooltip]="canLogTime() ? '' : 'Only the assigned agent (or an admin) can log time.'"
                >
                  Log Time
                </button>
              </form>
            </section>

            <mat-divider />
          }

          <section>
            <h3>Comments</h3>
            @if (ticket.comments.length === 0) {
              <p class="empty-state">No comments yet.</p>
            } @else {
              <ul class="comment-list">
                @for (comment of ticket.comments; track comment.id) {
                  <li>
                    <div class="comment-meta">
                      <strong>{{ comment.userName }}</strong>
                      <span class="comment-role">{{ comment.userRole }}</span>
                      <span class="comment-date">{{ comment.createdAt | date: 'medium' }}</span>
                    </div>
                    <p>{{ comment.commentText }}</p>
                  </li>
                }
              </ul>
            }

            <form [formGroup]="commentForm" (ngSubmit)="submitComment()" class="comment-form">
              <mat-form-field appearance="outline">
                <mat-label>Add a comment</mat-label>
                <textarea matInput formControlName="commentText" rows="3"></textarea>
              </mat-form-field>
              <button mat-flat-button color="primary" type="submit" [disabled]="commentForm.invalid || commentSubmitting()">
                Post Comment
              </button>
            </form>
          </section>
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .detail-card { margin: 16px; }
    .loading-spinner { margin: 48px auto; }
    .detail-header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; justify-content: space-between; width: 100%; }
    .detail-header ::ng-deep .mat-mdc-card-header-text { flex: 1 1 auto; }
    .header-badges { display: flex; gap: 8px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin: 16px 0;
    }
    .summary-grid .label { display: block; font-size: 0.75rem; opacity: 0.6; }
    .description { white-space: pre-wrap; margin: 16px 0; }
    .edit-action { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    mat-divider { margin: 16px 0; }
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .action-block h3 { margin: 0 0 4px; font-size: 0.95rem; }
    .inline-control { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
    .inline-control mat-form-field { flex: 1 1 160px; }
    .error-message { color: var(--mat-sys-error); font-size: 0.875rem; }
    .empty-state { opacity: 0.7; }
    .simple-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
    .simple-table th, .simple-table td { text-align: left; padding: 6px 8px; border-bottom: 1px solid var(--mat-sys-outline-variant); font-size: 0.875rem; }
    .time-entry-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; }
    .minutes-field { max-width: 120px; }
    .description-field { flex: 1 1 200px; }
    .comment-list { list-style: none; padding: 0; margin: 0 0 16px; display: flex; flex-direction: column; gap: 12px; }
    .comment-list li { border-left: 3px solid var(--mat-sys-outline-variant); padding-left: 10px; }
    .comment-list p { margin: 4px 0 0; white-space: pre-wrap; }
    .comment-meta { display: flex; gap: 8px; align-items: baseline; font-size: 0.8rem; }
    .comment-role { opacity: 0.6; }
    .comment-date { opacity: 0.5; margin-left: auto; }
    .comment-form { display: flex; flex-direction: column; gap: 4px; max-width: 480px; }

    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 500; white-space: nowrap; }
    .status-open { background: #e3f2fd; color: #0d47a1; }
    .status-inprogress { background: #fff3e0; color: #e65100; }
    .status-resolved { background: #e8f5e9; color: #1b5e20; }
    .status-closed { background: #eceff1; color: #37474f; }
    .priority-low { background: #eceff1; color: #37474f; }
    .priority-medium { background: #e3f2fd; color: #0d47a1; }
    .priority-high { background: #fff3e0; color: #e65100; }
    .priority-critical { background: #ffebee; color: #b71c1c; }
  `]
})
export class TicketDetailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly ticketService = inject(TicketService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  protected readonly priorityOptions = Object.values(TicketPriority);
  protected readonly unassignedValue = UNASSIGNED;
  protected readonly today = new Date();

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly ticket = signal<TicketDetail | null>(null);
  protected readonly agents = signal<UserSummary[]>([]);

  protected readonly pendingStatus = signal<TicketStatus | undefined>(undefined);
  protected readonly pendingPriority = signal<TicketPriority | undefined>(undefined);
  protected readonly pendingAgentId = signal<string>(UNASSIGNED);

  protected readonly statusSubmitting = signal(false);
  protected readonly prioritySubmitting = signal(false);
  protected readonly assignSubmitting = signal(false);
  protected readonly commentSubmitting = signal(false);
  protected readonly timeEntrySubmitting = signal(false);
  protected readonly actionError = signal<string | null>(null);

  protected readonly commentForm = this.fb.nonNullable.group({
    commentText: ['', [Validators.required]]
  });

  protected readonly timeEntryForm = this.fb.nonNullable.group({
    workDate: [new Date(), [Validators.required]],
    durationMinutes: [30, [Validators.required, Validators.min(1)]],
    description: ['', [Validators.required]]
  });

  private readonly currentUser = this.authService.currentUser;

  protected readonly isOwner = computed(() => {
    const ticket = this.ticket();
    const user = this.currentUser();
    return !!ticket && !!user && ticket.customerId === user.id;
  });

  protected readonly isAssignedAgent = computed(() => {
    const ticket = this.ticket();
    const user = this.currentUser();
    return !!ticket && !!user && ticket.assignedAgentId === user.id;
  });

  protected readonly canEdit = computed(() => {
    const ticket = this.ticket();
    if (!ticket) {
      return false;
    }
    if (this.authService.hasRole(UserRole.Admin)) {
      return true;
    }
    if (this.authService.hasRole(UserRole.SupportAgent)) {
      return this.isAssignedAgent();
    }
    return this.authService.hasRole(UserRole.Customer) && this.isOwner() && ticket.status !== TicketStatus.Closed;
  });

  /** Mirrors TicketService.EnsureCallerCanChangeStatus — a UX projection only; the backend re-validates every request. */
  protected readonly statusOptions = computed(() => {
    const ticket = this.ticket();
    if (!ticket) {
      return [];
    }

    const nextStatuses = getValidNextStatuses(ticket.status);

    if (this.authService.hasRole(UserRole.Admin)) {
      return nextStatuses;
    }
    if (this.authService.hasRole(UserRole.SupportAgent)) {
      return this.isAssignedAgent()
        ? nextStatuses.filter((s) => !(ticket.status === TicketStatus.Resolved && s === TicketStatus.Closed))
        : [];
    }
    if (this.authService.hasRole(UserRole.Customer)) {
      return this.isOwner()
        ? nextStatuses.filter((s) => ticket.status === TicketStatus.Resolved && s === TicketStatus.Closed)
        : [];
    }
    return [];
  });

  protected readonly canChangePriority = computed(() => this.authService.hasRole(UserRole.Admin));
  protected readonly canAssign = computed(() => this.authService.hasRole(UserRole.Admin));
  protected readonly canLogTime = computed(
    () => this.authService.hasRole(UserRole.Admin) || (this.authService.hasRole(UserRole.SupportAgent) && this.isAssignedAgent())
  );

  protected readonly assignmentChanged = computed(() => {
    const ticket = this.ticket();
    if (!ticket) {
      return false;
    }
    const current = ticket.assignedAgentId ?? UNASSIGNED;
    return current !== this.pendingAgentId();
  });

  protected isAgentInRoster(agentId: string): boolean {
    return this.agents().some((agent) => agent.id === agentId);
  }

  ngOnInit(): void {
    if (this.authService.hasRole(UserRole.Admin)) {
      this.userService.getAgents().subscribe((agents) => this.agents.set(agents));
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      this.loadError.set('Ticket not found.');
      return;
    }

    this.ticketService.getTicket(id).subscribe({
      next: (ticket) => {
        this.applyTicket(ticket);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(error.status === 404 ? 'Ticket not found.' : 'Could not load this ticket.');
      }
    });
  }

  protected submitStatus(): void {
    const ticket = this.ticket();
    const status = this.pendingStatus();
    if (!ticket || !status) {
      return;
    }

    this.statusSubmitting.set(true);
    this.actionError.set(null);
    this.ticketService.changeStatus(ticket.id, { status }).subscribe({
      next: (updated) => {
        this.applyTicket(updated);
        this.statusSubmitting.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleActionError(error, this.statusSubmitting)
    });
  }

  protected submitPriority(): void {
    const ticket = this.ticket();
    const priority = this.pendingPriority();
    if (!ticket || !priority) {
      return;
    }

    this.prioritySubmitting.set(true);
    this.actionError.set(null);
    this.ticketService.changePriority(ticket.id, { priority }).subscribe({
      next: (updated) => {
        this.applyTicket(updated);
        this.prioritySubmitting.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleActionError(error, this.prioritySubmitting)
    });
  }

  protected submitAssignment(): void {
    const ticket = this.ticket();
    if (!ticket) {
      return;
    }

    const agentId = this.pendingAgentId();
    this.assignSubmitting.set(true);
    this.actionError.set(null);
    this.ticketService.assignTicket(ticket.id, { agentId: agentId === UNASSIGNED ? null : agentId }).subscribe({
      next: (updated) => {
        this.applyTicket(updated);
        this.assignSubmitting.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleActionError(error, this.assignSubmitting)
    });
  }

  protected submitComment(): void {
    const ticket = this.ticket();
    if (!ticket || this.commentForm.invalid) {
      return;
    }

    this.commentSubmitting.set(true);
    this.actionError.set(null);
    this.ticketService.addComment(ticket.id, this.commentForm.getRawValue()).subscribe({
      next: (updated) => {
        this.applyTicket(updated);
        this.commentForm.reset({ commentText: '' });
        this.commentSubmitting.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleActionError(error, this.commentSubmitting)
    });
  }

  protected submitTimeEntry(): void {
    const ticket = this.ticket();
    if (!ticket || this.timeEntryForm.invalid) {
      return;
    }

    this.timeEntrySubmitting.set(true);
    this.actionError.set(null);
    const { workDate, durationMinutes, description } = this.timeEntryForm.getRawValue();
    this.ticketService.addTimeEntry(ticket.id, { workDate: toIsoDate(workDate), durationMinutes, description }).subscribe({
      next: (updated) => {
        this.applyTicket(updated);
        this.timeEntryForm.reset({ workDate: new Date(), durationMinutes: 30, description: '' });
        this.timeEntrySubmitting.set(false);
      },
      error: (error: HttpErrorResponse) => this.handleActionError(error, this.timeEntrySubmitting)
    });
  }

  private applyTicket(ticket: TicketDetail): void {
    this.ticket.set(ticket);
    this.pendingStatus.set(undefined);
    this.pendingPriority.set(ticket.priority);
    this.pendingAgentId.set(ticket.assignedAgentId ?? UNASSIGNED);
  }

  private handleActionError(error: HttpErrorResponse, submitting: WritableSignal<boolean>): void {
    submitting.set(false);
    const body = error.error as ApiErrorResponse | undefined;
    this.actionError.set(body?.message ?? 'That action could not be completed. Please try again.');
  }
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
