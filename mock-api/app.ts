import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import express, { type ErrorRequestHandler, type RequestHandler, type Response } from 'express';
import type { ApplicationStatus, Decision, Page, RiskLevel, Role, User } from '../shared/models';
import { canRevealSensitive, canViewApplication } from '../shared/permissions';
import { Sessions } from './auth';
import type { ApplicationRecord, MockApiOptions } from './models';
import { applicationDetail, applicationSummary } from './responses';
import { createEmptyForm, createSeedData, DEMO_PASSWORD } from './seed';
import {
  mergeForm,
  objectBody,
  parseFormPatch,
  requireVersion,
  validateForSubmission,
  ValidationError,
} from './validation';

const STATUSES: readonly ApplicationStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
];

function requestString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number,
  allowEmpty = false,
  trim = true,
): string {
  const value = body[key];
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new ValidationError(400, 'INVALID_FIELD', `Provide a valid ${key}.`);
  }
  const result = trim ? value.trim() : value;
  if (!allowEmpty && result.length === 0) {
    throw new ValidationError(400, 'INVALID_FIELD', `Provide a valid ${key}.`);
  }
  return result;
}

function pageNumber(value: unknown, fallback: number, maximum = Number.MAX_SAFE_INTEGER): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new ValidationError(400, 'INVALID_QUERY', 'Pagination requires positive whole numbers.');
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new ValidationError(400, 'INVALID_QUERY', 'Pagination is outside the supported range.');
  }
  return parsed;
}

function listQuery(query: Record<string, unknown>): {
  page: number;
  pageSize: number;
  search: string;
  status: ApplicationStatus | undefined;
} {
  if (Object.keys(query).some((key) => !['page', 'pageSize', 'search', 'status'].includes(key))) {
    throw new ValidationError(400, 'INVALID_QUERY', 'Unsupported application filter.');
  }
  const search = query['search'] ?? '';
  const status = query['status'];
  if (typeof search !== 'string' || search.trim().length > 100) {
    throw new ValidationError(400, 'INVALID_QUERY', 'Search must contain at most 100 characters.');
  }
  if (
    status !== undefined &&
    (typeof status !== 'string' || !STATUSES.includes(status as ApplicationStatus))
  ) {
    throw new ValidationError(400, 'INVALID_QUERY', 'Select a supported application status.');
  }
  return {
    page: pageNumber(query['page'], 1),
    pageSize: pageNumber(query['pageSize'], 10, 50),
    search: search.trim().toLowerCase(),
    status: status as ApplicationStatus | undefined,
  };
}

function currentUser(response: Response): User {
  // Every protected handler runs after requireAuth, which owns this local value.
  return response.locals['user'] as User;
}

function requireRole(user: User, role: Role): void {
  if (user.role !== role) {
    throw new ValidationError(403, 'FORBIDDEN', 'Your role cannot perform this action.');
  }
}

function requireState(record: ApplicationRecord, states: readonly ApplicationStatus[]): void {
  if (!states.includes(record.status)) {
    throw new ValidationError(
      409,
      'INVALID_STATE',
      'This action is unavailable in the current status.',
    );
  }
}

function checkVersion(record: ApplicationRecord, body: Record<string, unknown>): void {
  if (requireVersion(body) !== record.version) {
    throw new ValidationError(
      409,
      'VERSION_CONFLICT',
      'This application changed. Reload it before saving.',
    );
  }
}

/** A fresh store per instance keeps demonstrations and API tests independent. */
export function createMockApi(options: MockApiOptions = {}): express.Express {
  const app = express();
  const { users, applications } = createSeedData();
  const now = options.now ?? Date.now;
  const sessions = new Sessions(
    now,
    options.accessTtlMs ?? 30_000,
    options.refreshTtlMs ?? 3_600_000,
  );
  let failListOnce = options.failListOnce ?? false;
  let failSaveOnce = options.failSaveOnce ?? false;

  app.disable('x-powered-by');
  app.use((_request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.use(async (_request, _response, next) => {
    if ((options.latencyMs ?? 0) > 0) await setTimeout(options.latencyMs);
    next();
  });

  const requireAuth: RequestHandler = (request, response, next) => {
    const userId = sessions.authenticate(request.get('authorization'));
    const user = users.find((candidate) => candidate.id === userId);
    if (!user) throw new ValidationError(401, 'UNAUTHENTICATED', 'Sign in again.');
    response.locals['user'] = user;
    next();
  };

  function visibleRecord(id: string | string[] | undefined, user: User): ApplicationRecord {
    const record = applications.find((candidate) => candidate.id === id);
    if (!record) throw new ValidationError(404, 'NOT_FOUND', 'Application not found.');
    if (!canViewApplication(user, record)) {
      throw new ValidationError(403, 'FORBIDDEN', 'You cannot access this application.');
    }
    return record;
  }

  function touch(record: ApplicationRecord): void {
    record.version += 1;
    record.updatedAt = new Date(now()).toISOString();
  }

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.post('/api/auth/login', (request, response) => {
    const body = objectBody(request.body, ['email', 'password']);
    const email = requestString(body, 'email', 254).toLowerCase();
    const password = requestString(body, 'password', 128, false, false);
    const user = users.find((candidate) => candidate.email.toLowerCase() === email);
    if (!user || password !== DEMO_PASSWORD) {
      throw new ValidationError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
    }
    response.json({ ...sessions.create(user.id), user });
  });

  app.post('/api/auth/refresh', (request, response) => {
    const body = objectBody(request.body, ['refreshToken']);
    response.json(sessions.refresh(requestString(body, 'refreshToken', 200)));
  });

  app.post('/api/auth/logout', (request, response) => {
    const body = objectBody(request.body, ['refreshToken']);
    sessions.logout(requestString(body, 'refreshToken', 200));
    response.status(204).end();
  });

  app.get('/api/me', requireAuth, (_request, response) => {
    response.json(currentUser(response));
  });

  app.get('/api/reviewers', requireAuth, (_request, response) => {
    requireRole(currentUser(response), 'ADMIN');
    response.json(users.filter((user) => user.role === 'REVIEWER'));
  });

  app.get('/api/applications', requireAuth, (request, response) => {
    const user = currentUser(response);
    const query = listQuery(request.query);
    if (failListOnce) {
      failListOnce = false;
      throw new ValidationError(
        503,
        'TEMPORARILY_UNAVAILABLE',
        'Could not load applications. Try again.',
      );
    }
    const records = applications
      .filter((record) => canViewApplication(user, record))
      .filter((record) => !query.status || record.status === query.status)
      .filter((record) => record.form.business.legalName.toLowerCase().includes(query.search))
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
      );
    const start = (query.page - 1) * query.pageSize;
    const page: Page<ReturnType<typeof applicationSummary>> = {
      items: records
        .slice(start, start + query.pageSize)
        .map((record) => applicationSummary(record, users)),
      total: records.length,
      page: query.page,
      pageSize: query.pageSize,
    };
    response.json(page);
  });

  app.post('/api/applications', requireAuth, (request, response) => {
    const user = currentUser(response);
    requireRole(user, 'SALES');
    objectBody(request.body ?? {}, []);
    const record: ApplicationRecord = {
      id: `app-${randomUUID()}`,
      status: 'DRAFT',
      createdBy: user.id,
      assignedReviewerId: null,
      form: createEmptyForm(),
      riskHistory: [],
      updatedAt: new Date(now()).toISOString(),
      version: 1,
    };
    applications.push(record);
    response.status(201).json(applicationDetail(record, users));
  });

  app.get('/api/applications/:id', requireAuth, (request, response) => {
    response.json(
      applicationDetail(visibleRecord(request.params['id'], currentUser(response)), users),
    );
  });

  app.patch('/api/applications/:id', requireAuth, (request, response) => {
    const user = currentUser(response);
    requireRole(user, 'SALES');
    const record = visibleRecord(request.params['id'], user);
    requireState(record, ['DRAFT']);
    const body = objectBody(request.body, ['version', 'form']);
    const patch = parseFormPatch(body['form']);
    checkVersion(record, body);
    if (failSaveOnce) {
      failSaveOnce = false;
      throw new ValidationError(503, 'TEMPORARILY_UNAVAILABLE', 'Draft was not saved. Try again.');
    }
    // Keep version checking and mutation synchronous: a stale autosave cannot win.
    record.form = mergeForm(record.form, patch);
    touch(record);
    response.json(applicationDetail(record, users));
  });

  app.post('/api/applications/:id/submit', requireAuth, (request, response) => {
    const user = currentUser(response);
    requireRole(user, 'SALES');
    const record = visibleRecord(request.params['id'], user);
    requireState(record, ['DRAFT']);
    const body = objectBody(request.body, ['version']);
    checkVersion(record, body);
    validateForSubmission(record.form);
    record.status = 'SUBMITTED';
    touch(record);
    response.json(applicationDetail(record, users));
  });

  app.put('/api/applications/:id/assignment', requireAuth, (request, response) => {
    const user = currentUser(response);
    requireRole(user, 'ADMIN');
    const record = visibleRecord(request.params['id'], user);
    requireState(record, ['SUBMITTED', 'IN_REVIEW']);
    const body = objectBody(request.body, ['version', 'reviewerId']);
    const reviewerId = requestString(body, 'reviewerId', 100);
    if (!users.some((reviewer) => reviewer.id === reviewerId && reviewer.role === 'REVIEWER')) {
      throw new ValidationError(400, 'INVALID_REVIEWER', 'Choose an existing reviewer.');
    }
    checkVersion(record, body);
    record.assignedReviewerId = reviewerId;
    record.status = 'IN_REVIEW';
    touch(record);
    response.json(applicationDetail(record, users));
  });

  app.post('/api/applications/:id/decision', requireAuth, (request, response) => {
    const user = currentUser(response);
    requireRole(user, 'REVIEWER');
    const record = visibleRecord(request.params['id'], user);
    requireState(record, ['IN_REVIEW']);
    const body = objectBody(request.body, ['version', 'decision', 'riskLevel', 'note']);
    const decision = requestString(body, 'decision', 10);
    const riskLevel = requestString(body, 'riskLevel', 10);
    const note = requestString(body, 'note', 2000, true);
    if (
      !['APPROVE', 'REJECT'].includes(decision) ||
      !['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel)
    ) {
      throw new ValidationError(
        400,
        'INVALID_FIELD',
        'Choose a supported decision and risk level.',
      );
    }
    if (decision === 'REJECT' && note.length === 0) {
      throw new ValidationError(
        422,
        'VALIDATION_ERROR',
        'Explain why the application was rejected.',
        {
          note: 'A rejection reason is required.',
        },
      );
    }
    checkVersion(record, body);
    record.status = decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    record.riskHistory.push({
      id: randomUUID(),
      decision: decision as Decision,
      riskLevel: riskLevel as RiskLevel,
      note,
      reviewerId: user.id,
      reviewerName: user.name,
      at: new Date(now()).toISOString(),
    });
    touch(record);
    response.json(applicationDetail(record, users));
  });

  app.get('/api/applications/:id/sensitive', requireAuth, (request, response) => {
    const user = currentUser(response);
    const record = visibleRecord(request.params['id'], user);
    if (!canRevealSensitive(user, record)) {
      throw new ValidationError(
        403,
        'FORBIDDEN',
        'Your role cannot reveal sensitive banking details.',
      );
    }
    response.json({
      accountNumber: record.form.banking.accountNumber,
      taxId: record.form.banking.taxId,
    });
  });

  app.use((_request, _response, next) => {
    next(new ValidationError(404, 'NOT_FOUND', 'API route not found.'));
  });

  const handleError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    if (error instanceof ValidationError) {
      response.status(error.status).json({
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {}),
      });
    } else if (error instanceof Error && 'type' in error && error.type === 'entity.parse.failed') {
      response
        .status(400)
        .json({ code: 'INVALID_JSON', message: 'Request body must be valid JSON.' });
    } else if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') {
      response
        .status(413)
        .json({ code: 'PAYLOAD_TOO_LARGE', message: 'Request body is too large.' });
    } else {
      response
        .status(500)
        .json({ code: 'INTERNAL_ERROR', message: 'The request could not be completed.' });
    }
  };
  app.use(handleError);
  return app;
}
