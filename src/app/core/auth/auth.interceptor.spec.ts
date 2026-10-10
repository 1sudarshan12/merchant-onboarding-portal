import {
  HttpClient,
  HttpErrorResponse,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LoginResponse, User } from '../../../../shared/models';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';

const sales: User = {
  id: 'sales-1',
  name: 'Demo Sales',
  email: 'sales1@example.test',
  role: 'SALES',
};
const reviewer: User = {
  id: 'reviewer-1',
  name: 'Demo Reviewer',
  email: 'reviewer1@example.test',
  role: 'REVIEWER',
};

function observe<T>(source: Observable<T>) {
  const values: T[] = [];
  const errors: unknown[] = [];
  const result = { values, errors, completed: false };
  source.subscribe({
    next: (value) => values.push(value),
    error: (error: unknown) => errors.push(error),
    complete: () => {
      result.completed = true;
    },
  });
  return result;
}

describe('authenticated HTTP requests', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => controller.verify());

  function signIn(user = sales, suffix = 'initial'): LoginResponse {
    const session: LoginResponse = {
      user,
      accessToken: `access-${suffix}`,
      refreshToken: `refresh-${suffix}`,
    };
    const result = observe(auth.login({ email: user.email, password: 'Demo#1234' }));
    const login = controller.expectOne('/api/auth/login');
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(session);
    expect(result.values).toEqual([user]);
    return session;
  }

  function unauthorized(url: string) {
    const request = controller.expectOne(url);
    request.flush(
      { code: 'UNAUTHENTICATED', message: 'Access token expired.' },
      { status: 401, statusText: 'Unauthorized' },
    );
    return request;
  }

  function refresh(suffix = 'rotated') {
    const request = controller.expectOne('/api/auth/refresh');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}` });
    return request;
  }

  it('attaches credentials only to normalized, protected, root-relative API requests', () => {
    signIn();
    for (const url of ['/api/applications', '/api/me?source=test']) {
      observe(http.get(url));
      const request = controller.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer access-initial');
      request.flush({});
    }
    for (const url of [
      'https://external.example.test/api/applications',
      '//external.example.test/api/applications',
      'api/applications',
      '/assets/example.svg',
      '/api/../outside',
      '/api/%2e%2e/outside',
      '/api/auth/login',
      '/api/health',
    ]) {
      observe(http.get(url));
      const request = controller.expectOne(url);
      expect(request.request.headers.has('Authorization'), url).toBe(false);
      request.flush({});
    }
  });

  it('does not refresh a failed authentication request or an anonymous protected request', () => {
    const anonymous = observe(http.get('/api/applications'));
    unauthorized('/api/applications');
    expect(anonymous.errors).toHaveLength(1);
    controller.expectNone('/api/auth/refresh');
    signIn();
    const loginAttempt = observe(
      http.post('/api/auth/login', { email: sales.email, password: 'incorrect' }),
    );
    unauthorized('/api/auth/login');
    expect(loginAttempt.errors).toHaveLength(1);
    controller.expectNone('/api/auth/refresh');
    expect(auth.user()).toEqual(sales);
  });

  it('shares one refresh across simultaneous 401s and retries both requests with the new token', () => {
    signIn();
    const first = observe(http.get<{ id: number }>('/api/applications?page=1'));
    const second = observe(http.get<{ id: number }>('/api/me'));
    unauthorized('/api/applications?page=1');
    unauthorized('/api/me');
    const refreshRequest = controller.expectOne('/api/auth/refresh');
    expect(refreshRequest.request.body).toEqual({ refreshToken: 'refresh-initial' });
    refreshRequest.flush({ accessToken: 'access-rotated', refreshToken: 'refresh-rotated' });
    for (const [url, id] of [
      ['/api/applications?page=1', 1],
      ['/api/me', 2],
    ] as const) {
      const retry = controller.expectOne(url);
      expect(retry.request.headers.get('Authorization')).toBe('Bearer access-rotated');
      retry.flush({ id });
    }
    expect(first.values).toEqual([{ id: 1 }]);
    expect(second.values).toEqual([{ id: 2 }]);
    expect(first.completed && second.completed).toBe(true);
    expect(first.errors.concat(second.errors)).toEqual([]);
    controller.expectNone('/api/auth/refresh');
  });

  it('retries a late 401 with the current token instead of rotating the session again', () => {
    signIn();
    const late = observe(http.get('/api/me'));
    const oldRequest = controller.expectOne('/api/me');
    const first = observe(http.get('/api/applications'));
    unauthorized('/api/applications');
    refresh();
    controller.expectOne('/api/applications').flush({ items: [] });
    oldRequest.flush({}, { status: 401, statusText: 'Unauthorized' });
    const retry = controller.expectOne('/api/me');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer access-rotated');
    retry.flush(sales);
    controller.expectNone('/api/auth/refresh');
    expect(late.values).toEqual([sales]);
    expect(first.errors.concat(late.errors)).toEqual([]);
  });

  it('starts a fresh shared refresh when the rotated token later expires', () => {
    signIn();
    for (const suffix of ['second', 'third']) {
      const result = observe(http.get('/api/me'));
      unauthorized('/api/me');
      const refreshRequest = controller.expectOne('/api/auth/refresh');
      expect(refreshRequest.request.body).toEqual({
        refreshToken: suffix === 'second' ? 'refresh-initial' : 'refresh-second',
      });
      refreshRequest.flush({ accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}` });
      const retry = controller.expectOne('/api/me');
      expect(retry.request.headers.get('Authorization')).toBe(`Bearer access-${suffix}`);
      retry.flush(sales);
      expect(result.values).toEqual([sales]);
    }
  });

  it('expires the session once when a shared refresh fails and completes every waiting request with an error', () => {
    signIn();
    const first = observe(http.get('/api/me'));
    const second = observe(http.get('/api/applications'));
    unauthorized('/api/me');
    unauthorized('/api/applications');
    controller
      .expectOne('/api/auth/refresh')
      .flush(
        { code: 'INVALID_REFRESH_TOKEN', message: 'Sign in again.' },
        { status: 401, statusText: 'Unauthorized' },
      );
    expect(first.errors).toHaveLength(1);
    expect(second.errors).toHaveLength(1);
    expect(first.values.concat(second.values)).toEqual([]);
    expect(auth.user()).toBeNull();
    expect(auth.getAccessToken()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(
      ['/login'],
      expect.objectContaining({
        replaceUrl: true,
        queryParams: expect.objectContaining({ reason: 'expired' }),
      }),
    );
    controller.expectNone('/api/me');
    controller.expectNone('/api/applications');
    signIn(reviewer, 'new-user');
    const recovered = observe(http.get('/api/me'));
    unauthorized('/api/me');
    refresh('recovered');
    controller.expectOne('/api/me').flush(reviewer);
    expect(recovered.values).toEqual([reviewer]);
  });

  it('does not log out when a successfully refreshed business request returns 403 or 500', () => {
    signIn();
    for (const status of [403, 500]) {
      const result = observe(http.get('/api/applications'));
      unauthorized('/api/applications');
      refresh(String(status));
      controller
        .expectOne('/api/applications')
        .flush(
          { code: 'BUSINESS_ERROR', message: 'Unable to load.' },
          { status, statusText: 'Error' },
        );
      expect(result.errors).toHaveLength(1);
      expect((result.errors[0] as HttpErrorResponse).status).toBe(status);
      expect(auth.user()).toEqual(sales);
      expect(auth.isAuthenticated()).toBe(true);
    }
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('retries only once and expires the session if the refreshed request also returns 401', () => {
    signIn();
    const result = observe(http.get('/api/me'));
    unauthorized('/api/me');
    refresh();
    unauthorized('/api/me');
    controller.expectNone('/api/auth/refresh');
    expect(result.errors).toHaveLength(1);
    expect(auth.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledTimes(1);
  });

  it('clears the session immediately on logout and ignores a pending refresh response', () => {
    signIn();
    const result = observe(http.get('/api/me'));
    unauthorized('/api/me');
    const pendingRefresh = controller.expectOne('/api/auth/refresh');
    auth.logout();
    expect(auth.user()).toBeNull();
    expect(auth.getAccessToken()).toBeNull();
    const logout = controller.expectOne('/api/auth/logout');
    expect(logout.request.body).toEqual({ refreshToken: 'refresh-initial' });
    logout.flush(null, { status: 204, statusText: 'No Content' });
    if (!pendingRefresh.cancelled) {
      pendingRefresh.flush({ accessToken: 'orphan-access', refreshToken: 'orphan-refresh' });
      const orphanLogout = controller.expectOne('/api/auth/logout');
      expect(orphanLogout.request.body).toEqual({ refreshToken: 'orphan-refresh' });
      orphanLogout.flush(null, { status: 204, statusText: 'No Content' });
    }
    expect(auth.isAuthenticated()).toBe(false);
    expect(result.values).toEqual([]);
    controller.expectNone('/api/me');
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('does not restore a session when an earlier login finishes after logout', () => {
    const result = observe(auth.login({ email: sales.email, password: 'Demo#1234' }));
    const pendingLogin = controller.expectOne('/api/auth/login');
    auth.logout();
    if (!pendingLogin.cancelled) {
      pendingLogin.flush({ user: sales, accessToken: 'late-access', refreshToken: 'late-refresh' });
      const orphanLogout = controller.expectOne('/api/auth/logout');
      expect(orphanLogout.request.body).toEqual({ refreshToken: 'late-refresh' });
      orphanLogout.flush(null, { status: 204, statusText: 'No Content' });
    }
    expect(auth.user()).toBeNull();
    expect(auth.getAccessToken()).toBeNull();
    expect(result.values).toEqual([]);
  });

  it('never replays a request from an old session with the credentials of a new login', () => {
    signIn();
    const old = observe(http.get('/api/applications'));
    const pending = controller.expectOne('/api/applications');
    signIn(reviewer, 'new-user');
    pending.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(old.values).toEqual([]);
    expect(old.errors).toHaveLength(1);
    controller.expectNone('/api/auth/refresh');
    controller.expectNone('/api/applications');
    expect(auth.user()).toEqual(reviewer);
    expect(auth.getAccessToken()).toBe('access-new-user');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not expire a new login when an old session’s refresh fails late', () => {
    signIn();
    const old = observe(http.get('/api/me'));
    unauthorized('/api/me');
    const pendingRefresh = controller.expectOne('/api/auth/refresh');
    signIn(reviewer, 'new-user');
    if (!pendingRefresh.cancelled)
      pendingRefresh.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(old.values).toEqual([]);
    expect(auth.user()).toEqual(reviewer);
    expect(auth.getAccessToken()).toBe('access-new-user');
    expect(router.navigate).not.toHaveBeenCalled();
    controller.expectNone('/api/me');
  });

  it('revokes a late refresh from an old session without replacing a new login or replaying its request', () => {
    signIn();
    const old = observe(http.get('/api/me'));
    unauthorized('/api/me');
    const pendingRefresh = controller.expectOne('/api/auth/refresh');
    signIn(reviewer, 'new-user');
    if (!pendingRefresh.cancelled) {
      pendingRefresh.flush({
        accessToken: 'old-rotated-access',
        refreshToken: 'old-rotated-refresh',
      });
      const orphanLogout = controller.expectOne('/api/auth/logout');
      expect(orphanLogout.request.body).toEqual({ refreshToken: 'old-rotated-refresh' });
      orphanLogout.flush(null, { status: 204, statusText: 'No Content' });
    }
    expect(old.values).toEqual([]);
    expect(auth.user()).toEqual(reviewer);
    expect(auth.getAccessToken()).toBe('access-new-user');
    expect(router.navigate).not.toHaveBeenCalled();
    controller.expectNone('/api/me');
  });

  it('keeps logout final when the best-effort server revocation fails', () => {
    signIn();
    auth.logout();
    const logout = controller.expectOne('/api/auth/logout');
    expect(logout.request.headers.has('Authorization')).toBe(false);
    logout.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(auth.user()).toBeNull();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.getAccessToken()).toBeNull();
    controller.expectNone('/api/auth/refresh');
  });
});
