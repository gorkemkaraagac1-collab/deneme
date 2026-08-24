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
    // Ham DB hata mesajı (SQL detayları, tablo/kolon adları vb.)
    // client'a asla dönmez — yalnızca server loguna yazılır.
    console.error("GET /api/reports/summary hatası:", error);
    res.status(500).json({ error: "Rapor oluşturulurken beklenmeyen bir hata oluştu" });
  }
});

// GET /api/reports/expiring?days=90 — yakında bitecek kontratlar,
// yine yalnızca kullanıcının kendi şirket(ler)i.
router.get("/expiring", async (req, res) => {
  try {
    // Number("") -> 0, Number("abc") -> NaN, Number("-5") -> -5.
    // Number.isFinite ile hem NaN hem de Infinity/-Infinity reddedilir;
    // ardından 1..3650 aralığına clamp edilir (negatif/aşırı büyük
    // değerler ile anlamsız/aşırı maliyetli sorgular önlenir).
    const rawDays = Number(req.query.days);
    const days = Number.isFinite(rawDays)
      ? Math.min(Math.max(Math.trunc(rawDays), 1), 3650)
      : 90;

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
    console.error("GET /api/reports/expiring hatası:", error);
    res.status(500).json({ error: "Rapor oluşturulurken beklenmeyen bir hata oluştu" });
  }
});

module.exports = router;
