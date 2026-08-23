/**
 * ============================================================
 * TFRS 16 FINANCIAL INTELLIGENCE PLATFORM
 * Backend Application
 * ============================================================
 *
 * Bu dosya Express application'ı oluşturur.
 *
 * ÖNEMLİ:
 * - Burada app.listen() KULLANILMAZ.
 * - Jest / Supertest doğrudan bu app'i import eder.
 * - HTTP server backend/server.js tarafından başlatılır.
 *
 * Mimari:
 *
 *     app.js
 *       ↓
 *     Express Application
 *       ↓
 *     Routes / Middleware
 *
 * Production:
 *
 *     server.js
 *       ↓
 *     app.js
 *       ↓
 *     app.listen()
 *
 * Test:
 *
 *     Jest
 *       ↓
 *     app.js
 *       ↓
 *     Supertest
 *
 * ============================================================
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");


/**
 * ============================================================
 * ROUTERS
 * ============================================================
 */

const authRouter = require("./routes/auth");

const contractsRouter = require("./routes/contracts");

const auditRouter = require("./routes/audit");

const reportsRouter = require("./routes/reports");

const adminLicenseRouter =
  require("./routes/admin-licenses");

const licenseTestRouter =
  require("./routes/license-test");


/**
 * ============================================================
 * EXPRESS APPLICATION
 * ============================================================
 */

const app = express();


/**
 * ============================================================
 * GLOBAL MIDDLEWARE
 * ============================================================
 */


/**
 * CORS
 *
 * Development aşamasında frontend-backend
 * farklı portlarda çalışabileceği için aktif.
 *
 * Production'da kontrollü origin whitelist
 * uygulanması önerilir.
 */

app.use(
  cors()
);


/**
 * JSON BODY PARSER
 *
 * Maksimum request body:
 * 2 MB
 */

app.use(
  express.json({
    limit: "2mb"
  })
);


/**
 * ============================================================
 * REQUEST LOGGING
 * ============================================================
 *
 * Development / audit trail açısından temel
 * HTTP request logging.
 *
 * Production'da:
 * - request ID
 * - user ID
 * - IP
 * - response status
 * - duration
 *
 * gibi alanlar ayrıca loglanabilir.
 */

app.use(
  (req, res, next) => {

    console.log(
      `${new Date().toISOString()} ${req.method} ${req.path}`
    );

    next();

  }
);


/**
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 *
 * GET /health
 *
 * Load balancer / VPS / Docker / monitoring
 * tarafından kullanılabilir.
 */

app.get(
  "/health",
  (req, res) => {

    res.json({
      status: "ok",
      version: "v26.1-license-system"
    });

  }
);


/**
 * ============================================================
 * AUTHENTICATION ROUTES
 * ============================================================
 *
 * POST /api/auth/login
 *
 * POST /api/auth/register
 *
 * GET /api/auth/me
 *
 * Authentication ve identity işlemleri.
 */

app.use(
  "/api/auth",
  authRouter
);


/**
 * ============================================================
 * ADMIN LICENSE ROUTES
 * ============================================================
 *
 * GET
 * /api/admin/plans
 *
 * GET
 * /api/admin/companies/:companyId/license
 *
 * POST
 * /api/admin/companies/:companyId/license
 *
 * PATCH
 * /api/admin/licenses/:licenseId/extend
 *
 * POST
 * /api/admin/licenses/:licenseId/cancel
 *
 * License administration.
 */

app.use(
  "/api/admin",
  adminLicenseRouter
);


/**
 * ============================================================
 * LICENSE AUTHORIZATION TEST ROUTES
 * ============================================================
 *
 * Bu endpointler production business functionality
 * değildir.
 *
 * Authorization middleware'lerinin doğru çalıştığını
 * doğrulamak amacıyla kullanılmaktadır.
 *
 *
 * GET
 * /api/license-test/active
 *
 * Aktif lisans kontrolü.
 *
 *
 * GET
 * /api/license-test/professional
 *
 * Professional veya üzeri plan kontrolü.
 *
 *
 * GET
 * /api/license-test/enterprise
 *
 * Enterprise plan kontrolü.
 */

app.use(
  "/api/license-test",
  licenseTestRouter
);


/**
 * ============================================================
 * APPLICATION ROUTES
 * ============================================================
 */


/**
 * ------------------------------------------------------------
 * TFRS 16 CONTRACTS
 * ------------------------------------------------------------
 *
 * /api/contracts
 *
 * Contract creation
 * Contract retrieval
 * Contract calculation
 * Contract updates
 * etc.
 */

app.use(
  "/api/contracts",
  contractsRouter
);


/**
 * ------------------------------------------------------------
 * AUDIT
 * ------------------------------------------------------------
 *
 * /api/audit
 *
 * Audit trail / control / audit-related functionality.
 */

app.use(
  "/api/audit",
  auditRouter
);


/**
 * ------------------------------------------------------------
 * REPORTS
 * ------------------------------------------------------------
 *
 * /api/reports
 *
 * Financial reporting endpoints.
 */

app.use(
  "/api/reports",
  reportsRouter
);


/**
 * ============================================================
 * 404 HANDLER
 * ============================================================
 *
 * Hiçbir route request'i karşılamadıysa buraya gelir.
 */

app.use(
  (req, res) => {

    res.status(404).json({

      error:
        "İstenen endpoint bulunamadı"

    });

  }
);


/**
 * ============================================================
 * CENTRAL ERROR HANDLER
 * ============================================================
 *
 * Express error middleware.
 *
 * Route veya middleware içerisinde
 * next(error) çağrıldığında buraya gelir.
 */

app.use(
  (err, req, res, next) => {

    console.error(
      "Unhandled error:",
      err
    );


    /**
     * Eğer response zaten başladıysa
     * Express'in default error handling
     * mekanizmasına bırak.
     */

    if (res.headersSent) {

      return next(err);

    }


    res.status(500).json({

      error:
        "Sunucuda beklenmeyen bir hata oluştu"

    });

  }
);


/**
 * ============================================================
 * EXPORT EXPRESS APPLICATION
 * ============================================================
 *
 * ÇOK ÖNEMLİ:
 *
 * Burada app.listen() YOKTUR.
 *
 * Jest:
 *
 *     const app = require("../backend/app");
 *
 * şeklinde application'ı import eder.
 *
 * Supertest:
 *
 *     request(app)
 *
 * şeklinde çalışır.
 *
 * Production server:
 *
 *     backend/server.js
 *
 * içerisinden app.listen() çağırır.
 */

module.exports = app;
