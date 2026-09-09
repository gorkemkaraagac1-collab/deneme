/** @jest-environment jsdom */

const { loadTfrs16 } = require("./helpers/loadTfrs16");

function contract() {
  return {
    id: "MOD-ADVANCE-EFFECTIVE-DATE",
    company: "Test A.Ş.",
    companyId: "C-1",
    supplier: "Test Tedarikçi",
    monthlyPayment: 125000,
    discountRate: 18,
    startDate: "2025-12-01",
    endDate: "2030-11-30",
    currency: "TRY",
    paymentFrequency: "monthly",
    paymentTiming: "advance",
    status: "active",
    modifications: [],
    reassessments: []
  };
}

test("advance modifikasyonunda yürürlük tarihindeki ödeme yeni tutarı kullanır", async () => {
  localStorage.clear();
  localStorage.setItem("access_token", "test-token");
  jest.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ success: true })
  });

  const tfrs16 = loadTfrs16();
  const result = await tfrs16.createModification(contract(), {
    modificationDate: "2026-03-01",
    effectiveDate: "2026-03-01",
    modificationType: "PAYMENT_INCREASE",
    newPayment: 135000,
    reason: "Mart 2026 kira artışı"
  });

  expect(result.valid).toBe(true);
  const march = result.revisedSchedule.find(row =>
    row.date.getFullYear() === 2026 && row.date.getMonth() === 2
  );
  expect(march).toBeDefined();
  expect(march.payment).toBe(135000);
});
