import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationDetail, MerchantFormPatch } from '../../../../shared/models';
import { DraftAutosave } from './draft-autosave';

const path = '/api/applications/app-draft';

function detail(version = 1, legalName = 'Fictional merchant'): ApplicationDetail {
  return {
    id: 'app-draft',
    legalName,
    status: 'DRAFT',
    createdBy: 'sales-1',
    createdByName: 'Demo Sales',
    assignedReviewerId: null,
    assignedReviewerName: null,
    updatedAt: '2026-10-10T12:00:00.000Z',
    version,
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
    riskHistory: [],
  };
}

function snapshot(legalName = 'Fictional merchant'): MerchantFormPatch {
  // Unchanged secrets are absent. Masked metadata must never become a write value.
  return { ...detail(1, legalName).form };
}

describe('draft autosave coordination', () => {
  let autosave: DraftAutosave;
  let controller: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), DraftAutosave],
    });
    controller = TestBed.inject(HttpTestingController);
    autosave = TestBed.inject(DraftAutosave);
    autosave.initialize(detail(), snapshot());
  });

  afterEach(() => {
    controller.verify();
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  const settle = () => vi.advanceTimersByTimeAsync(0);
  const noWrite = () => controller.expectNone((request) => request.method === 'PATCH');
  const write = () => controller.expectOne({ method: 'PATCH', url: path });

  it('debounces the latest snapshot for 700ms and omits unchanged banking secrets from writes', async () => {
    expect(autosave.state()).toBe('saved');
    expect(autosave.hasPending()).toBe(false);
    controller.expectNone(path);
    autosave.queue(snapshot('First edit'));
    expect(autosave.state()).toBe('unsaved');
    expect(autosave.hasPending()).toBe(true);
    await vi.advanceTimersByTimeAsync(600);
    noWrite();
    autosave.queue(snapshot('Latest edit'));
    await vi.advanceTimersByTimeAsync(699);
    noWrite();
    await vi.advanceTimersByTimeAsync(1);
    const saved = write();
    expect(saved.request.body).toEqual({ version: 1, form: snapshot('Latest edit') });
    expect(saved.request.body.form.banking).toEqual({ bankName: 'Fictional bank' });
    expect(JSON.stringify(saved.request.body)).not.toContain('••••');
    expect(autosave.state()).toBe('saving');
    saved.flush(detail(2, 'Latest edit'));
    await settle();
    expect(autosave.state()).toBe('saved');
    expect(autosave.hasPending()).toBe(false);
    expect(autosave.detail()?.version).toBe(2);
  });

  it('keeps one write in flight and coalesces newer edits using the acknowledged version', async () => {
    autosave.queue(snapshot('First edit'));
    await vi.advanceTimersByTimeAsync(700);
    const first = write();
    autosave.queue(snapshot('Intermediate edit'));
    autosave.queue(snapshot('Newest edit'));
    await vi.advanceTimersByTimeAsync(700);
    noWrite();
    expect(first.cancelled).toBe(false);
    first.flush(detail(2, 'First edit'));
    await settle();
    const second = write();
    expect(second.request.body).toEqual({ version: 2, form: snapshot('Newest edit') });
    expect(autosave.hasPending()).toBe(true);
    second.flush(detail(3, 'Newest edit'));
    await settle();
    noWrite();
    expect(autosave.state()).toBe('saved');
    expect(autosave.detail()?.legalName).toBe('Newest edit');
    expect(autosave.detail()?.version).toBe(3);
  });

  it('waits for the remaining debounce when a newer edit arrives shortly before acknowledgement', async () => {
    autosave.queue(snapshot('First edit'));
    await vi.advanceTimersByTimeAsync(700);
    const first = write();
    autosave.queue(snapshot('Newer edit'));
    await vi.advanceTimersByTimeAsync(100);
    first.flush(detail(2, 'First edit'));
    await settle();
    expect(autosave.state()).toBe('unsaved');
    noWrite();
    await vi.advanceTimersByTimeAsync(599);
    noWrite();
    await vi.advanceTimersByTimeAsync(1);
    const next = write();
    expect(next.request.body).toEqual({ version: 2, form: snapshot('Newer edit') });
    next.flush(detail(3, 'Newer edit'));
    await settle();
    expect(autosave.state()).toBe('saved');
  });

  it('settles an active explicit save as unsuccessful when its owner is destroyed and sends no queued write', async () => {
    autosave.queue(snapshot('First edit'));
    const saved = autosave.saveNow();
    const active = write();
    autosave.queue(snapshot('Queued after first edit'));
    TestBed.resetTestingModule();
    expect(await saved).toBe(false);
    expect(active.cancelled).toBe(true);
    await vi.advanceTimersByTimeAsync(1_000);
    noWrite();
  });

  it('retains the latest edit after a failed write and retries without advancing the server version', async () => {
    autosave.queue(snapshot('First edit'));
    await vi.advanceTimersByTimeAsync(700);
    const failed = write();
    autosave.queue(snapshot('Newest edit'));
    await vi.advanceTimersByTimeAsync(700);
    failed.flush(
      { code: 'TEMPORARILY_UNAVAILABLE', message: 'Could not save this draft.' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    await settle();
    expect(autosave.state()).toBe('error');
    expect(autosave.hasPending()).toBe(true);
    expect(autosave.detail()?.version).toBe(1);
    const retried = autosave.saveNow();
    await settle();
    const retry = write();
    expect(retry.request.body).toEqual({ version: 1, form: snapshot('Newest edit') });
    retry.flush(detail(2, 'Newest edit'));
    expect(await retried).toBe(true);
    expect(autosave.state()).toBe('saved');
    expect(autosave.hasPending()).toBe(false);
  });

  it('pauses after a version conflict and prevents edits or submission from overwriting the remote draft', async () => {
    autosave.queue(snapshot('Local edit'));
    await vi.advanceTimersByTimeAsync(700);
    write().flush(
      { code: 'VERSION_CONFLICT', message: 'Reload the application before saving.' },
      { status: 409, statusText: 'Conflict' },
    );
    await settle();
    expect(autosave.state()).toBe('conflict');
    expect(autosave.hasPending()).toBe(true);
    autosave.queue(snapshot('Newest local edit'));
    await vi.advanceTimersByTimeAsync(700);
    expect(await autosave.saveNow()).toBe(false);
    expect(await autosave.submit()).toBe(false);
    noWrite();
    controller.expectNone(`${path}/submit`);
    expect(autosave.detail()?.version).toBe(1);
    expect(autosave.state()).toBe('conflict');

    // The parent obtains confirmation and fetches this copy before reinitializing.
    autosave.initialize(detail(5, 'Remote edit'), snapshot('Remote edit'));
    expect(autosave.state()).toBe('saved');
    expect(autosave.hasPending()).toBe(false);
    controller.expectNone(path);
    autosave.queue(snapshot('Edit after explicit reload'));
    await vi.advanceTimersByTimeAsync(700);
    const resumed = write();
    expect(resumed.request.body).toEqual({
      version: 5,
      form: snapshot('Edit after explicit reload'),
    });
    resumed.flush(detail(6, 'Edit after explicit reload'));
    await settle();
    expect(autosave.state()).toBe('saved');
  });

  it('reconciles an undo after a lost response instead of falsely declaring the old baseline saved', async () => {
    autosave.queue(snapshot('A write whose response is lost'));
    await vi.advanceTimersByTimeAsync(700);
    write().error(new ProgressEvent('error'));
    await settle();
    expect(autosave.state()).toBe('error');
    autosave.queue(snapshot());
    expect(autosave.state()).toBe('unsaved');
    expect(autosave.hasPending()).toBe(true);
    const reconciled = autosave.saveNow();
    const retry = write();
    expect(retry.request.body).toEqual({ version: 1, form: snapshot() });
    // If the first write committed, the API detects that our acknowledged version is stale.
    retry.flush(
      { code: 'VERSION_CONFLICT', message: 'This application changed.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(await reconciled).toBe(false);
    expect(autosave.state()).toBe('conflict');
    expect(autosave.hasPending()).toBe(true);
  });

  it('saves before submitting, maps server field errors, and submits the corrected acknowledged version', async () => {
    autosave.queue(snapshot('Ready to submit'));
    const submitted = autosave.submit();
    await settle();
    expect(autosave.isSubmitting()).toBe(true);
    controller.expectNone(`${path}/submit`);
    const lastSave = write();
    expect(lastSave.request.body).toEqual({ version: 1, form: snapshot('Ready to submit') });
    lastSave.flush(detail(2, 'Ready to submit'));
    await settle();
    const rejected = controller.expectOne({ method: 'POST', url: `${path}/submit` });
    expect(rejected.request.body).toEqual({ version: 2 });
    rejected.flush(
      {
        code: 'VALIDATION_ERROR',
        message: 'Correct the highlighted fields.',
        fields: { 'contact.email': 'Use a valid contact email.' },
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(await submitted).toBe(false);
    expect(autosave.isSubmitting()).toBe(false);
    expect(autosave.submitted()).toBe(false);
    expect(autosave.fieldErrors()).toEqual({ 'contact.email': 'Use a valid contact email.' });

    const corrected = snapshot('Ready to submit');
    corrected.contact = { ...corrected.contact, email: 'corrected@example.test' };
    autosave.queue(corrected);
    const retry = autosave.submit();
    await settle();
    const savedCorrection = write();
    expect(savedCorrection.request.body).toEqual({ version: 2, form: corrected });
    const updated = detail(3, 'Ready to submit');
    updated.form.contact.email = 'corrected@example.test';
    savedCorrection.flush(updated);
    await settle();
    const accepted = controller.expectOne({ method: 'POST', url: `${path}/submit` });
    expect(accepted.request.body).toEqual({ version: 3 });
    accepted.flush({ ...updated, status: 'SUBMITTED', version: 4 });
    expect(await retry).toBe(true);
    expect(autosave.submitted()).toBe(true);
    expect(autosave.detail()?.status).toBe('SUBMITTED');
    expect(autosave.hasPending()).toBe(false);
    expect(autosave.fieldErrors()).toEqual({});
  });

  it('sends only one submission and ignores edits while submission is in progress', async () => {
    const first = autosave.submit();
    await settle();
    const request = controller.expectOne({ method: 'POST', url: `${path}/submit` });
    const duplicate = autosave.submit();
    autosave.queue(snapshot('Edit attempted during submission'));
    await vi.advanceTimersByTimeAsync(700);
    noWrite();
    controller.expectNone(`${path}/submit`);
    request.flush({ ...detail(2), status: 'SUBMITTED' });
    expect(await first).toBe(true);
    await duplicate;
    expect(autosave.submitted()).toBe(true);
    expect(autosave.detail()?.legalName).toBe('Fictional merchant');
    expect(autosave.hasPending()).toBe(false);
  });

  it('waits for a saveable snapshot and cancels queued work when its component is destroyed', async () => {
    autosave.queue(snapshot('Temporarily invalid edit'), false);
    await vi.advanceTimersByTimeAsync(700);
    noWrite();
    expect(autosave.hasPending()).toBe(true);
    expect(await autosave.saveNow()).toBe(false);
    autosave.queue(snapshot('Temporarily invalid edit'), true);
    await vi.advanceTimersByTimeAsync(699);
    noWrite();
    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(1_000);
    noWrite();
  });

  it('keeps unsaveable edits pending even when their serialized snapshot matches an acknowledged value', async () => {
    autosave.queue(snapshot(), false);
    expect(autosave.state()).toBe('unsaved');
    expect(autosave.hasPending()).toBe(true);
    expect(await autosave.saveNow()).toBe(false);
    await vi.advanceTimersByTimeAsync(700);
    noWrite();
    expect(autosave.state()).toBe('unsaved');

    autosave.queue(snapshot('An accepted value'));
    await vi.advanceTimersByTimeAsync(700);
    const active = write();
    autosave.queue(snapshot('An accepted value'), false);
    active.flush(detail(2, 'An accepted value'));
    await settle();
    expect(autosave.state()).toBe('unsaved');
    expect(autosave.hasPending()).toBe(true);
    expect(await autosave.saveNow()).toBe(false);
    noWrite();
  });
});
