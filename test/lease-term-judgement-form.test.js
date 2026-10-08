'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ui = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../tfrs16.html'), 'utf8');

// UAT CASE 06: an option contract entered by hand could never be calculated
// (LEASE_TERM_EVIDENCE_REQUIRED) because the form had no evidence reference
// and no termination/purchase "reasonably certain" judgement.
test('manual form carries the lease-term judgements and evidence reference the server requires', () => {
  for (const id of ['leaseTermEvidenceReference', 'terminationOptionExpectedToExercise', 'purchaseOptionExpectedToExercise']) {
    assert.match(html, new RegExp(`id="${id}"`), `${id} input`);
    assert.match(ui, new RegExp(`getCheckbox\\("${id}"\\)|getInput\\("${id}"\\)`), `${id} saved`);
    assert.match(ui, new RegExp(`"${id}",\\n\\s+contract\\?\\.${id}`), `${id} restored`);
  }
  assert.match(ui, /kira süresi değerlendirme referansı zorunludur/);
  assert.match(html, /evidence\.required = anyOption/);
});
