import type { ApplicationStatus, ApplicationSummary, Page } from '../../../../shared/models';

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  IN_REVIEW: 'In review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

export const STATUS_OPTIONS: readonly { value: ApplicationStatus; label: string }[] = [
  { value: 'DRAFT', label: STATUS_LABELS.DRAFT },
  { value: 'SUBMITTED', label: STATUS_LABELS.SUBMITTED },
  { value: 'IN_REVIEW', label: STATUS_LABELS.IN_REVIEW },
  { value: 'APPROVED', label: STATUS_LABELS.APPROVED },
  { value: 'REJECTED', label: STATUS_LABELS.REJECTED },
];

export interface ApplicationsQuery {
  page: number;
  pageSize: number;
  search: string;
  status: ApplicationStatus | '';
}

export type ApplicationsState =
  | { kind: 'loading' }
  | { kind: 'success'; page: Page<ApplicationSummary> }
  | { kind: 'error'; message: string };
