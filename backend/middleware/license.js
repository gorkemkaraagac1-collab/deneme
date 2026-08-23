const pool = require("../db/pool");

const {
  getActiveCompanyLicense,
  getUserLicensedCompanies
} = require("../services/license-service");


/**
 * Kullanıcının en az bir şirketinde aktif lisans
 * bulunup bulunmadığını kontrol eder.
 *
 * Kullanım:
 *
 * router.get(
 *   "/protected",
 *   requireAuth,
 *   requireActiveLicense,
 *   controller
 * );
 *
 * KURAL:
 * Kullanıcı birden fazla şirkete bağlı olabilir.
 *
 * En az bir şirketin geçerli lisansı varsa erişim verilir.
 */
async function requireActiveLicense(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Kimlik doğrulaması gerekli"
      });
    }

    const licensedCompanies = await getUserLicensedCompanies(
      req.user.id
    );

    if (licensedCompanies.length === 0) {
      return res.status(403).json({
        error: "Aktif lisans bulunamadı",
        code: "NO_ACTIVE_LICENSE",
        message:
          "Kullanıcının erişebildiği şirketlerin hiçbirinde geçerli bir lisans bulunmamaktadır."
      });
    }

    /**
     * Sonraki middleware/controller'ların tekrar DB sorgusu
     * yapmasına gerek kalmaması için bilgiyi request'e ekliyoruz.
     */
    req.licensedCompanies = licensedCompanies;

    return next();

  } catch (error) {
    console.error(
      "requireActiveLicense hatası:",
      error
    );

    return res.status(500).json({
      error: "Lisans kontrolü sırasında bir hata oluştu"
    });
  }
}


/**
 * Belirli bir şirketin aktif lisansını kontrol eder.
 *
 * Bu middleware companyId'nin nereden alınacağını
 * route'a göre belirler:
 *
 * /companies/:companyId/...
 *
 * veya
 *
 * /companies?companyId=...
 *
 * Öncelik:
 *
 * 1. req.params.companyId
 * 2. req.body.companyId
 * 3. req.query.companyId
 *
 * Ancak companyId'nin gerçekten kullanıcının şirketi olup
 * olmadığı ayrıca kontrol edilir.
 */
async function requireCompanyLicense(req, res, next) {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        error: "Kimlik doğrulaması gerekli"
      });
    }

    const companyId =
      req.params.companyId ||
      req.body.companyId ||
      req.query.companyId;

    if (!companyId) {
      return res.status(400).json({
        error: "companyId belirtilmelidir"
      });
    }

    const normalizedCompanyId = String(companyId);

    /**
     * Kritik güvenlik kontrolü:
     *
     * Client'ın istediği herhangi bir companyId'ye
     * erişmesine izin vermiyoruz.
     *
     * JWT'deki companyIds üzerinden kontrol ediyoruz.
     */
    const hasCompanyAccess =
      Array.isArray(req.user.companyIds) &&
      req.user.companyIds
        .map(String)
        .includes(normalizedCompanyId);

    if (!hasCompanyAccess) {
      return res.status(403).json({
        error: "Bu şirkete erişim yetkiniz bulunmamaktadır",
        code: "COMPANY_ACCESS_DENIED"
      });
    }

    const license = await getActiveCompanyLicense(
      normalizedCompanyId
    );

    if (!license) {
      return res.status(403).json({
        error: "Şirketin aktif lisansı bulunmamaktadır",
        code: "COMPANY_LICENSE_INACTIVE"
      });
    }

    /**
     * Controller'ın kullanabileceği lisans bilgisi.
     */
    req.companyId = normalizedCompanyId;
    req.companyLicense = license;

    return next();

  } catch (error) {
    console.error(
      "requireCompanyLicense hatası:",
      error
    );

    return res.status(500).json({
      error: "Şirket lisansı kontrol edilirken bir hata oluştu"
    });
  }
}


/**
 * Belirli bir plana erişim kontrolü.
 *
 * Kullanım:
 *
 * requirePlan("professional")
 *
 * ÖNEMLİ:
 *
 * Bu middleware ilgili companyId üzerinden çalışır.
 *
 * Örneğin:
 *
 * /companies/:companyId/reports
 */
function requirePlan(requiredPlan) {

  return async function planMiddleware(req, res, next) {

    try {

      if (!requiredPlan) {
        return res.status(500).json({
          error: "Plan kontrolü yapılandırılmamış"
        });
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: "Kimlik doğrulaması gerekli"
        });
      }

      const companyId =
        req.params.companyId ||
        req.body.companyId ||
        req.query.companyId;

      if (!companyId) {
        return res.status(400).json({
          error: "companyId belirtilmelidir"
        });
      }

      const normalizedCompanyId =
        String(companyId);

      /**
       * Önce şirket erişimini kontrol ediyoruz.
       */
      const hasCompanyAccess =
        Array.isArray(req.user.companyIds) &&
        req.user.companyIds
          .map(String)
          .includes(normalizedCompanyId);

      if (!hasCompanyAccess) {
        return res.status(403).json({
          error:
            "Bu şirkete erişim yetkiniz bulunmamaktadır",
          code: "COMPANY_ACCESS_DENIED"
        });
      }

      /**
       * Aktif lisans.
       */
      const license =
        await getActiveCompanyLicense(
          normalizedCompanyId
        );

      if (!license) {
        return res.status(403).json({
          error:
            "Şirketin aktif lisansı bulunmamaktadır",
          code: "COMPANY_LICENSE_INACTIVE"
        });
      }

      /**
       * Şimdilik exact plan kontrolü.
       *
       * professional != starter
       * enterprise != professional
       *
       * Plan hiyerarşisini ilerleyen aşamada ekleyebiliriz.
       */
      if (license.plan_id !== requiredPlan) {
        return res.status(403).json({
          error:
            `Bu özellik ${requiredPlan} planı gerektirmektedir`,
          code: "PLAN_REQUIRED",
          requiredPlan,
          currentPlan: license.plan_id
        });
      }

      req.companyId = normalizedCompanyId;
      req.companyLicense = license;

      return next();

    } catch (error) {

      console.error(
        "requirePlan hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Plan yetkisi kontrol edilirken bir hata oluştu"
      });
    }
  };
}


/**
 * Enterprise ve Professional gibi planların belirli
 * minimum seviyede erişebilmesini sağlayacak middleware.
 *
 * Örnek:
 *
 * requireMinimumPlan("professional")
 *
 * Böylece:
 *
 * Starter       -> DENY
 * Professional  -> ALLOW
 * Enterprise    -> ALLOW
 */
function requireMinimumPlan(minimumPlan) {

  const PLAN_LEVELS = {
    starter: 1,
    professional: 2,
    enterprise: 3
  };

  return async function minimumPlanMiddleware(
    req,
    res,
    next
  ) {

    try {

      const requiredLevel =
        PLAN_LEVELS[minimumPlan];

      if (!requiredLevel) {
        return res.status(500).json({
          error:
            "Geçersiz minimum plan tanımı"
        });
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error:
            "Kimlik doğrulaması gerekli"
        });
      }

      const companyId =
        req.params.companyId ||
        req.body.companyId ||
        req.query.companyId;

      if (!companyId) {
        return res.status(400).json({
          error:
            "companyId belirtilmelidir"
        });
      }

      const normalizedCompanyId =
        String(companyId);

      const hasCompanyAccess =
        Array.isArray(req.user.companyIds) &&
        req.user.companyIds
          .map(String)
          .includes(normalizedCompanyId);

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

      const currentLevel =
        PLAN_LEVELS[license.plan_id] || 0;

      if (currentLevel < requiredLevel) {
        return res.status(403).json({
          error:
            `Bu özellik en az ${minimumPlan} planı gerektirmektedir`,
          code:
            "MINIMUM_PLAN_REQUIRED",
          requiredPlan:
            minimumPlan,
          currentPlan:
            license.plan_id
        });
      }

      req.companyId =
        normalizedCompanyId;

      req.companyLicense =
        license;

      return next();

    } catch (error) {

      console.error(
        "requireMinimumPlan hatası:",
        error
      );

      return res.status(500).json({
        error:
          "Plan seviyesi kontrol edilirken bir hata oluştu"
      });
    }
  };
}


module.exports = {
  requireActiveLicense,
  requireCompanyLicense,
  requirePlan,
  requireMinimumPlan
};
