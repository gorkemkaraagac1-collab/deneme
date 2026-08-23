cat > backend/server.js <<'EOF'
/**
 * TFRS 16 Backend — HTTP Server
 *
 * Express application:
 *   backend/app.js
 *
 * HTTP server:
 *   backend/server.js
 */

require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 8080;

const server = app.listen(
  PORT,
  "0.0.0.0",
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
    `\n${signal} received. Server kapatılıyor...`
  );

  server.close(() => {

    console.log(
      "HTTP server başarıyla kapatıldı."
    );

    process.exit(0);

  });

}


process.on(
  "SIGTERM",
  () => shutdown("SIGTERM")
);

process.on(
  "SIGINT",
  () => shutdown("SIGINT")
);


module.exports = server;
EOF
