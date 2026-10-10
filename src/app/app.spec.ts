import { OverlayContainer } from '@angular/cdk/overlay';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { NavigationEnd, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApplicationSummary, LoginResponse, Page } from '../../shared/models';
import { App } from './app';
import { appConfig } from './app.config';
import { AuthService } from './core/auth/auth.service';

const SESSION: LoginResponse = {
  user: {
    id: 'sales-1',
    name: 'Demo Sales 01',
    email: 'sales1@example.test',
    role: 'SALES',
  },
  accessToken: 'integration-access-token',
  refreshToken: 'integration-refresh-token',
};
const APPLICATION_PAGE: Page<ApplicationSummary> = {
  items: [
    {
      id: 'app-test-001',
      legalName: 'Integration Merchant',
      status: 'DRAFT',
      createdBy: 'sales-1',
      createdByName: 'Demo Sales 01',
      assignedReviewerId: null,
      assignedReviewerName: null,
      updatedAt: '2026-10-10T09:00:00.000Z',
      version: 1,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 10,
};

async function createApplication() {
  await TestBed.configureTestingModule({
    imports: [App],
    // Use the production providers so a missing router, HttpClient, or interceptor fails here.
    providers: [...appConfig.providers, provideHttpClientTesting()],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  return {
    fixture,
    router: TestBed.inject(Router),
    controller: TestBed.inject(HttpTestingController),
    auth: TestBed.inject(AuthService),
  };
}

type ApplicationContext = Awaited<ReturnType<typeof createApplication>>;

async function signIn(context: ApplicationContext): Promise<void> {
  const signedIn = firstValueFrom(
    context.auth.login({ email: SESSION.user.email, password: 'Demo#1234' }),
  );
  const request = context.controller.expectOne('/api/auth/login');
  expect(request.request.headers.has('Authorization')).toBe(false);
  request.flush(SESSION);
  await signedIn;
}

function flushDashboard(context: ApplicationContext): void {
  context.fixture.detectChanges();
  TestBed.tick();
  const request = context.controller.expectOne(
    (candidate) => candidate.url === '/api/applications',
  );
  expect(request.request.method).toBe('GET');
  expect(request.request.headers.get('Authorization')).toBe(`Bearer ${SESSION.accessToken}`);
  request.flush(APPLICATION_PAGE);
}

describe('Application integration', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('renders the public login route using the real application providers', async () => {
    const { fixture, router, auth } = await createApplication();
    await router.navigateByUrl('/login');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    expect(router.url).toBe('/login');
    expect(auth.isAuthenticated()).toBe(false);
    expect(page.querySelector('h1')?.textContent).toBe('Sign in');
    expect(page.querySelector('input[type="password"]')).not.toBeNull();
    expect(page.querySelector('app-workspace-shell')).toBeNull();
    expect(page.querySelector('nav[aria-label="Main navigation"]')).toBeNull();
  });

  it('redirects an anonymous applications visit to login with its return destination', async () => {
    const { fixture, router, controller } = await createApplication();
    await router.navigateByUrl('/applications');
    await fixture.whenStable();
    const url = router.parseUrl(router.url);

    expect(router.url.split('?')[0]).toBe('/login');
    expect(url.queryParams['returnUrl']).toBe('/applications');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-workspace-shell')).toBeNull();
    controller.expectNone((request) => request.url === '/api/applications');
  });

  it('signs in through the form and loads the protected dashboard with the bearer interceptor', async () => {
    const context = await createApplication();
    const { fixture, router, controller, auth } = context;
    await router.navigateByUrl('/login?returnUrl=%2Fapplications');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    page.querySelector<HTMLButtonElement>('[aria-label="Use Sales demo account"]')!.click();
    fixture.detectChanges();
    const navigated = firstValueFrom(
      router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    );
    page
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    const login = controller.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({ email: SESSION.user.email, password: 'Demo#1234' });
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush(SESSION);
    await navigated;
    flushDashboard(context);
    await fixture.whenStable();

    expect(auth.user()).toEqual(SESSION.user);
    expect(router.url).toBe('/applications');
    expect(page.querySelector('main h1')?.textContent).toBe('Applications');
    expect(page.querySelector('.merchant-name')?.textContent).toContain('Integration Merchant');
    expect(page.querySelector('nav a[aria-current="page"]')?.textContent).toContain('Applications');
    expect(page.querySelector('.breadcrumb-current')?.textContent).toBe('Applications');
    expect(page.querySelector('.user-name')?.textContent).toContain(SESSION.user.name);
    expect(page.querySelector('.user-role')?.textContent).toContain(SESSION.user.role);

    await router.navigateByUrl('/overview');
    await fixture.whenStable();
    expect(page.querySelector('.breadcrumb-current')?.textContent).toBe('Overview');
    expect(page.querySelector('nav a[aria-current="page"]')?.textContent).toContain('Overview');
  });

  it('retains the default overview and opens and dismisses the preparation checklist', async () => {
    const context = await createApplication();
    const { fixture, router } = context;
    await signIn(context);
    await router.navigateByUrl('/');
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;

    expect(router.url).toBe('/overview');
    expect(page.querySelector('main h1')?.textContent).toContain('Merchant applications');
    page.querySelector<HTMLButtonElement>('.welcome-copy button')!.click();
    await fixture.whenStable();
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('[role="dialog"]')).not.toBeNull();
    expect(overlay.querySelector('h2')?.textContent).toContain('Application checklist');
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    overlay.querySelector<HTMLButtonElement>('[aria-label="Close application checklist"]')!.click();
    await closed;
    await fixture.whenStable();

    expect(overlay.querySelector('[role="dialog"]')).toBeNull();
    expect(router.url).toBe('/overview');
  });

  it('signs out, revokes the session, and removes private dashboard content', async () => {
    const context = await createApplication();
    const { fixture, router, controller, auth } = context;
    await signIn(context);
    await router.navigateByUrl('/applications');
    flushDashboard(context);
    await fixture.whenStable();
    const page = fixture.nativeElement as HTMLElement;
    expect(page.textContent).toContain('Integration Merchant');
    const signOut = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === 'Sign out',
    );
    expect(signOut?.type).toBe('button');
    signOut!.click();
    expect(auth.isAuthenticated()).toBe(false);
    const logout = controller.expectOne('/api/auth/logout');
    expect(logout.request.body).toEqual({ refreshToken: SESSION.refreshToken });
    expect(logout.request.headers.has('Authorization')).toBe(false);
    logout.flush(null, { status: 204, statusText: 'No Content' });
    await fixture.whenStable();

    expect(router.url).toBe('/login');
    expect(page.querySelector('app-workspace-shell')).toBeNull();
    expect(page.textContent).not.toContain('Integration Merchant');
    expect(page.querySelector('.session-identity')).toBeNull();
  });
});
