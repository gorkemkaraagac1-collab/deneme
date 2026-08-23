/**
 * TFRS 16 Backend — Express Application
 *
 * Bu dosya sadece Express application oluşturur.
 *
 * DİKKAT:
 * Burada app.listen() YOKTUR.
 *
 * Production server başlangıcı:
 * backend/server.js
 *
 * Bunun ayrılmasının nedeni:
 * - Jest testlerinde gerçek HTTP server açılmasını engellemek
 * - EADDRINUSE problemlerini önlemek
 * - Application ile infrastructure katmanını ayırmak
 */

require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRouter = require("./routes/auth");
const contractsRouter = require("./routes/contracts");
const auditRouter = require("./routes/audit");
const reportsRouter = require("./routes/reports");
const adminLicenseRouter = require("./routes/admin-licenses");
const licenseTestRouter = require("./routes/license-test");

const app = express();


/**
 * ============================================================
 * GLOBAL MIDDLEWARE
 * ============================================================
 */

app.use(cors());

app.use(
  express.json({
    limit: "2mb"
  })
);


/**
 * ============================================================
 * REQUEST LOGGING
 * ============================================================
 */

app.use((req, res, next) => {

  console.log(
    `${new Date().toISOString()} ${req.method} ${req.path}`
  );

  next();
});


/**
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 */

app.get("/health", (req, res) => {

  res.json({
    status: "ok",
    version: "v26.1-license-system"
  });

});


/**
 * ============================================================
 * AUTH ROUTES
 * ============================================================
 *
 * POST /api/auth/login
 * POST /api/auth/register
 * GET  /api/auth/me
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
 * GET   /api/admin/plans
 * GET   /api/admin/companies/:companyId/license
 * POST  /api/admin/companies/:companyId/license
 * PATCH /api/admin/licenses/:licenseId/extend
 * POST  /api/admin/licenses/:licenseId/cancel
 */

app.use(
  "/api/admin",
  adminLicenseRouter
);


/**
 * ============================================================
 * LICENSE AUTHORIZATION TEST ROUTES
 * ============================================================
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
 * TFRS 16 Contracts
 */
app.use(
  "/api/contracts",
  contractsRouter
);


/**
 * Audit
 */
app.use(
  "/api/audit",
  auditRouter
);


/**
 * Reports
 */
app.use(
  "/api/reports",
  reportsRouter
);


/**
 * ============================================================
 * 404 HANDLER
 * ============================================================
 */

app.use((req, res) => {

  res.status(404).json({
    error:
      "İstenen endpoint bulunamadı"
  });

});


/**
 * ============================================================
 * CENTRAL ERROR HANDLER
 * ============================================================
 */

app.use(
  (err, req, res, next) => {

    console.error(
      "Unhandled error:",
      err
    );

    res.status(500).json({
      error:
        "Sunucuda beklenmeyen bir hata oluştu"
    });

  }
);


/**
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = app;
