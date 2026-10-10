import type { BusinessType, MerchantForm, MerchantFormPatch } from '../shared/models';

export class ValidationError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function objectBody(value: unknown, allowed: string[]): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
  ) {
    throw new ValidationError(400, 'INVALID_BODY', 'Expected a plain JSON object.');
  }

  if (Reflect.ownKeys(value).some((key) => typeof key !== 'string' || !allowed.includes(key))) {
    throw new ValidationError(400, 'INVALID_BODY', 'The request contains unsupported fields.');
  }
  return value as Record<string, unknown>;
}

export function requireVersion(body: Record<string, unknown>): number {
  const version = body['version'];
  if (typeof version !== 'number' || !Number.isSafeInteger(version) || version < 1) {
    throw new ValidationError(400, 'INVALID_VERSION', 'Version must be a positive integer.');
  }
  return version;
}

function invalidField(path: string, message: string): never {
  throw new ValidationError(400, 'INVALID_FIELD', message, { [path]: message });
}

function readString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.length > 500) {
    return invalidField(path, 'Enter a string of at most 500 characters.');
  }
  return value.trim();
}

function stringFields<K extends string>(
  body: Record<string, unknown>,
  keys: readonly K[],
  section: string,
): Partial<Record<K, string>> {
  const result: Partial<Record<K, string>> = {};
  for (const key of keys) {
    if (Object.hasOwn(body, key)) {
      result[key] = readString(body[key], `${section}.${key}`);
    }
  }
  return result;
}

export function parseFormPatch(value: unknown): MerchantFormPatch {
  const body = objectBody(value, ['business', 'contact', 'banking', 'processing']);
  const patch: MerchantFormPatch = {};

  if (Object.hasOwn(body, 'business')) {
    const keys = ['legalName', 'tradingName', 'registrationNumber', 'industry', 'website'] as const;
    const section = objectBody(body['business'], [...keys, 'businessType']);
    patch.business = stringFields(section, keys, 'business');
    if (Object.hasOwn(section, 'businessType')) {
      const businessType = readString(section['businessType'], 'business.businessType');
      const allowed: readonly BusinessType[] = ['', 'SOLE_TRADER', 'PARTNERSHIP', 'COMPANY'];
      if (!allowed.some((type) => type === businessType)) {
        invalidField('business.businessType', 'Choose a supported business type.');
      }
      patch.business.businessType = businessType as BusinessType;
    }
  }

  if (Object.hasOwn(body, 'contact')) {
    const keys = ['fullName', 'email', 'phone', 'addressLine', 'city', 'postalCode'] as const;
    patch.contact = stringFields(objectBody(body['contact'], [...keys]), keys, 'contact');
  }

  if (Object.hasOwn(body, 'banking')) {
    const keys = ['bankName', 'accountNumber', 'taxId'] as const;
    patch.banking = stringFields(objectBody(body['banking'], [...keys]), keys, 'banking');
    for (const key of ['accountNumber', 'taxId'] as const) {
      const value = patch.banking[key];
      if (value !== undefined && /[*•●∙·…xX█■＊]/u.test(value)) {
        invalidField(
          `banking.${key}`,
          'Omit unchanged sensitive fields instead of sending a mask.',
        );
      }
    }
  }

  if (Object.hasOwn(body, 'processing')) {
    const numberKeys = ['monthlyVolume', 'averageTicket', 'maxTicket'] as const;
    const section = objectBody(body['processing'], [...numberKeys, 'acceptsInternational']);
    patch.processing = {};
    for (const key of numberKeys) {
      if (Object.hasOwn(section, key)) {
        const value = section[key];
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e12) {
          invalidField(`processing.${key}`, 'Enter a finite number between 0 and 1000000000000.');
        }
        patch.processing[key] = value;
      }
    }
    if (Object.hasOwn(section, 'acceptsInternational')) {
      const value = section['acceptsInternational'];
      if (typeof value !== 'boolean') {
        invalidField('processing.acceptsInternational', 'Enter a boolean value.');
      }
      patch.processing.acceptsInternational = value;
    }
  }

  return patch;
}

export function mergeForm(current: MerchantForm, patch: MerchantFormPatch): MerchantForm {
  return {
    business: { ...current.business, ...patch.business },
    contact: { ...current.contact, ...patch.contact },
    banking: { ...current.banking, ...patch.banking },
    processing: { ...current.processing, ...patch.processing },
  };
}

export function validateForSubmission(form: MerchantForm): void {
  const fields: Record<string, string> = {};
  const required = (path: string, value: string): void => {
    if (!value.trim()) fields[path] = 'This field is required.';
  };

  if (form.business.legalName.trim().length < 2) {
    fields['business.legalName'] = 'Enter a legal name of at least 2 characters.';
  }
  if (!/^[a-z\d-]{6,20}$/i.test(form.business.registrationNumber)) {
    fields['business.registrationNumber'] = 'Use 6–20 letters, digits, or hyphens.';
  }
  if (!['SOLE_TRADER', 'PARTNERSHIP', 'COMPANY'].includes(form.business.businessType)) {
    fields['business.businessType'] = 'Choose a business type.';
  }
  required('business.industry', form.business.industry);
  if (form.business.website) {
    let validWebsite = false;
    try {
      const url = new URL(form.business.website);
      validWebsite =
        (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
    } catch {
      // Invalid URLs become field errors alongside the rest of the form's validation errors.
    }
    if (!validWebsite) fields['business.website'] = 'Enter a valid HTTP or HTTPS website.';
  }

  required('contact.fullName', form.contact.fullName);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact.email)) {
    fields['contact.email'] = 'Enter a valid email address.';
  }
  const phoneDigits = form.contact.phone.replace(/\D/g, '');
  if (!/^\+?[\d ]+$/.test(form.contact.phone) || !/^\d{7,15}$/.test(phoneDigits)) {
    fields['contact.phone'] = 'Use 7–15 digits with optional spaces and a leading +.';
  }
  required('contact.addressLine', form.contact.addressLine);
  required('contact.city', form.contact.city);
  required('contact.postalCode', form.contact.postalCode);
  required('banking.bankName', form.banking.bankName);
  if (!/^\d{8,17}$/.test(form.banking.accountNumber)) {
    fields['banking.accountNumber'] = 'Use 8–17 digits for the account number.';
  }
  if (!/^\d{9}$/.test(form.banking.taxId)) {
    fields['banking.taxId'] = 'Use 9 digits for the tax ID.';
  }

  for (const key of ['monthlyVolume', 'averageTicket', 'maxTicket'] as const) {
    const value = form.processing[key];
    if (!Number.isFinite(value) || value <= 0 || value > 1e12) {
      fields[`processing.${key}`] = 'Enter an amount greater than 0 and at most 1000000000000.';
    }
  }
  if (form.processing.averageTicket > form.processing.maxTicket) {
    fields['processing.maxTicket'] = 'Maximum ticket must be at least the average ticket.';
  }
  if (form.processing.maxTicket > form.processing.monthlyVolume) {
    fields['processing.monthlyVolume'] = 'Monthly volume must be at least the maximum ticket.';
  }

  if (Object.keys(fields).length > 0) {
    throw new ValidationError(
      422,
      'VALIDATION_ERROR',
      'Complete the required application details.',
      fields,
    );
  }
}
