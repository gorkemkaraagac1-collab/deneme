const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

// GET /api/audit?contractId=&action=&limit=
// audit_events tablosunda doğrudan company_id yok — kontrata (contract_id)
// bağlı. Bu yüzden contracts tablosuyla JOIN edilip, kontratın
// company_id'si kullanıcının req.user.companyIds listesinde olması
// ZORUNLU kılınıyor. contract_id NULL olan (kontrata bağlı olmayan)
// audit kayıtları, sahibi belirsiz olduğu için hiçbir kullanıcıya
// gösterilmez.
router.get("/", async (req, res) => {
  try {
    const { contractId, action, limit } = req.query;
    const conditions = ["c.company_id = ANY($1)"];
    const params = [req.user.companyIds];

    if (contractId) {
      params.push(contractId);
      conditions.push(`a.contract_id = $${params.length}`);
    }
    if (action) {
      params.push(action);
      conditions.push(`a.action = $${params.length}`);
    }

    const rawLimit = Number(limit);
    const safeLimit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.trunc(rawLimit), 1), 1000)
      : 200;
    params.push(safeLimit);

    const result = await pool.query(
      `SELECT a.* FROM audit_events a
       JOIN contracts c ON c.id = a.contract_id
       WHERE ${conditions.join(" AND ")}
       ORDER BY a.timestamp DESC
       LIMIT $${params.length}`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error("GET /api/audit hatası:", error);
    res.status(500).json({ error: "Audit kayıtları alınırken beklenmeyen bir hata oluştu" });
  }
});

// POST /api/audit — yeni bir audit event kaydeder. contractId
// verilmişse, o kontratın gerçekten kullanıcının kendi şirketine ait
// olduğu ÖNCE doğrulanır — aksi halde bir kullanıcı başka şirketin
// kontratına sahte audit kaydı düşürebilirdi.
router.post("/", async (req, res) => {
  try {
    const { id, action, entityType, entityId, contractId, oldValue, newValue, metadata } = req.body;

    if (!id || !action || !entityType) {
      return res.status(400).json({ error: "id, action, entityType zorunludur" });
    }

    if (contractId) {
      const owns = await pool.query(
        "SELECT 1 FROM contracts WHERE id = $1 AND company_id = ANY($2)",
        [contractId, req.user.companyIds]
      );
      if (owns.rows.length === 0) {
        return res.status(403).json({ error: "Bu kontrata audit kaydı ekleme yetkiniz yok" });
      }
    }

    // GÜVENLİK: "actor" (kaydı kimin yaptığı) client'ın body'sinden
    // ASLA alınmaz — aksi halde herhangi bir kullanıcı kendi
    // eylemini başka bir kullanıcının üzerine yazarak audit trail'i
    // sahteleyebilirdi (audit log integrity / non-repudiation
    // ihlali). Bu alan yalnızca doğrulanmış JWT kimliğinden gelir.
    const actor = req.user.username || req.user.id || "system";

    const result = await pool.query(
      `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, contract_id, old_value, new_value, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        actor,
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
    console.error("POST /api/audit hatası:", error);
    res.status(500).json({ error: "Audit kaydı oluşturulurken beklenmeyen bir hata oluştu" });
  }
});

module.exports = router;
