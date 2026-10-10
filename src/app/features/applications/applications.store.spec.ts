import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationSummary, Page } from '../../../../shared/models';
import { ApplicationsStore } from './applications.store';

function result(page = 1, pageSize = 10, name = 'Fictional merchant'): Page<ApplicationSummary> {
  return {
    page,
    pageSize,
    total: 40,
    items: [
      {
        id: 'app-example',
        legalName: name,
        status: 'DRAFT',
        createdBy: 'sales-1',
        createdByName: 'Demo Sales',
        assignedReviewerId: null,
        assignedReviewerName: null,
        updatedAt: '2026-10-10T12:00:00.000Z',
        version: 1,
      },
    ],
  };
}

describe('applications server query store', () => {
  let store: ApplicationsStore;
  let controller: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApplicationsStore],
    });
    controller = TestBed.inject(HttpTestingController);
    store = TestBed.inject(ApplicationsStore);
  });

  afterEach(() => {
    controller.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  function pending() {
    const request = controller.expectOne((candidate) => candidate.url === '/api/applications');
    expect(request.request.method).toBe('GET');
    return request;
  }

  function expectQuery(page: number, pageSize: number, search = '', status = '') {
    const request = pending();
    expect(request.request.params.get('page')).toBe(String(page));
    expect(request.request.params.get('pageSize')).toBe(String(pageSize));
    expect(request.request.params.get('search')).toBe(search || null);
    expect(request.request.params.get('status')).toBe(status || null);
    return request;
  }

  it('loads the first server page and exposes the returned total without slicing it locally', () => {
    expect(store.state().kind).toBe('loading');
    expect(store.query()).toEqual({ page: 1, pageSize: 10, search: '', status: '' });
    const page = result();
    expectQuery(1, 10).flush(page);
    const state = store.state();
    expect(state.kind).toBe('success');
    if (state.kind !== 'success') throw new Error('Expected loaded applications.');
    expect(state.page).toEqual(page);
    expect(state.page.total).toBeGreaterThan(state.page.items.length);
  });

  it('converts paginator indexes to API pages and resets to page one when the page size changes', () => {
    pending().flush(result());
    store.setPage(2, 10);
    expect(store.state().kind).toBe('loading');
    expectQuery(3, 10).flush(result(3));
    expect(store.query().page).toBe(3);
    store.setPage(1, 25);
    expectQuery(1, 25).flush(result(1, 25));
    expect(store.query()).toMatchObject({ page: 1, pageSize: 25 });
  });

  it('resets pagination for status and normalized search filters', () => {
    pending().flush(result());
    store.setPage(3, 10);
    pending().flush(result(4));
    store.setStatus('APPROVED');
    expectQuery(1, 10, '', 'APPROVED').flush(result());
    store.setPage(2, 10);
    pending().flush(result(3));
    store.setSearch('  Fictional merchant  ');
    vi.advanceTimersByTime(300);
    expectQuery(1, 10, 'Fictional merchant', 'APPROVED').flush(result());
    expect(store.query()).toEqual({
      page: 1,
      pageSize: 10,
      search: 'Fictional merchant',
      status: 'APPROVED',
    });
  });

  it('cancels the previous request immediately and sends only the latest search after 300ms', () => {
    const initial = pending();
    store.setSearch('Fiction');
    expect(initial.cancelled).toBe(true);
    vi.advanceTimersByTime(250);
    controller.expectNone((request) => request.url === '/api/applications');
    store.setSearch('  Fictional merchant  ');
    vi.advanceTimersByTime(299);
    controller.expectNone((request) => request.url === '/api/applications');
    expect(store.state().kind).toBe('loading');
    vi.advanceTimersByTime(1);
    const latest = expectQuery(1, 10, 'Fictional merchant');
    latest.flush(result(1, 10, 'Latest response'));
    const state = store.state();
    if (state.kind !== 'success') throw new Error('Expected latest search results.');
    expect(state.page.items[0].legalName).toBe('Latest response');
  });

  it('cancels an in-flight search before waiting for the next debounce, preventing stale results', () => {
    pending().flush(result());
    store.setSearch('First');
    vi.advanceTimersByTime(300);
    const firstSearch = expectQuery(1, 10, 'First');
    store.setSearch('Second');
    expect(firstSearch.cancelled).toBe(true);
    expect(store.state().kind).toBe('loading');
    vi.advanceTimersByTime(300);
    expectQuery(1, 10, 'Second').flush(result(1, 10, 'Second merchant'));
    const state = store.state();
    if (state.kind !== 'success') throw new Error('Expected current results.');
    expect(state.page.items[0].legalName).toBe('Second merchant');
  });

  it('retries a failed query and continues responding to filters after recovery', () => {
    pending().flush(result());
    store.setSearch('Fictional');
    vi.advanceTimersByTime(300);
    expectQuery(1, 10, 'Fictional').flush(
      { code: 'TEMPORARILY_UNAVAILABLE', message: 'Could not load applications. Try again.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    const error = store.state();
    expect(error.kind).toBe('error');
    if (error.kind !== 'error') throw new Error('Expected an actionable error.');
    expect(error.message.length).toBeGreaterThan(0);
    store.reload();
    expect(store.state().kind).toBe('loading');
    expectQuery(1, 10, 'Fictional').flush(result());
    expect(store.state().kind).toBe('success');
    store.setStatus('SUBMITTED');
    expectQuery(1, 10, 'Fictional', 'SUBMITTED').flush(result());
    expect(store.state().kind).toBe('success');
  });

  it('clears filters and returns to the first page while retaining the selected page size', () => {
    pending().flush(result());
    store.setPage(0, 25);
    pending().flush(result(1, 25));
    store.setStatus('IN_REVIEW');
    pending().flush(result(1, 25));
    store.setSearch('Fictional');
    vi.advanceTimersByTime(300);
    pending().flush(result(1, 25));
    store.setPage(2, 25);
    pending().flush(result(3, 25));
    store.clearFilters();
    expectQuery(1, 25).flush(result(1, 25));
    expect(store.query()).toEqual({ page: 1, pageSize: 25, search: '', status: '' });
  });

  it('bounds search length at the API boundary and cancels work when its owner is destroyed', () => {
    pending().flush(result());
    store.setSearch(`  ${'x'.repeat(120)}  `);
    vi.advanceTimersByTime(300);
    const search = expectQuery(1, 10, 'x'.repeat(100));
    TestBed.resetTestingModule();
    expect(search.cancelled).toBe(true);
    vi.advanceTimersByTime(1_000);
    controller.expectNone((request) => request.url === '/api/applications');
  });
});
