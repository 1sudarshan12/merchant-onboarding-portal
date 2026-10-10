import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

function isProtectedApiUrl(value: string): boolean {
  // The application uses the same-origin /api proxy. Do not send its credentials elsewhere.
  if (!value.startsWith('/api/') || value.includes('\\')) return false;
  const url = new URL(value, 'https://merchant.invalid');
  return (
    url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/auth/') &&
    url.pathname !== '/api/health' &&
    url.pathname !== '/api/health/'
  );
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isProtectedApiUrl(request.url)) return next(request);
  const auth = inject(AuthService);
  const token = auth.getAccessToken();
  if (!token) return next(request);
  const revision = auth.sessionRevision();
  const withToken = (value: string) =>
    request.clone({ setHeaders: { Authorization: `Bearer ${value}` } });

  const retry = (value: string) =>
    next(withToken(value)).pipe(
      catchError((error: unknown) => {
        // Business errors (403/409/422/500) are not session failures.
        if (
          error instanceof HttpErrorResponse &&
          error.status === 401 &&
          auth.getAccessToken() === value
        ) {
          auth.expireSession(revision);
        }
        return throwError(() => error);
      }),
    );

  return next(withToken(token)).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        revision !== auth.sessionRevision() ||
        !auth.isAuthenticated()
      ) {
        return throwError(() => error);
      }

      const currentToken = auth.getAccessToken();
      // Another request may already have refreshed before this old-token 401 arrived.
      if (currentToken && currentToken !== token) return retry(currentToken);

      // This catch handles the original request only. The retry cannot recurse into it.
      return auth.refreshAccessToken().pipe(switchMap((newToken) => retry(newToken)));
    }),
  );
};
