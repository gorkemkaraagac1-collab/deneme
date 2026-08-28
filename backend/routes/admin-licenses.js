const express = require("express");

const crypto = require("crypto");

const pool = require("../db/pool");

const {
  requireAdmin
} = require("../middleware/admin");

const {
  getActiveCompanyLicense,
  getCompanyUserCount
} = require("../services/license-service");

const router = express.Router();

/**
 * admin.js içindeki generateEntityId ile aynı mantık —
 * VARCHAR(50) şemasıyla uyumlu, id DEFAULT/SERIAL olmadığı için
 * burada da elle üretiliyor.
 */
function generateEntityId(prefix) {
  const suffix = crypto.randomBytes(8).toString("hex");
  return `${prefix}-${Date.now()}-${suffix}`.slice(0, 50);
}

/**
 * Lisans mutasyonlarını audit_events tablosuna yazar.
 *
 * ÖNEMLİ — DÜZELTME NOTU:
 * Bu dosyadaki hiçbir endpoint daha önce audit_events'e yazmıyordu;
 * admin.js'deki CREATE_USER/UPDATE_USER/CREATE_COMPANY loglanırken
 * CREATE_LICENSE/EXTEND_LICENSE/CANCEL_LICENSE hiç loglanmıyordu
 * (audit.html'deki filtre seçenekleri buna rağmen zaten vardı).
 * `db` parametresi, transaction içinde çağrıldığında aynı client'ı
 * (COMMIT'ten önce) kullanabilmek için eklendi.
 */
async function logLicenseAudit(
  db,
  {
    actor,
    action,
    entityId,
    oldValue,
    newValue
  }
) {
  await db.query(
    `INSERT INTO audit_events (
        id,
        actor,
        action,
        entity_type,
        entity_id,
        old_value,
        new_value
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      generateEntityId("AUD"),
      String(actor),
      action,
      "license",
      entityId,
      oldValue !== undefined ? JSON.stringify(oldValue) : null,
      newValue !== undefined ? JSON.stringify(newValue) : null
    ]
  );
}


/**
 * ============================================================
 * ADMIN LICENSE MANAGEMENT
 * ============================================================
 *
 * Tüm endpoint'ler ADMIN yetkisi gerektirir (bkz. middleware/admin.js).
 *
 * KAPSAM: ADMIN burada PLATFORM-LEVEL bir yöneticidir — sadece
 * kendi şirketiyle sınırlı değildir. Bu yüzden bu dosyadaki hiçbir
 * endpoint companyId'yi req.user.companyIds ile karşılaştırmaz;
 * ADMIN rolüne sahip herhangi bir kullanıcı :companyId parametresi
 * ile belirtilen HERHANGİ BİR şirketin lisansını görüntüleyebilir,
 * oluşturabilir, uzatabilir veya iptal edebilir. Bu, kasıtlı bir
 * tasarım kararıdır (detaylı gerekçe için middleware/admin.js'e
 * bakınız); şirket bazlı bir "company admin" rolü bu aşamada
 * bilinçli olarak oluşturulmamıştır.
 */


/**
 * ============================================================
 * 1. ŞİRKET LİSANS DURUMUNU GÖRÜNTÜLE
 * ============================================================
 *
 * GET
 * /api/admin/companies/:companyId/license
 */
router.get(
  "/companies/:companyId/license",
  requireAdmin,
  async (req, res) => {

    try {

      const {
        companyId
      } = req.params;


      /**
       * Şirket + kullanıcı sayısı.
       */
      const companyResult =
        await pool.query(
          `
            SELECT
              id,
              name
            FROM companies
            WHERE id = $1
          `,
          [companyId]
        );


      if (companyResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "Şirket bulunamadı"
        });
      }


      const company =
        companyResult.rows[0];


      const license =
        await getActiveCompanyLicense(
          companyId
        );


      const currentUsers =
        await getCompanyUserCount(
          companyId
        );


      /**
       * Aktif lisans varsa kullanıcı kapasitesi.
       */
      let remainingUsers = null;

      if (license) {

        if (license.max_users !== null) {

          remainingUsers =
            Math.max(
              Number(license.max_users) -
              currentUsers,
              0
            );
        }
      }


      return res.json({

        company: {
          id:
            company.id,

          name:
            company.name
        },

        license: license
          ? {
              id:
                license.id,

              planId:
                license.plan_id,

              planName:
                license.plan_name,

              maxUsers:
                license.max_users,

              description:
                license.description,

              startsAt:
                license.starts_at,

              expiresAt:
                license.expires_at,

              status:
                license.status
            }
          : null,

        currentUsers,

        remainingUsers,

        hasActiveLicense:
          Boolean(license)
      });

    } catch (error) {

      console.error(
        "Admin license görüntüleme hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Lisans bilgileri alınırken bir hata oluştu"
      });
    }
  }
);


/**
 * ============================================================
 * 2. ŞİRKETE PLAN ATA / LİSANS OLUŞTUR
 * ============================================================
 *
 * POST
 * /api/admin/companies/:companyId/license
 *
 * Body:
 *
 * {
 *   "planId": "professional",
 *   "startsAt": "2026-08-23",
 *   "expiresAt": "2027-08-23"
 * }
 *
 * expiresAt = null => süresiz
 */
router.post(
  "/companies/:companyId/license",
  requireAdmin,
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const {
        companyId
      } = req.params;

      const {
        planId,
        startsAt,
        expiresAt
      } = req.body;


      if (!planId) {

        return res.status(400).json({
          error:
            "planId zorunludur"
        });
      }


      /**
       * Transaction.
       */
      await client.query(
        "BEGIN"
      );


      /**
       * Şirketi kilitle.
       *
       * Aynı anda iki admin lisans değiştirirse
       * race condition oluşmasını önler.
       */
      const companyResult =
        await client.query(
          `
            SELECT
              id,
              name
            FROM companies
            WHERE id = $1
            FOR UPDATE
          `,
          [companyId]
        );


      if (companyResult.rows.length === 0) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Şirket bulunamadı"
        });
      }


      /**
       * Planın gerçekten mevcut olduğunu kontrol et.
       */
      const planResult =
        await client.query(
          `
            SELECT
              id,
              name,
              max_users,
              description
            FROM plans
            WHERE id = $1
          `,
          [planId]
        );


      if (planResult.rows.length === 0) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Belirtilen plan bulunamadı"
        });
      }


      const plan =
        planResult.rows[0];


      /**
       * Tarihleri normalize et.
       */
      const startDate =
        startsAt
          ? new Date(startsAt)
          : new Date();


      if (Number.isNaN(startDate.getTime())) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          error:
            "Geçersiz startsAt tarihi"
        });
      }


      let endDate = null;


      if (expiresAt !== null &&
          expiresAt !== undefined &&
          expiresAt !== "") {

        endDate =
          new Date(expiresAt);


        if (Number.isNaN(
          endDate.getTime()
        )) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Geçersiz expiresAt tarihi"
          });
        }


        if (endDate <= startDate) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "expiresAt, startsAt tarihinden sonra olmalıdır"
          });
        }
      }


      /**
       * Aynı şirketin mevcut aktif lisansını
       * iptal ediyoruz.
       *
       * Böylece aynı anda iki aktif lisans
       * bulunmasını engelliyoruz.
       */
      await client.query(
        `
          UPDATE company_licenses
          SET status = 'cancelled'
          WHERE company_id = $1
            AND status = 'active'
        `,
        [companyId]
      );


      /**
       * Yeni lisans.
       */
      const licenseResult =
        await client.query(
          `
            INSERT INTO company_licenses (
              company_id,
              plan_id,
              starts_at,
              expires_at,
              status
            )
            VALUES (
              $1,
              $2,
              $3,
              $4,
              'active'
            )
            RETURNING
              id,
              company_id,
              plan_id,
              starts_at,
              expires_at,
              status,
              created_at
          `,
          [
            companyId,
            planId,
            startDate,
            endDate
          ]
        );


      const license =
        licenseResult.rows[0];


      await logLicenseAudit(client, {
        actor: req.user.id,
        action: "CREATE_LICENSE",
        entityId: license.id,
        oldValue: null,
        newValue: {
          company_id: license.company_id,
          plan_id: license.plan_id,
          starts_at: license.starts_at,
          expires_at: license.expires_at,
          status: license.status
        }
      });


      await client.query(
        "COMMIT"
      );


      return res.status(201).json({

        message:
          "Şirket lisansı başarıyla oluşturuldu",

        license: {
          ...license,

          planName:
            plan.name,

          maxUsers:
            plan.max_users,

          description:
            plan.description
        }

      });

    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}

      console.error(
        "Admin lisans oluşturma hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Şirket lisansı oluşturulurken bir hata oluştu"
      });

    } finally {

      client.release();
    }
  }
);


/**
 * ============================================================
 * 3. LİSANS SÜRESİNİ UZAT
 * ============================================================
 *
 * PATCH
 * /api/admin/licenses/:licenseId/extend
 *
 * Body:
 *
 * {
 *   "expiresAt": "2027-12-31"
 * }
 *
 * veya:
 *
 * {
 *   "additionalMonths": 12
 * }
 */
router.patch(
  "/licenses/:licenseId/extend",
  requireAdmin,
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      const {
        licenseId
      } = req.params;

      const {
        expiresAt,
        additionalMonths
      } = req.body;


      if (
        !expiresAt &&
        !additionalMonths
      ) {

        return res.status(400).json({
          error:
            "expiresAt veya additionalMonths belirtilmelidir"
        });
      }


      await client.query(
        "BEGIN"
      );


      /**
       * Lisansı kilitle.
       */
      const licenseResult =
        await client.query(
          `
            SELECT
              id,
              company_id,
              starts_at,
              expires_at,
              status
            FROM company_licenses
            WHERE id = $1
            FOR UPDATE
          `,
          [licenseId]
        );


      if (licenseResult.rows.length === 0) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          error:
            "Lisans bulunamadı"
        });
      }


      const license =
        licenseResult.rows[0];


      if (
        license.status ===
        "cancelled"
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          error:
            "İptal edilmiş lisans uzatılamaz"
        });
      }


      let newExpiry;


      /**
       * Doğrudan tarih verilmişse.
       */
      if (expiresAt) {

        newExpiry =
          new Date(expiresAt);


        if (Number.isNaN(
          newExpiry.getTime()
        )) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "Geçersiz expiresAt tarihi"
          });
        }

      } else {

        const months =
          Number(additionalMonths);


        if (
          !Number.isInteger(months) ||
          months <= 0 ||
          months > 120
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(400).json({
            error:
              "additionalMonths 1 ile 120 arasında tam sayı olmalıdır"
          });
        }


        /**
         * Mevcut expiry yoksa:
         *
         * bugün + ay
         *
         * Mevcut expiry varsa:
         *
         * mevcut expiry + ay
         */
        const baseDate =
          license.expires_at
            ? new Date(
                license.expires_at
              )
            : new Date();


        newExpiry =
          new Date(baseDate);

        newExpiry.setMonth(
          newExpiry.getMonth() +
          months
        );
      }


      /**
       * Expiry başlangıçtan önce olamaz.
       */
      if (
        newExpiry <=
        new Date(license.starts_at)
      ) {

        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          error:
            "Yeni bitiş tarihi lisans başlangıç tarihinden sonra olmalıdır"
        });
      }


      const updateResult =
        await client.query(
          `
            UPDATE company_licenses
            SET
              expires_at = $1,
              status = 'active'
            WHERE id = $2
            RETURNING
              id,
              company_id,
              plan_id,
              starts_at,
              expires_at,
              status,
              created_at
          `,
          [
            newExpiry,
            licenseId
          ]
        );


      const updatedLicense =
        updateResult.rows[0];


      await logLicenseAudit(client, {
        actor: req.user.id,
        action: "EXTEND_LICENSE",
        entityId: licenseId,
        oldValue: {
          expires_at: license.expires_at,
          status: license.status
        },
        newValue: {
          expires_at: updatedLicense.expires_at,
          status: updatedLicense.status
        }
      });


      await client.query(
        "COMMIT"
      );


      return res.json({

        message:
          "Lisans süresi başarıyla uzatıldı",

        license:
          updatedLicense

      });

    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (_) {}

      console.error(
        "Lisans uzatma hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Lisans süresi uzatılırken bir hata oluştu"
      });

    } finally {

      client.release();
    }
  }
);


/**
 * ============================================================
 * 4. LİSANSI İPTAL ET
 * ============================================================
 *
 * POST
 * /api/admin/licenses/:licenseId/cancel
 */
router.post(
  "/licenses/:licenseId/cancel",
  requireAdmin,
  async (req, res) => {

    try {

      const {
        licenseId
      } = req.params;


      const priorResult =
        await pool.query(
          `SELECT status FROM company_licenses WHERE id = $1`,
          [licenseId]
        );

      const priorStatus =
        priorResult.rows[0]
          ? priorResult.rows[0].status
          : null;


      const result =
        await pool.query(
          `
            UPDATE company_licenses
            SET status = 'cancelled'
            WHERE id = $1
              AND status <> 'cancelled'
            RETURNING
              id,
              company_id,
              plan_id,
              starts_at,
              expires_at,
              status,
              created_at
          `,
          [licenseId]
        );


      if (result.rows.length === 0) {

        return res.status(404).json({
          error:
            "Aktif lisans bulunamadı veya lisans zaten iptal edilmiş"
        });
      }


      const cancelledLicense =
        result.rows[0];


      await logLicenseAudit(pool, {
        actor: req.user.id,
        action: "CANCEL_LICENSE",
        entityId: licenseId,
        oldValue: {
          status: priorStatus
        },
        newValue: {
          status: cancelledLicense.status
        }
      });


      return res.json({

        message:
          "Lisans başarıyla iptal edildi",

        license:
          cancelledLicense

      });

    } catch (error) {

      console.error(
        "Lisans iptal hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Lisans iptal edilirken bir hata oluştu"
      });
    }
  }
);


/**
 * ============================================================
 * 5. PLANLARI LİSTELE
 * ============================================================
 *
 * Admin panelinin planları dinamik olarak göstermesi için.
 *
 * GET
 * /api/admin/plans
 */
router.get(
  "/plans",
  requireAdmin,
  async (req, res) => {

    try {

      const result =
        await pool.query(
          `
            SELECT
              id,
              name,
              max_users,
              max_contracts,
              description,
              created_at
            FROM plans
            ORDER BY
              created_at ASC,
              id ASC
          `
        );


      return res.json({
        plans:
          result.rows
      });

    } catch (error) {

      console.error(
        "Plan listesi hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Planlar alınırken bir hata oluştu"
      });
    }
  }
);


/**
 * ============================================================
 * 6. PLAN GÜNCELLE
 * ============================================================
 *
 * Admin panelinden bir planın kullanıcı/sözleşme limitlerini ve
 * açıklamasını düzenlemek için. Plan adı (id) ve isim (name)
 * kasıtlı olarak DEĞİŞTİRİLEMEZ — id, company_licenses.plan_id
 * tarafından referans alınıyor ve PLAN_LEVELS (starter/
 * professional/enterprise sıralaması) kod içinde bu id'lere göre
 * sabitlenmiş (bkz. license-service.js, middleware/license.js,
 * routes/auth.js). Sadece limitler ve açıklama değişebilir.
 *
 * PATCH
 * /api/admin/plans/:id
 *
 * Body:
 * {
 *   maxUsers: number | null,
 *   maxContracts: number | null,
 *   description: string
 * }
 */
router.patch(
  "/plans/:id",
  requireAdmin,
  async (req, res) => {

    const { id } = req.params;

    const {
      maxUsers,
      maxContracts,
      description
    } = req.body;


    /**
     * INPUT VALIDATION
     *
     * null => sınırsız (izinli). Sayı ise pozitif tam sayı olmalı.
     * undefined => bu alan güncellenmiyor (mevcut değer korunur).
     */
    function isValidLimit(value) {
      return (
        value === null ||
        value === undefined ||
        (
          Number.isInteger(value) &&
          value > 0
        )
      );
    }

    if (
      !isValidLimit(maxUsers) ||
      !isValidLimit(maxContracts)
    ) {
      return res.status(400).json({
        error:
          "maxUsers ve maxContracts null (sınırsız) veya pozitif bir tam sayı olmalıdır"
      });
    }

    if (
      description !== undefined &&
      typeof description !== "string"
    ) {
      return res.status(400).json({
        error:
          "description bir metin olmalıdır"
      });
    }


    try {

      const existingResult =
        await pool.query(
          `
            SELECT
              id,
              name,
              max_users,
              max_contracts,
              description
            FROM plans
            WHERE id = $1
          `,
          [id]
        );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          error:
            "Belirtilen plan bulunamadı"
        });
      }

      const existing =
        existingResult.rows[0];


      const nextMaxUsers =
        maxUsers !== undefined
          ? maxUsers
          : existing.max_users;

      const nextMaxContracts =
        maxContracts !== undefined
          ? maxContracts
          : existing.max_contracts;

      const nextDescription =
        description !== undefined
          ? description
          : existing.description;


      const updateResult =
        await pool.query(
          `
            UPDATE plans
            SET
              max_users = $1,
              max_contracts = $2,
              description = $3
            WHERE id = $4
            RETURNING
              id,
              name,
              max_users,
              max_contracts,
              description,
              created_at
          `,
          [
            nextMaxUsers,
            nextMaxContracts,
            nextDescription,
            id
          ]
        );


      await logLicenseAudit(
        pool,
        {
          actor: req.user.id,
          action: "UPDATE_PLAN",
          entityId: id,
          oldValue: existing,
          newValue: updateResult.rows[0]
        }
      );


      return res.json(
        updateResult.rows[0]
      );

    } catch (error) {

      console.error(
        "Plan güncelleme hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Plan güncellenirken bir hata oluştu"
      });
    }
  }
);


module.exports = router;
