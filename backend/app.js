/**
 * TFRS 16 Backend — Express.js giriş noktası.
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

const PORT = process.env.PORT || 8080;


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
 *
 * GET /api/license-test/active
 *
 * Aktif lisans kontrolü.
 *
 *
 * GET /api/license-test/professional
 *
 * Professional veya üzeri plan kontrolü.
 *
 *
 * GET /api/license-test/enterprise
 *
 * Enterprise plan kontrolü.
 *
 * Bu endpointler production business functionality değildir.
 * Authorization middleware'lerinin doğru çalıştığını
 * doğrulamak amacıyla kullanılmaktadır.
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
 * SERVER START
 * ============================================================
 */

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `🚀 TFRS16 Backend çalışıyor: port ${PORT}`
    );

  }
);
