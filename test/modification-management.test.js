/**
 * @jest-environment jsdom
 *
 * ============================================================
 * KİRA MODİFİKASYONU — MODÜL TESTLERİ
 * ============================================================
 *
 * Kapsam: createModification / applyModification / updateModification /
 * cancelModification fonksiyonlarının (js/tfrs16.js) mantığını VE
 * backend'e (PostgreSQL) kayıt DAVRANIŞINI doğrular.
 *
 * ÖNEMLİ BULGU (bu dosyanın asıl amacı): bu fonksiyonlar SADECE
 * saveContracts() (localStorage) çağırıyor — persistContractToApi()
 * (backend PUT /api/contracts/:id) HİÇ ÇAĞRILMIYOR. "Backend persistence"
 * describe bloğundaki testler bunu KANITLAR: fetch/tfrs16ApiFetch'in
 * HİÇ ÇAĞRILMADIĞINI doğrularlar — yani PASS olmaları "her şey yolunda"
 * değil, "backend'e hiç yazılmadığı" anlamına gelir. Ayrıntı için
 * konuşma raporuna bakınız.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function baseContract(overrides = {}) {
  return {
    id: "MOD-TEST-" + Math.random().toString(36).slice(2),
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 100000,
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

describe("createModification", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("geçerli input ile DRAFT durumunda bir modification oluşturur", () => {
    const contract = baseContract();
    const result = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000,
      reason: "Test"
    });

    expect(result.valid).toBe(true);
    expect(contract.modifications.length).toBe(1);
    expect(contract.modifications[0].status).toBe("DRAFT");
    expect(contract.modifications[0].modificationType).toBe("PAYMENT_INCREASE");
  });

  test("sözleşmenin GERÇEK alanlarını (monthlyPayment vb.) DEĞİŞTİRMEZ — yalnızca APPLIED anında değişir", () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 999999
    });
    expect(contract.monthlyPayment).toBe(100000);
  });

  test("geçersiz/eksik input reddedilir (valid:false), sözleşmeye kayıt eklenmez", () => {
    const contract = baseContract();
    const result = tfrs16.createModification(contract, {
      // effectiveDate eksik — validateModification'ın reddetmesi beklenir
      modificationType: "PAYMENT_INCREASE"
    });
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(contract.modifications || []).toEqual([]);
  });
});

describe("applyModification", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("APPLIED sonrası sözleşmenin monthlyPayment/discountRate/endDate alanları GERÇEKTEN güncellenir", () => {
    const contract = baseContract({ monthlyPayment: 100000, discountRate: 18 });
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 150000,
      newDiscountRate: 22
    });
    expect(created.valid).toBe(true);

    const applied = tfrs16.applyModification(contract, created.modification.id);
    expect(applied.valid).toBe(true);
    expect(contract.monthlyPayment).toBe(150000);
    expect(contract.discountRate).toBe(22);
    expect(contract.modifications[0].status).toBe("APPLIED");
  });

  test("APPLIED modification için journal (yevmiye) üretilir", () => {
    const contract = baseContract();
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    const applied = tfrs16.applyModification(contract, created.modification.id);
    expect(applied.valid).toBe(true);
    expect(Array.isArray(contract.modifications[0].journal)).toBe(true);
  });

  test("zaten APPLIED olan bir modification tekrar apply edilirse aynı sonucu döner (idempotent), tekrar mutasyon yapmaz", () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 150000
    });
    tfrs16.applyModification(contract, created.modification.id);
    expect(contract.monthlyPayment).toBe(150000);

    // İkinci apply — fail-closed değil ama en azından tekrar başka bir
    // değere MUTASYON yapmamalı (durum zaten APPLIED).
    const secondApply = tfrs16.applyModification(contract, created.modification.id);
    expect(secondApply.valid).toBe(true);
    expect(contract.monthlyPayment).toBe(150000);
  });

  test("var olmayan bir modification id'si için açık hata döner", () => {
    const contract = baseContract();
    const result = tfrs16.applyModification(contract, "NON-EXISTENT-ID");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/bulunamadı/);
  });

  test("CANCELLED bir modification apply edilemez", () => {
    const contract = baseContract();
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    tfrs16.cancelModification(contract, created.modification.id);
    const result = tfrs16.applyModification(contract, created.modification.id);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/CANCELLED/);
  });
});

describe("cancelModification", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("DRAFT bir modification iptal edilebilir (status: CANCELLED)", () => {
    const contract = baseContract();
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    const cancelled = tfrs16.cancelModification(contract, created.modification.id);
    expect(cancelled.valid).toBe(true);
    expect(contract.modifications[0].status).toBe("CANCELLED");
  });

  test("APPLIED bir modification iptal EDİLEMEZ (fail-closed — finansal geçmiş bozulmaz)", () => {
    const contract = baseContract();
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    tfrs16.applyModification(contract, created.modification.id);
    const result = tfrs16.cancelModification(contract, created.modification.id);
    expect(result.valid).toBe(false);
  });
});

describe("updateModification", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("DRAFT bir modification'ın alanları güncellenebilir", () => {
    const contract = baseContract();
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    const updated = tfrs16.updateModification(contract, created.modification.id, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 135000
    });
    expect(updated.valid).toBe(true);
    expect(contract.modifications[0].newTerms.payment).toBe(135000);
  });
});

describe("Kilitli dönem koruması (assertPeriodWritable)", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("kilitli bir döneme düşen effectiveDate ile createModification reddedilir", () => {
    const lockResult = tfrs16.lockPeriod("2026-03", { reason: "test lock" });
    expect(lockResult.success).toBe(true);

    const contract = baseContract();
    const result = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-03-15",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/kilitli/);
  });
});

describe("Backend persistence — createModification/applyModification/cancelModification BACKEND'E YAZMIYOR", () => {
  let tfrs16;
  let fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => {
      throw new Error("fetch ÇAĞRILDI — bu test bunu YAKALAMAK için var");
    });
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  test("createModification sırasında hiçbir backend çağrısı (fetch) yapılmaz", () => {
    const contract = baseContract();
    const result = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    expect(result.valid).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("applyModification sırasında hiçbir backend çağrısı yapılmaz — APPLIED sonrası yeni ödeme/iskonto/bitiş tarihi SADECE localStorage'da kalır", () => {
    const contract = baseContract();
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 150000
    });
    const applied = tfrs16.applyModification(contract, created.modification.id);
    expect(applied.valid).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("cancelModification sırasında hiçbir backend çağrısı yapılmaz", () => {
    const contract = baseContract();
    const created = tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    tfrs16.cancelModification(contract, created.modification.id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("KIYASLAMA: aynı contract, persistContractToApi() ile DOĞRUDAN çağrılırsa fetch GERÇEKTEN tetiklenir — yani sorun 'fetch hiç yok' değil, modification/reassessment akışının bu fonksiyonu çağırmaması", async () => {
    fetchSpy.mockRestore();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: {} })
    });
    localStorage.setItem("access_token", "fake-token-for-test");

    const contract = baseContract();
    await tfrs16.persistContractToApi(contract, false).catch(() => {});
    expect(fetchSpy).toHaveBeenCalled();
  });
});
