import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, describe, expect, it } from 'vitest';
import type { ApplicationDetail, User } from '../../../../shared/models';
import { AuthService } from '../../core/auth/auth.service';
import { ApplicationDetailPage } from './application-detail';

const detail: ApplicationDetail = {
  id: 'app-003',
  legalName: 'Demo Merchant 03',
  status: 'IN_REVIEW',
  createdBy: 'sales-1',
  createdByName: 'Demo Sales 01',
  assignedReviewerId: 'reviewer-1',
  assignedReviewerName: 'Demo Reviewer 01',
  updatedAt: '2026-10-10T12:00:00.000Z',
  version: 3,
  form: {
    business: {
      legalName: 'Demo Merchant 03',
      tradingName: '',
      registrationNumber: 'DEMO-00003',
      businessType: 'COMPANY',
      industry: 'Retail',
      website: '',
    },
    contact: {
      fullName: 'Demo Contact',
      email: 'contact@example.test',
      phone: '+12025550123',
      addressLine: '1 Example Way',
      city: 'Demo City',
      postalCode: '00000',
    },
    banking: { bankName: 'Demo Bank' },
    processing: {
      monthlyVolume: 10000,
      averageTicket: 100,
      maxTicket: 500,
      acceptsInternational: false,
    },
  },
  sensitive: {
    accountNumber: { present: true, masked: '•••• 1003' },
    taxId: { present: true, masked: '•••• 0103' },
  },
  riskHistory: [],
};

async function render(role: User['role']) {
  const user: User = {
    id: role === 'REVIEWER' ? 'reviewer-1' : 'admin-1',
    name: 'Demo User',
    email: 'demo@example.test',
    role,
  };
  await TestBed.configureTestingModule({
    imports: [ApplicationDetailPage],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      { provide: AuthService, useValue: { user: signal<User | null>(user) } },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: detail.id })) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ApplicationDetailPage);
  const controller = TestBed.inject(HttpTestingController);
  controller.expectOne('/api/applications/app-003').flush(detail);
  fixture.detectChanges();
  return { fixture, page: fixture.nativeElement as HTMLElement, controller };
}

describe('Application detail', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
  });

  it('renders reviewer actions, keeps banking values masked, and reveals only after an explicit request', async () => {
    const { fixture, page, controller } = await render('REVIEWER');
    expect(page.textContent).toContain('Record a decision');
    expect(page.textContent).toContain('•••• 1003');
    expect(page.textContent).not.toContain('0000000000001003');
    page.querySelector<HTMLButtonElement>('button')!;
    const reveal = Array.from(page.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Reveal'),
    )!;
    reveal.click();
    controller
      .expectOne('/api/applications/app-003/sensitive')
      .flush({ accountNumber: '0000000000001003', taxId: '000000103' });
    fixture.detectChanges();
    expect(page.textContent).toContain('0000000000001003');
  });

  it('requires a rejection note before making a decision request', async () => {
    const { fixture, page, controller } = await render('REVIEWER');
    const decision = page.querySelector<HTMLElement>('[formcontrolname="decision"]');
    decision?.click();
    const reject = Array.from(document.querySelectorAll<HTMLElement>('mat-option')).find(
      (option) => option.textContent?.trim() === 'Reject',
    );
    reject?.click();
    fixture.detectChanges();
    page.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    fixture.detectChanges();
    expect(page.textContent).toContain('Explain why the application was rejected.');
    controller.expectNone('/api/applications/app-003/decision');
  });
});
