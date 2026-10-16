'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');

test('C12-02: exportRowsFile writes the FX list as an .xlsx sheet', () => {
  const calls = [];
  const XLSX = { utils: { book_new: () => ({ sheets: [] }), json_to_sheet: rows => ({ rows }),
    book_append_sheet: (book, sheet, name) => book.sheets.push({ name, rows: sheet.rows }) },
    writeFile: (book, file) => calls.push({ book, file }) };
  const window = { XLSX, document: {}, console };
  window.window = window;
  vm.createContext(window);
  vm.runInContext(`var XLSX = window.XLSX;\n${fs.readFileSync(path.join(__dirname, '../js/tfrs16-operations-ui.js'), 'utf8')}`, window);
  const ui = window.LeaseQantTfrs16OperationsUi;
  assert.equal(ui.exportRowsFile({ fileBase: 'LeaseQant_Kurlar_X', sheetName: 'Kurlar', rows: [] }), false);
  assert.equal(ui.exportRowsFile({ fileBase: 'LeaseQant_Kurlar_X', sheetName: 'Kurlar', rows: [{ Tarih: '2025-01-02', Kur: 35.28 }] }), true);
  assert.equal(calls[0].file, 'LeaseQant_Kurlar_X.xlsx');
  assert.equal(calls[0].book.sheets[0].name, 'Kurlar');
  assert.equal(calls[0].book.sheets[0].rows[0].Kur, 35.28);
});
