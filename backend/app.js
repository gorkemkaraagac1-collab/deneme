/**
 * TFRS 16 Backend — Express.js giriş noktası.
 *
 * Bu, V20 localStorage API contract'ının gelecekte gerçek bir
 * backend'e taşınması için hazırlanmış bir ISKELETTIR (boilerplate).
 * Frontend (tfrs16.js) şu an hâlâ localStorage kullanıyor; bu sunucu
 * paralel olarak geliştirilip test edilebilir, henüz frontend'e
 * bağlanmamıştır.
 */
require("dotenv").config();

const express = require("express");
const cors = require("cors");

const authRouter = require("./routes/auth");
const contractsRouter = require("./routes/contracts");
const auditRouter = require("./routes/audit");
const reportsRouter = require("./routes/reports");

const app = express();

// Cloud Run varsayılan portu 8080'dir; ortam değişkeni yoksa 8080 kullanılır.
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Basit istek loglama (üretimde pino/morgan ile değiştirilebilir)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", version: "v25.1-backend-boilerplate" });
});

// /api/auth: register/login — kimlik doğrulama gerektirmez
app.use("/api/auth", authRouter);

// Aşağıdaki üç router'ın İÇİNDE (router.use(requireAuth)) zaten auth
// zorunlu kılınmıştır.
app.use("/api/contracts", contractsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/reports", reportsRouter);

// Merkezi hata yakalayıcı
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// '0.0.0.0' eklenerek Cloud Run/Docker konteyner trafiğinin kabul edilmesi sağlandı.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TFRS16 Backend çalışıyor: port ${PORT}`);
});

module.exports = app;
