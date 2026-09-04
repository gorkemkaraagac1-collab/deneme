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
    expect(report.reconciliation.passed).toBe(true);
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

  test("admin audit ve dashboard sorguları kayıt sonucunu açıkça döndürür", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../backend/routes/admin.js"),
      "utf8"
    );
    expect((source.match(/END AS success/g) || [])).toHaveLength(2);
  });
});
