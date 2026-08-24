import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { environment } from '../../../../../environments/environment';
import { TicketPriority, TicketStatus } from '../../../../core/models/enums';
import { TicketDetail } from '../../../../core/models/ticket.model';
import { TicketFormComponent } from './ticket-form.component';

describe('TicketFormComponent', () => {
  let fixture: ComponentFixture<TicketFormComponent>;
  let component: TicketFormComponent;
  let httpMock: HttpTestingController;
  let navigateSpy: jasmine.Spy;

  const ticketsUrl = `${environment.apiUrl}/tickets`;

  const ticketDetail: TicketDetail = {
    id: 'ticket-1',
    ticketNumber: 'TKT-000001',
    title: 'Cannot log in',
    description: 'User cannot access the portal.',
    status: TicketStatus.Open,
    priority: TicketPriority.High,
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

  /** Pass an id for edit mode, or null for create mode. */
  function setup(routeId: string | null): void {
    const fakeRoute = {
      snapshot: {
        paramMap: convertToParamMap(routeId ? { id: routeId } : {})
      }
    };

    TestBed.configureTestingModule({
      imports: [TicketFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        { provide: ActivatedRoute, useValue: fakeRoute }
      ]
    });

    httpMock = TestBed.inject(HttpTestingController);
    navigateSpy = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(TicketFormComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => httpMock.verify());

  it('should create in create mode without issuing any request', () => {
    setup(null);
    fixture.detectChanges();

    expect(component).toBeTruthy();
    expect((component as any).ticketId()).toBeNull();
  });

  it('shows "New Ticket" as the title in create mode', () => {
    setup(null);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('New Ticket');
  });

  it('loads the ticket in edit mode, patches the form, and shows "Edit Ticket"', () => {
    setup('ticket-1');
    fixture.detectChanges();

    expect((component as any).loading()).toBeTrue();

    const req = httpMock.expectOne(`${ticketsUrl}/ticket-1`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', data: ticketDetail });

    expect((component as any).loading()).toBeFalse();
    expect((component as any).form.value.title).toBe('Cannot log in');
    expect((component as any).form.value.description).toBe('User cannot access the portal.');

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Edit Ticket');
  });

  it('does not submit and marks the title control touched/invalid when the form is empty', () => {
    setup(null);
    fixture.detectChanges();

    (component as any).submit();

    httpMock.expectNone(ticketsUrl);
    const titleControl = (component as any).form.controls.title;
    expect(titleControl.touched).toBeTrue();
    expect(titleControl.invalid).toBeTrue();
    expect((component as any).isSubmitting()).toBeFalse();
  });

  it('POSTs the raw form value including priority when creating a ticket, then navigates on success', () => {
    setup(null);
    fixture.detectChanges();

    (component as any).form.setValue({
      title: 'New issue',
      description: 'Something broke',
      priority: TicketPriority.High
    });
    (component as any).submit();

    expect((component as any).isSubmitting()).toBeTrue();

    const req = httpMock.expectOne(ticketsUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      title: 'New issue',
      description: 'Something broke',
      priority: TicketPriority.High
    });

    req.flush({ success: true, message: 'ok', data: { ...ticketDetail, id: 'new-ticket-id' } });

    expect(navigateSpy).toHaveBeenCalledWith(['/tickets', 'new-ticket-id']);
  });

  it('PUTs only title and description (no priority) when editing a ticket, then navigates on success', () => {
    setup('ticket-1');
    fixture.detectChanges();
    httpMock.expectOne(`${ticketsUrl}/ticket-1`).flush({ success: true, message: 'ok', data: ticketDetail });

    (component as any).form.patchValue({ title: 'Updated title', description: 'Updated description' });
    (component as any).submit();

    const req = httpMock.expectOne(`${ticketsUrl}/ticket-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ title: 'Updated title', description: 'Updated description' });

    req.flush({ success: true, message: 'ok', data: ticketDetail });

    expect(navigateSpy).toHaveBeenCalledWith(['/tickets', ticketDetail.id]);
  });

  it('surfaces the API error message and stops submitting without navigating', () => {
    setup(null);
    fixture.detectChanges();

    (component as any).form.setValue({
      title: 'New issue',
      description: 'Something broke',
      priority: TicketPriority.Medium
    });
    (component as any).submit();

    const req = httpMock.expectOne(ticketsUrl);
    req.flush(
      { success: false, message: 'Title already exists.', errors: {} },
      { status: 400, statusText: 'Bad Request' }
    );

    expect((component as any).errorMessage()).toBe('Title already exists.');
    expect((component as any).isSubmitting()).toBeFalse();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('falls back to a generic error message when the server does not provide one', () => {
    setup(null);
    fixture.detectChanges();

    (component as any).form.setValue({
      title: 'New issue',
      description: 'Something broke',
      priority: TicketPriority.Medium
    });
    (component as any).submit();

    const req = httpMock.expectOne(ticketsUrl);
    req.flush('Unexpected failure', { status: 500, statusText: 'Server Error' });

    expect((component as any).errorMessage()).toBe('Could not save the ticket. Please try again.');
    expect((component as any).isSubmitting()).toBeFalse();
  });

  it('cancel() navigates to the tickets list in create mode', () => {
    setup(null);
    fixture.detectChanges();

    (component as any).cancel();

    expect(navigateSpy).toHaveBeenCalledWith(['/tickets']);
  });

  it('cancel() navigates back to the ticket detail in edit mode', () => {
    setup('ticket-1');
    fixture.detectChanges();
    httpMock.expectOne(`${ticketsUrl}/ticket-1`).flush({ success: true, message: 'ok', data: ticketDetail });

    (component as any).cancel();

    expect(navigateSpy).toHaveBeenCalledWith(['/tickets', 'ticket-1']);
  });
});
