const express = require("express");
const pool = require("../db/pool");

const { requireAuth } = require("../middleware/auth");

const {
  requireCompanyLicense
} = require("../middleware/license");

const router = express.Router();


/**
 * ============================================================
 * AUTHENTICATION
 * ============================================================
 *
 * Bu router'daki bütün endpoint'ler JWT authentication
 * gerektirir.
 */
router.use(requireAuth);


/**
 * ============================================================
 * GET /api/contracts
 * ============================================================
 *
 * Kullanıcının bağlı olduğu şirketlerin kontratlarını getirir.
 *
 * ÖNEMLİ:
 * - companyIds JWT'den gelir.
 * - Client tarafından gönderilen companyIds kullanılmaz.
 * - DB seviyesinde company_id filtresi uygulanır.
 *
 * Aktif lisans kontrolü şirket bazlı olarak yapılır.
 */
router.get("/", async (req, res) => {

  try {

    if (
      !Array.isArray(req.user.companyIds) ||
      req.user.companyIds.length === 0
    ) {

      return res.status(403).json({
        error: "Kullanıcının erişebildiği şirket bulunmamaktadır",
        code: "NO_COMPANY_ACCESS"
      });

    }


    const result = await pool.query(
      `
        SELECT
          c.*
        FROM contracts c
        WHERE c.company_id = ANY($1)
          AND EXISTS (
            SELECT 1
            FROM company_licenses cl
            WHERE cl.company_id = c.company_id
              AND cl.status = 'active'
              AND cl.starts_at <= NOW()
              AND (
                cl.expires_at IS NULL
                OR cl.expires_at > NOW()
              )
          )
        ORDER BY c.created_at DESC
      `,
      [req.user.companyIds]
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
 * - Kullanıcı şirkete bağlı olmalı.
 * - Şirketin aktif lisansı olmalı.
 * - Başka şirketin kontratı 404 döner.
 */
router.get("/:id", async (req, res) => {

  try {

    const result = await pool.query(
      `
        SELECT
          c.*
        FROM contracts c
        WHERE c.id = $1
          AND c.company_id = ANY($2)
          AND EXISTS (
            SELECT 1
            FROM company_licenses cl
            WHERE cl.company_id = c.company_id
              AND cl.status = 'active'
              AND cl.starts_at <= NOW()
              AND (
                cl.expires_at IS NULL
                OR cl.expires_at > NOW()
              )
          )
        LIMIT 1
      `,
      [
        req.params.id,
        req.user.companyIds
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
        currency
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
            currency
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
            $9
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
          currency || "TRY"
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
        companyId
      } = req.body;


      /**
       * Önce kontratın sahibini buluyoruz.
       */
      const contractResult = await pool.query(
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
          req.user.companyIds
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
       * Aktif lisans kontrolü.
       */
      if (
        !req.user.companyIds
          .map(String)
          .includes(contractCompanyId)
      ) {

        return res.status(403).json({
          error:
            "Bu şirkete erişim yetkiniz bulunmamaktadır",
          code:
            "COMPANY_ACCESS_DENIED"
        });

      }


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
            updated_at = NOW()
          WHERE id = $9
            AND company_id = $10
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
  async (req, res) => {

    try {

      const contractResult = await pool.query(
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
          req.user.companyIds
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
