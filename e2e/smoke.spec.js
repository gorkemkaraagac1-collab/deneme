"use strict";

const { test, expect } = require("@playwright/test");

test.describe("legacy TFRS16 entry-point compatibility", () => {
  test("sends old page links to the new workspace and preserves requested view", async ({ page }) => {
    await page.route("**/workspace.html**", route => route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: "<!doctype html><title>workspace handoff</title>"
    }));
    await page.goto("/tfrs16.html?open=footnotes&contract=LEASE-1#note-14.1");
    await expect.poll(() => new URL(page.url()).pathname).toBe("/workspace.html");
    const url = new URL(page.url());
    expect(url.searchParams.get("view")).toBe("disclosures");
    expect(url.searchParams.get("contract")).toBe("LEASE-1");
    expect(url.hash).toBe("#note-14.1");
  });

  test("keeps direct workspace entry behind its existing session guard", async ({ page }) => {
    await page.addInitScript(() => { sessionStorage.setItem("gk_session_token", "test-only"); });
    await page.route("https://api.leaseqant.com/api/auth/me", route => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: { id: "E2E", role: "VIEWER" } })
    }));
    await page.route("https://api.leaseqant.com/api/org/companies", route => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] })
    }));
    await page.route("https://api.leaseqant.com/api/contracts", route => route.fulfill({
      status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data: [] })
    }));
    await page.goto("/workspace.html?view=contracts");
    await expect(page.getByRole("heading", { name: "Sözleşmeler" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Yeni sözleşme" }).first()).toBeDisabled();
  });
});
