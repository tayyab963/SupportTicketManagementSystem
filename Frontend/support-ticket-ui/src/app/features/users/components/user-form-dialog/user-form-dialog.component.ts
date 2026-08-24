import { HttpErrorResponse } from '@angular/common/http';
import { Component, Inject, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { ApiErrorResponse } from '../../../../core/models/api-response.model';
import { UserRole } from '../../../../core/models/enums';
import { UserListItem } from '../../../../core/models/user.model';
import { UserService } from '../../../../core/services/user.service';

export interface UserFormDialogData {
  user: UserListItem | null;
}

/** Create/edit modal for a single user. Password is collected only when creating a new account. */
@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule
  ],
  template: `
    <h2 mat-dialog-title>{{ isEdit ? 'Edit User' : 'New User' }}</h2>

    <form [formGroup]="form" (ngSubmit)="submit()">
      <mat-dialog-content class="form-content">
        <div class="name-row">
          <mat-form-field appearance="outline">
            <mat-label>First name</mat-label>
            <input matInput formControlName="firstName" maxlength="100" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Last name</mat-label>
            <input matInput formControlName="lastName" maxlength="100" required />
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" maxlength="256" required />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <mat-error>A valid email is required.</mat-error>
          }
        </mat-form-field>

        @if (!isEdit) {
          <mat-form-field appearance="outline">
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" required />
            @if (form.controls.password.invalid && form.controls.password.touched) {
              <mat-error>At least 8 characters, with a letter and a digit.</mat-error>
            }
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Role</mat-label>
          <mat-select formControlName="role" required>
            @for (role of roleOptions; track role) {
              <mat-option [value]="role">{{ role }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (errorMessage()) {
          <p class="error-message">{{ errorMessage() }}</p>
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close [disabled]="isSubmitting()">Cancel</button>
        <button mat-flat-button color="primary" type="submit" [disabled]="isSubmitting()">
          @if (isSubmitting()) {
            <mat-progress-spinner diameter="20" mode="indeterminate" />
          } @else {
            {{ isEdit ? 'Save Changes' : 'Create User' }}
          }
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: [`
    .form-content { display: flex; flex-direction: column; gap: 4px; min-width: 340px; }
    .name-row { display: flex; gap: 12px; }
    .name-row mat-form-field { flex: 1 1 0; }
    .error-message { color: var(--mat-sys-error); margin: 0 0 8px; font-size: 0.875rem; }
  `]
})
export class UserFormDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly dialogRef = inject(MatDialogRef<UserFormDialogComponent, UserListItem | undefined>);

  protected readonly roleOptions = Object.values(UserRole);
  protected readonly isEdit: boolean;
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private readonly editingUser: UserListItem | null;

  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(100)]],
    lastName: ['', [Validators.required, Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)]],
    role: [UserRole.Customer, [Validators.required]]
  });

  constructor(@Inject(MAT_DIALOG_DATA) data: UserFormDialogData) {
    this.editingUser = data.user;
    this.isEdit = data.user !== null;

    if (data.user) {
      this.form.controls.password.clearValidators();
      this.form.controls.password.updateValueAndValidity();
      this.form.patchValue({
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        email: data.user.email,
        role: data.user.role
      });
    }
  }

  protected submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const { firstName, lastName, email, password, role } = this.form.getRawValue();

    const request$ = this.isEdit
      ? this.userService.updateUser(this.editingUser!.id, { firstName, lastName, email, role })
      : this.userService.createUser({ firstName, lastName, email, password, role });

    request$.subscribe({
      next: (user) => this.dialogRef.close(user),
      error: (error: HttpErrorResponse) => {
        this.isSubmitting.set(false);
        const body = error.error as ApiErrorResponse | undefined;
        this.errorMessage.set(body?.message ?? 'Could not save the user. Please try again.');
      }
    });
  }
}
