/**
 * @jest-environment jsdom
 *
 * ============================================================
 * GC-18 — REASSESSMENT ÖDEME GRID KAYMASI (regresyon testi)
 * ============================================================
 *
 * Kök neden: buildModificationFuturePayments() arrears dalında,
 * "kalan ilk ödeme" cursor'ı effectiveDate + stepMonths olarak
 * hesaplanıyordu. effectiveDate, doğal ödeme takviminde bir sonraki
 * ödeme tarihinin BİR GÜN ÖNCESİNE denk geldiğinde (ör. kontrat
 * başlangıcı ile endeks inceleme tarihi aynı gün olan çeyreklik
 * kontratlarda — bkz. LEASE-012, 2026-09-04), bu formül bir tam
 * doğal ödeme dönemini atlıyordu: o dönem ne eski plana (effectiveDate
 * sonrası olduğu için) ne yeni plana (future ilk satırı bir dönem
 * sonrasından başladığı için) dahil oluyordu.
 *
 * Bu sadece görünürde bir schedule satırı kaybı değildi — aynı
 * fonksiyon calculateReassessmentLiability() tarafından yeniden
 * ölçüm (remeasurement) PV'sini hesaplamak için de kullanıldığından,
 * atlanan ödeme PV hesabına hiç girmiyor, revisedLeaseLiability (ve
 * dolayısıyla liabilityAdjustment/journal tutarı) gerçek değerinden
 * düşük çıkıyordu — roll-forward raporlarında bu fark "Diğer"e
 * sızıyordu.
 */
const { loadTfrs16 } = require("./helpers/loadTfrs16");

function baseContract(overrides = {}) {
  return {
    id: "GC18-TEST-" + Math.random().toString(36).slice(2),
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 450000,
    discountRate: 16.5,
    startDate: "2025-04-01",
    endDate: "2030-03-31",
    currency: "TRY",
    paymentFrequency: "quarterly",
    paymentTiming: "arrears",
    status: "active",
    reassessments: [],
    modifications: [],
    ...overrides
  };
}

function mockOkResponse(data = {}) {
  return { ok: true, status: 200, text: async () => JSON.stringify(data) };
}

describe("GC-18: arrears reassessment ödeme grid'i", () => {
  let fetchSpy;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("access_token", "fake-token-for-test");
    fetchSpy = jest.spyOn(global, "fetch").mockResolvedValue(mockOkResponse({ success: true }));
  });

  afterEach(() => fetchSpy.mockRestore());

  test("effectiveDate doğal ödeme tarihinden 1 gün önce olduğunda hiçbir doğal ödeme dönemi atlanmaz", async () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract();

    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-03-31",
      effectiveDate: "2026-03-31",
      type: "INDEX_RATE_CHANGE",
      newPayment: 486900,
      reason: "test"
    });

    expect(result.valid).toBe(true);

    const rows = result.revisedSchedule;
    const dates = rows.map(r =>
      r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)
    );

    // Doğal takvimde 2026-04-01 bir ödeme tarihidir ve atlanmamalı.
    expect(dates).toContain("2026-04-01");

    // Ardışık satırlar arasında süreklilik: bir satırın kapanışı,
    // sıradaki satırın açılışına eşit olmalı — TEK istisna, eski/yeni
    // plan geçiş noktası (remeasurement sıçraması, beklenen bir
    // ekonomik olay). O noktayı reassessment adjustment'a göre ayrı
    // doğruluyoruz, döngüden hariç tutuyoruz.
    const effectiveIdx = rows.findIndex(r => {
      const d = r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10);
      return d === "2026-04-01";
    });

    for (let i = 1; i < rows.length; i++) {
      if (i === effectiveIdx) continue; // beklenen remeasurement sıçraması
      const prevClosing = Number(rows[i - 1].closingLiability);
      const currOpening = Number(rows[i].openingLiability);
      if (Number.isFinite(prevClosing) && Number.isFinite(currOpening)) {
        expect(Math.abs(prevClosing - currOpening)).toBeLessThan(1);
      }
    }

    // Remeasurement sıçraması tam olarak kayıtlı liabilityAdjustment'a eşit olmalı.
    const preRow = rows[effectiveIdx - 1];
    const postRow = rows[effectiveIdx];
    const jump = Number(postRow.openingLiability) - Number(preRow.closingLiability);
    expect(Math.abs(jump - result.reassessment.liabilityAdjustment)).toBeLessThan(1);
  });

  test("effectiveDate doğal ödeme tarihine tam denk geldiğinde davranış değişmez (regresyon yok)", async () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract();

    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2026-04-01",
      effectiveDate: "2026-04-01",
      type: "INDEX_RATE_CHANGE",
      newPayment: 486900,
      reason: "test"
    });

    expect(result.valid).toBe(true);
    const dates = result.revisedSchedule.map(r =>
      r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)
    );
    // Bir sonraki doğal ödeme (2026-07-01) hâlâ mevcut olmalı, atlanmamalı.
    expect(dates).toContain("2026-07-01");
  });

  test.each([
    {
      label: "artık olmayan yıl",
      startDate: "2025-01-31",
      endDate: "2025-05-31",
      effectiveDate: "2025-01-31",
      expected: ["2025-02-28", "2025-03-31", "2025-04-30", "2025-05-31"]
    },
    {
      label: "artık yıl",
      startDate: "2024-01-31",
      endDate: "2024-05-31",
      effectiveDate: "2024-01-31",
      expected: ["2024-02-29", "2024-03-31", "2024-04-30", "2024-05-31"]
    }
  ])("31 Ocak başlangıçlı aylık grid ay sonunu korur ($label)", async scenario => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({
      startDate: scenario.startDate,
      endDate: scenario.endDate,
      paymentFrequency: "monthly"
    });

    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: scenario.effectiveDate,
      effectiveDate: scenario.effectiveDate,
      type: "INDEX_RATE_CHANGE",
      newPayment: 486900,
      reason: "month-end test"
    });

    expect(result.valid).toBe(true);
    const dates = result.revisedSchedule.map(r =>
      r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)
    );
    expect(dates).toEqual(expect.arrayContaining(scenario.expected));
    expect(dates).not.toContain(scenario.startDate.startsWith("2024") ? "2024-03-02" : "2025-03-03");
  });

  test("31 Ocak başlangıçlı çeyreklik grid kısa aylarda kırpılır, sonra doğal güne döner", async () => {
    const tfrs16 = loadTfrs16();
    const contract = baseContract({
      startDate: "2024-01-31",
      endDate: "2025-01-31",
      paymentFrequency: "quarterly"
    });

    const result = await tfrs16.createReassessment(contract, {
      reassessmentDate: "2024-01-31",
      effectiveDate: "2024-01-31",
      type: "INDEX_RATE_CHANGE",
      newPayment: 486900,
      reason: "quarter-end test"
    });

    expect(result.valid).toBe(true);
    const dates = result.revisedSchedule.map(r =>
      r.date instanceof Date ? r.date.toISOString().slice(0, 10) : String(r.date).slice(0, 10)
    );
    expect(dates).toEqual(expect.arrayContaining([
      "2024-04-30",
      "2024-07-31",
      "2024-10-31",
      "2025-01-31"
    ]));
  });
});
