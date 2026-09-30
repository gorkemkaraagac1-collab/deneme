const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
function load(file, window) {
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), {
    window, URLSearchParams, Intl, Blob, AbortController, Promise, Date, Number, String, Set, Object
  }, { filename: file });
}

function fixture(period) {
  return {
    identity: { disclosureId: 'DISC-TEST', companyId: 'COMPANY-1', currencyEvidenceId: 'CURRENCY-TEST' },
    population: { populationId: 'POP-TEST',
      includedContractIds: ['CONTRACT-1'], includedCalculationIds: ['CALC-1'], includedCount: 1 },
    period: { ...period, presentationCurrency: 'TRY' },
    certification: { status: 'DISCLOSURE_BACKEND_IMPLEMENTED_NOT_CERTIFIED' },
    quantitative: {
      rouCarryingAmount: { value: 91.23456, status: 'SUPPORTED', currency: 'TRY' },
      rouDepreciationTotal: { value: 17.12345, status: 'SUPPORTED', currency: 'TRY' },
      initialRecognitionRouAdditions: { value: 0, status: 'ZERO_CONFIRMED', currency: 'TRY' },
      interestExpense: { value: 8.731, status: 'SUPPORTED', currency: 'TRY' },
      totalCashOutflowForLeases: { value: null, status: 'REQUIRES_LEDGER_DATA', currency: 'TRY' },
      rouDepreciationByAssetClass: { value: null, status: 'REQUIRES_ENTITY_INPUT', currency: 'TRY' },
      rouCarryingAmountByAssetClass: { value: null, status: 'REQUIRES_ENTITY_INPUT', currency: 'TRY' },
      shortTermLeaseExpense: { value: null, status: 'NOT_SUPPORTED', currency: 'TRY' }
    },
    maturityAnalysis: { status: 'REQUIRES_ENTITY_INPUT', bands: [], undiscountedTotal: null,
      discountedLeaseLiabilityCarryingAmount: { value: 80.45678, status: 'SUPPORTED', currency: 'TRY' } },
    periodMovement: {
      sourceRouteStatus: 'P1_TRUSTED_SNAPSHOT_ONLY',
      rou: {
        opening: { value: null, status: 'NOT_CALCULABLE' },
        initialRecognitionAdditions: { value: 0, status: 'ZERO_CONFIRMED', currency: 'TRY' },
        subsequentAdditions: { value: null, status: 'NOT_SUPPORTED' },
        depreciation: { value: 17.12345, status: 'SUPPORTED', currency: 'TRY' },
        modifications: { value: null, status: 'NOT_SUPPORTED' },
        remeasurements: { value: null, status: 'NOT_SUPPORTED' },
        tms29Movement: { value: null, status: 'NOT_CALCULABLE' },
        closing: { value: 91.23456, status: 'SUPPORTED', currency: 'TRY' }
      },
      liability: {
        opening: { value: null, status: 'NOT_CALCULABLE' },
        initialRecognitionAdditions: { value: 19.45678, status: 'SUPPORTED', currency: 'TRY' },
        interest: { value: 8.731, status: 'SUPPORTED', currency: 'TRY' },
        scheduledContractualCash: { value: null, status: 'NOT_PROVIDED' },
        actualCashOutflow: { value: null, status: 'REQUIRES_LEDGER_DATA' },
        modifications: { value: null, status: 'NOT_SUPPORTED' },
        remeasurements: { value: null, status: 'NOT_SUPPORTED' },
        tms21Movement: { value: null, status: 'NOT_SUPPORTED' },
        closing: { value: 80.45678, status: 'SUPPORTED', currency: 'TRY' }
      }
    },
    validation: { status: 'INCOMPLETE_INPUT_REQUIRED' }
  };
}

test('authenticated adapter discovers server-owned IDs and posts exact DISC payload', async () => {
  const calls = [];
  const window = {
    tfrs16GetToken: () => 'TEST-TOKEN-ONLY',
    setTimeout, clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ success: true,
        data: calls.length === 1 ? {
          companyId: 'COMPANY-1', reportingPeriodStart: '2026-01-01',
          reportingPeriodEnd: '2026-12-31', reportingDate: '2026-12-31',
          populationId: 'POP-TEST', contractIds: ['CONTRACT-1'], calculationIds: ['CALC-1'],
          sourceTrustStatus: 'TRUSTED_SOURCE_IDENTIFIERS_VERIFIED'
        } : { validation: { status: 'INCOMPLETE_INPUT_REQUIRED' } }
      }) };
    }
  };
  load('js/private-calculation-api.js', window);
  load('js/private-tfrs16-facade.js', window);
  const availability = await window.LeaseQantPrivateTfrs16Facade.loadLeaseDisclosureAvailability({
    companyId: 'COMPANY-1', reportingPeriodStart: '2026-01-01',
    reportingPeriodEnd: '2026-12-31', reportingDate: '2026-12-31'
  });
  await window.LeaseQantPrivateTfrs16Facade.loadLeaseDisclosure(availability);
  assert.match(calls[0].url, /\/api\/reports\/lease-disclosure\/availability\?/);
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[1].url, 'https://api.leaseqant.com/api/reports/lease-disclosure');
  assert.equal(calls[1].options.method, 'POST');
  assert.equal(calls[1].options.credentials, 'include');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer TEST-TOKEN-ONLY');
  assert.deepEqual(JSON.parse(calls[1].options.body), {
    companyId: 'COMPANY-1', reportingPeriodStart: '2026-01-01',
    reportingPeriodEnd: '2026-12-31', reportingDate: '2026-12-31',
    populationId: 'POP-TEST', contractIds: ['CONTRACT-1'], calculationIds: ['CALC-1']
  });
});

test('trusted source producer uses only the existing authenticated execute and snapshot routes', async () => {
  const calls = [];
  const window = {
    tfrs16GetToken: () => 'TEST-TOKEN-ONLY', setTimeout, clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options });
      const data = calls.length === 1
        ? { calculationId: 'EXEC-111', eligibleForDisclosureSnapshot: true, replayed: false }
        : { snapshotId: 'D1S-EXEC-111', trustedExecutionId: 'EXEC-111', replayed: false };
      return { ok: true, status: calls.length === 1 ? 200 : 201,
        json: async () => ({ success: true, data }) };
    }
  };
  load('js/private-calculation-api.js', window);
  load('js/private-tfrs16-facade.js', window);
  const period = { reportingPeriodStart: '2026-01-01', reportingPeriodEnd: '2026-06-30', reportingDate: '2026-06-30' };
  const result = await window.LeaseQantPrivateTfrs16Facade.createTrustedDisclosureSnapshots(['111'], period);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), [{ contractId: '111', success: true,
    calculationId: 'EXEC-111', snapshotId: 'D1S-EXEC-111', replayed: false }]);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, 'https://api.leaseqant.com/api/calculations/lease/111/execute');
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.credentials, 'include');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer TEST-TOKEN-ONLY');
  assert.deepEqual(JSON.parse(calls[0].options.body), period);
  assert.equal(calls[1].url, 'https://api.leaseqant.com/api/reports/lease-disclosure/snapshots');
  assert.deepEqual(JSON.parse(calls[1].options.body), { trustedExecutionId: 'EXEC-111' });
});

test('trusted source producer never snapshots an execution the server marks ineligible', async () => {
  let requests = 0;
  const window = {
    tfrs16GetToken: () => 'TEST-TOKEN-ONLY', setTimeout, clearTimeout,
    fetch: async () => { requests += 1; return { ok: true, status: 200,
      json: async () => ({ success: true, data: { calculationId: 'EXEC-UNSUPPORTED', eligibleForDisclosureSnapshot: false } }) }; }
  };
  load('js/private-calculation-api.js', window);
  load('js/private-tfrs16-facade.js', window);
  const results = await window.LeaseQantPrivateTfrs16Facade.createTrustedDisclosureSnapshots(['111'], {
    reportingPeriodStart: '2026-01-01', reportingPeriodEnd: '2026-06-30', reportingDate: '2026-06-30'
  });
  assert.equal(requests, 1, 'the snapshot route must not be called after an ineligible execution');
  assert.deepEqual(JSON.parse(JSON.stringify(results)), [{ contractId: '111', success: false, code: 'DISCLOSURE_TRUSTED_EXECUTION_NOT_ELIGIBLE' }]);
});

test('source statuses and exact values survive UI projection and export', () => {
  let exported;
  const window = { XLSX: { utils: {
    book_new: () => ({}), json_to_sheet: rows => { exported = rows; return rows; },
    book_append_sheet: () => {}
  }, writeFile: () => {} } };
  load('js/tfrs16-disclosure-ui.js', window);
  const ui = window.LeaseQantTfrs16DisclosureUi;
  const pkg = fixture({ reportingPeriodStart: '2026-01-01', reportingPeriodEnd: '2026-12-31', reportingDate: '2026-12-31' });
  const asset = ui.rowsForTab(pkg, 'asset');
  const liability = ui.rowsForTab(pkg, 'liability');
  const liquidity = ui.rowsForTab(pkg, 'liquidity');
  assert.equal(asset.find(row => row.label.includes('kapanış')).value, 91.23456);
  assert.equal(asset.find(row => row.label.includes('açılış')).status, 'NOT_CALCULABLE');
  assert.equal(asset.find(row => row.label.includes('Varlık sınıfına göre kapanış')).status, 'REQUIRES_ENTITY_INPUT');
  assert.equal(liability.find(row => row.label.includes('nakit çıkışı')).status, 'REQUIRES_LEDGER_DATA');
  assert.equal(liability.find(row => row.label.includes('İlk muhasebeleştirme')).value, 19.45678);
  assert.equal(liability.find(row => row.label.includes('Planlanan')).status, 'NOT_PROVIDED');
  assert.equal(asset.some(row => row.status === 'BACKEND_FIELD_MISSING'), false);
  assert.equal(liability.some(row => row.status === 'BACKEND_FIELD_MISSING'), false);
  assert.equal(liquidity.find(row => row.label.includes('Vade dilimleri')).value, null);
  assert.equal(liquidity.find(row => row.label.includes('Vade dilimleri')).status, 'REQUIRES_ENTITY_INPUT');
  ui.exportRows(asset, 'asset', pkg);
  assert.equal(exported.find(row => row.Kalem.includes('kapanış')).Tutar, 91.23456);
  assert.equal(exported.find(row => row.Kalem.includes('açılış')).Tutar, null);
  assert.equal(exported.find(row => row.Kalem.includes('Varlık sınıfına göre kapanış')).Durum, 'REQUIRES_ENTITY_INPUT');
});

test('trusted opening values keep identical raw precision in view and export', () => {
  let exported;
  const window = { XLSX: { utils: {
    book_new: () => ({}), json_to_sheet: rows => { exported = rows; return rows; },
    book_append_sheet: () => {}
  }, writeFile: () => {} } };
  load('js/tfrs16-disclosure-ui.js', window);
  const ui = window.LeaseQantTfrs16DisclosureUi;
  const pkg = fixture({ reportingPeriodStart: '2026-01-01', reportingPeriodEnd: '2026-12-31', reportingDate: '2026-12-31' });
  pkg.periodMovement.sourceRouteStatus = 'P1_TRUSTED_OPENING_CLOSING';
  pkg.periodMovement.rou.opening = { value: 26977.248228282493, status: 'SUPPORTED', currency: 'TRY' };
  pkg.periodMovement.liability.opening = { value: 27801.122659154174, status: 'SUPPORTED', currency: 'TRY' };
  const asset = ui.rowsForTab(pkg, 'asset');
  const liability = ui.rowsForTab(pkg, 'liability');
  assert.equal(asset.find(row => row.label.includes('varlığı — açılış')).value,
    pkg.periodMovement.rou.opening.value);
  assert.equal(liability.find(row => row.label.includes('yükümlülüğü — açılış')).value,
    pkg.periodMovement.liability.opening.value);
  ui.exportRows(asset, 'asset', pkg);
  assert.equal(exported.find(row => row.Kalem.includes('varlığı — açılış')).Tutar,
    pkg.periodMovement.rou.opening.value);
  ui.exportRows(liability, 'liability', pkg);
  assert.equal(exported.find(row => row.Kalem.includes('yükümlülüğü — açılış')).Tutar,
    pkg.periodMovement.liability.opening.value);
  pkg.periodMovement.rou.opening = { value: null, status: 'NOT_DISCLOSURE_READY' };
  const missing = ui.rowsForTab(pkg, 'asset').find(row => row.label.includes('varlığı — açılış'));
  assert.equal(missing.value, null);
  assert.equal(missing.status, 'NOT_DISCLOSURE_READY');
});

test('active Dipnotlar delegates only to disclosure UI, without old accounting helpers', async () => {
  const source = fs.readFileSync(path.join(root, 'js/tfrs16-reporting-ui.js'), 'utf8');
  const active = source.slice(source.indexOf('  function renderFootnotes(container) {'),
    source.indexOf('  function renderAuditTrailBody(container) {'));
  for (const forbidden of ['prepareFinancialReportingData', 'getRuoAssetRollForwardReport',
    'getLeaseLiabilityRollForwardReport', 'getLeasePaymentMaturityAnalysis', 'loadTms29Many']) {
    assert.equal(active.includes(forbidden), false, forbidden);
  }
  assert.match(active, /disclosure\.renderFootnotes\(container\)/);
  assert.match(fs.readFileSync(path.join(root, 'tfrs16.html'), 'utf8'), /tfrs16-disclosure-ui\.js/);

  let requestedPeriod;
  const calls = [];
  const window = {
    GK_TFRS16: {
      getUnifiedCompanyOptions: () => [{ id: 'COMPANY-1', name: 'Test Şirketi' }],
      getActiveCompanyId: () => 'COMPANY-1',
      prepareFinancialReportingData: () => { throw new Error('Legacy disclosure path called'); },
      setActiveScreenRefreshCallback: () => {}
    },
    LeaseQantPrivateTfrs16Facade: {
      loadLeaseDisclosureAvailability: async requested => {
        calls.push('availability');
        requestedPeriod = requested;
        return { ...requested, populationId: 'POP-TEST', contractIds: ['CONTRACT-1'],
          calculationIds: ['CALC-1'], sourceTrustStatus: 'TRUSTED_SOURCE_IDENTIFIERS_VERIFIED',
          currencyProfile: { presentationCurrency: 'TRY', evidenceId: 'CURRENCY-TEST' } };
      },
      loadLeaseDisclosure: async () => { calls.push('disclosure'); return fixture(requestedPeriod); }
    }
  };
  load('js/tfrs16-disclosure-ui.js', window);
  const container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  window.LeaseQantTfrs16DisclosureUi.renderFootnotes(container);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['availability', 'disclosure']);
  assert.match(container.innerHTML, /Kullanım hakkı varlığı/);
  assert.match(container.innerHTML, /91,23/);
  assert.match(container.innerHTML, /Güvenilir hesaplama kaynağı gerekli/);
});

test('adapter errors preserve auth/scope/source status without a numeric fallback', async () => {
  const window = { tfrs16GetToken: () => null, setTimeout, clearTimeout,
    fetch: async () => ({ ok: false, status: 403,
      json: async () => ({ success: false, code: 'DISCLOSURE_COMPANY_ACCESS_DENIED' }) }) };
  load('js/private-calculation-api.js', window);
  await assert.rejects(window.LeaseQantPrivateCalculation.getLeaseDisclosureAvailability({
    companyId: 'OTHER', reportingPeriodStart: '2026-01-01',
    reportingPeriodEnd: '2026-12-31', reportingDate: '2026-12-31'
  }), error => error.status === 403 && error.code === 'DISCLOSURE_COMPANY_ACCESS_DENIED');
  load('js/tfrs16-disclosure-ui.js', window);
  const ui = window.LeaseQantTfrs16DisclosureUi;
  assert.equal(ui.errorLabel({ status: 401 }), 'Oturum açmanız gerekiyor.');
  assert.equal(ui.errorLabel({ status: 403 }), 'Bu şirketin dipnotlarına erişim yetkiniz yok.');
  assert.equal(ui.errorLabel({ code: 'DISCLOSURE_TRUSTED_SOURCE_REQUIRED' }), 'Seçilen dönem için doğrulanmış dipnot hesaplama kaydı bulunamadı. Dipnotlar yalnızca onaylı, kaynak bağlı hesaplama kaydı bulunduğunda gösterilir.');
});

test('disclosure uses a complete month by default and blocks reversed date ranges before source lookup', async () => {
  const calls = [], dom = new JSDOM('<main id="footnotes"></main>', { url: 'https://example.test/tfrs16.html' });
  const window = dom.window;
  window.GK_TFRS16 = {
    getUnifiedCompanyOptions: () => [{ id: 'COMPANY-1', name: 'Synthetic Test' }],
    getActiveCompanyId: () => 'COMPANY-1', setActiveScreenRefreshCallback: () => {}
  };
  window.LeaseQantPrivateTfrs16Facade = {
    loadLeaseDisclosureAvailability: async period => { calls.push({ ...period });
      throw Object.assign(new Error('Missing test source'), { code: 'DISCLOSURE_TRUSTED_SOURCE_REQUIRED' }); },
    loadLeaseDisclosure: async () => { throw new Error('Not reached'); }
  };
  load('js/tfrs16-disclosure-ui.js', window);
  const ui = window.LeaseQantTfrs16DisclosureUi, target = window.document.getElementById('footnotes');
  assert.equal(ui.validPeriodRange('2026-08-01', '2026-08-31'), true);
  assert.equal(ui.validPeriodRange('2026-09-01', '2026-06-30'), false);
  ui.renderFootnotes(target);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(calls[0], { companyId: 'COMPANY-1', reportingPeriodStart: '2026-08-01',
    reportingPeriodEnd: '2026-08-31', reportingDate: '2026-08-31' });
  assert.match(target.querySelector('[role="status"]').textContent, /onaylı, kaynak bağlı hesaplama kaydı/);
  assert.equal(target.querySelector('[role="alert"]'), null);
  const start = target.querySelector('#disclosureStart'), end = target.querySelector('#disclosureDate');
  start.value = '2026-09-01'; start.dispatchEvent(new window.Event('change', { bubbles: true }));
  end.value = '2026-06-30'; end.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls.length, 1);
  assert.match(target.querySelector('[role="alert"]').textContent, /başlangıcı, dönem sonundan sonra olamaz/);
});

test('trusted source generation is an explicit click and reloads only after the server accepts it', async () => {
  const calls = [], dom = new JSDOM('<main id="footnotes"></main>', { url: 'https://example.test/tfrs16.html' });
  const window = dom.window;
  let sourcesCreated = false;
  const periodContract = { id: '111', companyId: 'COMPANY-1', startDate: '2025-02-28', endDate: '2030-02-28' };
  window.GK_TFRS16 = {
    getUnifiedCompanyOptions: () => [{ id: 'COMPANY-1', name: 'Financial Intelligence Platform' }],
    getActiveCompanyId: () => 'COMPANY-1', getPortfolioContracts: () => [periodContract],
    setActiveScreenRefreshCallback: () => {}
  };
  window.LeaseQantPrivateTfrs16Facade = {
    loadLeaseDisclosureAvailability: async period => {
      calls.push({ type: 'availability', ...period });
      if (!sourcesCreated) throw Object.assign(new Error('No trusted source'), { code: 'DISCLOSURE_TRUSTED_SOURCE_REQUIRED' });
      return { ...period, populationId: 'POP-TEST', contractIds: ['111'], calculationIds: ['EXEC-111'],
        sourceTrustStatus: 'TRUSTED_SOURCE_IDENTIFIERS_VERIFIED',
        currencyProfile: { presentationCurrency: 'TRY', evidenceId: 'CURRENCY-TEST' } };
    },
    loadLeaseDisclosure: async availability => ({
      ...fixture(availability), identity: { ...fixture(availability).identity, companyId: availability.companyId },
      population: { ...fixture(availability).population, populationId: availability.populationId,
        includedContractIds: availability.contractIds, includedCalculationIds: availability.calculationIds }
    }),
    createTrustedDisclosureSnapshots: async (ids, period) => {
      calls.push({ type: 'produce', ids: [...ids], ...period });
      sourcesCreated = true;
      return [{ contractId: '111', success: true, calculationId: 'EXEC-111', snapshotId: 'D1S-EXEC-111' }];
    }
  };
  load('js/tfrs16-disclosure-ui.js', window);
  const container = window.document.getElementById('footnotes');
  window.LeaseQantTfrs16DisclosureUi.renderFootnotes(container);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(calls.some(call => call.type === 'produce'), false, 'page load must not create accounting sources');
  assert.ok(container.querySelector('#disclosureCreateTrustedSource'));
  const start = container.querySelector('#disclosureStart'), end = container.querySelector('#disclosureDate');
  start.value = '2026-01-01'; start.dispatchEvent(new window.Event('change', { bubbles: true }));
  end.value = '2026-06-30'; end.dispatchEvent(new window.Event('change', { bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 0));
  container.querySelector('#disclosureCreateTrustedSource').click();
  await new Promise(resolve => setTimeout(resolve, 10));
  const production = calls.find(call => call.type === 'produce');
  assert.deepEqual(production.ids, ['111']);
  assert.deepEqual({ reportingPeriodStart: production.reportingPeriodStart,
    reportingPeriodEnd: production.reportingPeriodEnd, reportingDate: production.reportingDate },
  { reportingPeriodStart: '2026-01-01', reportingPeriodEnd: '2026-06-30', reportingDate: '2026-06-30' });
  assert.match(container.textContent, /91,23/);
  assert.match(container.textContent, /Güvenilir snapshot/);
});

test('trusted source generation excludes contracts outside the selected company and period', async () => {
  const dom = new JSDOM('<main id="footnotes"></main>', { url: 'https://example.test/tfrs16.html' });
  const window = dom.window;
  window.GK_TFRS16 = {
    getUnifiedCompanyOptions: () => [{ id: 'COMPANY-1' }], getActiveCompanyId: () => 'COMPANY-1',
    getPortfolioContracts: () => [
      { id: 'FOREIGN', companyId: 'COMPANY-2', startDate: '2025-01-01', endDate: '2030-01-01' },
      { id: 'OUTSIDE', companyId: 'COMPANY-1', startDate: '2027-01-01', endDate: '2030-01-01' }
    ], setActiveScreenRefreshCallback: () => {}
  };
  window.LeaseQantPrivateTfrs16Facade = {
    loadLeaseDisclosureAvailability: async () => { throw Object.assign(new Error('No source'), { code: 'DISCLOSURE_TRUSTED_SOURCE_REQUIRED' }); },
    loadLeaseDisclosure: async () => { throw new Error('Not reached without a trusted source'); },
    createTrustedDisclosureSnapshots: async () => { throw new Error('No in-scope source may be sent'); }
  };
  load('js/tfrs16-disclosure-ui.js', window);
  const container = window.document.getElementById('footnotes');
  window.LeaseQantTfrs16DisclosureUi.renderFootnotes(container);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(container.querySelector('#disclosureCreateTrustedSource'), container.innerHTML);
  assert.equal(container.querySelector('#disclosureCreateTrustedSource').disabled, true);
  assert.match(container.textContent, /Bu dönem için sözleşme kapsamı yok/);
});

test('unsupported trusted route is displayed and does not render invented disclosure amounts', async () => {
  const dom = new JSDOM('<main id="footnotes"></main>', { url: 'https://example.test/tfrs16.html' });
  const window = dom.window;
  window.GK_TFRS16 = {
    getUnifiedCompanyOptions: () => [{ id: 'COMPANY-1' }], getActiveCompanyId: () => 'COMPANY-1',
    getPortfolioContracts: () => [{ id: '111', companyId: 'COMPANY-1', startDate: '2025-01-01', endDate: '2030-01-01' }],
    setActiveScreenRefreshCallback: () => {}
  };
  window.LeaseQantPrivateTfrs16Facade = {
    loadLeaseDisclosureAvailability: async () => { throw Object.assign(new Error('No source'), { code: 'DISCLOSURE_TRUSTED_SOURCE_REQUIRED' }); },
    loadLeaseDisclosure: async () => { throw new Error('Not reached without a trusted source'); },
    createTrustedDisclosureSnapshots: async () => [{ contractId: '111', success: false, code: 'TRUSTED_ROUTE_UNSUPPORTED' }]
  };
  load('js/tfrs16-disclosure-ui.js', window);
  const container = window.document.getElementById('footnotes');
  window.LeaseQantTfrs16DisclosureUi.renderFootnotes(container);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.ok(container.querySelector('#disclosureCreateTrustedSource'), container.innerHTML);
  container.querySelector('#disclosureCreateTrustedSource').click();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(container.textContent, /TRUSTED_ROUTE_UNSUPPORTED/);
  assert.doesNotMatch(container.textContent, /91,23/);
  assert.ok(container.querySelector('[role="status"]'));
});

test('all three tabs render backend values; company and period controls reload the scoped package', async () => {
  const events = {};
  const container = {
    innerHTML: '',
    querySelector: selector => ({ addEventListener: (_event, listener) => { events[selector] = listener; } }),
    querySelectorAll: () => ['asset', 'liability', 'liquidity'].map(disclosureTab => ({
      dataset: { disclosureTab },
      addEventListener: (_event, listener) => { events[`tab:${disclosureTab}`] = listener; }
    }))
  };
  const requests = [];
  const window = {
    GK_TFRS16: {
      getUnifiedCompanyOptions: () => [{ id: 'COMPANY-1' }, { id: 'COMPANY-2' }],
      getActiveCompanyId: () => 'COMPANY-1', setActiveScreenRefreshCallback: () => {}
    },
    LeaseQantPrivateTfrs16Facade: {
      loadLeaseDisclosureAvailability: async period => {
        requests.push({ ...period });
        return { ...period, populationId: 'POP-TEST', contractIds: ['CONTRACT-1'],
          calculationIds: ['CALC-1'], sourceTrustStatus: 'TRUSTED_SOURCE_IDENTIFIERS_VERIFIED',
          currencyProfile: { presentationCurrency: 'TRY', evidenceId: 'CURRENCY-TEST' } };
      },
      loadLeaseDisclosure: async availability => ({
        ...fixture(availability), identity: { ...fixture(availability).identity, companyId: availability.companyId }
      })
    }
  };
  load('js/tfrs16-disclosure-ui.js', window);
  window.LeaseQantTfrs16DisclosureUi.renderFootnotes(container);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.match(container.innerHTML, /91,23/);
  events['tab:liability']();
  assert.match(container.innerHTML, /80,46/);
  assert.match(container.innerHTML, /Defter verisi gerekli/);
  events['tab:liquidity']();
  assert.match(container.innerHTML, /Vade dilimleri/);
  assert.match(container.innerHTML, /Şirket girdisi gerekli/);
  events['#disclosureCompany']({ target: { value: 'COMPANY-2' } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.at(-1).companyId, 'COMPANY-2');
  events['#disclosureStart']({ target: { value: '2026-01-01' } });
  await new Promise(resolve => setTimeout(resolve, 0));
  events['#disclosureDate']({ target: { value: '2026-06-30' } });
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(requests.at(-1).reportingDate, '2026-06-30');
});

test('disclosure response from a different company is rejected before any value is shown', async () => {
  const window = {
    GK_TFRS16: { getUnifiedCompanyOptions: () => [{ id: 'COMPANY-1' }],
      getActiveCompanyId: () => 'COMPANY-1' },
    LeaseQantPrivateTfrs16Facade: {
      loadLeaseDisclosureAvailability: async period => ({ ...period,
        populationId: 'POP-TEST', contractIds: ['CONTRACT-1'], calculationIds: ['CALC-1'],
        currencyProfile: { presentationCurrency: 'TRY', evidenceId: 'CURRENCY-TEST' } }),
      loadLeaseDisclosure: async availability => ({ ...fixture(availability),
        identity: { ...fixture(availability).identity, companyId: 'OTHER-COMPANY' } })
    }
  };
  load('js/tfrs16-disclosure-ui.js', window);
  const container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  window.LeaseQantTfrs16DisclosureUi.renderFootnotes(container);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.doesNotMatch(container.innerHTML, /91,23/);
  assert.match(container.innerHTML, /Dipnot paketi alınamadı/);
});

test('v2 source gaps include qualitative inputs and support requirements without inventing amounts',()=>{
 const window={};load('js/tfrs16-disclosure-ui.js',window);
 const gaps=window.LeaseQantTfrs16DisclosureUi.sourceGaps({missingInputs:[{fieldId:'totalCashOutflowForLeases',status:'REQUIRES_LEDGER_DATA'},{fieldId:'totalCashOutflowForLeases',status:'REQUIRES_LEDGER_DATA'}],qualitative:{leasingActivity:{status:'REQUIRES_ENTITY_INPUT'},shortTermElection:{status:'NOT_APPLICABLE'}},supportStatus:[{requirementId:'IFRS-UNSUPPORTED',supportedStatus:'NOT_SUPPORTED'},{requirementId:'IFRS-SUPPORTED',supportedStatus:'SUPPORTED'}]});
 assert.equal(gaps.length,3);assert.equal(gaps.find(g=>g.id==='totalCashOutflowForLeases').status,'REQUIRES_LEDGER_DATA');assert.ok(gaps.find(g=>g.id==='leasingActivity'));assert.ok(gaps.find(g=>g.id==='IFRS-UNSUPPORTED'));assert.ok(gaps.every(g=>!Object.hasOwn(g,'value')));
});

test('real v2 disclosure shows full source gaps separately from numerical table gaps',async()=>{
 const dom=new JSDOM('<html data-lq-ui="2"><body><main id="footnotes"></main></body></html>',{url:'https://example.test/tfrs16.html'}),window=dom.window;
 window.GK_TFRS16={getUnifiedCompanyOptions:()=>[{id:'COMPANY-1',name:'Synthetic Test'}],getActiveCompanyId:()=> 'COMPANY-1',setActiveScreenRefreshCallback:()=>{}};
 let requested;
 window.LeaseQantPrivateTfrs16Facade={loadLeaseDisclosureAvailability:async period=>{requested=period;return {...period,populationId:'POP-TEST',contractIds:['CONTRACT-1'],calculationIds:['CALC-1'],currencyProfile:{presentationCurrency:'TRY',evidenceId:'CURRENCY-TEST'}};},loadLeaseDisclosure:async()=>({...fixture(requested),validation:{status:'UNSUPPORTED_REQUIREMENT_PRESENT'},missingInputs:[{fieldId:'totalCashOutflowForLeases',status:'REQUIRES_LEDGER_DATA'}],qualitative:{leasingActivity:{status:'REQUIRES_ENTITY_INPUT'}},supportStatus:[{requirementId:'IFRS-UNSUPPORTED',supportedStatus:'NOT_SUPPORTED'}]})};
 load('js/tfrs16-disclosure-ui.js',window);const target=window.document.getElementById('footnotes');window.LeaseQantTfrs16DisclosureUi.renderFootnotes(target);await new Promise(r=>setTimeout(r,20));
 assert.match(target.textContent,/3 kaynak \/ destek gerekliliği/);assert.match(target.textContent,/Desteklenmeyen açıklama gerekliliği var/);assert.match(target.textContent,/Kiralama faaliyetinin niteliği/);assert.match(target.textContent,/Defter verisi gerekli/);
 assert.doesNotMatch(target.textContent,/Tüm kalemler kaynaklı|Motor · otomatik/);assert.equal(target.querySelectorAll('[data-disclosure-source-gaps] li').length,3);assert.equal(target.querySelector('[data-disclosure-source-gaps] input'),null);assert.match(target.textContent,/DISCLOSURE_BACKEND_IMPLEMENTED_NOT_CERTIFIED/);dom.window.close();
});

test('legacy disclosure presentation retains its existing structure',async()=>{
 const window={document:{documentElement:{getAttribute:()=> 'legacy'}},GK_TFRS16:{getUnifiedCompanyOptions:()=>[],getActiveCompanyId:()=>'',setActiveScreenRefreshCallback:()=>{}}};load('js/tfrs16-disclosure-ui.js',window);
 const target={innerHTML:'',querySelector:()=>null,querySelectorAll:()=>[]};window.LeaseQantTfrs16DisclosureUi.renderFootnotes(target);
 assert.match(target.innerHTML,/gk-v26-page/);assert.doesNotMatch(target.innerHTML,/data-disclosure-source-gaps/);
});

test('real backend support vocabulary separates capability from absent evidence',()=>{
 const window={};load('js/tfrs16-disclosure-ui.js',window);const sourceGaps=window.LeaseQantTfrs16DisclosureUi.sourceGaps;
 const pkg={missingInputs:[{fieldId:'totalCashOutflowForLeases',status:'REQUIRES_LEDGER_DATA'}],supportStatus:[{requirementId:'AUTO',supportedStatus:'SUPPORTED_AUTOMATIC'},{requirementId:'ENTITY',supportedStatus:'SUPPORTED_WITH_ENTITY_INPUT'},{requirementId:'LEDGER',supportedStatus:'SUPPORTED_WITH_LEDGER_INPUT'},{requirementId:'DISC',supportedStatus:'SUPPORTED_WITH_DISCLOSURE_INPUT'},{requirementId:'UNSUPPORTED',supportedStatus:'NOT_YET_SUPPORTED'},{requirementId:'BOUNDARY',supportedStatus:'OUT_OF_SCOPE'}]};
 const gaps=sourceGaps(pkg);assert.equal(gaps.map(x=>x.id).join(','),'totalCashOutflowForLeases,UNSUPPORTED,BOUNDARY');assert.equal(gaps[0].status,'REQUIRES_LEDGER_DATA');
 assert.equal(sourceGaps({supportStatus:[{requirementId:'UNKNOWN',supportedStatus:'FUTURE_UNKNOWN'}]}).length,1);
});
