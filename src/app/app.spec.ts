import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { App } from './app';
import { routes } from './app.routes';

async function renderWorkspace() {
  await TestBed.configureTestingModule({
    imports: [App],
    providers: [provideRouter(routes)],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  await TestBed.inject(Router).navigateByUrl('/');
  await fixture.whenStable();
  return fixture;
}

describe('Workspace shell', () => {
  it('redirects to and renders the lazy workspace page inside the application shell', async () => {
    const fixture = await renderWorkspace();
    const page = fixture.nativeElement as HTMLElement;

    expect(TestBed.inject(Router).url).toBe('/overview');
    expect(page.querySelector('main h1')?.textContent).toContain('Merchant applications');
    expect(page.querySelector('nav a[aria-current="page"]')?.textContent).toContain('Overview');
  });

  it('opens the preparation checklist and dismisses it without leaving the workspace', async () => {
    const fixture = await renderWorkspace();
    const page = fixture.nativeElement as HTMLElement;
    const button = page.querySelector<HTMLButtonElement>('.welcome-copy button');
    expect(button).not.toBeNull();
    button!.click();
    await fixture.whenStable();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('[role="dialog"]')).not.toBeNull();
    expect(overlay.querySelector('h2')?.textContent).toContain('Application checklist');
    const closed = firstValueFrom(TestBed.inject(MatDialog).openDialogs[0].afterClosed());
    overlay.querySelector<HTMLButtonElement>('[aria-label="Close application checklist"]')!.click();
    await closed;
    await fixture.whenStable();

    expect(overlay.querySelector('[role="dialog"]')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/overview');
  });
});
