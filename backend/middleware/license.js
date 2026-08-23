const {
  getUserLicenses,
  getActiveCompanyLicense
} = require("../services/license-service");


/**
 * ============================================================
 * LICENSE / ENTITLEMENT MIDDLEWARE
 * ============================================================
 *
 * Mimari:
 *
 * Authentication
 *      ↓
 * Company Access
 *      ↓
 * Active License
 *      ↓
 * Plan Entitlement
 *
 * Plan hiyerarşisi:
 *
 * starter       = 1
 * professional  = 2
 * enterprise    = 3
 *
 * Üst plan alt plan özelliklerini kullanabilir.
 */


const PLAN_LEVELS = {
  starter: 1,
  professional: 2,
  enterprise: 3
};


/**
 * ------------------------------------------------------------
 * PLAN NORMALIZATION
 * ------------------------------------------------------------
 */

function normalizePlan(plan) {

  if (!plan) {
    return null;
  }

  return String(plan)
    .trim()
    .toLowerCase();

}


/**
 * ------------------------------------------------------------
 * ACTIVE USER LICENSES
 * ------------------------------------------------------------
 *
 * Kullanıcının bağlı olduğu şirketlerden yalnızca aktif
 * lisansa sahip olanları döndürür.
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
 * ------------------------------------------------------------
 * HIGHEST PLAN
 * ------------------------------------------------------------
 *
 * Kullanıcının tüm şirketleri içerisindeki en yüksek planı
 * bulur.
 *
 * Bu fonksiyon GLOBAL dashboard bilgisi için kullanılmalıdır.
 *
 * Şirket bazlı yetkilendirmede kullanılmamalıdır.
 */

function getHighestPlan(activeLicenses) {

  if (!Array.isArray(activeLicenses)) {
    return null;
  }

  let highestPlan = null;
  let highestLevel = 0;

  for (const company of activeLicenses) {

    const planId =
      normalizePlan(
        company?.license?.planId
      );

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
 * ------------------------------------------------------------
 * REQUIRE ACTIVE LICENSE
 * ------------------------------------------------------------
 *
 * Kullanıcının en az bir aktif şirket lisansı olmasını ister.
 *
 * Global endpointlerde kullanılabilir.
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
          "Kimlik doğrulaması gereklidir",
        code:
          "AUTH_REQUIRED"
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


    req.license = {

      ...(req.license || {}),

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
        "Lisans kontrolü sırasında beklenmeyen bir hata oluştu",

      code:
        "LICENSE_CHECK_ERROR"

    });

  }

}


/**
 * ------------------------------------------------------------
 * REQUIRE PLAN
 * ------------------------------------------------------------
 *
 * GLOBAL plan kontrolüdür.
 *
 * Örneğin:
 *
 * requirePlan("professional")
 *
 * Kullanıcının herhangi bir şirketinde Professional veya
 * Enterprise lisans varsa geçer.
 *
 * ÖNEMLİ:
 *
 * Şirket bazlı endpointlerde bunun yerine
 * requireCompanyPlan() kullanılmalıdır.
 */

function requirePlan(requiredPlan) {

  const normalizedPlan =
    normalizePlan(
      requiredPlan
    );


    if (!PLAN_LEVELS[normalizedPlan]) {

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
              "Kimlik doğrulaması gereklidir",

            code:
              "AUTH_REQUIRED"

          });

        }


        const activeLicenses =
          req.license?.activeLicenses ||
          await getActiveUserLicenses(
            req.user.id
          );


        if (activeLicenses.length === 0) {

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
          PLAN_LEVELS[highestPlan] || 0;


        const requiredLevel =
          PLAN_LEVELS[normalizedPlan];


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
            "Lisans planı kontrol edilirken beklenmeyen bir hata oluştu",

          code:
            "PLAN_CHECK_ERROR"

        });

      }

    };

}


/**
 * ------------------------------------------------------------
 * REQUIRE COMPANY LICENSE
 * ------------------------------------------------------------
 *
 * Belirli bir şirket için:
 *
 * 1. companyId var mı?
 * 2. Kullanıcı bu şirkete bağlı mı?
 * 3. Şirketin aktif lisansı var mı?
 *
 * Bu middleware tenant isolation'ın temelidir.
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
          "Kimlik doğrulaması gereklidir",

        code:
          "AUTH_REQUIRED"

      });

    }


    const companyId =
      req.params?.companyId ||
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
      String(companyId);


    const userCompanyIds =
      Array.isArray(req.user.companyIds)
        ? req.user.companyIds.map(String)
        : [];


    const hasCompanyAccess =
      userCompanyIds.includes(
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
        "Şirket lisansı kontrol edilirken beklenmeyen bir hata oluştu",

      code:
        "COMPANY_LICENSE_CHECK_ERROR"

    });

  }

}


/**
 * ------------------------------------------------------------
 * REQUIRE COMPANY PLAN
 * ------------------------------------------------------------
 *
 * EN ÖNEMLİ MIDDLEWARE.
 *
 * Belirli şirketin kendi lisansını kontrol eder.
 *
 * Örnek:
 *
 * requireCompanyPlan("professional")
 *
 * Şirket Professional ise:
 *
 * Professional → ✅
 * Enterprise   → ✅
 * Starter      → ❌
 *
 * Başka bir şirkette Enterprise olması bu şirketin erişimini
 * etkilemez.
 */

function requireCompanyPlan(
  requiredPlan
) {

  const normalizedPlan =
    normalizePlan(
      requiredPlan
    );


  if (!PLAN_LEVELS[normalizedPlan]) {

    throw new Error(
      `Geçersiz şirket planı: ${requiredPlan}`
    );

  }


  return async function companyPlanMiddleware(
    req,
    res,
    next
  ) {

    try {

      if (!req.user || !req.user.id) {

        return res.status(401).json({

          error:
            "Kimlik doğrulaması gereklidir",

          code:
            "AUTH_REQUIRED"

        });

      }


      const companyId =
        req.companyId ||
        req.params?.companyId ||
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
        String(companyId);


      const userCompanyIds =
        Array.isArray(req.user.companyIds)
          ? req.user.companyIds.map(String)
          : [];


      if (
        !userCompanyIds.includes(
          normalizedCompanyId
        )
      ) {

        return res.status(403).json({

          error:
            "Bu şirkete erişim yetkiniz bulunmamaktadır",

          code:
            "COMPANY_ACCESS_DENIED"

        });

      }


      const companyLicense =
        req.companyLicense ||
        await getActiveCompanyLicense(
          normalizedCompanyId
        );


      if (!companyLicense) {

        return res.status(403).json({

          error:
            "Şirketin aktif lisansı bulunmamaktadır",

          code:
            "COMPANY_LICENSE_INACTIVE"

        });

      }


      const currentPlan =
        normalizePlan(
          companyLicense.plan_id
        );


      const currentLevel =
        PLAN_LEVELS[currentPlan] || 0;


      const requiredLevel =
        PLAN_LEVELS[normalizedPlan];


      if (
        currentLevel <
        requiredLevel
      ) {

        return res.status(403).json({

          error:
            "Bu özellik mevcut lisans planınızda kullanılamaz",

          code:
            "PLAN_REQUIRED",

          companyId:
            normalizedCompanyId,

          requiredPlan:
            normalizedPlan,

          currentPlan,

          message:
            `Bu özellik için ${normalizedPlan} veya daha üst bir lisans gereklidir.`

        });

      }


      req.companyId =
        normalizedCompanyId;


      req.companyLicense =
        companyLicense;


      req.license = {

        ...(req.license || {}),

        hasActiveLicense:
          true,

        highestPlan:
          currentPlan,

        requiredPlan:
          normalizedPlan,

        companyId:
          normalizedCompanyId

      };


      return next();

    } catch (error) {

      console.error(
        "requireCompanyPlan hatası:",
        error
      );

      return res.status(500).json({

        error:
          "Şirket lisans planı kontrol edilirken beklenmeyen bir hata oluştu",

        code:
          "COMPANY_PLAN_CHECK_ERROR"

      });

    }

  };

}


/**
 * ------------------------------------------------------------
 * REQUIRE MINIMUM PLAN
 * ------------------------------------------------------------
 *
 * requirePlan() için daha okunabilir alias.
 */

function requireMinimumPlan(
  minimumPlan
) {

  const normalizedPlan =
    normalizePlan(
      minimumPlan
    );


  if (!PLAN_LEVELS[normalizedPlan]) {

    throw new Error(
      `Geçersiz minimum plan: ${minimumPlan}`
    );

  }


  return requirePlan(
    normalizedPlan
  );

}


/**
 * ------------------------------------------------------------
 * EXPORTS
 * ------------------------------------------------------------
 */

module.exports = {

  requireActiveLicense,

  requireCompanyLicense,

  requirePlan,

  requireCompanyPlan,

  requireMinimumPlan,

  getActiveUserLicenses,

  getHighestPlan,

  PLAN_LEVELS

};
