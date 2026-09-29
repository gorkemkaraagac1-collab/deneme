'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.resolve(__dirname, '..');
const workspaceHtml = fs.readFileSync(path.join(root, 'workspace.html'), 'utf8');
const workspaceJs = fs.readFileSync(path.join(root, 'js/workspace-v3.js'), 'utf8');
const workspaceCss = fs.readFileSync(path.join(root, 'css/workspace-v3.css'), 'utf8');
const entrypoint = fs.readFileSync(path.join(root, 'tfrs16.html'), 'utf8');

test('new workspace exposes every supported lessee screen and one company/period context', () => {
  const document = new JSDOM(workspaceHtml).window.document;
  const links = Array.from(document.querySelectorAll('[data-nav]')).map(node => node.dataset.nav);
  assert.deepEqual(links, ['overview', 'contracts', 'calculations', 'journals', 'disclosures', 'close']);
  assert.equal(document.querySelectorAll('#companySelect').length, 1);
  assert.equal(document.querySelectorAll('#periodStart').length, 1);
  assert.equal(document.querySelectorAll('#periodEnd').length, 1);
  assert.equal(document.querySelectorAll('#periodLockBadge').length, 1);
  assert.equal(document.querySelector('main#pageShell')?.getAttribute('tabindex'), '-1');
  assert.match(workspaceHtml, /aria-label="Ana menü"/);
});

test('trusted accounting adapters load before the new view and the retired public engine is not mounted', () => {
  const adapter = workspaceHtml.indexOf('js/private-calculation-api.js');
  const facade = workspaceHtml.indexOf('js/private-tfrs16-facade.js');
  const authority = workspaceHtml.indexOf('js/tfrs16-report-authority-ui.js');
  const workspace = workspaceHtml.indexOf('js/workspace-v3.js');
  assert.ok(adapter >= 0 && adapter < facade && facade < authority && authority < workspace);
  assert.equal(workspaceHtml.includes('js/tfrs16-ui.js'), false);
  assert.equal(workspaceHtml.includes('js/workspace-v3.js'), true);
  assert.match(workspaceJs, /LeaseQantPrivateCalculation\.calculate\(contract\)/);
  assert.match(workspaceJs, /getJournalAuthorityPackage\(intent, false\)/);
  assert.match(workspaceJs, /getLeaseDisclosureAvailability\(disclosureIntent\)/);
  assert.match(workspaceJs, /NOT_READY_FOR_LIVE_POSTING|Canlı muhasebe aktarımı kapalı/);
});

test('legacy entry-point only translates old links; all links open the new workspace', () => {
  assert.match(entrypoint, /window\.location\.replace\('workspace\.html'/);
  assert.match(entrypoint, /footnotes: 'disclosures'/);
  assert.match(entrypoint, /financialReporting: 'calculations'/);
  assert.match(entrypoint, /accountingCenter: 'journals'/);
  assert.match(entrypoint, /riskControls: 'close'/);
});

test('responsive styles retain a single column on phones and contain horizontally scrolling tables', () => {
  assert.match(workspaceCss, /@media \(max-width: 800px\)/);
  assert.match(workspaceCss, /@media \(max-width: 500px\)/);
  assert.match(workspaceCss, /\.table-scroll[^\n]*overflow: auto/);
  assert.match(workspaceCss, /\.primary-nav/);
  assert.match(workspaceCss, /:focus-visible/);
});
