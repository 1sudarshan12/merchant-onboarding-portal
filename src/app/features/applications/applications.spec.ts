import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationSummary, Page, Role, User } from '../../../../shared/models';
import { AuthService } from '../../core/auth/auth.service';
import { Applications } from './applications';

const merchants: ApplicationSummary[] = [
  {
    id: 'app-001',
    legalName: 'Fictional Alpine Goods',
    status: 'DRAFT',
    createdBy: 'sales-1',
    createdByName: 'Demo Sales',
    assignedReviewerId: null,
    assignedReviewerName: null,
    updatedAt: '2026-10-10T12:00:00.000Z',
    version: 1,
  },
  {
    id: 'app-003',
    legalName: 'Fictional Summit Store',
    status: 'IN_REVIEW',
    createdBy: 'sales-1',
    createdByName: 'Demo Sales',
    assignedReviewerId: 'reviewer-1',
    assignedReviewerName: 'Demo Reviewer',
    updatedAt: '2026-10-09T12:00:00.000Z',
    version: 3,
  },
];

function result(items = merchants, total = 23, page = 1): Page<ApplicationSummary> {
  return { items, total, page, pageSize: 10 };
}

async function renderApplications(role: Role = 'SALES') {
  const user: User = {
    id: `${role.toLowerCase()}-1`,
    name: 'Demo User',
    email: 'demo@example.test',
    role,
  };
  await TestBed.configureTestingModule({
    imports: [Applications],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { user: signal<User | null>(user) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(Applications);
  fixture.detectChanges();
  const page = fixture.nativeElement as HTMLElement;
  const controller = TestBed.inject(HttpTestingController);
  const pending = () => controller.expectOne((request) => request.url === '/api/applications');
  const button = (label: string): HTMLButtonElement => {
    const found = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  };
  return { fixture, page, controller, pending, button };
}

describe('Applications dashboard', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('announces loading, renders readable server results, and requests the next server page', async () => {
    const { fixture, page, pending } = await renderApplications();
    expect(
      page.querySelector('[aria-label="Application results"]')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(page.querySelector('[role="status"]')?.textContent).toContain('Loading applications');
    expect(page.querySelector('table')).toBeNull();
    pending().flush(result());
    fixture.detectChanges();
    expect(
      page.querySelector('[aria-label="Application results"]')?.getAttribute('aria-busy'),
    ).toBe('false');
    expect(page.querySelector('caption')?.textContent).toContain('Merchant applications');
    expect(
      Array.from(page.querySelectorAll('tbody .merchant-name'), (cell) => cell.textContent?.trim()),
    ).toEqual(merchants.map((merchant) => merchant.legalName));
    expect(page.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(page.querySelector('tbody')?.textContent).toContain('In review');
    expect(page.querySelector('tbody')?.textContent).toContain('Unassigned');
    expect(page.textContent).not.toContain('No applications on this page');
    expect(page.querySelector('mat-paginator')?.getAttribute('aria-label')).toBe(
      'Application pages',
    );
    expect(page.querySelector('.mat-mdc-paginator-range-label')?.textContent).toContain('of 23');
    const next = page.querySelector<HTMLButtonElement>('button[aria-label="Next page"]');
    expect(next).not.toBeNull();
    expect(next?.disabled).toBe(false);
    next!.focus();
    next!.click();
    fixture.detectChanges();
    expect(
      page.querySelector('[aria-label="Application results"]')?.getAttribute('aria-busy'),
    ).toBe('true');
    expect(page.querySelector('button[aria-label="Next page"]')).toBe(next);
    expect(document.activeElement).toBe(next);
    const secondPage = pending();
    expect(secondPage.request.params.get('page')).toBe('2');
    expect(secondPage.request.params.get('pageSize')).toBe('10');
    secondPage.flush(result([merchants[1]], 23, 2));
    fixture.detectChanges();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(page.querySelector('tbody .merchant-name')?.textContent).toContain(
      'Fictional Summit Store',
    );
    expect(page.querySelector('button[aria-label="Next page"]')).toBe(next);
    expect(document.activeElement).toBe(next);
  });

  it('keeps focus on the page-size selector while requesting a different server page size', async () => {
    const { fixture, page, pending } = await renderApplications();
    pending().flush(result());
    fixture.detectChanges();
    const select = page.querySelector<HTMLElement>('mat-paginator mat-select');
    expect(select).not.toBeNull();
    select!.focus();
    select!.click();
    fixture.detectChanges();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const option = Array.from(overlay.querySelectorAll<HTMLElement>('mat-option')).find(
      (candidate) => candidate.textContent?.trim() === '25',
    );
    expect(option).not.toBeUndefined();
    option!.click();
    fixture.detectChanges();
    expect(page.querySelector('mat-paginator mat-select')).toBe(select);
    expect(document.activeElement).toBe(select);
    const resized = pending();
    expect(resized.request.params.get('page')).toBe('1');
    expect(resized.request.params.get('pageSize')).toBe('25');
    resized.flush({ ...result(), pageSize: 25 });
    fixture.detectChanges();
    expect(page.querySelector('mat-paginator mat-select')).toBe(select);
    expect(document.activeElement).toBe(select);
  });

  it('shows an accessible error and retries the failed request from the visible action', async () => {
    const { fixture, page, pending, button } = await renderApplications();
    pending().flush(
      { code: 'TEMPORARILY_UNAVAILABLE', message: 'Try again.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')?.textContent).toContain(
      'Applications couldn’t load',
    );
    expect(page.querySelector('table')).toBeNull();
    const results = page.querySelector<HTMLElement>('[aria-label="Application results"]');
    const retryButton = button('Try again');
    retryButton.focus();
    retryButton.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(results);
    expect(
      page.querySelector('[aria-label="Application results"]')?.getAttribute('aria-busy'),
    ).toBe('true');
    const retry = pending();
    expect(retry.request.params.get('page')).toBe('1');
    retry.flush(result());
    fixture.detectChanges();
    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(document.activeElement).toBe(results);
  });

  it('shows a clear first-use empty state when the server returns no accessible applications', async () => {
    const { fixture, page, pending } = await renderApplications();
    pending().flush(result([], 0));
    fixture.detectChanges();
    expect(page.textContent).toContain('No applications yet');
    expect(page.textContent).not.toContain('No matching applications');
    expect(page.querySelector('table')).toBeNull();
    expect(page.querySelector('[role="alert"]')).toBeNull();
    expect(
      page.querySelector('[aria-label="Application results"]')?.getAttribute('aria-busy'),
    ).toBe('false');
  });

  it('connects search input to the server and clears both the input and filtered empty results', async () => {
    vi.useFakeTimers();
    const { fixture, page, pending, controller, button } = await renderApplications();
    pending().flush(result());
    fixture.detectChanges();
    const input = page.querySelector<HTMLInputElement>('input[type="search"]');
    expect(input).not.toBeNull();
    expect(input?.maxLength).toBe(100);
    input!.value = '  Missing merchant  ';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(299);
    controller.expectNone((request) => request.url === '/api/applications');
    vi.advanceTimersByTime(1);
    const search = pending();
    expect(search.request.params.get('search')).toBe('Missing merchant');
    search.flush(result([], 0));
    fixture.detectChanges();
    expect(page.textContent).toContain('No matching applications');
    const clearFilters = button('Clear filters');
    clearFilters.focus();
    clearFilters.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(input);
    const cleared = pending();
    expect(cleared.request.params.has('search')).toBe(false);
    expect(cleared.request.params.has('status')).toBe(false);
    cleared.flush(result());
    fixture.detectChanges();
    expect(input?.value).toBe('');
    expect(page.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(page.textContent).not.toContain('No matching applications');
    expect(document.activeElement).toBe(input);

    input!.value = 'Alpine';
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(300);
    pending().flush(result([merchants[0]], 1));
    fixture.detectChanges();
    const clearSearch = page.querySelector<HTMLButtonElement>('[aria-label="Clear search"]');
    expect(clearSearch).not.toBeNull();
    clearSearch!.focus();
    clearSearch!.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(input);
    expect(page.querySelector('[aria-label="Clear search"]')).toBeNull();
    vi.advanceTimersByTime(300);
    const clearedSearch = pending();
    expect(clearedSearch.request.params.has('search')).toBe(false);
    clearedSearch.flush(result());
    fixture.detectChanges();
    expect(document.activeElement).toBe(input);
  });

  it('offers a way back when the current server page becomes empty after the list changes', async () => {
    const { fixture, page, pending, button } = await renderApplications();
    pending().flush(result(merchants, 11));
    fixture.detectChanges();
    page.querySelector<HTMLButtonElement>('button[aria-label="Next page"]')!.click();
    pending().flush(result([], 1, 2));
    fixture.detectChanges();
    expect(page.textContent).toContain('No applications on this page');
    expect(page.textContent).not.toContain('No applications yet');
    const results = page.querySelector<HTMLElement>('[aria-label="Application results"]');
    const returnButton = button('Return to first page');
    returnButton.focus();
    returnButton.click();
    fixture.detectChanges();
    expect(document.activeElement).toBe(results);
    const firstPage = pending();
    expect(firstPage.request.params.get('page')).toBe('1');
    firstPage.flush(result([merchants[0]], 1));
    fixture.detectChanges();
    expect(page.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(document.activeElement).toBe(results);
  });

  it.each([
    ['SALES', 'Showing applications created by you.'],
    ['REVIEWER', 'Showing applications assigned to you.'],
    ['ADMIN', 'Showing applications across the team.'],
  ] as const)(
    'explains the %s view while leaving record scoping to the API',
    async (role, description) => {
      const { fixture, page, pending } = await renderApplications(role);
      const request = pending();
      expect(request.request.params.keys().sort()).toEqual(['page', 'pageSize']);
      request.flush(result([], 0));
      fixture.detectChanges();
      expect(page.querySelector('.scope-note')?.textContent).toContain(description);
      expect(page.querySelector('[aria-label="Filter applications by status"]')).not.toBeNull();
    },
  );
});
