import { Component, Input } from '@angular/core';

export type BadgeVariant = 'status' | 'priority' | 'role';

/**
 * Shared color-coded pill for ticket status/priority and user role/active-state. Emits
 * `class="badge {variant}-{value.toLowerCase()}"` — e.g. `badge status-open`, `badge priority-high`
 * — matching the class names the pre-existing hand-rolled badges used, so it's a drop-in visual
 * replacement without touching any DOM contract callers (or specs) already depend on.
 */
@Component({
  selector: 'app-badge',
  standalone: true,
  template: `<span class="badge {{ variant }}-{{ value.toLowerCase() }}">{{ value }}</span>`,
  styles: [`
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 12px 3px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 600;
      white-space: nowrap;
      line-height: 1.4;
    }
    .badge::before {
      content: '';
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: currentColor;
      flex-shrink: 0;
    }

    .status-open, .priority-medium, .role-customer { background: #eef2ff; color: #4338ca; }
    .status-inprogress, .priority-high, .role-supportagent { background: #fffbeb; color: #b45309; }
    .status-resolved, .status-active { background: #ecfdf5; color: #047857; }
    .status-closed, .priority-low, .status-inactive { background: #f1f5f9; color: #334155; }
    .priority-critical, .role-admin { background: #fff1f2; color: #be123c; }

    :host-context(.dark-theme) .status-open,
    :host-context(.dark-theme) .priority-medium,
    :host-context(.dark-theme) .role-customer { background: rgba(99, 102, 241, 0.22); color: #c7d2fe; }
    :host-context(.dark-theme) .status-inprogress,
    :host-context(.dark-theme) .priority-high,
    :host-context(.dark-theme) .role-supportagent { background: rgba(245, 158, 11, 0.2); color: #fcd34d; }
    :host-context(.dark-theme) .status-resolved,
    :host-context(.dark-theme) .status-active { background: rgba(16, 185, 129, 0.2); color: #6ee7b7; }
    :host-context(.dark-theme) .status-closed,
    :host-context(.dark-theme) .priority-low,
    :host-context(.dark-theme) .status-inactive { background: rgba(100, 116, 139, 0.28); color: #cbd5e1; }
    :host-context(.dark-theme) .priority-critical,
    :host-context(.dark-theme) .role-admin { background: rgba(225, 29, 72, 0.22); color: #fda4af; }
  `]
})
export class BadgeComponent {
  @Input({ required: true }) variant!: BadgeVariant;
  @Input({ required: true }) value!: string;
}
