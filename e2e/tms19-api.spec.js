const { test, expect } = require("@playwright/test");
const { installApiStub } = require("./fixtures/api-stub");

test.describe("TMS19 private API geçişi", () => {
  test("hesaplama düğmesi private API'ye gider ve tabloyu doldurur", async ({ page }) => {
    const store = await installApiStub(page);

    await page.goto("/tms19.html");
    await expect(page.locator("#kpiEmployees")).toHaveText("5");
    await expect(page.locator("#personelTab")).toContainText("P001");
    expect(store.tms19Calculations).toHaveLength(1);
    expect(store.tms19Calculations[0].employees).toHaveLength(5);
    expect(await page.evaluate(() => window.LEASEQANT_TMS19_CALCULATION_SOURCE)).toBe("private-api");

    await page.getByRole("button", { name: "Rapor" }).click();
    await expect(page.locator("#tms19ReportSummary")).toContainText("Toplam DBO");
    await expect(page.locator("#tms19RollForward")).toContainText("Reconciliation");
  });

  test("api=0 acil geri dönüşünde private endpoint çağrılmaz", async ({ page }) => {
    const store = await installApiStub(page);

    await page.goto("/tms19.html?api=0");
    await expect(page.locator("#kpiEmployees")).toHaveText("5");
    expect(store.tms19Calculations).toHaveLength(0);
    expect(await page.evaluate(() => window.LEASEQANT_TMS19_CALCULATION_SOURCE)).toBe("local");
  });
});
