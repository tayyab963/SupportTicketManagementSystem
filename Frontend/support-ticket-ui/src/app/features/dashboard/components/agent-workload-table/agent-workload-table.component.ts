import { Component, Input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { AgentWorkload } from '../../../../core/models/dashboard.model';

@Component({
  selector: 'app-agent-workload-table',
  standalone: true,
  imports: [MatTableModule],
  template: `
    <div class="table-container">
      <table mat-table [dataSource]="data" class="workload-table">
        <ng-container matColumnDef="agentName">
          <th mat-header-cell *matHeaderCellDef>Agent</th>
          <td mat-cell *matCellDef="let row">{{ row.agentName }}</td>
        </ng-container>

        <ng-container matColumnDef="totalAssigned">
          <th mat-header-cell *matHeaderCellDef>Total Assigned</th>
          <td mat-cell *matCellDef="let row">{{ row.totalAssigned }}</td>
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
        <p class="empty-state">No support agents yet.</p>
      }
    </div>
  `,
  styles: [`
    .table-container { overflow-x: auto; }
    .workload-table { width: 100%; }
    .empty-state { text-align: center; padding: 24px; opacity: 0.7; }
  `]
})
export class AgentWorkloadTableComponent {
  @Input({ required: true }) data: AgentWorkload[] = [];

  protected readonly displayedColumns = ['agentName', 'totalAssigned', 'open', 'inProgress', 'resolved'];
}
