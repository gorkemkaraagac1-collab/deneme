'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../js/tfrs16-report-authority-ui.js'), 'utf8');

test('C12-04: translated schedule rows become flat presentation columns', () => {
  const m = /function presentationColumns\(t\)\{[\s\S]*?\n \}/.exec(src);
  assert.ok(m, 'presentationColumns helper present');
  const ctx = {}; vm.createContext(ctx); vm.runInContext(m[0], ctx);
  const cols = ctx.presentationColumns({ currency: 'TRY', rate: 35.28, openingLiability: 1, interest: 2, payment: 3, closingLiability: 4, fxDifference: 5 });
  assert.equal(cols.presentationRate, 35.28);
  assert.equal(cols.presentationFxDifference, 5);
  assert.equal(ctx.presentationColumns(null).presentationClosingLiability, null);
  assert.match(src, /all\.some\(x=>'presentation' in x\)/);
});
