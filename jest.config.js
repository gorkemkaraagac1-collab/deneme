cd /workspaces/deneme

cat > jest.config.js <<'EOF'
module.exports = {
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
EOF
