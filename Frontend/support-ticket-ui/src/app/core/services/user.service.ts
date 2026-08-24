import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import { UserSummary } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/users`;

  /** Active support agents only, for assignment/filter pickers (Admin/SupportAgent only — see UsersController). */
  getAgents(): Observable<UserSummary[]> {
    return this.http
      .get<ApiSuccessResponse<UserSummary[]>>(`${this.baseUrl}/agents`)
      .pipe(map((response) => response.data));
  }
}
