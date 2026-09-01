const app = require("./app");

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 TFRS16 Backend çalışıyor: port ${PORT}`);
});

module.exports = server;
