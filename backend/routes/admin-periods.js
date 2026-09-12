'use strict';
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/admin');
const { assertPeriodKey } = require('../services/period-lock-service');

router.use(requireAdmin);

function auditId() {
  return `AUD-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`.slice(0, 50);
}

router.get('/periods', async (req, res) => {
  try {
    const companyId = req.query.companyId ? String(req.query.companyId) : null;
    const includeReopened = String(req.query.includeReopened || 'false') === 'true';
    const result = await pool.query(
      `SELECT id, company_id, period_key, closed_at, closed_by, reopened_at, reopened_by
       FROM closed_periods
       WHERE ($1::varchar IS NULL OR company_id = $1)
         AND ($2::boolean OR reopened_at IS NULL)
       ORDER BY company_id, period_key DESC`,
      [companyId, includeReopened]
    );
    return res.json({ success: true, periods: result.rows });
  } catch (error) {
    console.error('Admin list periods error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/periods/close', async (req, res) => {
  const { companyId, periodKey } = req.body || {};
  try {
    if (!companyId) return res.status(400).json({ error: 'companyId is required.' });
    assertPeriodKey(periodKey);
    const id = `close-${companyId}-${periodKey}`;
    const actor = req.user?.id || 'admin';
    const result = await pool.query(
      `WITH changed AS (
         INSERT INTO closed_periods (id, company_id, period_key, closed_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (company_id, period_key) DO UPDATE
         SET reopened_at = NULL, reopened_by = NULL, closed_at = NOW(), closed_by = EXCLUDED.closed_by
         RETURNING *
       ), audited AS (
         INSERT INTO audit_events (id, actor, action, entity_type, entity_id, new_value)
         SELECT $5, $4, 'PERIOD_CLOSED', 'period', id, to_jsonb(changed) FROM changed
       )
       SELECT * FROM changed`,
      [id, companyId, periodKey, actor, auditId()]
    );
    return res.status(200).json({ success: true, period: result.rows[0] });
  } catch (error) {
    if (error.code === 'INVALID_PERIOD_KEY') return res.status(400).json({ error: error.message });
    console.error('Admin close period error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/periods/reopen', async (req, res) => {
  const { companyId, periodKey } = req.body || {};
  try {
    if (!companyId) return res.status(400).json({ error: 'companyId is required.' });
    assertPeriodKey(periodKey);
    const actor = req.user?.id || 'admin';
    const result = await pool.query(
      `WITH changed AS (
         UPDATE closed_periods SET reopened_at = NOW(), reopened_by = $3
         WHERE company_id = $1 AND period_key = $2 AND reopened_at IS NULL RETURNING *
       ), audited AS (
         INSERT INTO audit_events (id, actor, action, entity_type, entity_id, new_value)
         SELECT $4, $3, 'PERIOD_REOPENED', 'period', id, to_jsonb(changed) FROM changed
       )
       SELECT * FROM changed`,
      [companyId, periodKey, actor, auditId()]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Closed period not found.' });
    return res.json({ success: true, period: result.rows[0] });
  } catch (error) {
    if (error.code === 'INVALID_PERIOD_KEY') return res.status(400).json({ error: error.message });
    console.error('Admin reopen period error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
