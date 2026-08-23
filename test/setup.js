/**
 * Jest global test setup.
 *
 * TFRS16 frontend JavaScript dosyaları browser ortamı
 * kullandığı için Jest jsdom environment ile çalışmaktadır.
 */

const {
  TextEncoder,
  TextDecoder
} = require("util");


/**
 * ============================================================
 * TEXT ENCODER / DECODER
 * ============================================================
 */

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}


/**
 * ============================================================
 * FETCH
 * ============================================================
 *
 * Node sürümünde mevcutsa dokunmuyoruz.
 */

if (
  typeof global.fetch === "undefined" &&
  typeof window !== "undefined" &&
  window.fetch
) {
  global.fetch = window.fetch.bind(window);
}


/**
 * ============================================================
 * TEST ENVIRONMENT
 * ============================================================
 */

process.env.NODE_ENV = "test";
