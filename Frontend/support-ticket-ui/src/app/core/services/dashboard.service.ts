import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import { DashboardSummary } from '../models/dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/dashboard`;

  /** Admin-only — see DashboardController. */
  getSummary(): Observable<DashboardSummary> {
    return this.http
      .get<ApiSuccessResponse<DashboardSummary>>(`${this.baseUrl}/summary`)
      .pipe(map((response) => response.data));
  }
}
