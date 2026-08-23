module.exports = {

  /**
   * Frontend TFRS16 engine'leri window/document kullandığı
   * için jsdom kullanılmalıdır.
   */
  testEnvironment: "jsdom",


  /**
   * Test dosyaları.
   */
  testMatch: [
    "**/test/**/*.test.js"
  ],


  /**
   * Global test setup.
   */
  setupFiles: [
    "<rootDir>/test/setup.js"
  ],


  /**
   * Mock'ları temizle.
   */
  clearMocks: true,


  /**
   * Test çıktısını okunabilir yap.
   */
  verbose: true,


  /**
   * Jest'in açık handle'ları daha kolay yakalaması için.
   */
  detectOpenHandles: false
};
