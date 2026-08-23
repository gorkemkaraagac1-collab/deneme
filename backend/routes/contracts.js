const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// Bu router'daki HER route requireAuth'tan geçer — token yoksa/geçersizse
// isteğe hiçbir satır dönmeden 401 verilir.
router.use(requireAuth);

// GET /api/contracts — SADECE isteği yapan kullanıcının req.user.companyIds
// listesindeki şirketlere ait kontratları döndürür. company_id = ANY($1)
// filtresi query'nin İÇİNDE, yani veritabanı seviyesinde uygulanır —
// client'ın gönderdiği hiçbir parametreyle bu filtre atlatılamaz.
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contracts WHERE company_id = ANY($1) ORDER BY created_at DESC",
      [req.user.companyIds]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/contracts/:id — yalnızca kullanıcının kendi şirketine aitse
// döner; başka şirketin kontratı için de (var olsa dahi) 404 döner —
// "bu kayıt var ama senin değil" bilgisini bile sızdırmamak için.
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM contracts WHERE id = $1 AND company_id = ANY($2)",
      [req.params.id, req.user.companyIds]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contracts — yeni kontrat oluşturur. company_id, body'den
// GELMEZ/GÜVENİLMEZ — yalnızca req.user.companyIds içinden, body'de
// belirtilen companyId bu listede geçerliyse kabul edilir. Aksi halde
// bir kullanıcı başka bir şirket adına kontrat oluşturabilirdi.
router.post("/", async (req, res) => {
  try {
    const { id, companyId, company, supplier, monthlyPayment, startDate, endDate, discountRate, currency } = req.body;

    if (!id || !companyId || !company || !supplier || !startDate || !endDate) {
      return res.status(400).json({ error: "id, companyId, company, supplier, startDate, endDate zorunludur" });
    }
    if (!req.user.companyIds.includes(String(companyId))) {
      return res.status(403).json({ error: "Bu şirket adına kontrat oluşturma yetkiniz yok" });
    }

    const result = await pool.query(
      `INSERT INTO contracts (id, company_id, company, supplier, monthly_payment, start_date, end_date, discount_rate, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [id, companyId, company, supplier, monthlyPayment, startDate, endDate, discountRate || 0, currency || "TRY"]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") { // unique_violation
      return res.status(409).json({ error: `Contract already exists: ${req.body.id}` });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/contracts/:id — güncelleme, WHERE koşuluna company_id filtresi
// eklenerek yapılır. Böylece "id doğru tahmin edilse bile" başka şirketin
// kontratı güncellenemez — UPDATE 0 satır etkiler, 404 döner.
router.put("/:id", async (req, res) => {
  try {
    const { company, supplier, monthlyPayment, startDate, endDate, discountRate, currency, status } = req.body;
    const result = await pool.query(
      `UPDATE contracts SET
         company = COALESCE($1, company),
         supplier = COALESCE($2, supplier),
         monthly_payment = COALESCE($3, monthly_payment),
         start_date = COALESCE($4, start_date),
         end_date = COALESCE($5, end_date),
         discount_rate = COALESCE($6, discount_rate),
         currency = COALESCE($7, currency),
         status = COALESCE($8, status),
         updated_at = NOW()
       WHERE id = $9 AND company_id = ANY($10)
       RETURNING *`,
      [company, supplier, monthlyPayment, startDate, endDate, discountRate, currency, status, req.params.id, req.user.companyIds]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/contracts/:id — aynı mantık: company_id filtresi olmadan
// silme YOK.
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM contracts WHERE id = $1 AND company_id = ANY($2) RETURNING id",
      [req.params.id, req.user.companyIds]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
