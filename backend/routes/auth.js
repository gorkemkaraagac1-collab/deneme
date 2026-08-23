const express = require("express");
const bcrypt = require("bcryptjs");

const pool = require("../db/pool");

const { signUserToken } = require("../utils/jwt");
const { requireAuth } = require("../middleware/auth");

const {
  canAddUserToCompany,
  getUserLicenses
} = require("../services/license-service");

const router = express.Router();

const BCRYPT_ROUNDS = 12;


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
        .filter(id => id !== null && id !== undefined)
        .map(id => String(id).trim())
        .filter(Boolean)
    )
  ];
}


/**
 * Kullanıcı oluşturulmadan önce şirketlerin gerçekten
 * mevcut olduğunu kontrol eder.
 *
 * Aynı zamanda şirket satırlarını FOR UPDATE ile kilitler.
 *
 * Bu lock kullanıcı limitindeki race condition'ı önlemek
 * açısından kritiktir.
 */
async function lockCompaniesForUserCreation(
  client,
  companyIds
) {
  const sortedCompanyIds = [...companyIds].sort();

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

  const foundCompanyIds = result.rows.map(
    row => String(row.id)
  );

  const missingCompanyIds =
    sortedCompanyIds.filter(
      companyId =>
        !foundCompanyIds.includes(companyId)
    );

  if (missingCompanyIds.length > 0) {
    const error = new Error(
      "Bir veya daha fazla şirket bulunamadı."
    );

    error.code = "COMPANY_NOT_FOUND";
    error.companyIds = missingCompanyIds;

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
 * Kullanıcı birden fazla şirkete bağlanabilir.
 *
 * Her şirket için:
 *
 * 1. Şirket satırı kilitlenir.
 * 2. Aktif lisans kontrol edilir.
 * 3. Kullanıcı limiti kontrol edilir.
 * 4. Kullanıcı oluşturulur.
 * 5. user_companies ilişkileri oluşturulur.
 *
 * Tüm işlemler tek transaction içerisindedir.
 *
 * Herhangi bir şirketin limiti yetersizse:
 *
 * -> hiçbir şirket için kullanıcı oluşturulmaz.
 */
router.post("/register", async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      id,
      username,
      password,
      role,
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

    if (password.length < 10) {
      return res.status(400).json({
        error:
          "Parola en az 10 karakter olmalıdır"
      });
    }

    const normalizedCompanyIds =
      normalizeCompanyIds(companyIds);

    if (normalizedCompanyIds.length === 0) {
      return res.status(400).json({
        error:
          "En az bir geçerli şirket belirtilmelidir"
      });
    }

    /**
     * Güvenlik:
     *
     * Role değeri client tarafından serbestçe verilmemeli.
     * Mevcut davranışı tamamen bozmamak için şimdilik
     * sadece geçerli roller kabul edilir.
     */
    const allowedRoles = [
      "ADMIN",
      "MANAGER",
      "VIEWER"
    ];

    const userRole =
      role && allowedRoles.includes(role)
        ? role
        : "VIEWER";


    /**
     * Password hash transaction dışında hazırlanabilir.
     * Böylece DB transaction gereksiz yere açık tutulmaz.
     */
    const passwordHash = await bcrypt.hash(
      password,
      BCRYPT_ROUNDS
    );


    /**
     * --------------------------------------------------------
     * TRANSACTION START
     * --------------------------------------------------------
     */

    await client.query("BEGIN");


    /**
     * --------------------------------------------------------
     * 1. ŞİRKETLERİ KİLİTLE
     * --------------------------------------------------------
     *
     * Aynı şirket üzerinde iki transaction'ın aynı anda
     * kullanıcı limiti değerlendirmesini engeller.
     */
    await lockCompaniesForUserCreation(
      client,
      normalizedCompanyIds
    );


    /**
     * --------------------------------------------------------
     * 2. LİSANS / USER LIMIT KONTROLÜ
     * --------------------------------------------------------
     *
     * Şirketleri sıralı şekilde kontrol ediyoruz.
     *
     * Örneğin:
     *
     * Company A -> Professional -> 4/5
     * Company B -> Starter       -> 1/1
     *
     * Kullanıcı Company B'ye bağlanamayacağı için
     * transaction tamamen rollback edilir.
     */
    const companyLicenseResults = [];

    for (const companyId of normalizedCompanyIds) {

      const licenseCheck =
        await canAddUserToCompany(
          companyId,
          client
        );

      companyLicenseResults.push({
        companyId,
        ...licenseCheck
      });

      if (!licenseCheck.allowed) {

        await client.query("ROLLBACK");

        /**
         * Aktif lisans yok.
         */
        if (
          licenseCheck.reason ===
          "NO_ACTIVE_LICENSE"
        ) {
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
         * Kullanıcı limiti dolu.
         */
        if (
          licenseCheck.reason ===
          "LIMIT_REACHED"
        ) {
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

        return res.status(403).json({
          error:
            "Kullanıcı oluşturulamadı",
          companyId,
          message:
            licenseCheck.message
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
     * 4. USER ↔ COMPANY RELATIONSHIPS
     * --------------------------------------------------------
     */

    for (const companyId of normalizedCompanyIds) {

      await client.query(
        `
          INSERT INTO user_companies (
            user_id,
            company_id
          )
          VALUES ($1, $2)
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

    await client.query("COMMIT");


    /**
     * Response'a lisans bilgilerini de ekliyoruz.
     * Frontend bunu doğrudan kullanabilir.
     */
    const licenses =
      await getUserLicenses(id);


    return res.status(201).json({
      message:
        "Kullanıcı başarıyla oluşturuldu",

      id,

      username,

      role: userRole,

      companyIds:
        normalizedCompanyIds,

      licenses
    });

  } catch (error) {

    /**
     * Transaction açıksa rollback.
     */
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Transaction rollback hatası:",
        rollbackError
      );
    }


    /**
     * Duplicate user ID / username
     */
    if (error.code === "23505") {
      return res.status(409).json({
        error:
          "Bu id veya username zaten kayıtlı"
      });
    }


    /**
     * Şirket bulunamadı.
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
});


/**
 * ============================================================
 * POST /api/auth/login
 * ============================================================
 *
 * Login response artık şirket lisanslarını da içerir.
 */
router.post("/login", async (req, res) => {

  try {

    const {
      username,
      password
    } = req.body;


    /**
     * Input validation.
     */
    if (!username || !password) {
      return res.status(400).json({
        error:
          "username ve password zorunludur"
      });
    }


    /**
     * Kullanıcıyı getir.
     */
    const result = await pool.query(
      `
        SELECT *
        FROM users
        WHERE username = $1
          AND status = 'ACTIVE'
      `,
      [username]
    );

    const user = result.rows[0];


    /**
     * Kullanıcı yok.
     */
    if (!user) {
      return res.status(401).json({
        error:
          "Kullanıcı adı veya parola hatalı"
      });
    }


    /**
     * Password validation.
     */
    const isValid =
      await bcrypt.compare(
        password,
        user.password_hash
      );


    if (!isValid) {
      return res.status(401).json({
        error:
          "Kullanıcı adı veya parola hatalı"
      });
    }


    /**
     * Kullanıcının şirketleri.
     */
    const companyIds =
      await getUserCompanyIds(user.id);


    /**
     * Şirket lisansları.
     */
    const licenses =
      await getUserLicenses(user.id);


    /**
     * En az bir aktif lisans var mı?
     */
    const activeLicenses =
      licenses.filter(
        license =>
          license.hasActiveLicense
      );


    /**
     * Kullanıcının en yüksek aktif planını
     * frontend için kolay erişilebilir şekilde
     * belirliyoruz.
     */
    const PLAN_LEVELS = {
      starter: 1,
      professional: 2,
      enterprise: 3
    };

    let highestPlan = null;

    for (const company of activeLicenses) {

      const plan =
        company.license?.planId;

      if (!plan) {
        continue;
      }

      if (
        !highestPlan ||
        (PLAN_LEVELS[plan] || 0) >
          (PLAN_LEVELS[highestPlan] || 0)
      ) {
        highestPlan = plan;
      }
    }


    /**
     * JWT.
     *
     * DİKKAT:
     *
     * JWT'ye lisans bilgilerini koymuyoruz.
     *
     * Çünkü lisans sonradan iptal edilebilir.
     *
     * Lisans bilgileri DB'den gerçek zamanlı
     * kontrol edilmeye devam edecek.
     */
    const token =
      signUserToken({
        id: user.id,
        username: user.username,
        role: user.role,
        companyIds
      });


    /**
     * Login response.
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

        companyIds,

        /**
         * Kullanıcının bağlı olduğu tüm şirketlerin
         * lisans durumları.
         */
        licenses,

        /**
         * En az bir aktif lisansı olan şirketler.
         */
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

        /**
         * Frontend'de hızlı kontrol için.
         */
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
});


/**
 * ============================================================
 * GET /api/auth/me
 * ============================================================
 *
 * Mevcut endpoint korunuyor.
 */
router.get(
  "/me",
  requireAuth,
  async (req, res) => {

    try {

      /**
       * JWT'deki companyIds yerine güncel DB ilişkilerini
       * okuyalım.
       *
       * Böylece kullanıcı şirket bağlantısı değişmişse
       * /me endpoint'i güncel bilgi döndürür.
       */
      const companyIds =
        await getUserCompanyIds(
          req.user.id
        );

      const licenses =
        await getUserLicenses(
          req.user.id
        );

      const activeLicenses =
        licenses.filter(
          license =>
            license.hasActiveLicense
        );

      return res.json({

        id:
          req.user.id,

        username:
          req.user.username,

        role:
          req.user.role,

        companyIds,

        licenses,

        hasActiveLicense:
          activeLicenses.length > 0

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
