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
  contractId: "E2E-LEASE-001",
  company: "E2E Test A.Ş.",
  supplier: "E2E Tedarikçi Ltd.",
  monthlyPayment: "125000",
  startDate: "2026-01-01",
  endDate: "2028-12-31",
  discountRate: "20"
};

/**
 * Yeni kontrat modalını açar, doldurur, kaydeder.
 *
 * NOT: js/tfrs16.js içinde V26 "Şirket Ekle" modalı da id="company"
 * taşıyan bir <select> enjekte ediyor (satır ~29609) — sayfa genelinde
 * bare #company/#supplier gibi id'ler TEKİL DEĞİL. Bu yüzden alanlar
 * #contractModal içine SCOPE edilir.
 *
 * NOT 2 (gerçek davranış, hata DEĞİL): `applySessionCompanyToForm()`
 * (js/tfrs16.js satır ~580), kullanıcının atanmış şirketleri varsa
 * (`sessionCompanies.length > 0` — çoklu şirket/holding mimarisi),
 * #company alanını serbest metin <input>'tan <select>'e DÖNÜŞTÜRÜR.
 * API stub'ı bir kullanıcı şirketi tohumladığı için select modu
 * tetikleniyor — bu yüzden alan tipi çalışma anında tespit edilir.
 */
async function createContract(page, contract = CONTRACT) {
  await page.click("#newContractButton");
  await page.locator("#contractModal").waitFor({ state: "visible" });

  const modal = page.locator("#contractModal");
  await modal.locator("#contractId").fill(contract.contractId);

  const companyField = modal.locator("#company");
  const companyTag = await companyField.evaluate(el => el.tagName);
  if (companyTag === "SELECT") {
    await companyField.selectOption({ label: contract.company });
  } else {
    await companyField.fill(contract.company);
  }

  await modal.locator("#supplier").fill(contract.supplier);
  await modal.locator("#monthlyPayment").fill(contract.monthlyPayment);
  await modal.locator("#startDate").fill(contract.startDate);
  await modal.locator("#endDate").fill(contract.endDate);
  await modal.locator("#discountRate").fill(contract.discountRate);

  await page.click("#contractForm button[type=submit]");
  await page.locator("#contractModal").waitFor({ state: "hidden" });
}

test.describe("smoke — TFRS 16 ana akış", () => {
  test("dashboard yüklenir ve sayfa hatası üretmez", async ({ dashboardPage }) => {
    await expect(dashboardPage.locator("#userDisplay")).toContainText("e2e");
    await expect(dashboardPage.locator("#apiStatus")).toContainText("AKTİF");
    expect(dashboardPage.consoleErrors).toEqual([]);
  });

  test("kontrat oluştur → detay aç → ödeme planı gör", async ({ stubbedPage, apiStore }) => {
    await stubbedPage.goto("/tfrs16.html");

    // --- 1) Kontrat oluştur ---
    // NOT: kayıt başarılı olunca uygulama detay modalını OTOMATİK açıyor
    // (gerçek davranış — ayrıca satıra tıklamaya gerek yok).
    await createContract(stubbedPage);

    // Kontrat listede görünmeli.
    const row = stubbedPage.locator("#contractTableBody tr", { hasText: CONTRACT.supplier });
    await expect(row).toHaveCount(1);

    // Backend'e yazma DENENMİŞ olmalı — sessiz "sadece localStorage"
    // regresyonu (PROJECT_CONTEXT bölüm 23 madde 14) böyle yakalanır.
    expect(apiStore.contracts.length).toBeGreaterThan(0);

    // --- 2) Detay (otomatik açıldı) ---
    // NOT: #detailTitle görünür metni "Şirket › SözleşmeID" biçiminde;
    // tedarikçi adı yalnızca title="" attribute'unda geçiyor.
    await expect(stubbedPage.locator("#detailModal")).toBeVisible();
    await expect(stubbedPage.locator("#detailTitle")).toContainText(CONTRACT.contractId);
    await expect(stubbedPage.locator("#detailTitle")).toHaveAttribute("title", new RegExp(CONTRACT.supplier));

    // --- 3) Ödeme planı ---
    // NOT: #scheduleTableContainer, Faz B tab konsolidasyonu ÖNCESİNDEN
    // kalma boş/orfan bir statik div ("tfrs16.js tarafından
    // doldurulacak" yorumu var ama hiçbir kod onu hedeflemiyor —
    // grep ile doğrulandı). Gerçek ödeme planı, renderPaymentSchedule
    // Section() tarafından #scheduleTableBody (tbody) içine, "Ödeme
    // Planı" tab paneline render ediliyor — modal açılışında zaten
    // DOM'da, yalnızca CSS ile gizli (tab tıklamaya bile gerek yok).
    const scheduleBody = stubbedPage.locator("#scheduleTableBody");
    // 36 aylık kontrat → tam 36 satır (virtual scroll yok, hepsi DOM'da).
    await expect(scheduleBody.locator("tr")).toHaveCount(36);

    expect(stubbedPage.consoleErrors).toEqual([]);
  });

  test("toplu fiş modalı açılır ve kapanır (createBulkJournalModal — Faz 3 refaktör hedefi)", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");
    await createContract(stubbedPage);
    await stubbedPage.locator("#detailModal").waitFor({ state: "visible" });

    // "Fişler" tab'ına geç — renderAccountingCenter'ın (ve içindeki
    // "Tüm Sözleşmeler İçin Toplu Fiş Üret" butonunun) render edildiği yer.
    await stubbedPage.click('[data-detail-tab-target="accounting"]');

    // openBulkJournalModal() → createBulkJournalModal() zincirini tetikler.
    await stubbedPage.click("#openBulkJournalButton");

    const bulkModal = stubbedPage.locator("#bulkJournalModal");
    await expect(bulkModal).toBeVisible();

    // wireBulkJournalModalEvents()'in gerçekten bağladığı bir listener'ı
    // tetikliyoruz — sadece DOM yapısını değil, event wiring'in fiilen
    // ÇALIŞTIĞINI doğrular (bu fonksiyonun asıl risk kategorisi buydu).
    await stubbedPage.click("#closeBulkJournalModal");
    await expect(bulkModal).toBeHidden();

    expect(stubbedPage.consoleErrors).toEqual([]);
  });

  test("toplu fiş önizlemesi büyük veri setinde sanal kaydırmaya geçer (Faz 4.4 refaktör hedefi)", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");

    // NOT: gerçek generateBulkJournals() akışı 51+ sözleşme gerektirir
    // (API üzerinden) — burada test-shim seed helper'ı ile eşik-üstü
    // (120 satır) veri doğrudan enjekte edilip renderBulkJournalResults()
    // tetikleniyor. Bu, sanal kaydırma bağlama mantığını (renderVirtualTable
    // entegrasyonu) izole şekilde, gerçek tarayıcıda doğrular.
    const result = await stubbedPage.evaluate(() => {
      const items = Array.from({ length: 120 }, (_, i) => ({
        voucherNo: `FIS-${String(i + 1).padStart(3, "0")}`,
        voucherDate: "2026-01-01",
        contractId: `C${i + 1}`,
        company: "A.Ş.",
        companyId: "CO1",
        currency: "TRY",
        balanced: true,
        totalDebit: 100000 + i,
        totalCredit: 100000 + i,
        entries: []
      }));
      document.body.insertAdjacentHTML(
        "beforeend",
        '<div id="bulkJournalSummary"></div><div id="bulkJournalPreview"></div><button id="exportBulkJournals"></button>'
      );
      window.__TFRS16_TEST__.__seedBulkJournalDataForTest(items);
      window.__TFRS16_TEST__.renderBulkJournalResults();

      const container = document.getElementById("bulkJournalVirtualRows");
      const before = container.querySelectorAll(".virtual-row").length;
      const beforeFirstText = container.querySelector(".virtual-row")?.textContent || "";

      container.scrollTop = 2000;
      container.dispatchEvent(new Event("scroll"));

      const after = container.querySelectorAll(".virtual-row").length;
      const afterFirstText = container.querySelector(".virtual-row")?.textContent || "";

      return { before, after, beforeFirstText, afterFirstText, totalRows: items.length };
    });

    // Tam 120 satır DEĞİL, yalnızca görünür bir alt küme DOM'da olmalı.
    expect(result.before).toBeGreaterThan(0);
    expect(result.before).toBeLessThan(result.totalRows);
    // Kaydırma sonrası görünen ilk satır değişmiş olmalı (gerçek scroll).
    expect(result.afterFirstText).not.toBe(result.beforeFirstText);
    expect(result.beforeFirstText).toContain("FIS-001");
  });

  test("KPI kartları hesaplanmış değer gösterir", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");

    await createContract(stubbedPage);
    await expect(stubbedPage.locator("#leaseLiability")).not.toHaveText(/^\s*(₺\s*)?0([.,]00)?\s*$/);
    await expect(stubbedPage.locator("#rouAssets")).not.toHaveText(/^\s*(₺\s*)?0([.,]00)?\s*$/);
  });

  test("dışa aktarma yeni pencerede rapor açar", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");

    await createContract(stubbedPage);

    // NOT: exportReport(format="html") dosya İNDİRMEZ — window.open() ile
    // yeni sekme açıp HTML'i doğrudan document.write() ile yazar
    // (js/tfrs16.js satır ~26874). "download" event'i asla ateşlenmez;
    // gerçek davranış "popup" event'idir.
    const popupPromise = stubbedPage.waitForEvent("popup", { timeout: 15000 });
    await stubbedPage.click("#exportReportHtmlButton");
    const popup = await popupPromise;
    await popup.waitForLoadState();

    await expect(popup).toHaveTitle(new RegExp(CONTRACT.contractId));
    await expect(popup.locator("body")).toContainText(CONTRACT.supplier);
  });

  test("şablon indirme çalışır (downloadTemplate — Faz 3 refaktör hedefi)", async ({ stubbedPage }) => {
    await stubbedPage.goto("/tfrs16.html");
    // downloadTemplateButton #bulkImportModal içinde — önce açılmalı.
    await stubbedPage.click("#bulkImportButton");
    await stubbedPage.locator("#bulkImportModal").waitFor({ state: "visible" });

    const downloadPromise = stubbedPage.waitForEvent("download", { timeout: 20000 });
    await stubbedPage.click("#downloadTemplateButton");
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(xlsx|csv)$/i);
  });
});
