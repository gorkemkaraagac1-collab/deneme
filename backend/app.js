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
 * Basit request logging.
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
 * /api/auth
 *
 * Login
 * Register
 * Me
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
 * Tüm endpoint'lerin içerisinde requireAdmin
 * middleware'i bulunmaktadır.
 *
 * Örnek:
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
 */
app.use(
  "/api/admin",
  adminLicenseRouter
);


/**
 * ============================================================
 * APPLICATION ROUTES
 * ============================================================
 */

app.use(
  "/api/contracts",
  contractsRouter
);

app.use(
  "/api/audit",
  auditRouter
);

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


module.exports = app;
