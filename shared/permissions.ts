import type { ApplicationSummary, Role, User } from './models';

export type Permission =
  | 'application:create'
  | 'application:edit'
  | 'application:review'
  | 'application:assign'
  | 'sensitive:reveal';
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SALES: ['application:create', 'application:edit'],
  REVIEWER: ['application:review', 'sensitive:reveal'],
  ADMIN: ['application:assign', 'sensitive:reveal'],
};

type ApplicationScope = Pick<ApplicationSummary, 'createdBy' | 'assignedReviewerId' | 'status'>;

export function canViewApplication(user: User, application: ApplicationScope): boolean {
  switch (user.role) {
    case 'SALES':
      return application.createdBy === user.id;
    case 'REVIEWER':
      return application.assignedReviewerId === user.id;
    case 'ADMIN':
      return true;
  }
}

export function canEditApplication(user: User, application: ApplicationScope): boolean {
  return (
    user.role === 'SALES' && application.createdBy === user.id && application.status === 'DRAFT'
  );
}

export function canAssignApplication(user: User, application: ApplicationScope): boolean {
  return (
    user.role === 'ADMIN' &&
    (application.status === 'SUBMITTED' || application.status === 'IN_REVIEW')
  );
}

export function canReviewApplication(user: User, application: ApplicationScope): boolean {
  return (
    user.role === 'REVIEWER' &&
    application.assignedReviewerId === user.id &&
    application.status === 'IN_REVIEW'
  );
}

export function canRevealSensitive(user: User, application: ApplicationScope): boolean {
  return (
    user.role === 'ADMIN' ||
    (user.role === 'REVIEWER' && application.assignedReviewerId === user.id)
  );
}
