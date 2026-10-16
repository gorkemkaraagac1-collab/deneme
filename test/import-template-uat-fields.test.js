'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { JSDOM } = require('jsdom');
const ui = fs.readFileSync(path.join(__dirname, '../js/tfrs16-ui.js'), 'utf8');

// UAT2: every contract input of the 15 cases can come from the Excel template.
test('the import template carries the UAT2 contract fields', () => {
  for (const column of ['Fonksiyonel Para Birimi', 'Restorasyon Para Birimi', 'Kalıntı Değer Garantisi', 'Beklenen Garanti Ödemesi',
    'Kira Bedelsiz Dönem Başlangıç', 'Kira Bedelsiz Dönem Bitiş', 'Satın Alma Opsiyon Bedeli', 'Yenileme Sonrası Bitiş Tarihi',
    'Varlığın Faydalı Ömrü (Yıl)', 'Peşin Ödemeler', 'Kiralayan Teşvikleri', 'Doğrudan İlk Maliyetler', 'Ödeme Frekansı']) {
    assert.match(ui, new RegExp(`"${column.replace(/[()]/g, '\\$&')}":`), column);
  }
});

test('the new columns are read and written to the contract', () => {
  // Alias, row mapping and contract write for each new field.
  for (const [key, header] of [['residualValueGuarantee', 'kalıntı değer garantisi'], ['expectedResidualValueGuaranteePayment', 'beklenen garanti ödemesi'],
    ['restorationObligationCurrency', 'restorasyon para birimi'], ['rentFreeStart', 'kira bedelsiz dönem başlangıç'], ['rentFreeEnd', 'kira bedelsiz dönem bitiş'],
    ['functionalCurrency', 'fonksiyonel para birimi']]) {
    assert.match(ui, new RegExp(`${key}: \\[[^\\]]*"${header}"`), `alias ${key}`);
    assert.match(ui, new RegExp(`${key}: (integration|normalizeIntegrationCurrency)`), `row mapping ${key}`);
  }
  assert.match(ui, /"expectedResidualValueGuaranteePayment", "restorationObligationCurrency"\]/);
  assert.match(ui, /base\.residualValueGuarantee = data\.residualValueGuarantee === true/);
  assert.match(ui, /base\.rentFreePeriods = \[\{ startDate: data\.rentFreeStart, endDate: data\.rentFreeEnd/);
});
