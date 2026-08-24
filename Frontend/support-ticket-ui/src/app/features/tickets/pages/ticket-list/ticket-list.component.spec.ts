import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { TicketPriority, TicketStatus, UserRole } from '../../../../core/models/enums';
import { PagedResult } from '../../../../core/models/paged-result.model';
import { TicketListItem } from '../../../../core/models/ticket.model';
import { UserSummary } from '../../../../core/models/user.model';
import { TicketListComponent } from './ticket-list.component';

describe('TicketListComponent', () => {
  let fixture: ComponentFixture<TicketListComponent>;
  let component: TicketListComponent;
  let httpMock: HttpTestingController;

  const ticketsUrl = `${environment.apiUrl}/tickets`;
  const agentsUrl = `${environment.apiUrl}/users/agents`;

  const sampleTicket: TicketListItem = {
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

  function pagedResult(items: TicketListItem[] = [sampleTicket]): PagedResult<TicketListItem> {
    return { items, pageNumber: 1, pageSize: 20, totalCount: items.length, totalPages: 1 };
  }

  function createAuthServiceStub(role: UserRole | null) {
    return {
      hasRole: (...roles: UserRole[]) => role !== null && roles.includes(role)
    };
  }

  function setup(role: UserRole | null): void {
    TestBed.configureTestingModule({
      imports: [TicketListComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: createAuthServiceStub(role) }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TicketListComponent);
    component = fixture.componentInstance;
  }

  /** Admin/SupportAgent trigger an agents fetch on init; flush it so httpMock.verify() stays clean. */
  function flushAgentsIfNeeded(role: UserRole | null, agents: UserSummary[] = []): void {
    if (role === UserRole.Admin || role === UserRole.SupportAgent) {
      const req = httpMock.expectOne(agentsUrl);
      req.flush({ success: true, message: 'ok', data: agents });
    }
  }

  function flushTickets(items: TicketListItem[] = [sampleTicket]): void {
    httpMock.expectOne((r) => r.url === ticketsUrl).flush({ success: true, message: 'ok', data: pagedResult(items) });
  }

  afterEach(() => httpMock.verify());

  it('should create', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();
    flushTickets();
    expect(component).toBeTruthy();
  });

  it('renders ticket rows once the tickets request resolves', () => {
    setup(UserRole.Admin);
    fixture.detectChanges();
    flushAgentsIfNeeded(UserRole.Admin);
    flushTickets();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('TKT-000001');
    expect(text).toContain('Cannot log in');
  });

  it('shows the progress bar while loading and hides it once the request resolves', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeTruthy();

    flushTickets();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeFalsy();
  });

  it('resolves loading back to false when the request errors, without throwing', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url === ticketsUrl);
    expect(() => req.flush('Server error', { status: 500, statusText: 'Server Error' })).not.toThrow();

    expect(() => fixture.detectChanges()).not.toThrow();
    expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeFalsy();
    expect(fixture.nativeElement.textContent).toContain('No tickets match the current filters.');
  });

  it('requests the first page with the documented default query params on init', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) =>
        r.url === ticketsUrl &&
        r.params.get('pageNumber') === '1' &&
        r.params.get('pageSize') === '20' &&
        r.params.get('sortBy') === 'CreatedAt' &&
        r.params.get('sortDescending') === 'true'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('search')).toBeFalse();
    expect(req.request.params.has('status')).toBeFalse();
    expect(req.request.params.has('priority')).toBeFalse();
    expect(req.request.params.has('assignedAgentId')).toBeFalse();
    expect(req.request.params.has('unassigned')).toBeFalse();

    req.flush({ success: true, message: 'ok', data: pagedResult() });
  });

  it('loads agents into the agent filter for an Admin', () => {
    setup(UserRole.Admin);
    fixture.detectChanges();

    const agents: UserSummary[] = [
      { id: 'agent-1', firstName: 'Alan', lastName: 'Agent', email: 'alan@example.com', role: UserRole.SupportAgent }
    ];
    const agentsReq = httpMock.expectOne(agentsUrl);
    expect(agentsReq.request.method).toBe('GET');
    agentsReq.flush({ success: true, message: 'ok', data: agents });
    flushTickets();

    expect((component as any).agents()).toEqual(agents);
  });

  it('does not request agents for a Customer', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();
    flushTickets();

    expect(() => httpMock.expectNone(agentsUrl)).not.toThrow();
  });

  it('re-fetches with the selected status and resets to page 1 after paging forward', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();
    flushTickets();

    (component as any).onPageChange({ pageIndex: 1, pageSize: 20, length: 40 });
    const pageReq = httpMock.expectOne((r) => r.url === ticketsUrl && r.params.get('pageNumber') === '2');
    expect(pageReq.request.method).toBe('GET');
    pageReq.flush({ success: true, message: 'ok', data: pagedResult() });

    (component as any).onStatusChange(TicketStatus.Open);
    const req = httpMock.expectOne(
      (r) => r.url === ticketsUrl && r.params.get('status') === 'Open' && r.params.get('pageNumber') === '1'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', data: pagedResult() });
  });

  it('re-fetches with the selected priority filter', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();
    flushTickets();

    (component as any).onPriorityChange(TicketPriority.Critical);
    const req = httpMock.expectOne(
      (r) => r.url === ticketsUrl && r.params.get('priority') === 'Critical' && r.params.get('pageNumber') === '1'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', data: pagedResult() });
  });

  it('maps the "unassigned" agent filter to unassigned=true instead of assignedAgentId', () => {
    setup(UserRole.Admin);
    fixture.detectChanges();
    flushAgentsIfNeeded(UserRole.Admin);
    flushTickets();

    (component as any).onAgentChange('unassigned');
    const req = httpMock.expectOne((r) => r.url === ticketsUrl && r.params.get('unassigned') === 'true');
    expect(req.request.params.has('assignedAgentId')).toBeFalse();
    req.flush({ success: true, message: 'ok', data: pagedResult() });
  });

  it('sets assignedAgentId when a specific agent is selected', () => {
    setup(UserRole.Admin);
    fixture.detectChanges();
    flushAgentsIfNeeded(UserRole.Admin);
    flushTickets();

    (component as any).onAgentChange('agent-42');
    const req = httpMock.expectOne((r) => r.url === ticketsUrl && r.params.get('assignedAgentId') === 'agent-42');
    expect(req.request.params.has('unassigned')).toBeFalse();
    req.flush({ success: true, message: 'ok', data: pagedResult() });
  });

  it('updates sortBy and sortDescending on the next request', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();
    flushTickets();

    (component as any).onSortByChange('Priority');
    const sortByReq = httpMock.expectOne((r) => r.url === ticketsUrl && r.params.get('sortBy') === 'Priority');
    expect(sortByReq.request.params.get('sortDescending')).toBe('true');
    sortByReq.flush({ success: true, message: 'ok', data: pagedResult() });

    (component as any).toggleSortDirection();
    const req = httpMock.expectOne((r) => r.url === ticketsUrl && r.params.get('sortDescending') === 'false');
    expect(req.request.params.get('sortBy')).toBe('Priority');
    req.flush({ success: true, message: 'ok', data: pagedResult() });
  });

  it('debounces search input and only fires one request after the value settles', fakeAsync(() => {
    setup(UserRole.Customer);
    fixture.detectChanges();
    flushTickets();

    (component as any).searchControl.setValue('lo');
    tick(100);
    (component as any).searchControl.setValue('log');
    tick(100);
    (component as any).searchControl.setValue('login');

    httpMock.expectNone((r) => r.url === ticketsUrl);

    tick(300);

    const req = httpMock.expectOne((r) => r.url === ticketsUrl && r.params.get('search') === 'login');
    expect(req.request.params.get('pageNumber')).toBe('1');
    req.flush({ success: true, message: 'ok', data: pagedResult() });
  }));

  it('shows the "New Ticket" link for a Customer', () => {
    setup(UserRole.Customer);
    fixture.detectChanges();
    flushTickets();
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    const newTicketLink = links.find((a) => a.textContent?.includes('New Ticket'));
    expect(newTicketLink).toBeTruthy();
  });

  it('hides the "New Ticket" link for a SupportAgent', () => {
    setup(UserRole.SupportAgent);
    fixture.detectChanges();
    flushAgentsIfNeeded(UserRole.SupportAgent);
    flushTickets();
    fixture.detectChanges();

    const links = Array.from(fixture.nativeElement.querySelectorAll('a')) as HTMLAnchorElement[];
    const newTicketLink = links.find((a) => a.textContent?.includes('New Ticket'));
    expect(newTicketLink).toBeFalsy();
  });
});
