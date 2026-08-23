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
 * ACTIVE LICENSE TEST
 * ============================================================
 *
 * Endpoint:
 *
 * GET /api/license-test/active
 *
 * Amaç:
 *
 * 1. JWT authentication çalışıyor mu?
 * 2. Kullanıcının aktif lisansı var mı?
 * 3. License context doğru oluşturuluyor mu?
 * 4. Highest plan doğru hesaplanıyor mu?
 *
 */
router.get(
  "/active",

  requireAuth,

  requireActiveLicense,

  (req, res) => {

    const license =
      req.license || {};

    const activeLicenses =
      Array.isArray(
        license.activeLicenses
      )
        ? license.activeLicenses
        : [];


    return res.status(200).json({

      success: true,

      message:
        "Aktif lisans doğrulandı",

      license: {

        hasActiveLicense:
          Boolean(
            license.hasActiveLicense
          ),

        highestPlan:
          license.highestPlan || null,

        highestLevel:
          license.highestLevel || 0,

        activeCompanyCount:
          activeLicenses.length,

        activeCompanies:
          activeLicenses.map(
            company => ({

              companyId:
                company?.companyId || null,

              companyName:
                company?.companyName || null,

              hasActiveLicense:
                company?.hasActiveLicense === true,

              planId:
                company?.license?.planId || null,

              planName:
                company?.license?.planName || null,

              status:
                company?.license?.status || null,

              startsAt:
                company?.license?.startsAt || null,

              expiresAt:
                company?.license?.expiresAt || null

            })
          )

      }

    });

  }
);


/**
 * ============================================================
 * PROFESSIONAL PLAN TEST
 * ============================================================
 *
 * Endpoint:
 *
 * GET /api/license-test/professional
 *
 *
 * Minimum:
 *
 * Professional
 *
 * Allowed:
 *
 * Professional
 * Enterprise
 *
 *
 * Denied:
 *
 * Starter
 * No License
 *
 */
router.get(
  "/professional",

  requireAuth,

  requireActiveLicense,

  requirePlan(
    "professional"
  ),

  (req, res) => {

    return res.status(200).json({

      success: true,

      message:
        "Professional veya üzeri lisans doğrulandı",

      license: {

        currentPlan:
          req.license?.highestPlan || null,

        currentLevel:
          req.license?.highestLevel || 0,

        requiredPlan:
          req.license?.requiredPlan || "professional",

        requiredLevel:
          req.license?.requiredLevel || 2,

        hasActiveLicense:
          req.license?.hasActiveLicense === true

      }

    });

  }
);


/**
 * ============================================================
 * ENTERPRISE PLAN TEST
 * ============================================================
 *
 * Endpoint:
 *
 * GET /api/license-test/enterprise
 *
 *
 * Minimum:
 *
 * Enterprise
 *
 * Allowed:
 *
 * Enterprise
 *
 *
 * Denied:
 *
 * Professional
 * Starter
 * No License
 *
 */
router.get(
  "/enterprise",

  requireAuth,

  requireActiveLicense,

  requirePlan(
    "enterprise"
  ),

  (req, res) => {

    return res.status(200).json({

      success: true,

      message:
        "Enterprise lisans doğrulandı",

      license: {

        currentPlan:
          req.license?.highestPlan || null,

        currentLevel:
          req.license?.highestLevel || 0,

        requiredPlan:
          req.license?.requiredPlan || "enterprise",

        requiredLevel:
          req.license?.requiredLevel || 3,

        hasActiveLicense:
          req.license?.hasActiveLicense === true

      }

    });

  }
);


/**
 * ============================================================
 * LICENSE ROUTER ERROR HANDLING
 * ============================================================
 *
 * Normalde global error handler app.js tarafından
 * yönetilecektir.
 *
 * Burada özel bir error middleware eklemiyoruz.
 *
 * Böylece merkezi error handling korunur.
 */


/**
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = router;
