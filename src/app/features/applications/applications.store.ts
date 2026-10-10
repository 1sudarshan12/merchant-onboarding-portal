import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, Subject, switchMap, timeout, timer } from 'rxjs';
import type { ApplicationStatus } from '../../../../shared/models';
import type { ApplicationsQuery, ApplicationsState } from './application-list';
import { ApplicationsApi } from './applications.api';

interface LoadRequest {
  query: ApplicationsQuery;
  debounce: boolean;
}

/** One instance per dashboard visit. Signals expose state; RxJS coordinates cancellable reads. */
@Injectable()
export class ApplicationsStore {
  private readonly api = inject(ApplicationsApi);
  private readonly currentQuery = signal<ApplicationsQuery>({
    page: 1,
    pageSize: 10,
    search: '',
    status: '',
  });
  private readonly loadState = signal<ApplicationsState>({ kind: 'loading' });
  private readonly requests = new Subject<LoadRequest>();

  readonly query = this.currentQuery.asReadonly();
  readonly state = this.loadState.asReadonly();

  constructor() {
    this.requests
      .pipe(
        startWith({ query: this.currentQuery(), debounce: false }),
        switchMap(({ query, debounce }) => {
          this.loadState.set({ kind: 'loading' });
          // Cancel the previous read immediately, including while the next search is debouncing.
          return (debounce ? timer(300) : of(0)).pipe(
            switchMap(() =>
              this.api.list({
                page: query.page,
                pageSize: query.pageSize,
                ...(query.search ? { search: query.search } : {}),
                ...(query.status ? { status: query.status } : {}),
              }),
            ),
            timeout(15_000),
            map((page): ApplicationsState => ({ kind: 'success', page })),
            // Recover inside this request, so an error does not stop future filters or retries.
            catchError((error: unknown) =>
              of<ApplicationsState>({ kind: 'error', message: this.errorMessage(error) }),
            ),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.loadState.set(state));
  }

  setSearch(value: string): void {
    this.update({ ...this.query(), search: value.trim().slice(0, 100), page: 1 }, true);
  }

  setStatus(status: ApplicationStatus | ''): void {
    this.update({ ...this.query(), status, page: 1 });
  }

  setPage(pageIndex: number, pageSize: number): void {
    if (!Number.isSafeInteger(pageIndex) || pageIndex < 0 || ![10, 25, 50].includes(pageSize)) {
      return;
    }
    this.update({
      ...this.query(),
      page: pageSize === this.query().pageSize ? pageIndex + 1 : 1,
      pageSize,
    });
  }

  reload(): void {
    this.requests.next({ query: this.query(), debounce: false });
  }

  clearFilters(): void {
    this.update({ ...this.query(), search: '', status: '', page: 1 });
  }

  private update(query: ApplicationsQuery, debounce = false): void {
    const current = this.query();
    if (
      query.page === current.page &&
      query.pageSize === current.pageSize &&
      query.search === current.search &&
      query.status === current.status
    ) {
      return;
    }
    this.currentQuery.set(query);
    this.requests.next({ query, debounce });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) return 'You do not have permission to load these applications.';
      if (error.status === 0) return 'Unable to reach the server. Check your connection and retry.';
    }
    return 'We could not load your applications. Please try again.';
  }
}
