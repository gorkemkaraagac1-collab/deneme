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

  test("'Financial Reporting Snapshot' bölümü KALDIRILDI (bkz. PROJECT_CONTEXT.md — data.byCurrency hiçbir zaman dolu değildi, gerçek bir bug'dı, kullanıcı talebiyle kaldırıldı)", () => {
    const html = tfrs16.v191RenderFinancialReporting(new Date("2026-12-31"));
    expect(html).not.toMatch(/Financial Reporting Snapshot/);
    expect(html).toMatch(/Lease Liability/); // KPI kartı hâlâ duruyor, bu ayrı
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

describe("TMS 29 ROU — dövizli legacy hareket tablosu", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    localStorage.setItem("gk_tfrs16_v23_fx_rates_v1", JSON.stringify([
      { fromCurrency: "USD", toCurrency: "TRY", rateDate: "2025-01-01", rateType: "CLOSING", rate: 35, status: "APPROVED" },
      { fromCurrency: "USD", toCurrency: "TRY", rateDate: "2026-06-30", rateType: "CLOSING", rate: 40, status: "APPROVED" }
    ]));
    tfrs16 = loadTfrs16();
    tfrs16.setReportingCurrency("TRY");

    const months = [];
    for (let y = 2025; y <= 2026; y++) {
      const lastMonth = y === 2026 ? 6 : 12;
      for (let m = 1; m <= lastMonth; m++) months.push(`${y}-${String(m).padStart(2, "0")}`);
    }
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ indices: months.map(month => ({
        month, index: 100, source: "MANUAL_OVERRIDE", verificationStatus: "VERIFIED"
      })) })
    });
    await tfrs16.refreshInflationIndexCacheFromBackend(months);
    fetchSpy.mockRestore();
  });

  test("uygulanmış değişiklik bulunan USD sözleşmenin TMS29 ROU hareketleri TRY'ye bir kez çevrilir", () => {
    tfrs16.contracts.push({
      id: "FX-TMS29-LEGACY",
      company: "Currency Test A.Ş.",
      supplier: "Test Supplier",
      assetClass: "Makine",
      monthlyPayment: 10000,
      discountRate: 5,
      startDate: "2025-01-01",
      endDate: "2027-12-31",
      paymentFrequency: "monthly",
      paymentTiming: "arrears",
      status: "active",
      currency: "USD",
      // Canlıya taşınmış eski sözleşmelerde bu alan işlem para birimiyle
      // aynı kalmış olabilir. Dipnot yine seçili sunum para birimi TRY'de
      // üretilmeli; başlık TRY iken hareketlerin USD ölçeğinde kalmasına
      // izin verilmez.
      functionalCurrency: "USD",
      reportingCurrency: "TRY",
      modifications: [],
      reassessments: [{
        id: "FUTURE-REASS",
        status: "APPLIED",
        type: "FIXED_PAYMENT_CHANGE",
        effectiveDate: "2027-01-01",
        newTerms: { payment: 12000, leaseTerm: "2027-12-31", discountRate: 5 }
      }]
    });

    const prepared = tfrs16.v191PrepareFinancialReportingData(
      new Date("2026-01-01"),
      new Date("2026-06-30")
    );
    const totals = prepared.tms29.totals;

    expect(prepared.tms29.computedCount).toBe(1);
    expect(totals.rouOpeningNominal).toBeGreaterThan(1_000_000);
    expect(totals.rouOpeningRestated).toBeCloseTo(totals.rouOpeningNominal, 2);
    expect(totals.rouClosingNominalPeriod).toBeCloseTo(
      totals.rouOpeningNominal + totals.rouEntriesNominal - totals.rouDepreciationNominal,
      2
    );
    expect(totals.rouClosingRestatedPeriod).toBeCloseTo(
      totals.rouOpeningRestated + totals.rouEntriesRestated - totals.rouDepreciationRestated,
      2
    );
  });

  test("takvim tahakkuku kullanan USD sözleşmenin TMS29 ROU hareketleri de TRY'ye çevrilir", () => {
    tfrs16.contracts.push({
      id: "FX-TMS29-CALENDAR",
      company: "Currency Test A.Ş.",
      supplier: "Test Supplier",
      assetClass: "Makine",
      monthlyPayment: 10000,
      discountRate: 5,
      startDate: "2025-01-01",
      endDate: "2027-12-31",
      paymentFrequency: "monthly",
      paymentTiming: "arrears",
      status: "active",
      currency: "USD",
      functionalCurrency: "TRY",
      reportingCurrency: "TRY",
      modifications: [],
      reassessments: []
    });

    const previousTimezone = process.env.TZ;
    process.env.TZ = "Europe/Istanbul";
    let prepared;
    try {
      prepared = tfrs16.v191PrepareFinancialReportingData(
        new Date(2026, 0, 1),
        new Date(2026, 5, 30)
      );
    } finally {
      process.env.TZ = previousTimezone;
    }
    const totals = prepared.tms29.totals;

    expect(prepared.tms29.computedCount).toBe(1);
    expect(totals.rouOpeningNominal).toBeGreaterThan(1_000_000);
    expect(totals.rouClosingNominalPeriod).toBeCloseTo(
      totals.rouOpeningNominal + totals.rouEntriesNominal - totals.rouDepreciationNominal,
      2
    );
    expect(totals.rouClosingRestatedPeriod).toBeCloseTo(
      totals.rouOpeningRestated + totals.rouEntriesRestated - totals.rouDepreciationRestated,
      2
    );
  });

  test("USD sözleşmenin likidite dipnotu TRY kapanış kuruyla çevrilir ve nominal yükümlülük TMS 21 farkıyla mutabık kalır", () => {
    tfrs16.contracts.push({
      id: "FX-DISCLOSURE-TRY",
      company: "Currency Test A.Ş.",
      supplier: "Test Supplier",
      assetClass: "Makine",
      monthlyPayment: 10000,
      discountRate: 5,
      startDate: "2025-01-01",
      endDate: "2027-12-31",
      paymentFrequency: "monthly",
      paymentTiming: "arrears",
      status: "active",
      currency: "USD",
      functionalCurrency: "TRY",
      reportingCurrency: "TRY",
      modifications: [],
      reassessments: []
    });

    const prepared = tfrs16.v191PrepareFinancialReportingData(
      new Date("2026-01-01"),
      new Date("2026-06-30")
    );
    const liquidity = prepared.liquidityDisclosure.rows[0];
    const liability = prepared.liabRows[0];
    const bucketTotal = liquidity.buckets.reduce((sum, bucket) => sum + bucket.cashOutflow, 0);

    expect(prepared.liquidityDisclosure.presentationCurrency).toBe("TRY");
    expect(liquidity.currency).toBe("TRY");
    // Yerel gece yarısı Date'i 29.06 UTC'ye kaymamalı; 30.06 için
    // tanımlanan 40,00 kapanış kuru aynen kullanılmalı.
    expect(liquidity.contractualCashOutflowsTotal).toBeCloseTo(180_000 * 40, 2);
    expect(liquidity.carryingValue).toBeCloseTo(
      prepared.liabReport.rows[0].closingLiability * 40,
      2
    );
    expect(liquidity.contractualCashOutflowsTotal).toBeCloseTo(bucketTotal, 2);
    expect(Math.abs(liability.fxTranslationAdjustment)).toBeGreaterThan(0);
    expect(
      liability.openingLiability + liability.entriesLiability + liability.interest
      - liability.payments + liability.modificationAdjustment
      + liability.reassessmentAdjustment + liability.otherAdjustment
      + liability.fxTranslationAdjustment
    ).toBeCloseTo(liability.closingLiability, 2);
    expect(prepared.liabReport.reconciliation.passed).toBe(true);

    const rou = prepared.rouRows[0];
    expect(rou.openingRuo + rou.entriesRuo - rou.depreciation
      + rou.modificationAdjustment + rou.reassessmentAdjustment + rou.otherAdjustment
    ).toBeCloseTo(rou.closingRuo, 2);
    expect(rou.closingRuo).toBeCloseTo(
      prepared.tms29.results.get("FX-DISCLOSURE-TRY").rouClosingNominalPeriod,
      0
    );
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

  test("tüm içerik TEK bir beyaz kart (gk-v26-card) içinde — dashboard'un krem arka planı araya sızmıyor", () => {
    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);

    const cards = host.querySelectorAll(".gk-v26-card");
    expect(cards.length).toBe(1);
    // Tab butonları da bu kartın İÇİNDE olmalı.
    expect(cards[0].querySelector('[data-footnote-tab="asset"]')).toBeTruthy();
  });

  test("DÜZELTME: Varlık sınıfı drill-down linkine tıklanınca Dipnotlar sayfasının KENDİSİ yenilenir (Finansal Raporlama ekranına gitmeye çalışmaz)", () => {
    // Demo veri artık YOK (kullanıcı talebiyle kaldırıldı — bkz.
    // loadContracts/v26LoadCompanies değişiklikleri), bu yüzden drill
    // link'in DOM'da oluşabilmesi için kendi test sözleşmemizi ekliyoruz.
    tfrs16.contracts.push({
      id: "DRILL-TEST-1", company: "Test A.Ş.", companyId: "C-1", supplier: "Test Tedarikçi",
      monthlyPayment: 10000, discountRate: 18, startDate: "2026-01-01", endDate: "2027-12-01",
      currency: "TRY", status: "active"
    });

    const host = document.getElementById("footnotesPageHost");
    tfrs16.renderFootnotesPage(host);

    const drillLink = host.querySelector('a[onclick*="v191FilterDetail"]');
    expect(drillLink).toBeTruthy();

    // onclick inline handler'ı gerçek DOM'da window.GK_TFRS16 nesnesine
    // bağımlı — burada doğrudan fonksiyonu (aynı mantığı) tetikleyerek
    // Dipnotlar sayfasının render'ının GERÇEKTEN kaydolduğunu ve
    // tıklama sonrası detay tablosunun genişlediğini doğruluyoruz.
    const before = host.innerHTML;
    tfrs16.v191FilterDetail("rou", "Sınıflandırılmamış");
    const after = host.innerHTML;

    // Detay tablosu açılmış olmalı — "Detayı Göster" yerine artık
    // sözleşme satırları (ya da en azından değişmiş bir DOM) beklenir.
    expect(after).not.toBe(before);
    expect(host.innerHTML).toMatch(/Kullanım Hakkı Varlığı/); // hâlâ asset tab'ındayız (default), sayfa BOZULMADI
  });
});
