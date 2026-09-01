/**
 * @jest-environment jsdom
 *
 * ============================================================
 * FAZ 0.1 — REGRESYON MATRİSİ KAPSAMA TESTİ
 * ============================================================
 *
 * Matrisin plandaki boyutları GERÇEKTEN kapsadığını denetler.
 * Bu test olmadan matris zamanla sessizce çürür: biri bir fixture'ı
 * siler, kapsama düşer, kimse fark etmez ve golden-output yeşil
 * kalmaya devam eder — yani güvenlik ağı delinir ama alarm çalmaz.
 */

const { CONTRACT_MATRIX, REQUIRED_DIMENSIONS } = require("./fixtures/contract-matrix");
const { SLB_CASES, SUBLEASE_CASES } = require("./fixtures/slb-sublease");

describe("Faz 0.1 — regresyon matrisi kapsaması", () => {
  test("matris 25–30 kontrat içerir", () => {
    expect(CONTRACT_MATRIX.length).toBeGreaterThanOrEqual(25);
    expect(CONTRACT_MATRIX.length).toBeLessThanOrEqual(30);
  });

  test("fixture kimlikleri benzersiz", () => {
    const ids = CONTRACT_MATRIX.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("kontrat kimlikleri fixture kimlikleriyle eşleşir", () => {
    CONTRACT_MATRIX.forEach(f => {
      expect(f.contract.id).toBe(f.id);
    });
  });

  test("her fixture en az bir raporlama tarihi tanımlar", () => {
    CONTRACT_MATRIX.forEach(f => {
      expect(Array.isArray(f.reportingDates)).toBe(true);
      expect(f.reportingDates.length).toBeGreaterThan(0);
    });
  });

  test("planın ZORUNLU boyutlarının HEPSİ en az bir kez kapsanmış", () => {
    const covered = new Set();
    CONTRACT_MATRIX.forEach(f => (f.dimensions || []).forEach(d => covered.add(d)));

    const missing = REQUIRED_DIMENSIONS.filter(d => !covered.has(d));
    if (missing.length) {
      throw new Error(
        `Matris kapsaması EKSİK. Kapsanmayan boyutlar:\n  ${missing.join("\n  ")}`
      );
    }
    expect(missing).toHaveLength(0);
  });

  test("en az bir YÜKSEK RİSKLİ KESİŞİM temsil edilmiş (FX + endeks + modification)", () => {
    const intersections = CONTRACT_MATRIX.filter(f =>
      (f.dimensions || []).some(d => d.startsWith("intersection:"))
    );
    expect(intersections.length).toBeGreaterThanOrEqual(3);

    const fxIndexMod = CONTRACT_MATRIX.find(f =>
      (f.dimensions || []).includes("intersection:fx+index+modification")
    );
    expect(fxIndexMod).toBeDefined();
    expect(fxIndexMod.contract.currency).not.toBe("TRY");
    expect(fxIndexMod.contract.leaseIncreaseType).toBe("index");
    expect((fxIndexMod.modificationInputs || []).length).toBeGreaterThan(0);
  });

  test("zincirli modification (2+) kapsanmış", () => {
    const chained = CONTRACT_MATRIX.filter(f => (f.modificationInputs || []).length >= 2);
    expect(chained.length).toBeGreaterThanOrEqual(1);
  });

  test("SLB ve Sublease senaryoları tanımlı", () => {
    expect(SLB_CASES.length).toBeGreaterThanOrEqual(1);
    expect(SUBLEASE_CASES.length).toBeGreaterThanOrEqual(1);
    SLB_CASES.forEach(c => expect(c.input.leasebackContract).toBeDefined());
    SUBLEASE_CASES.forEach(c => {
      expect(c.input.headLeaseContract).toBeDefined();
      expect(c.input.subleaseContract).toBeDefined();
    });
  });
});
