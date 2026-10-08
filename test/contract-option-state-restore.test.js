'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const html = fs.readFileSync(path.join(__dirname, '../tfrs16.html'), 'utf8');
const ui = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');
const script = html.match(/<script>\s*\/\* Purchase option price field state[\s\S]*?<\/script>/)[0].replace(/<\/?script>/g, '');

// UAT CASE 06 retest: a saved renewal contract reopened with its judgement
// and evidence fields disabled until the option was toggled off and on.
test('restoring a saved option contract re-enables its judgement and evidence fields', () => {
  const ids = ['purchaseOption', 'purchaseOptionPrice', 'renewalOption', 'renewalOptionExpectedToExercise', 'renewalEndDate',
    'terminationOption', 'terminationOptionExpectedToExercise', 'purchaseOptionExpectedToExercise', 'leaseTermEvidenceReference'];
  const dom = new JSDOM(`<div id="contractModal">${ids.map(id => `<input id="${id}" type="${/Date|Reference|Price/.test(id) ? 'text' : 'checkbox'}">`).join('')}</div>`, { runScripts: 'outside-only' });
  const { window } = dom, d = window.document;
  window.eval(script);
  assert.equal(d.getElementById('leaseTermEvidenceReference').disabled, true, 'empty form: disabled');
  // Restore writes values without change events, then calls the sync hook.
  d.getElementById('renewalOption').checked = true;
  d.getElementById('renewalOptionExpectedToExercise').checked = true;
  d.getElementById('renewalEndDate').value = '2030-12-31';
  window.LeaseQantSyncContractFieldState();
  assert.equal(d.getElementById('renewalOptionExpectedToExercise').disabled, false);
  assert.equal(d.getElementById('renewalOptionExpectedToExercise').checked, true);
  assert.equal(d.getElementById('renewalEndDate').value, '2030-12-31');
  assert.equal(d.getElementById('leaseTermEvidenceReference').disabled, false);
  assert.equal(d.getElementById('leaseTermEvidenceReference').required, true);
  assert.match(ui, /window\.LeaseQantSyncContractFieldState\(\);\n  \}/, 'called at the end of populateContractFormFields');
});
