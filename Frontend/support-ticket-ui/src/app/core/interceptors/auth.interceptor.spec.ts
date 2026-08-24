import {
  HttpClient,
  HttpHandlerFn,
  HttpRequest,
  HttpResponse,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TokenStorageService } from '../services/token-storage.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let tokenStorage: TokenStorageService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
    tokenStorage.clear();
  });

  afterEach(() => {
    httpMock.verify();
    tokenStorage.clear();
  });

  it('adds an Authorization header with the stored bearer token', () => {
    tokenStorage.setToken('abc123');

    http.get('/api/tickets').subscribe();

    const req = httpMock.expectOne('/api/tickets');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush({});
  });

  it('does not add an Authorization header when no token is stored', () => {
    http.get('/api/tickets').subscribe();

    const req = httpMock.expectOne('/api/tickets');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('passes the original request through unchanged (no clone) when no token is stored', () => {
    const req = new HttpRequest('GET', '/api/tickets');
    const nextSpy: jasmine.Spy = jasmine
      .createSpy('next')
      .and.returnValue(of(new HttpResponse({ status: 200 })));

    TestBed.runInInjectionContext(() => authInterceptor(req, nextSpy as unknown as HttpHandlerFn));

    expect(nextSpy).toHaveBeenCalledTimes(1);
    // Reference equality (not just deep equality) proves the interceptor did NOT clone the request.
    expect(nextSpy.calls.mostRecent().args[0]).toBe(req);
  });
});
