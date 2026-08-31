/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FİNANSAL RAPORLAMA — DASHBOARD'A TAŞINDI
 * ============================================================
 *
 * Kullanıcı kararı: SADECE Finansal Raporlama taşınıyor. CFO
 * Dashboard, Ay Sonu Kapanış, Integration, Reconciliation, Contract
 * Financial Tools kapsam dışı bırakıldı (taşınmıyor) — CFO Cockpit
 * projesi ileri bir tarihe ertelendi.
 *
 * v191RenderFinancialReporting'in KENDİSİNE dokunulmadı. İçindeki
 * period picker (v191ApplyPeriod/v191ResetPeriod) önceden her zaman
 * v191OpenFinancialReporting()'i (eski v191Show modal sistemini)
 * çağırıyordu — Dipnotlar sayfasında çözdüğümüz AYNI sorun, AYNI
 * v191TriggerActiveScreenRefresh callback mekanizmasıyla düzeltildi.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function seedContract(overrides = {}) {
  return {
    id: "FINREP-TEST-" + Math.random().toString(36).slice(2),
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 10000,
    discountRate: 18,
    startDate: "2026-01-01",
    endDate: "2027-12-01",
    currency: "TRY",
    status: "active",
    ...overrides
  };
}

async function setupTfrs16() {
  localStorage.clear();
  localStorage.setItem("access_token", "fake-token-for-test");
  const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true, status: 200, text: async () => JSON.stringify({ success: true })
  });
  const tfrs16 = loadTfrs16();
  await flushPromises();
  initFetchSpy.mockRestore();
  return tfrs16;
}

describe("renderFinancialReportingPage — sayfa yapısı", () => {
  let tfrs16;
  beforeEach(async () => {
    tfrs16 = await setupTfrs16();
    document.body.insertAdjacentHTML("beforeend", '<div id="finRepHost"></div>');
  });

  test("hatasız render edilir, başlık ve period picker içerir", () => {
    const host = document.getElementById("finRepHost");
    expect(() => tfrs16.renderFinancialReportingPage(host)).not.toThrow();
    expect(host.innerHTML).toMatch(/Finansal Raporlama/);
    expect(host.querySelector("#v191PeriodStartInput")).toBeTruthy();
    expect(host.querySelector("#v191PeriodEndInput")).toBeTruthy();
  });

  test("KPI kartlarını içerir (Lease Liability vb.)", () => {
    const host = document.getElementById("finRepHost");
    tfrs16.renderFinancialReportingPage(host);
    expect(host.innerHTML).toMatch(/Lease Liability/);
  });

  test("eski v191FunctionalModal sistemi KULLANILMIYOR", () => {
    const host = document.getElementById("finRepHost");
    tfrs16.renderFinancialReportingPage(host);
    expect(document.getElementById("v191FunctionalModal")).toBeNull();
  });
});

describe("DÜZELTME: period picker 'Uygula' butonu DOĞRU ekranı (bu sayfayı) yeniliyor", () => {
  let tfrs16;
  beforeEach(async () => {
    tfrs16 = await setupTfrs16();
    tfrs16.contracts.push(seedContract());
    document.body.insertAdjacentHTML("beforeend", '<div id="finRepHost2"></div>');
  });

  test("v191ApplyPeriod çağrıldığında bu sayfa yeniden render edilir, eski modal AÇILMAZ", () => {
    const host = document.getElementById("finRepHost2");
    tfrs16.renderFinancialReportingPage(host);

    const startInput = host.querySelector("#v191PeriodStartInput");
    const endInput = host.querySelector("#v191PeriodEndInput");
    startInput.value = "2026-01-01";
    endInput.value = "2026-06-30";

    tfrs16.v191ApplyPeriod();

    // Eski v191Show modal sistemi TETİKLENMEMİŞ olmalı.
    expect(document.getElementById("v191FunctionalModal")).toBeNull();
    // Sayfa hâlâ dolu ve tutarlı (host DOM'dan silinmedi/bozulmadı).
    expect(host.innerHTML).toMatch(/Finansal Raporlama/);
  });

  test("v191ResetPeriod çağrıldığında da DOĞRU sayfa yenilenir", () => {
    const host = document.getElementById("finRepHost2");
    tfrs16.renderFinancialReportingPage(host);

    tfrs16.v191ResetPeriod();

    expect(document.getElementById("v191FunctionalModal")).toBeNull();
    expect(host.innerHTML).toMatch(/Finansal Raporlama/);
  });
});

describe("v191RenderFinancialReporting — hâlâ bağımsız çağrılabilir (dokunulmadı)", () => {
  let tfrs16;
  beforeEach(async () => {
    tfrs16 = await setupTfrs16();
  });

  test("doğrudan çağrıldığında hâlâ HTML string döndürüyor", () => {
    const html = tfrs16.v191RenderFinancialReporting(new Date("2026-12-31"));
    expect(typeof html).toBe("string");
    expect(html).toMatch(/Lease Liability/);
  });
});

describe("dashboard.html — Finansal Raporlama linki eklendi", () => {
  test("frontend/dashboard.html içinde data-v26-open=\"financialReporting\" var", () => {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(path.join(__dirname, "../frontend/dashboard.html"), "utf-8");
    expect(html).toMatch(/data-v26-open="financialReporting"/);
  });
});

describe("tfrs16.html — 'CFO Cockpit' nav-item linki düzeltildi", () => {
  test("artık root'taki eski/terk edilmiş dashboard.html'e DEĞİL, frontend/dashboard.html'e gidiyor", () => {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(path.join(__dirname, "../tfrs16.html"), "utf-8");
    expect(html).toMatch(/href="frontend\/dashboard\.html"/);
    // Eski, YANLIŞ hedefe giden link (bare "dashboard.html") artık YOK.
    expect(html).not.toMatch(/href="dashboard\.html"/);
  });

  test("CFO Cockpit projesi ertelendiği için nav-item ismi artık 'CFO Cockpit' DEĞİL (kafa karışıklığını önlemek için)", () => {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(path.join(__dirname, "../tfrs16.html"), "utf-8");
    const navSection = html.match(/<nav class="navigation">[\s\S]*?<\/nav>/)[0];
    expect(navSection).not.toMatch(/CFO Cockpit/);
  });
});
