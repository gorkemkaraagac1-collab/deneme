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
          req.license.hasActiveLicense,

        highestPlan:
          req.license.highestPlan,

        activeCompanies:
          req.license.activeLicenses.map(
            company => ({
              companyId:
                company.companyId,

              companyName:
                company.companyName,

              planId:
                company.license?.planId,

              planName:
                company.license?.planName
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
