import { describe, expect, it, vi } from 'vitest';
import type { ApplicationDetail } from '../../../../shared/models';
import {
  createMerchantForm,
  draftCanSave,
  draftSnapshot,
  restoreMerchantForm,
  type SensitivePresence,
} from './merchant-form';

function savedDraft(): ApplicationDetail {
  return {
    id: 'app-form-test',
    legalName: 'Example Merchant',
    status: 'DRAFT',
    createdBy: 'sales-1',
    createdByName: 'Demo Sales',
    assignedReviewerId: null,
    assignedReviewerName: null,
    updatedAt: '2026-10-10T09:00:00.000Z',
    version: 3,
    form: {
      business: {
        legalName: 'Example Merchant',
        tradingName: '',
        registrationNumber: 'DEMO-123',
        businessType: 'COMPANY',
        industry: 'Retail',
        website: 'https://merchant.example.test',
      },
      contact: {
        fullName: 'Demo Contact',
        email: 'demo@example.test',
        phone: '+1 202 555 0101',
        addressLine: '1 Example Street',
        city: 'Demo City',
        postalCode: '00000',
      },
      banking: { bankName: 'Demo Bank' },
      processing: {
        monthlyVolume: 10000,
        averageTicket: 50,
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

describe('merchant form and draft payloads', () => {
  it('restores public values and a pristine baseline without placing masks in editable controls', () => {
    const form = createMerchantForm(() => ({ accountNumber: true, taxId: true }));
    const account = form.controls.banking.controls.accountNumber;
    account.markAsDirty();
    account.setValue('00001234');
    form.controls.contact.controls.fullName.markAsTouched();
    const changed = vi.fn();
    form.valueChanges.subscribe(changed);
    const detail = savedDraft();

    restoreMerchantForm(form, detail);

    expect(form.getRawValue().business).toEqual(detail.form.business);
    expect(form.getRawValue().contact).toEqual(detail.form.contact);
    expect(form.getRawValue().processing).toEqual(detail.form.processing);
    expect(form.getRawValue().banking).toEqual({
      bankName: 'Demo Bank',
      accountNumber: '',
      taxId: '',
    });
    expect(form.pristine).toBe(true);
    expect(form.untouched).toBe(true);
    expect(form.valid).toBe(true);
    expect(changed).not.toHaveBeenCalled();
    expect(JSON.stringify(form.getRawValue())).not.toContain('••••');
    expect(draftSnapshot(form).banking).toEqual({ bankName: 'Demo Bank' });
  });

  it('accepts a blank stored secret only while pristine and preserves explicit clear intent', () => {
    const form = createMerchantForm(() => ({ accountNumber: true, taxId: true }));
    restoreMerchantForm(form, savedDraft());
    const account = form.controls.banking.controls.accountNumber;
    expect(account.valid).toBe(true);

    account.markAsDirty();
    account.setValue('   ');

    expect(account.hasError('required')).toBe(true);
    expect(form.valid).toBe(false);
    expect(draftCanSave(form)).toBe(true);
    expect(draftSnapshot(form).banking).toEqual({ bankName: 'Demo Bank', accountNumber: '' });
    expect(form.controls.banking.controls.taxId.valid).toBe(true);
  });

  it('rechecks stored-value presence and permits valid replacement values with leading zeros', () => {
    let presence: SensitivePresence = { accountNumber: false, taxId: false };
    const form = createMerchantForm(() => presence);
    const banking = form.controls.banking.controls;
    expect(banking.accountNumber.hasError('required')).toBe(true);
    expect(banking.taxId.hasError('required')).toBe(true);

    presence = { accountNumber: true, taxId: true };
    banking.accountNumber.updateValueAndValidity();
    banking.taxId.updateValueAndValidity();
    expect(banking.accountNumber.valid).toBe(true);
    expect(banking.taxId.valid).toBe(true);

    banking.accountNumber.markAsDirty();
    banking.accountNumber.setValue(' 00001234 ');
    banking.taxId.markAsDirty();
    banking.taxId.setValue(' 000005678 ');
    expect(banking.accountNumber.valid).toBe(true);
    expect(banking.taxId.valid).toBe(true);
    expect(draftSnapshot(form).banking).toMatchObject({
      accountNumber: '00001234',
      taxId: '000005678',
    });
    banking.taxId.setValue('123');
    expect(banking.taxId.hasError('pattern')).toBe(true);
    expect(draftCanSave(form)).toBe(true);
  });

  it('stores incomplete drafts with null amounts as zero without calling them submission-ready', () => {
    const form = createMerchantForm(() => ({ accountNumber: false, taxId: false }));
    form.controls.contact.controls.email.setValue('email-in-progress');
    form.controls.business.controls.registrationNumber.setValue('short');

    expect(form.invalid).toBe(true);
    expect(draftCanSave(form)).toBe(true);
    expect(draftSnapshot(form).processing).toEqual({
      monthlyVolume: 0,
      averageTicket: 0,
      maxTicket: 0,
      acceptsInternational: false,
    });
    expect(draftSnapshot(form).contact?.email).toBe('email-in-progress');
  });

  it('validates trimmed input and produces trimmed public payload values', () => {
    const form = createMerchantForm(() => ({ accountNumber: true, taxId: true }));
    restoreMerchantForm(form, savedDraft());
    const business = form.controls.business.controls;
    const contact = form.controls.contact.controls;
    business.legalName.setValue(' a ');
    contact.fullName.setValue(' \t ');
    expect(business.legalName.getError('minlength')).toEqual({
      requiredLength: 2,
      actualLength: 1,
    });
    expect(contact.fullName.hasError('required')).toBe(true);

    business.legalName.setValue(' AB ');
    business.registrationNumber.setValue(' DEMO-123 ');
    business.website.setValue(' https://merchant.example.test ');
    contact.fullName.setValue(' Demo Contact ');
    contact.email.setValue(' demo@example.test ');
    contact.phone.setValue(' +1 202 555 0101 ');
    expect(form.valid).toBe(true);
    expect(draftSnapshot(form).business?.legalName).toBe('AB');
    expect(draftSnapshot(form).business?.registrationNumber).toBe('DEMO-123');
    expect(draftSnapshot(form).contact?.email).toBe('demo@example.test');

    business.website.setValue('javascript:alert(1)');
    contact.email.setValue('invalid@example');
    contact.phone.setValue('+1 (202) 555 0101');
    expect(business.website.hasError('website')).toBe(true);
    expect(contact.email.hasError('email')).toBe(true);
    expect(contact.phone.hasError('phone')).toBe(true);
    expect(draftCanSave(form)).toBe(true);
    business.website.setValue('   ');
    expect(business.website.valid).toBe(true);
  });

  it('enforces average, maximum, and monthly relationships only for submission', () => {
    const form = createMerchantForm(() => ({ accountNumber: true, taxId: true }));
    restoreMerchantForm(form, savedDraft());
    const processing = form.controls.processing;
    processing.patchValue({ averageTicket: 100, maxTicket: 50, monthlyVolume: 10 });

    expect(processing.errors).toEqual({ averageExceedsMax: true, maxExceedsMonthly: true });
    expect(draftCanSave(form)).toBe(true);
    processing.patchValue({ averageTicket: 100, maxTicket: 100, monthlyVolume: 100 });
    expect(form.valid).toBe(true);
    expect(processing.errors).toBeNull();
  });

  it('rejects invalid numeric wire values while allowing null and zero to save as incomplete drafts', () => {
    const form = createMerchantForm(() => ({ accountNumber: false, taxId: false }));
    const amount = form.controls.processing.controls.monthlyVolume;
    for (const [value, error, canSave] of [
      [null, 'required', true],
      [0, 'positive', true],
      [-1, 'positive', false],
      [Number.NaN, 'finite', false],
      [Number.POSITIVE_INFINITY, 'finite', false],
      [1e12 + 1, 'max', false],
    ] as const) {
      amount.setValue(value);
      expect(amount.hasError(error)).toBe(true);
      expect(draftCanSave(form)).toBe(canSave);
    }
    amount.setValue(1e12);
    expect(amount.valid).toBe(true);
    expect(draftCanSave(form)).toBe(true);
  });

  it('blocks oversized text and sensitive mask markers from draft requests', () => {
    const form = createMerchantForm(() => ({ accountNumber: false, taxId: false }));
    const name = form.controls.business.controls.legalName;
    name.setValue('a'.repeat(501));
    expect(name.hasError('maxlength')).toBe(true);
    expect(draftCanSave(form)).toBe(false);
    name.setValue('a'.repeat(500));
    expect(draftCanSave(form)).toBe(true);

    const account = form.controls.banking.controls.accountNumber;
    account.markAsDirty();
    for (const mask of ['•••• 1234', '****1234', 'XXXX1234', '…1234']) {
      account.setValue(mask);
      expect(account.hasError('pattern')).toBe(true);
      expect(draftCanSave(form)).toBe(false);
    }
    account.setValue('');
    expect(draftCanSave(form)).toBe(true);
    expect(draftSnapshot(form).banking?.accountNumber).toBe('');
  });
});
