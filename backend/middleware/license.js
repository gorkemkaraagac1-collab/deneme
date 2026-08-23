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
 * Yetkilendirme mantığı:
 *
 * Starter       -> Starter
 * Professional  -> Professional + Starter
 * Enterprise    -> Enterprise + Professional + Starter
 */
const PLAN_LEVELS = {
  starter: 1,
  professional: 2,
  enterprise: 3
};


/**
 * ============================================================
 * GET ACTIVE USER LICENSES
 * ============================================================
 */
async function getActiveUserLicenses(userId) {

  const licenses =
    await getUserLicenses(userId);

  if (!Array.isArray(licenses)) {
    return [];
  }

  return licenses.filter(
    license =>
      license &&
      license.hasActiveLicense === true
  );
}


/**
 * ============================================================
 * GET HIGHEST PLAN
 * ============================================================
 */
function getHighestPlan(activeLicenses) {

  let highestPlan = null;
  let highestLevel = 0;

  if (!Array.isArray(activeLicenses)) {
    return null;
  }

  for (const company of activeLicenses) {

    const planId =
      company?.license?.planId
        ? String(company.license.planId)
            .trim()
            .toLowerCase()
        : null;

    const level =
      PLAN_LEVELS[planId] || 0;

    if (level > highestLevel) {

      highestLevel = level;
      highestPlan = planId;

    }
  }

  return highestPlan;
}


/**
 * ============================================================
 * REQUIRE ACTIVE LICENSE
 * ============================================================
 *
 * Kullanıcının en az bir aktif lisansı bulunmalıdır.
 *
 * ADMIN için bypass yoktur.
 */
async function requireActiveLicense(
  req,
  res,
  next
) {

  try {

    if (!req.user || !req.user.id) {

      return res.status(401).json({
        error:
          "Kimlik doğrulaması gereklidir"
      });

    }

    const activeLicenses =
      await getActiveUserLicenses(
        req.user.id
      );


    if (activeLicenses.length === 0) {

      return res.status(403).json({

        error:
          "Aktif lisans bulunmamaktadır",

        code:
          "NO_ACTIVE_LICENSE",

        message:
          "Bu işlemi gerçekleştirmek için bağlı olduğunuz şirketlerden en az birinin aktif lisansı bulunmalıdır."

      });

    }


    const highestPlan =
      getHighestPlan(
        activeLicenses
      );


    /**
     * Request context.
     *
     * ÖNEMLİ:
     *
     * license-test.js buradaki
     * req.license objesini kullanacaktır.
     */
    req.license = {

      activeLicenses,

      hasActiveLicense:
        true,

      highestPlan

    };


    return next();

  } catch (error) {

    console.error(
      "License middleware hatası:",
      error
    );

    return res.status(500).json({

      error:
        "Lisans kontrolü sırasında beklenmeyen bir hata oluştu"

    });

  }
}


/**
 * ============================================================
 * REQUIRE PLAN
 * ============================================================
 *
 * BU MIDDLEWARE COMPANY ID İSTEMEZ.
 *
 * Kullanıcının aktif lisansları içerisindeki
 * EN YÜKSEK PLAN üzerinden karar verir.
 *
 * Örnek:
 *
 * Professional
 *     >= Professional
 *     => ALLOW
 *
 * Enterprise
 *     >= Professional
 *     => ALLOW
 *
 * Starter
 *     < Professional
 *     => DENY
 */
function requirePlan(requiredPlan) {

  const normalizedPlan =
    String(
      requiredPlan || ""
    )
      .trim()
      .toLowerCase();


  if (
    !PLAN_LEVELS[
      normalizedPlan
    ]
  ) {

    throw new Error(
      `Geçersiz plan: ${requiredPlan}`
    );

  }


  return async function planMiddleware(
    req,
    res,
    next
  ) {

    try {

      if (!req.user || !req.user.id) {

        return res.status(401).json({

          error:
            "Kimlik doğrulaması gereklidir"

        });

      }


      /**
       * requireActiveLicense daha önce
       * çalıştıysa tekrar DB sorgusu yapma.
       */
      const activeLicenses =
        req.license?.activeLicenses ||
        await getActiveUserLicenses(
          req.user.id
        );


      if (
        !Array.isArray(activeLicenses) ||
        activeLicenses.length === 0
      ) {

        return res.status(403).json({

          error:
            "Aktif lisans bulunmamaktadır",

          code:
            "NO_ACTIVE_LICENSE"

        });

      }


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

        requiredPlan:
          normalizedPlan

      };


      return next();

    } catch (error) {

      console.error(
        "Plan middleware hatası:",
        error
      );

      return res.status(500).json({

        error:
          "Lisans planı kontrol edilirken beklenmeyen bir hata oluştu"

      });

    }

  };
}


/**
 * ============================================================
 * REQUIRE COMPANY LICENSE
 * ============================================================
 *
 * Şirket bazlı endpoint'lerde kullanılacak.
 *
 * Bu middleware'i silmiyoruz.
 * Mevcut uygulamanın company-level authorization
 * ihtiyacı olabilir.
 */
async function requireCompanyLicense(
  req,
  res,
  next
) {

  try {

    if (!req.user || !req.user.id) {

      return res.status(401).json({
        error:
          "Kimlik doğrulaması gereklidir"
      });

    }


    const companyId =
      req.params.companyId ||
      req.body?.companyId ||
      req.query?.companyId;


    if (!companyId) {

      return res.status(400).json({

        error:
          "companyId belirtilmelidir"

      });

    }


    const normalizedCompanyId =
      String(companyId);


    /**
     * JWT içerisindeki şirket erişimi.
     */
    const hasCompanyAccess =
      Array.isArray(req.user.companyIds) &&
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
     * Şirketin aktif lisansını
     * service üzerinden kontrol ediyoruz.
     *
     * Burada requirePlan kullanmıyoruz.
     */
    const {
      getActiveCompanyLicense
    } = require(
      "../services/license-service"
    );


    const license =
      await getActiveCompanyLicense(
        normalizedCompanyId
      );


    if (!license) {

      return res.status(403).json({

        error:
          "Şirketin aktif lisansı bulunmamaktadır",

        code:
          "COMPANY_LICENSE_INACTIVE"

      });

    }


    req.companyId =
      normalizedCompanyId;

    req.companyLicense =
      license;


    return next();

  } catch (error) {

    console.error(
      "requireCompanyLicense hatası:",
      error
    );

    return res.status(500).json({

      error:
        "Şirket lisansı kontrol edilirken beklenmeyen bir hata oluştu"

    });

  }
}


/**
 * ============================================================
 * REQUIRE MINIMUM PLAN
 * ============================================================
 *
 * CompanyId gerektirmez.
 *
 * Kullanıcının tüm aktif lisansları üzerinden
 * en yüksek planı değerlendirir.
 */
function requireMinimumPlan(
  minimumPlan
) {

  const normalizedPlan =
    String(
      minimumPlan || ""
    )
      .trim()
      .toLowerCase();


  if (
    !PLAN_LEVELS[
      normalizedPlan
    ]
  ) {

    throw new Error(
      `Geçersiz minimum plan: ${minimumPlan}`
    );

  }


  return requirePlan(
    normalizedPlan
  );
}


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */
module.exports = {

  requireActiveLicense,

  requireCompanyLicense,

  requirePlan,

  requireMinimumPlan,

  getActiveUserLicenses,

  getHighestPlan,

  PLAN_LEVELS

};
