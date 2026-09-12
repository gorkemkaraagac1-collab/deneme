'use strict';

const { assertPeriodKey, assertPeriodOpen, PeriodClosedError } = require('../backend/services/period-lock-service');

describe('period lock service', () => {
  test('validates YYYY-MM period keys', () => {
    expect(() => assertPeriodKey('2026-01')).not.toThrow();
    expect(() => assertPeriodKey('2026-13')).toThrow('YYYY-MM');
  });

  test('allows an open period', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 0 }) };
    await expect(assertPeriodOpen(db, 'CO1', '2026-01')).resolves.toBe(true);
  });

  test('rejects a closed period', async () => {
    const db = { query: jest.fn().mockResolvedValue({ rowCount: 1 }) };
    await expect(assertPeriodOpen(db, 'CO1', '2026-01')).rejects.toBeInstanceOf(PeriodClosedError);
  });
});
