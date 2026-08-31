/**
 * @jest-environment jsdom
 *
 * ============================================================
 * ŞİRKET YÖNETİMİ / GRUPLAR / ELİMİNASYONLAR / RİSK & KONTROLLER
 * — DASHBOARD LİNKLERİ EKLENDİ
 * ============================================================
 *
 * Şirket Yönetimi/Gruplar/Eliminasyonlar zaten deepLinkMap'te
 * tanımlıydı (renderCompanyManagementPage/renderGroupManagementPage/
 * renderEliminationManagementPage) ama dashboard.html'e link olarak
 * hiç eklenmemişlerdi (taşıma sürecinde atlanmış). Risk & Kontroller
 * ise tamamen ayrı bir modal sistemine (v191Show/v191EnsureModal)
 * bağımlıydı — renderRiskControlsPage bunu normal openInMain akışına
 * uyarladı, v191RenderRiskControls'ün KENDİSİNE dokunulmadı.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
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

describe("deepLinkMap — companies/groups/eliminations/riskControls kayıtlı", () => {
  let tfrs16;
  beforeEach(async () => {
    tfrs16 = await setupTfrs16();
    document.body.insertAdjacentHTML("beforeend", '<div id="host"></div>');
  });

  test("renderCompanyManagementPage host'a hatasız render edilir", () => {
    const host = document.getElementById("host");
    expect(() => tfrs16.renderCompanyManagementPage(host)).not.toThrow();
    expect(host.innerHTML.length).toBeGreaterThan(0);
  });

  test("renderGroupManagementPage host'a hatasız render edilir", () => {
    const host = document.getElementById("host");
    expect(() => tfrs16.renderGroupManagementPage(host)).not.toThrow();
    expect(host.innerHTML.length).toBeGreaterThan(0);
  });

  test("renderEliminationManagementPage host'a hatasız render edilir", () => {
    const host = document.getElementById("host");
    expect(() => tfrs16.renderEliminationManagementPage(host)).not.toThrow();
    expect(host.innerHTML.length).toBeGreaterThan(0);
  });
});

describe("renderRiskControlsPage — v191RenderRiskControls'ü normal sayfa akışına taşır", () => {
  let tfrs16;
  beforeEach(async () => {
    tfrs16 = await setupTfrs16();
    document.body.insertAdjacentHTML("beforeend", '<div id="riskHost"></div>');
  });

  test("hatasız render edilir, başlık ve KPI bölümü içerir", () => {
    const host = document.getElementById("riskHost");
    expect(() => tfrs16.renderRiskControlsPage(host)).not.toThrow();
    expect(host.innerHTML).toMatch(/Risk &amp; Kontroller/);
  });

  test("v191RenderRiskControls'ün KENDİSİ hâlâ bağımsız çağrılabilir (dokunulmadı)", () => {
    const html = tfrs16.v191RenderRiskControls(new Date());
    expect(typeof html).toBe("string");
    expect(html).toMatch(/Open Control Exceptions/);
  });

  test("v191FunctionalModal (eski v191Show modal sistemi) KULLANILMIYOR — bu sayfa kendi container'ına yazıyor", () => {
    const host = document.getElementById("riskHost");
    tfrs16.renderRiskControlsPage(host);
    // Eski modal sistemi tetiklenmiş olsaydı #v191FunctionalModal DOM'a
    // eklenirdi — burada host'un DIŞINDA hiçbir yan etki olmamalı.
    expect(document.getElementById("v191FunctionalModal")).toBeNull();
  });
});

describe("dashboard.html sidebar linkleri (data-v26-open) — dört yeni modül", () => {
  test("frontend/dashboard.html içinde companies/groups/eliminations/riskControls linkleri var", () => {
    const fs = require("fs");
    const path = require("path");
    const html = fs.readFileSync(path.join(__dirname, "../frontend/dashboard.html"), "utf-8");
    expect(html).toMatch(/data-v26-open="companies"/);
    expect(html).toMatch(/data-v26-open="groups"/);
    expect(html).toMatch(/data-v26-open="eliminations"/);
    expect(html).toMatch(/data-v26-open="riskControls"/);
  });
});
