'use strict';
// UAT CASE 15 (C15-04): a restoration provision can be held in its own
// currency (e.g. a TRY provision on a USD lease).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const ui = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../tfrs16.html'), 'utf8');
const cache = fs.readFileSync(path.join(__dirname, '../js/tfrs16-reporting-date-cache.js'), 'utf8');

test('restoration currency is a form field, saved in details, restored and part of the cache key', () => {
  assert.match(html, /<select id="restorationObligationCurrency" name="restorationObligationCurrency">[\s\S]*?<option value="TRY">TRY<\/option>/);
  assert.match(ui, /restorationObligationCurrency: details\.restorationObligationCurrency \|\| ""/, 'hydrated');
  assert.match(ui, /restorationObligationCurrency: contract\.restorationObligationCurrency \|\| "",\n {6}assetClass/, 'sent in details');
  assert.match(ui, /getInput\("restorationObligationCurrency"\)/, 'read on save');
  assert.match(ui, /setInput\(\n {6}"restorationObligationCurrency",/, 'written back on edit');
  assert.match(cache, /restorationObligationCurrency: contract\.restorationObligationCurrency/);
});
