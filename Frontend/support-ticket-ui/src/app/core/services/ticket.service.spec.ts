import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { TicketPriority, TicketStatus } from '../models/enums';
import { TicketDetail, TicketListItem } from '../models/ticket.model';
import { TicketService } from './ticket.service';

describe('TicketService', () => {
  let service: TicketService;
  let httpMock: HttpTestingController;

  const baseUrl = `${environment.apiUrl}/tickets`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TicketService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getTickets sends non-empty query params and unwraps the paged result', () => {
    const listItem: TicketListItem = {
      id: 'ticket-1',
      ticketNumber: 'TKT-000001',
      title: 'Cannot log in',
      status: TicketStatus.Open,
      priority: TicketPriority.High,
      customerId: 'cust-1',
      customerName: 'Carol Customer',
      assignedAgentId: null,
      assignedAgentName: null,
      createdAt: '2026-08-24T00:00:00Z'
    };

    let result: unknown;
    service
      .getTickets({ pageNumber: 1, pageSize: 20, search: 'login', status: undefined, priority: TicketPriority.High })
      .subscribe((r) => (result = r));

    const req = httpMock.expectOne(
      (r) => r.url === baseUrl && r.params.get('pageNumber') === '1' && r.params.get('search') === 'login'
    );
    expect(req.request.params.has('status')).toBeFalse();
    expect(req.request.params.get('priority')).toBe('High');

    req.flush({
      success: true,
      message: 'ok',
      data: { items: [listItem], pageNumber: 1, pageSize: 20, totalCount: 1, totalPages: 1 }
    });

    expect(result).toEqual({ items: [listItem], pageNumber: 1, pageSize: 20, totalCount: 1, totalPages: 1 });
  });

  it('createTicket posts to /tickets and unwraps the created ticket', () => {
    const detail: TicketDetail = {
      id: 'ticket-2',
      ticketNumber: 'TKT-000002',
      title: 'Printer on fire',
      description: 'Send help',
      status: TicketStatus.Open,
      priority: TicketPriority.Critical,
      customerId: 'cust-1',
      customerName: 'Carol Customer',
      assignedAgentId: null,
      assignedAgentName: null,
      createdAt: '2026-08-24T00:00:00Z',
      updatedAt: '2026-08-24T00:00:00Z',
      resolvedAt: null,
      closedAt: null,
      comments: [],
      timeEntries: null
    };

    let result: TicketDetail | undefined;
    service
      .createTicket({ title: 'Printer on fire', description: 'Send help', priority: TicketPriority.Critical })
      .subscribe((r) => (result = r));

    const req = httpMock.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'ok', data: detail });

    expect(result).toEqual(detail);
  });

  it('assignTicket posts to /tickets/{id}/assign', () => {
    service.assignTicket('ticket-1', { agentId: 'agent-1' }).subscribe();

    const req = httpMock.expectOne(`${baseUrl}/ticket-1/assign`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ agentId: 'agent-1' });
    req.flush({ success: true, message: 'ok', data: {} });
  });
});
