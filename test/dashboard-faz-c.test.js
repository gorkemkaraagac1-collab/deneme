/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ C — CİLA + FAZ B'NİN DASHBOARD'DA GERÇEKTEN ÇALIŞMASI
 * ============================================================
 *
 * Faz C kapsamında bulunan İKİ GERÇEK HATA:
 *
 * 1) Faz B'de sözleşme detayı 7 tab'a bölündü — ama #detailModal
 *    SADECE tfrs16.html'de vardı, dashboard.html'de YOKTU. Yani
 *    dashboard'dan bir sözleşmeye tıklandığında openDetail() erken
 *    return ediyor, HİÇBİR ŞEY açılmıyordu. Faz B dashboard'da
 *    fiilen çalışmıyordu.
 *
 * 2) Detay modalındaki üç buton (Erken Ödeme / PDF / HTML export)
 *    inline onclick'te `selectedContractId` değişkenini ÇIPLAK bir
 *    global gibi kullanıyordu — ama o değişken js/tfrs16.js'in IIFE
 *    closure'ının İÇİNDE, window'a hiç açılmamıştı. Yani bu üç buton
 *    tfrs16.html'de DE HER ZAMAN ReferenceError ile patlıyordu.
 *    GK_TFRS16.getSelectedContractId() eklendi, onclick'ler düzeltildi.
 */

const fs = require("fs");
const path = require("path");
const { loadTfrs16 } = require("./helpers/loadTfrs16");

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function readFile(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf-8");
}

function seedContract(overrides = {}) {
  return {
    id: "FAZC-" + Math.random().toString(36).slice(2),
    company: "Cila A.Ş.",
    companyId: "C-1",
    supplier: "Cila Tedarikçi",
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

describe("HATA 1 — sözleşme detay modalı dashboard'a eklendi", () => {
  test("frontend/dashboard.html artık #detailModal / #detailContent / #detailTitle içeriyor", () => {
    const html = readFile("frontend/dashboard.html");
    expect(html).toMatch(/id="detailModal"/);
    expect(html).toMatch(/id="detailContent"/);
    expect(html).toMatch(/id="detailTitle"/);
    expect(html).toMatch(/id="scheduleTableContainer"/);
  });

  test("detay modalının aksiyon butonları da mevcut (Sil / Kapat / export)", () => {
    const html = readFile("frontend/dashboard.html");
    expect(html).toMatch(/id="deleteContract"/);
    expect(html).toMatch(/id="detailCloseButton"/);
    expect(html).toMatch(/id="closeDetailModal"/);
  });
});

describe("HATA 2 — selectedContractId artık GK_TFRS16 üzerinden erişilebilir", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    document.body.insertAdjacentHTML("beforeend", `
      <div id="detailModal" class="modal hidden">
        <h2 id="detailTitle">-</h2>
        <div id="detailContent"></div>
        <div id="scheduleTableContainer"></div>
      </div>
    `);
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await flushPromises();
    spy.mockRestore();
  });

  afterEach(() => { document.body.innerHTML = ""; });

  test("GK_TFRS16.getSelectedContractId fonksiyonu var", () => {
    expect(typeof window.GK_TFRS16.getSelectedContractId).toBe("function");
  });

  test("openDetail çağrılmadan önce null, çağrıldıktan sonra o sözleşmenin id'si döner", async () => {
    expect(window.GK_TFRS16.getSelectedContractId()).toBeNull();

    const contract = seedContract({ id: "FAZC-SEL-1" });
    tfrs16.contracts.push(contract);
    tfrs16.openDetail(contract.id);
    await flushPromises();

    expect(window.GK_TFRS16.getSelectedContractId()).toBe("FAZC-SEL-1");
  });

  test("inline onclick'ler artık çıplak `selectedContractId` DEĞİL, getSelectedContractId() kullanıyor (her iki HTML'de)", () => {
    for (const file of ["tfrs16.html", "frontend/dashboard.html"]) {
      const html = readFile(file);
      const actionButtons = html.match(/id="(applyEarlyPaymentButton|exportReportPdfButton|exportReportHtmlButton)"[^>]*>/g) || [];
      expect(actionButtons.length).toBe(3);
      actionButtons.forEach(btn => {
        expect(btn).toMatch(/getSelectedContractId\(\)/);
        // Çıplak global kullanımı (ReferenceError kaynağı) kalmamalı:
        expect(btn).not.toMatch(/\(selectedContractId[,)]/);
      });
    }
  });
});

describe("FAZ C — detay başlığında bağlam (breadcrumb)", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    document.body.insertAdjacentHTML("beforeend", `
      <div id="detailModal" class="modal hidden">
        <h2 id="detailTitle">-</h2>
        <div id="detailContent"></div>
        <div id="scheduleTableContainer"></div>
      </div>
    `);
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await flushPromises();
    spy.mockRestore();
  });

  afterEach(() => { document.body.innerHTML = ""; });

  test("başlık 'Şirket › Sözleşme ID' biçiminde (önceden sadece ID vardı)", async () => {
    const contract = seedContract({ id: "FAZC-BC-1", company: "Breadcrumb A.Ş." });
    tfrs16.contracts.push(contract);
    tfrs16.openDetail(contract.id);
    await flushPromises();

    const title = document.getElementById("detailTitle");
    expect(title.textContent).toBe("Breadcrumb A.Ş. › FAZC-BC-1");
  });

  test("title attribute'unda tedarikçi dahil tam bağlam var (hover tooltip)", async () => {
    const contract = seedContract({ id: "FAZC-BC-2", company: "X A.Ş.", supplier: "Y Ltd." });
    tfrs16.contracts.push(contract);
    tfrs16.openDetail(contract.id);
    await flushPromises();

    expect(document.getElementById("detailTitle").title).toBe("X A.Ş. — Y Ltd. — FAZC-BC-2");
  });
});

describe("FAZ C — detay modalı CSS'i dashboard'da da tanımlı", () => {
  beforeEach(async () => {
    localStorage.clear();
    const spy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    loadTfrs16();
    await flushPromises();
    spy.mockRestore();
  });

  afterEach(() => { document.body.innerHTML = ""; });

  test("injectV26Styles .detail-grid/.detail-item/.detail-actions/.danger-button enjekte ediyor", () => {
    const css = Array.from(document.querySelectorAll("style")).map(s => s.textContent).join("\n");
    expect(css).toMatch(/\.detail-grid\s*{/);
    expect(css).toMatch(/\.detail-item\s*{/);
    expect(css).toMatch(/\.detail-actions\s*{/);
    expect(css).toMatch(/\.danger-button\s*{/);
    expect(css).toMatch(/\.empty-state\s*{/);
  });

  test("Faz B tab CSS'i de mevcut (.gk-detail-tab-btn / .gk-detail-tab-active)", () => {
    const css = Array.from(document.querySelectorAll("style")).map(s => s.textContent).join("\n");
    expect(css).toMatch(/\.gk-detail-tab-btn\s*{/);
    expect(css).toMatch(/\.gk-detail-tab\.gk-detail-tab-active\s*{/);
  });
});
