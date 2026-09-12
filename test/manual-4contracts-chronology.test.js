/**
 * @jest-environment jsdom
 *
 * MANUEL TEST — 4 sözleşme (2 TL, 2 dövizli/USD), 2025 başlangıçlı.
 * Amaç: kronolojik reassessment/modification zincirinde geçmiş
 * ödeme tutarlarının (12.000 -> 13.500 -> 15.000) bozulmadığını
 * doğrulamak.
 *
 * Kurgu (varsayım — talimat metninde "dövizli" kelimesi iki kez
 * geçtiği için netleştirildi):
 *   - TL-1  (TRY): reassessment zinciri (2 olay)
 *   - FX-1  (USD): reassessment zinciri (2 olay) — TL-1 ile aynı tarih/tutar
 *   - TL-2  (TRY): modification zinciri (2 olay)
 *   - FX-2  (USD): modification zinciri (2 olay) — TL-2 ile aynı tarih/tutar
 */
const { loadTfrs16 } = require("./helpers/loadTfrs16");

function baseContract(overrides = {}) {
  return {
    id: "MANUAL-" + Math.random().toString(36).slice(2),
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

function paymentAt(rows, month) {
  const row = rows.find(item => {
    const d = item.date instanceof Date ? item.date.toISOString().slice(0, 7) : String(item.date).slice(0, 7);
    return d === month;
  });
  return Number(row?.payment || 0);
}

describe("4 sözleşme (2 TL + 2 USD) — kronolojik reassessment/modification zinciri", () => {
  let fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("TL-1: reassessment zinciri — 12.000 -> 13.500 -> 15.000 geçmiş bozulmaz", async () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({ id: "TL-1", currency: "TRY" });

    const r1 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2025-06-01", effectiveDate: "2025-07-01",
      type: "FIXED_PAYMENT_CHANGE", newPayment: 13500, reason: "manuel test - olay 1"
    });
    expect(r1.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r1.reassessment.id);

    const r2 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-02-01", effectiveDate: "2026-03-01",
      type: "FIXED_PAYMENT_CHANGE", newPayment: 15000, reason: "manuel test - olay 2"
    });
    expect(r2.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r2.reassessment.id);

    const rows = tfrs16.cfoBuildSchedule(contract).schedule;
    expect(paymentAt(rows, "2025-01")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-06")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-07")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-02")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-03")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2027-12")).toBeCloseTo(15000, 2);
  });

  test("FX-1 (USD): reassessment zinciri — aynı desen, dövizli sözleşmede de korunur", async () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({
      id: "FX-1", currency: "USD", functionalCurrency: "TRY", discountRate: 8
    });

    const r1 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2025-06-01", effectiveDate: "2025-07-01",
      type: "FIXED_PAYMENT_CHANGE", newPayment: 13500, reason: "manuel test - olay 1"
    });
    expect(r1.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r1.reassessment.id);

    const r2 = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-02-01", effectiveDate: "2026-03-01",
      type: "FIXED_PAYMENT_CHANGE", newPayment: 15000, reason: "manuel test - olay 2"
    });
    expect(r2.valid).toBe(true);
    await tfrs16.applyReassessment(contract, r2.reassessment.id);

    const rows = tfrs16.cfoBuildSchedule(contract).schedule;
    expect(paymentAt(rows, "2025-01")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-06")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-07")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-02")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-03")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2027-12")).toBeCloseTo(15000, 2);
  });

  test("TL-2: modification zinciri — 12.000 -> 13.500 -> 15.000 geçmiş bozulmaz", async () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({ id: "TL-2", currency: "TRY" });

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

    const rows = tfrs16.cfoBuildSchedule(contract).schedule;
    expect(paymentAt(rows, "2025-01")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-06")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-07")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-02")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-03")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2027-12")).toBeCloseTo(15000, 2);
  });

  test("FX-2 (USD): modification zinciri — aynı desen, dövizli sözleşmede de korunur", async () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({
      id: "FX-2", currency: "USD", functionalCurrency: "TRY", discountRate: 8
    });

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

    const rows = tfrs16.cfoBuildSchedule(contract).schedule;
    expect(paymentAt(rows, "2025-01")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-06")).toBeCloseTo(12000, 2);
    expect(paymentAt(rows, "2025-07")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-02")).toBeCloseTo(13500, 2);
    expect(paymentAt(rows, "2026-03")).toBeCloseTo(15000, 2);
    expect(paymentAt(rows, "2027-12")).toBeCloseTo(15000, 2);
  });
});
