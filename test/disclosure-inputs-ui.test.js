'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const source = fs.readFileSync(path.join(__dirname, '../js/tfrs16-disclosure-inputs-ui.js'), 'utf8');
const period = { reportingPeriodStart: '2026-06-01', reportingPeriodEnd: '2026-06-30' };
const field = (value, src = 'SYSTEM_DEFAULT') => ({ value, source: src, default: { value: 'Sistem metni' } });
function inputs(canEdit) {
  return { canEdit, companyInput: null,
    contracts: [{ id: 'L-1', supplier: 'Plaza', assetClassText: 'Ofis', assetClass: 'PROPERTY', defaultAssetClass: 'PROPERTY', source: 'SYSTEM_DEFAULT' }],
    disclosures: Object.fromEntries(['leasingActivity', 'extensionTerminationExposure', 'unrecognizedVariableExposure', 'residualValueGuaranteeExposure',
      'notYetCommencedCommitments', 'leaseRestrictionsOrCovenants', 'saleAndLeasebackInformation', 'shortTermElection', 'lowValueElection',
      'rentConcessionExpedient'].map(k => [k, field('Sistem metni')])),
    maturity: { source: 'SYSTEM_DEFAULT', bands: [{ label: '1 yıla kadar', fromDaysInclusive: 0, throughDaysInclusive: 365 },
      { label: '1 yıldan uzun', fromDaysInclusive: 366, throughDaysInclusive: null }], defaultBands: [] },
    tms29: { applies: true, source: 'SYSTEM_DEFAULT', default: true } };
}
const tick = () => new Promise(r => setTimeout(r, 0));
function setup(data) {
  const dom = new JSDOM('<!doctype html><head></head><body></body>', { runScripts: 'outside-only', virtualConsole: new VirtualConsole() });
  const w = dom.window, saved = [];
  w.LeaseQantPrivateCalculation = { getDisclosureInputs: async () => data,
    saveDisclosureInputs: async (companyId, p, changes) => { saved.push({ companyId, p, changes }); return { inputs: { ...data, canEdit: undefined } }; } };
  w.eval(source);
  return { w, saved };
}

test('only changed inputs are sent and the disclosure is reloaded', async () => {
  const { w, saved } = setup(inputs(true));
  let reloaded = 0;
  w.LeaseQantDisclosureInputsUi.open({ companyId: 'CO', companyName: 'Test', period, onSaved: () => reloaded++ });
  await tick();
  const doc = w.document;
  assert.equal(doc.querySelector('[data-di="save"]').disabled, true);
  const select = doc.querySelector('[data-class="L-1"]');
  select.value = 'VEHICLES'; select.dispatchEvent(new w.Event('change', { bubbles: true }));
  const na = doc.querySelector('[data-na="leaseRestrictionsOrCovenants"]');
  na.checked = true; na.dispatchEvent(new w.Event('change', { bubbles: true }));
  const reason = doc.querySelector('[data-text="leaseRestrictionsOrCovenants"]');
  reason.value = 'Kısıt yoktur.'; reason.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(doc.querySelector('[data-di="save"]').disabled, false);
  doc.querySelector('[data-di="save"]').click();
  await tick(); await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(saved[0].changes)), { assetClassByContract: { 'L-1': 'VEHICLES' },
    disclosures: { leaseRestrictionsOrCovenants: { status: 'NOT_APPLICABLE', reason: 'Kısıt yoktur.' } } });
  assert.equal(reloaded, 1);
  assert.match(doc.querySelector('.lq-di-msg').textContent, /Kaydedildi/);
});

test('read-only users see values without editing controls', async () => {
  const { w } = setup(inputs(false));
  w.LeaseQantDisclosureInputsUi.open({ companyId: 'CO', period });
  await tick();
  assert.equal(w.document.querySelector('[data-class]'), null);
  assert.equal(w.document.querySelector('[data-di="save"]').disabled, true);
  assert.match(w.document.querySelector('.lq-di-body').textContent, /Salt okunur/);
});

test('TMS 29 setting is sent when toggled', async () => {
  const { w, saved } = setup(inputs(true));
  w.LeaseQantDisclosureInputsUi.open({ companyId: 'CO', period });
  await tick();
  const box = w.document.querySelector('[data-tms29]');
  assert.equal(box.checked, true);
  box.checked = false; box.dispatchEvent(new w.Event('change', { bubbles: true }));
  w.document.querySelector('[data-di="save"]').click();
  await tick(); await tick();
  assert.deepEqual(JSON.parse(JSON.stringify(saved[0].changes)), { tms29Applies: false });
});

test('a value set back to the stored one disables Kaydet again', async () => {
  const { w } = setup(inputs(true));
  w.LeaseQantDisclosureInputsUi.open({ companyId: 'CO', period });
  await tick();
  const doc = w.document;
  const change = value => { const s = doc.querySelector('[data-class="L-1"]'); s.value = value; s.dispatchEvent(new w.Event('change', { bubbles: true })); };
  change('VEHICLES');
  assert.equal(doc.querySelector('[data-di="save"]').disabled, false);
  change('PROPERTY');
  assert.equal(doc.querySelector('[data-di="save"]').disabled, true);
  const text = doc.querySelector('[data-text="leasingActivity"]');
  text.value = 'Yeni'; text.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(doc.querySelector('[data-di="save"]').disabled, false);
  text.value = 'Sistem metni'; text.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(doc.querySelector('[data-di="save"]').disabled, true);
});
