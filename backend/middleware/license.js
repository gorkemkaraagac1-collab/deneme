const {
  getUserLicenses
} = require("../services/license-service");


/**
 * ============================================================
 * PLAN LEVELS
 * ============================================================
 *
 * Starter       = 1
 * Professional  = 2
 * Enterprise    = 3
 *
 * Plan kontrolü minimum seviye mantığıyla çalışır.
 *
 * Professional:
 *     Professional  -> ALLOW
 *     Enterprise    -> ALLOW
 *     Starter       -> DENY
 *
 * Enterprise:
 *     Enterprise    -> ALLOW
 *     Professional  -> DENY
 *     Starter       -> DENY
 */
const PLAN_LEVELS = {
  starter: 1,
  professional: 2,
  enterprise: 3
};


/**
 * ============================================================
 * NORMALIZATION
 * ============================================================
 */

function normalizePlan(plan) {

  if (
    plan === null ||
    plan === undefined
  ) {
    return null;
  }

  return String(plan)
    .trim()
    .toLowerCase();
}


/**
 * ============================================================
 * ACTIVE LICENSE HELPERS
 * ============================================================
 */


/**
 * Kullanıcının tüm lisanslarını getirir.
 */
async function getUserLicenseData(userId) {

  if (!userId) {
    return [];
  }

  const licenses =
    await getUserLicenses(userId);

  if (!Array.isArray(licenses)) {
    return [];
  }

  return licenses;
}


/**
 * Kullanıcının aktif lisanslarını getirir.
 *
 * Beklenen yapı:
 *
 * {
 *   companyId,
 *   companyName,
 *   hasActiveLicense: true,
 *   license: {
 *     planId,
 *     planName,
 *     status,
 *     startsAt,
 *     expiresAt
 *   }
 * }
 */
async function getActiveUserLicenses(userId) {

  const licenses =
    await getUserLicenseData(userId);


  return licenses.filter(
    company => {

      if (
        company &&
        company.hasActiveLicense === true
      ) {
        return true;
      }

      /**
       * Defensive fallback.
       *
       * Eğer servis doğrudan license objesi
       * döndürürse de aktifliği kontrol ediyoruz.
       */
      const license =
        company?.license;

      if (!license) {
        return false;
      }

      if (
        license.status &&
        String(license.status).toLowerCase() !== "active"
      ) {
        return false;
      }

      return true;
    }
  );
}


/**
 * ============================================================
 * HIGHEST PLAN
 * ============================================================
 */


/**
 * Kullanıcının aktif lisansları içerisindeki
 * en yüksek planı bulur.
 */
function getHighestPlan(
  activeLicenses
) {

  let highestPlan = null;
  let highestLevel = 0;


  if (
    !Array.isArray(activeLicenses)
  ) {
    return null;
  }


  for (
    const company
    of activeLicenses
  ) {

    const planId =
      normalizePlan(
        company?.license?.planId
      );


    const level =
      PLAN_LEVELS[
        planId
      ] || 0;


    if (
      level >
      highestLevel
    ) {

      highestLevel =
        level;

      highestPlan =
        planId;

    }

  }


  return highestPlan;
}


/**
 * ============================================================
 * LICENSE CONTEXT
 * ============================================================
 */


/**
 * Request üzerinde standart lisans context'i oluşturur.
 */
function buildLicenseContext(
  activeLicenses
) {

  const highestPlan =
    getHighestPlan(
      activeLicenses
    );


  return {

    activeLicenses,

    hasActiveLicense:
      activeLicenses.length > 0,

    highestPlan,

    highestLevel:
      PLAN_LEVELS[
        highestPlan
      ] || 0

  };
}


/**
 * ============================================================
 * REQUIRE ACTIVE LICENSE
 * ============================================================
 *
 * Kullanıcının en az bir şirketinde aktif lisans
 * bulunmasını zorunlu kılar.
 *
 * ADMIN dahil tüm roller için geçerlidir.
 *
 * ADMIN + lisans yok
 *      ↓
 * 403 NO_ACTIVE_LICENSE
 */
async function requireActiveLicense(
  req,
  res,
  next
) {

  try {

    /**
     * Önce authentication.
     */
    if (
      !req.user ||
      !req.user.id
    ) {

      return res.status(401).json({
        error:
          "Kimlik doğrulaması gereklidir",

        code:
          "AUTH_REQUIRED"
      });

    }


    /**
     * Eğer daha önce aynı request içerisinde
     * lisans context'i oluşturulduysa tekrar
     * DB sorgusu yapmıyoruz.
     */
    if (
      req.license &&
      Array.isArray(
        req.license.activeLicenses
      )
    ) {

      if (
        req.license.activeLicenses.length === 0
      ) {

        return res.status(403).json({

          error:
            "Aktif lisans bulunmamaktadır",

          code:
            "NO_ACTIVE_LICENSE",

          message:
            "Bu işlemi gerçekleştirmek için bağlı olduğunuz şirketlerden en az birinin aktif lisansı bulunmalıdır."

        });

      }

      return next();

    }


    /**
     * Kullanıcının aktif lisanslarını getir.
     */
    const activeLicenses =
      await getActiveUserLicenses(
        req.user.id
      );


    /**
     * Aktif lisans yok.
     */
    if (
      activeLicenses.length === 0
    ) {

      return res.status(403).json({

        error:
          "Aktif lisans bulunmamaktadır",

        code:
          "NO_ACTIVE_LICENSE",

        message:
          "Bu işlemi gerçekleştirmek için bağlı olduğunuz şirketlerden en az birinin aktif lisansı bulunmalıdır."

      });

    }


    /**
     * Request context.
     */
    req.license =
      buildLicenseContext(
        activeLicenses
      );


    return next();

  } catch (error) {

    console.error(
      "requireActiveLicense hatası:",
      error
    );


    return res.status(500).json({

      error:
        "Lisans kontrolü sırasında beklenmeyen bir hata oluştu",

      code:
        "LICENSE_CHECK_ERROR"

    });

  }

}


/**
 * ============================================================
 * REQUIRE PLAN
 * ============================================================
 *
 * Minimum plan kontrolü.
 *
 * requirePlan("professional")
 *
 * Starter
 *      -> DENY
 *
 * Professional
 *      -> ALLOW
 *
 * Enterprise
 *      -> ALLOW
 */
function requirePlan(
  requiredPlan
) {

  const normalizedPlan =
    normalizePlan(
      requiredPlan
    );


  /**
   * Middleware tanımlanırken hatalı plan
   * verilmesini engelliyoruz.
   */
  if (
    !PLAN_LEVELS[
      normalizedPlan
    ]
  ) {

    throw new Error(
      `Geçersiz lisans planı: ${requiredPlan}`
    );

  }


  return async function planMiddleware(
    req,
    res,
    next
  ) {

    try {

      /**
       * Authentication kontrolü.
       */
      if (
        !req.user ||
        !req.user.id
      ) {

        return res.status(401).json({

          error:
            "Kimlik doğrulaması gereklidir",

          code:
            "AUTH_REQUIRED"

        });

      }


      let activeLicenses;


      /**
       * requireActiveLicense daha önce çalıştıysa
       * DB'ye tekrar gitme.
       */
      if (
        req.license &&
        Array.isArray(
          req.license.activeLicenses
        )
      ) {

        activeLicenses =
          req.license.activeLicenses;

      } else {

        activeLicenses =
          await getActiveUserLicenses(
            req.user.id
          );

      }


      /**
       * Aktif lisans yok.
       */
      if (
        activeLicenses.length === 0
      ) {

        return res.status(403).json({

          error:
            "Aktif lisans bulunmamaktadır",

          code:
            "NO_ACTIVE_LICENSE",

          message:
            "Bu işlem için aktif bir lisans gereklidir."

        });

      }


      /**
       * Kullanıcının sahip olduğu
       * en yüksek plan.
       */
      const highestPlan =
        getHighestPlan(
          activeLicenses
        );


      const currentLevel =
        PLAN_LEVELS[
          highestPlan
        ] || 0;


      const requiredLevel =
        PLAN_LEVELS[
          normalizedPlan
        ];


      /**
       * Minimum plan kontrolü.
       */
      if (
        currentLevel <
        requiredLevel
      ) {

        return res.status(403).json({

          error:
            "Bu özellik mevcut lisans planınızda kullanılamaz",

          code:
            "PLAN_REQUIRED",

          requiredPlan:
            normalizedPlan,

          currentPlan:
            highestPlan,

          requiredLevel,

          currentLevel,

          message:
            `Bu özellik için ${normalizedPlan} veya daha üst bir lisans gereklidir.`

        });

      }


      /**
       * Request context'i güncelle.
       */
      req.license = {

        ...(req.license || {}),

        activeLicenses,

        hasActiveLicense:
          true,

        highestPlan,

        highestLevel:
          currentLevel,

        requiredPlan:
          normalizedPlan,

        requiredLevel

      };


      return next();

    } catch (error) {

      console.error(
        "requirePlan hatası:",
        error
      );


      return res.status(500).json({

        error:
          "Lisans planı kontrol edilirken beklenmeyen bir hata oluştu",

        code:
          "PLAN_CHECK_ERROR"

      });

    }

  };

}


/**
 * ============================================================
 * REQUIRE MINIMUM PLAN
 * ============================================================
 *
 * requireMinimumPlan("professional")
 *
 * Aynı minimum plan mantığını daha okunabilir
 * bir isimle kullanabilmek için alias/helper.
 */
function requireMinimumPlan(
  minimumPlan
) {

  return requirePlan(
    minimumPlan
  );

}


/**
 * ============================================================
 * REQUIRE COMPANY LICENSE
 * ============================================================
 *
 * Belirli bir şirket için lisans kontrolü.
 *
 * companyId aşağıdaki sırayla aranır:
 *
 * 1. req.params.companyId
 * 2. req.body.companyId
 * 3. req.query.companyId
 *
 * Ayrıca kullanıcının JWT içerisindeki
 * companyIds listesinde bu şirketin bulunması gerekir.
 *
 * Böylece client başka bir companyId göndererek
 * başka şirketin lisansına erişemez.
 */
async function requireCompanyLicense(
  req,
  res,
  next
) {

  try {

    if (
      !req.user ||
      !req.user.id
    ) {

      return res.status(401).json({

        error:
          "Kimlik doğrulaması gereklidir",

        code:
          "AUTH_REQUIRED"

      });

    }


    const companyId =
      req.params.companyId ||
      req.body?.companyId ||
      req.query?.companyId;


    if (!companyId) {

      return res.status(400).json({

        error:
          "companyId belirtilmelidir",

        code:
          "COMPANY_ID_REQUIRED"

      });

    }


    const normalizedCompanyId =
      String(companyId).trim();


    /**
     * Kullanıcının şirkete erişimi var mı?
     */
    const hasCompanyAccess =
      Array.isArray(
        req.user.companyIds
      ) &&
      req.user.companyIds
        .map(String)
        .includes(
          normalizedCompanyId
        );


    if (!hasCompanyAccess) {

      return res.status(403).json({

        error:
          "Bu şirkete erişim yetkiniz bulunmamaktadır",

        code:
          "COMPANY_ACCESS_DENIED"

      });

    }


    /**
     * Kullanıcının aktif lisansları içerisinden
     * ilgili şirketi bul.
     */
    let activeLicenses;


    if (
      req.license &&
      Array.isArray(
        req.license.activeLicenses
      )
    ) {

      activeLicenses =
        req.license.activeLicenses;

    } else {

      activeLicenses =
        await getActiveUserLicenses(
          req.user.id
        );

    }


    const companyLicense =
      activeLicenses.find(
        company =>
          String(
            company?.companyId
          ) === normalizedCompanyId
      );


    if (!companyLicense) {

      return res.status(403).json({

        error:
          "Şirketin aktif lisansı bulunmamaktadır",

        code:
          "COMPANY_LICENSE_INACTIVE"

      });

    }


    /**
     * Request context.
     */
    req.companyId =
      normalizedCompanyId;

    req.companyLicense =
      companyLicense.license ||
      companyLicense;


    req.license = {

      ...(req.license || {}),

      activeLicenses,

      hasActiveLicense:
        true,

      highestPlan:
        getHighestPlan(
          activeLicenses
        )

    };


    return next();

  } catch (error) {

    console.error(
      "requireCompanyLicense hatası:",
      error
    );


    return res.status(500).json({

      error:
        "Şirket lisansı kontrol edilirken beklenmeyen bir hata oluştu",

      code:
        "COMPANY_LICENSE_CHECK_ERROR"

    });

  }

}


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {

  requireActiveLicense,

  requirePlan,

  requireMinimumPlan,

  requireCompanyLicense,

  getActiveUserLicenses,

  getHighestPlan,

  PLAN_LEVELS

};
