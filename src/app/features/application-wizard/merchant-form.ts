import { FormControl, FormGroup, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import type {
  ApplicationDetail,
  BusinessType,
  MerchantForm,
  MerchantFormPatch,
} from '../../../../shared/models';

export interface SensitivePresence {
  accountNumber: boolean;
  taxId: boolean;
}

type SectionControls<T> = {
  [K in keyof T]: FormControl<T[K] extends number ? number | null : T[K]>;
};

export type MerchantFormGroup = FormGroup<{
  [K in keyof MerchantForm]: FormGroup<SectionControls<MerchantForm[K]>>;
}>;

const MAX_TEXT_LENGTH = 500;
const MAX_AMOUNT = 1e12;
const MASK_CHARACTERS = /[*•●∙·…xX█■＊]/u;
const BUSINESS_TYPES: readonly BusinessType[] = ['', 'SOLE_TRADER', 'PARTNERSHIP', 'COMPANY'];

function textRules(required = false, minimumLength = 0): ValidatorFn {
  return (control) => {
    const raw: unknown = control.value;
    if (typeof raw !== 'string') return { pattern: true };
    if (raw.length > MAX_TEXT_LENGTH) {
      return { maxlength: { requiredLength: MAX_TEXT_LENGTH, actualLength: raw.length } };
    }
    const value = raw.trim();
    if (required && !value) return { required: true };
    if (value && value.length < minimumLength) {
      return { minlength: { requiredLength: minimumLength, actualLength: value.length } };
    }
    return null;
  };
}

function patternRule(pattern: RegExp, error = 'pattern'): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (typeof value !== 'string' || !value.trim()) return null;
    return pattern.test(value.trim()) ? null : { [error]: true };
  };
}

const websiteRule: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (['http:', 'https:'].includes(url.protocol) && url.hostname) return null;
  } catch {
    // The error belongs to this field; no URL is requested by this validator.
  }
  return { website: true };
};

const phoneRule: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || !value.trim()) return null;
  const phone = value.trim();
  return /^\+?[\d ]+$/.test(phone) && /^\d{7,15}$/.test(phone.replace(/\D/g, ''))
    ? null
    : { phone: true };
};

const amountRule: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null) return { required: true };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { finite: true };
  if (value <= 0) return { positive: true };
  if (value > MAX_AMOUNT) return { max: { max: MAX_AMOUNT, actual: value } };
  return null;
};

const processingOrder: ValidatorFn = (control) => {
  const average: unknown = control.get('averageTicket')?.value;
  const maximum: unknown = control.get('maxTicket')?.value;
  const monthly: unknown = control.get('monthlyVolume')?.value;
  const errors: ValidationErrors = {};
  if (
    typeof average === 'number' &&
    Number.isFinite(average) &&
    typeof maximum === 'number' &&
    Number.isFinite(maximum) &&
    average > maximum
  ) {
    errors['averageExceedsMax'] = true;
  }
  if (
    typeof maximum === 'number' &&
    Number.isFinite(maximum) &&
    typeof monthly === 'number' &&
    Number.isFinite(monthly) &&
    maximum > monthly
  ) {
    errors['maxExceedsMonthly'] = true;
  }
  return Object.keys(errors).length ? errors : null;
};

function sensitiveRule(stored: () => boolean, pattern: RegExp): ValidatorFn {
  return (control) => {
    const raw: unknown = control.value;
    if (typeof raw !== 'string') return { pattern: true };
    if (raw.length > MAX_TEXT_LENGTH) {
      return { maxlength: { requiredLength: MAX_TEXT_LENGTH, actualLength: raw.length } };
    }
    const value = raw.trim();
    if (!value) return stored() && control.pristine ? null : { required: true };
    return pattern.test(value) ? null : { pattern: true };
  };
}

function textControl(...validators: ValidatorFn[]): FormControl<string> {
  return new FormControl('', { nonNullable: true, validators });
}

/** Submission validation is stricter than the draft wire format; incomplete work can still save. */
export function createMerchantForm(sensitivePresence: () => SensitivePresence): MerchantFormGroup {
  return new FormGroup({
    business: new FormGroup({
      legalName: textControl(textRules(true, 2)),
      tradingName: textControl(textRules()),
      registrationNumber: textControl(textRules(true), patternRule(/^[a-z\d-]{6,20}$/i)),
      businessType: new FormControl<BusinessType>('', {
        nonNullable: true,
        validators: [textRules(true), patternRule(/^(SOLE_TRADER|PARTNERSHIP|COMPANY)$/)],
      }),
      industry: textControl(textRules(true)),
      website: textControl(textRules(), websiteRule),
    }),
    contact: new FormGroup({
      fullName: textControl(textRules(true)),
      email: textControl(textRules(true), patternRule(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'email')),
      phone: textControl(textRules(true), phoneRule),
      addressLine: textControl(textRules(true)),
      city: textControl(textRules(true)),
      postalCode: textControl(textRules(true)),
    }),
    banking: new FormGroup({
      bankName: textControl(textRules(true)),
      accountNumber: textControl(
        sensitiveRule(() => sensitivePresence().accountNumber, /^\d{8,17}$/),
      ),
      taxId: textControl(sensitiveRule(() => sensitivePresence().taxId, /^\d{9}$/)),
    }),
    processing: new FormGroup(
      {
        monthlyVolume: new FormControl<number | null>(null, amountRule),
        averageTicket: new FormControl<number | null>(null, amountRule),
        maxTicket: new FormControl<number | null>(null, amountRule),
        acceptsInternational: new FormControl(false, { nonNullable: true }),
      },
      { validators: processingOrder },
    ),
  });
}

/** Restore a loaded record as a pristine baseline; masking metadata is never an editable value. */
export function restoreMerchantForm(form: MerchantFormGroup, detail: ApplicationDetail): void {
  form.reset(
    {
      business: { ...detail.form.business },
      contact: { ...detail.form.contact },
      banking: { bankName: detail.form.banking.bankName, accountNumber: '', taxId: '' },
      processing: { ...detail.form.processing },
    },
    { emitEvent: false },
  );
}

/** Include sensitive fields only when the user expressed replacement or explicit clearing intent. */
export function draftSnapshot(form: MerchantFormGroup): MerchantFormPatch {
  const value = form.getRawValue();
  const banking: MerchantFormPatch['banking'] = { bankName: value.banking.bankName.trim() };
  if (form.controls.banking.controls.accountNumber.dirty) {
    banking.accountNumber = value.banking.accountNumber.trim();
  }
  if (form.controls.banking.controls.taxId.dirty) {
    banking.taxId = value.banking.taxId.trim();
  }
  return {
    business: {
      legalName: value.business.legalName.trim(),
      tradingName: value.business.tradingName.trim(),
      registrationNumber: value.business.registrationNumber.trim(),
      businessType: value.business.businessType,
      industry: value.business.industry.trim(),
      website: value.business.website.trim(),
    },
    contact: {
      fullName: value.contact.fullName.trim(),
      email: value.contact.email.trim(),
      phone: value.contact.phone.trim(),
      addressLine: value.contact.addressLine.trim(),
      city: value.contact.city.trim(),
      postalCode: value.contact.postalCode.trim(),
    },
    banking,
    processing: {
      monthlyVolume: value.processing.monthlyVolume ?? 0,
      averageTicket: value.processing.averageTicket ?? 0,
      maxTicket: value.processing.maxTicket ?? 0,
      acceptsInternational: value.processing.acceptsInternational,
    },
  };
}

/** Only enforce the API's save bounds here, not required fields or submission relationships. */
export function draftCanSave(form: MerchantFormGroup): boolean {
  const value = form.getRawValue();
  const text = [
    ...Object.values(value.business),
    ...Object.values(value.contact),
    ...Object.values(value.banking),
  ];
  return (
    text.every((field) => typeof field === 'string' && field.length <= MAX_TEXT_LENGTH) &&
    BUSINESS_TYPES.includes(value.business.businessType) &&
    !MASK_CHARACTERS.test(value.banking.accountNumber) &&
    !MASK_CHARACTERS.test(value.banking.taxId) &&
    [
      value.processing.monthlyVolume,
      value.processing.averageTicket,
      value.processing.maxTicket,
    ].every(
      (amount) =>
        amount === null ||
        (typeof amount === 'number' &&
          Number.isFinite(amount) &&
          amount >= 0 &&
          amount <= MAX_AMOUNT),
    ) &&
    typeof value.processing.acceptsInternational === 'boolean'
  );
}
