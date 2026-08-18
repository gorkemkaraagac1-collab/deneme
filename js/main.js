/**
 * GK Financial Intelligence Platform - UI Engine Integrator
 */

document.addEventListener('DOMContentLoaded', () => {
  renderCockpitKPIs();
  renderWorkingCapitalKPIs();
  renderValuationUI();
  bindValuationInputEvents();
});

// Render Executive Cockpit KPIs
function renderCockpitKPIs() {
  if (typeof FinancialEngine === 'undefined') return;

  const pnl = FinancialEngine.calculatePnl();
  const wc = FinancialEngine.calculateWorkingCapital();
  const fmt = FinancialEngine.formatters;

  const revEl = document.querySelector('[data-kpi="revenue"]');
  if (revEl) revEl.textContent = fmt.currency(FinancialEngine.getState().pnl.revenue);

  const ebitdaMarginEl = document.querySelector('[data-kpi="ebitda-margin"]');
  if (ebitdaMarginEl) ebitdaMarginEl.textContent = fmt.percent(pnl.ebitdaMargin);

  const cccEl = document.querySelector('[data-kpi="ccc"]');
  if (cccEl) cccEl.textContent = fmt.days(wc.ccc);
}

// Render Working Capital Engine Page
function renderWorkingCapitalKPIs() {
  if (typeof FinancialEngine === 'undefined') return;

  const wc = FinancialEngine.calculateWorkingCapital();
  const fmt = FinancialEngine.formatters;

  const dsoEl = document.querySelector('[data-kpi="dso"]');
  if (dsoEl) dsoEl.textContent = fmt.days(wc.dso);

  const dioEl = document.querySelector('[data-kpi="dio"]');
  if (dioEl) dioEl.textContent = fmt.days(wc.dio);

  const dpoEl = document.querySelector('[data-kpi="dpo"]');
  if (dpoEl) dpoEl.textContent = fmt.days(wc.dpo);

  const cccEl = document.querySelector('[data-kpi="wc-ccc"]');
  if (cccEl) cccEl.textContent = fmt.days(wc.ccc);
}

// Render DCF Engine Page Outputs
function renderValuationUI() {
  if (typeof FinancialEngine === 'undefined') return;

  const dcf = FinancialEngine.calculateValuation();
  const fmt = FinancialEngine.formatters;

  const evEl = document.querySelector('[data-val="ev"]');
  if (evEl) evEl.textContent = fmt.currency(dcf.enterpriseValue);

  const eqEl = document.querySelector('[data-val="equity"]');
  if (eqEl) eqEl.textContent = fmt.currency(dcf.equityValue);

  const netDebtEl = document.querySelector('[data-val="net-debt"]');
  if (netDebtEl) netDebtEl.textContent = fmt.currency(dcf.netDebt);
}

// Bind Dynamic Inputs on DCF Page
function bindValuationInputEvents() {
  if (typeof FinancialEngine === 'undefined') return;

  const bindings = [
    { id: '#wacc-input', category: 'valuation', key: 'wacc', transform: v => v / 100 },
    { id: '#terminal-growth-input', category: 'valuation', key: 'terminalGrowth', transform: v => v / 100 },
    { id: '#revenue-growth-input', category: 'valuation', key: 'revenueGrowth', transform: v => v / 100 },
    { id: '#net-debt-input', category: 'valuation', key: 'netDebt', transform: v => v }
  ];

  bindings.forEach(binding => {
    const inputEl = document.querySelector(binding.id);
    if (inputEl) {
      inputEl.addEventListener('input', (e) => {
        const rawValue = parseFloat(e.target.value);
        if (!isNaN(rawValue)) {
          const transformedValue = binding.transform(rawValue);
          FinancialEngine.updateState(binding.category, binding.key, transformedValue);
          renderValuationUI();
        }
      });
    }
  });
}
