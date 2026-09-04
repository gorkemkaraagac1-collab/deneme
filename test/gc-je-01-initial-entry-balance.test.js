/**
 * @jest-environment jsdom
 *
 * ============================================================
 * GC-JE-01 — İLK MUHASEBELEŞTİRME FİŞİ BORÇ/ALACAK DENGESİZLİĞİ
 * ============================================================
 *
 * Kök neden: generateInitialEntry() yalnızca 260 (ROU) / 401
 * (Yükümlülük) satırlarını üretiyordu. ROU'nun ilk ölçümü (TFRS
 * 16.24) doğrudan ilk maliyetler + peşin ödemeler + restorasyon
 * karşılığını İÇERİR, teşvikleri DÜŞER — ama bu bileşenlerin karşı
 * kayıtları hiç yazılmıyordu. Herhangi biri sıfırdan farklı olduğunda
 * (ör. LEASE-026: doğrudan ilk maliyetler 500.000 + peşin ödemeler
 * 200.000 + restorasyon 1.500.000 = 2.200.000 TL) fiş dengesiz
 * çıkıyordu.
 */
const { loadTfrs16 } = require("./helpers/loadTfrs16");

function baseContract(overrides = {}) {
  return {
    id: "GCJE01-TEST",
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 550000,
    discountRate: 13.5,
    startDate: "2024-07-01",
    endDate: "2034-06-30",
    currency: "TRY",
    paymentFrequency: "monthly",
    paymentTiming: "advance",
    ...overrides
  };
}

describe("GC-JE-01: ilk muhasebeleştirme fişi dengesi", () => {
  test("doğrudan ilk maliyet + peşin ödeme + restorasyon karşılığı olan sözleşmede fiş dengede kalır (LEASE-026 senaryosu)", () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({
      initialDirectCosts: 500000,
      restorationObligation: 1500000,
      prepayments: 200000,
      leaseIncentives: 0
    });

    const entries = tfrs16.generateInitialEntry(contract);

    const totalDebit = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);

    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);

    // ROU debit'i ile Liability credit'i arasındaki farkın tam olarak
    // eklenen üç bileşenin toplamı kadar olduğunu doğrula.
    const rouLine = entries.find(e => e.account.includes("260"));
    const liabilityLine = entries.find(e => e.account.includes("401"));
    expect(rouLine.debit - liabilityLine.credit).toBeCloseTo(2200000, 1);
  });

  test("teşvik (lease incentive) olan sözleşmede de fiş dengede kalır", () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({
      initialDirectCosts: 0,
      restorationObligation: 0,
      prepayments: 0,
      leaseIncentives: 300000
    });

    const entries = tfrs16.generateInitialEntry(contract);
    const totalDebit = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });

  test("hiçbir ek bileşen olmayan sade sözleşmede davranış değişmez (regresyon yok — yalnızca 2 satır)", () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({
      initialDirectCosts: 0,
      restorationObligation: 0,
      prepayments: 0,
      leaseIncentives: 0
    });

    const entries = tfrs16.generateInitialEntry(contract);
    expect(entries.length).toBe(2);
    const totalDebit = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
    const totalCredit = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);
  });
});
