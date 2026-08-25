import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, ViewChild, WritableSignal, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ApiErrorResponse } from '../../../../core/models/api-response.model';
import { TicketPriority, TicketStatus, UserRole } from '../../../../core/models/enums';
import { getValidNextStatuses, TicketDetail } from '../../../../core/models/ticket.model';
import { UserSummary } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { TicketService } from '../../../../core/services/ticket.service';
import { UserService } from '../../../../core/services/user.service';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';
import { ActivityTimelineComponent } from '../../components/activity-timeline/activity-timeline.component';
import { CommentsSectionComponent } from '../../components/comments-section/comments-section.component';
import { TimeTrackingComponent } from '../../components/time-tracking/time-tracking.component';

const UNASSIGNED = '__unassigned__';

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    DatePipe,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    BadgeComponent,
    ActivityTimelineComponent,
    CommentsSectionComponent,
    TimeTrackingComponent
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
      <a mat-button routerLink="/tickets" class="back-link">
        <mat-icon>arrow_back</mat-icon>
        Back to tickets
      </a>
      <mat-card class="detail-card">
        <mat-card-header class="detail-header">
          <mat-card-title>{{ ticket.ticketNumber }} — {{ ticket.title }}</mat-card-title>
          <div class="header-badges">
            <app-badge variant="status" [value]="ticket.status" />
            <app-badge variant="priority" [value]="ticket.priority" />
          </div>
        </mat-card-header>

        <mat-card-content>
          <section class="summary-grid">
            <div class="summary-item">
              <mat-icon>person</mat-icon>
              <span><span class="label">Customer</span><span class="summary-value">{{ ticket.customerName }}</span></span>
            </div>
            <div class="summary-item">
              <mat-icon>support_agent</mat-icon>
              <span><span class="label">Assigned agent</span><span class="summary-value">{{ ticket.assignedAgentName ?? 'Unassigned' }}</span></span>
            </div>
            <div class="summary-item">
              <mat-icon>calendar_today</mat-icon>
              <span><span class="label">Created</span><span class="summary-value">{{ ticket.createdAt | date: 'medium' }}</span></span>
            </div>
            <div class="summary-item">
              <mat-icon>update</mat-icon>
              <span><span class="label">Updated</span><span class="summary-value">{{ ticket.updatedAt | date: 'medium' }}</span></span>
            </div>
            @if (ticket.resolvedAt) {
              <div class="summary-item">
                <mat-icon>task_alt</mat-icon>
                <span><span class="label">Resolved</span><span class="summary-value">{{ ticket.resolvedAt | date: 'medium' }}</span></span>
              </div>
            }
            @if (ticket.closedAt) {
              <div class="summary-item">
                <mat-icon>lock</mat-icon>
                <span><span class="label">Closed</span><span class="summary-value">{{ ticket.closedAt | date: 'medium' }}</span></span>
              </div>
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
            <div class="action-block action-status">
              <h3><mat-icon>swap_horiz</mat-icon>Status</h3>
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

            <div class="action-block action-priority">
              <h3><mat-icon>priority_high</mat-icon>Priority</h3>
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

            <div class="action-block action-assignment">
              <h3><mat-icon>assignment_ind</mat-icon>Assignment</h3>
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

          <app-activity-timeline #timeline [ticketId]="ticket.id" />

          <mat-divider />

          @if (showTimeTracking()) {
            <app-time-tracking
              [ticketId]="ticket.id"
              [canLogTime]="canLogTime()"
              (timeEntryAdded)="timeline.reload()"
            />

            <mat-divider />
          }

          <app-comments-section
            [ticketId]="ticket.id"
            [canComment]="canComment()"
            (commentAdded)="timeline.reload()"
          />
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: [`
    .back-link { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 8px; color: var(--mat-sys-on-surface-variant); }
    .back-link mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .detail-card { margin: 0; }
    .loading-spinner { margin: 48px auto; }
    .detail-header { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; justify-content: space-between; width: 100%; }
    .header-badges { display: flex; gap: 8px; }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
      margin: 20px 0;
    }
    .summary-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.02));
    }
    .summary-item mat-icon { flex-shrink: 0; opacity: 0.6; margin-top: 1px; }
    .summary-item > span { display: flex; flex-direction: column; min-width: 0; }
    .summary-value { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .summary-grid .label { display: block; font-size: 0.75rem; opacity: 0.6; }
    .description { white-space: pre-wrap; margin: 16px 0; line-height: 1.55; }
    .edit-action { display: flex; justify-content: flex-end; margin-bottom: 8px; }
    mat-divider { margin: 20px 0; }
    .actions-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .action-block {
      padding: 14px 16px;
      border-radius: 12px;
      border-left: 3px solid var(--mat-sys-outline-variant);
      background: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.02));
    }
    .action-block h3 {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 0 10px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .action-block h3 mat-icon { font-size: 18px; width: 18px; height: 18px; opacity: 0.75; }
    .action-status { border-left-color: #4f46e5; }
    .action-priority { border-left-color: #f59e0b; }
    .action-assignment { border-left-color: #10b981; }
    .inline-control { display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap; }
    .inline-control mat-form-field { flex: 1 1 160px; }
    .error-message { color: var(--mat-sys-error); font-size: 0.875rem; }
    .empty-state { opacity: 0.7; }
  `]
})
export class TicketDetailComponent implements OnInit {
  private readonly ticketService = inject(TicketService);
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('timeline') private timelineComponent?: ActivityTimelineComponent;

  protected readonly priorityOptions = Object.values(TicketPriority);
  protected readonly unassignedValue = UNASSIGNED;

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
  protected readonly actionError = signal<string | null>(null);

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

  /** Mirrors TicketService.AddCommentAsync's EnsureAgentAssigned check — a UX projection only. */
  protected readonly canComment = computed(() => {
    if (this.authService.hasRole(UserRole.Admin) || this.authService.hasRole(UserRole.Customer)) {
      return true;
    }
    return this.authService.hasRole(UserRole.SupportAgent) && this.isAssignedAgent();
  });

  /** Internal work logs are never shown to customers — mirrors TicketDetailDto.TimeEntries being null for that role. */
  protected readonly showTimeTracking = computed(() => !this.authService.hasRole(UserRole.Customer));

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

    if (status === TicketStatus.Closed) {
      const dialogRef = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Close ticket',
          message: 'Closing this ticket is final — it cannot be reopened afterwards. Continue?',
          confirmLabel: 'Close ticket'
        }
      });

      dialogRef.afterClosed().subscribe((confirmed) => {
        if (confirmed) {
          this.performStatusChange(ticket.id, status);
        }
      });
      return;
    }

    this.performStatusChange(ticket.id, status);
  }

  private performStatusChange(ticketId: string, status: TicketStatus): void {
    this.statusSubmitting.set(true);
    this.actionError.set(null);
    this.ticketService.changeStatus(ticketId, { status }).subscribe({
      next: (updated) => {
        this.applyTicket(updated);
        this.statusSubmitting.set(false);
        this.timelineComponent?.reload();
        this.snackBar.open(`Status updated to ${status}.`, 'Dismiss', { duration: 3000 });
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
        this.timelineComponent?.reload();
        this.snackBar.open(`Priority updated to ${priority}.`, 'Dismiss', { duration: 3000 });
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
        this.timelineComponent?.reload();
        this.snackBar.open('Assignment updated.', 'Dismiss', { duration: 3000 });
      },
      error: (error: HttpErrorResponse) => this.handleActionError(error, this.assignSubmitting)
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
