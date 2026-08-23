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
 * Request logging.
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
 */

app.use(
  "/api/auth",
  authRouter
);


/**
 * ============================================================
 * ADMIN LICENSE ROUTES
 * ============================================================
 */

app.use(
  "/api/admin",
  adminLicenseRouter
);


/**
 * ============================================================
 * LICENSE TEST ROUTES
 * ============================================================
 *
 * Test / doğrulama endpoint'leri.
 *
 * Örnek:
 *
 * GET /api/license-test/active
 * GET /api/license-test/professional
 * GET /api/license-test/enterprise
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
