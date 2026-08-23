import { Injectable } from '@angular/core';
import { CurrentUser } from '../models/auth.model';

const TOKEN_KEY = 'stms_auth_token';
const USER_KEY = 'stms_auth_user';

/**
 * Sole owner of localStorage access for the auth session. Kept separate from AuthService so the
 * interceptor can read the token without depending on AuthService (which depends on HttpClient).
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  }

  getUser(): CurrentUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as CurrentUser;
    } catch {
      return null;
    }
  }

  setUser(user: CurrentUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  }

  clear(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
}
