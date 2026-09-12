/**
 * @jest-environment jsdom
 *
 * MANUEL TEST — AŞAMA 2
 * TL-1 / FX-1: reassessment uygulanmış sözleşmeye, faiz oranını
 *   değiştiren 2 MODIFICATION ekle (2 farklı tarih).
 * TL-2 / FX-2: modification uygulanmış sözleşmeye, faiz oranını
 *   değiştiren 2 REASSESSMENT ekle (2 farklı tarih — ters yön).
 *
 * Kontrol edilen: (a) önceki ödeme kronolojisi (12.000/13.500/15.000)
 * hâlâ duruyor mu, (b) yeni faiz oranı sadece kendi effective
 * date'inden itibaren mi uygulanıyor, (c) schedule'da beklenmeyen bir
 * süreksizlik/ezme var mı.
 */
const { loadTfrs16 } = require("./helpers/loadTfrs16");

function baseContract(overrides = {}) {
  return {
    id: "MANUAL2-" + Math.random().toString(36).slice(2),
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 12000,
    discountRate: 20,
    startDate: "2025-01-01",
    endDate: "2027-12-31",
    currency: "TRY",
    paymentFrequency: "monthly",
    paymentTiming: "arrears",
    status: "active",
    reassessments: [],
    modifications: [],
    ...overrides
  };
}

function mockOkResponse(data = {}) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}

function rowAt(rows, month) {
  return rows.find(item => {
    const d = item.date instanceof Date ? item.date.toISOString().slice(0, 7) : String(item.date).slice(0, 7);
    return d === month;
  });
}

function paymentAt(rows, month) {
  return Number(rowAt(rows, month)?.payment || 0);
}

// Bir sözleşmenin schedule'ında, belirtilen "atlama" ayları dışında
// closingLiability[i-1] === openingLiability[i] sürekliliğini kontrol eder.
function checkContinuity(rows, jumpMonths) {
  const breaks = [];
  for (let i = 1; i < rows.length; i++) {
    const month = rows[i].date instanceof Date
      ? rows[i].date.toISOString().slice(0, 7)
      : String(rows[i].date).slice(0, 7);
    const prevClosing = Number(rows[i - 1].closingLiability);
    const currOpening = Number(rows[i].openingLiability);
    if (!Number.isFinite(prevClosing) || !Number.isFinite(currOpening)) continue;
    const diff = Math.abs(prevClosing - currOpening);
    if (diff >= 1 && !jumpMonths.includes(month)) {
      breaks.push({ month, prevClosing, currOpening, diff });
    }
  }
  return breaks;
}

// interest / openingLiability oranından aylık dönem faizini yaklaşık
// olarak geri çıkarır (kabaca yıllıklandırma karşılaştırması için).
function impliedMonthlyRatePct(row) {
  if (!row || !Number.isFinite(row.interest) || !Number.isFinite(row.openingLiability) || row.openingLiability === 0) {
    return null;
  }
  return (row.interest / row.openingLiability) * 100;
}

describe("Aşama 2 — çapraz mekanizma: reassessment'lı sözleşmeye modification ile faiz değişikliği (ve tersi)", () => {
  let fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test.each([
    { id: "TL-1", currency: "TRY", functionalCurrency: undefined, baseRate: 20, rate1: 24, rate2: 27 },
    { id: "FX-1", currency: "USD", functionalCurrency: "TRY", baseRate: 8, rate1: 10, rate2: 12 }
  ])("$id: reassessment (ödeme) + modification (faiz) — kronoloji ve süreklilik bozulmuyor", async ({ id, currency, functionalCurrency, baseRate, rate1, rate2 }) => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({ id, currency, functionalCurrency, discountRate: baseRate });

    // Aşama 1: reassessment ile ödeme zinciri (12.000 -> 13.500 -> 15.000)
    const r1 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2025-06-01", effectiveDate: "2025-07-01",
      type: "FIXED_PAYMENT_CHANGE", newPayment: 13500, reason: "olay 1"
    });
    expect(r1.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r1.reassessment.id);

    const r2 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-02-01", effectiveDate: "2026-03-01",
      type: "FIXED_PAYMENT_CHANGE", newPayment: 15000, reason: "olay 2"
    });
    expect(r2.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r2.reassessment.id);

    // Aşama 2: modification ile SADECE faiz oranı değişikliği (ödeme aynı kalıyor)
    const m1 = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01", effectiveDate: "2026-07-01",
      modificationType: "OTHER", newPayment: contract.monthlyPayment,
      newDiscountRate: rate1
    });
    if (!m1.valid) console.log(`[${id}] m1 errors:`, m1.errors);
    expect(m1.valid).toBe(true);
    await tfrs16.applyModification(contract, m1.modification.id);

    const m2 = await tfrs16.createModification(contract, {
      modificationDate: "2027-01-01", effectiveDate: "2027-02-01",
      modificationType: "OTHER", newPayment: contract.monthlyPayment,
      newDiscountRate: rate2
    });
    if (!m2.valid) console.log(`[${id}] m2 errors:`, m2.errors);
    expect(m2.valid).toBe(true);
    await tfrs16.applyModification(contract, m2.modification.id);

    const rows = tfrs16.cfoBuildSchedule(contract).schedule;

    // (a) Ödeme kronolojisi hâlâ duruyor mu
    expect(paymentAt(rows, "2025-06")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-07")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-02")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-03")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2026-06")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2027-12")).toBeCloseTo(15000, 2);

    // (b) Faiz oranı sadece kendi effective date'inden itibaren değişmiş mi
    const beforeRate1 = impliedMonthlyRatePct(rowAt(rows, "2026-06"));
    const afterRate1 = impliedMonthlyRatePct(rowAt(rows, "2026-07"));
    const afterRate2 = impliedMonthlyRatePct(rowAt(rows, "2027-02"));
    console.log(`[${id}] aylık zımni faiz -> 2026-06: ${beforeRate1?.toFixed(4)}%, 2026-07: ${afterRate1?.toFixed(4)}%, 2027-02: ${afterRate2?.toFixed(4)}%`);
    expect(afterRate1).not.toBeNull();
    expect(afterRate1).toBeGreaterThan(beforeRate1);
    expect(afterRate2).toBeGreaterThan(afterRate1);

    // (c) Beklenen sıçrama noktaları dışında süreklilik korunmalı
    const jumpMonths = ["2025-07", "2026-03", "2026-07", "2027-02"];
    const breaks = checkContinuity(rows, jumpMonths);
    if (breaks.length) console.log(`[${id}] beklenmeyen süreksizlikler:`, breaks);
    expect(breaks).toEqual([]);
  });

  test.each([
    { id: "TL-2", currency: "TRY", functionalCurrency: undefined, baseRate: 20, rate1: 24, rate2: 27 },
    { id: "FX-2", currency: "USD", functionalCurrency: "TRY", baseRate: 8, rate1: 10, rate2: 12 }
  ])("$id: modification (ödeme) + reassessment (faiz) — kronoloji ve süreklilik bozulmuyor", async ({ id, currency, functionalCurrency, baseRate, rate1, rate2 }) => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({ id, currency, functionalCurrency, discountRate: baseRate });

    // Aşama 1: modification ile ödeme zinciri (12.000 -> 13.500 -> 15.000)
    const m1 = await tfrs16.createModification(contract, {
      modificationDate: "2025-06-01", effectiveDate: "2025-07-01",
      modificationType: "PAYMENT_INCREASE", newPayment: 13500
    });
    expect(m1.valid).toBe(true);
    await tfrs16.applyModification(contract, m1.modification.id);

    const m2 = await tfrs16.createModification(contract, {
      modificationDate: "2026-02-01", effectiveDate: "2026-03-01",
      modificationType: "PAYMENT_INCREASE", newPayment: 15000
    });
    expect(m2.valid).toBe(true);
    await tfrs16.applyModification(contract, m2.modification.id);

    // Aşama 2: reassessment ile SADECE faiz oranı değişikliği (ödeme aynı kalıyor)
    const r1 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01", effectiveDate: "2026-07-01",
      type: "INDEX_RATE_CHANGE", newPayment: contract.monthlyPayment, newDiscountRate: rate1,
      reason: "faiz güncellemesi 1"
    });
    expect(r1.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r1.reassessment.id);

    const r2 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2027-01-01", effectiveDate: "2027-02-01",
      type: "INDEX_RATE_CHANGE", newPayment: contract.monthlyPayment, newDiscountRate: rate2,
      reason: "faiz güncellemesi 2"
    });
    expect(r2.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r2.reassessment.id);

    const rows = tfrs16.cfoBuildSchedule(contract).schedule;

    expect(paymentAt(rows, "2025-06")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-07")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-02")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-03")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2026-06")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2027-12")).toBeCloseTo(15000, 2);

    const beforeRate1 = impliedMonthlyRatePct(rowAt(rows, "2026-06"));
    const afterRate1 = impliedMonthlyRatePct(rowAt(rows, "2026-07"));
    const afterRate2 = impliedMonthlyRatePct(rowAt(rows, "2027-02"));
    console.log(`[${id}] aylık zımni faiz -> 2026-06: ${beforeRate1?.toFixed(4)}%, 2026-07: ${afterRate1?.toFixed(4)}%, 2027-02: ${afterRate2?.toFixed(4)}%`);
    expect(afterRate1).not.toBeNull();
    expect(afterRate1).toBeGreaterThan(beforeRate1);
    expect(afterRate2).toBeGreaterThan(afterRate1);

    const jumpMonths = ["2025-07", "2026-03", "2026-07", "2027-02"];
    const breaks = checkContinuity(rows, jumpMonths);
    if (breaks.length) console.log(`[${id}] beklenmeyen süreksizlikler:`, breaks);
    expect(breaks).toEqual([]);
  });
});
