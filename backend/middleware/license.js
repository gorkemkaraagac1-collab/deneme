function requirePlan(requiredPlan) {

  const normalizedPlan =
    String(requiredPlan || "")
      .trim()
      .toLowerCase();

  if (!PLAN_LEVELS[normalizedPlan]) {
    throw new Error(
      `Geçersiz plan: ${requiredPlan}`
    );
  }

  return async function planMiddleware(req, res, next) {

    try {

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          error: "Kimlik doğrulaması gereklidir"
        });
      }

      /**
       * requireActiveLicense daha önce çalıştıysa
       * mevcut lisans bilgisini kullan.
       */
      const activeLicenses =
        req.license?.activeLicenses ||
        await getActiveUserLicenses(req.user.id);

      if (activeLicenses.length === 0) {

        return res.status(403).json({
          error: "Aktif lisans bulunmamaktadır",
          code: "NO_ACTIVE_LICENSE"
        });

      }

      /**
       * Kullanıcının sahip olduğu en yüksek plan.
       */
      const highestPlan =
        getHighestPlan(activeLicenses);

      const highestLevel =
        PLAN_LEVELS[highestPlan] || 0;

      const requiredLevel =
        PLAN_LEVELS[normalizedPlan];

      /**
       * Plan authorization.
       */
      if (highestLevel < requiredLevel) {

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

        hasActiveLicense: true,

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
