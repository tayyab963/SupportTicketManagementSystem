import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { environment } from '../../../../../environments/environment';
import { DashboardSummary } from '../../../../core/models/dashboard.model';
import { StatCardComponent } from '../../components/stat-card/stat-card.component';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let component: DashboardComponent;
  let httpMock: HttpTestingController;

  const summaryUrl = `${environment.apiUrl}/dashboard/summary`;

  const fullSummary: DashboardSummary = {
    totalTickets: 50,
    openTickets: 10,
    inProgressTickets: 8,
    resolvedTickets: 20,
    closedTickets: 12,
    criticalTickets: 3,
    lowPriorityTickets: 15,
    mediumPriorityTickets: 20,
    highPriorityTickets: 12,
    averageResolutionMinutes: 135,
    agentWorkload: [
      { agentId: 'agent-1', agentName: 'Alan Agent', totalAssigned: 5, open: 2, inProgress: 1, resolved: 2 },
      { agentId: 'agent-2', agentName: 'Amy Agent', totalAssigned: 3, open: 1, inProgress: 1, resolved: 1 }
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideNoopAnimations()]
    });

    fixture = TestBed.createComponent(DashboardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  /** Matches and flushes the one outstanding GET /dashboard/summary request with a success payload. */
  function flushSummary(summary: DashboardSummary): void {
    const req = httpMock.expectOne(summaryUrl);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'ok', data: summary });
  }

  it('shows a loading indicator before the summary resolves, and renders no stat cards yet', () => {
    fixture.detectChanges(); // ngOnInit fires the request

    expect(fixture.nativeElement.querySelector('mat-progress-bar')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('app-stat-card').length).toBe(0);

    flushSummary(fullSummary);
  });

  it('requests GET {apiUrl}/dashboard/summary with no body and no query params', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne(summaryUrl);
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    expect(req.request.params.keys().length).toBe(0);

    req.flush({ success: true, message: 'ok', data: fullSummary });
  });

  describe('after the summary loads successfully', () => {
    beforeEach(() => {
      fixture.detectChanges();
      flushSummary(fullSummary);
      fixture.detectChanges();
    });

    it('hides the loading indicator', () => {
      expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeNull();
      expect((component as any).loading()).toBeFalse();
      expect((component as any).loadError()).toBeNull();
    });

    it('renders one stat card per KPI with the correct label/value inputs', () => {
      const statCards = fixture.debugElement.queryAll(By.directive(StatCardComponent));
      expect(statCards.length).toBe(6);

      const rendered = statCards.map((el) => ({
        label: (el.componentInstance as StatCardComponent).label,
        value: (el.componentInstance as StatCardComponent).value
      }));

      expect(rendered).toEqual([
        { label: 'Total Tickets', value: 50 },
        { label: 'Open', value: 10 },
        { label: 'In Progress', value: 8 },
        { label: 'Resolved', value: 20 },
        { label: 'Critical', value: 3 },
        { label: 'Avg. Resolution', value: '2h 15m' }
      ]);
    });

    it('renders the totals in the DOM text', () => {
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain('50');
      expect(text).toContain('2h 15m');
    });

    it('computes statusSegments as Open/In Progress/Resolved/Closed with the summary counts and colors', () => {
      const segments = (component as any).statusSegments();
      expect(segments).toEqual([
        { label: 'Open', value: 10, color: '#4f46e5' },
        { label: 'In Progress', value: 8, color: '#f59e0b' },
        { label: 'Resolved', value: 20, color: '#10b981' },
        { label: 'Closed', value: 12, color: '#64748b' }
      ]);
    });

    it('computes prioritySegments as Low/Medium/High/Critical with the summary counts and colors', () => {
      const segments = (component as any).prioritySegments();
      expect(segments).toEqual([
        { label: 'Low', value: 15, color: '#64748b' },
        { label: 'Medium', value: 20, color: '#4f46e5' },
        { label: 'High', value: 12, color: '#f59e0b' },
        { label: 'Critical', value: 3, color: '#e11d48' }
      ]);
    });

    it('formats avgResolutionLabel via formatDuration (135 min -> "2h 15m")', () => {
      expect((component as any).avgResolutionLabel()).toBe('2h 15m');
    });
  });

  it('avgResolutionLabel renders "—" when averageResolutionMinutes is 0', () => {
    fixture.detectChanges();
    flushSummary({ ...fullSummary, averageResolutionMinutes: 0 });
    fixture.detectChanges();

    expect((component as any).avgResolutionLabel()).toBe('—');

    const statCards = fixture.debugElement.queryAll(By.directive(StatCardComponent));
    const avgCard = statCards.find((el) => (el.componentInstance as StatCardComponent).label === 'Avg. Resolution');
    expect(avgCard?.componentInstance.value).toBe('—');
  });

  describe('when the summary request fails', () => {
    beforeEach(() => {
      fixture.detectChanges();
      const req = httpMock.expectOne(summaryUrl);
      req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });
      fixture.detectChanges();
    });

    it('sets loadError, clears loading, and renders the error message instead of the data view', () => {
      expect((component as any).loading()).toBeFalse();
      expect((component as any).loadError()).toBe('Could not load the dashboard summary.');

      expect(fixture.nativeElement.textContent).toContain('Could not load the dashboard summary.');
      expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeNull();
      expect(fixture.nativeElement.querySelectorAll('app-stat-card').length).toBe(0);
      expect(fixture.nativeElement.querySelector('app-donut-chart')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-bar-chart')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-agent-workload-table')).toBeNull();
    });
  });
});
