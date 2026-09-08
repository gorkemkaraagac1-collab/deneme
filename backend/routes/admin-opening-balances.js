const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireAdmin } = require('../middleware/admin');

const router = express.Router();
router.use(requireAdmin);

const MAX_ROWS = 1000;
const REQUIRED = ['company_id', 'contract_id', 'opening_date', 'opening_rou_asset', 'opening_lease_liability'];

function id() { return `OPENING-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`.slice(0, 50); }
function num(value) { return value === '' || value === null || value === undefined ? null : Number(value); }
function validateRows(rows) {
  const errors = [];
  if (!Array.isArray(rows) || rows.length === 0) return { rows: [], errors: [{ row: 0, message: 'En az bir satır gönderilmelidir.' }] };
  if (rows.length > MAX_ROWS) return { rows: [], errors: [{ row: 0, message: `En fazla ${MAX_ROWS} sözleşme tek seferde aktarılabilir.` }] };
  const seen = new Set();
  rows.forEach((raw, i) => {
    const row = raw || {};
    REQUIRED.forEach(field => { if (row[field] === undefined || row[field] === '') errors.push({ row: i + 1, field, message: `${field} zorunludur.` }); });
    const key = `${row.contract_id}|${row.opening_date}`;
    if (seen.has(key)) errors.push({ row: i + 1, field: 'contract_id', message: 'Aynı sözleşme ve açılış tarihi tekrar ediyor.' });
    seen.add(key);
    ['opening_rou_asset', 'opening_lease_liability', 'opening_accumulated_depreciation', 'opening_accumulated_interest', 'opening_retained_earnings_adjustment', 'discount_rate'].forEach(field => {
      if (row[field] !== undefined && row[field] !== '' && !Number.isFinite(num(row[field]))) errors.push({ row: i + 1, field, message: 'Sayısal değer olmalıdır.' });
    });
    if (row.opening_date && !/^\d{4}-\d{2}-\d{2}$/.test(String(row.opening_date))) errors.push({ row: i + 1, field: 'opening_date', message: 'Tarih YYYY-MM-DD formatında olmalıdır.' });
    if (num(row.opening_rou_asset) < 0 || num(row.opening_lease_liability) < 0) errors.push({ row: i + 1, message: 'Bakiye değerleri negatif olamaz.' });
  });
  return { rows, errors };
}

async function checkReferences(client, rows, errors) {
  const contracts = await client.query('SELECT id, company_id FROM contracts WHERE id = ANY($1::varchar[])', [rows.map(r => String(r.contract_id))]);
  const byId = new Map(contracts.rows.map(r => [r.id, r]));
  rows.forEach((r, i) => {
    const found = byId.get(String(r.contract_id));
    if (!found) errors.push({ row: i + 1, field: 'contract_id', message: 'Sözleşme bulunamadı.' });
    else if (String(found.company_id) !== String(r.company_id)) errors.push({ row: i + 1, field: 'company_id', message: 'Sözleşme bu şirkete ait değil.' });
  });
}

router.post('/validate', async (req, res) => {
  try {
    const checked = validateRows(req.body?.rows);
    if (!checked.errors.length) await checkReferences(pool, checked.rows, checked.errors);
    const totals = checked.rows.reduce((a, r) => ({ rou: a.rou + (num(r.opening_rou_asset) || 0), liability: a.liability + (num(r.opening_lease_liability) || 0), adjustment: a.adjustment + (num(r.opening_retained_earnings_adjustment) || 0) }), { rou: 0, liability: 0, adjustment: 0 });
    res.json({ success: checked.errors.length === 0, errors: checked.errors, row_count: checked.rows.length, totals });
  } catch (error) { console.error('Opening balance validation error:', error); res.status(500).json({ success: false, error: 'Açılış bakiyeleri doğrulanamadı.' }); }
});

router.post('/import', async (req, res) => {
  const checked = validateRows(req.body?.rows);
  const client = await pool.connect();
  try {
    if (!checked.errors.length) await checkReferences(client, checked.rows, checked.errors);
    if (checked.errors.length) return res.status(400).json({ success: false, errors: checked.errors });
    await client.query('BEGIN');
    for (const r of checked.rows) {
      await client.query(`INSERT INTO contract_opening_balances
        (id, company_id, contract_id, opening_date, opening_rou_asset, opening_lease_liability,
         opening_accumulated_depreciation, opening_accumulated_interest, opening_retained_earnings_adjustment,
         discount_rate, currency, next_payment_date, source_reference, status, imported_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'IMPORTED',$14)
        ON CONFLICT (contract_id, opening_date) DO UPDATE SET
          company_id=EXCLUDED.company_id, opening_rou_asset=EXCLUDED.opening_rou_asset,
          opening_lease_liability=EXCLUDED.opening_lease_liability,
          opening_accumulated_depreciation=EXCLUDED.opening_accumulated_depreciation,
          opening_accumulated_interest=EXCLUDED.opening_accumulated_interest,
          opening_retained_earnings_adjustment=EXCLUDED.opening_retained_earnings_adjustment,
          discount_rate=EXCLUDED.discount_rate, currency=EXCLUDED.currency,
          next_payment_date=EXCLUDED.next_payment_date, source_reference=EXCLUDED.source_reference,
          status='IMPORTED', imported_by=EXCLUDED.imported_by, updated_at=NOW()`,
        [id(), r.company_id, r.contract_id, r.opening_date, num(r.opening_rou_asset), num(r.opening_lease_liability), num(r.opening_accumulated_depreciation) || 0, num(r.opening_accumulated_interest) || 0, num(r.opening_retained_earnings_adjustment) || 0, num(r.discount_rate), r.currency || 'TRY', r.next_payment_date || null, r.source_reference || null, req.user.id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ success: true, imported: checked.rows.length, status: 'IMPORTED' });
  } catch (error) { await client.query('ROLLBACK'); console.error('Opening balance import error:', error); res.status(500).json({ success: false, error: 'Açılış bakiyeleri içe aktarılamadı.' }); }
  finally { client.release(); }
});

router.get('/', async (req, res) => {
  try { const result = await pool.query(`SELECT ob.*, c.company, c.supplier FROM contract_opening_balances ob JOIN contracts c ON c.id=ob.contract_id ORDER BY ob.company_id, ob.contract_id`); res.json({ success: true, data: result.rows }); }
  catch (error) { console.error('Opening balance list error:', error); res.status(500).json({ success: false, error: 'Açılış bakiyeleri alınamadı.' }); }
});

router.post('/approve', async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    if (!ids.length || ids.length > MAX_ROWS) return res.status(400).json({ success: false, error: 'Geçerli kayıt listesi gönderilmelidir.' });
    const result = await pool.query(`UPDATE contract_opening_balances SET status='APPROVED', approved_by=$1, approved_at=NOW(), updated_at=NOW() WHERE id=ANY($2::varchar[]) AND status='IMPORTED' RETURNING id`, [req.user.id, ids]);
    res.json({ success: true, approved: result.rowCount });
  } catch (error) { console.error('Opening balance approval error:', error); res.status(500).json({ success: false, error: 'Açılış bakiyeleri onaylanamadı.' }); }
});

// Admin-only cleanup for migrated/test opening balances. APPROVED rows may
// be removed here because this route is protected by requireAdmin above.
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM contract_opening_balances
       WHERE id = $1
       RETURNING id, contract_id`,
      [String(req.params.id)]
    );
    if (!result.rowCount) return res.status(404).json({ success: false, error: 'Açılış bakiyesi bulunamadı.' });
    res.json({ success: true, deleted: result.rows[0] });
  } catch (error) {
    console.error('Opening balance delete error:', error);
    res.status(500).json({ success: false, error: 'Açılış bakiyesi silinemedi.' });
  }
});

module.exports = router;
