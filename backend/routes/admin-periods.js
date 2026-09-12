'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/admin');
const { assertPeriodKey } = require('../services/period-lock-service');

router.use(requireAdmin);

router.post('/periods/close', async (req, res) => {
  const { companyId, periodKey } = req.body || {};
  try {
    if (!companyId) return res.status(400).json({ error: 'companyId is required.' });
    assertPeriodKey(periodKey);
    const id = `close-${companyId}-${periodKey}`;
    const result = await pool.query(
      `INSERT INTO closed_periods (id, company_id, period_key, closed_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (company_id, period_key) DO UPDATE
       SET reopened_at = NULL, reopened_by = NULL, closed_at = NOW(), closed_by = EXCLUDED.closed_by
       RETURNING *`,
      [id, companyId, periodKey, req.user?.id || 'admin']
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
    const result = await pool.query(
      `UPDATE closed_periods SET reopened_at = NOW(), reopened_by = $3
       WHERE company_id = $1 AND period_key = $2 AND reopened_at IS NULL RETURNING *`,
      [companyId, periodKey, req.user?.id || 'admin']
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
