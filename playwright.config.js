/**
 * ============================================================
 * FAZ 0.4 — PLAYWRIGHT YAPILANDIRMASI
 * ============================================================
 *
 * KAPSAM KURALI (refaktör planı Faz 0.4):
 * Playwright HER FONKSİYON için değil, YALNIZCA DOM'A DOKUNAN
 * fonksiyonlar için zorunlu koşulur (render / modal / event wiring —
 * Faz 3'ün 2. ve 3. alt grupları). Saf hesaplama fonksiyonları
 * (calculation engine, journal generator) golden-output + accounting
 * invariants ile DOM'suz zaten güvence altındadır; her fonksiyonda
 * tam Playwright koşumu gereksiz yavaşlatma yaratır.
 *
 * Bu kısıtı kaldırmak isterseniz: PLAYWRIGHT_ALL=1 ile koşun ve
 * Faz 3 doğrulama zincirinin 5. adımını her fonksiyona uygulayın.
 *
 * BACKEND: Testler GERÇEK backend'e (Cloud Run) BAĞLANMAZ. Tüm
 * /api/** çağrıları e2e/fixtures/api-stub.js tarafından yakalanır.
 * Bu kasıtlıdır — smoke testin amacı UI akışının çalıştığını
 * doğrulamak, backend'i test etmek değil; ayrıca üretim verisine
 * dokunan bir test paketi güvenli değildir.
 */

const fs = require("fs");
const { defineConfig, devices } = require("@playwright/test");

const PORT = Number(process.env.E2E_PORT || 4173);

/**
 * `playwright install` bu ortamda ağ allowlist'i nedeniyle başarısız
 * oluyor (cdn.playwright.dev erişilemiyor). Sistemde hazır uyumlu bir
 * Chromium ikilisi varsa onu kullanır. `PLAYWRIGHT_CHROMIUM_PATH` ile
 * açıkça geçersiz kılınabilir. Hiçbiri yoksa `undefined` döner —
 * Playwright kendi indirdiği tarayıcıyı kullanır (normal davranış).
 */
function resolveLocalChromium() {
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) return process.env.PLAYWRIGHT_CHROMIUM_PATH;
  const candidates = [
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    "/opt/google/chrome/chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome"
  ];
  return candidates.find(p => fs.existsSync(p));
}

module.exports = defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.js",

  // Smoke testler hızlı olmalı; takılan bir test CI'ı kilitlememeli.
  timeout: 60000,
  expect: { timeout: 10000 },

  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: Boolean(process.env.CI),

  reporter: process.env.CI
    ? [["list"], ["html", { outputFolder: "e2e-report", open: "never" }]]
    : [["list"]],

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off"
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Bu ortamda cdn.playwright.dev ağ allowlist dışında —
        // `playwright install` başarısız olur. Sistemde hazır duran
        // uyumlu bir Chromium ikilisi (141.0.7390.37) varsa onu
        // kullan; yoksa (örn. CI/production makinesi) Playwright
        // kendi indirdiği tarayıcıyı kullanır (executablePath undefined
        // olur ve varsayılan davranışa döner).
        launchOptions: {
          executablePath: resolveLocalChromium(),
          args: ["--no-sandbox"]
        }
      }
    }
  ],

  // Depo kökü statik olarak servis edilir; frontend/dashboard.html
  // ../js/tfrs16.js'i göreli yolla yükler, bu yüzden KÖK servis edilmeli.
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 30000
  }
});
