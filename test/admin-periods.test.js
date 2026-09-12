/** @jest-environment node */
'use strict';

const request = require('supertest');
const express = require('express');

const mockQuery = jest.fn();

jest.mock('../backend/db/pool', () => ({ query: mockQuery }));
jest.mock('../backend/middleware/admin', () => ({
  requireAdmin(req, res, next) {
    if (req.headers['x-test-role'] !== 'ADMIN') {
      return res.status(403).json({ code: 'ADMIN_REQUIRED' });
    }
    req.user = { id: 'ADMIN-1', role: 'ADMIN' };
    return next();
  }
}));

const router = require('../backend/routes/admin-periods');

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/admin', router);
  return instance;
}

describe('Admin period close/reopen API', () => {
  beforeEach(() => mockQuery.mockReset());

  test('admin olmayan kullanıcıyı reddeder', async () => {
    const response = await request(app()).post('/api/admin/periods/close').send({ companyId: 'C1', periodKey: '2026-09' });
    expect(response.status).toBe(403);
    expect(response.body.code).toBe('ADMIN_REQUIRED');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('geçersiz dönem formatını reddeder', async () => {
    const response = await request(app()).post('/api/admin/periods/close').set('x-test-role', 'ADMIN').send({ companyId: 'C1', periodKey: '2026-13' });
    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  test('dönemi kapatır ve işlemi yapan admini kaydeder', async () => {
    mockQuery.mockResolvedValue({ rows: [{ company_id: 'C1', period_key: '2026-09' }] });
    const response = await request(app()).post('/api/admin/periods/close').set('x-test-role', 'ADMIN').send({ companyId: 'C1', periodKey: '2026-09' });
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockQuery.mock.calls[0][1].slice(0, 4)).toEqual(['close-C1-2026-09', 'C1', '2026-09', 'ADMIN-1']);
    expect(mockQuery.mock.calls[0][0]).toContain('PERIOD_CLOSED');
  });

  test('kapalı dönemi yeniden açar', async () => {
    mockQuery.mockResolvedValue({ rows: [{ company_id: 'C1', period_key: '2026-09', reopened_by: 'ADMIN-1' }] });
    const response = await request(app()).post('/api/admin/periods/reopen').set('x-test-role', 'ADMIN').send({ companyId: 'C1', periodKey: '2026-09' });
    expect(response.status).toBe(200);
    expect(response.body.period.reopened_by).toBe('ADMIN-1');
    expect(mockQuery.mock.calls[0][1].slice(0, 3)).toEqual(['C1', '2026-09', 'ADMIN-1']);
    expect(mockQuery.mock.calls[0][0]).toContain('PERIOD_REOPENED');
  });

  test('açık veya bulunmayan dönem için 404 döner', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    const response = await request(app()).post('/api/admin/periods/reopen').set('x-test-role', 'ADMIN').send({ companyId: 'C1', periodKey: '2026-09' });
    expect(response.status).toBe(404);
  });

  test('yalnızca aktif kapalı dönemleri şirket filtresiyle listeler', async () => {
    mockQuery.mockResolvedValue({ rows: [{ company_id: 'C1', period_key: '2026-09', reopened_at: null }] });
    const response = await request(app()).get('/api/admin/periods?companyId=C1').set('x-test-role', 'ADMIN');
    expect(response.status).toBe(200);
    expect(response.body.periods).toHaveLength(1);
    expect(mockQuery.mock.calls[0][1]).toEqual(['C1', false]);
  });

  test('includeReopened ile geçmiş dönem durumlarını da listeler', async () => {
    mockQuery.mockResolvedValue({ rows: [] });
    await request(app()).get('/api/admin/periods?includeReopened=true').set('x-test-role', 'ADMIN');
    expect(mockQuery.mock.calls[0][1]).toEqual([null, true]);
  });
});
