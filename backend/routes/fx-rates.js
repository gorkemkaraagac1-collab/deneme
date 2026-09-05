const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const { createRateLimiter } = require("../middleware/rate-limit");
const pool = require("../db/pool");
const { EFFECTIVE_FROM, fetchTcmbDate, insertPendingRates } = require("../services/tcmb-fx-service");

const router = express.Router();
router.use(requireAuth);
const limiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 300, keyGenerator: req => `fx-read:${req.ip}` });
const syncLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 2, keyGenerator: req => `fx-sync:${req.ip}` });

router.get("/", limiter, async (req, res) => {
  try {
    const from = String(req.query.from || "").toUpperCase();
    const to = String(req.query.to || "TRY").toUpperCase();
    if (!["USD", "EUR"].includes(from) || to !== "TRY") return res.status(400).json({ error: "Yalnızca USD/TRY ve EUR/TRY desteklenir.", code: "UNSUPPORTED_CURRENCY_PAIR" });
    const requestedDate = req.query.date ? String(req.query.date) : null;
    if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return res.status(400).json({ error: "Geçersiz tarih.", code: "INVALID_DATE" });
    const result = await pool.query(requestedDate
      ? `SELECT from_currency AS "fromCurrency", to_currency AS "toCurrency", rate_date AS "rateDate", rate, verification_status AS "verificationStatus" FROM fx_rates WHERE from_currency=$1 AND to_currency=$2 AND rate_date >= $3 AND rate_date <= $4 AND superseded_by IS NULL AND verification_status='VERIFIED' ORDER BY rate_date DESC LIMIT 1`
      : `SELECT from_currency AS "fromCurrency", to_currency AS "toCurrency", rate_date AS "rateDate", rate, verification_status AS "verificationStatus" FROM fx_rates WHERE from_currency=$1 AND to_currency=$2 AND rate_date >= $3 AND superseded_by IS NULL AND verification_status='VERIFIED' ORDER BY rate_date`,
      requestedDate ? [from, to, EFFECTIVE_FROM, requestedDate] : [from, to, EFFECTIVE_FROM]);
    if (requestedDate && !result.rows[0]) return res.status(404).json({ error: "Bu tarih veya önceki yayımlanmış iş günleri için doğrulanmış kur bulunamadı.", code: "FX_RATE_NOT_FOUND" });
    if (requestedDate) return res.json({ rate: { ...result.rows[0], rate: Number(result.rows[0].rate) }, requestedDate });
    return res.json({ rates: result.rows.map(row => ({ ...row, rate: Number(row.rate) })) });
  } catch (error) { console.error("GET /api/fx-rates error:", error); return res.status(500).json({ error: "Kur verisi alınamadı." }); }
});

router.post("/:id/verify", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Geçersiz kur kimliği." });
  const result = await pool.query(`UPDATE fx_rates SET verification_status='VERIFIED', verified_at=NOW(), verified_by=$1 WHERE id=$2 AND superseded_by IS NULL AND verification_status='PENDING' RETURNING id`, [String(req.user.id), id]);
  if (!result.rows[0]) return res.status(404).json({ error: "Doğrulanacak kur bulunamadı." });
  return res.json({ verified: true, id });
});

router.post("/sync", syncLimiter, requireAdmin, async (req, res) => {
  const from = String(req.body?.from || EFFECTIVE_FROM);
  const to = String(req.body?.to || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || from < EFFECTIVE_FROM || from > to) return res.status(400).json({ error: "Geçersiz tarih aralığı.", code: "INVALID_DATE_RANGE" });
  const days = Math.ceil((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  if (days > 366) return res.status(400).json({ error: "Tek senkronizasyonda en fazla 366 gün alınabilir.", code: "DATE_RANGE_TOO_LARGE" });
  const fetched = [], skipped = [];
  try {
    for (let cursor = new Date(`${from}T00:00:00Z`); cursor <= new Date(`${to}T00:00:00Z`); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const date = cursor.toISOString().slice(0, 10);
      const result = await fetchTcmbDate(date);
      if (!result.published) { skipped.push(date); continue; }
      fetched.push(...await insertPendingRates(result.rows, String(req.user.id)));
    }
    return res.json({ from, to, inserted: fetched, skipped, status: "PENDING" });
  } catch (error) { console.error("POST /api/fx-rates/sync error:", error); return res.status(502).json({ error: "TCMB verisi alınamadı.", code: error.code || "TCMB_SYNC_FAILED" }); }
});

module.exports = router;
