import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** A single dashboard KPI tile: label, hero value, icon, and an accent color for the icon badge. */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [MatIconModule],
  template: `
    <div class="stat-card">
      <span class="stat-accent" [style.background]="accentColor"></span>
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
      position: relative;
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 18px 20px;
      border-radius: 16px;
      background: var(--mat-sys-surface-container-low, #fff);
      border: 1px solid var(--mat-sys-outline-variant);
      box-shadow: 0 1px 2px rgba(15, 15, 25, 0.04), 0 8px 24px -14px rgba(15, 15, 25, 0.16);
      min-width: 0;
      overflow: hidden;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 2px 4px rgba(15, 15, 25, 0.06), 0 16px 32px -16px rgba(15, 15, 25, 0.24);
    }
    .stat-accent {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
    }
    .stat-icon {
      flex-shrink: 0;
      width: 46px;
      height: 46px;
      border-radius: 12px;
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
      font-size: 1.7rem;
      font-weight: 700;
      letter-spacing: -0.02em;
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
  @Input() accentColor = '#4f46e5';
}
