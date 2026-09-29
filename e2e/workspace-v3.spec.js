"use strict";

const crypto = require("node:crypto");
const { test, expect } = require("@playwright/test");

const API = "https://api.leaseqant.com";
const CONTRACT = {
  id: "E2E-LEASE-01", companyId: "E2E-CO-1", company: "Test A.Ş.", supplier: "Örnek Kiraya Veren",
  monthlyPayment: 42000, currency: "TRY", startDate: "2026-01-01", endDate: "2030-12-31",
  discountRate: 0.185, status: "active", details: { paymentFrequency: "monthly", paymentTiming: "arrears" }
};

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function reportDto(intent) {
  const calculationId = "E2E-CALC-01";
  const sourceInputHash = "a".repeat(64);
  const sourceResultHash = "b".repeat(64);
  const sourceIds = [calculationId, sourceInputHash, sourceResultHash];
  const metricNames = ["rouCarryingAmount", "leaseLiability", "currentLiability", "nonCurrentLiability",
    "periodInterest", "periodDepreciation", "contractualPayments", "next12MonthPayments",
    "next12MonthPrincipal", "next12MonthInterest", "openingROU", "openingLiability"];
  const metric = (value, ids = sourceIds) => ({ value, currency: "TRY", status: "SUPPORTED", coverage: "COMPLETE_POPULATION", sourceIds: ids });
  const values = [350000, 365000, 72000, 293000, 5600, 7000, 42000, 504000, 430000, 74000, 357000, 370600];
  const totals = Object.fromEntries(metricNames.map((name, index) => [name, metric(values[index])]));
  const contractMetrics = Object.fromEntries(metricNames.map((name, index) => [name, metric(values[index])]));
  const dto = {
    schemaVersion: "REPORTING_AUTHORITY_DTO_V1",
    identity: { companyId: intent.companyId, companyName: "Test A.Ş.", populationId: "E2E-POP-01",
      functionalCurrency: "TRY", presentationCurrency: "TRY", currencyEvidenceId: "E2E-CURRENCY-01" },
    period: intent,
    sourceStatus: "SERVER_PERSISTED_PRIVATE_REPORTING",
    livePostingStatus: "NOT_READY_FOR_LIVE_POSTING",
    population: { count: 1, contractIds: [CONTRACT.id], includedCount: 1, excludedCount: 0,
      exclusions: [], coverage: "COMPLETE_POPULATION" },
    contracts: [{ contractId: CONTRACT.id, companyId: intent.companyId, supplier: CONTRACT.supplier,
      status: "SUPPORTED", route: "P1_PLAIN_MONTHLY_ARREARS", currency: "TRY",
      currencyEvidenceId: "E2E-CURRENCY-01", calculationId, sourceInputHash, sourceResultHash,
      economicSignature: "e2e-signature-01", metrics: contractMetrics,
      scheduleRows: [{ date: intent.periodEnd, currency: "TRY", payment: 42000, interest: 5600, principal: 36400, closingLiability: 365000 }] }],
    totals,
    controls: { status: "PASS", closeApprovalAuthorized: false, checks: [{ name: "Kaynak kimliği", status: "PASS", message: "E2E sentetik fixture" }] },
    audit: { status: "AVAILABLE", rows: [] }, unsupported: {}
  };
  dto.contentHash = crypto.createHash("sha256").update(stable(dto)).digest("hex");
  return dto;
}

async function boot(page, { locked = false } = {}) {
  const store = { contracts: [{ ...CONTRACT }], draft: null, calls: [], calculations: [] };
  await page.addInitScript(() => {
    sessionStorage.setItem("gk_session_token", "e2e-session");
    window.LEASEQANT_API_BASE = "https://api.leaseqant.com";
    localStorage.setItem("lq-workspace-period-v3", JSON.stringify({ periodStart: "2026-08-01", periodEnd: "2026-08-31" }));
  });
  await page.route(`${API}/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let data;
    store.calls.push({ path, method, headers: request.headers(), body: request.postDataJSON?.() });
    if (path === "/api/auth/me") data = { success: true, data: { id: "E2E-USER", username: "test", firstName: "Test", role: "ACCOUNTANT", mustChangePassword: false } };
    else if (path === "/api/org/companies") data = { success: true, data: [{ id: "E2E-CO-1", name: "Test A.Ş." }] };
    else if (path === "/api/contracts" && method === "GET") data = { success: true, data: store.contracts };
    else if (path === "/api/contracts" && method === "POST") {
      const body = request.postDataJSON(); store.contracts.push({ ...body, status: "active" }); data = { success: true, data: body };
    } else if (path.startsWith("/api/contracts/") && method === "GET") {
      const id = decodeURIComponent(path.split("/").pop());
      const record = store.contracts.find(row => String(row.id) === id);
      data = record ? { success: true, data: record } : { success: false, code: "CONTRACT_NOT_FOUND" };
    } else if (path === "/api/periods/lock-status") {
      data = { success: true, data: { companyId: "E2E-CO-1", periodKey: "2026-08", status: locked ? "LOCKED" : "OPEN", lockedAt: locked ? "2026-09-01T00:00:00.000Z" : null } };
    } else if (path === "/api/reports/authority" && method === "POST") data = { success: true, data: reportDto(request.postDataJSON()) };
    else if (path === "/api/calculations/lease" && method === "POST") {
      const body = request.postDataJSON(); store.calculations.push(body);
      data = { success: true, data: { liability: 100000, rouAssets: 100000, depreciation: 1666.67, monthlyInterest: 1250,
        currency: "TRY", schedule: [{ date: "2026-08-31", payment: 42000, interest: 1250, principal: 40750,
          closingLiability: 59250, depreciation: 1666.67 }] } };
    } else if (path === "/api/journals/preview" && method === "POST") data = { success: false, code: "JOURNAL_ROUTE_NOT_SUPPORTED" };
    else if (path === "/api/reports/lease-disclosure/availability") data = { success: true, data: {
      sourceTrustStatus: "NO_TRUSTED_SOURCES", companyId: "E2E-CO-1", reportingPeriodStart: "2026-08-01",
      reportingPeriodEnd: "2026-08-31", reportingDate: "2026-08-31", contractIds: [], calculationIds: []
    } };
    else if (path === "/api/reports/lease-disclosure/drafts" && method === "GET") data = { success: true, data: store.draft || {
      companyId: "E2E-CO-1", periodStart: "2026-08-01", periodEnd: "2026-08-31", currentVersion: 0, status: "NOT_CREATED", versions: []
    } };
    else if (path === "/api/reports/lease-disclosure/drafts" && method === "POST") {
      const body = request.postDataJSON();
      if (body.expectedVersion !== (store.draft?.currentVersion || 0)) data = { success: false, code: "DISCLOSURE_DRAFT_VERSION_CONFLICT" };
      else {
        const version = body.expectedVersion + 1;
        store.draft = { companyId: body.companyId, periodStart: body.periodStart, periodEnd: body.periodEnd,
          currentVersion: version, status: "DRAFT", versions: [{ id: `E2E-DRAFT-${version}`, version, sections: body.sections,
            createdBy: "E2E-USER", createdAt: "2026-09-28T10:00:00.000Z" }] };
        data = { success: true, data: { ...store.draft.versions[0], companyId: body.companyId,
          periodStart: body.periodStart, periodEnd: body.periodEnd, status: "DRAFT" } };
      }
    } else if (path === "/api/audit") data = { success: true, data: [] };
    else data = { success: false, code: "E2E_UNEXPECTED_API_ROUTE" };
    const status = data.success === false ? (data.code === "E2E_UNEXPECTED_API_ROUTE" ? 500 : 422) : method === "POST" && path === "/api/contracts" ? 201 : 200;
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
  });
  return store;
}

test.describe("new LeaseQant workspace", () => {
  test("shows server reporting and traverses contract, calculation, journals, disclosures and close", async ({ page }) => {
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => {
      // Chrome logs rejected fetch response statuses even when the UI handles
      // the expected fail-closed 422 in its error state.
      if (message.type() === "error" && !/Failed to load resource: the server responded with a status of 422/.test(message.text())) errors.push(message.text());
    });
    const store = await boot(page);
    await page.goto("/workspace.html");
    await expect(page.getByRole("heading", { name: "Genel Bakış" })).toBeVisible();
    await expect(page.getByTitle("365.000,00 TRY")).toBeVisible();
    if (process.env.LQ_WORKSPACE_SCREENSHOT) await page.screenshot({ path: process.env.LQ_WORKSPACE_SCREENSHOT, fullPage: true });
    expect(store.calls.find(call => call.path === "/api/auth/me").headers.authorization).toBe("Bearer e2e-session");

    await page.getByRole("button", { name: "Sözleşmeler", exact: true }).click();
    await expect(page.getByText(CONTRACT.id)).toBeVisible();
    await page.getByRole("button", { name: "Yeni sözleşme" }).click();
    await page.getByLabel("Kiraya veren").fill("Yeni Test Kiraya Veren");
    await page.getByLabel("Ödeme tutarı").fill("18000");
    await page.getByLabel("Başlangıç tarihi").fill("2026-10-01");
    await page.getByLabel("Bitiş tarihi").fill("2028-09-30");
    await page.getByLabel("Yıllık iskonto oranı (%)").fill("17.25");
    const createId = await page.getByLabel("Sözleşme numarası").inputValue();
    await page.getByRole("button", { name: "Kaydet", exact: true }).last().click();
    await expect(page.getByRole("heading", { name: createId })).toBeVisible();
    await page.getByRole("tab", { name: "Hesaplama" }).click();
    await expect(page.getByRole("cell", { name: "42.000,00 TRY" })).toBeVisible();
    expect(store.calculations).toHaveLength(1);

    await page.getByRole("button", { name: "Yevmiye", exact: true }).click();
    await page.getByRole("button", { name: "Önizleme oluştur" }).click();
    await expect(page.getByRole("alert")).toContainText("kapsamına alınmamış");
    expect(store.calls.some(call => call.path === "/api/journals/preview" && call.method === "POST")).toBeTruthy();

    await page.getByRole("button", { name: "Dipnotlar", exact: true }).click();
    const note = page.locator('[data-narrative="14.1"]');
    await expect(note).toBeEnabled();
    await note.fill("Test şirketinin sözleşme açıklaması.");
    await page.getByRole("button", { name: "Taslağı kaydet" }).click();
    await expect(page.getByText("Taslak v1", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Taslağı kaydet" })).toBeEnabled();
    expect(store.draft.versions[0].sections["14.1"]).toBe("Test şirketinin sözleşme açıklaması.");

    await page.getByRole("button", { name: "Kapanış", exact: true }).click();
    await expect(page.getByText("Kaynak kimliği")).toBeVisible();
    expect(store.calls.some(call => /\/api\/(?:journals\/post|ledger|erp)/i.test(call.path))).toBe(false);
    expect(errors).toEqual([]);
  });

  test("keeps narrative editing disabled when the backend reports a locked period", async ({ page }) => {
    await boot(page, { locked: true });
    await page.goto("/workspace.html?view=disclosures");
    await expect(page.locator('[data-narrative="14.1"]')).toBeDisabled();
    await expect(page.getByRole("button", { name: "Taslağı kaydet" })).toBeDisabled();
    await expect(page.getByText("Bu dönem kilitli. Anlatı taslağı salt okunur.")).toBeVisible();
  });

  test("keeps controls and tables usable on a narrow screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await page.goto("/workspace.html?view=contracts");
    await expect(page.getByRole("heading", { name: "Sözleşmeler" })).toBeVisible();
    await expect(page.getByPlaceholder("Sözleşme no, kiraya veren veya açıklama ara")).toBeVisible();
    if (process.env.LQ_WORKSPACE_SCREENSHOT_MOBILE) await page.screenshot({ path: process.env.LQ_WORKSPACE_SCREENSHOT_MOBILE, fullPage: true });
    const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    expect(widths.page).toBeLessThanOrEqual(widths.viewport + 1);
  });
});
