'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

// The stale-tab reference compares server rows per contract, so this tab's
// own save does not hide a change another tab made to a different contract.
const source = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');
const start = source.indexOf('  const contractRowSignatures =');
const end = source.indexOf('  // This tab already holds its own write');
const context = { backendContractsSignature: null };
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}\nthis.contractRowSignatures = contractRowSignatures; this.changedContractIds = changedContractIds;`, context);

test('own write is ignored, other contracts changed elsewhere are reported', () => {
  const before = [{ id: 'A', monthly_payment: 10 }, { id: 'B', monthly_payment: 16 }];
  context.backendContractsSignature = context.contractRowSignatures(before);
  const after = [{ id: 'A', monthly_payment: 11 }, { id: 'B', monthly_payment: 18 }];
  assert.deepEqual([...context.changedContractIds(after, 'A')], ['B']);
  assert.deepEqual([...context.changedContractIds([{ id: 'A', monthly_payment: 11 }, before[1]], 'A')], []);
});

test('added and removed contracts count as changes', () => {
  context.backendContractsSignature = context.contractRowSignatures([{ id: 'A' }]);
  assert.deepEqual([...context.changedContractIds([{ id: 'A' }, { id: 'C' }])], ['C']);
  assert.deepEqual([...context.changedContractIds([])], ['A']);
});
