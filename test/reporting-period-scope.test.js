'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../js/lq-reporting-period.js'), 'utf8');

function load(now = '2026-10-05T10:00:00') {
  const store = new Map(), local = new Map();
  const RealDate = Date;
  class FixedDate extends RealDate { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return new RealDate(now).getTime(); } }
  const window = { Date: FixedDate,
    sessionStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    localStorage: { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, v) } };
  window.window = window;
  vm.createContext(window);
  vm.runInContext(`var Date = this.Date;\n${source}`, window);
  return window.LeaseQantReportingPeriod;
}
const plain = v => JSON.parse(JSON.stringify(v));

test('single month stays the default', () => {
  const api = load();
  assert.deepEqual(plain(api.get()).periodStart, '2026-09-01');
  assert.equal(api.get().periodEnd, '2026-09-30');
  assert.equal(api.get().months, 1);
});

test('last 3 and 6 months end with the reporting month', () => {
  const api = load();
  api.setScope({ scope: 'QUARTER' });
  assert.equal(api.get().periodStart, '2026-07-01');
  api.setScope({ scope: 'HALF' });
  assert.equal(api.get().periodStart, '2026-04-01');
  assert.equal(api.get().months, 6);
});

test('fiscal year to date uses the chosen start month, across the calendar year', () => {
  const api = load();
  api.setScope({ scope: 'YTD', fiscalStart: 1 });
  assert.equal(api.get().periodStart, '2026-01-01');
  api.setScope({ scope: 'YTD', fiscalStart: 4 });
  assert.equal(api.get().periodStart, '2026-04-01');
  api.set('2026-02');
  assert.equal(api.get().periodStart, '2025-04-01');
  assert.equal(api.get().periodEnd, '2026-02-28');
});

test('custom start month; a start after the reporting month falls back to a single month', () => {
  const api = load();
  api.setScope({ scope: 'CUSTOM', customStart: '2025-11' });
  assert.equal(api.get().periodStart, '2025-11-01');
  api.set('2025-10');
  assert.equal(api.get().periodStart, '2025-10-01');
});

test('subscribers are told about a scope change', () => {
  const api = load();
  const seen = [];
  api.subscribe(value => seen.push(value.periodStart));
  api.setScope({ scope: 'QUARTER' });
  api.setScope({ scope: 'QUARTER' });
  assert.deepEqual(seen, ['2026-07-01']);
});
