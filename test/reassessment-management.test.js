/**
 * @jest-environment jsdom
 *
 * ============================================================
 * KİRA REASSESSMENT — MODÜL TESTLERİ
 * ============================================================
 *
 * Kapsam: createReassessment / applyReassessment / updateReassessment /
 * cancelReassessment fonksiyonlarının (js/tfrs16.js) mantığını VE
 * backend'e (PostgreSQL) kayıt DAVRANIŞINI doğrular.
 *
 * Aynı yapı ve aynı ÖNEMLİ BULGU test/modification-management.test.js
 * dosyasındaki gibi: "Backend persistence" bloğundaki testler PASS
 * olur ama bu "her şey yolunda" değil, "backend'e hiç yazılmadığı"
 * anlamına gelir — bkz. konuşma raporu.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function baseContract(overrides = {}) {
  return {
    id: "REASS-TEST-" + Math.random().toString(36).slice(2),
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

describe("createReassessment", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("geçerli input ile DRAFT durumunda bir reassessment oluşturur", () => {
    const contract = baseContract();
    const result = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2028-12-01",
      reason: "Test"
    });

    expect(result.valid).toBe(true);
    expect(contract.reassessments.length).toBe(1);
    expect(contract.reassessments[0].status).toBe("DRAFT");
    expect(contract.reassessments[0].type).toBe("LEASE_TERM_CHANGE");
  });

  test("sözleşmenin GERÇEK alanlarını DEĞİŞTİRMEZ — yalnızca APPLIED anında değişir", () => {
    const contract = baseContract({ endDate: "2027-12-01" });
    tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    expect(contract.endDate).toBe("2027-12-01");
  });

  test("geçersiz/eksik input reddedilir, sözleşmeye kayıt eklenmez", () => {
    const contract = baseContract();
    const result = tfrs16.createReassessment(contract, {
      // reassessmentDate ve effectiveDate eksik
      type: "LEASE_TERM_CHANGE"
    });
    expect(result.valid).toBe(false);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(contract.reassessments || []).toEqual([]);
  });

  test("effectiveDate, reassessmentDate'ten önce olamaz (validasyon)", () => {
    const contract = baseContract();
    const result = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-08-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2028-12-01"
    });
    expect(result.valid).toBe(false);
  });
});

describe("applyReassessment", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("APPLIED sonrası sözleşmenin endDate/discountRate alanları GERÇEKTEN güncellenir (LEASE_TERM_CHANGE)", () => {
    const contract = baseContract({ endDate: "2027-12-01", discountRate: 18 });
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01",
      newDiscountRate: 21
    });
    expect(created.valid).toBe(true);

    const applied = tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(applied.valid).toBe(true);
    expect(contract.endDate).toBe("2030-12-01");
    expect(contract.discountRate).toBe(21);
    expect(contract.reassessments[0].status).toBe("APPLIED");
  });

  test("LEASE_TERM_CHANGE tipinde monthlyPayment KASITLI OLARAK korunur (newPayment gönderilse bile yok sayılır — iş kuralı)", () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01",
      newPayment: 999999
    });
    tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(contract.monthlyPayment).toBe(100000);
  });

  test("FIXED_PAYMENT_CHANGE tipinde monthlyPayment APPLIED sonrası GERÇEKTEN güncellenir", () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 140000,
      newLeaseEndDate: contract.endDate
    });
    expect(created.valid).toBe(true);
    const applied = tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(applied.valid).toBe(true);
    expect(contract.monthlyPayment).toBe(140000);
  });

  test("opsiyon (renewal/termination/purchase) reassessment'i APPLIED sonrası contract flag'lerini günceller", () => {
    const contract = baseContract({ renewalOption: false });
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "RENEWAL_OPTION_CHANGE",
      newRenewalOption: true,
      newLeaseEndDate: contract.endDate
    });
    expect(created.valid).toBe(true);
    tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(contract.renewalOption).toBe(true);
  });

  test("APPLIED reassessment için journal (yevmiye) üretilir", () => {
    const contract = baseContract();
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(Array.isArray(contract.reassessments[0].journal)).toBe(true);
  });

  test("zaten APPLIED olan bir reassessment tekrar apply edilirse aynı sonucu döner (idempotent)", () => {
    const contract = baseContract({ endDate: "2027-12-01" });
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(contract.endDate).toBe("2030-12-01");

    const second = tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(second.valid).toBe(true);
    expect(contract.endDate).toBe("2030-12-01");
  });

  test("var olmayan bir reassessment id'si için açık hata döner", () => {
    const contract = baseContract();
    const result = tfrs16.applyReassessment(contract, "NON-EXISTENT-ID");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/bulunamadı/);
  });

  test("CANCELLED bir reassessment apply edilemez", () => {
    const contract = baseContract();
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    tfrs16.cancelReassessment(contract, created.reassessment.id);
    const result = tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/CANCELLED/);
  });
});

describe("cancelReassessment", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("DRAFT bir reassessment iptal edilebilir (status: CANCELLED)", () => {
    const contract = baseContract();
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    const cancelled = tfrs16.cancelReassessment(contract, created.reassessment.id);
    expect(cancelled.valid).toBe(true);
    expect(contract.reassessments[0].status).toBe("CANCELLED");
  });

  test("APPLIED bir reassessment iptal EDİLEMEZ (fail-closed)", () => {
    const contract = baseContract();
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    tfrs16.applyReassessment(contract, created.reassessment.id);
    const result = tfrs16.cancelReassessment(contract, created.reassessment.id);
    expect(result.valid).toBe(false);
  });
});

describe("updateReassessment", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("DRAFT bir reassessment'in alanları güncellenebilir", () => {
    const contract = baseContract();
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    const updated = tfrs16.updateReassessment(contract, created.reassessment.id, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2031-06-01"
    });
    expect(updated.valid).toBe(true);
    expect(contract.reassessments[0].newTerms.leaseTerm).toBe("2031-06-01");
  });
});

describe("Kilitli dönem koruması (assertPeriodWritable)", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("kilitli bir döneme düşen effectiveDate ile createReassessment reddedilir", () => {
    const lockResult = tfrs16.lockPeriod("2026-04", { reason: "test lock" });
    expect(lockResult.success).toBe(true);

    const contract = baseContract();
    const result = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-04-10",
      effectiveDate: "2026-04-15",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/kilitli/);
  });
});

describe("Backend persistence — createReassessment/applyReassessment/cancelReassessment BACKEND'E YAZMIYOR", () => {
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

  test("createReassessment sırasında hiçbir backend çağrısı yapılmaz", () => {
    const contract = baseContract();
    const result = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    expect(result.valid).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("applyReassessment sırasında hiçbir backend çağrısı yapılmaz — APPLIED sonrası yeni kira bitiş/ödeme/iskonto SADECE localStorage'da kalır", () => {
    const contract = baseContract();
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    const applied = tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(applied.valid).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("cancelReassessment sırasında hiçbir backend çağrısı yapılmaz", () => {
    const contract = baseContract();
    const created = tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    tfrs16.cancelReassessment(contract, created.reassessment.id);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
