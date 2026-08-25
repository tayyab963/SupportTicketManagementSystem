import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { TicketService } from '../../../../core/services/ticket.service';
import { UserService } from '../../../../core/services/user.service';
import { TicketPriority, TicketStatus, UserRole } from '../../../../core/models/enums';
import { PagedResult } from '../../../../core/models/paged-result.model';
import { TicketListItem, TicketQueryParams, TicketSortBy } from '../../../../core/models/ticket.model';
import { UserSummary } from '../../../../core/models/user.model';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

interface SortOption {
  value: TicketSortBy;
  label: string;
}

@Component({
  selector: 'app-ticket-list',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatSnackBarModule,
    BadgeComponent,
    EmptyStateComponent
  ],
  template: `
    <mat-card class="list-card">
      <mat-card-header class="list-header">
        <div class="header-title">
          <span class="header-icon"><mat-icon>confirmation_number</mat-icon></span>
          <div>
            <mat-card-title>Tickets</mat-card-title>
            <p class="header-subtitle">Browse, filter and track every support ticket.</p>
          </div>
        </div>
        @if (authService.hasRole(UserRole.Customer)) {
          <a mat-flat-button color="primary" routerLink="create">
            <mat-icon>add</mat-icon>
            New Ticket
          </a>
        }
      </mat-card-header>

      <mat-card-content>
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search</mat-label>
            <input matInput [formControl]="searchControl" placeholder="Ticket #, title or description" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select [value]="status()" (selectionChange)="onStatusChange($event.value)">
              <mat-option [value]="undefined">All statuses</mat-option>
              @for (value of statusOptions; track value) {
                <mat-option [value]="value">{{ value }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Priority</mat-label>
            <mat-select [value]="priority()" (selectionChange)="onPriorityChange($event.value)">
              <mat-option [value]="undefined">All priorities</mat-option>
              @for (value of priorityOptions; track value) {
                <mat-option [value]="value">{{ value }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          @if (authService.hasRole(UserRole.Admin)) {
            <mat-form-field appearance="outline">
              <mat-label>Agent</mat-label>
              <mat-select [value]="assignedAgentId()" (selectionChange)="onAgentChange($event.value)">
                <mat-option [value]="undefined">All agents</mat-option>
                <mat-option value="unassigned">Unassigned</mat-option>
                @for (agent of agents(); track agent.id) {
                  <mat-option [value]="agent.id">{{ agent.firstName }} {{ agent.lastName }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          }

          <mat-form-field appearance="outline">
            <mat-label>Sort by</mat-label>
            <mat-select [value]="sortBy()" (selectionChange)="onSortByChange($event.value)">
              @for (option of sortOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button
            mat-icon-button
            type="button"
            [matTooltip]="sortDescending() ? 'Descending' : 'Ascending'"
            (click)="toggleSortDirection()"
          >
            <mat-icon>{{ sortDescending() ? 'arrow_downward' : 'arrow_upward' }}</mat-icon>
          </button>
        </div>

        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }

        <div class="table-container">
          <table mat-table [dataSource]="items()" class="tickets-table">
            <ng-container matColumnDef="ticketNumber">
              <th mat-header-cell *matHeaderCellDef>Ticket #</th>
              <td mat-cell *matCellDef="let ticket">{{ ticket.ticketNumber }}</td>
            </ng-container>

            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Title</th>
              <td mat-cell *matCellDef="let ticket" class="title-cell">{{ ticket.title }}</td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let ticket">
                <app-badge variant="status" [value]="ticket.status" />
              </td>
            </ng-container>

            <ng-container matColumnDef="priority">
              <th mat-header-cell *matHeaderCellDef>Priority</th>
              <td mat-cell *matCellDef="let ticket">
                <app-badge variant="priority" [value]="ticket.priority" />
              </td>
            </ng-container>

            <ng-container matColumnDef="customerName">
              <th mat-header-cell *matHeaderCellDef>Customer</th>
              <td mat-cell *matCellDef="let ticket">{{ ticket.customerName }}</td>
            </ng-container>

            <ng-container matColumnDef="assignedAgentName">
              <th mat-header-cell *matHeaderCellDef>Agent</th>
              <td mat-cell *matCellDef="let ticket">{{ ticket.assignedAgentName ?? 'Unassigned' }}</td>
            </ng-container>

            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let ticket">{{ ticket.createdAt | date: 'mediumDate' }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
            <tr
              mat-row
              *matRowDef="let ticket; columns: displayedColumns()"
              class="ticket-row"
              [routerLink]="[ticket.id]"
            ></tr>
          </table>

          @if (!loading() && items().length === 0) {
            <app-empty-state icon="confirmation_number" message="No tickets match the current filters." />
          }
        </div>

        <mat-paginator
          [length]="totalCount()"
          [pageSize]="pageSize()"
          [pageIndex]="pageNumber() - 1"
          [pageSizeOptions]="[10, 20, 50]"
          (page)="onPageChange($event)"
        />
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .list-card { margin: 0; }
    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-title { display: flex; align-items: center; gap: 12px; }
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
    .header-subtitle { margin: 2px 0 0; font-size: 0.8125rem; color: var(--mat-sys-on-surface-variant); }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: flex-start;
      margin-bottom: 12px;
      padding: 12px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container-low, rgba(0, 0, 0, 0.02));
    }
    .search-field { flex: 1 1 240px; min-width: 200px; }
    mat-form-field { min-width: 160px; }
    .table-container { overflow-x: auto; border-radius: 12px; }
    .tickets-table { width: 100%; }
    .ticket-row { cursor: pointer; }
    .ticket-row:hover { background: var(--mat-sys-surface-container-low); }
    .title-cell { max-width: 320px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
  `]
})
export class TicketListComponent implements OnInit {
  protected readonly authService = inject(AuthService);
  protected readonly UserRole = UserRole;

  private readonly ticketService = inject(TicketService);
  private readonly userService = inject(UserService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly statusOptions = Object.values(TicketStatus);
  protected readonly priorityOptions = Object.values(TicketPriority);
  protected readonly sortOptions: SortOption[] = [
    { value: 'CreatedAt', label: 'Created date' },
    { value: 'UpdatedAt', label: 'Updated date' },
    { value: 'Priority', label: 'Priority' },
    { value: 'Status', label: 'Status' }
  ];

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(false);
  protected readonly results = signal<PagedResult<TicketListItem> | null>(null);
  protected readonly agents = signal<UserSummary[]>([]);

  protected readonly status = signal<TicketStatus | undefined>(undefined);
  protected readonly priority = signal<TicketPriority | undefined>(undefined);
  protected readonly assignedAgentId = signal<string | undefined>(undefined);
  protected readonly sortBy = signal<TicketSortBy>('CreatedAt');
  protected readonly sortDescending = signal(true);
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(20);

  protected readonly items = computed(() => this.results()?.items ?? []);
  protected readonly totalCount = computed(() => this.results()?.totalCount ?? 0);

  protected readonly displayedColumns = computed(() => {
    const base = ['ticketNumber', 'title', 'status', 'priority'];
    if (this.authService.hasRole(UserRole.Admin)) {
      return [...base, 'customerName', 'assignedAgentName', 'createdAt'];
    }
    if (this.authService.hasRole(UserRole.SupportAgent)) {
      return [...base, 'customerName', 'createdAt'];
    }
    return [...base, 'assignedAgentName', 'createdAt'];
  });

  ngOnInit(): void {
    if (this.authService.hasRole(UserRole.Admin, UserRole.SupportAgent)) {
      this.userService.getAgents().subscribe((agents) => this.agents.set(agents));
    }

    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageNumber.set(1);
        this.refresh();
      });

    this.refresh();
  }

  protected onStatusChange(value: TicketStatus | undefined): void {
    this.status.set(value);
    this.pageNumber.set(1);
    this.refresh();
  }

  protected onPriorityChange(value: TicketPriority | undefined): void {
    this.priority.set(value);
    this.pageNumber.set(1);
    this.refresh();
  }

  protected onAgentChange(value: string | undefined): void {
    this.assignedAgentId.set(value);
    this.pageNumber.set(1);
    this.refresh();
  }

  protected onSortByChange(value: TicketSortBy): void {
    this.sortBy.set(value);
    this.refresh();
  }

  protected toggleSortDirection(): void {
    this.sortDescending.set(!this.sortDescending());
    this.refresh();
  }

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.refresh();
  }

  private refresh(): void {
    this.loading.set(true);

    const agentFilter = this.assignedAgentId();
    const query: TicketQueryParams = {
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
      search: this.searchControl.value || undefined,
      status: this.status(),
      priority: this.priority(),
      unassigned: agentFilter === 'unassigned' ? true : undefined,
      assignedAgentId: agentFilter && agentFilter !== 'unassigned' ? agentFilter : undefined,
      sortBy: this.sortBy(),
      sortDescending: this.sortDescending()
    };

    this.ticketService.getTickets(query).subscribe({
      next: (result) => {
        this.results.set(result);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        const message = (error.error as { message?: string } | undefined)?.message ?? 'Could not load tickets.';
        this.snackBar.open(message, 'Dismiss', { duration: 4000 });
      }
    });
  }
}
