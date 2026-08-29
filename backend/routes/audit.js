const express = require("express");
const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { resolveAccessScope, isCompanyInScope } = require("../services/organization-service");

const router = express.Router();

router.use(requireAuth);

// P3 DÜZELTMESİ: bu route önceden HER YERDE doğrudan req.user.companyIds
// (JWT'den, kullanıcının DOĞRUDAN bağlı olduğu şirketler) kullanıyordu.
// Bu, iki ayrı sorun yaratıyordu:
//  1) ADMIN için: ADMIN'in companyIds'i genelde boş/anlamsızdır (platform-
//     level roldür, belirli şirketlere "bağlı" değildir) — ADMIN bu
//     endpoint'i çağırdığında muhtemelen HİÇBİR audit kaydı görmüyordu,
//     hâlbuki ADMIN global erişime sahip olmalı (middleware/admin.js'teki
//     tasarım kararıyla tutarlı).
//  2) ACCOUNTANT_MANAGER için: yalnızca DOĞRUDAN atandığı şirket(ler)in
//     audit kayıtlarını görüyordu, kendi holding ALT AĞACINDAKİ (child)
//     şirketlerin kayıtlarını GÖREMİYORDU — P1'in "ACCOUNTANT_MANAGER
//     kendi subtree'sini görür" ilkesiyle çelişiyordu.
// Artık her istekte resolveAccessScope() ile hesaplanan accessScope
// kullanılıyor (contracts.js/admin.js ile AYNI merkezi kaynak).
// ACCOUNTANT/CONTROLLER/VIEWER için sonuç ESKİ davranışla BİREBİR AYNIDIR
// (resolveAccessScope bu roller için doğrudan req.user.companyIds döner).
router.use(async (req, res, next) => {
  try {
    req.accessScope = await resolveAccessScope(req.user);
    return next();
  } catch (error) {
    console.error("audit.js erişim kapsamı hesaplama hatası:", error);
    return res.status(500).json({
      error: "Yetki kapsamı hesaplanırken beklenmeyen bir hata oluştu"
    });
  }
});

// GET /api/audit?contractId=&action=&limit=
// audit_events tablosunda doğrudan company_id yok — kontrata (contract_id)
// bağlı. Bu yüzden contracts tablosuyla JOIN edilip, kontratın
// company_id'si isteği yapanın accessScope'unda olması ZORUNLU kılınıyor
// (ADMIN: kısıtlama yok — global; ACCOUNTANT_MANAGER: kendi alt ağacı;
// diğerleri: req.user.companyIds). contract_id NULL olan (kontrata bağlı
// olmayan) audit kayıtları, sahibi belirsiz olduğu için hiçbir kullanıcıya
// gösterilmez.
router.get("/", async (req, res) => {
  try {
    const { contractId, action, limit } = req.query;
    const conditions = [];
    const params = [];

    if (!req.accessScope.isGlobalAdmin) {
      params.push(req.accessScope.allowedCompanyIds);
      conditions.push(`c.company_id = ANY($${params.length})`);
    }

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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `SELECT a.* FROM audit_events a
       JOIN contracts c ON c.id = a.contract_id
       ${whereClause}
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
// verilmişse, o kontratın gerçekten isteği yapanın accessScope'unda
// olduğu ÖNCE doğrulanır — aksi halde bir kullanıcı başka şirketin
// kontratına sahte audit kaydı düşürebilirdi.
router.post("/", async (req, res) => {
  try {
    const { id, action, entityType, entityId, contractId, oldValue, newValue, metadata } = req.body;

    if (!id || !action || !entityType) {
      return res.status(400).json({ error: "id, action, entityType zorunludur" });
    }

    if (contractId) {
      const contractResult = await pool.query(
        "SELECT company_id FROM contracts WHERE id = $1",
        [contractId]
      );

      const contractCompanyId = contractResult.rows[0]
        ? String(contractResult.rows[0].company_id)
        : null;

      if (!contractCompanyId || !isCompanyInScope(contractCompanyId, req.accessScope)) {
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
