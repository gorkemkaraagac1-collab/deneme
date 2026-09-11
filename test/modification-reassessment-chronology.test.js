/** @jest-environment jsdom */
const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("Modification + reassessment kronolojik ödeme zinciri", () => {
  test("olaylar hangi sırayla girilirse girilsin yürürlük tarihine göre uygulanır", () => {
    localStorage.clear();
    const tfrs16 = loadTfrs16();
    const contract = {
      id: "CHRONO-CROSS-1", companyId: "C-1", monthlyPayment: 12000,
      discountRate: 6, startDate: "2025-01-01", endDate: "2030-12-31",
      paymentFrequency: "monthly", paymentTiming: "arrears", currency: "TRY",
      functionalCurrency: "TRY", reportingCurrency: "TRY", status: "active",
      modifications: [
        { id: "MOD-MAR", status: "APPLIED", effectiveDate: "2026-03-01", modificationType: "PAYMENT_INCREASE", newTerms: { payment: 15000, discountRate: 6, leaseEndDate: "2030-12-31" }, createdAt: "2026-01-01T00:00:00.000Z" },
        { id: "MOD-JUL", status: "APPLIED", effectiveDate: "2025-07-01", modificationType: "PAYMENT_INCREASE", newTerms: { payment: 13500, discountRate: 6, leaseEndDate: "2030-12-31" }, createdAt: "2025-06-01T00:00:00.000Z" }
      ],
      reassessments: [
        { id: "REASS-OCT", status: "APPLIED", effectiveDate: "2025-10-01", type: "FIXED_PAYMENT_CHANGE", newTerms: { payment: 14000, discountRate: 6, leaseTerm: "2030-12-31" }, createdAt: "2025-09-01T00:00:00.000Z" }
      ]
    };
    const source = tfrs16.resolveContractScheduleSource(contract);
    expect(source.source).toBe("REASSESSED_SCHEDULE");
    const paymentAt = month => { const [y,m] = month.split("-").map(Number); return source.schedule.find(row => row.date instanceof Date && row.date.getUTCFullYear() === y && row.date.getUTCMonth() + 1 === m)?.payment; };
    expect(paymentAt("2025-06")).toBeCloseTo(12000, 2);
    expect(paymentAt("2025-07")).toBeCloseTo(13500, 2);
    expect(paymentAt("2025-09")).toBeCloseTo(13500, 2);
    expect(paymentAt("2025-10")).toBeCloseTo(14000, 2);
    expect(paymentAt("2026-02")).toBeCloseTo(14000, 2);
    expect(paymentAt("2026-03")).toBeCloseTo(15000, 2);
  });
});
