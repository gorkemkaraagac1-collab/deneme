/**
 * TFRS 16 Backend — HTTP Server
 *
 * Express application:
 *     backend/app.js
 *
 * HTTP server:
 *     backend/server.js
 *
 * Jest testleri app.js'i doğrudan kullanır.
 * Böylece test sırasında port açılmaz.
 */

require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0";


/**
 * ============================================================
 * SERVER START
 * ============================================================
 */

const server = app.listen(
  PORT,
  HOST,
  () => {

    console.log(
      `🚀 TFRS16 Backend çalışıyor: port ${PORT}`
    );

  }
);


/**
 * ============================================================
 * GRACEFUL SHUTDOWN
 * ============================================================
 */

function shutdown(signal) {

  console.log(
    `\n${signal} alındı. Server kapatılıyor...`
  );

  server.close(() => {

    console.log(
      "HTTP server kapatıldı."
    );

    process.exit(0);

  });

}


/**
 * ============================================================
 * PROCESS SIGNALS
 * ============================================================
 */

process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);


/**
 * ============================================================
 * UNHANDLED ERRORS
 * ============================================================
 */

process.on(
  "unhandledRejection",
  error => {

    console.error(
      "Unhandled Promise Rejection:",
      error
    );

  }
);

process.on(
  "uncaughtException",
  error => {

    console.error(
      "Uncaught Exception:",
      error
    );

    shutdown("uncaughtException");

  }
);


module.exports = server;
