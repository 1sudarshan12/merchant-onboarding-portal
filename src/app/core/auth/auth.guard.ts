import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { ROLE_PERMISSIONS, type Permission } from '../../../../shared/permissions';
import { safeReturnUrl } from './auth-navigation';
import { AuthService } from './auth.service';

export { safeReturnUrl } from './auth-navigation';

function loginRedirect(url: string) {
  return inject(Router).createUrlTree(['/login'], {
    queryParams: { returnUrl: safeReturnUrl(url) },
  });
}

export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthService).isAuthenticated() || loginRedirect(state.url);

export const authChildGuard: CanActivateChildFn = (_route, state) =>
  inject(AuthService).isAuthenticated() || loginRedirect(state.url);

export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isAuthenticated() || inject(Router).createUrlTree(['/overview']);

/** Apply with each future restricted feature; record-level authorization still belongs to the API. */
export function permissionGuard(permission: Permission): CanActivateFn {
  return (_route, state) => {
    const user = inject(AuthService).user();
    if (!user) return loginRedirect(state.url);
    return (
      ROLE_PERMISSIONS[user.role].includes(permission) ||
      inject(Router).createUrlTree(['/overview'])
    );
  };
}
