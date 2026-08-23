/**
 * ============================================================
 * LICENSE MIDDLEWARE
 * TFRS16 Backend
 * ============================================================
 *
 * Lisans / plan authorization katmanı.
 *
 * PLAN HIERARCHY
 *
 * Starter       = 1
 * Professional  = 2
 * Enterprise    = 3
 *
 * ============================================================
 */

const {
  getUserLicenses,
  getActiveCompanyLicense
} = require("../services/license-service");


/**
 * ============================================================
 * PLAN LEVELS
 * ============================================================
 */

const PLAN_LEVELS = {
  starter: 1,
  professional: 2,
  enterprise: 3
};


/**
 * ============================================================
 * PLAN NORMALIZATION
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
 * LICENSE PLAN ID
 * ============================================================
 *
 * DB / service katmanında farklı naming convention
 * kullanılması ihtimaline karşı normalize ediyoruz.
 *
 * Desteklenen:
 *
 * license.planId
 * license.plan_id
 * license.planName
 * license.plan_name
 */

function getLicensePlanId(license) {

  if (!license) {
    return null;
  }

  const plan =
    license.planId ||
    license.plan_id ||
    license.planName ||
    license.plan_name ||
    null;

  return normalizePlan(plan);

}


/**
 * ============================================================
 * ACTIVE LICENSE CHECK
 * ============================================================
 */

function isLicenseActive(companyLicense) {

  if (!companyLicense) {
    return false;
  }

  /**
   * Service katmanı zaten hasActiveLicense
   * döndürebiliyorsa onu kullan.
   */
  if (
    companyLicense.hasActiveLicense === true
  ) {
    return true;
  }

  /**
   * Fallback:
   *
   * active / isActive alanları.
   */
  if (
    companyLicense.active === true ||
    companyLicense.isActive === true
  ) {
    return true;
  }

  /**
   * Tarih bazlı fallback.
   */
  const now = new Date();

  if (
    companyLicense.startDate &&
    new Date(companyLicense.startDate) > now
  ) {
    return false;
  }

  if (
    companyLicense.endDate &&
    new Date(companyLicense.endDate) < now
  ) {
    return false;
  }

  /**
   * Eğer service zaten lisansı döndürmüşse
   * ve açıkça inactive demiyorsa aktif kabul edilir.
   */
  if (
    companyLicense.status &&
    String(companyLicense.status)
      .toLowerCase() !== "active"
  ) {
    return false;
  }

  return true;

}


/**
 * ============================================================
 * ACTIVE USER LICENSES
 * ============================================================
 *
 * Kullanıcının bağlı olduğu şirketlerin aktif lisanslarını
 * döndürür.
 */

async function getActiveUserLicenses(userId) {

  if (!userId) {
    return [];
  }

  const licenses =
    await getUserLicenses(userId);

  if (!Array.isArray(licenses)) {
    return [];
  }

  return licenses.filter(
    company =>
      isLicenseActive(
        company?.license ||
        company
      )
  );

}


/**
 * ============================================================
 * HIGHEST PLAN
 * ============================================================
 *
 * Kullanıcının tüm aktif lisansları içerisindeki
 * en yüksek planı bulur.
 */

function getHighestPlan(activeLicenses) {

  if (
    !Array.isArray(activeLicenses)
  ) {
    return null;
  }

  let highestPlan = null;
  let highestLevel = 0;

  for (
    const company of activeLicenses
  ) {

    const license =
      company?.license ||
      company;

    const planId =
      getLicensePlanId(
        license
      );

    const level =
      PLAN_LEVELS[planId] || 0;

    if (
      level > highestLevel
    ) {

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
 * Kullanıcının en az bir şirketinde aktif lisans
 * bulunmasını zorunlu kılar.
 *
 * Örnek:
 *
 * router.get(
 *   "/protected",
 *   requireAuth,
 *   requireActiveLicense,
 *   controller
 * );
 *
 * ADMIN için otomatik bypass YOKTUR.
 *
 * ADMIN + aktif lisans yok
 *        ↓
 *      403
 */

async function requireActiveLicense(
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
          "Kimlik doğrulaması gereklidir"
      });

    }


    /**
     * Kullanıcı lisansları.
     *
     * Daha önce middleware tarafından
     * hesaplandıysa tekrar DB sorgusu yapma.
     */

    const activeLicenses =
      req.license?.activeLicenses ||
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
     * En yüksek plan.
     */

    const highestPlan =
      getHighestPlan(
        activeLicenses
      );


    /**
     * Request context.
     *
     * Sonraki middleware'ler DB'ye tekrar gitmez.
     */

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
        "Lisans kontrolü sırasında beklenmeyen bir hata oluştu"

    });

  }

}


/**
 * ============================================================
 * REQUIRE PLAN
 * ============================================================
 *
 * Kullanıcının sahip olduğu EN YÜKSEK planı kontrol eder.
 *
 * requirePlan("professional")
 *
 * Starter
 *      ↓
 * DENY
 *
 * Professional
 *      ↓
 * ALLOW
 *
 * Enterprise
 *      ↓
 * ALLOW
 *
 *
 * requirePlan("enterprise")
 *
 * Starter
 *      ↓
 * DENY
 *
 * Professional
 *      ↓
 * DENY
 *
 * Enterprise
 *      ↓
 * ALLOW
 *
 *
 * ÖNEMLİ:
 *
 * Bu middleware USER ENTITLEMENT kontrolüdür.
 *
 * companyId istemez.
 */

function requirePlan(
  requiredPlan
) {

  const normalizedPlan =
    normalizePlan(
      requiredPlan
    );


    /**
     * Middleware oluşturulurken
     * geçersiz planı yakala.
     */

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

      if (
        !req.user ||
        !req.user.id
      ) {

        return res.status(401).json({

          error:
            "Kimlik doğrulaması gereklidir"

        });

      }


      /**
       * requireActiveLicense daha önce çalıştıysa
       * mevcut context'i kullan.
       */

      const activeLicenses =
        req.license?.activeLicenses ||
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
            "Bu işlem için aktif bir lisans gereklidir."

        });

      }


      /**
       * Kullanıcının en yüksek planı.
       */

      const highestPlan =
        getHighestPlan(
          activeLicenses
        );


      const highestLevel =
        PLAN_LEVELS[
          highestPlan
        ] || 0;


      const requiredLevel =
        PLAN_LEVELS[
          normalizedPlan
        ];


      /**
       * Authorization.
       */

      if (
        highestLevel <
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
       * Request context.
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
 * Belirli bir şirketin aktif lisansını kontrol eder.
 *
 * Bu middleware USER ENTITLEMENT'tan farklıdır.
 *
 * Örnek:
 *
 * /companies/:companyId/reports
 *
 * Burada companyId zorunludur.
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
          "companyId belirtilmelidir",

        code:
          "COMPANY_ID_REQUIRED"

      });

    }


    const normalizedCompanyId =
      String(companyId);


    /**
     * Kullanıcının şirkete erişim yetkisi.
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
     * Şirket lisansı.
     */

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


    /**
     * Request context.
     */

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
 * Şirket bazlı minimum plan kontrolü.
 *
 * Bu middleware USER ENTITLEMENT mantığıyla çalışır.
 *
 * requireMinimumPlan("professional")
 *
 * Professional + Enterprise → ALLOW
 * Starter                  → DENY
 */

function requireMinimumPlan(
  minimumPlan
) {

  const normalizedPlan =
    normalizePlan(
      minimumPlan
    );


  if (
    !PLAN_LEVELS[
      normalizedPlan
    ]
  ) {

    throw new Error(
      `Geçersiz minimum plan: ${minimumPlan}`
    );

  }


  return async function minimumPlanMiddleware(
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
            "Kimlik doğrulaması gereklidir"

        });

      }


      const activeLicenses =
        req.license?.activeLicenses ||
        await getActiveUserLicenses(
          req.user.id
        );


      if (
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


      const highestLevel =
        PLAN_LEVELS[
          highestPlan
        ] || 0;


      const requiredLevel =
        PLAN_LEVELS[
          normalizedPlan
        ];


      if (
        highestLevel <
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
        "requireMinimumPlan hatası:",
        error
      );

      return res.status(500).json({

        error:
          "Minimum lisans planı kontrol edilirken beklenmeyen bir hata oluştu"

      });

    }

  };

}


/**
 * ============================================================
 * EXPORTS
 * ============================================================
 */

module.exports = {

  requireActiveLicense,

  requirePlan,

  requireCompanyLicense,

  requireMinimumPlan,

  getActiveUserLicenses,

  getHighestPlan,

  getLicensePlanId,

  isLicenseActive,

  PLAN_LEVELS

};
