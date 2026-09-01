const {
  getUserLicenses,
  getActiveCompanyLicense
} = require("../services/license-service");

const PLAN_LEVELS = {
  starter: 1,
  professional: 2,
  enterprise: 3
};


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


function requirePlan(requiredPlan) {

  const normalizedPlan =
    String(
      requiredPlan || ""
    )
      .trim()
      .toLowerCase();

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
            "Kimlik doğrulaması gereklidir"
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

      if (currentLevel < requiredLevel) {

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
          "Lisans planı kontrol edilirken beklenmeyen bir hata oluştu"

      });

    }

  };
}


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


function requireMinimumPlan(
  minimumPlan
) {

  const normalizedPlan =
    String(
      minimumPlan || ""
    )
      .trim()
      .toLowerCase();

  if (!PLAN_LEVELS[normalizedPlan]) {

    throw new Error(
      `Geçersiz minimum plan: ${minimumPlan}`
    );

  }

  return requirePlan(
    normalizedPlan
  );
}


module.exports = {

  requireActiveLicense,

  requireCompanyLicense,

  requirePlan,

  requireMinimumPlan,

  getActiveUserLicenses,

  getHighestPlan,

  PLAN_LEVELS

};
