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
    MatSnackBarModule
  ],
  template: `
    <mat-card class="list-card">
      <mat-card-header class="list-header">
        <mat-card-title>User Management</mat-card-title>
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
              <td mat-cell *matCellDef="let user">{{ user.firstName }} {{ user.lastName }}</td>
            </ng-container>

            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let user">{{ user.email }}</td>
            </ng-container>

            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let user">
                <span class="badge role-{{ user.role.toLowerCase() }}">{{ user.role }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let user">
                <span class="badge" [class.status-active]="user.isActive" [class.status-inactive]="!user.isActive">
                  {{ user.isActive ? 'Active' : 'Inactive' }}
                </span>
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
            <p class="empty-state">No users match the current filters.</p>
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
    .list-card { margin: 16px; }
    .list-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    .list-header ::ng-deep .mat-mdc-card-header-text { flex: 1 1 auto; }
    .filter-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: flex-start;
      margin-bottom: 8px;
    }
    .search-field { flex: 1 1 240px; min-width: 200px; }
    mat-form-field { min-width: 160px; }
    .table-container { overflow-x: auto; }
    .users-table { width: 100%; }
    .actions-cell { white-space: nowrap; }
    .empty-state { text-align: center; padding: 32px; opacity: 0.7; }

    .badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
      white-space: nowrap;
    }
    .role-admin { background: #ffebee; color: #b71c1c; }
    .role-supportagent { background: #fff3e0; color: #e65100; }
    .role-customer { background: #e3f2fd; color: #0d47a1; }
    .status-active { background: #e8f5e9; color: #1b5e20; }
    .status-inactive { background: #eceff1; color: #37474f; }
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
    this.userService.deactivateUser(user.id).subscribe({
      next: () => {
        this.snackBar.open(`${user.firstName} ${user.lastName} deactivated.`, 'Dismiss', { duration: 3000 });
        this.refresh();
      },
      error: (error: HttpErrorResponse) => this.showError(error)
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
      error: () => this.loading.set(false)
    });
  }
}
