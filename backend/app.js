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

const contractsRouter = require("./routes/contracts");
const auditRouter = require("./routes/audit");
const reportsRouter = require("./routes/reports");

const app = express();
const PORT = process.env.PORT || 3000;

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

app.use("/api/contracts", contractsRouter);
app.use("/api/audit", auditRouter);
app.use("/api/reports", reportsRouter);

// Merkezi hata yakalayıcı
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`🚀 TFRS16 Backend çalışıyor: http://localhost:${PORT}`);
});

module.exports = app;
