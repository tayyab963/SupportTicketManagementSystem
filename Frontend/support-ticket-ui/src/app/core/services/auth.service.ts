import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import { AuthResponse, CurrentUser, LoginRequest } from '../models/auth.model';
import { UserRole } from '../models/enums';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);

  private readonly currentUserSignal = signal<CurrentUser | null>(this.tokenStorage.getUser());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);

  login(request: LoginRequest): Observable<ApiSuccessResponse<AuthResponse>> {
    return this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, request)
      .pipe(tap((response) => this.setSession(response.data)));
  }

  logout(): void {
    this.tokenStorage.clear();
    this.currentUserSignal.set(null);
  }

  hasRole(...roles: UserRole[]): boolean {
    const user = this.currentUserSignal();
    return !!user && roles.includes(user.role);
  }

  /**
   * Called once at app startup (see provideAppInitializer in app.config.ts). Applies whatever was
   * in storage immediately (so route guards work without a flash-redirect on refresh), then
   * re-validates the token against the server in the background — an invalid, expired, or
   * deactivated-account token results in a clean logout rather than a stale, trusted client state.
   */
  restoreSession(): void {
    const token = this.tokenStorage.getToken();
    if (!token) {
      return;
    }

    this.http.get<ApiSuccessResponse<CurrentUser>>(`${environment.apiUrl}/auth/me`).subscribe({
      next: (response) => {
        this.currentUserSignal.set(response.data);
        this.tokenStorage.setUser(response.data);
      },
      error: () => this.logout()
    });
  }

  private setSession(auth: AuthResponse): void {
    this.tokenStorage.setToken(auth.token);
    this.tokenStorage.setUser(auth.user);
    this.currentUserSignal.set(auth.user);
  }
}
