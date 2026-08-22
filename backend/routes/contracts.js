const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// GET /api/contracts — tüm kontratları listeler
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM contracts ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/contracts/:id — tek bir kontratı getirir
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM contracts WHERE id = $1", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/contracts — yeni kontrat oluşturur
router.post("/", async (req, res) => {
  try {
    const { id, company, supplier, monthlyPayment, startDate, endDate, discountRate, currency } = req.body;

    if (!id || !company || !supplier || !startDate || !endDate) {
      return res.status(400).json({ error: "id, company, supplier, startDate, endDate zorunludur" });
    }

    const result = await pool.query(
      `INSERT INTO contracts (id, company, supplier, monthly_payment, start_date, end_date, discount_rate, currency)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, company, supplier, monthlyPayment, startDate, endDate, discountRate || 0, currency || "TRY"]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") { // unique_violation
      return res.status(409).json({ error: `Contract already exists: ${req.body.id}` });
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/contracts/:id — kontratı günceller
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
       WHERE id = $9
       RETURNING *`,
      [company, supplier, monthlyPayment, startDate, endDate, discountRate, currency, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/contracts/:id — kontratı siler
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM contracts WHERE id = $1 RETURNING id", [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Contract not found" });
    }
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
