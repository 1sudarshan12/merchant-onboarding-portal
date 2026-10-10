import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  type CanActivateFn,
  provideRouter,
  Router,
  type RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role, User } from '../../../../shared/models';
import {
  authChildGuard,
  authGuard,
  guestGuard,
  permissionGuard,
  safeReturnUrl,
} from './auth.guard';
import { AuthService } from './auth.service';

describe('authentication route guards', () => {
  let auth: AuthService;
  let controller: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    controller = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => controller.verify());

  async function signIn(role: Role = 'SALES') {
    const user: User = {
      id: `${role.toLowerCase()}-1`,
      name: `Demo ${role}`,
      email: `${role.toLowerCase()}@example.test`,
      role,
    };
    const login = firstValueFrom(auth.login({ email: user.email, password: 'Demo#1234' }));
    controller
      .expectOne('/api/auth/login')
      .flush({ user, accessToken: `access-${role}`, refreshToken: `refresh-${role}` });
    await login;
  }

  async function run(guard: CanActivateFn, url = '/overview') {
    const result = TestBed.runInInjectionContext(() =>
      guard(new ActivatedRouteSnapshot(), { url } as RouterStateSnapshot),
    );
    return await (isObservable(result) ? firstValueFrom(result) : result);
  }

  it('redirects an anonymous protected navigation to login with a safe return URL', async () => {
    const result = await run(authGuard, '/overview?status=DRAFT#applications');
    expect(result).toBeInstanceOf(UrlTree);
    const tree = result as UrlTree;
    expect(tree.queryParams['returnUrl']).toBe('/overview?status=DRAFT#applications');
    expect(router.serializeUrl(tree).split('?')[0]).toBe('/login');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('allows authenticated parent and child navigation, then checks again after logout', async () => {
    await signIn();
    expect(await run(authGuard)).toBe(true);
    expect(await run(authChildGuard)).toBe(true);
    auth.logout();
    controller.expectOne('/api/auth/logout').flush(null, { status: 204, statusText: 'No Content' });
    expect(await run(authChildGuard)).toBeInstanceOf(UrlTree);
  });

  it('allows the login route for guests and redirects a signed-in user to the workspace', async () => {
    expect(await run(guestGuard, '/login')).toBe(true);
    await signIn();
    const result = await run(guestGuard, '/login');
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/overview');
  });

  it('requires authentication and the requested role permission before activating a feature', async () => {
    const guard = permissionGuard('application:create');
    const anonymous = await run(guard);
    expect(anonymous).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(anonymous as UrlTree).split('?')[0]).toBe('/login');
    await signIn('SALES');
    expect(await run(guard)).toBe(true);
    const cannotReview = await run(permissionGuard('application:review'));
    expect(router.serializeUrl(cannotReview as UrlTree)).toBe('/overview');
    await signIn('ADMIN');
    expect(await run(permissionGuard('application:assign'))).toBe(true);
    const cannotCreate = await run(guard);
    expect(router.serializeUrl(cannotCreate as UrlTree)).toBe('/overview');
  });

  it('restricts return URLs to implemented workspace routes and preserves query and fragment', () => {
    for (const url of [
      '/overview',
      '/overview?status=DRAFT#applications',
      '/applications',
      '/applications?status=SUBMITTED&page=2#results',
    ]) {
      expect(safeReturnUrl(url)).toBe(url);
    }
    for (const url of [
      null,
      '',
      'https://external.example.test',
      '//external.example.test',
      'javascript:alert(1)',
      '/login',
      '/unknown',
      '/overview/../login',
      '/overview-extra',
      '/applications-extra',
      '/applications/../login',
      '/applications/new',
      '/overview\\evil',
    ]) {
      expect(safeReturnUrl(url)).toBe('/overview');
    }
  });
});
