import request, { type Response } from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  ApiError,
  ApplicationDetail,
  ApplicationSummary,
  LoginResponse,
  Page,
  SensitiveBanking,
  TokenPair,
  User,
} from '../shared/models';
import { createMockApi } from './app';
import { createSeedData, DEMO_PASSWORD } from './seed';

function body<T>(response: Response): T {
  return response.body as T;
}

function expectApiError(response: Response, status: number): ApiError {
  expect(response.status).toBe(status);
  const error = body<ApiError>(response);
  expect(error.code).toEqual(expect.any(String));
  expect(error.message).toEqual(expect.any(String));
  expect(error.code.length).toBeGreaterThan(0);
  expect(error.message.length).toBeGreaterThan(0);
  expect(response.headers['content-type']).toContain('application/json');
  return error;
}

describe('mock API HTTP contract', () => {
  let app: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    app = createMockApi({ latencyMs: 0 });
  });

  async function login(email = 'sales1@example.test'): Promise<LoginResponse> {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password: DEMO_PASSWORD });
    expect(response.status).toBe(200);
    return body<LoginResponse>(response);
  }

  async function getApplication(token: string, id: string): Promise<ApplicationDetail> {
    const response = await request(app)
      .get(`/api/applications/${id}`)
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(200);
    return body<ApplicationDetail>(response);
  }

  it('authenticates a demo user and rejects missing or incorrect credentials', async () => {
    const session = await login();
    expect(session.user).toMatchObject({
      id: 'sales-1',
      role: 'SALES',
      email: 'sales1@example.test',
    });
    expect(session.accessToken).not.toBe(session.refreshToken);
    const me = await request(app).get('/api/me').auth(session.accessToken, { type: 'bearer' });
    expect(me.status).toBe(200);
    expect(body<User>(me)).toEqual(session.user);
    expectApiError(await request(app).get('/api/me'), 401);
    expectApiError(
      await request(app)
        .post('/api/auth/login')
        .send({ email: session.user.email, password: 'wrong' }),
      401,
    );
    expectApiError(
      await request(app).post('/api/auth/login').send({ email: session.user.email }),
      400,
    );
  });

  it('expires access, rotates both tokens, rejects replay, and revokes the session on logout', async () => {
    let now = Date.UTC(2026, 9, 10);
    app = createMockApi({ now: () => now, accessTtlMs: 100, refreshTtlMs: 1_000, latencyMs: 0 });
    const original = await login();
    now += 100;
    expectApiError(
      await request(app).get('/api/me').auth(original.accessToken, { type: 'bearer' }),
      401,
    );
    const refresh = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: original.refreshToken });
    expect(refresh.status).toBe(200);
    const rotated = body<TokenPair>(refresh);
    expect(rotated.accessToken).not.toBe(original.accessToken);
    expect(rotated.refreshToken).not.toBe(original.refreshToken);
    expectApiError(
      await request(app).post('/api/auth/refresh').send({ refreshToken: original.refreshToken }),
      401,
    );
    expect(
      (await request(app).get('/api/me').auth(rotated.accessToken, { type: 'bearer' })).status,
    ).toBe(200);
    expectApiError(
      await request(app).get('/api/me').auth(original.accessToken, { type: 'bearer' }),
      401,
    );
    expect(
      (await request(app).post('/api/auth/logout').send({ refreshToken: rotated.refreshToken }))
        .status,
    ).toBe(204);
    expectApiError(
      await request(app).get('/api/me').auth(rotated.accessToken, { type: 'bearer' }),
      401,
    );
    expectApiError(
      await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.refreshToken }),
      401,
    );
  });

  it('does not extend the refresh lifetime when rotating credentials', async () => {
    let now = 0;
    app = createMockApi({ now: () => now, accessTtlMs: 500, refreshTtlMs: 1_000, latencyMs: 0 });
    const session = await login();
    now = 900;
    const response = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(response.status).toBe(200);
    const rotated = body<TokenPair>(response);
    now = 1_000;
    expectApiError(
      await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.refreshToken }),
      401,
    );
    expectApiError(
      await request(app).get('/api/me').auth(rotated.accessToken, { type: 'bearer' }),
      401,
    );
  });

  it('scopes lists and totals before pagination for sales, reviewers, and admin', async () => {
    const seed = createSeedData();
    for (const email of ['sales1@example.test', 'reviewer1@example.test', 'admin@example.test']) {
      const { user, accessToken } = await login(email);
      const response = await request(app)
        .get('/api/applications')
        .query({ pageSize: 50 })
        .auth(accessToken, { type: 'bearer' });
      expect(response.status).toBe(200);
      const result = body<Page<ApplicationSummary>>(response);
      const expected = seed.applications.filter(
        (record) =>
          user.role === 'ADMIN' ||
          (user.role === 'SALES'
            ? record.createdBy === user.id
            : record.assignedReviewerId === user.id),
      );
      expect(result.total).toBe(expected.length);
      expect(result.items.map((item) => item.id).sort()).toEqual(
        expected.map((item) => item.id).sort(),
      );
      expect(result.items.every((item) => !('form' in item) && !('sensitive' in item))).toBe(true);
    }
  });

  it('paginates, filters status, and searches legal names on the server', async () => {
    const { accessToken } = await login('admin@example.test');
    const query = (values: Record<string, string | number>) =>
      request(app).get('/api/applications').query(values).auth(accessToken, { type: 'bearer' });
    const first = body<Page<ApplicationSummary>>(await query({ page: 1, pageSize: 3 }));
    const second = body<Page<ApplicationSummary>>(await query({ page: 2, pageSize: 3 }));
    expect(first).toMatchObject({ total: 30, page: 1, pageSize: 3 });
    expect(first.items).toHaveLength(3);
    expect(second.items).toHaveLength(3);
    expect(second.items.every((item) => !first.items.some((other) => other.id === item.id))).toBe(
      true,
    );
    const drafts = body<Page<ApplicationSummary>>(await query({ status: 'DRAFT', pageSize: 50 }));
    expect(drafts.total).toBe(6);
    expect(drafts.items.every((item) => item.status === 'DRAFT')).toBe(true);
    const name = createSeedData().applications[0].form.business.legalName;
    const search = body<Page<ApplicationSummary>>(
      await query({ search: name.toUpperCase(), pageSize: 50 }),
    );
    expect(search.items.some((item) => item.id === 'app-001')).toBe(true);
    expect(
      search.items.every((item) => item.legalName.toUpperCase().includes(name.toUpperCase())),
    ).toBe(true);
    expect(body<Page<ApplicationSummary>>(await query({ page: 100, pageSize: 3 })).items).toEqual(
      [],
    );
  });

  it('rejects invalid list parameters and unauthenticated requests consistently', async () => {
    expectApiError(await request(app).get('/api/applications'), 401);
    const { accessToken } = await login();
    for (const query of [{ page: 0 }, { page: 1.5 }, { pageSize: 51 }, { status: 'UNKNOWN' }]) {
      expectApiError(
        await request(app)
          .get('/api/applications')
          .query(query)
          .auth(accessToken, { type: 'bearer' }),
        400,
      );
    }
  });

  it('returns masked metadata without raw banking fields in detail responses', async () => {
    const { accessToken } = await login();
    const detail = await getApplication(accessToken, 'app-001');
    const original = createSeedData().applications[0].form.banking;
    expect(detail.form.banking).toEqual({ bankName: original.bankName });
    expect(detail.sensitive.accountNumber).toEqual({
      present: true,
      masked: expect.stringContaining(original.accountNumber.slice(-4)),
    });
    expect(detail.sensitive.taxId.present).toBe(true);
    expect(JSON.stringify(detail)).not.toContain(original.accountNumber);
    expect(JSON.stringify(detail)).not.toContain(original.taxId);
  });

  it('allows banking reveal only for admin or the assigned reviewer and prevents caching', async () => {
    const sales = await login();
    const reviewer = await login('reviewer1@example.test');
    const otherReviewer = await login('reviewer2@example.test');
    const admin = await login('admin@example.test');
    const reveal = (token: string) =>
      request(app).get('/api/applications/app-003/sensitive').auth(token, { type: 'bearer' });
    expectApiError(await reveal(sales.accessToken), 403);
    expectApiError(await reveal(otherReviewer.accessToken), 403);
    const original = createSeedData().applications[2].form.banking;
    for (const token of [reviewer.accessToken, admin.accessToken]) {
      const response = await reveal(token);
      expect(response.status).toBe(200);
      expect(body<SensitiveBanking>(response)).toEqual({
        accountNumber: original.accountNumber,
        taxId: original.taxId,
      });
      expect(response.headers['cache-control']).toContain('no-store');
    }
  });

  it('denies another sales user’s application on direct reads and writes', async () => {
    const { accessToken } = await login();
    expectApiError(
      await request(app).get('/api/applications/app-002').auth(accessToken, { type: 'bearer' }),
      403,
    );
    expectApiError(
      await request(app)
        .patch('/api/applications/app-006')
        .auth(accessToken, { type: 'bearer' })
        .send({ version: 1, form: { business: { legalName: 'Forbidden change' } } }),
      403,
    );
  });

  it('creates an empty draft for sales while rejecting role and ownership overrides', async () => {
    const sales = await login();
    const response = await request(app)
      .post('/api/applications')
      .auth(sales.accessToken, { type: 'bearer' })
      .send({});
    expect(response.status).toBe(201);
    const draft = body<ApplicationDetail>(response);
    expect(draft).toMatchObject({
      status: 'DRAFT',
      createdBy: 'sales-1',
      version: 1,
      assignedReviewerId: null,
    });
    expect(draft.sensitive.accountNumber).toEqual({ present: false, masked: '' });
    for (const email of ['admin@example.test', 'reviewer1@example.test']) {
      const { accessToken } = await login(email);
      expectApiError(
        await request(app).post('/api/applications').auth(accessToken, { type: 'bearer' }).send({}),
        403,
      );
    }
    expectApiError(
      await request(app)
        .post('/api/applications')
        .auth(sales.accessToken, { type: 'bearer' })
        .send({ createdBy: 'sales-2' }),
      400,
    );
  });

  it('merges partial draft fields, increments the version, and preserves omitted sensitive values', async () => {
    const sales = await login();
    const before = await getApplication(sales.accessToken, 'app-001');
    const response = await request(app)
      .patch('/api/applications/app-001')
      .auth(sales.accessToken, { type: 'bearer' })
      .send({
        version: before.version,
        form: {
          business: { legalName: 'Updated fictional merchant' },
          banking: { bankName: 'Updated test bank' },
        },
      });
    expect(response.status).toBe(200);
    const after = body<ApplicationDetail>(response);
    expect(after.version).toBe(before.version + 1);
    expect(after.form.business).toEqual({
      ...before.form.business,
      legalName: 'Updated fictional merchant',
    });
    expect(after.form.contact).toEqual(before.form.contact);
    expect(after.sensitive).toEqual(before.sensitive);
    const admin = await login('admin@example.test');
    const revealed = await request(app)
      .get('/api/applications/app-001/sensitive')
      .auth(admin.accessToken, { type: 'bearer' });
    const original = createSeedData().applications[0].form.banking;
    expect(body<SensitiveBanking>(revealed)).toEqual({
      accountNumber: original.accountNumber,
      taxId: original.taxId,
    });
  });

  it('rejects mass assignment and malformed nested fields without changing the draft', async () => {
    const { accessToken } = await login();
    const before = await getApplication(accessToken, 'app-001');
    const invalidBodies = [
      { version: before.version, form: {}, status: 'APPROVED' },
      { version: before.version, form: {}, createdBy: 'sales-2' },
      { version: before.version, form: { business: { injected: 'value' } } },
      { version: before.version, form: { unexpected: {} } },
      { version: before.version, form: { processing: { monthlyVolume: '1000' } } },
      { version: before.version, form: { banking: { accountNumber: '•••• 1234' } } },
      { form: { business: { legalName: 'No version' } } },
    ];
    for (const payload of invalidBodies) {
      expectApiError(
        await request(app)
          .patch('/api/applications/app-001')
          .auth(accessToken, { type: 'bearer' })
          .send(payload),
        400,
      );
    }
    expect(await getApplication(accessToken, 'app-001')).toEqual(before);
  });

  it('returns a conflict for stale saves so older autosaves cannot overwrite newer edits', async () => {
    const { accessToken } = await login();
    const before = await getApplication(accessToken, 'app-001');
    const save = (name: string) =>
      request(app)
        .patch('/api/applications/app-001')
        .auth(accessToken, { type: 'bearer' })
        .send({ version: before.version, form: { business: { legalName: name } } });
    expect((await save('Newest accepted edit')).status).toBe(200);
    expectApiError(await save('Stale edit'), 409);
    const current = await getApplication(accessToken, 'app-001');
    expect(current.form.business.legalName).toBe('Newest accepted edit');
    expect(current.version).toBe(before.version + 1);
  });

  it('permits incomplete drafts but returns field errors when they are submitted', async () => {
    const { accessToken } = await login();
    const created = await request(app)
      .post('/api/applications')
      .auth(accessToken, { type: 'bearer' })
      .send({});
    const draft = body<ApplicationDetail>(created);
    const saved = await request(app)
      .patch(`/api/applications/${draft.id}`)
      .auth(accessToken, { type: 'bearer' })
      .send({ version: draft.version, form: { business: { legalName: 'Incomplete merchant' } } });
    expect(saved.status).toBe(200);
    const updated = body<ApplicationDetail>(saved);
    const error = expectApiError(
      await request(app)
        .post(`/api/applications/${draft.id}/submit`)
        .auth(accessToken, { type: 'bearer' })
        .send({ version: updated.version }),
      422,
    );
    expect(error.fields).toHaveProperty('contact.email');
    expect(error.fields).toHaveProperty('banking.accountNumber');
    expect((await getApplication(accessToken, draft.id)).status).toBe('DRAFT');
  });

  it('completes the submit, assign, and reject workflow with validation and immutable decision history', async () => {
    const sales = await login();
    const admin = await login('admin@example.test');
    const reviewer = await login('reviewer1@example.test');
    const created = await request(app)
      .post('/api/applications')
      .auth(sales.accessToken, { type: 'bearer' })
      .send({});
    let draft = body<ApplicationDetail>(created);
    const path = `/api/applications/${draft.id}`;
    const saved = await request(app)
      .patch(path)
      .auth(sales.accessToken, { type: 'bearer' })
      .send({ version: draft.version, form: createSeedData().applications[0].form });
    expect(saved.status).toBe(200);
    draft = body<ApplicationDetail>(saved);
    const submitted = await request(app)
      .post(`${path}/submit`)
      .auth(sales.accessToken, { type: 'bearer' })
      .send({ version: draft.version });
    expect(submitted.status).toBe(200);
    const submission = body<ApplicationDetail>(submitted);
    expect(submission.status).toBe('SUBMITTED');
    expectApiError(
      await request(app)
        .patch(path)
        .auth(sales.accessToken, { type: 'bearer' })
        .send({ version: submission.version, form: { business: { legalName: 'Too late' } } }),
      409,
    );
    expectApiError(
      await request(app)
        .put(`${path}/assignment`)
        .auth(sales.accessToken, { type: 'bearer' })
        .send({ version: submission.version, reviewerId: reviewer.user.id }),
      403,
    );
    const assigned = await request(app)
      .put(`${path}/assignment`)
      .auth(admin.accessToken, { type: 'bearer' })
      .send({ version: submission.version, reviewerId: reviewer.user.id });
    expect(assigned.status).toBe(200);
    const review = body<ApplicationDetail>(assigned);
    expect(review).toMatchObject({ status: 'IN_REVIEW', assignedReviewerId: reviewer.user.id });
    const decision = { version: review.version, decision: 'REJECT', riskLevel: 'HIGH', note: '  ' };
    expectApiError(
      await request(app)
        .post(`${path}/decision`)
        .auth(reviewer.accessToken, { type: 'bearer' })
        .send(decision),
      422,
    );
    const rejected = await request(app)
      .post(`${path}/decision`)
      .auth(reviewer.accessToken, { type: 'bearer' })
      .send({ ...decision, note: 'Supporting registration evidence is missing.' });
    expect(rejected.status).toBe(200);
    const final = body<ApplicationDetail>(rejected);
    expect(final.status).toBe('REJECTED');
    expect(final.riskHistory).toHaveLength(1);
    expect(final.riskHistory[0]).toMatchObject({
      decision: 'REJECT',
      riskLevel: 'HIGH',
      reviewerId: reviewer.user.id,
      reviewerName: reviewer.user.name,
      note: 'Supporting registration evidence is missing.',
    });
    expect(Number.isNaN(Date.parse(final.riskHistory[0].at))).toBe(false);
    expectApiError(
      await request(app)
        .post(`${path}/decision`)
        .auth(reviewer.accessToken, { type: 'bearer' })
        .send({ ...decision, version: final.version, note: 'Repeated decision' }),
      409,
    );
    expectApiError(
      await request(app)
        .put(`${path}/assignment`)
        .auth(admin.accessToken, { type: 'bearer' })
        .send({ version: final.version, reviewerId: 'reviewer-2' }),
      409,
    );
    expect((await getApplication(admin.accessToken, draft.id)).riskHistory).toEqual(
      final.riskHistory,
    );
  });

  it('accepts approval only from the assigned reviewer', async () => {
    const admin = await login('admin@example.test');
    const reviewer = await login('reviewer1@example.test');
    const other = await login('reviewer2@example.test');
    const current = await getApplication(admin.accessToken, 'app-003');
    const payload = { version: current.version, decision: 'APPROVE', riskLevel: 'LOW', note: '' };
    const decide = (token: string) =>
      request(app)
        .post('/api/applications/app-003/decision')
        .auth(token, { type: 'bearer' })
        .send(payload);
    expectApiError(await decide(admin.accessToken), 403);
    expectApiError(await decide(other.accessToken), 403);
    const accepted = await decide(reviewer.accessToken);
    expect(accepted.status).toBe(200);
    expect(body<ApplicationDetail>(accepted).status).toBe('APPROVED');
    expect(body<ApplicationDetail>(accepted).riskHistory.at(-1)).toMatchObject({
      decision: 'APPROVE',
      riskLevel: 'LOW',
      reviewerId: reviewer.user.id,
    });
  });

  it('validates assignees and states, and removes the old reviewer’s access after reassignment', async () => {
    const admin = await login('admin@example.test');
    const reviewer = await login('reviewer1@example.test');
    const other = await login('reviewer2@example.test');
    const current = await getApplication(admin.accessToken, 'app-003');
    for (const reviewerId of ['sales-1', 'missing-user']) {
      expectApiError(
        await request(app)
          .put('/api/applications/app-003/assignment')
          .auth(admin.accessToken, { type: 'bearer' })
          .send({ version: current.version, reviewerId }),
        400,
      );
    }
    expectApiError(
      await request(app)
        .put('/api/applications/app-001/assignment')
        .auth(admin.accessToken, { type: 'bearer' })
        .send({ version: 1, reviewerId: other.user.id }),
      409,
    );
    const reassigned = await request(app)
      .put('/api/applications/app-003/assignment')
      .auth(admin.accessToken, { type: 'bearer' })
      .send({ version: current.version, reviewerId: other.user.id });
    expect(reassigned.status).toBe(200);
    expectApiError(
      await request(app)
        .get('/api/applications/app-003')
        .auth(reviewer.accessToken, { type: 'bearer' }),
      403,
    );
    expect((await getApplication(other.accessToken, 'app-003')).assignedReviewerId).toBe(
      other.user.id,
    );
  });

  it('fails one configured list request and allows the next retry', async () => {
    app = createMockApi({ latencyMs: 0, failListOnce: true });
    const { accessToken } = await login();
    const list = () => request(app).get('/api/applications').auth(accessToken, { type: 'bearer' });
    expectApiError(await list(), 503);
    const response = await list();
    expect(response.status).toBe(200);
    expect(body<Page<ApplicationSummary>>(response).total).toBe(15);
  });

  it('fails one configured save without changing data, then accepts the same version on retry', async () => {
    app = createMockApi({ latencyMs: 0, failSaveOnce: true });
    const { accessToken } = await login();
    const before = await getApplication(accessToken, 'app-001');
    const save = () =>
      request(app)
        .patch('/api/applications/app-001')
        .auth(accessToken, { type: 'bearer' })
        .send({ version: before.version, form: { business: { legalName: 'Saved after retry' } } });
    expectApiError(await save(), 503);
    expect(await getApplication(accessToken, 'app-001')).toEqual(before);
    const response = await save();
    expect(response.status).toBe(200);
    expect(body<ApplicationDetail>(response)).toMatchObject({
      version: before.version + 1,
      legalName: 'Saved after retry',
    });
  });

  it('returns the same JSON error envelope for malformed JSON and unknown API routes', async () => {
    expectApiError(
      await request(app)
        .post('/api/auth/login')
        .set('Content-Type', 'application/json')
        .send('{"email":'),
      400,
    );
    const { accessToken } = await login();
    expectApiError(
      await request(app).get('/api/unknown-route').auth(accessToken, { type: 'bearer' }),
      404,
    );
  });
});
