import { Component, Input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AgentWorkload } from '../../../../core/models/dashboard.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';

@Component({
  selector: 'app-agent-workload-table',
  standalone: true,
  imports: [MatTableModule, MatTooltipModule, EmptyStateComponent],
  template: `
    <div class="table-container">
      <table mat-table [dataSource]="data" class="workload-table">
        <ng-container matColumnDef="agentName">
          <th mat-header-cell *matHeaderCellDef>Agent</th>
          <td mat-cell *matCellDef="let row">
            <div class="agent-cell">
              <span class="agent-avatar">{{ initials(row.agentName) }}</span>
              <span>{{ row.agentName }}</span>
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="totalAssigned">
          <th mat-header-cell *matHeaderCellDef>Total Assigned</th>
          <td mat-cell *matCellDef="let row">{{ row.totalAssigned }}</td>
        </ng-container>

        <ng-container matColumnDef="workload">
          <th mat-header-cell *matHeaderCellDef>Workload</th>
          <td mat-cell *matCellDef="let row">
            <div
              class="mini-bar"
              [matTooltip]="row.open + ' open · ' + row.inProgress + ' in progress · ' + row.resolved + ' resolved'"
            >
              <span class="seg seg-open" [style.width.%]="segmentWidth(row, row.open)"></span>
              <span class="seg seg-progress" [style.width.%]="segmentWidth(row, row.inProgress)"></span>
              <span class="seg seg-resolved" [style.width.%]="segmentWidth(row, row.resolved)"></span>
            </div>
          </td>
        </ng-container>

        <ng-container matColumnDef="open">
          <th mat-header-cell *matHeaderCellDef>Open</th>
          <td mat-cell *matCellDef="let row">{{ row.open }}</td>
        </ng-container>

        <ng-container matColumnDef="inProgress">
          <th mat-header-cell *matHeaderCellDef>In Progress</th>
          <td mat-cell *matCellDef="let row">{{ row.inProgress }}</td>
        </ng-container>

        <ng-container matColumnDef="resolved">
          <th mat-header-cell *matHeaderCellDef>Resolved</th>
          <td mat-cell *matCellDef="let row">{{ row.resolved }}</td>
        </ng-container>

        <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
        <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
      </table>

      @if (data.length === 0) {
        <app-empty-state icon="groups" message="No support agents yet." />
      }
    </div>
  `,
  styles: [`
    .table-container { overflow-x: auto; }
    .workload-table { width: 100%; }
    .agent-cell { display: flex; align-items: center; gap: 10px; }
    .agent-avatar {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      flex-shrink: 0;
      border-radius: 50%;
      background: color-mix(in srgb, var(--mat-sys-primary) 14%, transparent);
      color: var(--mat-sys-primary);
      font-size: 0.7rem;
      font-weight: 700;
    }
    .mini-bar {
      display: flex;
      width: 120px;
      height: 8px;
      border-radius: 5px;
      overflow: hidden;
      background: var(--mat-sys-surface-container-highest, #eceff1);
    }
    .seg { height: 100%; }
    .seg-open { background: #4f46e5; }
    .seg-progress { background: #f59e0b; }
    .seg-resolved { background: #10b981; }
  `]
})
export class AgentWorkloadTableComponent {
  @Input({ required: true }) data: AgentWorkload[] = [];

  protected readonly displayedColumns = ['agentName', 'workload', 'totalAssigned', 'open', 'inProgress', 'resolved'];

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  protected segmentWidth(row: AgentWorkload, segment: number): number {
    return row.totalAssigned > 0 ? (segment / row.totalAssigned) * 100 : 0;
  }
}
