const {
  getUserLicenses
} = require("../services/license-service");


/**
 * ============================================================
 * PLAN LEVELS
 * ============================================================
 *
 * Plan hiyerarşisi:
 *
 * Starter       = 1
 * Professional  = 2
 * Enterprise    = 3
 *
 * Örneğin:
 *
 * requirePlan("professional")
 *
 * Professional VEYA Enterprise lisansı olan kullanıcıya
 * erişim verir.
 */
const PLAN_LEVELS = {
  starter: 1,
  professional: 2,
  enterprise: 3
};


/**
 * ============================================================
 * LICENSE HELPERS
 * ============================================================
 */


/**
 * Kullanıcının aktif lisanslarını getirir.
 */
async function getActiveUserLicenses(userId) {

  const licenses =
    await getUserLicenses(userId);

  return licenses.filter(
    license =>
      license.hasActiveLicense === true
  );
}


/**
 * Kullanıcının erişebildiği en yüksek planı bulur.
 */
function getHighestPlan(activeLicenses) {

  let highestPlan = null;
  let highestLevel = 0;

  for (const company of activeLicenses) {

    const planId =
      company.license?.planId;

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
 * Kullanıcının en az bir şirketinde aktif lisans
 * bulunmasını zorunlu kılar.
 *
 * ADMIN rolü için bile bypass yoktur.
 *
 * Bu özellikle önemlidir:
 *
 * ADMIN + lisans yok
 *
 * => 403
 *
 * Böylece şirket lisansı sistemin gerçek authorization
 * katmanı haline gelir.
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


    /**
     * Diğer middleware / route'ların tekrar
     * DB sorgusu yapmasına gerek kalmaması için
     * request context'e ekliyoruz.
     */
    req.license = {

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
 * Örnek:
 *
 * router.get(
 *   "/valuation",
 *   requireAuth,
 *   requireActiveLicense,
 *   requirePlan("professional"),
 *   ...
 * );
 *
 *
 * Professional kullanıcı:
 *     Professional >= Professional → OK
 *
 * Enterprise kullanıcı:
 *     Enterprise >= Professional → OK
 *
 * Starter kullanıcı:
 *     Starter < Professional → 403
 */
function requirePlan(
  requiredPlan
) {

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
       * Eğer requireActiveLicense daha önce
       * çalıştıysa DB sorgusunu tekrar yapmıyoruz.
       */
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
            "NO_ACTIVE_LICENSE",

          message:
            "Bu işlem için aktif bir lisans gereklidir."
        });

      }


      const requiredLevel =
        PLAN_LEVELS[
          normalizedPlan
        ];


      const highestPlan =
        getHighestPlan(
          activeLicenses
        );


      const highestLevel =
        PLAN_LEVELS[
          highestPlan
        ] || 0;


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


module.exports = {

  requireActiveLicense,

  requirePlan,

  getActiveUserLicenses,

  getHighestPlan,

  PLAN_LEVELS

};
