'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const ui = fs.readFileSync(path.join(__dirname, '../js/tfrs16-operations-ui.js'), 'utf8');
const runtime = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');
const runtimeSection = runtime.slice(runtime.indexOf('  function renderSlbSection(contract)'), runtime.indexOf('  function renderSlbJournalHtml('));
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function setup(preview) {
  const dom = new JSDOM('<html data-lq-ui="2"><div id="slbSectionContainer"></div></html>', { runScripts: 'outside-only' });
  const w = dom.window, calls = [], contract = { id: 'C1', companyId: 'CO1', revision: 1 };
  w.eval(ui);
  w.LeaseQantPrivateTfrs16Facade = { loadSaleAndLeaseback: async input => { calls.push(['preview', JSON.parse(JSON.stringify(input))]); return preview ? preview(input) : { testResult: true }; } };
  w.persistContractToApi = async value => { calls.push(['persist', JSON.parse(JSON.stringify(value))]); };
  w.saveContracts = () => calls.push(['local-save']);
  w.contracts = [contract];
  w.cloneModificationValue = value => JSON.parse(JSON.stringify(value));
  w.LeaseQantTfrs16OperationsUi.renderSlbResultHtml = () => '<p>Sunucu sonucu</p>';
  w.eval(runtimeSection + '\nwindow.mountSlb = renderSlbSection;');
  w.mountSlb(contract);
  const get = id => w.document.getElementById(id);
  get('slbCarryingAmount').value = '100'; get('slbFairValue').value = '120'; get('slbSaleProceeds').value = '125';
  return { dom, w, get, calls, contract };
}
test('actual v2 detail runtime previews without writes; explicit save uses the previewed inputs', async () => {
  const { dom, get, calls } = setup();
  assert.equal(get('slbSaveButton').disabled, true);
  get('slbCalculateButton').click(); await tick();
  assert.deepEqual(calls.map(c => c[0]), ['preview']);
  assert.equal(get('slbSaveButton').disabled, false);
  get('slbSaveButton').click(); get('slbSaveButton').click(); await tick();
  assert.deepEqual(calls.map(c => c[0]), ['preview', 'persist', 'local-save']);
  assert.equal(calls[1][1].saleAndLeaseback.saleProceeds, calls[0][1].saleProceeds);
  assert.equal(get('slbSaveButton').disabled, true);
  dom.window.close();
});
test('input change invalidates preview and ignores a late response', async () => {
  let resolve; const { dom, w, get, calls } = setup(() => new Promise(r => { resolve = r; }));
  get('slbCalculateButton').click();
  get('slbSaleProceeds').value = '200'; get('slbSaleProceeds').dispatchEvent(new w.Event('input', { bubbles: true }));
  resolve({}); await tick();
  assert.equal(get('slbSaveButton').disabled, true);
  assert.match(get('slbResultContainer').textContent, /yeniden alın/);
  assert.deepEqual(calls.map(c => c[0]), ['preview']);
  dom.window.close();
});
test('silent contract revision or field changes cannot reuse an accepted preview', async () => {
  for (const change of [s => { s.contract.revision++; }, s => { s.get('slbNote').value = 'Changed'; }]) {
    const s = setup(); s.get('slbCalculateButton').click(); await tick(); change(s);
    s.get('slbSaveButton').click(); await tick();
    assert.deepEqual(s.calls.map(c => c[0]), ['preview']);
    assert.equal(s.get('slbSaveButton').disabled, true); s.dom.window.close();
  }
});
test('preview failure never enables persistence; save failure rolls back and requires a new preview', async () => {
  const failed = setup(() => { throw Error('source unavailable'); });
  failed.get('slbCalculateButton').click(); await tick();
  assert.equal(failed.get('slbSaveButton').disabled, true);
  assert.deepEqual(failed.calls.map(c => c[0]), ['preview']); failed.dom.window.close();
  const s = setup(); s.w.persistContractToApi = async () => { throw Error('write rejected'); };
  s.get('slbCalculateButton').click(); await tick(); s.get('slbSaveButton').click(); await tick();
  assert.equal(s.contract.saleAndLeaseback, null);
  assert.equal(s.get('slbSaveButton').disabled, true);
  assert.match(s.get('slbResultContainer').textContent, /Yeniden önizleme/);
  assert.deepEqual(s.calls.map(c => c[0]), ['preview']); s.dom.window.close();
});
test('a response for a detached contract form cannot enable the replacement form', async () => {
  let resolve; const s = setup(() => new Promise(r => { resolve = r; }));
  s.get('slbCalculateButton').click(); s.w.mountSlb({ id: 'C2', companyId: 'CO1' }); resolve({}); await tick();
  assert.equal(s.get('slbSaveButton').disabled, true);
  assert.doesNotMatch(s.get('slbResultContainer').textContent, /Sunucu sonucu/);
  s.dom.window.close();
});
