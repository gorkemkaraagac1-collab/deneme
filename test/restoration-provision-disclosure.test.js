'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function ui() {
  const window = {};
  vm.createContext(window);
  window.window = window;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/tfrs16-disclosure-ui.js'), 'utf8'), window);
  return window.LeaseQantTfrs16DisclosureUi;
}
const f = value => ({ value, status: 'SUPPORTED', currency: 'TRY' });
const base = { period: { presentationCurrency: 'TRY' }, periodMovement: { rou: {}, liability: { closing: f(100) } } };

test('restoration provision roll-forward rows follow the liability movement (TMS 37.84)', () => {
  const pkg = { ...base, periodMovement: { ...base.periodMovement, restorationProvision: { status: 'SUPPORTED', currency: 'TRY', restated: false,
    opening: 0, additions: 500000, accretion: 45000, monetaryGainLoss: 0, closing: 545000, current: 0, nonCurrent: 545000 } } };
  const rows = ui().rowsForTab(pkg, 'liability');
  const value = label => rows.find(r => r.label === label)?.value;
  assert.equal(value('Restorasyon karşılığı — ilk muhasebeleştirme'), 500000);
  assert.equal(value('Restorasyon karşılığı — iskonto çözülmesi (finansman gideri)'), 45000);
  assert.equal(value('Restorasyon karşılığı — kapanış'), 545000);
  assert.equal(rows.some(r => /TMS 29 net parasal/.test(r.label)), false);
});

test('no provision, no rows; IAS 29 adds the monetary position line', () => {
  assert.equal(ui().rowsForTab(base, 'liability').some(r => /Restorasyon/.test(r.label)), false);
  const pkg = { ...base, periodMovement: { ...base.periodMovement, restorationProvision: { status: 'SUPPORTED', currency: 'TRY', restated: true,
    opening: 623109.05, additions: 0, accretion: 49841.54, monetaryGainLoss: -127950.60, closing: 545000, current: 0, nonCurrent: 545000 } } };
  const row = ui().rowsForTab(pkg, 'liability').find(r => r.label === 'Restorasyon karşılığı — TMS 29 net parasal pozisyon');
  assert.equal(row.value, -127950.60);
});

test('a translated provision shows its TMS 21 exchange difference', () => {
  const pkg = { ...base, periodMovement: { ...base.periodMovement, restorationProvision: { status: 'SUPPORTED', currency: 'TRY', restated: false,
    opening: 0, additions: 352803, accretion: 29000, tms21Movement: 48000, monetaryGainLoss: 0, closing: 429803, current: 0, nonCurrent: 429803 } } };
  const row = ui().rowsForTab(pkg, 'liability').find(r => r.label === 'Restorasyon karşılığı — TMS 21 kur farkı');
  assert.equal(row.value, 48000);
});

