module.exports = {
  testEnvironment: "jsdom",

  roots: [
    "<rootDir>/test",
    "<rootDir>/backend"
  ],

  testMatch: [
    "**/*.test.js",
    "**/*.spec.js"
  ],

  modulePathIgnorePatterns: [
    "<rootDir>/backend/node_modules/"
  ],

  coveragePathIgnorePatterns: [
    "/node_modules/",
    "/test/"
  ],

  clearMocks: true,

  restoreMocks: true
};
