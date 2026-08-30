/**
 * @jest-environment jsdom
 *
 * ============================================================
 * SATIŞ VE GERİ KİRALAMA (SLB) — MODÜL TESTLERİ
 * ============================================================
 *
 * Kapsam: calculateSaleAndLeaseback (hesaplama mantığı) VE
 * renderSlbSection (DOM formu → contract.saleAndLeaseback → backend
 * kaydı) fonksiyonlarını doğrular.
 *
 * renderSlbSection DOM'a bağımlı (document.getElementById ile form
 * elementlerini okuyor, "Hesapla ve Kaydet" butonuna click handler
 * bağlıyor) — bu yüzden testler jsdom'da gerçek form elementleri
 * oluşturup click() tetikleyip, async işin bitmesini flushPromises()
 * ile bekliyor.
 */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function flushPromises() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

function baseContract(overrides = {}) {
  return {
    id: "SLB-TEST-" + Math.random().toString(36).slice(2),
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

function setSlbForm({ carryingAmount, fairValue, saleProceeds, qualifiesAsSale, note }) {
  document.getElementById("slbCarryingAmount").value = carryingAmount;
  document.getElementById("slbFairValue").value = fairValue;
  document.getElementById("slbSaleProceeds").value = saleProceeds;
  document.getElementById("slbQualifiesAsSale").checked = !!qualifiesAsSale;
  if (note !== undefined) document.getElementById("slbNote").value = note;
}

describe("calculateSaleAndLeaseback — saf hesaplama mantığı", () => {
  let tfrs16;
  beforeEach(() => {
    localStorage.clear();
    tfrs16 = loadTfrs16();
  });

  test("qualifiesAsSale:false ise (satış sayılmıyor) 'Finansman Düzenlemesi' olarak değerlendirilir (schedule üretir)", () => {
    const result = tfrs16.calculateSaleAndLeaseback({
      previousCarryingAmount: 500000,
      fairValueOfAsset: 500000,
      saleProceeds: 500000,
      qualifiesAsSale: false,
      leasebackContract: baseContract()
    });
    expect(result.qualifiesAsSale).toBe(false);
    expect(Array.isArray(result.schedule)).toBe(true);
  });

  test("qualifiesAsSale:true ise kâr/zarar tanıma ve ROU-elde-tutulan hesaplanır", () => {
    const result = tfrs16.calculateSaleAndLeaseback({
      previousCarryingAmount: 400000,
      fairValueOfAsset: 500000,
      saleProceeds: 500000,
      qualifiesAsSale: true,
      leasebackContract: baseContract()
    });
    expect(result.qualifiesAsSale).toBe(true);
    expect(typeof result.totalGainLoss).toBe("number");
    expect(typeof result.rouRetained).toBe("number");
  });
});

describe("renderSlbSection — mutlu yol + backend kaydı", () => {
  let tfrs16, fetchSpy;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    // fetch'i loadTfrs16()'DAN ÖNCE mock'luyoruz — init akışı
    // (hydrateContractsFromApi/refreshInflationIndexCacheFromBackend)
    // setTimeout(fn,0) ile ZAMANLANMIŞ çağrılar yapıyor; bunlar test
    // sırasındaki ilk await/flush anında tetiklenip fetchSpy sayacını
    // kirletiyordu. Önce init'i TÜKETTİRİP sonra sayacı sıfırlıyoruz.
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
    tfrs16 = loadTfrs16();
    await flushPromises();
    fetchSpy.mockClear();
    document.body.insertAdjacentHTML("beforeend", '<div id="slbSectionContainer"></div>');
  });

  afterEach(() => fetchSpy.mockRestore());

  test("Hesapla ve Kaydet tıklanınca contract.saleAndLeaseback DOLAR ve sonuç render edilir", async () => {
    const contract = baseContract();
    tfrs16.renderSlbSection(contract);

    setSlbForm({ carryingAmount: 400000, fairValue: 500000, saleProceeds: 500000, qualifiesAsSale: true, note: "Test gerekçesi" });
    document.getElementById("slbCalculateButton").click();
    await flushPromises();

    expect(contract.saleAndLeaseback).toBeTruthy();
    expect(contract.saleAndLeaseback.fairValueOfAsset).toBe(500000);
    expect(document.getElementById("slbResultContainer").innerHTML).not.toBe("");
  });

  test("backend'e PUT /api/contracts/:id ile, details.saleAndLeaseback ile çağrı yapılır", async () => {
    const contract = baseContract();
    tfrs16.renderSlbSection(contract);
    setSlbForm({ carryingAmount: 400000, fairValue: 500000, saleProceeds: 500000, qualifiesAsSale: true });
    document.getElementById("slbCalculateButton").click();
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toMatch(new RegExp(`/api/contracts/${contract.id}$`));
    expect(options.method).toBe("PUT");
    const body = JSON.parse(options.body);
    expect(body.details.saleAndLeaseback.fairValueOfAsset).toBe(500000);
  });

  test("sadece görüntüleme (persist:false — sayfa ilk açılışta 'saved' varsa) backend'e YAZMAZ", async () => {
    const contract = baseContract({
      saleAndLeaseback: { previousCarryingAmount: 400000, fairValueOfAsset: 500000, saleProceeds: 500000, qualifiesAsSale: true, savedAt: "2026-01-01T00:00:00.000Z" }
    });
    tfrs16.renderSlbSection(contract);
    await flushPromises();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(document.getElementById("slbResultContainer").innerHTML).not.toBe("");
  });
});

describe("renderSlbSection — backend hatası → ROLLBACK", () => {
  let tfrs16;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    const initFetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
    tfrs16 = loadTfrs16();
    await flushPromises();
    initFetchSpy.mockRestore();
    document.body.insertAdjacentHTML("beforeend", '<div id="slbSectionContainer"></div>');
  });

  test("backend 500 dönerse contract.saleAndLeaseback ÖNCEKİ haline (kayıt öncesi) geri döner, hata gösterilir", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockFailResponse(500, "DB hatası"));
    const contract = baseContract(); // saleAndLeaseback yok — önceki hali null olmalı

    tfrs16.renderSlbSection(contract);
    setSlbForm({ carryingAmount: 400000, fairValue: 500000, saleProceeds: 500000, qualifiesAsSale: true });
    document.getElementById("slbCalculateButton").click();
    await flushPromises();

    expect(contract.saleAndLeaseback).toBeNull();
    expect(document.getElementById("slbResultContainer").innerHTML).toMatch(/Backend'e kaydedilemedi/);

    fetchSpy.mockRestore();
  });

  test("ÖNCEDEN kayıtlı bir SLB varken güncelleme başarısız olursa ESKİ kayda geri döner (yeni değerlere değil)", async () => {
    let callCount = 0;
    const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(async () => {
      callCount += 1;
      // İlk kayıt (ilk render sırasında persist:false olduğu için hiç
      // fetch çağrılmaz) — burada tek çağrı, ikinci "Hesapla ve
      // Kaydet" tıklaması, o başarısız olsun.
      return mockFailResponse(500);
    });

    const contract = baseContract({
      saleAndLeaseback: { previousCarryingAmount: 300000, fairValueOfAsset: 350000, saleProceeds: 350000, qualifiesAsSale: false, savedAt: "2026-01-01T00:00:00.000Z" }
    });

    tfrs16.renderSlbSection(contract);
    setSlbForm({ carryingAmount: 999999, fairValue: 999999, saleProceeds: 999999, qualifiesAsSale: true });
    document.getElementById("slbCalculateButton").click();
    await flushPromises();

    expect(contract.saleAndLeaseback.fairValueOfAsset).toBe(350000); // eski değer korunuyor
    fetchSpy.mockRestore();
  });
});
