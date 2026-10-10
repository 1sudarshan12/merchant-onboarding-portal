import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DEFAULT_OPTIONS, MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationDetail, User } from '../../../../shared/models';
import { AuthService } from '../../core/auth/auth.service';
import { PendingChanges } from '../../core/auth/pending-changes';
import { ApplicationWizard } from './application-wizard';
import { DraftAutosave } from './draft-autosave';

const path = '/api/applications/app-001';
const user: User = {
  id: 'sales-1',
  name: 'Demo Sales',
  email: 'sales1@example.test',
  role: 'SALES',
};

function savedDraft(version = 1, legalName = 'Fictional merchant'): ApplicationDetail {
  return {
    id: 'app-001',
    legalName,
    status: 'DRAFT',
    createdBy: user.id,
    createdByName: user.name,
    assignedReviewerId: null,
    assignedReviewerName: null,
    updatedAt: '2026-10-10T12:00:00.000Z',
    version,
    riskHistory: [],
    form: {
      business: {
        legalName,
        tradingName: '',
        registrationNumber: 'DEMO-12345',
        businessType: 'COMPANY',
        industry: 'Retail',
        website: 'https://merchant.example.test',
      },
      contact: {
        fullName: 'Demo Contact',
        email: 'contact@example.test',
        phone: '+9779812345678',
        addressLine: '123 Fictional Road',
        city: 'Kathmandu',
        postalCode: '44600',
      },
      banking: { bankName: 'Fictional bank' },
      processing: {
        monthlyVolume: 10_000,
        averageTicket: 100,
        maxTicket: 500,
        acceptsInternational: false,
      },
    },
    sensitive: {
      accountNumber: { present: true, masked: '•••• 1234' },
      taxId: { present: true, masked: '•••• 5678' },
    },
  };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

async function renderWizard(draft = savedDraft()) {
  const params = convertToParamMap({ id: 'app-001' });
  await TestBed.configureTestingModule({
    imports: [ApplicationWizard],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { user: signal<User | null>(user), isAuthenticated: signal(true) },
      },
      {
        provide: ActivatedRoute,
        useValue: { paramMap: of(params), snapshot: { paramMap: params } },
      },
      {
        provide: MAT_DIALOG_DEFAULT_OPTIONS,
        useValue: { enterAnimationDuration: 0, exitAnimationDuration: 0 },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ApplicationWizard);
  const controller = TestBed.inject(HttpTestingController);
  controller.expectOne({ method: 'GET', url: path }).flush(draft);
  fixture.detectChanges();
  const page = fixture.nativeElement as HTMLElement;
  const autosave = fixture.debugElement.injector.get(DraftAutosave);
  const input = (name: string): HTMLInputElement => {
    const field = page.querySelector<HTMLInputElement>(`input[formControlName="${name}"]`);
    if (!field) throw new Error(`Missing input: ${name}`);
    return field;
  };
  const fill = (name: string, value: string) => {
    const field = input(name);
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  };
  const button = (label: string): HTMLButtonElement => {
    const found = Array.from(page.querySelectorAll<HTMLButtonElement>('button')).find(
      (candidate) => candidate.textContent?.trim() === label,
    );
    if (!found) throw new Error(`Missing button: ${label}`);
    return found;
  };
  const step = (label: string) => {
    const found = Array.from(
      page.querySelectorAll<HTMLButtonElement>('.step-navigation button'),
    ).find((candidate) => candidate.textContent?.includes(label));
    if (!found) throw new Error(`Missing step: ${label}`);
    found.click();
    fixture.detectChanges();
  };
  const submitForm = () => {
    page
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  };
  return { fixture, controller, page, autosave, input, fill, button, step, submitForm };
}

async function chooseDialog(label: string): Promise<void> {
  TestBed.inject(ApplicationRef).tick();
  const overlay = TestBed.inject(OverlayContainer).getContainerElement();
  const choice = Array.from(overlay.querySelectorAll<HTMLButtonElement>('button')).find(
    (candidate) => candidate.textContent?.trim() === label,
  );
  if (!choice) throw new Error(`Missing dialog choice: ${label}`);
  choice.click();
  await settle();
}

describe('Application wizard integration', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('restores a pristine draft with blank secret inputs and saved masks without writing it back', async () => {
    const { page, controller, input, autosave, step } = await renderWizard();
    expect(input('legalName').value).toBe('Fictional merchant');
    expect(page.querySelector('form')?.classList.contains('ng-pristine')).toBe(true);
    expect(autosave.hasPending()).toBe(false);
    step('Banking');
    expect(input('accountNumber').value).toBe('');
    expect(input('taxId').value).toBe('');
    expect(page.textContent).toContain('Saved: •••• 1234');
    expect(page.textContent).toContain('Saved: •••• 5678');
    expect(input('accountNumber').type).toBe('password');
    await vi.advanceTimersByTimeAsync(1_000);
    controller.expectNone((request) => request.method === 'PATCH');
    expect(autosave.state()).toBe('saved');
    expect(page.querySelector('form')?.classList.contains('ng-pristine')).toBe(true);
  });

  it('autosaves an edited draft without including untouched secrets or resetting form dirtiness', async () => {
    const { fixture, page, controller, fill, input, autosave } = await renderWizard();
    fill('tradingName', 'A fictional trading name');
    expect(input('tradingName').classList.contains('ng-dirty')).toBe(true);
    expect(page.textContent).toContain('Unsaved changes');
    await vi.advanceTimersByTimeAsync(700);
    const save = controller.expectOne({ method: 'PATCH', url: path });
    expect(save.request.body.version).toBe(1);
    expect(save.request.body.form.business.tradingName).toBe('A fictional trading name');
    expect(save.request.body.form.banking).toEqual({ bankName: 'Fictional bank' });
    const acknowledged = savedDraft(2);
    acknowledged.form.business.tradingName = 'A fictional trading name';
    save.flush(acknowledged);
    await settle();
    fixture.detectChanges();
    expect(autosave.hasPending()).toBe(false);
    expect(page.textContent).toContain('All changes saved');
    expect(input('tradingName').value).toBe('A fictional trading name');
    expect(input('tradingName').classList.contains('ng-dirty')).toBe(true);
  });

  it('keeps newer text in the form when an older save is acknowledged and sends it after its debounce', async () => {
    const { fixture, controller, fill, input } = await renderWizard();
    fill('legalName', 'First local edit');
    await vi.advanceTimersByTimeAsync(700);
    const first = controller.expectOne({ method: 'PATCH', url: path });
    fill('legalName', 'Newer local edit');
    await vi.advanceTimersByTimeAsync(100);
    first.flush(savedDraft(2, 'First local edit'));
    await settle();
    fixture.detectChanges();
    expect(input('legalName').value).toBe('Newer local edit');
    controller.expectNone((request) => request.method === 'PATCH');
    await vi.advanceTimersByTimeAsync(600);
    const latest = controller.expectOne({ method: 'PATCH', url: path });
    expect(latest.request.body.version).toBe(2);
    expect(latest.request.body.form.business.legalName).toBe('Newer local edit');
    latest.flush(savedDraft(3, 'Newer local edit'));
    await settle();
    fixture.detectChanges();
    expect(input('legalName').value).toBe('Newer local edit');
  });

  it('blocks an invalid step and renders the actual field error after Continue is pressed', async () => {
    const incomplete = savedDraft();
    incomplete.form.business.legalName = '';
    incomplete.form.business.registrationNumber = '';
    incomplete.form.business.industry = '';
    incomplete.legalName = '';
    const { fixture, page, controller, input, submitForm } = await renderWizard(incomplete);
    expect(page.querySelector('mat-error')).toBeNull();
    input('legalName').dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(page.querySelectorAll('mat-error')).toHaveLength(1);
    submitForm();
    expect(page.querySelector('.section-heading h2')?.textContent).toContain('Business details');
    expect(page.querySelector('.validation-notice')?.textContent).toContain(
      'Check the highlighted fields',
    );
    expect(page.querySelector('mat-error')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(page.querySelectorAll('mat-error')).toHaveLength(3);
    expect(page.querySelector('.step-navigation [aria-current="step"]')?.textContent).toContain(
      'Business',
    );
    controller.expectNone(`${path}/submit`);
    controller.expectNone((request) => request.method === 'PATCH');
  });

  it('maps a submission field error to the Banking step and re-enables the form for correction', async () => {
    const { fixture, page, controller, step, submitForm, input, fill } = await renderWizard();
    step('Review');
    expect(page.querySelector('.section-heading h2')?.textContent).toContain(
      'Review your application',
    );
    submitForm();
    await settle();
    const submit = controller.expectOne({ method: 'POST', url: `${path}/submit` });
    expect(submit.request.body).toEqual({ version: 1 });
    submit.flush(
      {
        code: 'VALIDATION_ERROR',
        message: 'Correct the banking detail.',
        fields: { 'banking.accountNumber': 'Enter the updated fictional account number.' },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await settle();
    fixture.detectChanges();
    expect(page.querySelector('.section-heading h2')?.textContent).toContain('Banking details');
    expect(page.querySelector('.step-navigation [aria-current="step"]')?.textContent).toContain(
      'Banking',
    );
    expect(input('accountNumber').disabled).toBe(false);
    expect(
      Array.from(page.querySelectorAll('mat-error'), (error) => error.textContent).join(' '),
    ).toContain('Enter the updated fictional account number.');

    step('Business');
    fill('tradingName', 'An unrelated business edit');
    step('Banking');
    expect(
      Array.from(page.querySelectorAll('mat-error'), (error) => error.textContent).join(' '),
    ).toContain('Enter the updated fictional account number.');
    step('Review');
    expect(page.querySelector('.section-heading h2')?.textContent).toContain('Banking details');

    fill('accountNumber', '123456789012');
    expect(
      Array.from(page.querySelectorAll('mat-error'), (error) => error.textContent).join(' '),
    ).not.toContain('Enter the updated fictional account number.');
    step('Review');
    expect(page.querySelector('.section-heading h2')?.textContent).toContain(
      'Review your application',
    );
    controller.expectNone((request) => request.method === 'PATCH');
  });

  it('keeps local input after a conflict and fetches the server copy only after explicit discard confirmation', async () => {
    const { fixture, page, controller, fill, input, button, autosave } = await renderWizard();
    fill('legalName', 'Local edits to keep');
    await vi.advanceTimersByTimeAsync(700);
    controller
      .expectOne({ method: 'PATCH', url: path })
      .flush(
        { code: 'VERSION_CONFLICT', message: 'This application changed.' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();
    fixture.detectChanges();
    expect(input('legalName').value).toBe('Local edits to keep');
    expect(page.textContent).toContain('Saving paused: conflict');
    button('Load server copy').click();
    expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
    controller.expectNone({ method: 'GET', url: path });
    await chooseDialog('Stay here');
    controller.expectNone({ method: 'GET', url: path });
    expect(input('legalName').value).toBe('Local edits to keep');
    button('Load server copy').click();
    await chooseDialog('Discard edits and reload');
    controller.expectOne({ method: 'GET', url: path }).flush(savedDraft(5, 'Server copy'));
    await settle();
    fixture.detectChanges();
    expect(input('legalName').value).toBe('Server copy');
    expect(page.querySelector('form')?.classList.contains('ng-pristine')).toBe(true);
    expect(autosave.state()).toBe('saved');
    expect(autosave.detail()?.version).toBe(5);
  });

  it.each([
    ['Stay here', false],
    ['Leave without saving', true],
    ['Save and leave', true],
  ] as const)(
    'honors "%s" through the shared navigation and sign-out safeguard',
    async (choice, canLeave) => {
      const { fixture, controller, fill } = await renderWizard();
      fill('legalName', 'Pending local edit');
      const pendingChanges = TestBed.inject(PendingChanges);
      const leaving = pendingChanges.confirmLeaving();
      const duplicate = fixture.componentInstance.canLeave();
      expect(TestBed.inject(MatDialog).openDialogs).toHaveLength(1);
      await chooseDialog(choice);
      if (choice === 'Save and leave') {
        const save = controller.expectOne({ method: 'PATCH', url: path });
        expect(save.request.body.form.business.legalName).toBe('Pending local edit');
        save.flush(savedDraft(2, 'Pending local edit'));
      } else {
        controller.expectNone((request) => request.method === 'PATCH');
      }
      expect(await leaving).toBe(canLeave);
      expect(await duplicate).toBe(canLeave);
      fixture.destroy();
      expect(await pendingChanges.confirmLeaving()).toBe(true);
    },
  );
});
