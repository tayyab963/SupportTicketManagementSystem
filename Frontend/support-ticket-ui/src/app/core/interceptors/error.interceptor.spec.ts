import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let authServiceSpy: { logout: jasmine.Spy };
  let routerSpy: { navigate: jasmine.Spy; url: string };

  beforeEach(() => {
    authServiceSpy = { logout: jasmine.createSpy('logout') };
    routerSpy = { navigate: jasmine.createSpy('navigate').and.resolveTo(true), url: '/tickets/42' };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('on a 401 from a non-auth endpoint, logs out, redirects to /login with a returnUrl, and still rethrows', () => {
    let capturedError: unknown;

    http.get('/api/tickets/42').subscribe({
      next: () => fail('expected the request to error'),
      error: (err: unknown) => (capturedError = err)
    });

    const req = httpMock.expectOne('/api/tickets/42');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.logout).toHaveBeenCalled();
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: routerSpy.url } });
    expect(capturedError).toBeInstanceOf(HttpErrorResponse);
    expect((capturedError as HttpErrorResponse).status).toBe(401);
  });

  it('on a 401 from /auth/login, does not log out or redirect, but still rethrows', () => {
    let capturedError: unknown;

    http.post('/api/auth/login', { email: 'a@b.com', password: 'wrong' }).subscribe({
      next: () => fail('expected the request to error'),
      error: (err: unknown) => (capturedError = err)
    });

    const req = httpMock.expectOne('/api/auth/login');
    req.flush('Invalid credentials', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(capturedError).toBeInstanceOf(HttpErrorResponse);
    expect((capturedError as HttpErrorResponse).status).toBe(401);
  });

  it('on a non-401 error, does not log out or redirect, but still rethrows', () => {
    let capturedError: unknown;

    http.get('/api/tickets/42').subscribe({
      next: () => fail('expected the request to error'),
      error: (err: unknown) => (capturedError = err)
    });

    const req = httpMock.expectOne('/api/tickets/42');
    req.flush('Server error', { status: 500, statusText: 'Internal Server Error' });

    expect(authServiceSpy.logout).not.toHaveBeenCalled();
    expect(routerSpy.navigate).not.toHaveBeenCalled();
    expect(capturedError).toBeInstanceOf(HttpErrorResponse);
    expect((capturedError as HttpErrorResponse).status).toBe(500);
  });
});
