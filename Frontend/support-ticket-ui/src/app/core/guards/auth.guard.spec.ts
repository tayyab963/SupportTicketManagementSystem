import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { authGuard, guestGuard } from './auth.guard';

describe('auth.guard', () => {
  let authServiceSpy: { isAuthenticated: jasmine.Spy };
  let router: Router;

  const route = {} as unknown as ActivatedRouteSnapshot;

  beforeEach(() => {
    authServiceSpy = { isAuthenticated: jasmine.createSpy('isAuthenticated') };

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    router = TestBed.inject(Router);
  });

  describe('authGuard', () => {
    it('allows navigation when the user is authenticated', () => {
      authServiceSpy.isAuthenticated.and.returnValue(true);
      const state = { url: '/tickets/123' } as unknown as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => authGuard(route, state));

      expect(result).toBeTrue();
    });

    it('redirects to /login with a returnUrl query param when the user is not authenticated', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);
      const state = { url: '/tickets/123' } as unknown as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => authGuard(route, state)) as UrlTree;

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result)).toBe(`/login?returnUrl=${encodeURIComponent(state.url)}`);
    });
  });

  describe('guestGuard', () => {
    it('redirects an already-authenticated user to /tickets', () => {
      authServiceSpy.isAuthenticated.and.returnValue(true);
      const state = {} as unknown as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => guestGuard(route, state)) as UrlTree;

      expect(result).toBeInstanceOf(UrlTree);
      expect(router.serializeUrl(result)).toBe('/tickets');
    });

    it('allows navigation when the user is not authenticated', () => {
      authServiceSpy.isAuthenticated.and.returnValue(false);
      const state = {} as unknown as RouterStateSnapshot;

      const result = TestBed.runInInjectionContext(() => guestGuard(route, state));

      expect(result).toBeTrue();
    });
  });
});
