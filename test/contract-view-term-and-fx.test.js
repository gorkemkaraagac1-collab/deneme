'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const src = fs.readFileSync(path.join(__dirname, '../js/lq-contract-view.js'), 'utf8');
const start = src.indexOf('  function monthsBetween(');
const monthsBetween = new Function(`${src.slice(start, src.indexOf('\n  }\n', start) + 4)}\nreturn monthsBetween;`)();

test('UAT3: lease term months count to the day before the anniversary', () => {
  assert.equal(monthsBetween('2025-01-01', '2025-12-31'), 12);
  assert.equal(monthsBetween('2025-01-01', '2029-12-31'), 60);
  assert.equal(monthsBetween('2025-04-20', '2030-04-19'), 60);
  assert.equal(monthsBetween('2025-01-15', '2030-01-14'), 60);
  assert.equal(monthsBetween('2025-01-31', '2025-02-28'), 1);
  assert.equal(monthsBetween('2025-01-10', '2025-03-25'), 3);
});

test('UAT3 C09: a foreign-currency lease shows the liability in its own currency', () => {
  assert.match(src, /fxTranslation\?\.rates[^\n]*rate\?\.date === r\.period\.reportingDate/);
  assert.match(src, /\$\{money\(sourceLiability\)\} \$\{sc\} · /);
});
