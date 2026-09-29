'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../js/lq-ui-v2.js'), 'utf8');
function runtime(markup) {
  const dom = new JSDOM(markup, { url: 'https://leaseqant.com/tfrs16.html', runScripts: 'outside-only' });
  dom.window.eval(source);
  return dom;
}
const tick = () => new Promise(resolve => setTimeout(resolve, 0));

test('v2 shares accessible empty, loading, error, unauthorized and blocked states', () => {
  const dom = runtime(`<!doctype html><html data-lq-ui="2"><body><main id="mainContent">
    <p class="lq-pg-empty">Henüz sözleşme bulunmuyor.</p>
    <p role="alert">Rapor şu anda gösterilemiyor.</p>
    <p>Kaynak gerekli; tutar gösterilmiyor.</p>
    <p>403 — Bu şirket için yetkiniz yok.</p>
    <div class="lq-cv-kpis is-loading" aria-busy="true">Bekleniyor</div>
    <p class="lq-pg-emptyrow"><strong>Bu görünümde sözleşme yok</strong></p>
    <div id="lqTotalLiability">₺ 1.234,56</div>
  </main></body></html>`);
  const { document } = dom.window;
  const states = dom.window.LeaseQantUiV2States;
  assert.ok(states);
  states.scan(document);

  const byText = text => Array.from(document.querySelectorAll('#mainContent *')).find(el => el.textContent.trim() === text);
  const empty = document.querySelector('.lq-pg-empty');
  const error = document.querySelector('[role="alert"]');
  const blocked = byText('Kaynak gerekli; tutar gösterilmiyor.');
  const unauthorized = byText('403 — Bu şirket için yetkiniz yok.');
  const loading = document.querySelector('.lq-cv-kpis');
  const emptyRow = document.querySelector('.lq-pg-emptyrow');
  assert.equal(empty.dataset.lqUiState, 'empty');
  assert.equal(empty.getAttribute('aria-live'), 'polite');
  assert.equal(error.dataset.lqUiState, 'error');
  assert.equal(error.getAttribute('aria-live'), 'assertive');
  assert.equal(blocked.dataset.lqUiState, 'blocked');
  assert.equal(unauthorized.dataset.lqUiState, 'unauthorized');
  assert.equal(unauthorized.getAttribute('role'), 'alert');
  assert.equal(loading.dataset.lqUiState, 'loading');
  assert.equal(loading.getAttribute('aria-busy'), 'true');
  assert.equal(emptyRow.dataset.lqUiState, 'empty');

  const amount = document.getElementById('lqTotalLiability');
  assert.equal(amount.textContent, '₺ 1.234,56');
  assert.equal(amount.hasAttribute('data-lq-ui-state'), false);
  dom.window.close();
});

test('state transitions restore original ARIA and leave amount text untouched', async () => {
  const dom = runtime(`<!doctype html><html data-lq-ui="2"><body>
    <main id="mainContent"><p id="liveState" class="lq-pg-empty">Bu dönemde kayıt yok.</p>
      <div id="lqTotalLiability">Veri henüz hazır değil</div></main>
  </body></html>`);
  const { document } = dom.window;
  document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  const state = document.getElementById('liveState');
  const amount = document.getElementById('lqTotalLiability');
  assert.equal(amount.textContent, 'Veri henüz hazır değil');
  assert.equal(amount.dataset.lqState, 'status');

  state.textContent = 'Rapor paketine göre 2 kontrol tamamlandı.';
  await tick();
  assert.equal(state.hasAttribute('data-lq-ui-state'), false);
  assert.equal(state.getAttribute('role'), null);
  assert.equal(state.getAttribute('aria-live'), null);

  amount.textContent = '₺ 1.234,56';
  await tick();
  assert.equal(amount.textContent, '₺ 1.234,56');
  assert.equal(amount.dataset.lqState, 'value');
  assert.equal(amount.hasAttribute('data-lq-ui-state'), false);
  dom.window.close();
});

test('legacy mode receives no shared-state helper or DOM changes', () => {
  const dom = runtime(`<!doctype html><html data-lq-ui="legacy"><body><main id="mainContent">
    <p class="lq-pg-empty">Henüz sözleşme bulunmuyor.</p>
  </main></body></html>`);
  const empty = dom.window.document.querySelector('.lq-pg-empty');
  assert.equal(dom.window.LeaseQantUiV2States, undefined);
  assert.equal(empty.hasAttribute('data-lq-ui-state'), false);
  assert.equal(empty.getAttribute('role'), null);
  assert.equal(empty.classList.contains('lq-v2-state'), false);
  dom.window.close();
});
