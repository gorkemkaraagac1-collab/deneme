/**
 * @jest-environment jsdom
 *
 * ============================================================
 * TMS 29 RESTATED TABLOLARININ DOĞRU TAB'A YERLEŞTİRİLMESİ
 * ============================================================
 *
 * Kullanıcı geri bildirimi: Dipnotlar sayfasının Yükümlülük tab'ında,
 * "Kullanım Hakkı Varlığı (ROU) — Varlık Sınıfına Göre, Restated"
 * tablosu YANLIŞLIKLA görünüyordu (v191Tms29SummaryHtml TEK blokta
 * hem ROU hem Liability restated tablolarını üretip Yükümlülük
 * dipnotunun sonuna ekliyordu). Düzeltme: v191Tms29RouSummaryHtml
 * (Varlık tab'ına) ve v191Tms29LiabilitySummaryHtml (Yükümlülük
 * tab'ında kalıyor) olarak ikiye ayrıldı.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function seedContract(overrides = {}) {
  return {
    id: "TMS29-TEST-" + Math.random().toString(36).slice(2),
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

describe("Dipnotlar sayfası — TMS 29 restated tablolarının doğru tab'da olduğu", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await new Promise(resolve => setTimeout(resolve, 0));
    initFetchSpy.mockRestore();
    tfrs16.contracts.push(seedContract());
    document.body.insertAdjacentHTML("beforeend", '<div id="tms29Host"></div>');
  });

  test("Varlık tab'ında 'Kullanım Hakkı Varlığı (ROU) — Restated' başlığı VAR", () => {
    const host = document.getElementById("tms29Host");
    tfrs16.renderFootnotesPage(host); // varsayılan tab: asset
    expect(host.innerHTML).toMatch(/Kullanım Hakkı Varlığı \(ROU\) — Varlık Sınıfına Göre, Restated/);
  });

  test("Varlık tab'ında 'Kira Yükümlülüğü — Restated' başlığı YOK", () => {
    const host = document.getElementById("tms29Host");
    tfrs16.renderFootnotesPage(host);
    expect(host.innerHTML).not.toMatch(/Kira Yükümlülüğü — Varlık Sınıfına Göre, Restated/);
  });

  test("Yükümlülük tab'ında 'Kira Yükümlülüğü — Restated' başlığı VAR", () => {
    const host = document.getElementById("tms29Host");
    tfrs16.renderFootnotesPage(host);
    host.querySelector('[data-footnote-tab="liability"]').click();
    expect(host.innerHTML).toMatch(/Kira Yükümlülüğü — Varlık Sınıfına Göre, Restated/);
  });

  test("DÜZELTME DOĞRULANDI: Yükümlülük tab'ında 'Kullanım Hakkı Varlığı (ROU) — Restated' başlığı ARTIK YOK", () => {
    const host = document.getElementById("tms29Host");
    tfrs16.renderFootnotesPage(host);
    host.querySelector('[data-footnote-tab="liability"]').click();
    expect(host.innerHTML).not.toMatch(/Kullanım Hakkı Varlığı \(ROU\) — Varlık Sınıfına Göre, Restated/);
  });

  test("Likidite tab'ında ne ROU ne Yükümlülük restated tablosu var (ilgisiz)", () => {
    const host = document.getElementById("tms29Host");
    tfrs16.renderFootnotesPage(host);
    host.querySelector('[data-footnote-tab="liquidity"]').click();
    expect(host.innerHTML).not.toMatch(/Restated/);
  });
});

describe("v191Tms29RouSummaryHtml / v191Tms29LiabilitySummaryHtml — bağımsız çağrılabilirlik", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("her ikisi de aynı v191PrepareFinancialReportingData çıktısıyla, birbirinden bağımsız çalışır", () => {
    tfrs16.contracts.push(seedContract());
    const prepared = tfrs16.v191PrepareFinancialReportingData(new Date("2026-01-01"), new Date("2026-12-31"));

    const rouHtml = tfrs16.v191Tms29RouSummaryHtml(prepared.tms29, prepared.periodLabel, prepared.periodStart, prepared.periodEnd);
    expect(rouHtml).toMatch(/Kullanım Hakkı Varlığı \(ROU\)/);
    expect(rouHtml).not.toMatch(/Kira Yükümlülüğü — Varlık Sınıfına Göre/);

    const liabHtml = tfrs16.v191Tms29LiabilitySummaryHtml(prepared.tms29, prepared.periodLabel, prepared.periodStart, prepared.periodEnd);
    expect(liabHtml).toMatch(/Kira Yükümlülüğü — Varlık Sınıfına Göre/);
    expect(liabHtml).not.toMatch(/Kullanım Hakkı Varlığı \(ROU\)/);
  });

  test("endeks verisi tamamen eksikse yanıltıcı sıfır toplam yerine hesaplanamadı uyarısı gösterir", () => {
    tfrs16.contracts.push(seedContract());
    const prepared = tfrs16.v191PrepareFinancialReportingData(new Date("2026-01-01"), new Date("2026-12-31"));
    expect(prepared.tms29.computedCount).toBe(0);
    expect(prepared.tms29.missingCount).toBeGreaterThan(0);

    const rouHtml = tfrs16.v191Tms29RouSummaryHtml(prepared.tms29, prepared.periodLabel, prepared.periodStart, prepared.periodEnd);
    const liabHtml = tfrs16.v191Tms29LiabilitySummaryHtml(prepared.tms29, prepared.periodLabel, prepared.periodStart, prepared.periodEnd);

    for (const html of [rouHtml, liabHtml]) {
      expect(html).toContain('data-tms29-unavailable="true"');
      expect(html).toMatch(/TMS 29 tablosu hesaplanamadı/);
      expect(html).toMatch(/Yanıltıcı sıfır toplam gösterilmedi/);
      expect(html).not.toMatch(/>TOPLAM</);
      expect(html).not.toMatch(/Dipnotu Dışa Aktar/);
    }
  });
});

describe("v191RenderFinancialReporting (Finansal Raporlama ekranı) — hâlâ her iki tabloyu da içeriyor", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("tek sayfalı Finansal Raporlama ekranında ROU restated Varlık dipnotunun içinde, Liability restated Yükümlülük dipnotunun içinde", () => {
    tfrs16.contracts.push(seedContract());
    const html = tfrs16.v191RenderFinancialReporting(new Date("2026-12-31"));

    // İkisi de sayfada bulunmalı (tek sayfa, tab yok) — sadece SIRALARI
    // artık doğru dipnotun İÇİNDE.
    const rouIdx = html.indexOf("Kullanım Hakkı Varlığı (ROU) — Varlık Sınıfına Göre, Restated");
    const liabNoteIdx = html.indexOf("Dipnot: Kira Yükümlülüğü Hareket Tablosu");
    const liabRestatedIdx = html.indexOf("Kira Yükümlülüğü — Varlık Sınıfına Göre, Restated");
    const assetNoteIdx = html.indexOf("Dipnot: Kullanım Hakkı Varlığı Hareket Tablosu");

    expect(rouIdx).toBeGreaterThan(-1);
    expect(liabRestatedIdx).toBeGreaterThan(-1);
    // ROU restated, Varlık dipnotunun (assetNoteIdx) SONRASINDA ve
    // Yükümlülük dipnotunun (liabNoteIdx) BAŞLAMASINDAN ÖNCE olmalı.
    expect(rouIdx).toBeGreaterThan(assetNoteIdx);
    expect(rouIdx).toBeLessThan(liabNoteIdx);
    // Liability restated, Yükümlülük dipnotunun İÇİNDE (sonrasında) olmalı.
    expect(liabRestatedIdx).toBeGreaterThan(liabNoteIdx);
  });
});
