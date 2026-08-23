module.exports = {

  /**
   * Frontend/TFRS16 engine testleri window/document
   * kullandığı için jsdom gereklidir.
   */
  testEnvironment: "jsdom",

  testMatch: [
    "**/test/**/*.test.js"
  ],

  setupFiles: [
    "<rootDir>/test/setup.js"
  ],

  clearMocks: true,

  verbose: true

};
