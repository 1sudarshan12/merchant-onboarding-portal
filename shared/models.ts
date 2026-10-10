/** Shared API contract. Runtime request validation still happens on the server. */
export type Role = 'SALES' | 'REVIEWER' | 'ADMIN';
export type ApplicationStatus = 'DRAFT' | 'SUBMITTED' | 'IN_REVIEW' | 'APPROVED' | 'REJECTED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH';
export type Decision = 'APPROVE' | 'REJECT';
export type BusinessType = '' | 'SOLE_TRADER' | 'PARTNERSHIP' | 'COMPANY';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
export interface LoginResponse extends TokenPair {
  user: User;
}

/** Raw banking values appear only in write payloads and authorized reveal responses. */
export interface MerchantForm {
  business: {
    legalName: string;
    tradingName: string;
    registrationNumber: string;
    businessType: BusinessType;
    industry: string;
    website: string;
  };
  contact: {
    fullName: string;
    email: string;
    phone: string;
    addressLine: string;
    city: string;
    postalCode: string;
  };
  banking: { bankName: string; accountNumber: string; taxId: string };
  processing: {
    monthlyVolume: number;
    averageTicket: number;
    maxTicket: number;
    acceptsInternational: boolean;
  };
}
export type MerchantFormPatch = { [K in keyof MerchantForm]?: Partial<MerchantForm[K]> };
export type PublicMerchantForm = Omit<MerchantForm, 'banking'> & {
  banking: Pick<MerchantForm['banking'], 'bankName'>;
};
export interface MaskedValue {
  present: boolean;
  masked: string;
}
export interface SensitiveBanking {
  accountNumber: string;
  taxId: string;
}
export interface RiskEntry {
  id: string;
  decision: Decision;
  riskLevel: RiskLevel;
  note: string;
  reviewerId: string;
  reviewerName: string;
  at: string;
}
export interface ApplicationSummary {
  id: string;
  legalName: string;
  status: ApplicationStatus;
  createdBy: string;
  createdByName: string;
  assignedReviewerId: string | null;
  assignedReviewerName: string | null;
  updatedAt: string;
  version: number;
}
export interface ApplicationDetail extends ApplicationSummary {
  form: PublicMerchantForm;
  sensitive: { accountNumber: MaskedValue; taxId: MaskedValue };
  riskHistory: RiskEntry[];
}
export interface Page<T> {
  items: T[];
  total: number;
  /** One-based API page; convert Material paginator's zero-based index at the API boundary. */
  page: number;
  pageSize: number;
}
export interface ListQuery {
  page: number;
  pageSize: number;
  status?: ApplicationStatus;
  search?: string;
}
export interface SaveDraftRequest {
  version: number;
  form: MerchantFormPatch;
}
export interface VersionRequest {
  version: number;
}
export interface AssignmentRequest extends VersionRequest {
  reviewerId: string;
}
export interface DecisionRequest extends VersionRequest {
  decision: Decision;
  riskLevel: RiskLevel;
  note: string;
}
export interface ApiError {
  code: string;
  message: string;
  fields?: Record<string, string>;
}
