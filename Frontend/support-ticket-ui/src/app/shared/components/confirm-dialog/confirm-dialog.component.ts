import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmDialogData {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

/** Generic Yes/No confirmation dialog for destructive or otherwise impactful actions. */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <span class="dialog-icon"><mat-icon>warning</mat-icon></span>
      {{ data.title }}
    </h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button [mat-dialog-close]="false">{{ data.cancelLabel ?? 'Cancel' }}</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="true">{{ data.confirmLabel ?? 'Confirm' }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title { display: flex; align-items: center; gap: 12px; }
    .dialog-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      flex-shrink: 0;
      background: color-mix(in srgb, var(--mat-sys-error) 12%, transparent);
      color: var(--mat-sys-error);
    }
    .dialog-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
  `]
})
export class ConfirmDialogComponent {
  protected readonly data = inject<ConfirmDialogData>(MAT_DIALOG_DATA);
  protected readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);
}
