import type { ApplicationStatus, MerchantForm, User } from '../shared/models';
import type { ApplicationRecord } from './models';

/** Shared, deliberately public credential for this local synthetic-data demo only. */
export const DEMO_PASSWORD = 'Demo#1234';

export function createEmptyForm(): MerchantForm {
  return {
    business: {
      legalName: '',
      tradingName: '',
      registrationNumber: '',
      businessType: '',
      industry: '',
      website: '',
    },
    contact: {
      fullName: '',
      email: '',
      phone: '',
      addressLine: '',
      city: '',
      postalCode: '',
    },
    banking: { bankName: '', accountNumber: '', taxId: '' },
    processing: {
      monthlyVolume: 0,
      averageTicket: 0,
      maxTicket: 0,
      acceptsInternational: false,
    },
  };
}

export function createSeedData(): { users: User[]; applications: ApplicationRecord[] } {
  const users: User[] = [
    { id: 'sales-1', name: 'Demo Sales 01', email: 'sales1@example.test', role: 'SALES' },
    { id: 'sales-2', name: 'Demo Sales 02', email: 'sales2@example.test', role: 'SALES' },
    {
      id: 'reviewer-1',
      name: 'Demo Reviewer 01',
      email: 'reviewer1@example.test',
      role: 'REVIEWER',
    },
    {
      id: 'reviewer-2',
      name: 'Demo Reviewer 02',
      email: 'reviewer2@example.test',
      role: 'REVIEWER',
    },
    { id: 'admin-1', name: 'Demo Administrator', email: 'admin@example.test', role: 'ADMIN' },
  ];
  const statuses: ApplicationStatus[] = ['DRAFT', 'SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'];

  const applications = Array.from({ length: 30 }, (_, index): ApplicationRecord => {
    const number = String(index + 1).padStart(2, '0');
    const suffix = String(index + 1).padStart(3, '0');
    const status = statuses[index % statuses.length];
    const assigned = status === 'IN_REVIEW' || status === 'APPROVED' || status === 'REJECTED';
    const reviewerNumber = index % 2 === 0 ? '1' : '2';
    const reviewerId = `reviewer-${reviewerNumber}`;
    const updatedAt = `2026-10-01T09:${String(index).padStart(2, '0')}:00.000Z`;

    return {
      id: `app-${suffix}`,
      status,
      createdBy: index % 2 === 0 ? 'sales-1' : 'sales-2',
      assignedReviewerId: assigned ? reviewerId : null,
      form: {
        business: {
          legalName: `Demo Merchant ${number}`,
          tradingName: `Demo Store ${number}`,
          registrationNumber: `DEMO-${suffix}`,
          businessType: 'COMPANY',
          industry: index % 2 === 0 ? 'Retail' : 'Professional services',
          website: `https://merchant${number}.example.test`,
        },
        contact: {
          fullName: `Demo Contact ${number}`,
          email: `contact${number}@example.test`,
          // The 555-0100 through 555-0199 range is reserved for fictional use.
          phone: `+1 202 555 ${String(101 + index).padStart(4, '0')}`,
          addressLine: `${index + 1} Example Street`,
          city: 'Demo City',
          postalCode: '00000',
        },
        banking: {
          bankName: 'Demo Bank',
          accountNumber: String(1001 + index).padStart(16, '0'),
          taxId: String(101 + index).padStart(9, '0'),
        },
        processing: {
          monthlyVolume: 10000 + index * 1000,
          averageTicket: 50 + index,
          maxTicket: 500 + index * 10,
          acceptsInternational: index % 3 === 0,
        },
      },
      riskHistory:
        status === 'APPROVED' || status === 'REJECTED'
          ? [
              {
                id: `risk-${suffix}`,
                decision: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
                riskLevel: status === 'APPROVED' ? 'LOW' : 'HIGH',
                note:
                  status === 'APPROVED'
                    ? 'Synthetic example: approved after review.'
                    : 'Synthetic example: rejected after review.',
                reviewerId,
                reviewerName: `Demo Reviewer 0${reviewerNumber}`,
                at: updatedAt,
              },
            ]
          : [],
      updatedAt,
      version: status === 'DRAFT' ? 1 : status === 'SUBMITTED' ? 2 : status === 'IN_REVIEW' ? 3 : 4,
    };
  });

  return { users, applications };
}
