'use strict';
// UAT CASE 09 (C09-01): a scope increase that adds a right of use at its
// standalone price is a separate lease (TFRS 16.44). The original contract is
// not remeasured; the additional scope becomes a new linked contract.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const ui = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');
const body = ui.match(/async function createSeparateLeaseIfApplicable\(\) \{[\s\S]*?\n    \}\n/)[0];

function run(fields, checks) {
  const dom = new JSDOM(`<select id="modificationType"><option>SCOPE_INCREASE</option><option>OTHER</option></select>${
    Object.keys(fields).filter(k => k !== 'modificationType').map(id => `<input id="${id}">`).join('')}${
    Object.keys(checks).map(id => `<input id="${id}" type="checkbox">`).join('')}<button id="b">x</button>`);
  const d = dom.window.document;
  for (const [id, v] of Object.entries(fields)) d.getElementById(id).value = v;
  for (const [id, v] of Object.entries(checks)) d.getElementById(id).checked = v;
  const persisted = [], alerts = [], contracts = [];
  const contract = { id: 'UAT-CASE-09', companyId: 'C1', company: 'Test A.Ş.', supplier: 'S', currency: 'TRY', paymentFrequency: 'monthly',
    paymentTiming: 'arrears', startDate: '2025-01-01', endDate: '2029-12-31', monthlyPayment: 100000, discountRate: 18 };
  const fn = new Function('document', 'window', 'contract', 'contracts', 'createButton', 'persistContractToApi', 'ensureModificationState',
    'ensureReassessmentState', 'recordAuditEvent', 'saveContracts', 'formChanges', 'showAlert', 'refreshAfterMutation',
    `${body}; return createSeparateLeaseIfApplicable();`);
  const result = fn(d, { confirm: () => true }, contract, contracts, d.getElementById('b'), async (c, upd) => { persisted.push([c, upd]); }, () => {}, () => {},
    () => {}, () => {}, { sync() {} }, m => alerts.push(m), () => {});
  return result.then(handled => ({ handled, persisted, alerts, contract }));
}
const full = { modificationType: 'SCOPE_INCREASE', modificationEffectiveDate: '2026-01-01', modificationNewEndDate: '2029-12-31',
  modificationAdditionalPayment: '30000', modificationStandalonePrice: '30000', modificationNewDiscountRate: '22',
  modificationSeparateLeaseEvidence: 'Piyasa kira raporu', modificationReason: '' };

test('both 16.44 conditions: a linked 30.000 / %22 lease from 01.01.2026; the original is untouched', async () => {
  const r = await run(full, { modificationAddsRightOfUse: true, modificationPriceCommensurate: true });
  assert.equal(r.handled, true);
  assert.equal(r.persisted.length, 1);
  const [lease, isUpdate] = r.persisted[0];
  assert.equal(isUpdate, false);
  assert.equal(lease.id, 'UAT-CASE-09-EK-20260101');
  assert.deepEqual([lease.startDate, lease.endDate, lease.monthlyPayment, lease.discountRate], ['2026-01-01', '2029-12-31', 30000, 22]);
  assert.equal(lease.separateLeaseOf, 'UAT-CASE-09');
  assert.equal(lease.separateLeaseAssessment.standalonePrice, 30000);
  assert.equal(r.contract.monthlyPayment, 100000);
  assert.equal(r.contract.discountRate, 18);
});

test('a condition not met: the normal modification path runs', async () => {
  const r = await run(full, { modificationAddsRightOfUse: true, modificationPriceCommensurate: false });
  assert.equal(r.handled, false);
  assert.equal(r.persisted.length, 0);
});

test('missing standalone price or evidence: blocked with a message, nothing written', async () => {
  const r = await run({ ...full, modificationStandalonePrice: '', modificationSeparateLeaseEvidence: '' },
    { modificationAddsRightOfUse: true, modificationPriceCommensurate: true });
  assert.equal(r.handled, true);
  assert.equal(r.persisted.length, 0);
  assert.match(r.alerts[0], /bağımsız aylık fiyatı/);
  assert.match(r.alerts[0], /dayanağı/);
});
