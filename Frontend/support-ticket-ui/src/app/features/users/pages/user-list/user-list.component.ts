import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
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
import { UserService } from '../../../../core/services/user.service';
import { UserRole } from '../../../../core/models/enums';
import { PagedResult } from '../../../../core/models/paged-result.model';
import { UserListItem, UserQueryParams } from '../../../../core/models/user.model';
import { UserFormDialogComponent } from '../../components/user-form-dialog/user-form-dialog.component';
import { BadgeComponent } from '../../../../shared/components/badge/badge.component';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogComponent } from '../../../../shared/components/confirm-dialog/confirm-dialog.component';

type ActiveFilter = 'all' | 'active' | 'inactive';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
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
    MatDialogModule,
    MatSnackBarModule,
    BadgeComponent,
    EmptyStateComponent
  ],
  template: `
    <mat-card class="list-card">
      <mat-card-header class="list-header">
        <div class="header-title">
          <span class="header-icon"><mat-icon>group</mat-icon></span>
          <div>
            <mat-card-title>User Management</mat-card-title>
            <p class="header-subtitle">Manage accounts, roles and access.</p>
          </div>
        </div>
        <button mat-flat-button color="primary" (click)="openCreateDialog()">
          <mat-icon>person_add</mat-icon>
          New User
        </button>
      </mat-card-header>

      <mat-card-content>
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search</mat-label>
            <input matInput [formControl]="searchControl" placeholder="Name or email" />
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Role</mat-label>
            <mat-select [value]="role()" (selectionChange)="onRoleChange($event.value)">
              <mat-option [value]="undefined">All roles</mat-option>
              @for (value of roleOptions; track value) {
                <mat-option [value]="value">{{ value }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Status</mat-label>
            <mat-select [value]="activeFilter()" (selectionChange)="onActiveFilterChange($event.value)">
              <mat-option value="all">All</mat-option>
              <mat-option value="active">Active</mat-option>
              <mat-option value="inactive">Inactive</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        @if (loading()) {
          <mat-progress-bar mode="indeterminate" />
        }

        <div class="table-container">
          <table mat-table [dataSource]="items()" class="users-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let user">
                <div class="name-cell">
                  <span class="user-avatar">{{ initials(user) }}</span>
                  <span>{{ user.firstName }} {{ user.lastName }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let user">{{ user.email }}</td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let user">
                <app-badge variant="role" [value]="user.role" />
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let user">
                <app-badge variant="status" [value]="user.isActive ? 'Active' : 'Inactive'" />
              </td>
            </ng-container>

            <ng-container matColumnDef="createdAt">
              <th mat-header-cell *matHeaderCellDef>Created</th>
              <td mat-cell *matCellDef="let user">{{ user.createdAt | date: 'mediumDate' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef></th>
              <td mat-cell *matCellDef="let user" class="actions-cell">
                <button mat-icon-button matTooltip="Edit" (click)="openEditDialog(user)">
                  <mat-icon>edit</mat-icon>
                </button>
                @if (user.isActive) {
                  <button
                    mat-icon-button
                    [matTooltip]="isSelf(user) ? 'You cannot deactivate your own account' : 'Deactivate'"
                    [disabled]="isSelf(user)"
                    (click)="deactivate(user)"
                  >
                    <mat-icon>block</mat-icon>
                  </button>
                } @else {
                  <button mat-icon-button matTooltip="Activate" (click)="activate(user)">
                    <mat-icon>check_circle</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let user; columns: displayedColumns"></tr>
          </table>

          @if (!loading() && items().length === 0) {
            <app-empty-state icon="group_off" message="No users match the current filters." />
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
    .users-table { width: 100%; }
    .actions-cell { white-space: nowrap; }
    .name-cell { display: flex; align-items: center; gap: 10px; }
    .user-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      border-radius: 50%;
      background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      color: var(--mat-sys-primary);
      font-size: 0.7rem;
      font-weight: 700;
    }
  `]
})
export class UserListComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly roleOptions = Object.values(UserRole);
  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly loading = signal(false);
  protected readonly results = signal<PagedResult<UserListItem> | null>(null);

  protected readonly role = signal<UserRole | undefined>(undefined);
  protected readonly activeFilter = signal<ActiveFilter>('all');
  protected readonly pageNumber = signal(1);
  protected readonly pageSize = signal(20);

  protected readonly items = computed(() => this.results()?.items ?? []);
  protected readonly totalCount = computed(() => this.results()?.totalCount ?? 0);
  protected readonly displayedColumns = ['name', 'email', 'role', 'status', 'createdAt', 'actions'];

  ngOnInit(): void {
    this.searchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pageNumber.set(1);
        this.refresh();
      });

    this.refresh();
  }

  protected isSelf(user: UserListItem): boolean {
    return this.authService.currentUser()?.id === user.id;
  }

  protected initials(user: UserListItem): string {
    return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  }

  protected onRoleChange(value: UserRole | undefined): void {
    this.role.set(value);
    this.pageNumber.set(1);
    this.refresh();
  }

  protected onActiveFilterChange(value: ActiveFilter): void {
    this.activeFilter.set(value);
    this.pageNumber.set(1);
    this.refresh();
  }

  protected onPageChange(event: PageEvent): void {
    this.pageNumber.set(event.pageIndex + 1);
    this.pageSize.set(event.pageSize);
    this.refresh();
  }

  protected openCreateDialog(): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, { data: { user: null } });
    dialogRef.afterClosed().subscribe((created) => {
      if (created) {
        this.snackBar.open('User created.', 'Dismiss', { duration: 3000 });
        this.refresh();
      }
    });
  }

  protected openEditDialog(user: UserListItem): void {
    const dialogRef = this.dialog.open(UserFormDialogComponent, { data: { user } });
    dialogRef.afterClosed().subscribe((updated) => {
      if (updated) {
        this.snackBar.open('User updated.', 'Dismiss', { duration: 3000 });
        this.refresh();
      }
    });
  }

  protected activate(user: UserListItem): void {
    this.userService.activateUser(user.id).subscribe({
      next: () => {
        this.snackBar.open(`${user.firstName} ${user.lastName} activated.`, 'Dismiss', { duration: 3000 });
        this.refresh();
      },
      error: (error: HttpErrorResponse) => this.showError(error)
    });
  }

  protected deactivate(user: UserListItem): void {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Deactivate user',
        message: `Deactivate ${user.firstName} ${user.lastName}? They will no longer be able to log in.`,
        confirmLabel: 'Deactivate'
      }
    });

    dialogRef.afterClosed().subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }

      this.userService.deactivateUser(user.id).subscribe({
        next: () => {
          this.snackBar.open(`${user.firstName} ${user.lastName} deactivated.`, 'Dismiss', { duration: 3000 });
          this.refresh();
        },
        error: (error: HttpErrorResponse) => this.showError(error)
      });
    });
  }

  private showError(error: HttpErrorResponse): void {
    const message = (error.error as { message?: string } | undefined)?.message ?? 'Something went wrong.';
    this.snackBar.open(message, 'Dismiss', { duration: 4000 });
  }

  private refresh(): void {
    this.loading.set(true);

    const query: UserQueryParams = {
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
      search: this.searchControl.value || undefined,
      role: this.role(),
      isActive: this.activeFilter() === 'all' ? undefined : this.activeFilter() === 'active'
    };

    this.userService.getUsers(query).subscribe({
      next: (result) => {
        this.results.set(result);
        this.loading.set(false);
      },
      error: (error: HttpErrorResponse) => {
        this.loading.set(false);
        this.showError(error);
      }
    });
  }
}
