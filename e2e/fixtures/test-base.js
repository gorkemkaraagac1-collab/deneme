/**
 * ============================================================
 * FAZ 0.4 — ORTAK TEST TABANI
 * ============================================================
 *
 * Her spec'in aynı 6 satırı kopyalaması yerine, kimlik tohumlama
 * ve backend stub'ı burada tek yerden bağlanır. `tfrs16Page`
 * fixture'ı, TFRS16 motoruna girmiş ve önyüklemesi bitmiş bir sayfa verir.
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

  /** TFRS16 motoruna gitmiş ve önyüklemesi tamamlanmış sayfa. */
  tfrs16Page: async ({ stubbedPage }, use) => {
    await stubbedPage.goto("/tfrs16.html");
    // Ana motor kabuğu yüklendiğinde yeni sözleşme eylemi hazırdır.
    await stubbedPage.waitForSelector("#newContractButton", { timeout: 15000 });
    await use(stubbedPage);
  },

  /** Derin bağlantıların private hydration yarışına girmediğini doğrulayan sayfa. */
  delayedPrivatePage: async ({ page, apiStore }, use) => {
    await seedSession(page, DEFAULT_USER);
    apiStore.contracts.push({
      id: "DEEP-LINK-E2E-001",
      company: "E2E Test A.Ş.",
      companyId: "E2E-CO-1",
      supplier: "Hydration Test Supplier",
      monthlyPayment: 100,
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      discountRate: 10,
      currency: "TRY",
      status: "active"
    });
    await installApiStub(page, {
      store: apiStore,
      calculationDelayMs: 300
    });
    const consoleErrors = [];
    page.on("pageerror", error => consoleErrors.push(String(error?.message || error)));
    page.consoleErrors = consoleErrors;
    await use(page);
  }
});

const { expect } = base;

module.exports = { test, expect };
