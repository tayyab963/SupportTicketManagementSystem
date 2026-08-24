import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { environment } from '../../../../../environments/environment';
import { CurrentUser } from '../../../../core/models/auth.model';
import { TicketPriority, TicketStatus, UserRole } from '../../../../core/models/enums';
import { TicketDetail, getValidNextStatuses } from '../../../../core/models/ticket.model';
import { UserSummary } from '../../../../core/models/user.model';
import { AuthService } from '../../../../core/services/auth.service';
import { TicketDetailComponent } from './ticket-detail.component';

/**
 * Fake AuthService: `currentUser` is a real writable signal (so tests can `.set()` it, and the
 * component's own computed signals — which call `this.currentUser()` — read it exactly as they
 * would the real, readonly signal). `hasRole` mirrors AuthService's actual implementation
 * (single-role membership check) so the authorization tests exercise the same logic shape as prod.
 */
class FakeAuthService {
  readonly currentUser = signal<CurrentUser | null>(null);

  hasRole(...roles: UserRole[]): boolean {
    const user = this.currentUser();
    return !!user && roles.includes(user.role);
  }
}

function makeUser(overrides: Partial<CurrentUser> = {}): CurrentUser {
  return {
    id: 'user-1',
    firstName: 'Test',
    lastName: 'User',
    email: 'test.user@example.com',
    role: UserRole.Admin,
    ...overrides
  };
}

function makeTicket(overrides: Partial<TicketDetail> = {}): TicketDetail {
  return {
    id: 'ticket-1',
    ticketNumber: 'TKT-000001',
    title: 'Cannot log in',
    description: 'Login is broken for this customer.',
    status: TicketStatus.Open,
    priority: TicketPriority.High,
    customerId: 'cust-1',
    customerName: 'Carol Customer',
    assignedAgentId: null,
    assignedAgentName: null,
    createdAt: '2026-08-20T09:00:00Z',
    updatedAt: '2026-08-20T09:00:00Z',
    resolvedAt: null,
    closedAt: null,
    comments: [],
    timeEntries: null,
    ...overrides
  };
}

/**
 * ----------------------------------------------------------------------------------------------
 * HTTP-cascade handling
 * ----------------------------------------------------------------------------------------------
 * TicketDetailComponent's template unconditionally mounts <app-activity-timeline>, and once the
 * ticket loads, always mounts <app-comments-section> plus <app-time-tracking> (unless the caller
 * is a Customer). Each of those children fires its own GET in ngOnInit the instant it is rendered.
 * So loading a ticket is NOT one HTTP round trip — it is (per role):
 *   GET /tickets/:id                    (this component, always)
 *   GET /users/agents                   (this component, Admin only, fired even before the above)
 *   GET /tickets/:id/timeline           (activity-timeline child, always, once ticket loads)
 *   GET /tickets/:id/comments           (comments-section child, always, once ticket loads)
 *   GET /tickets/:id/time-entries       (time-tracking child, only when showTimeTracking(), i.e. non-Customer)
 *
 * `loadTicket(...)` below drives that whole sequence for the common case (flush -> detectChanges
 * -> flush children -> detectChanges), and `flushTimelineReload` covers the *extra* timeline GET
 * that fires after any successful status/priority/assignment action, since the component calls
 * `timelineComponent?.reload()` on success. Tests that only exercise the load-error paths never
 * reach the child components (the template's `ticket(); as ticket` branch never becomes true), so
 * they need no child flushing at all — httpMock.verify() in afterEach confirms nothing is left
 * outstanding either way.
 */
describe('TicketDetailComponent', () => {
  const ticketsUrl = `${environment.apiUrl}/tickets`;
  const usersUrl = `${environment.apiUrl}/users`;

  let httpMock: HttpTestingController;

  afterEach(() => httpMock.verify());

  function setup(routeId: string | null = 'ticket-1'): {
    fixture: ComponentFixture<TicketDetailComponent>;
    authService: FakeAuthService;
  } {
    TestBed.configureTestingModule({
      imports: [TicketDetailComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        provideNativeDateAdapter(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(routeId ? { id: routeId } : {}) } }
        },
        { provide: AuthService, useClass: FakeAuthService }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    const authService = TestBed.inject(AuthService) as unknown as FakeAuthService;
    const fixture = TestBed.createComponent(TicketDetailComponent);

    return { fixture, authService };
  }

  function flushTicket(id: string, ticket: TicketDetail): void {
    const req = httpMock.expectOne(`${ticketsUrl}/${id}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', data: ticket });
  }

  function flushAgents(agents: UserSummary[] = []): void {
    httpMock.expectOne(`${usersUrl}/agents`).flush({ success: true, message: 'ok', data: agents });
  }

  function flushChildRequests(id: string, opts: { showTimeTracking: boolean }): void {
    httpMock.expectOne(`${ticketsUrl}/${id}/timeline`).flush({ success: true, message: 'ok', data: [] });
    httpMock.expectOne(`${ticketsUrl}/${id}/comments`).flush({ success: true, message: 'ok', data: [] });
    if (opts.showTimeTracking) {
      httpMock.expectOne(`${ticketsUrl}/${id}/time-entries`).flush({
        success: true,
        message: 'ok',
        data: { entries: [], totalDurationMinutes: 0 }
      });
    }
  }

  /** Extra GET fired by the activity-timeline child's `reload()`, called after any successful action. */
  function flushTimelineReload(id: string): void {
    httpMock.expectOne(`${ticketsUrl}/${id}/timeline`).flush({ success: true, message: 'ok', data: [] });
  }

  /** Drives the full load sequence: ngOnInit -> (agents, admin only) -> ticket -> children. */
  function loadTicket(
    fixture: ComponentFixture<TicketDetailComponent>,
    ticket: TicketDetail,
    role: UserRole,
    agents: UserSummary[] = []
  ): void {
    fixture.detectChanges();
    if (role === UserRole.Admin) {
      flushAgents(agents);
    }
    flushTicket(ticket.id, ticket);
    fixture.detectChanges();
    flushChildRequests(ticket.id, { showTimeTracking: role !== UserRole.Customer });
    fixture.detectChanges();
  }

  describe('rendering', () => {
    it('shows a loading spinner before the ticket loads, then renders ticket details once loaded', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'cust-1', role: UserRole.Customer }));

      fixture.detectChanges();
      let compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.loading-spinner')).toBeTruthy();
      expect(compiled.querySelector('mat-card-title')).toBeFalsy();

      const ticket = makeTicket({ customerId: 'cust-1', status: TicketStatus.Open, priority: TicketPriority.High });
      flushTicket(ticket.id, ticket);
      fixture.detectChanges();
      flushChildRequests(ticket.id, { showTimeTracking: false });
      fixture.detectChanges();

      compiled = fixture.nativeElement as HTMLElement;
      expect(compiled.querySelector('.loading-spinner')).toBeFalsy();
      const title = compiled.querySelector('mat-card-title')?.textContent ?? '';
      expect(title).toContain(ticket.ticketNumber);
      expect(title).toContain(ticket.title);
      expect(compiled.querySelector('.badge.status-open')?.textContent?.trim()).toBe('Open');
      expect(compiled.querySelector('.badge.priority-high')?.textContent?.trim()).toBe('High');
    });
  });

  describe('load errors', () => {
    it('sets "Ticket not found." and makes no HTTP calls when the route has no ticket id', () => {
      const { fixture, authService } = setup(null);
      authService.currentUser.set(makeUser({ id: 'agent-1', role: UserRole.SupportAgent }));

      fixture.detectChanges();

      const component = fixture.componentInstance as any;
      expect(component.loading()).toBeFalse();
      expect(component.loadError()).toBe('Ticket not found.');
      httpMock.verify();
    });

    it('sets "Ticket not found." when getTicket responds with a 404', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'agent-1', role: UserRole.SupportAgent }));

      fixture.detectChanges();
      httpMock
        .expectOne(`${ticketsUrl}/ticket-1`)
        .flush({ success: false, message: 'Not found', errors: [] }, { status: 404, statusText: 'Not Found' });

      const component = fixture.componentInstance as any;
      expect(component.loading()).toBeFalse();
      expect(component.loadError()).toBe('Ticket not found.');
    });

    it('sets a generic error message when getTicket fails with a non-404 status', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'agent-1', role: UserRole.SupportAgent }));

      fixture.detectChanges();
      httpMock
        .expectOne(`${ticketsUrl}/ticket-1`)
        .flush({ success: false, message: 'Server error', errors: [] }, { status: 500, statusText: 'Internal Server Error' });

      const component = fixture.componentInstance as any;
      expect(component.loading()).toBeFalse();
      expect(component.loadError()).toBe('Could not load this ticket.');
    });
  });

  describe('authorization projections', () => {
    it('grants full permissions to an Admin regardless of ownership or assignment, exposing every valid next status', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'admin-1', role: UserRole.Admin }));
      const ticket = makeTicket({
        status: TicketStatus.InProgress,
        customerId: 'cust-9',
        assignedAgentId: 'agent-9',
        assignedAgentName: 'Other Agent'
      });

      loadTicket(fixture, ticket, UserRole.Admin, [
        { id: 'agent-1', firstName: 'Alan', lastName: 'Agent', email: 'alan@example.com', role: UserRole.SupportAgent }
      ]);

      const component = fixture.componentInstance as any;
      expect(component.canEdit()).toBeTrue();
      expect(component.canChangePriority()).toBeTrue();
      expect(component.canAssign()).toBeTrue();
      expect(component.canLogTime()).toBeTrue();
      expect(component.canComment()).toBeTrue();
      expect(component.showTimeTracking()).toBeTrue();
      expect(component.statusOptions()).toEqual(getValidNextStatuses(TicketStatus.InProgress));
    });

    it('lets an assigned SupportAgent edit, log time and comment, offering only the forward transition from Open', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'agent-1', role: UserRole.SupportAgent }));
      const ticket = makeTicket({ status: TicketStatus.Open, assignedAgentId: 'agent-1', assignedAgentName: 'Alan Agent' });

      loadTicket(fixture, ticket, UserRole.SupportAgent);

      const component = fixture.componentInstance as any;
      expect(component.canEdit()).toBeTrue();
      expect(component.canLogTime()).toBeTrue();
      expect(component.canComment()).toBeTrue();
      expect(component.statusOptions()).toEqual([TicketStatus.InProgress]);
    });

    it('excludes the customer/admin-only Resolved->Closed transition for an assigned SupportAgent', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'agent-1', role: UserRole.SupportAgent }));
      const ticket = makeTicket({ status: TicketStatus.Resolved, assignedAgentId: 'agent-1', assignedAgentName: 'Alan Agent' });

      loadTicket(fixture, ticket, UserRole.SupportAgent);

      // Sanity check on the underlying business rule this authorization is layered on top of.
      expect(getValidNextStatuses(TicketStatus.Resolved)).toEqual([TicketStatus.Closed, TicketStatus.InProgress]);

      const component = fixture.componentInstance as any;
      expect(component.statusOptions()).toEqual([TicketStatus.InProgress]);
    });

    it('blocks an unassigned SupportAgent from editing, logging time, commenting, or changing status', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'agent-2', role: UserRole.SupportAgent }));
      const ticket = makeTicket({ status: TicketStatus.Open, assignedAgentId: 'agent-1', assignedAgentName: 'Alan Agent' });

      loadTicket(fixture, ticket, UserRole.SupportAgent);

      const component = fixture.componentInstance as any;
      expect(component.canEdit()).toBeFalse();
      expect(component.canLogTime()).toBeFalse();
      expect(component.canComment()).toBeFalse();
      expect(component.statusOptions()).toEqual([]);
    });

    it('lets an owning Customer edit an open ticket, with no status change and no priority/assignment control', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'cust-1', role: UserRole.Customer }));
      const ticket = makeTicket({ status: TicketStatus.Open, customerId: 'cust-1' });

      loadTicket(fixture, ticket, UserRole.Customer);

      const component = fixture.componentInstance as any;
      expect(component.canEdit()).toBeTrue();
      expect(component.statusOptions()).toEqual([]);
      expect(component.canChangePriority()).toBeFalse();
      expect(component.canAssign()).toBeFalse();
      expect(component.showTimeTracking()).toBeFalse();
    });

    it('offers only the Closed transition to an owning Customer once the ticket is Resolved', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'cust-1', role: UserRole.Customer }));
      const ticket = makeTicket({ status: TicketStatus.Resolved, customerId: 'cust-1' });

      loadTicket(fixture, ticket, UserRole.Customer);

      const component = fixture.componentInstance as any;
      expect(component.statusOptions()).toEqual([TicketStatus.Closed]);
    });

    it('blocks a non-owning Customer from editing, though canComment is a role-only check the backend still enforces by ownership', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'cust-2', role: UserRole.Customer }));
      const ticket = makeTicket({ status: TicketStatus.Open, customerId: 'cust-1' });

      loadTicket(fixture, ticket, UserRole.Customer);

      const component = fixture.componentInstance as any;
      // canEdit correctly checks isOwner() for a Customer caller.
      expect(component.canEdit()).toBeFalse();
      // canComment does NOT check ownership for a Customer caller (see the component's canComment
      // computed) — in practice a non-owning customer never reaches this state because the backend
      // 404s the ticket load itself (TicketService.ApplyDetailVisibilityScope), so this gap is
      // unreachable in production, but the projection's actual value is still worth pinning down.
      expect(component.canComment()).toBeTrue();
    });
  });

  describe('actions', () => {
    it('submitStatus posts the pending status to /tickets/:id/status and applies the returned ticket', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'admin-1', role: UserRole.Admin }));
      const ticket = makeTicket({ status: TicketStatus.Open });

      loadTicket(fixture, ticket, UserRole.Admin);

      const component = fixture.componentInstance as any;
      component.pendingStatus.set(TicketStatus.InProgress);
      component.submitStatus();

      const req = httpMock.expectOne(`${ticketsUrl}/${ticket.id}/status`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ status: TicketStatus.InProgress });

      const updated: TicketDetail = { ...ticket, status: TicketStatus.InProgress };
      req.flush({ success: true, message: 'ok', data: updated });
      flushTimelineReload(ticket.id);

      expect(component.ticket().status).toBe(TicketStatus.InProgress);
      expect(component.statusSubmitting()).toBeFalse();
      expect(component.pendingStatus()).toBeUndefined();
    });

    it('submitPriority posts the pending priority to /tickets/:id/priority and applies the returned ticket', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'admin-1', role: UserRole.Admin }));
      const ticket = makeTicket({ priority: TicketPriority.Low });

      loadTicket(fixture, ticket, UserRole.Admin);

      const component = fixture.componentInstance as any;
      component.pendingPriority.set(TicketPriority.Critical);
      component.submitPriority();

      const req = httpMock.expectOne(`${ticketsUrl}/${ticket.id}/priority`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ priority: TicketPriority.Critical });

      const updated: TicketDetail = { ...ticket, priority: TicketPriority.Critical };
      req.flush({ success: true, message: 'ok', data: updated });
      flushTimelineReload(ticket.id);

      expect(component.ticket().priority).toBe(TicketPriority.Critical);
      expect(component.prioritySubmitting()).toBeFalse();
    });

    it('submitAssignment posts the selected agent id to /tickets/:id/assign when assigning a ticket', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'admin-1', role: UserRole.Admin }));
      const ticket = makeTicket({ assignedAgentId: null, assignedAgentName: null });

      loadTicket(fixture, ticket, UserRole.Admin);

      const component = fixture.componentInstance as any;
      component.pendingAgentId.set('agent-2');
      component.submitAssignment();

      const req = httpMock.expectOne(`${ticketsUrl}/${ticket.id}/assign`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ agentId: 'agent-2' });

      const updated: TicketDetail = { ...ticket, assignedAgentId: 'agent-2', assignedAgentName: 'Agent Two' };
      req.flush({ success: true, message: 'ok', data: updated });
      flushTimelineReload(ticket.id);

      expect(component.ticket().assignedAgentId).toBe('agent-2');
      expect(component.assignSubmitting()).toBeFalse();
    });

    it('submitAssignment posts agentId: null when unassigning via the sentinel "unassigned" value', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'admin-1', role: UserRole.Admin }));
      const ticket = makeTicket({ assignedAgentId: 'agent-1', assignedAgentName: 'Alan Agent' });

      loadTicket(fixture, ticket, UserRole.Admin);

      const component = fixture.componentInstance as any;
      expect(component.pendingAgentId()).toBe('agent-1');
      component.pendingAgentId.set(component.unassignedValue);
      component.submitAssignment();

      const req = httpMock.expectOne(`${ticketsUrl}/${ticket.id}/assign`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ agentId: null });

      const updated: TicketDetail = { ...ticket, assignedAgentId: null, assignedAgentName: null };
      req.flush({ success: true, message: 'ok', data: updated });
      flushTimelineReload(ticket.id);

      expect(component.ticket().assignedAgentId).toBeNull();
    });

    it('sets actionError and resets statusSubmitting on a failed status change, without corrupting the loaded ticket', () => {
      const { fixture, authService } = setup();
      authService.currentUser.set(makeUser({ id: 'admin-1', role: UserRole.Admin }));
      const ticket = makeTicket({ status: TicketStatus.Open });

      loadTicket(fixture, ticket, UserRole.Admin);

      const component = fixture.componentInstance as any;
      component.pendingStatus.set(TicketStatus.InProgress);
      component.submitStatus();

      const req = httpMock.expectOne(`${ticketsUrl}/${ticket.id}/status`);
      req.flush(
        { success: false, message: 'That transition is not permitted.', errors: [] },
        { status: 400, statusText: 'Bad Request' }
      );

      expect(component.actionError()).toBe('That transition is not permitted.');
      expect(component.statusSubmitting()).toBeFalse();
      expect(component.ticket().status).toBe(TicketStatus.Open);
    });
  });
});
