import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DashboardService } from '../../../../core/services/dashboard.service';
import { DashboardSummary } from '../../../../core/models/dashboard.model';
import { formatDuration } from '../../../../core/models/ticket.model';
import { ChartSegment } from '../../components/chart-segment.model';
import { StatCardComponent } from '../../components/stat-card/stat-card.component';
import { DonutChartComponent } from '../../components/donut-chart/donut-chart.component';
import { BarChartComponent } from '../../components/bar-chart/bar-chart.component';
import { AgentWorkloadTableComponent } from '../../components/agent-workload-table/agent-workload-table.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    MatCardModule,
    MatProgressBarModule,
    StatCardComponent,
    DonutChartComponent,
    BarChartComponent,
    AgentWorkloadTableComponent
  ],
  template: `
    <div class="dashboard">
      <header class="dashboard-header">
        <h1>Dashboard</h1>
        <p class="dashboard-subtitle">A live snapshot of ticket volume, priority mix and agent workload.</p>
      </header>

      @if (loading()) {
        <mat-progress-bar mode="indeterminate" />
      } @else if (loadError()) {
        <mat-card class="placeholder-card">
          <mat-card-content>
            <p class="error-message">{{ loadError() }}</p>
          </mat-card-content>
        </mat-card>
      } @else if (summary(); as data) {
        <div class="stat-grid">
          <app-stat-card label="Total Tickets" [value]="data.totalTickets" icon="confirmation_number" accentColor="#4f46e5" />
          <app-stat-card label="Open" [value]="data.openTickets" icon="inbox" accentColor="#4f46e5" />
          <app-stat-card label="In Progress" [value]="data.inProgressTickets" icon="autorenew" accentColor="#f59e0b" />
          <app-stat-card label="Resolved" [value]="data.resolvedTickets" icon="task_alt" accentColor="#10b981" />
          <app-stat-card label="Critical" [value]="data.criticalTickets" icon="priority_high" accentColor="#e11d48" />
          <app-stat-card label="Avg. Resolution" [value]="avgResolutionLabel()" icon="schedule" accentColor="#9333ea" />
        </div>

        <div class="chart-grid">
          <mat-card class="chart-card">
            <mat-card-header>
              <mat-card-title>Tickets by Status</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <app-donut-chart title="Tickets by status" [data]="statusSegments()" />
            </mat-card-content>
          </mat-card>

          <mat-card class="chart-card">
            <mat-card-header>
              <mat-card-title>Tickets by Priority</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <app-bar-chart title="Tickets by priority" [data]="prioritySegments()" />
            </mat-card-content>
          </mat-card>
        </div>

        <mat-card class="workload-card">
          <mat-card-header>
            <mat-card-title>Agent Workload</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <app-agent-workload-table [data]="data.agentWorkload" />
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .dashboard { display: flex; flex-direction: column; gap: 22px; }
    .dashboard-header { padding: 4px 4px 0; }
    .dashboard-header h1 { margin: 0; font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; }
    .dashboard-subtitle { margin: 4px 0 0; color: var(--mat-sys-on-surface-variant); font-size: 0.9rem; }
    .placeholder-card { margin: 0; }
    .error-message { color: var(--mat-sys-error); }
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .chart-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
      gap: 16px;
    }
    .chart-card, .workload-card { margin: 0; }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly loading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly summary = signal<DashboardSummary | null>(null);

  protected readonly statusSegments = computed<ChartSegment[]>(() => {
    const data = this.summary();
    if (!data) {
      return [];
    }
    return [
      { label: 'Open', value: data.openTickets, color: '#4f46e5' },
      { label: 'In Progress', value: data.inProgressTickets, color: '#f59e0b' },
      { label: 'Resolved', value: data.resolvedTickets, color: '#10b981' },
      { label: 'Closed', value: data.closedTickets, color: '#64748b' }
    ];
  });

  protected readonly prioritySegments = computed<ChartSegment[]>(() => {
    const data = this.summary();
    if (!data) {
      return [];
    }
    return [
      { label: 'Low', value: data.lowPriorityTickets, color: '#64748b' },
      { label: 'Medium', value: data.mediumPriorityTickets, color: '#4f46e5' },
      { label: 'High', value: data.highPriorityTickets, color: '#f59e0b' },
      { label: 'Critical', value: data.criticalTickets, color: '#e11d48' }
    ];
  });

  protected readonly avgResolutionLabel = computed(() => {
    const data = this.summary();
    if (!data) {
      return '—';
    }
    return data.averageResolutionMinutes > 0 ? formatDuration(Math.round(data.averageResolutionMinutes)) : '—';
  });

  ngOnInit(): void {
    this.dashboardService.getSummary().subscribe({
      next: (summary) => {
        this.summary.set(summary);
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set('Could not load the dashboard summary.');
        this.loading.set(false);
      }
    });
  }
}
