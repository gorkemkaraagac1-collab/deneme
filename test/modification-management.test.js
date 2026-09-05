/**
 * @jest-environment jsdom
 *
 * ============================================================
 * KİRA MODİFİKASYONU — MODÜL TESTLERİ (backend-persist sürümü)
 * ============================================================
 *
 * Kapsam: createModification / applyModification / updateModification /
 * cancelModification fonksiyonlarının (js/tfrs16.js) mantığını VE
 * backend'e (PostgreSQL, persistContractToApi → PUT /api/contracts/:id)
 * GERÇEKTEN kayıt yapıp yapmadığını doğrular.
 *
 * DEĞİŞİKLİK GEÇMİŞİ: bu fonksiyonlar önceden SADECE localStorage'a
 * yazıyordu — backend'e HİÇ senkronize olmuyordu. Düzeltme sonrası
 * artık backend-first + rollback stratejisi uygulanıyor: fonksiyonlar
 * async'e çevrildi, backend yazma BAŞARISIZ olursa yerel değişiklik
 * TAM olarak geri alınıyor. Bu dosya hem "backend'e doğru yazılıyor
 * mu" (mutlu yol) hem de "backend hata verirse yerel state kirlenmeden
 * geri dönüyor mu" (rollback) senaryolarını kapsıyor.
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

// tfrs16ApiFetch res.text() okuyor (res.json() DEĞİL) — mock bunu yansıtmalı.
function mockOkResponse(data = {}) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}
function mockFailResponse(status = 500, error = "Sunucu hatası") {
  return { ok: false, status, text: async () => JSON.stringify({ error }) };
}

describe("createModification — mutlu yol + backend kaydı", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("geçerli input ile DRAFT durumunda bir modification oluşturur", async () => {
    const contract = baseContract();
    const result = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000,
      reason: "Test"
    });

    expect(result.valid).toBe(true);
    expect(contract.modifications.length).toBe(1);
    expect(contract.modifications[0].status).toBe("DRAFT");
  });

  test("backend'e PUT /api/contracts/:id ile, details.modifications içinde yeni kayıtla çağrı yapılır", async () => {
    const contract = baseContract();
    await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toMatch(new RegExp(`/api/contracts/${contract.id}$`));
    expect(options.method).toBe("PUT");
    const body = JSON.parse(options.body);
    expect(body.details.modifications.length).toBe(1);
    expect(body.details.modifications[0].modificationType).toBe("PAYMENT_INCREASE");
  });

  test("sözleşmenin GERÇEK alanlarını (monthlyPayment vb.) DEĞİŞTİRMEZ — yalnızca APPLIED anında değişir", async () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    await tfrs16.createModification(contract, {
      effectiveDate: "2026-07-01",
      modificationDate: "2026-06-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 999999
    });
    expect(contract.monthlyPayment).toBe(100000);
  });

  test("geçersiz/eksik input reddedilir (valid:false), sözleşmeye kayıt eklenmez, backend'e hiç gidilmez", async () => {
    const contract = baseContract();
    const result = await tfrs16.createModification(contract, {
      modificationType: "PAYMENT_INCREASE"
      // effectiveDate/modificationDate eksik
    });
    expect(result.valid).toBe(false);
    expect(contract.modifications || []).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test.each([
    ["PAYMENT_INCREASE", 100000, /mevcut ödemeden büyük/],
    ["PAYMENT_INCREASE", 90000, /mevcut ödemeden büyük/],
    ["PAYMENT_DECREASE", 100000, /mevcut ödemeden küçük/],
    ["PAYMENT_DECREASE", 110000, /mevcut ödemeden küçük/]
  ])("%s, ekonomik yönüyle uyumsuz %s ödemeyi reddeder", async (modificationType, newPayment, expectedError) => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const result = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType,
      newPayment
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(expectedError);
    expect(contract.modifications).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("createModification — backend hatası → ROLLBACK", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
  });

  afterEach(() => fetchSpy && fetchSpy.mockRestore());

  test("backend 500 dönerse valid:false, HATA MESAJI verilir VE contract.modifications BOŞ kalır (yerel kayıt geri alınır)", async () => {
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockFailResponse(500, "DB bağlantı hatası"));
    const contract = baseContract();

    const result = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Backend'e kaydedilemedi/);
    expect(contract.modifications).toEqual([]);
  });

  test("token yoksa (oturum yok) da aynı şekilde rollback olur", async () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("gk_backend_jwt");
    fetchSpy = jest.spyOn(global, "fetch").mockImplementation(() => {
      throw new Error("fetch hiç çağrılmamalı — token kontrolü ondan önce devreye girer");
    });
    const contract = baseContract();

    const result = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });

    expect(result.valid).toBe(false);
    expect(contract.modifications).toEqual([]);
  });
});

describe("applyModification — mutlu yol + backend kaydı", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("APPLIED sonrası sözleşmenin monthlyPayment/discountRate/endDate alanları GERÇEKTEN güncellenir", async () => {
    const contract = baseContract({ monthlyPayment: 100000, discountRate: 18 });
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 150000,
      newDiscountRate: 22
    });
    expect(created.valid).toBe(true);

    const applied = await tfrs16.applyModification(contract, created.modification.id);
    expect(applied.valid).toBe(true);
    expect(contract.monthlyPayment).toBe(150000);
    expect(contract.discountRate).toBe(22);
    expect(contract.modifications[0].status).toBe("APPLIED");
  });

  test("APPLY sırasında backend'e ikinci bir PUT çağrısı (güncel monthlyPayment ile) yapılır", async () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 150000
    });
    fetchSpy.mockClear();

    await tfrs16.applyModification(contract, created.modification.id);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options.body);
    expect(body.monthlyPayment).toBe(150000);
    expect(body.details.modifications[0].status).toBe("APPLIED");
  });

  test("APPLIED modification için journal (yevmiye) üretilir", async () => {
    const contract = baseContract();
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    const applied = await tfrs16.applyModification(contract, created.modification.id);
    expect(applied.valid).toBe(true);
    expect(Array.isArray(contract.modifications[0].journal)).toBe(true);
  });

  test("zaten APPLIED olan bir modification tekrar apply edilirse aynı sonucu döner (idempotent), backend'e tekrar gitmez", async () => {
    const contract = baseContract({ monthlyPayment: 100000 });
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 150000
    });
    await tfrs16.applyModification(contract, created.modification.id);
    fetchSpy.mockClear();

    const second = await tfrs16.applyModification(contract, created.modification.id);
    expect(second.valid).toBe(true);
    expect(contract.monthlyPayment).toBe(150000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  test("var olmayan bir modification id'si için açık hata döner", async () => {
    const contract = baseContract();
    const result = await tfrs16.applyModification(contract, "NON-EXISTENT-ID");
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/bulunamadı/);
  });

  test("CANCELLED bir modification apply edilemez", async () => {
    const contract = baseContract();
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    await tfrs16.cancelModification(contract, created.modification.id);
    const result = await tfrs16.applyModification(contract, created.modification.id);
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/CANCELLED/);
  });
});

describe("applyModification — backend hatası → TAM ROLLBACK", () => {
  let tfrs16;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
  });

  test("APPLY sırasında backend hata verirse hem contract alanları hem modification objesi APPLY ÖNCESİ haline TAM olarak döner", async () => {
    // İlk çağrı (createModification) başarılı, ikinci çağrı (apply) başarısız.
    let callCount = 0;
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => {
      callCount += 1;
      return callCount === 1 ? mockOkResponse({ success: true }) : mockFailResponse(500, "Zaman aşımı");
    });

    const contract = baseContract({ monthlyPayment: 100000, discountRate: 18, endDate: "2027-12-01" });
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 150000,
      newDiscountRate: 25
    });
    expect(created.valid).toBe(true);

    const applied = await tfrs16.applyModification(contract, created.modification.id);

    expect(applied.valid).toBe(false);
    expect(applied.errors.join(" ")).toMatch(/Backend'e kaydedilemedi/);
    // Rollback doğrulaması — hiçbir alan APPLY sonrası değerinde KALMAMALI.
    expect(contract.monthlyPayment).toBe(100000);
    expect(contract.discountRate).toBe(18);
    expect(contract.modifications[0].status).toBe("DRAFT");
    expect(contract.modifications[0].journal).toBeUndefined();

    fetchSpy.mockRestore();
  });
});

describe("cancelModification", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("DRAFT bir modification iptal edilebilir (status: CANCELLED), backend'e yazılır", async () => {
    const contract = baseContract();
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    const cancelled = await tfrs16.cancelModification(contract, created.modification.id);
    expect(cancelled.valid).toBe(true);
    expect(contract.modifications[0].status).toBe("CANCELLED");
  });

  test("APPLIED bir modification iptal EDİLEMEZ (fail-closed — finansal geçmiş bozulmaz)", async () => {
    const contract = baseContract();
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    await tfrs16.applyModification(contract, created.modification.id);
    const result = await tfrs16.cancelModification(contract, created.modification.id);
    expect(result.valid).toBe(false);
  });

  test("backend hata verirse status DRAFT'a geri döner", async () => {
    const contract = baseContract();
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    fetchSpy.mockResolvedValueOnce(mockFailResponse(500));
    const result = await tfrs16.cancelModification(contract, created.modification.id);
    expect(result.valid).toBe(false);
    expect(contract.modifications[0].status).toBe("DRAFT");
  });
});

describe("updateModification", () => {
  let tfrs16, fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    tfrs16 = loadTfrs16();
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("DRAFT bir modification'ın alanları güncellenebilir ve backend'e yazılır", async () => {
    const contract = baseContract();
    const created = await tfrs16.createModification(contract, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    const updated = await tfrs16.updateModification(contract, created.modification.id, {
      modificationDate: "2026-06-01",
      effectiveDate: "2026-07-01",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 135000
    });
    expect(updated.valid).toBe(true);
    expect(contract.modifications[0].newTerms.payment).toBe(135000);
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

  test("kilitli bir döneme düşen effectiveDate ile createModification reddedilir, fetch hiç çağrılmaz", async () => {
    const lockResult = tfrs16.lockPeriod("2026-03", { reason: "test lock" });
    expect(lockResult.success).toBe(true);

    const contract = baseContract();
    const result = await tfrs16.createModification(contract, {
      modificationDate: "2026-03-01",
      effectiveDate: "2026-03-15",
      modificationType: "PAYMENT_INCREASE",
      newPayment: 120000
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/kilitli/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("payment schedule presentation currency", () => {
  test("payment schedule exposes presentation currency selector and renderer", () => {
    const tfrs16 = loadTfrs16();
    expect(typeof tfrs16.renderPaymentScheduleTable).toBe("function");
    const html = tfrs16.renderPaymentScheduleSection({ currency: "EUR", startDate: "2026-01-01", endDate: "2026-12-01" });
    expect(html).toContain('id="schedulePresentationCurrency"');
    expect(html).toContain("Sunum Para Birimi");
  });
});

describe("audit backend sync queue", () => {
  test("audit olayını yerel kuyrukta tutar ve backend gönderim yardımcısını dışa açar", () => {
    const tfrs16 = loadTfrs16();
    localStorage.clear();
    const event = tfrs16.recordAuditEvent({ id: "AUD-QUEUE-1", action: "TEST", entityType: "SYSTEM" });
    expect(event.id).toBe("AUD-QUEUE-1");
    expect(tfrs16.loadPendingAuditSync().map(x => x.id)).toContain("AUD-QUEUE-1");
    expect(typeof tfrs16.flushAuditBackendSync).toBe("function");
  });
});
