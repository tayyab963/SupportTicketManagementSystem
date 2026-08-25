import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartSegment } from '../chart-segment.model';

interface BarRow extends ChartSegment {
  widthPercent: number;
}

/** Dependency-free horizontal bar chart for a small, fixed set of categories (e.g. ticket priority). */
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [MatTooltipModule],
  template: `
    <div class="bar-chart" role="img" [attr.aria-label]="title + ' bar chart'">
      @for (row of rows(); track row.label) {
        <div class="bar-row" [matTooltip]="row.label + ': ' + row.value">
          <span class="bar-label">{{ row.label }}</span>
          <div class="bar-track">
            <div class="bar-fill" [style.width.%]="row.widthPercent" [style.background]="row.color"></div>
          </div>
          <span class="bar-value">{{ row.value }}</span>
        </div>
      }
      @if (rows().length === 0) {
        <p class="empty-state">No data yet.</p>
      }
    </div>
  `,
  styles: [`
    .bar-chart { display: flex; flex-direction: column; gap: 16px; }
    .bar-row { display: grid; grid-template-columns: 90px 1fr 40px; align-items: center; gap: 12px; }
    .bar-label { font-size: 0.85rem; font-weight: 500; opacity: 0.85; }
    .bar-track { height: 20px; border-radius: 10px; background: var(--mat-sys-surface-container-highest, #eceff1); overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 10px; min-width: 3px; transition: width 0.3s ease; }
    .bar-value { font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; text-align: right; }
    .empty-state { opacity: 0.6; margin: 0; }
  `]
})
export class BarChartComponent implements OnChanges {
  @Input({ required: true }) data: ChartSegment[] = [];
  @Input() title = 'Chart';

  private computedRows: BarRow[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      const max = Math.max(1, ...this.data.map((d) => d.value));
      this.computedRows = this.data.map((row) => ({
        ...row,
        widthPercent: (row.value / max) * 100
      }));
    }
  }

  protected rows(): BarRow[] {
    return this.computedRows;
  }
}
