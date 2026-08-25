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

const { securityHeaders } = require("./middleware/security-headers");
const { createRateLimiter } = require("./middleware/rate-limit");

const authRouter = require("./routes/auth");
const contractsRouter = require("./routes/contracts");
const auditRouter = require("./routes/audit");
const reportsRouter = require("./routes/reports");
const adminLicenseRouter = require("./routes/admin-licenses");
const licenseTestRouter = require("./routes/license-test");
const inflationIndicesRouter = require("./routes/inflation-indices");

const app = express();


/**
 * ============================================================
 * TRUST PROXY
 * ============================================================
 *
 * Production'da bu servis genellikle bir load balancer / reverse
 * proxy (ör. Nginx, ALB) arkasında çalışır. req.ip'nin gerçek
 * istemci IP'sini yansıtması (ve dolayısıyla rate limiting'in
 * doğru çalışması) için TRUST_PROXY ortam değişkeni ile kontrollü
 * biçimde etkinleştirilir. Varsayılan olarak KAPALIDIR — aksi
 * halde bir saldırgan X-Forwarded-For header'ını sahteleyerek
 * rate limiting'i atlatabilir.
 */
if (process.env.TRUST_PROXY) {
  app.set("trust proxy", process.env.TRUST_PROXY);
}


/**
 * ============================================================
 * GLOBAL MIDDLEWARE
 * ============================================================
 */

app.use(securityHeaders);

/**
 * CORS
 *
 * Production'da CORS_ORIGINS ortam değişkeni ile virgülle
 * ayrılmış bir origin allowlist'i tanımlanmalıdır
 * (ör. "https://app.example.com,https://admin.example.com").
 *
 * CORS_ORIGINS tanımlı değilse:
 * - production dışı ortamlarda (development/test) tüm origin'lere
 *   izin verilir (yerel geliştirme kolaylığı için),
 * - production'da ise HİÇBİR cross-origin isteğe izin verilmez
 *   (güvenli varsayılan / fail-closed).
 */
const configuredOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {

    // origin yoksa (server-to-server, curl, mobil uygulama vb.)
    // Origin header'ı gönderilmez — bu durumda engellemiyoruz.
    if (!origin) {
      return callback(null, true);
    }

    if (configuredOrigins.length > 0) {
      return callback(
        null,
        configuredOrigins.includes(origin)
      );
    }

    if (process.env.NODE_ENV === "production") {
      // Fail-closed: production'da allowlist tanımlanmadıysa
      // hiçbir cross-origin isteğe izin verilmez.
      return callback(null, false);
    }

    // development / test: yerel geliştirmeyi kolaylaştırmak için
    // serbest bırakılır.
    return callback(null, true);
  },
  credentials: true
};

app.use(cors(corsOptions));

app.use(
  express.json({
    limit: "2mb"
  })
);


/**
 * ============================================================
 * RATE LIMITING — ADMIN & LICENSE ENDPOINTS
 * ============================================================
 *
 * Login/register limitleri kendi router'ında (routes/auth.js)
 * tanımlıdır çünkü daha sıkı, endpoint'e özel eşiklere ihtiyaç
 * duyarlar. Burada admin işlemleri için daha genel bir abuse
 * koruması uygulanır.
 */
const adminRateLimiter = createRateLimiter({
  windowMs: Number(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.ADMIN_RATE_LIMIT_MAX) || 300,
  keyGenerator: req => `admin:${req.ip}`,
  message:
    "Admin endpoint'lerine çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin."
});


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
  adminRateLimiter,
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
 * INFLATION INDICES (TÜİK / TFRS 16 — TMS 29 restatement veri kaynağı)
 * ============================================================
 *
 * Bağımsız bir "/api/tms29" DEĞİLDİR — TFRS 16'nın enflasyon
 * düzeltmesi bileşenine veri sağlayan yardımcı bir endpoint.
 * Kendi router'ı içinde requireAuth/requireActiveLicense/
 * requireAdmin ve rate limiting zaten uygulanıyor (bkz.
 * routes/inflation-indices.js).
 */
app.use(
  "/api/inflation-indices",
  inflationIndicesRouter
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
