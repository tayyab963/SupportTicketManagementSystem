import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from '../models/enums';
import { AuthService } from '../services/auth.service';

/**
 * Restricts a route to specific roles, declared via route data: `data: { roles: [UserRole.Admin] }`.
 * This is a UX convenience only — it hides routes the current user has no business navigating to.
 * It is NOT the security boundary: every protected API call re-checks the role/ownership from the
 * validated JWT on the server, since a client-side guard can never be trusted to enforce access.
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['roles'] as UserRole[] | undefined;

  if (!allowedRoles || allowedRoles.length === 0 || authService.hasRole(...allowedRoles)) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
