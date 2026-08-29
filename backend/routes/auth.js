const express = require("express");
const bcrypt = require("bcryptjs");

const pool = require("../db/pool");

const { signUserToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/rate-limit");

const {
  canAddUserToCompany,
  getUserLicenses
} = require("../services/license-service");

const router = express.Router();

const BCRYPT_ROUNDS = 12;

/**
 * ============================================================
 * BRUTE-FORCE / ABUSE PROTECTION
 * ============================================================
 *
 * /login username+password brute-force denemelerine karşı en
 * kritik endpoint'tir; IP başına sıkı bir limit uygulanır.
 * Kullanıcı adı bilinmeyen/hatalı parola denemelerinde bile
 * aynı jenerik hata döndüğü için (user enumeration önlenmiş
 * durumda), rate limiting brute-force'a karşı asıl savunma
 * hattıdır.
 *
 * /register zaten requireAuth + requireAdmin ile korunuyor
 * (yalnızca kimliği doğrulanmış bir ADMIN çağırabilir), yine de
 * ele geçirilmiş bir admin hesabının toplu kullanıcı oluşturarak
 * lisans limitlerini yoklamasını/abuse etmesini zorlaştırmak için
 * daha gevşek bir limit uygulanır.
 */
const loginRateLimiter = createRateLimiter({
  windowMs: Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX) || 10,
  keyGenerator: req =>
    `login:${req.ip}:${(req.body && req.body.username) || ""}`,
  message:
    "Çok fazla başarısız giriş denemesi. Lütfen daha sonra tekrar deneyin."
});

const registerRateLimiter = createRateLimiter({
  windowMs: Number(process.env.REGISTER_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.REGISTER_RATE_LIMIT_MAX) || 30,
  keyGenerator: req => `register:${req.ip}`,
  message:
    "Çok fazla kullanıcı oluşturma isteği. Lütfen daha sonra tekrar deneyin."
});


/**
 * ============================================================
 * AUTH HELPERS
 * ============================================================
 */


/**
 * Bir kullanıcının bağlı olduğu şirket ID'lerini getirir.
 */
async function getUserCompanyIds(userId, db = pool) {
  const result = await db.query(
    `
      SELECT company_id
      FROM user_companies
      WHERE user_id = $1
      ORDER BY company_id
    `,
    [userId]
  );

  return result.rows.map(row => row.company_id);
}


/**
 * Company ID listesini normalize eder.
 *
 * Aynı şirketin request içinde iki kez gönderilmesini engeller.
 */
function normalizeCompanyIds(companyIds) {
  if (!Array.isArray(companyIds)) {
    return [];
  }

  return [
    ...new Set(
      companyIds
        .filter(
          id =>
            id !== null &&
            id !== undefined
        )
        .map(id => String(id).trim())
        .filter(Boolean)
    )
  ];
}


/**
 * Kullanıcı oluşturulmadan önce şirketlerin gerçekten
 * mevcut olduğunu kontrol eder.
 *
 * Şirket satırlarını FOR UPDATE ile kilitler.
 *
 * Bu lock kullanıcı limitindeki race condition'ı
 * önlemek açısından kritiktir.
 */
async function lockCompaniesForUserCreation(
  client,
  companyIds
) {
  const sortedCompanyIds =
    [...companyIds].sort();

  const result = await client.query(
    `
      SELECT id
      FROM companies
      WHERE id = ANY($1::text[])
      ORDER BY id
      FOR UPDATE
    `,
    [sortedCompanyIds]
  );

  const foundCompanyIds =
    result.rows.map(
      row => String(row.id)
    );

  const missingCompanyIds =
    sortedCompanyIds.filter(
      companyId =>
        !foundCompanyIds.includes(
          companyId
        )
    );

  if (missingCompanyIds.length > 0) {
    const error = new Error(
      "Bir veya daha fazla şirket bulunamadı."
    );

    error.code =
      "COMPANY_NOT_FOUND";

    error.companyIds =
      missingCompanyIds;

    throw error;
  }

  return foundCompanyIds;
}


/**
 * ============================================================
 * POST /api/auth/register
 * ============================================================
 *
 * Yeni kullanıcı oluşturur.
 *
 * GÜVENLİK:
 *
 * - Authentication zorunludur.
 * - Sadece ADMIN kullanıcı oluşturabilir.
 * - ADMIN sadece kendi şirketlerine kullanıcı ekleyebilir.
 * - Client tarafından gönderilen role güvenilmez.
 * - Yeni kullanıcı default olarak VIEWER olur.
 *
 * Lisans:
 *
 * - Aktif lisans kontrol edilir.
 * - Kullanıcı limiti kontrol edilir.
 * - Şirketler transaction içerisinde kilitlenir.
 *
 * Tüm işlemler tek transaction içerisindedir.
 */
router.post(
  "/register",
  registerRateLimiter,
  requireAuth,
  async (req, res) => {

    const client =
      await pool.connect();

    try {

      /**
       * --------------------------------------------------------
       * AUTHORIZATION
       * --------------------------------------------------------
       */

      if (!req.user) {
        return res.status(401).json({
          error:
            "Kimlik doğrulaması gerekli"
        });
      }


      if (req.user.role !== "ADMIN") {
        return res.status(403).json({
          error:
            "Bu işlem için ADMIN yetkisi gereklidir."
        });
      }


      /**
       * --------------------------------------------------------
       * INPUT
       * --------------------------------------------------------
       */

      const {
        id,
        username,
        password,
        companyIds
      } = req.body;


      /**
       * --------------------------------------------------------
       * INPUT VALIDATION
       * --------------------------------------------------------
       */

      if (
        !id ||
        !username ||
        !password ||
        !Array.isArray(companyIds) ||
        companyIds.length === 0
      ) {
        return res.status(400).json({
          error:
            "id, username, password ve en az bir companyIds zorunludur"
        });
      }


      if (
        typeof id !== "string" ||
        typeof username !== "string" ||
        typeof password !== "string"
      ) {
        return res.status(400).json({
          error:
            "id, username ve password metin tipinde olmalıdır"
        });
      }


      if (
        password.length < 10
      ) {
        return res.status(400).json({
          error:
            "Parola en az 10 karakter olmalıdır"
        });
      }


      const normalizedCompanyIds =
        normalizeCompanyIds(
          companyIds
        );


      if (
        normalizedCompanyIds.length === 0
      ) {
        return res.status(400).json({
          error:
            "En az bir geçerli şirket belirtilmelidir"
        });
      }


      /**
       * --------------------------------------------------------
       * COMPANY AUTHORIZATION
       * --------------------------------------------------------
       *
       * ADMIN yalnızca JWT'deki kendi şirketlerine
       * kullanıcı ekleyebilir.
       *
       * Client tarafından gönderilen companyIds,
       * req.user.companyIds ile karşılaştırılır.
       */

      const adminCompanyIds =
        Array.isArray(
          req.user.companyIds
        )
          ? req.user.companyIds.map(
              String
            )
          : [];


      const unauthorizedCompanyIds =
        normalizedCompanyIds.filter(
          companyId =>
            !adminCompanyIds.includes(
              String(companyId)
            )
        );


      if (
        unauthorizedCompanyIds.length > 0
      ) {
        return res.status(403).json({
          error:
            "Bu şirketlerden birine kullanıcı ekleme yetkiniz bulunmamaktadır.",

          companyIds:
            unauthorizedCompanyIds
        });
      }


      /**
       * --------------------------------------------------------
       * ROLE
       * --------------------------------------------------------
       *
       * Client'ın gönderdiği role artık
       * kullanılmıyor.
       *
       * Bu sayede kullanıcı request'e:
       *
       * "role": "ADMIN"
       *
       * yazsa bile ADMIN oluşturamaz.
       *
       * İleride ADMIN'in kontrollü olarak
       * MANAGER / VIEWER seçmesine izin verilebilir.
       */

      const userRole =
        "VIEWER";


      /**
       * --------------------------------------------------------
       * PASSWORD HASH
       * --------------------------------------------------------
       *
       * Hash transaction başlamadan önce hazırlanır.
       */

      const passwordHash =
        await bcrypt.hash(
          password,
          BCRYPT_ROUNDS
        );


      /**
       * --------------------------------------------------------
       * TRANSACTION START
       * --------------------------------------------------------
       */

      await client.query(
        "BEGIN"
      );


      /**
       * --------------------------------------------------------
       * 1. COMPANY LOCK
       * --------------------------------------------------------
       *
       * Race condition önlenir.
       */

      await lockCompaniesForUserCreation(
        client,
        normalizedCompanyIds
      );


      /**
       * --------------------------------------------------------
       * 2. LICENSE / USER LIMIT CHECK
       * --------------------------------------------------------
       */

      for (
        const companyId
        of normalizedCompanyIds
      ) {

        const licenseCheck =
          await canAddUserToCompany(
            companyId,
            client
          );


        /**
         * ----------------------------------------------------
         * NO ACTIVE LICENSE
         * ----------------------------------------------------
         */

        if (
          !licenseCheck.allowed &&
          licenseCheck.reason ===
            "NO_ACTIVE_LICENSE"
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(403).json({

            error:
              "Kullanıcı oluşturulamadı",

            code:
              "NO_ACTIVE_LICENSE",

            companyId,

            message:
              "Kullanıcının bağlanacağı şirketin geçerli bir lisansı bulunmamaktadır."
          });
        }


        /**
         * ----------------------------------------------------
         * USER LIMIT REACHED
         * ----------------------------------------------------
         */

        if (
          !licenseCheck.allowed &&
          licenseCheck.reason ===
            "LIMIT_REACHED"
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(403).json({

            error:
              "Kullanıcı oluşturulamadı",

            code:
              "USER_LIMIT_REACHED",

            companyId,

            currentUsers:
              licenseCheck.currentUsers,

            maxUsers:
              licenseCheck.maxUsers,

            message:
              "Şirket kullanıcı limitine ulaşmıştır. Yeni kullanıcı eklemek için lisansınızı yükseltin."
          });
        }


        /**
         * ----------------------------------------------------
         * OTHER LICENSE ERROR
         * ----------------------------------------------------
         */

        if (
          !licenseCheck.allowed
        ) {

          await client.query(
            "ROLLBACK"
          );

          return res.status(403).json({

            error:
              "Kullanıcı oluşturulamadı",

            companyId,

            message:
              licenseCheck.message ||
              "Şirket lisansı kullanıcı eklenmesine izin vermiyor."
          });
        }
      }


      /**
       * --------------------------------------------------------
       * 3. USER INSERT
       * --------------------------------------------------------
       */

      await client.query(
        `
          INSERT INTO users (
            id,
            username,
            password_hash,
            role,
            status
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            'ACTIVE'
          )
        `,
        [
          id,
          username,
          passwordHash,
          userRole
        ]
      );


      /**
       * --------------------------------------------------------
       * 4. USER ↔ COMPANY
       * --------------------------------------------------------
       */

      for (
        const companyId
        of normalizedCompanyIds
      ) {

        await client.query(
          `
            INSERT INTO user_companies (
              user_id,
              company_id
            )
            VALUES (
              $1,
              $2
            )
          `,
          [
            id,
            companyId
          ]
        );
      }


      /**
       * --------------------------------------------------------
       * 5. COMMIT
       * --------------------------------------------------------
       */

      await client.query(
        "COMMIT"
      );


      /**
       * --------------------------------------------------------
       * LICENSE INFORMATION
       * --------------------------------------------------------
       */

      const licenses =
        await getUserLicenses(
          id
        );


      /**
       * --------------------------------------------------------
       * RESPONSE
       * --------------------------------------------------------
       */

      return res.status(201).json({

        message:
          "Kullanıcı başarıyla oluşturuldu",

        id,

        username,

        role:
          userRole,

        companyIds:
          normalizedCompanyIds,

        licenses
      });


    } catch (error) {


      /**
       * --------------------------------------------------------
       * ROLLBACK
       * --------------------------------------------------------
       */

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "Transaction rollback hatası:",
          rollbackError
        );
      }


      /**
       * --------------------------------------------------------
       * DUPLICATE
       * --------------------------------------------------------
       */

      if (
        error.code ===
        "23505"
      ) {

        return res.status(409).json({
          error:
            "Bu id veya username zaten kayıtlı"
        });
      }


      /**
       * --------------------------------------------------------
       * COMPANY NOT FOUND
       * --------------------------------------------------------
       */

      if (
        error.code ===
        "COMPANY_NOT_FOUND"
      ) {

        return res.status(404).json({

          error:
            "Bir veya daha fazla şirket bulunamadı",

          companyIds:
            error.companyIds || []
        });
      }


      console.error(
        "Register hatası:",
        error
      );


      return res.status(500).json({
        error:
          "Kullanıcı oluşturulurken beklenmeyen bir hata oluştu"
      });


    } finally {

      client.release();

    }
  }
);


/**
 * ============================================================
 * POST /api/auth/login
 * ============================================================
 *
 * Login response şirket lisanslarını da içerir.
 */
router.post(
  "/login",
  loginRateLimiter,
  async (req, res) => {

    try {

      const {
        username,
        password
      } = req.body;


      /**
       * INPUT VALIDATION
       */

      if (
        !username ||
        !password
      ) {
        return res.status(400).json({
          error:
            "username ve password zorunludur"
        });
      }


      /**
       * USER
       */

      const result =
        await pool.query(
          `
            SELECT *
            FROM users
            WHERE username = $1
              AND status = 'ACTIVE'
          `,
          [username]
        );


      const user =
        result.rows[0];


      if (!user) {
        return res.status(401).json({
          error:
            "Kullanıcı adı veya parola hatalı"
        });
      }


      /**
       * PASSWORD
       *
       * DÜZELTME: user.password_hash veritabanında bozuk/eksik
       * (geçersiz uzunlukta, örn. 60 karakterden kısa) bir bcrypt
       * hash'i olarak saklanmışsa bcrypt.compare() exception fırlatır.
       * Bu durum önceden yakalanmadığı için dıştaki genel catch
       * bloğuna düşüyor ve kullanıcıya "Giriş işlemi sırasında
       * beklenmeyen bir hata oluştu" 500 hatası dönüyordu; log'da da
       * gerçek sebep (bozuk hash) belirsiz kalıyordu. Burada ayrı bir
       * try/catch ile bu durum açıkça yakalanıp loglanıyor ve
       * kullanıcıya normal "hatalı kullanıcı adı/parola" cevabı
       * dönülüyor.
       */

      let isValid;

      try {

        isValid =
          await bcrypt.compare(
            password,
            user.password_hash
          );

      } catch (bcryptError) {

        console.error(
          `Login: kullanıcı '${username}' için password_hash geçersiz/bozuk (bcrypt.compare hata verdi):`,
          bcryptError
        );

        return res.status(401).json({
          error:
            "Kullanıcı adı veya parola hatalı"
        });
      }


      if (!isValid) {
        return res.status(401).json({
          error:
            "Kullanıcı adı veya parola hatalı"
        });
      }


      /**
       * USER COMPANIES
       */

      const companyIds =
        await getUserCompanyIds(
          user.id
        );


      /**
       * LICENSES
       */

      const licenses =
        await getUserLicenses(
          user.id
        );


      /**
       * ACTIVE LICENSES
       */

      const activeLicenses =
        licenses.filter(
          license =>
            license.hasActiveLicense
        );


      /**
       * PLAN LEVEL
       */

      const PLAN_LEVELS = {
        starter: 1,
        professional: 2,
        enterprise: 3
      };


      let highestPlan =
        null;


      for (
        const company
        of activeLicenses
      ) {

        const plan =
          company.license?.planId;


        if (!plan) {
          continue;
        }


        if (
          !highestPlan ||
          (
            PLAN_LEVELS[plan] || 0
          ) >
          (
            PLAN_LEVELS[
              highestPlan
            ] || 0
          )
        ) {
          highestPlan =
            plan;
        }
      }


      /**
       * JWT
       *
       * Lisans bilgileri JWT içine konulmaz.
       *
       * Çünkü lisans sonradan iptal edilebilir.
       */

      const token =
        signUserToken({
          id:
            user.id,

          username:
            user.username,

          role:
            user.role,

          companyIds
        });


      /**
       * LOGIN RESPONSE
       */

      return res.json({

        token,

        user: {

          id:
            user.id,

          username:
            user.username,

          role:
            user.role,

          // P0 — HOLDİNG/KULLANICI YÖNETİMİ: dashboard karşılama
          // metni ("Hoş geldiniz, {Ad} {Soyad}") ve email = login
          // kimliği hedefi için. Mevcut kullanıcılarda bu alanlar
          // NULL olabilir (email/ad/soyad daha önce hiç girilmemiş
          // olabilir) — frontend fallback (username göstermek gibi)
          // uygulayabilir, burada zorunlu kılınmıyor.
          email:
            user.email,

          firstName:
            user.first_name,

          lastName:
            user.last_name,

          mustChangePassword:
            user.must_change_password,

          companyIds,

          licenses,

          licensedCompanies:
            activeLicenses.map(
              company => ({

                companyId:
                  company.companyId,

                companyName:
                  company.companyName,

                planId:
                  company.license.planId,

                planName:
                  company.license.planName

              })
            ),

          hasActiveLicense:
            activeLicenses.length > 0,

          highestPlan

        }
      });


    } catch (error) {

      console.error(
        "Login hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Giriş işlemi sırasında beklenmeyen bir hata oluştu"
      });
    }
  }
);


/**
 * ============================================================
 * GET /api/auth/me
 * ============================================================
 */
router.get(
  "/me",
  requireAuth,
  async (req, res) => {

    try {

      /**
       * P0: email/first_name/last_name/must_change_password JWT
       * payload'ında YOK (bkz. signUserToken — bilinçli olarak
       * lisans bilgisi gibi bu alanlar da token'a konulmadı, token
       * yapısını değiştirmemek için). Bu yüzden burada DB'den ayrıca
       * okunuyor. companyIds/licenses zaten aynı sebeple DB'den
       * taze okunuyordu — aynı desen izleniyor.
       */
      const userProfileResult =
        await pool.query(
          `
            SELECT
              email,
              first_name,
              last_name,
              must_change_password
            FROM users
            WHERE id = $1
          `,
          [req.user.id]
        );

      const userProfile =
        userProfileResult.rows[0] || {};


      /**
       * Güncel şirket ilişkilerini DB'den okuyoruz.
       */
      const companyIds =
        await getUserCompanyIds(
          req.user.id
        );


      /**
       * Güncel lisans bilgileri.
       */
      const licenses =
        await getUserLicenses(
          req.user.id
        );


      /**
       * Aktif lisanslar.
       */
      const activeLicenses =
        licenses.filter(
          license =>
            license.hasActiveLicense
        );


      return res.json({

        success: true,

        data: {

          id:
            req.user.id,

          username:
            req.user.username,

          role:
            req.user.role,

          email:
            userProfile.email,

          firstName:
            userProfile.first_name,

          lastName:
            userProfile.last_name,

          mustChangePassword:
            userProfile.must_change_password,

          companyIds,

          licenses,

          hasActiveLicense:
            activeLicenses.length > 0
        }

      });


    } catch (error) {

      console.error(
        "Auth /me hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Kullanıcı bilgileri alınırken bir hata oluştu"
      });
    }
  }
);


module.exports = router;
