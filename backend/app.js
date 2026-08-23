require("dotenv").config();

const express = require("express");
const cors = require("cors");

const pool = require("./db/pool");

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

app.use(
  express.urlencoded({
    extended: true
  })
);


/**
 * ============================================================
 * REQUEST LOGGING
 * ============================================================
 */

app.use((req, res, next) => {

  console.log(
    `${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();

});


/**
 * ============================================================
 * HEALTH CHECK
 * ============================================================
 */

app.get("/health", async (req, res) => {

  try {

    await pool.query("SELECT 1");

    return res.json({
      status: "ok",
      version: "v26.1-license-system"
    });

  } catch (error) {

    console.error(
      "Health check DB hatası:",
      error
    );

    return res.status(503).json({
      status: "error",
      database: "unavailable"
    });

  }

});


/**
 * ============================================================
 * AUTH
 * ============================================================
 *
 * POST /api/auth/register
 * POST /api/auth/login
 * GET  /api/auth/me
 */

app.use(
  "/api/auth",
  authRouter
);


/**
 * ============================================================
 * CONTRACTS
 * ============================================================
 */

app.use(
  "/api/contracts",
  contractsRouter
);


/**
 * ============================================================
 * AUDIT
 * ============================================================
 */

app.use(
  "/api/audit",
  auditRouter
);


/**
 * ============================================================
 * REPORTS
 * ============================================================
 */

app.use(
  "/api/reports",
  reportsRouter
);


/**
 * ============================================================
 * ADMIN LICENSE MANAGEMENT
 * ============================================================
 *
 * Sadece ADMIN middleware'i kendi route'ları içerisinde
 * kontrol eder.
 *
 * Örnek:
 *
 * GET    /api/admin/plans
 * GET    /api/admin/licenses/:companyId
 * POST   /api/admin/licenses/:companyId
 * PATCH  /api/admin/licenses/:companyId
 * DELETE /api/admin/licenses/:companyId
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
 * Faz 5 authorization testleri için kullanılır.
 *
 * /api/license-test/active
 * /api/license-test/professional
 * /api/license-test/enterprise
 *
 * Production'a geçmeden önce bu route'ları kaldırabiliriz
 * veya ayrı bir internal test mekanizmasına taşıyabiliriz.
 */

app.use(
  "/api/license-test",
  licenseTestRouter
);


/**
 * ============================================================
 * 404 HANDLER
 * ============================================================
 */

app.use((req, res) => {

  return res.status(404).json({
    error: "İstenen endpoint bulunamadı"
  });

});


/**
 * ============================================================
 * GLOBAL ERROR HANDLER
 * ============================================================
 */

app.use(
  (error, req, res, next) => {

    console.error(
      "Unhandled application error:",
      error
    );

    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      error:
        "Sunucu tarafında beklenmeyen bir hata oluştu"
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
      `TFRS16 Backend çalışıyor: http://0.0.0.0:${PORT}`
    );

  }
);
