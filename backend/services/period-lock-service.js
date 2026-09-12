'use strict';

class PeriodClosedError extends Error {
  constructor(companyId, periodKey) {
    super(`Period ${periodKey} is closed for company ${companyId}.`);
    this.name = 'PeriodClosedError';
    this.code = 'PERIOD_CLOSED';
    this.status = 409;
    this.companyId = companyId;
    this.periodKey = periodKey;
  }
}

function assertPeriodKey(periodKey) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(periodKey || ''))) {
    const error = new Error('periodKey must use YYYY-MM format.');
    error.code = 'INVALID_PERIOD_KEY';
    error.status = 400;
    throw error;
  }
}

async function assertPeriodOpen(db, companyId, periodKey) {
  if (!companyId) {
    const error = new Error('companyId is required.');
    error.code = 'COMPANY_REQUIRED';
    error.status = 400;
    throw error;
  }
  assertPeriodKey(periodKey);
  const result = await db.query(
    'SELECT 1 FROM closed_periods WHERE company_id = $1 AND period_key = $2 AND reopened_at IS NULL LIMIT 1',
    [companyId, periodKey]
  );
  if ((result?.rowCount || 0) > 0) throw new PeriodClosedError(companyId, periodKey);
  return true;
}

module.exports = { PeriodClosedError, assertPeriodKey, assertPeriodOpen };
