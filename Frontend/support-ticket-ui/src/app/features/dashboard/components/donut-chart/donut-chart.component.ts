import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ChartSegment } from '../chart-segment.model';

interface DonutArc extends ChartSegment {
  percentage: number;
  dashArray: string;
  dashOffset: number;
}

const RADIUS = 52;
const STROKE_WIDTH = 24;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

/**
 * Dependency-free SVG donut chart for a small, fixed set of categories (e.g. ticket status).
 * Identity is never color-alone: a legend with swatch + label + count/percentage always renders
 * beside the ring, and every arc carries a hover tooltip with its exact value.
 */
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  imports: [MatTooltipModule],
  template: `
    <div class="donut-wrap">
      <svg viewBox="0 0 140 140" class="donut-svg" role="img" [attr.aria-label]="title + ' donut chart'">
        <circle cx="70" cy="70" [attr.r]="radius" fill="none" [attr.stroke-width]="strokeWidth" class="donut-track" />
        @for (arc of arcs(); track arc.label) {
          <circle
            cx="70"
            cy="70"
            [attr.r]="radius"
            fill="none"
            [attr.stroke]="arc.color"
            [attr.stroke-width]="strokeWidth"
            [attr.stroke-dasharray]="arc.dashArray"
            [attr.stroke-dashoffset]="arc.dashOffset"
            stroke-linecap="round"
            class="donut-arc"
            [matTooltip]="arc.label + ': ' + arc.value + ' (' + arc.percentage + '%)'"
          />
        }
        <text x="70" y="66" text-anchor="middle" class="donut-total-value">{{ total() }}</text>
        <text x="70" y="84" text-anchor="middle" class="donut-total-label">Total</text>
      </svg>

      <ul class="legend">
        @for (arc of arcs(); track arc.label) {
          <li>
            <span class="swatch" [style.background]="arc.color" [style.color]="arc.color"></span>
            <span class="legend-label">{{ arc.label }}</span>
            <span class="legend-value">{{ arc.value }} &middot; {{ arc.percentage }}%</span>
          </li>
        }
        @if (arcs().length === 0) {
          <li class="empty-state">No data yet.</li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .donut-wrap { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
    .donut-svg { width: 168px; height: 168px; flex-shrink: 0; }
    .donut-track { stroke: var(--mat-sys-surface-container-highest, #e1e0d9); }
    .donut-arc { transform: rotate(-90deg); transform-origin: 70px 70px; cursor: default; transition: opacity 0.15s ease; }
    .donut-arc:hover { opacity: 0.8; }
    .donut-total-value { font-size: 24px; font-weight: 700; fill: currentColor; transform: rotate(0deg); }
    .donut-total-label { font-size: 10px; fill: currentColor; opacity: 0.6; letter-spacing: 0.04em; text-transform: uppercase; }
    .legend { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; min-width: 160px; flex: 1 1 160px; }
    .legend li { display: flex; align-items: center; gap: 10px; font-size: 0.85rem; }
    .swatch { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 15%, transparent); }
    .legend-label { flex: 1 1 auto; font-weight: 500; }
    .legend-value { opacity: 0.65; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .empty-state { opacity: 0.6; }
  `]
})
export class DonutChartComponent implements OnChanges {
  @Input({ required: true }) data: ChartSegment[] = [];
  @Input() title = 'Chart';

  protected readonly radius = RADIUS;
  protected readonly strokeWidth = STROKE_WIDTH;

  private computedArcs: DonutArc[] = [];
  private computedTotal = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.recompute();
    }
  }

  protected arcs(): DonutArc[] {
    return this.computedArcs;
  }

  protected total(): number {
    return this.computedTotal;
  }

  private recompute(): void {
    const nonZero = this.data.filter((d) => d.value > 0);
    const total = nonZero.reduce((sum, d) => sum + d.value, 0);
    this.computedTotal = this.data.reduce((sum, d) => sum + d.value, 0);

    if (total === 0) {
      this.computedArcs = [];
      return;
    }

    let cursor = 0;
    this.computedArcs = nonZero.map((segment) => {
      const length = (segment.value / total) * CIRCUMFERENCE;
      const visibleLength = nonZero.length > 1 ? Math.max(length - GAP, 0) : length;
      const arc: DonutArc = {
        ...segment,
        percentage: Math.round((segment.value / total) * 100),
        dashArray: `${visibleLength} ${CIRCUMFERENCE - visibleLength}`,
        dashOffset: -cursor
      };
      cursor += length;
      return arc;
    });
  }
}
