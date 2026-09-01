/**
 * ============================================================
 * FAZ 0.4 — BACKEND STUB
 * ============================================================
 *
 * Smoke testler GERÇEK backend'e (Cloud Run) BAĞLANMAZ. Nedenleri:
 *  - Üretim verisine yazan bir test paketi güvenli değildir.
 *  - Ağ/deploy dalgalanması smoke testi gürültülü yapar; gürültülü
 *    test görmezden gelinir ve güvenlik ağı ölür.
 *  - Refaktörün doğrulaması UI davranışıdır, backend değil.
 *
 * Bu modül tüm /api/** çağrılarını yakalar ve bellek içi bir
 * kontrat deposuyla yanıtlar. Depo test başına sıfırlanır.
 *
 * KAPSANAN UÇLAR (js/tfrs16.js + frontend/dashboard.html taramasından):
 *   GET    /api/auth/me
 *   GET    /api/contracts
 *   POST   /api/contracts
 *   PUT    /api/contracts/:id
 *   DELETE /api/contracts/:id
 *   GET    /api/customer/license
 *   GET    /api/admin/companies
 *   GET    /api/inflation-indices
 */

"use strict";

const API_ORIGIN = "https://deneme-git-285469227510.europe-west1.run.app";

const DEFAULT_USER = {
  id: "e2e-user-1",
  username: "e2e.kullanici",
  role: "FINANCE_MANAGER",
  companyIds: ["E2E-CO-1"],
  mustChangePassword: false
};

const DEFAULT_COMPANY = {
  id: "E2E-CO-1",
  name: "E2E Test A.Ş.",
  functionalCurrency: "TRY",
  reportingCurrency: "TRY"
};

const DEFAULT_LICENSE = {
  plan: "PROFESSIONAL",
  status: "ACTIVE",
  startDate: "2026-01-01",
  endDate: "2027-12-31",
  maxUsers: 25
};

/** Bellek içi kontrat deposu — her test kendi örneğini alır. */
function createStore(seedContracts = []) {
  return { contracts: seedContracts.map(c => ({ ...c })) };
}

function json(body, status = 200) {
  return {
    status,
    contentType: "application/json",
    body: JSON.stringify(body)
  };
}

/**
 * Sayfaya API stub'ını bağlar.
 *
 * @param {import('@playwright/test').Page} page
 * @param {Object} [options]
 * @param {Object} [options.user]
 * @param {Array}  [options.contracts]
 * @param {Object} [options.store] Dışarıdan verilirse test doğrudan inceleyebilir.
 * @returns {Promise<Object>} store
 */
async function installApiStub(page, options = {}) {
  const store = options.store || createStore(options.contracts || []);
  const user = { ...DEFAULT_USER, ...(options.user || {}) };

  await page.route(`${API_ORIGIN}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method().toUpperCase();

    // --- Kimlik ---
    if (path === "/api/auth/me") {
      return route.fulfill(json({ success: true, data: user }));
    }

    // --- Kontratlar ---
    if (path === "/api/contracts" && method === "GET") {
      return route.fulfill(json(store.contracts));
    }

    if (path === "/api/contracts" && method === "POST") {
      let payload = {};
      try { payload = JSON.parse(request.postData() || "{}"); } catch (_) { payload = {}; }
      const record = { ...payload, id: payload.id || `E2E-${store.contracts.length + 1}` };
      store.contracts.push(record);
      return route.fulfill(json({ success: true, data: record }, 201));
    }

    const contractMatch = path.match(/^\/api\/contracts\/(.+)$/);
    if (contractMatch) {
      const id = decodeURIComponent(contractMatch[1]);
      const index = store.contracts.findIndex(c => String(c.id) === id);

      if (method === "PUT") {
        let payload = {};
        try { payload = JSON.parse(request.postData() || "{}"); } catch (_) { payload = {}; }
        if (index >= 0) {
          store.contracts[index] = { ...store.contracts[index], ...payload, id };
        } else {
          store.contracts.push({ ...payload, id });
        }
        return route.fulfill(json({ success: true, data: { id } }));
      }

      if (method === "DELETE") {
        if (index >= 0) store.contracts.splice(index, 1);
        return route.fulfill(json({ success: true }));
      }
    }

    // --- Lisans / şirket / endeks ---
    if (path === "/api/customer/license") {
      return route.fulfill(json({ success: true, data: DEFAULT_LICENSE }));
    }

    if (path === "/api/admin/companies") {
      return route.fulfill(json({ success: true, data: [DEFAULT_COMPANY] }));
    }

    if (path === "/api/inflation-indices") {
      return route.fulfill(json({ success: true, data: [] }));
    }

    // Kapsanmayan bir uç çağrılırsa SESSİZCE boş dönmek yerine
    // görünür bir hata döndürülür — testin neyi kaçırdığı belli olsun.
    return route.fulfill(
      json({ success: false, error: `E2E stub kapsamında olmayan uç: ${method} ${path}` }, 501)
    );
  });

  return store;
}

/**
 * Sayfa yüklenmeden ÖNCE oturum token'ını yerleştirir.
 * dashboard.html, getToken() yoksa login.html'e yönlendirir; bu yüzden
 * token navigasyondan önce mevcut olmalıdır.
 */
async function seedSession(page, user = DEFAULT_USER) {
  await page.addInitScript(
    ({ currentUser }) => {
      localStorage.setItem("access_token", "e2e-fake-jwt-token");
      localStorage.setItem("current_user", JSON.stringify(currentUser));
    },
    { currentUser: user }
  );
}

module.exports = {
  API_ORIGIN,
  DEFAULT_USER,
  DEFAULT_COMPANY,
  DEFAULT_LICENSE,
  createStore,
  installApiStub,
  seedSession
};
