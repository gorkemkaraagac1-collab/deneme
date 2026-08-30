/**
 * @jest-environment jsdom
 *
 * ============================================================
 * SEÇİLİ SÖZLEŞME GÖSTERGESİ — TESTLER
 * ============================================================
 *
 * Kullanıcı geri bildirimi: Modifikasyon & Reassessment / SLB /
 * Sublease sayfalarında, sözleşme seçildikten sonra hangi sözleşmeye
 * işlem yapılacağına dair hiçbir gösterge yoktu (form içeriği hiçbir
 * yerde sözleşme kimliği göstermiyordu). Bu dosya, üç sayfaya da
 * eklenen v26SelectedContractBanner'ın gerçekten göründüğünü ve
 * sözleşme değiştirildiğinde güncellendiğini doğrular.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function seedContract(overrides = {}) {
  return {
    id: "BANNER-TEST-" + Math.random().toString(36).slice(2),
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 10000,
    discountRate: 18,
    startDate: "2026-01-01",
    endDate: "2027-12-01",
    currency: "TRY",
    paymentFrequency: "monthly",
    paymentTiming: "arrears",
    status: "active",
    ...overrides
  };
}

async function setupWithContracts(tfrs16, contractsList) {
  contractsList.forEach(c => tfrs16.contracts.push(c));
}

describe("v26SelectedContractBanner — saf fonksiyon", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("sözleşme verildiğinde ID/şirket/tedarikçi içeren bir banner HTML'i üretir", () => {
    const contract = seedContract({ id: "LEASE-042", company: "ACME A.Ş.", supplier: "Kiralayan Ltd." });
    const html = tfrs16.v26SelectedContractBanner(contract);
    expect(html).toMatch(/LEASE-042/);
    expect(html).toMatch(/ACME A\.Ş\./);
    expect(html).toMatch(/Kiralayan Ltd\./);
  });

  test("sözleşme null ise boş string döner (hata vermez)", () => {
    expect(tfrs16.v26SelectedContractBanner(null)).toBe("");
  });
});

describe("renderModificationReassessmentPage — seçili sözleşme göstergesi", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await new Promise(resolve => setTimeout(resolve, 0));
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="modReassHost"></div>');
  });

  test("sayfa açıldığında ilk sözleşmenin kimliği banner'da görünür", async () => {
    const c1 = seedContract({ id: "LEASE-A", company: "Şirket A" });
    const c2 = seedContract({ id: "LEASE-B", company: "Şirket B" });
    await setupWithContracts(tfrs16, [c1, c2]);

    const host = document.getElementById("modReassHost");
    tfrs16.renderModificationReassessmentPage(host);

    expect(host.innerHTML).toMatch(/İşlem uygulanacak sözleşme/);
    // İlk sözleşme (alfabetik sıralı) LEASE-A olmalı.
    expect(host.innerHTML).toMatch(/LEASE-A/);
  });

  test("sözleşme değiştirilince banner GÜNCELLENİR (eski sözleşme kimliği kaybolur)", async () => {
    const c1 = seedContract({ id: "LEASE-A", company: "Şirket A" });
    const c2 = seedContract({ id: "LEASE-B", company: "Şirket B" });
    await setupWithContracts(tfrs16, [c1, c2]);

    const host = document.getElementById("modReassHost");
    tfrs16.renderModificationReassessmentPage(host);

    const select = host.querySelector("#v26ModReassContractSelect");
    select.value = "LEASE-B";
    select.dispatchEvent(new Event("change"));

    expect(host.innerHTML).toMatch(/LEASE-B/);
    expect(host.innerHTML).not.toMatch(/İşlem uygulanacak sözleşme:.*LEASE-A/);
  });

  test("hiç sözleşme yokken banner gösterilmez (boş durum mesajı ayrı zaten var)", async () => {
    tfrs16.contracts.length = 0; // paylaşılan state — açıkça boşalt
    const host = document.getElementById("modReassHost");
    tfrs16.renderModificationReassessmentPage(host);
    expect(host.innerHTML).not.toMatch(/İşlem uygulanacak sözleşme/);
  });
});

describe("renderSlbManagementPage — seçili sözleşme göstergesi", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await new Promise(resolve => setTimeout(resolve, 0));
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="slbHost"></div>');
  });

  test("seçili sözleşme kimliği banner'da görünür", async () => {
    const c1 = seedContract({ id: "SLB-A", company: "Şirket SLB" });
    await setupWithContracts(tfrs16, [c1]);

    const host = document.getElementById("slbHost");
    tfrs16.renderSlbManagementPage(host);

    expect(host.innerHTML).toMatch(/İşlem uygulanacak sözleşme/);
    expect(host.innerHTML).toMatch(/SLB-A/);
  });
});

describe("renderSubleaseManagementPage — seçili sözleşme göstergesi", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await new Promise(resolve => setTimeout(resolve, 0));
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="subleaseHost"></div>');
  });

  test("seçili sözleşme kimliği banner'da görünür", async () => {
    const c1 = seedContract({ id: "SUB-A", company: "Şirket Sublease" });
    await setupWithContracts(tfrs16, [c1]);

    const host = document.getElementById("subleaseHost");
    tfrs16.renderSubleaseManagementPage(host);

    expect(host.innerHTML).toMatch(/İşlem uygulanacak sözleşme/);
    expect(host.innerHTML).toMatch(/SUB-A/);
  });
});
