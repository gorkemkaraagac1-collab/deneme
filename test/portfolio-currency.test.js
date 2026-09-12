/**
 * @jest-environment jsdom
 *
 * Portfolio currency regression coverage.  These tests deliberately exercise
 * the public test shim so the eventual UI fix can be validated without
 * network data or shared application state.
 */
const { loadTfrs16 } = require("./helpers/loadTfrs16");

const currency = (value, code) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency", currency: code, minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(value);

function contract(overrides = {}) {
  return {
    id: "CUR-" + Math.random().toString(36).slice(2),
    company: "Currency Test A.Ş.",
    supplier: "Test Supplier",
    monthlyPayment: 1000,
    discountRate: 10,
    startDate: "2026-01-01",
    endDate: "2027-12-01",
    renewalDate: "2028-01-01",
    paymentFrequency: "monthly",
    paymentTiming: "arrears",
    status: "active",
    currency: "TRY",
    reassessments: [],
    modifications: [],
    auditTrail: [],
    ...overrides
  };
}

describe("Sözleşme Portföyü — çoklu para birimi", () => {
  let tfrs16;

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] });
    jest.setSystemTime(new Date("2026-06-30T12:00:00Z"));
    localStorage.clear();
    document.body.innerHTML = `
      <input id="searchInput" />
      <select id="statusFilter"><option value="all">all</option></select>
      <select id="companyFilter"><option value="all">all</option></select>
      <table><tbody id="contractTableBody"></tbody></table>
      <span id="contractCount"></span><span id="leaseLiability"></span>
      <span id="rouAssets"></span><span id="next12Months"></span>
      <span id="renewals90Days"></span><span id="modifications"></span>`;
    tfrs16 = loadTfrs16();
  });

  afterEach(() => jest.useRealTimers());

  test.each([
    ["TRY", 1250],
    ["USD", 1250],
    ["EUR", 1250]
  ])("portföy satırı %s tutarını kendi para birimiyle gösterir", (code, amount) => {
    tfrs16.contracts.push(contract({ currency: code, presentationCurrency: code, monthlyPayment: amount }));
    expect(typeof tfrs16.renderTable).toBe("function");
    tfrs16.renderTable();
    expect(document.querySelector("#contractTableBody").textContent).toContain(currency(amount, code));
  });

  test("KPI güncel kapanış bakiyesini şirket para biriminde ve onaylı kurla toplar", () => {
    const tryContract = contract({ id: "TRY-1", currency: "TRY", monthlyPayment: 1000 });
    const tryContract2 = contract({ id: "TRY-2", currency: "TRY", monthlyPayment: 2000 });
    const usdContract = contract({
      id: "USD-1", currency: "USD", functionalCurrency: "TRY", monthlyPayment: 3000
    });
    // Son onaylı kapanış kuru; KPI bu kuru raporlama gününe kadar seçer.
    localStorage.setItem("gk_tfrs16_v23_fx_rates_v1", JSON.stringify([{
      id: "FX-USD-2026-06-30", fromCurrency: "USD", toCurrency: "TRY",
      rate: 40, rateDate: "2026-06-30", rateType: "CLOSING",
      source: "CENTRAL_BANK", status: "APPROVED"
    }]));
    tfrs16.contracts.push(tryContract, tryContract2, usdContract);
    expect(typeof tfrs16.updateKPIs).toBe("function");
    tfrs16.updateKPIs();

    const asOf = new Date("2026-06-30T12:00:00Z");
    const metrics = [tryContract, tryContract2, usdContract].map(c => tfrs16.getCfoContractMetrics(c.id, asOf));
    const expectedLiability = metrics[0].leaseLiability + metrics[1].leaseLiability + metrics[2].leaseLiability * 40;
    const expectedRou = metrics[0].rouAsset + metrics[1].rouAsset + metrics[2].rouAsset * 40;
    const expectedInitialLiability = tfrs16.calculateLeaseEngine(tryContract).liability +
      tfrs16.calculateLeaseEngine(tryContract2).liability +
      tfrs16.calculateLeaseEngine(usdContract).liability * 40;

    expect(document.getElementById("leaseLiability").textContent).toContain(currency(expectedLiability, "TRY"));
    expect(document.getElementById("rouAssets").textContent).toContain(currency(expectedRou, "TRY"));
    // Güncel KPI ilk tanıma toplamına dönmemeli.
    expect(expectedLiability).not.toBeCloseTo(expectedInitialLiability, 2);
    expect(document.getElementById("leaseLiability").textContent).not.toContain(currency(expectedInitialLiability, "TRY"));
    expect(document.getElementById("leaseLiability").textContent).not.toContain("Kur bulunamadı");
  });

  test.each([undefined, "", "USDX"]) (
    "eksik/geçersiz para birimi %p için açık hata gösterilir",
    code => {
      tfrs16.contracts.push(contract({ currency: code }));
      expect(typeof tfrs16.renderTable).toBe("function");
      expect(() => tfrs16.renderTable()).not.toThrow();
      expect(document.querySelector("#contractTableBody").textContent).toContain("Para birimi eksik/geçersiz");
      tfrs16.updateKPIs();
      ["leaseLiability", "rouAssets", "next12Months"].forEach(id =>
        expect(document.getElementById(id).textContent).toBe("Para birimi eksik/geçersiz")
      );
    }
  );

  test("boş portföy KPI'ları hata vermez", () => {
    expect(() => tfrs16.updateKPIs()).not.toThrow();
    expect(document.getElementById("contractCount").textContent).toBe("0");
  });

  test("render ve KPI işlemleri sözleşmeleri veya localStorage'ı mutasyona uğratmaz", () => {
    const rows = [contract({ id: "IMMUTABLE-TRY", currency: "TRY" }), contract({ id: "IMMUTABLE-USD", currency: "USD" })];
    tfrs16.contracts.push(...rows);
    const beforeContracts = JSON.stringify(tfrs16.contracts);
    const beforeStorage = localStorage.getItem("contracts");
    tfrs16.renderTable();
    tfrs16.updateKPIs();
    expect(JSON.stringify(tfrs16.contracts)).toBe(beforeContracts);
    expect(localStorage.getItem("contracts")).toBe(beforeStorage);
  });
});
