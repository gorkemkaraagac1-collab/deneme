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
 * KAPSANAN UÇLAR (js/tfrs16-engine.js + tfrs16.html taramasından):
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

const API_ORIGIN = "https://api.leaseqant.com";

const DEFAULT_USER = {
  id: "e2e-user-1",
  username: "e2e.kullanici",
  role: "FINANCE_MANAGER",
  companyIds: ["E2E-CO-1"],
  // loadSessionCompanies() (js/tfrs16-engine.js satır ~490) licenses[].companyName'i
  // öncelikli kullanır; bu olmadan select'in seçenek metni sadece
  // companyId (ham "E2E-CO-1") olur. Gerçekçi bir isim için eklendi.
  licenses: [{ companyId: "E2E-CO-1", companyName: "E2E Test A.Ş." }],
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
  return { contracts: seedContracts.map(c => ({ ...c })), calculations: [], tms19Calculations: [] };
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

    // --- Private hesaplama API'si ---
    // API-primary UI testleri gerçek Cloud Run'a gitmez; bunun yerine
    // deterministik bir sonuç döndürür ve isteğin gerçekten yapıldığını
    // store.calculations üzerinden görünür kılar.
    if (path === "/api/calculations/lease" && method === "POST") {
      let payload = {};
      try { payload = JSON.parse(request.postData() || "{}"); } catch (_) { payload = {}; }
      const contract = payload.contract || {};
      store.calculations.push({ contract });
      return route.fulfill(json({
        success: true,
        data: {
          liability: 1000,
          rouAssets: 1000,
          depreciation: 100,
          monthlyInterest: 10,
          advancePaymentAtCommencement: 0,
          months: 1,
          schedule: [{
            date: "2026-01-31",
            payment: 110,
            interest: 10,
            principal: 100,
            closingLiability: 900,
            depreciation: 100,
            rouClosing: 900
          }]
        }
      }));
    }

    // --- Private TMS 19 hesaplama API'si ---
    if (path === "/api/calculations/tms19" && method === "POST") {
      let payload = {};
      try { payload = JSON.parse(request.postData() || "{}"); } catch (_) { payload = {}; }
      const employees = Array.isArray(payload.employees) ? payload.employees : [];
      const assumptions = payload.assumptions || {};
      if (payload.mode === "employee" && payload.employee) {
        const employee = payload.employee;
        store.tms19Calculations.push({ mode: "employee", employee, assumptions });
        return route.fulfill(json({
          success: true,
          data: {
            personelId: employee.personelId,
            puc: { dbo: 1200 },
            quality: { dboPositive: true },
            auditTrail: [{ adim: 1, alan: "DBO", deger: 1200, birim: "TRY", aciklama: "E2E" }]
          }
        }));
      }
      store.tms19Calculations.push({ mode: "portfolio", employees, assumptions });
      const results = employees.map((employee, index) => ({
        index,
        personelId: employee.personelId || `TMS19-E2E-${index + 1}`,
        adSoyad: employee.adSoyad || `E2E Personel ${index + 1}`,
        departman: employee.departman || "Finance",
        pozisyon: employee.pozisyon || "Specialist",
        mevcutMaas: Number(employee.mevcutMaas) || 0,
        yas: 40,
        hizmetSuresi: 5,
        emekliligeKalanYil: 20,
        dbo: 1200,
        cariHizmetMaliyeti: 100,
        faizMaliyeti: 30,
        hesaplamaDurumu: "BAŞARILI",
        sgkRejimEtiketi: "Kademeli (5510)",
        sgkRejimAciklamasi: "E2E",
        eytUygulandi: false
      }));
      return route.fulfill(json({
        success: true,
        data: {
          success: true,
          ui: { results, errors: [], total: results.length, calculated: results.length, failed: 0 },
          actuarial: { success: true, results: [], summary: { personelSayisi: results.length } },
          view: {
            summary: {
              personelSayisi: results.length,
              toplamDBO: results.length * 1200,
              toplamCariHizmetMaliyeti: results.length * 100,
              toplamFaizMaliyeti: results.length * 30,
              toplamFayda: 0,
              ortalamaYas: 40,
              ortalamaHizmet: 5,
              tavanUygulananPersonel: 0
            },
            controls: { durum: "TEMİZ", toplamKontrol: 0, kontroller: [] },
            risk: results.map((result) => ({ personelId: result.personelId, genelRisk: "DÜŞÜK", skor: 0 })),
            sensitivity: [{ ad: "Baz Senaryo", dbo: results.length * 1200, fark: 0, farkYuzde: 0 }],
            report: {
              kpi: {
                personelSayisi: results.length,
                toplamDBO: results.length * 1200,
                toplamCSC: results.length * 100,
                toplamNetInterest: results.length * 30,
                toplamPnL: results.length * 130,
                toplamOCI: 0
              },
              dboRollForward: { reconciled: true },
              toplam: { dbo: results.length * 1200, closingPlanAsset: 0, netDefinedBenefitLiability: results.length * 1200 }
            }
          }
        }
      }));
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
 * tfrs16.html, getToken() yoksa login.html'e yönlendirir; bu yüzden
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
