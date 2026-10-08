'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const src = fs.readFileSync(path.join(__dirname, '../js/lq-pages.js'), 'utf8');

// UAT CASE 05: an index reassessment effective 01.01.2026 (recorded in
// October) must appear in the 2026-H1 event log from lifecycleEvents.
test('financial event log lists lifecycle events by effective date before the audit rows', () => {
  assert.match(src, /r\.v\.lifecycleEvents && r\.v\.lifecycleEvents\.rows/);
  assert.match(src, /MUHASEBE OLAYLARI \(YÜRÜRLÜK TARİHİNE GÖRE\)/);
  assert.match(src, /iskonto %/);
  assert.match(src, /\$\{changeHtml\}\$\{ev\.length/);
});
