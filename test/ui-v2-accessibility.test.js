'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const uiSource = read('js/lq-ui-v2.js');
const pagesSource = read('js/lq-pages.js');
const contractViewSource = read('js/lq-contract-view.js');
const cssSource = read('css/lq-v2.css');
const dateCssSource = read('css/lq-date-fields.css');
const wait = (ms = 40) => new Promise(resolve => setTimeout(resolve, ms));

function installPageSources(window) {
  window.LeaseQantReportingAuthorityUi = {
    defaultPeriod: () => ({ periodStart: '2026-01-01', periodEnd: '2026-06-30', reportingDate: '2026-06-30' }),
    companies: async () => [{ id: 'test-company', name: 'Synthetic Test' }],
    load: async () => { throw new Error('synthetic source unavailable'); },
    rawRows: () => []
  };
  window.LeaseQantPrivateTfrs16Facade = {
    loadLeaseDisclosureAvailability: async () => { throw new Error('synthetic source unavailable'); },
    loadLeaseDisclosure: async () => { throw new Error('synthetic source unavailable'); }
  };
  window.LeaseQantDashboardCharts = {
    scopeOk: () => true,
    bridgeModel: () => ({ rows: [], residual: null, complete: false, paymentPlanned: false }),
    maturityModel: () => ({ supported: false, status: 'NOT_READY', bands: [] })
  };
  window.GK_TFRS16 = {
    getPortfolioContracts: () => [{
      id: 'LEASE-TEST-01', companyId: 'test-company', company: 'Synthetic Test', supplier: 'Test Lessor',
      status: 'active', startDate: '2025-01-01', endDate: '2030-12-31', monthlyPayment: 2500,
      currency: 'TRY', assetClass: 'Bina'
    }]
  };
}

function dispatchKey(window, element, key) {
  const event = new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

test('contract and finance tabs expose one labelled panel and support arrow/Home/End keyboard activation', async () => {
  const dom = new JSDOM(`<!doctype html><html data-lq-ui="2"><body>
    <nav id="sidebarNav" aria-label="Ana navigasyon"><button class="nav-item active" data-open="financialReporting">Finansal Raporlama</button></nav>
      <select id="v26ActiveCompanySelect"><option value="test-company" selected>Synthetic Test</option></select>
      <section id="contractsView" style="display:block"></section><section id="lqDashboard" hidden></section>
      <div id="v26PageHost" style="display:block"></div>
  </body></html>`, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  installPageSources(dom.window);
  dom.window.eval(uiSource);
  dom.window.eval(pagesSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  await wait(120);

  const d = dom.window.document;
  const contractTabs = Array.from(d.querySelectorAll('#lqContracts [role="tab"]'));
  assert.equal(contractTabs.filter(tab => tab.getAttribute('aria-selected') === 'true').length, 1);
  assert.equal(contractTabs.filter(tab => tab.tabIndex === 0).length, 1);
  assert.ok(contractTabs.every(tab => d.getElementById(tab.getAttribute('aria-controls'))));
  const first = contractTabs[0];
  first.focus();
  assert.equal(dispatchKey(dom.window, first, 'ArrowDown').defaultPrevented, false, 'horizontal tabs leave vertical arrow keys available to page navigation');
  assert.equal(dispatchKey(dom.window, first, 'ArrowRight').defaultPrevented, true);
  let selected = d.querySelector('#lqContracts [role="tab"][aria-selected="true"]');
  assert.equal(selected.getAttribute('data-cview'), 'active');
  assert.equal(d.activeElement, selected, 'focus follows the selected tab after its list is redrawn');
  dispatchKey(dom.window, selected, 'End');
  selected = d.querySelector('#lqContracts [role="tab"][aria-selected="true"]');
  assert.equal(selected.getAttribute('data-cview'), 'out');
  assert.equal(d.activeElement, selected);
  assert.equal(d.getElementById('lqContractsViewPanel').getAttribute('aria-labelledby'), selected.id);

  const financialTabs = Array.from(d.querySelectorAll('#lqFinancial [role="tab"]'));
  assert.ok(financialTabs.length >= 5);
  assert.equal(financialTabs.filter(tab => tab.tabIndex === 0).length, 1);
  assert.ok(financialTabs.every(tab => d.getElementById(tab.getAttribute('aria-controls'))));
  const last = financialTabs.at(-1);
  dispatchKey(dom.window, financialTabs[0], 'ArrowRight');
  let activeFinance = d.querySelector('#lqFinancial [role="tab"][aria-selected="true"]');
  assert.equal(activeFinance.getAttribute('data-frtab'), 'rou');
  assert.equal(d.activeElement, activeFinance);
  dispatchKey(dom.window, activeFinance, 'End');
  activeFinance = d.querySelector('#lqFinancial [role="tab"][aria-selected="true"]');
  assert.equal(activeFinance, last);
  assert.equal(d.getElementById('lqFrBody').getAttribute('aria-labelledby'), activeFinance.id);
  assert.equal(activeFinance.tabIndex, 0);
  await wait(20);
  dom.window.close();
});

test('navigation disclosures and detail dialog have accessible state; Escape closes and restores focus', async () => {
  const dom = new JSDOM(`<!doctype html><html data-lq-ui="2"><body>
    <button id="menuToggle" aria-expanded="false">☰</button>
    <nav id="sidebarNav" aria-label="Ana navigasyon">
      <button class="nav-item active" data-view="contracts">Sözleşmeler</button>
      <div class="lq-nav-dropdown"><button class="lq-nav-trigger" aria-expanded="false">İşlemler</button>
        <div class="lq-nav-menu"><button class="nav-item" data-open="modification">Modifikasyon</button></div>
      </div>
    </nav>
    <div id="bulkImportModal" role="dialog"><h2>Excel ile toplu içe aktarım</h2></div>
    <div id="detailModal" role="dialog"><h2 id="detailTitle">Sözleşme</h2></div>
  </body></html>`, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  dom.window.eval(uiSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  const d = dom.window.document;
  const toggle = d.getElementById('menuToggle');
  const nav = d.getElementById('sidebarNav');
  const trigger = nav.querySelector('.lq-nav-trigger');
  assert.equal(toggle.getAttribute('aria-controls'), 'sidebarNav');
  assert.equal(toggle.getAttribute('aria-label'), 'Ana menüyü aç');
  assert.equal(nav.querySelector('[data-view="contracts"]').getAttribute('aria-current'), 'page');
  assert.equal(d.getElementById('detailModal').getAttribute('aria-labelledby'), 'detailTitle');
  assert.equal(d.getElementById('bulkImportModal').getAttribute('aria-label'), 'Excel ile toplu içe aktarım');
  const dynamicDialog = d.createElement('div');
  dynamicDialog.setAttribute('role', 'dialog');
  d.body.append(dynamicDialog);
  const dynamicHeading = d.createElement('h2');
  dynamicHeading.textContent = 'Yeni doğrulama penceresi';
  dynamicDialog.append(dynamicHeading);
  await wait(5);
  assert.equal(dynamicDialog.getAttribute('aria-label'), 'Yeni doğrulama penceresi');

  trigger.focus();
  nav.querySelector('.lq-nav-dropdown').classList.add('open');
  trigger.setAttribute('aria-expanded', 'true');
  const escape = dispatchKey(dom.window, trigger, 'Escape');
  assert.equal(escape.defaultPrevented, true);
  assert.equal(nav.querySelector('.lq-nav-dropdown').classList.contains('open'), false);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(d.activeElement, trigger);

  nav.classList.add('mobile-open');
  toggle.setAttribute('aria-expanded', 'true');
  dispatchKey(dom.window, nav.querySelector('[data-open="modification"]'), 'Escape');
  assert.equal(nav.classList.contains('mobile-open'), false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(d.activeElement, toggle);
  assert.equal(toggle.getAttribute('aria-label'), 'Ana menüyü aç');
  await wait(10);
  dom.window.close();
});

test('contract detail tabs and action menus expose labelled relationships and keyboard operation', async () => {
  const dom = new JSDOM(`<!doctype html><html data-lq-ui="2"><body>
    <div id="detailModal" role="dialog"><div id="detailContent"></div></div><button id="deleteContract"></button>
  </body></html>`, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  const w = dom.window;
  w.GK_TFRS16 = { getSelectedContractId: () => 'LEASE-1', getPortfolioContracts: () => [{
    id: 'LEASE-1', company: 'Test', supplier: 'Lessor', startDate: '2025-01-01', endDate: '2030-12-31',
    discountRate: 5.5, monthlyPayment: 100, currency: 'TRY', status: 'active'
  }] };
  w.LeaseQantReportingAuthorityUi = { defaultPeriod: () => ({ periodStart: '2026-01-01', periodEnd: '2026-01-31', reportingDate: '2026-01-31' }) };
  w.eval(contractViewSource);
  const content = w.document.getElementById('detailContent');
  content.innerHTML = `<div class="gk-detail-tabs">${['summary','schedule','modification','slb','sublease','accounting','audit'].map(key => `<button class="gk-detail-tab-btn" data-detail-tab-target="${key}">${key}</button>`).join('')}</div>${['summary','schedule','modification','slb','sublease','accounting','audit'].map(key => `<div class="gk-detail-tab" data-detail-tab="${key}">${key}</div>`).join('')}`;
  await wait(20);

  const d = w.document;
  const shell = content.querySelector('.lq-cv-shell');
  assert.ok(shell);
  const tabs = Array.from(shell.querySelectorAll('[role="tab"]'));
  assert.ok(tabs.every(tab => d.getElementById(tab.getAttribute('aria-controls'))));
  assert.equal(shell.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'), shell.querySelector('[role="tab"][aria-selected="true"]').id);
  const first = tabs[0];
  dispatchKey(w, first, 'End');
  assert.equal(d.activeElement.getAttribute('data-lq-cv-tab'), 'audit');
  assert.equal(shell.querySelector('[role="tabpanel"]').getAttribute('aria-labelledby'), 'lqCvTab-audit');

  const trigger = shell.querySelector('[data-lq-cv="menu"]');
  assert.equal(d.getElementById(trigger.getAttribute('aria-controls')).getAttribute('aria-label'), 'Sözleşme işlemleri');
  trigger.click();
  let menu = d.getElementById('lqCvActionsMenu');
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  assert.equal(d.activeElement, menu.querySelector('[role="menuitem"]'));
  dispatchKey(w, d.activeElement, 'ArrowDown');
  assert.equal(d.activeElement.textContent.trim(), 'Satış ve geri kiralama');
  dispatchKey(w, d.activeElement, 'Escape');
  assert.equal(menu.hidden, true);
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  assert.equal(d.activeElement, trigger);
  dom.window.close();
});

test('focus indicators remain visible and disabled text meets WCAG AA contrast on its v2 surface', () => {
  assert.match(cssSource, /html\[data-lq-ui="2"\]\s+:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--lq-primary\)/);
  assert.match(cssSource, /\.form-field input:not\(\.lq-date-text\):focus-visible[\s\S]*?outline:\s*2px solid var\(--lq-primary\)/);
  assert.match(dateCssSource, /\.lq-date > input\.lq-date-text:focus-visible[\s\S]*?outline:\s*2px solid var\(--lq-primary/);
  assert.match(cssSource, /button:disabled[^}]*color:\s*var\(--lq-ink-2\)/);
  assert.match(cssSource, /\.form-field textarea:disabled[^}]*color:\s*var\(--lq-ink-2\)/);
  assert.match(dateCssSource, /\.lq-date > input\.lq-date-text::placeholder \{ color: var\(--lq-ink-3/);

  const colors = Object.fromEntries([...cssSource.matchAll(/--(lq-[\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(([, key, color]) => [key, color]));
  const luminance = hex => {
    const channels = hex.slice(1).match(/.{2}/g).map(channel => parseInt(channel, 16) / 255);
    const linear = channels.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const ratio = (foreground, background) => {
    const a = luminance(foreground), b = luminance(background);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  };
  assert.ok(ratio(colors['lq-ink-2'], '#E3E7EE') >= 4.5, 'disabled control text is readable against its disabled surface');
  assert.ok(ratio(colors['lq-ink-2'], colors['lq-bg']) >= 4.5, 'secondary text meets AA on the v2 canvas');
  assert.ok(ratio(colors['lq-ink-3'], '#FFFFFF') >= 4.5, 'muted text meets AA on cards');
  assert.ok(ratio(colors['lq-warn'], '#FFFFFF') >= 4.5, 'warning text meets AA on white');
  assert.ok(ratio('#FFFFFF', colors['lq-primary']) >= 4.5, 'primary button text meets AA');
  assert.ok(ratio(colors['lq-rail-text'], colors['lq-rail']) >= 4.5, 'navigation text meets AA on the rail');
});

test('legacy mode skips all v2 accessibility decoration', () => {
  const dom = new JSDOM('<!doctype html><html data-lq-ui="legacy"><body><button id="menuToggle" aria-expanded="false"></button><nav id="sidebarNav"><button class="nav-item active">Sözleşmeler</button></nav><div id="detailModal" role="dialog"><h2 id="detailTitle"></h2></div></body></html>', { runScripts: 'outside-only' });
  dom.window.eval(uiSource);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  const d = dom.window.document;
  assert.equal(d.getElementById('menuToggle').hasAttribute('aria-controls'), false);
  assert.equal(d.querySelector('.nav-item').hasAttribute('aria-current'), false);
  assert.equal(d.getElementById('detailModal').hasAttribute('aria-labelledby'), false);
  dom.window.close();
});
