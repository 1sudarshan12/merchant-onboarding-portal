import type { ApplicationStatus, MerchantForm, RiskEntry } from '../shared/models';

/** Internal records never leave the API directly; response mappers remove raw banking fields. */
export interface ApplicationRecord {
  id: string;
  status: ApplicationStatus;
  createdBy: string;
  assignedReviewerId: string | null;
  form: MerchantForm;
  riskHistory: RiskEntry[];
  updatedAt: string;
  version: number;
}
export interface MockApiOptions {
  now?: () => number;
  accessTtlMs?: number;
  refreshTtlMs?: number;
  latencyMs?: number;
  failListOnce?: boolean;
  failSaveOnce?: boolean;
}
