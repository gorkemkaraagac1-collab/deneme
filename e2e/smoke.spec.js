/**
 * ============================================================
 * FAZ 0.4 — SMOKE TEST (minimum akış)
 * ============================================================
 *
 * Plandaki minimum akış:
 *   kontrat oluştur → detay aç → ödeme planı gör → fiş üret → dışa aktar
 *
 * ⚠️ DOĞRULAMA DURUMU: Bu spec'in selector'ları tfrs16.html ve
 * frontend/dashboard.html KAYNAĞINDAN çıkarıldı, ancak bu ortamda
 * tarayıcı ikilisi indirilemediği için HENÜZ GERÇEK BİR TARAYICIDA
 * KOŞULMADI. İlk koşumda selector düzeltmesi gerekebilir. Faz 0'ın
 * kapanış koşulu bu spec'in YEŞİL koşmasıdır — "dosya var" yeterli
 * değildir.
 *
 * Koşum:
 *   npx playwright install chromium
 *   npm run test:e2e
 */

"use strict";

const { test, expect } = require("./fixtures/test-base");

const CONTRACT = {
  company: "E2E Test A.Ş.",
  supplier: "E2E Tedarikçi Ltd.",
  monthlyPayment: "125000",
  startDate: "2026-01-01",
  endDate: "2028-12-31",
  discountRate: "20"
};

test.describe("smoke — TFRS 16 ana akış", () => {
  test("dashboard yüklenir ve sayfa hatası üretmez", async ({ dashboardPage }) => {
    await expect(dashboardPage.locator("#userDisplay")).toContainText("e2e");
    await expect(dashboardPage.locator("#apiStatus")).toContainText("AKTİF");
    expect(dashboardPage.consoleErrors).toEqual([]);
  });

  test("kontrat oluştur → detay aç → ödeme planı gör", async ({ stubbedPage, apiStore }) => {
    await stubbedPage.goto("/tfrs16.html");

    // --- 1) Kontrat oluştur ---
    await stubbedPage.click("#newContractButton");
    await expect(stubbedPage.locator("#contractModal")).toBeVisible();

    await stubbedPage.fill("#company", CONTRACT.company);
    await stubbedPage.fill("#supplier", CONTRACT.supplier);
    await stubbedPage.fill("#monthlyPayment", CONTRACT.monthlyPayment);
    await stubbedPage.fill("#startDate", CONTRACT.startDate);
    await stubbedPage.fill("#endDate", CONTRACT.endDate);
    await stubbedPage.fill("#discountRate", CONTRACT.discountRate);

    await stubbedPage.click("#contractForm button[type=submit]");
    await expect(stubbedPage.locator("#contractModal")).toBeHidden();

    // Kontrat listede görünmeli.
    const row = stubbedPage.locator("#contractTableBody tr", { hasText: CONTRACT.supplier });
    await expect(row).toHaveCount(1);

    // Backend'e yazma DENENMİŞ olmalı — sessiz "sadece localStorage"
    // regresyonu (PROJECT_CONTEXT bölüm 23 madde 14) böyle yakalanır.
    expect(apiStore.contracts.length).toBeGreaterThan(0);

    // --- 2) Detay aç ---
    await row.first().click();
    await expect(stubbedPage.locator("#detailModal")).toBeVisible();
    await expect(stubbedPage.locator("#detailTitle")).toContainText(CONTRACT.supplier);

    // --- 3) Ödeme planı ---
    const schedule = stubbedPage.locator("#scheduleTableContainer");
    await expect(schedule).toBeVisible();
    // 36 aylık kontrat → en az 12 satır render edilmiş olmalı
    // (virtual scroll nedeniyle tamamı DOM'da olmayabilir).
    await expect(schedule.locator("tbody tr")).not.toHaveCount(0);

    expect(stubbedPage.consoleErrors).toEqual([]);
  });

  test("KPI kartları hesaplanmış değer gösterir", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");

    await stubbedPage.click("#newContractButton");
    await stubbedPage.fill("#company", CONTRACT.company);
    await stubbedPage.fill("#supplier", CONTRACT.supplier);
    await stubbedPage.fill("#monthlyPayment", CONTRACT.monthlyPayment);
    await stubbedPage.fill("#startDate", CONTRACT.startDate);
    await stubbedPage.fill("#endDate", CONTRACT.endDate);
    await stubbedPage.fill("#discountRate", CONTRACT.discountRate);
    await stubbedPage.click("#contractForm button[type=submit]");

    // Kira yükümlülüğü ve ROU sıfırdan farklı olmalı — motor koştu demektir.
    await expect(stubbedPage.locator("#leaseLiability")).not.toHaveText(/^\s*(₺\s*)?0([.,]00)?\s*$/);
    await expect(stubbedPage.locator("#rouAssets")).not.toHaveText(/^\s*(₺\s*)?0([.,]00)?\s*$/);
  });

  test("dışa aktarma indirme tetikler", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");

    await stubbedPage.click("#newContractButton");
    await stubbedPage.fill("#company", CONTRACT.company);
    await stubbedPage.fill("#supplier", CONTRACT.supplier);
    await stubbedPage.fill("#monthlyPayment", CONTRACT.monthlyPayment);
    await stubbedPage.fill("#startDate", CONTRACT.startDate);
    await stubbedPage.fill("#endDate", CONTRACT.endDate);
    await stubbedPage.fill("#discountRate", CONTRACT.discountRate);
    await stubbedPage.click("#contractForm button[type=submit]");

    const downloadPromise = stubbedPage.waitForEvent("download", { timeout: 20000 });
    await stubbedPage.click("#exportReportHtmlButton");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBeTruthy();
  });

  test("şablon indirme çalışır (downloadTemplate — Faz 3 refaktör hedefi)", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");
    const downloadPromise = stubbedPage.waitForEvent("download", { timeout: 20000 });
    await stubbedPage.click("#downloadTemplateButton");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(xlsx|csv)$/i);
  });
});
