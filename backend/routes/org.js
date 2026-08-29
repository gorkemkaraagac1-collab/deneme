const express = require("express");
const crypto = require("crypto");

const pool = require("../db/pool");
const { requireAuth } = require("../middleware/auth");
const { requireStaffAccess, requireAdmin } = require("../middleware/admin");

const {
  resolveAccessScope,
  isCompanyInScope,
  getRootCompanyId
} = require("../services/organization-service");

const {
  canAddUserToCompany,
  canAddContractToCompany,
  canAddCompanyToTree
} = require("../services/license-service");

const router = express.Router();

/**
 * ============================================================
 * ORGANIZATION API (P3)
 * ============================================================
 *
 * Bu dosya P0/P1'de kurulan organization-service.js /
 * license-service.js'i TEK yetki/limit kaynağı olarak kullanır —
 * hiçbir yetki veya limit hesabı burada yeniden yazılmaz, sadece
 * bu servislerin sonuçları HTTP response'una çevrilir.
 *
 * Neden ayrı bir dosya (routes/admin.js'e eklemek yerine)?
 * admin.js'teki /api/admin/companies ve /api/admin/users
 * requireStaffAccess (yalnızca ADMIN + ACCOUNTANT_MANAGER) ile
 * korunuyor — "yönetim" (management) amaçlıdır. Bu dosyadaki
 * GET endpoint'leri ise TÜM authenticated rollere (ACCOUNTANT/
 * CONTROLLER/VIEWER dahil) kendi erişim kapsamlarını (accessScope)
 * görüntüleme imkanı verir — farklı bir yetki seviyesi, farklı bir
 * router.
 *
 * Client'tan gelen hiçbir companyId/companyIds DOĞRUDAN
 * güvenilmez: her istek JWT + DB + resolveAccessScope() üzerinden
 * doğrulanır (P3 madde 4).
 */

router.use(requireAuth);

function generateEntityId(prefix) {
  const suffix = crypto.randomBytes(8).toString("hex");
  return `${prefix}-${Date.now()}-${suffix}`.slice(0, 50);
}

/**
 * ============================================================
 * GET /api/org/limits
 * ============================================================
 *
 * Bir holding ağacının (root company) efektif limit/kullanım
 * özetini döner. Efektif değerler license-service.js üzerinden
 * COALESCE(override, plan) ile hesaplanır (P0/P1 mekanizması
 * BURADA yeniden yazılmaz, yalnızca çağrılır).
 *
 * ?companyId= — ağacın herhangi bir üyesi (kendisi zaten ağacın
 * kökü de olabilir). Verilmezse, ADMIN olmayan bir kullanıcı için
 * kendi ilk (JWT'deki) şirketi varsayılan alınır. ADMIN için
 * companyId ZORUNLUDUR — ADMIN'in "kendi" tek bir ağacı yoktur.
 *
 * active_users: yalnızca status='ACTIVE' kullanıcıları sayar
 * (bkz. license-service.getTreeActiveUserCount) — INACTIVE
 * kullanıcılar hiçbir zaman bu sayıma dahil değildir.
 */
router.get("/limits", async (req, res) => {
  try {
    const scope = await resolveAccessScope(req.user);

    let companyId = req.query.companyId
      ? String(req.query.companyId)
      : null;

    if (!companyId) {
      if (scope.isGlobalAdmin) {
        return res.status(400).json({
          error:
            "ADMIN için companyId query parametresi zorunludur (hangi holding ağacı sorgulanacak?)",
          code: "COMPANY_ID_REQUIRED"
        });
      }

      const ownCompanyIds = Array.isArray(req.user.companyIds)
        ? req.user.companyIds.map(String)
        : [];

      if (ownCompanyIds.length === 0) {
        return res.status(403).json({
          error: "Herhangi bir şirkete atanmamışsınız.",
          code: "NO_COMPANY_ACCESS"
        });
      }

      companyId = ownCompanyIds[0];
    }

    // IDOR koruması: companyId, isteği yapanın erişim kapsamında
    // (ADMIN: her zaman; ACCOUNTANT_MANAGER: kendi alt ağacı;
    // diğerleri: kendi req.user.companyIds) olmalı. Değilse şirketin
    // var olduğu bile sızdırılmaz (404).
    if (!isCompanyInScope(companyId, scope)) {
      return res.status(404).json({
        error: "Şirket bulunamadı",
        code: "COMPANY_NOT_FOUND"
      });
    }

    const rootCompanyId = await getRootCompanyId(companyId);

    if (!rootCompanyId) {
      return res.status(404).json({
        error: "Şirket bulunamadı",
        code: "COMPANY_NOT_FOUND"
      });
    }

    const [userCapacity, contractCapacity, companyCapacity] =
      await Promise.all([
        canAddUserToCompany(companyId),
        canAddContractToCompany(companyId),
        canAddCompanyToTree(companyId)
      ]);

    return res.json({
      companyId,
      rootCompanyId,
      hasActiveLicense: Boolean(userCapacity.license),
      planId: userCapacity.license ? userCapacity.license.plan_id : null,

      max_users:
        userCapacity.maxUsers !== undefined ? userCapacity.maxUsers : null,
      active_users: userCapacity.currentUsers || 0,
      remaining_users:
        userCapacity.remainingUsers !== undefined
          ? userCapacity.remainingUsers
          : null,

      max_contracts:
        contractCapacity.maxContracts !== undefined
          ? contractCapacity.maxContracts
          : null,
      used_contracts: contractCapacity.currentContracts || 0,
      remaining_contracts:
        contractCapacity.remainingContracts !== undefined
          ? contractCapacity.remainingContracts
          : null,

      max_companies:
        companyCapacity.maxCompanies !== undefined
          ? companyCapacity.maxCompanies
          : null,
      used_companies:
        companyCapacity.currentCompanies !== undefined
          ? companyCapacity.currentCompanies
          : null,
      remaining_companies:
        companyCapacity.remainingCompanies !== undefined
          ? companyCapacity.remainingCompanies
          : null
    });
  } catch (error) {
    console.error("GET /api/org/limits hatası:", error);
    return res.status(500).json({
      error: "Limitler hesaplanırken beklenmeyen bir hata oluştu"
    });
  }
});

/**
 * ============================================================
 * GET /api/org/companies
 * ============================================================
 *
 * /api/admin/companies'ten FARKI: requireStaffAccess değil,
 * requireAuth kullanır — yani ACCOUNTANT/CONTROLLER/VIEWER de
 * (yalnızca kendi accessScope'undaki şirketleri) görebilir.
 * ADMIN: global. ACCOUNTANT_MANAGER: kendi alt ağacı.
 * ACCOUNTANT/CONTROLLER/VIEWER: yalnızca kendi req.user.companyIds
 * (mevcut/eski davranışla birebir aynı — resolveAccessScope zaten
 * bunu garanti ediyor).
 */
router.get("/companies", async (req, res) => {
  try {
    const scope = await resolveAccessScope(req.user);

    const conditions = [];
    const params = [];

    if (!scope.isGlobalAdmin) {
      params.push(scope.allowedCompanyIds);
      conditions.push(`c.id = ANY($${params.length})`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await pool.query(
      `
        SELECT
          c.id,
          c.name,
          c.code,
          c.status,
          c.parent_company_id,
          c.created_at
        FROM companies c
        ${whereClause}
        ORDER BY c.created_at DESC
      `,
      params
    );

    return res.json({
      data: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        status: row.status,
        parentCompanyId: row.parent_company_id
          ? String(row.parent_company_id)
          : null,
        isRoot: row.parent_company_id === null,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error("GET /api/org/companies hatası:", error);
    return res.status(500).json({
      error: "Şirketler alınırken beklenmeyen bir hata oluştu"
    });
  }
});

/**
 * ============================================================
 * POST /api/org/companies
 * ============================================================
 *
 * admin.js POST /companies ile AYNI kural seti (kasıtlı olarak
 * yeniden yazılmadı, aynen uygulanıyor):
 *  - ADMIN: parent_company_id opsiyonel (boşsa yeni bağımsız ana
 *    şirket / yeni holding).
 *  - ACCOUNTANT_MANAGER: parent_company_id ZORUNLU ve kendi
 *    accessScope'unda olmalı — kendi ağacına child ekleyebilir,
 *    yeni bir root/bağımsız şirket OLUŞTURAMAZ.
 *  - max_companies enforcement, parent satırının FOR UPDATE ile
 *    kilitlenmesiyle race-safe şekilde uygulanır (aynı desen:
 *    services/license-service.js canAddCompanyToTree dosya başı
 *    notu).
 */
router.post("/companies", requireStaffAccess, async (req, res) => {
  try {
    const { name: rawName, code: rawCode, parent_company_id: rawParentCompanyId } =
      req.body || {};

    const name = typeof rawName === "string" ? rawName.trim() : "";
    const code = typeof rawCode === "string" ? rawCode.trim() : "";

    const parentCompanyId =
      rawParentCompanyId === undefined ||
      rawParentCompanyId === null ||
      rawParentCompanyId === ""
        ? null
        : String(rawParentCompanyId).trim();

    if (!name || name.length > 150) {
      return res.status(400).json({
        error: "name zorunludur ve 1-150 karakter olmalıdır"
      });
    }

    if (!code || code.length > 50) {
      return res.status(400).json({
        error: "code zorunludur ve 1-50 karakter olmalıdır"
      });
    }

    if (
      parentCompanyId !== null &&
      (parentCompanyId.length === 0 || parentCompanyId.length > 50)
    ) {
      return res.status(400).json({ error: "Invalid parent_company_id" });
    }

    if (!req.accessScope.isGlobalAdmin) {
      if (parentCompanyId === null) {
        return res.status(403).json({
          error:
            "ACCOUNTANT_MANAGER yalnızca kendi holding ağacına alt şirket ekleyebilir; parent_company_id zorunludur.",
          code: "PARENT_COMPANY_REQUIRED"
        });
      }

      if (!isCompanyInScope(parentCompanyId, req.accessScope)) {
        return res.status(403).json({
          error:
            "Bu şirketi üst şirket (parent) olarak gösterme yetkiniz bulunmamaktadır.",
          code: "COMPANY_ACCESS_DENIED"
        });
      }
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const existingCompany = await client.query(
        "SELECT id FROM companies WHERE code = $1",
        [code]
      );

      if (existingCompany.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "Company code already exists" });
      }

      if (parentCompanyId !== null) {
        // Race-safe: parent satırını kilitle (aynı transaction
        // içinde, max_companies sayımından ÖNCE) — bkz. license-
        // service.js canAddCompanyToTree dosya başı notu.
        const parentCheck = await client.query(
          "SELECT id FROM companies WHERE id = $1 FOR UPDATE",
          [parentCompanyId]
        );

        if (parentCheck.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            error: "parent_company_id references a company that does not exist"
          });
        }

        const capacity = await canAddCompanyToTree(parentCompanyId, client);

        if (!capacity.allowed) {
          await client.query("ROLLBACK");
          return res
            .status(capacity.reason === "NO_ACTIVE_LICENSE" ? 403 : 409)
            .json({
              error: capacity.message,
              code: capacity.reason,
              currentCompanies: capacity.currentCompanies,
              maxCompanies: capacity.maxCompanies
            });
        }
      }

      const newCompanyId = generateEntityId("COMP");

      const insertResult = await client.query(
        `INSERT INTO companies (id, name, code, parent_company_id)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, code, status, parent_company_id, created_at`,
        [newCompanyId, name, code, parentCompanyId]
      );

      const newCompany = insertResult.rows[0];

      await client.query(
        `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, old_value, new_value)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          generateEntityId("AUD"),
          String(req.user.id),
          "CREATE_COMPANY",
          "company",
          newCompany.id,
          null,
          JSON.stringify(newCompany)
        ]
      );

      await client.query("COMMIT");

      return res.status(201).json({
        data: {
          id: newCompany.id,
          name: newCompany.name,
          code: newCompany.code,
          status: newCompany.status,
          parentCompanyId: newCompany.parent_company_id
            ? String(newCompany.parent_company_id)
            : null,
          isRoot: newCompany.parent_company_id === null,
          createdAt: newCompany.created_at
        }
      });
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("POST /api/org/companies rollback hatası:", rollbackError);
      }

      if (error && error.code === "23505") {
        return res.status(409).json({ error: "Company code already exists" });
      }

      // P4 SERTLEŞTİRME — bkz. admin.js POST /companies'teki aynı not
      // (23514 = chk_companies_not_self_parent CHECK constraint).
      if (error && error.code === "23514") {
        return res.status(400).json({
          error: "Bir şirket kendi üst şirketi (parent) olamaz"
        });
      }

      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("POST /api/org/companies hatası:", error);
    return res.status(500).json({
      error: "Şirket oluşturulurken beklenmeyen bir hata oluştu"
    });
  }
});

/**
 * ============================================================
 * DELETE /api/org/companies/:id
 * ============================================================
 *
 * Spec (P3 madde 5): yalnızca ADMIN, sözleşmesi olan şirket
 * silinemez.
 *
 * TASARIM KARARI — FİZİKSEL DELETE: mevcut mimaride şirketler için
 * zaten bir soft-delete/status yaklaşımı var (PATCH /companies/:id/
 * status → ACTIVE/INACTIVE, bkz. admin.js). Bu endpoint onu
 * DEĞİŞTİRMİYOR/BOZMUYOR — ayrı, YENİ bir yetenek olarak ekleniyor
 * (spec DELETE /api/org/companies/:id'yi açıkça istiyor). status
 * kullanmak isteyen mevcut akışlar (PATCH .../status) hiç
 * dokunulmadan çalışmaya devam eder.
 *
 * ÖN KONTROLLER (DB seviyesindeki FK RESTRICT'lere ek, daha
 * anlaşılır hata mesajı için):
 *  1) contracts.company_id → RESTRICT (FK) zaten hard-block eder;
 *     burada proaktif kontrol edip 409 + COMPANY_HAS_CONTRACTS
 *     döndürüyoruz (spec'in istediği "sözleşmeli şirket silinemez"
 *     kuralı böylece backend'de garanti altında — DB constraint bu
 *     garantinin SON çizgisi, asıl kullanıcı dostu hata burada).
 *  2) companies.parent_company_id → RESTRICT (FK) alt şirketi olan
 *     bir şirketin silinmesini zaten engelliyor; aynı şekilde
 *     proaktif kontrol edip 409 + COMPANY_HAS_CHILDREN döndürüyoruz.
 *  3) company_licenses.company_id → RESTRICT (FK) — bu şirkete
 *     (kendi id'sine, ağacın köküne değil) doğrudan bağlı bir lisans
 *     satırı varsa DB seviyesinde engellenir; catch bloğunda 23503
 *     genel bir 409'a çevrilir (ayrı bir proaktif SELECT'e gerek
 *     yok, bu senaryo nadir ve genel fallback yeterli).
 *
 * user_companies.company_id → ON DELETE CASCADE (bilerek): şirket
 * silinince o şirkete atanmış kullanıcı-şirket ilişkisi de silinir
 * (kullanıcının KENDİSİ silinmez, yalnızca bu şirketle bağı kalkar)
 * — bu, mevcut şemanın P0'dan beri sahip olduğu davranış, P3'te
 * DEĞİŞTİRİLMEDİ.
 */
router.delete("/companies/:id", requireAdmin, async (req, res) => {
  try {
    const companyId = String(req.params.id || "").trim();

    if (!companyId) {
      return res.status(400).json({ error: "Invalid company id" });
    }

    const companyResult = await pool.query(
      "SELECT id FROM companies WHERE id = $1",
      [companyId]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: "Company not found" });
    }

    const contractCountResult = await pool.query(
      "SELECT COUNT(*)::INTEGER AS count FROM contracts WHERE company_id = $1",
      [companyId]
    );

    if (contractCountResult.rows[0].count > 0) {
      return res.status(409).json({
        error:
          "Bu şirketin sözleşmeleri olduğu için silinemez. Önce sözleşmeleri kaldırın veya taşıyın.",
        code: "COMPANY_HAS_CONTRACTS",
        contractCount: contractCountResult.rows[0].count
      });
    }

    const childCountResult = await pool.query(
      "SELECT COUNT(*)::INTEGER AS count FROM companies WHERE parent_company_id = $1",
      [companyId]
    );

    if (childCountResult.rows[0].count > 0) {
      return res.status(409).json({
        error:
          "Bu şirketin alt şirketleri olduğu için silinemez. Önce alt şirketleri taşıyın veya silin.",
        code: "COMPANY_HAS_CHILDREN",
        childCount: childCountResult.rows[0].count
      });
    }

    const deleteResult = await pool.query(
      "DELETE FROM companies WHERE id = $1 RETURNING id, name, code",
      [companyId]
    );

    if (deleteResult.rows.length === 0) {
      // Kontrol ile DELETE arasında başka bir istek şirketi zaten
      // sildi (race) — idempotent 404.
      return res.status(404).json({ error: "Company not found" });
    }

    const deletedCompany = deleteResult.rows[0];

    await pool.query(
      `INSERT INTO audit_events (id, actor, action, entity_type, entity_id, old_value, new_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        generateEntityId("AUD"),
        String(req.user.id),
        "DELETE_COMPANY",
        "company",
        deletedCompany.id,
        JSON.stringify(deletedCompany),
        null
      ]
    );

    return res.status(204).send();
  } catch (error) {
    // Yukarıdaki proaktif kontroller çoğu durumu yakalar; bu catch
    // yalnızca beklenmedik bir FK ihlali (ör. company_licenses satırı)
    // için son savunma hattıdır.
    if (error && error.code === "23503") {
      return res.status(409).json({
        error:
          "Bu şirket başka kayıtlarla (lisans, kullanıcı vb.) ilişkili olduğu için silinemedi.",
        code: "COMPANY_HAS_RELATED_RECORDS"
      });
    }

    console.error("DELETE /api/org/companies/:id hatası:", error);
    return res.status(500).json({
      error: "Şirket silinirken beklenmeyen bir hata oluştu"
    });
  }
});

module.exports = router;
