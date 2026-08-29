const express = require("express");
const pool = require("../db/pool");

const { requireAuth } = require("../middleware/auth");

const {
  requireCompanyLicense
} = require("../middleware/license");

const {
  canAddContractToCompany
} = require("../services/license-service");

const {
  resolveAccessScope,
  isCompanyInScope,
  isContractWriteRole
} = require("../services/organization-service");

const router = express.Router();


/**
 * ============================================================
 * AUTHENTICATION + ACCESS SCOPE
 * ============================================================
 *
 * Bu router'daki bütün endpoint'ler JWT authentication
 * gerektirir.
 *
 * P1: erişim artık yalnızca JWT'deki ham companyIds ile değil,
 * role'e göre hesaplanan ERİŞİM KAPSAMI (access scope) ile
 * belirlenir:
 *   - ADMIN               → global (tüm şirketlerin kontratları)
 *   - ACCOUNTANT_MANAGER  → kendi holding alt ağacı
 *   - ACCOUNTANT/CONTROLLER/VIEWER
 *                         → ESKİ davranışla birebir aynı
 *                           (req.user.companyIds)
 *
 * req.accessScope her istekte burada hesaplanıp sonraki tüm route
 * handler'larına aktarılır (bkz. services/organization-service.js).
 */
router.use(requireAuth);

router.use(async (req, res, next) => {
  try {
    req.accessScope = await resolveAccessScope(req.user);
    return next();
  } catch (error) {
    console.error(
      "contracts.js erişim kapsamı hesaplama hatası:",
      error
    );
    return res.status(500).json({
      error: "Yetki kapsamı hesaplanırken beklenmeyen bir hata oluştu"
    });
  }
});


/**
 * P1-B: CONTROLLER (izleme/raporlama, yazma yetkisi yok) ve VIEWER
 * (salt okunur) sözleşme oluşturamaz/güncelleyemez/silemez. Bu
 * middleware yalnızca POST/PUT/DELETE route'larına eklenir — GET
 * route'ları tüm rollere (okuma yetkisi olan herkese) açıktır.
 */
function requireContractWriteRole(req, res, next) {
  if (!isContractWriteRole(req.user.role)) {
    return res.status(403).json({
      error: "Bu işlem için yazma yetkiniz bulunmamaktadır",
      code: "CONTRACT_WRITE_ACCESS_DENIED"
    });
  }
  return next();
}


/**
 * ============================================================
 * GET /api/contracts
 * ============================================================
 *
 * Kullanıcının erişim kapsamındaki (bkz. yukarı — accessScope)
 * şirketlerin kontratlarını getirir.
 *
 * ÖNEMLİ:
 * - companyIds/erişim kapsamı JWT + role'den hesaplanır.
 * - Client tarafından gönderilen hiçbir company_id/companyIds
 *   değerine güvenilmez (bu endpoint zaten query/body'den company
 *   id almıyor).
 *
 * P1 — "License expired: read = OK, write = 403": bu endpoint bir
 * OKUMA (read) endpoint'idir, bu yüzden BURADA lisans durumuna
 * BAKILMAZ — süresi dolmuş/pasif lisanslı bir şirketin kontratları
 * da listelenir (yazma endpoint'lerinde — POST/PUT/DELETE — lisans
 * hâlâ zorunludur). Önceki sürümde burada bir aktif-lisans EXISTS
 * kontrolü vardı; bu, süresi dolan bir şirketin kontratlarının
 * OKUNMASINI da tamamen engelliyordu — kabul kriterine aykırıydı,
 * kaldırıldı.
 */
router.get("/", async (req, res) => {

  try {

    const scope = req.accessScope;

    if (!scope.isGlobalAdmin && (!Array.isArray(scope.allowedCompanyIds) || scope.allowedCompanyIds.length === 0)) {

      return res.status(403).json({
        error: "Kullanıcının erişebildiği şirket bulunmamaktadır",
        code: "NO_COMPANY_ACCESS"
      });

    }


    const result = scope.isGlobalAdmin
      ? await pool.query(
          `
            SELECT
              c.*
            FROM contracts c
            ORDER BY c.created_at DESC
          `
        )
      : await pool.query(
          `
            SELECT
              c.*
            FROM contracts c
            WHERE c.company_id = ANY($1)
            ORDER BY c.created_at DESC
          `,
          [scope.allowedCompanyIds]
        );


    return res.json(result.rows);

  } catch (error) {

    console.error(
      "GET /api/contracts hatası:",
      error
    );

    return res.status(500).json({
      error: "Kontratlar alınırken beklenmeyen bir hata oluştu"
    });

  }

});


/**
 * ============================================================
 * GET /api/contracts/:id
 * ============================================================
 *
 * Tek kontrat getirir.
 *
 * Güvenlik:
 * - Kullanıcının erişim kapsamında olmalı (ADMIN: global,
 *   ACCOUNTANT_MANAGER: kendi holding alt ağacı, diğerleri: kendi
 *   şirketleri).
 * - Başka şirketin kontratı 404 döner.
 *
 * P1: bu da bir OKUMA endpoint'i olduğundan aktif lisans şartı
 * ARANMAZ (bkz. GET / üzerindeki not — "License expired: read=OK").
 */
router.get("/:id", async (req, res) => {

  try {

    const scope = req.accessScope;

    const result = scope.isGlobalAdmin
      ? await pool.query(
          `
            SELECT
              c.*
            FROM contracts c
            WHERE c.id = $1
            LIMIT 1
          `,
          [req.params.id]
        )
      : await pool.query(
          `
            SELECT
              c.*
            FROM contracts c
            WHERE c.id = $1
              AND c.company_id = ANY($2)
            LIMIT 1
          `,
          [
            req.params.id,
            scope.allowedCompanyIds
          ]
        );


    if (result.rows.length === 0) {

      return res.status(404).json({
        error: "Contract not found"
      });

    }


    return res.json(result.rows[0]);

  } catch (error) {

    console.error(
      "GET /api/contracts/:id hatası:",
      error
    );

    return res.status(500).json({
      error: "Kontrat alınırken beklenmeyen bir hata oluştu"
    });

  }

});


/**
 * ============================================================
 * POST /api/contracts
 * ============================================================
 *
 * Yeni kontrat oluşturur.
 *
 * companyId:
 * - body'den alınabilir
 * - fakat JWT companyIds ile mutlaka doğrulanır
 * - ardından aktif şirket lisansı kontrol edilir
 */
router.post(
  "/",
  requireContractWriteRole,
  requireCompanyLicense,
  async (req, res) => {

    try {

      const {
        id,
        companyId,
        company,
        supplier,
        monthlyPayment,
        startDate,
        endDate,
        discountRate,
        currency,
        details
      } = req.body;


      /**
       * requireCompanyLicense tarafından doğrulanmış
       * companyId kullanılır.
       */
      const authorizedCompanyId =
        req.companyId;


      if (
        !id ||
        !companyId ||
        !company ||
        !supplier ||
        !startDate ||
        !endDate
      ) {

        return res.status(400).json({
          error:
            "id, companyId, company, supplier, startDate, endDate zorunludur"
        });

      }


      /**
       * Client'ın body içindeki companyId'si ile
       * middleware'in doğruladığı companyId aynı olmalı.
       */
      if (
        String(companyId) !==
        String(authorizedCompanyId)
      ) {

        return res.status(403).json({
          error:
            "Geçersiz şirket erişimi",
          code:
            "COMPANY_ACCESS_DENIED"
        });

      }


      /**
       * DÜZELTME: Planların max_users ile aynı şekilde bir
       * max_contracts (sözleşme) limiti var artık, ama daha önce
       * hiçbir yerde kontrol edilmiyordu — Starter planındaki bir
       * şirket de Enterprise ile aynı sayıda sözleşme
       * girebiliyordu. requireCompanyLicense zaten aktif lisansı
       * doğruladı; burada ayrıca o lisansın sözleşme limitine
       * ulaşılıp ulaşılmadığına bakılıyor.
       */
      const contractLimitCheck =
        await canAddContractToCompany(
          authorizedCompanyId
        );

      if (!contractLimitCheck.allowed) {

        return res.status(403).json({
          error:
            contractLimitCheck.message ||
            "Şirket sözleşme limitine ulaşmıştır.",
          code:
            contractLimitCheck.reason,
          currentContracts:
            contractLimitCheck.currentContracts,
          maxContracts:
            contractLimitCheck.maxContracts
        });

      }


      const result = await pool.query(
        `
          INSERT INTO contracts (
            id,
            company_id,
            company,
            supplier,
            monthly_payment,
            start_date,
            end_date,
            discount_rate,
            currency,
            details
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10
          )
          RETURNING *
        `,
        [
          id,
          authorizedCompanyId,
          company,
          supplier,
          monthlyPayment,
          startDate,
          endDate,
          discountRate || 0,
          currency || "TRY",
          JSON.stringify(details && typeof details === "object" ? details : {})
        ]
      );


      return res.status(201).json(
        result.rows[0]
      );

    } catch (error) {

      console.error(
        "POST /api/contracts hatası:",
        error
      );


      if (error.code === "23505") {

        return res.status(409).json({
          error:
            `Contract already exists: ${req.body.id}`
        });

      }


      return res.status(500).json({
        error:
          "Kontrat oluşturulurken beklenmeyen bir hata oluştu"
      });

    }

  }
);


/**
 * ============================================================
 * PUT /api/contracts/:id
 * ============================================================
 *
 * Güncelleme yalnızca:
 *
 * JWT companyIds
 * +
 * aktif lisans
 *
 * kapsamında yapılabilir.
 */
router.put(
  "/:id",
  requireContractWriteRole,
  async (req, res) => {

    try {

      const {
        company,
        supplier,
        monthlyPayment,
        startDate,
        endDate,
        discountRate,
        currency,
        status,
        companyId,
        details
      } = req.body;


      const scope = req.accessScope;

      /**
       * Önce kontratın sahibini buluyoruz — erişim kapsamı
       * dışındaki bir kontrat için "var olduğu" bile sızdırılmaz
       * (404).
       */
      const contractResult = scope.isGlobalAdmin
        ? await pool.query(
            `
              SELECT
                company_id
              FROM contracts
              WHERE id = $1
              LIMIT 1
            `,
            [req.params.id]
          )
        : await pool.query(
            `
              SELECT
                company_id
              FROM contracts
              WHERE id = $1
                AND company_id = ANY($2)
              LIMIT 1
            `,
            [
              req.params.id,
              scope.allowedCompanyIds
            ]
          );


      if (
        contractResult.rows.length === 0
      ) {

        return res.status(404).json({
          error: "Contract not found"
        });

      }


      const contractCompanyId =
        String(
          contractResult.rows[0].company_id
        );


      /**
       * P1: erişim kontrolü artık accessScope üzerinden yapılır
       * (ADMIN: global, ACCOUNTANT_MANAGER: kendi holding alt
       * ağacı, diğerleri: req.user.companyIds ile birebir aynı).
       * SELECT sorgusu zaten scope'a göre filtrelendiği için bu
       * ikinci kontrol normalde hep true döner — savunma amaçlı
       * (defense in depth) korunuyor.
       */
      if (!isCompanyInScope(contractCompanyId, scope)) {

        return res.status(403).json({
          error:
            "Bu şirkete erişim yetkiniz bulunmamaktadır",
          code:
            "COMPANY_ACCESS_DENIED"
        });

      }


      /**
       * Aktif lisans kontrolü — bu bir YAZMA (write) işlemi
       * olduğundan lisans şartı burada AYNEN KORUNUR ("License
       * expired: write = 403" — yalnızca GET'lerden kaldırıldı).
       */
      const licenseResult =
        await pool.query(
          `
            SELECT 1
            FROM company_licenses
            WHERE company_id = $1
              AND status = 'active'
              AND starts_at <= NOW()
              AND (
                expires_at IS NULL
                OR expires_at > NOW()
              )
            LIMIT 1
          `,
          [contractCompanyId]
        );


      if (
        licenseResult.rows.length === 0
      ) {

        return res.status(403).json({
          error:
            "Şirketin aktif lisansı bulunmamaktadır",
          code:
            "COMPANY_LICENSE_INACTIVE"
        });

      }


      /**
       * companyId client tarafından değiştirilmek
       * istenirse kontratın şirketi değiştirilemez.
       */
      if (
        companyId !== undefined &&
        String(companyId) !== contractCompanyId
      ) {

        return res.status(403).json({
          error:
            "Kontratın şirketi değiştirilemez",
          code:
            "COMPANY_CHANGE_NOT_ALLOWED"
        });

      }


      const result = await pool.query(
        `
          UPDATE contracts
          SET
            company = COALESCE($1, company),
            supplier = COALESCE($2, supplier),
            monthly_payment = COALESCE($3, monthly_payment),
            start_date = COALESCE($4, start_date),
            end_date = COALESCE($5, end_date),
            discount_rate = COALESCE($6, discount_rate),
            currency = COALESCE($7, currency),
            status = COALESCE($8, status),
            details = COALESCE($9, details),
            updated_at = NOW()
          WHERE id = $10
            AND company_id = $11
          RETURNING *
        `,
        [
          company,
          supplier,
          monthlyPayment,
          startDate,
          endDate,
          discountRate,
          currency,
          status,
          /**
           * DÜZELTME (birlikte): details client tarafından
           * gönderilmediyse (undefined) mevcut satırdaki değeri
           * KORUYORUZ (COALESCE ile null geçip eski değeri bırakıyoruz).
           * pg, JS 'undefined' parametresini kabul etmediği için
           * null'a çeviriyoruz — COALESCE($9, details) null'ı da
           * "değiştirme" olarak yorumlar.
           */
          details !== undefined && details !== null
            ? JSON.stringify(details)
            : null,
          req.params.id,
          contractCompanyId
        ]
      );


      return res.json(
        result.rows[0]
      );

    } catch (error) {

      console.error(
        "PUT /api/contracts/:id hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Kontrat güncellenirken beklenmeyen bir hata oluştu"
      });

    }

  }
);


/**
 * ============================================================
 * DELETE /api/contracts/:id
 * ============================================================
 *
 * Silme işlemi:
 * - kullanıcı şirketine ait olmalı
 * - aktif lisans bulunmalı
 */
router.delete(
  "/:id",
  requireContractWriteRole,
  async (req, res) => {

    try {

      const scope = req.accessScope;

      const contractResult = scope.isGlobalAdmin
        ? await pool.query(
            `
              SELECT
                company_id
              FROM contracts
              WHERE id = $1
              LIMIT 1
            `,
            [req.params.id]
          )
        : await pool.query(
            `
              SELECT
                company_id
              FROM contracts
              WHERE id = $1
                AND company_id = ANY($2)
              LIMIT 1
            `,
            [
              req.params.id,
              scope.allowedCompanyIds
            ]
          );


      if (
        contractResult.rows.length === 0
      ) {

        return res.status(404).json({
          error: "Contract not found"
        });

      }


      const companyId =
        String(
          contractResult.rows[0].company_id
        );


      const licenseResult =
        await pool.query(
          `
            SELECT 1
            FROM company_licenses
            WHERE company_id = $1
              AND status = 'active'
              AND starts_at <= NOW()
              AND (
                expires_at IS NULL
                OR expires_at > NOW()
              )
            LIMIT 1
          `,
          [companyId]
        );


      if (
        licenseResult.rows.length === 0
      ) {

        return res.status(403).json({
          error:
            "Şirketin aktif lisansı bulunmamaktadır",
          code:
            "COMPANY_LICENSE_INACTIVE"
        });

      }


      const result = await pool.query(
        `
          DELETE FROM contracts
          WHERE id = $1
            AND company_id = $2
          RETURNING id
        `,
        [
          req.params.id,
          companyId
        ]
      );


      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({
          error: "Contract not found"
        });

      }


      return res.status(204).send();

    } catch (error) {

      console.error(
        "DELETE /api/contracts/:id hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Kontrat silinirken beklenmeyen bir hata oluştu"
      });

    }

  }
);


module.exports = router;
