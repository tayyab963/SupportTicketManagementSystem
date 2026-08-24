import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import { PagedResult } from '../models/paged-result.model';
import {
  CreateUserRequest,
  UpdateUserRequest,
  UserListItem,
  UserQueryParams,
  UserSummary
} from '../models/user.model';

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

  /** Admin-only user management list — server-side paged/searched/filtered. */
  getUsers(query: UserQueryParams): Observable<PagedResult<UserListItem>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http
      .get<ApiSuccessResponse<PagedResult<UserListItem>>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  createUser(request: CreateUserRequest): Observable<UserListItem> {
    return this.http
      .post<ApiSuccessResponse<UserListItem>>(this.baseUrl, request)
      .pipe(map((response) => response.data));
  }

  updateUser(id: string, request: UpdateUserRequest): Observable<UserListItem> {
    return this.http
      .put<ApiSuccessResponse<UserListItem>>(`${this.baseUrl}/${id}`, request)
      .pipe(map((response) => response.data));
  }

  activateUser(id: string): Observable<UserListItem> {
    return this.http
      .post<ApiSuccessResponse<UserListItem>>(`${this.baseUrl}/${id}/activate`, {})
      .pipe(map((response) => response.data));
  }

  deactivateUser(id: string): Observable<UserListItem> {
    return this.http
      .post<ApiSuccessResponse<UserListItem>>(`${this.baseUrl}/${id}/deactivate`, {})
      .pipe(map((response) => response.data));
  }
}
