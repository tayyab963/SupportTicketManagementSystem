import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { UserRole } from '../models/enums';
import { AuthService } from '../services/auth.service';
import { roleGuard } from './role.guard';

describe('roleGuard', () => {
  let authServiceSpy: { hasRole: jasmine.Spy };
  let router: Router;

  const state = {} as unknown as RouterStateSnapshot;

  /** Builds a minimal route snapshot exposing only the `data.roles` property the guard reads. */
  const routeWithRoles = (roles?: UserRole[]): ActivatedRouteSnapshot =>
    ({ data: { roles } }) as unknown as ActivatedRouteSnapshot;

  beforeEach(() => {
    authServiceSpy = { hasRole: jasmine.createSpy('hasRole') };

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

  it('allows navigation when the route declares no roles', () => {
    const result = TestBed.runInInjectionContext(() => roleGuard(routeWithRoles(undefined), state));

    expect(result).toBeTrue();
    expect(authServiceSpy.hasRole).not.toHaveBeenCalled();
  });

  it('allows navigation when the route declares an empty roles array', () => {
    const result = TestBed.runInInjectionContext(() => roleGuard(routeWithRoles([]), state));

    expect(result).toBeTrue();
    expect(authServiceSpy.hasRole).not.toHaveBeenCalled();
  });

  it('allows navigation when the user has one of the allowed roles', () => {
    authServiceSpy.hasRole.and.returnValue(true);

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles([UserRole.Admin, UserRole.SupportAgent]), state)
    );

    expect(result).toBeTrue();
    expect(authServiceSpy.hasRole).toHaveBeenCalledWith(UserRole.Admin, UserRole.SupportAgent);
  });

  it('redirects to /tickets when the user lacks any of the allowed roles', () => {
    authServiceSpy.hasRole.and.returnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(routeWithRoles([UserRole.Admin]), state)
    ) as UrlTree;

    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result)).toBe('/tickets');
  });
});
