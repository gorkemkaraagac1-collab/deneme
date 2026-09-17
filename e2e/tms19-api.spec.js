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

    await page.locator('button[onclick^="personelDetay"]').first().click();
    await expect(page.locator("#modalBody")).toContainText("Audit Trail");
    expect(store.tms19Calculations).toHaveLength(2);
    expect(store.tms19Calculations[1].mode).toBe("employee");
  });

  test("api=0 modunda private endpoint çağrılmaz ve kontrollü kaynak durumu korunur", async ({ page }) => {
    const store = await installApiStub(page);

    await page.goto("/tms19.html?api=0");
    // The page also announces that its sample data loaded, so the toast is
    // intentionally not the source-of-truth for this asynchronous path.
    await expect.poll(() => page.evaluate(() => window.LEASEQANT_TMS19_CALCULATION_SOURCE)).toBe("api-disabled");
    expect(store.tms19Calculations).toHaveLength(0);
    expect(await page.evaluate(() => window.LEASEQANT_TMS19_CALCULATION_SOURCE)).toBe("api-disabled");
  });
});
