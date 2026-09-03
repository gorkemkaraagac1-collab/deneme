/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");
const { loadTfrs16 } = require("./helpers/loadTfrs16");

const extendedFields = {
  renewalDate: "2030-09-30",
  paymentFrequency: "quarterly",
  paymentTiming: "advance",
  initialDirectCosts: 15000,
  restorationObligation: 50000,
  assetClass: "Makine",
  prepayments: 25000,
  leaseIncentives: 10000,
  leaseIncreaseType: "index",
  leaseIncreaseRate: 8,
  fixedIncrease: 12000,
  variablePayment: 5000,
  usefulLifeMonths: 120,
  indexBaseRate: 100,
  indexCurrentRate: 118,
  indexReviewMonth: 2,
  indexReviewDay: 15,
  renewalOption: true,
  terminationOption: true,
  purchaseOption: true,
  ownershipTransfer: true,
  shortTermLease: false,
  lowValueAsset: false,
  integrationMetadata: { sourceType: "EXCEL", jobId: "JOB-1" }
};

function contract(overrides = {}) {
  return {
    id: "LEASE-DETAIL-1",
    companyId: "COMPANY-1",
    company: "Financial Intelligence Platform",
    supplier: "Test Supplier",
    monthlyPayment: 125000,
    startDate: "2026-01-01",
    endDate: "2030-12-31",
    discountRate: 18,
    currency: "TRY",
    status: "active",
    ...extendedFields,
    ...overrides
  };
}

describe("contract details JSONB round-trip", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "test-token");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("persistContractToApi bütün finansal import alanlarını details içinde gönderir", async () => {
    const fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ success: true })
    });
    const tfrs16 = loadTfrs16();

    await tfrs16.persistContractToApi(contract(), false);

    const postCall = fetchSpy.mock.calls.find(([, options]) => options?.method === "POST");
    expect(postCall).toBeTruthy();
    const payload = JSON.parse(postCall[1].body);
    expect(payload.details).toMatchObject(extendedFields);
  });

  test("mapDbContractToUi details alanlarını kayıpsız geri yükler", () => {
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([])
    });
    const tfrs16 = loadTfrs16();
    const mapped = tfrs16.mapDbContractToUi({
      id: "LEASE-DETAIL-1",
      company_id: "COMPANY-1",
      company: "Financial Intelligence Platform",
      supplier: "Test Supplier",
      monthly_payment: "125000",
      start_date: "2026-01-01T00:00:00.000Z",
      end_date: "2030-12-31T00:00:00.000Z",
      discount_rate: "18",
      currency: "TRY",
      status: "ACTIVE",
      details: extendedFields
    });

    expect(mapped).toMatchObject(extendedFields);
    expect(mapped.assetClass).toBe("Makine");
    expect(mapped.usefulLifeMonths).toBe(120);
  });

  test("TMS29 Excel çıktısı genel Endeks Eksik etiketi yerine gerçek hata detayını içerir", () => {
    const source = fs.readFileSync(path.join(__dirname, "../js/tfrs16.js"), "utf8");
    expect(source).toContain('"Hata Detayı": r?.ok ? "" : (r?.error || "Bilinmeyen hesaplama hatası")');
    expect(source).toContain('"Durum": r?.ok ? "OK" : "Hesaplanamadı"');
  });
});
