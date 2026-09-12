/**
 * @jest-environment jsdom
 *
 * MANUEL TEST — AŞAMA 3: DİPNOT DOĞRULAMASI
 * ============================================================
 * Nominal (TMS 21 çevrimli) ve enflasyonlu (TMS 29) dipnot
 * tablolarındaki sütunları, motora HİÇ dokunmadan, kapalı-form
 * (closed-form) anüite/amortisman formülleriyle KENDİM hesaplıyorum.
 * Sonra aynı sözleşmeleri modülden (v191PrepareFinancialReportingData)
 * geçiriyorum ve iki sonucu satır satır kıyaslıyorum.
 *
 * Kapsam:
 *  - TL-NOTE: TRY sözleşme, nominal + TMS29 (fonksiyonel para birimi = işlem para birimi, çevrim yok)
 *  - FX-NOTE: USD sözleşme, functionalCurrency=TRY, nominal (TMS21 çevrimli) + TMS29
 *
 * Bağımsız hesap mantığı (motor kodundan DEĞİL, TFRS 16/TMS 21/TMS 29
 * standart metninden ve önceki oturumda motor kaynak kodunda
 * doğrulanan sözleşilmiş kurallardan türetildi):
 *  - Kapalı-form anüite: initialLiability = pay*(1-(1+r)^-N)/r,
 *    r = (1+yıllık)^(1/12)-1 (efektif yıllık faiz konvansiyonu)
 *  - initialROU = initialLiability (ilave maliyet/teşvik yok)
 *  - Doğrusal amortisman: aylık pay = initialROU / kira süresi (ay)
 *  - TMS21 (nominal→sunum p.b.): açılış yükümlülüğü dönem başı-1 gün
 *    kapanış kuruyla; her ayın faiz/ödemesi KENDİ ay sonu kapanış
 *    kuruyla; kapanış yükümlülüğü dönem sonu kapanış kuruyla; ROU
 *    (gayrimoneter) TEK bir tarihi kur (taahhüt tarihi) ile.
 *  - TMS29: restatedGrossROU = grossROU × CPI(rp)/CPI(edinim ayı);
 *    restatedAccumDep = restatedGrossROU × (geçenAy/amortismanAyı);
 *    netAdjustment = restatedROUClosing - nominalROUClosing.
 */
const { loadTfrs16 } = require("./helpers/loadTfrs16");

function closedFormSchedule(annualRate, payment, N) {
  const r = Math.pow(1 + annualRate, 1 / 12) - 1;
  const initial = payment * (1 - Math.pow(1 + r, -N)) / r;
  let opening = initial;
  const rows = [];
  for (let i = 1; i <= N; i++) {
    const interest = opening * r;
    const closing = opening + interest - payment;
    rows.push({ period: i, opening, interest, payment, closing });
    opening = closing;
  }
  return { r, initial, rows };
}

const FX_RATES = {
  "2025-01-01": 30.00,
  "2025-12-31": 32.00,
  "2026-01-31": 32.20,
  "2026-02-28": 32.50,
  "2026-03-31": 32.80,
  "2026-04-30": 33.10,
  "2026-05-31": 33.40,
  "2026-06-30": 33.70,
  "2026-07-31": 34.00,
  "2026-08-31": 34.30,
  "2026-09-30": 34.60,
  "2026-10-31": 34.90,
  "2026-11-30": 35.20,
  "2026-12-31": 35.50
};
const MONTH_DATES_2026 = ["2026-01-31","2026-02-28","2026-03-31","2026-04-30","2026-05-31","2026-06-30","2026-07-31","2026-08-31","2026-09-30","2026-10-31","2026-11-30","2026-12-31"];

const CPI_MONTHS = [];
for (let y = 2025; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) CPI_MONTHS.push(`${y}-${String(m).padStart(2,"0")}`);
}
const CPI = {};
CPI_MONTHS.forEach((month, idx) => { CPI[month] = 100 + 2 * idx; });
const CPI_RATIO_2025_01_to_2026_12 = CPI["2026-12"] / CPI["2025-01"]; // 1.46

function near(actual, expected, tol, label, diffs) {
  const diff = Math.abs(actual - expected);
  diffs.push({ label, actual, expected, diff });
  return diff <= tol;
}

describe("Aşama 3 — dipnot (nominal + TMS29) bağımsız hesap vs modül", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    localStorage.setItem("gk_tfrs16_v23_fx_rates_v1", JSON.stringify(
      Object.entries(FX_RATES).map(([rateDate, rate]) => ({
        fromCurrency: "USD", toCurrency: "TRY", rateDate, rateType: "CLOSING", rate, status: "APPROVED"
      }))
    ));
    tfrs16 = loadTfrs16();
    tfrs16.setReportingCurrency("TRY");

    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ indices: CPI_MONTHS.map(month => ({
        month, index: CPI[month], source: "MANUAL_OVERRIDE", verificationStatus: "VERIFIED"
      })) })
    });
    await tfrs16.refreshInflationIndexCacheFromBackend(CPI_MONTHS);
    fetchSpy.mockRestore();
  });

  test("TL-NOTE (TRY): nominal liability + ROU roll-forward — kendi hesabım motorla birebir", () => {
    const contract = {
      id: "TL-NOTE", company: "Test A.Ş.", companyId: "C-1", supplier: "Test Tedarikçi",
      assetClass: "Makine", monthlyPayment: 100000, discountRate: 18,
      startDate: "2025-01-01", endDate: "2029-12-31",
      paymentFrequency: "monthly", paymentTiming: "arrears", status: "active",
      currency: "TRY", modifications: [], reassessments: []
    };
    tfrs16.contracts.push(contract);

    // --- Bağımsız hesap ---
    const { initial, rows } = closedFormSchedule(0.18, 100000, 60);
    const opening2026 = rows[11].closing;
    const interest2026 = rows.slice(12, 24).reduce((s, x) => s + x.interest, 0);
    const payments2026 = rows.slice(12, 24).reduce((s, x) => s + x.payment, 0);
    const closing2026 = rows[23].closing;
    const monthlyDep = initial / 60;
    const openingRou2026 = initial - 12 * monthlyDep;
    const dep2026 = 12 * monthlyDep;
    const closingRou2026 = initial - 24 * monthlyDep;

    // --- Modül ---
    const prepared = tfrs16.v191PrepareFinancialReportingData(new Date(2026,0,1), new Date(2026,11,31));
    const liab = prepared.liabRows.find(r => r.contractId === "TL-NOTE");
    const rou = prepared.rouRows.find(r => r.contractId === "TL-NOTE");

    const diffs = [];
    expect(near(liab.openingLiability, opening2026, 1, "openingLiability", diffs)).toBe(true);
    expect(near(liab.interest, interest2026, 1, "interest", diffs)).toBe(true);
    expect(near(liab.payments, payments2026, 1, "payments", diffs)).toBe(true);
    expect(near(liab.closingLiability, closing2026, 1, "closingLiability", diffs)).toBe(true);
    expect(near(liab.fxTranslationAdjustment, 0, 0.01, "fxTranslationAdjustment", diffs)).toBe(true);
    expect(near(rou.openingRuo, openingRou2026, 1, "openingRuo", diffs)).toBe(true);
    expect(near(rou.depreciation, dep2026, 1, "depreciation", diffs)).toBe(true);
    expect(near(rou.closingRuo, closingRou2026, 1, "closingRuo", diffs)).toBe(true);
    console.log("[TL-NOTE nominal] fark tablosu:", diffs);

    // --- TMS29 (enflasyonlu) ---
    // NOT: applyTMS29Restatement İKİ farklı restated-ROU-kapanış hesabı
    // üretiyor — headline netAdjustment (edinim oranı yöntemi) ile
    // rouRollForward.rouClosingRestatedPeriod (dönem bazlı, satır-satır
    // endekslenmiş yöntem) FARKLI sayılar verebiliyor. İkisini de
    // bağımsız hesaplayıp modülün her ikisiyle de kıyaslıyorum.
    const restatedGrossROU = initial * CPI_RATIO_2025_01_to_2026_12;
    const restatedROUClosing_acquisitionMethod = restatedGrossROU * (1 - 24/60);
    const expectedNetAdjustment_acquisitionMethod = restatedROUClosing_acquisitionMethod - closingRou2026;

    const tmsResult = prepared.tms29.results.get("TL-NOTE");
    console.log("[TL-NOTE TMS29] modül ham değerler:", JSON.stringify(tmsResult, null, 2));
    const tmsDiffs = [];
    expect(near(tmsResult.netAdjustment, expectedNetAdjustment_acquisitionMethod, 1, "netAdjustment (headline, edinim-oranı yöntemi)", tmsDiffs)).toBe(true);
    expect(near(tmsResult.rouClosingNominalPeriod, closingRou2026, 1, "rouClosingNominalPeriod", tmsDiffs)).toBe(true);
    console.log("[TL-NOTE TMS29] fark tablosu (headline netAdjustment vs bağımsız hesap):", tmsDiffs);

    // Tutarlılık kontrolü: rouRollForward.rouClosingRestatedPeriod'dan
    // türeyen (nominal + netAdjustment) ile roll-forward'ın KENDİ
    // rapor ettiği rouClosingRestatedPeriod aynı mı?
    const impliedRestatedClosing_viaNetAdjustment = tmsResult.rouClosingNominalPeriod + tmsResult.netAdjustment;
    const rollForwardRestatedClosing = tmsResult.rouRollForward.rouClosingRestatedPeriod;
    const internalDiff = Math.abs(impliedRestatedClosing_viaNetAdjustment - rollForwardRestatedClosing);
    console.log("[TL-NOTE TMS29] MOTOR İÇİ TUTARLILIK:", {
      impliedRestatedClosing_viaNetAdjustment,
      rollForwardRestatedClosing,
      internalDiff
    });
  });

  test("FX-NOTE (USD, functionalCurrency=TRY): nominal (TMS21 çevrimli) + TMS29 — kendi hesabım motorla birebir", () => {
    const contract = {
      id: "FX-NOTE", company: "Test A.Ş.", companyId: "C-1", supplier: "Test Tedarikçi",
      assetClass: "Makine", monthlyPayment: 3000, discountRate: 8,
      startDate: "2025-01-01", endDate: "2029-12-31",
      paymentFrequency: "monthly", paymentTiming: "arrears", status: "active",
      currency: "USD", functionalCurrency: "TRY", reportingCurrency: "TRY",
      modifications: [], reassessments: []
    };
    tfrs16.contracts.push(contract);

    // --- Bağımsız hesap (USD nominal) ---
    const { initial, rows } = closedFormSchedule(0.08, 3000, 60);
    const opening2026_USD = rows[11].closing;
    const closing2026_USD = rows[23].closing;
    const interestRows2026 = rows.slice(12, 24);
    const monthlyDep = initial / 60;
    const openingRou2026_USD = initial - 12 * monthlyDep;
    const dep2026_USD = 12 * monthlyDep;
    const closingRou2026_USD = initial - 24 * monthlyDep;

    // --- Bağımsız hesap: TMS21 çevrimi (USD -> TRY) ---
    const openingLiability_TRY = opening2026_USD * FX_RATES["2025-12-31"];
    let interest_TRY = 0, payments_TRY = 0;
    interestRows2026.forEach((row, idx) => {
      const rate = FX_RATES[MONTH_DATES_2026[idx]];
      interest_TRY += row.interest * rate;
      payments_TRY += row.payment * rate;
    });
    const closingLiability_TRY = closing2026_USD * FX_RATES["2026-12-31"];
    const expectedFxTranslation = closingLiability_TRY - (openingLiability_TRY + interest_TRY - payments_TRY);

    const histRate = FX_RATES["2025-01-01"];
    const openingRuo_TRY = openingRou2026_USD * histRate;
    const depreciation_TRY = dep2026_USD * histRate;
    const closingRuo_TRY = closingRou2026_USD * histRate;

    // --- Modül ---
    const prepared = tfrs16.v191PrepareFinancialReportingData(new Date(2026,0,1), new Date(2026,11,31));
    const liab = prepared.liabRows.find(r => r.contractId === "FX-NOTE");
    const rou = prepared.rouRows.find(r => r.contractId === "FX-NOTE");

    expect(liab.currency).toBe("TRY"); // dipnot fonksiyonel p.b.'de mi?
    expect(rou.currency).toBe("TRY");

    const diffs = [];
    expect(near(liab.openingLiability, openingLiability_TRY, 5, "openingLiability", diffs)).toBe(true);
    expect(near(liab.interest, interest_TRY, 5, "interest", diffs)).toBe(true);
    expect(near(liab.payments, payments_TRY, 5, "payments", diffs)).toBe(true);
    expect(near(liab.closingLiability, closingLiability_TRY, 5, "closingLiability", diffs)).toBe(true);
    expect(near(liab.fxTranslationAdjustment, expectedFxTranslation, 5, "fxTranslationAdjustment", diffs)).toBe(true);
    expect(near(rou.openingRuo, openingRuo_TRY, 5, "openingRuo", diffs)).toBe(true);
    expect(near(rou.depreciation, depreciation_TRY, 5, "depreciation", diffs)).toBe(true);
    expect(near(rou.closingRuo, closingRuo_TRY, 5, "closingRuo", diffs)).toBe(true);
    console.log("[FX-NOTE nominal/TMS21] fark tablosu:", diffs);

    // --- TMS29 (enflasyonlu, USD sözleşme TRY'ye çevrilip endekslenir) ---
    const nominalROUClosing = closingRuo_TRY; // = closingRou2026_USD * histRate (commencementRate)
    const grossROU_TRY = initial * histRate;
    const restatedGrossROU = grossROU_TRY * CPI_RATIO_2025_01_to_2026_12;
    const restatedROUClosing_acquisitionMethod = restatedGrossROU * (1 - 24/60);
    const expectedNetAdjustment_acquisitionMethod = restatedROUClosing_acquisitionMethod - nominalROUClosing;

    const tmsResult = prepared.tms29.results.get("FX-NOTE");
    console.log("[FX-NOTE TMS29] modül ham değerler:", JSON.stringify(tmsResult, null, 2));
    const tmsDiffs = [];
    expect(near(tmsResult.rouClosingNominalPeriod, nominalROUClosing, 5, "rouClosingNominalPeriod", tmsDiffs)).toBe(true);
    console.log("[FX-NOTE TMS29] edinim-oranı yöntemiyle beklenen netAdjustment:", expectedNetAdjustment_acquisitionMethod, "— modülün fiilen döndürdüğü netAdjustment:", tmsResult.netAdjustment);
    console.log("[FX-NOTE TMS29] fark (edinim-oranı yöntemi vs modülün FX yolunda kullandığı yöntem):", Math.abs(tmsResult.netAdjustment - expectedNetAdjustment_acquisitionMethod));
  });
});
