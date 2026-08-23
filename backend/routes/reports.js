const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// GET /api/reports/summary — SADECE kullanıcının kendi şirket(ler)inin
// aktif kontratları üzerinden özet. company_id = ANY($1) filtresi
// olmadan bu endpoint tüm şirketlerin toplamını sızdırırdı.
router.get("/summary", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        company,
        COUNT(*) AS contract_count,
        SUM(monthly_payment) AS total_monthly_payment,
        currency
      FROM contracts
      WHERE status = 'active' AND company_id = ANY($1)
      GROUP BY company, currency
      ORDER BY company`,
      [req.user.companyIds]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/expiring?days=90 — yakında bitecek kontratlar,
// yine yalnızca kullanıcının kendi şirket(ler)i.
router.get("/expiring", async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 90, 3650);
    const result = await pool.query(
      `SELECT * FROM contracts
       WHERE status = 'active'
         AND company_id = ANY($1)
         AND end_date BETWEEN NOW() AND NOW() + ($2 || ' days')::interval
       ORDER BY end_date ASC`,
      [req.user.companyIds, days]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
