import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Shared empty-state panel: icon + message, with an optional action via content projection. */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="empty-state">
      <mat-icon class="empty-icon">{{ icon }}</mat-icon>
      <p class="empty-message">{{ message }}</p>
      <ng-content />
    </div>
  `,
  styles: [`
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 48px 24px;
      color: var(--mat-sys-on-surface-variant);
    }
    .empty-icon {
      width: 40px;
      height: 40px;
      font-size: 40px;
      opacity: 0.5;
      margin-bottom: 4px;
    }
    .empty-message {
      margin: 0;
      font-size: 0.9rem;
    }
  `]
})
export class EmptyStateComponent {
  @Input() icon = 'inbox';
  @Input({ required: true }) message!: string;
}
