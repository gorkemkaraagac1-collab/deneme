/**
 * ============================================================
 * FAZ 0.4 — ORTAK TEST TABANI
 * ============================================================
 *
 * Her spec'in aynı 6 satırı kopyalaması yerine, kimlik tohumlama
 * ve backend stub'ı burada tek yerden bağlanır. `dashboardPage`
 * fixture'ı, dashboard'a girmiş ve önyüklemesi bitmiş bir sayfa verir.
 */

"use strict";

const base = require("@playwright/test");
const { installApiStub, seedSession, createStore, DEFAULT_USER } = require("./api-stub");

const test = base.test.extend({
  /** Bellek içi kontrat deposu — test doğrudan inceleyebilir. */
  apiStore: async ({}, use) => {
    await use(createStore());
  },

  /** Kimliği tohumlanmış, API'si stub'lanmış ham sayfa. */
  stubbedPage: async ({ page, apiStore }, use) => {
    await seedSession(page, DEFAULT_USER);
    await installApiStub(page, { store: apiStore });

    // Konsol hataları sessizce yutulmasın — smoke testin asıl değeri
    // "sayfa patladı mı" sorusunu cevaplamasıdır.
    const consoleErrors = [];
    page.on("pageerror", error => consoleErrors.push(String(error?.message || error)));
    page.consoleErrors = consoleErrors;

    await use(page);
  },

  /** Dashboard'a gitmiş ve önyüklemesi tamamlanmış sayfa. */
  dashboardPage: async ({ stubbedPage }, use) => {
    await stubbedPage.goto("/frontend/dashboard.html");
    // loadDashboard() /api/auth/me'yi bekler; kullanıcı adı yazılınca hazır.
    await stubbedPage.waitForSelector("#userDisplay:not(:empty)", { timeout: 15000 });
    await use(stubbedPage);
  }
});

const { expect } = base;

module.exports = { test, expect };
