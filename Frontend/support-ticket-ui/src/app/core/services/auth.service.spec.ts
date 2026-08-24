import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AuthResponse, CurrentUser, LoginRequest } from '../models/auth.model';
import { UserRole } from '../models/enums';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';

describe('AuthService', () => {
  let httpMock: HttpTestingController;
  let tokenStorage: TokenStorageService;

  const user: CurrentUser = {
    id: 'user-1',
    firstName: 'Alan',
    lastName: 'Agent',
    email: 'alan@example.com',
    role: UserRole.SupportAgent
  };

  const authResponse: AuthResponse = {
    token: 'jwt-token-123',
    expiresAtUtc: '2026-08-25T00:00:00Z',
    user
  };

  const loginRequest: LoginRequest = { email: 'alan@example.com', password: 'secret' };

  beforeEach(() => {
    // AuthService hydrates its signal from TokenStorageService (localStorage) at construction time,
    // so every test must start from a clean slate before the service is first injected.
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });

    httpMock = TestBed.inject(HttpTestingController);
    tokenStorage = TestBed.inject(TokenStorageService);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  describe('initialization', () => {
    it('hydrates currentUser from a previously stored session', () => {
      tokenStorage.setToken('stored-token');
      tokenStorage.setUser(user);

      const service = TestBed.inject(AuthService);

      expect(service.currentUser()).toEqual(user);
      expect(service.isAuthenticated()).toBeTrue();
    });

    it('starts with no current user when nothing is stored', () => {
      const service = TestBed.inject(AuthService);

      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  describe('login', () => {
    it('posts credentials to /auth/login and unwraps the response data', () => {
      const service = TestBed.inject(AuthService);

      let result: AuthResponse | undefined;
      service.login(loginRequest).subscribe((response) => (result = response.data));

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(loginRequest);

      req.flush({ success: true, message: 'ok', data: authResponse });

      expect(result).toEqual(authResponse);
    });

    it('persists the token and user, and updates the signals, on successful login', () => {
      const service = TestBed.inject(AuthService);

      service.login(loginRequest).subscribe();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/login`);
      req.flush({ success: true, message: 'ok', data: authResponse });

      expect(tokenStorage.getToken()).toBe(authResponse.token);
      expect(tokenStorage.getUser()).toEqual(user);
      expect(service.currentUser()).toEqual(user);
      expect(service.isAuthenticated()).toBeTrue();
    });
  });

  describe('logout', () => {
    it('clears storage and nulls the current user', () => {
      tokenStorage.setToken('stored-token');
      tokenStorage.setUser(user);
      const service = TestBed.inject(AuthService);
      expect(service.isAuthenticated()).toBeTrue();

      service.logout();

      expect(tokenStorage.getToken()).toBeNull();
      expect(tokenStorage.getUser()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
    });
  });

  describe('hasRole', () => {
    it('returns false when no user is logged in', () => {
      const service = TestBed.inject(AuthService);

      expect(service.hasRole(UserRole.Admin, UserRole.SupportAgent)).toBeFalse();
    });

    it('returns true when the current user has one of the given roles', () => {
      tokenStorage.setToken('stored-token');
      tokenStorage.setUser(user); // role: SupportAgent
      const service = TestBed.inject(AuthService);

      expect(service.hasRole(UserRole.Admin, UserRole.SupportAgent)).toBeTrue();
    });

    it('returns false when the current user does not have any of the given roles', () => {
      tokenStorage.setToken('stored-token');
      tokenStorage.setUser(user); // role: SupportAgent
      const service = TestBed.inject(AuthService);

      expect(service.hasRole(UserRole.Admin)).toBeFalse();
    });
  });

  describe('restoreSession', () => {
    it('does nothing (no HTTP call) when there is no stored token', () => {
      const service = TestBed.inject(AuthService);

      service.restoreSession();

      httpMock.expectNone(`${environment.apiUrl}/auth/me`);
      expect(service.currentUser()).toBeNull();
    });

    it('fetches the current user and updates the signal + storage on success', () => {
      tokenStorage.setToken('stored-token');
      const service = TestBed.inject(AuthService);

      service.restoreSession();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, message: 'ok', data: user });

      expect(service.currentUser()).toEqual(user);
      expect(service.isAuthenticated()).toBeTrue();
      expect(tokenStorage.getUser()).toEqual(user);
    });

    it('logs out (clears signal + storage) when the /auth/me request fails', () => {
      tokenStorage.setToken('stale-token');
      tokenStorage.setUser(user);
      const service = TestBed.inject(AuthService);

      service.restoreSession();

      const req = httpMock.expectOne(`${environment.apiUrl}/auth/me`);
      req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBeFalse();
      expect(tokenStorage.getToken()).toBeNull();
      expect(tokenStorage.getUser()).toBeNull();
    });
  });
});
