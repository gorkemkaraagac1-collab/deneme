const express = require("express");
const pool = require("../db/pool");

const router = express.Router();

// GET /api/audit?contractId=&action=&limit=
// Frontend'deki recordAuditEvent() ile aynı alan adlarını (actor,
// action, entityType, entityId, contractId, oldValue, newValue,
// metadata) kullanır — backend'e taşındığında dönüşüm gerekmez.
router.get("/", async (req, res) => {
  try {
    const { contractId, action, limit } = req.query;
    const conditions = [];
    const params = [];

    if (contractId) {
      params.push(contractId);
      conditions.push(`contract_id = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`action = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(Math.min(Number(limit) || 200, 1000));

    const result = await pool.query(
      `SELECT * FROM audit_events ${where} ORDER BY timestamp DESC LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/audit — yeni bir audit event kaydeder
router.post("/", async (req, res) => {
  try {
    const { id, actor, action, entityType, entityId, contractId, oldValue, newValue, metadata } = req.body;

    if (!id || !action || !entityType) {
      return res.status(400).json({ error: "id, action, entityType zorunludur" });
    }

    const result = await pool.query(
      `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, contract_id, old_value, new_value, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        actor || "system",
        action,
        entityType,
        entityId || null,
        contractId || null,
        oldValue ? JSON.stringify(oldValue) : null,
        newValue ? JSON.stringify(newValue) : null,
        metadata ? JSON.stringify(metadata) : null
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
