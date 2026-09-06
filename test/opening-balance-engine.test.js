/** @jest-environment jsdom */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("approved TFRS 16 opening balance", () => {
  beforeEach(() => {
    localStorage.clear();
    delete window.__TFRS16_TEST__;
  });

  test("starts the forward schedule from the approved cut-over balance", () => {
    const tfrs16 = loadTfrs16();
    const result = tfrs16.calculateLeaseEngine({
      id: "OPENING-TEST-1",
      companyId: "C-1",
      monthlyPayment: 1000,
      discountRate: 12,
      startDate: "2020-01-01",
      endDate: "2026-12-01",
      currency: "TRY",
      openingBalance: {
        status: "APPROVED",
        opening_date: "2025-12-31",
        opening_rou_asset: "9000.00",
        opening_lease_liability: "10000.00"
      }
    });

    expect(result.openingBalanceApplied).toBe(true);
    expect(result.liability).toBe(10000);
    expect(result.rouAssets).toBe(9000);
    expect(result.schedule[0].date.getFullYear()).toBe(2026);
    expect(result.schedule[0].openingLiability).toBe(10000);
  });

  test("leaves legacy contracts unchanged without an approved balance", () => {
    const tfrs16 = loadTfrs16();
    const result = tfrs16.calculateLeaseEngine({
      id: "OPENING-TEST-2",
      monthlyPayment: 1000,
      discountRate: 12,
      startDate: "2026-01-01",
      endDate: "2026-12-01"
    });

    expect(result.openingBalanceApplied).toBeUndefined();
    expect(result.schedule[0].date.getFullYear()).toBe(2026);
  });

  test("does not apply an imported but unapproved balance", () => {
    const tfrs16 = loadTfrs16();
    const result = tfrs16.calculateLeaseEngine({
      id: "OPENING-TEST-3",
      monthlyPayment: 1000,
      discountRate: 12,
      startDate: "2020-01-01",
      endDate: "2026-12-01",
      openingBalance: {
        status: "IMPORTED",
        opening_date: "2025-12-31",
        opening_rou_asset: 9000,
        opening_lease_liability: 10000
      }
    });

    expect(result.openingBalanceApplied).toBeUndefined();
    expect(result.schedule[0].date.getFullYear()).toBe(2020);
  });
});
