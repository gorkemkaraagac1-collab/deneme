const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "tfrs16",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "tfrs16",
  port: process.env.DB_PORT || 5432
});

pool.on("error", err => {
  console.error("Beklenmeyen PostgreSQL pool hatası:", err);
});

module.exports = pool;
