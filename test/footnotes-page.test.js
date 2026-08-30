/**
 * @jest-environment jsdom
 *
 * ============================================================
 * DİPNOTLAR SAYFASI + FINANCIAL REPORTING EXTRACTION — TESTLER
 * ============================================================
 *
 * İki ayrı endişeyi kapsıyor:
 *
 * 1) REGRESYON: v191RenderFinancialReporting'in dipnot HTML üretimi
 *    (Varlık/Yükümlülük/Likidite) üç ayrı fonksiyona (v191RenderAssetNoteHtml
 *    vb.) ÇIKARILDI (extract). Bu blok, extraction'ın davranışı
 *    DEĞİŞTİRMEDİĞİNİ (aynı üç dipnot başlığı hâlâ üretiliyor) doğrular.
 *
 * 2) YENİ ÖZELLİK: renderFootnotesPage — "Dipnotlar" sayfası, 3 tab
 *    (Varlık/Yükümlülük/Likidite) arasında native olmayan (JS
 *    tabanlı) geçiş yapıyor, her tab kendi ilgili dipnotunu gösteriyor.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("v191RenderFinancialReporting — extraction sonrası regresyon yok", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("hiç sözleşme yokken bile hata vermeden çalışır, üç dipnot başlığını üretir", () => {
    const html = tfrs16.v191RenderFinancialReporting(new Date("2026-12-31"));
    expect(typeof html).toBe("string");
    expect(html).toMatch(/Dipnot: Kullanım Hakkı Varlığı Hareket Tablosu/);
    expect(html).toMatch(/Dipnot: Kira Yükümlülüğü Hareket Tablosu/);
    expect(html).toMatch(/Dipnot: Kiralama Yükümlülükleri — Likidite Riski/);
  });

  test("Financial Reporting Snapshot / KPI bölümü hâlâ üretiliyor (extraction bunu bozmadı)", () => {
    const html = tfrs16.v191RenderFinancialReporting(new Date("2026-12-31"));
    expect(html).toMatch(/Financial Reporting Snapshot/);
    expect(html).toMatch(/Lease Liability/);
  });
});

describe("v191PrepareFinancialReportingData — paylaşılan veri hazırlama", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("gerekli tüm alanları (rouReport, liabReport, tms29, liquidityDisclosure vb.) döndürür", () => {
    const start = new Date("2026-01-01");
    const end = new Date("2026-12-31");
    const prepared = tfrs16.v191PrepareFinancialReportingData(start, end);

    expect(prepared).toHaveProperty("rouReport");
    expect(prepared).toHaveProperty("liabReport");
    expect(prepared).toHaveProperty("tms29");
    expect(prepared).toHaveProperty("liquidityDisclosure");
    expect(prepared).toHaveProperty("rouDetailColumns");
    expect(prepared).toHaveProperty("liabDetailColumns");
    expect(Array.isArray(prepared.rouRows)).toBe(true);
    expect(Array.isArray(prepared.liabRows)).toBe(true);
  });
});

describe("v191RenderAssetNoteHtml / v191RenderLiabilityNoteHtml / v191RenderLiquidityNoteHtml — bağımsız çağrılabilirlik", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("üçü de v191PrepareFinancialReportingData çıktısıyla, birbirinden bağımsız, hatasız çalışır", () => {
    const prepared = tfrs16.v191PrepareFinancialReportingData(new Date("2026-01-01"), new Date("2026-12-31"));

    const assetHtml = tfrs16.v191RenderAssetNoteHtml({
      rouRows: prepared.rouRows, rouTotalsRow: prepared.rouTotalsRow,
      rouByAssetClass: prepared.rouByAssetClass, rouByCurrency: prepared.rouByCurrency,
      rouDetailColumns: prepared.rouDetailColumns, rouReport: prepared.rouReport,
      periodStart: prepared.periodStart, periodEnd: prepared.periodEnd, periodLabel: prepared.periodLabel
    });
    expect(assetHtml).toMatch(/Kullanım Hakkı Varlığı/);

    const liabHtml = tfrs16.v191RenderLiabilityNoteHtml({
      liabRows: prepared.liabRows, liabTotalsRow: prepared.liabTotalsRow,
      liabByAssetClass: prepared.liabByAssetClass, liabByCurrency: prepared.liabByCurrency,
      liabDetailColumns: prepared.liabDetailColumns, liabReport: prepared.liabReport,
      periodStart: prepared.periodStart, periodEnd: prepared.periodEnd, periodLabel: prepared.periodLabel,
      tms29: prepared.tms29
    });
    expect(liabHtml).toMatch(/Kira Yükümlülüğü/);

    const liquidityHtml = tfrs16.v191RenderLiquidityNoteHtml({
      liquidityRows: prepared.liquidityRows, liquidityDisclosure: prepared.liquidityDisclosure,
      effectivePeriodEnd: prepared.periodEnd
    });
    expect(liquidityHtml).toMatch(/Likidite Riski/);
  });
});

describe("renderFootnotesPage — 3 tab arası geçiş (Varlık/Yükümlülük/Likidite)", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
    await new Promise(resolve => setTimeout(resolve, 0));
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="footnotesPageHost"></div>');
  });

  test("varsayılan olarak 'Varlık' tab'ı aktif ve içeriği gösterilir", () => {
    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);

    expect(host.innerHTML).toMatch(/Dipnotlar/);
    expect(host.innerHTML).toMatch(/Kullanım Hakkı Varlığı/);
    const assetTabBtn = host.querySelector('[data-footnote-tab="asset"]');
    expect(assetTabBtn).toBeTruthy();
  });

  test("'Yükümlülük' tab'ına tıklanınca içerik değişir, Kira Yükümlülüğü dipnotu gösterilir", () => {
    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);

    host.querySelector('[data-footnote-tab="liability"]').click();

    expect(host.innerHTML).toMatch(/Kira Yükümlülüğü Hareket Tablosu/);
    expect(host.innerHTML).not.toMatch(/Kullanım Hakkı Varlığı Hareket Tablosu/);
  });

  test("'Likidite' tab'ına tıklanınca içerik değişir, Likidite Riski dipnotu gösterilir", () => {
    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);

    host.querySelector('[data-footnote-tab="liquidity"]').click();

    expect(host.innerHTML).toMatch(/Likidite Riski/);
    expect(host.innerHTML).not.toMatch(/Kullanım Hakkı Varlığı Hareket Tablosu/);
    expect(host.innerHTML).not.toMatch(/Kira Yükümlülüğü Hareket Tablosu/);
  });

  test("tekrar 'Varlık' tab'ına dönülünce doğru içerik geri gelir (state kaybolmaz)", () => {
    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);

    host.querySelector('[data-footnote-tab="liquidity"]').click();
    host.querySelector('[data-footnote-tab="asset"]').click();

    expect(host.innerHTML).toMatch(/Kullanım Hakkı Varlığı Hareket Tablosu/);
  });

  test("sözleşme seçici YOK — bu sayfa tüm portföyü tarıyor, tek sözleşmeye özgü değil", () => {
    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);
    expect(host.querySelector("select")).toBeNull();
  });

  test("dönem sonu (raporlama tarihi) inputu var ve Uygula butonuyla değiştirilebilir", () => {
    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);

    const input = host.querySelector("#v26FootnotesPeriodEndInput");
    expect(input).toBeTruthy();

    input.value = "2025-06-30";
    host.querySelector("#v26FootnotesApplyPeriod").click();

    // Dönem başı görünen metni güncellenmiş olmalı (2025 1 Ocak).
    expect(host.innerHTML).toMatch(/01\.01\.2025|1\.1\.2025/);
  });
});
