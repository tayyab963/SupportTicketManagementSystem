import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Login/register 401s are just "wrong credentials" feedback for the form, not an expired session. */
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register'];

/** On any other 401 (expired/invalid/revoked token), clears the session and returns to /login. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      const isUnauthenticatedApiCall =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !AUTH_ENDPOINTS.some((endpoint) => req.url.includes(endpoint));

      if (isUnauthenticatedApiCall) {
        authService.logout();
        void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
      }

      return throwError(() => error);
    })
  );
};
