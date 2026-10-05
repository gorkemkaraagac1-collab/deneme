'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const pageSource = fs.readFileSync(path.join(__dirname, '../js/lq-pages.js'), 'utf8');
const cssSource = fs.readFileSync(path.join(__dirname, '../css/lq-v2.css'), 'utf8');
const tick = (ms = 80) => new Promise(resolve => setTimeout(resolve, ms));
const metric = value => ({ value, status: 'SUPPORTED' });

function contractPackage() {
  return {
    contracts: [{
      contractId: 'LEASE-2030', status: 'SUPPORTED',
      metrics: { leaseLiability: metric(123456), rouCarryingAmount: metric(100000) }
    }],
    totals: {
      leaseLiability: metric(123456), periodInterest: metric(1), periodDepreciation: metric(2),
      contractualPayments: metric(3), next12MonthInterest: metric(4), currentLiability: metric(5),
      nonCurrentLiability: metric(6), next12MonthPrincipal: metric(7)
    },
    population: { excludedCount: 0 },
    identity: { presentationCurrency: 'TRY' }
  };
}

function disclosurePackage() {
  return {
    periodMovement: {
      liability: {
        opening: metric(100), initialRecognitionAdditions: metric(0), interest: metric(4),
        actualCashOutflow: metric(-10), modifications: metric(0), remeasurements: metric(0),
        tms21Movement: { status: 'NOT_PROVIDED' }, closing: metric(94)
      },
      rou: {
        opening: metric(100), initialRecognitionAdditions: metric(0), subsequentAdditions: metric(0),
        depreciation: metric(4), modifications: metric(0), remeasurements: metric(0),
        tms29Movement: { status: 'NOT_PROVIDED' }, closing: metric(96)
      }
    }
  };
}

function installSources(window) {
  window.LeaseQantReportingAuthorityUi = {
    defaultPeriod: () => ({ periodStart: '2026-01-01', periodEnd: '2026-06-30', reportingDate: '2026-06-30' }),
    companies: async () => [{ id: 'company-1', name: 'Synthetic Company' }],
    load: async () => contractPackage(),
    rawRows: () => [{ timestamp: '2026-03-31T09:15:00Z', contract_id: 'LEASE-2030', action: 'Ödeme', actor: 'Test' }]
  };
  window.LeaseQantPrivateTfrs16Facade = {
    loadLeaseDisclosureAvailability: async request => ({ request }),
    loadLeaseDisclosure: async () => (window.__tms29Package || disclosurePackage())
  };
  window.LeaseQantDashboardCharts = {
    scopeOk: () => true,
    bridgeModel: () => ({ rows: [], residual: null, complete: true, paymentPlanned: false }),
    maturityModel: () => ({
      supported: true, status: 'SUPPORTED', bands: [{ id: 'year-1', label: '0–1 yıl', value: 5 }],
      total: 6, carrying: 5, finance: 1, max: 5
    })
  };
  window.GK_TFRS16 = {
    getPortfolioContracts: () => [{
      id: 'LEASE-2030', companyId: 'company-1', company: 'Synthetic Company', supplier: 'Test Kiraya Veren',
      status: 'active', startDate: '2025-01-01', endDate: '2030-12-31', monthlyPayment: 2500,
      currency: 'TRY', assetClass: 'Bina'
    }]
  };
}

test('mobile contract cards label all fields and preserve source values and keyboard row semantics', async () => {
  const dom = new JSDOM(`<!doctype html><html data-lq-ui="2"><body>
    <select id="v26ActiveCompanySelect"><option value="company-1" selected>Synthetic Company</option></select>
    <section id="lqDashboard" hidden></section><div id="contractsView" style="display:block"></div>
    <nav id="sidebarNav"></nav><div id="v26PageHost" style="display:none"></div>
  </body></html>`, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  installSources(dom.window);
  dom.window.eval(pageSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await tick();

  const row = dom.window.document.querySelector('#lqContracts [data-open-contract="LEASE-2030"]');
  assert.ok(row);
  assert.equal(row.getAttribute('role'), 'button');
  assert.equal(row.getAttribute('tabindex'), '0');
  assert.deepEqual(Array.from(row.children, cell => cell.getAttribute('data-label')), [
    'Sözleşme', 'Kiraya veren', 'Şirket', 'Sınıf', 'Bitiş', 'Kalan süre', 'Dönemsel ödeme',
    'Kira yükümlülüğü', 'Kullanım hakkı varlığı', 'Kapsam', 'Durum'
  ]);
  assert.match(row.textContent, /2\.500,00/);
  assert.match(row.textContent, /123\.456/);
  assert.match(row.textContent, /2030/);
  dom.window.close();
});

test('financial calculation rows carry their matching server-table headings into mobile cards', async () => {
  const dom = new JSDOM(`<!doctype html><html data-lq-ui="2"><body>
    <select id="v26ActiveCompanySelect"><option value="company-1" selected>Synthetic Company</option></select>
    <nav id="sidebarNav"><button class="nav-item active" data-open="financialReporting">Raporlama</button></nav>
    <div id="v26PageHost" style="display:block"></div>
  </body></html>`, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  installSources(dom.window);
  dom.window.eval(pageSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await tick();

  const finance = dom.window.document.getElementById('lqFinancial');
  assert.ok(finance);
  for (const tab of ['liability', 'rou', 'expense', 'split', 'maturity']) {
    finance.querySelector(`[data-frtab="${tab}"]`).click();
    const head = finance.querySelector('.lq-pg-ftr.is-head');
    const row = finance.querySelector('.lq-pg-ftr:not(.is-head)');
    assert.ok(row, `${tab} tab has a source row`);
    const headings = Array.from(head.children, cell => cell.textContent.trim());
    const labels = Array.from(row.children, cell => cell.getAttribute('data-label'));
    assert.deepEqual(labels, headings, `${tab} cell labels follow its current source headings`);
  }
  const expense = finance.querySelector('[data-frtab="expense"]');
  expense.click();
  const expenseRow = finance.querySelector('.lq-pg-ftr:not(.is-head)');
  assert.match(expenseRow.textContent, /Synthetic Company/);
  assert.match(expenseRow.textContent, /1/);

  finance.querySelector('[data-frtab="events"]').click();
  const event = finance.querySelector('.lq-pg-event');
  assert.ok(event);
  assert.deepEqual(Array.from(event.children, cell => cell.getAttribute('data-label')), [
    'Zaman', 'Sözleşme', 'Olay', 'Şirket ve kullanıcı'
  ]);
  assert.match(event.textContent, /LEASE-2030/);
  dom.window.close();
});

test('legacy view remains outside the mobile card markup and the responsive rules are v2-only', () => {
  const dom = new JSDOM(`<!doctype html><html data-lq-ui="legacy"><body>
    <select id="v26ActiveCompanySelect"><option value="company-1" selected>Synthetic Company</option></select>
    <div id="contractsView" style="display:block"></div>
  </body></html>`, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  installSources(dom.window);
  dom.window.eval(pageSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  assert.equal(dom.window.document.querySelector('#lqContracts'), null);
  assert.equal(dom.window.document.querySelector('[data-label]'), null);
  dom.window.close();

  assert.match(cssSource, /@media\s*\(max-width:\s*900px\)[\s\S]*?html\[data-lq-ui="2"\]\s+\.lq-pg-table\s*>\s*\.lq-pg-tr\[data-open-contract\]/);
  assert.match(cssSource, /html\[data-lq-ui="2"\]\s+\.lq-pg-fgrid\s*>\s*\.lq-pg-ftr:not\(\.is-head\)/);
  assert.match(cssSource, /html\[data-lq-ui="2"\]\s+\.lq-pg-event/);
});

test('IAS 29: liability table shows the monetary gain column, ROU table has no inflation column and a by-class block', async () => {
  const dom = new JSDOM(`<!doctype html><html data-lq-ui="2"><body>
    <select id="v26ActiveCompanySelect"><option value="company-1" selected>Synthetic Company</option></select>
    <nav id="sidebarNav"><button class="nav-item active" data-open="financialReporting">Raporlama</button></nav>
    <div id="v26PageHost" style="display:block"></div>
  </body></html>`, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  installSources(dom.window);
  const base = disclosurePackage();
  dom.window.__tms29Package = { ...base,
    quantitative: { rouRollForwardByAssetClass: { status: 'SUPPORTED', value: [
      { assetClass: 'PROPERTY', opening: 70, initialRecognitionAdditions: 0, modifications: 0, remeasurements: 0, depreciation: 3, subleaseDerecognition: 0, closing: 67 },
      { assetClass: 'VEHICLES', opening: 32, initialRecognitionAdditions: 0, modifications: 0, remeasurements: 0, depreciation: 3, subleaseDerecognition: 0, closing: 29 }] } },
    periodMovement: { ...base.periodMovement,
      rou: { ...base.periodMovement.rou, openingRestated: metric(102), tms29Movement: metric(2), closing: metric(96) },
      liability: { ...base.periodMovement.liability, tms29: { status: 'SUPPORTED', totals: { opening: 102, initialRecognitionAdditions: 0, interest: 4,
        scheduledContractualCash: 10, commencementAdvance: 0, modifications: 0, remeasurements: 0, tms21Movement: 0, monetaryGainLoss: -2, closing: 94 } } } } };
  dom.window.eval(pageSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await tick();
  const finance = dom.window.document.getElementById('lqFinancial');
  const headings = () => Array.from(finance.querySelector('.lq-pg-ftr.is-head').children, cell => cell.textContent.trim());
  finance.querySelector('[data-frtab="liability"]').click();
  assert.ok(headings().includes('TMS 29 PARASAL KAZANÇ / KAYIP'));
  const liabilityRow = finance.querySelector('.lq-pg-ftr:not(.is-head)');
  assert.match(liabilityRow.textContent, /\(2\)/);
  assert.ok(liabilityRow.querySelector('.is-ok'), 'restated movement reconciles to the nominal closing');
  finance.querySelector('[data-frtab="rou"]').click();
  assert.equal(headings().some(h => /TMS 29/.test(h)), false);
  assert.match(finance.querySelector('.lq-pg-ftr:not(.is-head)').textContent, /102/);
  const byClass = finance.querySelector('.lq-pg-byclass');
  assert.ok(byClass);
  const classHead = Array.from(byClass.querySelector('.lq-pg-ftr.is-head').children, cell => cell.textContent.trim());
  assert.deepEqual(classHead, ['HAREKET', 'GAYRİMENKUL', 'TAŞITLAR', 'TOPLAM']);
  // Period expenses use the same restated figures (not the nominal report).
  finance.querySelector('[data-frtab="expense"]').click();
  const cells = Array.from(finance.querySelector('.lq-pg-ftr:not(.is-head)').children, cell => cell.textContent.trim());
  assert.deepEqual(cells.slice(1, 4), ['4', '4', '10']);
  assert.match(finance.textContent, /dönem sonu alım gücüyle/);
  dom.window.close();
});
