const { loadTfrs16 } = require('./helpers/loadTfrs16');

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  loadTfrs16();
});
beforeEach(() => {
  localStorage.setItem('gk_tfrs16_v23_fx_rates_v1', JSON.stringify([
    { fromCurrency: 'EUR', toCurrency: 'TRY', rateDate: '2026-07-31', rateType: 'CLOSING', rate: 50, status: 'APPROVED' },
    { fromCurrency: 'USD', toCurrency: 'TRY', rateDate: '2026-07-31', rateType: 'CLOSING', rate: 40, status: 'APPROVED' }
  ]));
  document.body.innerHTML = '<input id="scheduleReportingDate" type="date" value="2026-07-31">';
});
const rows = [2025, 2027, 2030].map((year, i) => ({
  period: i+1, date: `${year}-01-01`, openingLiability: 1000, payment: 100,
  interest: 10, principal: 90, closingLiability: 910, depreciation: 80, rouClosing: 800
}));
test.each([['EUR', 50], ['USD', 40]])('%s payment plan uses selected report date for all periods', async (currency, rate) => {
  const result = await window.GK_TFRS16.v26ConvertScheduleToPresentation(rows, currency, 'TRY');
  expect(result.ok).toBe(true);
  expect(result.asOfDate).toBe('2026-07-31');
  expect(result.schedule.map(r => r.payment)).toEqual([100*rate,100*rate,100*rate]);
  expect(result.schedule.every(r => r.presentationFxOk)).toBe(true);
  expect(rows[0].payment).toBe(100);
});
test('non-business report date uses the latest earlier verified rate', async () => {
  const result = await window.GK_TFRS16.v26ConvertScheduleToPresentation(rows, 'EUR', 'TRY', '2026-08-02');
  expect(result.ok).toBe(true);
  expect(result.schedule[0].presentationFxOk).toBe(true);
  expect(result.schedule[0].payment).toBe(5000);
});
test('missing report date before first rate stays explicit and preserves source amounts', async () => {
  const result = await window.GK_TFRS16.v26ConvertScheduleToPresentation(rows, 'EUR', 'TRY', '2025-01-01');
  expect(result.ok).toBe(false);
  expect(result.schedule[0].presentationFxOk).toBe(false);
  expect(result.schedule[0].payment).toBe(100);
});
test('empty reporting date uses local today', async () => {
  document.getElementById('scheduleReportingDate').value = '';
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const result = await window.GK_TFRS16.v26ConvertScheduleToPresentation(rows, 'EUR', 'EUR');
  expect(result.asOfDate).toBe(today);
  expect(result.schedule[0].payment).toBe(100);
});
test('payment screen actually exposes a reporting date and feedback area', () => {
  const html = window.__TFRS16_TEST__.renderPaymentScheduleSection({ currency: 'EUR', startDate: '2025-01-01', endDate: '2030-01-01' });
  document.body.innerHTML = html;
  expect(document.getElementById('scheduleReportingDate').type).toBe('date');
  expect(document.getElementById('scheduleFxStatus')).not.toBeNull();
});
test('30 Haziran kapanışı 1 Temmuz ödeme satırını içermemeli', async () => {
  localStorage.setItem('gk_tfrs16_v23_fx_rates_v1', JSON.stringify([
    { fromCurrency: 'EUR', toCurrency: 'TRY', rateDate: '2026-04-01', rateType: 'CLOSING', rate: 50, status: 'APPROVED' },
    { fromCurrency: 'EUR', toCurrency: 'TRY', rateDate: '2026-06-30', rateType: 'CLOSING', rate: 53, status: 'APPROVED' },
    { fromCurrency: 'EUR', toCurrency: 'TRY', rateDate: '2026-07-01', rateType: 'CLOSING', rate: 54, status: 'APPROVED' }
  ]));
  const contract = { currency: 'EUR', functionalCurrency: 'TRY', startDate: '2026-04-01' };
  const result = await window.GK_TFRS16.buildTms21FxTranslation(contract, {
    schedule: [{ period: 1, date: new Date(2026, 6, 1), openingLiability: 1000, payment: 100, interest: 10, closingLiability: 910, rouOpening: 1000, depreciation: 10, rouClosing: 990 }]
  }, { reportingDate: new Date(2026, 5, 30) });
  expect(result.schedule).toHaveLength(0);
});
test.each(['EUR', 'USD'])('%s rendered payment cells populate in TRY at selected date', async currency => {
  const contract = { id: 'REPORT-FX', currency, company: 'Test', monthlyPayment: 100,
    startDate: '2026-01-01', endDate: '2028-12-31', discountRate: 6,
    paymentFrequency: 'monthly', paymentTiming: 'arrears' };
  document.body.innerHTML = window.__TFRS16_TEST__.renderPaymentScheduleSection(contract);
  document.getElementById('scheduleReportingDate').value = '2026-07-31';
  document.getElementById('schedulePresentationCurrency').value = 'TRY';
  await window.__TFRS16_TEST__.renderPaymentScheduleTable(contract);
  const body = document.getElementById('scheduleTableBody');
  expect(body.querySelectorAll('tr').length).toBeGreaterThan(0);
  expect(body.innerHTML).not.toContain('Kur bulunamadı');
  expect(document.getElementById('scheduleFxStatus').textContent).toContain('2026-07-31 kuruyla');
});
