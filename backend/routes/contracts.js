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
 * Bu router'daki bütün endpoint'ler JWT doğrulamasından geçer.
 */
router.use(requireAuth);


/**
 * ============================================================
 * GET ALL CONTRACTS
 * ============================================================
 *
 * Kullanıcının:
 *
 * 1. JWT'de bağlı olduğu
 * 2. Aktif lisansı bulunan
 *
 * şirketlerin kontratlarını döndürür.
 *
 * Şirket erişimi DB seviyesinde ANY($1) ile uygulanır.
 */
router.get("/", async (req, res) => {

  try {

    const result = await pool.query(
      `
        SELECT *
        FROM contracts
        WHERE company_id = ANY($1)
          AND EXISTS (
            SELECT 1
            FROM company_licenses cl
            WHERE cl.company_id = contracts.company_id
              AND cl.status = 'active'
              AND cl.starts_at <= NOW()
              AND (
                cl.expires_at IS NULL
                OR cl.expires_at > NOW()
              )
          )
        ORDER BY created_at DESC
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
 * GET SINGLE CONTRACT
 * ============================================================
 *
 * Önce kullanıcı şirket erişimi + aktif lisans kontrolünden geçer.
 *
 * Sonrasında DB seviyesinde:
 *
 * id + company_id
 *
 * birlikte kontrol edilir.
 */
router.get(
  "/:id",
  async (req, res) => {

    try {

      const result = await pool.query(
        `
          SELECT *
          FROM contracts
          WHERE id = $1
            AND company_id = ANY($2)
            AND EXISTS (
              SELECT 1
              FROM company_licenses cl
              WHERE cl.company_id = contracts.company_id
                AND cl.status = 'active'
                AND cl.starts_at <= NOW()
                AND (
                  cl.expires_at IS NULL
                  OR cl.expires_at > NOW()
                )
            )
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

  }
);


/**
 * ============================================================
 * CREATE CONTRACT
 * ============================================================
 *
 * companyId:
 *
 * - Client tarafından gönderilebilir
 * - ancak hiçbir zaman güvenilmez
 * - requireCompanyLicense tarafından doğrulanır
 *
 * Middleware:
 *
 * requireAuth
 *      ↓
 * requireCompanyLicense
 *      ↓
 * controller
 */
router.post(
  "/",
  async (req, res, next) => {

    try {

      const companyId =
        req.body.companyId;

      if (!companyId) {

        return res.status(400).json({
          error: "companyId belirtilmelidir"
        });

      }

      /**
       * requireCompanyLicense için
       * companyId'yi request context'e taşıyoruz.
       */
      req.body.companyId =
        String(companyId);

      return requireCompanyLicense(
        req,
        res,
        next
      );

    } catch (error) {

      console.error(
        "Contract company license middleware hatası:",
        error
      );

      return res.status(500).json({
        error: "Şirket lisansı kontrol edilemedi"
      });

    }

  },
  async (req, res) => {

    try {

      const {
        id,
        company,
        supplier,
        monthlyPayment,
        startDate,
        endDate,
        discountRate,
        currency
      } = req.body;

      const companyId =
        req.companyId;

      if (
        !id ||
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

      const result =
        await pool.query(
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
            companyId,
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
 * UPDATE CONTRACT
 * ============================================================
 */
router.put(
  "/:id",
  async (req, res, next) => {

    const companyId =
      req.body.companyId;

    if (!companyId) {

      /**
       * Update için companyId'nin body'den
       * zorunlu olmasını istemiyoruz.
       *
       * Önce mevcut kontrattan şirketi buluyoruz.
       */
      try {

        const lookup =
          await pool.query(
            `
              SELECT company_id
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

        if (lookup.rows.length === 0) {

          return res.status(404).json({
            error: "Contract not found"
          });

        }

        req.params.companyId =
          lookup.rows[0].company_id;

      } catch (error) {

        console.error(
          "Contract lookup hatası:",
          error
        );

        return res.status(500).json({
          error:
            "Kontrat doğrulanırken beklenmeyen bir hata oluştu"
        });

      }

    } else {

      req.params.companyId =
        String(companyId);

    }

    return requireCompanyLicense(
      req,
      res,
      next
    );

  },
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
        status
      } = req.body;

      const result =
        await pool.query(
          `
            UPDATE contracts
            SET
              company =
                COALESCE($1, company),

              supplier =
                COALESCE($2, supplier),

              monthly_payment =
                COALESCE($3, monthly_payment),

              start_date =
                COALESCE($4, start_date),

              end_date =
                COALESCE($5, end_date),

              discount_rate =
                COALESCE($6, discount_rate),

              currency =
                COALESCE($7, currency),

              status =
                COALESCE($8, status),

              updated_at =
                NOW()

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
            req.companyId
          ]
        );

      if (result.rows.length === 0) {

        return res.status(404).json({
          error: "Contract not found"
        });

      }

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
 * DELETE CONTRACT
 * ============================================================
 */
router.delete(
  "/:id",
  async (req, res, next) => {

    try {

      const lookup =
        await pool.query(
          `
            SELECT company_id
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

      if (lookup.rows.length === 0) {

        return res.status(404).json({
          error: "Contract not found"
        });

      }

      req.params.companyId =
        lookup.rows[0].company_id;

      return requireCompanyLicense(
        req,
        res,
        next
      );

    } catch (error) {

      console.error(
        "DELETE contract lookup hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Kontrat doğrulanırken beklenmeyen bir hata oluştu"
      });

    }

  },
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
            DELETE FROM contracts
            WHERE id = $1
              AND company_id = $2
            RETURNING id
          `,
          [
            req.params.id,
            req.companyId
          ]
        );

      if (result.rows.length === 0) {

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
