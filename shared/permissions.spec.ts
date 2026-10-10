import { describe, expect, it } from 'vitest';
import type { ApplicationSummary, ApplicationStatus, User } from './models';
import {
  canAssignApplication,
  canEditApplication,
  canRevealSensitive,
  canReviewApplication,
  canViewApplication,
} from './permissions';

const sales: User = { id: 'sales-1', name: 'Sales', email: 'sales@example.test', role: 'SALES' };
const reviewer: User = {
  id: 'reviewer-1',
  name: 'Reviewer',
  email: 'reviewer@example.test',
  role: 'REVIEWER',
};
const admin: User = { id: 'admin-1', name: 'Admin', email: 'admin@example.test', role: 'ADMIN' };
type Scope = Pick<ApplicationSummary, 'createdBy' | 'assignedReviewerId' | 'status'>;
const application = (status: ApplicationStatus = 'DRAFT'): Scope => ({
  createdBy: sales.id,
  assignedReviewerId: reviewer.id,
  status,
});

describe('application permissions', () => {
  it('limits visibility by ownership or reviewer assignment, while admin can view all', () => {
    const cases: [User, Scope, boolean][] = [
      [sales, application(), true],
      [sales, { ...application(), createdBy: 'sales-2' }, false],
      [reviewer, application('IN_REVIEW'), true],
      [reviewer, { ...application('IN_REVIEW'), assignedReviewerId: 'reviewer-2' }, false],
      [reviewer, { ...application('SUBMITTED'), assignedReviewerId: null }, false],
      [admin, { ...application(), createdBy: 'sales-2', assignedReviewerId: null }, true],
    ];
    for (const [user, record, expected] of cases) {
      expect(canViewApplication(user, record)).toBe(expected);
    }
  });

  it('allows only the sales owner to edit a draft, including when admin owns a record', () => {
    expect(canEditApplication(sales, application())).toBe(true);
    const denied: [User, Scope][] = [
      [sales, { ...application(), createdBy: 'sales-2' }],
      [reviewer, { ...application(), createdBy: reviewer.id }],
      [admin, { ...application(), createdBy: admin.id }],
      ...(['SUBMITTED', 'IN_REVIEW', 'APPROVED', 'REJECTED'] as const).map(
        (status): [User, Scope] => [sales, application(status)],
      ),
    ];
    for (const [user, record] of denied) expect(canEditApplication(user, record)).toBe(false);
  });

  it('restricts assignment and reassignment to admin while review is still pending', () => {
    for (const status of ['SUBMITTED', 'IN_REVIEW'] as const) {
      expect(canAssignApplication(admin, application(status))).toBe(true);
      expect(canAssignApplication(sales, application(status))).toBe(false);
      expect(canAssignApplication(reviewer, application(status))).toBe(false);
    }
    for (const status of ['DRAFT', 'APPROVED', 'REJECTED'] as const) {
      expect(canAssignApplication(admin, application(status))).toBe(false);
    }
  });

  it('requires both the assigned reviewer and the in-review state for a decision', () => {
    expect(canReviewApplication(reviewer, application('IN_REVIEW'))).toBe(true);
    expect(
      canReviewApplication(reviewer, {
        ...application('IN_REVIEW'),
        assignedReviewerId: 'reviewer-2',
      }),
    ).toBe(false);
    for (const user of [sales, admin]) {
      expect(
        canReviewApplication(user, { ...application('IN_REVIEW'), assignedReviewerId: user.id }),
      ).toBe(false);
    }
    for (const status of ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const) {
      expect(canReviewApplication(reviewer, application(status))).toBe(false);
    }
  });

  it('never lets sales reveal banking details, even on their own application', () => {
    expect(canRevealSensitive(sales, application())).toBe(false);
    expect(canRevealSensitive(admin, application())).toBe(true);
    expect(canRevealSensitive(reviewer, application('IN_REVIEW'))).toBe(true);
    expect(canRevealSensitive(reviewer, application('APPROVED'))).toBe(true);
    expect(
      canRevealSensitive(reviewer, { ...application('IN_REVIEW'), assignedReviewerId: null }),
    ).toBe(false);
    expect(
      canRevealSensitive(reviewer, {
        ...application('IN_REVIEW'),
        assignedReviewerId: 'reviewer-2',
      }),
    ).toBe(false);
  });
});
