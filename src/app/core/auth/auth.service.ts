import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  catchError,
  defer,
  finalize,
  map,
  Observable,
  of,
  shareReplay,
  throwError,
  timeout,
} from 'rxjs';
import type { LoginResponse, TokenPair, User } from '../../../../shared/models';
import { safeReturnUrl } from './auth-navigation';

class SessionChangedError extends Error {
  constructor() {
    super('The session changed while this request was in progress.');
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<LoginResponse | null>(null);
  private revision = 0;
  private refreshRequest: Observable<string> | null = null;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);

  getAccessToken(): string | null {
    return this.session()?.accessToken ?? null;
  }

  /** Identifies a login session, not a particular token rotation within that session. */
  sessionRevision(): number {
    return this.revision;
  }

  login(credentials: { email: string; password: string }): Observable<User> {
    return defer(() => {
      const revision = ++this.revision;
      this.session.set(null);
      this.refreshRequest = null;
      return this.http.post<LoginResponse>('/api/auth/login', credentials).pipe(
        timeout(10_000),
        map((session) => {
          if (revision !== this.revision) {
            this.revoke(session.refreshToken);
            throw new SessionChangedError();
          }
          this.session.set(session);
          return session.user;
        }),
      );
    });
  }

  refreshAccessToken(): Observable<string> {
    if (this.refreshRequest) return this.refreshRequest;
    const current = this.session();
    if (!current) return throwError(() => new SessionChangedError());
    const revision = this.revision;

    const request = this.http
      .post<TokenPair>('/api/auth/refresh', { refreshToken: current.refreshToken })
      .pipe(
        timeout(10_000),
        map((tokens) => {
          if (revision !== this.revision) {
            // A logout/new login may finish before this response. Never restore the old user.
            this.revoke(tokens.refreshToken);
            throw new SessionChangedError();
          }
          this.session.set({ ...current, ...tokens });
          return tokens.accessToken;
        }),
        catchError((error: unknown) => {
          this.expireSession(revision);
          return throwError(() => error);
        }),
        // Run once for the HTTP source, not once per waiting request's subscription.
        finalize(() => {
          if (this.refreshRequest === request) this.refreshRequest = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.refreshRequest = request;
    return request;
  }

  logout(): void {
    const refreshToken = this.session()?.refreshToken;
    this.clearSession();
    void this.router.navigate(['/login'], { replaceUrl: true });
    if (refreshToken) this.revoke(refreshToken);
  }

  expireSession(expectedRevision: number): void {
    if (expectedRevision !== this.revision || !this.session()) return;
    const returnUrl = safeReturnUrl(this.router.url);
    this.clearSession();
    void this.router.navigate(['/login'], {
      queryParams: { reason: 'expired', returnUrl },
      replaceUrl: true,
    });
  }

  private clearSession(): void {
    ++this.revision;
    this.session.set(null);
    this.refreshRequest = null;
  }

  private revoke(refreshToken: string): void {
    // Clear local access immediately. A network failure must not trap the user in the workspace.
    this.http
      .post<void>('/api/auth/logout', { refreshToken })
      .pipe(
        timeout(5_000),
        catchError(() => of(undefined)),
      )
      .subscribe();
  }
}
