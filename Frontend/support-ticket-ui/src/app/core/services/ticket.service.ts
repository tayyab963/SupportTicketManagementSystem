import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import { PagedResult } from '../models/paged-result.model';
import {
  AssignTicketRequest,
  ChangeTicketPriorityRequest,
  ChangeTicketStatusRequest,
  CreateCommentRequest,
  CreateTicketRequest,
  CreateTimeEntryRequest,
  TicketDetail,
  TicketListItem,
  TicketQueryParams,
  UpdateTicketRequest
} from '../models/ticket.model';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/tickets`;

  getTickets(query: TicketQueryParams): Observable<PagedResult<TicketListItem>> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }

    return this.http
      .get<ApiSuccessResponse<PagedResult<TicketListItem>>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }

  getTicket(id: string): Observable<TicketDetail> {
    return this.http
      .get<ApiSuccessResponse<TicketDetail>>(`${this.baseUrl}/${id}`)
      .pipe(map((response) => response.data));
  }

  createTicket(request: CreateTicketRequest): Observable<TicketDetail> {
    return this.http
      .post<ApiSuccessResponse<TicketDetail>>(this.baseUrl, request)
      .pipe(map((response) => response.data));
  }

  updateTicket(id: string, request: UpdateTicketRequest): Observable<TicketDetail> {
    return this.http
      .put<ApiSuccessResponse<TicketDetail>>(`${this.baseUrl}/${id}`, request)
      .pipe(map((response) => response.data));
  }

  changeStatus(id: string, request: ChangeTicketStatusRequest): Observable<TicketDetail> {
    return this.http
      .post<ApiSuccessResponse<TicketDetail>>(`${this.baseUrl}/${id}/status`, request)
      .pipe(map((response) => response.data));
  }

  changePriority(id: string, request: ChangeTicketPriorityRequest): Observable<TicketDetail> {
    return this.http
      .post<ApiSuccessResponse<TicketDetail>>(`${this.baseUrl}/${id}/priority`, request)
      .pipe(map((response) => response.data));
  }

  assignTicket(id: string, request: AssignTicketRequest): Observable<TicketDetail> {
    return this.http
      .post<ApiSuccessResponse<TicketDetail>>(`${this.baseUrl}/${id}/assign`, request)
      .pipe(map((response) => response.data));
  }

  addComment(id: string, request: CreateCommentRequest): Observable<TicketDetail> {
    return this.http
      .post<ApiSuccessResponse<TicketDetail>>(`${this.baseUrl}/${id}/comments`, request)
      .pipe(map((response) => response.data));
  }

  addTimeEntry(id: string, request: CreateTimeEntryRequest): Observable<TicketDetail> {
    return this.http
      .post<ApiSuccessResponse<TicketDetail>>(`${this.baseUrl}/${id}/time-entries`, request)
      .pipe(map((response) => response.data));
  }
}
