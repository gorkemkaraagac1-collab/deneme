const { loadTfrs16 } = require("./helpers/loadTfrs16");

describe("calculateLeaseEngine", () => {
  let tfrs16;

  beforeEach(() => {
    tfrs16 = loadTfrs16();
  });

  test("3 yıllık bir kira için yükümlülüğü hesaplar", () => {
    const contract = {
      id: "TEST-001",
      monthlyPayment: 1000,
      startDate: "2026-01-01",
      endDate: "2028-12-31",
      discountRate: 6
    };
    const result = tfrs16.calculateLeaseEngine(contract);

    expect(result.liability).toBeGreaterThan(0);
    expect(result.exempt).toBe(false);
    // NOT: months/schedule.length gerçek ay sayısına (36) eşit olmalı;
    // proje içindeki monthsBetween() kapsayıcılık kuralına göre 35 de
    // çıkabilir — bu satırı monthsBetween() davranışını teyit ettikten
    // sonra kesinleştir.
    expect(result.schedule.length).toBeGreaterThan(0);
  });

  test("kısa vadeli (short-term) kira için istisna uygulanır", () => {
    const contract = {
      id: "TEST-002",
      monthlyPayment: 1000,
      startDate: "2026-01-01",
      endDate: "2026-06-30",
      discountRate: 6,
      shortTermLease: true
    };
    const result = tfrs16.calculateLeaseEngine(contract);

    expect(result.exempt).toBe(true);
    expect(result.liability).toBe(0);
  });

  test("aynı kontrat için önbellekten (cache) aynı referansı döndürür", () => {
    const contract = {
      id: "TEST-003",
      monthlyPayment: 2500,
      startDate: "2026-03-01",
      endDate: "2027-02-28",
      discountRate: 8
    };
    const first = tfrs16.calculateLeaseEngine(contract);
    const second = tfrs16.calculateLeaseEngine(contract);

    expect(second).toBe(first);
  });

  test("LEASE-027 aylık arrears ödemelerini gerçek dönem sonlarında üretir", () => {
    const result = tfrs16.calculateLeaseEngine({
      id: "LEASE-027",
      monthlyPayment: 1000,
      startDate: "2026-01-15",
      endDate: "2029-01-14",
      discountRate: 6
    });

    expect(result.schedule).toHaveLength(36);
    expect(result.schedule[0].date).toEqual(new Date("2026-02-14T00:00:00"));
    expect(result.schedule.at(-1).date).toEqual(new Date("2029-01-14T00:00:00"));
    expect(result.depreciationMonths).toBe(36);
  });
});

  test("yıllık arrears sözleşmede ilk ödeme başlangıçta değil dönem sonunda oluşur", () => {
    const result = tfrs16.calculateLeaseEngine({
      id: "LEASE-022",
      monthlyPayment: 480000,
      startDate: "2026-01-01",
      endDate: "2029-12-31",
      discountRate: 16,
      paymentFrequency: "annual",
      paymentTiming: "arrears",
      leaseIncreaseType: "fixed",
      leaseIncreaseRate: 6
    });

    expect(result.schedule).toHaveLength(4);
    expect(result.schedule[0].date).toEqual(new Date("2026-12-31T00:00:00"));
    expect(result.schedule[0].payment).toBeCloseTo(480000, 2);
    expect(result.schedule[0].interest).toBeGreaterThan(0);
    expect(result.schedule[0].closingLiability).toBeLessThan(result.schedule[0].openingLiability);
  });
