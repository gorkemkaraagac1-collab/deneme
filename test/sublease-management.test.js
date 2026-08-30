/**
 * @jest-environment jsdom
 *
 * ============================================================
 * ALT KİRALAMA (SUBLEASE) — MODÜL TESTLERİ
 * ============================================================
 *
 * Bkz. test/slb-management.test.js başlığı — aynı yapı ve aynı
 * düzeltme geçmişi (backend-first + rollback) burada da geçerli.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function baseContract(overrides = {}) {
  return {
    id: "SUB-TEST-" + Math.random().toString(36).slice(2),
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
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

function mockOkResponse(data = {}) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}
function mockFailResponse(status = 500, error = "Sunucu hatası") {
  return { ok: false, status, text: async () => JSON.stringify({ error }) };
}

function setSubleaseForm({ monthlyPayment, discountRate, startDate, endDate, rouRatio, classification, note }) {
  document.getElementById("subleaseMonthlyPayment").value = monthlyPayment;
  document.getElementById("subleaseDiscountRate").value = discountRate;
  document.getElementById("subleaseStartDate").value = startDate;
  document.getElementById("subleaseEndDate").value = endDate;
  document.getElementById("subleaseRouRatio").value = rouRatio ?? 1;
  document.getElementById("subleaseClassification").value = classification || "OPERATING";
  if (note !== undefined) document.getElementById("subleaseNote").value = note;
}

describe("calculateSublease — saf hesaplama mantığı", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("OPERATING sınıflandırmasında gelir/schedule üretir", () => {
    const headLease = baseContract();
    const result = tfrs16.calculateSublease({
      headLeaseContract: headLease,
      subleaseContract: { monthlyPayment: 5000, discountRate: 15, startDate: "2026-02-01", endDate: "2027-01-01", currency: "TRY" },
      classification: "OPERATING",
      rouAllocationRatio: 1
    });
    expect(result.classification).toBe("OPERATING");
    expect(Array.isArray(result.schedule)).toBe(true);
  });

  test("FINANCE sınıflandırmasında yükümlülük tablosu üretir", () => {
    const headLease = baseContract();
    const result = tfrs16.calculateSublease({
      headLeaseContract: headLease,
      subleaseContract: { monthlyPayment: 5000, discountRate: 15, startDate: "2026-02-01", endDate: "2027-01-01", currency: "TRY" },
      classification: "FINANCE",
      rouAllocationRatio: 1
    });
    expect(result.classification).toBe("FINANCE");
  });
});

describe("renderSubleaseSection — mutlu yol + backend kaydı", () => {
  let tfrs16, fetchSpy;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
    tfrs16 = loadTfrs16();
    await flushPromises();
    fetchSpy.mockClear();
    document.body.insertAdjacentHTML("beforeend", '<div id="subleaseSectionContainer"></div>');
  });

  afterEach(() => fetchSpy.mockRestore());

  test("Hesapla ve Kaydet tıklanınca contract.sublease DOLAR ve sonuç render edilir", async () => {
    const contract = baseContract();
    tfrs16.renderSubleaseSection(contract);

    setSubleaseForm({ monthlyPayment: 5000, discountRate: 15, startDate: "2026-02-01", endDate: "2027-01-01", rouRatio: 0.5, classification: "OPERATING", note: "Test" });
    document.getElementById("subleaseCalculateButton").click();
    await flushPromises();

    expect(contract.sublease).toBeTruthy();
    expect(contract.sublease.monthlyPayment).toBe(5000);
    expect(contract.sublease.rouAllocationRatio).toBe(0.5);
    expect(document.getElementById("subleaseResultContainer").innerHTML).not.toBe("");
  });

  test("backend'e PUT /api/contracts/:id ile, details.sublease ile çağrı yapılır", async () => {
    const contract = baseContract();
    tfrs16.renderSubleaseSection(contract);
    setSubleaseForm({ monthlyPayment: 5000, discountRate: 15, startDate: "2026-02-01", endDate: "2027-01-01", classification: "FINANCE" });
    document.getElementById("subleaseCalculateButton").click();
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toMatch(new RegExp(`/api/contracts/${contract.id}$`));
    expect(options.method).toBe("PUT");
    const body = JSON.parse(options.body);
    expect(body.details.sublease.classification).toBe("FINANCE");
  });

  test("sadece görüntüleme (persist:false — sayfa ilk açılışta 'saved' varsa) backend'e YAZMAZ", async () => {
    const contract = baseContract({
      sublease: { monthlyPayment: 4000, discountRate: 14, startDate: "2026-02-01", endDate: "2027-01-01", classification: "OPERATING", rouAllocationRatio: 1, savedAt: "2026-01-01T00:00:00.000Z" }
    });
    tfrs16.renderSubleaseSection(contract);
    await flushPromises();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.getElementById("subleaseResultContainer").innerHTML).not.toBe("");
  });
});

describe("renderSubleaseSection — backend hatası → ROLLBACK", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
    tfrs16 = loadTfrs16();
    await flushPromises();
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="subleaseSectionContainer"></div>');
  });

  test("backend 500 dönerse contract.sublease ÖNCEKİ haline (kayıt öncesi) geri döner, hata gösterilir", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockFailResponse(500, "DB hatası"));
    const contract = baseContract(); // sublease yok — önceki hali null olmalı

    tfrs16.renderSubleaseSection(contract);
    setSubleaseForm({ monthlyPayment: 5000, discountRate: 15, startDate: "2026-02-01", endDate: "2027-01-01" });
    document.getElementById("subleaseCalculateButton").click();
    await flushPromises();

    expect(contract.sublease).toBeNull();
    expect(document.getElementById("subleaseResultContainer").innerHTML).toMatch(/Backend'e kaydedilemedi/);

    fetchSpy.mockRestore();
  });

  test("ÖNCEDEN kayıtlı bir sublease varken güncelleme başarısız olursa ESKİ kayda geri döner", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockFailResponse(500));

    const contract = baseContract({
      sublease: { monthlyPayment: 3000, discountRate: 12, startDate: "2026-02-01", endDate: "2027-01-01", classification: "OPERATING", rouAllocationRatio: 1, savedAt: "2026-01-01T00:00:00.000Z" }
    });

    tfrs16.renderSubleaseSection(contract);
    setSubleaseForm({ monthlyPayment: 999999, discountRate: 99, startDate: "2026-02-01", endDate: "2027-01-01" });
    document.getElementById("subleaseCalculateButton").click();
    await flushPromises();

    expect(contract.sublease.monthlyPayment).toBe(3000); // eski değer korunuyor
    fetchSpy.mockRestore();
  });
});
