import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** A single dashboard KPI tile: label, hero value, icon, and an accent color for the icon badge. */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="stat-card">
      <div class="stat-icon" [style.background]="accentColor + '1a'" [style.color]="accentColor">
        <mat-icon>{{ icon }}</mat-icon>
      </div>
      <div class="stat-body">
        <span class="stat-value">{{ value }}</span>
        <span class="stat-label">{{ label }}</span>
      </div>
    </div>
  `,
  styles: [`
    .stat-card {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 18px;
      border-radius: 12px;
      background: var(--mat-sys-surface-container, #fff);
      border: 1px solid rgba(11, 11, 11, 0.08);
      min-width: 0;
    }
    .stat-icon {
      flex-shrink: 0;
      width: 44px;
      height: 44px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .stat-body {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .stat-value {
      font-size: 1.6rem;
      font-weight: 600;
      line-height: 1.2;
    }
    .stat-label {
      font-size: 0.8rem;
      opacity: 0.65;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `]
})
export class StatCardComponent {
  @Input({ required: true }) label!: string;
  @Input({ required: true }) value!: string | number;
  @Input({ required: true }) icon!: string;
  @Input() accentColor = '#2a78d6';
}
