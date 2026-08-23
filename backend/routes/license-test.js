const express = require("express");

const {
  requireAuth
} = require("../middleware/auth");

const {
  requireActiveLicense,
  requirePlan
} = require("../middleware/license");

const router = express.Router();


/**
 * ============================================================
 * AKTİF LİSANS TESTİ
 * ============================================================
 *
 * GET
 * /api/license-test/active
 *
 * Kullanıcının en az bir aktif lisansı olup olmadığını
 * doğrular.
 */
router.get(
  "/active",
  requireAuth,
  requireActiveLicense,
  (req, res) => {

    const activeLicenses =
      req.license?.activeLicenses ||
      req.licensedCompanies ||
      [];

    const highestPlan =
      req.license?.highestPlan ||
      null;

    return res.json({

      success: true,

      message:
        "Aktif lisans doğrulandı",

      license: {

        hasActiveLicense:
          activeLicenses.length > 0,

        highestPlan,

        activeCompanies:
          activeLicenses.map(
            company => ({

              companyId:
                company.companyId,

              companyName:
                company.companyName,

              planId:
                company.license?.planId ||
                company.planId ||
                company.plan_id ||
                null,

              planName:
                company.license?.planName ||
                company.planName ||
                null

            })
          )

      }

    });

  }
);


/**
 * ============================================================
 * PROFESSIONAL PLAN TESTİ
 * ============================================================
 *
 * Professional veya Enterprise kullanıcılar
 * erişebilmelidir.
 */
router.get(
  "/professional",
  requireAuth,
  requireActiveLicense,
  requirePlan("professional"),
  (req, res) => {

    return res.json({

      success: true,

      message:
        "Professional veya üzeri lisans doğrulandı",

      currentPlan:
        req.license?.highestPlan || null,

      requiredPlan:
        req.license?.requiredPlan ||
        "professional"

    });

  }
);


/**
 * ============================================================
 * ENTERPRISE PLAN TESTİ
 * ============================================================
 *
 * Sadece Enterprise kullanıcılar erişebilmelidir.
 */
router.get(
  "/enterprise",
  requireAuth,
  requireActiveLicense,
  requirePlan("enterprise"),
  (req, res) => {

    return res.json({

      success: true,

      message:
        "Enterprise lisans doğrulandı",

      currentPlan:
        req.license?.highestPlan || null,

      requiredPlan:
        req.license?.requiredPlan ||
        "enterprise"

    });

  }
);


module.exports = router;
