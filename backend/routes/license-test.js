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
 * Aktif lisans testi
 */
router.get(
  "/active",
  requireAuth,
  requireActiveLicense,
  (req, res) => {

    return res.json({
      success: true,
      message: "Aktif lisans doğrulandı",

      license: {
        hasActiveLicense:
          req.license?.hasActiveLicense === true ||
          (req.license?.activeLicenses?.length || 0) > 0 ||
          (req.licensedCompanies?.length || 0) > 0,

        highestPlan:
          req.license?.highestPlan || null,

        activeCompanies:
          (
            req.license?.activeLicenses ||
            req.licensedCompanies ||
            []
          ).map(
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
 * Professional ve üzeri plan testi
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
        req.license.highestPlan,

      requiredPlan:
        req.license.requiredPlan
    });

  }
);


/**
 * Enterprise plan testi
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
        req.license.highestPlan,

      requiredPlan:
        req.license.requiredPlan
    });

  }
);

module.exports = router;
