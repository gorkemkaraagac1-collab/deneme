/**
 * @jest-environment jsdom
 *
 * ============================================================
 * KİRA REASSESSMENT — MODÜL TESTLERİ (backend-persist sürümü)
 * ============================================================
 *
 * Bkz. test/modification-management.test.js başlığı — aynı yapı ve
 * aynı düzeltme geçmişi (backend-first + rollback) burada da geçerli.
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

function mockOkResponse(data = {}) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}
function mockFailResponse(status = 500, error = "Sunucu hatası") {
  return { ok: false, status, text: async () => JSON.stringify({ error }) };
}

describe("createReassessment — mutlu yol + backend kaydı", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("geçerli input ile DRAFT durumunda bir reassessment oluşturur", async () => {
    const contract = baseContract();
    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2028-12-01",
      reason: "Test"
    });

    expect(result.valid).toBe(true);
    expect(contract.reassessments.length).toBe(1);
    expect(contract.reassessments[0].status).toBe("DRAFT");
  });

  test("backend'e PUT /api/contracts/:id ile, details.reassessments içinde yeni kayıtla çağrı yapılır", async () => {
    const contract = baseContract();
    await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2028-12-01"
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toMatch(new RegExp(`/api/contracts/${contract.id}$`));
    expect(options.method).toBe("PUT");
    const body = JSON.parse(options.body);
    expect(body.details.reassessments.length).toBe(1);
    expect(body.details.reassessments[0].type).toBe("LEASE_TERM_CHANGE");
  });

  test("sözleşmenin GERÇEK alanlarını DEĞİŞTİRMEZ — yalnızca APPLIED anında değişir", async () => {
    const contract = baseContract({ endDate: "2027-12-01" });
    await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    expect(contract.endDate).toBe("2027-12-01");
  });

  test("aynı ekonomik olay ikinci kez oluşturulursa mevcut kayıt döner ve duplicate yazılmaz", async () => {
    const contract = baseContract();
    const input = {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 140000,
      newLeaseEndDate: contract.endDate,
      reason: "Aynı endeks olayı"
    };

    const first = await tfrs16.createReassessment(contract, input);
    const second = await tfrs16.createReassessment(contract, input);

    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
    expect(second.duplicate).toBe(true);
    expect(second.reassessment.id).toBe(first.reassessment.id);
    expect(contract.reassessments).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("geçersiz/eksik input reddedilir, sözleşmeye kayıt eklenmez, backend'e hiç gidilmez", async () => {
    const contract = baseContract();
    const result = await tfrs16.createReassessment(contract, {
      type: "LEASE_TERM_CHANGE"
      // reassessmentDate/effectiveDate eksik
    });
    expect(result.valid).toBe(false);
    expect(contract.reassessments || []).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("effectiveDate, reassessmentDate'ten önce olamaz (validasyon)", async () => {
    const contract = baseContract();
    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-08-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2028-12-01"
    });
    expect(result.valid).toBe(false);
  });
});

describe("createReassessment — backend hatası → ROLLBACK", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
  });

  afterEach(() => fetchSpy && fetchSpy.mockRestore());

  test("backend 500 dönerse valid:false, HATA MESAJI verilir VE contract.reassessments BOŞ kalır", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockFailResponse(500, "DB bağlantı hatası"));
    const contract = baseContract();

    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Backend'e kaydedilemedi/);
    expect(contract.reassessments).toEqual([]);
  });
});

describe("applyReassessment — mutlu yol + backend kaydı", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("APPLIED sonrası sözleşmenin endDate/discountRate alanları GERÇEKTEN güncellenir (LEASE_TERM_CHANGE)", async () => {
    const contract = baseContract({ endDate: "2027-12-01", discountRate: 18 });
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01",
      newDiscountRate: 21
    });
    expect(created.valid).toBe(true);

    const applied = await tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(applied.valid).toBe(true);
    expect(contract.endDate).toBe("2030-12-01");
    expect(contract.discountRate).toBe(21);
    expect(contract.reassessments[0].status).toBe("APPLIED");
  });

  test("APPLY sırasında backend'e ikinci bir PUT çağrısı (güncel endDate ile) yapılır", async () => {
    const contract = baseContract({ endDate: "2027-12-01" });
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    fetchSpy.mockClear();

    await tfrs16.applyReassessment(contract, created.reassessment.id);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.endDate).toBe("2030-12-01");
    expect(body.details.reassessments[0].status).toBe("APPLIED");
  });

  test("LEASE_TERM_CHANGE tipinde monthlyPayment KASITLI OLARAK korunur (newPayment gönderilse bile yok sayılır — iş kuralı)", async () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01",
      newPayment: 999999
    });
    await tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(contract.monthlyPayment).toBe(100000);
  });

  test("FIXED_PAYMENT_CHANGE tipinde monthlyPayment APPLIED sonrası GERÇEKTEN güncellenir", async () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "FIXED_PAYMENT_CHANGE",
      newPayment: 140000,
      newLeaseEndDate: contract.endDate
    });
    expect(created.valid).toBe(true);
    const applied = await tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(applied.valid).toBe(true);
    expect(contract.monthlyPayment).toBe(140000);
  });

  test("opsiyon (renewal/termination/purchase) reassessment'i APPLIED sonrası contract flag'lerini günceller", async () => {
    const contract = baseContract({ renewalOption: false });
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "RENEWAL_OPTION_CHANGE",
      newRenewalOption: true,
      newLeaseEndDate: contract.endDate
    });
    expect(created.valid).toBe(true);
    await tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(contract.renewalOption).toBe(true);
  });

  test("APPLIED reassessment için journal (yevmiye) üretilir", async () => {
    const contract = baseContract();
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    await tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(Array.isArray(contract.reassessments[0].journal)).toBe(true);
  });

  test("zaten APPLIED olan bir reassessment tekrar apply edilirse aynı sonucu döner (idempotent), backend'e tekrar gitmez", async () => {
    const contract = baseContract({ endDate: "2027-12-01" });
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    await tfrs16.applyReassessment(contract, created.reassessment.id);
    fetchSpy.mockClear();

    const second = await tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(second.valid).toBe(true);
    expect(contract.endDate).toBe("2030-12-01");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("var olmayan bir reassessment id'si için açık hata döner", async () => {
    const contract = baseContract();
    const result = await tfrs16.applyReassessment(contract, "NON-EXISTENT-ID");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/bulunamadı/);
  });

  test("CANCELLED bir reassessment apply edilemez", async () => {
    const contract = baseContract();
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    await tfrs16.cancelReassessment(contract, created.reassessment.id);
    const result = await tfrs16.applyReassessment(contract, created.reassessment.id);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/CANCELLED/);
  });
});

describe("applyReassessment — backend hatası → TAM ROLLBACK", () => {
  let tfrs16;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
  });

  test("APPLY sırasında backend hata verirse hem contract alanları hem reassessment objesi APPLY ÖNCESİ haline TAM olarak döner", async () => {
    let callCount = 0;
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => {
      callCount += 1;
      return callCount === 1 ? mockOkResponse({ success: true }) : mockFailResponse(500, "Zaman aşımı");
    });

    const contract = baseContract({ endDate: "2027-12-01", discountRate: 18 });
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01",
      newDiscountRate: 25
    });
    expect(created.valid).toBe(true);

    const applied = await tfrs16.applyReassessment(contract, created.reassessment.id);

    expect(applied.valid).toBe(false);
    expect(applied.errors.join(" ")).toMatch(/Backend'e kaydedilemedi/);
    expect(contract.endDate).toBe("2027-12-01");
    expect(contract.discountRate).toBe(18);
    expect(contract.reassessments[0].status).toBe("DRAFT");
    expect(contract.reassessments[0].journal).toBeUndefined();

    fetchSpy.mockRestore();
  });
});

describe("cancelReassessment", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("DRAFT bir reassessment iptal edilebilir (status: CANCELLED)", async () => {
    const contract = baseContract();
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    const cancelled = await tfrs16.cancelReassessment(contract, created.reassessment.id);
    expect(cancelled.valid).toBe(true);
    expect(contract.reassessments[0].status).toBe("CANCELLED");
  });

  test("APPLIED bir reassessment iptal EDİLEMEZ (fail-closed)", async () => {
    const contract = baseContract();
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    await tfrs16.applyReassessment(contract, created.reassessment.id);
    const result = await tfrs16.cancelReassessment(contract, created.reassessment.id);
    expect(result.valid).toBe(false);
  });

  test("backend hata verirse status DRAFT'a geri döner", async () => {
    const contract = baseContract();
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    fetchSpy.mockResolvedValueOnce(mockFailResponse(500));
    const result = await tfrs16.cancelReassessment(contract, created.reassessment.id);
    expect(result.valid).toBe(false);
    expect(contract.reassessments[0].status).toBe("DRAFT");
  });
});

describe("updateReassessment", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("DRAFT bir reassessment'in alanları güncellenebilir ve backend'e yazılır", async () => {
    const contract = baseContract();
    const created = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    const updated = await tfrs16.updateReassessment(contract, created.reassessment.id, {
      reassessmentDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2031-06-01"
    });
    expect(updated.valid).toBe(true);
    expect(contract.reassessments[0].newTerms.leaseTerm).toBe("2031-06-01");
  });
});

describe("Kilitli dönem koruması (assertPeriodWritable) — backend'e hiç gidilmez", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("kilitli bir döneme düşen effectiveDate ile createReassessment reddedilir, fetch hiç çağrılmaz", async () => {
    const lockResult = tfrs16.lockPeriod("2026-04", { reason: "test lock" });
    expect(lockResult.success).toBe(true);

    const contract = baseContract();
    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-04-10",
      effectiveDate: "2026-04-15",
      type: "LEASE_TERM_CHANGE",
      newLeaseEndDate: "2030-12-01"
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/kilitli/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
