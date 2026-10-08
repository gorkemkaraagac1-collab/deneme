'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');
const parser = src.match(/function parseRentFreePeriods\(text\) \{[\s\S]*?\n {2}\}\n/)[0];
const normalizeDate = value => (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? value : null);
const parseRentFreePeriods = new Function('normalizeDate', `${parser}; return parseRentFreePeriods;`)(normalizeDate);

test('rent-free lines parse into dated periods; bad lines are reported, not dropped silently', () => {
  const { rows, errors } = parseRentFreePeriods('2025-01-01 | 2025-03-31 | İlk 3 ay kira ücretsiz\n\n2025-13-01 | 2025-14-01\n2026-05-01 | 2026-04-01');
  assert.deepEqual(rows, [{ line: '1.', startDate: '2025-01-01', endDate: '2025-03-31', description: 'İlk 3 ay kira ücretsiz' }]);
  assert.equal(errors.length, 2);
});

test('rent-free periods are saved in details, restored to the form and part of the calculation cache key', () => {
  assert.match(src, /rentFreePeriods: Array\.isArray\(details\.rentFreePeriods\) \? details\.rentFreePeriods : \[\]/, 'hydrated from the server row');
  assert.match(src, /rentFreePeriods: Array\.isArray\(contract\.rentFreePeriods\) \? contract\.rentFreePeriods : \[\],\n {6}initialDirectCosts/, 'sent in details');
  assert.match(src, /parseRentFreePeriods\(getInput\("rentFreePeriods"\)\)/, 'read from the form on save');
  assert.match(src, /setInput\(\n {6}"rentFreePeriods",/, 'written back to the form on edit');
  const cache = fs.readFileSync(path.join(__dirname, '../js/tfrs16-reporting-date-cache.js'), 'utf8');
  assert.match(cache, /rentFreePeriods: Array\.isArray\(contract\.rentFreePeriods\)/);
});
