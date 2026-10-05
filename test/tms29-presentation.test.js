'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

function ui() {
  const window = {};
  vm.createContext(window);
  window.window = window;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/tfrs16-disclosure-ui.js'), 'utf8'), window);
  return window.LeaseQantTfrs16DisclosureUi;
}
const f = (value, extra = {}) => ({ value, status: 'SUPPORTED', currency: 'TRY', sourceIds: ['S'], evidenceIds: ['E'], ...extra });
const pkg = {
  period: { presentationCurrency: 'TRY' },
  quantitative: { rouRollForwardByAssetClass: f([{ assetClass: 'PROPERTY', opening: 102, initialRecognitionAdditions: 10, closing: 105, currency: 'TRY' }]) },
  periodMovement: {
    rou: { opening: f(100), openingRestated: f(102), initialRecognitionAdditions: f(10), depreciation: f(7), tms29Movement: f(2), closing: f(105) },
    liability: { closing: f(910), tms29: { status: 'SUPPORTED', evidenceIds: ['TUFE:2026-06:1'], totals: { opening: 1020, initialRecognitionAdditions: 0,
      interest: 10, scheduledContractualCash: 100, commencementAdvance: 0, modifications: 0, remeasurements: 0, tms21Movement: 0, monetaryGainLoss: -20, closing: 910 } } }
  }
};

test('IAS 29: ROU opening is shown in the reporting-date unit and there is no separate inflation line', () => {
  const rows = ui().rowsForTab(pkg, 'asset');
  const labels = rows.map(r => r.label);
  assert.ok(labels.includes('Kullanım hakkı varlığı — açılış (dönem sonu alım gücüyle)'));
  assert.equal(rows.find(r => r.label.startsWith('Kullanım hakkı varlığı — açılış')).value, 102);
  assert.equal(labels.some(l => /TMS 29 kullanım hakkı hareketi/.test(l)), false);
  assert.equal(rows.find(r => r.label === 'Varlık sınıfına göre açılış — Gayrimenkul').value, 102);
});

test('IAS 29: liability movement is restated and closes with the net monetary position', () => {
  const rows = ui().rowsForTab(pkg, 'liability');
  const value = label => rows.find(r => r.label.startsWith(label))?.value;
  assert.equal(value('Kira yükümlülüğü — açılış (dönem sonu'), 1020);
  assert.equal(value('TMS 29 net parasal pozisyon'), -20);
  assert.equal(value('Kira yükümlülüğü — kapanış'), 910);
  assert.equal(value('Kira yükümlülüğü — açılış (dönem sonu') + value('Dönem faiz gideri') - value('Planlanan sözleşme ödemeleri') + value('TMS 29 net parasal pozisyon'), 910);
});

test('without IAS 29 the nominal movement is unchanged', () => {
  const nominal = { ...pkg, periodMovement: { rou: { opening: f(100), tms29Movement: { value: null, status: 'NOT_APPLICABLE' }, closing: f(103) }, liability: { opening: f(1000), closing: f(910) } } };
  const asset = ui().rowsForTab(nominal, 'asset').map(r => r.label);
  assert.ok(asset.includes('Kullanım hakkı varlığı — açılış'));
  assert.equal(ui().rowsForTab(nominal, 'liability').find(r => r.label === 'Kira yükümlülüğü — açılış').value, 1000);
});
