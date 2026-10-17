'use strict';
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "tfrs16-ui.js"), "utf8");

function extract(name) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf("\n  }\n", start);
  return source.slice(start, end + 4);
}

const currentLeaseTermsForEventForm = new Function(
  `${extract("judgedLeaseEndDate")}\n${extract("currentLeaseTermsForEventForm")}\nreturn currentLeaseTermsForEventForm;`
)();

test("UAT3 C07 event forms start from the applied terms", async t => {
  const contract = {
    monthlyPayment: 100000, discountRate: 18, endDate: "2029-12-31",
    reassessments: [
      { status: "APPLIED", effectiveDate: "2026-01-01", newTerms: { payment: 110000, discountRate: 21, leaseTerm: "2031-12-31" } },
      { status: "APPLIED", effectiveDate: "2025-07-01", newTerms: { payment: 110000, discountRate: 18, leaseTerm: "2029-12-31" } },
      { status: "DRAFT", effectiveDate: "2026-07-01", newTerms: { payment: 1, discountRate: 1 } }
    ],
    modifications: []
  };

  await t.test("payment, rate and end date follow the last applied event", () => {
    assert.deepEqual(currentLeaseTermsForEventForm(contract), { payment: 110000, discountRate: 21, leaseEndDate: "2031-12-31" });
  });

  await t.test("a later applied modification wins over earlier reassessments", () => {
    const withMod = { ...contract, modifications: [
      { status: "APPLIED", effectiveDate: "2026-04-01", newTerms: { payment: 95000, discountRate: 22, leaseEndDate: "2031-12-31" } }] };
    assert.deepEqual(currentLeaseTermsForEventForm(withMod), { payment: 95000, discountRate: 22, leaseEndDate: "2031-12-31" });
  });

  await t.test("without applied events the commencement terms are used", () => {
    assert.deepEqual(currentLeaseTermsForEventForm({ monthlyPayment: 5, discountRate: 7, endDate: "2030-01-31" }),
      { payment: 5, discountRate: 7, leaseEndDate: "2030-01-31" });
  });

  await t.test("every new-payment, rate and end-date input uses the helper", () => {
    for (const id of ["modificationNewPayment", "reassessmentNewPayment", "modificationNewDiscountRate",
      "reassessmentNewDiscountRate", "modificationNewEndDate", "reassessmentNewEndDate"]) {
      assert.match(source, new RegExp(`id="${id}"[^>]*value="\\$\\{(escapeHtml\\()?currentLeaseTermsForEventForm\\(contract\\)`));
    }
  });
});
