import type { ApplicationDetail, ApplicationSummary, MaskedValue, User } from '../shared/models';
import type { ApplicationRecord } from './models';

function mask(value: string): MaskedValue {
  return {
    present: value.length > 0,
    masked: value.length === 0 ? '' : value.length > 4 ? `•••• ${value.slice(-4)}` : '••••',
  };
}

/** Always construct an allowlisted response instead of serializing an internal record. */
export function applicationSummary(record: ApplicationRecord, users: User[]): ApplicationSummary {
  return {
    id: record.id,
    legalName: record.form.business.legalName,
    status: record.status,
    createdBy: record.createdBy,
    createdByName: users.find((user) => user.id === record.createdBy)?.name ?? 'Unknown user',
    assignedReviewerId: record.assignedReviewerId,
    assignedReviewerName: users.find((user) => user.id === record.assignedReviewerId)?.name ?? null,
    updatedAt: record.updatedAt,
    version: record.version,
  };
}

export function applicationDetail(record: ApplicationRecord, users: User[]): ApplicationDetail {
  return {
    ...applicationSummary(record, users),
    form: {
      business: { ...record.form.business },
      contact: { ...record.form.contact },
      banking: { bankName: record.form.banking.bankName },
      processing: { ...record.form.processing },
    },
    sensitive: {
      accountNumber: mask(record.form.banking.accountNumber),
      taxId: mask(record.form.banking.taxId),
    },
    riskHistory: record.riskHistory.map((entry) => ({ ...entry })),
  };
}
