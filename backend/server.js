/**
 * TFRS 16 Backend — HTTP Server
 *
 * app.js → Express application
 * server.js → HTTP server lifecycle
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
 * Graceful shutdown
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
