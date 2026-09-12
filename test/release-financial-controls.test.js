/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");
const { loadTfrs16 } = require("./helpers/loadTfrs16");

function contract(id, overrides = {}) {
  return {
    id,
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test",
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

describe("release financial controls", () => {
  let tfrs16;
  let fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true })
    });
    tfrs16 = loadTfrs16();
  });

  afterEach(() => fetchSpy.mockRestore());

  test("short-term ve low-value istisnaları liability roll-forward'a girmez", () => {
    tfrs16.contracts.push(
      contract("SHORT-TERM", { shortTermLease: true }),
      contract("LOW-VALUE", { lowValueAsset: true })
    );

    const report = tfrs16.getLeaseLiabilityRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );

    expect(report.rows).toEqual([]);
    expect(report.totals.otherAdjustment).toBe(0);
    expect(report.reconciliation.passed).toBe(true);
  });

  test("portfolio mutabakatı Diğer Düzeltmeler toplamını denkleme dahil eder", () => {
    tfrs16.contracts.push(contract("ENDED", { endDate: "2026-03-31" }));

    const report = tfrs16.getLeaseLiabilityRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );
    const expected = Math.round((
      report.totals.openingLiability +
      report.totals.entriesLiability +
      report.totals.interest -
      report.totals.payments +
      report.totals.modificationAdjustment +
      report.totals.reassessmentAdjustment +
      report.totals.otherAdjustment -
      report.totals.closingLiability
    ) * 100) / 100;

    expect(report.reconciliation.difference).toBe(expected);
    expect(report.reconciliation.passed).toBe(true);
  });

  test("aynı APPLIED reassessment raporda yalnızca bir kez sayılır", () => {
    const duplicate = {
      id: "REASS-1",
      status: "APPLIED",
      type: "FIXED_PAYMENT_CHANGE",
      effectiveDate: "2026-03-31",
      reassessmentDate: "2026-03-31",
      liabilityAdjustment: 12345.67,
      newTerms: { payment: 11000, leaseTerm: "2027-12-01", discountRate: 18 }
    };
    tfrs16.contracts.push(contract("DUP-APPLIED", {
      reassessments: [duplicate, { ...duplicate, id: "REASS-2" }]
    }));

    const report = tfrs16.getLeaseLiabilityRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].reassessmentAdjustment).toBe(12345.67);
    // Sentetik eski kayıt bilinçli olarak ödeme planıyla uyuşmayan bir delta
    // taşıyor. Mükerrer sayılmamalı ve mutabakat kontrolü bu farkı gizlememeli.
    expect(report.reconciliation.passed).toBe(false);
  });

  test("APPLIED reassessment geçmiş schedule'a geriye dönük uygulanmaz ve Diğer üretmez", async () => {
    const changed = contract("REASS-HISTORY", { reassessments: [] });
    tfrs16.contracts.push(changed);
    const created = await tfrs16.createReassessment(changed, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 14000,
      newLeaseEndDate: changed.endDate
    });
    expect(created.valid).toBe(true);
    const applied = await tfrs16.applyReassessment(changed, created.reassessment.id);
    expect(applied.valid).toBe(true);

    const report = tfrs16.getLeaseLiabilityRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );

    expect(report.rows).toHaveLength(1);
    expect(Math.abs(report.rows[0].otherAdjustment)).toBeLessThan(1);
  });

  test("önceki yılın son schedule günündeki reassessment yeni yıl açılışına taşınır", async () => {
    const changed = contract("YEAR-END-REASS", {
      startDate: "2025-01-01",
      endDate: "2027-12-31",
      reassessments: []
    });
    tfrs16.contracts.push(changed);
    const created = await tfrs16.createReassessment(changed, {
      reassessmentDate: "2025-12-31",
      effectiveDate: "2025-12-31",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 14000,
      newLeaseEndDate: changed.endDate
    });
    expect(created.valid).toBe(true);
    expect((await tfrs16.applyReassessment(changed, created.reassessment.id)).valid).toBe(true);

    const liability = tfrs16.getLeaseLiabilityRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );
    const rou = tfrs16.getRuoAssetRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );

    expect(liability.rows[0].reassessmentAdjustment).toBe(0);
    expect(Math.abs(liability.rows[0].otherAdjustment)).toBeLessThan(1);
    expect(rou.rows[0].reassessmentAdjustment).toBe(0);
    expect(Math.abs(rou.rows[0].otherAdjustment)).toBeLessThan(1);
  });

  test("otomatik endeks reassessment'i yeni baz oranıyla birlikte kalıcılaştırılır", async () => {
    const indexed = contract("INDEXED", {
      startDate: "2025-01-01",
      endDate: "2028-12-01",
      leaseIncreaseType: "index",
      indexReviewMonth: 1,
      indexReviewDay: 1,
      indexBaseRate: 100,
      indexCurrentRate: 110,
      reassessments: []
    });
    tfrs16.contracts.push(indexed);

    const result = await tfrs16.checkIndexReassessment(indexed);

    expect(result.reassessmentCreated).toBe(true);
    expect(indexed.indexBaseRate).toBe(110);
    const persisted = JSON.parse(fetchSpy.mock.calls[0][1].body);
    expect(persisted.details.indexBaseRate).toBe(110);
  });

  test("short-term ve low-value istisnaları ROU roll-forward'a girmez", () => {
    tfrs16.contracts.push(
      contract("SHORT-TERM-ROU", { shortTermLease: true }),
      contract("LOW-VALUE-ROU", { lowValueAsset: true })
    );

    const report = tfrs16.getRuoAssetRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );

    expect(report.rows).toEqual([]);
    expect(report.reconciliation.passed).toBe(true);
  });

  test("dönem başında başlayan sözleşmenin ilk bakiyesi Açılış yerine Girişler'e alınır", () => {
    tfrs16.contracts.push(contract("START-OF-PERIOD"));
    const start = new Date("2026-01-01");
    const end = new Date("2026-06-30");
    const liability = tfrs16.getLeaseLiabilityRollForwardReport(start, end);
    const rou = tfrs16.getRuoAssetRollForwardReport(start, end);

    expect(liability.rows).toHaveLength(1);
    expect(rou.rows).toHaveLength(1);
    expect(liability.rows[0].openingLiability).toBe(0);
    expect(rou.rows[0].openingRuo).toBe(0);
    expect(liability.rows[0].entriesLiability).toBeGreaterThan(0);
    expect(rou.rows[0].entriesRuo).toBeGreaterThan(0);
    expect(liability.reconciliation.passed).toBe(true);
    expect(rou.reconciliation.passed).toBe(true);
  });

  test("önceki yılda başlayan sözleşme 2026 hareketinde Açılış'ta kalır", () => {
    tfrs16.contracts.push(contract("PRIOR-YEAR", { startDate: "2025-01-01" }));
    const report = tfrs16.getLeaseLiabilityRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-06-30")
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].openingLiability).toBeGreaterThan(0);
    expect(report.rows[0].entriesLiability).toBe(0);
  });

  test("ROU roll-forward mükerrer APPLIED reassessment'i bir kez sayar ve Diğer'i denkleme dahil eder", () => {
    const duplicate = {
      id: "ROU-REASS-1",
      status: "APPLIED",
      type: "FIXED_PAYMENT_CHANGE",
      effectiveDate: "2026-03-31",
      reassessmentDate: "2026-03-31",
      rouAdjustment: 23456.78,
      newTerms: { payment: 11000, leaseTerm: "2027-12-01", discountRate: 18 }
    };
    tfrs16.contracts.push(contract("DUP-APPLIED-ROU", {
      reassessments: [duplicate, { ...duplicate, id: "ROU-REASS-2" }]
    }));

    const report = tfrs16.getRuoAssetRollForwardReport(
      new Date("2026-01-01"),
      new Date("2026-07-31")
    );

    expect(report.rows).toHaveLength(1);
    expect(report.rows[0].reassessmentAdjustment).toBe(23456.78);
    expect(report.reconciliation.passed).toBe(true);
  });

  test("TRY sözleşmede kronoloji farkı TMS 21 çevrim farkı olarak sınıflanmaz", async () => {
    const changed = contract("TRY-NO-FX", {
      startDate: "2025-01-01",
      endDate: "2028-12-31",
      functionalCurrency: "TRY",
      reportingCurrency: "TRY",
      modifications: [],
      reassessments: []
    });
    tfrs16.contracts.push(changed);

    const persist = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true, status: 200, text: async () => JSON.stringify({ success: true })
    });
    const modification = await tfrs16.createModification(changed, {
      modificationDate: "2025-07-01",
      effectiveDate: "2025-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 13500,
      reason: "TRY chain regression"
    });
    expect(modification.valid).toBe(true);
    expect((await tfrs16.applyModification(changed, modification.modification.id)).valid).toBe(true);

    const reassessment = await tfrs16.createReassessment(changed, {
      reassessmentDate: "2026-03-01",
      effectiveDate: "2026-03-01",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 15000,
      newLeaseEndDate: changed.endDate
    });
    expect(reassessment.valid).toBe(true);
    expect((await tfrs16.applyReassessment(changed, reassessment.reassessment.id)).valid).toBe(true);
    persist.mockRestore();

    // Simulate an old persisted delta from before the chronological resolver.
    changed.reassessments[0].liabilityAdjustment += 1234.56;
    const prepared = tfrs16.v191PrepareFinancialReportingData(
      new Date("2026-01-01"), new Date("2026-06-30")
    );
    const liability = prepared.liabRows.find(row => row.contractId === changed.id);

    expect(liability.currency).toBe("TRY");
    expect(liability.fxTranslationAdjustment).toBe(0);
  });

  test("aynı yürürlük tarihindeki değişiklikler net plan sıçramasını yalnızca bir kez raporlar", async () => {
    const modificationContract = contract("SAME-DATE-MOD", {
      monthlyPayment: 12000,
      discountRate: 6,
      startDate: "2025-01-01",
      endDate: "2030-12-31",
      functionalCurrency: "TRY",
      reportingCurrency: "TRY",
      modifications: [],
      reassessments: []
    });
    const reassessmentContract = contract("SAME-DATE-REASS", {
      monthlyPayment: 12000,
      discountRate: 6,
      startDate: "2025-01-01",
      endDate: "2030-12-31",
      functionalCurrency: "TRY",
      reportingCurrency: "TRY",
      modifications: [],
      reassessments: []
    });
    const mixedContract = contract("SAME-DATE-MIXED", {
      monthlyPayment: 12000,
      discountRate: 6,
      startDate: "2025-01-01",
      endDate: "2030-12-31",
      functionalCurrency: "TRY",
      reportingCurrency: "TRY",
      modifications: [],
      reassessments: []
    });
    tfrs16.contracts.push(modificationContract, reassessmentContract, mixedContract);

    const paymentModification = await tfrs16.createModification(modificationContract, {
      modificationDate: "2026-02-01",
      effectiveDate: "2026-03-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 15000,
      newDiscountRate: 6
    });
    expect(paymentModification.valid).toBe(true);
    expect((await tfrs16.applyModification(modificationContract, paymentModification.modification.id)).valid).toBe(true);
    modificationContract.modifications[0].createdAt = "2026-02-01T10:00:00.000Z";

    const rateModification = await tfrs16.createModification(modificationContract, {
      modificationDate: "2026-02-02",
      effectiveDate: "2026-03-01",
      modificationType: "OTHER",
      newPayment: 15000,
      newDiscountRate: 8,
      newLeaseEndDate: modificationContract.endDate,
      reason: "same-date rate change"
    });
    expect(rateModification.valid).toBe(true);
    expect((await tfrs16.applyModification(modificationContract, rateModification.modification.id)).valid).toBe(true);
    modificationContract.modifications[1].createdAt = "2026-02-02T10:00:00.000Z";

    const paymentReassessment = await tfrs16.createReassessment(reassessmentContract, {
      reassessmentDate: "2026-02-01",
      effectiveDate: "2026-03-01",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 15000,
      newDiscountRate: 6,
      newLeaseEndDate: reassessmentContract.endDate
    });
    expect(paymentReassessment.valid).toBe(true);
    expect((await tfrs16.applyReassessment(reassessmentContract, paymentReassessment.reassessment.id)).valid).toBe(true);
    reassessmentContract.reassessments[0].createdAt = "2026-02-01T10:00:00.000Z";

    const rateReassessment = await tfrs16.createReassessment(reassessmentContract, {
      reassessmentDate: "2026-02-02",
      effectiveDate: "2026-03-01",
      type: "INDEX_RATE_CHANGE",
      newPayment: 15000,
      newDiscountRate: 8,
      newLeaseEndDate: reassessmentContract.endDate,
      reason: "same-date rate change"
    });
    expect(rateReassessment.valid).toBe(true);
    expect((await tfrs16.applyReassessment(reassessmentContract, rateReassessment.reassessment.id)).valid).toBe(true);
    reassessmentContract.reassessments[1].createdAt = "2026-02-02T10:00:00.000Z";

    const mixedModification = await tfrs16.createModification(mixedContract, {
      modificationDate: "2026-02-01",
      effectiveDate: "2026-03-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 15000,
      newDiscountRate: 6
    });
    expect(mixedModification.valid).toBe(true);
    expect((await tfrs16.applyModification(mixedContract, mixedModification.modification.id)).valid).toBe(true);
    mixedContract.modifications[0].createdAt = "2026-02-01T10:00:00.000Z";

    const mixedReassessment = await tfrs16.createReassessment(mixedContract, {
      reassessmentDate: "2026-02-02",
      effectiveDate: "2026-03-01",
      type: "INDEX_RATE_CHANGE",
      newPayment: 15000,
      newDiscountRate: 8,
      newLeaseEndDate: mixedContract.endDate,
      reason: "same-date mixed change"
    });
    expect(mixedReassessment.valid).toBe(true);
    expect((await tfrs16.applyReassessment(mixedContract, mixedReassessment.reassessment.id)).valid).toBe(true);
    mixedContract.reassessments[0].createdAt = "2026-02-02T10:00:00.000Z";

    const report = tfrs16.getLeaseLiabilityRollForwardReport(
      new Date("2026-01-01"), new Date("2026-06-30")
    );

    expect(report.rows).toHaveLength(3);
    report.rows.forEach(row => {
      const requiredNetChange = row.closingLiability - row.openingLiability -
        row.entriesLiability - row.interest + row.payments;
      const reportedNetChange = row.modificationAdjustment + row.reassessmentAdjustment;
      expect(Math.abs(reportedNetChange - requiredNetChange)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(row.reconciliationDifference)).toBeLessThanOrEqual(0.02);
    });
    expect(Math.abs(report.reconciliation.difference)).toBeLessThanOrEqual(0.02);
    expect(report.reconciliation.passed).toBe(true);
  });

  test("geçmiş dönemdeki modification ve reassessment kapanış bakiyesini birlikte mutabıklaştırır", async () => {
    const historical = contract("HISTORICAL-CHANGES", {
      startDate: "2025-01-01",
      endDate: "2030-12-31",
      monthlyPayment: 12000,
      discountRate: 6
    });
    tfrs16.contracts.push(historical);

    const modification = await tfrs16.createModification(historical, {
      modificationDate: "2025-06-01",
      effectiveDate: "2025-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 13500,
      newDiscountRate: 6,
      newLeaseEndDate: historical.endDate
    });
    expect(modification.valid).toBe(true);
    expect((await tfrs16.applyModification(historical, modification.modification.id)).valid).toBe(true);

    const reassessment = await tfrs16.createReassessment(historical, {
      reassessmentDate: "2025-10-01",
      effectiveDate: "2025-10-01",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 15000,
      newDiscountRate: 6,
      newLeaseEndDate: historical.endDate
    });
    expect(reassessment.valid).toBe(true);
    expect((await tfrs16.applyReassessment(historical, reassessment.reassessment.id)).valid).toBe(true);

    const periodStart = new Date("2025-01-01");
    const periodEnd = new Date("2025-12-31");
    const liability = tfrs16.getLeaseLiabilityRollForwardReport(periodStart, periodEnd);
    const rou = tfrs16.getRuoAssetRollForwardReport(periodStart, periodEnd);
    [liability, rou].forEach(report => {
      expect(report.rows).toHaveLength(1);
      expect(["OK", "READY"]).toContain(report.rows[0].status);
      expect(Math.abs(report.rows[0].reconciliationDifference)).toBeLessThanOrEqual(0.02);
      expect(Math.abs(report.reconciliation.difference)).toBeLessThanOrEqual(0.02);
      expect(report.reconciliation.passed).toBe(true);
    });
  });

  test("admin audit ve dashboard sorguları kayıt sonucunu açıkça döndürür", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../backend/routes/admin.js"),
      "utf8"
    );
    expect((source.match(/END AS success/g) || [])).toHaveLength(2);
  });
});
