const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// GET /api/reports/summary — aktif kontratlar için özet rapor
// (toplam aylık ödeme, kontrat sayısı, şirket bazında kırılım).
// NOT: Bu, veritabanı seviyesinde basit bir toplama örneğidir.
// Gerçek TFRS 16 hesaplamaları (liability, ROU, amortisman planı)
// hâlâ frontend'deki calculateLeaseEngine() içinde yapılıyor —
// backend'e taşınması ayrı bir iştir ve bu boilerplate'in kapsamı
// dışındadır.
router.get("/summary", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        company,
        COUNT(*) AS contract_count,
        SUM(monthly_payment) AS total_monthly_payment,
        currency
      FROM contracts
      WHERE status = 'active'
      GROUP BY company, currency
      ORDER BY company
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/expiring?days=90 — yakında bitecek kontratlar
router.get("/expiring", async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 90, 3650);
    const result = await pool.query(
      `SELECT * FROM contracts
       WHERE status = 'active'
         AND end_date BETWEEN NOW() AND NOW() + ($1 || ' days')::interval
       ORDER BY end_date ASC`,
      [days]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
