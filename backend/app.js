/**
 * TFRS 16 Backend — Express Application
 *
 * Bu dosya sadece Express uygulamasını oluşturur.
 * HTTP server başlatmaz.
 *
 * Testlerde:
 *   require("./app")
 *
 * Production/local çalıştırmada:
 *   backend/server.js
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

  res.status(200).json({
    status: "ok",
    version: "v26.1-license-system"
  });

});


/**
 * ============================================================
 * AUTH
 * ============================================================
 */

app.use(
  "/api/auth",
  authRouter
);


/**
 * ============================================================
 * ADMIN LICENSE
 * ============================================================
 */

app.use(
  "/api/admin",
  adminLicenseRouter
);


/**
 * ============================================================
 * LICENSE TEST
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
 * 404
 * ============================================================
 */

app.use((req, res) => {

  res.status(404).json({
    error: "İstenen endpoint bulunamadı"
  });

});


/**
 * ============================================================
 * ERROR HANDLER
 * ============================================================
 */

app.use((err, req, res, next) => {

  console.error(
    "Unhandled error:",
    err
  );

  res.status(500).json({
    error: "Sunucuda beklenmeyen bir hata oluştu"
  });

});


/**
 * ============================================================
 * EXPORT
 * ============================================================
 */

module.exports = app;
